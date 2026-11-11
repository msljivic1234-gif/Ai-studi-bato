'use strict';
const assert = require('node:assert/strict');
const { test } = require('node:test');
const { randomUUID } = require('node:crypto');
const { createCancellationFixture, allFunctions } = require('./r08-cancellation-fixture.cjs');

test('R08 cancellation, durable reason, completion and calendar SQL contracts', async t => {
  const f = await createCancellationFixture();
  try {
    const cancelEvents = async a => (await f.events(a)).filter(e => e.event_type === 'AGREEMENT_CANCELLED');
    const projection = (a, actor) => f.value('select private.agreement_action_state($1,$2) as value', [a.id, actor]);
    const metadata = () => f.rows(`select n.nspname||'.'||p.proname as name,md5(p.prosrc) as hash,to_jsonb(p)-'prosrc' as metadata
      from pg_proc p join pg_namespace n on n.oid=p.pronamespace
      where n.nspname||'.'||p.proname=any($1::text[]) order by 1`, [allFunctions.map(e => e.name)]);

    await t.test('preimage reproduces requester RPC bypass after worker done and lost cancellation reason', async () => {
      const a = await f.agreement();
      await f.actor(f.WORKER); await f.markDone(a);
      assert.equal((await projection(a, f.REQUESTER)).canCancel, false);
      await f.actor(f.REQUESTER); await f.cancel(a, 'Ovaj razlog ranije nije ostajao sačuvan.');
      assert.equal((await f.state(a)).agreement.status, 'CANCELLED');
      assert.equal((await f.messages(a)).length, 0);
      assert.equal((await cancelEvents(a)).length, 0);
      assert.equal((await f.facts(a)).reasonState, 'NOT_KEPT');
    });

    await t.test('guarded candidate changes only cancellation body and preserves every captured function attribute', async () => {
      const before = await metadata();
      await f.db.exec(f.candidate);
      const after = await metadata();
      assert.deepEqual(after.map(r => ({ name: r.name, metadata: r.metadata })), before.map(r => ({ name: r.name, metadata: r.metadata })));
      assert.deepEqual(after.filter((r, i) => r.hash !== before[i].hash).map(r => r.name), ['public.rpc_cancel_agreement']);
      assert.equal(f.executedTriggers, 29);
      assert.equal(f.foreignKeys, 26);
    });

    await t.test('requester is denied after worker done; worker cancellation releases only that accepted cooperation', async () => {
      const a = await f.agreement();
      await f.actor(f.WORKER); await f.markDone(a);
      const before = await f.state(a);
      await f.actor(f.REQUESTER);
      await f.fails(() => f.cancel(a), 'AGREEMENT_CANCELLATION_NOT_ALLOWED');
      assert.deepEqual(await f.state(a), before);
      await f.actor(f.WORKER); await f.cancel(a, 'Ne mogu da nastavim pod ovim uslovima.');
      const after = await f.state(a);
      assert.equal(after.agreement.status, 'CANCELLED');
      assert.equal(after.execution.state, 'CANCELLED');
      assert.equal(after.calendar.state, 'RELEASED');
      assert.equal(after.grants[0].status, 'REVOKED');
      assert.deepEqual(after.terms, before.terms);
      assert.equal(after.deliveries.filter(d => d.state === 'EXPIRED').length, 2);
      assert.equal(after.deliveries.filter(d => d.state === 'CREATED').length, 2);
      assert.equal((await f.facts(a)).cancelledBy, 'WORKER');
      assert.equal((await cancelEvents(a)).length, 1);
    });

    await t.test('both parties can cancel CONFIRMED; one author-owned reason and one safe event identify who and when', async () => {
      for (const [actor, role, recipient] of [[f.REQUESTER, 'REQUESTER', f.WORKER], [f.WORKER, 'WORKER', f.REQUESTER]]) {
        const a = await f.agreement(); await f.actor(actor);
        assert.equal((await projection(a, actor)).canCancel, true);
        const reason = 'Termin nam više ne odgovara. Čujemo se drugi put.';
        await f.cancel(a, reason);
        const messages = await f.messages(a), events = await cancelEvents(a), state = await f.state(a), facts = await f.facts(a);
        assert.equal(messages.length, 1); assert.equal(events.length, 1);
        assert.equal(messages[0].sender_account_id, actor);
        assert.equal(messages[0].body, `Otkazujem Dogovor. Razlog: ${reason}`);
        assert.equal(events[0].recipient_user_id, recipient);
        assert.deepEqual(events[0].payload, { cancelledByRole: role });
        assert.equal(facts.reason, reason); assert.equal(facts.reasonState, 'KEPT');
        assert.equal(facts.cancelledBy, role); assert.equal(facts.sideSource, 'EVENT');
        assert.equal(facts.cancelledAt, state.agreement.updated_at);
        assert.equal(messages[0].created_at.getTime(), new Date(facts.cancelledAt).getTime());
        assert.ok(state.deliveries.every(d => !d.body.includes(reason)));
      }
    });

    await t.test('anonymous and unrelated accounts cannot cancel or append any reason', async () => {
      const a = await f.agreement(); const before = await f.state(a);
      await f.actor(null); await f.fails(() => f.cancel(a), 'AUTH_REQUIRED');
      await f.actor(f.FOREIGN); await f.fails(() => f.cancel(a), 'NOT_PARTY');
      assert.deepEqual(await f.state(a), before);
    });

    await t.test('execution version mismatch, missing execution and superseded agreement fail closed', async () => {
      const a = await f.agreement(); await f.actor(f.REQUESTER);
      await f.db.query('update public.agreement_execution set agreement_version=2 where agreement_id=$1', [a.id]);
      const before = await f.state(a);
      await f.fails(() => f.cancel(a), 'EXECUTION_VERSION_MISMATCH');
      assert.deepEqual(await f.state(a), before);
      await f.fails(() => f.db.query('update public.agreement_execution set agreement_version=null where agreement_id=$1', [a.id]), 'not-null constraint');
      await f.db.query('delete from public.agreement_execution where agreement_id=$1', [a.id]);
      await f.fails(() => f.cancel(a), 'EXECUTION_NOT_FOUND');
      const b = await f.agreement();
      await f.db.query("update public.agreements set status='SUPERSEDED' where id=$1", [b.id]);
      await f.fails(() => f.cancel(b), 'AGREEMENT_NOT_ACTIVE');
      assert.equal((await f.messages(b)).length, 0);
    });

    await t.test('blank and more than 4000 Unicode characters reject without any business side effect', async () => {
      const a = await f.agreement(); await f.actor(f.REQUESTER); const before = await f.state(a);
      for (const reason of [null, '', ' \n\t ']) await f.fails(() => f.cancel(a, reason), 'REASON_REQUIRED');
      await f.fails(() => f.cancel(a, '🙂'.repeat(4001)), 'REASON_TOO_LONG');
      assert.deepEqual(await f.state(a), before);
    });

    await t.test('1973-character reason stays one message; 1974 uses a bounded readable continuation', async () => {
      await f.actor(f.REQUESTER);
      for (const [length, parts] of [[1973, 1], [1974, 2]]) {
        const a = await f.agreement(); const reason = 'Ж'.repeat(length); await f.cancel(a, reason);
        const messages = await f.messages(a); assert.equal(messages.length, parts);
        assert.ok(messages.every(m => Array.from(m.body).length <= 2000));
        if (parts === 1) assert.equal((await f.facts(a)).reason, reason);
        else assert.ok(messages[0].body.startsWith('Otkazujem Dogovor. Razlog: [1/2] '));
      }
    });

    let longReason, longAgreement;
    await t.test('all 4000 characters including emoji and Cyrillic survive three ordered messages exactly', async () => {
      longAgreement = await f.agreement();
      longReason = Array.from('Ж🙂čĆ🏠Ђ').flatMap(x => Array(667).fill(x)).slice(0, 4000).join('');
      assert.equal(Array.from(longReason).length, 4000);
      await f.actor(f.WORKER); await f.cancel(longAgreement, longReason);
      const messages = await f.messages(longAgreement);
      assert.equal(messages.length, 3);
      const text = messages.map((m, i) => {
        const prefix = i === 0 ? 'Otkazujem Dogovor. Razlog: [1/3] ' : `Razlog otkazivanja [${i + 1}/3]: `;
        assert.ok(m.body.startsWith(prefix));
        assert.ok(Array.from(m.body).length <= 2000);
        assert.equal(m.sender_account_id, f.WORKER);
        assert.equal(m.created_at.toISOString(), messages[0].created_at.toISOString());
        assert.ok(!m.body.includes('\uFFFD'));
        return m.body.slice(prefix.length);
      }).join('');
      assert.equal(text, longReason); // Test-only reconstruction; no runtime helper.
      assert.equal((await cancelEvents(longAgreement)).length, 1);
      assert.ok((await f.facts(longAgreement)).reason.startsWith('[1/3] '));
    });

    await t.test('sender-owned export projection contains every reason part and excludes other accounts', async () => {
      const definition = allFunctions.find(e => e.name === 'private.data_export_snapshot').definition;
      const branch = definition.match(/select 'ownAgreementMessages'[\s\S]+?(?=\nunion all)/)?.[0];
      assert.ok(branch);
      const sql = `${branch.replaceAll('p_account_id', '$1::uuid')} and t.agreement_id=$2 order by t.created_at,t.id`;
      const own = await f.rows(sql, [f.WORKER, longAgreement.id]);
      assert.equal(own.length, 3);
      assert.deepEqual(own.map(r => r.value.body), (await f.messages(longAgreement)).map(r => r.body));
      assert.equal((await f.rows(sql, [f.REQUESTER, longAgreement.id])).length, 0);
      assert.equal((await f.rows(sql, [f.FOREIGN, longAgreement.id])).length, 0);
    });

    await t.test('existing closure sender scope and exact patch remove all three ordinary reason messages', async () => {
      const scope = await f.value("select private.closure_redaction_scope_v5('public.agreement_messages') as value");
      assert.equal(scope, 't.sender_account_id=$1');
      const own = await f.rows(`select to_jsonb(t) as row from public.agreement_messages t where ${scope} and t.agreement_id=$2`, [f.WORKER, longAgreement.id]);
      assert.equal(own.length, 3);
      for (const { row } of own) {
        const patch = await f.value("select private.closure_redaction_patch_v5('public.agreement_messages',$1,$2,$3) as value", [row, f.WORKER, randomUUID()]);
        assert.deepEqual(patch, { operation: 'UPDATE', patch: { body: 'Sadržaj uklonjen pri zatvaranju naloga.', photo_asset_ids: [], voice_asset_id: null } });
        // Execute only the canonical ordinary-message patch; this is not an
        // export/closure admission or erasure-certificate E2E claim.
        await f.db.query('update public.agreement_messages set body=$2,photo_asset_ids=$3,voice_asset_id=$4 where id=$1',
          [row.id, patch.patch.body, patch.patch.photo_asset_ids, patch.patch.voice_asset_id]);
      }
      const facts = await f.facts(longAgreement);
      assert.equal(facts.reason, null); assert.equal(facts.reasonState, 'REMOVED');
      assert.ok((await f.messages(longAgreement)).every(m => m.body === 'Sadržaj uklonjen pri zatvaranju naloga.'));
      assert.ok(!(JSON.stringify(await f.events(longAgreement))).includes(longReason.slice(0, 20)));
    });

    await t.test('CANCELLED replay never changes reason, timestamp, calendar, messages or events', async () => {
      const a = await f.agreement(); await f.actor(f.REQUESTER); await f.cancel(a, 'Prvi potvrđeni razlog.');
      const before = await f.state(a);
      await f.cancel(a, 'Drugačiji naknadni razlog se ne upisuje.');
      await f.actor(f.WORKER); await f.cancel(a, 'Ni druga strana ne prepisuje potvrdu.');
      assert.deepEqual(await f.state(a), before);
      assert.equal((await f.facts(a)).reason, 'Prvi potvrđeni razlog.');
    });

    await t.test('legacy cancelled replay remains possible without an execution row', async () => {
      const a = await f.agreement(); await f.actor(f.REQUESTER); await f.cancel(a);
      await f.db.query('delete from public.agreement_execution where agreement_id=$1', [a.id]);
      const before = await f.state(a); await f.cancel(a); assert.deepEqual(await f.state(a), before);
    });

    await t.test('blocked pair may exit; private reason is deliberately not retained or delivered', async () => {
      const a = await f.agreement(); await f.actor(f.REQUESTER); await f.block();
      try {
        await f.cancel(a, 'Privatan razlog ne sme zaobići blokadu.');
        const state = await f.state(a);
        assert.equal(state.agreement.status, 'CANCELLED');
        assert.equal(state.messages.length, 0); assert.equal(state.events.length, 1);
        assert.equal((await f.facts(a)).reasonState, 'NOT_KEPT');
        assert.ok(state.deliveries.every(d => d.state === 'CREATED'));
        assert.deepEqual(state.events[0].payload, { cancelledByRole: 'REQUESTER' });
      } finally { await f.unblock(); }
    });

    await t.test('closing recipient has no new reason message and existing guard suppresses terminal delivery', async () => {
      const a = await f.agreement(); await f.actor(f.REQUESTER); await f.close(f.WORKER);
      try {
        await f.cancel(a, 'Ovaj tekst ne ulazi u tuđi događaj.');
        const state = await f.state(a);
        assert.equal(state.agreement.status, 'CANCELLED'); assert.equal(state.messages.length, 0);
        assert.equal(state.events.length, 1);
        assert.equal((await f.facts(a)).reasonState, 'NOT_KEPT');
        assert.ok(state.deliveries.every(d => d.state === 'SUPPRESSED' && d.suppression_reason === 'ACCOUNT_CLOSING'));
      } finally { await f.reopen(); }
    });

    await t.test('event failure rolls back cancellation, reason, access revocation and calendar release together', async () => {
      const a = await f.agreement(); await f.actor(f.REQUESTER); const before = await f.state(a);
      await f.db.exec(`create function private.fixture_fail_cancel_event() returns trigger language plpgsql as $$
        begin if new.event_type='AGREEMENT_CANCELLED' then raise exception 'FIXTURE_EVENT_FAILURE';end if;return new;end$$;
        create trigger fixture_fail_cancel_event before insert on public.user_activity_events for each row execute function private.fixture_fail_cancel_event();`);
      try {
        await f.fails(() => f.cancel(a), 'FIXTURE_EVENT_FAILURE');
        assert.deepEqual(await f.state(a), before);
      } finally { await f.db.exec('drop trigger fixture_fail_cancel_event on public.user_activity_events'); }
    });

    await t.test('partial coverage cancellation releases exactly its people and leaves the other cooperation intact', async () => {
      const a = await f.agreement({ covered: 2, required: 5 });
      const b = await f.agreement({ need: a.need, covered: 3, required: 5 });
      const other = await f.state(b); await f.actor(f.REQUESTER);
      assert.equal(await f.value('select public.fn_need_covered_slots($1) as value', [a.need]), 5);
      await f.cancel(a);
      assert.equal(await f.value('select public.fn_need_covered_slots($1) as value', [a.need]), 3);
      assert.deepEqual(await f.state(b), other);
      assert.equal(await f.value('select status as value from public.needs where id=$1', [a.need]), 'SELECTION');
    });

    await t.test('closed remaining search early completion still records reason and event before returning', async () => {
      const a = await f.agreement({ covered: 2, required: 5 });
      const b = await f.agreement({ need: a.need, covered: 3, required: 5 });
      await f.actor(f.REQUESTER); await f.confirm(b);
      await f.db.query('update public.needs set remaining_search_closed_at=statement_timestamp(),remaining_search_closed_by_account_id=$2 where id=$1', [a.need, f.REQUESTER]);
      await f.cancel(a, 'Preostali deo nije potreban.');
      assert.equal(await f.value('select status as value from public.needs where id=$1', [a.need]), 'COMPLETED');
      assert.equal((await f.messages(a)).length, 1); assert.equal((await cancelEvents(a)).length, 1);
      assert.equal((await f.facts(a)).reason, 'Preostali deo nije potreban.');
      assert.equal(await f.value('select count(*)::int as value from private.fixture_dispatch_calls where need_id=$1', [a.need]), 0);
    });

    await t.test('unchanged worker-done replay preserves exact 48-hour deadline and single event', async () => {
      const a = await f.agreement(); await f.actor(f.WORKER);
      const first = await f.markDone(a), before = await f.state(a);
      assert.equal(new Date(before.execution.requester_deadline_at) - new Date(before.execution.worker_marked_done_at), 48 * 3600000);
      const replay = await f.markDone(a);
      assert.equal(replay.toISOString(), first.toISOString());
      assert.deepEqual(await f.state(a), before);
      assert.equal((await f.events(a)).filter(e => e.event_type === 'COMPLETION_REQUIRED').length, 1);
      assert.equal(before.calendar.state, 'BLOCKING');
    });

    await t.test('pending change blocks both completion paths and only worker can mark done', async () => {
      const a = await f.agreement(); await f.actor(f.REQUESTER);
      await f.fails(() => f.markDone(a), 'ONLY_WORKER_CAN_MARK_DONE');
      await f.pending(a);
      await f.fails(() => f.confirm(a), 'AGREEMENT_CHANGE_PENDING');
      await f.actor(f.WORKER); await f.fails(() => f.markDone(a), 'AGREEMENT_CHANGE_PENDING');
      await f.fails(() => f.confirm(a), 'ONLY_REQUESTER_CAN_CONFIRM_COMPLETION');
      assert.equal((await f.state(a)).execution.state, 'CONFIRMED');
    });

    await t.test('requester completion and replay keep one timestamp/event and prevent later cancellation', async () => {
      const a = await f.agreement(); await f.actor(f.WORKER); await f.markDone(a);
      await f.actor(f.REQUESTER); const first = await f.confirm(a), before = await f.state(a), replay = await f.confirm(a);
      assert.equal(first.idempotentReplay, false); assert.equal(replay.idempotentReplay, true);
      assert.equal(replay.completedAt, first.completedAt); assert.deepEqual(await f.state(a), before);
      assert.equal(before.calendar.state, 'RELEASED');
      assert.equal((await f.events(a)).filter(e => e.event_type === 'EXECUTION_STATE_CHANGED').length, 1);
      await f.fails(() => f.cancel(a), 'ALREADY_COMPLETED');
      await f.actor(f.WORKER); await f.fails(() => f.markDone(a), 'AGREEMENT_ALREADY_COMPLETED');
    });

    await t.test('automatic completion skips pending/problem records and completes eligible deadline only once', async () => {
      const normal = await f.agreement(), problem = await f.agreement(), pending = await f.agreement();
      await f.actor(f.WORKER);
      for (const a of [normal, problem, pending]) {
        await f.markDone(a);
        await f.db.query("update public.agreement_execution set requester_deadline_at=statement_timestamp()-interval '1 minute' where agreement_id=$1", [a.id]);
      }
      await f.db.query('update public.agreement_execution set problem_opened_at=statement_timestamp(),problem_opened_by=$2 where agreement_id=$1', [problem.id, f.REQUESTER]);
      await f.pending(pending);
      assert.equal(await f.value('select public.rpc_tick_auto_completion() as value'), 1);
      assert.equal((await f.state(normal)).agreement.status, 'COMPLETED');
      assert.equal((await f.state(normal)).calendar.state, 'RELEASED');
      assert.equal((await f.state(problem)).agreement.status, 'CONFIRMED');
      assert.equal((await f.state(pending)).agreement.status, 'CONFIRMED');
      assert.equal(await f.value('select public.rpc_tick_auto_completion() as value'), 0);
      assert.equal((await f.events(normal)).filter(e => e.event_type === 'EXECUTION_STATE_CHANGED').length, 1);
    });

    await t.test('accepted-version calendar projection moves atomically and rejects overlapping new interval', async () => {
      const a = await f.agreement(), b = await f.agreement(); await f.actor(f.REQUESTER);
      const moved = { ...a.terms, proposed_start_at: '2035-07-01T08:00:00+02:00', proposed_end_at: '2035-07-01T10:00:00+02:00' };
      await f.db.query(`insert into public.agreement_versions(agreement_id,version,status,terms,content_hash,created_by_account_id)
        values($1,2,'CONFIRMED',$2,$3,$4)`, [a.id, moved, 'c'.repeat(64), f.REQUESTER]);
      assert.equal((await f.state(a)).calendar.agreement_version, 1);
      await f.db.query('update public.agreements set current_version=2 where id=$1', [a.id]);
      const calendar = (await f.state(a)).calendar;
      assert.equal(calendar.agreement_version, 2);
      assert.equal(new Date(calendar.starts_at).toISOString(), '2035-07-01T06:00:00.000Z');
      await f.db.query(`insert into public.agreement_versions(agreement_id,version,status,terms,content_hash,created_by_account_id)
        values($1,2,'CONFIRMED',$2,$3,$4)`, [b.id, moved, 'd'.repeat(64), f.REQUESTER]);
      const before = await f.state(b);
      await f.fails(() => f.db.query('update public.agreements set current_version=2 where id=$1', [b.id]), 'WORKER_CALENDAR_CONFLICT');
      assert.deepEqual(await f.state(b), before);
    });

    await t.test('no accepted interval creates no calendar reservation; malformed half interval is rejected', async () => {
      const a = await f.agreement({ noInterval: true });
      assert.equal((await f.state(a)).calendar, null);
      await f.fails(() => f.value('select * from private.agreement_calendar_interval($1)', [{ proposed_start_at: '2030-01-01T09:00:00Z' }]), 'AGREEMENT_CALENDAR_INTERVAL_INVALID');
    });

    await t.test('stale candidate cannot be reapplied and anonymous EXECUTE remains denied', async () => {
      const before = await metadata();
      await f.fails(() => f.db.exec(f.candidate), 'R08_CANCELLATION_SOURCE_OR_ACL_DRIFT');
      assert.deepEqual(await metadata(), before);
      assert.equal(await f.value("select has_function_privilege('anon','public.rpc_cancel_agreement(uuid,text)','EXECUTE') as value"), false);
      assert.equal(await f.value("select has_function_privilege('authenticated','public.rpc_cancel_agreement(uuid,text)','EXECUTE') as value"), true);
    });
  } finally { await f.db.close(); }
});
