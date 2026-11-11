'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const sql=fs.readFileSync(path.join(__dirname,'..','scripts','sql','r07a_currency_invalidation_20261107.sql'),'utf8');
test('currency SQL candidate is fenced to the reviewed writer',()=>{
 assert.match(sql,/R07A_WRITER_SOURCE_DRIFT/);
 assert.match(sql,/db25bcbffbef1d0947c53defb1a6cb05/);
 assert.match(sql,/IF v_item->>'action'='INVALIDATE_PRICE' THEN/);
});
test('correction atomically removes only old price fields in the same conversation',()=>{
 assert.match(sql,/UPDATE public\.ai_structured_facts/);
 assert.match(sql,/account_id=p_account_id AND conversation_id=p_conversation_id/);
 assert.match(sql,/fact_key IN \('need\.price_mode','need\.price_rsd','need\.price_basis'\)/);
 assert.match(sql,/superseded_at IS NULL/);
 assert.match(sql,/v_price_invalidation_seen:=TRUE/);
});
test('service-only correction rejects conflicts and preserves caller rights',()=>{
 assert.match(sql,/v_price_invalidation_seen/);
 assert.match(sql,/p_safety NOT IN \('CLARIFY','REVIEW'\)/);
 assert.match(sql,/concurrent_fact->>'key' IN \('need\.price_mode','need\.price_rsd','need\.price_basis'\)/);
 assert.match(sql,/REVOKE ALL ON FUNCTION/);
 assert.match(sql,/GRANT EXECUTE ON FUNCTION/);
});
