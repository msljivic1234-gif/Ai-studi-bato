'use strict';
// Actual client transport, Worker route + owned editor, Need submit callback,
// native speech adapter and controller. Network/native boundaries are fixtures;
// no provider call, hosted DEV write or installed-Android claim is made here.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path');
const { execFileSync } = require('node:child_process');
const ts = require('typescript');
const React = require('react');
const { act, create } = require('react-test-renderer');
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const ROOT = path.resolve(__dirname, '..');
const PREIMAGE = process.env.USKOCI_BUDGET_UI_PREIMAGE;
const PATCHED_FILES = new Set(['src/app/(app)/profil/razgovor.tsx', 'src/features/voice/nativeSpeechAdapter.ts']);
const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const ACCOUNT = id(1), CONVERSATION = id(2), REQUEST = id(3), TURN = id(4);
const COPY = 'AI trenutno nije dostupan.';
const ok = podatak => ({ ok: true, podatak });
const compiled = new Map();
function sourceLoader(overrides, globals = {}) {
  const cache = new Map();
  function load(name) {
    if (Object.hasOwn(overrides, name)) return overrides[name];
    const full = ['', '.ts', '.tsx', '.mjs', '/index.ts'].map(ext => path.resolve(ROOT, name + ext))
      .find(file => fs.existsSync(file) && fs.statSync(file).isFile());
    assert.ok(full, 'Actual source must exist: ' + name);
    name = path.relative(ROOT, full).replaceAll(path.sep, '/');
    if (Object.hasOwn(overrides, name)) return overrides[name];
    if (cache.has(name)) return cache.get(name).exports;
    const source = PREIMAGE && PATCHED_FILES.has(name)
      ? execFileSync('git', ['show', `${PREIMAGE}:${name}`], { cwd: ROOT, encoding: 'utf8' }) : fs.readFileSync(full, 'utf8');
    const key = name + '\0' + source;
    if (!compiled.has(key)) compiled.set(key, ts.transpileModule(source, {
      fileName: full.endsWith('.mjs') ? full + '.ts' : full,
      compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
    }).outputText);
    const mod = { exports: {} }; cache.set(name, mod);
    new Function('require', 'module', 'exports', ...Object.keys(globals), compiled.get(key))(
      request => request.startsWith('.') ? load(path.relative(ROOT, path.resolve(path.dirname(full), request)).replaceAll(path.sep, '/'))
        : Object.hasOwn(overrides, request) ? overrides[request] : require(request), mod, mod.exports, ...Object.values(globals));
    return mod.exports;
  }
  return load;
}

function transportHarness() {
  const session = { user: { id: ACCOUNT }, accountRevision: 1, session: { access_token: 'fixture-user-token' } };
  const requests = [], sdkWrites = [];
  const load = sourceLoader({
    'expo/fetch': { fetch: async (url, init) => {
      requests.push({ url, init });
      return new Response(JSON.stringify({ code: 'AI_TEST_BUDGET_EXHAUSTED', internal: 'not-for-the-user' }), {
        status: 503, headers: { 'content-type': 'application/json' },
      });
    } },
    'src/store/sesija.ts': { sesijaSada: () => session },
    'src/data/publicSupabaseConfig.ts': { readPublicSupabaseConfig: () => ({ url: 'https://fixture.supabase.co', anonKey: 'public-fixture' }) },
    'src/data/supabaseClient.ts': { supabaseKlijent: () => ({ rpc: () => { throw Error('UNEXPECTED_RPC'); },
      functions: { invoke: (...args) => { sdkWrites.push(args); throw Error('NO_SDK_WRITE_ALLOWED'); } } }) },
  });
  const need = load('src/data/aiNeedV2Production.ts').aiNeedV2Production;
  const worker = load('src/data/workerAiClientService.ts').workerAiClientService;
  return { session, load, need, worker, requests, sdkWrites };
}
for (const domain of ['Need', 'Worker']) test(`${domain}: actual budget 503 becomes bounded formal copy with exactly one request`, async () => {
  const h = transportHarness(), text = [], hints = [];
  const stream = { onText: value => text.push(value), onConversationIntent: value => hints.push(value) };
  const result = domain === 'Need' ? await h.need.sendMessage(CONVERSATION, 'Treba mi pomoć.', REQUEST, stream)
    : await h.worker.send(CONVERSATION, 'Mogu da pomognem.', REQUEST, stream);
  assert.deepEqual(result, { ok: false, kod: 'AI_SERVICE_UNAVAILABLE', poruka: COPY });
  assert.equal(h.requests.length, 1); assert.deepEqual(h.sdkWrites, []);
  assert.deepEqual(text, []); assert.deepEqual(hints, []);
  assert.doesNotMatch(JSON.stringify(result), /AI_TEST_BUDGET|not-for-the-user|sačuvan|objavljen/i);
});

function actualNeedSubmit(scope) {
  const file = path.join(ROOT, 'src/app/(app)/nova.tsx'), source = fs.readFileSync(file, 'utf8');
  const parsed = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX), matches = [];
  function visit(node) {
    if (ts.isVariableDeclaration(node) && node.name.getText(parsed) === 'submitTurn') matches.push(node.initializer.getText(parsed));
    ts.forEachChild(node, visit);
  }
  visit(parsed); assert.equal(matches.length, 1);
  const js = ts.transpileModule('module.exports = (' + matches[0] + ');', {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  }).outputText;
  const mod = { exports: {} };
  new Function('module', ...Object.keys(scope), js)(mod, ...Object.values(scope));
  return mod.exports;
}
for (const state of ['FAILED', 'SUCCEEDED', 'PROCESSING']) test(`Need: budget refusal reconciles only by read (${state}) without a new AI or publication`, async () => {
  const h = transportHarness(), calls = [], draft = { value: 'Treba mi pomoć.', revision: 2 };
  const previous = { conversationId: CONVERSATION, messages: [{ id: id(20), body: 'Prethodni odgovor.', fromAi: true }] };
  const checked = ok({ conversation: previous, turn: { state } });
  let returned;
  const submit = actualNeedSubmit({
    canAct: () => true, canSubmit: true, setRoleSuggestion() {}, request: { current: null },
    roleOfferPrompted: { current: null }, isExplicitWorkerOffer: () => false,
    locationFlight: { current: null }, sendFlight: { current: null },
    editor: { save: async command => { returned = await command(); } }, conversation: { current: CONVERSATION },
    aiNeedV2Izvor: h.need, noviUuidZahtevId: () => REQUEST, accountId: ACCOUNT,
    aiTurnIntentJournal: { save: async value => calls.push(['journal', value]) }, isCurrent: () => true,
    streamAbort: { current: null }, restartOwner: { current: {} }, setStreamingText() {}, turnRoles: { current: {} },
    unconfirmedSend: { current: null }, SEND_UNCONFIRMED_CODE: 'AI_SEND_UNCONFIRMED',
    read: async () => { calls.push(['read']); return checked; },
  });
  await submit(draft.value, draft);
  assert.equal(h.requests.length, 1); assert.deepEqual(h.sdkWrites, []);
  assert.equal(calls.filter(call => call[0] === 'read').length, 1);
  assert.deepEqual(draft, { value: 'Treba mi pomoć.', revision: 2 });
  assert.equal(previous.messages[0].body, 'Prethodni odgovor.');
  assert.deepEqual(returned, state === 'FAILED' ? { ok: false, kod: 'AI_SERVICE_UNAVAILABLE', poruka: COPY } : checked);
});

function workerHarness(outcome = 'FAILED') {
  const transport = transportHarness(), calls = [], listeners = new Set();
  const session = transport.session, Focus = React.createContext(true);
  const useFocusEffect = callback => { const focused = React.useContext(Focus);
    React.useEffect(() => focused ? callback() : undefined, [focused, callback]); };
  const app = { currentState: 'active', addEventListener: (_type, fn) => { listeners.add(fn); return { remove: () => listeners.delete(fn) }; } };
  const profile = { displayName: 'Milan', bio: '', skills: [], tools: [], vehicles: [], licenses: [], teamCapacity: 1,
    workAreas: [], location: { city: '', operatingCountryCode: null, radiusKm: 1, approximatePosition: null },
    availability: { timezone: 'Europe/Belgrade', availableNow: false, rules: [], windows: [] } };
  const oldMessages = [{ id: id(10), role: 'USER', body: 'Moja prethodna poruka.', sequence: 1 },
    { id: id(11), role: 'ASSISTANT', body: 'Prethodni odgovor.', sequence: 2 }];
  let snapshot = { schemaVersion: 'WORKER_PROFILE_V1', accountId: ACCOUNT, conversationId: CONVERSATION, profileId: id(6),
    revision: 1, status: 'OPEN', stale: false, safety: 'ALLOW', profileStatus: 'DRAFT', candidate: profile,
    review: null, saved: null, messages: oldMessages, turn: null };
  let journalValue = null;
  const decoders = transport.load('src/data/workerAiClientService.ts');
  const api = {
    read: async () => { calls.push('read'); const decoded = decoders.decodeWorkerAiSnapshot(snapshot, ACCOUNT, CONVERSATION);
      assert.ok(decoded, 'read fixture must pass the actual receipt decoder'); return ok(decoded); },
    open: async () => { throw Error('UNEXPECTED_OPEN'); },
    send: async (...args) => {
      calls.push('send');
      const result = await transport.worker.send(...args);
      const actualState = outcome === 'OLD_SUCCESS' ? 'SUCCEEDED' : outcome;
      snapshot = { ...snapshot, turn: outcome === 'NOT_RECEIVED' ? null : { turnId: TURN, conversationId: CONVERSATION,
        clientRequestId: outcome === 'OLD_SUCCESS' ? id(99) : REQUEST, attemptId: id(5), state: actualState,
        retryAllowed: false, authoritative: true },
        messages: outcome === 'SUCCEEDED' ? [...oldMessages,
          { id: id(12), role: 'USER', body: args[1], sequence: 3 },
          { id: id(13), role: 'ASSISTANT', body: 'Autoritativno potvrđen odgovor.', sequence: 4 }] : oldMessages };
      return result;
    },
    recoverTurn: async (conversationId, clientRequestId) => {
      calls.push('recover'); assert.equal(conversationId, CONVERSATION); assert.equal(clientRequestId, REQUEST);
      const decoded = decoders.decodeWorkerAiTurnRecovery({ schemaVersion: 'WORKER_PROFILE_V1', accountId: ACCOUNT, conversationId, profileId: id(6), clientRequestId,
        conversationStatus: 'OPEN', turn: outcome === 'OLD_SUCCESS' ? null : snapshot.turn,
        retryAllowed: outcome === 'NOT_RECEIVED' || outcome === 'OLD_SUCCESS',
        canCancel: outcome === 'NOT_RECEIVED' || outcome === 'OLD_SUCCESS', cancelled: false, authoritative: true,
        providerDispatched: ['SUCCEEDED', 'PROCESSING', 'UNKNOWN_OUTCOME'].includes(outcome) }, ACCOUNT, CONVERSATION, REQUEST);
      assert.ok(decoded, 'recovery fixture must pass the actual owned receipt decoder'); return ok(decoded);
    },
    prepare: async () => { throw Error('UNEXPECTED_PREPARE'); }, patch: async () => { throw Error('UNEXPECTED_PATCH'); },
    save: async () => { throw Error('NO_SAVE_ALLOWED'); },
  };
  const host = name => props => React.createElement(name, props, props.children, props.header, props.footer,
    props.footerAction, props.actions, props.status);
  const confirm = { close() {}, ask() {}, sheet: null };
  const overrides = {
    react: React, 'react/jsx-runtime': require('react/jsx-runtime'),
    'react-native': { AppState: app },
    'expo-router': { useFocusEffect, useLocalSearchParams: () => ({ conversationId: CONVERSATION }),
      router: { setParams() {}, replace() {}, push() {}, back() {}, canGoBack: () => true } },
    'src/store/sesija.ts': { useSesija: () => session, sesijaSada: () => session },
    'src/data/supabaseClient.ts': { supabaseKlijent: () => { throw Error('UNEXPECTED_SUPABASE_CALL'); } },
    'src/data/reviewFactProblem.ts': {}, 'src/lib/location.ts': {}, 'src/ui/v2/draftSummary.ts': {},
    'src/data/workerAiClientService.ts': { workerAiClientService: api, WORKER_AI_READ_TRANSPORT_UNAVAILABLE: 'WORKER_AI_READ_TRANSPORT_UNAVAILABLE' },
    'src/data/workerAiTurnIntentJournal.ts': { workerAiTurnIntentJournal: {
      load: async () => journalValue, save: async value => { journalValue = value; }, clear: async () => { calls.push('journalClear'); journalValue = null; },
    } },
    'src/data/aiRoleHandoff.ts': { takeWorkerText: () => null, stageAiRoleText: () => { throw Error('NO_HANDOFF_ALLOWED'); } },
    'src/data/aiCorrectionIntent.ts': { takeAiCorrection: () => null },
    'src/data/workerExecutionModeClientService.ts': { inferWorkerExecutionModes: () => [], workerExecutionModeClientService: {} },
    'src/lib/idempotencija.ts': { noviUuidZahtevId: () => REQUEST },
    'src/features/voice/useHoldToTalk.ts': { useHoldToTalk: () => ({ state: { phase: 'IDLE' },
      controller: { getSnapshot: () => ({ phase: 'IDLE' }), cancel() {} } }) },
    'src/ui/profile/useAccountName.ts': { useAccountName: () => ({ state: 'ready', name: 'Milan' }) },
    'src/ui/system/ConfirmSheet.tsx': { useConfirmSheet: () => confirm },
    'src/ui/system/tokens.ts': { sys: { color: {} }, brandAction: {} },
  };
  for (const [name, exports] of Object.entries({
    'src/ui/aiFirst/AiConversationShell.tsx': ['AiConversationShell'],
    'src/ui/system/ActionSheet.tsx': ['ActionSheet'], 'src/ui/Text.tsx': ['T'], 'src/ui/v2/V2Action.tsx': ['V2Action'],
    'src/ui/workerProfile/WorkerProfilePresentation.tsx': ['WorkerProfileFrame', 'WorkerProfileStatus'],
    'src/ui/workerProfile/WorkerAiPresentation.tsx': ['WorkerAiActivation', 'WorkerAiNotificationsNote', 'WorkerAiReviewDetails'],
  })) overrides[name] = Object.fromEntries(exports.map(name => [name, host(name)]));
  const load = sourceLoader(overrides), Route = load('src/app/(app)/profil/razgovor.tsx').default;
  let tree;
  return {
    calls, transport,
    async mount() { await act(async () => { tree = create(React.createElement(Focus.Provider, { value: true }, React.createElement(Route))); }); },
    shell() { return tree.root.findByType('AiConversationShell'); },
    copy() { return tree.root.findAllByType('T').flatMap(node => [node.props.children].flat(Infinity)).filter(value => typeof value === 'string'); },
    async type(value) { await act(async () => this.shell().props.onChange(value)); },
    async send() { await act(async () => this.shell().props.onSend()); },
    async check() { const button = tree.root.findAll(node => node.type === 'V2Action' && node.props.label === 'Proverite razgovor');
      assert.equal(button.length, 1); await act(async () => button[0].props.onPress()); },
    async close() { if (tree) await act(async () => tree.unmount()); assert.equal(listeners.size, 0); },
  };
}
for (const outcome of ['FAILED', 'NOT_RECEIVED', 'OLD_SUCCESS', 'UNKNOWN_OUTCOME']) test(`Worker: budget refusal stays visible after a successful read (${outcome}) and Check never resends`, async () => {
  const h = workerHarness(outcome);
  try {
    await h.mount(); await h.type('Dostupan sam svakog dana.'); await h.send();
    assert.ok(h.copy().includes(COPY), 'successful canonical read must not hide the failed AI attempt: ' + JSON.stringify({ copy: h.copy(), calls: h.calls }));
    assert.equal(h.shell().props.value, 'Dostupan sam svakog dana.');
    assert.equal(h.shell().props.messages.at(-1).body, 'Prethodni odgovor.');
    assert.equal(h.transport.requests.length, 1); assert.equal(h.calls.filter(name => name === 'send').length, 1);
    assert.ok(h.copy().every(copy => !/Profil je sačuvan|Profil je aktivan/.test(copy)));
    const reads = h.calls.filter(name => name === 'read').length;
    await h.check();
    assert.ok(h.calls.filter(name => name === 'read').length > reads);
    assert.equal(h.transport.requests.length, 1, 'Check performs no AI dispatch');
    assert.equal(h.shell().props.value, 'Dostupan sam svakog dana.');
    assert.deepEqual(h.transport.sdkWrites, []);
  } finally { await h.close(); }
});
for (const outcome of ['SUCCEEDED', 'PROCESSING']) test(`Worker: exact canonical ${outcome} still supersedes a lost transport response`, async () => {
  const h = workerHarness(outcome);
  try {
    await h.mount(); await h.type('Dostupan sam svakog dana.'); await h.send();
    assert.equal(h.copy().includes(COPY), false);
    assert.equal(h.transport.requests.length, 1);
    assert.equal(h.shell().props.value, outcome === 'SUCCEEDED' ? '' : 'Dostupan sam svakog dana.');
    assert.equal(h.shell().props.pending, outcome === 'PROCESSING');
    assert.deepEqual(h.transport.sdkWrites, []);
  } finally { await h.close(); }
});

function speechHarness() {
  const sockets = [], subscriptions = new Set(), calls = [], delivered = [];
  class Socket {
    constructor() { this.readyState = 0; this.bufferedAmount = 0; this.sent = []; sockets.push(this); }
    send(body) { this.sent.push(JSON.parse(body)); }
    close() { this.readyState = 3; }
    message(kind, value = {}) { this.readyState = 1;
      this.onmessage?.({ data: JSON.stringify({ protocol: 'USKOCI_SPEECH_V1', conversationId: CONVERSATION,
        operationId: REQUEST, sequence: kind === 'ready' ? 0 : 1, kind, ...value }) }); }
  }
  let releaseCount = 0;
  const native = { start: async () => { calls.push('start'); }, stop: () => { calls.push('stop'); },
    addListener: (name, fn) => { const subscription = { name, fn }; subscriptions.add(subscription);
      return { remove: () => subscriptions.delete(subscription) }; } };
  const lease = () => { releaseCount += 1; }; lease.isCurrent = () => releaseCount === 0;
  const load = sourceLoader({
    'react-native': { Platform: { OS: 'android', isTV: false },
      PermissionsAndroid: { PERMISSIONS: { RECORD_AUDIO: 'RECORD_AUDIO' }, check: async () => true } },
    expo: { requireOptionalNativeModule: name => { assert.equal(name, 'UskociVoice'); return native; } },
    'src/features/voiceMessages/audioArbiter.ts': { sharedAudioArbiter: {} },
    'src/ui/permissions/permissionAsk.ts': { permissionAsk: {} },
  }, { WebSocket: Socket, process: { env: {} } });
  const adapter = load('src/features/voice/nativeSpeechAdapter.ts').createNativeSpeechAdapter({
    getConnection: async () => ({ url: 'https://fixture.supabase.co', accessToken: 'fixture-token', anonKey: 'fixture-public' }),
    newOperationId: () => REQUEST, arbiter: { claim: async () => lease },
  });
  const { HoldToTalkController, voiceErrorCopy } = load('src/features/voice/holdToTalk.ts');
  const controller = new HoldToTalkController({ adapter,
    getScope: () => ({ accountId: ACCOUNT, accountRevision: 1, conversationId: CONVERSATION }),
    onTranscript: value => { delivered.push(value); return true; },
    limits: { permissionMs: 5000, captureMs: 5000, finalizationMs: 5000 },
  });
  const flush = async () => { for (let n = 0; n < 12; n++) await Promise.resolve(); };
  return { controller, calls, sockets, delivered, voiceErrorCopy, flush,
    async begin() { assert.equal(controller.begin('fixture-gesture'), true); await flush(); assert.equal(sockets.length, 1); },
    close() { controller.dispose(); assert.equal(subscriptions.size, 0); assert.equal(releaseCount, 1); },
  };
}
for (const event of ['onerror', 'onclose']) test(`speech: pre-ready ${event} shows unavailable service without microphone, transcript or automatic reconnect`, async () => {
  const h = speechHarness();
  try {
    await h.begin(); h.sockets[0][event]({}); await h.flush();
    const state = h.controller.getSnapshot();
    assert.equal(state.phase, 'IDLE'); assert.equal(state.error, 'SPEECH_UNAVAILABLE');
    assert.match(h.voiceErrorCopy(state.error), /Pokušajte kasnije/);
    assert.equal(h.calls.includes('start'), false); assert.deepEqual(h.delivered, []);
    assert.equal(h.sockets.length, 1); assert.deepEqual(h.sockets[0].sent, []);
  } finally { h.close(); }
});
for (const event of ['onerror', 'onclose']) test(`speech: post-ready ${event} remains a connection loss and preserves recognized text without sending`, async () => {
  const h = speechHarness();
  try {
    await h.begin(); h.sockets[0].message('ready'); await h.flush();
    assert.equal(h.controller.getSnapshot().phase, 'LISTENING'); assert.deepEqual(h.calls, ['start']);
    h.sockets[0].message('segment', { index: 0, final: true, text: 'Želim da sačuvam ovaj deo.' });
    h.sockets[0][event]({}); await h.flush();
    const state = h.controller.getSnapshot();
    assert.equal(state.phase, 'IDLE'); assert.equal(state.error, 'SPEECH_CONNECTION_FAILED');
    assert.equal(state.fallbackText, 'Želim da sačuvam ovaj deo.');
    assert.match(h.voiceErrorCopy(state.error, state.fallbackText), /Prepoznati deo možete da pregledate pre slanja/);
    assert.deepEqual(h.delivered, []); assert.equal(h.sockets.length, 1);
    assert.ok(h.sockets[0].sent.every(message => message.kind === 'cancel'));
  } finally { h.close(); }
});
