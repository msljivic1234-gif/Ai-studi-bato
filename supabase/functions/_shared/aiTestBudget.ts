// Shared V5 controlled-provider test budget. No retries or refunds after uncertain I/O.
import { supabaseServiceHeaders } from './supabaseKeys.mjs';
export const AI_TEST_LIMITS = Object.freeze({
  // Per model call, including the complete catalog and owned conversation.
  // Keep request/output limits and pre-dispatch cost admission on every path.
  llmRequestBytes: 10485760,
  llmMaxOutputTokens: 2048,
  llmReservationMicrousd: 250000,
  speechPcmBytes: 3840000,
  speechMaxOutputTokens: 8192,
  speechReservationMicrousd: 200000,
  speechCaptureMs: 120000,
  speechFinalizationMs: 15000,
});

export type AiTestBudgetResult = {
  admitted: boolean;
  reservationId: string | null;
  replay: boolean;
  code: string;
};

export async function reserveAiTestBudget(input: {
  supabaseUrl: string; serviceRoleKey: string; accountId: string; operationId: string;
  kind: 'LLM' | 'STT'; signal?: AbortSignal;
}): Promise<AiTestBudgetResult> {
  const abort = new AbortController();
  const stop = () => abort.abort();
  const timeout = setTimeout(stop, 5000);
  input.signal?.addEventListener('abort', stop, { once: true });
  if (input.signal?.aborted) stop();
  // A response body or fetch implementation may ignore AbortSignal. The five-
  // second budget and caller cancellation must still settle this reservation.
  // Do not interpret an interrupted reservation as proof of no provider charge
  // or automatically create another paid operation.
  const cancelled=new Promise<never>((_,reject)=>{
    const onAbort=()=>reject(new Error('AI_TEST_BUDGET_UNAVAILABLE'));
    if(abort.signal.aborted)onAbort();
    else abort.signal.addEventListener('abort',onAbort,{once:true});
  });
  void cancelled.catch(()=>undefined);
  const assertActive = () => {
    if (abort.signal.aborted) throw new Error('AI_TEST_BUDGET_UNAVAILABLE');
  };
  try {
    assertActive();
    const response = await Promise.race([fetch(input.supabaseUrl + '/rest/v1/rpc/rpc_ai_test_budget_reserve_service', {
      method: 'POST', redirect: 'error', signal: abort.signal,
      headers: supabaseServiceHeaders(input.serviceRoleKey, { 'Content-Type': 'application/json' }),
      body: JSON.stringify({ p_account_id: input.accountId, p_operation_id: input.operationId, p_kind: input.kind,
        p_max_cost_microusd: input.kind === 'LLM' ? AI_TEST_LIMITS.llmReservationMicrousd : AI_TEST_LIMITS.speechReservationMicrousd }),
    }),cancelled]);
    if (abort.signal.aborted || !response.ok || !response.body) {
      // The deadline may win just before headers resolve. Cleanup MUST NOT
      // replace the original budget refusal with a TypeError, even for a
      // nonstandard transport that only exposes getReader().cancel().
      // Do not await cleanup: its promise may ignore cancellation too.
      try {
        const body=response.body;
        if (body && typeof body.cancel==='function')
          void Promise.resolve(body.cancel()).catch(()=>undefined);
        else if (body && typeof body.getReader==='function') {
          const reader=body.getReader();
          if (typeof reader.cancel==='function')
            void Promise.resolve(reader.cancel()).catch(()=>undefined);
        }
      } catch { /* best effort, never changes the conservative refusal */ }
      throw new Error('AI_TEST_BUDGET_UNAVAILABLE');
    }
    const reader = response.body.getReader();
    let content = '', length = 0;
    try {
      const decoder = new TextDecoder();
      while (true) {
        const part = await Promise.race([reader.read(),cancelled]);
        assertActive();
        if (part.done) break;
        length += part.value.byteLength;
        if (length > 4096) throw new Error('AI_TEST_BUDGET_UNAVAILABLE');
        content += decoder.decode(part.value, { stream: true });
      }
      content += decoder.decode();
    } finally { void reader.cancel().catch(() => undefined); }
    const result = JSON.parse(content);
    const codes = ['AI_TEST_RESERVED','AI_TEST_OPERATION_REPLAY','AI_TEST_BUDGET_NOT_READY','AI_TEST_ACCOUNT_NOT_ADMITTED','AI_TEST_BUDGET_EXHAUSTED'];
    if (!result || Object.keys(result).length !== 4 || typeof result.admitted !== 'boolean' || typeof result.replay !== 'boolean'
      || !codes.includes(result.code) || !(result.reservationId === null || /^[0-9a-f-]{36}$/i.test(result.reservationId))
      || (result.admitted && (result.replay || result.code !== 'AI_TEST_RESERVED' || !result.reservationId))) {
      throw new Error('AI_TEST_BUDGET_UNAVAILABLE');
    }
    assertActive();
    return result;
  } finally { clearTimeout(timeout); input.signal?.removeEventListener('abort', stop); stop(); }
}

// The speech session uses waitUntil for these two receipts. AbortSignal alone
// cannot settle a transport/body that ignores cancellation; bound the wait as
// well, and keep an uncertain write unconfirmed without retrying it.
async function postAudioBudgetReceipt(input: {
  supabaseUrl: string; serviceRoleKey: string;
}, rpc: 'rpc_ai_test_release_unused_reservation_service' | 'rpc_ai_test_settle_audio_service',
args: Record<string, unknown>): Promise<Record<string, unknown>> {
  const abort = new AbortController();
  const stopped = new Promise<never>((_, reject) => {
    abort.signal.addEventListener('abort', () => reject(new Error('AI_TEST_ACCOUNTING_UNCONFIRMED')), { once: true });
  });
  void stopped.catch(() => undefined);
  const timeout = setTimeout(() => abort.abort(), 5000);
  const check = () => { if (abort.signal.aborted) throw new Error('AI_TEST_ACCOUNTING_UNCONFIRMED'); };
  try {
    const request = fetch(input.supabaseUrl + '/rest/v1/rpc/' + rpc, {
      method: 'POST', redirect: 'error', signal: abort.signal,
      headers: supabaseServiceHeaders(input.serviceRoleKey, { 'Content-Type': 'application/json' }),
      body: JSON.stringify(args),
    }).then(response => {
      if (abort.signal.aborted || !response.ok || response.redirected || !response.body) {
        try { void response.body?.cancel().catch(() => undefined); } catch { /* best effort cleanup */ }
        throw new Error('AI_TEST_ACCOUNTING_UNCONFIRMED');
      }
      return response;
    });
    const response = await Promise.race([request, stopped]);
    check();
    const reader = response.body!.getReader();
    let raw = '', length = 0;
    try {
      const decoder = new TextDecoder('utf-8', { fatal: true });
      while (true) {
        const part = await Promise.race([reader.read(), stopped]);
        check();
        if (part.done) break;
        length += part.value.byteLength;
        if (length > 4096) throw new Error('AI_TEST_ACCOUNTING_UNCONFIRMED');
        raw += decoder.decode(part.value, { stream: true });
      }
      raw += decoder.decode();
    } finally { try { void reader.cancel().catch(() => undefined); } catch { /* best effort cleanup */ } }
    check();
    const receipt: unknown = JSON.parse(raw);
    if (!receipt || typeof receipt !== 'object' || Array.isArray(receipt)) throw new Error('AI_TEST_ACCOUNTING_UNCONFIRMED');
    return receipt as Record<string, unknown>;
  } finally { clearTimeout(timeout); abort.abort(); }
}

/** Only call with proof that no audio was dispatched and no provider output observed.
 * Missing output after dispatch is UNKNOWN, never proof of zero cost. The RPC also
 * refuses release when usage exists, but absence of recorded usage is not that proof. */
export async function releaseUnusedAiTestReservation(input: {
  supabaseUrl: string; serviceRoleKey: string; operationId: string;
}): Promise<boolean> {
  try {
    const body = await postAudioBudgetReceipt(input, 'rpc_ai_test_release_unused_reservation_service', { p_operation_id: input.operationId });
    return body.operationId === input.operationId && body.released === true && body.code === 'AI_RELEASE_DONE';
  } catch { return false; }
}

/** A fully completed session uses the existing duration/output estimate, not a provider
 * invoice. Partial/unknown completion keeps its hold. The RPC refuses when provider
 * usage exists, so reported usage always wins. */
export async function settleAiTestAudio(input: {
  supabaseUrl: string; serviceRoleKey: string; operationId: string; audioBytes: number; transcriptChars: number;
}): Promise<boolean> {
  if (!(input.audioBytes > 0)) return false;
  try {
    const body = await postAudioBudgetReceipt(input, 'rpc_ai_test_settle_audio_service', {
      p_operation_id: input.operationId, p_audio_bytes: input.audioBytes, p_transcript_chars: input.transcriptChars,
    });
    return body.operationId === input.operationId && body.settled === true && body.code === 'AI_AUDIO_SETTLED';
  } catch { return false; }
}
