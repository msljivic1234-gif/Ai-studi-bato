'use strict';
// Actual client stream, receipt adapters and one-use handoff. Only network,
// Supabase transport and the current Auth session are substituted. The corpus
// supplies controlled semantic results; it does NOT claim real-model accuracy.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const ROOT = path.resolve(__dirname, '..');
const id = number => `00000000-0000-4000-8000-${String(number).padStart(12, '0')}`;
const ACCOUNT = id(1), CONVERSATION = id(2), REQUEST = id(3), TURN = id(4), ATTEMPT = id(5);
const SCHEMA = 'AI_CONVERSATION_INTENT_V1';
const compiled = new Map();

function sourceLoader(overrides, globals = {}) {
  const modules = new Map();
  function load(relative) {
    if (Object.hasOwn(overrides, relative)) return overrides[relative];
    const resolved = ['', '.ts', '.tsx', '.js', '.mjs', '/index.ts'].map(ext => path.resolve(ROOT, relative + ext))
      .find(file => fs.existsSync(file) && fs.statSync(file).isFile());
    assert.ok(resolved, 'Actual source module must exist: ' + relative);
    relative = path.relative(ROOT, resolved).replaceAll(path.sep, '/');
    if (Object.hasOwn(overrides, relative)) return overrides[relative];
    if (modules.has(relative)) return modules.get(relative).exports;
    const source = fs.readFileSync(resolved, 'utf8'), key = relative + '\0' + source;
    if (!compiled.has(key)) {
      // .mjs forces ESM output even with module=CommonJS. Use a synthetic .ts
      // compiler filename only; module resolution and executed contents stay real.
      const result = ts.transpileModule(source, { fileName: resolved.endsWith('.mjs') ? resolved + '.ts' : resolved, reportDiagnostics: true,
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } });
      assert.deepEqual((result.diagnostics ?? []).filter(item => item.category === ts.DiagnosticCategory.Error), []);
      compiled.set(key, result.outputText);
    }
    const mod = { exports: {} }; modules.set(relative, mod);
    const localRequire = name => name.startsWith('.')
      ? load(path.relative(ROOT, path.resolve(path.dirname(resolved), name)).replaceAll(path.sep, '/'))
      : Object.hasOwn(overrides, name) ? overrides[name] : require(name);
    new Function('require', 'module', 'exports', ...Object.keys(globals), compiled.get(key))
      (localRequire, mod, mod.exports, ...Object.values(globals));
    return mod.exports;
  }
  return load;
}

function needTurn(patch = {}) {
  return { conversationId: CONVERSATION, clientRequestId: REQUEST, state: 'SUCCEEDED', turnId: TURN,
    retryAllowed: false, receipt: { userMessageId: id(6), assistantMessageId: id(7), proposedCount: 0,
      safety: 'ALLOW', schemaVersion: 'NEED_FACT_V2', authoritative: true }, ...patch };
}
function workerTurn(patch = {}) {
  return { turnId: TURN, conversationId: CONVERSATION, clientRequestId: REQUEST, attemptId: ATTEMPT,
    state: 'SUCCEEDED', retryAllowed: false, authoritative: true, ...patch };
}
const hint = (kind, evidence) => ({ schemaVersion: SCHEMA, kind, evidence });
const event = (sequence, kind, extra = {}) => ({ conversationId: CONVERSATION, clientRequestId: REQUEST,
  turnId: TURN, attemptId: ATTEMPT, sequence, kind, ...extra });
function responseEvents(events, change = {}) {
  return new Response(events.map(value => 'data: ' + JSON.stringify(value) + '\n\n').join(''),
    { status: 200, headers: { 'content-type': 'text/event-stream' }, ...change });
}
function finalEvents(turn, intent, extra = {}) {
  return [event(1, 'accepted'), event(2, 'final', { turn, ...(intent ? { conversationIntent: intent } : {}), ...extra })];
}

function clientHarness(makeResponse, options = {}) {
  const session = { user: { id: ACCOUNT }, accountRevision: 5, session: { access_token: 'bounded-test-token' } };
  const requests = [], sdkWrites = [];
  const overrides = {
    'expo/fetch': { fetch: async (url, init) => {
      requests.push({ url, init });
      return makeResponse({ url, init, session });
    } },
    'src/store/sesija.ts': { sesijaSada: () => session },
    'src/data/publicSupabaseConfig.ts': { readPublicSupabaseConfig: () => ({ url: 'https://fixture.supabase.co', anonKey: 'public-fixture-key' }) },
    'src/data/supabaseClient.ts': { supabaseKlijent: () => ({
      rpc: () => { throw new Error('UNEXPECTED_RPC'); },
      functions: { invoke: async (...args) => { sdkWrites.push(args); return { data: needTurn(), error: null }; } },
    }) },
    ...options.overrides,
  };
  const load = sourceLoader(overrides);
  async function send(domain, text, config = {}) {
    const received = [], deltas = [];
    const stream = { onText: value => deltas.push(value), ...(config.optOut ? {} : {
      onConversationIntent: intent => { received.push(intent); config.onHint?.(intent); },
    }), ...(config.signal ? { signal: config.signal } : {}) };
    const result = domain === 'NEED'
      ? await load('src/data/aiNeedV2Production.ts').aiNeedV2Production.sendMessage(CONVERSATION, text, REQUEST, stream)
      : await load('src/data/workerAiClientService.ts').workerAiClientService.send(CONVERSATION, text, REQUEST, stream);
    return { result, received, deltas };
  }
  return { load, send, session, requests, sdkWrites };
}

const corpus = [
  ['Predajem francuski preko interneta.', 'WORKER_OFFER', 'NEED', 'WORKER'],
  ['Ја нудим онлајн часове француског.', 'WORKER_OFFER', 'NEED', 'WORKER'],
  ['Treba mi neko da mi popravi slavinu.', 'NEED_REQUEST', 'WORKER', 'NEED'],
  ['Треба ми помоћ да ствари унесемо на четврти спрат.', 'NEED_REQUEST', 'WORKER', 'NEED'],
  ['Promenite termin postojećeg zadatka na petak.', 'NEED_EDIT', 'WORKER', 'NEED'],
  ['Takođe popravljam slavine.', 'WORKER_ADD_SERVICE', 'NEED', 'WORKER'],
  ['Сада радим и преводе.', 'WORKER_ADD_SERVICE', 'NEED', 'WORKER'],
  ['Додај и кошење траве.', 'WORKER_ADD_SERVICE', 'NEED', 'WORKER'],
  ['Više ne radim selidbe.', 'WORKER_REMOVE_SERVICE', 'NEED', 'WORKER'],
  ['Prevoz radim, ali utovar više ne.', 'WORKER_EDIT_SERVICE', 'NEED', 'WORKER'],
  ['Radnim danima mogu posle 15.', 'WORKER_AVAILABILITY', 'NEED', 'WORKER'],
  ['Radim u Novom Sadu i Beogradu.', 'WORKER_AREA', 'NEED', 'WORKER'],
  ['Kako se šalje prijava?', 'QUESTION', 'NEED', null],
  ['Да ли овде могу да нудим превоз?', 'QUESTION', 'WORKER', null],
  ['Imam kombi i radim prevoz, ali danas mi trebaju dvojica da istovarim nameštaj.', 'MIXED', 'NEED', null],
  ['Mislio sam evre.', 'CORRECTION', 'NEED', null],
  ['Не треба одвоз.', 'CORRECTION', 'WORKER', null],
  ['Promenio sam mišljenje.', 'UNCLEAR', 'NEED', null],
  ['Ćao.', 'CONTINUE', 'NEED', null], ['Da.', 'CONTINUE', 'WORKER', null],
  ['Ne.', 'CONTINUE', 'NEED', null], ['To je to.', 'CONTINUE', 'WORKER', null],
  ['Sutra.', 'CONTINUE', 'NEED', null], ['Posle četiri.', 'CONTINUE', 'WORKER', null],
  ['Nemam kombi.', 'CORRECTION', 'WORKER', null], ['Samo utovar.', 'CONTINUE', 'NEED', null],
  ['Može i petak.', 'CONTINUE', 'NEED', null], ['I subotu bih mogao.', 'CONTINUE', 'WORKER', null],
  ['Mogu da nosim stvari, utovaram i istovaram. Nemam kombi.', 'WORKER_OFFER', 'NEED', 'WORKER'],
  ['Kombi je moj, trebaju mi samo fizički radnici.', 'NEED_REQUEST', 'WORKER', 'NEED'],
];

test('controlled Serbian intent corpus crosses actual SSE and both owned receipt adapters without automatic writes', async () => {
  for (const [text, kind, domain, target] of corpus) {
    const intent = hint(kind, text);
    const turn = domain === 'NEED' ? needTurn() : workerTurn();
    const h = clientHarness(() => responseEvents(finalEvents(turn, intent)));
    const result = await h.send(domain, text);
    assert.equal(result.result.ok, true, text);
    assert.deepEqual(result.received, [intent], text);
    assert.equal(h.load('src/contracts/aiConversationIntent.ts').oppositeInterviewDomain(result.received[0], domain), target, text);
    assert.equal(h.requests.length, 1, 'no second model/transport request');
    assert.equal(h.requests[0].init.headers['x-uskoci-interview-intent'], 'v1');
    assert.deepEqual(JSON.parse(h.requests[0].init.body), { conversationId: CONVERSATION, clientRequestId: REQUEST, text });
    assert.deepEqual(h.sdkWrites, [], 'a suggestion never calls Save, Publish or profile activation');
  }
});

for (const domain of ['NEED', 'WORKER']) {
  const makeTurn = domain === 'NEED' ? needTurn : workerTurn;
  const text = domain === 'NEED' ? 'Predajem francuski preko interneta.' : 'Treba mi neko da popravi slavinu.';
  const intent = hint(domain === 'NEED' ? 'WORKER_OFFER' : 'NEED_REQUEST', text);
  test(`${domain}: old final and JSON replay keep the exact completed receipt without a fabricated hint`, async () => {
    for (const mode of ['legacy_sse', 'replay_json', 'opt_out']) {
      const turn = makeTurn();
      const h = clientHarness(() => mode === 'replay_json'
        ? new Response(JSON.stringify(turn), { headers: { 'content-type': 'application/json' } })
        : responseEvents(finalEvents(turn)));
      const result = await h.send(domain, text, { optOut: mode === 'opt_out' });
      assert.equal(result.result.ok, true, mode); assert.deepEqual(result.result.podatak, turn);
      assert.deepEqual(result.received, []);
      assert.equal(h.requests[0].init.headers['x-uskoci-interview-intent'], mode === 'opt_out' ? undefined : 'v1');
      assert.equal(h.requests.length, 1);
    }
  });
  test(`${domain}: final identity is insufficient until the complete existing receipt decoder succeeds`, async () => {
    const invalid = domain === 'NEED' ? makeTurn({ receipt: { ...needTurn().receipt, authoritative: false } }) : makeTurn({ authoritative: false });
    const h = clientHarness(() => responseEvents(finalEvents(invalid, intent)));
    const result = await h.send(domain, text);
    assert.equal(result.result.ok, false); assert.deepEqual(result.received, []);
    assert.equal(h.requests.length, 1);
  });
  test(`${domain}: an old-turn quote, wrong schema, invented kind or extra authority field cannot escape`, async () => {
    for (const bad of [hint(intent.kind, 'Tekst iz ranije poruke'), { ...intent, schemaVersion: 'AI_CONVERSATION_INTENT_V2' },
      hint('PUBLISH_NOW', text), { ...intent, authoritative: true }, hint(intent.kind, ''), hint(intent.kind, 'x'.repeat(501))]) {
      const h = clientHarness(() => responseEvents(finalEvents(makeTurn(), bad)));
      const result = await h.send(domain, text);
      assert.equal(result.result.ok, false); assert.deepEqual(result.received, []);
    }
  });
  test(`${domain}: unknown outcome and safe error never hand off or retry the model`, async () => {
    for (const events of [[event(1, 'accepted')], [event(1, 'accepted'), event(2, 'safe_error', { code: 'AI_TURN_NOT_CONFIRMED' })],
      finalEvents(makeTurn(), intent).concat(event(3, 'final', { turn: makeTurn(), conversationIntent: intent }))]) {
      const h = clientHarness(() => responseEvents(events)); const result = await h.send(domain, text);
      assert.equal(result.result.ok, false); assert.deepEqual(result.received, []); assert.equal(h.requests.length, 1);
    }
  });
  test(`${domain}: replaced attempt, other request and pre-final hint are rejected`, async () => {
    for (const bad of [event(2, 'final', { turn: makeTurn(), conversationIntent: intent, attemptId: id(50) }),
      event(2, 'final', { turn: makeTurn(), conversationIntent: intent, clientRequestId: id(51) }),
      event(2, 'text_delta', { text: 'Nacrt', conversationIntent: intent })]) {
      const h = clientHarness(() => responseEvents([event(1, 'accepted'), bad]));
      const result = await h.send(domain, text); assert.equal(result.result.ok, false); assert.deepEqual(result.received, []);
    }
  });
  test(`${domain}: account A-B-A generation and abort fence a late confirmed hint`, async () => {
    for (const mode of ['other_account', 'same_account_new_generation', 'aborted']) {
      const controller = new AbortController();
      const h = clientHarness(({ session }) => {
        if (mode === 'other_account') session.user = { id: id(80) };
        if (mode === 'same_account_new_generation') session.accountRevision += 2;
        if (mode === 'aborted') controller.abort();
        return responseEvents(finalEvents(makeTurn(), intent));
      });
      const result = await h.send(domain, text, { signal: controller.signal });
      assert.equal(result.result.ok, false); assert.deepEqual(result.received, []);
    }
  });
  test(`${domain}: suggestion callback failure does not turn confirmed server success into failure`, async () => {
    const h = clientHarness(() => responseEvents(finalEvents(makeTurn(), intent)));
    const result = await h.send(domain, text, { onHint: () => { throw Error('UI_RETIRED'); } });
    assert.equal(result.result.ok, true); assert.equal(result.received.length, 1);
  });
}

test('transport returns a validated advisory value but never invokes its callback before owned receipt validation', async () => {
  const text = 'Predajem francuski.', intent = hint('WORKER_OFFER', text);
  const h = clientHarness(() => responseEvents(finalEvents(needTurn(), intent)));
  let invoked = 0;
  const response = await h.load('src/data/aiNeedTurnStream.ts').requestAiTurnStream({
    url: 'https://fixture.supabase.co', anonKey: 'public', accessToken: 'fixture-token', conversationId: CONVERSATION,
    clientRequestId: REQUEST, text, current: () => true, deadline: Date.now() + 2000,
    onText() {}, onConversationIntent() { invoked++; },
  });
  assert.equal(invoked, 0); assert.deepEqual(response.conversationIntent, intent); assert.deepEqual(response.data, needTurn());
});

test('whitespace-only quote normalization preserves Serbian content and never transliterates or removes negation', () => {
  const { decodeAiConversationIntent } = sourceLoader({})('src/contracts/aiConversationIntent.ts');
  assert.ok(decodeAiConversationIntent(hint('WORKER_OFFER', 'Нудим часове'), 'Нудим\n  часове француског.'));
  assert.equal(decodeAiConversationIntent(hint('WORKER_OFFER', 'Nudim časove'), 'Нудим часове француског.'), null);
  assert.equal(decodeAiConversationIntent(hint('WORKER_OFFER', 'radim prevoz'), 'Ne radim utovar.'), null);
  assert.ok(decodeAiConversationIntent(hint('UNCLEAR', ''), 'Promenio sam mišljenje.'));
  assert.ok(decodeAiConversationIntent(hint('CONTINUE', ''), 'Da.'));
  assert.equal(decodeAiConversationIntent(hint('QUESTION', ''), 'Da li mogu?'), null);
});

test('confirmed semantic drafts preserve the whole statement and require the exact account, target and one-use token', () => {
  const handoff = sourceLoader({})('src/data/aiRoleHandoff.ts');
  const owner = { accountId: ACCOUNT, accountRevision: 5 }, token = id(90);
  for (const target of ['NEED', 'WORKER']) {
    const text = target === 'NEED' ? 'Kombi je moj, trebaju mi samo fizički radnici.' : 'Prevoz radim, ali utovar više ne.';
    assert.equal(handoff.stageAiRoleText({ ...owner, token, target, text }, 1000), true);
    const correct = target === 'NEED' ? handoff.takeNeedText : handoff.takeWorkerText;
    const wrong = target === 'NEED' ? handoff.takeWorkerText : handoff.takeNeedText;
    assert.equal(wrong({ ...owner, token }, 1001), null);
    assert.equal(correct({ ...owner, accountId: id(91), token }, 1001), null);
    assert.equal(correct({ ...owner, accountRevision: 6, token }, 1001), null);
    assert.equal(correct({ ...owner, token: id(92) }, 1001), null);
    assert.equal(correct({ ...owner, token, capacity: text.length - 1 }, 1001), null, 'occupied composer must not consume it');
    assert.equal(correct({ ...owner, token, capacity: text.length }, 1002), text);
    assert.equal(correct({ ...owner, token }, 1003), null);
  }
});

test('a newer user-approved handoff replaces the old one while wrong or expired tokens never expose it', () => {
  const handoff = sourceLoader({})('src/data/aiRoleHandoff.ts');
  const owner = { accountId: ACCOUNT, accountRevision: 5 };
  assert.equal(handoff.stageAiRoleText({ ...owner, token: id(93), target: 'NEED', text: 'Treba mi slavina.' }, 1000), true);
  assert.equal(handoff.stageAiRoleText({ ...owner, token: id(94), target: 'WORKER', text: 'Takođe popravljam slavine.' }, 1001), true);
  assert.equal(handoff.takeNeedText({ ...owner, token: id(93) }, 1002), null);
  assert.equal(handoff.takeWorkerText({ ...owner, token: id(94) }, 301002), null);
  assert.equal(handoff.takeWorkerText({ ...owner, token: id(94) }, 1003), null);
});

// These probes execute both complete Edge handlers, their real provider SSE
// decoder and the same guards that form SQL arguments. Only HTTP is fake: no
// provider, SQL mutation, account, paid call or production secrets are used.
function handlerHarness(domain, text, providerOutput, options = {}) {
  const calls = [], logs = [], handlers = [];
  const singlePass = options.singlePass === true;
  const env = { SUPABASE_URL: 'https://leqcwgzvjsxugfgzdmth.supabase.co',
    SUPABASE_ANON_KEY: 'public-fixture', SUPABASE_SERVICE_ROLE_KEY: 'server-fixture',
    GEMINI_API_KEY: 'provider-fixture', GEMINI_MODEL: 'gemini-3.8-flash', AI_PROVIDER: 'gemini',
    USKOCI_GEMINI_PAID_TEST_ENABLED: 'true', USKOCI_TAXONOMY_DUAL_GEMINI: String(singlePass),
    USKOCI_TAXONOMY_ROLLOUT_SCOPE: 'DEV', USKOCI_TAXONOMY_ALLOWED_PROJECT_REF: 'leqcwgzvjsxugfgzdmth', ...options.env };
  const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });
  const processing = domain === 'NEED' ? needTurn({ state: 'PROCESSING', receipt: null }) : workerTurn({ state: 'PROCESSING' });
  const candidate = { displayName: 'QA Fixture', bio: '', skills: options.skills ?? [],
    location: { operatingCountryCode: 'RS', city: '', radiusKm: 0 },
    availability: { timezone: 'Europe/Belgrade', availableNow: false, rules: [], windows: [] },
    tools: [], vehicles: [], licenses: [], teamCapacity: 1, workAreas: [] };
  const fetchMock = async (url, init = {}) => {
    const parsed = new URL(String(url)), name = parsed.pathname.split('/').at(-1);
    const args = typeof init.body === 'string' ? JSON.parse(init.body) : null;
    calls.push({ url: parsed.origin + parsed.pathname, name, args, headers: new Headers(init.headers) });
    if (parsed.pathname === '/auth/v1/user') return options.authDenied ? json({}, 401) : json({ id: ACCOUNT });
    if (parsed.pathname === '/rest/v1/ai_conversations') return json([{ id: CONVERSATION, account_id: ACCOUNT, fact_schema_version: 'NEED_FACT_V2', status: 'OPEN' }]);
    if (parsed.hostname === 'generativelanguage.googleapis.com') {
      assert.equal(calls.filter(call => call.url.startsWith(parsed.origin)).length, 1, 'A single request cannot invoke a second model');
      const output = typeof providerOutput === 'function' ? providerOutput(args) : providerOutput;
      const value = { candidates: [{ content: { parts: [{ text: JSON.stringify(output) }] }, finishReason: 'STOP' }],
        usageMetadata: { promptTokenCount: 100, candidatesTokenCount: 30, totalTokenCount: 130 } };
      return new Response('data: ' + JSON.stringify(value) + '\n\n', { headers: { 'content-type': 'text/event-stream' } });
    }
    if (name === 'rpc_ai_claim_need_turn_v2_service') return json(options.replay ? { turn: needTurn(), claim: null } : {
      turn: processing, claim: { attemptId: ATTEMPT, leaseExpiresAt: new Date(Date.now() + 60_000).toISOString(),
        context: { schemaVersion: 'NEED_FACT_V2', history: options.history ?? [], activeFacts: options.activeFacts ?? [] } },
    });
    if (name === 'rpc_claim_worker_ai_turn_service') return json({ acquired: !options.replay, turn: options.replay ? workerTurn() : processing });
    if (name === 'rpc_read_worker_ai_context_service') return json({ schemaVersion: 'WORKER_PROFILE_V1', accountId: ACCOUNT,
      conversationId: CONVERSATION, status: 'OPEN', stale: false, safety: 'ALLOW', profileStatus: 'DRAFT', revision: 1, candidate,
      messages: options.history ?? [{ role: 'USER', body: text, id: id(6) }],
      serviceModeContext: { schemaVersion: 'WORKER_SERVICE_MODE_CONTEXT_V1', revision: 1, savedServices: [], draftServices: [], unresolvedServices: candidate.skills } });
    if (name === 'rpc_ai_test_budget_reserve_service') return json({ admitted: true, replay: false, reservationId: id(10), code: 'AI_TEST_RESERVED' });
    if (name === 'rpc_ai_dispatch_need_turn_v2_service') return json(true);
    if (name === 'rpc_dispatch_worker_ai_turn_service') return json({ dispatched: true, turn: processing });
    if (name === 'rpc_taxonomy_fetch_snapshot_v1') return json({ catalogVersion: 1, catalogFingerprint: 'fixture-catalog', count: 1,
      categories: [{ categoryId: id(20), label: 'Fizička pomoć pri selidbi', parentId: null, isLeaf: true, aliases: [], modes: ['ON_SITE'] }] });
    if (name === 'rpc_ai_test_record_usage_service') return json(true);
    if (['rpc_ai_fail_need_turn_v2_service', 'rpc_fail_worker_ai_turn_service'].includes(name)) return json(true);
    if (['rpc_ai_complete_need_turn_v2_service', 'rpc_ai_complete_need_turn_with_first_plan_service',
      'rpc_complete_worker_ai_turn_service', 'rpc_complete_worker_ai_turn_with_first_plan_service'].includes(name)) {
      if (options.completionFailure) return json({ message: 'FIXTURE_COMPLETION_UNAVAILABLE' }, 503);
      const completed = domain === 'NEED' ? needTurn({ receipt: { ...needTurn().receipt,
        proposedCount: args.p_proposals.length, safety: args.p_safety } }) : workerTurn();
      if (options.malformedReceipt) completed.authoritative = false;
      return json(name.includes('first_plan') ? { completion: completed,
        firstPlan: { state: 'RESOLVED', authority: 'CATALOG_ONLY', applicability: 'NOT_EVALUATED' } } : completed);
    }
    throw new Error('Unexpected external call: ' + parsed.origin + parsed.pathname);
  };
  const load = sourceLoader({}, { Deno: { env: { get: name => env[name] }, serve: handler => handlers.push(handler) },
    fetch: fetchMock, console: Object.fromEntries(['log', 'info', 'warn', 'error'].map(name => [name, (...args) => logs.push(args)])) });
  load(domain === 'NEED' ? 'supabase/functions/uskoci-ai-interview/index.ts' : 'supabase/functions/uskoci-worker-interview/index.ts');
  assert.equal(handlers.length, 1);
  async function run() {
    const response = await handlers[0](new Request(env.SUPABASE_URL + '/functions/v1/fixture', { method: 'POST',
      headers: { Authorization: 'Bearer fixture-account-token', 'Content-Type': 'application/json', Accept: 'text/event-stream',
        ...(options.optOut ? {} : { 'x-uskoci-interview-intent': 'v1' }) },
      body: JSON.stringify({ conversationId: CONVERSATION, clientRequestId: REQUEST, text }) }));
    const raw = await response.text();
    const events = response.headers.get('content-type').includes('text/event-stream')
      ? raw.split('\n\n').filter(Boolean).map(part => JSON.parse(part.slice(6))) : [];
    const writes = calls.filter(call => /rpc_(?:ai_)?complete_(?:need|worker)_/.test(call.name));
    return { status: response.status, events, json: events.length ? null : JSON.parse(raw), calls, writes, logs };
  }
  return { run };
}

function providerNeed(kind, text, patch = {}) {
  return { assistantMessage: 'Proverite sledeći korak.', safety: 'ALLOW',
    facts: [], dialogue: { next: 'ANSWER', questionKey: 'NONE', taskRelation: 'CONTINUE', priceUnit: 'UNSPECIFIED', schedulePattern: 'UNSPECIFIED' },
    conversationIntent: { kind, evidence: text }, ...patch };
}
function providerWorker(kind, text, patch = {}) {
  return { assistantMessage: 'Proverite sledeći korak.', safety: 'ALLOW', patch: { availability: null },
    availabilityChange: { kind: 'NONE', scope: 'NONE', evidence: '' }, serviceChanges: [], conversationIntent: { kind, evidence: text }, ...patch };
}

for (const domain of ['NEED', 'WORKER']) {
  test(`${domain} actual Edge: opposite, mixed, pure questions and unclear intent freeze malicious provider writes before SQL`, async () => {
    const cases = domain === 'NEED'
      ? [['WORKER_OFFER', 'Predajem francuski preko interneta.'], ['WORKER_ADD_SERVICE', 'Додај и кошење траве.'],
        ['MIXED', 'Nudim prevoz, ali treba mi pomoć za utovar.'], ['QUESTION', 'Da li ovde mogu da nudim prevoz?'], ['UNCLEAR', 'Promenio sam mišljenje.']]
      : [['NEED_REQUEST', 'Треба ми неко да поправи славину.'], ['NEED_EDIT', 'Promenite termin zadatka.'],
        ['MIXED', 'Radim prevoz, ali trebaju mi dvojica za utovar.'], ['QUESTION', 'Kako radi prijava za zadatak?'], ['UNCLEAR', 'Promenio sam mišljenje.']];
    for (const [kind, text] of cases) {
      const output = domain === 'NEED' ? providerNeed(kind, text, { facts: [{ key: 'need.price_rsd', valueJson: '1200', displayValue: '1200 RSD', evidence: text, confidence: 1 }], taxonomyDecisions: [{ invented: true }] })
        : providerWorker(kind, text, { patch: { availability: { availableNow: true }, skills: ['Prevoz kombijem'], bio: 'Imam kombi.',
          areaRequests: [{ invalidProviderArea: true }] }, serviceChanges: [{ action: 'ADD', service: 'Prevoz kombijem', replacement: '', evidence: text }],
          serviceModeChangesJson: '[{"invented":true}]', taxonomyDecisions: [{ invented: true }] });
      const result = await handlerHarness(domain, text, output, { singlePass: true }).run();
      assert.equal(result.events.at(-1)?.kind, 'final', JSON.stringify({ kind, events: result.events, logs: result.logs }));
      assert.equal(result.writes.length, 1);
      const args = result.writes[0].args;
      assert.deepEqual(domain === 'NEED' ? args.p_proposals : args.p_output.patch, domain === 'NEED' ? [] : {});
      assert.equal(Object.hasOwn(args, 'p_taxonomy_plan'), false);
      assert.equal(result.calls.filter(call => /streamGenerateContent/.test(call.name)).length, 1);
      assert.equal(result.calls.filter(call => /dispatch.*turn/.test(call.name)).length, 1);
      assert.equal(result.calls.some(call => /locationiq|geocod|resolve.*area|apply_legacy/.test(call.url)), false);
      assert.deepEqual(result.events.at(-1).conversationIntent, hint(kind, text));
    }
  });

  test(`${domain} actual Edge: old client wire and durable replay do not invent a semantic receipt`, async () => {
    const text = domain === 'NEED' ? 'Nudim časove francuskog.' : 'Treba mi pomoć za selidbu.';
    const kind = domain === 'NEED' ? 'WORKER_OFFER' : 'NEED_REQUEST';
    const provider = domain === 'NEED' ? providerNeed(kind, text) : providerWorker(kind, text);
    const old = await handlerHarness(domain, text, provider, { optOut: true }).run();
    assert.equal(old.events.at(-1)?.kind, 'final', JSON.stringify(old));
    assert.equal(Object.hasOwn(old.events.at(-1), 'conversationIntent'), false);
    const replay = await handlerHarness(domain, text, provider, { replay: true }).run();
    assert.equal(replay.status, 200); assert.deepEqual(replay.json, domain === 'NEED' ? needTurn() : workerTurn());
    assert.equal(replay.calls.some(call => /streamGenerateContent|dispatch|complete|budget/.test(call.name)), false);
  });

  test(`${domain} actual Edge: missing intent and safety holds cannot create facts or handoff authority`, async () => {
    const text = 'Novi zahtev za proveru.';
    for (const safety of ['ALLOW', 'REVIEW', 'BLOCK']) {
      const output = domain === 'NEED' ? providerNeed('WORKER_OFFER', text, { safety }) : providerWorker('NEED_REQUEST', text, { safety });
      if (safety === 'ALLOW') delete output.conversationIntent;
      const result = await handlerHarness(domain, text, output).run();
      assert.equal(result.events.at(-1)?.kind, 'final', JSON.stringify({ events: result.events, logs: result.logs }));
      assert.equal(Object.hasOwn(result.events.at(-1), 'conversationIntent'), false);
      const args = result.writes[0].args;
      assert.deepEqual(domain === 'NEED' ? args.p_proposals : args.p_output.patch, domain === 'NEED' ? [] : {});
      assert.equal(domain === 'NEED' ? args.p_safety : args.p_output.safety, safety === 'ALLOW' ? 'CLARIFY' : safety);
    }
  });

  test(`${domain} actual Edge: provider success plus failed completion has one dispatch and no final hint`, async () => {
    const text = domain === 'NEED' ? 'Predajem francuski.' : 'Treba mi majstor.';
    const provider = domain === 'NEED' ? providerNeed('WORKER_OFFER', text) : providerWorker('NEED_REQUEST', text);
    const result = await handlerHarness(domain, text, provider, { completionFailure: true }).run();
    assert.equal(result.events.at(-1)?.kind, 'safe_error');
    assert.equal(result.events.some(event => event.conversationIntent || event.kind === 'final'), false);
    assert.equal(result.calls.filter(call => /streamGenerateContent/.test(call.name)).length, 1);
    assert.equal(result.calls.filter(call => /dispatch.*turn/.test(call.name)).length, 1);
    assert.equal(result.calls.filter(call => /fail.*turn/.test(call.name)).length, 1);
    assert.equal(result.calls.some(call => /release_unused/.test(call.name)), false);
    assert.equal(result.calls.filter(call => call.name === 'rpc_ai_test_record_usage_service').length, 1);
  });
}

test('Worker actual Edge: ADD, REMOVE and scoped REPLACE preserve every unrelated saved service and never infer a van', async () => {
  const cases = [
    { text: 'Takođe popravljam slavine.', kind: 'WORKER_ADD_SERVICE', base: ['Prevoz', 'Utovar'], action: 'ADD', service: 'Popravka slavina', replacement: '', expected: ['Prevoz', 'Utovar', 'Popravka slavina'] },
    { text: 'Сада радим и преводе.', kind: 'WORKER_ADD_SERVICE', base: ['Košenje trave'], action: 'ADD', service: 'Prevođenje', replacement: '', expected: ['Košenje trave', 'Prevođenje'] },
    { text: 'Više ne radim selidbe.', kind: 'WORKER_REMOVE_SERVICE', base: ['Selidbe', 'Košenje trave'], action: 'REMOVE', service: 'Selidbe', replacement: '', expected: ['Košenje trave'] },
    { text: 'Prevoz radim, ali utovar više ne.', kind: 'WORKER_EDIT_SERVICE', base: ['Prevoz sa utovarom', 'Košenje trave'], action: 'REPLACE', service: 'Prevoz sa utovarom', replacement: 'Prevoz bez utovara', expected: ['Prevoz bez utovara', 'Košenje trave'] },
    { text: 'Mogu da nosim nameštaj, nemam kombi.', kind: 'WORKER_OFFER', base: [], action: 'ADD', service: 'Fizička pomoć pri selidbi', replacement: '', expected: ['Fizička pomoć pri selidbi'] },
  ];
  for (const c of cases) {
    const output = providerWorker(c.kind, c.text, { serviceChanges: [{ action: c.action, service: c.service, replacement: c.replacement, evidence: c.text }],
      taxonomyDecisions: [], serviceModeChangesJson: '[]' });
    const result = await handlerHarness('WORKER', c.text, output, { skills: c.base, singlePass: true }).run();
    assert.equal(result.events.at(-1)?.kind, 'final', JSON.stringify({ events: result.events, logs: result.logs }));
    assert.deepEqual(result.writes[0].args.p_output.patch, { skills: c.expected });
    assert.equal(result.calls.filter(call => /streamGenerateContent/.test(call.name)).length, 1);
    const modelInput = result.calls.find(call => /streamGenerateContent/.test(call.name)).args;
    for (const key of ['conversationIntent', 'serviceChanges', 'taxonomyDecisions', 'serviceModeChangesJson'])
      assert.ok(modelInput.generationConfig.responseSchema.required.includes(key), 'Natural edits get the complete schema: ' + key);
    assert.ok(modelInput.systemInstruction.parts.some(part => part.text.includes(id(20))), 'The same single model call receives the actual complete catalog');
  }
});

test('Worker actual Edge: mismatched removals, stale evidence and legacy full-list overwrite keep existing services', async () => {
  const text = 'Više ne radim selidbe.', base = ['Prevoz', 'Utovar'];
  for (const extra of [
    { serviceChanges: [{ action: 'REMOVE', service: 'Selidbe', replacement: '', evidence: text }] },
    { serviceChanges: [{ action: 'REMOVE', service: 'Prevoz', replacement: '', evidence: 'Ranije sam radio prevoz.' }] },
    { patch: { availability: null, skills: ['Selidbe'], bio: 'Radim samo selidbe.' }, serviceChanges: [] },
  ]) {
    const result = await handlerHarness('WORKER', text, providerWorker('WORKER_REMOVE_SERVICE', text, extra), { skills: base }).run();
    assert.equal(result.events.at(-1)?.kind, 'final', JSON.stringify({ events: result.events, logs: result.logs }));
    assert.deepEqual(result.writes[0].args.p_output.patch, {});
    assert.equal(result.writes[0].args.p_output.safety, 'CLARIFY');
  }
});

test('Worker actual Edge: a recurring statement cannot become today-only availability even under a mislabeled DATED plan', async () => {
  for (const text of ['Dostupan sam svakog dana od 8 do 22.', 'Доступан сам сваког дана од 8 до 22.']) {
    for (const scope of ['WEEKLY', 'DATED']) {
      const availability = { windowsUpsert: [{ id: null, startsAt: '2026-11-07T07:00:00Z',
        endsAt: '2026-11-07T21:00:00Z', state: 'AVAILABLE', label: 'Danas' }] };
      const result = await handlerHarness('WORKER', text, providerWorker('WORKER_AVAILABILITY', text, {
        patch: { availability }, availabilityChange: { kind: 'PATCH', scope, evidence: text },
      }), { skills: ['Lektura tekstova'] }).run();
      assert.equal(result.events.at(-1)?.kind, 'final', JSON.stringify({ events: result.events, logs: result.logs }));
      assert.deepEqual(result.writes[0].args.p_output.patch, {}, 'No dated window may reach the canonical writer');
      assert.equal(result.writes[0].args.p_output.safety, 'CLARIFY');
      assert.equal(result.calls.filter(call => /streamGenerateContent/.test(call.name)).length, 1);
    }
  }
});

test('Worker actual Edge: weekly hours and current availability survive the same one-call MIXED plan with every day preserved', async () => {
  const text = 'Dostupan sam svakog dana od 8 do 22 po vremenu Beograda. Trenutno sam dostupan.';
  const availability = { timezone: 'Europe/Belgrade', availableNow: true, ruleChanges: [{ ruleId: null,
    weekdays: [0, 1, 2, 3, 4, 5, 6], value: { startTime: '08:00', endTime: '22:00', startsOn: '2026-11-07',
      endsOn: null, label: 'Svakog dana', active: true } }] };
  const result = await handlerHarness('WORKER', text, providerWorker('WORKER_AVAILABILITY', text, {
    patch: { availability }, availabilityChange: { kind: 'PATCH', scope: 'MIXED', evidence: text },
  }), { skills: ['Lektura tekstova'] }).run();
  assert.equal(result.events.at(-1)?.kind, 'final', JSON.stringify({ events: result.events, logs: result.logs }));
  assert.deepEqual(result.writes[0].args.p_output.patch, { availability });
  assert.equal(result.writes[0].args.p_output.safety, 'ALLOW');
  assert.equal(result.calls.filter(call => /streamGenerateContent/.test(call.name)).length, 1);
  const request = result.calls.find(call => /streamGenerateContent/.test(call.name)).args;
  assert.ok(request.generationConfig.responseSchema.properties.availabilityChange.required.includes('scope'));
});

test('Worker actual Edge: historical availability evidence cannot authorize a new calendar change', async () => {
  const previous = 'Sada sam dostupan.', text = 'Dodaj i prevode.';
  const result = await handlerHarness('WORKER', text, providerWorker('WORKER_ADD_SERVICE', text, {
    patch: { availability: { availableNow: true } },
    serviceChanges: [{ action: 'ADD', service: 'Prevođenje', replacement: '', evidence: text }],
    availabilityChange: { kind: 'PATCH', scope: 'NOW', evidence: previous },
  }), { skills: ['Lektura tekstova'], history: [{ role: 'USER', body: previous, id: id(55) }] }).run();
  assert.equal(result.events.at(-1)?.kind, 'final', JSON.stringify({ events: result.events, logs: result.logs }));
  assert.deepEqual(result.writes[0].args.p_output.patch, { skills: ['Lektura tekstova', 'Prevođenje'] });
  assert.equal(result.writes[0].args.p_output.safety, 'CLARIFY');
});

// Execute only the real route-owned closure/commit block with explicit refs.
// This checks authority races without claiming a renderer or native UI test.
function routeFragment(relative, choose, scope, expression = true) {
  const source = fs.readFileSync(path.join(ROOT, relative), 'utf8');
  const ast = ts.createSourceFile(relative, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const matches = [];
  const visit = node => { const chosen = choose(node, ast); if (chosen) matches.push(chosen.getText(ast)); ts.forEachChild(node, visit); };
  visit(ast); assert.equal(matches.length, 1, 'One real route fragment must match in ' + relative);
  const raw = expression ? 'module.exports = (' + matches[0] + ');' : 'module.exports = () => {' + matches[0] + '};';
  const output = ts.transpileModule(raw, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const module = { exports: {} };
  new Function('scope', 'module', 'with (scope) {' + output + '}')(scope, module);
  return module.exports;
}
const routePath = domain => domain === 'NEED' ? 'src/app/(app)/nova.tsx' : 'src/app/(app)/profil/razgovor.tsx';

for (const domain of ['NEED', 'WORKER']) {
  test(`${domain} real route handoff closure rejects retained onPress after blur, background and foreground replacement`, () => {
    const staged = [], pushed = [], foreground = {}, generation = { current: foreground };
    let current = true;
    const scope = { canAct: () => current, enabled: true, writable: true, currentRoleSuggestion: { text: 'Potpuna korisnička poruka.' },
      accountId: ACCOUNT, accountRevision: 5, request: { current: null }, pending: { current: null }, draftText: { current: '' },
      voice: { controller: { getSnapshot: () => ({ phase: 'IDLE' }) } }, noviUuidZahtevId: () => id(14),
      stageAiRoleText: value => { staged.push(value); return true; }, navigate: go => go(), leave: go => go(),
      router: { push: value => pushed.push(value) }, restartOwner: generation, foregroundGeneration: generation,
      renderedForeground: foreground };
    const name = domain === 'NEED' ? 'openSuggestedWorker' : 'openSuggestedNeed';
    const action = routeFragment(routePath(domain), node => ts.isVariableDeclaration(node) && node.name.getText() === name ? node.initializer : null, scope);
    current = false; action(); assert.equal(staged.length, 0, 'stale account/focus cannot navigate');
    current = true; generation.current = null; action(); assert.equal(staged.length, 0, 'background cannot navigate before rerender');
    generation.current = {}; action(); assert.equal(staged.length, 0, 'returning active never revives the old handler');
    generation.current = foreground; scope.draftText.current = 'Nov neposlat nacrt'; action(); assert.equal(staged.length, 0);
    scope.draftText.current = ''; scope.request.current = {}; scope.pending.current = {}; action(); assert.equal(staged.length, 0);
    scope.request.current = null; scope.pending.current = null; action();
    assert.deepEqual(staged, [{ token: id(14), text: 'Potpuna korisnička poruka.', target: domain === 'NEED' ? 'WORKER' : 'NEED', accountId: ACCOUNT, accountRevision: 5 }]);
    assert.equal(pushed.length, 1);
    assert.equal(JSON.stringify(pushed).includes('Potpuna korisnička poruka.'), false, 'The route gets a token, never private draft text');
  });

  test(`${domain} real route canonical gate refuses stale, blocked, image and unrelated receipt content`, () => {
    const intentApi = sourceLoader({})('src/contracts/aiConversationIntent.ts');
    const body = 'Cela izvorna poruka.', changes = [], foreground = {};
    const canonical = domain === 'NEED' ? { conversationId: CONVERSATION, safety: 'ALLOW', messages: [
      { id: id(6), body, fromAi: false }, { id: id(7), body: 'Predlog', fromAi: true }] }
      : { conversationId: CONVERSATION, safety: 'ALLOW', turn: workerTurn(), messages: [
        { id: id(6), body, role: 'USER' }, { id: id(7), body: 'Predlog', role: 'ASSISTANT' }] };
    let current = true;
    const scope = { isCurrent: () => current, current: () => current, presence: foreground, restartOwner: { current: foreground },
      abort: { signal: { aborted: false } }, controller: { signal: { aborted: false } },
      semanticHint: { value: hint(domain === 'NEED' ? 'WORKER_OFFER' : 'NEED_REQUEST', body) },
      oppositeInterviewDomain: intentApi.oppositeInterviewDomain, command: { id: REQUEST, body, text: body },
      id: CONVERSATION, data: { conversationId: CONVERSATION }, setRoleSuggestion: value => changes.push(value),
      nextRead: { ok: true, podatak: { conversation: canonical } },
      result: domain === 'NEED' ? { ok: true, podatak: needTurn() } : { ok: true, podatak: canonical },
      sent: { ok: true, podatak: workerTurn() } };
    const commit = routeFragment(routePath(domain), (node, ast) => ts.isIfStatement(node)
      && node.expression.getText(ast).includes('semanticHint.value') && node.thenStatement.getText(ast).includes('setRoleSuggestion(') ? node : null, scope, false);
    current = false; commit(); assert.equal(changes.length, 0); current = true;
    canonical.safety = 'REVIEW'; commit(); assert.equal(changes.length, 0); canonical.safety = 'ALLOW';
    canonical.messages[0].body = 'Druga poruka.'; commit(); assert.equal(changes.length, 0); canonical.messages[0].body = body;
    if (domain === 'NEED') {
      scope.command.image = { base64: 'fixture', mimeType: 'image/jpeg' }; commit(); assert.equal(changes.length, 0); delete scope.command.image;
      scope.restartOwner.current = {}; commit(); assert.equal(changes.length, 0); scope.restartOwner.current = foreground;
      canonical.messages[1].id = id(15); commit(); assert.equal(changes.length, 0); canonical.messages[1].id = id(7);
    } else {
      canonical.turn.clientRequestId = id(15); commit(); assert.equal(changes.length, 0); canonical.turn.clientRequestId = REQUEST;
      canonical.turn.turnId = id(15); commit(); assert.equal(changes.length, 0); canonical.turn.turnId = TURN;
      scope.controller.signal.aborted = true; commit(); assert.equal(changes.length, 0); scope.controller.signal.aborted = false;
    }
    commit(); assert.equal(changes.length, 1); assert.equal(changes[0].text, body);
    assert.equal(changes[0].assistantMessageId, id(7));
  });

  test(`${domain} real receiving effect appends an unsent draft once and never consumes an overflowing transfer`, () => {
    const handoff = sourceLoader({})('src/data/aiRoleHandoff.ts'), token = id(18), text = 'Izvorna poruka za drugi razgovor.';
    let rendered = '';
    const scope = { roleHandoff: token, accountId: ACCOUNT, accountRevision: 5, canSubmit: true, writable: true, data: { conversationId: CONVERSATION },
      focus: { current: {} }, active: { current: true }, restartOwner: { current: {} }, request: { current: null }, pending: { current: null },
      owns: () => true, sesijaSada: () => ({ user: { id: ACCOUNT }, accountRevision: 5 }), draftText: { current: 'z'.repeat(3990) },
      draftRevision: { current: 8 }, takeNeedText: handoff.takeNeedText, takeWorkerText: handoff.takeWorkerText,
      setUnos: value => { rendered = value; }, setInput: value => { rendered = value; }, showPanel: () => {} };
    const effect = routeFragment(routePath(domain), (node, ast) => ts.isCallExpression(node) && node.expression.getText(ast) === 'useEffect'
      && node.arguments[0]?.getText(ast).includes(domain === 'NEED' ? 'takeNeedText(' : 'takeWorkerText(') ? node.arguments[0] : null, scope);
    assert.equal(handoff.stageAiRoleText({ token, text, target: domain, accountId: ACCOUNT, accountRevision: 5 }), true);
    effect(); assert.equal(rendered, ''); assert.equal(scope.draftRevision.current, 8);
    scope.draftText.current = 'Već napisano'; effect();
    assert.equal(rendered, 'Već napisano\n' + text); assert.equal(scope.draftRevision.current, 9);
    effect(); assert.equal(scope.draftRevision.current, 9, 'the same navigation token is consumed once');
  });
}

test('Need fast-path confirmation cannot navigate through a retained callback from a previous foreground generation', () => {
  const foreground = {}, staged = [];
  const scope = { canAct: () => true, request: { current: null }, accountId: ACCOUNT, accountRevision: 5,
    renderedForeground: foreground, restartOwner: { current: null }, body: 'Nudim časove.',
    voice: { controller: { getSnapshot: () => ({ phase: 'IDLE' }) } }, noviUuidZahtevId: () => id(19),
    stageWorkerText: value => { staged.push(value); return true; }, navigate: go => go(), router: { push: () => {} } };
  const confirm = routeFragment(routePath('NEED'), (node, ast) => ts.isPropertyAssignment(node) && node.name.getText(ast) === 'onConfirm'
    && node.initializer.getText(ast).includes('stageWorkerText(') ? node.initializer : null, scope);
  confirm(); assert.equal(staged.length, 0); scope.restartOwner.current = {}; confirm(); assert.equal(staged.length, 0);
  scope.restartOwner.current = foreground; confirm(); assert.equal(staged.length, 1);
});
