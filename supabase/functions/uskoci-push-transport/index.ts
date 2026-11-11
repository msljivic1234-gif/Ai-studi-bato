/** Service-only existing-ledger worker. No client recipients, payload or URL.
 * Ticket = Expo queued; receipt OK = FCM/APNs accepted; neither = device delivered.
 * No logs: Expo error messages can contain transport addresses.
 */
import { notificationPushCopy } from '../_shared/pushNotificationCopy.mjs';
import { isSupabaseServiceRequest, readSupabaseServiceKey, supabaseServiceHeaders } from '../_shared/supabaseKeys.mjs';
declare const Deno: { env: { get(name: string): string | undefined }; serve(handler: (req: Request) => Promise<Response>): void };
export {};
type Row = Record<string, unknown>;
const row = (x: unknown): x is Row => !!x && typeof x === 'object' && !Array.isArray(x);
const only = (x: Row, keys: string[]) => Object.keys(x).every(k => keys.includes(k)) && keys.every(k => k in x);
const uuid = (x: unknown): x is string => typeof x === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(x);
const ticket = (x: unknown): x is string => typeof x === 'string' && /^[A-Za-z0-9_-]{1,200}$/.test(x);
const live = (x: unknown): x is string => typeof x === 'string' && Number.isFinite(Date.parse(x)) && Date.parse(x) > Date.now();
const json = (x: unknown, status = 200) => new Response(JSON.stringify(x), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
class Invalid extends Error {}
let running = false;
async function request(url: string, init: RequestInit & { signal: AbortSignal }): Promise<Response> {
 let aborted: (() => void) | undefined;
 const signal = init.signal;
 if (signal.aborted) throw new Invalid();
 try {
  return await Promise.race([fetch(url, init).then(response => {
   if (signal.aborted) { void response.body?.cancel().catch(() => undefined); throw new Invalid(); }
   return response;
  }), new Promise<never>((_, reject) => { aborted = () => reject(new Invalid()); signal.addEventListener('abort', aborted, { once: true }); if (signal.aborted) aborted(); })]);
 } finally { if (aborted) signal.removeEventListener('abort', aborted); }
}
async function read(stream: ReadableStream<Uint8Array> | null, max: number, signal: AbortSignal): Promise<unknown> {
 if (!stream) throw new Invalid();
 const reader = stream.getReader(); let total = 0; const chunks: Uint8Array[] = [];
 const cancel = () => { void reader.cancel().catch(() => undefined); };
 signal.addEventListener('abort', cancel, { once: true });
 try {
  while (true) { if (signal.aborted) throw new Invalid(); const part = await reader.read(); if (signal.aborted) throw new Invalid(); if (part.done) break; total += part.value.length; if (total > max) throw new Invalid(); chunks.push(part.value); }
  const bytes = new Uint8Array(total); let offset = 0; for (const c of chunks) { bytes.set(c, offset); offset += c.length; }
  return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
 } finally { signal.removeEventListener('abort', cancel); cancel(); }
}
type Result = 'TICKET' | 'PROVIDER_ACCEPTED' | 'DEVICE_NOT_REGISTERED' | 'RETRYABLE' | 'RECEIPT_RATE_EXCEEDED' | 'FATAL' | 'UNKNOWN' | 'RECEIPT_PENDING';
function expoResult(value: unknown, receipt: boolean): { result: Result; ticketId: string | null } {
 if (!row(value)) throw new Invalid();
 if (value.status === 'ok') {
  if (receipt && only(value, ['status'])) return { result: 'PROVIDER_ACCEPTED', ticketId: null };
  if (!receipt && only(value, ['status', 'id']) && ticket(value.id)) return { result: 'TICKET', ticketId: value.id };
  throw new Invalid();
 }
 if (value.status !== 'error' || Object.keys(value).some(k => !['status', 'message', 'details'].includes(k))
  || (value.message !== undefined && (typeof value.message !== 'string' || value.message.length > 4096))
  || !row(value.details) || typeof value.details.error !== 'string') throw new Invalid();
 // Never retain provider messages, credentials, token or arbitrary detail fields.
 const error = value.details.error;
 return { result: error === 'DeviceNotRegistered' ? 'DEVICE_NOT_REGISTERED' : error === 'MessageRateExceeded' ? (receipt ? 'RECEIPT_RATE_EXCEEDED' : 'RETRYABLE')
  : ['MessageTooBig', 'MismatchSenderId', 'InvalidCredentials', 'InvalidPushToken'].includes(error) ? 'FATAL' : 'UNKNOWN', ticketId: null };
}
Deno.serve(async req => {
 if (req.method !== 'POST') return json({ code: 'METHOD_NOT_ALLOWED' }, 405);
 const service = readSupabaseServiceKey(name => Deno.env.get(name));
 if (!service || !isSupabaseServiceRequest(req.headers, name => Deno.env.get(name))) return json({ code: 'FORBIDDEN' }, 403);
 // A disabled tick performs no DB/provider IO; a service-only probe may
 // record its actual disabled state without claiming work or reading Expo keys.
 const enabled = Deno.env.get('EXPO_PUSH_TRANSPORT_ENABLED') === 'true';
 if (running) return json({ kind: 'BUSY' }, 429);
 running = true;
 const controller = new AbortController();
 const cancel = () => controller.abort(); req.signal.addEventListener('abort', cancel, { once: true });
 if (req.signal.aborted) cancel();
 const timer = setTimeout(cancel, 25000);
 const signal = controller.signal;
 let reportFailure: (() => Promise<void>) | undefined;
 try {
  const input = await read(req.body, 256, signal);
  if (!row(input)) return json({ code: 'INVALID_REQUEST' }, 400);
  const targeted = input.action === 'single_target' || input.action === 'single_target_receipt';
  if (targeted ? (!only(input, ['action', 'admissionId']) || !uuid(input.admissionId))
   : (!only(input, ['action']) || !['tick', 'probe'].includes(String(input.action)))) return json({ code: 'INVALID_REQUEST' }, 400);
  if (targeted && Deno.env.get('EXPO_PUSH_SINGLE_TARGET_ENABLED') !== 'true') return json({ kind: 'DISABLED' });
  if (!enabled && input.action === 'tick') return json({ kind: 'DISABLED' });
  const rawURL = Deno.env.get('SUPABASE_URL'); if (!rawURL) throw new Invalid();
  const base = new URL(rawURL);
  if (base.protocol !== 'https:' || !/^[a-z0-9-]+\.supabase\.co$/.test(base.hostname) || base.username || base.password || base.port || base.pathname !== '/' || base.search || base.hash) throw new Invalid();
  async function rpc(name: 'rpc_claim_push_transport' | 'rpc_begin_push_send' | 'rpc_complete_push_transport' | 'rpc_record_push_readiness' | 'rpc_claim_push_single_target' | 'rpc_claim_push_single_target_receipt', args: Row) {
   if (signal.aborted) throw new Invalid();
   const result = await request(`${base.origin}/rest/v1/rpc/${name}`, { method: 'POST', redirect: 'error', signal,
    headers: supabaseServiceHeaders(service!, { 'Content-Type': 'application/json' }), body: JSON.stringify(args) });
   if (!result.ok) { void result.body?.cancel().catch(() => undefined); throw new Invalid(); }
   return read(result.body, 16384, signal);
  }
  async function observe(observation: 'PROBE_ENABLED' | 'PROBE_DISABLED' | 'TICK_OK' | 'TICK_DEGRADED' | 'TICK_FAILED') {
   const receipt = await rpc('rpc_record_push_readiness', { p_sender_version: 'PRE_V3_PUSH_READINESS_V1', p_observation: observation });
   if (!row(receipt) || !only(receipt, ['recorded', 'observation', 'observedAt', 'authoritative']) || receipt.recorded !== true ||
    receipt.observation !== observation || receipt.authoritative !== true || typeof receipt.observedAt !== 'string' ||
    !Number.isFinite(Date.parse(receipt.observedAt))) throw new Invalid();
  }
  if (input.action === 'probe') {
   await observe(enabled ? 'PROBE_ENABLED' : 'PROBE_DISABLED');
   return json({ kind: 'READINESS_RECORDED', enabled });
  }
  // Targeted actions never record a global tick observation.
  if (!targeted) reportFailure = () => observe('TICK_FAILED');
  async function once(kind: 'SEND' | 'RECEIPT', admissionId?: string) {
   const claim = admissionId
    ? await rpc(kind === 'SEND' ? 'rpc_claim_push_single_target' : 'rpc_claim_push_single_target_receipt', { p_admission_id: admissionId })
    : await rpc('rpc_claim_push_transport', { p_kind: kind });
   if (row(claim) && only(claim, ['kind']) && claim.kind === 'NONE') return 'NONE';
   if (!row(claim) || !only(claim, ['kind', 'attemptId', 'leaseId', 'leaseExpiresAt', 'ticketId']) || claim.kind !== kind
    || !uuid(claim.attemptId) || !uuid(claim.leaseId) || !live(claim.leaseExpiresAt)
    || (kind === 'SEND' ? claim.ticketId !== null : !ticket(claim.ticketId))) throw new Invalid();
   let body: Row | Row[];
   if (kind === 'SEND') {
    const begin = await rpc('rpc_begin_push_send', { p_attempt_id: claim.attemptId, p_lease_id: claim.leaseId });
    if (row(begin) && only(begin, ['kind']) && begin.kind === 'SUPPRESSED') return 'SUPPRESSED';
    const beginKeys = ['kind', 'attemptId', 'leaseId', 'leaseExpiresAt', 'expoPushToken', 'priority', 'eventType'];
    // Compatibility bridge: legacy receipts have no eventId. These four
    // server-authorized event kinds may add one opaque identity; no Need ID/body.
    if (!row(begin) || !(only(begin, beginKeys) || (only(begin, [...beginKeys, 'eventId'])
      && ['MESSAGE_RECEIVED', 'OPPORTUNITY_AVAILABLE', 'RESPONSE_RECEIVED', 'RESPONSE_UPDATED'].includes(String(begin.eventType)) && uuid(begin.eventId))) || begin.kind !== 'SEND'
     || begin.attemptId !== claim.attemptId || begin.leaseId !== claim.leaseId || begin.leaseExpiresAt !== claim.leaseExpiresAt || !live(begin.leaseExpiresAt)
     || typeof begin.expoPushToken !== 'string' || begin.expoPushToken.length > 256 || !/^(ExpoPushToken|ExponentPushToken)\[[A-Za-z0-9_-]+\]$/.test(begin.expoPushToken)
     || !['NORMAL', 'HIGH'].includes(String(begin.priority))
     || typeof begin.eventType !== 'string' || !/^[A-Z][A-Z0-9_]{2,63}$/.test(begin.eventType)) throw new Invalid();
    const copy = notificationPushCopy(begin.eventType, begin.priority === 'HIGH' ? 'HITNO' : 'NORMAL');
    // Older installed clients admit only {kind:'INBOX'}. Keep that default until
    // the owned exact-target client has shipped and its cold/live tap is proven.
    const exactMessage = Deno.env.get('EXPO_PUSH_MESSAGE_TARGET_ENABLED') === 'true'
      && begin.eventType === 'MESSAGE_RECEIVED' && uuid(begin.eventId);
    // This second feature gate applies ONLY to one admitted recipient/device.
    // A global push tick never carries an opportunity event even if the flag is on.
    const exactOpportunity = targeted && Deno.env.get('EXPO_PUSH_OPPORTUNITY_TARGET_ENABLED') === 'true'
      && begin.eventType === 'OPPORTUNITY_AVAILABLE' && uuid(begin.eventId);
    const exactApplication = Deno.env.get('EXPO_PUSH_APPLICATION_TARGET_ENABLED') === 'true'
      && ['RESPONSE_RECEIVED', 'RESPONSE_UPDATED'].includes(String(begin.eventType)) && uuid(begin.eventId);
    const data = exactMessage || exactOpportunity || exactApplication
      ? { kind: 'INBOX', eventType: begin.eventType, eventId: (begin.eventId as string).toLowerCase() }
      : { kind: 'INBOX' };
    body = [{ to: begin.expoPushToken, title: copy.title, body: copy.body,
     data, channelId: 'default', sound: 'default', priority: begin.priority === 'HIGH' ? 'high' : 'normal', ttl: 0 }];
   } else body = { ids: [claim.ticketId] };
   let parsed: { result: Result; ticketId: string | null } = { result: kind === 'SEND' ? 'UNKNOWN' : 'RECEIPT_PENDING', ticketId: null };
   try {
    if (signal.aborted || !live(claim.leaseExpiresAt)) throw new Invalid();
    const headers: Record<string, string> = { 'Content-Type': 'application/json', Accept: 'application/json' };
    const access = Deno.env.get('EXPO_ACCESS_TOKEN'); if (access) headers.Authorization = `Bearer ${access}`;
    // Literal provider URLs; no redirects or caller-controlled target component.
    const response = await request(kind === 'SEND' ? 'https://exp.host/--/api/v2/push/send' : 'https://exp.host/--/api/v2/push/getReceipts',
     { method: 'POST', headers, body: JSON.stringify(body), signal, redirect: 'error' });
    if (!response.ok) {
     void response.body?.cancel().catch(() => undefined);
     // Only explicit throttle rejection is known safe to resend. 5xx/network/
     // deadline may follow provider acceptance; SQL preserves them as UNKNOWN.
     parsed.result = kind === 'RECEIPT' ? 'RECEIPT_PENDING' : response.status === 429 ? 'RETRYABLE'
      : response.status >= 400 && response.status < 500 ? 'FATAL' : 'UNKNOWN';
    } else {
     const envelope = await read(response.body, 32768, signal);
     if (!row(envelope) || !only(envelope, ['data'])) throw new Invalid();
     if (kind === 'SEND') {
      if (!Array.isArray(envelope.data) || envelope.data.length !== 1) throw new Invalid();
      parsed = expoResult(envelope.data[0], false);
     } else {
      if (!row(envelope.data) || Object.keys(envelope.data).some(k => k !== claim.ticketId)) throw new Invalid();
      parsed = String(claim.ticketId) in envelope.data ? expoResult(envelope.data[String(claim.ticketId)], true) : { result: 'RECEIPT_PENDING', ticketId: null };
     }
    }
   } catch { /* No blind resend and no raw provider exception reaches output. */ }
   if (signal.aborted || !live(claim.leaseExpiresAt)) throw new Invalid();
   const done = await rpc('rpc_complete_push_transport', { p_attempt_id: claim.attemptId, p_lease_id: claim.leaseId, p_result: parsed.result, p_ticket_id: parsed.ticketId });
   const states: Record<Result, string[]> = { TICKET: ['TICKET_PENDING'], PROVIDER_ACCEPTED: ['PROVIDER_ACCEPTED'], DEVICE_NOT_REGISTERED: ['FINAL'],
    RETRYABLE: kind === 'SEND' ? ['RETRYABLE', 'FINAL'] : ['TICKET_PENDING'], RECEIPT_RATE_EXCEEDED: ['RETRYABLE', 'FINAL'], FATAL: ['FINAL'], UNKNOWN: ['UNKNOWN'], RECEIPT_PENDING: ['TICKET_PENDING'] };
   if (!row(done) || !only(done, ['attemptId', 'state']) || done.attemptId !== claim.attemptId || !states[parsed.result].includes(String(done.state))) throw new Invalid();
   return String(done.state);
  }
  // Exactly one selected lane. Never fall through to global receipt/send scans.
  if (targeted) {
   const state = await once(input.action === 'single_target' ? 'SEND' : 'RECEIPT', input.admissionId as string);
   return json({ kind: 'SINGLE_TARGET_COMPLETED', state });
  }
  const receipt = await once('RECEIPT'); const send = await once('SEND');
  const unhealthy = [receipt, send].some(state => ['UNKNOWN', 'FINAL', 'RETRYABLE'].includes(state));
  await observe(unhealthy ? 'TICK_DEGRADED' : 'TICK_OK');
  return json({ kind: 'TICK_COMPLETED', receipt, send });
 } catch {
  // No late writes after cancellation; failed telemetry never masks the original
  // unknown outcome and never causes a resend. Stale/no observation stays UNKNOWN.
  if (!signal.aborted && reportFailure) { try { await reportFailure(); } catch { /* bounded, no raw error */ } }
  return json({ code: 'PUSH_UNAVAILABLE' }, signal.aborted ? 504 : 503);
 }
 finally { clearTimeout(timer); req.signal.removeEventListener('abort', cancel); controller.abort(); running = false; }
});
