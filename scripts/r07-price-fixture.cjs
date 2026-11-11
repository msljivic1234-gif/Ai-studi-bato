'use strict';
// Bounded SQL execution of current R07 bodies. Actual captured columns, checks,
// versioning, price rules, hashes and receipts run in PGlite/PostgreSQL 18.
// Auth identity/world, matching/calendar, notifications and audit are explicit
// local substitutes. No claim of hosted PG17, RLS/PostgREST or native E2E.
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { PGlite } = require('@electric-sql/pglite');
const { pgcrypto } = require('@electric-sql/pglite/contrib/pgcrypto');
const capture = JSON.parse(readFileSync(path.join(__dirname, 'sql/r07b_price_snapshot_20261107.preimage.json'), 'utf8'));
const schema = JSON.parse(readFileSync(path.join(__dirname, 'sql/r07b_price_snapshot_20261107.fixture-schema.json'), 'utf8'));
const candidate = readFileSync(path.join(__dirname, 'sql/r07b_price_snapshot_20261107.sql'), 'utf8');

async function createPriceFixture() {
  const db = new PGlite({ extensions: { pgcrypto } });
  try {
    const rows = async (sql, args = []) => (await db.query(sql, args)).rows;
    const value = async (sql, args = []) => (await rows(sql, args))[0]?.value;
    const actor = id => value("select set_config('request.jwt.claim.sub',$1,false) as value", [id ?? '']);
    const ids = {
      WORKER: '11111111-1111-4111-8111-111111111111',
      REQUESTER: '22222222-2222-4222-8222-222222222222',
      FOREIGN: '33333333-3333-4333-8333-333333333333',
      PROFILE: '44444444-4444-4444-8444-444444444444',
      REQUESTER_PROFILE: '55555555-5555-4555-8555-555555555555',
    };
    await db.exec(`
      create schema private; create schema auth; create schema extensions;
      create role anon; create role authenticated; create role service_role;
      create extension pgcrypto with schema extensions;
      create function auth.uid() returns uuid language sql stable as $$
        select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      set check_function_bodies=off;
    `);
    for (const table of schema.tables) {
      const columns = table.columns.map(col => {
        // PostGIS is outside this monetary proof; this unused generated search
        // projection is the only column whose captured physical type is replaced.
        if (table.name === 'public.needs' && col.name === 'approx_geog') return 'approx_geog text';
        assert.equal(col.generated, '', `${table.name}.${col.name}`);
        return `"${col.name}" ${col.type}${col.default ? ` DEFAULT ${col.default}` : ''}${col.notNull ? ' NOT NULL' : ''}`;
      });
      await db.exec(`CREATE TABLE ${table.name} (${columns.join(',')});`);
      for (const constraint of table.constraints ?? []) {
        await db.exec(`ALTER TABLE ${table.name} ADD CONSTRAINT "${constraint.name}" ${constraint.definition};`);
      }
    }
    await db.exec(`
      create function private.accounts_same_world(uuid,uuid) returns boolean language sql stable as $$
        select current_setting('test.world_mismatch',true) is distinct from 'true' $$;
      create function private.need_search_time_admitted_v1(uuid,timestamptz) returns boolean language sql stable as $$select true$$;
      create function private.match_detail_for_calendar_interval(uuid,uuid,timestamptz,timestamptz) returns jsonb language sql stable as $$
        select jsonb_build_object('responseAllowed',current_setting('test.eligible',true) is distinct from 'false','hardBlockers','[]'::jsonb)$$;
      create function private.worker_remote_only_activation_ready_v1(uuid,text[]) returns boolean language sql stable as $$
        select current_setting('test.remote_ready',true)='true'$$;
      create function private.worker_calendar_conflict(uuid,timestamptz,timestamptz,uuid) returns boolean language sql stable as $$select false$$;
      create function private.application_calendar_conflict_v1(uuid) returns boolean language sql stable as $$select false$$;
      create function public.rpc_get_public_profile(uuid) returns jsonb language sql stable as $$select '{}'::jsonb$$;
      create function private.emit_event(uuid,text,text,text,uuid,integer,text,text,text,text default 'NORMAL',jsonb default '{}',timestamptz default null)
        returns void language plpgsql as $$begin end$$;
      create function private.enqueue_dispatch(uuid,timestamptz) returns void language plpgsql as $$begin end$$;
      create function private.audit_marketplace(uuid,text,text,uuid,integer,jsonb) returns void language plpgsql as $$begin end$$;
      create function public.fn_need_covered_slots(p_id uuid) returns integer language sql stable as $$
        select coalesce(sum(s.covered_slots),0)::integer from public.need_selections s where s.need_id=p_id and s.status='SELECTED'$$;
    `);
    for (const entry of [...capture.functions, ...capture.unchangedDependencies]) {
      await db.exec(entry.definition);
      if (entry.signature) {
        // Apply the exact observed per-function ACL order. These are fixture
        // roles, not grants issued to the remote project.
        const signature = entry.signature.replace('(needs,', '(public.needs,');
        await db.exec(`REVOKE ALL ON FUNCTION ${signature} FROM PUBLIC;`);
        for (const match of entry.acl.matchAll(/(?:\{|,)([a-z_]+)=X\//g)) {
          if (match[1] !== 'postgres') await db.exec(`GRANT EXECUTE ON FUNCTION ${signature} TO ${match[1]};`);
        }
      }
    }
    await db.query(`INSERT INTO public.app_profiles(id,account_id,kind,display_name,city,skills,profile_status)
      VALUES($1,$2,'WORKER','Test radnik','Novi Sad',array['Selidbe'],'ACTIVE'),
            ($3,$4,'REQUESTER','Test naručilac','Novi Sad','{}','ACTIVE')`,
    [ids.PROFILE, ids.WORKER, ids.REQUESTER_PROFILE, ids.REQUESTER]);
    await db.exec(`INSERT INTO private.connection_policy_versions(policy_key,version,beneficiary_role,activation_reason,charge_mode,unit_basis,platform_cost_rsd,policy_snapshot)
      VALUES('REQUESTER_SELECTION_V1',1,'REQUESTER','SELECTION','PROMOTIONAL_FREE','HEADCOUNT',0,
      '{"schema":"CONNECTION_POLICY_V1","policyKey":"REQUESTER_SELECTION_V1","version":1,"beneficiaryRole":"REQUESTER","activationReason":"SELECTION","chargeMode":"PROMOTIONAL_FREE","unitBasis":"HEADCOUNT","platformCostRsd":0}');`);
    const names = capture.functions.map(e => e.name);
    const hashes = () => rows(`select n.nspname||'.'||p.proname as name,md5(p.prosrc) as hash
      from pg_proc p join pg_namespace n on n.oid=p.pronamespace
      where n.nspname||'.'||p.proname=any($1::text[]) order by 1`, [names]);
    const metadata = () => rows(`select n.nspname||'.'||p.proname as name,to_jsonb(p)-'prosrc' as metadata
      from pg_proc p join pg_namespace n on n.oid=p.pronamespace
      where n.nspname||'.'||p.proname=any($1::text[]) order by 1`, [names]);
    const fails = (op, message) => assert.rejects(op, error => { assert.match(error.message, new RegExp(message)); return true; });
    const need = async (basis, amount = 1200, required = 4, mode = 'MY_PRICE') => {
      const id = randomUUID();
      await db.query(`insert into public.needs(id,requester_account_id,requester_profile_id,status,title,description,category,required_slots,mode,requester_price_rsd,price_basis)
        values($1,$2,$3,'PUBLISHED','Test zadatak','Sintetički cenovni slučaj','Selidbe',$4,$5,$6,$7)`,
      [id, ids.REQUESTER, ids.REQUESTER_PROFILE, required, mode, amount, basis]);
      return id;
    };
    const submit = (id, price = 1200, covered = 2, revision = 1, key = randomUUID(), profile = ids.PROFILE) => value(
      `select public.rpc_submit_response($1,$2,$3,$4,$5,null,null,'',$6) as value`, [id, revision, profile, covered, price, key]);
    const select = (id, receipt, key = randomUUID(), revision = receipt.needRevision) => value(
      `select public.rpc_select_response($1,$2,$3,$4,$5,$6) as value`, [id, revision, receipt.responseId, receipt.version, receipt.contentHash, key]);
    const resolve = (r, revision, action, price = null, covered = null, key = randomUUID()) => value(
      `select public.rpc_resolve_stale_response_after_need_edit($1,$2,$3,$4,$5,$6,$7,null,null,'') as value`,
      [r.responseId, r.version, revision, key, action, covered, price]);
    const immutable = responseId => value(`select jsonb_build_object(
      'response',(select to_jsonb(r) from public.marketplace_responses r where id=$1),
      'versions',(select jsonb_agg(to_jsonb(v) order by version) from public.marketplace_response_versions v where response_id=$1),
      'submit',(select jsonb_agg(to_jsonb(c) order by client_request_id) from private.response_submit_commands c where response_id=$1),
      'selections',(select jsonb_agg(to_jsonb(c) order by client_request_id) from private.selection_commands c where response_id=$1),
      'agreement',(select jsonb_agg(to_jsonb(v) order by v.version) from public.agreement_versions v join public.agreements a on a.id=v.agreement_id where a.selected_response_id=$1)
      ) as value`, [responseId]);
    return { db, rows, value, actor, ...ids, capture, candidate, hashes, metadata, fails, need, submit, select, resolve, immutable };
  } catch (error) { await db.close(); throw error; }
}
module.exports = { createPriceFixture, capture, candidate };
