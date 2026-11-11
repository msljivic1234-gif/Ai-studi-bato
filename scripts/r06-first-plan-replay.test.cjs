'use strict';
/** PostgreSQL execution of the exact DEV completion/lock/receipt/readback bodies.
 * The fixture replaces only unrelated account/fact/catalog dependencies with
 * bounded in-memory SQL contracts. It is not live Auth, PostgREST or Gemini proof.
 */
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {PGlite}=require('@electric-sql/pglite');
const root=path.resolve(__dirname,'..');
const preimage=JSON.parse(fs.readFileSync(path.join(__dirname,'sql/r06_first_plan_preimage_20261107.json'),'utf8'));
const candidate=fs.readFileSync(path.join(__dirname,'sql/r06_first_plan_replay_20261107.sql'),'utf8');
const A='10000000-0000-4000-8000-000000000001',C='20000000-0000-4000-8000-000000000001';
const OLD_R='30000000-0000-4000-8000-000000000001',R='30000000-0000-4000-8000-000000000002';
const OLD_T='40000000-0000-4000-8000-000000000001',T='40000000-0000-4000-8000-000000000002';
const OLD_ATT='50000000-0000-4000-8000-000000000001',ATT='50000000-0000-4000-8000-000000000002';
const SERVICE='Fizička pomoć pri selidbi';
const PROPOSALS=[{key:'need.starts_at',value:'2026-11-08T09:00:00+01:00'}];
const PLAN={catalogVersion:3,proposals:[{service:SERVICE,mode:'ON_SITE',action:'REUSE_EXISTING',
  categoryId:'60000000-0000-4000-8000-000000000001',reason:'Isti ranije potvrđeni posao.'}],anchors:[]};
const setup=`
 create schema private; create schema auth; create schema extensions;
 create role anon; create role authenticated; create role service_role;
 grant usage on schema public,private,auth to anon,authenticated,service_role;
 create table public.ai_conversations(id uuid primary key,account_id uuid,purpose text,fact_schema_version text,status text);
 create table private.ai_need_turn_commands(account_id uuid,conversation_id uuid,client_request_id uuid,turn_id uuid,attempt_id uuid,
   state text,provider_dispatched boolean,cancelled_at timestamptz,lease_expires_at timestamptz,context_hash text,request_hash text,
   receipt jsonb,updated_at timestamptz,primary key(account_id,client_request_id));
 create table private.worker_ai_turns(like private.ai_need_turn_commands);
 create table private.worker_ai_sessions(account_id uuid,conversation_id uuid);
 create table public.ai_structured_facts(id uuid default gen_random_uuid(),account_id uuid,conversation_id uuid,
   fact_key text,fact_value jsonb,status text default 'CONFIRMED',superseded_at timestamptz);
 create table private.work_taxonomy_gemini_turn_hints_v1(id uuid primary key default gen_random_uuid(),
   account_id uuid,conversation_id uuid,client_request_id uuid,turn_id uuid,attempt_id uuid,purpose text,catalog_version bigint,
   proposals jsonb,payload_digest text,source_fingerprint text,catalog_resolution jsonb,created_at timestamptz default clock_timestamp(),
   unique(account_id,purpose,turn_id));
 create table private.work_taxonomy_control(singleton boolean primary key,catalog_version bigint);
 insert into private.work_taxonomy_control values(true,3);
 create table private.fixture_calls(kind text);
 create table private.fixture_config(fail_resolver boolean default false,closed boolean default false);
 insert into private.fixture_config default values;
 create function auth.jwt() returns jsonb language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb $$;
 create function extensions.digest(text,text) returns bytea language sql immutable as $$
  select case when $2='sha256' then sha256(convert_to($1,'UTF8')) end $$;
 create function extensions.digest(bytea,text) returns bytea language sql immutable as $$
  select case when $2='sha256' then sha256($1) end $$;
 create function private.closure_assert_open(uuid) returns void language plpgsql as $$
  begin if (select closed from private.fixture_config) then raise exception 'ACCOUNT_CLOSED' using errcode='42501';end if;end $$;
 create function private.ai_need_turn_context(uuid) returns jsonb language sql as $$ select '{"sha256":"ctx"}'::jsonb $$;
 create function private.ai_need_turn_status(uuid,uuid,uuid) returns jsonb language sql as $$
  select jsonb_build_object('turnId',t.turn_id,'conversationId',t.conversation_id,'clientRequestId',t.client_request_id,
    'state',t.state,'retryAllowed',false,'authoritative',true,'receipt',t.receipt)
  from private.ai_need_turn_commands t where t.account_id=$1 and t.conversation_id=$2 and t.client_request_id=$3 $$;
 create function private.worker_ai_turn_document(uuid) returns jsonb language sql as $$ select null::jsonb $$;
 create function private.taxonomy_normalize_v1(text) returns text language sql immutable as $$ select lower(btrim($1)) $$;
 create function private.ai_task_review_source(uuid) returns jsonb language sql as $$
  select jsonb_build_object('conversationId',$1,'need','unchanged','messages','[]'::jsonb,
   'facts',coalesce((select jsonb_agg(jsonb_build_object('id',id,'fact_key',fact_key,'fact_value',fact_value) order by fact_key,id)
     from public.ai_structured_facts where conversation_id=$1 and superseded_at is null),'[]'::jsonb),
   'turns',coalesce((select jsonb_agg(jsonb_build_object('id',turn_id,'state',state) order by turn_id)
     from private.ai_need_turn_commands where conversation_id=$1),'[]'::jsonb)) $$;
 create function public.rpc_ai_apply_interview_turn_v2_service(p_account_id uuid,p_conversation_id uuid,p_user_message text,
   p_assistant_message text,p_safety text,p_proposals jsonb) returns jsonb language plpgsql as $$
 declare fact jsonb;
 begin
  insert into private.fixture_calls values('fact_write');
  if p_safety in('ALLOW','CLARIFY') then
   for fact in select value from jsonb_array_elements(p_proposals) loop
    update public.ai_structured_facts set superseded_at=clock_timestamp()
     where account_id=p_account_id and conversation_id=p_conversation_id and fact_key=fact->>'key' and superseded_at is null;
    insert into public.ai_structured_facts(account_id,conversation_id,fact_key,fact_value)
     values(p_account_id,p_conversation_id,fact->>'key',fact->'value');
   end loop;
  end if;
  return jsonb_build_object('conversationId',p_conversation_id,'schemaVersion','NEED_FACT_V2','authoritative',true,
   'userMessageId',gen_random_uuid(),'assistantMessageId',gen_random_uuid(),'proposedCount',jsonb_array_length(p_proposals),'safety',p_safety);
 end $$;
 create function public.rpc_taxonomy_capture_gemini_turn_hints_service(p_account_id uuid,p_conversation_id uuid,
   p_client_request_id uuid,p_turn_id uuid,p_attempt_id uuid,p_purpose text,p_catalog_version bigint,p_proposals jsonb)
 returns jsonb language plpgsql as $$
 begin
  insert into private.fixture_calls values('capture');
  insert into private.work_taxonomy_gemini_turn_hints_v1(account_id,conversation_id,client_request_id,turn_id,attempt_id,purpose,
    catalog_version,proposals,payload_digest,source_fingerprint)
  values(p_account_id,p_conversation_id,p_client_request_id,p_turn_id,p_attempt_id,p_purpose,p_catalog_version,p_proposals,
    encode(extensions.digest(p_proposals::text,'sha256'),'hex'),
    encode(extensions.digest(private.ai_task_review_source(p_conversation_id)::text,'sha256'),'hex'));
  return jsonb_build_object('action','HINT_CAPTURED','authority','NONE');
 end $$;
 create function private.taxonomy_resolve_turn_catalog_v1(p_hint_id uuid,p_input_digest text,p_anchors jsonb,p_safety text)
 returns jsonb language plpgsql as $$
 begin
  if (select fail_resolver from private.fixture_config) then raise exception 'FIXTURE_RESOLVER_FAILURE';end if;
  insert into private.fixture_calls values('resolve');
  return jsonb_build_object('state','RESOLVED','inputDigest',p_input_digest);
 end $$;
 select set_config('request.jwt.claims','{"role":"service_role"}',false);
`;

async function seed(db) {
 await db.exec(`reset role;truncate private.fixture_calls,public.ai_structured_facts,private.work_taxonomy_gemini_turn_hints_v1,
   private.ai_need_turn_commands,public.ai_conversations;update private.fixture_config set fail_resolver=false,closed=false;
   select set_config('request.jwt.claims','{"role":"service_role"}',false);`);
 await db.query('insert into public.ai_conversations values($1,$2,\'NEED_INTAKE\',\'NEED_FACT_V2\',\'OPEN\')',[C,A]);
 await db.query(`insert into public.ai_structured_facts(account_id,conversation_id,fact_key,fact_value)
   values($1,$2,'need.category',$3::jsonb),($1,$2,'need.task_geography','{"mode":"STATIONARY"}'::jsonb)`,[A,C,JSON.stringify(SERVICE)]);
 await db.query(`insert into private.ai_need_turn_commands(account_id,conversation_id,client_request_id,turn_id,attempt_id,state,
  provider_dispatched,lease_expires_at,context_hash) values($1,$2,$3,$4,$5,'SUCCEEDED',true,clock_timestamp()+interval '5 minutes','ctx')`,
  [A,C,OLD_R,OLD_T,OLD_ATT]);
 await db.query(`insert into private.work_taxonomy_gemini_turn_hints_v1(account_id,conversation_id,client_request_id,turn_id,attempt_id,
  purpose,catalog_version,proposals,payload_digest,source_fingerprint,catalog_resolution)
  values($1,$2,$3,$4,$5,'NEED_SERVICE',3,$6::jsonb,encode(extensions.digest(($6::jsonb)::text,'sha256'),'hex'),
  encode(extensions.digest(private.ai_task_review_source($2)::text,'sha256'),'hex'),'{"state":"RESOLVED","inputDigest":"old"}'::jsonb)`,
  [A,C,OLD_R,OLD_T,OLD_ATT,JSON.stringify(PLAN.proposals)]);
 await db.query(`insert into private.ai_need_turn_commands(account_id,conversation_id,client_request_id,turn_id,attempt_id,state,
  provider_dispatched,lease_expires_at,context_hash,request_hash) values($1,$2,$3,$4,$5,'PROCESSING',true,
  clock_timestamp()+interval '5 minutes','ctx',encode(extensions.digest(convert_to(jsonb_build_object('conversationId',$2::uuid,
  'text','Sutra u devet.')::text,'UTF8'),'sha256'),'hex'))`,[A,C,R,T,ATT]);
}
const args=(changes={})=>({p_account_id:A,p_conversation_id:C,p_client_request_id:R,p_attempt_id:ATT,
  p_user_message:'Sutra u devet.',p_assistant_message:'Početak je sutra u devet.',p_safety:'ALLOW',p_proposals:PROPOSALS,
  p_taxonomy_plan:PLAN,...changes});
async function complete(db,changes={},legacy=false) {
 const a=args(changes),values=[a.p_account_id,a.p_conversation_id,a.p_client_request_id,a.p_attempt_id,
  a.p_user_message,a.p_assistant_message,a.p_safety,JSON.stringify(a.p_proposals)];
 if(!legacy)values.push(JSON.stringify(a.p_taxonomy_plan));
 return (await db.query(`select public.${legacy?'rpc_ai_complete_need_turn_v2_service':'rpc_ai_complete_need_turn_with_first_plan_service'}(
  $1,$2,$3,$4,$5,$6,$7,$8::jsonb${legacy?'':',$9::jsonb'}) as result`,values)).rows[0].result;
}
async function state(db) {
 return (await db.query(`select (select state from private.ai_need_turn_commands where turn_id=$1) as state,
  (select count(*)::int from private.fixture_calls where kind='fact_write') as writes,
  (select count(*)::int from private.fixture_calls where kind='capture') as captures,
  (select count(*)::int from private.fixture_calls where kind='resolve') as resolves,
  (select count(*)::int from private.work_taxonomy_gemini_turn_hints_v1 where turn_id=$1) as new_hints`,[T])).rows[0];
}

test('R06 scheduling-only completion and first-plan replay execute against exact DEV bodies',async t=>{
 const db=new PGlite();
 try {
  await db.exec(setup);
  for(const fn of preimage.functions) {
   const body=fn.definition.split('AS $function$')[1].split('$function$')[0];
   assert.equal(crypto.createHash('md5').update(body).digest('hex'),fn.body_md5);
   await db.exec(fn.definition);
   const signature=fn.schema_name+'.'+fn.proname+'('+fn.args.split(', ').map(arg=>arg.split(' ').at(-1)).join(',')+')';
   await db.exec('revoke all on function '+signature+' from public,anon,authenticated,service_role;'+
    (fn.schema_name==='public'?'grant execute on function '+signature+' to service_role;':''));
  }
  await t.test('preimage reproduces NULL-resolution failure and rolls the whole completion back',async()=>{
   await seed(db);
   await assert.rejects(complete(db),error=>error.message==='R06_FIRST_PLAN_REPLAY_MISSING');
   assert.deepEqual(await state(db),{state:'PROCESSING',writes:0,captures:0,resolves:0,new_hints:0});
  });
  await t.test('different explanation on the same service also reproduces the old capture conflict',async()=>{
   await seed(db);const plan=structuredClone(PLAN);plan.proposals[0].reason='Zadržana potvrđena kategorija iz prethodnog koraka.';
   await assert.rejects(complete(db,{p_taxonomy_plan:plan}),error=>error.message==='R06_FIRST_PLAN_REPLAY_CONFLICT');
   assert.equal((await state(db)).writes,0);
  });
  await t.test('fenced forward candidate installs with checked postimages and no new public executor',async()=>{
   await db.exec(candidate);
   const result=await db.query(`select md5(prosrc) as md5,prosecdef from pg_proc
    where oid='private.ai_complete_need_turn_v2_core(uuid,uuid,uuid,uuid,text,text,text,jsonb,boolean)'::regprocedure`);
   assert.deepEqual(result.rows,[{md5:'70389d9f437a1edda4014df273435037',prosecdef:false}]);
   for(const role of ['anon','authenticated','service_role']) {
    assert.equal((await db.query(`select has_function_privilege($1,
     'private.ai_complete_need_turn_v2_core(uuid,uuid,uuid,uuid,text,text,text,jsonb,boolean)','EXECUTE') as allowed`,[role])).rows[0].allowed,false);
   }
  });
  await t.test('same scheduling change now has one fact write, one plan and one completion',async()=>{
   await seed(db);const result=await complete(db);
   assert.equal(result.completion.state,'SUCCEEDED');assert.equal(result.firstPlan.authority,'CATALOG_ONLY');
   assert.deepEqual(await state(db),{state:'SUCCEEDED',writes:1,captures:1,resolves:1,new_hints:1});
   assert.equal((await db.query('select count(*)::int as n from public.ai_structured_facts where fact_key=\'need.starts_at\' and superseded_at is null')).rows[0].n,1);
  });
  await t.test('new explanation does not overwrite the old classification receipt',async()=>{
   await seed(db);const before=(await db.query('select to_jsonb(h) as h from private.work_taxonomy_gemini_turn_hints_v1 h where turn_id=$1',[OLD_T])).rows[0].h;
   const plan=structuredClone(PLAN);plan.proposals[0].reason='Zadržana potvrđena kategorija iz prethodnog koraka.';
   assert.equal((await complete(db,{p_taxonomy_plan:plan})).completion.state,'SUCCEEDED');
   assert.deepEqual((await db.query('select to_jsonb(h) as h from private.work_taxonomy_gemini_turn_hints_v1 h where turn_id=$1',[OLD_T])).rows[0].h,before);
   assert.deepEqual((await db.query('select proposals from private.work_taxonomy_gemini_turn_hints_v1 where turn_id=$1',[T])).rows[0].proposals,plan.proposals);
  });
  await t.test('identical replay and lost-ACK readback do not repeat writes or catalog work',async()=>{
   await seed(db);const result=await complete(db),before=await state(db);
   assert.deepEqual(await complete(db),result);
   const read=(await db.query('select public.rpc_ai_read_first_plan_completion_service($1,$2::jsonb) as value',
    ['rpc_ai_complete_need_turn_with_first_plan_service',JSON.stringify(args())])).rows[0].value;
   assert.deepEqual(read,{state:'COMPLETED',envelope:result});assert.deepEqual(await state(db),before);
  });
  await t.test('changed replay payload remains forbidden after successful completion',async()=>{
   await seed(db);await complete(db);const before=await state(db);
   await assert.rejects(complete(db,{p_assistant_message:'Drugi odgovor.'}),error=>error.message==='R06_FIRST_PLAN_REPLAY_CONFLICT');
   assert.deepEqual(await state(db),before);
  });
  await t.test('legacy callers retain scheduling continuity without manufactured catalog authority',async()=>{
   await seed(db);assert.equal((await complete(db,{},true)).state,'SUCCEEDED');
   assert.deepEqual(await state(db),{state:'SUCCEEDED',writes:1,captures:1,resolves:0,new_hints:1});
   assert.equal((await db.query('select catalog_resolution from private.work_taxonomy_gemini_turn_hints_v1 where turn_id=$1',[T])).rows[0].catalog_resolution,null);
  });
  await t.test('an already completed legacy receipt cannot acquire authority on replay',async()=>{
   await seed(db);await complete(db,{},true);const before=await state(db);
   await assert.rejects(complete(db),error=>error.message==='R06_FIRST_PLAN_REPLAY_MISSING');
   assert.deepEqual(await state(db),before);
  });
  await t.test('expired lease and stale context still fail without accepting the provider answer',async()=>{
   for(const change of ["lease_expires_at=clock_timestamp()-interval '1 second'","context_hash='stale'"]) {
    await seed(db);await db.query('update private.ai_need_turn_commands set '+change+' where turn_id=$1',[T]);
    const result=await complete(db);assert.equal(result.completion.state,'FAILED');assert.equal(result.firstPlan.state,'NOT_ELIGIBLE');
    assert.equal((await state(db)).writes,0);assert.equal((await state(db)).captures,0);
   }
  });
  await t.test('explicit cancellation and missing provider dispatch never commit facts',async()=>{
   for(const change of ['cancelled_at=clock_timestamp()','provider_dispatched=false']) {
    await seed(db);await db.query('update private.ai_need_turn_commands set '+change+' where turn_id=$1',[T]);
    assert.equal((await complete(db)).firstPlan.state,'NOT_ELIGIBLE');assert.equal((await state(db)).writes,0);
   }
  });
  await t.test('foreign owner, wrong attempt and closure remain rejected',async()=>{
   for(const change of [{p_account_id:'10000000-0000-4000-8000-000000000099'},{p_attempt_id:OLD_ATT}]) {
    await seed(db);await assert.rejects(complete(db,change),error=>error.message==='R06_FIRST_PLAN_DENIED');
    assert.equal((await state(db)).writes,0);
   }
   await seed(db);await db.exec('update private.fixture_config set closed=true');
   await assert.rejects(complete(db),error=>error.message==='ACCOUNT_CLOSED');assert.equal((await state(db)).writes,0);
  });
  await t.test('wrong service or safety and failed resolver roll back facts and captured plan',async()=>{
   await seed(db);const wrong=structuredClone(PLAN);wrong.proposals[0].service='Prevoz svojim kombijem';
   await assert.rejects(complete(db,{p_taxonomy_plan:wrong}),error=>error.message==='R06_FIRST_PLAN_NEED_TARGET_MISMATCH');
   assert.equal((await state(db)).writes,0);
   await assert.rejects(complete(db,{p_safety:'REVIEW'}),error=>error.message==='R06_FIRST_PLAN_SAFETY_INVALID');
   assert.equal((await state(db)).writes,0);
   await db.exec('update private.fixture_config set fail_resolver=true');
   await assert.rejects(complete(db),error=>error.message==='FIXTURE_RESOLVER_FAILURE');
   assert.deepEqual(await state(db),{state:'PROCESSING',writes:0,captures:0,resolves:0,new_hints:0});
  });
  await t.test('anon/authenticated calls fail at the actual SQL role boundary',async()=>{
   await seed(db);
   for(const role of ['anon','authenticated']) {
    await db.exec('set role '+role);
    try {await assert.rejects(complete(db),error=>error.code==='42501');}
    finally {await db.exec('reset role');}
   }
   assert.equal((await state(db)).writes,0);
   await db.exec('set role service_role');
   try {assert.equal((await complete(db)).completion.state,'SUCCEEDED');}
   finally {await db.exec('reset role');}
  });
  await t.test('private helper is not a new service or client RPC',async()=>{
   await db.exec('set role service_role');
   try {await assert.rejects(db.query(`select private.ai_complete_need_turn_v2_core($1,$2,$3,$4,$5,$6,$7,$8::jsonb,false)`,
    [A,C,R,ATT,'Sutra u devet.','Odgovor','ALLOW',JSON.stringify(PROPOSALS)]),error=>error.code==='42501');}
   finally {await db.exec('reset role');}
  });
  await t.test('reapplying a candidate with stale preimages fails atomically',async()=>{
   await assert.rejects(db.exec(candidate),error=>error.message==='R06_COMPLETION_SOURCE_DRIFT');
   assert.equal((await db.query(`select md5(prosrc) as md5 from pg_proc where oid=
    'private.taxonomy_first_plan_complete_receipt_v1(uuid,uuid,uuid,uuid,text,text,jsonb,jsonb,text,boolean)'::regprocedure`)).rows[0].md5,
    '1fd600075014202a6cc719c262af6e5e');
  });
 } finally {await db.close();}
});
