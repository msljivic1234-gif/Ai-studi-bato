'use strict';
// Actual captured/current Edge handler, current admission and actual sanitizer /
// M4A inspectors. Auth, RPC, Storage, clocks and the WASM decoder are local seams.
// Synthetic bytes only: no network/provider, native, hosted SQL or codec proof.
const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const { createHash, randomUUID, webcrypto } = require('node:crypto');
const ts = require('typescript');
const ROOT = path.resolve(__dirname, '..');
const ENTRY = 'supabase/functions/uskoci-media/index.ts';
const preimageBytes = fs.readFileSync(path.join(__dirname, 'media-v28.preimage.json'));
assert.equal(createHash('sha256').update(preimageBytes).digest('hex'), 'f88b3d710976e718d1c1e460dfcb346bbd7643860a2f00042de68b40821a8fa6');
const preimage = JSON.parse(preimageBytes);
assert.equal(createHash('sha256').update(preimage.file.content).digest('hex'), preimage.file.sha256);
for (const f of preimage.full_package_manifest.filter(x => !x.name.endsWith('/uskoci-media/index.ts'))) {
  assert.equal(createHash('sha256').update(fs.readFileSync(path.join(ROOT, 'supabase', f.name))).digest('hex'), f.sha256,
    'The two unchanged codec dependencies match the captured v28 package');
}
const ACCOUNT = '11111111-1111-4111-8111-111111111111';
const FOREIGN = '22222222-2222-4222-8222-222222222222';
const TARGET = '33333333-3333-4333-8333-333333333333';
const SESSION = '44444444-4444-4444-8444-444444444444';
const ORIGIN = 'https://media-fixture.supabase.invalid';
const SAMPLE = Uint8Array.from([255, 216, 255, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 255, 217]);
const tick = () => new Promise(resolve => setImmediate(resolve));
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };
async function until(predicate) { for (let i = 0; i < 30 && !predicate(); i++) await tick(); assert.ok(predicate(), 'local transition completed'); }
function clock() {
  let next = 0; const active = new Map();
  return { active, setTimeout(fn, ms) { const id = ++next; active.set(id, { fn, ms }); return id; },
    clearTimeout(id) { active.delete(id); },
    fire(ms) { for (const [id, t] of [...active]) if (t.ms === ms && active.delete(id)) t.fn(); } };
}
function body(chunks = [new Uint8Array(SAMPLE)], options = {}) {
  const gate = deferred(); let index = 0, cancelled = false;
  const stats = { acquired: 0, reads: 0, cancelled: 0, chunks };
  const reader = {
    async read() {
      stats.reads++; const at = index++;
      if (at === options.holdAt) await gate.promise;
      if (cancelled || at >= chunks.length) return { done: true };
      if (at === options.errorAt) throw new Error('synthetic body failure');
      return { done: false, value: chunks[at] };
    },
    async cancel() { cancelled = true; stats.cancelled++; gate.resolve(); },
  };
  return { stats, release: () => gate.resolve(), getReader() { stats.acquired++; return reader; } };
}
function jwt(account = ACCOUNT) {
  return 'e30.' + Buffer.from(JSON.stringify({ sub: account, role: 'authenticated', session_id: SESSION,
    iss: ORIGIN + '/auth/v1', exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url') + '.c2ln';
}
function request(kind = 'TASK', options = {}) {
  const controller = new AbortController(), stream = options.body ?? body(undefined, options.bodyOptions);
  const key = options.key ?? randomUUID();
  const op = kind === 'VOICE' ? 'agreement-voice-upload' : kind === 'PHOTO' ? 'agreement-upload' : 'upload';
  const headers = new Headers({ authorization: 'Bearer ' + jwt(options.claimAccount ?? options.account),
    'content-type': kind === 'VOICE' ? 'audio/mp4' : 'image/jpeg', 'x-media-operation': op,
    'x-media-target': TARGET, 'x-media-request-id': key, 'x-media-version': '1', 'x-media-scope': 'TASK', ...options.headers });
  return { method: 'POST', headers, body: stream, signal: controller.signal, controller, key, kind, stream };
}
function harness(options = {}) {
  const timer = clock(), calls = [], requests = [], records = new Map(), storage = new Map(), posts = [], sanitizerInputs = [], sanitizerOutputs = [];
  const config = { full: false, ...options };
  let handler;
  const json = (value, status = 200) => new Response(JSON.stringify(value), { status, headers: { 'content-type': 'application/json' } });
  const actualOwner = authorization => config.authAccount ?? JSON.parse(Buffer.from(authorization.split('.')[1], 'base64url')).sub;
  const plain = r => ({ assetId: r.assetId, accountId: config.foreignReceipt ? FOREIGN : r.accountId,
    clientRequestId: r.key, scope: 'TASK', state: r.state, authoritative: true,
    ...(r.state === 'READY' ? { sha256: r.sha256, ref: r.path, byteSize: r.byteSize, contentType: 'image/jpeg', width: 16, height: 16 } : {}) });
  const transfer = r => ({ receipt: { accountId: config.foreignReceipt ? FOREIGN : r.accountId, agreementId: TARGET,
    agreementVersion: 1, clientRequestId: r.key, assetId: r.assetId, state: r.state, attachedMessageId: null,
    [r.kind === 'VOICE' ? 'voice' : 'photo']: r.state === 'READY' ? { assetId: r.assetId, contentType: r.kind === 'VOICE' ? 'audio/mp4' : 'image/jpeg',
      byteSize: r.byteSize, ...(r.kind === 'VOICE' ? { durationMs: 1000 } : { width: 16, height: 16 }) } : null, authoritative: true },
    attemptId: r.attemptId, path: r.path ?? null, sha256: r.sha256 ?? null, byteSize: r.byteSize ?? null,
    ...(r.kind === 'VOICE' ? { durationMs: r.path ? 1000 : null } : {}),
    dispatchState: r.dispatchState, dispatchOutcome: r.dispatchOutcome, acquired: r.acquired });
  function createRecord(key, accountId, kind) {
    const r = { key, accountId, kind, assetId: randomUUID(), attemptId: randomUUID(), state: 'PROCESSING',
      dispatchState: 'NOT_DISPATCHED', dispatchOutcome: null, acquired: config.full };
    records.set(key, r); return r;
  }
  const network = async (raw, init = {}) => {
    const url = new URL(raw); assert.equal(url.origin, ORIGIN, 'No external request escapes this fixture');
    if (init.signal?.aborted) throw new Error('synthetic aborted fetch');
    const headers = new Headers(init.headers);
    requests.push({ path: url.pathname, method: init.method ?? 'GET', headers });
    if (url.pathname === '/auth/v1/user') {
      calls.push({ name: 'auth' }); return config.authDenied ? json({}, 401) : json({ id: actualOwner(headers.get('authorization')) });
    }
    if (url.pathname.startsWith('/storage/v1/object/')) {
      const key = url.pathname.replace('/storage/v1/object/', '');
      if (init.method === 'POST') {
        posts.push(key);
        if (config.storageReject) { const status = config.storageReject; config.storageReject = null; return new Response('', { status }); }
        storage.set(key, new Uint8Array(init.body instanceof ArrayBuffer ? init.body.slice(0) : init.body));
        if (config.losePostResponse) { config.losePostResponse = false; throw new Error('synthetic lost Storage response'); }
        return new Response('', { status: 200 });
      }
      const bytes = storage.get(key); if (!bytes) return new Response('', { status: 404 });
      return new Response(new Uint8Array(bytes), { headers: { 'content-type': key.includes('agreement-voice/') ? 'audio/mp4' : 'image/jpeg' } });
    }
    if (url.pathname === '/rest/v1/needs') { calls.push({ name: 'public-need-projection' }); return json([]); }
    const name = url.pathname.split('/').at(-1), args = JSON.parse(init.body ?? '{}'); calls.push({ name, args });
    if (name === 'rpc_read_media_asset_service') {
      const r = [...records.values()].find(x => x.assetId === args.p_asset_id); assert.ok(r); return json(plain(r));
    }
    if (name === 'rpc_agreement_photo_read_service_v5') {
      const r = [...records.values()].find(x => x.assetId === args.p_asset_id); assert.ok(r);
      const n = calls.filter(x => x.name === name).length;
      if (config.revokeRead && n > 1) return json({ message: 'MEDIA_NOT_FOUND' }, 403);
      return json({ assetId: r.assetId, agreementId: TARGET, messageId: null, bucket: 'profile-media', path: r.path,
        sha256: r.sha256, contentType: 'image/jpeg', byteSize: r.byteSize, authoritative: true });
    }
    if (name === 'rpc_claim_media_upload_service') {
      if (config.claimReject) { const message = config.claimReject; config.claimReject = null; return json({ message }, 409); }
      const existed = records.has(args.p_client_request_id), r = records.get(args.p_client_request_id) ?? createRecord(args.p_client_request_id, args.p_account_id, 'TASK');
      r.acquired = config.full && !existed;
      return json({ acquired: r.acquired, attemptId: r.attemptId, asset: plain(r), staged: { ...r } });
    }
    if (['rpc_agreement_photo_upload_service_v5', 'rpc_agreement_voice_upload_service_v1'].includes(name)) {
      if (config.claimReject) { const message = config.claimReject; config.claimReject = null; return json({ message }, 409); }
      const kind = name.includes('voice') ? 'VOICE' : 'PHOTO';
      const existed = records.has(args.p_key), r = records.get(args.p_key) ?? createRecord(args.p_key, args.p_account_id, kind);
      assert.equal(args.p_account_id, r.accountId); assert.equal(args.p_session_id, SESSION);
      if (args.p_operation === 'CLAIM') r.acquired = config.full && !existed;
      else if (args.p_operation === 'FAIL') { r.state = 'FAILED'; r.acquired = false; }
      else if (args.p_operation === 'STAGE') {
        Object.assign(r, { state: 'STAGED', sha256: args.p_input.sha256, byteSize: args.p_input.byteSize,
          path: `${r.accountId}/agreement-v5/${r.assetId}/${args.p_input.sha256}.jpg` });
      } else if (args.p_operation === 'DISPATCH') r.dispatchState = 'DISPATCHING';
      else if (args.p_operation === 'SETTLE') { r.dispatchState = 'SETTLED'; r.dispatchOutcome = args.p_input.outcome; r.state = args.p_input.outcome === 'STORED' ? 'READY' : 'FAILED'; }
      else assert.fail('Unsupported fixture transfer operation: ' + args.p_operation);
      return json(transfer(r));
    }
    const r = [...records.values()].find(x => x.assetId === args.p_asset_id); assert.ok(r, 'RPC addresses one fixture-owned asset');
    assert.equal(args.p_account_id, r.accountId, 'Writer identity comes from verified Auth, not caller headers');
    if (name === 'rpc_fail_media_upload_service') { r.state = 'FAILED'; return json(true); }
    if (name === 'rpc_stage_media_upload_service') {
      Object.assign(r, { state: 'STAGED', sha256: args.p_sha256, byteSize: args.p_byte_size, path: `${r.accountId}/v5/${r.assetId}/${args.p_sha256}.jpg` });
      return json({ ...r });
    }
    if (name === 'rpc_dispatch_media_upload_service') { r.dispatchState = 'DISPATCHING'; return json(true); }
    if (name === 'rpc_settle_media_upload_service') { r.dispatchState = 'SETTLED'; r.dispatchOutcome = args.p_outcome; return json(true); }
    if (name === 'rpc_complete_media_upload_service') { r.state = 'READY'; return json(plain(r)); }
    assert.fail('Unexpected fixture RPC: ' + name);
  };
  const magick = {
    ResourceLimits: {}, MagickFormat: { Jpeg: 'JPEG', Png: 'PNG', WebP: 'WEBP' },
    MagickReadSettings: class { constructor(value) { Object.assign(this, value); } },
    MagickImageInfo: { create(input) { sanitizerInputs.push(input); if (config.sanitizerError) { config.sanitizerError = false; throw new Error('MEDIA_SANITIZATION_FAILED'); } return { width: 16, height: 16 }; } },
    initializeImageMagick: async () => {}, MagickColors: { White: 'white' }, AlphaAction: { Remove: 'remove' }, ColorSpace: { sRGB: 'sRGB' },
    ImageMagick: { read(_input, _settings, callback) { return callback({ width: 16, height: 16, profileNames: [], attributeNames: [],
      autoOrient() {}, alpha() {}, strip() {}, write(_format, cb) { const output = new Uint8Array(SAMPLE); sanitizerOutputs.push(output); return cb(output); } }); } },
  };
  const globals = { Deno: { env: { get: name => ({ SUPABASE_URL: ORIGIN, SUPABASE_ANON_KEY: 'public-fixture', SUPABASE_SERVICE_ROLE_KEY: 'service-fixture', ...config.env })[name] },
    readFile: async () => new Uint8Array(), serve: fn => { handler = fn; } },
    fixtureImportMeta: { resolve: () => 'file:///synthetic-magick.wasm' }, fetch: network, crypto: webcrypto,
    setTimeout: timer.setTimeout, clearTimeout: timer.clearTimeout };
  const modules = new Map();
  const load = name => {
    if (modules.has(name)) return modules.get(name).exports;
    const filename = path.join(ROOT, name), source = name === ENTRY && config.old ? preimage.file.content : fs.readFileSync(filename, 'utf8');
    const meta = context => {
      const visit = node => ts.isMetaProperty(node) && node.keywordToken === ts.SyntaxKind.ImportKeyword
        ? context.factory.createIdentifier('fixtureImportMeta') : ts.visitEachChild(node, visit, context);
      return node => ts.visitNode(node, visit);
    };
    const compiled = ts.transpileModule(source, { fileName: filename.replace(/\.mjs$/, '.ts'), reportDiagnostics: true,
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }, transformers: { before: [meta] } });
    assert.deepEqual((compiled.diagnostics ?? []).filter(d => d.category === ts.DiagnosticCategory.Error), []);
    const mod = { exports: {} }; modules.set(name, mod);
    const localRequire = target => {
      if (target === 'npm:@imagemagick/magick-wasm@0.0.43') return magick;
      assert.ok(target.startsWith('.'), 'No uncontrolled external module');
      return load(path.relative(ROOT, path.resolve(path.dirname(filename), target)));
    };
    new Function('require', 'module', 'exports', ...Object.keys(globals), compiled.outputText)(localRequire, mod, mod.exports, ...Object.values(globals));
    return mod.exports;
  };
  load(ENTRY); assert.equal(typeof handler, 'function');
  return { handler, timer, calls, requests, records, storage, posts, config, sanitizerInputs, sanitizerOutputs,
    pending: () => calls.filter(c => /(?:claim_media|upload_service)/.test(c.name)),
    decode: async req => { const r = await handler(req); return { status: r.status, body: await r.json() }; } };
}

test('captured v28 rejects a second image and voice while the first image holds its global flag', async () => {
  const h = harness({ old: true }), first = request('TASK', { bodyOptions: { holdAt: 0 } });
  const pending = h.decode(first); await until(() => first.stream.stats.reads === 1);
  const second = request(), voice = request('VOICE');
  assert.deepEqual(await h.decode(second), { status: 429, body: { code: 'MEDIA_UPLOAD_PENDING' } });
  assert.deepEqual(await h.decode(voice), { status: 429, body: { code: 'MEDIA_BUSY' } });
  assert.equal(second.stream.stats.acquired, 0); assert.equal(voice.stream.stats.acquired, 0);
  first.stream.release(); assert.equal((await pending).status, 200);
});

test('two image requests complete FIFO; a waiting image never reads its upload body', async () => {
  const h = harness(), first = request('TASK', { bodyOptions: { holdAt: 0 } }), second = request();
  const a = h.decode(first); await until(() => first.stream.stats.reads === 1);
  const b = h.decode(second); await until(() => h.timer.active.size === 3);
  assert.equal(second.stream.stats.acquired, 0); first.stream.release();
  assert.equal((await a).status, 200); assert.equal((await b).status, 200);
  assert.deepEqual(h.pending().map(c => c.args.p_client_request_id), [first.key, second.key]);
  assert.ok(first.stream.stats.chunks[0].every(x => x === 0)); assert.ok(second.stream.stats.chunks[0].every(x => x === 0));
  assert.equal(h.timer.active.size, 0);
});

test('two voice requests progress independently from a held image; the third voice waits', async () => {
  const h = harness(), photo = request('TASK', { bodyOptions: { holdAt: 0 } });
  const p = h.decode(photo); await until(() => photo.stream.stats.reads === 1);
  const a = request('VOICE', { bodyOptions: { holdAt: 0 } }), b = request('VOICE', { bodyOptions: { holdAt: 0 } }), c = request('VOICE');
  const pa = h.decode(a), pb = h.decode(b); await until(() => a.stream.stats.reads && b.stream.stats.reads);
  const pc = h.decode(c); await until(() => [...h.timer.active.values()].some(t => t.ms === 4000));
  assert.equal(c.stream.stats.acquired, 0); a.stream.release();
  assert.equal((await pa).status, 200); assert.equal((await pc).status, 200);
  assert.equal(photo.stream.stats.reads, 1); b.stream.release(); photo.stream.release();
  assert.equal((await pb).status, 200); assert.equal((await p).status, 200); assert.equal(h.timer.active.size, 0);
});

test('image queue holds at most four requests and preserves each established refusal code', async () => {
  for (const kind of ['TASK', 'PHOTO']) {
    const h = harness(), active = request(kind, { bodyOptions: { holdAt: 0 } }), first = h.decode(active);
    await until(() => active.stream.stats.reads === 1);
    const waiting = Array.from({ length: 4 }, () => request(kind)), promises = waiting.map(r => h.decode(r));
    await until(() => [...h.timer.active.values()].filter(t => t.ms === 4000).length === 4);
    const excess = request(kind), result = await h.decode(excess);
    assert.equal(result.status, 429); assert.equal(result.body.code, kind === 'TASK' ? 'MEDIA_UPLOAD_PENDING' : 'MEDIA_BUSY');
    assert.equal(excess.stream.stats.acquired, 0); assert.ok(waiting.every(r => r.stream.stats.acquired === 0));
    active.stream.release(); assert.equal((await first).status, 200); assert.ok((await Promise.all(promises)).every(x => x.status === 200));
  }
});

test('waiting deadline refuses without reading bytes; the next upload can use the freed place', async () => {
  const h = harness(), active = request('TASK', { bodyOptions: { holdAt: 0 } });
  const first = h.decode(active); await until(() => active.stream.stats.reads === 1);
  const waiting = request(), second = h.decode(waiting); await until(() => [...h.timer.active.values()].some(t => t.ms === 4000));
  h.timer.fire(4000); assert.deepEqual(await second, { status: 429, body: { code: 'MEDIA_UPLOAD_PENDING' } });
  assert.equal(waiting.stream.stats.acquired, 0); assert.equal(h.pending().length, 0);
  active.stream.release(); assert.equal((await first).status, 200); assert.equal((await h.decode(request())).status, 200);
});

test('cancelling a queued upload removes it without consuming body or another admission', async () => {
  const h = harness(), active = request('TASK', { bodyOptions: { holdAt: 0 } });
  const first = h.decode(active); await until(() => active.stream.stats.reads === 1);
  const waiting = request(), second = h.decode(waiting); await until(() => [...h.timer.active.values()].some(t => t.ms === 4000));
  waiting.controller.abort(); assert.deepEqual(await second, { status: 503, body: { code: 'MEDIA_UNCONFIRMED' } });
  assert.equal(waiting.stream.stats.acquired, 0); active.stream.release(); assert.equal((await first).status, 200);
  assert.equal((await h.decode(request())).status, 200); assert.equal(h.timer.active.size, 0);
});

test('active body cancellation and body error wipe received bytes and release the waiting image', async () => {
  for (const reason of ['abort', 'read-error']) {
    const h = harness(), stream = body([new Uint8Array(SAMPLE), new Uint8Array(SAMPLE)], { holdAt: 1, ...(reason === 'read-error' ? { errorAt: 1 } : {}) });
    const active = request('TASK', { body: stream }), first = h.decode(active);
    await until(() => stream.stats.reads === 2); const second = h.decode(request());
    if (reason === 'abort') active.controller.abort(); else stream.release();
    assert.equal((await first).status, 503); assert.ok(stream.stats.chunks[0].every(x => x === 0));
    assert.equal((await second).status, 200); assert.ok(stream.stats.cancelled > 0); assert.equal(h.timer.active.size, 0);
  }
});

test('an oversized just-received chunk is wiped together with all earlier chunks', async () => {
  const h = harness(), prior = new Uint8Array(SAMPLE), excess = new Uint8Array(10 * 1024 * 1024).fill(7);
  const req = request('TASK', { body: body([prior, excess]) });
  assert.deepEqual(await h.decode(req), { status: 413, body: { code: 'MEDIA_INPUT_INVALID' } });
  assert.ok(prior.every(x => x === 0)); assert.ok(excess.every(x => x === 0), 'the offending chunk must not remain outside final cleanup');
  assert.equal(h.pending().length, 0); assert.equal((await h.decode(request())).status, 200);
});

test('a chunk resolved immediately before cancellation is still cleared before refusal', async () => {
  const h = harness(), chunk = new Uint8Array(SAMPLE); let req, cancelled = 0;
  const stream = { getReader: () => ({
    read() {
      // The read has already resolved with bytes; cancellation cannot change
      // that resolved result before the awaiting handler resumes.
      queueMicrotask(() => req.controller.abort());
      return Promise.resolve({ done: false, value: chunk });
    },
    async cancel() { cancelled++; },
  }) };
  req = request('TASK', { body: stream });
  assert.deepEqual(await h.decode(req), { status: 503, body: { code: 'MEDIA_UNCONFIRMED' } });
  assert.ok(chunk.every(x => x === 0), 'already-delivered bytes remain owned until cleanup');
  assert.ok(cancelled > 0); assert.equal(h.pending().length, 0);
  assert.equal((await h.decode(request())).status, 200);
});

test('server ownership and six-photo-limit refusals survive admission and free the next request', async () => {
  for (const code of ['MEDIA_NOT_EDITABLE', 'MEDIA_NOT_FOUND', 'MEDIA_LIMIT_REACHED']) {
    const h = harness({ claimReject: code }), result = await h.decode(request());
    assert.equal(result.status, code === 'MEDIA_NOT_FOUND' ? 403 : 409); assert.equal(result.body.code, code);
    assert.equal(h.posts.length, 0); assert.equal((await h.decode(request())).status, 200);
  }
});

test('upload identity comes from Auth; a foreign authoritative receipt is refused before Storage', async () => {
  const h = harness(), req = request('TASK', { account: FOREIGN, headers: { 'x-media-account-id': ACCOUNT } });
  assert.equal((await h.decode(req)).status, 200); assert.equal(h.pending()[0].args.p_account_id, FOREIGN);
  const foreign = harness({ foreignReceipt: true });
  assert.deepEqual(await foreign.decode(request()), { status: 503, body: { code: 'MEDIA_UNCONFIRMED' } });
  assert.equal(foreign.posts.length, 0); foreign.config.foreignReceipt = false;
  assert.equal((await foreign.decode(request())).status, 200);
  const mismatchedSession = harness({ authAccount: ACCOUNT });
  assert.deepEqual(await mismatchedSession.decode(request('VOICE', { claimAccount: FOREIGN })), { status: 401, body: { code: 'AUTH_REQUIRED' } });
  assert.equal(mismatchedSession.pending().length, 0);
});

test('successful TASK and Agreement photo uploads keep canonical claim-stage-dispatch-readback-settle', async () => {
  for (const kind of ['TASK', 'PHOTO']) {
    const h = harness({ full: true }), result = await h.decode(request(kind));
    assert.equal(result.status, 200); assert.equal(result.body.state, 'READY'); assert.equal(result.body.accountId, ACCOUNT);
    assert.equal(h.posts.length, 1); assert.ok(h.sanitizerInputs.every(b => b.every(x => x === 0)));
    assert.equal(h.timer.active.size, 0);
  }
});

test('sanitizer and Storage errors release admission and never pretend an unknown dispatch was rejected', async () => {
  for (const failure of ['sanitizerError', 'storageReject']) {
    const h = harness({ full: true, [failure]: failure === 'storageReject' ? 503 : true });
    const first = await h.decode(request()); assert.equal(first.status, failure === 'sanitizerError' ? 400 : 503);
    assert.ok(h.sanitizerInputs.every(b => b.every(x => x === 0)));
    if (failure === 'storageReject') assert.equal(h.calls.filter(c => c.name === 'rpc_settle_media_upload_service').length, 0);
    assert.equal((await h.decode(request())).body.state, 'READY'); assert.equal(h.timer.active.size, 0);
  }
});

test('lost Storage response can reconcile the same upload without a second POST', async () => {
  const h = harness({ full: true, losePostResponse: true }), key = randomUUID();
  assert.equal((await h.decode(request('TASK', { key }))).status, 503); assert.equal(h.posts.length, 1);
  const replay = await h.decode(request('TASK', { key })); assert.equal(replay.status, 200); assert.equal(replay.body.state, 'READY');
  assert.equal(h.posts.length, 1); assert.equal(h.calls.filter(c => c.name === 'rpc_dispatch_media_upload_service').length, 1);
});

test('private image proxy refuses a foreign viewer and rechecks a revoked Agreement grant', async () => {
  const h = harness({ full: true }); const uploaded = await h.decode(request()); const r = h.records.values().next().value;
  const read = (account, need = false) => request('TASK', { account, headers: { 'x-media-operation': 'read' },
    body: body([new TextEncoder().encode(JSON.stringify({ assetId: uploaded.body.assetId, ...(need ? { needId: TARGET } : {}) }))]) });
  const own = await h.handler(read(ACCOUNT)); assert.equal(own.status, 200); assert.deepEqual(new Uint8Array(await own.arrayBuffer()), SAMPLE);
  assert.equal((await h.decode(read(FOREIGN))).status, 403); assert.equal((await h.decode(read(FOREIGN, true))).status, 403);
  const grant = harness({ full: true, revokeRead: true }); const photo = await grant.decode(request('PHOTO'));
  const revoked = request('PHOTO', { headers: { 'x-media-operation': 'agreement-read' },
    body: body([new TextEncoder().encode(JSON.stringify({ agreementId: TARGET, assetId: photo.body.assetId }))]) });
  assert.deepEqual(await grant.decode(revoked), { status: 403, body: { code: 'MEDIA_NOT_FOUND' } });
  assert.equal(grant.calls.filter(c => c.name === 'rpc_agreement_photo_read_service_v5').length, 2);
  assert.equal(r.state, 'READY'); // A denied read never rewrites the owner's upload.
});
