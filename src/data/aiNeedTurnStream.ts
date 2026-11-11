import { AI_CREDITS_UNAVAILABLE, AI_DIAGNOSTICS_HEADER, AI_DIAGNOSTICS_VERSION, AI_AVAILABILITY_HEADER } from '../contracts/aiAvailability';
import { uuid, record, sameId } from './serverReceipt';
import { fetch as expoFetch } from 'expo/fetch';
import { NEED_FACT_TURN_CAPABILITY_HEADER, NEED_FACT_TURN_CAPABILITY_VERSION } from '../contracts/needFactsV2';
import { AI_CONVERSATION_INTENT_HEADER, AI_CONVERSATION_INTENT_CAPABILITY, decodeAiConversationIntent, type AiConversationIntent } from '../contracts/aiConversationIntent';

export type AiTurnStreamOptions = { onText: (delta: string) => void; signal?: AbortSignal;
  /** Called by the owned service only after its existing full receipt decoder succeeds. */
  onConversationIntent?: (intent: AiConversationIntent) => void };

/** Ordered, bounded stream events are ephemeral. Only the terminal DTO may be
 * decoded by the existing owned-turn receipt decoder. */
export function createAiTurnStreamDecoder(input: {
  conversationId: string; clientRequestId: string; current: () => boolean; onText: (delta: string) => void;
  text?: string; allowConversationIntent?: boolean;
}) {
  let sequence = 0, attempt: string | null = null, turn: string | null = null;
  let text = '', terminal = false, safeError = false, receipt: unknown = undefined;
  let failureCode: typeof AI_CREDITS_UNAVAILABLE | null = null;
  let intent: AiConversationIntent | null = null;
  const accept = (raw: unknown) => {
    const e = record(raw);
    if (!input.current() || terminal || !e || !sameId(e.conversationId, input.conversationId)
      || !sameId(e.clientRequestId, input.clientRequestId) || !uuid(e.turnId) || !uuid(e.attemptId)
      || e.sequence !== sequence + 1) throw new Error('AI_STREAM_INVALID');
    const fields = ['conversationId', 'clientRequestId', 'turnId', 'attemptId', 'sequence', 'kind'];
    const extras = e.kind === 'accepted' ? [] : e.kind === 'text_delta' ? ['text'] : e.kind === 'final'
      ? input.allowConversationIntent && Object.hasOwn(e, 'conversationIntent') ? ['turn', 'conversationIntent'] : ['turn']
      : e.kind === 'safe_error' ? ['code'] : null;
    if (!extras || Object.keys(e).length !== fields.length + extras.length
      || [...fields, ...extras].some(key => !Object.hasOwn(e, key))) throw new Error('AI_STREAM_INVALID');
    if (!sequence) {
      if (e.kind !== 'accepted') throw new Error('AI_STREAM_INVALID');
      attempt = e.attemptId; turn = e.turnId;
    } else if (e.kind === 'accepted' || !attempt || !turn || !sameId(e.attemptId, attempt) || !sameId(e.turnId, turn)) throw new Error('AI_STREAM_INVALID');
    sequence++;
    if (e.kind === 'text_delta') {
      if (typeof e.text !== 'string' || !e.text || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(e.text)
        || text.length + e.text.length > 1500) throw new Error('AI_STREAM_INVALID');
      text += e.text; input.onText(e.text);
    } else if (e.kind === 'final') {
      const result = record(e.turn);
      if (!result || !turn || !attempt || result.state !== 'SUCCEEDED'
        || !sameId(result.conversationId, input.conversationId)
        || !sameId(result.clientRequestId, input.clientRequestId)
        || !sameId(result.turnId, turn)
        || (Object.hasOwn(result, 'attemptId') && !sameId(result.attemptId, attempt))) throw new Error('AI_STREAM_INVALID');
      if (Object.hasOwn(e, 'conversationIntent')) {
        intent = decodeAiConversationIntent(e.conversationIntent, input.text ?? '');
        if (!intent) throw new Error('AI_STREAM_INVALID');
      }
      receipt = e.turn; terminal = true;
    } else if (e.kind === 'safe_error') {
      // Never reflect provider, SQL, Auth or arbitrary event text in the UI.
      terminal = true;
      if (e.code !== 'AI_TURN_NOT_CONFIRMED' && e.code !== AI_CREDITS_UNAVAILABLE) throw new Error('AI_STREAM_INVALID');
      safeError = true; failureCode = e.code === AI_CREDITS_UNAVAILABLE ? AI_CREDITS_UNAVAILABLE : null;
    }
  };
  return { accept, result: () => terminal ? receipt : undefined,
    conversationIntent: () => terminal && !safeError ? intent : null, failed: () => safeError, failureCode: () => failureCode };
}

export async function requestAiTurnStream(input: AiTurnStreamOptions & {
  url: string; anonKey: string; accessToken: string; conversationId: string; clientRequestId: string;
  text: string; current: () => boolean; deadline: number;
  endpoint?: 'uskoci-ai-interview' | 'uskoci-worker-interview';
  imageBase64?: string; imageMime?: string;
}): Promise<{ data: unknown; error: { message: string } | null; conversationIntent?: AiConversationIntent | null }> {
  const abort = new AbortController(), stop = () => abort.abort();
  const timer = setTimeout(stop, Math.max(0, input.deadline - Date.now()));
  input.signal?.addEventListener('abort', stop, { once: true });
  const current = () => !abort.signal.aborted && !input.signal?.aborted && Date.now() < input.deadline && input.current();
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
  try {
    if (!current()) throw new Error('AI_STREAM_STOPPED');
    const response = await expoFetch(input.url + '/functions/v1/' + (input.endpoint ?? 'uskoci-ai-interview'), {
      method: 'POST', signal: abort.signal, redirect: 'error',
      headers: { Authorization: 'Bearer ' + input.accessToken, apikey: input.anonKey, 'Content-Type': 'application/json', Accept: 'text/event-stream', [AI_DIAGNOSTICS_HEADER]: AI_DIAGNOSTICS_VERSION,
        ...(input.onConversationIntent ? { [AI_CONVERSATION_INTENT_HEADER]: AI_CONVERSATION_INTENT_CAPABILITY } : {}),
        ...(input.endpoint === 'uskoci-worker-interview' ? { 'x-uskoci-worker-preview-stream': 'v1' } : { [NEED_FACT_TURN_CAPABILITY_HEADER]: NEED_FACT_TURN_CAPABILITY_VERSION }) },
      body: JSON.stringify({
        conversationId: input.conversationId,
        text: input.text,
        clientRequestId: input.clientRequestId,
        ...(input.imageBase64 && input.imageMime ? { imageBase64: input.imageBase64, imageMime: input.imageMime } : {}),
      }),
    });
    if (!current() || response.redirected || !response.body) throw new Error('AI_STREAM_STOPPED');
    if (!response.ok && response.status !== 409) {
      void response.body.cancel().catch(() => undefined);
      return { data: null, error: { message: aiAvailabilityFromResponse(response.status, response.headers) ?? (response.status === 401 ? 'AUTH_REQUIRED' : response.status === 403 ? 'AI_ACCESS_DENIED'
        : response.status === 429 ? 'AI_RATE_LIMITED' : 'AI_SERVICE_UNAVAILABLE') } };
    }
    const contentType = response.headers.get('content-type') ?? '';
    const streaming = contentType.includes('text/event-stream');
    if (!streaming && !contentType.includes('application/json')) throw new Error('AI_STREAM_INVALID');
    const declared = response.headers.get('content-length'), maximum = streaming ? 262144 : 8192;
    if (declared !== null && (!/^\d+$/.test(declared) || Number(declared) > maximum)) throw new Error('AI_STREAM_INVALID');
    reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8', { fatal: true });
    const events = createAiTurnStreamDecoder({ ...input, current, allowConversationIntent: !!input.onConversationIntent });
    let buffer = '', total = 0;
    const event = (body: string) => {
      const lines = body.split('\n').filter(line => line.startsWith('data:')).map(line => line.slice(5).trimStart());
      if (lines.length) events.accept(JSON.parse(lines.join('\n')));
    };
    while (true) {
      const part = await reader.read();
      if (!current()) throw new Error('AI_STREAM_STOPPED');
      if (part.done) break;
      total += part.value.byteLength;
      if (total > maximum) throw new Error('AI_STREAM_INVALID');
      buffer = (buffer + decoder.decode(part.value, { stream: true })).replace(/\r\n/g, '\n');
      if (streaming) {
        let boundary: number;
        while ((boundary = buffer.indexOf('\n\n')) !== -1) { event(buffer.slice(0, boundary)); buffer = buffer.slice(boundary + 2); }
        if (buffer.length > 16384) throw new Error('AI_STREAM_INVALID');
      }
    }
    buffer += decoder.decode();
    if (declared !== null && Number(declared) !== total) throw new Error('AI_STREAM_INVALID');
    if (!current()) throw new Error('AI_STREAM_STOPPED');
    if (!streaming) return { data: JSON.parse(buffer), error: null }; // Existing claim replay/terminal envelope.
    if (buffer.trim()) event(buffer);
    return events.failed()
      ? { data: undefined, error: { message: events.failureCode() ?? 'AI_SERVICE_UNAVAILABLE' } }
      : { data: events.result(), error: null, conversationIntent: events.conversationIntent() };
  } catch {
    return { data: undefined, error: { message: 'AI_TURN_SEND_UNCONFIRMED' } };
  } finally {
    clearTimeout(timer); input.signal?.removeEventListener('abort', stop); abort.abort();
    void reader?.cancel().catch(() => undefined);
  }
}

/** Read one closed diagnostic header from our own Edge response. No error body,
 * provider prose, or classification of the command's durable outcome. */
export function aiAvailabilityFromResponse(status: number, headers: unknown): typeof AI_CREDITS_UNAVAILABLE | null {
  if (status !== 503) return null;
  const value = record(headers);
  if (!value || typeof value.get !== 'function') return null;
  try {
    return value.get.call(headers, AI_AVAILABILITY_HEADER) === AI_CREDITS_UNAVAILABLE ? AI_CREDITS_UNAVAILABLE : null;
  } catch { return null; }
}
export function aiAvailabilityFromSdkError(error: unknown): typeof AI_CREDITS_UNAVAILABLE | null {
  const context = record(record(error)?.context);
  return context && typeof context.status === 'number' ? aiAvailabilityFromResponse(context.status, context.headers) : null;
}
