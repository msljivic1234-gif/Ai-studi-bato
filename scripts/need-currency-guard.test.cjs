'use strict';
/** Exercise the EXACT TypeScript guard from the Edge function without calling Gemini,
 * PostgREST, or billing. AST extraction fails if it disappears or is renamed.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const ts = require('typescript');
const source = fs.readFileSync(path.join(__dirname, '..', 'supabase', 'functions', 'uskoci-ai-interview', 'index.ts'), 'utf8');
const parsed = ts.createSourceFile('index.ts', source, ts.ScriptTarget.ES2022, true, ts.ScriptKind.TS);
const ast = parsed.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === 'guardConversationTurn');
assert.ok(ast, 'live Need price guard must remain present');
const { outputText, diagnostics } = ts.transpileModule(ast.getText(parsed), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS }, reportDiagnostics: true,
});
assert.equal(diagnostics.length, 0);
const sandbox = {
  guardTimestampProposals: turn => turn,
  taskFinishOnly: () => false,
  applicationDeadlineEnabled: () => false,
  sameFactValue: (a, b) => JSON.stringify(a) === JSON.stringify(b),
  decodeServiceHandoff: () => null,
  NEED_FACT_V2_DEFINITIONS: {},
  Date,
};
vm.runInNewContext(outputText + '\nthis.extractedGuard = guardConversationTurn;', sandbox, { timeout: 1000 });
const run = sandbox.extractedGuard;
const time = { nowUtc:'2026-11-07T00:00:00Z', localDate:'2026-11-07', timeZone:'Europe/Belgrade' };
const turn = (message, facts = [], next = 'ACK') => ({
  safety: 'ALLOW', assistantMessage: message,
  proposals: facts.map(([key, value]) => ({ key, value, displayValue: String(value),
    confidence: 1, evidence: message })),
  dialogue: { next, questionKey: '', taskRelation:'CONTINUE', priceUnit:'UNSPECIFIED', schedulePattern:'UNSPECIFIED' },
});
const entries = out => JSON.parse(JSON.stringify(out.proposals));
const rsdFacts = [
  ['need.description','Potrebno je krečenje sobe'],
  ['need.price_mode','MY_PRICE'],
  ['need.price_rsd',50],
  ['need.price_basis','TOTAL'],
];
test('50 EUR never becomes 50 RSD; task description survives', () => {
  const out = run(turn('Cena je 50 evra', rsdFacts), 'Cena je 50 evra', [], [], time);
  assert.equal(out.safety, 'CLARIFY');
  assert.equal(entries(out).some(x => x.key === 'need.price_rsd'), false);
  assert.equal(entries(out).some(x => x.key === 'need.description'), true);
  assert.match(out.assistantMessage, /RSD/);
});
test('50 € cannot leak via REVIEW safety', () => {
  const review = turn('Cena je 50 €', rsdFacts);
  review.safety = 'REVIEW';
  const out = run(review, 'Cena je 50 €', [], [], time);
  assert.equal(out.safety, 'REVIEW');
  assert.equal(entries(out).some(x => x.key === 'need.price_rsd'), false);
  assert.match(out.assistantMessage, /RSD/);
});
test('explicit RSD remains RSD and keeps its value', () => {
  const out = run(turn('Cena je 50 RSD', rsdFacts), 'Cena je 50 RSD', [], [], time);
  assert.equal(entries(out).find(x => x.key === 'need.price_rsd')?.value, 50);
  assert.equal(out.priceRetraction, undefined);
});
test('EUR-only correction invalidates earlier RSD consent', () => {
  const active = [{ fact_key:'need.price_rsd', fact_value:50, status:'CONFIRMED' }];
  const history = [{ role:'USER', body:'Cena je 50' },{role:'ASSISTANT',body:'Koja je cena?' }];
  const out = run(turn('Mislio sam u evrima'), 'Mislio sam u evrima', history, active, time);
  assert.equal(out.priceRetraction, 'UNSUPPORTED_CURRENCY');
  assert.equal(entries(out).length, 0);
  assert.equal(out.safety, 'CLARIFY');
});
test('expense EUR with separate RSD task price does not corrupt task amount', () => {
  const sentence = 'Materijal košta 50 evra; cena rada je 2.000 RSD';
  const out = run(turn(sentence, [['need.price_mode','MY_PRICE'], ['need.price_rsd',2000]]),
    sentence, [], [], time);
  assert.equal(entries(out).find(x => x.key === 'need.price_rsd')?.value, 2000);
  assert.equal(out.priceRetraction, undefined);
});
test('plain 2 workers do not silently become a price', () => {
  const out = run(turn('Trebaju mi 2 radnika', [['need.price_rsd',2], ['need.people_needed',2]]),
    'Trebaju mi 2 radnika', [], [], time);
  assert.equal(entries(out).some(x => x.key === 'need.price_rsd'), false);
  assert.equal(entries(out).find(x => x.key === 'need.people_needed')?.value, 2);
});
test('prompt does not instruct Gemini to store EUR as a RSD fact', () => {
  assert.doesNotMatch(source, /store the exact stated amount \(50\)/);
  assert.match(source, /NEVER put its numeral in need.price_rsd/);
});
