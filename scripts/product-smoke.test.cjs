'use strict';
          const test=require('node:test');
          const assert=require('node:assert/strict');
          const fs=require('node:fs'),path=require('node:path');
          const root=path.resolve(__dirname,'..');
          const exists=p=>fs.existsSync(path.join(root,p));
          test('app has both real AI interview routes',()=>{
            for(const p of ['src/app/(app)/nova.tsx','src/app/(app)/profil/razgovor.tsx',
              'src/ui/aiFirst/AiConversationShell.tsx','src/ui/v2/IntakePresentation.tsx'])
              assert.ok(exists(p),p);
          });
          test('one shared service handoff contract exists for both client and Edge',()=>{
            const client=fs.readFileSync(path.join(root,'src/contracts/serviceHandoff.ts'),'utf8');
            assert.ok(client.includes("from '../../supabase/functions/_shared/serviceHandoff.mjs'"));
            assert.ok(exists('supabase/functions/_shared/serviceHandoff.mjs'));
          });
          test('both Edge interview entrypoints are retained',()=>{
            for(const p of ['supabase/functions/uskoci-ai-interview/index.ts',
              'supabase/functions/uskoci-worker-interview/index.ts'])assert.ok(exists(p),p);
          });
          test('canonical database migration history is still present',()=>{
            const dir=path.join(root,'supabase/migrations');
            assert.equal(fs.readdirSync(dir).filter(x=>x.endsWith('.sql')).length>100,true);
          });
          test('native patch and app entry generation inputs are kept',()=>{
            for(const p of ['patches/react-native-reanimated+4.5.1.patch',
              'scripts/verify-native-patches.cjs','scripts/sync-entry-reference-assets.cjs',
              'assets/brand/reference-entry/provenance.json','vendor/decode-uri-component-compat/package.json'])
              assert.ok(exists(p),p);
          });
          test('production tree has no historical QA corpora or extra masters',()=>{
            for(const p of ['supabase/proofs','supabase/candidates','supabase/operations',
              'src/data/__tests__','src/designLab','docs/continuation','jest.config.cjs'])
              assert.equal(exists(p),false,p);
            for(const p of ['docs/plan/CODEX_PLAN_RADA.md','docs/product/USKOCI_PRODUCT_UX_MASTER.md'])
              assert.ok(exists(p),p);
          });
          test('normal product screens keep active visual resources',()=>{
            for(const p of ['assets/illustrations/natural-v1/home.webp',
              'assets/illustrations/uskoci-clock-v1.png',
              'assets/illustrations/uskoci-messages-v2.png'])
              assert.ok(exists(p),p);
          });
          test('AI timing distinguishes active phases without logging private text',async()=>{
            const {measureAiPhase}=await import('../supabase/functions/_shared/aiPhaseTiming.mjs');
            const phases=['NEED_FULL_CATALOG','WORKER_FULL_CATALOG','NEED_TAXONOMY_VALIDATE','WORKER_TAXONOMY_VALIDATE'];
            const original=console.info, logs=[];
            console.info=(...args)=>logs.push(args);
            try {
              const value={private:'PRIVATE_RESULT'}, error=new Error('PRIVATE_ERROR');
              for(const phase of phases)assert.equal(await measureAiPhase(phase,async()=>value),value);
              await assert.rejects(measureAiPhase('PRIVATE_PROMPT',async()=>{throw error;}),e=>e===error);
              assert.deepEqual(logs.map(row=>row[1]),[...phases,'UNKNOWN']);
              assert.ok(logs.every(row=>row.length===4&&row[0]==='AI_PHASE_MS'&&Number.isFinite(row[2])&&row[2]>=0));
              assert.equal(logs.at(-1)[3],'FAILED');
              assert.equal(JSON.stringify(logs).includes('PRIVATE_'),false);
            } finally {console.info=original;}
          });

test('voice retry requires a retained send intent',async()=>{
  const ts=require('typescript');
  const source=fs.readFileSync(path.join(root,'src/features/voiceMessages/voiceMessageComposer.ts'),'utf8');
  const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  const mod={exports:{}};
  new Function('module','exports','require',js)(mod,mod.exports,id=>{
    if(id==='./voiceCopy')return {VOICE_ERROR_COPY:{UPLOAD_UNCONFIRMED:'Proverite stanje.'}};
    throw new Error('UNEXPECTED_VOICE_IMPORT:'+id);
  });
  function make(newRequestId,save){
    const lease=()=>{};lease.isCurrent=()=>true;
    return mod.exports.createVoiceMessageComposer({
      accountId:'00000000-0000-4000-8000-000000000001',accountRevision:1,
      agreementId:'00000000-0000-4000-8000-000000000002',isCurrent:()=>true,
      agreement:()=>({version:1,writable:true}),
      recorder:{requestPermission:async()=> 'granted',start:async()=>{},
        stop:async()=>({uri:'local-recording',durationMs:1200}),cancel:async()=>{},onInterrupted:()=>()=>{}},
      player:{stop:async()=>{},release:async()=>{}},
      files:{remove:async()=>{},read:async()=>new ArrayBuffer(64)},
      arbiter:{claim:async()=>lease},
      uploads:{upload:async()=>{throw Error('UNEXPECTED_UPLOAD');},read:async()=>{throw Error('UNEXPECTED_READ');},cancel:async()=>{throw Error('UNEXPECTED_CANCEL');}},
      journal:{load:async()=>[],save,clear:async()=>{}},
      outbox:{getSnapshot:()=>({capturing:false,entries:[]}),sendVoice:async()=>{}},
      newRequestId,timers:{setInterval:()=>1,clearInterval:()=>{}}
    });
  }
  for(const [newId,save,shouldRetry] of [
    [()=>{throw Error('NO_KEY');},async()=>{},false],
    [()=> '00000000-0000-4000-8000-000000000003',async()=>{throw Error('STORAGE_DOWN');},true]
  ]){
    const voice=make(newId,save);
    await voice.start();assert.equal(voice.getSnapshot().phase,'recording');
    await voice.stop();assert.equal(voice.getSnapshot().phase,'review');
    await voice.send();assert.equal(voice.getSnapshot().phase,'failed');
    assert.equal(voice.getSnapshot().canRetry,shouldRetry);
    await voice.dispose();
  }
});

test('signed task readiness follows the server handoff projection',async t=>{
  const ts=require('typescript'),mod={exports:{}};
  const source=fs.readFileSync(path.join(root,'src/features/ai/intake/intakeReviewReadiness.ts'),'utf8');
  const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  // Unit boundary: decoded location/summary inputs, no provider, transport or native calls.
  new Function('module','exports','require',js)(mod,mod.exports,id=>{
    if(id==='../../../data/reviewFactProblem')return {reviewFactProblem:()=>null};
    if(id==='../../../ui/v2/draftSummary')return {completeDraftProposal:()=>true};
    if(id==='../../../lib/location')return {normalizeNeedLocation:v=>v?.geography?v:null,pointsMissing:()=>({total:1,done:1})};
    throw Error('UNEXPECTED_READINESS_IMPORT:'+id);
  });
  const now=Date.parse('2026-11-04T12:00:00Z');
  function fixture(mode='STATIONARY'){
    const facts=[['need.task_country_code','RS'],['need.task_geography',mode==='REMOTE'?{mode}:{mode,start:{city:'Novi Sad'}}],
      ['need.title','Popravka stolice'],['need.description','Popravka drvene stolice'],['need.category','Popravka nameštaja'],
      ['need.price_mode','MY_PRICE'],['need.price_rsd',3000],['need.people_needed',1],['need.schedule_kind','FLEXIBLE'],
      ['need.handoff',{required:true,localExchange:{countryCode:'RS',city:'Novi Sad'}}]]
      .map(([key,value],i)=>({id:String(i),key,value,status:'CONFIRMED',privacyClass:'PUBLIC'}));
    const conversation={conversationId:'conversation-a',status:'OPEN',safety:'ALLOW',facts,messages:[]};
    const review={conversationId:conversation.conversationId,canAccept:true,safety:'ALLOW',classificationState:'READY',
      missingRequired:[],expiresAt:'2026-11-04T12:15:00Z',
      publicProjection:structuredClone(facts.filter(f=>mode==='REMOTE'||f.key!=='need.handoff')),ownerPrivateProjection:[],
      location:{taskCountryCode:'RS',geography:structuredClone(facts[1].value),exactAddress:null,accessNotes:null,resolvedLocation:null}};
    return {conversation,review};
  }
  const ready=({conversation,review})=>mod.exports.taskReviewReady(review,conversation,now);
  await t.test('on-site mode correction does not get stuck on the previous handoff',()=>assert.equal(ready(fixture()),true));
  await t.test('remote handoff must remain visible',()=>{
    const f=fixture('REMOTE');assert.equal(ready(f),true);
    f.review.publicProjection=f.review.publicProjection.filter(x=>x.key!=='need.handoff');assert.equal(ready(f),false);
  });
  await t.test('remote handoff changes invalidate the review',()=>{
    const f=fixture('REMOTE');f.review.publicProjection.find(x=>x.key==='need.handoff').value={required:false};assert.equal(ready(f),false);
  });
  await t.test('price and geography mismatches still block review',()=>{
    const f=fixture();f.conversation.facts=f.conversation.facts.filter(x=>x.key!=='need.handoff');assert.equal(ready(f),true);
    f.review.publicProjection.find(x=>x.key==='need.price_rsd').value=4000;assert.equal(ready(f),false);
    f.review.publicProjection.find(x=>x.key==='need.price_rsd').value=3000;f.review.location.geography={mode:'REMOTE'};assert.equal(ready(f),false);
  });
  await t.test('on-site signed review cannot add an extra handoff',()=>{
    const f=fixture();f.review.publicProjection.push(structuredClone(f.conversation.facts.at(-1)));assert.equal(ready(f),false);
  });
  await t.test('expired, unclassified and unaccepted reviews stay blocked',()=>{
    for(const change of [{expiresAt:'2026-11-04T11:59:59Z'},{classificationState:'PENDING_CLASSIFICATION'},{canAccept:false}]){
      const f=fixture();Object.assign(f.review,change);assert.equal(ready(f),false);
    }
  });
  await t.test('comparison does not mutate facts or weaken the cache identity',()=>{
    const f=fixture(),before=structuredClone(f),key=mod.exports.taskReadinessKey(f.conversation);
    ready(f);assert.deepEqual(f,before);f.conversation.facts.at(-1).value={required:false};
    assert.notEqual(mod.exports.taskReadinessKey(f.conversation),key);
  });
});


test('Worker Gemini text streaming is opt-in and never bypasses signed persistence',()=>{
  const edge=fs.readFileSync(path.join(root,'supabase/functions/uskoci-worker-interview/index.ts'),'utf8');
  const transport=fs.readFileSync(path.join(root,'src/data/aiNeedTurnStream.ts'),'utf8');
  const shell=fs.readFileSync(path.join(root,'src/ui/aiFirst/AiConversationShell.tsx'),'utf8');
  const workerRoute=fs.readFileSync(path.join(root,'src/app/(app)/profil/razgovor.tsx'),'utf8');
  const needRoute=fs.readFileSync(path.join(root,'src/app/(app)/nova.tsx'),'utf8');
  assert.ok(transport.includes("'x-uskoci-worker-preview-stream': 'v1'"));
  assert.ok(edge.includes("req.headers.get('x-uskoci-worker-preview-stream')==='v1'"));
  assert.ok(edge.includes('x-client-info,x-uskoci-worker-preview-stream'));
  const provider=edge.indexOf("const raw=await measureAiPhase('PROVIDER'");
  const preview=edge.indexOf("send('text_delta',{text:delta})",provider);
  const signed=edge.indexOf("const completionRpc=",provider);
  assert.ok(provider>=0 && preview>provider && signed>preview,'preview precedes authoritative SQL completion');
  assert.ok(edge.includes("if(previewStream&&!abort.signal.aborted)"));
  assert.ok(edge.includes("if(!previewStream)send('text_delta',{text:output.assistantMessage});"));
  const final=edge.indexOf("send('final',{turn,",signed);
  assert.ok(final>signed,'the final still follows authoritative completion');
  assert.ok(edge.includes("...(wantsIntent && intentHint ? {conversationIntent:intentHint} : {})"),
    'only opted-in clients receive advisory metadata beside the unchanged turn');
  assert.ok(workerRoute.includes('setStream(value=>value+delta)'));
  assert.ok(needRoute.includes('setStreamingText((prev) => prev + delta)'));
  assert.ok(shell.includes('Odgovor u pripremi · podaci još nisu potvrđeni'));
});
