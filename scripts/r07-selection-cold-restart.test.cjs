'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const { ROOT, ID, ownerId, needId, agreementId, command, savedRecord, storageKey, found, absent, compile, deferred, harness } = require('./r07-selection-recovery-harness.cjs');
const seeded = (value = savedRecord()) => new Map([[storageKey(), JSON.stringify(value)]]);
const rpcNames = h => h.calls.map(call => call.name);
const flush = () => new Promise(resolve => setImmediate(resolve));
function controlledClock() {
  let now = 1_800_000_000_000, sequence = 0;
  const timers = new Map();
  return {
    Date: class extends Date { static now() { return now; } },
    setTimeout(work, delay) { const id = ++sequence; timers.set(id, { work, due: now + delay }); return id; },
    clearTimeout(id) { timers.delete(id); },
    active: () => timers.size,
    // A delayed JS timer must not let an already expired native result resume.
    elapseWithoutCallbacks(ms) { now += ms; },
    async tick(ms) {
      const target = now + ms;
      for (;;) {
        const first = [...timers.entries()].filter(([, timer]) => timer.due <= target).sort((a, b) => a[1].due - b[1].due)[0];
        if (!first) break;
        now = first[1].due; timers.delete(first[0]); first[1].work(); await flush();
      }
      now = target; await flush();
    },
  };
}
function observe(promise) {
  const result = { state: 'PENDING', value: undefined, error: undefined };
  result.done = promise.then(value => { result.state = 'FULFILLED'; result.value = value; },
    error => { result.state = 'REJECTED'; result.error = error; });
  return result;
}

test('the original selection is durably read back before dispatch and a fresh process recovers a lost reply read-only', async () => {
  const before = harness(absent, { fresh: true, pending: false });
  assert.equal((await before.read()).ok, true);
  before.control.selectThrows = true;
  before.control.hook = name => {
    if (name !== 'rpc_select_response') return;
    assert.deepEqual(JSON.parse(before.memory.get(storageKey())), savedRecord());
    assert.deepEqual(before.events.slice(-4), ['getItem', 'setItem', 'getItem', 'rpc_select_response']);
  };
  const failed = await before.choose();
  assert.equal(failed.ok, false); assert.equal(before.control.newKeys, 1);
  assert.equal(before.memory.size, 1);
  const original = before.session.pending.command;
  const restarted = harness(found(), { pending: false, memory: before.memory });
  restarted.control.sourceThrows = true;
  const recovered = await restarted.read();
  assert.deepEqual(recovered.podatak.receipt, { dogovorId: agreementId, agreementStatus: 'CONFIRMED' });
  assert.equal(recovered.podatak.need, null, 'restart never invents the old task/profile snapshot');
  assert.deepEqual(restarted.session.pending.command, original);
  assert.notEqual(restarted.session.pending.command, original, 'all JS objects and module caches are fresh');
  assert.deepEqual(rpcNames(restarted), ['rpc_read_selection_result']);
  assert.deepEqual(restarted.sourceCalls, []); assert.equal(restarted.control.newKeys, 0);
  assert.equal(restarted.memory.has(storageKey()), false, 'exact confirmed command is retired');
});

test('a crash after durable intent but before dispatch restores the same unsent key and does not automatically send', async () => {
  const before = harness(absent, { pending: false, fresh: true });
  await before.journal.save(savedRecord(), before.current);
  const after = harness(absent, { memory: before.memory, pending: false, fresh: true });
  const result = await after.read();
  assert.equal(result.ok, true); assert.equal(result.podatak.receipt, null);
  assert.deepEqual(rpcNames(after), ['rpc_read_selection_result']);
  assert.equal(after.session.pending.reconciled, true);
  assert.equal(after.session.pending.candidate, after.candidate, 'only an exact current offer can restore its display');
  after.control.failSet = true; // The identical durable record needs no redundant device write.
  await after.choose();
  assert.deepEqual(rpcNames(after), ['rpc_read_selection_result', 'rpc_select_response']);
  assert.equal(after.calls[1].args.p_client_request_id, savedRecord().command.clientRequestId);
  assert.equal(after.control.newKeys, 0);
  assert.equal(after.storageCalls.some(call => call.name === 'setItem'), false);
});

test('NOT_FOUND retains the immutable request despite newer price, version and people; explicit replay sends only the original', async () => {
  const h = harness(absent, { memory: seeded(), pending: false });
  h.candidate.cena.iznos = 600; h.candidate.osnovaCene = 'TOTAL'; h.candidate.verzija = 9;
  h.candidate.hash = 'b'.repeat(64); h.candidate.pokrivaMesta = 7;
  assert.equal((await h.read()).podatak.receipt, null);
  assert.equal(h.session.pending.need, null); assert.equal(h.session.pending.candidate, null);
  assert.deepEqual(h.session.pending.command, command()); assert.equal(h.memory.size, 1);
  assert.deepEqual(rpcNames(h), ['rpc_read_selection_result']);
  h.control.selectError = { message: 'STALE_REVIEW_REQUIRED', code: 'P0001' };
  const refused = await h.choose();
  assert.equal(h.service.conclusiveSelectionRefusal(refused), true);
  assert.equal(h.calls[1].args.p_need_revision, 3); assert.equal(h.calls[1].args.p_response_version, 2);
  assert.equal(h.calls[1].args.p_content_hash, 'a'.repeat(64));
  assert.deepEqual(h.session.pending.command, command()); assert.equal(h.control.newKeys, 0);
  await h.reset();
  assert.equal(h.session.pending, null); assert.equal(h.memory.has(storageKey()), false);
});

test('missing or failed current list leaves a checked saved request recoverable without inventing an offer', async () => {
  for (const scenario of ['failure', 'missing', 'mixed']) {
    const h = harness(absent, { memory: seeded(), pending: false });
    if (scenario === 'failure') h.control.sourceThrows = true;
    if (scenario === 'missing') h.control.needMissing = true;
    if (scenario === 'mixed') h.candidate.potrebaRevizija = 99;
    const result = await h.read();
    assert.equal(result.ok, true); assert.equal(result.podatak.need, null); assert.equal(result.podatak.receipt, null);
    assert.equal(h.session.pending.reconciled, true); assert.equal(h.session.pending.candidate, null);
    assert.deepEqual(rpcNames(h), ['rpc_read_selection_result']);
    assert.deepEqual(JSON.parse(h.memory.get(storageKey())), savedRecord());
  }
});

test('storage rejection and silent failed write both prevent selection dispatch', async () => {
  for (const flag of ['failSet', 'silentSet']) {
    const h = harness(absent, { fresh: true, pending: false });
    await h.read(); h.control[flag] = true;
    const result = await h.choose();
    assert.equal(result.ok, false); assert.equal(result.kod, 'SELECTION_COMMAND_NOT_SAVED');
    assert.equal(h.calls.length, 0); assert.equal(h.memory.size, 0);
    assert.equal(h.session.pending.command.clientRequestId, command().clientRequestId);
  }
});

test('storage readback failure prevents dispatch while preserving the already written identity for restart', async () => {
  const h = harness(absent, { fresh: true, pending: false }); await h.read();
  h.control.storageHook = name => { if (name === 'setItem') h.control.failGet = true; };
  assert.equal((await h.choose()).kod, 'SELECTION_COMMAND_NOT_SAVED');
  assert.equal(h.calls.length, 0); assert.deepEqual(JSON.parse(h.memory.get(storageKey())), savedRecord());
  const after = harness(absent, { pending: false, memory: h.memory });
  assert.equal((await after.read()).podatak.receipt, null);
  assert.deepEqual(rpcNames(after), ['rpc_read_selection_result']); assert.equal(after.control.newKeys, 0);
});

test('a failed journal read blocks new selection without falling through to candidate reads', async () => {
  const h = harness(absent, { fresh: true, pending: false }); h.control.failGet = true;
  const result = await h.read();
  assert.equal(result.ok, false); assert.equal(result.kod, 'SELECTION_COMMAND_JOURNAL_READ_FAILED');
  assert.deepEqual(h.sourceCalls, []); assert.deepEqual(h.calls, []); assert.equal(h.control.newKeys, 0);
  assert.equal(await h.choose(), undefined); assert.equal(h.memory.size, 0);
});

test('corrupt, foreign, oversized and extra-field journals fail closed without deletion or RPC', async () => {
  const invalid = ['{broken', 'x'.repeat(2001), JSON.stringify(savedRecord({ accountId: ID(9) })),
    JSON.stringify(savedRecord({ needId: ID(9) })), JSON.stringify(savedRecord({ version: 2 })),
    JSON.stringify({ ...savedRecord(), profile: 'private data' }),
    JSON.stringify(savedRecord({ command: command({ mesta: 0 }) })),
    JSON.stringify(savedRecord({ command: command({ prijavaHash: 'invalid' }) })),
    JSON.stringify(savedRecord({ command: { ...command(), price: 600 } })),
    JSON.stringify(savedRecord({ command: command({ potrebaId: ID(9) }) }))];
  for (const raw of invalid) {
    const memory = new Map([[storageKey(), raw]]), h = harness(absent, { memory, pending: false });
    assert.equal((await h.read()).kod, 'SELECTION_COMMAND_JOURNAL_INVALID');
    assert.equal(h.session.pending, null); assert.equal(h.calls.length, 0); assert.equal(h.sourceCalls.length, 0);
    assert.equal(memory.get(storageKey()), raw); assert.equal(h.storageCalls.some(c => c.name === 'removeItem'), false);
    assert.equal(await h.choose(), undefined); assert.equal(h.control.newKeys, 0);
  }
});

test('a new account does not load, display, erase or resend the previous account selection', async () => {
  const memory = seeded(), h = harness(absent, { memory, pending: false, accountId: ID(9), accountRevision: 3 });
  assert.equal((await h.read()).ok, true); assert.equal(h.session.pending, null);
  assert.deepEqual(rpcNames(h), []); assert.equal(h.control.newKeys, 0);
  assert.equal(h.storageCalls.every(call => call.key === storageKey(ID(9))), true);
  assert.deepEqual(JSON.parse(memory.get(storageKey())), savedRecord());
});

test('logout/account change at every persistence await prevents the business write', async () => {
  for (const boundary of ['first-read', 'write', 'readback']) {
    for (const target of ['logout', 'other', 'same-again']) {
      const h = harness(absent, { fresh: true, pending: false }); await h.read();
      let gets = 0;
      h.control.storageHook = name => {
        if (name === 'getItem') gets++;
        if ((boundary === 'first-read' && name === 'getItem' && gets === 1)
          || (boundary === 'write' && name === 'setItem') || (boundary === 'readback' && name === 'getItem' && gets === 2)) {
          h.auth.user = target === 'logout' ? null : { id: target === 'other' ? ID(9) : ownerId };
          h.auth.accountRevision = target === 'same-again' ? 3 : 2;
        }
      };
      await h.choose();
      assert.equal(h.calls.length, 0, `${boundary}/${target}`);
      assert.equal(h.storageCalls.every(call => call.key === storageKey()), true);
    }
  }
});

test('a retained old callback cannot regain authority after A to B to A or a new focus generation', async () => {
  for (const change of [h => { h.auth.user = { id: ownerId }; h.auth.accountRevision += 2; },
    h => { h.session.focusToken += 2; }, h => { h.session.readRevision++; }]) {
    const h = harness(absent, { fresh: true, pending: false }); await h.read();
    const oldChoose = h.getChoose(), beforeStorage = h.storageCalls.length;
    change(h); assert.equal(await oldChoose(), undefined);
    assert.equal(h.calls.length, 0); assert.equal(h.control.newKeys, 0); assert.equal(h.storageCalls.length, beforeStorage);
  }
});

test('late restore and receipt retirement after logout cannot disclose a receipt or erase its journal', async () => {
  for (const boundary of [1, 2]) {
    const h = harness(found(), { pending: false, memory: seeded() }); let gets = 0;
    h.control.storageHook = name => {
      if (name === 'getItem' && ++gets === boundary) { h.auth.user = null; h.auth.accountRevision++; }
    };
    const result = await h.read(); assert.equal(result.ok, false);
    assert.deepEqual(JSON.parse(h.memory.get(storageKey())), savedRecord());
    assert.equal(h.storageCalls.some(call => call.name === 'removeItem'), false);
    assert.equal(h.session.pending?.result?.ok ?? false, false);
  }
});

test('a proven receipt stays true when local retirement fails; no new choice is admitted until it is retired', async () => {
  const h = harness(found({ agreementStatus: 'COMPLETED' }), { pending: false, memory: seeded() });
  h.control.failRemove = true;
  assert.equal((await h.read()).podatak.receipt.agreementStatus, 'COMPLETED');
  assert.equal(h.memory.size, 1); assert.ok(h.session.notice);
  assert.equal(await h.choose(), undefined); await h.reset();
  assert.notEqual(h.session.pending, null); assert.equal(h.memory.size, 1);
  h.control.failRemove = false;
  assert.equal((await h.read()).podatak.receipt.dogovorId, agreementId);
  assert.equal(h.memory.size, 0); assert.equal(h.calls.every(call => call.name === 'rpc_read_selection_result'), true);
});

test('a pending request cannot be retried before a successful exact read, nor after a transport-unknown read', async () => {
  const h = harness(absent, { pending: false, memory: seeded() });
  h.control.hook = () => { throw new Error('offline'); };
  assert.equal((await h.read()).ok, false); assert.equal(h.session.pending.reconciled, false);
  assert.equal(await h.choose(), undefined);
  assert.deepEqual(rpcNames(h), ['rpc_read_selection_result']); assert.equal(h.memory.size, 1);
  h.control.hook = null;
  assert.equal((await h.read()).ok, true); assert.equal(h.session.pending.reconciled, true);
  await h.choose(); assert.equal(rpcNames(h).filter(name => name === 'rpc_select_response').length, 1);
});

test('another retained screen command wins over a new local key and is loaded without being overwritten', async () => {
  const h = harness(absent, { fresh: true, pending: false }); await h.read();
  const other = savedRecord({ command: command({ clientRequestId: 'already-pending-selection' }) });
  await h.journal.save(other, h.current);
  assert.equal((await h.choose()).kod, 'SELECTION_COMMAND_NOT_SAVED');
  assert.equal(h.session.pending, null); assert.equal(h.calls.length, 0);
  assert.deepEqual(JSON.parse(h.memory.get(storageKey())), other);
  assert.equal((await h.read()).podatak.receipt, null);
  assert.equal(h.session.pending.command.clientRequestId, other.command.clientRequestId);
  assert.deepEqual(rpcNames(h), ['rpc_read_selection_result']);
});

test('same request key cannot change its reviewed revision, applicant, hash or people in storage', async () => {
  const h = harness(absent, { pending: false, memory: seeded() });
  for (const patch of [{ potrebaRevizija: 4 }, { prijavaId: ID(8) }, { prijavaVerzija: 3 }, { prijavaHash: 'b'.repeat(64) }, { mesta: 1 }]) {
    await assert.rejects(h.journal.save(savedRecord({ command: command(patch) }), h.current), /SELECTION_COMMAND_PAYLOAD_CHANGED/);
  }
  assert.deepEqual(JSON.parse(h.memory.get(storageKey())), savedRecord());
  const parsed = h.journalModule.parseSelectionCommand(h.memory.get(storageKey()), ownerId, needId);
  assert.equal(Object.isFrozen(parsed.command), true);
  assert.deepEqual(Object.keys(parsed.command).sort(), ['clientRequestId', 'mesta', 'potrebaId', 'potrebaRevizija', 'prijavaHash', 'prijavaId', 'prijavaVerzija'].sort());
  assert.equal(/1200|HOURLY|ime|napomena|lokacija/.test(h.memory.get(storageKey())), false, 'no private offer or mutable display data is retained');
});

test('serialized retirement cannot erase a newer saved intent and verifies actual removal', async () => {
  const h = harness(absent, { pending: false, memory: seeded() });
  const entered = deferred(), release = deferred();
  h.control.storageHook = async name => { if (name === 'removeItem') { entered.resolve(); await release.promise; } };
  const clearing = h.journal.clear(savedRecord(), h.current); await entered.promise;
  const newer = savedRecord({ command: command({ clientRequestId: 'newer-selection-request' }) });
  const saving = h.journal.save(newer, h.current);
  release.resolve(); assert.equal(await clearing, true); await saving;
  assert.deepEqual(JSON.parse(h.memory.get(storageKey())), newer);
  assert.equal(await h.journal.clear(savedRecord(), h.current), false);
  h.control.silentRemove = true;
  assert.equal(await h.journal.clear(newer, h.current), false);
  assert.deepEqual(JSON.parse(h.memory.get(storageKey())), newer);
});

test('a hung journal load ends after five seconds and a late value cannot restore or send a command', async () => {
  const clock = controlledClock(), h = harness(found(), { pending: false, memory: seeded(), clock });
  const entered = deferred(), release = deferred();
  h.control.storageHook = async name => { if (name === 'getItem') { entered.resolve(); await release.promise; } };
  const reading = observe(h.read()); await entered.promise;
  try {
    await clock.tick(4999); assert.equal(reading.state, 'PENDING');
    await clock.tick(1); assert.equal(reading.state, 'FULFILLED');
    assert.equal(reading.value.kod, 'SELECTION_COMMAND_JOURNAL_READ_FAILED');
    assert.equal(h.session.reading, false); assert.equal(h.session.pending, null);
    assert.deepEqual(h.calls, []); assert.deepEqual(h.sourceCalls, []);
    assert.equal(await h.choose(), undefined); assert.equal(h.control.newKeys, 0);
    release.resolve(); await flush();
    assert.equal(h.session.pending, null); assert.deepEqual(h.calls, []);
    assert.deepEqual(JSON.parse(h.memory.get(storageKey())), savedRecord());
    assert.equal(clock.active(), 0);
  } finally { release.resolve(); await flush(); }
});

test('a hung save pre-read never reaches device mutation or the selection writer after expiry', async () => {
  const clock = controlledClock(), h = harness(absent, { pending: false, fresh: true, clock }); await h.read();
  const entered = deferred(), release = deferred();
  const before = h.storageCalls.length;
  h.control.storageHook = async name => { if (name === 'getItem') { entered.resolve(); await release.promise; } };
  const choosing = observe(h.choose()); await entered.promise;
  try {
    await clock.tick(5000); assert.equal(choosing.state, 'FULFILLED');
    assert.equal(choosing.value.kod, 'SELECTION_COMMAND_NOT_SAVED');
    assert.equal(h.control.busy, false); assert.equal(h.control.uncertain, true); assert.equal(h.session.pending.inFlight, false);
    assert.equal(await h.choose(), undefined); assert.deepEqual(h.calls, []);
    release.resolve(); await flush();
    assert.deepEqual(h.storageCalls.slice(before).map(call => call.name), ['getItem']);
    assert.equal(h.memory.size, 0); assert.deepEqual(h.calls, []); assert.equal(clock.active(), 0);
  } finally { release.resolve(); await flush(); }
});

test('a hung native set keeps its original identity but never dispatches when it completes after timeout', async () => {
  const clock = controlledClock(), h = harness(absent, { pending: false, fresh: true, clock }); await h.read();
  const entered = deferred(), release = deferred();
  h.control.storageHook = async name => { if (name === 'setItem') { entered.resolve(); await release.promise; } };
  const choosing = observe(h.choose()); await entered.promise;
  try {
    await clock.tick(5000); assert.equal(choosing.state, 'FULFILLED');
    assert.equal(choosing.value.kod, 'SELECTION_COMMAND_NOT_SAVED');
    assert.equal(h.memory.size, 0); assert.deepEqual(h.calls, []);
    const beforeLate = h.storageCalls.length;
    release.resolve(); await flush();
    assert.deepEqual(JSON.parse(h.memory.get(storageKey())), savedRecord(), 'already-issued native write may finish; its immutable identity survives');
    assert.equal(h.storageCalls.length, beforeLate, 'expired operation cannot start a readback');
    assert.deepEqual(h.calls, []); assert.equal(await h.choose(), undefined);
    assert.equal((await h.read()).podatak.receipt, null);
    assert.deepEqual(rpcNames(h), ['rpc_read_selection_result'], 'checking after expiry remains read-only');
    assert.equal(h.control.newKeys, 1); assert.equal(clock.active(), 0);
  } finally { release.resolve(); await flush(); }
});

test('a hung saved-command readback is bounded and late success cannot trigger the business writer', async () => {
  const clock = controlledClock(), h = harness(absent, { pending: false, fresh: true, clock }); await h.read();
  const entered = deferred(), release = deferred(); let gets = 0;
  h.control.storageHook = async name => { if (name === 'getItem' && ++gets === 2) { entered.resolve(); await release.promise; } };
  const choosing = observe(h.choose()); await entered.promise;
  try {
    await clock.tick(5000); assert.equal(choosing.state, 'FULFILLED');
    assert.equal(choosing.value.kod, 'SELECTION_COMMAND_NOT_SAVED');
    assert.deepEqual(JSON.parse(h.memory.get(storageKey())), savedRecord());
    release.resolve(); await flush();
    assert.deepEqual(h.calls, []); assert.equal(h.session.pending.result.ok, false);
    assert.equal(await h.choose(), undefined); assert.equal(clock.active(), 0);
  } finally { release.resolve(); await flush(); }
});

test('a confirmed server receipt opens its Agreement when native removal hangs', async () => {
  const clock = controlledClock(), h = harness(found(), { pending: false, memory: seeded(), clock });
  const entered = deferred(), release = deferred();
  h.control.storageHook = async name => { if (name === 'removeItem') { entered.resolve(); await release.promise; } };
  const reading = observe(h.read()); await entered.promise;
  try {
    assert.deepEqual(rpcNames(h), ['rpc_read_selection_result']);
    await clock.tick(5000); assert.equal(reading.state, 'FULFILLED');
    assert.equal(reading.value.podatak.receipt.dogovorId, agreementId);
    assert.equal(h.session.pending.result.ok, true); assert.equal(h.session.reading, false);
    assert.equal(h.session.notice, 'Izbor je potvrđen, ali zapis na telefonu još nije uklonjen. Možete otvoriti Dogovor ili ponoviti proveru.');
    assert.equal(h.memory.size, 1); assert.equal(await h.choose(), undefined);
    h.openAgreement(); assert.equal(h.events.at(-1), 'navigate');
    const beforeLate = h.storageCalls.length;
    release.resolve(); await flush();
    assert.equal(h.memory.size, 0); assert.equal(h.storageCalls.length, beforeLate, 'late clear cannot start another read');
    assert.deepEqual(rpcNames(h), ['rpc_read_selection_result']); assert.equal(clock.active(), 0);
  } finally { release.resolve(); await flush(); }
});

test('a successful explicit selection also returns its receipt when local cleanup stalls', async () => {
  const clock = controlledClock(), h = harness(absent, { pending: false, fresh: true, clock }); await h.read();
  const entered = deferred(), release = deferred();
  h.control.storageHook = async name => { if (name === 'removeItem') { entered.resolve(); await release.promise; } };
  const choosing = observe(h.choose()); await entered.promise;
  try {
    await clock.tick(5000); assert.equal(choosing.state, 'FULFILLED');
    assert.equal(choosing.value.podatak.receipt.dogovorId, agreementId);
    assert.equal(h.control.busy, false); assert.equal(h.control.uncertain, false); assert.ok(h.session.notice);
    assert.equal(await h.choose(), undefined); h.openAgreement(); assert.equal(h.events.at(-1), 'navigate');
    release.resolve(); await flush();
    assert.deepEqual(rpcNames(h), ['rpc_select_response']); assert.equal(clock.active(), 0);
  } finally { release.resolve(); await flush(); }
});

test('queued load, save and clear each expire from enqueue time and never run after the blocked predecessor', async () => {
  const clock = controlledClock(), h = harness(absent, { pending: false, clock });
  const entered = deferred(), release = deferred();
  h.control.storageHook = async name => { if (name === 'getItem') { entered.resolve(); await release.promise; } };
  const blocked = observe(h.journal.load(ownerId, needId, h.current)); await entered.promise;
  await clock.tick(1000);
  const queued = [observe(h.journal.load(ownerId, needId, h.current)),
    observe(h.journal.save(savedRecord(), h.current)), observe(h.journal.clear(savedRecord(), h.current))];
  try {
    await clock.tick(4000); assert.equal(blocked.state, 'REJECTED');
    assert.match(blocked.error.message, /SELECTION_COMMAND_JOURNAL_TIMEOUT/);
    assert.equal(queued.every(operation => operation.state === 'PENDING'), true);
    await clock.tick(1000);
    for (const operation of queued) {
      assert.equal(operation.state, 'REJECTED'); assert.match(operation.error.message, /SELECTION_COMMAND_JOURNAL_TIMEOUT/);
    }
    assert.deepEqual(h.storageCalls.map(call => call.name), ['getItem']);
    release.resolve(); await flush();
    assert.deepEqual(h.storageCalls.map(call => call.name), ['getItem'], 'expired queued operations lose authority before any native call');
    assert.equal(h.memory.size, 0); assert.deepEqual(h.calls, []);
    h.control.storageHook = null; await h.journal.save(savedRecord(), h.current);
    assert.deepEqual(JSON.parse(h.memory.get(storageKey())), savedRecord()); assert.equal(clock.active(), 0);
  } finally { release.resolve(); await flush(); }
});

test('timeout does not unlock an in-flight native remove ahead of a newer saved intent', async () => {
  const clock = controlledClock(), h = harness(absent, { pending: false, memory: seeded(), clock });
  const entered = deferred(), release = deferred();
  h.control.storageHook = async name => { if (name === 'removeItem') { entered.resolve(); await release.promise; } };
  const clearing = observe(h.journal.clear(savedRecord(), h.current)); await entered.promise;
  try {
    await clock.tick(5000); assert.equal(clearing.state, 'REJECTED');
    const nativeCalls = h.storageCalls.length;
    const newer = savedRecord({ command: command({ clientRequestId: 'newer-after-timeout' }) });
    const saving = observe(h.journal.save(newer, h.current)); await clock.tick(1000);
    assert.equal(saving.state, 'PENDING'); assert.equal(h.storageCalls.length, nativeCalls);
    assert.deepEqual(JSON.parse(h.memory.get(storageKey())), savedRecord());
    release.resolve(); await flush(); await saving.done;
    assert.equal(saving.state, 'FULFILLED'); assert.deepEqual(JSON.parse(h.memory.get(storageKey())), newer);
    assert.equal(await h.journal.clear(savedRecord(), h.current), false);
    assert.deepEqual(JSON.parse(h.memory.get(storageKey())), newer); assert.deepEqual(h.calls, []); assert.equal(clock.active(), 0);
  } finally { release.resolve(); await flush(); }
});

test('queued old-account work cannot regain authority after A to B to A and late native completion', async () => {
  const clock = controlledClock(), h = harness(absent, { pending: false, fresh: true, clock }); await h.read();
  const entered = deferred(), release = deferred();
  h.control.storageHook = async name => { if (name === 'setItem') { entered.resolve(); await release.promise; } };
  const choosing = observe(h.choose()); await entered.promise;
  const queued = observe(h.journal.clear(savedRecord(), h.current));
  try {
    await clock.tick(5000); assert.equal(choosing.state, 'FULFILLED'); assert.equal(queued.state, 'REJECTED');
    h.auth.user = { id: ID(9) }; h.auth.accountRevision = 2;
    h.auth.user = { id: ownerId }; h.auth.accountRevision = 3;
    const nativeCalls = h.storageCalls.length;
    release.resolve(); await flush();
    assert.equal(h.storageCalls.length, nativeCalls, 'no old readback or queued removal runs');
    assert.deepEqual(JSON.parse(h.memory.get(storageKey())), savedRecord());
    assert.deepEqual(h.calls, []); assert.equal(await h.choose(), undefined); assert.equal(clock.active(), 0);
    const restarted = harness(absent, { pending: false, fresh: true, memory: h.memory, accountRevision: 3 });
    assert.equal((await restarted.read()).podatak.receipt, null);
    assert.deepEqual(rpcNames(restarted), ['rpc_read_selection_result']); assert.equal(restarted.control.newKeys, 0);
  } finally { release.resolve(); await flush(); }
});

test('an elapsed deadline fences native continuation even before a delayed timer callback executes', async () => {
  const clock = controlledClock(), h = harness(absent, { pending: false, fresh: true, clock }); await h.read();
  const entered = deferred(), release = deferred();
  h.control.storageHook = async name => { if (name === 'getItem') { entered.resolve(); await release.promise; } };
  const before = h.storageCalls.length, choosing = observe(h.choose()); await entered.promise;
  try {
    clock.elapseWithoutCallbacks(5001); release.resolve(); await flush();
    assert.equal(choosing.state, 'FULFILLED'); assert.equal(choosing.value.kod, 'SELECTION_COMMAND_NOT_SAVED');
    assert.deepEqual(h.storageCalls.slice(before).map(call => call.name), ['getItem']);
    assert.deepEqual(h.calls, []); assert.equal(h.memory.size, 0); assert.equal(clock.active(), 0);
  } finally { release.resolve(); await flush(); }
});

test('a receipt read timeout cannot resend a previously checked request or adopt its late receipt', async () => {
  const clock = controlledClock(), h = harness(absent, { pending: false, memory: seeded(), fresh: true, clock });
  assert.equal((await h.read()).podatak.receipt, null);
  const entered = deferred(), release = deferred(); h.control.readResult = found();
  h.control.hook = async name => { if (name === 'rpc_read_selection_result') { entered.resolve(); await release.promise; } };
  const reading = observe(h.read()); await entered.promise;
  try {
    await clock.tick(15000); assert.equal(reading.state, 'FULFILLED'); assert.equal(reading.value.ok, false);
    assert.equal(h.control.data, null); assert.equal(h.session.reading, false); assert.equal(await h.choose(), undefined);
    release.resolve(); await flush();
    assert.equal(h.session.pending.result?.ok ?? false, false);
    assert.deepEqual(rpcNames(h), ['rpc_read_selection_result', 'rpc_read_selection_result']);
    assert.equal(h.storageCalls.some(call => call.name === 'removeItem'), false);
    assert.deepEqual(JSON.parse(h.memory.get(storageKey())), savedRecord()); assert.equal(clock.active(), 0);
  } finally { release.resolve(); await flush(); }
});

function recoveryPresentation() {
  const filename = 'src/ui/v2/ApplicationSelectionPresentation.tsx';
  const source = ts.createSourceFile(filename, fs.readFileSync(path.join(ROOT, filename), 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const node = source.statements.find(n => ts.isFunctionDeclaration(n) && n.name?.text === 'SelectionRecoveryPresentation');
  assert.ok(node);
  const js = compile(node.getText(source).replace(/^export /, '') + '\nmodule.exports = SelectionRecoveryPresentation;', filename);
  const module = { exports: {} }, jsx = (type, props) => ({ type, props });
  new Function('module', 'exports', 'require', 'Screen', 'ProductHeader', 'StateView', js)(module, module.exports,
    specifier => { assert.equal(specifier, 'react/jsx-runtime'); return { jsx, jsxs: jsx }; }, 'Screen', 'ProductHeader', 'StateView');
  return module.exports;
}

test('cold recovery controls keep read-only checks separate from explicit same-command replay', () => {
  const present = recoveryPresentation(); let reads = 0, writes = 0, opens = 0;
  const props = { receipt: null, busy: false, uncertain: true, refresh: () => reads++, resend: () => writes++,
    back: () => {}, openAgreement: () => opens++, error: null };
  const unknown = present(props).props.children.props;
  assert.equal(unknown.primary.label, 'Proverite da li je izabrano'); unknown.primary.onPress();
  assert.equal(reads, 1); assert.equal(writes, 0); assert.equal(unknown.quiet, undefined);
  const checked = present({ ...props, uncertain: false }).props.children.props;
  checked.quiet.onPress(); assert.equal(reads, 2); assert.equal(writes, 0);
  assert.equal(checked.primary.label, 'Pošaljite isti izbor ponovo'); checked.primary.onPress(); assert.equal(writes, 1);
  const busy = present({ ...props, uncertain: false, busy: true }).props.children.props;
  assert.equal(busy.primary.disabled, true); assert.equal(busy.quiet.disabled, true);
  for (const agreementStatus of ['CONFIRMED', 'COMPLETED', 'CANCELLED', 'SUPERSEDED']) {
    const confirmed = present({ ...props, receipt: { dogovorId: agreementId, agreementStatus } }).props.children.props;
    assert.equal(confirmed.title, 'Izbor je sačuvan'); assert.equal(confirmed.primary.label, 'Otvorite Dogovor');
    confirmed.primary.onPress(); assert.equal(confirmed.quiet, undefined);
    assert.equal(/1200|600|Dogovoreno!|preostalo/.test(confirmed.body), false);
  }
  assert.equal(opens, 4); assert.equal(writes, 1);
});
