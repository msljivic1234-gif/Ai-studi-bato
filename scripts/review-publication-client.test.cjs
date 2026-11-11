'use strict';
// Real presentation/screen React branches and real receipt services. Native
// widgets, session and transport are substituted; this is not pixel/native QA.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path');
const ts = require('typescript');
const React = require('react');
const { act, create } = require('react-test-renderer');
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const ROOT = path.resolve(__dirname, '..');
const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const ACCOUNT = id(1), AGREEMENT = id(2), TARGET = id(3), REQUEST = id(4), REVIEW = id(5);
const TAGS = ['AS_AGREED', 'CAREFUL', 'CLEAR_COMMUNICATION', 'ON_TIME', 'RELIABLE', 'RESPECTFUL'];
const command = () => ({ agreementId: AGREEMENT, targetAccountId: TARGET, rating: 5, tags: ['AS_AGREED'], clientRequestId: REQUEST });
const receipt = extra => ({ ...command(), reviewId: REVIEW, reviewerAccountId: ACCOUNT,
  createdAt: '2026-11-07T12:00:00Z', idempotentReplay: false, authoritative: true, ...extra });
const context = extra => ({ accountId: ACCOUNT, agreementId: AGREEMENT, targetAccountId: TARGET, eligible: true,
  review: null, authoritative: true, tagCatalog: { version: 'PRE_V3_REVIEW_TAGS_V1', maxTags: 3, tags: TAGS }, ...extra });

function loader(overrides) {
  const cache = new Map();
  function load(relative) {
    if (Object.hasOwn(overrides, relative)) return overrides[relative];
    const filename = ['', '.ts', '.tsx', '.js', '.mjs', '/index.ts'].map(ext => path.resolve(ROOT, relative + ext))
      .find(file => fs.existsSync(file) && fs.statSync(file).isFile());
    assert.ok(filename, 'Real module exists: ' + relative);
    relative = path.relative(ROOT, filename).replaceAll(path.sep, '/');
    if (Object.hasOwn(overrides, relative)) return overrides[relative];
    if (cache.has(relative)) return cache.get(relative).exports;
    const source = fs.readFileSync(filename, 'utf8');
    const compiled = ts.transpileModule(source, { fileName: filename.endsWith('.mjs') ? filename + '.ts' : filename,
      reportDiagnostics: true, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } });
    assert.deepEqual((compiled.diagnostics ?? []).filter(row => row.category === ts.DiagnosticCategory.Error), []);
    const module = { exports: {} }; cache.set(relative, module);
    const localRequire = name => name.startsWith('.') ? load(path.relative(ROOT, path.resolve(path.dirname(filename), name)).replaceAll(path.sep, '/'))
      : Object.hasOwn(overrides, name) ? overrides[name] : require(name);
    new Function('require', 'module', 'exports', compiled.outputText)(localRequire, module, module.exports);
    return module.exports;
  }
  return load;
}

function serviceHarness(reply, v2 = false) {
  const session = { user: { id: ACCOUNT }, accountRevision: 1 }, calls = [];
  const load = loader({
    'src/store/sesija.ts': { sesijaSada: () => session },
    'src/data/supabaseClient.ts': { supabaseKlijent: () => ({ rpc: async (name, args) => {
      calls.push({ name, args }); return reply(name, args);
    } }) },
    'src/data/reviewCommentGate.ts': { reviewCommentBuilt: () => v2 },
  });
  const api = v2 ? load('src/data/reviewCommentsClientService.ts').reviewCommentsClientService
    : load('src/data/reviewsClientService.ts').reviewsClientService;
  return { api, session, calls, load };
}

test('14-day refusal maps to the same known explanation in legacy and comment-enabled review writers', async () => {
  for (const v2 of [false, true]) {
    const h = serviceHarness(async () => ({ data: null, error: { code: 'P0001', message: 'REVIEW_WINDOW_CLOSED' } }), v2);
    const result = await h.api.submit(command());
    assert.equal(result.ok, false); assert.equal(result.kod, 'REVIEW_WINDOW_CLOSED');
    assert.equal(result.poruka, 'Istekao je rok od 14 dana za ocenjivanje ove saradnje.');
    assert.equal(h.calls.length, 1);
    assert.equal(h.calls[0].name, v2 ? 'rpc_submit_agreement_review_v2' : 'rpc_submit_agreement_review');
  }
});

test('own saved review stays readable while an expired empty context remains unavailable without invented publication fields', () => {
  const h = serviceHarness(async () => { throw new Error('NO_REQUEST_EXPECTED'); });
  const decode = h.load('src/data/reviewsClientService.ts').decodeReviewContext;
  const expired = decode(context({ eligible: false }), ACCOUNT, AGREEMENT);
  assert.ok(expired); assert.equal(expired.eligible, false); assert.equal(expired.review, null);
  const saved = decode(context({ eligible: false, review: receipt() }), ACCOUNT, AGREEMENT);
  assert.equal(saved.review.reviewId, REVIEW); assert.equal(saved.review.rating, 5);
  assert.equal(Object.hasOwn(saved.review, 'published'), false);
  assert.equal(decode(context({ eligible: true, review: receipt() }), ACCOUNT, AGREEMENT), null);
  assert.equal(decode(context({ accountId: TARGET }), ACCOUNT, AGREEMENT), null);
  assert.equal(h.calls.length, 0);
});

test('exact same-key review replay preserves the authoritative own receipt in both writers', async () => {
  for (const v2 of [false, true]) {
    const h = serviceHarness(async () => ({ data: receipt({ idempotentReplay: true, ...(v2 ? { comment: null } : {}) }), error: null }), v2);
    const result = await h.api.submit(command());
    assert.equal(result.ok, true, result.kod);
    assert.equal(result.podatak.idempotentReplay, true);
    assert.equal(result.podatak.clientRequestId, REQUEST);
    assert.equal(result.podatak.reviewerAccountId, ACCOUNT);
    assert.equal(h.calls.length, 1);
    assert.equal(h.calls[0].args.p_client_request_id, REQUEST);
  }
});

test('mismatched review identity, value or authority never becomes saved success', async () => {
  for (const patch of [{ clientRequestId: id(8) }, { targetAccountId: id(9) }, { reviewerAccountId: TARGET },
    { authoritative: false }, { rating: 4 }, { tags: ['ON_TIME'] }]) {
    const h = serviceHarness(async () => ({ data: receipt(patch), error: null }));
    const result = await h.api.submit(command());
    assert.equal(result.ok, false); assert.equal(result.kod, 'REVIEW_INVALID_RECEIPT');
    assert.equal(h.calls.length, 1);
  }
});

test('a lost review answer stays unknown and does not replay or fall back to another writer', async () => {
  for (const v2 of [false, true]) {
    const h = serviceHarness(async () => { throw new Error('Synthetic transport loss'); }, v2);
    const result = await h.api.submit(command());
    assert.equal(result.ok, false); assert.equal(result.kod, 'REVIEW_OUTCOME_UNKNOWN');
    await Promise.resolve(); assert.equal(h.calls.length, 1);
  }
});

test('a late review receipt cannot cross a changed account generation', async () => {
  let finish;
  const h = serviceHarness(() => new Promise(resolve => { finish = resolve; }));
  const pending = h.api.submit(command());
  await new Promise(resolve => setImmediate(resolve));
  h.session.accountRevision += 1;
  finish({ data: receipt(), error: null });
  const result = await pending;
  assert.equal(result.ok, false); assert.equal(result.kod, 'AUTH_ACCOUNT_CHANGED');
  assert.equal(h.calls.length, 1);
});

const host = name => props => React.createElement(name, props, props.children);
function presentationLoader() {
  const components = {
    'src/ui/Press.tsx': { Press: host('Press') },
    'src/ui/Text.tsx': { T: host('Text') },
    'src/ui/system/Avatar.tsx': { Avatar: host('Avatar'), FaceEdge: host('FaceEdge') },
    'src/ui/system/DetailTopBar.tsx': { DetailTopBar: host('DetailTopBar') },
    'src/ui/system/FlowFooter.tsx': { FlowFooter: host('FlowFooter') },
    'src/ui/system/Glyph.tsx': { Glyph: host('Glyph') },
    'src/ui/system/Pecat.tsx': { PECAT_FALL_MS: 0, Pecat: host('Pecat') },
    'src/ui/system/Section.tsx': { Section: host('Section') },
    'src/ui/system/StateView.tsx': { StateView: host('StateView') },
    'src/ui/system/Surface.tsx': { Surface: host('Surface') },
    'src/ui/system/Screen.tsx': { Screen: props => React.createElement('Screen', props, props.header, props.children, props.footer) },
    'src/ui/system/layout.ts': { layout: { touch: 48 } },
    'src/ui/system/tokens.ts': { brandAction: {}, sys: { color: {}, space: { xs: 4, sm: 8, md: 16, base: 16 }, radius: { pill: 999 } } },
    'src/ui/v2/V2Action.tsx': { V2Action: host('Action') },
    'src/ui/v2/QuietReadState.tsx': { QuietReadState: host('QuietReadState') },
    'src/ui/reviews/RatingStar.tsx': { RatingStar: host('RatingStar'), StarGlow: host('StarGlow'), STARS_WIDTH: 272, STAR_SLOT: 48 },
    'src/ui/reviews/ReviewCommentField.tsx': { ReviewCommentField: host('ReviewCommentField') },
    'src/ui/reviews/ReviewCommentText.tsx': { ReviewCommentText: host('ReviewCommentText') },
  };
  return loader({ ...components, 'react-native': { View: 'View', StyleSheet: { create: value => value } } });
}
const noop = () => {};
const presentationProps = view => ({ view, person: null, notice: null, backLabel: 'Nazad na Dogovor', onBack: noop,
  retry: { label: 'Proverite sačuvanu ocenu', disabled: false, onPress: noop } });
const eligible = extra => ({ kind: 'eligible', catalog: { maxTags: 3, tags: TAGS }, rating: 5, tags: [], editable: true,
  attempt: false, onRate: noop, onToggleTag: noop,
  save: { label: 'Sačuvajte ocenu', loading: false, disabled: false, reason: null, onPress: noop }, ...extra });

test('actual eligible renderer explains blind publication and the 14-day window once before saving', async () => {
  const module = presentationLoader()('src/ui/reviews/AgreementReviewPresentation.tsx');
  let rendered;
  await act(async () => { rendered = create(React.createElement(module.AgreementReviewPresentation, presentationProps(eligible()))); });
  const warning = rendered.root.findByProps({ testID: 'review-save-warning' });
  assert.equal(warning.props.children, module.SAVE_WARNING);
  assert.match(warning.props.children, /obe strane ocene/); assert.match(warning.props.children, /14 dana/);
  assert.doesNotMatch(warning.props.children, /ne možeš/);
  assert.equal(rendered.root.findAllByType('Action').filter(row => row.props.label === 'Sačuvajte ocenu').length, 1);
  await act(async () => rendered.unmount());
});

test('actual saved renderer keeps confirmed stars and publication explanation through a failed later read', async () => {
  const module = presentationLoader()('src/ui/reviews/AgreementReviewPresentation.tsx');
  const props = { ...presentationProps({ kind: 'saved', rating: 5, tags: ['AS_AGREED'], fresh: false }), notice: 'Provera nije uspela.' };
  let rendered;
  await act(async () => { rendered = create(React.createElement(module.AgreementReviewPresentation, props)); });
  const text = rendered.root.findAllByType('Text').map(row => row.props.children).filter(value => typeof value === 'string');
  assert.ok(text.includes('Ocena je sačuvana.'));
  assert.ok(text.includes('Vaša ocena: 5 od 5'));
  assert.ok(text.includes(module.SACUVANO_NOTE));
  assert.match(module.SACUVANO_NOTE, /obe strane ocene.*14 dana/);
  const actions = rendered.root.findAllByType('Action').map(row => row.props.label);
  assert.deepEqual(actions, ['Nazad na Dogovor', 'Proverite sačuvanu ocenu']);
  assert.equal(rendered.root.findAllByType('Press').length, 0);
  await act(async () => rendered.unmount());
});

test('actual unavailable renderer does not imply an expired review will later become eligible', async () => {
  const module = presentationLoader()('src/ui/reviews/AgreementReviewPresentation.tsx');
  let rendered;
  await act(async () => { rendered = create(React.createElement(module.AgreementReviewPresentation, presentationProps({ kind: 'unavailable' }))); });
  const state = rendered.root.findByType('StateView');
  assert.equal(state.props.title, 'Ocena nije dostupna');
  assert.match(state.props.body, /nakon završetka Dogovora, u roku od 14 dana/);
  assert.doesNotMatch(state.props.title, /još/);
  assert.equal(rendered.root.findAllByType('Action').length, 0);
  assert.equal(state.props.primary.label, 'Nazad na Dogovor');
  await act(async () => rendered.unmount());
});

test('actual screen checks an unknown outcome without sending, then an explicit retry retains the original immutable request', async () => {
  const writes = [], pending = [], listeners = new Set();
  let checks = 0, minted = 0, saved = false;
  const workspace = { data: context(), loading: false, busy: false, error: null, uncertain: false, saved: false,
    refresh: async () => { checks += 1; workspace.error = null; workspace.uncertain = false; },
    save: fn => {
      const work = (async () => {
        const result = await fn();
        if (result.ok) { workspace.data = result.podatak; workspace.saved = true; }
        else { workspace.error = result.poruka; workspace.uncertain = true; }
        return result;
      })();
      pending.push(work); return work;
    } };
  const load = loader({
    'react-native': { AppState: { addEventListener: (_type, fn) => { listeners.add(fn); return { remove: () => listeners.delete(fn) }; } } },
    'expo-router': { router: { canGoBack: () => false, replace: noop } },
    'src/data/needDetailPresentation.ts': { readableTitle: value => value },
    'src/hooks/useOwnedEditor.ts': { useOwnedEditor: () => workspace },
    'src/lib/idempotencija.ts': { noviUuidZahtevId: () => { minted += 1; return REQUEST; } },
    'src/ui/reviews/AgreementReviewPresentation.tsx': { AgreementReviewPresentation: host('ReviewPresentation') },
    'src/data/reviewCommentsClientService.ts': { reviewCommentsClientService: {
      context: async () => ({ ok: true, podatak: context(saved ? { eligible: false, review: receipt() } : {}) }),
      submit: async input => { writes.push(structuredClone(input));
        if (writes.length === 1) return { ok: false, kod: 'REVIEW_OUTCOME_UNKNOWN', poruka: 'Ishod ocene nije potvrđen.' };
        saved = true; return { ok: true, podatak: receipt({ idempotentReplay: true }) };
      },
    } },
    'src/store/sesija.ts': { sesijaSada: () => ({ user: { id: ACCOUNT }, accountRevision: 1 }) },
    'src/data/supabaseClient.ts': { supabaseKlijent: () => { throw new Error('NO_NETWORK'); } },
  });
  const Screen = load('src/ui/reviews/AgreementReviewScreen.tsx').AgreementReviewScreen;
  const props = { agreementId: AGREEMENT, accountId: ACCOUNT, accountRevision: 1 };
  let rendered;
  const current = () => rendered.root.findByType('ReviewPresentation').props;
  await act(async () => { rendered = create(React.createElement(Screen, props)); });
  await act(async () => current().view.onRate(5));
  await act(async () => { current().view.save.onPress(); await Promise.all(pending); });
  await act(async () => rendered.update(React.createElement(Screen, props)));
  assert.equal(writes.length, 1); assert.equal(current().view.attempt, true);
  assert.equal(current().view.editable, false); assert.equal(current().view.save.disabled, true);
  assert.equal(current().retry.label, 'Proverite sačuvanu ocenu');
  await act(async () => current().retry.onPress());
  await act(async () => rendered.update(React.createElement(Screen, props)));
  assert.equal(checks, 1); assert.equal(writes.length, 1, 'Check is read-only');
  assert.equal(current().view.save.label, 'Sačuvajte ocenu ponovo');
  await act(async () => { current().view.onRate(2); current().view.onToggleTag('ON_TIME'); });
  assert.equal(current().view.rating, 5, 'Unknown saved command stays immutable');
  await act(async () => { current().view.save.onPress(); await Promise.all(pending); });
  await act(async () => rendered.update(React.createElement(Screen, props)));
  assert.equal(writes.length, 2); assert.deepEqual(writes[1], writes[0]); assert.equal(minted, 1);
  assert.equal(current().view.kind, 'saved'); assert.equal(current().view.rating, 5);
  await act(async () => rendered.unmount());
});
