'use strict';
// Real React + actual route/owned-editor code. Native widgets, time, session and
// network boundaries are deterministic substitutes; this is not Android E2E.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path');
const { execFileSync } = require('node:child_process');
const ts = require('typescript');
const React = require('react');
const { act, create } = require('react-test-renderer');
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const ROOT = path.resolve(__dirname, '..');
const PREIMAGE = process.env.USKOCI_EXPIRY_PREIMAGE;
const BASE_FILES = new Set(['src/app/(app)/pregled-zadatka.tsx', 'src/app/(app)/profil/razgovor.tsx',
  'src/features/ai/intake/intakeReviewReadiness.ts']);
const ID = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const START = Date.parse('2026-11-04T12:00:00Z');
const EXPIRY = START + 10_000;
const iso = time => new Date(time).toISOString();
const ok = podatak => ({ ok: true, podatak });

function harness(kind = 'task', options = {}) {
  const clock = { now: START, sequence: 0, jobs: new Map(),
    set(fn, delay) { const id = ++this.sequence; this.jobs.set(id, { fn, due: this.now + delay, delay }); return id; },
    clear(id) { this.jobs.delete(id); },
    jump(ms, deliver = true) { this.now += ms; if (!deliver) return;
      for (let n = 0; n < 100; n++) { const next = [...this.jobs].find(([, job]) => job.due <= this.now);
        if (!next) return; this.jobs.delete(next[0]); next[1].fn(); }
      throw Error('UNBOUNDED_TIMER_LOOP'); },
  };
  class ClockDate extends Date { static now() { return clock.now; } }
  const listeners = new Set();
  const app = { currentState: 'active', addEventListener(type, fn) {
    assert.equal(type, 'change'); listeners.add(fn); return { remove: () => listeners.delete(fn) }; },
    emit(state) { this.currentState = state; for (const fn of [...listeners]) fn(state); } };
  const Focus = React.createContext(true);
  const useFocusEffect = fn => { const focused = React.useContext(Focus); React.useEffect(() => focused ? fn() : undefined, [focused, fn]); };
  const session = { user: { id: ID(1) }, accountRevision: 1 };
  const calls = [];
  const profile = { displayName: 'Milan', bio: 'Programiranje', skills: ['Programiranje'], tools: [], vehicles: [], licenses: [], teamCapacity: 1,
    workAreas: [], location: { city: '', operatingCountryCode: null, radiusKm: 0, approximatePosition: null },
    availability: { availableNow: false, rules: [], windows: [] } };
  let review = kind === 'worker' ? { accountId: ID(1), conversationId: ID(2), reviewId: ID(3), profileId: ID(4), revision: 1,
    activate: false, canAccept: true, missingRequired: [], classificationState: 'READY', reviewedServiceModes: [{ service: 'Programiranje', mode: 'REMOTE' }],
    expiresAt: iso(options.expired ? START - 1 : EXPIRY), profile } :
    { accountId: ID(1), conversationId: ID(2), reviewId: ID(3), draftId: null, canAccept: true, safety: 'ALLOW',
      classificationState: 'READY', missingRequired: [], publicProjection: [], ownerPrivateProjection: [],
      expiresAt: iso(options.expired ? START - 1 : EXPIRY), location: null, responseDeadline: null };
  let command = options.command ? { reviewId: ID(3), clientRequestId: ID(5), needId: ID(6), needRevision: 1,
    authoritative: true, state: options.command, evaluation: null } : null;
  let worker = { accountId: ID(1), conversationId: ID(2), profileId: ID(4), revision: 1, status: 'OPEN',
    stale: false, safety: 'ALLOW', candidate: profile, review, profileStatus: 'DRAFT', saved: null, messages: [], turn: null };
  let write;
  const record = (name, value) => { calls.push([name, value]); };
  const taskApi = {
    readLatest: async () => { record('readLatest'); return ok({ review, command }); },
    read: async () => { record('read'); return ok({ review, command }); },
    prepare: async () => { record('prepare'); if (calls.filter(c => c[0] === 'prepare').length > 1) review = { ...review, reviewId: ID(7), expiresAt: iso(clock.now + 60_000) }; return ok(review); },
    acceptAndPublish: async value => { record('acceptAndPublish', value); return options.pending ? new Promise(resolve => { write = resolve; }) : ok(command); },
    acceptAsDraft: async value => { record('acceptAsDraft', value); return ok(command); },
    resume: async value => { record('resume', value); return ok(command); },
  };
  const workerApi = {
    read: async () => { record('workerRead'); return ok(worker); }, open: async () => ok(worker),
    prepare: async (_cid, _rev, activate) => { record('workerPrepare', activate);
      review = { ...review, reviewId: ID(7), activate, expiresAt: iso(clock.now + 60_000) }; worker = { ...worker, review }; return ok(review); },
    save: async (value, key) => { record('workerSave', { value, key }); return new Promise(resolve => { write = resolve; }); },
    send: async () => { throw Error('NO_PROVIDER_CALL_ALLOWED'); },
  };
  const host = name => props => React.createElement(name, props, props.children, props.header, props.footer, props.footerAction, props.actions, props.status);
  const ui = names => Object.fromEntries(names.map(name => [name, host(name)]));
  const confirm = { close() {}, ask() {}, sheet: null };
  const voice = { state: { phase: 'IDLE' }, controller: { getSnapshot: () => ({ phase: 'IDLE' }), cancel() {} } };
  let focus = true, tree;
  const overrides = {
    'react': React, 'react/jsx-runtime': require('react/jsx-runtime'),
    'react-native': { AppState: app, Platform: { OS: 'android' }, BackHandler: { addEventListener: () => ({ remove() {} }) },
      StyleSheet: { create: x => x, flatten: x => Array.isArray(x) ? Object.assign({}, ...x.filter(Boolean)) : (x || {}) },
      View: 'View', ScrollView: 'ScrollView', KeyboardAvoidingView: 'KeyboardAvoidingView',
      Easing: { bezier: () => ({}), out: () => ({}), inOut: () => ({}), ease: () => ({}), linear: () => ({}) },
      Animated: { timing: () => ({ start: cb => cb?.() }), Value: class { constructor(v) { this._v = v; } setValue(v) { this._v = v; } interpolate() { return this; } } } },
    'react-native-safe-area-context': { SafeAreaView: 'SafeAreaView' },
    'expo-router': { useFocusEffect, useLocalSearchParams: () => ({ conversationId: ID(2) }),
      router: { setParams() {}, replace() {}, push() {}, back() {}, canGoBack: () => true } },
    'src/store/sesija.ts': { useSesija: () => session, sesijaSada: () => session },
    'src/data/supabaseClient.ts': { supabaseKlijent: {}, supabaseKonfigurisan: () => false },
    'src/data/aiTaskReviewClientService.ts': { aiTaskReviewClientService: taskApi },
    'src/data/workerAiClientService.ts': { workerAiClientService: workerApi },
    'src/data/workerAiTurnIntentJournal.ts': { workerAiTurnIntentJournal: { load: async () => null } },
    'src/data/serverReceipt.ts': { uuid: value => typeof value === 'string' && /^[a-f0-9-]{36}$/i.test(value) },
    'src/lib/idempotencija.ts': { noviUuidZahtevId: () => ID(8) },
    'src/data/index.ts': { aiNeedV2Izvor: {}, izvor: { potreba: async () => ({ id: ID(6), revizija: 1, stanje: 'OBJAVLJENA' }) } },
    'src/data/aiOpenIntakes.ts': { readIntakeLifecycle: async () => ({ status: 'OPEN', boundNeedId: null }) },
    'src/data/aiNeedV2Ui.ts': { factLabel: x => x }, 'src/data/needDetailPresentation.ts': { needRequirementRows: () => [] },
    'src/data/reviewFactProblem.ts': { REVIEW_FACT_COPY: {}, reviewDraftWriteProblem: () => null, reviewFactProblem: () => null },
    'src/data/publicationHandoff.ts': {}, 'src/data/intakeReviewReturn.ts': { readIntakeReviewReturn: () => null },
    'src/data/aiCorrectionIntent.ts': { takeAiCorrection: () => null },
    'src/data/workerExecutionModeClientService.ts': {},
    'src/data/productionLocationResolver.ts': { createProductionLocationResolver: () => ({ cancel() {} }) },
    'src/data/locationClientService.ts': {},
    'src/contracts/needFactsV2.ts': { NEED_FACT_V2_DEFINITIONS: {} },
    'src/lib/location.ts': {},
    'src/features/voice/useHoldToTalk.ts': { useHoldToTalk: () => voice },
    'src/ui/profile/useAccountName.ts': { useAccountName: () => ({ state: 'ready', name: 'Milan' }) },
    'src/ui/objava/useReviewPerson.tsx': { useReviewPerson: () => ({}) },
    'src/ui/objava/reviewAsTask.ts': { reviewAsTask: () => ({ id: ID(6), naslov: 'Programiranje', detalji: { rezimLokacije: 'REMOTE' } }) },
    'src/ui/objava/reviewFacts.ts': { reviewLocationReadiness: () => ({ ready: true, geography: { mode: 'REMOTE' } }),
      reviewTodos: () => [], partFact: () => undefined, REQUIREMENT_FACT: {}, privateReviewMap: () => ({ points: [], route: false }), ownerAddressFrame: () => null },
    'src/ui/v2/draftSummary.ts': {}, 'src/ui/media/AuthorizedPhoto.tsx': {},
    'src/ui/system/ConfirmSheet.tsx': { useConfirmSheet: () => confirm },
    'src/ui/system/motion.ts': { useReducedMotion: () => true },
    'src/ui/system/haptics.ts': { tick() {} },
    'src/ui/system/tokens.ts': { sys: { color: {}, space: {} }, brandAction: {} },
    'src/ui/system/layout.ts': { layout: {} },
    'src/ui/system/Poruka.tsx': { poruka: { show() {} } },
    'src/ui/system/outcomeCopy.ts': { OUTCOME_ACTION: { check: 'Proverite', refresh: 'Osvežite' }, UNCERTAIN_ABOUT: { publication: { title: 'Nepoznato' } }, cannotLoad: () => ({}) },
  };
  const widgets = {
    'src/ui/Text.tsx': ['T'], 'src/ui/v2/V2Action.tsx': ['V2Action'],
    'src/ui/support/SupportContextEntry.tsx': ['SupportContextEntry'], 'src/ui/needs/NeedLifecycleActions.tsx': ['NeedLifecycleActions'],
    'src/ui/system/DetailTopBar.tsx': ['DetailTopBar'], 'src/ui/system/StateView.tsx': ['StateView'],
    'src/ui/v2/QuietReadState.tsx': ['QuietReadState'], 'src/ui/system/FlowFooter.tsx': ['FlowFooter'],
    'src/ui/system/Surface.tsx': ['Surface'], 'src/ui/location/NeedLocationForm.tsx': ['NeedLocationForm'],
    'src/ui/objava/PublishedMoment.tsx': ['PublishedMoment'], 'src/ui/location/LocationMapPreview.tsx': ['LocationMapPreview'],
    'src/ui/objava/ReviewPresentation.tsx': ['PublishButton', 'ReviewFactRow', 'ReviewFrame', 'ReviewMoreFacts', 'ReviewStatus', 'ReviewTodoList', 'ReviewWaysOut'],
    'src/ui/objava/ReviewDetail.tsx': ['AddPhotos', 'OwnerAddress', 'ReviewDetail', 'ReviewGallery'],
    'src/ui/aiFirst/AiConversationShell.tsx': ['AiConversationShell'], 'src/ui/system/ActionSheet.tsx': ['ActionSheet'],
    'src/ui/workerProfile/WorkerProfilePresentation.tsx': ['WorkerProfileFrame', 'WorkerProfileStatus'],
    'src/ui/workerProfile/WorkerAiPresentation.tsx': ['WorkerAiActivation', 'WorkerAiNotificationsNote', 'WorkerAiReviewDetails'],
  };
  for (const [name, names] of Object.entries(widgets)) overrides[name] = ui(names);
  overrides['src/ui/objava/ReviewPresentation.tsx'].reviewStyles = {};
  overrides['@supabase/supabase-js'] = require('@supabase/supabase-js');
  overrides['react-native-gesture-handler'] = { GestureHandlerRootView: host('GestureHandlerRootView'), ScrollView: 'ScrollView' };
  overrides['expo-haptics'] = { impactAsync: async () => {}, selectionAsync: async () => {}, notificationAsync: async () => {} };
  overrides['expo/fetch'] = { fetch: globalThis.fetch };
  overrides['expo'] = {};
  overrides['expo-image'] = { Image: host('Image') };
  overrides['phosphor-react-native'] = new Proxy({}, { get: () => 'Glyph' });
  overrides['react-native-svg'] = new Proxy({}, { get: () => 'Svg' });
  overrides['@maplibre/maplibre-react-native'] = new Proxy({}, { get: () => host('MapLibre') });
  const reanimatedMock = {
    View: 'View',
    createAnimatedComponent: c => c,
    useSharedValue: v => ({ value: v }),
    useAnimatedStyle: () => ({}),
    withTiming: v => v,
    withSpring: v => v,
    Easing: { bezier: () => ({}), out: () => ({}), inOut: () => ({}), ease: () => ({}), linear: () => ({}) },
  };
  reanimatedMock.default = reanimatedMock;
  overrides['react-native-reanimated'] = reanimatedMock;
  overrides['@react-native-async-storage/async-storage'] = {
    getItem: async () => null,
    setItem: async () => {},
    removeItem: async () => {},
    clear: async () => {},
  };
  const cache = new Map();
  function load(name) {
    if (Object.hasOwn(overrides, name)) return overrides[name];
    const full = ['', '.ts', '.tsx', '.mjs', '/index.ts'].map(ext => path.resolve(ROOT, name + ext)).find(p => fs.existsSync(p) && fs.statSync(p).isFile());
    if (!full) throw Error('UNEXPECTED_IMPORT:' + name);
    if (/\.(webp|png|jpg|jpeg|svg|gif)$/i.test(full)) return 1;
    name = path.relative(ROOT, full).replace(/\\/g, '/');
    if (Object.hasOwn(overrides, name)) return overrides[name];
    if (cache.has(name)) return cache.get(name).exports;
    const source = PREIMAGE && BASE_FILES.has(name) ? execFileSync('git', ['show', `${PREIMAGE}:${name}`], { cwd: ROOT, encoding: 'utf8' }) : fs.readFileSync(full, 'utf8');
    const js = ts.transpileModule(source, { fileName: full.replace(/\.mjs$/, '.ts'), compilerOptions: { target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
    const mod = { exports: {} }; cache.set(name, mod);
    new Function('module', 'exports', 'require', 'Date', 'setTimeout', 'clearTimeout', js)(mod, mod.exports,
      id => load(id.startsWith('.') ? path.relative(ROOT, path.resolve(path.dirname(full), id)).replace(/\\/g, '/') : id), ClockDate,
      clock.set.bind(clock), clock.clear.bind(clock));
    return mod.exports;
  }
  const Route = kind === 'worker' ? load('src/app/(app)/profil/razgovor.tsx').default : kind === 'task' ? load('src/app/(app)/pregled-zadatka.tsx').default : null;
  let component = Route;
  return {
    clock, app, calls, session, load,
    get tree() { return tree; },
    async mount(probe) { component = probe ?? Route; await act(async () => { tree = create(React.createElement(Focus.Provider, { value: focus }, React.createElement(component))); }); },
    async advance(ms, deliver = true) { await act(async () => clock.jump(ms, deliver)); },
    async state(state) { await act(async () => app.emit(state)); },
    async focus(value) { focus = value; await act(async () => tree.update(React.createElement(Focus.Provider, { value }, React.createElement(component)))); },
    async press(node) { await act(async () => { const result = node.props.onPress(); if (!options.pending) await result; }); },
    buttons(label) { return tree.root.findAll(node => node.type === 'V2Action' && node.props.label === label); },
    button(label) { const found = this.buttons(label); assert.equal(found.length, 1, `one action: ${label}`); return found[0]; },
    publish() { return tree.root.findByType('PublishButton'); },
    count(name) { return calls.filter(call => call[0] === name).length; },
    async lostTaskWrite() { command = { reviewId: ID(3), clientRequestId: ID(8), needId: ID(6), needRevision: 1, authoritative: true, state: 'ACCEPTED', evaluation: null };
      await act(async () => write({ ok: false, kod: 'UNKNOWN', poruka: 'Proverite stanje' })); },
    async savedWorker() { worker = { ...worker, status: 'COMPLETED', saved: { reviewId: review.reviewId, profileStatus: 'DRAFT' } };
      await act(async () => write(ok(worker.saved))); },
    async close() { if (tree) await act(async () => tree.unmount()); assert.equal(clock.jobs.size, 0, 'no retained expiry timer'); assert.equal(listeners.size, 0, 'no retained AppState subscription'); },
  };
}

// Each scenario disposes even on failure, including intentionally red preimage runs.
async function scenario(kind, options, run) { const h = harness(kind, options); try { await h.mount(); await run(h); } finally { await h.close(); } }

test('task idle expiry replaces publication/draft with refresh, without network work', () => scenario('task', {}, async h => {
  assert.equal(h.publish().props.blocked, false); const count = h.calls.length;
  await h.advance(10_000);
  assert.equal(h.tree.root.findAllByType('PublishButton').length, 0);
  h.button('Osvežite pregled'); assert.equal(h.buttons('Sačuvajte nacrt').length, 0);
  assert.equal(h.calls.length, count); assert.equal(h.tree.root.findAllByType('ReviewDetail').length, 1);
}));
test('task queued publish and draft taps recheck the deadline before dispatch', () => scenario('task', {}, async h => {
  const publish = h.publish(), draft = h.button('Sačuvajte nacrt');
  await h.advance(10_000, false); await h.press(publish); await h.press(draft);
  assert.equal(h.count('acceptAndPublish'), 0); assert.equal(h.count('acceptAsDraft'), 0);
}));
test('explicit task refresh restores readiness but never auto-publishes', () => scenario('task', { expired: true }, async h => {
  await h.press(h.button('Osvežite pregled')); assert.equal(h.publish().props.blocked, false);
  assert.equal(h.count('prepare'), 2); assert.equal(h.count('acceptAndPublish'), 0);
}));
test('task background return updates expiry without timer delivery or fresh network read', () => scenario('task', {}, async h => {
  const count = h.calls.length; await h.state('background'); await h.advance(12_000, false); await h.state('active');
  h.button('Osvežite pregled'); assert.equal(h.calls.length, count);
}));
test('accepted task command remains resumable after the review expires', () => scenario('task', { expired: true, command: 'ACCEPTED' }, async h => {
  await h.press(h.button('Objavite ovaj nacrt')); assert.equal(h.count('resume'), 1); assert.equal(h.count('prepare'), 0);
}));
test('unknown task outcome takes precedence over expiry and reconciles the original command', () => scenario('task', { pending: true }, async h => {
  await h.press(h.publish()); await h.advance(12_000); await h.lostTaskWrite();
  assert.equal(h.buttons('Osvežite pregled').length, 0); await h.press(h.button('Proverite'));
  h.button('Objavite ovaj nacrt'); assert.equal(h.count('prepare'), 1); assert.equal(h.count('acceptAndPublish'), 1);
}));
test('task retained callbacks cannot dispatch for a background or replaced account', () => scenario('task', {}, async h => {
  const publish = h.publish(); await h.state('background'); await h.press(publish); assert.equal(h.count('acceptAndPublish'), 0);
  await h.state('active'); h.session.user = { id: ID(99) }; await h.press(publish); assert.equal(h.count('acceptAndPublish'), 0);
}));
test('worker opened review remains visible at expiry with save disabled', () => scenario('worker', {}, async h => {
  await h.press(h.button('Pregledajte radni profil')); await h.advance(10_001);
  assert.equal(h.tree.root.findAllByType('WorkerAiReviewDetails').length, 1);
  assert.equal(h.button('Sačuvajte profil').props.disabled, true); h.button('Učitajte novi pregled');
  assert.equal(h.count('workerPrepare'), 0); assert.equal(h.count('workerSave'), 0);
}));
test('worker expired queued Save is refused even before timer delivery', () => scenario('worker', {}, async h => {
  await h.press(h.button('Pregledajte radni profil')); const save = h.button('Sačuvajte profil');
  await h.advance(10_001, false); await h.press(save); assert.equal(h.count('workerSave'), 0);
}));
test('worker explicit renewal keeps draft choice and still requires confirmation', () => scenario('worker', {}, async h => {
  await h.press(h.button('Pregledajte radni profil')); await h.advance(10_001); await h.press(h.button('Učitajte novi pregled'));
  assert.equal(h.button('Sačuvajte profil').props.disabled, false); assert.equal(h.count('workerSave'), 0);
  assert.deepEqual(h.calls.filter(c => c[0] === 'workerPrepare').map(c => c[1]), [false]);
}));
test('worker save started before expiry can finish after it without a new request', () => scenario('worker', { pending: true }, async h => {
  await h.press(h.button('Pregledajte radni profil')); await h.press(h.button('Sačuvajte profil'));
  await h.advance(10_001); await h.savedWorker(); h.button('Otvorite sačuvani profil'); assert.equal(h.count('workerSave'), 1);
}));

if (!PREIMAGE) {
  test('expiry hook cleans up on blur and rechecks after a suspended deadline', async () => {
    const h = harness('hook'), { useReviewExpiry } = h.load('src/features/ai/intake/useReviewExpiry.ts'); let expired;
    function Probe() { expired = useReviewExpiry(iso(EXPIRY)); return null; }
    try { await h.mount(Probe); assert.equal(expired, false); await h.focus(false); assert.equal(h.clock.jobs.size, 0);
      await h.advance(20_000); await h.focus(true); assert.equal(expired, true); } finally { await h.close(); }
  });
  test('expiry hook bounds long timers and reschedules an early callback', async () => {
    const h = harness('hook'), { useReviewExpiry } = h.load('src/features/ai/intake/useReviewExpiry.ts'); let expired;
    const far = START + 2_147_483_647 + 1000;
    function Probe() { expired = useReviewExpiry(iso(far)); return null; }
    try { await h.mount(Probe); assert.equal([...h.clock.jobs.values()][0].delay, 2_147_483_647);
      await h.advance(2_147_483_647); assert.equal(expired, false); await h.advance(1000); assert.equal(expired, true);
    } finally { await h.close(); }
  });
  test('missing deadline creates no timers; invalid deadline fails closed', async () => {
    const h = harness('hook'), { useReviewExpiry, reviewExpired } = h.load('src/features/ai/intake/useReviewExpiry.ts'); let expired;
    function Probe() { expired = useReviewExpiry(null); return null; }
    try { await h.mount(Probe); assert.equal(expired, false); assert.equal(h.clock.jobs.size, 0);
      assert.equal(reviewExpired('invalid'), true); assert.equal(reviewExpired(iso(START)), true);
    } finally { await h.close(); }
  });
}
