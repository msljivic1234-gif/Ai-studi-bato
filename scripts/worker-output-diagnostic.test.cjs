'use strict';
// Execute the actual Worker handler with the existing HTTP-only test fixtures.
// No provider call, private hosted context, SQL write or model-accuracy claim.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const harnessPath = path.join(__dirname, 'conversation-intent-integration.test.cjs');
const harnessSource = fs.readFileSync(harnessPath, 'utf8');
const harnessAst = ts.createSourceFile(harnessPath, harnessSource, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
let fixtures = harnessAst.statements.filter(node => ts.isVariableStatement(node) || ts.isFunctionDeclaration(node))
  .map(node => node.getText(harnessAst)).join('\n');
// Only add a raw-body option at the MOCK provider boundary. This permits the
// real stream parser to reject malformed JSON before analyzeOutput is reached.
const providerMockText = 'text: JSON.stringify(output)';
assert.equal(fixtures.split(providerMockText).length, 2, 'one mock provider body boundary');
fixtures = fixtures.replace(providerMockText, "text: typeof options.providerRaw === 'string' ? options.providerRaw : JSON.stringify(output)");
const { handlerHarness, providerWorker } = new Function('require', '__dirname', fixtures +
  '\nreturn {handlerHarness,providerWorker};')(require, __dirname);

const PRIVATE = 'PRIVATNI_TEST_SADRZAJ_NIKAD_U_LOG_387';
const PRIVATE_KEY = 'PRIVATNO_IME_POLJA_916';
const TEXT = 'Dostupan sam svakog dana od 8 do 22. ' + PRIVATE;
const AVAILABILITY = { ruleChanges: [{ ruleId: null, weekdays: [0, 1, 2, 3, 4, 5, 6],
  value: { startTime: '08:00', endTime: '22:00', startsOn: '2026-11-07', endsOn: null, label: PRIVATE, active: true } }] };
const weeklyOutput = extra => providerWorker('WORKER_AVAILABILITY', TEXT, {
  assistantMessage: PRIVATE, patch: { availability: AVAILABILITY },
  availabilityChange: { kind: 'PATCH', scope: 'WEEKLY', evidence: TEXT },
  taxonomyDecisions: [], serviceModeChangesJson: '[]', ...extra,
});
const run = (output, options = {}) => handlerHarness('WORKER', TEXT, output,
  { singlePass: true, skills: ['Lektura tekstova'], ...options }).run();
const gates = result => result.logs.filter(row => row[0] === 'WORKER_OUTPUT_GATE');

function privateLogsAbsent(result) {
  const encoded = JSON.stringify(result.logs);
  assert.equal(encoded.includes(PRIVATE), false, 'no user/provider text or field values in logs');
  assert.equal(encoded.includes(PRIVATE_KEY), false, 'no untrusted patch/top-level keys in logs');
  for (const row of gates(result)) {
    assert.equal(row.length, 3);
    assert.ok(['JSON', 'INTENT', 'OUTPUT', 'SERVICES', 'AVAILABILITY', 'AREA'].includes(row[1]));
    assert.ok(['JSON_SYNTAX', 'AREA_SHAPE', 'OUTPUT_SHAPE', 'GATE_FAILED'].includes(row[2]));
  }
}

function rejectedAfterOneDispatch(result, expectedGate) {
  assert.equal(result.status, 200);
  assert.equal(result.events[0].kind, 'accepted');
  assert.equal(result.events.at(-1).kind, 'safe_error');
  assert.equal(result.events.at(-1).code, 'AI_TURN_NOT_CONFIRMED');
  assert.equal(result.events.some(row => row.kind === 'final'), false);
  assert.equal(result.events.some(row => Object.hasOwn(row, 'conversationIntent')), false);
  assert.equal(result.writes.length, 0, 'invalid output never reaches completion');
  assert.equal(result.calls.filter(call => call.name.endsWith(':streamGenerateContent')).length, 1);
  assert.equal(result.calls.filter(call => call.name === 'rpc_dispatch_worker_ai_turn_service').length, 1);
  assert.equal(result.calls.filter(call => call.name === 'rpc_fail_worker_ai_turn_service').length, 1);
  assert.equal(result.calls.filter(call => call.name === 'rpc_ai_test_record_usage_service').length, 1,
    'known paid usage survives local output rejection');
  assert.deepEqual(gates(result), expectedGate ? [expectedGate] : []);
  privateLogsAbsent(result);
}

test('Worker diagnostic: top-level output rejection logs only a closed stage and code', async () => {
  const result = await run(weeklyOutput({ [PRIVATE_KEY]: PRIVATE }));
  rejectedAfterOneDispatch(result, ['WORKER_OUTPUT_GATE', 'OUTPUT', 'OUTPUT_SHAPE']);
  assert.ok(result.logs.some(row => row[0] === 'AI_PHASE_MS' && row[1] === 'PROVIDER' && row[3] === 'SUCCEEDED'));
});

test('Worker diagnostic: empty areaRequests remains invalid and is not normalized into a save', async () => {
  const result = await run(weeklyOutput({ patch: { availability: AVAILABILITY, areaRequests: [] } }));
  rejectedAfterOneDispatch(result, ['WORKER_OUTPUT_GATE', 'OUTPUT', 'AREA_SHAPE']);
});

test('Worker diagnostic: malformed area with private content never reaches logs or geocoding', async () => {
  const result = await run(weeklyOutput({ patch: { availability: AVAILABILITY,
    areaRequests: [{ kind: 'CITY', countryCode: 'RS', query: PRIVATE, radiusKm: null, [PRIVATE_KEY]: PRIVATE }] } }));
  rejectedAfterOneDispatch(result, ['WORKER_OUTPUT_GATE', 'OUTPUT', 'AREA_SHAPE']);
  assert.equal(result.calls.some(call => /locationiq/i.test(call.url)), false);
});

test('Worker diagnostic: malformed availability intent is distinct from output or SQL failure', async () => {
  for (const availabilityChange of [
    { kind: 'PATCH', evidence: TEXT },
    { kind: 'PATCH', scope: PRIVATE, evidence: TEXT },
    { kind: 'PATCH', scope: 'WEEKLY', evidence: { [PRIVATE_KEY]: PRIVATE } },
  ]) {
    const result = await run(weeklyOutput({ availabilityChange }));
    rejectedAfterOneDispatch(result, ['WORKER_OUTPUT_GATE', 'AVAILABILITY', 'OUTPUT_SHAPE']);
  }
});

test('Worker diagnostic: real stream JSON rejection stays in PROVIDER and records known usage', async () => {
  const providerRaw = '{"assistantMessage":' + JSON.stringify(PRIVATE) + ',"patch":';
  const result = await run(weeklyOutput(), { providerRaw });
  rejectedAfterOneDispatch(result, null);
  assert.ok(result.logs.some(row => row[0] === 'AI_PHASE_MS' && row[1] === 'PROVIDER' && row[3] === 'FAILED'));
});

test('Worker diagnostic: valid seven-day correction still completes once with its exact calendar patch', async () => {
  const result = await run(weeklyOutput());
  assert.equal(result.events.at(-1).kind, 'final');
  assert.equal(result.events.at(-1).turn.state, 'SUCCEEDED');
  assert.equal(result.writes.length, 1);
  assert.deepEqual(result.writes[0].args.p_output.patch.availability, AVAILABILITY);
  assert.equal(result.calls.filter(call => call.name.endsWith(':streamGenerateContent')).length, 1);
  assert.equal(result.calls.filter(call => call.name === 'rpc_fail_worker_ai_turn_service').length, 0);
  assert.deepEqual(gates(result), []);
  privateLogsAbsent(result);
});

test('Worker provider request requires all operation lists and records supplied hours before offering review', async () => {
  const result=await run(weeklyOutput());
  const request=result.calls.find(call=>call.name.endsWith(':streamGenerateContent')).args;
  const availability=request.generationConfig.responseSchema.properties.patch.properties.availability;
  assert.deepEqual(availability.required,['ruleChanges','windowsUpsert','windowIdsRemove']);
  assert.equal(availability.nullable,true);
  const instruction=request.systemInstruction.parts.map(part=>part.text).join('\n');
  assert.match(instruction,/optional to ask for, never optional to record/);
  assert.match(instruction,/removing the old window alone does not implement the weekly request/);
  assert.match(availability.properties.ruleChanges.description,/Recurring hours belong here/);
  assert.equal(result.calls.filter(call=>call.name.endsWith(':streamGenerateContent')).length,1);
  privateLogsAbsent(result);
});

test('Worker recorded missing weekly operation and schema-shaped empty replacement both remain fail-closed', async () => {
  const oldWindow='00000000-0000-4000-8000-000000000012';
  const text='Dostupan sam svakog dana od 8 do 22. Uklonite prethodno pogrešan termin samo za danas.';
  for(const calendar of [
    {windowsUpsert:[],windowIdsRemove:[oldWindow]},
    {ruleChanges:[],windowsUpsert:[],windowIdsRemove:[oldWindow]},
  ]) {
    const result=await handlerHarness('WORKER',text,providerWorker('WORKER_AVAILABILITY',text,{
      patch:{bio:'Radim lekturu.',availability:calendar},
      availabilityChange:{kind:'PATCH',scope:'MIXED',evidence:text},
      taxonomyDecisions:[],serviceModeChangesJson:'[]',
    }),{singlePass:true,skills:['Lektura tekstova']}).run();
    assert.equal(result.events.at(-1).kind,'final');
    assert.equal(result.writes.length,1);
    assert.equal(result.writes[0].args.p_output.safety,'CLARIFY');
    assert.deepEqual(result.writes[0].args.p_output.patch,{bio:'Radim lekturu.'},'the prior dated window is not removed');
    assert.ok(result.logs.some(row=>row[0]==='WORKER_AVAILABILITY_GUARD'&&row[1]==='RECURRENCE_SHAPE_MISMATCH'));
    assert.equal(result.calls.filter(call=>call.name.endsWith(':streamGenerateContent')).length,1,'no repair model call');
    privateLogsAbsent(result);
  }
});

test('Worker full daily correction carries the rule and requested dated removal together without toggling now', async () => {
  const text='Доступан сам сваког дана од 8 до 22. Уклоните претходни погрешан термин само за данас.';
  const calendar={ruleChanges:AVAILABILITY.ruleChanges,windowsUpsert:[],
    windowIdsRemove:['00000000-0000-4000-8000-000000000012']};
  const result=await handlerHarness('WORKER',text,providerWorker('WORKER_AVAILABILITY',text,{
    patch:{availability:calendar},availabilityChange:{kind:'PATCH',scope:'MIXED',evidence:text},
    taxonomyDecisions:[],serviceModeChangesJson:'[]',
  }),{singlePass:true,skills:['Lektura tekstova']}).run();
  assert.equal(result.events.at(-1).kind,'final');
  assert.equal(result.writes.length,1);
  assert.equal(result.writes[0].args.p_output.safety,'ALLOW');
  assert.deepEqual(result.writes[0].args.p_output.patch.availability,calendar);
  assert.equal(Object.hasOwn(result.writes[0].args.p_output.patch.availability,'availableNow'),false);
  assert.equal(result.calls.filter(call=>call.name.endsWith(':streamGenerateContent')).length,1);
  privateLogsAbsent(result);
});

test('Worker diagnostic: a pure question still freezes irrelevant invalid patch before output admission', async () => {
  const question = 'Kako da promenim raspored? ' + PRIVATE;
  const output = providerWorker('QUESTION', question, { assistantMessage: PRIVATE,
    patch: { availability: { [PRIVATE_KEY]: PRIVATE }, areaRequests: [] },
    availabilityChange: { kind: 'PATCH', scope: PRIVATE, evidence: TEXT },
    taxonomyDecisions: [], serviceModeChangesJson: '[]' });
  const result = await handlerHarness('WORKER', question, output, { singlePass: true }).run();
  assert.equal(result.events.at(-1).kind, 'final');
  assert.equal(result.writes.length, 1);
  assert.deepEqual(result.writes[0].args.p_output.patch, {});
  assert.deepEqual(gates(result), []);
  privateLogsAbsent(result);
});

test('Worker diagnostic: local JSON catch is closed even when diagnostics themselves fail', () => {
  // Defensive local boundary only: the actual transport test above establishes
  // that malformed hosted JSON normally never reaches analyzeOutput.
  const file = path.join(__dirname, '../supabase/functions/uskoci-worker-interview/index.ts');
  const source = fs.readFileSync(file, 'utf8');
  const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const expressions = [];
  const visit = node => {
    if (ts.isVariableDeclaration(node) && node.name.getText(ast) === 'analyzeOutput') expressions.push(node.initializer.getText(ast));
    ts.forEachChild(node, visit);
  };
  visit(ast); assert.equal(expressions.length, 1);
  const code = ts.transpileModule('module.exports = (' + expressions[0] + ');', {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  for (const diagnosticFailure of [false, true]) {
    const logs = [], mod = { exports: {} };
    const console = { warn: (...args) => { logs.push(args); if (diagnosticFailure) throw Error(PRIVATE); } };
    new Function('module', 'console', code)(mod, console);
    assert.throws(() => mod.exports('{"' + PRIVATE_KEY + '":'), { message: 'WORKER_AI_INVALID' });
    assert.deepEqual(logs, [['WORKER_OUTPUT_GATE', 'JSON', 'JSON_SYNTAX']]);
    privateLogsAbsent({ logs });
  }
});
