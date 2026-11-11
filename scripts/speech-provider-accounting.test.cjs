'use strict';
// Execute the actual Edge handler, speech proxy and budget helper together.
// HTTP, WebSocket, Auth identity and time are entirely local substitutes. This
// makes no provider call and is not a native microphone or hosted-STT proof.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const ts = require('typescript');
const ROOT = path.resolve(__dirname, '..');
const PREIMAGE = fs.readFileSync(path.join(__dirname, 'speech-v29.preimage.json'));
assert.equal(createHash('sha256').update(PREIMAGE).digest('hex'), '68b811cf88623388b5a9e69c5f853a029eb9b6d54515efb12092fd1ddc1ec77c');
const deployed = JSON.parse(PREIMAGE);
const ACCOUNT = '11111111-1111-4111-8111-111111111111';
const CONVERSATION = '22222222-2222-4222-8222-222222222222';
const OPERATION = '33333333-3333-4333-8333-333333333333';
const RESERVATION = '44444444-4444-4444-8444-444444444444';
const PCM = Buffer.alloc(3200).toString('base64');
const compiled = new Map();
const turn = () => new Promise(resolve => setImmediate(resolve));

function clock() {
  let counter = 0; const active = new Map();
  return {
    setTimeout(fn, ms) { const id = ++counter; active.set(id, { fn, ms }); return id; },
    clearTimeout(id) { active.delete(id); },
    fire(ms) { for (const [id, timer] of [...active]) if (timer.ms === ms && active.delete(id)) timer.fn(); },
    active,
  };
}

class Socket {
  constructor() { this.readyState = 1; this.bufferedAmount = 0; this.sent = []; this.closed = 0; }
  send(raw) {
    const value = JSON.parse(raw);
    if (this.throwAudio && value.realtimeInput?.audio) throw new Error('synthetic send failure');
    this.sent.push(value);
  }
  close() { if (this.readyState === 3) return; this.readyState = 3; this.closed++; this.onclose?.({}); }
  open() { this.readyState = 1; this.onopen?.({}); }
  receive(value) { this.onmessage?.({ data: typeof value === 'string' || value instanceof ArrayBuffer || value instanceof Blob ? value : JSON.stringify(value) }); }
}

function loadSources(overrides, globals) {
  const modules = new Map();
  function load(name) {
    name = name.replaceAll(path.sep, '/');
    if (modules.has(name)) return modules.get(name).exports;
    const filename = path.join(ROOT, name), source = overrides[name] ?? fs.readFileSync(filename, 'utf8');
    const key = name + '\0' + source;
    if (!compiled.has(key)) {
      const result = ts.transpileModule(source, { fileName: filename.replace(/\.mjs$/, '.ts'), reportDiagnostics: true,
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } });
      assert.deepEqual((result.diagnostics ?? []).filter(d => d.category === ts.DiagnosticCategory.Error), []);
      compiled.set(key, result.outputText);
    }
    const mod = { exports: {} }; modules.set(name, mod);
    const localRequire = target => {
      assert.ok(target.startsWith('.'), 'Edge fixture does not import uncontrolled external runtime');
      return load(path.relative(ROOT, path.resolve(path.dirname(filename), target)));
    };
    new Function('require', 'module', 'exports', ...Object.keys(globals), compiled.get(key))
      (localRequire, mod, mod.exports, ...Object.values(globals));
    return mod.exports;
  }
  return load;
}

async function harness(options = {}) {
  const timer = clock(), client = new Socket(), upstreams = [], requests = [], background = [], logs = [];
  let handler, upgrades = 0;
  const env = {
    SUPABASE_URL: 'https://speech-fixture.supabase.invalid', SUPABASE_ANON_KEY: 'public-fixture',
    SUPABASE_SERVICE_ROLE_KEY: 'fixture-service-key', GEMINI_API_KEY: 'fixture-provider-key',
    USKOCI_GEMINI_PAID_TEST_ENABLED: 'true', USKOCI_SPEECH_CONTROLLED_TEST_ENABLED: 'true', ...options.env,
  };
  const json = (value, status = 200) => new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json' } });
  const network = async (url, init = {}) => {
    const parsed = new URL(url);
    assert.equal(parsed.origin, env.SUPABASE_URL, 'Only the stub Supabase origin is admitted');
    const args = init.body ? JSON.parse(init.body) : null;
    requests.push({ path: parsed.pathname, args, headers: init.headers });
    if (parsed.pathname === '/auth/v1/user') return json({ id: ACCOUNT });
    if (parsed.pathname === '/rest/v1/ai_conversations') return json([{ id: CONVERSATION,
      account_id: options.foreignConversation ? RESERVATION : ACCOUNT,
      status: options.conversationStatus ?? 'OPEN', purpose: options.purpose ?? 'NEED_INTAKE' }]);
    if (parsed.pathname.endsWith('/rpc_read_worker_ai_context_service')) return json({
      schemaVersion: 'WORKER_PROFILE_V1', accountId: ACCOUNT, conversationId: CONVERSATION,
      status: 'OPEN', stale: options.staleWorker ?? false, safety: 'ALLOW',
    });
    if (parsed.pathname.endsWith('/rpc_ai_test_budget_reserve_service')) {
      if (options.hangReserve) return new Promise(() => {});
      return json(options.budget ?? { admitted: true, reservationId: RESERVATION, replay: false, code: 'AI_TEST_RESERVED' });
    }
    if (parsed.pathname.endsWith('/rpc_ai_test_release_unused_reservation_service')) {
      if (options.hangAccounting) return new Promise(() => {});
      return json({ operationId: options.wrongAccountingIdentity ? RESERVATION : OPERATION, released: true, code: 'AI_RELEASE_DONE' });
    }
    if (parsed.pathname.endsWith('/rpc_ai_test_settle_audio_service')) {
      if (options.hangAccounting) return new Promise(() => {});
      return json({ operationId: options.wrongAccountingIdentity ? RESERVATION : OPERATION, settled: true, code: 'AI_AUDIO_SETTLED' });
    }
    throw new Error('Unmodelled local HTTP path: ' + parsed.pathname);
  };
  const upgraded = new Response('local-websocket-upgrade', { status: 200 }); // Node cannot construct status 101.
  const globals = {
    Deno: { env: { get: name => env[name] }, serve: fn => { handler = fn; },
      upgradeWebSocket() { upgrades++; return { socket: client, response: upgraded }; } },
    EdgeRuntime: { waitUntil(p) { background.push(Promise.resolve(p)); } },
    WebSocket: class extends Socket { constructor(url) {
      super(); assert.equal(new URL(url).hostname, 'generativelanguage.googleapis.com');
      this.readyState = 0; upstreams.push(this);
    } },
    fetch: network, setTimeout: timer.setTimeout, clearTimeout: timer.clearTimeout,
    console: { log: (...args) => logs.push(args), warn: (...args) => logs.push(args), error: (...args) => logs.push(args) },
  };
  const overrides = options.old ? Object.fromEntries(deployed.files.map(f => [f.name, f.content])) : {};
  const load = loadSources(overrides, globals);
  load('supabase/functions/uskoci-speech-session/index.ts');
  assert.equal(typeof handler, 'function');
  const req = new Request(env.SUPABASE_URL + `/functions/v1/uskoci-speech-session?conversationId=${CONVERSATION}&operationId=${OPERATION}`,
    { headers: { upgrade: 'websocket', Authorization: 'Bearer synthetic-ordinary-user' } });
  const responsePromise = handler(req);
  if (options.hangReserve) { await turn(); timer.fire(5000); }
  const response = await responsePromise;
  const upstream = upstreams[0];
  const calls = suffix => requests.filter(r => r.path.endsWith('/' + suffix));
  const accounting = () => requests.filter(r => /rpc_ai_test_(release_unused_reservation|settle_audio)_service$/.test(r.path));
  const ready = async (binary = false) => {
    assert.ok(upstream); upstream.open();
    const setup = { setupComplete: {} };
    upstream.receive(binary ? new TextEncoder().encode(JSON.stringify(setup)).buffer : setup);
    await turn(); assert.equal(client.sent.filter(x => x.kind === 'ready').length, 1);
  };
  const audio = (sequence = 0) => client.receive({ kind: 'audio', sequence, pcmBase64: PCM });
  const release = () => client.receive({ kind: 'release' });
  const cancel = () => client.receive({ kind: 'cancel' });
  const drain = async () => { await turn(); return Promise.all(background); };
  const finish = async () => { client.close(); upstream?.close(); await drain(); assert.equal(logs.length, 0); };
  return { client, upstream, requests, background, response, upgraded, upgrades, timer, calls, accounting,
    ready, audio, release, cancel, drain, finish, logs, load };
}

test('speech v29 preimage is exact and the fourth shared protocol dependency is unchanged', () => {
  assert.equal(deployed.version, 29); assert.equal(deployed.files.length, 3); assert.equal(deployed.full_package_manifest.length, 4);
  const sorted = deployed.full_package_manifest.map(item => Object.fromEntries(Object.entries(item).sort(([a], [b]) => a.localeCompare(b))));
  assert.equal(createHash('sha256').update(JSON.stringify(sorted)).digest('hex'), deployed.full_package_manifest_sha256);
  for (const file of deployed.files) {
    assert.equal(Buffer.byteLength(file.content), file.bytes);
    assert.equal(createHash('sha256').update(file.content).digest('hex'), file.sha256);
  }
  for (const file of deployed.unchanged_dependencies) assert.equal(createHash('sha256').update(fs.readFileSync(path.join(ROOT, file.name))).digest('hex'), file.sha256);
});

test('actual deployed v29 reproduces refund after audio was dispatched but no transcript arrived', async () => {
  const h = await harness({ old: true });
  try {
    await h.ready(); h.audio(); h.upstream.close(); await h.drain();
    assert.equal(h.upstream.sent.filter(x => x.realtimeInput?.audio).length, 1);
    assert.equal(h.calls('rpc_ai_test_release_unused_reservation_service').length, 1);
    assert.equal(h.calls('rpc_ai_test_settle_audio_service').length, 0);
  } finally { await h.finish(); }
});

test('current actual handler retains unknown cost after dispatched audio loses its transcript', async () => {
  const h = await harness();
  try {
    assert.equal(h.response, h.upgraded); await h.ready(); h.audio(); h.upstream.close(); await h.drain();
    assert.equal(h.upstream.sent.filter(x => x.realtimeInput?.audio).length, 1);
    assert.equal(h.accounting().length, 0);
    assert.equal(h.client.sent.filter(x => x.kind === 'final').length, 0);
    assert.ok(h.client.sent.some(x => x.kind === 'error' && x.code === 'SPEECH_INCOMPLETE'));
  } finally { await h.finish(); }
});

test('deployed v29 prematurely settles a partial transcript; current source keeps the hold', async () => {
  for (const old of [true, false]) {
    const h = await harness({ old });
    try {
      await h.ready(); h.audio(); h.upstream.receive({ serverContent: { inputTranscription: { text: 'Deo rečenice' } } });
      h.upstream.close(); await h.drain();
      assert.equal(h.calls('rpc_ai_test_settle_audio_service').length, old ? 1 : 0);
      assert.equal(h.calls('rpc_ai_test_release_unused_reservation_service').length, 0);
    } finally { await h.finish(); }
  }
});

test('zero dispatched audio and no output releases exactly once on cancellation', async () => {
  const h = await harness();
  try {
    await h.ready(); h.cancel(); h.cancel(); h.upstream.close(); await h.drain();
    assert.equal(h.calls('rpc_ai_test_release_unused_reservation_service').length, 1);
    assert.equal(h.calls('rpc_ai_test_settle_audio_service').length, 0);
  } finally { await h.finish(); }
});

test('partial provider output and an empty replacement do not erase evidence or permit a refund', async () => {
  const h = await harness();
  try {
    await h.ready();
    h.upstream.receive({ serverContent: { interimInputTranscription: { text: 'Početa rečenica' } } });
    h.upstream.receive({ serverContent: { interimInputTranscription: { text: '' } } });
    h.cancel(); await h.drain();
    assert.equal(h.accounting().length, 0);
    assert.equal(h.upstream.sent.filter(x => x.realtimeInput?.audio).length, 0);
  } finally { await h.finish(); }
});

test('an audio send that throws is an uncertain attempt and never turns into a refund', async () => {
  const h = await harness();
  try {
    await h.ready(); h.upstream.throwAudio = true; h.audio(); await h.drain();
    assert.equal(h.accounting().length, 0);
    assert.equal(h.client.readyState, 3);
    assert.ok(h.client.sent.some(x => x.code === 'SPEECH_UNAVAILABLE'));
  } finally { await h.finish(); }
});

test('release plus final provider completion settles once using actual audio and transcript counters', async () => {
  const h = await harness();
  try {
    await h.ready(true); h.audio(); h.audio(1); h.release();
    const text = 'Требају ми два човека 🙂';
    h.upstream.receive(new TextEncoder().encode(JSON.stringify({ serverContent: { inputTranscription: { text } } })).buffer);
    h.upstream.receive({ serverContent: { generationComplete: true } });
    await turn(); await h.drain();
    const settled = h.calls('rpc_ai_test_settle_audio_service');
    assert.equal(settled.length, 1);
    assert.deepEqual(settled[0].args, { p_operation_id: OPERATION, p_audio_bytes: 6400, p_transcript_chars: text.length });
    assert.equal(h.calls('rpc_ai_test_release_unused_reservation_service').length, 0);
    assert.deepEqual(h.client.sent.filter(x => x.kind === 'final').map(x => x.text), [text]);
  } finally { await h.finish(); }
});

test('provider turnComplete while the microphone gesture is held cannot publish a final transcript', async () => {
  const h = await harness();
  try {
    await h.ready(); h.audio(); h.upstream.receive({ serverContent: { inputTranscription: { text: 'Nije još gotovo' }, turnComplete: true } });
    await h.drain(); assert.equal(h.accounting().length, 0);
    assert.equal(h.client.sent.filter(x => x.kind === 'final').length, 0);
    assert.ok(h.client.sent.some(x => x.code === 'SPEECH_INCOMPLETE'));
  } finally { await h.finish(); }
});

test('finalization timeout and local cancellation after audio keep unknown cost and never retry', async () => {
  for (const mode of ['timeout', 'cancel']) {
    const h = await harness();
    try {
      await h.ready(); h.audio();
      if (mode === 'timeout') { h.release(); h.timer.fire(15000); } else h.cancel();
      await h.drain(); assert.equal(h.accounting().length, 0);
      assert.equal(h.calls('rpc_ai_test_budget_reserve_service').length, 1);
      assert.equal(h.upgrades, 1);
    } finally { await h.finish(); }
  }
});

test('malformed audio rejected before dispatch releases unused reservation, without provider audio', async () => {
  const h = await harness();
  try {
    await h.ready(); h.client.receive({ kind: 'audio', sequence: 0, pcmBase64: 'broken' }); await h.drain();
    assert.equal(h.calls('rpc_ai_test_release_unused_reservation_service').length, 1);
    assert.equal(h.upstream.sent.filter(x => x.realtimeInput?.audio).length, 0);
  } finally { await h.finish(); }
});

test('ordinary ownership and editable Worker context are checked before any paid admission', async () => {
  for (const options of [{ foreignConversation: true }, { conversationStatus: 'CLOSED' }, { purpose: 'PROFILE', staleWorker: true }]) {
    const h = await harness(options);
    assert.ok([404, 409].includes(h.response.status)); assert.equal(h.upgrades, 0);
    assert.equal(h.calls('rpc_ai_test_budget_reserve_service').length, 0); assert.equal(h.accounting().length, 0);
  }
});

test('denied or replayed reservation does not open a second provider socket', async () => {
  for (const budget of [
    { admitted: false, reservationId: null, replay: false, code: 'AI_TEST_ACCOUNT_NOT_ADMITTED' },
    { admitted: false, reservationId: RESERVATION, replay: true, code: 'AI_TEST_OPERATION_REPLAY' },
  ]) {
    const h = await harness({ budget });
    assert.equal(h.response.status, 409); assert.equal(h.upgrades, 0);
    assert.equal(h.calls('rpc_ai_test_budget_reserve_service').length, 1); assert.equal(h.accounting().length, 0);
  }
});

test('a reservation transport ignoring abort is bounded and never dispatches speech', async () => {
  const h = await harness({ hangReserve: true });
  assert.equal(h.response.status, 503); assert.equal(h.upgrades, 0);
  assert.equal(h.calls('rpc_ai_test_budget_reserve_service').length, 1); assert.equal(h.accounting().length, 0);
});

test('an accounting transport ignoring abort remains unconfirmed and has no retry', async () => {
  const h = await harness({ hangAccounting: true });
  try {
    await h.ready(); h.cancel(); await turn(); h.timer.fire(5000);
    const results = await h.drain(); assert.ok(results.includes(false));
    assert.equal(h.calls('rpc_ai_test_release_unused_reservation_service').length, 1);
  } finally { await h.finish(); }
});

test('wrong accounting operation identity cannot confirm release or settlement', async () => {
  for (const complete of [false, true]) {
    const h = await harness({ wrongAccountingIdentity: true });
    try {
      await h.ready();
      if (complete) {
        h.audio(); h.release(); h.upstream.receive({ serverContent: { inputTranscription: { text: 'Gotovo.' }, generationComplete: true } });
      } else h.cancel();
      const results = await h.drain(); assert.ok(results.includes(false));
      assert.equal(h.accounting().length, 1);
    } finally { await h.finish(); }
  }
});
