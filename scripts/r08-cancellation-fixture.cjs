'use strict';
// Bounded PostgreSQL execution: actual captured R08 writers, calendar, ordinary
// message guards, event/delivery guards and sender export/redaction predicates.
// Auth is a local identity stub; no hosted JWT/RLS, full closure execution,
// group-chat, media-upload, dispatch-provider, or native E2E claim is made.
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { PGlite } = require('@electric-sql/pglite');
const { pgcrypto } = require('@electric-sql/pglite/contrib/pgcrypto');
const stem = 'r08_agreement_cancellation_20261107';
const capture = JSON.parse(readFileSync(path.join(__dirname, `sql/${stem}.preimage.json`), 'utf8'));
const schema = JSON.parse(readFileSync(path.join(__dirname, `sql/${stem}.fixture-schema.json`), 'utf8'));
const triggerCapture = JSON.parse(readFileSync(path.join(__dirname, `sql/${stem}.triggers.json`), 'utf8'));
const candidate = readFileSync(path.join(__dirname, `sql/${stem}.sql`), 'utf8');
const allFunctions = [...capture.functions, ...capture.unchangedDependencies];

async function createCancellationFixture() {
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
      create function auth.role() returns text language sql stable as $$
        select coalesce(nullif(current_setting('request.jwt.claim.role',true),''),'authenticated') $$;
      set check_function_bodies=off;
    `);
    for (const table of schema.tables) {
      const columns = table.columns.map(col => {
        // Unused PostGIS search projection is outside this cancellation proof.
        if (table.name === 'public.needs' && col.name === 'approx_geog') return 'approx_geog text';
        assert.equal(col.generated, '', `${table.name}.${col.name}`);
        return `"${col.name}" ${col.type}${col.default ? ` DEFAULT ${col.default}` : ''}${col.notNull ? ' NOT NULL' : ''}`;
      });
      await db.exec(`CREATE TABLE ${table.name} (${columns.join(',')});`);
      for (const constraint of table.constraints ?? []) {
        await db.exec(`ALTER TABLE ${table.name} ADD CONSTRAINT "${constraint.name}" ${constraint.definition};`);
      }
    }
    // These empty dependency shapes are parsed by unrelated short-circuit
    // branches of the exact redaction function. No AI row is inserted or tested.
    await db.exec(`
      create table private.retention_holds(account_id uuid,active boolean,conversation_id uuid);
      create table private.ai_task_reviews(id uuid,account_id uuid,conversation_id uuid);
      create table private.worker_ai_reviews(id uuid,account_id uuid,conversation_id uuid);
      create table private.fixture_dispatch_calls(need_id uuid,at_time timestamptz);
      create function private.closure_redaction_allowed_v5(oid,text,jsonb,jsonb)
        returns boolean language sql stable as $$select false$$;
    `);
    for (const entry of allFunctions) {
      if (entry.name === 'private.enqueue_dispatch') continue;
      await db.exec(entry.definition);
      await db.exec(`REVOKE ALL ON FUNCTION ${entry.signature} FROM PUBLIC;`);
      for (const match of entry.acl.matchAll(/(?:\{|,)([a-z_]+)=X\//g)) {
        if (match[1] !== 'postgres') await db.exec(`GRANT EXECUTE ON FUNCTION ${entry.signature} TO ${match[1]};`);
      }
    }
    await db.exec(`create function private.enqueue_dispatch(p_need_id uuid,p_at timestamptz)
      returns void language sql as $$insert into private.fixture_dispatch_calls values(p_need_id,p_at)$$;`);
    const included = t =>
      t.tgname.startsWith('pre_v3_') ||
      t.tgname.endsWith('_set_updated_at') ||
      ['agreement_calendar_sync', 'agreement_version_calendar_sync',
        'chat_b3c_invalidation_after_message', 'chat_b3c_invalidation_lifecycle',
        'guard_closed_remaining_search_response_trg',
        'agreement_photo_link_guard_v5', 'agreement_photo_message_guard_v5',
        'agreement_voice_link_guard_v1', 'agreement_voice_message_guard_v1'].includes(t.tgname);
    const executedTriggers = triggerCapture.triggers.filter(included);
    for (const trigger of executedTriggers) {
      assert.equal(trigger.tgenabled, 'O');
      await db.exec(trigger.definition);
    }
    // Only FKs whose complete endpoints belong to this bounded fixture are
    // included. Full cross-domain FK/RLS equivalence is deliberately not claimed.
    let foreignKeys = 0;
    for (const table of schema.tables) {
      for (const constraint of table.foreignkeys ?? []) {
        const target = constraint.definition.match(/REFERENCES ([a-z_]+(?:\.[a-z_]+)?)/)?.[1];
        const targetName = target?.includes('.') ? target : `public.${target}`;
        if (schema.tables.some(t => t.name === targetName)) {
          await db.exec(`ALTER TABLE ${table.name} ADD CONSTRAINT "${constraint.name}" ${constraint.definition};`);
          foreignKeys++;
        }
      }
    }
    await db.query(`insert into public.app_accounts(id,email) values
      ($1,'requester@invalid.example'),($2,'worker@invalid.example'),($3,'foreign@invalid.example')`,
    [ids.REQUESTER, ids.WORKER, ids.FOREIGN]);
    await db.query(`insert into public.app_profiles(id,account_id,kind,display_name,city,skills,profile_status)
      values($1,$2,'WORKER','Test radnik','Novi Sad',array['Selidbe'],'ACTIVE'),
      ($3,$4,'REQUESTER','Test naručilac','Novi Sad','{}','ACTIVE')`,
    [ids.PROFILE, ids.WORKER, ids.REQUESTER_PROFILE, ids.REQUESTER]);
    const fails = (op, message) => assert.rejects(op, error => {
      assert.match(error.message, new RegExp(message)); return true;
    });
    let sequence = 0;
    const agreement = async (options = {}) => {
      const id = randomUUID(), response = randomUUID(), selection = randomUUID();
      const need = options.need ?? randomUUID();
      sequence++;
      const date = new Date(Date.UTC(2030, 0, 1 + sequence));
      const start = options.start ?? date.toISOString();
      const end = options.end ?? new Date(date.getTime() + 3600000).toISOString();
      const terms = { price_rsd: 1200, priceBasis: 'HOURLY', currency: 'RSD', pricingMode: 'MY_PRICE',
        covered_slots: options.covered ?? 2, required_slots: options.required ?? 5,
        scope_note: 'Sintetički R08 primer', ...options.terms };
      if (!options.noInterval) { terms.proposed_start_at = start; terms.proposed_end_at = end; }
      if (!options.need) {
        await db.query(`insert into public.needs(id,requester_account_id,requester_profile_id,status,title,description,category,required_slots,mode,price_basis,requester_price_rsd)
          values($1,$2,$3,'ACTIVE','Sintetički R08 zadatak','Isključivo lokalni SQL fixture','Selidbe',$4,'MY_PRICE','HOURLY',1200)`,
        [need, ids.REQUESTER, ids.REQUESTER_PROFILE, options.required ?? 5]);
      }
      await db.query(`insert into public.marketplace_responses(id,need_id,worker_account_id,worker_profile_id,response_kind,status,submitted_against_need_revision,covered_slots,price_rsd,price_basis,selected_at)
        values($1,$2,$3,$4,'APPLICATION','SELECTED',1,$5,1200,'HOURLY',statement_timestamp())`,
      [response, need, ids.WORKER, ids.PROFILE, options.covered ?? 2]);
      await db.query(`insert into public.need_selections(id,need_id,need_revision,selected_by_account_id,client_request_id,covered_slots,response_id,worker_account_id,worker_profile_id,selection_mode)
        values($1,$2,1,$3,$4,$5,$6,$7,$8,'REQUESTER_SELECTS')`,
      [selection, need, ids.REQUESTER, randomUUID(), options.covered ?? 2, response, ids.WORKER, ids.PROFILE]);
      await db.query(`insert into public.agreements(id,need_id,selection_id,selected_response_id,requester_account_id,requester_profile_id,worker_account_id,worker_profile_id)
        values($1,$2,$3,$4,$5,$6,$7,$8)`,
      [id, need, selection, response, ids.REQUESTER, ids.REQUESTER_PROFILE, ids.WORKER, ids.PROFILE]);
      await db.query(`insert into public.agreement_versions(agreement_id,version,status,terms,content_hash,created_by_account_id)
        values($1,1,'CONFIRMED',$2,$3,$4)`, [id, terms, 'a'.repeat(64), ids.REQUESTER]);
      await db.query(`insert into public.agreement_execution(agreement_id,agreement_version) values($1,1)`, [id]);
      await db.query(`insert into public.access_grants(agreement_id,channel,granted_by_account_id,granted_to_account_id)
        values($1,'EXACT_LOCATION',$2,$3)`, [id, ids.REQUESTER, ids.WORKER]);
      return { id, need, response, selection, terms, start, end };
    };
    const cancel = (a, reason = 'Promenili su se uslovi.') => value('select public.rpc_cancel_agreement($1,$2) as value', [a.id ?? a, reason]);
    const markDone = a => value('select public.rpc_mark_work_done($1) as value', [a.id ?? a]);
    const confirm = a => value('select public.rpc_confirm_completion($1) as value', [a.id ?? a]);
    const messages = a => rows('select * from public.agreement_messages where agreement_id=$1 order by created_at,id', [a.id ?? a]);
    const events = a => rows('select * from public.user_activity_events where entity_id=$1 order by created_at,id', [a.id ?? a]);
    const facts = a => value('select private.agreement_cancellation_facts_v1($1) as value', [a.id ?? a]);
    const state = a => value(`select jsonb_build_object(
      'agreement',(select to_jsonb(t) from public.agreements t where id=$1),
      'execution',(select to_jsonb(t) from public.agreement_execution t where agreement_id=$1),
      'calendar',(select to_jsonb(t) from private.worker_calendar_events t where agreement_id=$1),
      'messages',(select coalesce(jsonb_agg(to_jsonb(t) order by t.id),'[]') from public.agreement_messages t where agreement_id=$1),
      'events',(select coalesce(jsonb_agg(to_jsonb(t) order by t.id),'[]') from public.user_activity_events t where entity_id=$1),
      'grants',(select coalesce(jsonb_agg(to_jsonb(t) order by t.id),'[]') from public.access_grants t where agreement_id=$1),
      'terms',(select jsonb_agg(to_jsonb(t) order by t.version) from public.agreement_versions t where agreement_id=$1),
      'deliveries',(select coalesce(jsonb_agg(to_jsonb(d) order by d.id),'[]') from public.notification_deliveries d join public.user_activity_events e on e.id=d.event_id where e.entity_id=$1)
      ) as value`, [a.id ?? a]);
    const pending = a => db.query(`insert into public.agreement_change_proposals(agreement_id,base_version,proposed_terms,content_hash,client_request_id,proposed_by_account_id)
      values($1,1,$2,$3,$4,$5)`, [a.id, a.terms, 'b'.repeat(64), randomUUID(), ids.WORKER]);
    const block = () => db.query(`insert into private.account_blocks(blocker_account_id,blocked_account_id,active,revision,last_blocked_at)
      values($1,$2,true,1,statement_timestamp()) on conflict(blocker_account_id,blocked_account_id) do update set active=true`, [ids.REQUESTER, ids.WORKER]);
    const unblock = () => db.exec('delete from private.account_blocks');
    const close = id => db.query(`insert into private.account_closure_requests(account_id,state,revision) values($1,'READY',1)`, [id]);
    const reopen = () => db.exec('delete from private.account_closure_requests');
    return { db, rows, value, actor, ...ids, fails, agreement, cancel, markDone, confirm, messages,
      events, facts, state, pending, block, unblock, close, reopen, capture, candidate,
      executedTriggers: executedTriggers.length, omittedTriggers: triggerCapture.triggers.filter(t => !included(t)).map(t => t.tgname), foreignKeys };
  } catch (error) { await db.close(); throw error; }
}
module.exports = { createCancellationFixture, capture, candidate, allFunctions };
