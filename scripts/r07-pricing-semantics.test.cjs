'use strict';
// Execute the current financial selectors/decoders. Transport, native layout and
// external profile formatting are explicit boundaries, not E2E proof.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
function extract(file, names, dependencies = {}) {
  const text = fs.readFileSync(path.join(root, file), 'utf8');
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, file.endsWith('tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const wanted = new Set(names);
  const found = new Set();
  const parts = [];
  for (const node of source.statements) {
    const declared = ts.isFunctionDeclaration(node) && node.name ? [node.name.text]
      : ts.isVariableStatement(node) ? node.declarationList.declarations.map(d => d.name.getText(source)) : [];
    if (!declared.some(name => wanted.has(name))) continue;
    declared.forEach(name => found.add(name));
    parts.push(node.getText(source));
  }
  names.forEach(name => assert.ok(found.has(name), `${file} exports real declaration ${name}`));
  const js = ts.transpileModule(parts.join('\n') + '\nmodule.exports = {' + names.join(',') + '};', {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const module = { exports: {} };
  new Function('module', 'exports', ...Object.keys(dependencies), js)(module, module.exports, ...Object.values(dependencies));
  return module.exports;
}
const money = extract('src/lib/novac.ts', ['LOCALE', 'iznos', 'novac', 'applicationPriceBasisText']);
const { fixedApplicationPrice } = extract('src/data/needDetailPresentation.ts', ['fixedApplicationPrice']);
const { candidateValue, candidateStatus } = extract('src/ui/v2/CandidateFace.tsx', ['candidateValue', 'candidateStatus', 'CANDIDATE_REASON'], money);
const { applicationValue } = extract('src/ui/v2/ApplicationFace.tsx', ['applicationValue'], money);
const selection = extract('src/ui/v2/ApplicationSelectionPresentation.tsx', [
  'comparablePrice', 'comparePrices', 'incomparablePrices', 'sortCandidates', 'candidateMeasures',
  'MEASURE_LOWEST_PRICE', 'MEASURE_BEST_RATING', 'candidateRatingFigure',
], { candidateValue, candidateRatingValue: () => null });
function candidate(id, amount, basis, people = 1, currency = 'RSD') {
  return { prijavaId: id, cena: { iznos: amount, valuta: currency, prikaz: money.novac(amount, currency) },
    osnovaCene: basis, pokrivaMesta: people, stanje: 'SELECTABLE', mozeIzabrati: true,
    ocenaTekst: '—', recenzijeTekst: '0 ocena' };
}
function task(amount, basis, people) {
  return { rezimCene: 'MY_PRICE', osnovaCene: basis, ponudjenaCena: { iznos: amount }, pokrivenost: { ukupno: people } };
}
for (const [basis, amount, required, covered, expected] of [
  ['HOURLY', 1200, 5, 2, 1200], ['HOURLY', 1000, 5, 1, 1000],
  ['TOTAL', 5000, 5, 2, 2000], ['PER_PERSON', 1200, 5, 2, 2400],
]) test(`${basis} fixed application preserves the unit with partial coverage`, () => {
  assert.equal(fixedApplicationPrice(task(amount, basis, required), covered), expected);
});
test('hourly rate never assumes a duration and refuses overfill', () => {
  assert.equal(fixedApplicationPrice(task(1200, 'HOURLY', 5), 6), null);
  assert.equal(fixedApplicationPrice(task(1200, 'HOURLY', 5), 0), null);
  assert.equal(fixedApplicationPrice({ rezimCene: 'OFFERS' }, 2), null);
});
test('both application cards retain 1200 RSD per person per hour for two people', () => {
  const row = candidate('a', 1200, 'HOURLY', 2);
  for (const display of [candidateValue(row), applicationValue(row)]) {
    assert.equal(display.amount, '1.200 RSD');
    assert.equal(display.basis, 'po osobi po satu');
  }
});
test('hourly 1000 for one ranks below 1200 for two; no division by people', () => {
  const a = candidate('a', 1200, 'HOURLY', 2), b = candidate('b', 1000, 'HOURLY', 1);
  assert.deepEqual(selection.sortCandidates([a,b], 'PRICE').map(x => x.prijavaId), ['b','a']);
  assert.equal(selection.candidateMeasures([a,b], true).get('b'), selection.MEASURE_LOWEST_PRICE);
  assert.equal(selection.candidateMeasures([a,b], true).has('a'), false);
});
test('TOTAL comparison uses price for the people in the application', () => {
  const a = candidate('a', 2400, 'TOTAL', 3), b = candidate('b', 1000, 'TOTAL', 1);
  assert.deepEqual(selection.sortCandidates([b,a], 'PRICE').map(x => x.prijavaId), ['a','b']);
});
for (const unknown of [null, undefined]) test(`missing basis ${unknown} is shown explicitly and cannot become a total`, () => {
  const row = candidate('old', 1200, unknown, 2);
  assert.equal(candidateValue(row).amount, '1.200 RSD');
  assert.equal(candidateValue(row).basis, 'osnovica cene nije potvrđena');
  assert.equal(applicationValue(row).basis, 'osnovica cene nije potvrđena');
  assert.match(candidateStatus(row).text, /Podnosilac treba/);
  assert.equal(selection.comparablePrice(row), null);
});
for (const other of [candidate('other', 1000, 'TOTAL'), candidate('other', 1000, null), candidate('other', 1000, 'HOURLY', 1, 'EUR')]) {
  test(`unlike or unknown units do not claim a cheapest offer (${other.osnovaCene}/${other.cena.valuta})`, () => {
    const rows = [candidate('hourly', 1200, 'HOURLY', 2), other];
    assert.equal(selection.sortCandidates(rows, 'PRICE'), rows);
    assert.equal(selection.candidateMeasures(rows, true).size, 0);
  });
}
test('partial list and nonselectable candidates cannot claim cheapest', () => {
  const rows = [candidate('a', 1000, 'HOURLY'), candidate('b', 1200, 'HOURLY')];
  assert.equal(selection.candidateMeasures(rows, false).size, 0);
  assert.equal(selection.candidateMeasures([{...rows[0],mozeIzabrati:false}, rows[1]], true).size, 0);
});
const { mapCandidate } = extract('src/data/candidateClientService.ts', ['mapCandidate', 'dokaz', 'rsd', 'STATES'], {
  ...money, uuid: value => typeof value === 'string' && /^[0-9a-f-]{36}$/.test(value),
  positiveInteger: value => Number.isSafeInteger(value) && value > 0,
  calendarInstant: value => value === null ? null : Date.parse(value),
  dogovorenoVreme: () => 'Fleksibilno', inicijali: () => 'AB', plural: value => `${value} ocena`,
});
const wire = { responseId:'11111111-1111-4111-8111-111111111111', workerProfileId:'22222222-2222-4222-8222-222222222222',
  needRevision: 3, version: 1, contentHash: 'a'.repeat(64), proposedStartAt:null, proposedEndAt:null,
  state:'SELECTABLE', canSelect:true, priceRsd:1200, coveredSlots:2, remainingSlots:5,
  applicationEvidence: {schema:'LEGACY_UNPROVEN'}, publicProfile:{displayName:'Test',trust:{}}, currency:'RSD' };
test('candidate decoder preserves explicit hourly price and people', () => {
  const row=mapCandidate({...wire,applicationPriceBasis:'HOURLY'});
  assert.equal(row.cena.iznos,1200); assert.equal(row.cena.valuta,'RSD');
  assert.equal(row.osnovaCene,'HOURLY'); assert.equal(row.pokrivaMesta,2); assert.equal(row.mozeIzabrati,true);
});
test('candidate decoder never grants selection without an authoritative unit', () => {
  assert.equal(mapCandidate(wire).mozeIzabrati,false);
  assert.equal(mapCandidate({...wire,applicationPriceBasis:null}).mozeIzabrati,false);
});
test('candidate decoder rejects other currencies and unsupported units', () => {
  assert.throws(()=>mapCandidate({...wire,applicationPriceBasis:'HOURLY',currency:'EUR'}),/CURRENCY/);
  assert.throws(()=>mapCandidate({...wire,applicationPriceBasis:'PER_PERSON'}),/BASIS/);
});

const { observed } = extract('src/app/(app)/moje-prijave.tsx', ['observed', 'withdrawal'], {
  sameId: (a,b) => a === b, calendarInstant: value => value === null ? null : Date.parse(value),
});
function pendingReview(basis) {
  return { row: {prijavaId:'application',potrebaId:'need',prijavaVerzija:1,potrebaRevizija:3,
      cena:{iznos:1200},pokrivaMesta:2,napomena:'Test'}, expectedPriceBasis:basis, result:'receipt',
    intent:{kind:'resolve',command:{akcija:'KEEP'}} };
}
const observedRow={applicationId:'application',needId:'need',version:2,submittedNeedRevision:3,
  status:'SUBMITTED',priceRsd:1200,coveredSlots:2,scopeNote:'Test',proposedStartAt:null,proposedEndAt:null};
test('saved-command reconciliation requires the exact frozen basis, amount and headcount',()=>{
  const pending=pendingReview('HOURLY');
  assert.equal(observed(pending,{...observedRow,priceBasis:'HOURLY'}),true);
  for(const changed of [{priceBasis:undefined},{priceBasis:'TOTAL'},{priceRsd:2400,priceBasis:'HOURLY'},
    {coveredSlots:1,priceBasis:'HOURLY'},{submittedNeedRevision:4,priceBasis:'HOURLY'}])
    assert.equal(observed(pending,{...observedRow,...changed}),false);
});
test('missing server basis cannot settle a pending TOTAL command',()=>{
  assert.equal(observed(pendingReview('TOTAL'),observedRow),false);
  assert.equal(observed(pendingReview('TOTAL'),{...observedRow,priceBasis:'TOTAL'}),true);
});
