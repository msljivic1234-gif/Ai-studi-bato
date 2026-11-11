'use strict';
// Execute actual captured/changed SQL, not text-presence assertions. See fixture
// header for the deliberately bounded Auth/matching/RLS/native proof limits.
const test = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { createPriceFixture } = require('./r07-price-fixture.cjs');
let f, baselineMetadata, baselineHashes, legacy, legacyNeed, legacyAgreement,
  legacyProposal, legacySnapshot, oldSubmitKey, oldSelectKey, unresolved, unresolvedNeed, withdrawable, withdrawableNeed;
const propose = (id, patch, key = randomUUID(), version = 1) => f.value(
  'select public.rpc_propose_agreement_change_v2($1,$2,$3,$4,$5) as value', [id, version, patch, 'Dogovorena promena', key]);
const respond = (id, accept) => f.value('select public.rpc_respond_agreement_change($1,$2) as value', [id, accept]);

test.before(async () => {
  f = await createPriceFixture();
  baselineMetadata = await f.metadata(); baselineHashes = await f.hashes();
  await f.actor(f.WORKER);
  legacyNeed = await f.need('HOURLY'); oldSubmitKey = randomUUID();
  legacy = await f.submit(legacyNeed, 1200, 2, 1, oldSubmitKey);
  unresolvedNeed = await f.need('HOURLY'); unresolved = await f.submit(unresolvedNeed);
  withdrawableNeed = await f.need(null, null, 4, 'OFFERS'); withdrawable = await f.submit(withdrawableNeed, 1800);
  await f.actor(f.REQUESTER); oldSelectKey = randomUUID(); legacyAgreement = await f.select(legacyNeed, legacy, oldSelectKey);
  legacyProposal = await propose(legacyAgreement, { price_rsd: 1400 });
  legacySnapshot = await f.immutable(legacy.responseId);
});
test.after(async () => { if (f) await f.db.close(); });

test('current captured DEV rule reproduces ambiguous hourly unit and team-rate acceptance', async () => {
  const [row] = await f.rows(`select
    private.assert_application_price_v5(jsonb_populate_record(null::public.needs,'{"mode":"MY_PRICE","price_basis":"HOURLY","requester_price_rsd":1200,"required_slots":5}'),2,1200) as unit,
    private.assert_application_price_v5(jsonb_populate_record(null::public.needs,'{"mode":"MY_PRICE","price_basis":"HOURLY","requester_price_rsd":1200,"required_slots":5}'),2,2400) as team`);
  assert.ok(Object.hasOwn(row, 'unit') && Object.hasOwn(row, 'team'));
  assert.equal(await f.value('select price_basis as value from public.marketplace_responses where id=$1', [legacy.responseId]), null);
  const terms = await f.value('select terms as value from public.agreement_versions where agreement_id=$1', [legacyAgreement]);
  assert.equal(terms.priceBasis, undefined);
});

test('forward SQL refuses source drift, changed ACL and incompatible schema without partial changes', async () => {
  const price = f.capture.functions.find(x => x.name === 'private.assert_application_price_v5');
  for (const [sql, message] of [
    [price.definition.replace('\nbegin', '\nbegin -- deliberate drift'), 'R07B_SOURCE_OR_ACL_DRIFT'],
    ['grant execute on function public.rpc_submit_response(uuid,integer,uuid,integer,integer,timestamptz,timestamptz,text,text) to anon', 'R07B_SOURCE_OR_ACL_DRIFT'],
    ["alter table public.marketplace_responses alter column price_basis set default 'TOTAL'", 'R07B_PRICE_SCHEMA_DRIFT'],
  ]) {
    await f.db.exec('begin'); await f.db.exec(sql);
    await f.fails(() => f.db.exec(f.candidate), message); await f.db.exec('rollback');
    assert.deepEqual(await f.hashes(), baselineHashes); assert.deepEqual(await f.metadata(), baselineMetadata);
  }
});

test('the entire reviewed patch rolls back atomically and applies with unchanged OIDs, ACLs and old rows', async () => {
  await f.db.exec('begin'); await f.db.exec(f.candidate); await f.db.exec('rollback');
  assert.deepEqual(await f.hashes(), baselineHashes); assert.deepEqual(await f.metadata(), baselineMetadata);
  await f.db.exec(f.candidate);
  assert.deepEqual(await f.metadata(), baselineMetadata);
  assert.deepEqual(await f.immutable(legacy.responseId), legacySnapshot);
});

test('old committed submit and selection receipts replay before new price-unit guards', async () => {
  await f.db.query("update public.needs set price_basis='TOTAL',requester_price_rsd=7777,revision=revision+1 where id=$1", [legacyNeed]);
  await f.actor(f.WORKER);
  assert.deepEqual(await f.submit(legacyNeed, 1200, 2, 1, oldSubmitKey), { ...legacy, idempotentReplay: true });
  await f.actor(f.REQUESTER); assert.equal(await f.select(legacyNeed, legacy, oldSelectKey), legacyAgreement);
  assert.deepEqual(await f.immutable(legacy.responseId), legacySnapshot);
});

test('an unknown application unit stays unknown and cannot be selected or priced from the parent task', async () => {
  await f.actor(f.REQUESTER);
  for (const sql of ['select public.rpc_list_need_candidates($1) as value', 'select public.rpc_list_need_candidates_page($1) as value']) {
    const result = await f.value(sql, [unresolvedNeed]); const row = (Array.isArray(result) ? result : result.items)[0];
    assert.equal(row.applicationPriceBasis, null); assert.equal(row.canSelect, false); assert.equal(row.priceReviewRequired, true);
  }
  await f.fails(() => f.select(unresolvedNeed, unresolved), 'APPLICATION_PRICE_BASIS_REVIEW_REQUIRED');
  assert.equal(await f.value('select count(*)::integer as value from public.agreements where need_id=$1', [unresolvedNeed]), 0);
});

test('both own readers route an active unknown unit into explicit price review at the same task revision', async () => {
  await f.actor(f.WORKER);
  for (const sql of ['select public.rpc_list_my_applications() as value', "select public.rpc_list_my_applications_page('ATTENTION',100) as value"]) {
    const result = await f.value(sql); const row = (Array.isArray(result) ? result : result.items).find(x => x.applicationId === unresolved.responseId);
    assert.equal(row.applicationPriceBasis, null); assert.equal(row.state, 'STALE_REVIEW_REQUIRED');
    assert.equal(row.requiresStaleReview, true); assert.equal(row.priceReviewRequired, true);
    assert.equal(row.needRevision, row.submittedNeedRevision);
  }
  assert.equal(await f.value('select status as value from public.marketplace_responses where id=$1', [unresolved.responseId]), 'SUBMITTED');
});

test('unknown same-revision KEEP is refused while reviewed UPDATE creates one immutable, replayable version', async () => {
  await f.actor(f.WORKER);
  await f.fails(() => f.resolve(unresolved, 1, 'KEEP'), 'APPLICATION_PRICE_BASIS_REVIEW_REQUIRED');
  const key = randomUUID(); const fixed = await f.resolve(unresolved, 1, 'UPDATE', 1200, 2, key);
  assert.equal(fixed.applicationPriceBasis, 'HOURLY'); assert.equal(fixed.currency, 'RSD'); assert.equal(fixed.version, 2);
  assert.deepEqual(await f.resolve(unresolved, 1, 'UPDATE', 1200, 2, key), { ...fixed, idempotentReplay: true });
  assert.deepEqual(await f.rows('select version,price_rsd,price_basis,covered_slots from public.marketplace_response_versions where response_id=$1 order by version', [fixed.responseId]), [
    { version: 1, price_rsd: 1200, price_basis: null, covered_slots: 2 },
    { version: 2, price_rsd: 1200, price_basis: 'HOURLY', covered_slots: 2 },
  ]);
  await f.actor(f.REQUESTER); assert.ok(await f.select(unresolvedNeed, fixed));
});

test('unknown unit withdrawal works at the same revision without a ready worker profile', async () => {
  await f.actor(f.WORKER); await f.db.query("update public.app_profiles set profile_status='DRAFT' where id=$1", [f.PROFILE]);
  try {
    const key = randomUUID(), result = await f.resolve(withdrawable, 1, 'WITHDRAW', null, null, key);
    assert.equal(result.status, 'WITHDRAWN');
    assert.deepEqual(await f.resolve(withdrawable, 1, 'WITHDRAW', null, null, key), { ...result, idempotentReplay: true });
  } finally { await f.db.query("update public.app_profiles set profile_status='ACTIVE' where id=$1", [f.PROFILE]); }
});

for (const scenario of [
  { basis: 'HOURLY', amount: 1200, price: 1200, unit: 'HOURLY', required: 5 },
  { basis: 'TOTAL', amount: 1200, price: 600, unit: 'TOTAL', required: 4 },
  { basis: 'PER_PERSON', amount: 1200, price: 2400, unit: 'TOTAL', required: 4 },
  { basis: null, amount: null, price: 1800, unit: 'TOTAL', required: 4, mode: 'OFFERS' },
  { basis: 'TOTAL', amount: 10001, price: 4000, unit: 'TOTAL', required: 5 },
]) test(`${scenario.basis ?? scenario.mode}: amount, RSD, people and unit survive four readers, partial selection, Agreement and replay`, async () => {
  await f.actor(f.WORKER);
  const id = await f.need(scenario.basis, scenario.amount, scenario.required, scenario.mode), key = randomUUID();
  const receipt = await f.submit(id, scenario.price, 2, 1, key);
  assert.equal(receipt.applicationPriceBasis, scenario.unit); assert.equal(receipt.currency, 'RSD'); assert.equal(receipt.priceRsd, scenario.price);
  for (const sql of ['select public.rpc_list_my_applications() as value', "select public.rpc_list_my_applications_page('ALL',100) as value"]) {
    const result = await f.value(sql); const row = (Array.isArray(result) ? result : result.items).find(x => x.applicationId === receipt.responseId);
    assert.equal(row.applicationPriceBasis, scenario.unit); assert.equal(row.priceRsd, scenario.price); assert.equal(row.currency, 'RSD');
    assert.equal(row.applicationPriceMode, scenario.mode ?? 'MY_PRICE');
  }
  await f.actor(f.REQUESTER);
  for (const sql of ['select public.rpc_list_need_candidates($1) as value', 'select public.rpc_list_need_candidates_page($1) as value']) {
    const result = await f.value(sql, [id]); const row = (Array.isArray(result) ? result : result.items)[0];
    assert.equal(row.applicationPriceBasis, scenario.unit); assert.equal(row.priceRsd, scenario.price); assert.equal(row.currency, 'RSD');
    assert.equal(row.canSelect, true); assert.equal(row.coveredSlots, 2);
  }
  const selectKey = randomUUID(), agreement = await f.select(id, receipt, selectKey);
  const terms = await f.value('select terms as value from public.agreement_versions where agreement_id=$1', [agreement]);
  assert.equal(terms.price_rsd, scenario.price); assert.equal(terms.priceBasis, scenario.unit); assert.equal(terms.covered_slots, 2);
  assert.equal(terms.currency, 'RSD'); assert.equal(terms.required_slots, scenario.required); assert.equal(terms.pricingMode, scenario.mode ?? 'MY_PRICE');
  assert.equal(await f.value('select status as value from public.needs where id=$1', [id]), 'SELECTION');
  assert.equal(await f.select(id, receipt, selectKey), agreement);
  await f.actor(f.WORKER); assert.deepEqual(await f.submit(id, scenario.price, 2, 1, key), { ...receipt, idempotentReplay: true });
});

test('hourly multiplied price, invalid people, stale task and foreign ownership are refused without a response write', async () => {
  const id = await f.need('HOURLY'); await f.actor(f.WORKER);
  for (const [price, people, rev, error] of [[2400, 2, 1, 'FIXED_PRICE_MISMATCH'], [0, 2, 1, 'INVALID_PRICE'], [1200, 0, 1, 'INVALID_COVERED_SLOTS'], [1200, 5, 1, 'NEED_REMAINING_CAPACITY_EXCEEDED'], [1200, 2, 2, 'STALE_REVIEW_REQUIRED']]) {
    await f.fails(() => f.submit(id, price, people, rev), error);
  }
  await f.actor(null); await f.fails(() => f.submit(id), 'AUTH_REQUIRED');
  await f.actor(f.FOREIGN); await f.fails(() => f.submit(id), 'PROFILE_NOT_OWNED_BY_ACCOUNT');
  await f.actor(f.WORKER); await f.db.exec("set test.world_mismatch='true'");
  try { await f.fails(() => f.submit(id), 'NEED_NOT_FOUND'); } finally { await f.db.exec("set test.world_mismatch='false'"); }
  assert.equal(await f.value('select count(*)::integer as value from public.marketplace_responses where need_id=$1', [id]), 0);
});

test('unit changes alter the immutable content hash even if amount, people and task revision are identical', async () => {
  await f.actor(f.WORKER); const id = await f.need('HOURLY', 1200, 2), hourly = await f.submit(id);
  await f.db.query("update public.needs set price_basis='TOTAL' where id=$1", [id]);
  const total = await f.submit(id);
  assert.notEqual(hourly.contentHash, total.contentHash);
  assert.deepEqual(await f.rows('select version,price_basis from public.marketplace_response_versions where response_id=$1 order by version', [total.responseId]), [
    { version: 1, price_basis: 'HOURLY' }, { version: 2, price_basis: 'TOTAL' },
  ]);
});

test('stale KEEP cannot change a known unit and UPDATE needs a new confirmed version', async () => {
  await f.actor(f.WORKER); const id = await f.need('TOTAL', 1200, 2), first = await f.submit(id);
  await f.db.query("update public.needs set revision=2,price_basis='HOURLY' where id=$1", [id]);
  await f.db.query("update public.marketplace_responses set status='STALE_REVIEW_REQUIRED' where id=$1", [first.responseId]);
  await f.fails(() => f.resolve(first, 2, 'KEEP'), 'APPLICATION_PRICE_BASIS_CHANGED');
  const changed = await f.resolve(first, 2, 'UPDATE', 1200, 2); assert.equal(changed.applicationPriceBasis, 'HOURLY');
  await f.actor(f.REQUESTER); assert.ok(await f.select(id, changed));
});

test('known three-hour interval never converts the accepted rate into a team or job total', async () => {
  await f.actor(f.WORKER); const id = await f.need('HOURLY'), start = '2099-05-01T09:00:00Z', end = '2099-05-01T12:00:00Z';
  const receipt = await f.value('select public.rpc_submit_response($1,1,$2,2,1200,$3,$4,\'\',$5) as value', [id, f.PROFILE, start, end, randomUUID()]);
  await f.actor(f.REQUESTER); const agreement = await f.select(id, receipt);
  const terms = await f.value('select terms as value from public.agreement_versions where agreement_id=$1', [agreement]);
  assert.equal(terms.price_rsd, 1200); assert.equal(terms.priceBasis, 'HOURLY'); assert.equal(terms.covered_slots, 2);
  assert.equal((Date.parse(terms.proposed_end_at) - Date.parse(terms.proposed_start_at)) / 3600000, 3);
  assert.equal(terms.price_rsd * terms.covered_slots * 3, 7200);
});

test('new accepted Agreement changes preserve immutable unit, people and task coverage after parent edits', async () => {
  await f.actor(f.WORKER); const id = await f.need('HOURLY'), receipt = await f.submit(id);
  await f.actor(f.REQUESTER); const agreement = await f.select(id, receipt);
  const first = await f.value('select terms as value from public.agreement_versions where agreement_id=$1 and version=1', [agreement]);
  await f.db.query("update public.needs set price_basis='TOTAL',requester_price_rsd=9999,required_slots=1,revision=2 where id=$1", [id]);
  const proposalKey = randomUUID(), proposal = await propose(agreement, { price_rsd: 1400 }, proposalKey);
  assert.equal(await propose(agreement, { price_rsd: 1400 }, proposalKey), proposal);
  await f.actor(f.WORKER); const accepted = await respond(proposal, true); assert.equal(accepted.agreementVersion, 2);
  assert.deepEqual(await respond(proposal, true), accepted);
  const second = await f.value('select terms as value from public.agreement_versions where agreement_id=$1 and version=2', [agreement]);
  assert.deepEqual(second, { ...first, price_rsd: 1400 });
  assert.deepEqual(await f.value('select terms as value from public.agreement_versions where agreement_id=$1 and version=1', [agreement]), first);
});

test('legacy unknown Agreement proposals cannot be newly accepted or created, while rejection still works', async () => {
  await f.actor(f.WORKER);
  await f.fails(() => respond(legacyProposal, true), 'APPLICATION_PRICE_BASIS_REVIEW_REQUIRED');
  assert.equal((await respond(legacyProposal, false)).accepted, false);
  await f.fails(() => propose(legacyAgreement, { price_rsd: 1600 }), 'APPLICATION_PRICE_BASIS_REVIEW_REQUIRED');
  assert.equal(await f.value('select current_version as value from public.agreements where id=$1', [legacyAgreement]), 1);
});

test('a tampered pending proposal cannot change hourly basis, currency or headcount even with a new valid hash', async () => {
  for (const [patch, error] of [[{ priceBasis: 'TOTAL' }, 'APPLICATION_PRICE_BASIS_CHANGED'], [{ covered_slots: 1 }, 'CHANGE_TERMS_INVALID'], [{ currency: 'EUR' }, 'CHANGE_CURRENCY_INVALID']]) {
    await f.actor(f.WORKER); const id = await f.need('HOURLY'), receipt = await f.submit(id);
    await f.actor(f.REQUESTER); const agreement = await f.select(id, receipt), proposal = await propose(agreement, { price_rsd: 1400 });
    await f.db.query(`update public.agreement_change_proposals set proposed_terms=proposed_terms||$2::jsonb,
      content_hash=encode(extensions.digest(convert_to((proposed_terms||$2::jsonb)::text,'UTF8'),'sha256'),'hex') where id=$1`, [proposal, patch]);
    await f.actor(f.WORKER); await f.fails(() => respond(proposal, true), error);
    assert.equal(await f.value('select current_version as value from public.agreements where id=$1', [agreement]), 1);
    assert.equal((await respond(proposal, false)).accepted, false);
  }
});

test('known unit cannot bypass capacity, active profile, exact response hash or semantic idempotency checks', async () => {
  await f.actor(f.WORKER); const id = await f.need('HOURLY'), key = randomUUID(), receipt = await f.submit(id, 1200, 2, 1, key);
  await f.fails(() => f.submit(id, 1200, 1, 1, key), 'IDEMPOTENCY_KEY_REUSED');
  await f.actor(f.FOREIGN); await f.fails(() => f.select(id, receipt), 'NOT_REQUESTER');
  await f.actor(f.REQUESTER); await f.fails(() => f.select(id, { ...receipt, contentHash: 'a'.repeat(64) }), 'STALE_REVIEW_REQUIRED');
  await f.db.query("update public.app_profiles set profile_status='DRAFT' where id=$1", [f.PROFILE]);
  try { await f.fails(() => f.select(id, receipt), 'WORKER_PROFILE_NOT_READY'); }
  finally { await f.db.query("update public.app_profiles set profile_status='ACTIVE' where id=$1", [f.PROFILE]); }
  assert.ok(await f.select(id, receipt));
});

test('an indivisible three-person offer cannot fill only two remaining places', async () => {
  const secondAccount = randomUUID(), secondProfile = randomUUID();
  await f.db.query(`insert into public.app_profiles(id,account_id,kind,display_name,city,skills,profile_status)
    values($1,$2,'WORKER','Drugi test radnik','Novi Sad',array['Selidbe'],'ACTIVE')`, [secondProfile, secondAccount]);
  const id = await f.need('HOURLY', 1200, 5);
  await f.actor(f.WORKER); const first = await f.submit(id, 1200, 3);
  await f.actor(secondAccount); const second = await f.submit(id, 1200, 3, 1, randomUUID(), secondProfile);
  await f.actor(f.REQUESTER); await f.select(id, first);
  await f.fails(() => f.select(id, second), 'OVERFILL');
  assert.equal(await f.value('select public.fn_need_covered_slots($1) as value', [id]), 3);
  await f.actor(secondAccount); const revised = await f.submit(id, 1200, 2, 1, randomUUID(), secondProfile);
  await f.actor(f.REQUESTER); await f.select(id, revised);
  assert.equal(await f.value('select public.fn_need_covered_slots($1) as value', [id]), 5);
  assert.equal(await f.value('select status as value from public.needs where id=$1', [id]), 'ACTIVE');
});

const readResult = (id, price, people, revision, key, profile = f.PROFILE) => f.value(
  'select public.rpc_read_response_submit_result($1,$2,$3,$4,$5,null,null,\'\',$6) as value',
  [id, revision, profile, people, price, key]);

test('read-only receipt recovery returns original legacy and new outcomes without another submission', async () => {
  await f.actor(f.WORKER);
  const before = await f.immutable(legacy.responseId);
  const old = await readResult(legacyNeed, 1200, 2, 1, oldSubmitKey);
  assert.deepEqual(old, { found: true, authoritative: true, result: { ...legacy, idempotentReplay: true } });
  assert.equal(Object.hasOwn(old.result, 'applicationPriceBasis'), false);
  assert.deepEqual(await f.immutable(legacy.responseId), before);
  const id = await f.need('HOURLY'), key = randomUUID(), receipt = await f.submit(id, 1200, 2, 1, key);
  const snapshot = await f.immutable(receipt.responseId);
  assert.deepEqual(await readResult(id, 1200, 2, 1, key), { found: true, authoritative: true, result: { ...receipt, idempotentReplay: true } });
  assert.deepEqual(await f.immutable(receipt.responseId), snapshot);
});

test('receipt lookup never reveals another account and never writes on an absent key or changed payload', async () => {
  const before = await f.value('select count(*)::int as value from private.response_submit_commands');
  await f.actor(f.FOREIGN);
  assert.deepEqual(await readResult(legacyNeed, 1200, 2, 1, oldSubmitKey), { found: false, authoritative: true, result: null });
  await f.actor(f.WORKER);
  assert.deepEqual(await readResult(legacyNeed, 1200, 2, 1, randomUUID()), { found: false, authoritative: true, result: null });
  await f.fails(() => readResult(legacyNeed, 2400, 2, 1, oldSubmitKey), 'IDEMPOTENCY_KEY_REUSED');
  await f.actor(null); await f.fails(() => readResult(legacyNeed, 1200, 2, 1, oldSubmitKey), 'AUTH_REQUIRED');
  assert.equal(await f.value('select count(*)::int as value from private.response_submit_commands'), before);
});

test('new receipt reader grants only authenticated/service execution and remains owner-scoped under the real SQL role', async () => {
  await f.actor(f.WORKER); await f.db.exec('set role authenticated');
  try { assert.equal((await readResult(legacyNeed, 1200, 2, 1, oldSubmitKey)).found, true); }
  finally { await f.db.exec('reset role'); }
  await f.db.exec('set role anon');
  try { await f.fails(() => readResult(legacyNeed, 1200, 2, 1, oldSubmitKey), 'permission denied'); }
  finally { await f.db.exec('reset role'); }
});
