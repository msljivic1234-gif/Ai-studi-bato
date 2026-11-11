'use strict';
// Actual deployed cancellation writer and message guards in a bounded local
// PostgreSQL fixture. Auth is explicitly a local identity stub, not hosted E2E.
const assert = require('node:assert/strict');
const { test } = require('node:test');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { createCancellationFixture } = require('./r08-cancellation-fixture.cjs');
const candidate = readFileSync(path.join(__dirname, 'sql/r08_cancellation_reason_readback_20261107.sql'), 'utf8');

test('R08 complete cancellation reason uses only the existing exact writer sequence', async t => {
  const f = await createCancellationFixture();
  try {
    await f.db.exec(f.candidate); // The already deployed 07.11 cancellation writer.
    const text = length => Array.from('Ž🙂Љč🏠ћ').flatMap(c => Array(667).fill(c)).slice(0, length).join('');
    const cancelled = async (reason, actor = f.REQUESTER) => {
      const a = await f.agreement(); await f.actor(actor); await f.cancel(a, reason); return a;
    };
    const reader = ids => f.value('select public.rpc_agreement_cancellation_v1($1) as value', [ids]);
    const metadata = () => f.rows(`select p.oid::regprocedure::text as signature, md5(p.prosrc) as hash,
      to_jsonb(p)-'prosrc' as attributes from pg_proc p where p.oid in (
      'private.agreement_cancellation_facts_v1(uuid)'::regprocedure,
      'public.rpc_agreement_cancellation_v1(uuid[])'::regprocedure,
      'public.rpc_cancel_agreement(uuid,text)'::regprocedure) order by 1`);
    let old, reason;
    await t.test('deployed reader reproduces a partial reason despite all 4000 Unicode characters being stored', async () => {
      reason = text(4000); old = await cancelled(reason);
      assert.equal((await f.messages(old)).length, 3);
      const facts = await f.facts(old);
      assert.equal(facts.reasonState, 'KEPT');
      assert.ok(facts.reason.startsWith('[1/3] '));
      assert.notEqual(facts.reason, reason);
      assert.equal(Array.from(facts.reason).length, 1973);
    });
    await t.test('forward candidate changes only the read-only helper body and preserves every attribute and grant', async () => {
      const before = await metadata(); await f.db.exec(candidate); const after = await metadata();
      assert.deepEqual(after.map(x => [x.signature, x.attributes]), before.map(x => [x.signature, x.attributes]));
      assert.deepEqual(after.filter((x, i) => x.hash !== before[i].hash).map(x => x.signature), ['private.agreement_cancellation_facts_v1(uuid)']);
      assert.equal(await f.value("select has_function_privilege('anon','private.agreement_cancellation_facts_v1(uuid)','EXECUTE') as value"), false);
      assert.equal(await f.value("select has_function_privilege('authenticated','private.agreement_cancellation_facts_v1(uuid)','EXECUTE') as value"), false);
    });
    await t.test('already stored three-part reason is returned whole to each participant without any write', async () => {
      const before = await f.state(old);
      for (const actor of [f.REQUESTER, f.WORKER]) {
        await f.actor(actor); const result = await reader([old.id]);
        assert.equal(result.items.length, 1);
        assert.equal(result.items[0].reason, reason);
        assert.equal(result.items[0].reasonState, 'KEPT');
        assert.equal(result.items[0].cancelledBy, 'REQUESTER');
        assert.equal(result.items[0].cancelledByMe, actor === f.REQUESTER);
      }
      assert.deepEqual(await f.state(old), before);
    });
    await t.test('single-message and two/three-part boundaries retain exact text and no numbered markers', async () => {
      for (const length of [1, 1973, 1974, 3934, 3935, 4000]) {
        const input = text(length); const a = await cancelled(input, f.WORKER);
        const before = await f.state(a), facts = await f.facts(a);
        assert.equal(facts.reason, input, String(length));
        assert.equal(Array.from(facts.reason).length, length);
        assert.equal(facts.reasonState, 'KEPT');
        assert.equal(facts.cancelledBy, 'WORKER');
        assert.ok(!facts.reason.includes('\uFFFD'));
        assert.deepEqual(await f.state(a), before);
      }
    });
    await t.test('a literal numbered prefix in a short ordinary reason remains the original user text', async () => {
      for (const input of ['[1/2] Ovo je moj lični spisak.', '[1/3] Razlog sa oznakom.', '[1/4] Nije protokol.']) {
        const a = await cancelled(input);
        assert.equal((await f.messages(a)).length, 1);
        assert.equal((await f.facts(a)).reason, input);
      }
    });
    await t.test('unrelated conversation content at the same time is never concatenated into a reason', async () => {
      const input = text(4000), a = await cancelled(input); const rows = await f.messages(a);
      await f.db.query(`insert into public.agreement_messages(id,agreement_id,agreement_version,sender_account_id,body,created_at)
        values($1,$2,1,$3,'Razlog otkazivanja [2/3]: TUĐA PORUKA',$4)`,
      [randomUUID(), a.id, f.WORKER, rows[0].created_at]);
      assert.equal((await f.facts(a)).reason, input);
    });
    await t.test('missing, altered, other-author, other-version and different-time parts cannot fabricate a whole reason', async () => {
      for (const mutation of ['missing', 'prefix', 'author', 'version', 'time', 'content_length']) {
        const a = await cancelled(text(4000)), rows = await f.messages(a), second = rows[1];
        if (mutation === 'missing') await f.db.query('delete from public.agreement_messages where id=$1', [second.id]);
        if (mutation === 'prefix') await f.db.query("update public.agreement_messages set body='Nevažeći deo' where id=$1", [second.id]);
        if (mutation === 'author') await f.db.query('update public.agreement_messages set sender_account_id=$2 where id=$1', [second.id, f.WORKER]);
        if (mutation === 'version') await f.db.query('update public.agreement_messages set agreement_version=2 where id=$1', [second.id]);
        if (mutation === 'time') await f.db.query("update public.agreement_messages set created_at=created_at+interval '1 microsecond' where id=$1", [second.id]);
        if (mutation === 'content_length') await f.db.query("update public.agreement_messages set body='Razlog otkazivanja [2/3]: Kratko' where id=$1", [second.id]);
        const before = await f.state(a), facts = await f.facts(a);
        assert.equal(facts.reason, rows[0].body.slice(27), mutation);
        assert.ok(facts.reason.startsWith('[1/3] '), mutation); // Existing explicit partial fallback, not invented text.
        assert.deepEqual(await f.state(a), before);
      }
    });
    await t.test('the matching UUID prefix alone cannot join a message from another Agreement', async () => {
      const a = await cancelled(text(4000)), b = await f.agreement(), rows = await f.messages(a);
      await f.db.query('update public.agreement_messages set agreement_id=$2 where id=$1', [rows[1].id, b.id]);
      assert.equal((await f.facts(a)).reason, rows[0].body.slice(27));
    });
    await t.test('blocked pair and closing recipient retain the existing no-new-message privacy boundary', async () => {
      const a = await f.agreement(); await f.actor(f.REQUESTER); await f.block();
      try {
        await f.cancel(a, 'Privatan razlog.');
        assert.equal((await f.messages(a)).length, 0);
        assert.equal((await f.facts(a)).reasonState, 'NOT_KEPT');
        assert.equal((await f.facts(a)).reason, null);
      } finally { await f.unblock(); }
      const b = await f.agreement(); await f.close(f.WORKER);
      try {
        await f.cancel(b, 'Nema nove poruke nalogu u zatvaranju.');
        assert.equal((await f.facts(b)).reasonState, 'NOT_KEPT');
        assert.equal((await f.messages(b)).length, 0);
      } finally { await f.reopen(); }
    });
    await t.test('existing sender redaction removes every part and does not reconstruct deleted personal text', async () => {
      const a = await cancelled(text(4000));
      await f.db.query("update public.agreement_messages set body='Sadržaj uklonjen pri zatvaranju naloga.' where agreement_id=$1", [a.id]);
      const facts = await f.facts(a);
      assert.equal(facts.reasonState, 'REMOVED'); assert.equal(facts.reason, null);
    });
    await t.test('foreign/anonymous/closing readers gain no cancellation details', async () => {
      await f.actor(f.FOREIGN); assert.deepEqual((await reader([old.id])).items, []);
      await f.actor(null); await f.fails(() => reader([old.id]), 'AUTH_REQUIRED');
      await f.actor(f.WORKER); await f.close(f.WORKER);
      try { await f.fails(() => reader([old.id]), 'ACCOUNT_CLOSING'); } finally { await f.reopen(); }
    });
    await t.test('confirmed replay preserves the complete original reason and all business state', async () => {
      const a = await cancelled(text(4000)); const before = await f.state(a);
      await f.cancel(a, 'Kasnija izmena ne važi.');
      assert.deepEqual(await f.state(a), before);
      assert.equal((await f.facts(a)).reason, text(4000));
    });
    await t.test('source drift and a second application fail closed instead of overwriting a newer helper', async () => {
      await f.fails(() => f.db.exec(candidate), 'R08_REASON_PREIMAGE_MISMATCH');
    });
  } finally { await f.db.close(); }
});
