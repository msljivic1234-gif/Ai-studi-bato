'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const ts=require('typescript');
const source=fs.readFileSync(path.join(__dirname,'../src/features/voiceMessages/voiceMessageComposer.ts'),'utf8');
const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const mod={exports:{}};
new Function('module','exports','require',js)(mod,mod.exports,id=>{
  if(id==='./voiceCopy')return {VOICE_ERROR_COPY:{OUTCOME_UNKNOWN:'Proverite stanje.'}};
  throw Error('UNEXPECTED_VOICE_IMPORT:'+id);
});
const uuid=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
const accountId=uuid(1), agreementId=uuid(2), assetId=uuid(3);
const ref={agreementId,agreementVersion:1,clientRequestId:uuid(4)};
function fixture(){
  let entries=[], sends=0,cancels=0,reads=0;
  const composer=mod.exports.createVoiceMessageComposer({
    accountId,accountRevision:1,agreementId,isCurrent:()=>true,
    agreement:()=>({version:1,writable:true}),
    recorder:{cancel:async()=>{}}, player:{stop:async()=>{},release:async()=>{}}, files:{remove:async()=>{}},
    arbiter:{}, journal:{load:async()=>[ref],clear:async()=>{}},
    uploads:{read:async()=>{reads++;return {ok:true,podatak:{state:'READY',assetId,voice:{durationMs:1500},attachedMessageId:null}}},
      cancel:async()=>{cancels++;return {ok:true,podatak:{state:'CANCELLED',assetId,voice:null,attachedMessageId:null}}}},
    outbox:{getSnapshot:()=>({capturing:false,entries}),sendVoice:async()=>{sends++;entries=[...entries,{command:{voice:{assetId}}}];}},
    newRequestId:()=>uuid(5),timers:{setInterval:()=>1,clearInterval:()=>{}}
  });
  return {composer,markCaptured(){entries=[{command:{voice:{assetId}}}]},stats:()=>({sends,cancels,reads})};
}
test('recovered voice cannot be sent again after the outbox captures the asset',async()=>{
  const f=fixture();
  try {
    await f.composer.restore();
    assert.equal(f.composer.getSnapshot().recovered.length,1);
    f.markCaptured();
    await f.composer.sendRecovered(ref);
    assert.equal(f.stats().sends,0,'second message key must not be generated');
    assert.equal(f.composer.getSnapshot().recovered.length,0,'already owned asset is not offered again');
  }finally{await f.composer.dispose()}
});
test('recovered voice cannot be cancelled after the outbox captures the asset',async()=>{
  const f=fixture();
  try{
    await f.composer.restore();
    assert.equal(f.composer.getSnapshot().recovered.length,1);
    f.markCaptured();
    await f.composer.discardRecovered(ref);
    assert.equal(f.stats().cancels,0,'a pending send must not lose its uploaded recording');
    assert.equal(f.composer.getSnapshot().recovered.length,0);
  }finally{await f.composer.dispose()}
});

test('an unowned recovered recording is still sendable with one durable capture',async()=>{
  const f=fixture();
  try {
    await f.composer.restore();
    await f.composer.sendRecovered(ref);
    assert.equal(f.stats().sends,1);
    assert.equal(f.stats().cancels,0);
    assert.equal(f.composer.getSnapshot().recovered.length,0);
  }finally{await f.composer.dispose()}
});
test('an unowned recovered recording can still be explicitly cancelled',async()=>{
  const f=fixture();
  try {
    await f.composer.restore();
    await f.composer.discardRecovered(ref);
    assert.equal(f.stats().sends,0);
    assert.equal(f.stats().cancels,1);
    assert.equal(f.composer.getSnapshot().recovered.length,0);
  }finally{await f.composer.dispose()}
});
