// P1.7 — internal, bounded post-save catalog admission processor.
// No public client access. No user/private payload logs. This ONLY admits
// reviewed catalog IDs; it never binds worker abilities, needs, matches or push.
// The Edge endpoint is disabled until all independent rollout gates pass.
const record=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const uuid=x=>typeof x==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(x);
const purposes=new Set(['WORKER_CAPABILITY','NEED_SERVICE']);
const exact=(obj,keys)=>record(obj)&&Object.keys(obj).length===keys.length&&keys.every(k=>Object.hasOwn(obj,k));
const claimFields=['id','ownerAccountId','requestKey','sourceReviewId','purpose','plans','leaseToken','attempts'];
const validClaim=x=>exact(x,claimFields)&&uuid(x.id)&&uuid(x.ownerAccountId)&&uuid(x.requestKey)&&
  uuid(x.sourceReviewId)&&uuid(x.leaseToken)&&purposes.has(x.purpose)&&
  Number.isInteger(x.attempts)&&x.attempts>0&&x.attempts<=1000&&
  Array.isArray(x.plans)&&x.plans.length>0&&
  x.plans.length<=(x.purpose==='WORKER_CAPABILITY'?24:1)&&
  x.plans.every(record);

export class TaxonomyWorkerProtocolError extends Error {
  constructor(){super('TAXONOMY_WORKER_PROTOCOL_INVALID');}
}

/** Drive the database's signed-review admission and fenced outbox protocol.
 *  rpc(name,args) MUST be a service-role-only, time-bounded internal transport.
 *  A catalog receipt is NOT a worker capability or need/push authorization.
 */
export async function processTaxonomyPostSaveTick(rpc,{limit=3,reconcileLimit=25}={}){
  if(typeof rpc!=='function'||!Number.isInteger(limit)||limit<1||limit>5||
    !Number.isInteger(reconcileLimit)||reconcileLimit<1||reconcileLimit>50)
    throw new TaxonomyWorkerProtocolError();
  const reconciled=await rpc('rpc_taxonomy_reconcile_reviewed_outbox_service',{p_limit:reconcileLimit});
  if(!Number.isInteger(reconciled)||reconciled<0||reconciled>reconcileLimit)
    throw new TaxonomyWorkerProtocolError();
  const rows=await rpc('rpc_taxonomy_claim_reviewed_batches_service',{p_limit:limit});
  if(!Array.isArray(rows)||rows.length>limit||!rows.every(validClaim))
    throw new TaxonomyWorkerProtocolError();
  let admitted=0,reviewRequired=0,retry=0;
  for(const job of rows){
    let errorCode=null;
    try {
      const receipt=await rpc('rpc_taxonomy_commit_reviewed_batch_service',{
        p_owner_account_id:job.ownerAccountId,
        p_request_key:job.requestKey,
        p_purpose:job.purpose,
        p_source_review_id:job.sourceReviewId,
        p_plans:job.plans,
      });
      if(!record(receipt)||receipt.status!=='COMMITTED'||
        receipt.capabilityAuthority!=='NONE'||receipt.needRevisionAuthority!=='NONE'||
        receipt.notificationAuthority!=='NONE'||receipt.requiresBinding!==true||
        !Array.isArray(receipt.items)||receipt.items.length!==job.plans.length||
        !receipt.items.every(item=>record(item)&&uuid(item.categoryId)&&
          ['REMOTE','ON_SITE'].includes(item.mode))||
        !Number.isInteger(receipt.catalogVersion)||receipt.catalogVersion<1)
        throw new TaxonomyWorkerProtocolError();
    }catch(error){
      // An uncertain network response may hide a successful committed receipt:
      // the finalizer first reconciles that SAME operation. If absent, PostgreSQL
      // retains the existing bounded same-key retry / review-required policy.
      // A generic exception may happen AFTER the database committed but
      // BEFORE the client received its receipt. Only an explicitly classified
      // permanent internal transport error may require human review now.
      // Unknown errors and malformed receipts retain the SAME request key
      // through the database's bounded RETRY/lease protocol (max 5 claims).
      let confirmedPermanent=false;
      try {
        // Deno/Node VM boundaries can throw Error objects from another realm:
        // instanceof Error is NOT a reliable proof of a known 4xx failure.
        // Require our internal transport's explicit own boolean classification.
        confirmedPermanent=error!==null && typeof error==='object'
          && !(error instanceof TaxonomyWorkerProtocolError)
          && Object.hasOwn(error,'retryable') && error.retryable===false;
      } catch { /* hostile or broken error metadata is still UNKNOWN */ }
      errorCode=confirmedPermanent?'BATCH_REVIEW_REQUIRED':'TEMPORARY_UNAVAILABLE';
    }
    // We never claim success from the Edge alone: only the database receipt
    // may finalize a lease, even when the commit ACK was lost. If this fails,
    // lease expiration safely reclaims it; the transport never invents success.
    const outcome=await rpc('rpc_taxonomy_finalize_reviewed_batch_service',{
      p_outbox_id:job.id,p_lease_token:job.leaseToken,p_error_code:errorCode,
    });
    if(!record(outcome)||outcome.outboxId!==job.id||
      !['COMMITTED','RETRY','REVIEW_REQUIRED'].includes(outcome.status)||
      (errorCode===null && outcome.status!=='COMMITTED'))
      throw new TaxonomyWorkerProtocolError();
    if(outcome.status==='COMMITTED')admitted++;
    else if(outcome.status==='RETRY')retry++;
    else reviewRequired++;
  }
  return Object.freeze({kind:'CATALOG_ONLY_TICK',reconciled,claimed:rows.length,
    admitted,reviewRequired,retry,
    capabilityAuthority:'NONE',needRevisionAuthority:'NONE',notificationAuthority:'NONE'});
}
