'use strict';
/** Execute captured DEV reservation/settlement SQL and its guarded forward candidate.
 * Synthetic accounts and closure dependencies only. PGlite serializes queued work;
 * this is not a claim of independent hosted sessions or provider billing accuracy.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { PGlite } = require('@electric-sql/pglite');
const capture = JSON.parse(fs.readFileSync(path.join(__dirname, 'sql/r06_budget_accounting_20261107.preimage.json'), 'utf8'));
const candidate = fs.readFileSync(path.join(__dirname, 'sql/r06_budget_accounting_20261107.sql'), 'utf8');
const A = '10000000-0000-4000-8000-000000000001';
const B = '10000000-0000-4000-8000-000000000002';
const C = '10000000-0000-4000-8000-000000000003';
const operation = index => `20000000-0000-4000-8000-${String(index).padStart(12, '0')}`;
const value = async (db, sql, args = []) => (await db.query(sql, args)).rows[0].value;
const reserve = (db, index = 1, account = A, kind = 'LLM') => value(db,
  'select public.rpc_ai_test_budget_reserve_service($1,$2,$3,$4) as value',
  [account, operation(index), kind, kind === 'LLM' ? 250000 : 200000]);
const usage = (db, index = 1, prompt = 1000, output = 200, model = 'gemini-3.8-flash') => value(db,
  'select public.rpc_ai_test_record_usage_service($1,$2,$3,$4,$5) as value',
  [operation(index), model, prompt, output, prompt + output]);
const release = (db, index = 1) => value(db,
  'select public.rpc_ai_test_release_unused_reservation_service($1) as value', [operation(index)]);
const audio = (db, index = 1, bytes = 32000 * 20, chars = 200) => value(db,
  'select public.rpc_ai_test_settle_audio_service($1,$2,$3) as value', [operation(index), bytes, chars]);
const row = (db, index = 1) => value(db,
  'select to_jsonb(r) as value from private.ai_test_reservations_v5 r where operation_id=$1', [operation(index)]);
const state = db => value(db, `select jsonb_build_object(
  'budget',(select to_jsonb(b) from private.ai_test_budget_v5 b where singleton),
  'reservations',(select coalesce(jsonb_agg(to_jsonb(r) order by r.operation_id),'[]') from private.ai_test_reservations_v5 r),
  'usage',(select coalesce(jsonb_agg(to_jsonb(u) order by u.operation_id),'[]') from private.ai_test_usage_v5 u),
  'accounts',(select coalesce(jsonb_agg(to_jsonb(a) order by a.account_id),'[]') from private.ai_test_accounts_v5 a)) as value`);
const balance = db => value(db, 'select reserved_microusd as value from private.ai_test_budget_v5 where singleton');
const assertLedger = async db => assert.equal(await balance(db), await value(db,
  'select coalesce(sum(coalesce(settled_microusd,max_cost_microusd)),0)::bigint as value from private.ai_test_reservations_v5'));
async function fixture() {
  const db = new PGlite();
  try {
    await db.exec(`create schema private; create schema auth;
      create role anon; create role authenticated; create role service_role;
      grant usage on schema auth,private,public to anon,authenticated,service_role;
      create table auth.users(id uuid primary key,deleted_at timestamptz);
      create table private.fixture_closed_accounts(id uuid primary key);
      create function auth.role() returns text language sql stable as $$
        select nullif(current_setting('request.jwt.claim.role',true),'') $$;
      create function private.closure_account_key(uuid) returns bigint language sql immutable as $$
        select hashtextextended($1::text,0) $$;
      create function private.closure_account_restricted(uuid) returns boolean language sql stable as $$
        select exists(select 1 from private.fixture_closed_accounts where id=$1) $$;`);
    for (const table of capture.tables) {
      const columns = table.columns.map(c => `"${c.column_name}" ${c.data_type}${c.default_expr ? ' default ' + c.default_expr : ''}${c.not_null ? ' not null' : ''}`);
      await db.exec(`create table ${table.name} (${columns.join(',')});`);
      for (const constraint of table.constraints) await db.exec(`alter table ${table.name} add constraint "${constraint.conname}" ${constraint.definition};`);
      await db.exec(`alter table ${table.name} enable row level security; revoke all on ${table.name} from public,anon,authenticated,service_role;`);
      assert.equal(table.triggers.length, 0);
    }
    for (const fn of capture.functions) {
      const body = fn.definition.split('AS $function$')[1].split('$function$')[0];
      assert.equal(crypto.createHash('md5').update(body).digest('hex'), fn.body_md5);
      await db.exec(fn.definition);
      await db.exec(`revoke all on function ${fn.signature} from public,anon,authenticated,service_role;`);
      if (fn.service_execute) await db.exec(`grant execute on function ${fn.signature} to service_role;`);
    }
    return db;
  } catch (error) { await db.close(); throw error; }
}
async function seed(db, enforced = false) {
  await db.exec(`reset role;
    truncate private.ai_test_budget_v5,private.ai_test_reservations_v5,private.ai_test_usage_v5,
      private.ai_test_accounts_v5,private.fixture_closed_accounts,auth.users;
    select set_config('request.jwt.claim.role','service_role',false);`);
  await db.query('insert into auth.users(id) values($1),($2),($3)', [A, B, C]);
  await db.query('insert into private.ai_test_accounts_v5(account_id) values($1),($2)', [A, B]);
  await db.query('insert into private.ai_test_budget_v5(singleton,enabled,reservation_cap_enforced) values(true,true,$1)', [enforced]);
}
async function metadata(db) {
  return value(db, `select jsonb_build_object('functions',(select jsonb_object_agg(
    p.oid::regprocedure::text,to_jsonb(p)-'prosrc') from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname in ('public','private') and p.proname like '%ai_test%'),
    'tables',(select jsonb_object_agg(c.relname,jsonb_build_object('owner',c.relowner,'acl',c.relacl,
      'rls',c.relrowsecurity,'forceRls',c.relforcerowsecurity)) from pg_class c join pg_namespace n on n.oid=c.relnamespace
      where n.nspname='private' and c.relname in ('ai_test_budget_v5','ai_test_accounts_v5','ai_test_reservations_v5','ai_test_usage_v5'))) as value`);
}

test('R06 enforces the existing global ceiling and settles actual SQL accounting once', async t => {
  const db = await fixture();
  try {
    await t.test('preimage admits new costs above the configured $5 ceiling with enforcement off', async () => {
      await seed(db);
      for (let i = 1; i <= 21; i++) assert.equal((await reserve(db, i, i % 2 ? A : B)).admitted, true);
      assert.equal(await balance(db), 5250000); await assertLedger(db);
      await assert.rejects(db.exec('update private.ai_test_budget_v5 set reservation_cap_enforced=true'), e => e.code === '23514');
    });
    await t.test('preimage loses a real usage charge that arrives after a no-usage release', async () => {
      await seed(db); await reserve(db, 1, A, 'STT'); await release(db);
      const reported = await usage(db);
      assert.equal(reported.recorded, true); assert.equal(reported.settledMicrousd, 0);
      assert.equal(await balance(db), 0); assert.equal((await row(db)).settlement_basis, 'FAILED_NO_USAGE');
    });
    await t.test('preimage keeps its duration estimate instead of later reported usage', async () => {
      await seed(db); await reserve(db, 1, A, 'STT'); const estimated = await audio(db);
      const reported = await usage(db, 1, 100000, 1000);
      assert.equal(reported.settledMicrousd, estimated.settledMicrousd);
      assert.equal((await row(db)).settlement_basis, 'AUDIO_DURATION_AT_PUBLISHED_RATE');
    });
    await t.test('preimage truncates a known priced usage amount at the reservation estimate', async () => {
      await seed(db); await reserve(db); const reported = await usage(db, 1, 1000000, 0);
      assert.equal(reported.settledMicrousd, 250000);
      assert.equal(await value(db, 'select private.ai_test_price_microusd(1000000,0) as value'), 750000);
    });
    await t.test('forward candidate activates the cap above it without resetting rows or amounts', async () => {
      await seed(db);
      for (let i = 1; i <= 21; i++) await reserve(db, i, i % 2 ? A : B);
      const before = await state(db), beforeMetadata = await metadata(db);
      await db.exec(candidate); const after = await state(db);
      assert.equal(after.budget.reservation_cap_enforced, true);
      before.budget.reservation_cap_enforced = true;
      assert.deepEqual(after, before); assert.deepEqual(await metadata(db), beforeMetadata);
      assert.deepEqual(await reserve(db, 22), { admitted: false, replay: false, reservationId: null, code: 'AI_TEST_BUDGET_EXHAUSTED' });
      assert.equal(await balance(db), 5250000); await assertLedger(db);
    });
    await t.test('one global ceiling covers both accounts and mixed LLM/STT costs', async () => {
      await seed(db, true);
      for (let i = 1; i <= 18; i++) await reserve(db, i, i % 2 ? A : B);
      await reserve(db, 19, A, 'STT'); await reserve(db, 20, B, 'STT');
      assert.equal(await balance(db), 4900000);
      for (const kind of ['LLM', 'STT']) assert.equal((await reserve(db, 21, B, kind)).code, 'AI_TEST_BUDGET_EXHAUSTED');
      assert.equal((await state(db)).reservations.length, 20); await assertLedger(db);
    });
    await t.test('the final allocation is granted once across queued requests from two accounts', async () => {
      await seed(db, true); for (let i = 1; i <= 19; i++) await reserve(db, i);
      const results = await Promise.all([reserve(db, 20, A), reserve(db, 21, B)]);
      assert.equal(results.filter(r => r.admitted).length, 1);
      assert.equal(results.filter(r => r.code === 'AI_TEST_BUDGET_EXHAUSTED').length, 1);
      assert.equal(await balance(db), 5000000); await assertLedger(db);
    });
    await t.test('disabled enforcement cannot bypass cost admission and expiry stays closed', async () => {
      for (const setting of ['reservation_cap_enforced=false', 'enabled=false', "price_valid_until='2000-01-01T00:00:00Z'"]) {
        await seed(db, true); await db.exec('update private.ai_test_budget_v5 set ' + setting);
        assert.equal((await reserve(db)).code, 'AI_TEST_BUDGET_NOT_READY');
        assert.equal((await state(db)).reservations.length, 0); assert.equal(await balance(db), 0);
      }
    });
    await t.test('unlisted, retired, deleted and closing accounts remain unable to reserve', async () => {
      for (const condition of ['unlisted', 'retired', 'deleted', 'closing']) {
        await seed(db, true);
        if (condition === 'retired') await db.query('update private.ai_test_accounts_v5 set retired_at=statement_timestamp() where account_id=$1', [A]);
        if (condition === 'deleted') await db.query('update auth.users set deleted_at=statement_timestamp() where id=$1', [A]);
        if (condition === 'closing') await db.query('insert into private.fixture_closed_accounts values($1)', [A]);
        assert.equal((await reserve(db, 1, condition === 'unlisted' ? C : A)).code, 'AI_TEST_ACCOUNT_NOT_ADMITTED');
        assert.equal(await balance(db), 0);
      }
    });
    await t.test('repeated operation is never admitted and conflicting identity cannot replace it', async () => {
      await seed(db, true); const first = await reserve(db); const before = await state(db);
      const replay = await reserve(db); assert.equal(replay.admitted, false); assert.equal(replay.replay, true);
      assert.equal(replay.reservationId, first.reservationId);
      await assert.rejects(reserve(db, 1, B), e => e.message === 'AI_TEST_OPERATION_CONFLICT');
      await assert.rejects(reserve(db, 1, A, 'STT'), e => e.message === 'AI_TEST_OPERATION_CONFLICT');
      assert.deepEqual(await state(db), before);
    });
    await t.test('unknown outcomes retain their full hold and cannot cause a second paid dispatch', async () => {
      await seed(db, true); await reserve(db);
      await db.exec("update private.ai_test_reservations_v5 set created_at=statement_timestamp()-interval '30 days'");
      const before = await state(db); assert.equal((await reserve(db)).admitted, false);
      assert.equal((await row(db)).settled_microusd, null); assert.equal(await balance(db), 250000);
      assert.deepEqual(await state(db), before);
    });
    await t.test('reported usage settles once and its exact replay leaves all rows unchanged', async () => {
      await seed(db, true); await reserve(db); const result = await usage(db);
      assert.equal(result.recorded, true); assert.equal(result.settledMicrousd, 1500); assert.equal(result.releasedMicrousd, 248500);
      assert.equal(await balance(db), 1500); const before = await state(db);
      const replay = await usage(db); assert.equal(replay.recorded, false); assert.equal(replay.releasedMicrousd, 0);
      assert.deepEqual(await state(db), before); await assertLedger(db);
      await assert.rejects(usage(db, 1, 1001), e => e.message === 'AI_USAGE_ALREADY_RECORDED');
      assert.deepEqual(await state(db), before);
    });
    await t.test('known unused release is once-only and never opens the same operation again', async () => {
      await seed(db, true); await reserve(db, 1, A, 'STT');
      assert.equal((await release(db)).released, true); assert.equal(await balance(db), 0);
      const before = await state(db); assert.equal((await release(db)).released, false);
      assert.equal((await reserve(db, 1, A, 'STT')).admitted, false); assert.deepEqual(await state(db), before); await assertLedger(db);
    });
    await t.test('late reported usage corrects a prior no-usage release without a second charge', async () => {
      await seed(db, true); await reserve(db, 1, A, 'STT'); await release(db);
      const result = await usage(db); assert.equal(result.settledMicrousd, 1500); assert.equal(result.releasedMicrousd, 0);
      assert.equal(await balance(db), 1500); assert.equal((await row(db)).settlement_basis, 'MEASURED');
      const before = await state(db); assert.equal((await usage(db)).recorded, false);
      assert.equal((await release(db)).released, false); assert.deepEqual(await state(db), before); await assertLedger(db);
    });
    await t.test('late provider usage supersedes either a higher or lower audio estimate and preserves measurements', async () => {
      for (const prompt of [1000, 100000]) {
        await seed(db, true); await reserve(db, 1, A, 'STT'); const estimated = await audio(db);
        const before = await row(db); const actual = await usage(db, 1, prompt, 200);
        assert.notEqual(actual.settledMicrousd, estimated.settledMicrousd);
        const after = await row(db); assert.equal(after.settlement_basis, 'MEASURED');
        assert.equal(after.measured_audio_bytes, before.measured_audio_bytes);
        assert.equal(after.measured_transcript_chars, before.measured_transcript_chars);
        assert.equal(await balance(db), actual.settledMicrousd);
        const settled = await state(db); assert.equal((await audio(db)).settled, false); assert.equal((await release(db)).released, false);
        assert.deepEqual(await state(db), settled); await assertLedger(db);
      }
    });
    await t.test('reported usage first prevents a later duration or unused receipt from changing it', async () => {
      await seed(db, true); await reserve(db, 1, A, 'STT'); await usage(db); const before = await state(db);
      assert.equal((await audio(db)).code, 'AI_AUDIO_SETTLE_USAGE_EXISTS');
      assert.equal((await release(db)).code, 'AI_RELEASE_REFUSED_USAGE_EXISTS');
      assert.deepEqual(await state(db), before); await assertLedger(db);
    });
    await t.test('known usage above its original estimate remains truthful and closes further admission', async () => {
      await seed(db, true); for (let i = 1; i <= 20; i++) await reserve(db, i);
      const result = await usage(db, 1, 1000000, 0);
      assert.equal(result.settledMicrousd, 750000); assert.equal(result.releasedMicrousd, 0);
      assert.equal(await balance(db), 5500000); assert.equal((await row(db)).settled_microusd, 750000);
      assert.equal((await reserve(db, 21)).code, 'AI_TEST_BUDGET_EXHAUSTED'); await assertLedger(db);
    });
    await t.test('duration accounting also does not silently truncate supplied measurements', async () => {
      await seed(db, true); await reserve(db, 1, A, 'STT'); const result = await audio(db, 1, 32000 * 120, 30000);
      assert.equal(result.settledMicrousd, 325500); assert.equal(result.releasedMicrousd, 0);
      assert.equal(await balance(db), 325500); await assertLedger(db);
    });
    await t.test('invalid usage, missing operations and wrong audio kind do not mutate the ledger', async () => {
      await seed(db, true); await reserve(db); const before = await state(db);
      await assert.rejects(usage(db, 1, -1), e => e.message === 'AI_USAGE_INPUT_INVALID');
      await assert.rejects(usage(db, 99), e => e.message === 'AI_USAGE_NO_RESERVATION');
      await assert.rejects(release(db, 99), e => e.message === 'AI_RELEASE_NO_RESERVATION');
      assert.equal((await audio(db)).code, 'AI_AUDIO_SETTLE_NOT_STT');
      assert.deepEqual(await state(db), before);
    });
    await t.test('settlement fields cannot be partially null or contain a negative amount', async () => {
      await seed(db, true); await reserve(db); const before = await state(db);
      for (const update of [
        "settled_microusd=null,settlement_basis='MEASURED',settled_at=statement_timestamp()",
        'settled_microusd=0,settlement_basis=null,settled_at=statement_timestamp()',
        "settled_microusd=0,settlement_basis='MEASURED',settled_at=null",
        "settled_microusd=-1,settlement_basis='MEASURED',settled_at=statement_timestamp()",
        "settled_microusd=0,settlement_basis='MADE_UP',settled_at=statement_timestamp()",
      ]) await assert.rejects(db.exec('update private.ai_test_reservations_v5 set ' + update), e => e.code === '23514');
      await assert.rejects(db.exec('update private.ai_test_budget_v5 set reserved_microusd=-1'), e => e.code === '23514');
      assert.deepEqual(await state(db), before);
    });
    await t.test('the service SQL role can use the bounded writer but cannot directly edit its ledger', async () => {
      await seed(db, true); await db.exec('set role service_role');
      try {
        assert.equal((await reserve(db)).admitted, true);
        await assert.rejects(db.exec('update private.ai_test_budget_v5 set reserved_microusd=0'), e => e.code === '42501');
        assert.equal((await usage(db)).settledMicrousd, 1500);
      } finally { await db.exec('reset role'); }
      assert.equal(await balance(db), 1500); await assertLedger(db);
    });
    await t.test('ordinary SQL roles cannot reserve or submit fabricated usage, release or audio receipts', async () => {
      await seed(db, true); await reserve(db); const before = await state(db);
      for (const role of ['anon', 'authenticated']) {
        await db.exec('set role ' + role);
        try {
          for (const action of [() => reserve(db, 2), () => usage(db), () => release(db), () => audio(db)])
            await assert.rejects(action(), e => e.code === '42501');
        } finally { await db.exec('reset role'); }
      }
      await db.exec("select set_config('request.jwt.claim.role','authenticated',false)");
      await assert.rejects(usage(db), e => e.message === 'SERVICE_ROLE_REQUIRED');
      await db.exec("select set_config('request.jwt.claim.role','service_role',false)");
      assert.deepEqual(await state(db), before); await assertLedger(db);
    });
    await t.test('stale reapplication is rejected atomically and cannot modify accounting', async () => {
      const before = await state(db), beforeMetadata = await metadata(db);
      await assert.rejects(db.exec(candidate), e => e.message === 'R06_BUDGET_SOURCE_OR_ACL_DRIFT');
      assert.deepEqual(await state(db), before); assert.deepEqual(await metadata(db), beforeMetadata);
    });
  } finally { await db.close(); }
});

test('R06 refuses activation against inconsistent prior accounting without a reset', async () => {
  const db = await fixture();
  try {
    await seed(db); await db.exec('update private.ai_test_budget_v5 set reserved_microusd=1');
    const before = await state(db), beforeMetadata = await metadata(db);
    await assert.rejects(db.exec(candidate), e => e.message === 'R06_BUDGET_LEDGER_MISMATCH');
    assert.deepEqual(await state(db), before); assert.deepEqual(await metadata(db), beforeMetadata);
  } finally { await db.close(); }
});

test('R06 refuses an unexpected public accounting grant without weakening it', async () => {
  const db = await fixture();
  try {
    await seed(db); await db.exec('grant execute on function public.rpc_ai_test_record_usage_service(uuid,text,integer,integer,integer) to authenticated');
    const before = await state(db), beforeMetadata = await metadata(db);
    await assert.rejects(db.exec(candidate), e => e.message === 'R06_BUDGET_SOURCE_OR_ACL_DRIFT');
    assert.deepEqual(await state(db), before); assert.deepEqual(await metadata(db), beforeMetadata);
  } finally { await db.close(); }
});
