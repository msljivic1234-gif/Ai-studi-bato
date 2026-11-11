'use strict';
// Real submit/read adapters and ownership fences, with only RPC transport and
// the active account replaced. This is client contract evidence, not live RLS.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const ROOT = path.resolve(__dirname, '..');
const ID = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const ownerId = ID(1), needId = ID(2), profileId = ID(3), responseId = ID(4);
const command = (patch = {}) => ({ potrebaId: needId, potrebaRevizija: 3, radnikProfilId: profileId,
  pokrivenaMesta: 2, cenaRsd: 1200, predlozeniPocetak: null, predlozeniKraj: null,
  napomena: '  Samo utovar.  ', clientRequestId: 'r07-receipt-review-1', ...patch });
const receipt = (patch = {}) => ({ responseId, applicationId: responseId, version: 1, needRevision: 3,
  contentHash: 'a'.repeat(64), status: 'SUBMITTED', pricingMode: 'MY_PRICE', coveredSlots: 2,
  snapshotSchema: 'APPLICATION_V1_SELF_DECLARED', authoritative: true, idempotentReplay: false,
  applicationPriceBasis: 'HOURLY', currency: 'RSD', priceRsd: 1200, ...patch });
function legacyReceipt() {
  const value = receipt({ idempotentReplay: true });
  delete value.applicationPriceBasis; delete value.currency; delete value.priceRsd;
  return value;
}
function harness(result, options = {}) {
  const account = { accountId: ownerId, accountRevision: 1 };
  const session = { user: { id: ownerId }, accountRevision: 1 };
  const calls = [];
  const wire = { rpc: async (name, args) => {
    calls.push({ name, args });
    if (options.afterDispatch) await options.afterDispatch(session);
    return typeof result === 'function' ? result(name, args) : { data: structuredClone(result), error: null };
  } };
  const stubs = {
    'src/data/supabaseClient.ts': { supabaseKlijent: () => wire },
    'src/store/sesija.ts': { sesijaSada: () => session },
  };
  const cache = new Map();
  function load(relative) {
    if (stubs[relative]) return stubs[relative];
    if (cache.has(relative)) return cache.get(relative).exports;
    const filename = path.join(ROOT, relative);
    const module = { exports: {} }; cache.set(relative, module);
    const compiled = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
      fileName: filename, reportDiagnostics: true,
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    });
    assert.deepEqual((compiled.diagnostics ?? []).filter(item => item.category === ts.DiagnosticCategory.Error), []);
    const localRequire = specifier => {
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
  return { ...load('src/data/applicationSelectionClientService.ts'), account, session, calls };
}

test('fresh hourly receipt confirms exactly 1200 RSD for the reviewed two-person offer', async () => {
  const h = harness(receipt());
  const result = await h.applicationSelectionClientService.podnesiPrijavu(command());
  assert.equal(result.ok, true);
  assert.deepEqual(result.podatak, { prijavaId: responseId, verzija: 1, hash: 'a'.repeat(64), osnovaCene: 'HOURLY' });
  assert.equal(h.calls[0].args.p_price_rsd, 1200);
  assert.equal(h.calls[0].args.p_covered_slots, 2);
});

test('fresh receipt cannot confirm another amount, a missing amount or another currency', async () => {
  for (const patch of [{ priceRsd: 9999 }, { priceRsd: undefined }, { priceRsd: '1200' },
    { currency: 'EUR' }, { currency: undefined }, { currency: null }]) {
    const h = harness(receipt(patch));
    const result = await h.applicationSelectionClientService.podnesiPrijavu(command());
    assert.equal(result.ok, false, JSON.stringify(patch));
    assert.equal(result.kod, 'APPLICATION_SELECTION_INVALID_RECEIPT');
  }
});

test('fresh receipt requires a known explicit application unit', async () => {
  for (const applicationPriceBasis of [undefined, null, 'PER_PERSON', 'HOURLY_TEAM']) {
    const h = harness(receipt({ applicationPriceBasis }));
    const result = await h.applicationSelectionClientService.podnesiPrijavu(command());
    assert.equal(result.ok, false);
    assert.equal(result.kod, 'APPLICATION_SELECTION_INVALID_RECEIPT');
  }
});

test('OFFERS confirms a reviewed total and cannot silently become an hourly offer', async () => {
  const valid = harness(receipt({ pricingMode: 'OFFERS', applicationPriceBasis: 'TOTAL' }));
  assert.equal((await valid.applicationSelectionClientService.podnesiPrijavu(command())).ok, true);
  const invalid = harness(receipt({ pricingMode: 'OFFERS', applicationPriceBasis: 'HOURLY' }));
  assert.equal((await invalid.applicationSelectionClientService.podnesiPrijavu(command())).ok, false);
});

test('a known idempotent replay must still match the original command amount', async () => {
  const good = harness(receipt({ idempotentReplay: true }));
  assert.equal((await good.applicationSelectionClientService.podnesiPrijavu(command())).ok, true);
  const bad = harness(receipt({ idempotentReplay: true, priceRsd: 9999 }));
  assert.equal((await bad.applicationSelectionClientService.podnesiPrijavu(command())).ok, false);
});

test('legacy submit replay is review-required, never a confirmed TOTAL or a conclusive refusal', async () => {
  const h = harness(legacyReceipt());
  const result = await h.applicationSelectionClientService.podnesiPrijavu(command());
  assert.equal(result.ok, false);
  assert.equal(result.kod, 'APPLICATION_PRICE_BASIS_REVIEW_REQUIRED');
  assert.equal(h.conclusiveApplicationRefusal(result), false);
});

test('old metadata shape without replay evidence cannot be accepted as legacy history', async () => {
  const h = harness({ ...legacyReceipt(), idempotentReplay: false });
  const result = await h.applicationSelectionClientService.podnesiPrijavu(command());
  assert.equal(result.ok, false);
  assert.equal(result.kod, 'APPLICATION_SELECTION_INVALID_RECEIPT');
});

test('read-only recovery returns a known exact receipt without submitting again', async () => {
  const h = harness({ found: true, authoritative: true, result: receipt({ idempotentReplay: true }) });
  const result = await h.readApplicationSubmitResult(command(), h.account);
  assert.equal(result.ok, true);
  assert.equal(result.podatak.state, 'CONFIRMED');
  assert.equal(result.podatak.receipt.osnovaCene, 'HOURLY');
  assert.deepEqual(h.calls.map(call => call.name), ['rpc_read_response_submit_result']);
  assert.deepEqual(h.calls[0].args, { p_need_id: needId, p_need_revision: 3, p_worker_profile_id: profileId,
    p_covered_slots: 2, p_price_rsd: 1200, p_proposed_start_at: null, p_proposed_end_at: null,
    p_scope_note: '  Samo utovar.  ', p_client_request_id: 'r07-receipt-review-1' });
});

test('read-only legacy recovery proves existence without inventing price metadata', async () => {
  const h = harness({ found: true, authoritative: true, result: legacyReceipt() });
  const result = await h.readApplicationSubmitResult(command(), h.account);
  assert.equal(result.ok, true);
  assert.deepEqual(result.podatak, { state: 'LEGACY_REVIEW_REQUIRED',
    receipt: { prijavaId: responseId, verzija: 1, hash: 'a'.repeat(64) } });
  assert.equal(Object.hasOwn(result.podatak.receipt, 'osnovaCene'), false);
});

test('a not-found read is only NOT_FOUND and provides no receipt or write', async () => {
  const h = harness({ found: false, authoritative: true });
  const result = await h.readApplicationSubmitResult(command(), h.account);
  assert.deepEqual(result, { ok: true, podatak: { state: 'NOT_FOUND' } });
  assert.deepEqual(h.calls.map(call => call.name), ['rpc_read_response_submit_result']);
});

test('recovery rejects malformed, nonauthoritative or contradictory envelopes', async () => {
  for (const wire of [null, { found: true, authoritative: false, result: legacyReceipt() },
    { found: 'true', authoritative: true, result: legacyReceipt() },
    { found: false, authoritative: true, result: legacyReceipt() },
    { found: true, authoritative: true, result: receipt() }]) {
    const h = harness(wire);
    const result = await h.readApplicationSubmitResult(command(), h.account);
    assert.equal(result.ok, false);
    assert.equal(result.kod, 'APPLICATION_SUBMIT_RESULT_INVALID');
  }
});

test('recovery rejects a different amount, people, revision or mismatching identity', async () => {
  for (const patch of [{ priceRsd: 9999 }, { coveredSlots: 1 }, { needRevision: 2 },
    { applicationId: ID(8) }, { contentHash: 'bad' }]) {
    const h = harness({ found: true, authoritative: true, result: receipt({ idempotentReplay: true, ...patch }) });
    const result = await h.readApplicationSubmitResult(command(), h.account);
    assert.equal(result.ok, false);
    assert.equal(result.kod, 'APPLICATION_SUBMIT_RESULT_INVALID');
  }
});

test('partial monetary metadata is corruption, not a legacy escape hatch', async () => {
  for (const patch of [{ applicationPriceBasis: null }, { applicationPriceBasis: 'TOTAL' },
    { currency: 'RSD' }, { priceRsd: 1200 }, { currency: 'EUR' }]) {
    const h = harness({ found: true, authoritative: true, result: { ...legacyReceipt(), ...patch } });
    const result = await h.readApplicationSubmitResult(command(), h.account);
    assert.equal(result.ok, false);
    assert.equal(result.kod, 'APPLICATION_SUBMIT_RESULT_INVALID');
  }
});

test('a changed account cannot use the previous account recovery request', async () => {
  const h = harness({ found: true, authoritative: true, result: legacyReceipt() });
  h.session.user = { id: ID(9) }; h.session.accountRevision = 2;
  const result = await h.readApplicationSubmitResult(command(), h.account);
  assert.equal(result.ok, false);
  assert.equal(result.kod, 'AUTH_ACCOUNT_CHANGED');
  assert.equal(h.calls.length, 0);
});

test('late recovery response after account change cannot retire the old owner journal', async () => {
  const h = harness({ found: true, authoritative: true, result: legacyReceipt() }, {
    afterDispatch: session => { session.user = { id: ID(9) }; session.accountRevision = 2; },
  });
  const result = await h.readApplicationSubmitResult(command(), h.account);
  assert.equal(result.ok, false);
  assert.equal(result.kod, 'AUTH_ACCOUNT_CHANGED');
  assert.equal(h.calls.length, 1);
});

test('different key or payload is not replaced by the adapter during recovery', async () => {
  const h = harness(() => ({ data: null, error: { code: '22023', message: 'IDEMPOTENCY_KEY_REUSED' } }));
  const changed = command({ clientRequestId: 'different-request-key', cenaRsd: 1300 });
  const result = await h.readApplicationSubmitResult(changed, h.account);
  assert.equal(result.ok, false);
  assert.equal(h.calls[0].args.p_client_request_id, 'different-request-key');
  assert.equal(h.calls[0].args.p_price_rsd, 1300);
  assert.equal(h.calls.some(call => call.name === 'rpc_submit_response'), false);
});
