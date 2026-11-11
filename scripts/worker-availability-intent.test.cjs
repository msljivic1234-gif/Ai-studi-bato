'use strict';
// Exercise the actual Worker provider schema and admission guard. Model outputs
// are deliberately controlled: this proves boundary behavior, not live Serbian
// model classification, calendar storage, matching, or native rendering.
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript');
const source=fs.readFileSync(path.join(__dirname,'..','supabase/functions/uskoci-worker-interview/index.ts'),'utf8');
const parsed=ts.createSourceFile('index.ts',source,ts.ScriptTarget.ES2022,true,ts.ScriptKind.TS);
const declarations=['object','keys','workerProviderSchema','guardAvailabilityChange'];
const picked=parsed.statements.filter(node=>ts.isFunctionDeclaration(node)
  ?declarations.includes(node.name?.text)
  :ts.isVariableStatement(node)&&node.declarationList.declarations.some(d=>declarations.includes(d.name.getText(parsed))));
assert.equal(picked.length,declarations.length,'actual guard and schema must remain extractable');
const compiled=ts.transpileModule(picked.map(node=>node.getText(parsed)).join('\n'),{
  compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS},reportDiagnostics:true});
assert.deepEqual(compiled.diagnostics,[]);
const diagnostics=[];
const sandbox={exports:{},console:{info:(...args)=>diagnostics.push(args)},
  withConversationIntentSchema:schema=>schema,workerAreaRequestSchema:{},workerServiceChangesSchema:{}};
vm.runInNewContext(compiled.outputText+'\nthis.runGuard=guardAvailabilityChange;',sandbox,{timeout:1000});
const run=sandbox.runGuard,plain=value=>JSON.parse(JSON.stringify(value));
const existingRule={id:'00000000-0000-4000-8000-000000000011',weekdays:[1,3],startTime:'10:00',endTime:'12:00',
  startsOn:'2026-11-01',endsOn:null,label:'Postojeći raspored',active:true};
const existingWindow={id:'00000000-0000-4000-8000-000000000012',startsAt:'2026-11-12T11:00:00+01:00',
  endsAt:'2026-11-12T12:00:00+01:00',state:'UNAVAILABLE',label:'Postojeći izuzetak'};
const context=()=>({candidate:{skills:['Lektura','Prevođenje'],availability:{timezone:'Europe/Belgrade',
  availableNow:false,rules:[structuredClone(existingRule)],windows:[structuredClone(existingWindow)]}},
  messages:[{role:'USER',body:'Dostupan sam svakog dana od 8 do 22. Trenutno sam dostupan.'}]});
const rule=(weekdays=[0,1,2,3,4,5,6],overrides={})=>({ruleId:null,weekdays,
  value:{startTime:'08:00',endTime:'22:00',startsOn:'2026-11-07',endsOn:null,label:'Dostupnost',active:true,...overrides}});
const window=()=>({id:null,startsAt:'2026-11-07T08:00:00+01:00',endsAt:'2026-11-07T22:00:00+01:00',
  state:'AVAILABLE',label:'Danas'});
const output=availability=>({safety:'ALLOW',assistantMessage:'Predlog je spreman za pregled.',
  patch:{bio:'Lektura na srpskom jeziku.',skills:['Lektura','Prevođenje'],...(availability?{availability}:{})}});
const plan=(scope,evidence,kind='PATCH')=>({kind,scope,evidence});
const current='Dostupan sam svakog dana od 8 do 22 časa po vremenu Beograda. Trenutno sam dostupan.';
function denied(value){assert.equal(value.safety,'CLARIFY');assert.equal(Object.hasOwn(value.patch,'availability'),false);
  assert.equal(value.patch.bio,'Lektura na srpskom jeziku.');assert.deepEqual(plain(value.patch.skills),['Lektura','Prevođenje']);}

test('provider requires the temporal scope without changing the writer patch contract',()=>{
  const schema=plain(sandbox.exports.workerProviderSchema()),intent=schema.properties.availabilityChange;
  assert.deepEqual(intent.required,['kind','scope','evidence']);
  assert.deepEqual(intent.properties.scope.enum,['NONE','WEEKLY','DATED','NOW','MIXED']);
  assert.deepEqual(Object.keys(schema.properties.patch.properties.availability.properties),
    ['timezone','availableNow','ruleChanges','windowsUpsert','windowIdsRemove']);
});

test('provider must decide all calendar operation lists, without inventing scalar changes',()=>{
  const schema=plain(sandbox.exports.workerProviderSchema());
  const availability=schema.properties.patch.properties.availability;
  assert.equal(availability.nullable,true,'no change or incomplete intent can still use null');
  assert.deepEqual(availability.required,['ruleChanges','windowsUpsert','windowIdsRemove']);
  for(const key of availability.required) assert.equal(availability.properties[key].type,'ARRAY');
  assert.equal(availability.required.includes('timezone'),false,'unchanged timezone remains absent');
  assert.equal(availability.required.includes('availableNow'),false,'weekly hours cannot require a now toggle');
  const deletionOnly={windowsUpsert:[],windowIdsRemove:[existingWindow.id]};
  assert.deepEqual(availability.required.filter(key=>!Object.hasOwn(deletionOnly,key)),['ruleChanges'],
    'the recorded hosted missing-weekly-list output is no longer schema-compliant');
});

test('everyday plus immediate availability retains seven weekdays, local hours, timezone and explicit now',()=>{
  const av={timezone:'Europe/Belgrade',ruleChanges:[rule()],availableNow:true};
  const input=output(av),before=structuredClone(input),owned=context(),prior=structuredClone(owned);
  assert.equal(run(input,plan('MIXED',current),owned,current),input);
  assert.deepEqual(input,before);assert.deepEqual(owned,prior);
  assert.equal(input.patch.availability.ruleChanges[0].value.endsOn,null);
});

test('known live regression: WEEKLY cannot become one AVAILABLE window today',()=>{
  const text='Dostupan sam svakog dana od 8 do 22 časa po vremenu Beograda.';
  denied(run(output({windowsUpsert:[window()]}),plan('WEEKLY',text),context(),text));
});

test('explicit daily wording also blocks a model that incorrectly labels today-only output DATED',()=>{
  denied(run(output({windowsUpsert:[window()]}),plan('DATED',current),context(),current));
});

test('daily plus now cannot pass as a MIXED date-window/now substitution',()=>{
  denied(run(output({windowsUpsert:[window()],availableNow:true}),plan('MIXED',current),context(),current));
});

test('daily rule must cover all seven active days, not just weekdays or an inactive week',()=>{
  const text='Dostupan sam svakog dana od 8 do 22.';
  for(const changes of [[rule([1,2,3,4,5])],[rule(undefined,{active:false})]])
    denied(run(output({ruleChanges:changes}),plan('WEEKLY',text),context(),text));
});

test('Cyrillic everyday wording has the same seven-day guard and accepts exact local hours',()=>{
  const text='Доступан сам сваког дана од 8 до 22.';
  denied(run(output({windowsUpsert:[window()]}),plan('DATED',text),context(),text));
  const input=output({ruleChanges:[rule()]});assert.equal(run(input,plan('WEEKLY',text),context(),text),input);
});

test('ordinary weekday recurring schedule and targeted removal remain valid',()=>{
  for(const [text,change] of [['Radnim danima mogu od 15 do 19.',rule([1,2,3,4,5],{startTime:'15:00',endTime:'19:00'})],
    ['Više nisam dostupan sredom.',{ruleId:existingRule.id,weekdays:[3],value:null}]]) {
    const input=output({ruleChanges:[change]});assert.equal(run(input,plan('WEEKLY',text),context(),text),input);
  }
});

test('weekend and separated weekly intervals retain the declared days and exact hours',()=>{
  for(const [text,changes] of [
    ['Vikendom mogu od 10 do 14.',[rule([0,6],{startTime:'10:00',endTime:'14:00'})]],
    ['Radnim danima mogu od 8 do 12 i od 16 do 20.',[
      rule([1,2,3,4,5],{startTime:'08:00',endTime:'12:00'}),
      rule([1,2,3,4,5],{startTime:'16:00',endTime:'20:00'}),
    ]],
  ]) {
    const availability={ruleChanges:changes,windowsUpsert:[],windowIdsRemove:[]};
    const input=output(availability),owned=context(),prior=structuredClone(owned);
    assert.equal(run(input,plan('WEEKLY',text),owned,text),input);
    assert.deepEqual(input.patch.availability,availability);
    assert.deepEqual(owned,prior,'the proposal cannot erase existing saved rules or exceptions');
  }
});

test('daily wording with an exception does not force the excepted day into an available week',()=>{
  const text='Dostupan sam svakog dana osim nedelje od 8 do 22.';
  const input=output({ruleChanges:[rule([1,2,3,4,5,6])]});
  assert.equal(run(input,plan('WEEKLY',text),context(),text),input);
});

test('negated daily statement does not invent seven available days',()=>{
  const text='Nisam dostupan svakog dana. Mogu samo ponedeljkom od 8 do 22.';
  const input=output({ruleChanges:[rule([1])]});assert.equal(run(input,plan('WEEKLY',text),context(),text),input);
});

test('dated window remains dated, without manufacturing a weekly schedule',()=>{
  const text='Danas mogu od 8 do 22.',input=output({windowsUpsert:[window()]});
  assert.equal(run(input,plan('DATED',text),context(),text),input);
  denied(run(output({ruleChanges:[rule()]}),plan('DATED',text),context(),text));
});

test('tomorrow and a dated unavailable exception keep their offsets and do not change weekly or now settings',()=>{
  for(const [text,state] of [['Sutra mogu od 8 do 22.','AVAILABLE'],['Sutra ne mogu od 8 do 22.','UNAVAILABLE']]) {
    const availability={ruleChanges:[],windowsUpsert:[{...window(),startsAt:'2026-11-08T08:00:00+01:00',
      endsAt:'2026-11-08T22:00:00+01:00',state,label:'Sutra'}],windowIdsRemove:[]};
    const input=output(availability);
    assert.equal(run(input,plan('DATED',text),context(),text),input);
    assert.deepEqual(input.patch.availability,availability);
    assert.equal(Object.hasOwn(input.patch.availability,'availableNow'),false);
  }
});

test('explicit cancellation of an owned date exception retains its ID',()=>{
  const text='Uklonite izuzetak 12. novembra.',input=output({windowIdsRemove:[existingWindow.id]});
  assert.equal(run(input,plan('DATED',text),context(),text),input);
  assert.deepEqual(input.patch.availability.windowIdsRemove,[existingWindow.id]);
});

test('explicit immediate availability toggle needs no fabricated hours or dates',()=>{
  for(const [text,value,previous] of [['Mogu odmah.',true,false],['Trenutno nisam dostupan.',false,true]]) {
    const owned=context();owned.candidate.availability.availableNow=previous;
    const input=output({availableNow:value});assert.equal(run(input,plan('NOW',text),owned,text),input);
  }
});

test('a weekly-only declaration cannot silently toggle immediate availability',()=>{
  const text='Radnim danima mogu od 8 do 22.';
  denied(run(output({ruleChanges:[rule([1,2,3,4,5])],availableNow:true}),plan('WEEKLY',text),context(),text));
});

test('explicit timezone correction remains available without invented calendar hours',()=>{
  const text='Vremenska zona mog rasporeda je Europe/Paris.',input=output({timezone:'Europe/Paris'});
  assert.equal(run(input,plan('WEEKLY',text),context(),text),input);
  denied(run(output({timezone:'Europe/Paris',availableNow:true}),plan('NOW',text),context(),text));
});

test('a current explicit correction can combine weekly hours and deletion of the old dated exception',()=>{
  const text='Dostupan sam svakog dana od 8 do 22. Uklonite prethodno pogrešan termin samo za danas.';
  const input=output({ruleChanges:[rule()],windowIdsRemove:[existingWindow.id]});
  assert.equal(run(input,plan('MIXED',text),context(),text),input);
});

test('explicit empty operation arrays preserve no-op behavior and never erase the old calendar',()=>{
  const owned=context(),before=structuredClone(owned);
  const availability={ruleChanges:[],windowsUpsert:[],windowIdsRemove:[]};
  const input=output(availability);
  assert.equal(run(input,plan('NONE','','NONE'),owned,'Hvala.'),input);
  assert.deepEqual(owned,before);
  denied(run(output(availability),plan('WEEKLY',current),owned,current));
});

test('historic evidence cannot authorize a new calendar edit after the person changes the subject',()=>{
  const owned=context(),old=owned.messages[0].body;
  denied(run(output({ruleChanges:[rule()],availableNow:true}),plan('MIXED',old),owned,'Takođe radim prevode.'));
});

test('current evidence normalization accepts formatting only, not paraphrase or translated script',()=>{
  const evidence='Доступан сам понедељком од 8 до 22.',input=output({ruleChanges:[rule([1])]});
  assert.equal(run(input,plan('WEEKLY',evidence),context(),'Доступан\nсам понедељком  од 8 до 22.'),input);
  denied(run(output({ruleChanges:[rule([1])]}),plan('WEEKLY','Dostupan sam ponedeljkom od 8 do 22.'),context(),evidence));
  denied(run(output({ruleChanges:[rule([1])]}),plan('WEEKLY','Доступан сам понедељком од 9 до 22.'),context(),evidence));
});

test('missing, extra or unsupported scope cannot grant calendar edit authority',()=>{
  for(const hint of [{kind:'PATCH',evidence:current},plan('YEARLY',current),{...plan('MIXED',current),confirmed:true}])
    assert.throws(()=>run(output({ruleChanges:[rule()],availableNow:true}),hint,context(),current),/WORKER_AI_OUTPUT_INVALID/);
});

test('NONE and the internal legacy no-op are safe only when there is no mutation',()=>{
  for(const hint of [plan('NONE','','NONE'),{kind:'NONE',evidence:''}]) {
    const input=output();assert.equal(run(input,hint,context(),'Ćao.'),input);
    denied(run(output({availableNow:true}),hint,context(),'Ćao.'));
  }
});

test('an incomplete recurring statement preserves its precise question and all unrelated changes',()=>{
  const text='Radnim danima posle 15.',input={...output(),assistantMessage:'Do koliko sati ste dostupni radnim danima?'};
  const out=run(input,plan('WEEKLY',text,'CLARIFY'),context(),text);
  assert.equal(out.assistantMessage,input.assistantMessage);assert.equal(out.safety,'CLARIFY');
  assert.equal(out.patch.bio,input.patch.bio);assert.equal(Object.hasOwn(out.patch,'availability'),false);
});

test('CLARIFY cannot smuggle weekly operations or toggle now',()=>{
  const text='Promeniću dostupnost.';
  denied(run(output({availableNow:true}),plan('NOW',text,'CLARIFY'),context(),text));
});

test('safety hold remains authoritative and the guard never claims a calendar update',()=>{
  for(const safety of ['REVIEW','BLOCK']) {
    const input={...output(),safety};assert.equal(run(input,plan('NONE','','NONE'),context(),'Ćao.'),input);
  }
});

test('failure diagnostics contain counts and fixed codes, not the current private quote or dates',()=>{
  diagnostics.length=0;
  const secret='Privatna poruka za proveru odsustva u logu.';
  denied(run(output({windowsUpsert:[window()]}),plan('WEEKLY',secret),context(),secret));
  const log=JSON.stringify(diagnostics);assert.doesNotMatch(log,/Privatna|2026-11-07|08:00/);
  assert.match(log,/SCOPE_MISMATCH/);
});
