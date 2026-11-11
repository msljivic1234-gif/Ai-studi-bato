'use strict';
/**
 * R10/F19: execute captured DEV SQL in an isolated PostgreSQL runtime.
 * The complete current snapshot and archive projectors run against synthetic
 * catalog-shaped tables, not rewritten SELECTs or mocked successful exports.
 * Table constraints/triggers/roles outside the private function boundary and
 * two unused PostGIS columns are not a full Supabase environment. No public
 * export request, legal policy, signing, Storage, Auth deletion or device flow
 * is activated or certified by this projection/redaction-helper proof.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { PGlite } = require('@electric-sql/pglite');
const { pgcrypto } = require('@electric-sql/pglite/contrib/pgcrypto');
const read = name => JSON.parse(fs.readFileSync(path.join(__dirname, 'sql', name), 'utf8'));
const captured = read('r10_work_areas_projection_20261107.preimage.json');
const dependencies = read('r10_work_areas_projection_20261107.dependencies.json');
const schema = read('r10_work_areas_projection_20261107.fixture-schema.json');
const functions = [...captured.functions, ...dependencies.functions];
const candidate = fs.readFileSync(path.join(__dirname, 'sql/r10_work_areas_projection_20261107.sql'), 'utf8');
const baselineOnly = process.env.USKOCI_R10_BASELINE_ONLY === '1';
const A = '10000000-0000-4000-8000-000000000001';
const B = '10000000-0000-4000-8000-000000000002';
const CA = '20000000-0000-4000-8000-000000000001';
const CB = '20000000-0000-4000-8000-000000000002';
const RA = '30000000-0000-4000-8000-000000000001';
const RB = '30000000-0000-4000-8000-000000000002';
const PA = '40000000-0000-4000-8000-000000000001';
const PB = '40000000-0000-4000-8000-000000000002';
const GA = '50000000-0000-4000-8000-000000000001';
const SNAP_A = '60000000-0000-4000-8000-000000000001';
const SNAP_B = '60000000-0000-4000-8000-000000000002';
const CUTOFF = '2026-11-07T16:00:00.000Z';
const COUNTRY = { kind: 'COUNTRY', countryCode: 'RS', label: 'Cela Srbija', city: null, sourceRef: null, latitude: null, longitude: null, radiusKm: null };
const CITY = { kind: 'CITY', countryCode: 'RS', label: 'Beograd', city: 'Beograd', sourceRef: 'osm:relation:10002', latitude: 44.82, longitude: 20.46, radiusKm: null };
const RADIUS = { kind: 'RADIUS', countryCode: 'RS', label: 'Novi Sad · do 30 km', city: 'Novi Sad', sourceRef: 'osm:node:10001', latitude: 45.26, longitude: 19.84, radiusKm: 30 };
const AREA_CASES = { COUNTRY: [COUNTRY], CITY: [CITY], RADIUS: [RADIUS], ORDERED_CITY_RADIUS: [RADIUS, CITY] };
const fields = ['city', 'countryCode', 'kind', 'label', 'latitude', 'longitude', 'radiusKm', 'sourceRef'];
const quote = value => '"' + value.replaceAll('"', '""') + '"';
const signature = fn => fn.signature || `${fn.name}(${fn.arguments.split(', ').filter(Boolean).map(arg => arg.slice(arg.indexOf(' ') + 1)).join(',')})`;
const body = fn => fn.definition.split('AS $function$')[1].split('$function$')[0];
const value = async (db, sql, args = []) => (await db.query(sql, args)).rows[0].value;
const source = name => functions.find(fn => fn.name === name);

async function fixture() {
  const db = new PGlite({ extensions: { pgcrypto } });
  try {
    await db.exec(`create schema private; create schema extensions; create schema storage;
      create role anon; create role authenticated; create role service_role;
      grant usage on schema private,public to anon,authenticated,service_role;
      create extension pgcrypto with schema extensions;
      set check_function_bodies=off;`);
    for (const table of schema.tables) {
      // These two unused geography fields are never populated or read by the
      // reviewed projectors. Geographic matching/PostGIS is outside this test.
      const columns = table.columns.map(c => `${quote(c.name)} ${c.type_schema === 'pg_catalog' ? c.data_type : 'text'}`);
      assert.ok(table.columns.every(c => c.type_schema === 'pg_catalog' || c.data_type === 'geography(Point,4326)'));
      await db.exec(`create table ${table.name} (${columns.join(',')}); revoke all on ${table.name} from public,anon,authenticated,service_role;`);
    }
    for (const fn of functions) {
      assert.equal(crypto.createHash('md5').update(body(fn)).digest('hex'), fn.body_md5, fn.name);
      assert.equal(fn.owner, 'postgres');
      assert.equal(fn.acl, '{postgres=X/postgres}', fn.name);
      await db.exec(fn.definition);
      await db.exec(`revoke all on function ${signature(fn)} from public,anon,authenticated,service_role;`);
    }
    await db.exec('set check_function_bodies=on;');
    return db;
  } catch (error) {
    await db.close(); throw error;
  }
}

const profile = areas => ({
  displayName: 'Sintetički profil', bio: 'Samo izolovana R10 provera', skills: ['Montaža'], tools: ['Alat'], vehicles: [], licenses: [], teamCapacity: 2,
  location: { operatingCountryCode: 'RS', city: 'Novi Sad', radiusKm: 30, approximatePosition: { latitude: 45.26, longitude: 19.84 } },
  availability: { timezone: 'Europe/Belgrade', availableNow: false, rules: [], windows: [] },
  workAreas: areas,
  privateLocation: { exactStreet: 'R10_PRIVATE_SENTINEL' },
  unapprovedProfileField: 'R10_PRIVATE_SENTINEL',
});

async function seed(db, areas = [RADIUS, CITY]) {
  await db.exec(`reset role; truncate ${schema.tables.map(x => x.name).join(',')};`);
  const a = profile(areas), b = { ...profile([COUNTRY]), displayName: 'Drugi nalog', privateNote: 'FOREIGN_SENTINEL' };
  await db.query('insert into public.app_accounts(id,full_name,created_at) values($1,$3,$5),($2,$4,$5)', [A, B, 'Nalog A', 'Nalog B', CUTOFF]);
  await db.query('insert into public.ai_conversations(id,account_id,purpose,status,created_at) values($1,$3,\'WORKER_PROFILE\',\'OPEN\',$5),($2,$4,\'WORKER_PROFILE\',\'OPEN\',$5)', [CA, CB, A, B, CUTOFF]);
  await db.query('insert into private.worker_ai_sessions(conversation_id,account_id,profile_id,candidate,revision,created_at) values($1,$3,$5,$7,1,$9),($2,$4,$6,$8,1,$9)', [CA, CB, A, B, PA, PB, a, b, CUTOFF]);
  await db.query('insert into private.worker_ai_reviews(id,account_id,conversation_id,revision,envelope,created_at) values($1,$3,$5,1,$7,$9),($2,$4,$6,1,$8,$9)', [RA, RB, A, B, CA, CB, { activate: false, profile: a }, { activate: false, profile: b }, CUTOFF]);
  await db.query('insert into private.worker_ai_saves(review_id,account_id,created_at) values($1,$3,$5),($2,$4,$5)', [RA, RB, A, B, CUTOFF]);
  const payload = (account, conversation, review, p) => ({
    worker_sessions: [{ account_id: account, conversation_id: conversation, profile_id: PA, revision: 1, candidate: p, created_at: CUTOFF }],
    worker_reviews: [{ account_id: account, id: review, conversation_id: conversation, revision: 1, envelope: { activate: false, profile: p, privateEnvelopeField: 'R10_PRIVATE_SENTINEL' }, created_at: CUTOFF }],
    worker_saves: [{ account_id: account, review_id: review, created_at: CUTOFF }],
    unapprovedSection: [{ exactStreet: 'R10_PRIVATE_SENTINEL' }],
  });
  const ownPayload = payload(A, CA, RA, a);
  // A mixed archived payload must still exclude an explicitly foreign row.
  ownPayload.worker_sessions.push(...payload(B, CB, RB, b).worker_sessions);
  ownPayload.worker_reviews.push(...payload(B, CB, RB, b).worker_reviews);
  await db.query('insert into private.dev_worker_profile_reset_snapshots_v1(backup_id,account_id,profile_id,backed_up_at,payload) values($1,$3,$5,$7,$8),($2,$4,$6,$7,$9)', [SNAP_A, SNAP_B, A, B, PA, PB, CUTOFF, ownPayload, payload(B, CB, RB, b)]);
}

async function binding(db) {
  const catalog = await value(db, 'select private.data_export_dataset_catalog() as value');
  // Synthetic input to the private projection only. This is not a policy row,
  // a public export grant, an approved lifetime, or a readiness bypass.
  return { policyId: 'ISOLATED_TEST_NOT_APPROVED', policyVersion: 'TEST', delivery: { datasets: catalog.map(row => ({ key: row.key, mode: 'INCLUDE', fields: row.fields })) } };
}
async function snapshotText(db, account = A) {
  return value(db, 'select private.data_export_snapshot($1,$2,$3,$4) as value', [account, GA, await binding(db), CUTOFF]);
}
async function snapshot(db, account = A) { return JSON.parse(await snapshotText(db, account)); }
const copies = data => ({
  liveDraft: data.datasets.workerAiDrafts[0].profile,
  liveReview: data.datasets.workerAiReviews[0].profile,
  archivedDraft: data.datasets.archivedWorkerReset[0].payload.worker_sessions[0].candidate,
  archivedReview: data.datasets.archivedWorkerReset[0].payload.worker_reviews[0].envelope.profile,
});
function withoutAreas(value) {
  if (Array.isArray(value)) return value.map(withoutAreas);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).filter(([key]) => key !== 'workAreas').map(([key, v]) => [key, withoutAreas(v)]));
  return value;
}
const projection = (db, input) => value(db, 'select private.data_export_worker_candidate_v5($1) as value', [input]);
const digest = db => value(db, 'select private.data_export_projection_sha_v5() as value');
const functionMetadata = db => value(db, `select jsonb_object_agg(s.signature,to_jsonb(p)-'prosrc') as value
  from unnest($1::text[]) s(signature) join pg_proc p on p.oid=to_regprocedure(s.signature)`, [functions.map(signature)]);
const state = db => value(db, `select jsonb_build_object(
  'drafts',(select jsonb_agg(to_jsonb(t) order by conversation_id) from private.worker_ai_sessions t),
  'reviews',(select jsonb_agg(to_jsonb(t) order by id) from private.worker_ai_reviews t),
  'saves',(select jsonb_agg(to_jsonb(t) order by review_id) from private.worker_ai_saves t),
  'archives',(select jsonb_agg(to_jsonb(t) order by backup_id) from private.dev_worker_profile_reset_snapshots_v1 t)) as value`);
const redaction = (db, relation, row, account = A) => value(db, 'select private.closure_redaction_patch_v5($1,$2,$3,$4) as value', [relation, row, account, GA]);

test('R10 preserves validated workAreas through the current own-account snapshot and reset archive', async t => {
  const db = await fixture();
  try {
    await seed(db);
    const before = await snapshot(db);
    const preDigest = await digest(db);
    const preMetadata = await functionMetadata(db);
    await t.test('captured DEV preimage reproduces the omission in all four current copy projections', async () => {
      assert.equal(preDigest, '46b8c6a4b4a7fb67bec0545cde68a6f92088810663695c0f3b09b195a090246e');
      assert.equal(Object.keys(copies(before)).length, 4);
      for (const item of Object.values(copies(before))) assert.equal(Object.hasOwn(item, 'workAreas'), false);
      assert.deepEqual((await state(db)).drafts[0].candidate.workAreas, [RADIUS, CITY]);
    });
    if (!baselineOnly) await db.exec(candidate);
    for (const [kind, areas] of Object.entries(AREA_CASES)) {
      await t.test(`${kind}: exact type, values and order survive live draft, review and both archive copies`, async () => {
        await seed(db, areas);
        const initial = await state(db);
        const exported = await snapshot(db);
        for (const item of Object.values(copies(exported))) {
          assert.deepEqual(item.workAreas, areas);
          for (const area of item.workAreas) assert.deepEqual(Object.keys(area).sort(), fields);
        }
        assert.deepEqual(await state(db), initial, 'export projection must be read-only');
        assert.equal(JSON.stringify(exported).includes('R10_PRIVATE_SENTINEL'), false);
        assert.equal(JSON.stringify(exported).includes('FOREIGN_SENTINEL'), false);
      });
    }
    await t.test('all pre-existing exported fields are unchanged; replayed private snapshots are identical', async () => {
      await seed(db);
      const text = await snapshotText(db);
      assert.deepEqual(withoutAreas(JSON.parse(text)), before);
      assert.equal(await snapshotText(db), text);
    });
    await t.test('another owner receives only their own live and archived copies', async () => {
      const a = await snapshot(db, A), b = await snapshot(db, B);
      assert.equal(a.datasets.workerAiDrafts.length, 1);
      assert.equal(a.datasets.workerAiReviews.length, 1);
      assert.equal(a.datasets.archivedWorkerReset.length, 1);
      assert.equal(a.datasets.archivedWorkerReset[0].payload.worker_sessions.length, 1);
      assert.equal(a.datasets.archivedWorkerReset[0].payload.worker_reviews.length, 1);
      assert.deepEqual(copies(b).liveDraft.workAreas, [COUNTRY]);
      assert.deepEqual(copies(a).liveDraft.workAreas, [RADIUS, CITY]);
      assert.equal(a.datasets.workerAiDrafts[0].conversationId, CA);
      assert.equal(b.datasets.workerAiDrafts[0].conversationId, CB);
    });
    await t.test('an inconsistent draft/review conversation owner cannot cross the existing ownership join', async () => {
      await db.query('update private.worker_ai_sessions set conversation_id=$2 where account_id=$1', [A, CB]);
      await db.query('update private.worker_ai_reviews set conversation_id=$2 where account_id=$1', [A, CB]);
      const exported = await snapshot(db, A);
      assert.deepEqual(exported.datasets.workerAiDrafts, []);
      assert.deepEqual(exported.datasets.workerAiReviews, []);
      await seed(db);
    });
    await t.test('a missing account produces no snapshot', async () => {
      assert.equal(await snapshotText(db, '10000000-0000-4000-8000-000000000099'), null);
    });
    await t.test('legacy profiles without workAreas export an empty array and invent no location', async () => {
      const old = profile([]); delete old.workAreas; delete old.location;
      const result = await projection(db, old);
      assert.deepEqual(result.workAreas, []);
      assert.equal(result.location.city, null);
      assert.equal(result.location.approximatePosition.latitude, null);
    });
    await t.test('extra private area fields are discarded while the valid allowed fields survive', async () => {
      const result = await projection(db, { workAreas: [{ ...CITY, exactAddress: 'R10_PRIVATE_SENTINEL', precisePosition: { latitude: 44.821234, longitude: 20.461234 } }] });
      assert.deepEqual(result.workAreas, [CITY]);
      assert.equal(JSON.stringify(result).includes('R10_PRIVATE_SENTINEL'), false);
      assert.deepEqual(Object.keys(result.workAreas[0]).sort(), fields);
    });
    const invalid = {
      missing_contract_field: [{ ...CITY, sourceRef: undefined }],
      unrounded_private_coordinates: [{ ...RADIUS, latitude: 45.261234 }],
      numeric_string_radius: [{ ...RADIUS, radiusKm: '30' }],
      unapproved_country: [{ ...CITY, countryCode: 'ME' }],
      wrong_kind: [{ ...CITY, kind: 'EXACT_ADDRESS' }],
      object_instead_of_array: CITY,
      null_instead_of_array: null,
      string_instead_of_array: 'Novi Sad',
      nonobject_array_entries: [null, 'Novi Sad', 30],
    };
    for (const [name, areas] of Object.entries(invalid)) {
      await t.test(`invalid ${name} is omitted without inventing replacement facts or rejecting the profile`, async () => {
        const result = await projection(db, { displayName: 'Sačuvano ime', workAreas: areas });
        assert.deepEqual(result.workAreas, []);
        assert.equal(result.displayName, 'Sačuvano ime');
      });
    }
    await t.test('mixed valid and invalid entries preserve the valid order across all live/archive copies', async () => {
      await seed(db, [RADIUS, null, { ...CITY, countryCode: 'XX' }, { ...CITY, privateAddress: 'R10_PRIVATE_SENTINEL' }, 42]);
      const initial = await state(db);
      const exported = await snapshot(db);
      for (const item of Object.values(copies(exported))) assert.deepEqual(item.workAreas, [RADIUS, CITY]);
      assert.equal(JSON.stringify(exported).includes('R10_PRIVATE_SENTINEL'), false);
      assert.deepEqual(await state(db), initial, 'tolerant export must not repair or rewrite the source copies');
      await seed(db);
    });
    await t.test('historical repeated entries are projected in order without turning export into a profile writer', async () => {
      assert.deepEqual((await projection(db, { workAreas: [CITY, CITY, COUNTRY] })).workAreas, [CITY, CITY, COUNTRY]);
    });
    await t.test('projection digest changes with this field and covers changes to its canonical validator', async () => {
      const current = await digest(db);
      assert.notEqual(current, preDigest);
      t.diagnostic(`R10_POSTIMAGE_PROJECTION_SHA256=${current}`);
      const validator = source('private.validate_worker_areas_v1');
      await db.exec(validator.definition.replace('AS $function$', 'AS $function$\n-- isolated validator drift probe\n'));
      assert.notEqual(await digest(db), current);
      await db.exec(validator.definition);
      assert.equal(await digest(db), current);
    });
    await t.test('only the existing projector and its dynamic dependency digest have changed', async () => {
      const changed = [];
      for (const fn of functions) if (await value(db, 'select md5(prosrc) as value from pg_proc where oid=to_regprocedure($1)', [signature(fn)]) !== fn.body_md5) changed.push(fn.name);
      assert.deepEqual(changed.sort(), ['private.data_export_projection_sha_v5', 'private.data_export_worker_candidate_v5']);
      assert.deepEqual(await functionMetadata(db), preMetadata, 'all metadata of all 20 existing dependencies must be unchanged');
    });
    for (const role of ['anon', 'authenticated', 'service_role']) {
      await t.test(`${role} cannot call the private candidate or snapshot projection directly`, async () => {
        try {
          await db.exec(`set role ${role}`);
          await assert.rejects(db.query('select private.data_export_worker_areas_v5($1)', [[CITY]]), error => error.code === '42501');
          await assert.rejects(projection(db, { workAreas: [CITY] }), error => error.code === '42501');
          await assert.rejects(db.query('select private.data_export_snapshot($1,$2,$3,$4)', [A, GA, {}, CUTOFF]), error => error.code === '42501');
        } finally { await db.exec('reset role'); }
      });
    }
    await t.test('existing worker-session redaction removes the entire candidate, including workAreas', async () => {
      const row = (await state(db)).drafts.find(x => x.account_id === A);
      const patch = await redaction(db, 'private.worker_ai_sessions', row);
      assert.deepEqual(patch, { operation: 'UPDATE', patch: { candidate: { erasedBy: 'AF-D22' } } });
      assert.equal(JSON.stringify({ ...row, ...patch.patch }).includes('workAreas'), false);
    });
    await t.test('existing worker-review redaction removes the entire signed envelope copy', async () => {
      const row = (await state(db)).reviews.find(x => x.account_id === A);
      const patch = await redaction(db, 'private.worker_ai_reviews', row);
      assert.deepEqual(patch, { operation: 'UPDATE', patch: { envelope: { erasedBy: 'AF-D22' } } });
      assert.equal(JSON.stringify({ ...row, ...patch.patch }).includes('workAreas'), false);
    });
    await t.test('the existing reset/archive redaction covers the entire payload with a delete instruction', async () => {
      const row = (await state(db)).archives.find(x => x.account_id === A);
      assert.equal(JSON.stringify(row).includes('workAreas'), true);
      assert.deepEqual(await redaction(db, 'private.dev_worker_profile_reset_snapshots_v1', row), { operation: 'DELETE', patch: {} });
      // This checks the actual redaction instruction, not a completed executor.
    });
    await t.test('an existing active conversation hold still prevents live draft/review redaction', async () => {
      await db.query('insert into private.retention_holds(id,account_id,conversation_id,active) values($1,$2,$3,true)', [GA, A, CA]);
      const rows = await state(db);
      assert.equal(await redaction(db, 'private.worker_ai_sessions', rows.drafts.find(x => x.account_id === A)), null);
      assert.equal(await redaction(db, 'private.worker_ai_reviews', rows.reviews.find(x => x.account_id === A)), null);
    });
    await t.test('unregistered redaction relations remain rejected', async () => {
      await assert.rejects(redaction(db, 'private.not_a_registered_copy', { id: RA }), error => /ERASURE_RELATION_NOT_ADMITTED/.test(error.message));
    });
  } finally { await db.close(); }
});

test('R10 forward candidate rejects unreviewed source and authority drift', async t => {
  const db = await fixture();
  try {
    const validator = source('private.validate_worker_areas_v1');
    await t.test('changed validator definition fails before changing the projection', async () => {
      await db.exec(validator.definition.replace('AS $function$', 'AS $function$\n-- isolated preimage drift\n'));
      await assert.rejects(db.exec(candidate), error => /R10_PROJECTION_PREIMAGE_MISMATCH:private.validate_worker_areas_v1/.test(error.message));
      await db.exec('rollback');
      assert.equal(await value(db, "select md5(prosrc) as value from pg_proc where oid='private.data_export_worker_candidate_v5(jsonb)'::regprocedure"), source('private.data_export_worker_candidate_v5').body_md5);
      await db.exec(validator.definition);
    });
    await t.test('unexpected public execute permission fails without silently repairing permissions', async () => {
      await db.exec('grant execute on function private.data_export_worker_candidate_v5(jsonb) to authenticated');
      await assert.rejects(db.exec(candidate), error => /R10_PROJECTION_METADATA_MISMATCH/.test(error.message));
      await db.exec('rollback');
      assert.equal(await value(db, "select has_function_privilege('authenticated','private.data_export_worker_candidate_v5(jsonb)','EXECUTE') as value"), true);
      await db.exec('revoke execute on function private.data_export_worker_candidate_v5(jsonb) from authenticated');
    });
    await t.test('postimage guards reject changed metadata of an otherwise unchanged dependency', async () => {
      const altered = candidate.replace('DO $r10_postimage$', 'ALTER FUNCTION private.closure_taxonomy_scope_v1(text) VOLATILE;\nDO $r10_postimage$');
      await assert.rejects(db.exec(altered), error => /R10_PROJECTION_DEPENDENCY_METADATA_CHANGED:private.closure_taxonomy_scope_v1/.test(error.message));
      await db.exec('rollback');
      assert.equal(await value(db, "select to_regprocedure('private.data_export_worker_areas_v5(jsonb)') is null as value"), true);
    });
    await t.test('postimage guards reject an unexpected adapter body and roll back its creation', async () => {
      const altered = candidate.replace('DECLARE item jsonb; area jsonb;', '-- unexpected adapter body drift\nDECLARE item jsonb; area jsonb;');
      await assert.rejects(db.exec(altered), error => /R10_PROJECTION_ADAPTER_POSTIMAGE_MISMATCH/.test(error.message));
      await db.exec('rollback');
      assert.equal(await value(db, "select to_regprocedure('private.data_export_worker_areas_v5(jsonb)') is null as value"), true);
    });
    await t.test('the exact reviewed candidate applies once and an accidental reapplication stops', async () => {
      await db.exec(candidate);
      await assert.rejects(db.exec(candidate), error => /R10_PROJECTION_ADAPTER_ALREADY_EXISTS/.test(error.message));
      await db.exec('rollback');
      assert.deepEqual((await projection(db, { workAreas: [COUNTRY] })).workAreas, [COUNTRY]);
    });
  } finally { await db.close(); }
});
