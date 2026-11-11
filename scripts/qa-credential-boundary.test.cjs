'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const { createClient } = require('@supabase/supabase-js');
const { spawnSync } = require('node:child_process');
const root = path.join(__dirname, '..');
const source = fs.readFileSync(path.join(__dirname, 'simulate_two_phones_e2e.mjs'), 'utf8');
const ast = ts.createSourceFile('fixture.mjs', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
const declaration = ast.statements.find(n => ts.isFunctionDeclaration(n) && n.name?.text === 'secretServiceFetch');
assert.ok(declaration);
const secret = 'sb_secret_<offline-test-only>';
const publicKey = 'sb_publishable_<offline-test-only>';

function serviceFetch(calls) {
  const fakeFetch = async (url, init) => {
    calls.push({ url: String(url), headers: new Headers(init?.headers) });
    return new Response('{"offline":true}', { status: 200, headers: { 'Content-Type': 'application/json' } });
  };
  return new Function('SERVICE_KEY', 'fetch', declaration.getText(ast) + '\nreturn secretServiceFetch;')(secret, fakeFetch);
}

test('historical admin fixture sends modern secret only as apikey through the installed SDK', async () => {
  const calls = [];
  const client = createClient('https://offline-fixture.invalid', secret, {
    auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: serviceFetch(calls) },
  });
  const { error } = await client.rpc('offline_probe', {});
  assert.equal(error, null);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].headers.get('apikey'), secret);
  assert.equal(calls[0].headers.has('Authorization'), false);
});

test('the narrow service transport does not strip a distinct explicit user authorization', async () => {
  const calls = [];
  await serviceFetch(calls)('https://offline-fixture.invalid', {
    headers: { apikey: publicKey, Authorization: 'Bearer offline-user-session' },
  });
  assert.equal(calls[0].headers.get('Authorization'), 'Bearer offline-user-session');
  assert.equal(calls[0].headers.get('apikey'), publicKey);
});

test('both historical QA scripts refuse missing environment credentials before a network operation', () => {
  const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith('QA_')
    && !['SUPABASE_SECRET_KEY', 'SUPABASE_SERVICE_ROLE_KEY'].includes(key)));
  for (const file of ['live_gemini_interview_test.mjs', 'simulate_two_phones_e2e.mjs']) {
    const result = spawnSync(process.execPath, [path.join(__dirname, file)], { cwd: root, env, encoding: 'utf8', timeout: 5000 });
    assert.equal(result.error, undefined);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /MISSING_QA_ENV:QA_REQUESTER_EMAIL|SUPABASE_SECRET_KEY/);
  }
});
