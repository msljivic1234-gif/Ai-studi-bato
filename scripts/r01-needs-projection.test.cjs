'use strict';
// Execute the reviewed grant candidate and captured production reader bodies.
// Auth, lineage/closure services and locale/GIS primitives are bounded fixtures;
// PostgreSQL grants and the six actual needs RLS policies run without bypass.
// This is not JWT/PostgREST, actual PostGIS, matching or native acceptance.
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {PGlite}=require('@electric-sql/pglite');
const preimage=JSON.parse(fs.readFileSync(path.join(__dirname,'sql/r01_needs_projection_20261107.preimage.json'),'utf8'));
const candidate=fs.readFileSync(path.join(__dirname,'sql/r01_needs_projection_20261107.sql'),'utf8');
const A='10000000-0000-4000-8000-000000000001',B='10000000-0000-4000-8000-000000000002',C='10000000-0000-4000-8000-000000000003';
const N='20000000-0000-4000-8000-000000000001',D='20000000-0000-4000-8000-000000000002',OTHER='20000000-0000-4000-8000-000000000003';
const CLOSED='20000000-0000-4000-8000-000000000004';
const PROFILE='30000000-0000-4000-8000-000000000001',RESPONSE='40000000-0000-4000-8000-000000000001',EVENT='50000000-0000-4000-8000-000000000001';
const internal=['remaining_search_close_reason','remaining_search_closed_by_account_id'];
const quote=s=>"'"+s.replace(/'/g,"''")+"'";

async function fixture() {
 const db=new PGlite();
 await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;
 create schema auth;create schema private;create schema rls_private;create schema extensions;
 grant usage on schema public,auth,rls_private,extensions to anon,authenticated,service_role;
 create domain extensions.geography as text;
 create function extensions.fixture_geography_overlap(extensions.geography,extensions.geography) returns boolean language sql immutable as 'select true';
 create operator extensions.&& (leftarg=extensions.geography,rightarg=extensions.geography,function=extensions.fixture_geography_overlap);
 create function extensions.st_makeenvelope(double precision,double precision,double precision,double precision,integer)
 returns extensions.geography language sql immutable as 'select null::extensions.geography';
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('fixture.actor',true),'')::uuid$$;
 create table private.account_lineage_v5(account_id uuid primary key,world text not null);
 create function private.account_visibility_world(a uuid) returns text language sql stable security definer set search_path=pg_catalog
 as $$select l.world from private.account_lineage_v5 l where l.account_id=a$$;
 create function private.closure_assert_open(uuid) returns void language plpgsql as $$begin
 if current_setting('fixture.closed',true)='true' then raise exception 'ACCOUNT_CLOSING' using errcode='42501';end if;end$$;
 create function private.need_candidate_states_v5(uuid) returns table(candidate_state text) language sql stable as $$select 'SELECTABLE'::text where false$$;
 do $$begin if not exists(select 1 from pg_collation c join pg_namespace n on n.oid=c.collnamespace where c.collname='sr-Latn-RS-x-icu' and n.nspname='pg_catalog') then
 create collation pg_catalog."sr-Latn-RS-x-icu" from pg_catalog."C";end if;end$$;
 create function public.p6_discovery_trim(text) returns text language sql immutable as $$select btrim($1)$$;
 create function public.p6_discovery_key(text) returns text language sql immutable as $$select lower(btrim($1))$$;
 create function public.p6_discovery_civil(text) returns boolean language sql immutable as $$select $1 ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'$$;
 create function public.p6_discovery_days(text,timestamptz,timestamptz,text,timestamptz) returns text[] language sql stable as $$select array['2099-01-01','2099-01-02']$$;
 create function public.p6_discovery_area(text,text,boolean) returns text language sql immutable as $$select case when $3 then 'Na daljinu' else $1||', '||$2 end$$;
 `);
 const columns=[];
 for(let i=1;i<=43;i++) {
   const c=preimage.columns.find(c=>c.position===i);
   if(!c){columns.push('dropped_fixture_column text');continue;}
   columns.push(c.name+' '+(c.name==='approx_geog'?'extensions.geography generated always as (case when approximate_lat is null then null else approximate_lat::text end) stored':c.type)+(c.notNull?' not null':''));
 }
 await db.exec('create table public.needs('+columns.join(',')+',primary key(id));alter table public.needs drop column dropped_fixture_column;');
 await db.exec(`create table public.agreements(id uuid primary key,need_id uuid,worker_account_id uuid,requester_account_id uuid,status text,selected_response_id uuid,created_at timestamptz);
 create table public.need_selections(need_id uuid,worker_account_id uuid,status text,covered_slots integer);
 create table public.marketplace_responses(id uuid primary key,need_id uuid references public.needs(id),worker_account_id uuid,current_version integer,
   submitted_against_need_revision integer,status text,price_basis text,proposed_start_at timestamptz,proposed_end_at timestamptz);
 create table public.need_geography(need_id uuid,public_topology jsonb);
 create table public.need_requirement_details(need_id uuid,critical_conditions text[]);
 create table public.app_profiles(id uuid,account_id uuid);
 create table public.user_activity_events(id uuid,recipient_user_id uuid,entity_type text,entity_id uuid,payload jsonb,recipient_role text);
 create table public.notification_deliveries(event_id uuid,recipient_user_id uuid,channel text,state text);
 grant select on public.agreements,public.need_selections,public.marketplace_responses,public.need_geography,public.need_requirement_details,
   public.app_profiles,public.user_activity_events,public.notification_deliveries to authenticated,service_role;
 alter table public.marketplace_responses enable row level security;
 create policy response_fixture_owner on public.marketplace_responses for select to authenticated using(worker_account_id=auth.uid());
 grant all on public.needs to postgres;
 grant truncate,references,trigger,maintain on public.needs to anon;
 grant insert,select,update,truncate,references,trigger,maintain on public.needs to authenticated;
 grant all on public.needs to service_role;
 `);
 await db.exec('grant select('+preimage.columns.filter(c=>c.acl).map(c=>c.name).join(',')+') on public.needs to authenticated;');
 // Create every original body before its callers are exercised. PostgreSQL
 // validates PL/pgSQL statements on first execution, as in the hosted server.
 for(const f of preimage.functions) {
   const body=f.definition.split('AS $function$')[1].split('$function$')[0];
   assert.equal(crypto.createHash('md5').update(body).digest('hex'),f.body_md5,f.signature);
   await db.exec(f.definition);
   await db.exec('revoke all on function '+f.signature+' from public,anon,authenticated,service_role;');
   const entries=f.acl.slice(1,-1).split(',');
   for(const entry of entries) {
     const [grantee,access]=entry.split('=');
     if(grantee!=='postgres'&&access.includes('X')) await db.exec('grant execute on function '+f.signature+' to '+grantee+';');
   }
 }
 await db.exec('alter table public.needs enable row level security;');
 for(const p of preimage.policies) await db.exec('create policy '+p.name+' on public.needs as '+p.permissive+' for '+p.cmd+' to '+p.roles.join(',')+
   (p.qual?' using('+p.qual+')':'')+(p.check?' with check('+p.check+')':'')+';');
 await db.query('insert into private.account_lineage_v5 values($1,\'TEST\'),($2,\'TEST\'),($3,\'REAL\')',[A,B,C]);
 const common={requester_account_id:A,requester_profile_id:PROFILE,status:'PUBLISHED',title:'TEST public title',description:'TEST public description',category:'Košenje trave',
   approximate_city:'Novi Sad',approximate_area:'Liman',approximate_lat:45.24,approximate_lng:19.83,schedule_kind:'TODAY_FLEXIBLE',
   required_slots:5,mode:'MY_PRICE',requester_price_rsd:1200,required_skills:[],required_tools:[],required_vehicles:[],verified_identity_required:false,
   urgent:false,public_photo_paths:[],revision:1,published_at:'2026-11-07T00:00:00Z',created_at:'2026-11-07T00:00:00Z',updated_at:'2026-11-07T00:00:00Z',
   execution_location_mode:'STATIONARY',required_licenses:[],task_country_code:'RS',task_timezone:'Europe/Belgrade',price_basis:'HOURLY'};
 for(const row of [{...common,id:N},{...common,id:D,status:'DRAFT',published_at:null},{...common,id:OTHER,requester_account_id:C},
   {...common,id:CLOSED,status:'SELECTION',remaining_search_closed_at:'2026-11-07T01:00:00Z',
     remaining_search_close_reason:'SYNTHETIC_PRIVATE_REASON',remaining_search_closed_by_account_id:A}]) {
   const fields=Object.keys(row);await db.query('insert into public.needs('+fields.join(',')+') values('+fields.map((_,i)=>'$'+(i+1)).join(',')+')',Object.values(row));
 }
 await db.query('insert into public.app_profiles values($1,$2)',[PROFILE,A]);
 await db.query("insert into public.marketplace_responses(id,need_id,worker_account_id,current_version,submitted_against_need_revision,status) values($1,$2,$3,1,1,'STALE_REVIEW_REQUIRED')",[RESPONSE,N,B]);
 await db.query("insert into public.user_activity_events values($1,$2,'NEED',$3,'{}','WORKER');",[EVENT,B,N]);
 await db.query("insert into public.notification_deliveries values($1,$2,'IN_APP','DELIVERED')",[EVENT,B]);
 const actor=async(account,role='authenticated')=>{await db.exec('reset role');await db.query("select set_config('fixture.actor',$1,false)",[account??'']);await db.exec('set role '+role);};
 const value=async(sql,params=[]) => (await db.query(sql,params)).rows[0]?.value;
 return {db,actor,value};
}

test('R01 executes exact forward projection against real PostgreSQL grants/RLS and captured readers',async t=>{
 const {db,actor,value}=await fixture();
 try {
  const metadata=()=>value(`select jsonb_build_object('acl',(select relacl::text from pg_class where oid='public.needs'::regclass),
   'columns',(select jsonb_agg(jsonb_build_object('name',attname,'acl',attacl::text) order by attnum) from pg_attribute where attrelid='public.needs'::regclass and attnum>0 and not attisdropped)) as value`);
  const before=await metadata();
  await t.test('preimage exposes a synthetic internal reason to another ordinary account',async()=>{
    await actor(B);assert.equal(await value('select remaining_search_close_reason as value from public.needs where id=$1',[CLOSED]),'SYNTHETIC_PRIVATE_REASON');
    assert.equal(await value('select remaining_search_closed_by_account_id as value from public.needs where id=$1',[CLOSED]),A);
    assert.equal(await value('select count(*)::int as value from public.needs where id=$1',[D]),0);
    assert.equal(await value('select count(*)::int as value from public.needs where id=$1',[OTHER]),0);
    await db.exec('reset role');
  });
  await t.test('source, ACL, column, RLS and new dependency drift all abort before narrowing access',async()=>{
    const fn=preimage.functions.find(f=>f.signature==='public.fn_need_urgency(uuid)');
    for(const [drift,code] of [
      [fn.definition.replace('select case','select /* drift */ case'),'R01_NEEDS_READER_DRIFT'],
      ['grant select on public.needs to anon','R01_NEEDS_RELATION_ACL_DRIFT'],
      ['grant select(remaining_search_close_reason) on public.needs to authenticated','R01_NEEDS_COLUMN_DRIFT'],
      ['alter table public.needs add column unexpected text','R01_NEEDS_COLUMN_DRIFT'],
      ['alter policy needs_public_discovery on public.needs using(true)','R01_NEEDS_POLICY_DRIFT'],
      ['create view public.unreviewed_view as select * from public.needs','R01_NEEDS_DEPENDENCY_DRIFT'],
      ["create function public.unreviewed_read() returns text language sql as 'select remaining_search_close_reason from public.needs limit 1'",'R01_NEEDS_DEPENDENCY_DRIFT'],
    ]) {
      await db.exec('begin');await db.exec(drift);
      await assert.rejects(db.exec(candidate),error=>error.message===code,code);
      await db.exec('rollback');assert.deepEqual(await metadata(),before);
    }
  });
  await t.test('candidate is atomic and changes no data, RLS or function metadata',async()=>{
    const dataBefore=await value('select jsonb_agg(to_jsonb(n) order by id) as value from public.needs n');
    await db.exec('begin');await db.exec(candidate);await db.exec('rollback');assert.deepEqual(await metadata(),before);
    await db.exec(candidate);
    assert.deepEqual(await value('select jsonb_agg(to_jsonb(n) order by id) as value from public.needs n'),dataBefore);
  });
  await t.test('both hidden columns, SELECT star and full-row aliases are denied to ordinary owner and foreign account',async()=>{
    for(const who of [A,B]) {
      await actor(who);
      for(const sql of internal.map(c=>'select '+c+' from public.needs where id=$1').concat([
        'select * from public.needs where id=$1','select to_jsonb(n) from public.needs n where id=$1']))
        await assert.rejects(db.query(sql,[CLOSED]),error=>error.code==='42501');
    }
  });
  await t.test('all forty allowed columns retain access with identical draft/world boundaries',async()=>{
    const allowed=preimage.columns.map(c=>c.name).filter(c=>!internal.includes(c));
    await actor(B);assert.equal((await db.query('select '+allowed.join(',')+' from public.needs where id=$1',[N])).rows.length,1);
    assert.equal(await value('select count(*)::int as value from public.needs where id=$1',[D]),0);
    assert.equal(await value('select count(*)::int as value from public.needs where id=$1',[OTHER]),0);
    await actor(A);assert.equal((await db.query('select '+allowed.join(',')+' from public.needs where id=$1',[D])).rows.length,1);
  });
  await t.test('actual invoker detail, owner list, urgency and computed-field boundaries still succeed',async()=>{
    await actor(B);
    const detail=await value('select public.rpc_read_task($1) as value',[N]);
    assert.equal(detail.id,N);assert.equal(detail.requester_price_rsd,1200);assert.equal(detail.price_basis,'HOURLY');
    assert.equal(detail.covered_slots,0);assert.equal(detail.selectable_application_count,null);
    for(const c of internal)assert.equal(Object.hasOwn(detail,c),false);
    assert.equal((await value('select public.fn_need_urgency($1) as value',[N])).needId,N);
    assert.equal(await value('select public.rpc_read_task($1) as value',[D]),null);
    await actor(A);const owned=await value('select public.rpc_list_my_tasks() as value');
    assert.equal(owned.length,3);assert.equal(owned.find(x=>x.id===N).selectable_application_count,0);
    assert.equal(JSON.stringify(owned).includes('SYNTHETIC_PRIVATE_REASON'),false);
  });
  await t.test('actual discovery, exact public landing and notification target still work',async()=>{
    await actor(B);
    const discovery=await value('select public.rpc_discovery_v1($1) as value',[{mode:'EXACT_PUBLIC',needId:N}]);
    assert.equal(discovery.items.length,1);assert.equal(discovery.items[0].id,N);
    const legacy=await value('select public.rpc_list_open_tasks_v3(null,$1) as value',[{needId:N}]);
    assert.equal(legacy.items.length,1);assert.equal(legacy.items[0].id,N);
    assert.deepEqual(await value('select public.rpc_resolve_activity_event($1) as value',[EVENT]),{kind:'OPPORTUNITY',id:N,role:'WORKER'});
  });
  await t.test('current stale-application join and close-state column still read their exact fields',async()=>{
    await actor(B);
    const row=(await db.query('select n.id,n.revision,n.mode,n.requester_price_rsd,n.price_basis,n.required_slots from public.marketplace_responses r join public.needs n on n.id=r.need_id where r.id=$1 and r.worker_account_id=auth.uid()',[RESPONSE])).rows[0];
    assert.deepEqual(row,{id:N,revision:1,mode:'MY_PRICE',requester_price_rsd:1200,price_basis:'HOURLY',required_slots:5});
    await actor(A);assert.equal(await value('select remaining_search_closed_at as value from public.needs where id=$1',[N]),null);
  });
  await t.test('participant/closure/anon boundaries remain separate from column projection',async()=>{
    await db.exec('reset role');await db.query("update public.needs set status='COMPLETED' where id=$1",[N]);
    await db.query("insert into public.agreements(id,need_id,worker_account_id,requester_account_id,status) values(gen_random_uuid(),$1,$2,$3,'COMPLETED')",[N,B,A]);
    await actor(B);assert.equal((await value('select public.rpc_read_task($1) as value',[N])).id,N);
    await assert.rejects(db.query('select remaining_search_close_reason from public.needs where id=$1',[N]),e=>e.code==='42501');
    await db.exec("set fixture.closed='true'");await assert.rejects(db.query('select id from public.needs'),e=>e.message==='ACCOUNT_CLOSING');
    await db.exec("set fixture.closed='false'");await actor(null,'anon');
    await assert.rejects(db.query('select id from public.needs'),e=>e.code==='42501');
    await actor(null,'service_role');assert.equal(await value('select remaining_search_close_reason as value from public.needs where id=$1',[CLOSED]),'SYNTHETIC_PRIVATE_REASON');
  });
  await t.test('unexpected reapplication stops on the reviewed preimage fence',async()=>{
    await db.exec('reset role');await assert.rejects(db.exec(candidate),e=>e.message==='R01_NEEDS_RELATION_ACL_DRIFT');
  });
 } finally {await db.close();}
});
