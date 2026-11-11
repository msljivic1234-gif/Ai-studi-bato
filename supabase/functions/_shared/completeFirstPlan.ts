type RpcResult = { ok: boolean; status: number; data: unknown };
type Rpc = (name: string, args: Record<string, unknown>, signal: AbortSignal, timeout: number) => Promise<RpcResult>;
const writers = new Set([
  'rpc_ai_complete_need_turn_with_first_plan_service',
  'rpc_ai_complete_need_location_turn_with_first_plan_service',
  'rpc_complete_worker_ai_turn_with_first_plan_service',
]);
const record = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

/** Finish an already obtained/validated answer; never claim or call a model.
 * One normal write. Only an unconfirmed response plus an owned PENDING read
 * permits one replay of identical arguments. A final lost ACK gets one read.
 * HTTP/domain refusal, decoded malformed receipt, cancellation and stale attempts
 * never authorize a new write. An uncertain result remains uncertain to the caller.
 */
export async function completeFirstPlan<T>(input: {
  rpc: Rpc; writer: string; args: Record<string, unknown>; decode: (envelope: unknown) => T;
}): Promise<T> {
  if (!writers.has(input.writer)) throw new Error('AI_FIRST_PLAN_WRITER_INVALID');
  const frozen = JSON.stringify(input.args);
  if (new TextEncoder().encode(frozen).byteLength > 65536) throw new Error('AI_FIRST_PLAN_PAYLOAD_TOO_LARGE');
  const args = (): Record<string, unknown> => JSON.parse(frozen);
  // The handler retains its completion work with waitUntil. This signal is
  // independent of the phone's connection; each RPC still has a deadline.
  // Explicit cancellation still wins under the original SQL command locks.
  const signal = new AbortController().signal;
  for (let attempt = 0; attempt < 2; attempt++) {
    let result: RpcResult | undefined;
    let transportUnknown = false;
    try { result = await input.rpc(input.writer, args(), signal, 8000); }
    catch { transportUnknown = true; }
    if (result?.ok) {
      try { return input.decode(result.data); }
      catch { /* Read the exact persisted receipt; malformed data grants no replay. */ }
    } else if (result) {
      // Gateway/transport outcomes may hide a committed transaction. Never
      // reinterpret a Postgres validation/authorization error as retryable.
      transportUnknown = [408, 502, 503, 504].includes(result.status)
        && !(record(result.data) && typeof result.data.code === 'string');
      if (!transportUnknown) throw new Error('AI_FIRST_PLAN_WRITE_REFUSED');
    }
    const recovered = await input.rpc('rpc_ai_read_first_plan_completion_service',
      { p_writer: input.writer, p_arguments: args() }, signal, 4000);
    const data = recovered.data;
    if (!recovered.ok || !record(data)) throw new Error('AI_FIRST_PLAN_READ_UNCONFIRMED');
    if (data.state === 'COMPLETED' && Object.keys(data).length === 2 && Object.hasOwn(data, 'envelope'))
      return input.decode(data.envelope);
    if (data.state !== 'PENDING' || Object.keys(data).length !== 1 || !transportUnknown || attempt !== 0)
      throw new Error('AI_FIRST_PLAN_NOT_CONFIRMED');
  }
  throw new Error('AI_FIRST_PLAN_NOT_CONFIRMED');
}
