'use strict';
// Shared behavioral seam: execute production TS, including the native storage
// journal and actual Candidates callbacks. Each harness has fresh module state;
// only its optional AsyncStorage map survives a simulated process restart.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const ROOT = path.resolve(__dirname, '..');
const ROUTE = 'src/app/(app)/potrebe/[id]/kandidati.tsx';
const ID = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const ownerId = ID(1), needId = ID(2), responseId = ID(3), agreementId = ID(4);
const command = (patch = {}) => Object.freeze({ potrebaId: needId, potrebaRevizija: 3, prijavaId: responseId,
  prijavaVerzija: 2, prijavaHash: 'a'.repeat(64), mesta: 2, clientRequestId: 'r07-selection-original', ...patch });
const savedRecord = (patch = {}) => ({ version: 1, accountId: ownerId, needId, command: command(), ...patch });
const storageKey = (account = ownerId, need = needId) => `uskoci.selection.command.v1.${account}.${need}`;
const found = (patch = {}) => ({ schema: 'SELECTION_RESULT_V1', authoritative: true, found: true, result: {
  agreementId, agreementStatus: 'CONFIRMED', needId, needRevision: 3, responseId, responseVersion: 2,
  contentHash: 'a'.repeat(64), coveredSlots: 2, clientRequestId: 'r07-selection-original', ...patch,
} });
const absent = { schema: 'SELECTION_RESULT_V1', authoritative: true, found: false, result: null };
function compile(source, fileName = 'test.ts') {
  const output = ts.transpileModule(source, { fileName, reportDiagnostics: true, compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } });
  assert.deepEqual((output.diagnostics ?? []).filter(d => d.category === ts.DiagnosticCategory.Error), []);
  return output.outputText;
}
function evaluate(source, environment, fileName) {
  const module = { exports: {} };
  new Function('module', ...Object.keys(environment), compile(source, fileName))(module, ...Object.values(environment));
  return module.exports;
}
function deferred() {
  let resolve; const promise = new Promise(done => { resolve = done; });
  return { promise, resolve };
}
function harness(wireResult = found(), options = {}) {
  const account = { accountId: options.accountId ?? ownerId, accountRevision: options.accountRevision ?? 1 };
  const auth = { user: { id: account.accountId }, accountRevision: account.accountRevision };
  const user = auth.user;
  const need = { id: needId, revizija: options.fresh ? 3 : 4 };
  const candidate = { prijavaId: responseId, potrebaRevizija: need.revizija,
    stanje: options.fresh ? 'SELECTABLE' : 'SELECTED', mozeIzabrati: !!options.fresh,
    verzija: 2, hash: 'a'.repeat(64), pokrivaMesta: 2, cena: { iznos: 1200 }, osnovaCene: 'HOURLY' };
  const original = { ok: false, kod: 'APPLICATION_SELECTION_UNCONFIRMED', poruka: 'Ishod nije potvrđen.' };
  const session = { readRevision: 0, focusToken: 1, reading: false, navigated: false, hardReload: false, resetting: false, notice: null,
    focused: true, active: true, pending: options.pending === false ? null
      : { command: command(), candidate, need: { ...need, revizija: 3 }, result: original, inFlight: false, reconciled: false } };
  const calls = [], sourceCalls = [], storageCalls = [], events = [];
  const memory = options.memory ?? new Map();
  const control = { hook: null, sourceHook: null, readResult: wireResult, selectError: null, selectThrows: false, saveOptions: null,
    sourceThrows: false, needMissing: false, candidates: null, storageHook: null, failGet: false, failSet: false,
    silentSet: false, failRemove: false, silentRemove: false, uncertain: false, busy: false, newKeys: 0,
    data: { need, candidates: [candidate], receipt: null }, refreshes: 0 };
  const storage = {
    async getItem(key) {
      storageCalls.push({ name: 'getItem', key }); events.push('getItem');
      if (control.storageHook) await control.storageHook('getItem', key);
      if (control.failGet) throw new Error('storage read unavailable');
      return memory.get(key) ?? null;
    },
    async setItem(key, value) {
      storageCalls.push({ name: 'setItem', key }); events.push('setItem');
      if (control.storageHook) await control.storageHook('setItem', key);
      if (control.failSet) throw new Error('storage full');
      if (!control.silentSet) memory.set(key, value);
    },
    async removeItem(key) {
      storageCalls.push({ name: 'removeItem', key }); events.push('removeItem');
      if (control.storageHook) await control.storageHook('removeItem', key);
      if (control.failRemove) throw new Error('storage removal unavailable');
      if (!control.silentRemove) memory.delete(key);
    },
  };
  const wire = { async rpc(name, args) {
    calls.push({ name, args }); events.push(name);
    if (control.hook) await control.hook(name, args);
    if (name === 'rpc_read_selection_result') return { data: structuredClone(control.readResult), error: null };
    if (name === 'rpc_select_response') {
      if (control.selectThrows) throw new Error('connection ended after server commit');
      return control.selectError ? { data: null, error: control.selectError } : { data: agreementId, error: null };
    }
    throw new Error('Unexpected RPC ' + name);
  } };
  const stubs = {
    'src/data/supabaseClient.ts': { supabaseKlijent: () => wire },
    'src/store/sesija.ts': { sesijaSada: () => auth },
  };
  const cache = new Map();
  function load(relative) {
    if (stubs[relative]) return stubs[relative];
    if (cache.has(relative)) return cache.get(relative).exports;
    const filename = path.join(ROOT, relative), module = { exports: {} }; cache.set(relative, module);
    const requireLocal = specifier => {
      if (specifier === '@react-native-async-storage/async-storage') return { __esModule: true, default: storage };
      if (!specifier.startsWith('.')) return require(specifier);
      const base = path.resolve(path.dirname(filename), specifier);
      const resolved = ['', '.ts', '.tsx', '.js', '/index.ts'].map(s => base + s).find(p => fs.existsSync(p) && fs.statSync(p).isFile());
      assert.ok(resolved, relative + ': ' + specifier);
      return load(path.relative(ROOT, resolved).replaceAll(path.sep, '/'));
    };
    // Tests may control only the scheduler/clock; production module bodies and
    // their queue, deadline and account guards run unchanged.
    new Function('require', 'module', 'exports', 'setTimeout', 'clearTimeout', 'Date',
      compile(fs.readFileSync(filename, 'utf8'), filename))(requireLocal, module, module.exports,
      options.clock?.setTimeout ?? setTimeout, options.clock?.clearTimeout ?? clearTimeout, options.clock?.Date ?? Date);
    return module.exports;
  }
  const service = load('src/data/applicationSelectionClientService.ts');
  const journalModule = load('src/data/selectionCommandJournal.ts'), journal = journalModule.selectionCommandJournal;
  const source = ts.createSourceFile(ROUTE, fs.readFileSync(path.join(ROOT, ROUTE), 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const helpers = ['recoverPendingSelection', 'retirePendingSelection'].map(name => {
    const node = source.statements.find(n => ts.isFunctionDeclaration(n) && n.name?.text === name);
    assert.ok(node, name); return node.getText(source);
  }).join('\n');
  const constants = ['NOT_SAVED_ON_DEVICE', 'NOT_RETIRED_ON_DEVICE', 'STALE_REVIEW_MESSAGE'].map(name => {
    const node = source.statements.find(n => ts.isVariableStatement(n) && n.declarationList.declarations.some(d => d.name.getText(source) === name));
    assert.ok(node, name); return node.getText(source);
  }).join('\n');
  const component = source.statements.find(n => ts.isFunctionDeclaration(n) && n.name?.text === 'Kandidati');
  const nodes = {};
  function visit(node) {
    if (ts.isVariableDeclaration(node) && ['read', 'choose', 'resetPending', 'openAgreement'].includes(node.name.getText(source))) {
      nodes[node.name.getText(source)] = ts.isCallExpression(node.initializer) ? node.initializer.arguments[0] : node.initializer;
    }
    ts.forEachChild(node, visit);
  }
  visit(component); for (const name of ['read', 'choose', 'resetPending', 'openAgreement']) assert.ok(nodes[name], name);
  const currentAccount = () => auth.user?.id === account.accountId && auth.accountRevision === account.accountRevision;
  const izvor = {
    async potreba() { sourceCalls.push('need'); if (control.sourceHook) await control.sourceHook(); if (control.sourceThrows) throw new Error('task unavailable'); return control.needMissing ? null : need; },
    async prijaveZaPotrebu() { sourceCalls.push('candidates'); if (control.sourceThrows) throw new Error('candidates unavailable'); return control.candidates ?? [candidate]; },
    izaberiPrijavu: service.applicationSelectionClientService.izaberiPrijavu,
  };
  let read;
  const bindings = () => {
    const focus = session.focusToken, generation = session.readRevision;
    const current = () => currentAccount() && session.focused && session.active && session.focusToken === focus && session.readRevision === generation;
    return { session, id: needId, izvor, pager: null, boundedApplicationSelectionRead: service.boundedApplicationSelectionRead,
      readSelectionResult: service.readSelectionResult, selectionCommandJournal: journal,
      currentAccount, user, accountRevision: account.accountRevision, current, NO_ROWS: [],
      candidate: session.pending ? session.pending.candidate : candidate, pending: session.pending,
      data: control.data, render: () => {}, setOpened: () => {}, router: { replace: () => events.push('navigate') },
      noviZahtevId: () => { control.newKeys++; return 'r07-selection-original'; },
      conclusiveSelectionRefusal: service.conclusiveSelectionRefusal,
      editor: { uncertain: control.uncertain, busy: control.busy,
        async refresh() { control.refreshes++; return read(); },
        async save(work, options) {
          if (control.busy || control.uncertain) return;
          control.busy = true; control.saveOptions = options;
          try {
            const result = await work();
            if (current()) {
              if (result.ok) control.data = result.podatak;
              control.uncertain = !result.ok && !options?.settledFailure?.(result);
            }
            return result;
          } finally { control.busy = false; }
        },
      },
    };
  };
  const callback = name => evaluate(constants + '\n' + helpers + '\nmodule.exports = ' + nodes[name].getText(source) + ';', bindings());
  read = async () => {
    const result = await callback('read')();
    if (result.ok) { control.data = result.podatak; control.uncertain = false; }
    else control.data = null; // useOwnedEditor removes data after an explicit failed read.
    return result;
  };
  return { account, auth, need, candidate, session, calls, sourceCalls, storageCalls, memory, events, control, service, journal, journalModule,
    read, choose: () => callback('choose')(), reset: () => callback('resetPending')(), getChoose: () => callback('choose'),
    openAgreement: () => callback('openAgreement')(), original,
    current: () => currentAccount() && session.active && session.focused,
  };
}
module.exports = { ROOT, ROUTE, ID, ownerId, needId, responseId, agreementId, command, savedRecord, storageKey, found, absent, compile, evaluate, deferred, harness };
