'use strict';
// Execute the actual QA handler, budget/key helpers and Gemini usage decoder.
// Only Auth/RPC/provider transport and the clock are synthetic. No live I/O.
// R06_QA_PREIMAGE_REF replays this suite against an immutable Git source.
// R06_QA_SOURCE_MAP executes a complete Edge candidate package with no fallback.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const { createHash, webcrypto } = require('node:crypto');
const { execFileSync } = require('node:child_process');
const ROOT = path.resolve(__dirname, '..');
const ENTRY = 'supabase/functions/uskoci-qa-classify/index.ts';
const BASE = process.env.R06_QA_PREIMAGE_REF;
const SOURCE_MAP = process.env.R06_QA_SOURCE_MAP
  ? JSON.parse(fs.readFileSync(process.env.R06_QA_SOURCE_MAP, 'utf8')) : null;
const MAP = SOURCE_MAP ? new Map((Array.isArray(SOURCE_MAP.files) ? SOURCE_MAP.files
  : Object.entries(SOURCE_MAP.files).map(([name, content]) => ({ name, content })))
  .map(file => [file.name ?? file.path, file.content])) : null;
const compiled = new Map();
function readSource(relative) {
  const candidates = ['', '.ts', '.js', '.mjs', '/index.ts'].map(ext => relative + ext);
  if (MAP) {
    const found = candidates.find(candidate => MAP.has(candidate));
    assert.ok(found, 'Exact candidate dependency missing; repository fallback is forbidden: ' + relative);
    return { file: found, source: MAP.get(found) };
  }
  const found = candidates.find(candidate => fs.existsSync(path.join(ROOT, candidate)));
  assert.ok(found, 'Actual source dependency missing: ' + relative);
  return { file: found, source: BASE
    ? execFileSync('git', ['show', BASE + ':' + found], { cwd: ROOT, encoding: 'utf8' })
    : fs.readFileSync(path.join(ROOT, found), 'utf8') };
}
function sourceLoader(globals) {
  const modules = new Map();
  function load(relative) {
    const { file, source } = readSource(relative);
    if (modules.has(file)) return modules.get(file).exports;
    const key = file + '\0' + source;
    if (!compiled.has(key)) {
      const result = ts.transpileModule(source, { fileName: file.endsWith('.mjs') ? file + '.ts' : file,
        reportDiagnostics: true, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } });
      assert.deepEqual((result.diagnostics ?? []).filter(d => d.category === ts.DiagnosticCategory.Error), []);
      compiled.set(key, result.outputText);
    }
    const mod = { exports: {} }; modules.set(file, mod);
    const requireLocal = name => {
      assert.ok(name.startsWith('.'), 'Unexpected external module: ' + name);
      return load(path.posix.normalize(path.posix.join(path.posix.dirname(file), name)));
    };
    new Function('require', 'module', 'exports', ...Object.keys(globals), compiled.get(key))
      (requireLocal, mod, mod.exports, ...Object.values(globals));
    return mod.exports;
  }
  return load;
}
const id = n => '00000000-0000-4000-8000-' + String(n).padStart(12, '0');
const ACCOUNT = id(1), NEED = id(2), REQUEST = id(3), CLASSIFICATION = id(4), ATTEMPT = id(5), RESERVATION = id(6);
const ORIGIN = 'https://r06-qa-fixture.invalid';
const SERVICE = 'sb_secret_r06_synthetic_fixture_only_012345';
const PUBLIC = 'sb_publishable_r06_synthetic_fixture_only_012345';
const USER = 'Bearer synthetic.ordinary_user.signature';
const QUESTION = 'Da li mogu da predam tekst sutra?';
const HASH = createHash('sha256').update(QUESTION).digest('hex');
const USAGE = { promptTokenCount: 1000, candidatesTokenCount: 30, thoughtsTokenCount: 20,
  toolUsePromptTokenCount: 20, totalTokenCount: 1070 };
const OUTPUT = { outcome: 'ALLOW', materiality: null, ruleIds: ['SYNTHETIC_RULE'], safeReasonCodes: [] };
const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { 'Content-Type': 'application/json' },
});
function clock() {
  let serial = 0; const active = new Map();
  return {
    setTimeout(fn, ms) { const id = ++serial; active.set(id, { fn, ms }); return id; },
    clearTimeout(id) { active.delete(id); },
    fire(ms) { for (const [id, timer] of [...active]) if (timer.ms === ms && active.delete(id)) timer.fn(); },
    active,
  };
}
function context() {
  const policy = { schemaVersion: 'USKOCI_PUBLICATION_POLICY_V1', instructions: 'Synthetic local policy.',
    rules: [{ ruleId: 'SYNTHETIC_RULE', instructions: 'Synthetic fixture only.',
      outcomes: ['ALLOW', 'BLOCK'], safeReasonCodes: ['SYNTHETIC_BLOCK'] }] };
  return {
    schemaVersion: 'PRESELECTION_QA_CLASSIFIER_V1', type: 'ASK', sourceHash: 'a'.repeat(64),
    policyHash: 'b'.repeat(64), policy, taskSafetyPolicy: policy, question: null,
    publicTask: {
      title: 'Lektura', description: 'Sintetički tekst za lokalni test.', category: 'Lektura',
      scheduleKind: 'REMOTE_ANYTIME', startsAt: null, endsAt: null, requiredSlots: 1,
      priceMode: 'OFFERS', requesterPriceRsd: null, requiredSkills: [], requiredTools: [],
      requiredVehicles: [], requiredLicenses: [], minimumExperienceYears: null,
      verifiedIdentityRequired: false, criticalConditions: [],
      publicGeography: { executionLocationMode: 'REMOTE', approximateCity: null,
        approximateArea: null, topology: { mode: 'REMOTE' } },
    },
  };
}
function harness(options = {}) {
  const timers = clock(), calls = [], background = [], receipts = [], pendingUsage = [];
  const controller = new AbortController();
  let handler, attempts = 0, reserved = false, current = {
    accountId: ACCOUNT, needId: NEED, clientRequestId: REQUEST, classificationId: CLASSIFICATION,
    type: 'ASK', needRevision: 1, questionId: null, textSha256: HASH,
    state: 'PROCESSING', outcome: null, materiality: null, safeReasonCodes: [],
    canCancel: true, receipt: null, authoritative: true,
  };
  const env = { SUPABASE_URL: ORIGIN, SUPABASE_SECRET_KEYS: JSON.stringify({ default: SERVICE }),
    SUPABASE_PUBLISHABLE_KEYS: JSON.stringify({ default: PUBLIC }), AI_PROVIDER: 'gemini',
    GEMINI_MODEL: 'gemini-3.8-flash', GEMINI_API_KEY: 'synthetic-provider-key',
    USKOCI_GEMINI_PAID_TEST_ENABLED: 'true', USKOCI_QA_CLASSIFIER_ENABLED: 'true' };
  const fixtureFetch = async (input, init = {}) => {
    const url = new URL(input), headers = new Headers(init.headers);
    const args = typeof init.body === 'string' ? JSON.parse(init.body) : null;
    const call = { origin: url.origin, path: url.pathname, headers, args, signal: init.signal };
    calls.push(call);
    if (url.origin === 'https://generativelanguage.googleapis.com') {
      assert.equal(url.pathname, '/v1beta/models/gemini-3.8-flash:generateContent');
      assert.equal(headers.get('x-goog-api-key'), 'synthetic-provider-key');
      assert.equal(headers.has('authorization'), false);
      assert.equal(headers.has('apikey'), false);
      attempts++;
      if (options.providerHttpFailure) return json({ error: { code: 429 } }, 429);
      if (options.providerThrows) throw new Error('Synthetic lost provider response');
      const usageMetadata = Object.hasOwn(options, 'usage') ? options.usage : USAGE;
      const output = options.output ?? OUTPUT;
      return json({
        ...(usageMetadata === undefined ? {} : { usageMetadata }),
        candidates: [{ finishReason: options.finishReason ?? 'STOP',
          content: { parts: [{ text: options.invalidJson ? '{' : JSON.stringify(output) }] } }],
      });
    }
    assert.equal(url.origin, ORIGIN, 'No network may leave synthetic endpoints');
    if (url.pathname === '/auth/v1/user') {
      assert.equal(headers.get('apikey'), PUBLIC);
      assert.equal(headers.get('authorization'), USER);
      return json({ id: ACCOUNT, role: 'authenticated' });
    }
    const rpc = url.pathname.split('/').at(-1);
    if (rpc === 'rpc_submit_classified_preselection_qa') {
      assert.equal(headers.get('apikey'), PUBLIC);
      assert.equal(headers.get('authorization'), USER);
      assert.equal(args.p_expected_user_id, ACCOUNT);
      assert.equal(args.p_client_request_id, REQUEST);
      current = { ...current, state: 'COMMITTED', canCancel: false,
        receipt: { questionId: id(7), status: 'PENDING_ANSWER', needRevision: 1, idempotentReplay: false } };
      return json(current);
    }
    assert.equal(headers.get('apikey'), SERVICE);
    assert.equal(headers.has('authorization'), false);
    if (rpc === 'rpc_claim_qa_classification_service') {
      assert.equal(args.p_account_id, ACCOUNT);
      assert.equal(args.p_client_request_id, REQUEST);
      return json({ status: options.wrongAccount ? { ...current, accountId: id(99) } : current,
        claim: current.state === 'PROCESSING'
          ? { attemptId: ATTEMPT, leaseExpiresAt: new Date(Date.now() + 60000).toISOString(), context: context() } : null });
    }
    if (rpc === 'rpc_ai_test_budget_reserve_service') {
      assert.deepEqual(args, { p_account_id: ACCOUNT, p_operation_id: CLASSIFICATION, p_kind: 'LLM', p_max_cost_microusd: 250000 });
      if (options.budgetRefused) return json({ admitted: false, replay: false, reservationId: null, code: 'AI_TEST_BUDGET_EXHAUSTED' });
      const replay = reserved; reserved = true;
      return json({ admitted: !replay, replay, reservationId: RESERVATION, code: replay ? 'AI_TEST_OPERATION_REPLAY' : 'AI_TEST_RESERVED' });
    }
    if (rpc === 'rpc_dispatch_qa_classification_service') {
      assert.equal(args.p_account_id, ACCOUNT); assert.equal(args.p_attempt_id, ATTEMPT);
      return json(options.dispatchRefused ? false : true);
    }
    if (rpc === 'rpc_ai_test_record_usage_service') {
      assert.deepEqual(args, { p_operation_id: CLASSIFICATION, p_model: 'gemini-3.8-flash',
        p_prompt_tokens: 1020, p_output_tokens: 50, p_total_tokens: 1070 });
      assert.equal(args.p_account_id, undefined, 'Existing writer resolves the reservation owner');
      if (options.usageFailure) return json({ code: 'SYNTHETIC_ACCOUNTING_UNAVAILABLE' }, 503);
      const respond = () => {
        receipts.push(args);
        return json({ operationId: CLASSIFICATION, recorded: true, authoritative: true,
          promptTokens: 1020, outputTokens: 50, totalTokens: 1070,
          settledMicrousd: 953, releasedMicrousd: 249047 });
      };
      if (options.holdUsage) return new Promise(resolve => pendingUsage.push(() => resolve(respond())));
      return respond();
    }
    if (rpc === 'rpc_complete_qa_classification_service') {
      assert.equal(args.p_account_id, ACCOUNT); assert.equal(args.p_attempt_id, ATTEMPT);
      if (options.abortOnCompletion) { controller.abort(); return json({}); }
      current = { ...current, state: args.p_output.outcome === 'ALLOW' ? 'READY' : 'REJECTED',
        outcome: args.p_output.outcome, materiality: args.p_output.materiality,
        safeReasonCodes: args.p_output.safeReasonCodes, canCancel: args.p_output.outcome === 'ALLOW' };
      return json(current);
    }
    if (rpc === 'rpc_fail_qa_classification_service') {
      assert.equal(args.p_account_id, ACCOUNT);
      if (current.state === 'PROCESSING') current = { ...current, state: 'CANCELLED', canCancel: false };
      return json(null);
    }
    assert.fail('Unexpected RPC; no implicit release or additional paid attempt is allowed: ' + rpc);
  };
  const globals = {
    Deno: { env: { get: name => env[name] }, serve: value => { handler = value; } },
    fetch: fixtureFetch, crypto: webcrypto, setTimeout: timers.setTimeout, clearTimeout: timers.clearTimeout,
    console: { log() {}, warn() {}, error() {} },
    EdgeRuntime: options.noWaitUntil ? undefined : { waitUntil: promise => background.push(promise) },
  };
  // The production handler discovers EdgeRuntime on globalThis, exactly as Deno does.
  globals.globalThis = { EdgeRuntime: globals.EdgeRuntime };
  sourceLoader(globals)(ENTRY);
  const send = () => handler(new Request(ORIGIN + '/functions/v1/uskoci-qa-classify', {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: USER },
    body: JSON.stringify({ type: 'ASK', needId: NEED, needRevision: 1, questionId: null,
      text: QUESTION, clientRequestId: REQUEST }), signal: controller.signal,
  }));
  return { calls, background, receipts, pendingUsage, timers, controller, send,
    providerAttempts: () => attempts,
    usageCalls: () => calls.filter(call => call.path.endsWith('/rpc_ai_test_record_usage_service')),
    flush: () => Promise.all(background),
  };
}

test('QA records provider usage once for the exact reserved operation, including thinking/tool tokens', async () => {
  const h = harness(), response = await h.send();
  assert.equal(response.status, 200); assert.equal((await response.json()).state, 'COMMITTED');
  await h.flush();
  assert.equal(h.providerAttempts(), 1);
  assert.equal(h.usageCalls().length, 1);
  assert.equal(h.receipts.length, 1);
  assert.ok(h.calls.findIndex(c => c.path.endsWith('/rpc_ai_test_record_usage_service'))
    < h.calls.findIndex(c => c.path.endsWith('/rpc_complete_qa_classification_service')));
});

test('a policy-rejected response still records known usage and never submits the question', async () => {
  const h = harness({ output: { ...OUTPUT, outcome: 'BLOCK', safeReasonCodes: ['SYNTHETIC_BLOCK'] } });
  const response = await h.send(); assert.equal(response.status, 200);
  assert.equal((await response.json()).state, 'REJECTED');
  await h.flush();
  assert.equal(h.receipts.length, 1); assert.equal(h.providerAttempts(), 1);
  assert.equal(h.calls.some(c => c.path.endsWith('/rpc_submit_classified_preselection_qa')), false);
});

for (const invalid of [{ output: { ...OUTPUT, ruleIds: ['NOT_APPROVED'] } },
  { invalidJson: true }, { finishReason: 'MAX_TOKENS' }]) {
  test('invalid semantic output retains known usage: ' + JSON.stringify(invalid), async () => {
    const h = harness(invalid), response = await h.send();
    assert.equal(response.status, 502); await h.flush();
    assert.equal(h.receipts.length, 1); assert.equal(h.providerAttempts(), 1);
    assert.equal(h.calls.some(c => c.path.endsWith('/rpc_complete_qa_classification_service')), false);
  });
}

for (const [label, usage] of [
  ['missing', undefined], ['null', null],
  ['unexplained residual', { promptTokenCount: 1000, candidatesTokenCount: 30, totalTokenCount: 1070 }],
  ['negative', { ...USAGE, thoughtsTokenCount: -20 }],
  ['string count', { ...USAGE, promptTokenCount: '1000' }],
]) {
  test(label + ' usage remains unknown without blocking a valid classification or releasing its hold', async () => {
    const h = harness({ usage }), response = await h.send();
    assert.equal(response.status, 200); assert.equal((await response.json()).state, 'COMMITTED');
    await h.flush(); assert.equal(h.usageCalls().length, 0); assert.equal(h.providerAttempts(), 1);
  });
}

test('accounting refusal preserves the classification and does not retry provider or receipt', async () => {
  const h = harness({ usageFailure: true }), response = await h.send();
  assert.equal(response.status, 200); assert.equal((await response.json()).state, 'COMMITTED');
  await h.flush(); assert.equal(h.receipts.length, 0); assert.equal(h.usageCalls().length, 1);
  assert.equal(h.providerAttempts(), 1);
});

test('a lost accounting response has an independent bounded deadline and no retry', async () => {
  const h = harness({ holdUsage: true }), response = await h.send();
  assert.equal(response.status, 200); assert.equal((await response.json()).state, 'COMMITTED');
  assert.equal(h.usageCalls().length, 1);
  h.timers.fire(5000); await h.flush();
  assert.equal(h.receipts.length, 0); assert.equal(h.providerAttempts(), 1);
  assert.equal(h.usageCalls().length, 1);
  assert.equal(h.timers.active.size, 0);
});

test('caller abort after receiving usage does not cancel its accounting request', async () => {
  const h = harness({ holdUsage: true, abortOnCompletion: true }), response = await h.send();
  assert.equal(response.status, 502); assert.equal(h.controller.signal.aborted, true);
  assert.equal(h.usageCalls().length, 1);
  assert.equal(h.usageCalls()[0].signal.aborted, false);
  h.pendingUsage.shift()(); await h.flush();
  assert.equal(h.receipts.length, 1); assert.equal(h.providerAttempts(), 1);
});

test('same-key replay returns the existing classification without a second provider or usage request', async () => {
  const h = harness();
  assert.equal((await h.send()).status, 200); await h.flush();
  const response = await h.send();
  assert.equal(response.status, 200); assert.equal((await response.json()).state, 'COMMITTED');
  await h.flush(); assert.equal(h.providerAttempts(), 1); assert.equal(h.usageCalls().length, 1);
});

test('without EdgeRuntime lifetime extension the same bounded accounting request is awaited', async () => {
  const h = harness({ noWaitUntil: true }), response = await h.send();
  assert.equal(response.status, 200); assert.equal((await response.json()).state, 'COMMITTED');
  assert.equal(h.background.length, 0); assert.equal(h.receipts.length, 1);
  assert.equal(h.providerAttempts(), 1);
});

for (const options of [{ budgetRefused: true }, { dispatchRefused: true }, { wrongAccount: true }]) {
  test('no authorized provider operation means no usage or release write: ' + JSON.stringify(options), async () => {
    const h = harness(options), response = await h.send();
    assert.ok([409, 502, 503].includes(response.status));
    await h.flush(); assert.equal(h.providerAttempts(), 0); assert.equal(h.usageCalls().length, 0);
  });
}
for (const options of [{ providerHttpFailure: true }, { providerThrows: true }]) {
  test('no readable provider usage retains the hold: ' + JSON.stringify(options), async () => {
    const h = harness(options), response = await h.send();
    assert.equal(response.status, 502); await h.flush();
    assert.equal(h.providerAttempts(), 1); assert.equal(h.usageCalls().length, 0);
  });
}

