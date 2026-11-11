'use strict';
// Execute the actual Agreement service and receipt/decoder dependencies. Only
// Supabase transport, the current account and unrelated rating reads are mocked.
// This proves the client boundary, not real Auth/PostgREST or native rendering.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const ts = require('typescript');
const ROOT = path.resolve(__dirname, '..');
const SERVICE = 'src/data/agreementClientService.ts';
const ID = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const requester = ID(1), worker = ID(2), agreementId = ID(3), proposalId = ID(4);
const clone = value => structuredClone(value);

function workspace(terms = {}, options = {}) {
  const accountId = options.accountId ?? requester;
  const snapshot = {
    price_rsd: 1200, priceBasis: 'HOURLY', currency: 'RSD',
    covered_slots: 2, required_slots: 5, scope_note: 'Utovar i istovar nameštaja.',
    proposed_start_at: null, proposed_end_at: null,
    ...terms,
  };
  return {
    id: agreementId, needId: ID(5), applicationId: ID(6), currentVersion: 3,
    requesterAccountId: requester, workerAccountId: worker,
    requesterName: 'Milan', workerName: 'Petar', title: 'Pomoć pri selidbi',
    // A later parent change must not redefine the accepted people or price.
    requiredSlots: options.parentPeople ?? 1, priceBasis: 'TOTAL', priceRsd: 9900,
    executionMode: 'ON_SITE', status: 'CONFIRMED', agreementStatus: 'CONFIRMED',
    createdAt: '2026-11-07T09:00:00Z', terms: snapshot,
    actionState: {
      agreementId, agreementVersion: 3, accountId, authoritative: true,
      canProposeChange: true, canRespondChange: true, canWithdrawChange: true,
      canMarkWorkDone: true, canConfirmCompletion: true, canCancel: true,
      pendingChanges: options.proposedTerms ? [{
        id: proposalId, baseVersion: 3, proposedByAccountId: worker,
        createdAt: '2026-11-07T09:10:00Z', reason: 'Dogovorena dopuna.',
        proposedTerms: { ...snapshot, price_rsd: 1400, ...options.proposedTerms },
      }] : [],
    },
  };
}

function harness(raw, accountId = requester) {
  const account = { accountId, accountRevision: 1 };
  const session = { user: { id: accountId }, accountRevision: 1 };
  const calls = [];
  const transport = {
    auth: { getUser: async () => ({ data: { user: session.user }, error: null }) },
    rpc(name, args) {
      calls.push({ name, args });
      if (name === 'rpc_get_agreement_workspace') return Promise.resolve({ data: clone(raw), error: null });
      if (name === 'rpc_list_my_agreements_page') return Promise.resolve({ data: { items: [clone(raw)], hasMore: false }, error: null });
      if (name === 'rpc_respond_agreement_change') return Promise.resolve({ data: {
        proposalId, accepted: args.p_accept, agreementVersion: 3 + (args.p_accept ? 1 : 0), authoritative: true,
      }, error: null });
      if (name === 'rpc_cancel_agreement') return Promise.resolve({ data: null, error: null });
      throw new Error(`Unexpected RPC: ${name}`);
    },
  };
  const overrides = {
    'src/data/supabaseClient.ts': { supabaseKlijent: () => transport },
    'src/store/sesija.ts': { sesijaSada: () => session },
    'src/data/agreementRatingsRead.ts': {
      ratingReadOwnerCurrent: owner => owner.accountId === session.user.id && owner.accountRevision === session.accountRevision,
      withAgreementRatings: async rows => rows,
    },
  };
  const cache = new Map();
  function load(relative) {
    if (overrides[relative]) return overrides[relative];
    if (cache.has(relative)) return cache.get(relative).exports;
    const filename = path.join(ROOT, relative);
    const source = process.env.USKOCI_R07_AGREEMENT_PREIMAGE && relative === SERVICE
      ? execFileSync('git', ['show', `${process.env.USKOCI_R07_AGREEMENT_PREIMAGE}:${relative}`], { cwd: ROOT, encoding: 'utf8' })
      : fs.readFileSync(filename, 'utf8');
    const compiled = ts.transpileModule(source, { fileName: filename,
      compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS }, reportDiagnostics: true });
    const syntaxErrors = (compiled.diagnostics ?? []).filter(item => item.category === ts.DiagnosticCategory.Error);
    assert.deepEqual(syntaxErrors, [], `Syntax diagnostics in ${relative}`);
    const module = { exports: {} }; cache.set(relative, module);
    const localRequire = specifier => {
      if (!specifier.startsWith('.')) return require(specifier);
      const base = path.resolve(path.dirname(filename), specifier);
      const resolved = ['', '.ts', '.tsx', '.js', '/index.ts'].map(suffix => base + suffix)
        .find(candidate => fs.existsSync(candidate) && fs.statSync(candidate).isFile());
      assert.ok(resolved, `Unresolved local import ${specifier} in ${relative}`);
      return load(path.relative(ROOT, resolved).replaceAll(path.sep, '/'));
    };
    new Function('require', 'module', 'exports', compiled.outputText)(localRequire, module, module.exports);
    return module.exports;
  }
  return { ...load(SERVICE), account, calls };
}

test('accepted hourly amount, people and original task count survive a later parent edit', async () => {
  const h = harness(workspace());
  const row = await h.agreementClientService.dogovor(agreementId);
  assert.equal(row.cena.iznos, 1200);
  assert.equal(row.cena.valuta, 'RSD');
  assert.equal(row.osnovaCene, 'HOURLY');
  assert.deepEqual(row.pokrivenost, { ukupno: 5, popunjeno: 2, preostalo: 3, udeo: 0.4 });
  assert.equal(row.ucesnici.find(person => person.uloga === 'uskocer').mesta, 2);
  assert.equal(row.prihvacenObim, 'Utovar i istovar nameštaja.');
});

test('both participants and the paged list read the same frozen terms', async () => {
  for (const accountId of [requester, worker]) {
    const h = harness(workspace({}, { accountId, parentPeople: 10 }), accountId);
    const detail = await h.agreementClientService.dogovor(agreementId);
    const [listed] = await h.agreementClientService.mojiDogovori({ includeRatings: false });
    for (const row of [detail, listed]) {
      assert.equal(row.cena.iznos, 1200);
      assert.equal(row.osnovaCene, 'HOURLY');
      assert.equal(row.pokrivenost.popunjeno, 2);
      assert.equal(row.pokrivenost.ukupno, 5);
      assert.equal(row.ucesnici.find(person => person.uloga === 'uskocer').mesta, 2);
    }
  }
});

test('TOTAL is the accepted application amount, even for a partially covered task', async () => {
  const h = harness(workspace({ price_rsd: 4800, priceBasis: 'TOTAL' }));
  const row = await h.agreementClientService.dogovor(agreementId);
  assert.equal(row.cena.iznos, 4800);
  assert.equal(row.osnovaCene, 'TOTAL');
  assert.equal(row.pokrivenost.popunjeno, 2);
});

test('legacy missing original task count remains unknown without shrinking accepted people', async () => {
  const raw = workspace(); delete raw.terms.required_slots;
  const h = harness(raw);
  const row = await h.agreementClientService.dogovor(agreementId);
  assert.deepEqual(row.pokrivenost, { ukupno: 0, popunjeno: 2, preostalo: 0, udeo: 0 });
  assert.equal(row.ucesnici.find(person => person.uloga === 'uskocer').mesta, 2);
});

test('legacy missing basis remains UNKNOWN, while the saved price_rsd retains its RSD meaning', async () => {
  const raw = workspace(); delete raw.terms.priceBasis; delete raw.terms.currency;
  const h = harness(raw);
  const row = await h.agreementClientService.dogovor(agreementId);
  assert.equal(row.osnovaCene, null);
  assert.equal(row.cena.iznos, 1200);
  assert.equal(row.cena.valuta, 'RSD');
  assert.match(row.cena.prikaz, /RSD/);
});

test('explicit null basis is UNKNOWN, never inferred from current parent pricing', async () => {
  const row = await harness(workspace({ priceBasis: null })).agreementClientService.dogovor(agreementId);
  assert.equal(row.osnovaCene, null);
  assert.equal(row.cena.iznos, 1200);
});

test('explicit unsupported accepted price units and currencies are refused', async () => {
  for (const priceBasis of ['PER_PERSON', 'HOURLY_TEAM', '', 1]) {
    const h = harness(workspace({ priceBasis }));
    await assert.rejects(h.agreementClientService.dogovor(agreementId), /AGREEMENT_PRICE_BASIS_INVALID/);
  }
  for (const currency of ['EUR', 'rsd', '', 1]) {
    const h = harness(workspace({ currency }));
    await assert.rejects(h.agreementClientService.dogovor(agreementId), /AGREEMENT_CURRENCY_INVALID/);
  }
});

test('malformed accepted people cannot become one person or a clamped parent count', async () => {
  for (const covered_slots of [undefined, null, 0, -1, 51, 1.5, '2']) {
    const h = harness(workspace({ covered_slots }));
    await assert.rejects(h.agreementClientService.dogovor(agreementId), /AGREEMENT_COVERAGE_INVALID/);
  }
  for (const required_slots of [0, 1, 51, 2.5, '5']) {
    const h = harness(workspace({ required_slots }));
    await assert.rejects(h.agreementClientService.dogovor(agreementId), /AGREEMENT_COVERAGE_INVALID/);
  }
});

test('known hourly price change retains the same unit and accepted number of people', async () => {
  const h = harness(workspace({}, { proposedTerms: {} }));
  const result = await h.agreementChangeService.read(agreementId, h.account);
  assert.equal(result.ok, true);
  const state = result.podatak;
  assert.equal(state.terms.priceBasis, 'HOURLY');
  assert.equal(state.terms.coveredSlots, 2);
  assert.equal(state.proposals[0].terms.priceRsd, 1400);
  assert.equal(state.proposals[0].terms.priceBasis, 'HOURLY');
  assert.equal(state.proposals[0].terms.coveredSlots, 2);
  const detail = await h.agreementClientService.dogovor(agreementId);
  assert.match(detail.radnje.predlogIzmene.izmene[0].sada, /po osobi po satu/);
  assert.match(detail.radnje.predlogIzmene.izmene[0].predlog, /po osobi po satu/);
  const response = await h.agreementChangeService.respond(state.proposals[0], true, h.account);
  assert.equal(response.ok, true);
  assert.equal(response.podatak.agreementVersion, 4);
});

test('proposals cannot change the accepted unit or people under a price-only change', async () => {
  for (const proposedTerms of [{ priceBasis: 'TOTAL' }, { covered_slots: 1 }]) {
    const h = harness(workspace({}, { proposedTerms }));
    const result = await h.agreementChangeService.read(agreementId, h.account);
    assert.equal(result.ok, false);
    assert.equal(result.kod, 'AGREEMENT_CHANGE_INVALID_RECEIPT');
    const detail = await h.agreementClientService.dogovor(agreementId);
    assert.equal(detail.radnje.predlogIzmene, null);
    assert.equal(h.calls.some(call => call.name === 'rpc_respond_agreement_change'), false);
  }
});

test('unknown accepted basis prevents proposing or accepting a reinterpretation', async () => {
  const h = harness(workspace({ priceBasis: null }, { proposedTerms: { priceBasis: 'TOTAL' } }));
  const result = await h.agreementChangeService.read(agreementId, h.account);
  assert.equal(result.ok, true);
  assert.equal(result.podatak.terms, null);
  assert.equal(result.podatak.actions.canProposeChange, false);
  assert.equal(result.podatak.proposals[0].termsAvailable, false);
  const response = await h.agreementChangeService.respond(result.podatak.proposals[0], true, h.account);
  assert.equal(response.ok, false);
  assert.equal(response.kod, 'CHANGE_TERMS_INVALID');
  assert.equal(h.calls.some(call => call.name === 'rpc_respond_agreement_change'), false);
});

test('unknown proposal terms may be rejected without accepting guessed price terms', async () => {
  const h = harness(workspace({}, { proposedTerms: { priceBasis: null } }));
  const result = await h.agreementChangeService.read(agreementId, h.account);
  assert.equal(result.ok, true);
  const proposal = result.podatak.proposals[0];
  assert.equal(proposal.termsAvailable, false);
  const accept = await h.agreementChangeService.respond(proposal, true, h.account);
  assert.equal(accept.ok, false);
  const reject = await h.agreementChangeService.respond(proposal, false, h.account);
  assert.equal(reject.ok, true);
  assert.equal(reject.podatak.accepted, false);
  assert.deepEqual(h.calls.filter(call => call.name === 'rpc_respond_agreement_change').map(call => call.args.p_accept), [false]);
});

test('unsupported proposal currency remains unavailable and never converts to RSD', async () => {
  const h = harness(workspace({}, { proposedTerms: { currency: 'EUR' } }));
  const result = await h.agreementChangeService.read(agreementId, h.account);
  assert.equal(result.ok, true);
  assert.equal(result.podatak.proposals[0].termsAvailable, false);
  assert.equal(result.podatak.proposals[0].terms, null);
});

test('legacy omission of redundant currency preserves the explicit RSD price and known basis', async () => {
  const raw = workspace({}, { proposedTerms: {} });
  delete raw.terms.currency; delete raw.actionState.pendingChanges[0].proposedTerms.currency;
  const h = harness(raw);
  const result = await h.agreementChangeService.read(agreementId, h.account);
  assert.equal(result.ok, true);
  assert.equal(result.podatak.terms.currency, 'RSD');
  assert.equal(result.podatak.proposals[0].terms.currency, 'RSD');
  assert.equal(result.podatak.proposals[0].termsAvailable, true);
});

test('respond refuses a restored malformed proposal before any RPC write', async () => {
  for (const delta of [{ priceBasis: undefined }, { currency: 'EUR' }, { coveredSlots: 0 }, { priceRsd: 0 }]) {
    const h = harness(workspace({}, { proposedTerms: {} }));
    const result = await h.agreementChangeService.read(agreementId, h.account);
    const proposal = result.podatak.proposals[0];
    const response = await h.agreementChangeService.respond({ ...proposal, terms: { ...proposal.terms, ...delta } }, true, h.account);
    assert.equal(response.ok, false);
    assert.equal(response.kod, 'CHANGE_TERMS_INVALID');
    assert.equal(h.calls.some(call => call.name === 'rpc_respond_agreement_change'), false);
  }
});

test('unknown old price basis does not remove authorized cancellation or read-only details', async () => {
  const h = harness(workspace({ priceBasis: null }));
  const result = await h.agreementChangeService.read(agreementId, h.account);
  assert.equal(result.ok, true);
  assert.equal(result.podatak.actions.canCancel, true);
  assert.equal(result.podatak.actions.canProposeChange, false);
  const cancelled = await h.agreementChangeService.cancel(agreementId, 'Dogovoreno otkazivanje.', h.account);
  assert.equal(cancelled.ok, true);
  const detail = await h.agreementClientService.dogovor(agreementId);
  assert.equal(detail.pokrivenost.popunjeno, 2);
  assert.equal(detail.prihvacenObim, 'Utovar i istovar nameštaja.');
});
