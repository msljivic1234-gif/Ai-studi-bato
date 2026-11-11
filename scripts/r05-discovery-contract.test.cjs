'use strict';
// Run the exact guarded forward SQL and the actual current client decoders.
// Reuse the existing disposable R01 setup (without running its tests), then
// install captured discovery/matcher bodies. PostgreSQL ACL/RLS, pagination,
// aggregates, ICU folding and the owned matcher chain execute for real.
// Account lineage, signed taxonomy eligibility and saved-area geometry are
// bounded fixtures. This is not native, live load, actual PostGIS or JWT proof.
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),ts=require('typescript');
const ROOT=path.resolve(__dirname,'..');
const preimage=JSON.parse(fs.readFileSync(path.join(__dirname,'sql/r05_discovery_contract_20261107.preimage.json'),'utf8'));
const candidate=fs.readFileSync(path.join(__dirname,'sql/r05_discovery_contract_20261107.sql'),'utf8');
const source=fs.readFileSync(path.join(__dirname,'r01-needs-projection.test.cjs'),'utf8');
const parsed=ts.createSourceFile('fixture.cjs',source,ts.ScriptTarget.ES2022,true,ts.ScriptKind.JS);
const firstTest=parsed.statements.find(node=>ts.isExpressionStatement(node)&&ts.isCallExpression(node.expression)
  &&node.expression.expression.getText(parsed)==='test');
assert.ok(firstTest,'existing synthetic R01 setup must be identifiable');
const baseline=new Function('require','__dirname',source.slice(0,firstTest.getStart(parsed))
  +'\nreturn {fixture,A,B,C,N,D,OTHER,CLOSED,PROFILE};')(require,__dirname);
const {A,B,C,N,D,OTHER,CLOSED}=baseline;
const id=n=>`60000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const WORKER=id(900),OTHER_WORKER=id(901);
const quote=value=>"'"+value.replaceAll("'","''")+"'";
const filter=change=>({text:'',price:'all',where:'any',places:1,when:'any',dates:null,place:null,...change});
const page=(change={},rest={})=>({mode:'PAGE',filter:filter(change),anchor:null,scope:{kind:'ALL'},limit:100,after:null,...rest});
const clean=value=>Array.isArray(value)?value.map(clean):value&&typeof value==='object'
  ?Object.fromEntries(Object.entries(value).filter(([key])=>!['asOf','observedAt'].includes(key)).map(([key,value])=>[key,clean(value)])):value;
const modules=new Map();
function load(relative){
 const file=['','.ts','.tsx'].map(ext=>path.resolve(ROOT,relative+ext)).find(p=>fs.existsSync(p)&&fs.statSync(p).isFile());
 assert.ok(file,'actual source module: '+relative);
 if(modules.has(file))return modules.get(file).exports;
 const result=ts.transpileModule(fs.readFileSync(file,'utf8'),{fileName:file,reportDiagnostics:true,
  compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}});
 assert.deepEqual(result.diagnostics,[]);
 const mod={exports:{}};modules.set(file,mod);
 new Function('require','module','exports',result.outputText)(name=>name.startsWith('.')
  ?load(path.relative(ROOT,path.resolve(path.dirname(file),name))):require(name),mod,mod.exports);
 return mod.exports;
}

async function fixture(){
 const f=await baseline.fixture(),{db,value}=f;
 await db.exec(fs.readFileSync(path.join(__dirname,'sql/r01_needs_projection_20261107.sql'),'utf8'));
 await db.exec(`drop collation pg_catalog."sr-Latn-RS-x-icu";
 create collation pg_catalog."sr-Latn-RS-x-icu" (provider=icu,locale='sr-Latn-RS');
 alter table public.app_profiles add column kind text default 'REQUESTER',add column profile_status text default 'ACTIVE',
  add column city text default 'Subotica',add column radius_km integer default 10,add column operating_country_code text default 'RS',
  add column skills text[] default '{Lektura}',add column exclusions text[] default '{}',add column available_now boolean default false;
 create table public.worker_match_preferences(worker_profile_id uuid,approximate_lat numeric,approximate_lng numeric,timezone text);
 create table private.taxonomy_match_scope_control_v1(singleton boolean,enabled boolean);
 insert into private.taxonomy_match_scope_control_v1 values(true,false);
 create table private.fixture_saved_areas(account_id uuid,areas jsonb);
 create function private.worker_saved_areas_v1(uuid) returns jsonb language sql stable as $$
  select coalesce((select areas from private.fixture_saved_areas where account_id=$1),'[]'::jsonb)$$;
 create function private.worker_area_fit_v1(jsonb,text,text,text,numeric,numeric) returns boolean language sql immutable as $$
  select exists(select 1 from jsonb_array_elements($1) x where x->>'city'=$4)$$;
 create function private.taxonomy_handoff_fit_v1(uuid,uuid) returns boolean language sql immutable as $$select true$$;
 create function private.identity_admitted(uuid) returns boolean language sql immutable as $$select false$$;
 create function private.accounts_same_world(uuid,uuid) returns boolean language sql stable as $$
  select private.account_visibility_world($1)=private.account_visibility_world($2)$$;
 create function private.lower_arr(text[]) returns text[] language sql immutable as $$select coalesce(array_agg(lower(x)),array[]::text[]) from unnest($1) x$$;
 create function private.work_kinds_v5(text[]) returns text[] language sql immutable as $$select private.lower_arr($1)$$;
 create function private.haversine_km(numeric,numeric,numeric,numeric) returns numeric language sql immutable as $$
  select 6371.0*2*asin(least(1,sqrt(power(sin(radians(($1-$3)::double precision)/2),2)
   +cos(radians($1::double precision))*cos(radians($3::double precision))*power(sin(radians(($2-$4)::double precision)/2),2))))$$;
 `);
 // Create dependencies first. PL/pgSQL validates unvisited calendar branches
 // lazily; fixture tasks are FLEXIBLE/REMOTE_ANYTIME without a fixed interval.
 for(const name of ['private.effective_radius_km(integer)','private.worker_need_time_tier_v1(uuid,uuid)',
  'private.worker_need_fit_v1(uuid,uuid,boolean)','private.worker_need_match_v1(uuid,uuid)',
  ...preimage.functions.filter(x=>!x.signature.startsWith('private.')&&x.signature!=='rpc_discovery_v1(jsonb)').map(x=>x.signature)]){
   const fn=preimage.functions.find(x=>x.signature===name);assert.ok(fn,name);
   await db.exec(fn.definition);
   const signature=name.startsWith('private.')?name:'public.'+name;
   await db.exec('revoke all on function '+signature+' from public,anon,authenticated,service_role;');
   for(const role of ['authenticated','service_role'])if(fn.acl.includes(role+'=X'))
    await db.exec('grant execute on function '+signature+' to '+role+';');
 }
 await db.query("insert into public.app_profiles(id,account_id,kind) values($1,$2,'WORKER'),($3,$4,'WORKER')",[WORKER,B,OTHER_WORKER,C]);
 await db.query("insert into public.worker_match_preferences values($1,46.10,19.66,'Europe/Belgrade'),($2,46.10,19.66,'Europe/Belgrade')",[WORKER,OTHER_WORKER]);
 await db.query("insert into private.fixture_saved_areas values($1,'[{\"city\":\"Niš\"}]'),($2,'[{\"city\":\"Niš\"}]')",[B,C]);
 await db.query("update public.needs set category='Lektura',schedule_kind='FLEXIBLE',published_at=statement_timestamp()-interval '20 minutes' where id=$1",[N]);
 const template=await value('select to_jsonb(n) as value from public.needs n where id=$1',[N]);
 const add=async(number,patch={})=>{
  const fields=preimage.needsState.columns.map(c=>c.name).filter(c=>c!=='approx_geog');
  const row={...template,id:id(number),title:'TEST lektura '+number,execution_location_mode:'REMOTE',schedule_kind:'REMOTE_ANYTIME',
   approximate_city:'',approximate_area:'',approximate_lat:null,approximate_lng:null,...patch};
  await db.query('insert into public.needs('+fields.join(',')+') values('+fields.map((_,i)=>'$'+(i+1)).join(',')+')',fields.map(k=>row[k]));
  await db.query("update public.needs set published_at=statement_timestamp()-make_interval(secs=>$2) where id=$1",[row.id,number+1]);
  return row.id;
 };
 await add(1,{category:'Moleraj'}); // newest public row must not consume a ForMe page
 await add(2,{price_basis:'HOURLY',requester_price_rsd:1200});
 await add(3,{price_basis:'PER_PERSON',requester_price_rsd:1000});
 for(const n of [4,5])await add(n,{execution_location_mode:'STATIONARY',schedule_kind:'FLEXIBLE',approximate_city:'Niš',
  approximate_area:n===4?'Medijana':'Pantelej',approximate_lat:43.32,approximate_lng:21.90,price_basis:'TOTAL',requester_price_rsd:2000});
 await add(6,{mode:'OFFERS',requester_price_rsd:null,price_basis:null});
 await add(7,{requester_price_rsd:50,price_basis:'TOTAL'});
 await add(8,{requester_account_id:B});
 await db.query("insert into public.need_selections values($1,$2,'SELECTED',3)",[id(2),B]);
 const raw=async request=>{try{return await value('select public.rpc_discovery_v1($1) as value',[request]);}
  catch(cause){const error=new Error(cause.message);error.code=cause.code;throw error;}};
 const decode=raw=>raw.mode==='PAGE'?load('src/data/discoveryV1Contract').decodeDiscoveryV1Page(raw,100)
  :raw.mode==='EXACT_PUBLIC'?load('src/data/discoveryV1Contract').decodeDiscoveryV1Exact(raw)
  :raw.mode==='MAP'?load('src/data/discoveryV1SpatialContract').decodeDiscoveryV1Map(raw)
  :load('src/data/discoveryV1SpatialContract').decodeDiscoveryV1Places(raw,30);
 return {...f,add,raw,decode};
}

test('R05 discovery restores active wire modes and filters without changing authority',async t=>{
 const f=await fixture(),{db,value,actor,raw,decode,add}=f;
 const metadata=()=>value(`select jsonb_object_agg(p.oid::regprocedure::text,to_jsonb(p)) as value from pg_proc p
  where p.oid=any($1::regprocedure[])`,[preimage.functions.map(x=>x.signature.startsWith('private.')?x.signature:'public.'+x.signature)]);
 try{
  await t.test('old live body reproduces forMe/minimum and MAP/PLACES failures',async()=>{
   await actor(B);
   for(const request of [page({forMe:true}),page({minBudgetRsd:1000})])
    await assert.rejects(raw(request),e=>e.message==='P6_INVALID_FILTER');
   for(const mode of ['MAP','PLACES'])await assert.rejects(raw({mode}),e=>e.message==='P6_MODE_NOT_IMPLEMENTED');
   assert.equal(decode(await raw(page())).items[0].id,id(1));
   await db.exec('reset role');
  });
  await t.test('source/ACL/projection drift aborts before any function replacement',async()=>{
   const target=preimage.functions.find(x=>x.signature==='rpc_discovery_v1(jsonb)');
   for(const drift of [target.definition.replace('declare','declare /* drift */'),
    'grant execute on function public.rpc_discovery_v1(jsonb) to anon',
    'grant select(remaining_search_close_reason) on public.needs to authenticated',
    'alter policy needs_public_discovery on public.needs using(true)']){
    await db.exec('begin');await db.exec(drift);
    await assert.rejects(db.exec(candidate),e=>/^R05_DISCOVERY_(PREIMAGE|PROJECTION)_DRIFT/.test(e.message));
    await db.exec('rollback');
   }
  });
  let oldPage;
  await t.test('exact candidate preserves data, every function metadata field, helpers and default PAGE output',async()=>{
   await actor(B);oldPage=await raw(page());await db.exec('reset role');
   const before=await metadata(),rows=await value('select jsonb_agg(to_jsonb(n) order by id) as value from public.needs n');
   await db.exec('begin');await db.exec(candidate);await db.exec('rollback');assert.deepEqual(await metadata(),before);
   await db.exec(candidate);
   const after=await metadata();
   for(const [key,entry] of Object.entries(before)){
    const afterEntry=after[key];assert.ok(afterEntry);
    if(key==='rpc_discovery_v1(jsonb)'){
     const {prosrc:oldBody,...oldMeta}=entry,{prosrc:newBody,...newMeta}=afterEntry;
     assert.notEqual(newBody,oldBody);assert.deepEqual(newMeta,oldMeta);
    }else assert.deepEqual(afterEntry,entry);
   }
   assert.deepEqual(await value('select jsonb_agg(to_jsonb(n) order by id) as value from public.needs n'),rows);
   await actor(B);assert.deepEqual(clean(await raw(page({}, {anchor:oldPage.anchor}))),clean(oldPage));
  });
  await t.test('absent and false forMe preserve the old filter hash and traversal',async()=>{
   const absent=await raw(page()),off=await raw(page({forMe:false},{anchor:absent.anchor}));
   assert.equal(absent.filterKey,oldPage.filterKey);assert.deepEqual(clean(off),clean(absent));decode(off);
  });
  await t.test('ForMe applies the existing owned matcher before limit and counts',async()=>{
   const first=await raw(page({forMe:true},{limit:1}));decode(first);
   assert.equal(first.items.length,1);assert.equal(first.items[0].id,id(2));
   assert.equal(first.counts.listed,6);assert.equal(first.hasMore,true);
   const second=await raw(page({forMe:true},{limit:1,anchor:first.anchor,after:first.nextCursor}));decode(second);
   assert.equal(second.items[0].id,id(3));assert.equal(second.counts.listed,first.counts.listed);
   const all=await raw(page({forMe:true}));assert.deepEqual(all.items.map(x=>x.id),[2,3,4,5,6,7].map(id));
  });
  await t.test('saved distant work areas survive despite a small legacy profile circle',async()=>{
   await db.exec('reset role');
   const distance=await value('select private.haversine_km(43.32,21.90,46.10,19.66) as value');assert.ok(distance>300);
   await actor(B);const result=decode(await raw(page({forMe:true,where:'onsite'})));
   assert.deepEqual(result.items.map(x=>x.id),[id(4),id(5)]);
  });
  await t.test('personal anchors/cursors cannot be reused for all tasks or another account',async()=>{
   const all=await raw(page()),mine=await raw(page({forMe:true},{limit:1}));
   await assert.rejects(raw(page({forMe:true},{anchor:all.anchor})),e=>e.message==='P6_INVALID_ANCHOR');
   await assert.rejects(raw(page({}, {anchor:mine.anchor})),e=>e.message==='P6_INVALID_ANCHOR');
   await assert.rejects(raw(page({}, {anchor:all.anchor,after:mine.nextCursor})),e=>e.message==='P6_INVALID_CURSOR');
   await actor(C);await assert.rejects(raw(page({forMe:true},{anchor:mine.anchor})),e=>e.message==='P6_INVALID_ANCHOR');
   await actor(B);
  });
  await t.test('missing/inactive profile refuses ForMe and never falls back to a public list',async()=>{
   await actor(A);await assert.rejects(raw(page({forMe:true})),e=>e.message==='P6_FOR_ME_PROFILE_REQUIRED');
   await db.exec('reset role');await db.query("update public.app_profiles set profile_status='DRAFT' where id=$1",[WORKER]);
   await actor(B);await assert.rejects(raw(page({forMe:true})),e=>e.message==='P6_FOR_ME_PROFILE_REQUIRED');
   await db.exec('reset role');await db.query("update public.app_profiles set profile_status='ACTIVE' where id=$1",[WORKER]);await actor(B);
  });
  await t.test('stated budget preserves HOURLY/PER_PERSON/TOTAL and offers without dividing by people',async()=>{
   const result=decode(await raw(page({forMe:true,minBudgetRsd:1000})));
   assert.deepEqual(result.items.map(x=>x.id),[2,3,4,5,6].map(id));
   assert.deepEqual(result.items.slice(0,3).map(x=>[x.requesterPriceRsd,x.priceBasis]),[[1200,'HOURLY'],[1000,'PER_PERSON'],[2000,'TOTAL']]);
   assert.equal(result.items[0].coveredSlots,3);assert.equal(result.items[0].requiredSlots,5);
   assert.equal(decode(await raw(page({forMe:true,minBudgetRsd:1000,places:3}))).items.some(x=>x.id===id(2)),false);
   assert.equal(decode(await raw(page({forMe:true,minBudgetRsd:1000,price:'MY_PRICE'}))).items.some(x=>x.priceMode==='OFFERS'),false);
   await assert.rejects(raw(page({forMe:true,minBudgetRsd:1001},{anchor:result.anchor})),e=>e.message==='P6_INVALID_ANCHOR');
  });
  await t.test('invalid optional filter values fail closed, including null, strings and OFFERS-only minimum',async()=>{
   for(const entry of [null,'1000',0,-1,1.5,2147483648])await assert.rejects(raw(page({minBudgetRsd:entry})),e=>e.message==='P6_INVALID_FILTER');
   for(const entry of [null,'true',1,{}])await assert.rejects(raw(page({forMe:entry})),e=>e.message==='P6_INVALID_FILTER');
   await assert.rejects(raw(page({price:'OFFERS',minBudgetRsd:1})),e=>e.message==='P6_INVALID_FILTER');
   await assert.rejects(raw(page({invented:true})),e=>e.message==='P6_INVALID_FILTER');
  });
  await t.test('MAP uses the same personal/budget membership and public coarse pins',async()=>{
   const request=page({forMe:true,minBudgetRsd:1000}),first=await raw(request);
   const map=decode(await raw({mode:'MAP',filter:request.filter,anchor:first.anchor,bounds:[-180,-90,180,90],grid:24}));
   assert.equal(map.counts.mapped,5);assert.equal(map.counts.withoutPoint,3);assert.equal(map.buckets.length,1);
   assert.equal(map.buckets[0].kind,'PLACE');assert.equal(map.buckets[0].taskCount,2);
   assert.deepEqual(map.buckets[0].point,{lat:43.32,lng:21.9});assert.deepEqual(map.wholeBounds,[21.9,43.32,21.9,43.32]);
  });
  await t.test('PLACES CITY totals agree with PAGE selection, while AREA and prefix cursors remain separate',async()=>{
   const base={mode:'PLACES',filter:filter({forMe:true,minBudgetRsd:1000}),anchor:null,prefix:'',facetArea:null,limit:1,after:null};
   const city=decode(await raw({...base,groupBy:'CITY'}));assert.deepEqual(city.items,[{key:'niš',text:'Niš',count:2}]);
   const chosen=decode(await raw(page({forMe:true,minBudgetRsd:1000,place:city.items[0].text})));assert.equal(chosen.items.length,2);
   const area=decode(await raw(base));assert.equal(area.hasMore,true);assert.equal(area.items[0].count,1);
   const next=decode(await raw({...base,anchor:area.anchor,after:area.nextCursor}));assert.equal(next.items.length,1);
   assert.notEqual(next.items[0].key,area.items[0].key);
   await assert.rejects(raw({...base,groupBy:'CITY',anchor:area.anchor}),e=>e.message==='P6_INVALID_ANCHOR');
   await assert.rejects(raw({...base,prefix:'Ni',anchor:area.anchor}),e=>e.message==='P6_INVALID_ANCHOR');
  });
  await t.test('Serbian Cyrillic and Latin folding find the same city without changing public labels',async()=>{
   const latin=decode(await raw(page({forMe:true,place:'Nis'}))),cyrillic=decode(await raw(page({forMe:true,place:'НИШ'})));
   assert.deepEqual(cyrillic.items.map(x=>x.id),latin.items.map(x=>x.id));assert.equal(cyrillic.items.length,2);
   assert.equal(cyrillic.items[0].approximateCity,'Niš');
  });
  await t.test('EXACT_PUBLIC retains strict existing wire and draft/world/closed privacy boundaries',async()=>{
   assert.equal(decode(await raw({mode:'EXACT_PUBLIC',needId:id(2)})).items[0].priceBasis,'HOURLY');
   for(const needId of [D,OTHER,CLOSED])assert.deepEqual(decode(await raw({mode:'EXACT_PUBLIC',needId})).items,[]);
   for(const sql of ['select * from public.needs','select remaining_search_close_reason from public.needs'])
    await assert.rejects(db.query(sql),e=>e.code==='42501');
   await db.exec("set fixture.closed='true'");await assert.rejects(raw(page()),e=>e.message==='ACCOUNT_CLOSING');
   await db.exec("set fixture.closed='false'");
   await actor(null);await assert.rejects(raw(page()),e=>e.message==='AUTH_REQUIRED');
   await actor(null,'anon');await assert.rejects(raw(page()),e=>e.code==='42501');await actor(B);
  });
  await t.test('world seed over 300 rows clusters all visible pins instead of truncating a page',async()=>{
   await db.exec('reset role');
   for(let n=100;n<400;n++)await add(n,{execution_location_mode:'STATIONARY',schedule_kind:'FLEXIBLE',approximate_city:'Test grad',
    approximate_area:'Test mesto',approximate_lat:40+(n%50)/100,approximate_lng:20+Math.floor(n/50)/100});
   await actor(B);const all=await raw(page()),map=decode(await raw({mode:'MAP',filter:filter(),anchor:all.anchor,bounds:[-180,-90,180,90],grid:24}));
   assert.ok(map.counts.mapped>300);assert.ok(map.buckets.length<=256);
   assert.equal(map.buckets.reduce((sum,x)=>sum+(x.kind==='TASK'?1:x.taskCount),0),map.counts.mapped-map.counts.withoutPoint);
  });
 }finally{await db.close();}
});
