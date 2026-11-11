'use strict';
const assert = require('node:assert/strict');
const { test } = require('node:test');
const { randomUUID } = require('node:crypto');
const { createReviewFixture } = require('./r08-blind-reviews-fixture.cjs');

test('R08 blind publication and completion-authoritative fourteen-day review window', async t => {
  const f = await createReviewFixture();
  try {
    let early, earlyReceipt, earlySnapshot;
    const metadata = () => f.rows(`select n.nspname||'.'||p.proname as name,md5(prosrc) as body_md5,to_jsonb(p)-'prosrc' as attributes
      from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname||'.'||p.proname=any($1::text[]) order by 1`,
    [f.ratingCapture.functions.map(fn => fn.name)]);
    const count = async account => (await f.reputation(account)).reviewCount;

    await t.test('preimage exposes the first rating and comment before the counterpart reviews', async () => {
      early = await f.completed(); earlyReceipt = await f.review(early, { comment: 'Sintetička prva ocena.' });
      assert.equal(await count(f.WORKER), 1);
      assert.ok((await f.comments(f.PROFILE)).items.some(r => r.reviewId === earlyReceipt.reviewId));
      earlySnapshot = await f.immutable(early);
    });

    await t.test('preimage accepts a new review after the fourteen-day deadline', async () => {
      const late = await f.completed(337);
      assert.equal((await f.own(late)).eligible, true);
      const receipt = await f.legacy(late);
      assert.equal(receipt.authoritative, true);
    });

    await t.test('candidate changes nine bodies, preserves their OIDs/ACL/arguments and admits two private helpers only', async () => {
      const before = await metadata(); await f.db.exec(f.ratingCandidate); const after = await metadata();
      assert.deepEqual(after.map(x => ({ name: x.name, attributes: x.attributes })), before.map(x => ({ name: x.name, attributes: x.attributes })));
      assert.equal(after.filter((x, i) => x.body_md5 !== before[i].body_md5).length, 9);
      for (const fn of ['private.agreement_review_deadline_v1(uuid)', 'private.agreement_review_published_v1(uuid)']) {
        for (const role of ['anon', 'authenticated', 'service_role']) assert.equal(await f.value('select has_function_privilege($1,$2,\'EXECUTE\') as value', [role, fn]), false);
      }
      assert.deepEqual(await f.immutable(early), earlySnapshot);
    });

    await t.test('existing early first review becomes private without rewriting its immutable row or owner receipt', async () => {
      assert.equal(await f.published(earlyReceipt), false);
      assert.equal(await count(f.WORKER), 1); // The separate historical expired review is publishable.
      assert.ok(!(await f.comments(f.PROFILE)).items.some(r => r.reviewId === earlyReceipt.reviewId));
      assert.equal((await f.own(early)).review.reviewId, earlyReceipt.reviewId);
      assert.equal((await f.own(early)).review.comment, 'Sintetička prva ocena.');
      await f.actor(f.WORKER);
      assert.ok(!(await f.received()).items.some(r => r.reviewId === earlyReceipt.reviewId));
    });

    await t.test('second bilateral review publishes both immediately, with one common account reputation', async () => {
      const beforeWorker = await count(f.WORKER), beforeRequester = await count(f.REQUESTER);
      const other = await f.review(early, { target: f.REQUESTER, rating: 5, comment: 'Sintetička druga ocena.' });
      assert.equal(await f.published(earlyReceipt), true); assert.equal(await f.published(other), true);
      assert.equal(await count(f.WORKER), beforeWorker + 1); assert.equal(await count(f.REQUESTER), beforeRequester + 1);
      assert.ok((await f.comments(f.PROFILE)).items.some(r => r.reviewId === earlyReceipt.reviewId));
      assert.equal((await f.profile(f.PROFILE)).trust.reviewCount, await count(f.WORKER));
      assert.ok((await f.received()).items.some(r => r.reviewId === earlyReceipt.reviewId));
    });

    await t.test('new first review stays absent from public count, profile, comments and received totals', async () => {
      const a = await f.completed(); const before = await count(f.WORKER);
      await f.actor(f.WORKER); const receivedBefore = (await f.received()).totalCount;
      await f.actor(f.REQUESTER); const r = await f.review(a, { comment: 'Skrivena pre objave.' });
      assert.equal(await count(f.WORKER), before); assert.equal((await f.profile(f.PROFILE)).trust.reviewCount, before);
      assert.equal(await f.published(r), false); assert.ok(!(await f.comments(f.PROFILE)).items.some(x => x.reviewId === r.reviewId));
      assert.equal((await f.own(a)).review.comment, 'Skrivena pre objave.');
      await f.actor(f.WORKER); assert.equal((await f.received()).totalCount, receivedBefore);
      assert.equal((await f.own(a)).review, null); assert.equal((await f.own(a)).eligible, true);
      assert.ok(!(await f.received()).items.some(x => x.reviewId === r.reviewId));
    });

    await t.test('one review publishes at the fixed deadline; no new review is admitted then', async () => {
      const a = await f.completed(335); const r = await f.review(a, { comment: 'Čeka istek roka.' });
      assert.equal(await f.published(r), false); const before = await count(f.WORKER);
      await f.db.query("update public.agreement_execution set completed_at=statement_timestamp()-interval '336 hours' where agreement_id=$1", [a.id]);
      assert.equal(await f.published(r), true); assert.equal(await count(f.WORKER), before + 1);
      await f.actor(f.WORKER);
      assert.equal((await f.own(a)).eligible, false); assert.equal((await f.own(a, true)).eligible, false);
      await f.fails(() => f.review(a, { target: f.REQUESTER }), 'REVIEW_WINDOW_CLOSED');
      await f.fails(() => f.legacy(a, { target: f.REQUESTER }), 'REVIEW_WINDOW_CLOSED');
    });

    await t.test('both legacy and v2 successful replay survive expiry and later closure without extra writes', async () => {
      for (const legacy of [true, false]) {
        const a = await f.completed(), key = randomUUID();
        const command = legacy ? f.legacy : f.review; const receipt = await command(a, { key });
        await f.db.query("update public.agreement_execution set completed_at=statement_timestamp()-interval '400 hours' where agreement_id=$1", [a.id]);
        await f.close(f.REQUESTER);
        try {
          const before = await f.immutable(a), replay = await command(a, { key });
          assert.equal(replay.idempotentReplay, true); assert.equal(replay.reviewId, receipt.reviewId);
          assert.deepEqual(await f.immutable(a), before);
          await f.fails(() => command(a, { key, rating: 1 }), 'REQUEST_ID_REUSED');
        } finally { await f.reopen(); }
      }
    });

    await t.test('missing, future, infinite or mismatched completion cannot invent a deadline or eligibility', async () => {
      for (const change of ['NULL', "statement_timestamp()+interval '1 hour'", "'infinity'::timestamptz"]) {
        const a = await f.completed();
        await f.db.exec(`update public.agreement_execution set completed_at=${change} where agreement_id='${a.id}'`);
        assert.equal(await f.deadline(a), null); assert.equal((await f.own(a)).eligible, false);
        await f.fails(() => f.review(a), 'REVIEW_NOT_COMPLETED');
      }
      const a = await f.completed(); await f.db.query('update public.agreement_execution set agreement_version=2 where agreement_id=$1', [a.id]);
      assert.equal(await f.deadline(a), null); assert.equal((await f.own(a, true)).eligible, false);
      await f.fails(() => f.legacy(a), 'REVIEW_NOT_COMPLETED');
    });

    await t.test('exact completion plus 336 hours is independent of session time zone and DST', async () => {
      const a = await f.completed();
      await f.db.query("update public.agreement_execution set completed_at='2026-03-28T12:00:00Z' where agreement_id=$1", [a.id]);
      for (const zone of ['UTC', 'Europe/Belgrade', 'America/New_York']) {
        await f.db.query("select set_config('TimeZone',$1,false)", [zone]);
        assert.equal((await f.deadline(a)).toISOString(), '2026-04-11T12:00:00.000Z');
      }
      await f.db.exec("set TimeZone='UTC'");
    });

    await t.test('home attention and Agreement page stop offering expired/missing-completion reviews', async () => {
      const fresh = await f.completed(), expired = await f.completed(337), invalid = await f.completed();
      await f.db.query('update public.agreement_execution set completed_at=null where agreement_id=$1', [invalid.id]);
      const page = await f.list();
      assert.equal(page.items.find(r => r.id === fresh.id).ratingDue, true);
      assert.equal(page.items.find(r => r.id === expired.id).ratingDue, false);
      assert.equal(page.items.find(r => r.id === invalid.id).ratingDue, false);
      const before = (await f.home()).ratings.due;
      await f.legacy(fresh);
      assert.equal((await f.home()).ratings.due, before - 1);
      assert.equal((await f.list()).items.find(r => r.id === fresh.id).ratingDue, false);
    });

    await t.test('blocking, world and closure gates remain separate from irrevocable bilateral publication', async () => {
      await f.actor(f.REQUESTER);
      assert.equal(await f.published(earlyReceipt), true);
      await f.block();
      try {
        assert.equal(await f.profile(f.PROFILE), null);
        assert.equal(await f.comments(f.PROFILE), null);
        await f.fails(() => f.reputation(f.WORKER), 'REPUTATION_NOT_AVAILABLE');
        assert.equal(await f.published(earlyReceipt), true);
      } finally { await f.unblock(); }
      await f.db.exec("select set_config('test.review_world_mismatch','true',false)");
      assert.equal(await f.profile(f.PROFILE), null); assert.equal(await f.comments(f.PROFILE), null);
      await f.db.exec("select set_config('test.review_world_mismatch','false',false)");
      await f.close(f.REQUESTER);
      try {
        await f.actor(f.FOREIGN);
        assert.ok(!(await f.comments(f.PROFILE)).items.some(r => r.reviewId === earlyReceipt.reviewId));
        assert.equal(await f.published(earlyReceipt), true);
      } finally { await f.reopen(); }
    });

    await t.test('comment moderation cannot remove the published stars or make the counterpart blind again', async () => {
      await f.db.exec("select set_config('request.jwt.claim.role','service_role',false);select set_config('uskoci.review_comment_moderation','on',false)");
      try {
        await f.db.query("update private.agreement_review_comments_v1 set hidden_at=statement_timestamp(),hidden_reason_code='TEST_MODERATION' where review_id=$1", [earlyReceipt.reviewId]);
      } finally { await f.db.exec("select set_config('request.jwt.claim.role','authenticated',false);select set_config('uskoci.review_comment_moderation','off',false)"); }
      assert.equal(await f.published(earlyReceipt), true);
      const before = await count(f.WORKER);
      assert.ok(!(await f.comments(f.PROFILE)).items.some(r => r.reviewId === earlyReceipt.reviewId));
      assert.equal(await count(f.WORKER), before);
      await f.fails(() => f.db.query('delete from private.agreement_reviews where id=$1', [earlyReceipt.reviewId]), 'REVIEW_IMMUTABLE');
      await f.fails(() => f.db.query('update private.agreement_reviews set rating=1 where id=$1', [earlyReceipt.reviewId]), 'REVIEW_IMMUTABLE');
      assert.equal(await f.value("select 'private.agreement_reviews'=any(private.closure_redaction_relations_v5()) as value"), false);
    });

    await t.test('unrelated actor, wrong counterpart, active Agreement and duplicate key are still rejected', async () => {
      const a = await f.completed(); await f.actor(f.FOREIGN);
      await f.fails(() => f.review(a), 'REVIEW_NOT_ALLOWED');
      await f.actor(f.REQUESTER); await f.fails(() => f.review(a, { target: f.FOREIGN }), 'REVIEW_NOT_ALLOWED');
      const active = await f.agreement(); await f.fails(() => f.review(active), 'REVIEW_NOT_COMPLETED');
      const key = randomUUID(); await f.review(a, { key });
      await f.fails(() => f.review(a, { key, comment: 'Promenjen komentar.' }), 'REQUEST_ID_REUSED');
      await f.fails(() => f.review(a), 'REVIEW_ALREADY_SUBMITTED');
    });

    await t.test('both publication-helper ACL and stale preimage guard remain closed', async () => {
      const before = await metadata();
      await f.fails(() => f.db.exec(f.ratingCandidate), 'R08_REVIEW_SOURCE_OR_ACL_DRIFT');
      assert.deepEqual(await metadata(), before);
      for (const role of ['anon', 'authenticated', 'service_role']) {
        assert.equal(await f.value("select has_table_privilege($1,'private.agreement_reviews','SELECT') as value", [role]), false);
        assert.equal(await f.value("select has_function_privilege($1,'private.agreement_review_published_v1(uuid)','EXECUTE') as value", [role]), false);
      }
    });
  } finally { await f.db.close(); }
});
