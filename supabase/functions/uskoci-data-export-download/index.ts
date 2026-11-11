import { bounded, BUCKET, bytesCount, cors, expectedPath, hash, json, liveInstant, MAX_BYTES, md5, only, parseJSON, preflight, readBytes, Rejected, reserve, row, sha256, uuid } from '../_shared/data-export.ts';
declare const Deno: { serve(handler: (req: Request) => Promise<Response> | Response): unknown };
Deno.serve(async req => {
  const early = preflight(req); if (early) return early;
  return bounded(req, async (transport, signal) => {
    const accountId = await transport.user(), release = reserve(accountId);
    let bytes: Uint8Array<ArrayBuffer> | undefined;
    try {
      const input = row(await parseJSON(req.body, 2048, signal));
      if (!input || !only(input, ['receiptId', 'artifactGeneration']) || !uuid(input.receiptId) || !uuid(input.artifactGeneration)) return json({ code: 'EXPORT_REQUEST_INVALID' }, 400);
      const grant = row(await transport.rpc('rpc_authorize_data_export_download', { p_receipt_id: input.receiptId, p_artifact_generation: input.artifactGeneration }));
      if (!grant || !only(grant, ['receiptId', 'downloadGrantId', 'artifactGeneration', 'expiresAt'])
        || grant.receiptId !== input.receiptId || grant.artifactGeneration !== input.artifactGeneration
        || !uuid(grant.downloadGrantId) || !liveInstant(grant.expiresAt)) throw new Rejected(502, 'EXPORT_INVALID_RESPONSE');
      const args = { p_receipt_id: input.receiptId, p_download_grant_id: grant.downloadGrantId, p_account_id: accountId };
      const target = row(await transport.rpc('rpc_resolve_data_export_download', args, true));
      if (!target || !only(target, ['receiptId', 'accountId', 'downloadGrantId', 'artifactGeneration', 'expiresAt', 'artifactExpiresAt', 'bucket', 'objectPath', 'byteLength', 'sha256', 'md5'])
        || target.receiptId !== input.receiptId || target.accountId !== accountId || target.downloadGrantId !== grant.downloadGrantId
        || target.artifactGeneration !== input.artifactGeneration || target.bucket !== BUCKET
        || target.objectPath !== expectedPath(accountId, input.receiptId, input.artifactGeneration)
        || !liveInstant(target.expiresAt) || !liveInstant(target.artifactExpiresAt) || Date.parse(target.expiresAt) > Date.parse(grant.expiresAt)
        || Date.parse(target.expiresAt) > Date.parse(target.artifactExpiresAt) || !bytesCount(target.byteLength) || !hash(target.sha256) || !md5(target.md5)) throw new Rejected(502, 'EXPORT_INVALID_RESPONSE');
      const stored = await transport.request(transport.storagePath(String(target.objectPath)), { method: 'GET' }, true);
      if (!stored.ok) { void stored.body?.cancel().catch(() => undefined); throw new Rejected(503, 'EXPORT_NOT_AVAILABLE'); }
      bytes = await readBytes(stored.body, MAX_BYTES, signal);
      if (bytes.length !== target.byteLength || await sha256(bytes) !== target.sha256) throw new Rejected(502, 'EXPORT_INVALID_RESPONSE');
      // Buffer the bounded artifact, then recheck authority before any byte is
      // released. Revocation cannot recall a file that was already transferred.
      const current = row(await transport.rpc('rpc_resolve_data_export_download', args, true));
      if (!current || Object.keys(target).some(key => current[key] !== target[key]) || Object.keys(current).length !== Object.keys(target).length
        || !liveInstant(target.expiresAt) || signal.aborted) throw new Rejected(409, 'EXPORT_NOT_AVAILABLE');
      const released = bytes; bytes = undefined;
      return new Response(released, { headers: { ...cors, 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': String(released.length),
        'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff',
        'Content-Disposition': `attachment; filename="uskoci-izvoz-${input.receiptId}-${input.artifactGeneration}.json"`,
        'x-uskoci-export-receipt': input.receiptId, 'x-uskoci-export-generation': input.artifactGeneration,
        'x-uskoci-export-sha256': target.sha256, 'x-uskoci-export-md5': target.md5, 'x-uskoci-export-expires-at': target.expiresAt } });
    } finally { bytes?.fill(0); release(); }
  });
});
