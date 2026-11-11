import { bounded, BUCKET, bytesCount, expectedPath, hash, json, liveInstant, MAX_BYTES, md5, objectAbsent, only, parseJSON, preflight, readBytes, Rejected, reserve, row, sha256, Transport, uuid } from '../_shared/data-export.ts';
declare const Deno: { serve(handler: (req: Request) => Promise<Response> | Response): unknown };

async function prepare(transport: Transport, receiptId: string | null, accountId: string | null) {
  const claim = row(await transport.rpc('rpc_claim_data_export', { p_receipt_id: receiptId, p_account_id: accountId }, true, MAX_BYTES * 2 + 65536));
  if (claim?.kind === 'NONE' && only(claim, ['kind'])) return { kind: 'NOT_READY', code: 'NOT_AVAILABLE' };
  if (claim?.kind === 'NOT_READY' && only(claim, ['kind', 'code'])
    && ['EXPORT_POLICY_NOT_READY', 'EXPORT_POLICY_CHANGED', 'EXPORT_SNAPSHOT_TOO_LARGE', 'EXPORT_ACCOUNT_UNAVAILABLE'].includes(String(claim.code))) {
    return { kind: 'NOT_READY', code: claim.code === 'EXPORT_POLICY_NOT_READY' || claim.code === 'EXPORT_POLICY_CHANGED' ? 'POLICY_NOT_READY' : 'NOT_AVAILABLE' };
  }
  if (!claim || !only(claim, ['kind', 'receiptId', 'accountId', 'attemptId', 'leaseExpiresAt', 'snapshotText', 'byteLength', 'sha256', 'md5', 'bucket', 'objectPath', 'artifactExpiresAt'])
    || claim.kind !== 'CLAIMED' || !uuid(claim.receiptId) || !uuid(claim.accountId) || !uuid(claim.attemptId)
    || (receiptId !== null && claim.receiptId !== receiptId) || (accountId !== null && claim.accountId !== accountId)
    || !liveInstant(claim.leaseExpiresAt) || !liveInstant(claim.artifactExpiresAt) || typeof claim.snapshotText !== 'string'
    || !bytesCount(claim.byteLength) || !hash(claim.sha256) || !md5(claim.md5) || claim.bucket !== BUCKET
    || claim.objectPath !== expectedPath(claim.accountId, claim.receiptId, claim.attemptId)) throw new Rejected(502, 'EXPORT_INVALID_RESPONSE');
  const bytes = new TextEncoder().encode(claim.snapshotText);
  const path = transport.storagePath(String(claim.objectPath));
  try {
    if (bytes.length !== claim.byteLength || await sha256(bytes) !== claim.sha256) throw new Rejected(502, 'EXPORT_INVALID_RESPONSE');
    const uploaded = await transport.request(path, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-upsert': 'false' }, body: bytes }, true);
    if (!uploaded.ok) { void uploaded.body?.cancel().catch(() => undefined); throw new Rejected(503, 'EXPORT_UPLOAD_FAILED'); }
    void uploaded.body?.cancel().catch(() => undefined);
    const stored = await transport.request(path, { method: 'GET' }, true);
    if (!stored.ok) { void stored.body?.cancel().catch(() => undefined); throw new Rejected(503, 'EXPORT_VERIFY_FAILED'); }
    const verified = await readBytes(stored.body, MAX_BYTES, transport.signal);
    try { if (verified.length !== claim.byteLength || await sha256(verified) !== claim.sha256) throw new Rejected(502, 'EXPORT_VERIFY_FAILED'); }
    finally { verified.fill(0); }
    if (!liveInstant(claim.leaseExpiresAt) || !liveInstant(claim.artifactExpiresAt)) throw new Rejected(409, 'EXPORT_ATTEMPT_STALE');
    const complete = row(await transport.rpc('rpc_complete_data_export', {
      p_receipt_id: claim.receiptId, p_attempt_id: claim.attemptId, p_byte_length: claim.byteLength, p_sha256: claim.sha256,
    }, true));
    if (!complete || !only(complete, ['receiptId', 'status', 'artifactGeneration', 'idempotentReplay'])
      || complete.receiptId !== claim.receiptId || complete.artifactGeneration !== claim.attemptId || complete.status !== 'READY'
      || typeof complete.idempotentReplay !== 'boolean') throw new Rejected(502, 'EXPORT_INVALID_RESPONSE');
    return { kind: 'READY' };
  } catch (error) {
    // An uncertain completion may already be committed. Never delete its object.
    // The fenced failure RPC cannot turn a completed or reclaimed attempt back.
    if (!transport.signal.aborted) {
      try { await transport.rpc('rpc_fail_data_export', { p_receipt_id: claim.receiptId, p_attempt_id: claim.attemptId,
        p_failure_code: error instanceof Rejected && ['EXPORT_UPLOAD_FAILED', 'EXPORT_VERIFY_FAILED'].includes(error.code) ? error.code : 'EXPORT_WORKER_FAILED', p_retryable: true }, true); }
      catch { /* Lease recovery is the authority if the failure receipt is unknown. */ }
    }
    return { kind: 'NOT_READY', code: 'RETRY_REQUIRED' };
  } finally { bytes.fill(0); }
}
async function cleanup(transport: Transport, receiptId: string | null, accountId: string | null) {
  const claim = row(await transport.rpc('rpc_claim_data_export_cleanup', { p_receipt_id: receiptId, p_account_id: accountId }, true));
  if (claim?.kind === 'NONE' && only(claim, ['kind'])) return;
  if (!claim || !only(claim, ['kind', 'receiptId', 'accountId', 'artifactGeneration', 'cleanupAttemptId', 'leaseExpiresAt', 'bucket', 'objectPath'])
    || claim.kind !== 'CLAIMED' || !uuid(claim.receiptId) || !uuid(claim.accountId) || !uuid(claim.artifactGeneration) || !uuid(claim.cleanupAttemptId)
    || (receiptId !== null && claim.receiptId !== receiptId) || (accountId !== null && claim.accountId !== accountId)
    || !liveInstant(claim.leaseExpiresAt) || claim.bucket !== BUCKET
    || claim.objectPath !== expectedPath(claim.accountId, claim.receiptId, claim.artifactGeneration)) throw new Rejected(502, 'EXPORT_INVALID_RESPONSE');
  let deleted = false;
  try {
    const removed = await transport.request(`/storage/v1/object/${BUCKET}`, {
      method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prefixes: [claim.objectPath] }),
    }, true);
    if (!removed.ok) { void removed.body?.cancel().catch(() => undefined); throw new Rejected(503, 'EXPORT_UNAVAILABLE'); }
    void removed.body?.cancel().catch(() => undefined);
    const absent = await transport.request(transport.storagePath(String(claim.objectPath)), { method: 'GET' }, true);
    // A missing tenant/bucket or a generic proxy 404 is not a deletion receipt.
    deleted = await objectAbsent(absent, transport.signal);
  } catch { deleted = false; }
  if (!liveInstant(claim.leaseExpiresAt)) throw new Rejected(409, 'EXPORT_ATTEMPT_STALE');
  const completed = row(await transport.rpc('rpc_complete_data_export_cleanup', { p_receipt_id: claim.receiptId,
    p_artifact_generation: claim.artifactGeneration, p_cleanup_attempt_id: claim.cleanupAttemptId, p_deleted: deleted }, true));
  if (!completed || !only(completed, ['receiptId', 'artifactGeneration', 'deleted']) || completed.receiptId !== claim.receiptId
    || completed.artifactGeneration !== claim.artifactGeneration || completed.deleted !== deleted) throw new Rejected(502, 'EXPORT_INVALID_RESPONSE');
}
Deno.serve(async req => {
  const early = preflight(req); if (early) return early;
  return bounded(req, async (transport, signal) => {
    const internal = transport.isInternal();
    const accountId = internal ? null : await transport.user();
    const release = reserve(accountId ?? 'internal-worker');
    try {
      const input = row(await parseJSON(req.body, 2048, signal));
      if (!input || !only(input, ['action', 'receiptId']) || !['prepare', 'cleanup', 'tick'].includes(String(input.action))
        || (input.action === 'tick' ? !internal || input.receiptId !== undefined : !uuid(input.receiptId))) return json({ code: 'EXPORT_REQUEST_INVALID' }, 400);
      const receiptId = input.action === 'tick' ? null : String(input.receiptId);
      if (!internal) {
        const status = row(await transport.rpc('rpc_get_data_export_status', {}));
        const request = row(status?.request);
        if (status?.hasRequest !== true || request?.receiptId !== receiptId) return json({ receiptId, kind: 'NOT_READY', code: 'NOT_AVAILABLE' });
      }
      if (input.action === 'cleanup') { await cleanup(transport, receiptId, accountId); return json({ receiptId, kind: 'NOT_READY', code: 'NOT_AVAILABLE' }); }
      const result = await prepare(transport, receiptId, accountId);
      if (internal && input.action === 'tick') { await cleanup(transport, null, null); return json({ kind: 'TICK_COMPLETED' }); }
      return json({ receiptId, ...result });
    } finally { release(); }
  });
});
