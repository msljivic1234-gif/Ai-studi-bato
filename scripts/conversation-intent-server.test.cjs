'use strict';
// The model labels below are bounded structured-output fixtures, not a claim
// that a live Gemini model classified Serbian correctly. Exercise the real
// admission/field guards and service-list owner without provider I/O.
const test=require('node:test'),assert=require('node:assert/strict');
const helper=import('../supabase/functions/_shared/conversationIntent.mjs');
const decision=async(kind,evidence,current=evidence)=>{
  const h=await helper; return h.takeConversationIntent({conversationIntent:{kind,evidence}},current);
};
const need=()=>({safety:'ALLOW',assistantMessage:'Detalji su u nacrtu.',
  facts:[{key:'need.description',valueJson:'"Pomoć"',displayValue:'Pomoć',confidence:1,evidence:'Pomoć'}],
  dialogue:{next:'REVIEW',questionKey:'NONE',taskRelation:'CONTINUE',priceUnit:'PER_HOUR',schedulePattern:'SINGLE'},
  taxonomyDecisions:[{service:'Pomoć'}],locationDecision:{action:'CONFIRM_DISPLAYED',proposalId:'id',
    explicitConfirmation:true,hasCorrection:false,hasUncertainty:false}});
const worker=()=>({safety:'ALLOW',assistantMessage:'Opis je u nacrtu.',patch:{bio:'Promenjen opis',availability:{availableNow:true}},
  availabilityChange:{kind:'PATCH',evidence:'Mogu odmah'},serviceChanges:[{action:'ADD',service:'Prevoz',replacement:'',evidence:'Mogu odmah'}],
  taxonomyDecisions:[{service:'Prevoz'}],serviceModeChangesJson:'[{"service":"Prevoz","modes":["ON_SITE"],"evidence":"Mogu odmah"}]'});
const change=(action,service,evidence,replacement='')=>({action,service,replacement,evidence});
const mutation=async({kind='WORKER_ADD_SERVICE',current,base=['Prevoz','Utovar i istovar'],changes,patch={bio:'Nova tvrdnja'}})=>{
  const h=await helper; return h.applyWorkerServiceChanges({safety:'ALLOW',assistantMessage:'Promena je u nacrtu.',patch},
    changes,{skills:base},current,await decision(kind,current));
};

test('provider schema adds only the structured intent and requires it',async()=>{
  const h=await helper, old={type:'OBJECT',properties:{facts:{type:'ARRAY'}},required:['facts']};
  const next=h.withConversationIntentSchema(old);
  assert.deepEqual(next.required,['facts','conversationIntent']);
  assert.deepEqual(next.properties.conversationIntent.required,['kind','evidence']);
  assert.equal(next.properties.conversationIntent.additionalProperties,false);
  assert.deepEqual(old.required,['facts']);
});

test('current quote accepts whitespace and NFKC, retaining original script',async()=>{
  const h=await helper, evidence='Ја нудим онлајн часове француског';
  const out=h.takeConversationIntent({conversationIntent:{kind:'WORKER_OFFER',evidence},facts:[]},'Ја\nнудим онлајн  часове француског.');
  assert.equal(out.valid,true); assert.equal(out.intent.evidence,evidence); assert.deepEqual(out.output,{facts:[]});
});

test('stale, translated, invented, malformed and oversized evidence fails closed',async()=>{
  const h=await helper, current='Nudim prevoz.';
  for(const intent of [undefined,null,{}, {kind:'WORKER_OFFER',evidence:''},
    {kind:'WORKER_OFFER',evidence:'Ја нудим превоз'}, {kind:'WORKER_OFFER',evidence:'Stari citat'},
    {kind:'WORKER_OFFER',evidence:'Nudim prevoz',consent:true}, {kind:'UNKNOWN',evidence:current},
    {kind:'WORKER_OFFER',evidence:'x'.repeat(501)}, {kind:'WORKER_OFFER',evidence:'Nudim\u0000prevoz'}]) {
    const out=h.takeConversationIntent({conversationIntent:intent},current);
    assert.equal(out.valid,false); assert.equal(h.intentAllowsDomain(out,'WORKER'),false);
    assert.equal(h.conversationIntentHint(out,'ALLOW'),null);
  }
});

test('short continuation may have no quote; other actionable kinds require it',async()=>{
  const h=await helper;
  for(const current of ['Ćao.','Da.','Ne.','To je to.','Sutra.','Posle četiri.','Nemam kombi.','Samo utovar.',
    'Mislim na evre.','Ne treba odvoz.','Može i petak.','I subotu bih mogao.','Променио сам мишљење.']) {
    const d=await decision('CONTINUE','',current);
    assert.equal(d.valid,true); assert.equal(h.intentAllowsDomain(d,'NEED'),true);
    assert.equal(h.intentAllowsDomain(d,'WORKER'),true);
  }
  assert.equal((await decision('UNCLEAR','','Ćao')).valid,true);
  assert.equal((await decision('WORKER_REMOVE_SERVICE','','Ne')).valid,false);
});

for(const phrase of ['Ja nudim onlajn časove francuskog.','Predajem francuski preko interneta.',
  'Ја нудим онлајн часове француског.','Nudim prevoz, ne radim utovar.']) {
  test('Need blocks task/category/map proposals for worker offer: '+phrase,async()=>{
    const h=await helper, d=await decision('WORKER_OFFER',phrase);
    const out=h.guardInterviewIntentOutput(need(),d,'NEED');
    assert.deepEqual(out.facts,[]); assert.deepEqual(out.taxonomyDecisions,[]);
    assert.equal(out.locationDecision.action,'CONTINUE'); assert.equal(out.locationDecision.explicitConfirmation,false);
    assert.equal(out.dialogue.next,'ANSWER'); assert.match(out.assistantMessage,/radni profil/);
    assert.doesNotMatch(out.assistantMessage,/sačuva|objavlj|prebacio/);
    assert.equal(h.intentAllowsDomain(d,'NEED'),false);
  });
}

test('Worker help request cannot become a skill, area, availability or mode',async()=>{
  const h=await helper,d=await decision('NEED_REQUEST','Treba mi neko da mi popravi slavinu.');
  const out=h.guardInterviewIntentOutput(worker(),d,'WORKER');
  assert.deepEqual(out.patch,{availability:null}); assert.deepEqual(out.serviceChanges,[]);
  assert.deepEqual(out.availabilityChange,{kind:'NONE',evidence:''}); assert.deepEqual(out.taxonomyDecisions,[]);
  assert.equal(out.serviceModeChangesJson,'[]'); assert.match(out.assistantMessage,/novi zadatak/);
});

test('mixed domains ask one intent question and never retain tentative changes',async()=>{
  const h=await helper,d=await decision('MIXED','Imam kombi i radim prevoz, ali danas mi trebaju dvojica za istovar.');
  for(const domain of ['NEED','WORKER']) {
    const out=h.guardInterviewIntentOutput(domain==='NEED'?need():worker(),d,domain);
    assert.equal(out.safety,'CLARIFY'); assert.equal((out.assistantMessage.match(/\?/g)||[]).length,1);
    assert.equal(h.intentAllowsDomain(d,domain),false);
    assert.equal(domain==='NEED'?out.facts.length:out.serviceChanges.length,0);
  }
});

test('direct question keeps the actual answer without business edits',async()=>{
  const h=await helper,d=await decision('QUESTION','Kako se objavljuje zadatak?');
  const source={...need(),assistantMessage:'Pregled proverite, a zatim Vi potvrđujete objavljivanje.'};
  const out=h.guardInterviewIntentOutput(source,d,'NEED');
  assert.equal(out.assistantMessage,source.assistantMessage); assert.deepEqual(out.facts,[]);
});

test('facts plus a question remain same-domain facts, not QUESTION-only',async()=>{
  const h=await helper,phrase='Trebaju mi dvojica sutra. Kako se plaća?';
  const d=await decision('NEED_REQUEST',phrase),source=need();
  assert.equal(h.guardInterviewIntentOutput(source,d,'NEED'),source);
  assert.equal(h.intentAllowsDomain(d,'NEED'),true);
});

test('unknown metadata asks intent without breaking the strict old parser shape',async()=>{
  const h=await helper,d=h.takeConversationIntent({},'Promenio sam mišljenje.');
  const source={safety:'ALLOW',assistantMessage:'U redu.',facts:[],dialogue:need().dialogue};
  const out=h.guardInterviewIntentOutput(source,d,'NEED');
  assert.equal(out.safety,'CLARIFY'); assert.equal(Object.hasOwn(out,'taxonomyDecisions'),false);
  assert.equal(Object.hasOwn(out,'locationDecision'),false);
});

test('valid UNCLEAR preserves its short local question instead of restarting role selection',async()=>{
  const h=await helper,d=await decision('UNCLEAR','Promenio sam mišljenje.');
  for(const question of ['Šta želite da promenite?','Koju postojeću uslugu želite da uklonite?','Који термин Вам сада одговара?']) {
    const out=h.guardInterviewIntentOutput({...need(),assistantMessage:question},d,'NEED');
    assert.equal(out.assistantMessage,question); assert.deepEqual(out.facts,[]);
  }
  const prefixed=h.guardInterviewIntentOutput({...need(),assistantMessage:'Profil je sačuvan. Šta želite da promenite?'},d,'NEED');
  assert.equal(prefixed.assistantMessage,'Šta želite da promenite?');
  const unsafe=h.guardInterviewIntentOutput({...need(),assistantMessage:'Prebacio sam Vas, šta želite da promenite?'},d,'NEED');
  assert.equal(unsafe.assistantMessage,'Šta biste želeli da promenite ili razjasnite?');
});

test('safety REVIEW/BLOCK freezes both domains and cannot emit a handoff hint',async()=>{
  const h=await helper,d=await decision('WORKER_OFFER','Nudim prevoz.');
  for(const safety of ['REVIEW','BLOCK']) for(const domain of ['NEED','WORKER']) {
    const out=h.guardInterviewIntentOutput({... (domain==='NEED'?need():worker()),safety},d,domain);
    assert.equal(out.safety,safety); assert.equal(domain==='NEED'?out.facts.length:out.serviceChanges.length,0);
    assert.equal(h.conversationIntentHint(d,safety),null);
  }
});

test('valid hint remains versioned advisory metadata, never an authority token',async()=>{
  const h=await helper,d=await decision('WORKER_OFFER','Nudim prevoz.');
  assert.deepEqual(h.conversationIntentHint(d,'ALLOW'),{
    schemaVersion:'AI_CONVERSATION_INTENT_V1',kind:'WORKER_OFFER',evidence:'Nudim prevoz.'});
  assert.equal(h.INTERVIEW_INTENT_HEADER,'x-uskoci-interview-intent');
});

for(const [current,service] of [['Takođe popravljam slavine.','Popravka slavina'],
  ['Sada radim i prevode.','Prevođenje'],['Додај и кошење траве.','Кошење траве']]) {
  test('quoted ADD preserves all existing services: '+current,async()=>{
    const out=await mutation({current,changes:[change('ADD',service,current)]});
    assert.equal(out.valid,true); assert.deepEqual(out.output.patch.skills,['Prevoz','Utovar i istovar',service]);
  });
}

test('REMOVE exact physical service keeps transport and every unrelated service',async()=>{
  const current='Prevoz radim, ali utovar više ne.';
  const out=await mutation({kind:'WORKER_REMOVE_SERVICE',current,changes:[change('REMOVE','Utovar i istovar',current)]});
  assert.equal(out.valid,true); assert.deepEqual(out.output.patch.skills,['Prevoz']);
});

test('partial combined-service correction replaces only that one service',async()=>{
  const current='Radim selidbe, ali samo kao ispomoć. Nemam kombi.';
  const out=await mutation({kind:'WORKER_EDIT_SERVICE',current,base:['Selidbe sa prevozom','Krečenje'],
    changes:[change('REPLACE','Selidbe sa prevozom',current,'Fizička pomoć pri selidbi')]});
  assert.equal(out.valid,true); assert.deepEqual(out.output.patch.skills,['Fizička pomoć pri selidbi','Krečenje']);
});

test('explicit withdrawal can remove the final service without inventing a replacement',async()=>{
  const current='Više ne radim selidbe.';
  const out=await mutation({kind:'WORKER_REMOVE_SERVICE',current,base:['Selidbe'],changes:[change('REMOVE','Selidbe',current)]});
  assert.equal(out.valid,true); assert.deepEqual(out.output.patch.skills,[]);
});

test('vehicle absence or ownership with no service plan adds nothing',async()=>{
  for(const current of ['Nemam kombi.','Imam kombi, ali ne radim utovar.']) {
    const out=await mutation({kind:'CONTINUE',current,changes:[],patch:{bio:current}});
    assert.equal(out.valid,true); assert.equal(Object.hasOwn(out.output.patch,'skills'),false);
  }
});

test('stale/ambiguous/duplicate/mismatched operations cannot mutate services or their biography',async()=>{
  const current='Više ne radim selidbe.';
  const cases=[undefined,[change('REMOVE','Selidbe',current)], // no exact owned target
    [change('REMOVE','Prevoz','Stari citat')], [change('ADD','Popravka slavina',current)],
    [change('REMOVE','Prevoz',current),change('REMOVE','Prevoz',current)],
    [change('REMOVE','Prevoz',current,'Nova usluga')],
    [{...change('REMOVE','Prevoz',current),categoryId:'untrusted'}]];
  for(const changes of cases) {
    const out=await mutation({kind:'WORKER_REMOVE_SERVICE',current,changes,patch:{bio:'Prevoz je uklonjen.',displayName:'Ime'}});
    assert.equal(out.valid,false); assert.equal(out.output.safety,'CLARIFY');
    assert.deepEqual(out.output.patch,{displayName:'Ime'});
    assert.match(out.output.assistantMessage,/Koju uslugu/);
  }
});

test('legacy provider complete-list patch cannot erase services beside a valid new plan',async()=>{
  const current='Dodaj košenje trave.';
  const out=await mutation({current,changes:[change('ADD','Košenje trave',current)],patch:{skills:['Košenje trave'],bio:'Samo košenje'}});
  assert.equal(out.valid,false); assert.deepEqual(out.output.patch,{});
});

test('invalid service label is withheld before the strict writer rejects the whole turn',async()=>{
  const current='Dodaj košenje trave.';
  for(const service of ['Košenje\ntrave','<Košenje trave>','Ko','x'.repeat(121)]) {
    const out=await mutation({current,changes:[change('ADD',service,current)]});
    assert.equal(out.valid,false); assert.equal(Object.hasOwn(out.output.patch,'skills'),false);
  }
});

test('availability-only intent cannot smuggle a service mutation',async()=>{
  const current='Mogu odmah.';
  const out=await mutation({kind:'WORKER_AVAILABILITY',current,changes:[change('ADD','Prevođenje',current)]});
  assert.equal(out.valid,false); assert.equal(Object.hasOwn(out.output.patch,'skills'),false);
});

test('rejected mode metadata cannot reclassify an unmentioned preserved service',async()=>{
  const {indexFullCatalog,buildWorkerFullTreeTaxonomyProposals}=await import('../supabase/functions/_shared/backgroundTaxonomyArchitect.mjs');
  const current='Prevoz radim, ali utovar više ne.';
  const changed=await mutation({kind:'WORKER_REMOVE_SERVICE',current,changes:[change('REMOVE','Utovar i istovar',current)]});
  const catalog=indexFullCatalog(8,'test-fingerprint',[
    {categoryId:'10000000-0000-0000-0000-000000000001',parentId:null,label:'Prevoz',isLeaf:true,modes:['ON_SITE'],aliases:[]},
    {categoryId:'10000000-0000-0000-0000-000000000002',parentId:null,label:'Utovar i istovar',isLeaf:true,modes:['ON_SITE'],aliases:[]},
  ],true);
  const built=await buildWorkerFullTreeTaxonomyProposals({skills:changed.output.patch.skills,
    messages:[{role:'USER',body:current}],serviceModeChangesJson:'[]',draftRevision:3,
    serviceModeContext:{savedServices:[{service:'Prevoz',mode:'ON_SITE',categoryId:'10000000-0000-0000-0000-000000000001'},
      {service:'Utovar i istovar',mode:'ON_SITE',categoryId:'10000000-0000-0000-0000-000000000002'}],draftServices:[],unresolvedServices:[]},
    suppliedCatalog:catalog,suppliedDecisions:[{service:'Prevoz',mode:'ON_SITE',action:'REUSE_EXISTING',
      categoryId:'10000000-0000-0000-0000-000000000002',reason:'Unsolicited wrong category.'}]});
  assert.equal(built.proposals.length,1); assert.equal(built.proposals[0].service,'Prevoz');
  assert.equal(built.proposals[0].categoryId,'10000000-0000-0000-0000-000000000001');
});

test('actual Need invalid-fact diagnostic never logs private provider values',()=>{
  const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript');
  const source=fs.readFileSync(path.join(__dirname,'../supabase/functions/uskoci-ai-interview/index.ts'),'utf8');
  const ast=ts.createSourceFile('index.ts',source,ts.ScriptTarget.ES2022,true,ts.ScriptKind.TS);
  const fn=ast.statements.find(node=>ts.isFunctionDeclaration(node)&&node.name?.text==='parseV2Output');
  assert.ok(fn,'exercise the actual current Edge parser');
  const {outputText,diagnostics}=ts.transpileModule(fn.getText(ast),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS},reportDiagnostics:true});
  assert.equal(diagnostics.length,0);
  const logged=[],dialogue={next:'ACK',questionKey:'NONE',taskRelation:'CONTINUE',priceUnit:'UNSPECIFIED',schedulePattern:'UNSPECIFIED'};
  const sandbox={rejectManualOnlyFacts:()=>{},exact:(v,keys)=>v&&Object.keys(v).length===keys.length&&keys.every(k=>Object.hasOwn(v,k)),
    DIALOGUE_VALUES:Object.fromEntries(Object.entries(dialogue).map(([k,v])=>[k,[k==='questionKey'?'':v]])),
    parseSafety:value=>value,interviewFactKeySet:new Set(['need.exact_address']),valueMatchesContract:()=>false,
    console:{info:(...args)=>logged.push(args),warn:(...args)=>logged.push(args)}};
  vm.runInNewContext(outputText+'\nthis.run = parseV2Output;',sandbox,{timeout:1000});
  const secret='Privatna adresa korisnika koja ne sme u log';
  const out=sandbox.run({safety:'ALLOW',assistantMessage:'Koje je mesto zadatka?',dialogue,facts:[{
    key:'need.exact_address',valueJson:JSON.stringify({privateAddress:secret}),displayValue:secret,evidence:secret,confidence:1}]});
  assert.equal(out.proposals.length,0);
  assert.deepEqual(logged,[['NEED_AI_OUTPUT_GATE_FACT_SKIPPED','need.exact_address']]);
  assert.equal(JSON.stringify(logged).includes(secret),false);
});
