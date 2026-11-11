'use strict';
// Execute the route's real async recovery helper, its actual receipt reader and
// journal. Only AsyncStorage, RPC transport and the active account are mocked.
// No renderer, native device, real Auth or PostgREST proof is claimed here.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const ROOT = path.resolve(__dirname, '..');
const ROUTE = 'src/app/(app)/prilike/[id]/prijava.tsx';
const ID = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const accountId = ID(1), needId = ID(2), profileId = ID(3), responseId = ID(4);
const storageKey = (account = accountId, need = needId) => `uskoci.application.command.v1.${account}.${need}`;
const record = (basis = 'HOURLY', key = 'r07-recovery-request-one') => ({
  version: 1, accountId, needId, ...(basis === undefined ? {} : { applicationPriceBasis: basis }),
  command: { clientRequestId: key, potrebaId: needId, potrebaRevizija: 3, radnikProfilId: profileId,
    pokrivenaMesta: 2, cenaRsd: 1200, predlozeniPocetak: null, predlozeniKraj: null, napomena: '  Samo utovar.  ' },
});
function receipt(basis = 'HOURLY') {
  return { responseId, applicationId: responseId, version: 1, needRevision: 3, contentHash: 'a'.repeat(64),
    status: 'SUBMITTED', pricingMode: 'MY_PRICE', coveredSlots: 2, snapshotSchema: 'APPLICATION_V1_SELF_DECLARED',
    authoritative: true, idempotentReplay: true,
    ...(basis === null ? {} : { applicationPriceBasis: basis, currency: 'RSD', priceRsd: 1200 }) };
}
const found = (basis = 'HOURLY') => ({ found: true, authoritative: true, result: receipt(basis) });
function deferred() {
  let resolve; const promise = new Promise(done => { resolve = done; });
  return { promise, resolve };
}
function harness(wireResult = found()) {
  const account = { accountId, accountRevision: 1 };
  const session = { user: { id: accountId }, accountRevision: 1 };
  const lifecycle = { focused: true };
  const memory = new Map(), calls = [], storageCalls = [];
  const controls = { getHook: null, removeHook: null, rpcHook: null, tableResult: null,
    failRemove: false, silentRemove: false, failRpc: false };
  const storage = {
    async getItem(key) {
      storageCalls.push({ name: 'getItem', key });
      const value = memory.get(key) ?? null;
      if (controls.getHook) await controls.getHook(key);
      return value;
    },
    async setItem(key, value) { storageCalls.push({ name: 'setItem', key }); memory.set(key, value); },
    async removeItem(key) {
      storageCalls.push({ name: 'removeItem', key });
      if (controls.removeHook) await controls.removeHook(key);
      if (controls.failRemove) throw new Error('storage unavailable');
      if (!controls.silentRemove) memory.delete(key);
    },
  };
  const wire = { from(table) {
    const query = { table, fields: null, filters: [] }; calls.push({ name: 'table-read', query });
    return {
      select(fields) { query.fields = fields; return this; },
      eq(field, value) { query.filters.push([field, value]); return this; },
      async maybeSingle() { return { data: structuredClone(controls.tableResult), error: null }; },
    };
  }, async rpc(name, args) {
    calls.push({ name, args });
    assert.equal(name, 'rpc_read_response_submit_result', 'recovery may never dispatch the submit writer');
    if (controls.rpcHook) await controls.rpcHook(name, args);
    if (controls.failRpc) throw new Error('network unavailable');
    return { data: structuredClone(wireResult), error: null };
  } };
  const stubs = {
    'src/data/supabaseClient.ts': { supabaseKlijent: () => wire },
    'src/store/sesija.ts': { sesijaSada: () => session },
  };
  const cache = new Map();
  function load(relative) {
    if (stubs[relative]) return stubs[relative];
    if (cache.has(relative)) return cache.get(relative).exports;
    const filename = path.join(ROOT, relative), module = { exports: {} }; cache.set(relative, module);
    const compiled = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { fileName: filename, reportDiagnostics: true,
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } });
    assert.deepEqual((compiled.diagnostics ?? []).filter(item => item.category === ts.DiagnosticCategory.Error), []);
    const localRequire = specifier => {
      if (specifier === '@react-native-async-storage/async-storage') return { __esModule: true, default: storage };
      if (!specifier.startsWith('.')) return require(specifier);
      const base = path.resolve(path.dirname(filename), specifier);
      const resolved = ['', '.ts', '.tsx', '.js', '/index.ts'].map(suffix => base + suffix)
        .find(candidate => fs.existsSync(candidate) && fs.statSync(candidate).isFile());
      assert.ok(resolved, `${relative}: ${specifier}`);
      return load(path.relative(ROOT, resolved).replaceAll(path.sep, '/'));
    };
    new Function('require', 'module', 'exports', compiled.outputText)(localRequire, module, module.exports);
    return module.exports;
  }
  const journal = load('src/data/applicationCommandJournal.ts');
  const reader = load('src/data/applicationSelectionClientService.ts');
  const route = fs.readFileSync(path.join(ROOT, ROUTE), 'utf8');
  const source = ts.createSourceFile(ROUTE, route, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const helper = source.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === 'recoverSavedApplication');
  const message = source.statements.find(node => ts.isVariableStatement(node) && node.declarationList.declarations.some(item => item.name.getText(source) === 'NOT_RETIRED_ON_DEVICE'));
  assert.ok(helper && message, 'the actual route recovery helper and message must exist');
  const compiled = ts.transpileModule(message.getText(source) + '\n' + helper.getText(source) + '\nmodule.exports = recoverSavedApplication;', {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const module = { exports: {} };
  new Function('module', 'readApplicationSubmitResult', 'applicationCommandJournal', compiled)(module, reader.readApplicationSubmitResult, journal.applicationCommandJournal);
  // Execute the actual retry decision inside submit without instantiating a
  // React/native screen. A changed task revision must not fill an unknown unit.
  let currentPriceDeclaration, retryExpression;
  function visit(node) {
    if (ts.isVariableStatement(node) && node.declarationList.declarations.some(item => item.name.getText(source) === 'currentPriceBasis')) currentPriceDeclaration = node;
    if (ts.isBinaryExpression(node) && node.left.getText(source) === 'result' && ts.isConditionalExpression(node.right)
      && node.right.getText(source).includes('APPLICATION_PRICE_BASIS_REVIEW_REQUIRED')) retryExpression = node.right;
    ts.forEachChild(node, visit);
  }
  visit(source); assert.ok(currentPriceDeclaration && retryExpression, 'the actual retry decision must exist');
  const retryJs = ts.transpileModule('async function retryDecision(pending, data, izvor) {\n'
    + currentPriceDeclaration.getText(source) + '\nreturn ' + retryExpression.getText(source) + ';\n}\nmodule.exports = retryDecision;', {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const retryModule = { exports: {} }; new Function('module', retryJs)(retryModule);
  const current = () => lifecycle.focused && session.user?.id === account.accountId && session.accountRevision === account.accountRevision;
  return { recover: module.exports, retryDecision: retryModule.exports, ...journal, account, session, lifecycle, memory, calls, storageCalls, controls, current, load,
    seed: value => journal.applicationCommandJournal.save(value),
    removeCalls: () => storageCalls.filter(call => call.name === 'removeItem') };
}

test('known matching receipt retires exactly its journal using only the read RPC', async () => {
  const h = harness(), saved = record(); await h.seed(saved);
  const result = await h.recover(saved, h.account, h.current);
  assert.deepEqual(result, { ok: true, podatak: { applicationId: responseId } });
  assert.equal(h.memory.has(storageKey()), false);
  assert.deepEqual(h.calls.map(call => call.name), ['rpc_read_response_submit_result']);
  assert.equal(h.calls[0].args.p_client_request_id, saved.command.clientRequestId);
  assert.equal(h.calls[0].args.p_scope_note, saved.command.napomena);
  assert.equal(h.removeCalls().length, 1);
});

test('legacy receipt recovers the existing application without confirming a price unit', async () => {
  const h = harness(found(null)), saved = record(); delete saved.applicationPriceBasis; await h.seed(saved);
  const restored = await h.applicationCommandJournal.load(accountId, needId);
  assert.equal(Object.hasOwn(restored.record, 'applicationPriceBasis'), false);
  const result = await h.recover(restored.record, h.account, h.current);
  assert.deepEqual(result, { ok: true, podatak: { applicationId: responseId } });
  assert.equal(Object.hasOwn(result.podatak, 'osnovaCene'), false);
  assert.equal(h.memory.has(storageKey()), false);
});

test('unknown local metadata may retire after exact authoritative receipt, without consulting the current task', async () => {
  const h = harness(), saved = record(); delete saved.applicationPriceBasis; await h.seed(saved);
  const result = await h.recover(saved, h.account, h.current);
  assert.equal(result.ok, true);
  assert.equal(result.podatak.applicationId, responseId);
  assert.deepEqual(h.calls.map(call => call.name), ['rpc_read_response_submit_result']);
});

test('NOT_FOUND leaves the exact original journal and price untouched', async () => {
  for (const basis of ['HOURLY', null]) {
    const h = harness({ found: false, authoritative: true, result: null }), saved = record();
    if (basis === null) delete saved.applicationPriceBasis;
    await h.seed(saved); const before = h.memory.get(storageKey());
    const result = await h.recover(saved, h.account, h.current);
    assert.deepEqual(result, { ok: true, podatak: null });
    assert.equal(h.memory.get(storageKey()), before);
    assert.equal(h.removeCalls().length, 0);
  }
});

test('a known local/receipt unit mismatch cannot retire the request', async () => {
  const h = harness(found('HOURLY')), saved = record('TOTAL'); await h.seed(saved);
  const before = h.memory.get(storageKey());
  const result = await h.recover(saved, h.account, h.current);
  assert.equal(result.ok, false); assert.equal(result.kod, 'APPLICATION_SELECTION_INVALID_RECEIPT');
  assert.equal(h.memory.get(storageKey()), before); assert.equal(h.removeCalls().length, 0);
});

test('stale focus after the receipt read cannot clear or navigate', async () => {
  const h = harness(), saved = record(); await h.seed(saved);
  h.controls.rpcHook = () => { h.lifecycle.focused = false; };
  const result = await h.recover(saved, h.account, h.current);
  assert.equal(result.ok, false); assert.equal(result.kod, 'STALE_READ');
  assert.equal(h.memory.has(storageKey()), true); assert.equal(h.removeCalls().length, 0);
});

test('account switch during the receipt read preserves both accounts journals', async () => {
  const h = harness(), saved = record(); await h.seed(saved);
  const other = { ...record('TOTAL'), accountId: ID(9) }; await h.seed(other);
  const before = new Map(h.memory);
  h.controls.rpcHook = () => { h.session.user = { id: ID(9) }; h.session.accountRevision = 2; };
  const result = await h.recover(saved, h.account, h.current);
  assert.equal(result.ok, false); assert.equal(result.kod, 'STALE_READ');
  assert.deepEqual(h.memory, before); assert.equal(h.removeCalls().length, 0);
});

test('focus loss while the journal clear is queued prevents storage removal', async () => {
  const h = harness(), saved = record(); await h.seed(saved);
  h.controls.getHook = () => { h.lifecycle.focused = false; };
  const result = await h.recover(saved, h.account, h.current);
  assert.equal(result.ok, false);
  assert.equal(h.memory.has(storageKey()), true); assert.equal(h.removeCalls().length, 0);
});

test('a completed authorized clear followed by focus loss cannot return navigation success', async () => {
  const h = harness(), saved = record(); await h.seed(saved);
  h.controls.removeHook = () => { h.lifecycle.focused = false; };
  const result = await h.recover(saved, h.account, h.current);
  assert.equal(result.ok, false); assert.equal(result.kod, 'STALE_READ');
  assert.equal(h.memory.has(storageKey()), false);
  assert.equal(h.removeCalls().length, 1);
});

test('a newer request saved during the old receipt read cannot be removed by its late result', async () => {
  const h = harness(), saved = record(); await h.seed(saved);
  const gate = deferred(), dispatched = deferred();
  h.controls.rpcHook = async () => { dispatched.resolve(); await gate.promise; };
  const recovery = h.recover(saved, h.account, h.current); await dispatched.promise;
  assert.equal(await h.applicationCommandJournal.clear(accountId, needId, saved.command.clientRequestId), true);
  const newer = record('TOTAL', 'r07-recovery-request-two'); await h.seed(newer);
  gate.resolve(); const result = await recovery;
  assert.equal(result.ok, false); assert.equal(result.kod, 'APPLICATION_JOURNAL_RETIRE_FAILED');
  assert.equal((await h.applicationCommandJournal.load(accountId, needId)).record.command.clientRequestId, newer.command.clientRequestId);
  assert.equal(h.removeCalls().length, 1, 'only the intentional earlier clear removed anything');
});

test('clear readback must observe absence before recovery can succeed', async () => {
  const h = harness(), saved = record(); await h.seed(saved); h.controls.silentRemove = true;
  const result = await h.recover(saved, h.account, h.current);
  assert.equal(result.ok, false); assert.equal(result.kod, 'APPLICATION_JOURNAL_RETIRE_FAILED');
  assert.equal(h.memory.has(storageKey()), true);
});

test('storage failure keeps the original request and does not claim recovery', async () => {
  const h = harness(), saved = record(); await h.seed(saved); h.controls.failRemove = true;
  const before = h.memory.get(storageKey());
  const result = await h.recover(saved, h.account, h.current);
  assert.equal(result.ok, false); assert.equal(result.kod, 'APPLICATION_JOURNAL_RETIRE_FAILED');
  assert.equal(h.memory.get(storageKey()), before);
});

test('read failure or malformed receipt never reaches journal removal', async () => {
  for (const failure of ['transport', 'receipt']) {
    const h = harness({ found: true, authoritative: false, result: receipt() }), saved = record(); await h.seed(saved);
    h.controls.failRpc = failure === 'transport';
    const result = await h.recover(saved, h.account, h.current);
    assert.equal(result.ok, false);
    assert.equal(h.memory.has(storageKey()), true); assert.equal(h.removeCalls().length, 0);
  }
});

test('legacy omission survives parse and an identical journal save without a TOTAL default', async () => {
  const h = harness(), saved = record(); delete saved.applicationPriceBasis; await h.seed(saved);
  const restored = await h.applicationCommandJournal.load(accountId, needId);
  assert.equal(restored.state, 'PRESENT');
  assert.equal(Object.hasOwn(restored.record, 'applicationPriceBasis'), false);
  await h.applicationCommandJournal.save(restored.record);
  assert.equal(Object.hasOwn(JSON.parse(h.memory.get(storageKey())), 'applicationPriceBasis'), false);
  assert.equal(JSON.parse(h.memory.get(storageKey())).command.cenaRsd, 1200);
});

test('journal save cannot upgrade unknown metadata to TOTAL or HOURLY without a new reviewed intent', async () => {
  for (const applicationPriceBasis of ['TOTAL', 'HOURLY']) {
    const h = harness(), saved = record(); delete saved.applicationPriceBasis; await h.seed(saved);
    const before = h.memory.get(storageKey());
    await assert.rejects(h.applicationCommandJournal.save({ ...saved, applicationPriceBasis }), /APPLICATION_COMMAND_PAYLOAD_CHANGED/);
    assert.equal(h.memory.get(storageKey()), before);
  }
});

test('journal save cannot remove a known unit or mutate amount under the same request identity', async () => {
  const h = harness(), saved = record('TOTAL'); await h.seed(saved);
  const unknown = { ...saved }; delete unknown.applicationPriceBasis;
  const before = h.memory.get(storageKey());
  await assert.rejects(h.applicationCommandJournal.save(unknown), /APPLICATION_COMMAND_PAYLOAD_CHANGED/);
  await assert.rejects(h.applicationCommandJournal.save({ ...saved, command: { ...saved.command, cenaRsd: 600 } }), /APPLICATION_COMMAND_PAYLOAD_CHANGED/);
  assert.equal(h.memory.get(storageKey()), before);
});

test('clear serializes with a later save, so the old acknowledgement cannot erase the newer request', async () => {
  const h = harness(), saved = record(); await h.seed(saved);
  const entered = deferred(), gate = deferred();
  h.controls.removeHook = async () => { entered.resolve(); await gate.promise; };
  const clear = h.applicationCommandJournal.clear(accountId, needId, saved.command.clientRequestId); await entered.promise;
  const newer = record('TOTAL', 'r07-recovery-request-two'), queued = h.applicationCommandJournal.save(newer);
  gate.resolve(); assert.equal(await clear, true); await queued;
  const restored = await h.applicationCommandJournal.load(accountId, needId);
  assert.equal(restored.record.command.clientRequestId, newer.command.clientRequestId);
  assert.equal(restored.record.applicationPriceBasis, 'TOTAL');
});

test('reading another account key cannot expose or erase the original account journal', async () => {
  const h = harness(), saved = record(); await h.seed(saved);
  assert.deepEqual(await h.applicationCommandJournal.load(ID(9), needId), { state: 'ABSENT' });
  assert.equal(await h.applicationCommandJournal.clear(ID(9), needId, saved.command.clientRequestId), true);
  assert.equal(h.memory.has(storageKey()), true); assert.equal(h.removeCalls().length, 0);
});

test('legacy raw STALE can load its explicit price review only with unknown basis and exact ownership/revisions', async () => {
  const input = { prijavaId: responseId, potrebaId: needId, prijavaVerzija: 1,
    potrebaRevizija: 3, prijavaRevizija: 3, osnovicaZaProveru: true };
  const row = { id: responseId, need_id: needId, worker_account_id: accountId,
    current_version: 1, submitted_against_need_revision: 3, status: 'STALE', price_basis: null,
    proposed_start_at: null, proposed_end_at: null,
    needs: { id: needId, revision: 3, mode: 'MY_PRICE', requester_price_rsd: 1200, price_basis: 'HOURLY', required_slots: 5 } };
  const h = harness(); h.controls.tableResult = row;
  const service = h.load('src/data/myApplicationsClientService.ts');
  const result = await service.readExistingApplicationInterval(input);
  assert.equal(result.ok, true);
  assert.equal(result.podatak.pricing.osnovaCene, 'HOURLY');
  assert.equal(result.podatak.pricing.ponudjenaCena.iznos, 1200);
  assert.equal(h.calls[0].query.table, 'marketplace_responses');
  assert.match(h.calls[0].query.fields, /price_basis/);
  for (const [delta, inputDelta] of [
    [{ price_basis: 'HOURLY' }, {}], [{}, { osnovicaZaProveru: false }],
    [{ worker_account_id: ID(9) }, {}], [{ current_version: 2 }, {}],
    [{ submitted_against_need_revision: 2 }, {}], [{ needs: { ...row.needs, revision: 4 } }, {}],
  ]) {
    h.controls.tableResult = { ...row, ...delta };
    const rejected = await service.readExistingApplicationInterval({ ...input, ...inputDelta });
    assert.equal(rejected.ok, false);
    assert.equal(rejected.kod, 'APPLICATION_INTERVAL_CHANGED');
  }
  assert.equal(h.calls.some(call => call.name === 'rpc_submit_response'), false);
});

test('unknown pending unit never reaches submit, including after a task revision change', async () => {
  const h = harness(), saved = record(); let writes = 0;
  const writer = { async podnesiPrijavu() { writes++; return { ok: true, podatak: {} }; } };
  for (const revizija of [3, 4]) {
    const result = await h.retryDecision({ applicationPriceBasis: null, command: saved.command },
      { need: { revizija, rezimCene: 'MY_PRICE', osnovaCene: 'HOURLY' } }, writer);
    assert.equal(result.ok, false); assert.equal(result.kod, 'APPLICATION_PRICE_BASIS_REVIEW_REQUIRED');
  }
  assert.equal(writes, 0);
  const known = await h.retryDecision({ applicationPriceBasis: 'HOURLY', command: saved.command },
    { need: { revizija: 3, rezimCene: 'MY_PRICE', osnovaCene: 'HOURLY' } }, writer);
  assert.equal(known.ok, true); assert.equal(writes, 1);
});
