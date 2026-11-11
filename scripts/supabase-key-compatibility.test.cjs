'use strict';
// Execute real Edge handlers and their real key helper. Only HTTP, provider
// sockets, identity fixtures and clocks are local seams; no hosted/paid call.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const { createHash, webcrypto } = require('node:crypto');

function fixtures(file, names, classes = false) {
  const filename = path.join(__dirname, file), source = fs.readFileSync(filename, 'utf8');
  const ast = ts.createSourceFile(filename, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  const declarations = ast.statements.filter(node => ts.isVariableStatement(node) || ts.isFunctionDeclaration(node)
    || (classes && ts.isClassDeclaration(node))).map(node => node.getText(ast)).join('\n');
  return new Function('require', '__dirname', declarations + '\nreturn {' + names.join(',') + '};')(require, __dirname);
}
const interview = fixtures('conversation-intent-integration.test.cjs', ['sourceLoader', 'handlerHarness', 'providerNeed', 'providerWorker']);
const speech = fixtures('speech-provider-accounting.test.cjs', ['harness'], true);
const media = fixtures('media-handler-admission.test.cjs', ['harness', 'request']);
const keys = interview.sourceLoader({})('supabase/functions/_shared/supabaseKeys.mjs');
const SECRET = 'sb_secret_fixture_default_01234567890123456789';
const PUBLIC = 'sb_publishable_fixture_default_01234567890123456789';
const OTHER_SECRET = 'sb_secret_fixture_named_01234567890123456789';
const LEGACY = 'synthetic.legacy_service_role.signature';
const LEGACY_PUBLIC = 'synthetic.legacy_anon.signature';
const USER_JWT = 'Bearer synthetic.ordinary_user.signature';
const ORIGIN = 'https://fixture-project.supabase.co';
const ACCOUNT = '11111111-1111-4111-8111-111111111111';
const RECEIPT = '22222222-2222-4222-8222-222222222222';
const GENERATION = '33333333-3333-4333-8333-333333333333';
const GRANT = '44444444-4444-4444-8444-444444444444';
const modernEnv = { SUPABASE_SECRET_KEYS: JSON.stringify({ named: OTHER_SECRET, default: SECRET }),
  SUPABASE_PUBLISHABLE_KEYS: JSON.stringify({ named: PUBLIC + '_other', default: PUBLIC }),
  SUPABASE_SERVICE_ROLE_KEY: undefined, SUPABASE_ANON_KEY: undefined };
const legacyEnv = { SUPABASE_SERVICE_ROLE_KEY: LEGACY, SUPABASE_ANON_KEY: LEGACY_PUBLIC };
const transitionEnv = { ...modernEnv, ...legacyEnv };
const get = env => name => env[name];
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const request = (body = {}, headers = {}) => new Request(ORIGIN + '/functions/v1/fixture', {
  method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body),
});
function serviceHeaders(actual, modern = true) {
  const h = new Headers(actual);
  assert.equal(h.get('apikey'), modern ? SECRET : LEGACY);
  assert.equal(h.get('authorization'), modern ? null : 'Bearer ' + LEGACY);
}
function userHeaders(actual, modern = true, jwt = USER_JWT) {
  const h = new Headers(actual);
  assert.equal(h.get('apikey'), modern ? PUBLIC : LEGACY_PUBLIC);
  assert.equal(h.get('authorization'), jwt);
}
function edge(name, env = modernEnv, respond = () => assert.fail('Unexpected HTTP request')) {
  let handler;
  const calls = [], logs = [], configured = { SUPABASE_URL: ORIGIN, ...env };
  const load = interview.sourceLoader({}, {
    Deno: { env: { get: get(configured) }, serve: value => { handler = value; } }, crypto: webcrypto,
    console: { warn: (...args) => logs.push(args), error: (...args) => logs.push(args), log: (...args) => logs.push(args) },
    fetch: async (input, init = {}) => {
      const url = new URL(input); assert.equal(url.origin, ORIGIN, 'No live/provider network can escape the fixture');
      const call = { path: url.pathname, method: init.method ?? 'GET', headers: new Headers(init.headers),
        args: typeof init.body === 'string' ? JSON.parse(init.body) : null, body: init.body };
      calls.push(call); return respond(call, calls);
    },
  });
  const module = load(name.startsWith('_shared/') ? 'supabase/functions/' + name : 'supabase/functions/' + name + '/index.ts');
  return { handler, module, calls, logs, load };
}

test('key configuration selects only the modern default; absent maps explicitly preserve legacy', () => {
  assert.equal(keys.readSupabaseServiceKey(get(transitionEnv)), SECRET);
  assert.equal(keys.readSupabasePublishableKey(get(transitionEnv)), PUBLIC);
  assert.equal(keys.readSupabaseServiceKey(get(legacyEnv)), LEGACY);
  assert.equal(keys.readSupabasePublishableKey(get(legacyEnv)), LEGACY_PUBLIC);
  assert.equal(keys.readSupabaseServiceKey(get({})), null);
  assert.equal(keys.readSupabasePublishableKey(get({})), null);
});

test('modern-only retirement switch closes both legacy directions while the explicit transition still works', () => {
  for (const value of [undefined, 'true']) {
    const env = { ...legacyEnv, USKOCI_LEGACY_SUPABASE_KEYS_ENABLED: value };
    assert.equal(keys.readSupabaseServiceKey(get(env)), LEGACY);
    assert.equal(keys.readSupabasePublishableKey(get(env)), LEGACY_PUBLIC);
    assert.equal(keys.isSupabaseServiceRequest({ Authorization: 'Bearer ' + LEGACY }, get(env)), true);
    assert.equal(keys.isSupabaseServiceRequest({ apikey: PUBLIC, Authorization: 'Bearer ' + LEGACY }, get({ ...transitionEnv, ...env })), true);
  }
  // Only an exact 'true' authorizes a present opt-in. Misspellings and empty
  // values cannot silently reopen the old credentials during retirement.
  for (const value of ['false', '', 'False', 'TRUE', '0', 'yes', null, false]) {
    const modernOnly = { ...transitionEnv, USKOCI_LEGACY_SUPABASE_KEYS_ENABLED: value };
    const noModern = { ...legacyEnv, USKOCI_LEGACY_SUPABASE_KEYS_ENABLED: value };
    assert.equal(keys.readSupabaseServiceKey(get(modernOnly)), SECRET);
    assert.equal(keys.readSupabasePublishableKey(get(modernOnly)), PUBLIC);
    assert.equal(keys.readSupabaseServiceKey(get(noModern)), null);
    assert.equal(keys.readSupabasePublishableKey(get(noModern)), null);
    assert.equal(keys.isSupabaseServiceRequest({ apikey: SECRET }, get(modernOnly)), true);
    for (const headers of [{ apikey: LEGACY }, { Authorization: 'Bearer ' + LEGACY },
      { apikey: PUBLIC, Authorization: 'Bearer ' + LEGACY }]) {
      assert.equal(keys.isSupabaseServiceRequest(headers, get(modernOnly)), false);
      assert.equal(keys.isSupabaseServiceRequest(headers, get(noModern)), false);
    }
  }
});

test('modern-only mode never falls back around an invalid modern map or promotes a public key', () => {
  for (const key of ['SUPABASE_SECRET_KEYS', 'SUPABASE_PUBLISHABLE_KEYS']) {
    const env = { ...transitionEnv, USKOCI_LEGACY_SUPABASE_KEYS_ENABLED: 'false', [key]: '{}' };
    assert.equal((key === 'SUPABASE_SECRET_KEYS' ? keys.readSupabaseServiceKey : keys.readSupabasePublishableKey)(get(env)), null);
    if (key === 'SUPABASE_SECRET_KEYS') for (const headers of [{ apikey: SECRET }, { apikey: LEGACY },
      { apikey: PUBLIC, Authorization: 'Bearer ' + LEGACY }]) assert.equal(keys.isSupabaseServiceRequest(headers, get(env)), false);
  }
  assert.equal(keys.isSupabaseServiceRequest({ apikey: PUBLIC, 'sb-api-key-compatibility': 'service_role' },
    get({ ...transitionEnv, USKOCI_LEGACY_SUPABASE_KEYS_ENABLED: 'false' })), false);
});

test('malformed, empty, wrong-role or unnamed modern maps fail closed despite a valid old key', () => {
  const bad = ['', '{', 'null', '[]', '42', '"secret"', '{}', JSON.stringify({ named: OTHER_SECRET }),
    JSON.stringify({ default: null }), JSON.stringify({ default: LEGACY }), JSON.stringify({ default: 'sb_secret_' }),
    JSON.stringify({ default: SECRET + '\n' }), ' '.repeat(65537)];
  for (const raw of bad) {
    assert.equal(keys.readSupabaseServiceKey(get({ ...transitionEnv, SUPABASE_SECRET_KEYS: raw })), null);
    assert.equal(keys.readSupabasePublishableKey(get({ ...transitionEnv, SUPABASE_PUBLISHABLE_KEYS: raw })), null);
    assert.equal(keys.isSupabaseServiceRequest({ apikey: LEGACY }, get({ ...transitionEnv, SUPABASE_SECRET_KEYS: raw })), false);
  }
  assert.equal(keys.readSupabaseServiceKey(get({ ...modernEnv, SUPABASE_SECRET_KEYS: JSON.stringify({ default: PUBLIC }) })), null);
  assert.equal(keys.readSupabasePublishableKey(get({ ...modernEnv, SUPABASE_PUBLISHABLE_KEYS: JSON.stringify({ default: SECRET }) })), null);
});

test('service header construction removes hidden Authorization without dropping Storage headers', () => {
  for (const extra of [new Headers({ AuThOrIzAtIoN: USER_JWT, apikey: PUBLIC, 'Content-Type': 'image/jpeg', 'x-upsert': 'false' }),
    { Authorization: USER_JWT, apikey: PUBLIC, 'Content-Type': 'image/jpeg', 'x-upsert': 'false' }]) {
    for (const modern of [true, false]) {
      const result = keys.supabaseServiceHeaders(modern ? SECRET : LEGACY, extra);
      serviceHeaders(result, modern);
      assert.equal(result['content-type'], 'image/jpeg'); assert.equal(result['x-upsert'], 'false');
    }
  }
  assert.throws(() => keys.supabaseServiceHeaders(PUBLIC), /SUPABASE_SERVICE_KEY_UNAVAILABLE/);
});

test('four actual cron handlers require configured-key possession and reject compatibility-header spoofing', async () => {
  const workers = ['uskoci-push-transport', 'uskoci-taxonomy-postsave-worker', 'uskoci-data-export-worker', 'uskoci-account-closure-worker'];
  for (const worker of workers) {
    const disabled = { ...transitionEnv, USKOCI_TAXONOMY_POSTSAVE_WORKER_ENABLED: 'false', USKOCI_TAXONOMY_CATALOG_ONLY_ACK: 'false' };
    for (const [headers, config, admitted] of [
      [{ apikey: SECRET }, { ...disabled, SUPABASE_SERVICE_ROLE_KEY: undefined, SUPABASE_ANON_KEY: undefined }, true],
      [{ apikey: SECRET }, disabled, true],
      [{ apikey: LEGACY }, disabled, true],
      [{ Authorization: 'Bearer ' + LEGACY }, disabled, true],
      [{ Authorization: 'Bearer ' + SECRET }, disabled, false],
      [{ apikey: OTHER_SECRET }, disabled, false],
      [{ apikey: PUBLIC, 'sb-api-key-compatibility': 'service_role' }, disabled, false],
      [{ 'sb-api-key-compatibility': 'service_role' }, disabled, false],
      [{ apikey: LEGACY }, { ...disabled, SUPABASE_SECRET_KEYS: '{}' }, false],
    ]) {
      const h = edge(worker, config, call => {
        if (call.path.endsWith('/rpc_claim_data_export')) return json({ kind: 'NONE' });
        if (call.path.endsWith('/rpc_claim_data_export_cleanup')) return json({ kind: 'NONE' });
        assert.fail('A disabled or unauthenticated worker must not perform I/O');
      });
      const result = await h.handler(request({ action: 'tick' }, headers));
      assert.equal(result.status === 200, admitted, worker);
      if (!admitted) { assert.ok([401, 403].includes(result.status), worker + ' refuses before I/O'); assert.equal(h.calls.length, 0); }
      else for (const call of h.calls) serviceHeaders(call.headers);
    }
  }
});

for (const worker of ['uskoci-push-transport', 'uskoci-taxonomy-postsave-worker', 'uskoci-data-export-worker', 'uskoci-account-closure-worker']) {
  test(`${worker}: modern-only admission rejects historical bearer even beside a valid publishable key`, async () => {
    for (const switchValue of ['false', 'TRUE']) {
      const env = { ...transitionEnv, USKOCI_LEGACY_SUPABASE_KEYS_ENABLED: switchValue,
        USKOCI_TAXONOMY_POSTSAVE_WORKER_ENABLED: 'false', USKOCI_TAXONOMY_CATALOG_ONLY_ACK: 'false' };
      for (const [headers, config, admitted] of [
        [{ apikey: SECRET }, env, true],
        [{ apikey: PUBLIC, Authorization: 'Bearer ' + LEGACY }, env, false],
        [{ Authorization: 'Bearer ' + LEGACY }, env, false],
        [{ apikey: LEGACY }, env, false],
        [{ apikey: PUBLIC, 'sb-api-key-compatibility': 'service_role' }, env, false],
        [{ apikey: SECRET }, { ...env, SUPABASE_SECRET_KEYS: undefined, SUPABASE_PUBLISHABLE_KEYS: undefined }, false],
        [{ Authorization: 'Bearer ' + LEGACY }, { ...env, SUPABASE_SECRET_KEYS: undefined, SUPABASE_PUBLISHABLE_KEYS: undefined }, false],
        [{ apikey: SECRET }, { ...env, SUPABASE_SECRET_KEYS: '{}' }, false],
      ]) {
        const h = edge(worker, config, call => {
          // Export also serves ordinary users. A JWT-shaped old credential may
          // reach Auth verification after internal admission is refused; it may
          // never reach a service RPC or Storage via modern outbound authority.
          if (call.path === '/auth/v1/user') {
            assert.equal(worker, 'uskoci-data-export-worker');
            userHeaders(call.headers, true, 'Bearer ' + LEGACY); return json({}, 401);
          }
          serviceHeaders(call.headers);
          if (call.path.endsWith('/rpc_claim_data_export') || call.path.endsWith('/rpc_claim_data_export_cleanup')) return json({ kind: 'NONE' });
          assert.fail('A disabled or unauthenticated worker must not perform I/O');
        });
        const result = await h.handler(request({ action: 'tick' }, headers));
        if (admitted) assert.equal(result.status, 200);
        else {
          assert.ok([401, 403, 503].includes(result.status), 'denied or unavailable before any privileged work');
          assert.ok(h.calls.length <= 1 && h.calls.every(call => call.path === '/auth/v1/user'),
            'retired credentials must not acquire the modern outbound authority');
        }
      }
    }
  });
}

test('actual push probe uses modern service apikey only and retains its readiness receipt', async () => {
  const h = edge('uskoci-push-transport', modernEnv, call => {
    assert.ok(call.path.endsWith('/rpc_record_push_readiness')); serviceHeaders(call.headers);
    return json({ recorded: true, observation: call.args.p_observation, observedAt: new Date().toISOString(), authoritative: true });
  });
  const response = await h.handler(request({ action: 'probe' }, { apikey: SECRET }));
  assert.deepEqual(await response.json(), { kind: 'READINESS_RECORDED', enabled: false });
  assert.equal(response.status, 200); assert.equal(h.calls.length, 1);
});

test('actual cron handlers retain the explicit legacy path while modern maps are absent', async () => {
  for (const worker of ['uskoci-push-transport', 'uskoci-taxonomy-postsave-worker', 'uskoci-data-export-worker', 'uskoci-account-closure-worker']) {
    const h = edge(worker, { ...legacyEnv, USKOCI_TAXONOMY_POSTSAVE_WORKER_ENABLED: 'false', USKOCI_TAXONOMY_CATALOG_ONLY_ACK: 'false' }, call => {
      serviceHeaders(call.headers, false);
      assert.ok(['/rest/v1/rpc/rpc_claim_data_export', '/rest/v1/rpc/rpc_claim_data_export_cleanup'].includes(call.path));
      return json({ kind: 'NONE' });
    });
    const r = await h.handler(request({ action: 'tick' }, { apikey: LEGACY }));
    assert.equal(r.status, 200, worker); assert.equal(h.calls.length, worker === 'uskoci-data-export-worker' ? 2 : 0);
  }
});

test('actual taxonomy tick and closure maintenance use modern service keys with existing authority gates', async () => {
  const taxonomy = edge('uskoci-taxonomy-postsave-worker', { ...modernEnv,
    USKOCI_TAXONOMY_POSTSAVE_WORKER_ENABLED: 'true', USKOCI_TAXONOMY_CATALOG_ONLY_ACK: 'true', USKOCI_TAXONOMY_BINDING_ENABLED: 'false' }, call => {
    serviceHeaders(call.headers);
    if (call.path.endsWith('/rpc_taxonomy_reconcile_reviewed_outbox_service')) return json(0);
    if (call.path.endsWith('/rpc_taxonomy_claim_reviewed_batches_service')) return json([]);
    assert.fail('No jobs authorize a commit or binding');
  });
  const t = await taxonomy.handler(request({}, { apikey: SECRET }));
  assert.equal(t.status, 200); assert.equal((await t.json()).capabilityAuthority, 'NONE'); assert.equal(taxonomy.calls.length, 2);
  const closure = edge('uskoci-account-closure-worker', { ...modernEnv, USKOCI_ACCOUNT_CLOSURE_WORKER_ENABLED: 'true' }, call => {
    serviceHeaders(call.headers); assert.ok(call.path.endsWith('/rpc_list_account_closure_work_service')); return json([]);
  });
  const c = await closure.handler(request({ action: 'maintenance', maxSteps: 1 }, { apikey: SECRET }));
  assert.equal(c.status, 200); assert.equal((await c.json()).checked, 0); assert.equal(closure.calls.length, 1);
});

test('real export Transport retains user JWT and strips stale Headers Authorization on modern Storage requests', async () => {
  for (const modern of [true, false]) {
    const h = edge('_shared/data-export.ts', modern ? modernEnv : legacyEnv, () => json({}));
    const t = new h.module.Transport(new AbortController().signal, request({}, { Authorization: USER_JWT }));
    assert.equal(t.isInternal(), false);
    const supplied = new Headers({ Authorization: 'Bearer stale-secret', apikey: 'stale', 'Content-Type': 'application/json', 'x-upsert': 'false' });
    await t.request('/storage/v1/object/data-export-artifacts/fixture', { method: 'POST', headers: supplied, body: '{}' }, true);
    serviceHeaders(h.calls[0].headers, modern);
    assert.equal(h.calls[0].headers.get('content-type'), 'application/json');
    assert.equal(h.calls[0].headers.get('x-upsert'), 'false');
    await t.request('/auth/v1/user', { headers: supplied });
    userHeaders(h.calls[1].headers, modern);
    assert.equal(supplied.get('authorization'), 'Bearer stale-secret', 'do not mutate caller-owned headers');
  }
});

test('actual ordinary export prepare remains POLICY_NOT_READY and never touches Storage', async () => {
  const h = edge('uskoci-data-export-worker', modernEnv, call => {
    if (call.path === '/auth/v1/user') { userHeaders(call.headers); return json({ id: ACCOUNT, role: 'authenticated' }); }
    if (call.path.endsWith('/rpc_get_data_export_status')) { userHeaders(call.headers); return json({ hasRequest: true, request: { receiptId: RECEIPT } }); }
    assert.ok(call.path.endsWith('/rpc_claim_data_export')); serviceHeaders(call.headers);
    assert.equal(call.args.p_account_id, ACCOUNT); return json({ kind: 'NOT_READY', code: 'EXPORT_POLICY_NOT_READY' });
  });
  const r = await h.handler(request({ action: 'prepare', receiptId: RECEIPT }, { Authorization: USER_JWT }));
  assert.equal(r.status, 200);
  assert.deepEqual(await r.json(), { receiptId: RECEIPT, kind: 'NOT_READY', code: 'POLICY_NOT_READY' });
  assert.equal(h.calls.length, 3);
});

function exportDownload(options = {}) {
  const payload = '{"fixture":true}', bytes = new TextEncoder().encode(payload), expires = new Date(Date.now() + 60000).toISOString();
  const target = { receiptId: RECEIPT, accountId: ACCOUNT, downloadGrantId: GRANT, artifactGeneration: GENERATION,
    expiresAt: expires, artifactExpiresAt: expires, bucket: 'data-export-artifacts', objectPath: `${ACCOUNT}/${RECEIPT}/${GENERATION}.json`,
    byteLength: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex'), md5: createHash('md5').update(bytes).digest('hex') };
  let resolves = 0;
  const h = edge('uskoci-data-export-download', modernEnv, call => {
    if (call.path === '/auth/v1/user') { userHeaders(call.headers); return json({ id: ACCOUNT, role: options.invalidRole ? 'service_role' : 'authenticated' }); }
    if (call.path.endsWith('/rpc_authorize_data_export_download')) { userHeaders(call.headers);
      return json({ receiptId: RECEIPT, downloadGrantId: GRANT, artifactGeneration: GENERATION, expiresAt: expires }); }
    serviceHeaders(call.headers);
    if (call.path.endsWith('/rpc_resolve_data_export_download')) {
      resolves++; assert.equal(call.args.p_account_id, ACCOUNT);
      return json(options.foreign ? { ...target, accountId: GRANT } : options.revoked && resolves > 1 ? null : target);
    }
    assert.equal(call.path, '/storage/v1/object/' + target.bucket + '/' + target.objectPath);
    return new Response(new Uint8Array(bytes));
  });
  return { ...h, payload, run: () => h.handler(request({ receiptId: RECEIPT, artifactGeneration: GENERATION }, { Authorization: USER_JWT })) };
}

test('actual private export download verifies owner, bytes and the final grant under modern keys', async () => {
  const h = exportDownload(), r = await h.run();
  assert.equal(r.status, 200); assert.equal(await r.text(), h.payload);
  assert.equal(h.calls.filter(c => c.path.endsWith('/rpc_resolve_data_export_download')).length, 2);
});

test('modern export keys never bypass ordinary Auth, foreign ownership or a revoked grant', async () => {
  for (const options of [{ invalidRole: true }, { foreign: true }, { revoked: true }]) {
    const h = exportDownload(options), r = await h.run();
    assert.ok([401, 409, 502].includes(r.status)); assert.notEqual(await r.text(), h.payload);
    if (!options.revoked) assert.equal(h.calls.some(c => c.path.startsWith('/storage/')), false);
  }
});

for (const domain of ['NEED', 'WORKER']) {
  test(`${domain} actual user JWT remains verified and separate from modern-only service authority`, async () => {
    const env = { ...transitionEnv, USKOCI_LEGACY_SUPABASE_KEYS_ENABLED: 'false' };
    const text = 'Koji je sledeći korak?', output = domain === 'NEED' ? interview.providerNeed('QUESTION', text) : interview.providerWorker('QUESTION', text);
    const result = await interview.handlerHarness(domain, text, output, { env }).run();
    assert.equal(result.events.at(-1).kind, 'final');
    assert.equal(result.calls.filter(call => call.url.includes('googleapis.com')).length, 1, 'single synthetic provider response');
    for (const call of result.calls.filter(call => !call.url.includes('googleapis.com'))) {
      if (call.name === 'user' || call.name === 'ai_conversations') userHeaders(call.headers, true, 'Bearer fixture-account-token');
      else serviceHeaders(call.headers);
    }
    const denied = await interview.handlerHarness(domain, text, output, { env, authDenied: true }).run();
    assert.equal(denied.events.some(event => event.kind === 'final'), false);
    assert.equal(denied.calls.some(call => call.name.startsWith('rpc_') || call.url.includes('googleapis.com')), false);
  });
  test(`${domain} actual interview preserves user JWT, service headers and one provider dispatch in both key regimes`, async () => {
    for (const modern of [true, false]) {
      const text = 'Koji je sledeći korak?', output = domain === 'NEED' ? interview.providerNeed('QUESTION', text) : interview.providerWorker('QUESTION', text);
      const result = await interview.handlerHarness(domain, text, output, { env: modern ? modernEnv : legacyEnv }).run();
      assert.equal(result.events.at(-1).kind, 'final'); assert.equal(result.writes.length, 1);
      const calls = result.calls.filter(c => !c.url.startsWith('https://generativelanguage.googleapis.com'));
      for (const call of calls) {
        if (call.name === 'user' || call.name === 'ai_conversations') userHeaders(call.headers, modern, 'Bearer fixture-account-token');
        else serviceHeaders(call.headers, modern);
      }
      assert.equal(result.calls.filter(c => c.name.endsWith(':streamGenerateContent')).length, 1);
      assert.equal(result.calls.filter(c => c.name === 'rpc_ai_test_budget_reserve_service').length, 1);
    }
  });
  test(`${domain} actual interview rejects malformed maps or refused Auth before any privileged or provider call`, async () => {
    for (const options of [{ env: { ...modernEnv, SUPABASE_PUBLISHABLE_KEYS: '{}' } },
      { env: { ...modernEnv, SUPABASE_SECRET_KEYS: '{}' } }, { env: modernEnv, authDenied: true }]) {
      const text = 'Pitanje', output = domain === 'NEED' ? interview.providerNeed('QUESTION', text) : interview.providerWorker('QUESTION', text);
      const result = await interview.handlerHarness(domain, text, output, options).run();
      assert.equal(result.events.some(e => e.kind === 'final'), false);
      assert.equal(result.calls.some(c => c.name.startsWith('rpc_') || c.url.includes('googleapis.com')), false);
    }
  });
}

test('actual speech Worker context, budget reserve and settlement use modern keys while retaining user ownership', async () => {
  for (const modern of [true, false]) {
    const h = await speech.harness({ env: modern ? modernEnv : legacyEnv, purpose: 'PROFILE' });
    try {
      assert.equal(h.response, h.upgraded); await h.ready(); h.audio(); h.release();
      h.upstream.receive({ serverContent: { inputTranscription: { text: 'Sintetički test.' }, generationComplete: true } });
      await h.drain();
      for (const call of h.requests) {
        if (call.path.startsWith('/rest/v1/rpc/')) serviceHeaders(call.headers, modern);
        else userHeaders(call.headers, modern, 'Bearer synthetic-ordinary-user');
      }
      assert.equal(h.calls('rpc_ai_test_settle_audio_service').length, 1);
      assert.equal(h.calls('rpc_ai_test_release_unused_reservation_service').length, 0);
    } finally { await h.finish(); }
  }
});

test('actual speech invalid key maps stop before Auth, budget reservation or WebSocket upgrade', async () => {
  for (const key of ['SUPABASE_SECRET_KEYS', 'SUPABASE_PUBLISHABLE_KEYS']) {
    const h = await speech.harness({ env: { ...modernEnv, [key]: '{}' } });
    try { assert.equal(h.response.status, 503); assert.equal(h.requests.length, 0); assert.equal(h.upgrades, 0); }
    finally { await h.finish(); }
  }
});

test('actual task and Agreement image uploads preserve Storage MIME and use modern service apikey only', async () => {
  for (const modern of [true, false]) for (const kind of ['TASK', 'PHOTO']) {
    const h = media.harness({ full: true, env: modern ? modernEnv : legacyEnv });
    const r = await h.decode(media.request(kind)); assert.equal(r.status, 200); assert.equal(h.posts.length, 1);
    for (const call of h.requests) {
      if (call.path === '/auth/v1/user') { assert.ok(call.headers.get('authorization').startsWith('Bearer ')); assert.equal(call.headers.get('apikey'), modern ? PUBLIC : LEGACY_PUBLIC); }
      else serviceHeaders(call.headers, modern);
      if (call.path.startsWith('/storage/') && call.method === 'POST') {
        assert.equal(call.headers.get('content-type'), 'image/jpeg'); assert.equal(call.headers.get('x-upsert'), 'false');
      }
    }
  }
});

test('actual media Auth denial or invalid modern config cannot claim an upload or reach Storage', async () => {
  for (const config of [{ env: modernEnv, authDenied: true }, { env: { ...modernEnv, SUPABASE_SECRET_KEYS: '{}' } },
    { env: { ...modernEnv, SUPABASE_PUBLISHABLE_KEYS: '{}' } }]) {
    const h = media.harness(config), result = await h.decode(media.request());
    assert.ok([401, 503].includes(result.status)); assert.equal(h.posts.length, 0); assert.equal(h.records.size, 0);
  }
});

test('actual QA replay reads with service authority but canonical submission retains the ordinary JWT', async () => {
  for (const modern of [true, false]) {
    const text = 'Da li odgovara termin?', hash = createHash('sha256').update(text).digest('hex');
    const state = { accountId: ACCOUNT, needId: RECEIPT, clientRequestId: GENERATION, classificationId: GRANT,
      type: 'ASK', needRevision: 1, questionId: null, textSha256: hash, state: 'READY', outcome: 'ALLOW', materiality: null,
      safeReasonCodes: [], canCancel: true, receipt: null, authoritative: true };
    const h = edge('uskoci-qa-classify', modern ? modernEnv : legacyEnv, call => {
      if (call.path === '/auth/v1/user') { userHeaders(call.headers, modern); return json({ id: ACCOUNT, role: 'authenticated' }); }
      if (call.path.endsWith('/rpc_claim_qa_classification_service')) { serviceHeaders(call.headers, modern); return json({ status: state, claim: null }); }
      assert.ok(call.path.endsWith('/rpc_submit_classified_preselection_qa')); userHeaders(call.headers, modern);
      assert.equal(call.args.p_expected_user_id, ACCOUNT); assert.equal(call.args.p_account_id, undefined);
      return json({ ...state, state: 'COMMITTED', canCancel: false,
        receipt: { questionId: GRANT, status: 'PENDING_ANSWER', needRevision: 1, idempotentReplay: false } });
    });
    const r = await h.handler(request({ type: 'ASK', needId: RECEIPT, needRevision: 1, questionId: null, text, clientRequestId: GENERATION }, { Authorization: USER_JWT }));
    assert.equal(r.status, 200); assert.equal((await r.json()).state, 'COMMITTED'); assert.equal(h.calls.length, 3);
  }
});

function publicationContext() {
  return { kind: 'READY', needId: RECEIPT, needRevision: 1, authoritativeDecision: false,
    binding: { needId: RECEIPT, needRevision: 1, schemaVersion: 'NEED_PUBLICATION_FINGERPRINT_V1', canonicalFingerprint: 'a'.repeat(64),
      privateMaterialityMarker: 'b'.repeat(64), taskCountryCode: 'RS', taskTimezone: 'Europe/Belgrade', policyBundleId: GRANT,
      policyId: 'TEST', policyVersion: 1, jurisdiction: 'RS', policyContentSha256: 'c'.repeat(64) },
    location: { mode: 'REMOTE', complete: true, missingSlots: [] },
    policy: { schemaVersion: 'USKOCI_PUBLICATION_POLICY_V1', instructions: 'Synthetic reviewed fixture.',
      rules: [{ ruleId: 'TEST', instructions: 'Synthetic only.', outcomes: ['ALLOW'], safeReasonCodes: [] }] },
    publicNeed: { title: 'Test', description: 'Sintetički zadatak.', category: 'Lektura', scheduleKind: 'REMOTE_ANYTIME', startsAt: null, endsAt: null,
      requiredSlots: 1, priceMode: 'OFFERS', requesterPriceRsd: null, requiredSkills: [], requiredTools: [], requiredVehicles: [], requiredLicenses: [],
      minimumExperienceYears: null, verifiedIdentityRequired: false, criticalConditions: [], publicMediaRefs: [],
      publicGeography: { executionLocationMode: 'REMOTE', approximateCity: null, approximateArea: null, approximateLat: null, approximateLng: null,
        topology: { mode: 'REMOTE' } } } };
}

test('actual publication evaluator keeps the owned-policy gate and budget refusal with either key regime', async () => {
  for (const modern of [true, false]) {
    const h = edge('uskoci-publication-evaluate', { ...(modern ? modernEnv : legacyEnv), GEMINI_API_KEY: 'fixture',
      GEMINI_MODEL: 'gemini-3.8-flash', AI_PROVIDER: 'gemini', USKOCI_GEMINI_PAID_TEST_ENABLED: 'true' }, call => {
      if (call.path === '/auth/v1/user') { userHeaders(call.headers, modern); return json({ id: ACCOUNT, role: 'authenticated' }); }
      if (call.path.endsWith('/rpc_get_need_publication_context')) { userHeaders(call.headers, modern); return json(publicationContext()); }
      assert.ok(call.path.endsWith('/rpc_ai_test_budget_reserve_service')); serviceHeaders(call.headers, modern);
      return json({ admitted: false, reservationId: null, replay: false, code: 'AI_TEST_BUDGET_EXHAUSTED' });
    });
    const r = await h.handler(request({ needId: RECEIPT, expectedRevision: 1 }, { Authorization: USER_JWT }));
    const body = await r.json(); assert.equal(body.kind, 'NOT_READY'); assert.equal(body.authoritativeDecision, false);
    assert.equal(h.calls.length, 3, 'budget refusal must not dispatch a provider or publication write');
  }
});

test('actual location search uses the modern public default and ordinary JWT, with no secret authority', async () => {
  const h = edge('uskoci-location-search', { ...modernEnv, SUPABASE_SERVICE_ROLE_KEY: undefined, SUPABASE_SECRET_KEYS: undefined }, call => {
    userHeaders(call.headers);
    if (call.path === '/auth/v1/user') return json({ id: ACCOUNT, role: 'authenticated' });
    assert.ok(call.path.endsWith('/rpc_list_location_markets'));
    return json([{ countryCode: 'RS', productStatus: 'BUILDING', defaultCurrencyCode: 'RSD', defaultLanguageTag: 'sr-Latn', defaultTimezone: 'Europe/Belgrade' }]);
  });
  const r = await h.handler(request({ text: 'Novi Sad', countryCode: 'RS' }, { Authorization: USER_JWT }));
  assert.equal(r.status, 503); assert.equal((await r.json()).code, 'PROVIDER_ACTIVATION_BLOCKED'); assert.equal(h.calls.length, 2);
});

test('publication, QA and location still reject non-user Auth and invalid public config before privileged work', async () => {
  const cases = [ ['uskoci-publication-evaluate', { needId: RECEIPT, expectedRevision: 1 }],
    ['uskoci-qa-classify', { type: 'ASK', needId: RECEIPT, needRevision: 1, questionId: null, text: 'Test?', clientRequestId: GENERATION }],
    ['uskoci-location-search', { text: 'Novi Sad', countryCode: 'RS' }] ];
  for (const [name, body] of cases) {
    const h = edge(name, modernEnv, call => { assert.equal(call.path, '/auth/v1/user'); return json({ id: ACCOUNT, role: 'service_role' }); });
    const rejected = await h.handler(request(body, { Authorization: USER_JWT }));
    assert.equal(rejected.status, 401); assert.equal(h.calls.length, 1);
    const invalid = edge(name, { ...modernEnv, SUPABASE_PUBLISHABLE_KEYS: '{}' });
    const result = await invalid.handler(request(body, { Authorization: USER_JWT }));
    if (name === 'uskoci-publication-evaluate') {
      assert.equal(result.status, 200);
      assert.deepEqual(await result.json(), { kind: 'NOT_READY', needId: RECEIPT, needRevision: 1, authoritativeDecision: false, code: 'EVALUATOR_UNAVAILABLE' });
    } else assert.equal(result.status, 503);
    assert.equal(invalid.calls.length, 0);
  }
});

test('taxonomy intake accepts a modern public default only after the existing DEV and paid-admission flags', () => {
  const { taxonomyIntakeEnabled } = interview.sourceLoader({})('supabase/functions/_shared/taxonomyRuntimeConfig.mjs');
  const env = { ...modernEnv, SUPABASE_ANON_KEY: undefined, SUPABASE_URL: 'https://leqcwgzvjsxugfgzdmth.supabase.co',
    USKOCI_TAXONOMY_DUAL_GEMINI: 'true', USKOCI_GEMINI_PAID_TEST_ENABLED: 'true', USKOCI_TAXONOMY_ROLLOUT_SCOPE: 'DEV',
    USKOCI_TAXONOMY_ALLOWED_PROJECT_REF: 'leqcwgzvjsxugfgzdmth' };
  assert.equal(taxonomyIntakeEnabled(get(env)), true);
  assert.equal(taxonomyIntakeEnabled(get({ ...env, SUPABASE_PUBLISHABLE_KEYS: '{}' })), false);
  assert.equal(taxonomyIntakeEnabled(get({ ...env, USKOCI_GEMINI_PAID_TEST_ENABLED: 'false' })), false);
  assert.equal(taxonomyIntakeEnabled(get({ ...env, USKOCI_TAXONOMY_ROLLOUT_SCOPE: 'PROD' })), false);
});
