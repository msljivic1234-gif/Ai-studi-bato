// Native authenticated bounded audio proxy. Provider key never leaves this Edge boundary.
import { releaseUnusedAiTestReservation, reserveAiTestBudget, settleAiTestAudio } from '../_shared/aiTestBudget.ts';
import { readSupabasePublishableKey, readSupabaseServiceKey, supabaseServiceHeaders } from '../_shared/supabaseKeys.mjs';
import { bridgeSpeech } from './proxy.ts';
// Supabase Edge background lifetimes are runtime-owned; no silent TypeScript escape.
declare const EdgeRuntime: { waitUntil(promise: Promise<unknown>): void };
declare const Deno: {
  env: { get(name: string): string | undefined };
  serve(handler: (request: Request) => Response | Promise<Response>): void;
  upgradeWebSocket(request: Request, options?: { idleTimeout?: number }): { socket: WebSocket; response: Response };
};

const uuid = (value: unknown): value is string => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
const deny = (status: number, code: string) => new Response(JSON.stringify({ code }), {
  status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
});

async function readBounded(url: string, headers: Record<string,string>, signal: AbortSignal, maxBytes: number, body?: unknown) {
  const controller = new AbortController();
  const stop = () => controller.abort();
  const timer = setTimeout(stop, 5000);
  signal.addEventListener('abort', stop, { once: true });
  if (signal.aborted) stop();
  const assertActive = () => { if (controller.signal.aborted) throw new Error('SPEECH_NOT_READY'); };
  try {
    assertActive();
    const response = await fetch(url, { headers, signal: controller.signal, redirect: 'error',
      method: body === undefined ? 'GET' : 'POST', body: body === undefined ? undefined : JSON.stringify(body) });
    if (controller.signal.aborted || !response.ok || !response.body) { void response.body?.cancel(); throw new Error('SPEECH_NOT_READY'); }
    const reader = response.body.getReader();
    let bytes = 0, text = '';
    const decoder = new TextDecoder();
    try {
      while (true) {
        const part = await reader.read(); assertActive(); if (part.done) break;
        bytes += part.value.byteLength;
        if (bytes > maxBytes) throw new Error('SPEECH_NOT_READY');
        text += decoder.decode(part.value, { stream: true });
      }
      text += decoder.decode(); assertActive(); return JSON.parse(text);
    } finally { void reader.cancel().catch(() => undefined); }
  } finally { clearTimeout(timer); signal.removeEventListener('abort', stop); stop(); }
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'GET' || req.headers.get('upgrade')?.toLowerCase() !== 'websocket') return deny(405, 'SPEECH_WEBSOCKET_REQUIRED');
  const authorization = req.headers.get('Authorization') ?? '';
  if (!/^Bearer [^\s]+$/.test(authorization)) return deny(401, 'AUTH_REQUIRED');
  const url = new URL(req.url);
  const conversationId = url.searchParams.get('conversationId')?.toLowerCase();
  const operationId = url.searchParams.get('operationId')?.toLowerCase();
  if ([...url.searchParams.keys()].length !== 2 || !uuid(conversationId) || !uuid(operationId)) return deny(400, 'SPEECH_REQUEST_INVALID');
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const anonKey = readSupabasePublishableKey(name => Deno.env.get(name)) ?? '';
  const serviceRoleKey = readSupabaseServiceKey(name => Deno.env.get(name)) ?? '';
  const providerKey = Deno.env.get('GEMINI_API_KEY') ?? '';
  // Named operator acknowledgement of the approved paid service; no free-tier/personal-data assumption.
  // Owner-approved controlled short probes with an internal reservation budget.
  // An operator verifies actual spend after each probe; this is not a provider billing guarantee.
  if (!supabaseUrl || !anonKey || !serviceRoleKey || !providerKey || Deno.env.get('USKOCI_GEMINI_PAID_TEST_ENABLED') !== 'true'
    || Deno.env.get('USKOCI_SPEECH_CONTROLLED_TEST_ENABLED') !== 'true') {
    return deny(503, 'SPEECH_NOT_READY');
  }
  try {
    const headers = { apikey: anonKey, Authorization: authorization };
    const account = await readBounded(supabaseUrl + '/auth/v1/user', headers, req.signal, 65536);
    if (!uuid(account?.id)) return deny(401, 'AUTH_REQUIRED');
    const conversations = await readBounded(supabaseUrl + '/rest/v1/ai_conversations?id=eq.' + conversationId
      + '&select=id,account_id,status,purpose&limit=1', headers, req.signal, 4096);
    const conversation = Array.isArray(conversations) && conversations.length === 1 ? conversations[0] : null;
    if (!conversation || conversation.id !== conversationId || conversation.account_id !== account.id
      || conversation.status !== 'OPEN' || !['NEED_INTAKE','PROFILE'].includes(conversation.purpose)) return deny(404, 'CONVERSATION_NOT_FOUND');
    if (conversation.purpose === 'PROFILE') {
      const context = await readBounded(supabaseUrl + '/rest/v1/rpc/rpc_read_worker_ai_context_service',
        supabaseServiceHeaders(serviceRoleKey, { 'Content-Type': 'application/json' }), req.signal, 524288,
        { p_account_id: account.id, p_conversation_id: conversationId });
      if (context?.schemaVersion !== 'WORKER_PROFILE_V1' || context.accountId !== account.id || context.conversationId !== conversationId
        || context.status !== 'OPEN' || context.stale !== false || !['ALLOW','CLARIFY'].includes(context.safety)) {
        return deny(409, 'WORKER_AI_NOT_EDITABLE');
      }
    }
    const budget = await reserveAiTestBudget({ supabaseUrl, serviceRoleKey, accountId: account.id, operationId, kind: 'STT', signal: req.signal });
    if (!budget.admitted || budget.replay) return deny(409, budget.code);
    if (req.signal.aborted) return deny(409, 'SPEECH_CANCELLED');
    const { socket, response } = Deno.upgradeWebSocket(req, { idleTimeout: 30 });
    // Browser/native peer sends only our allowlisted audio protocol; it never controls this URL or setup.
    const upstream = new WebSocket('wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key=' + encodeURIComponent(providerKey));
    bridgeSpeech(socket, upstream, conversationId, operationId, (completed, audioBytes, transcriptChars) => {
      // A missing/partial transcript does NOT prove that submitted audio was free.
      // Keep the existing durable reservation on uncertain completion; never refund,
      // generate another attempt, or invent zero provider usage from a local abort.
      // Full completion retains the existing duration-based estimate, not an invoice.
      if (completed) {
        EdgeRuntime.waitUntil(settleAiTestAudio({ supabaseUrl, serviceRoleKey, operationId, audioBytes, transcriptChars }));
      } else if (audioBytes === 0 && transcriptChars === 0) {
        EdgeRuntime.waitUntil(releaseUnusedAiTestReservation({ supabaseUrl, serviceRoleKey, operationId }));
      }
    });
    // The HTTP request ends at upgrade, while the bounded socket session remains active.
    // Hold the worker until the actual close event, including delivery of its final frame.
    const closed = new Promise<void>(resolve => {
      const onClose = socket.onclose;
      socket.onclose = (event: CloseEvent) => { try { onClose?.call(socket, event); } finally { resolve(); } };
    });
    if (typeof EdgeRuntime !== 'undefined') EdgeRuntime.waitUntil(closed);
    return response;
  } catch { return deny(503, 'SPEECH_UNAVAILABLE'); }
});
