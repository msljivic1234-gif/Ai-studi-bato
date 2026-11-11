'use strict';
/** Real DEV claim/dispatch/fail/status/recovery functions in isolated PostgreSQL.
 * Account lifecycle and context hash dependencies are bounded fixtures. No model,
 * budget reservation, private user conversation or live data is touched.
 */
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),ts=require('typescript');
const {PGlite}=require('@electric-sql/pglite');
const root=path.resolve(__dirname,'..');
const preimage=JSON.parse(fs.readFileSync(path.join(__dirname,'sql/r06_dispatch_preimage_20261107.json'),'utf8'));
const candidate=fs.readFileSync(path.join(__dirname,'sql/r06_provider_dispatch_retention_20261107.sql'),'utf8');
const A='10000000-0000-4000-8000-000000000001',C='20000000-0000-4000-8000-000000000001';
const R='30000000-0000-4000-8000-000000000001',OTHER_R='30000000-0000-4000-8000-000000000002';
const signature='public.rpc_ai_fail_need_turn_v2_service(uuid,uuid,uuid,uuid)';
const setup=`
 create schema private;create schema auth;create schema extensions;
 create role anon;create role authenticated;create role service_role;
 grant usage on schema public,private,auth to anon,authenticated,service_role;
 create table public.ai_conversations(id uuid primary key,account_id uuid,purpose text,fact_schema_version text,status text);
 create table private.ai_need_turn_commands(account_id uuid,conversation_id uuid,client_request_id uuid,
  turn_id uuid not null default gen_random_uuid(),attempt_id uuid,state text check(state in('PROCESSING','FAILED','SUCCEEDED')),
  provider_dispatched boolean not null default false,cancelled_at timestamptz,lease_expires_at timestamptz,
  context_hash text,request_hash text,receipt jsonb,updated_at timestamptz default clock_timestamp(),
  attempt_times timestamptz[] not null default '{}',primary key(account_id,client_request_id));
 create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
 create function private.closure_assert_open(uuid) returns void language sql as $$ select $$;
 create function private.closure_account_restricted(uuid) returns boolean language sql as $$ select false $$;
 create function private.ai_need_turn_context(uuid) returns jsonb language sql as $$
  select '{"sha256":"ctx","context":{"facts":[],"messages":[]}}'::jsonb $$;
 create function private.ai_location_context_valid(jsonb) returns boolean language sql as $$ select false $$;
 create function private.ai_location_review_matches(uuid,jsonb) returns boolean language sql as $$ select false $$;
 create function private.ai_location_request_hash(uuid,text,jsonb) returns text language sql immutable as $$
  select encode(sha256(convert_to(jsonb_build_object('conversationId',$1,'text',btrim($2))::text,'UTF8')),'hex') $$;
`;
function exactClientRecoveryDecoder() {
 const collect=(file,names)=>{
  const source=fs.readFileSync(path.join(root,file),'utf8');
  const parsed=ts.createSourceFile(file,source,ts.ScriptTarget.ES2022,true);
  const statements=parsed.statements.filter(node=>
   ts.isFunctionDeclaration(node)&&names.includes(node.name?.text)
   || ts.isVariableStatement(node)&&node.declarationList.declarations.some(d=>names.includes(d.name.getText(parsed))));
  assert.equal(statements.length,names.length,'exact current decoder dependencies must be present');
  return statements.map(s=>s.getText(parsed)).join('\n');
 };
 const source=collect('src/data/serverReceipt.ts',['record','uuid','sameId'])+'\n'+
  collect('src/data/aiNeedV2Production.ts',['SAFETY','STATUS','safety','exact','turnReceipt','turnStatus','turnRecovery']);
 const {outputText,diagnostics}=ts.transpileModule(source+'\nexport {turnRecovery};',{
  compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022},reportDiagnostics:true});
 assert.equal(diagnostics.length,0);
 const mod={exports:{}};
 new Function('module','exports','NEED_FACT_SCHEMA_V2','MAX_AI_NEED_FACT_V2_PROPOSALS',outputText)(mod,mod.exports,'NEED_FACT_V2',22);
 return mod.exports.turnRecovery;
}
async function seed(db) {
 await db.exec('reset role;truncate private.ai_need_turn_commands,public.ai_conversations');
 await db.query('select set_config(\'request.jwt.claim.sub\',$1,false)',[A]);
 await db.query('insert into public.ai_conversations values($1,$2,\'NEED_INTAKE\',\'NEED_FACT_V2\',\'OPEN\')',[C,A]);
}
const claim=async(db,key=R)=>(await db.query('select public.rpc_ai_claim_need_turn_v2_service($1,$2,$3,$4) as r',[A,C,key,'Sutra u devet.'])).rows[0].r;
const dispatch=async(db,attempt)=>(await db.query('select public.rpc_ai_dispatch_need_turn_v2_service($1,$2,$3,$4) as r',[A,C,R,attempt])).rows[0].r;
const fail=async(db,attempt,account=A)=>(await db.query('select public.rpc_ai_fail_need_turn_v2_service($1,$2,$3,$4) as r',[account,C,R,attempt])).rows[0].r;
const recover=async db=>(await db.query('select public.rpc_ai_recover_need_turn_v2($1,$2) as r',[C,R])).rows[0].r;
const row=async db=>(await db.query('select to_jsonb(t) as r from private.ai_need_turn_commands t where account_id=$1 and client_request_id=$2',[A,R])).rows[0].r;

test('R06 retains provider dispatch across real Need failure/recovery/claim paths',async t=>{
 const db=new PGlite();const decode=exactClientRecoveryDecoder();
 try {
  await db.exec(setup);
  for(const fn of [...preimage.functions].sort((a,b)=>Number(a.schema_name==='public')-Number(b.schema_name==='public'))) {
   const body=fn.definition.split('AS $function$')[1].split('$function$')[0];
   assert.equal(crypto.createHash('md5').update(body).digest('hex'),fn.body_md5);
   await db.exec(fn.definition);
   const sig=fn.schema_name+'.'+fn.proname+'('+fn.args.split(', ').map(arg=>arg.split(' ').at(-1)).join(',')+')';
   await db.exec('revoke all on function '+sig+' from public,anon,authenticated,service_role;'+
    (fn.schema_name==='public'?'grant execute on function '+sig+' to service_role;':'')+
    (['rpc_ai_read_need_turn_v2','rpc_ai_recover_need_turn_v2'].includes(fn.proname)?'grant execute on function '+sig+' to authenticated;':''));
  }
  await t.test('preimage loses the dispatch fact and admits another attempt for the same request',async()=>{
   await seed(db);const first=await claim(db);const attempt=first.claim.attemptId;
   assert.equal(await dispatch(db,attempt),true);assert.equal((await row(db)).provider_dispatched,true);
   assert.equal((await fail(db,attempt)).retryAllowed,true);
   assert.equal((await recover(db)).providerDispatched,false);
   const second=await claim(db);assert.ok(second.claim);assert.notEqual(second.claim.attemptId,attempt);
   assert.equal((await row(db)).attempt_times.length,2);
  });
  await t.test('candidate preserves RPC owner, ACL, named signature, settings and security',async()=>{
   const before=(await db.query('select to_jsonb(p)-\'prosrc\' as m from pg_proc p where oid=$1::regprocedure',[signature])).rows[0].m;
   await db.exec(candidate);
   const after=(await db.query('select to_jsonb(p)-\'prosrc\' as m,md5(prosrc) as md5 from pg_proc p where oid=$1::regprocedure',[signature])).rows[0];
   assert.deepEqual(after.m,before);assert.equal(after.md5,'1d6ee774d7eae32b2c6d7c6f56e07b10');
  });
  await t.test('post-dispatch failure remains visible and cannot claim or dispatch again',async()=>{
   await seed(db);const first=await claim(db),attempt=first.claim.attemptId;await dispatch(db,attempt);
   const failed=await fail(db,attempt);assert.equal(failed.state,'FAILED');assert.equal(failed.retryAllowed,false);
   const recovery=await recover(db);assert.equal(recovery.providerDispatched,true);assert.equal(recovery.canCancel,false);
   assert.ok(decode(recovery,A,C,R),'the current mobile decoder accepts the existing FAILED+dispatched contract');
   const before=await row(db),second=await claim(db);assert.equal(second.claim,null);
   assert.equal(await dispatch(db,attempt),false);assert.deepEqual(await row(db),before);
   assert.equal(before.attempt_times.length,1);
  });
  await t.test('known failure before dispatch still allows a legitimate new attempt',async()=>{
   await seed(db);const first=await claim(db),attempt=first.claim.attemptId;
   assert.equal((await fail(db,attempt)).retryAllowed,true);assert.equal((await recover(db)).providerDispatched,false);
   const second=await claim(db);assert.ok(second.claim);assert.notEqual(second.claim.attemptId,attempt);
   assert.equal(await dispatch(db,second.claim.attemptId),true);assert.equal((await row(db)).attempt_times.length,2);
  });
  await t.test('repeated failure and stale attempt cannot revise the settled receipt',async()=>{
   await seed(db);const attempt=(await claim(db)).claim.attemptId;await dispatch(db,attempt);await fail(db,attempt);
   const before=await row(db);await fail(db,attempt);await fail(db,'50000000-0000-4000-8000-000000000099');
   assert.deepEqual(await row(db),before);
  });
  await t.test('success and explicit cancellation are not demoted by a late failure',async()=>{
   for(const cancelled of [false,true]) {
    await seed(db);const attempt=(await claim(db)).claim.attemptId;await dispatch(db,attempt);
    await db.query('update private.ai_need_turn_commands set state=$1,cancelled_at='+
     (cancelled?'clock_timestamp()':'null')+' where client_request_id=$2',[cancelled?'FAILED':'SUCCEEDED',R]);
    const before=await row(db);await fail(db,attempt);assert.deepEqual(await row(db),before);
    assert.equal((await claim(db)).claim,null);
   }
  });
  await t.test('lease expiry does not erase whether dispatch already happened',async()=>{
   for(const wasDispatched of [false,true]) {
    await seed(db);const attempt=(await claim(db)).claim.attemptId;
    if(wasDispatched)await dispatch(db,attempt);
    await db.exec("update private.ai_need_turn_commands set lease_expires_at=clock_timestamp()-interval '1 second'");
    const failed=await fail(db,attempt);assert.equal(failed.retryAllowed,!wasDispatched);
    assert.equal((await recover(db)).providerDispatched,wasDispatched);
   }
  });
  await t.test('a separate explicit message remains possible after the failed attempt',async()=>{
   await seed(db);const attempt=(await claim(db)).claim.attemptId;await dispatch(db,attempt);await fail(db,attempt);
   assert.ok((await claim(db,OTHER_R)).claim);assert.equal((await row(db)).provider_dispatched,true);
  });
  await t.test('foreign account and ordinary SQL roles cannot settle another attempt',async()=>{
   await seed(db);const attempt=(await claim(db)).claim.attemptId;await dispatch(db,attempt);const before=await row(db);
   await assert.rejects(fail(db,attempt,'10000000-0000-4000-8000-000000000099'),error=>error.message==='CONVERSATION_NOT_FOUND');
   for(const role of ['anon','authenticated']) {
    await db.exec('set role '+role);
    try {await assert.rejects(fail(db,attempt),error=>error.code==='42501');}
    finally {await db.exec('reset role');}
   }
   assert.deepEqual(await row(db),before);
  });
  await t.test('ordinary owner recovery retains the flag and client rejects contradictory retry permission',async()=>{
   await seed(db);const attempt=(await claim(db)).claim.attemptId;await dispatch(db,attempt);await fail(db,attempt);
   await db.exec('set role authenticated');
   let recovery;try {recovery=await recover(db);}finally {await db.exec('reset role');}
   assert.equal(recovery.providerDispatched,true);assert.ok(decode(recovery,A,C,R));
   assert.equal(decode({...recovery,turn:{...recovery.turn,retryAllowed:true}},A,C,R),null);
   assert.equal(decode({...recovery,turn:{...recovery.turn,state:'UNKNOWN_OUTCOME'}},A,C,R),null);
  });
  await t.test('stale preimage refuses reapplication without changing the result',async()=>{
   const before=await row(db);await assert.rejects(db.exec(candidate),error=>error.message==='R06_DISPATCH_SOURCE_DRIFT');
   assert.deepEqual(await row(db),before);
  });
 } finally {await db.close();}
});
