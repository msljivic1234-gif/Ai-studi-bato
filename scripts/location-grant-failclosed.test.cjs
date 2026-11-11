'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const ts=require('typescript');
const file=fs.readFileSync(path.join(__dirname,'..','src','ui','AgreementPrivateLocation.tsx'),'utf8');
const parsed=ts.createSourceFile('AgreementPrivateLocation.tsx',file,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
let expression=null;
const visit=node=>{
  if(ts.isVariableDeclaration(node)&&node.name.getText(parsed)==='read'&&node.initializer
    &&ts.isCallExpression(node.initializer)&&node.initializer.expression.getText(parsed)==='useCallback')
    expression=node.initializer.getText(parsed);
  ts.forEachChild(node,visit);
};
visit(parsed);
assert.ok(expression,'must test the real private-location reader');
const compiled=ts.transpileModule('const read = '+expression+';\nthis.extractedRead = read;',
 {compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
const idA='11111111-1111-4111-8111-111111111111', idB='22222222-2222-4222-8222-222222222222',
 idC='33333333-3333-4333-8333-333333333333';
const granted={id:idC,status:'GRANTED',ownerAccountId:idA,recipientAccountId:idB,
  grantedAt:'2026-11-06T20:00:00Z',expiresAt:null};
const state={agreementId:idC,accountId:idB,grants:[granted]};
const reveal={agreementId:idC,grantId:idC,grantedAt:granted.grantedAt,expiresAt:null};
async function scenario(response) {
  let cacheReads=0,clears=0;
  const context={useCallback:fn=>fn,agreementId:idC,accountId:idB,requesterId:idA,workerId:idB,
    source:{lokacijskaDozvola:async()=>response}, intent:{current:{}}, appActive:()=>true,
    invalid:()=>({ok:false,kod:'LOCATION_SCOPE_CHANGED'}),
    readCachedLocation:async()=>{cacheReads++;return {state,revealed:reveal};},
    clearCachedAgreementLocation:async()=>{clears++;},activeGrant:grant=>grant?.status==='GRANTED',
    Date};
  vm.runInNewContext(compiled,context,{timeout:1000});
  const result=await context.extractedRead();
  return {result,cacheReads,clears};
}
for(const code of ['NOT_PARTY','AUTH_REQUIRED','LOCATION_UNAVAILABLE']) {
  test('failed '+code+' never reveals cached address',async()=>{
    const s=await scenario({ok:false,kod:code});
    assert.equal(s.result.ok,false);
    assert.equal(s.cacheReads,0);
    assert.equal(s.clears,1);
  });
}
test('current active grant may retain exact reveal for same scope',async()=>{
  const s=await scenario({ok:true,podatak:state});
  assert.equal(s.result.ok,true);
  assert.equal(s.result.podatak.revealed?.grantId,idC);
  assert.equal(s.cacheReads,1);
  assert.equal(s.clears,0);
});
test('revoked grant removes cache and hides revealed address',async()=>{
  const revoked={...state,grants:[{...granted,status:'REVOKED'}]};
  const s=await scenario({ok:true,podatak:revoked});
  assert.equal(s.result.ok,true);
  assert.equal(s.result.podatak.revealed,null);
  assert.equal(s.cacheReads,0);
  assert.equal(s.clears,1);
});
test('wrong account response fails closed and clears stale cache',async()=>{
  const s=await scenario({ok:true,podatak:{...state,accountId:idA}});
  assert.equal(s.result.ok,false);
  assert.equal(s.cacheReads,0);
  assert.equal(s.clears,1);
});
