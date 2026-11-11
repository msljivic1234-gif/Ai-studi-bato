'use strict';
// Execute actual captured review writers/readers on the existing bounded R08
// PostgreSQL fixture. Account-world admission, unrelated selection counts and
// marketplace audit transport are local substitutes, not hosted Auth/RLS proof.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { createCancellationFixture } = require('./r08-cancellation-fixture.cjs');
const stem = 'r08_blind_reviews_20261107';
const capture = JSON.parse(fs.readFileSync(path.join(__dirname, `sql/${stem}.preimage.json`), 'utf8'));
const schema = JSON.parse(fs.readFileSync(path.join(__dirname, `sql/${stem}.fixture-schema.json`), 'utf8'));
const candidate = fs.readFileSync(path.join(__dirname, `sql/${stem}.sql`), 'utf8');

async function createReviewFixture() {
  const f = await createCancellationFixture();
  try {
    const load = async entry => {
      await f.db.exec(entry.definition);
      await f.db.exec(`REVOKE ALL ON FUNCTION ${entry.signature} FROM PUBLIC;`);
      for (const match of entry.acl.matchAll(/(?:\{|,)([a-z_]+)=X\//g)) {
        if (match[1] !== 'postgres') await f.db.exec(`GRANT EXECUTE ON FUNCTION ${entry.signature} TO ${match[1]};`);
      }
    };
    await load(JSON.parse(fs.readFileSync(path.join(__dirname, `sql/${stem}.floor-dependency.json`), 'utf8')));
    for (const name of ['private.review_tag_catalog', 'private.review_tags_valid']) await load(capture.functions.find(x => x.name === name));
    for (const table of schema.tables) {
      const columns = table.columns.map(c => `"${c.name}" ${c.type}${c.default ? ` DEFAULT ${c.default}` : ''}${c.notNull ? ' NOT NULL' : ''}`);
      await f.db.exec(`CREATE TABLE ${table.name} (${columns.join(',')});`);
      for (const constraint of table.constraints) await f.db.exec(`ALTER TABLE ${table.name} ADD CONSTRAINT "${constraint.name}" ${constraint.definition};`);
      await f.db.exec(`ALTER TABLE ${table.name} ENABLE ROW LEVEL SECURITY;ALTER TABLE ${table.name} FORCE ROW LEVEL SECURITY;REVOKE ALL ON TABLE ${table.name} FROM PUBLIC,anon,authenticated,service_role;`);
    }
    for (const table of schema.tables) for (const constraint of table.foreignkeys) await f.db.exec(`ALTER TABLE ${table.name} ADD CONSTRAINT "${constraint.name}" ${constraint.definition};`);
    await f.db.exec(`create table private.marketplace_config(key text primary key,value jsonb);
      create table private.fixture_review_audit(action text,entity_id uuid,detail jsonb);`);
    const substitutes = ['private.accounts_same_world', 'private.audit_marketplace', 'public.selectable_application_count'];
    for (const fn of capture.functions) if (!substitutes.includes(fn.name)) await load(fn);
    await f.db.exec(`
      create function private.accounts_same_world(uuid,uuid) returns boolean language sql stable as $$
        select current_setting('test.review_world_mismatch',true) is distinct from 'true'$$;
      create function public.selectable_application_count(public.needs) returns bigint language sql stable as $$select 0::bigint$$;
      create function private.audit_marketplace(uuid,text,text,uuid,integer,jsonb) returns void language sql as $$
        insert into private.fixture_review_audit(action,entity_id,detail) values($2,$4,$6)$$;
    `);
    for (const table of schema.tables) for (const trigger of table.triggers) {
      assert.equal(trigger.enabled, 'O'); await f.db.exec(trigger.definition);
    }
    const completed = async (ageHours = 0) => {
      await f.actor(f.REQUESTER); const a = await f.agreement(); await f.confirm(a);
      if (ageHours) await f.db.query("update public.agreement_execution set completed_at=statement_timestamp()-($2::numeric*interval '1 hour') where agreement_id=$1", [a.id, ageHours]);
      return a;
    };
    const review = (a, options = {}) => f.value(`select public.rpc_submit_agreement_review_v2($1,$2,$3,$4,$5,$6) as value`,
      [a.id, options.target ?? f.WORKER, options.rating ?? 4, options.tags ?? [], options.key ?? randomUUID(), options.comment == null ? null : JSON.stringify(options.comment)]);
    const legacy = (a, options = {}) => f.value(`select public.rpc_submit_agreement_review($1,$2,$3,$4,$5) as value`,
      [a.id, options.target ?? f.WORKER, options.rating ?? 4, options.tags ?? [], options.key ?? randomUUID()]);
    const reputation = account => f.value('select public.rpc_get_account_reputation($1) as value', [account]);
    const own = (a, legacy = false) => f.value(`select public.${legacy ? 'rpc_get_my_agreement_review' : 'rpc_get_my_agreement_review_v2'}($1) as value`, [a.id]);
    const comments = profile => f.value('select public.rpc_list_review_comments_v1($1,50,null) as value', [profile]);
    const received = () => f.value('select public.rpc_list_received_reviews_v1(50,null) as value');
    const profile = p => f.value('select public.rpc_get_public_profile($1) as value', [p]);
    const home = () => f.value('select public.rpc_home_attention() as value');
    const list = () => f.value("select public.rpc_list_my_agreements_page('ALL',100,null,null) as value");
    const published = r => f.value('select private.agreement_review_published_v1($1) as value', [r.reviewId ?? r]);
    const deadline = a => f.value('select private.agreement_review_deadline_v1($1) as value', [a.id]);
    const immutable = a => f.value(`select jsonb_build_object(
      'reviews',(select coalesce(jsonb_agg(to_jsonb(r) order by r.id),'[]') from private.agreement_reviews r where agreement_id=$1),
      'comments',(select coalesce(jsonb_agg(to_jsonb(c) order by c.review_id),'[]') from private.agreement_review_comments_v1 c join private.agreement_reviews r on r.id=c.review_id where r.agreement_id=$1),
      'events',(select coalesce(jsonb_agg(to_jsonb(e) order by e.id),'[]') from public.user_activity_events e where e.entity_id=$1),
      'audit',(select coalesce(jsonb_agg(to_jsonb(e) order by e.action),'[]') from private.fixture_review_audit e where e.entity_id=$1)
      ) as value`, [a.id]);
    return { ...f, ratingCapture: capture, ratingCandidate: candidate, completed, review, legacy, reputation, own,
      comments, received, profile, home, list, published, deadline, immutable };
  } catch (error) { await f.db.close(); throw error; }
}
module.exports = { createReviewFixture, capture, candidate };
