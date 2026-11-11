import type { Ishod } from './ports';
import { sesijaSada } from '../store/sesija';
import { failure, readOwnedResult, record, sameId, uuid, type ReceiptAccount } from './serverReceipt';
import { supabaseKlijent } from './supabaseClient';

// No direct Need or URL arrives from the push provider. The new RPC must verify
// OPPORTUNITY_AVAILABLE, recipient, current event/revision and the delivery.
export type ActivityOpportunityTarget =
 | Readonly<{ schema:'ACTIVITY_OPPORTUNITY_TARGET_V1'; accountId:string; authoritative:true; kind:'UNAVAILABLE' }>
 | Readonly<{ schema:'ACTIVITY_OPPORTUNITY_TARGET_V1'; accountId:string; authoritative:true; kind:'OPPORTUNITY'; eventId:string; needId:string; role:'WORKER' }>;
type Rpc=(name:string,args:Record<string,unknown>,signal:AbortSignal)=>PromiseLike<unknown>;
const exact=(value:Record<string,unknown>,fields:readonly string[])=>Object.keys(value).length===fields.length && fields.every(field=>Object.hasOwn(value,field));

export function decodeActivityOpportunityTarget(raw:unknown,accountId:string,eventId:string):ActivityOpportunityTarget|null {
 const v=record(raw);
 if (!v || !uuid(accountId) || !uuid(eventId) || v.schema!=='ACTIVITY_OPPORTUNITY_TARGET_V1'
  || !sameId(v.accountId,accountId) || v.authoritative!==true) return null;
 const envelope={schema:'ACTIVITY_OPPORTUNITY_TARGET_V1' as const,accountId:accountId.toLowerCase(),authoritative:true as const};
 if(v.kind==='UNAVAILABLE') return exact(v,['schema','accountId','authoritative','kind'])?{...envelope,kind:'UNAVAILABLE'}:null;
 if(v.kind!=='OPPORTUNITY' || !exact(v,['schema','accountId','authoritative','kind','eventId','needId','role'])
  || !sameId(v.eventId,eventId) || !uuid(v.needId) || v.role!=='WORKER') return null;
 return {...envelope,kind:'OPPORTUNITY',eventId:eventId.toLowerCase(),needId:v.needId.toLowerCase(),role:'WORKER'};
}

export function createActivityOpportunityTargetService(rpc:Rpc) {
 return {
  async resolve(eventId:string,options:{signal?:AbortSignal}={},scope?:ReceiptAccount):Promise<Ishod<ActivityOpportunityTarget>> {
   const session=sesijaSada();
   const account=scope??(session.user?{accountId:session.user.id,accountRevision:session.accountRevision}:null);
   if(!account || !uuid(account.accountId)) return failure('AUTH_REQUIRED','Prijavi se da nastaviš.');
   if(session.user?.id!==account.accountId || session.accountRevision!==account.accountRevision)
    return failure('AUTH_ACCOUNT_CHANGED','Nalog je promenjen. Ponovo otvori zadatak.');
   if(!uuid(eventId)) return failure('ACTIVITY_OPPORTUNITY_INPUT_INVALID','Obaveštenje nije dostupno.');
   if(options.signal?.aborted) return failure('ACTIVITY_OPPORTUNITY_CANCELLED','Čitanje je prekinuto.');
   const controller=new AbortController();
   let removeAbort=()=>{};
   try {
    const result=await readOwnedResult({
     account,errors:{},fallback:'ACTIVITY_OPPORTUNITY_UNCONFIRMED',invalid:'ACTIVITY_OPPORTUNITY_INVALID_RESPONSE',
     decode:raw=>decodeActivityOpportunityTarget(raw,account.accountId,eventId),
     // A blurred/closed Inbox must release its pending request immediately,
     // including a transport which ignores AbortSignal and never resolves.
     request:()=>new Promise<unknown>((resolve,reject)=>{
      const abort=()=>{controller.abort();reject(new Error('ACTIVITY_OPPORTUNITY_CANCELLED'));};
      options.signal?.addEventListener('abort',abort,{once:true});
      removeAbort=()=>options.signal?.removeEventListener('abort',abort);
      if(options.signal?.aborted){abort();return;}
      try {
       Promise.resolve(rpc('rpc_resolve_activity_opportunity_v1',
        {p_expected_user_id:account.accountId,p_event_id:eventId.toLowerCase()},controller.signal))
        .then(resolve,reject);
      } catch {reject(new Error('ACTIVITY_OPPORTUNITY_UNCONFIRMED'));}
     }),
    });
    return options.signal?.aborted ? failure('ACTIVITY_OPPORTUNITY_CANCELLED','Čitanje je prekinuto.') : result;
   } finally {removeAbort();controller.abort();}
  },
 };
}

export const activityOpportunityTargetService=createActivityOpportunityTargetService((name,args,signal)=>
 supabaseKlijent().rpc(name,args).abortSignal(signal));
