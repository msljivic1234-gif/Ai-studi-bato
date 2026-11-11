'use strict';
// Actual selection writer/ledger and the read-only recovery SQL in PostgreSQL.
// Local Auth identity stubs are explicit: no hosted JWT, concurrent backend
// connection, full RLS/schema replay, or native-device acceptance is claimed.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { createPriceFixture } = require('./r07-price-fixture.cjs');
const capture = JSON.parse(readFileSync(path.join(__dirname,'sql/r07_selection_recovery_20261107.preimage.json'),'utf8'));
const closureCapture = JSON.parse(readFileSync(path.join(__dirname,'sql/r08_agreement_cancellation_20261107.preimage.json'),'utf8'));
const closureSchema = JSON.parse(readFileSync(path.join(__dirname,'sql/r08_agreement_cancellation_20261107.fixture-schema.json'),'utf8'));
const candidate = readFileSync(path.join(__dirname,'sql/r07_selection_recovery_20261107.sql'),'utf8');
const signature = 'public.rpc_read_selection_result(uuid,integer,uuid,integer,text,text,integer)';
const writerSignature = 'public.rpc_select_response(uuid,integer,uuid,integer,text,text)';
const absent = { schema: 'SELECTION_RESULT_V1', authoritative: true, found: false, result: null };

test('R07 exact selection receipt, last-place refusal and current access SQL contracts', async t => {
  const f = await createPriceFixture();
  try {
    await f.db.exec(f.candidate);
    // Only Auth transport is a fixture seam. The real current-session helper
    // queries captured auth column types and rejects missing/revoked identities.
    for (const name of ['auth.users','auth.sessions']) {
      const columns=capture.session_authority.auth_columns.filter(c=>c.table===name);
      assert.equal(columns.length,3);
      await f.db.exec(`create table ${name} (${columns.map(c=>
        `"${c.name}" ${c.type}${c.notNull?' not null':''}`).join(',')},primary key(id));`);
    }
    await f.db.exec(`create function auth.jwt() returns jsonb language sql stable as $$
      select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb $$;`);
    const sessionGuard=capture.session_authority.functions.find(e=>e.name==='private.push_session_valid');
    assert.ok(sessionGuard);await f.db.exec(sessionGuard.definition);
    await f.db.exec(`revoke all on function ${sessionGuard.signature} from public,anon,authenticated,service_role;`);
    const sessions=new Map();
    for(const id of [f.REQUESTER,f.WORKER,f.FOREIGN]) {
      const sid=randomUUID();sessions.set(id,sid);
      await f.db.query('insert into auth.users(id) values($1)',[id]);
      await f.db.query('insert into auth.sessions(id,user_id) values($1,$2)',[sid,id]);
    }
    const originalActor=f.actor;
    const claims=value=>f.value("select set_config('request.jwt.claims',$1,false) as value",[JSON.stringify(value)]);
    f.actor=async id=>{await originalActor(id);await claims(sessions.has(id)?{session_id:sessions.get(id)}:{});};
    // Real captured closure tables/helpers, with no fabricated open-account result.
    for (const name of ['private.account_closure_requests','private.account_blocks']) {
      const table = closureSchema.tables.find(t => t.name === name); assert.ok(table,name);
      await f.db.exec(`create table ${name} (${table.columns.map(c =>
        `"${c.name}" ${c.type}${c.default ? ` default ${c.default}` : ''}${c.notNull ? ' not null' : ''}`).join(',')});`);
      for (const c of table.constraints) await f.db.exec(`alter table ${name} add constraint "${c.name}" ${c.definition};`);
    }
    const closureNames = ['private.closure_account_key','private.closure_account_restricted','private.closure_assert_open','private.safety_pair_blocked'];
    for (const name of closureNames) {
      const entry = capture.functions.find(f => f.name === name) ??
        [...closureCapture.functions,...closureCapture.unchangedDependencies].find(f => f.name === name);
      assert.ok(entry,name); await f.db.exec(entry.definition);
      await f.db.exec(`revoke all on function ${entry.signature} from public,anon,authenticated,service_role;`);
    }
    await f.db.exec('alter table private.selection_commands enable row level security;alter table public.agreements enable row level security;');
    const writer = () => f.value('select to_jsonb(p) as value from pg_proc p where p.oid=$1::regprocedure',[writerSignature]);
    const exists = () => f.value('select to_regprocedure($1)::text as value',[signature]);
    const originalWriter = await writer();
    const read = (k, patch = {}) => {
      const q = { ...k, ...patch };
      return f.value('select public.rpc_read_selection_result($1,$2,$3,$4,$5,$6,$7) as value',
        [q.needId,q.needRevision,q.responseId,q.responseVersion,q.contentHash,q.clientRequestId,q.coveredSlots]);
    };
    const selected = async ({required=4,covered=2} = {}) => {
      const needId = await f.need('HOURLY',1200,required);
      await f.actor(f.WORKER); const response = await f.submit(needId,1200,covered);
      const clientRequestId = randomUUID(); await f.actor(f.REQUESTER);
      const agreementId = await f.select(needId,response,clientRequestId);
      return { needId,needRevision:response.needRevision,responseId:response.responseId,responseVersion:response.version,
        contentHash:response.contentHash,clientRequestId,coveredSlots:covered,agreementId,response };
    };
    const expected = (k,status='CONFIRMED') => ({schema:'SELECTION_RESULT_V1',authoritative:true,found:true,result:{
      agreementId:k.agreementId,agreementStatus:status,needId:k.needId,needRevision:k.needRevision,
      responseId:k.responseId,responseVersion:k.responseVersion,contentHash:k.contentHash,
      coveredSlots:k.coveredSlots,clientRequestId:k.clientRequestId,
    }});
    const snapshot = () => f.value(`select jsonb_build_object(
      'commands',(select coalesce(jsonb_agg(to_jsonb(c) order by requester_account_id,client_request_id),'[]') from private.selection_commands c),
      'selections',(select coalesce(jsonb_agg(to_jsonb(s) order by id),'[]') from public.need_selections s),
      'agreements',(select coalesce(jsonb_agg(to_jsonb(a) order by id),'[]') from public.agreements a),
      'versions',(select coalesce(jsonb_agg(to_jsonb(v) order by agreement_id,version),'[]') from public.agreement_versions v),
      'activations',(select coalesce(jsonb_agg(to_jsonb(a) order by id),'[]') from private.connection_activations a),
      'sessions',(select coalesce(jsonb_agg(to_jsonb(s) order by id),'[]') from auth.sessions s),
      'authUsers',(select coalesce(jsonb_agg(to_jsonb(u) order by id),'[]') from auth.users u)
    ) as value`);

    await t.test('fresh DEV capture matches the actual fixture writer before adding a reader',async()=>{
      assert.equal(await f.value('select md5(prosrc) as value from pg_proc where oid=$1::regprocedure',[writerSignature]),
        capture.functions.find(f=>f.name==='public.rpc_select_response').body_md5);
      assert.equal(await exists(),null);
    });
    await t.test('source, ACL and ledger-schema drift refuse the entire candidate',async()=>{
      const entry=capture.functions.find(f=>f.name==='public.rpc_select_response');
      for(const sql of [entry.definition.replace('\nbegin','\nbegin -- deliberate drift'),
        sessionGuard.definition.replace('p_session is not null','true'),
        `grant execute on function ${writerSignature} to anon`,
        'alter table private.selection_commands add column unreviewed boolean']) {
        await f.db.exec('begin'); await f.db.exec(sql);
        await f.fails(()=>f.db.exec(candidate),'R07_SELECTION_RECOVERY_(SOURCE_OR_ACL|SCHEMA)_DRIFT');
        await f.db.exec('rollback'); assert.equal(await exists(),null); assert.deepEqual(await writer(),originalWriter);
      }
    });
    await t.test('reader installation rolls back atomically and changes no existing writer or row',async()=>{
      const before=await snapshot();
      await f.db.exec('begin');await f.db.exec(candidate);await f.db.exec('rollback');
      assert.equal(await exists(),null);assert.deepEqual(await writer(),originalWriter);assert.deepEqual(await snapshot(),before);
      await f.db.exec(candidate);assert.ok(await exists());assert.deepEqual(await writer(),originalWriter);assert.deepEqual(await snapshot(),before);
    });
    await t.test('exact committed selection recovers its Agreement with no write or fabricated amount',async()=>{
      const k=await selected(), before=await snapshot();
      assert.deepEqual(await read(k),expected(k));assert.deepEqual(await read(k),expected(k));
      assert.deepEqual(await snapshot(),before);
      const terms=await f.value('select terms as value from public.agreement_versions where agreement_id=$1',[k.agreementId]);
      assert.equal(terms.price_rsd,1200);assert.equal(terms.priceBasis,'HOURLY');assert.equal(terms.covered_slots,2);
    });
    await t.test('current task edits never replace the saved key, version, price unit or people',async()=>{
      const k=await selected();
      await f.db.query("update public.needs set revision=revision+1,requester_price_rsd=9999,price_basis='TOTAL',required_slots=1 where id=$1",[k.needId]);
      const before=await snapshot();assert.deepEqual(await read(k),expected(k));assert.deepEqual(await snapshot(),before);
    });
    await t.test('NOT_FOUND is only an observation and later commit is recovered using the same key',async()=>{
      const needId=await f.need('HOURLY');await f.actor(f.WORKER);const r=await f.submit(needId);
      const k={needId,needRevision:r.needRevision,responseId:r.responseId,responseVersion:r.version,
        contentHash:r.contentHash,coveredSlots:2,clientRequestId:randomUUID()};
      await f.actor(f.REQUESTER);const before=await snapshot();assert.deepEqual(await read(k),absent);assert.deepEqual(await snapshot(),before);
      k.agreementId=await f.select(needId,r,k.clientRequestId);
      assert.deepEqual(await read(k),expected(k));
    });
    await t.test('foreign account cannot read the owner ledger even with every exact identity',async()=>{
      const k=await selected(), before=await snapshot();await f.actor(f.FOREIGN);
      assert.deepEqual(await read(k),absent);assert.deepEqual(await read({...k,clientRequestId:randomUUID()}),absent);
      assert.deepEqual(await snapshot(),before);
      await f.actor(null);await f.fails(()=>read(k),'AUTH_REQUIRED');
    });
    await t.test('each changed identity or headcount is rejected instead of recovering another intent',async()=>{
      const k=await selected(), before=await snapshot();
      for(const patch of [{needId:randomUUID()},{needRevision:2},{responseId:randomUUID()},
        {responseVersion:2},{contentHash:'f'.repeat(64)},{coveredSlots:1}])
        await f.fails(()=>read(k,patch),'IDEMPOTENCY_KEY_REUSED');
      for(const patch of [{needId:null},{responseId:null},{needRevision:0},{responseVersion:null},
        {contentHash:'invalid'},{coveredSlots:0},{coveredSlots:51},{clientRequestId:'short'}])
        await f.fails(()=>read(k,patch),'SELECTION_COMMAND_INVALID');
      assert.deepEqual(await snapshot(),before);
    });
    await t.test('missing, malformed or foreign session claims never authorize the owner ledger',async()=>{
      const k=await selected(),before=await snapshot();
      for(const value of [{},{session_id:null},{session_id:'invalid'},{session_id:randomUUID()},
        {session_id:sessions.get(f.FOREIGN)}]) {
        await claims(value);await f.fails(()=>read(k),'AUTH_REQUIRED');
      }
      await f.actor(f.REQUESTER);assert.deepEqual(await read(k),expected(k));
      assert.deepEqual(await snapshot(),before);
    });
    await t.test('revoked or expired sessions and deleted or banned accounts lose access immediately',async()=>{
      const k=await selected(),sid=sessions.get(f.REQUESTER);
      for(const [sql,args] of [
        ['delete from auth.sessions where id=$1',[sid]],
        ["update auth.sessions set not_after=clock_timestamp()-interval '1 second' where id=$1",[sid]],
        ['update auth.sessions set user_id=$2 where id=$1',[sid,f.FOREIGN]],
        ['update auth.users set deleted_at=clock_timestamp() where id=$1',[f.REQUESTER]],
        ["update auth.users set banned_until=clock_timestamp()+interval '1 day' where id=$1",[f.REQUESTER]],
      ]) {
        await f.db.exec('begin');await f.db.query(sql,args);
        await f.fails(()=>read(k),'AUTH_REQUIRED');await f.db.exec('rollback');
        assert.deepEqual(await read(k),expected(k));
      }
    });
    await t.test('cancelled, completed and superseded Agreements are recovered as their current state',async()=>{
      const k=await selected();
      for(const status of ['CANCELLED','COMPLETED','SUPERSEDED']) {
        await f.db.query('update public.agreements set status=$2 where id=$1',[k.agreementId,status]);
        const before=await snapshot();assert.deepEqual(await read(k),expected(k,status));assert.deepEqual(await snapshot(),before);
      }
    });
    await t.test('current caller closure denies a historical receipt; partner closure and block retain only own history',async()=>{
      const k=await selected();
      await f.db.query("insert into private.account_closure_requests(account_id,state,revision) values($1,'READY',1)",[f.REQUESTER]);
      await f.fails(()=>read(k),'ACCOUNT_CLOSING');
      await f.db.exec('delete from private.account_closure_requests');
      await f.db.query("insert into private.account_closure_requests(account_id,state,revision) values($1,'READY',1)",[f.WORKER]);
      await f.db.query(`insert into private.account_blocks(blocker_account_id,blocked_account_id,active,revision,last_blocked_at)
        values($1,$2,true,1,statement_timestamp())`,[f.REQUESTER,f.WORKER]);
      assert.equal(await f.value('select private.safety_pair_blocked($1,$2) as value',[f.REQUESTER,f.WORKER]),true);
      assert.deepEqual(await read(k),expected(k));
      assert.deepEqual(Object.keys((await read(k)).result).sort(),Object.keys(expected(k).result).sort());
      await f.db.exec('delete from private.account_closure_requests;delete from private.account_blocks;');
    });
    await t.test('revoked current participation and an inconsistent ledger link fail closed',async()=>{
      const k=await selected();
      await f.db.query('update public.agreements set requester_account_id=$2 where id=$1',[k.agreementId,f.FOREIGN]);
      await f.fails(()=>read(k),'SELECTION_RESULT_UNAVAILABLE');
      await f.db.query('update public.agreements set requester_account_id=$2,need_id=$3 where id=$1',[k.agreementId,f.REQUESTER,randomUUID()]);
      await f.fails(()=>read(k),'SELECTION_RESULT_UNAVAILABLE');
    });
    await t.test('ordinary SQL role can read only its own receipt while anon and no-identity service are denied',async()=>{
      const k=await selected();await f.db.exec('set role authenticated');
      try {assert.deepEqual(await read(k),expected(k));}
      finally {await f.db.exec('reset role');}
      await f.db.exec('set role anon');
      try {await f.fails(()=>read(k),'permission denied');}
      finally {await f.db.exec('reset role');}
      await f.actor(null);await f.db.exec('set role service_role');
      try {await f.fails(()=>read(k),'AUTH_REQUIRED');}
      finally {await f.db.exec('reset role');}
    });
    await t.test('one last place admits one whole offer and the refused second choice has no saved receipt',async()=>{
      const account=randomUUID(),profile=randomUUID(),id=await f.need('HOURLY',1200,1);
      await f.db.query(`insert into public.app_profiles(id,account_id,kind,display_name,city,skills,profile_status)
        values($1,$2,'WORKER','Drugi test radnik','Novi Sad',array['Selidbe'],'ACTIVE')`,[profile,account]);
      await f.actor(f.WORKER);const first=await f.submit(id,1200,1);
      await f.actor(account);const second=await f.submit(id,1200,1,1,randomUUID(),profile);
      const key1=randomUUID(),key2=randomUUID();await f.actor(f.REQUESTER);
      const agreement=await f.select(id,first,key1);
      await f.fails(()=>f.select(id,second,key2),'NEED_NOT_OPEN');
      assert.equal(await f.value('select public.fn_need_covered_slots($1) as value',[id]),1);
      assert.equal(await f.value('select count(*)::int as value from public.agreements where need_id=$1',[id]),1);
      assert.equal(await f.select(id,first,key1),agreement);
      assert.deepEqual(await read({needId:id,needRevision:second.needRevision,responseId:second.responseId,
        responseVersion:second.version,contentHash:second.contentHash,coveredSlots:1,clientRequestId:key2}),absent);
    });
  } finally {await f.db.close();}
});
