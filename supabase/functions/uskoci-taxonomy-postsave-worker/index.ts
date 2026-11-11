// DEV-phase-1 only, explicit false is a kill switch. Never enable in production.
const devTaxonomyFlagP1=(name:string):boolean=>{
 const setting=Deno.env.get(name);
 return setting==='true'||(setting!=='false'&&
  (Deno.env.get('SUPABASE_URL')??'').replace(/\/$/,'')==='https://leqcwgzvjsxugfgzdmth.supabase.co');
};
/** Source-only P1.7 internal catalog admission. This Edge handler is OFF by
 * default. No client-supplied review IDs, plans or beneficiary accounts.
 * Successful catalog admission never itself schedules push or grants skills.
 */
import { processTaxonomyPostSaveTick } from '../_shared/taxonomyPostSaveWorker.mjs';
import { isSupabaseServiceRequest, readSupabaseServiceKey, supabaseServiceHeaders } from '../_shared/supabaseKeys.mjs';
declare const Deno: { env: { get(name: string): string | undefined };
  serve(handler: (request: Request) => Promise<Response>): void };
type RpcArgs = Record<string, unknown>;
class Unavailable extends Error { retryable: boolean; constructor(retryable=false){
  super('TAXONOMY_INTERNAL_UNAVAILABLE');this.retryable=retryable;
} }
const json = (data:unknown,status=200)=>new Response(JSON.stringify(data),{
 status,headers:{'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
async function boundedJson(response:Response,signal:AbortSignal):Promise<unknown>{
 const maxBytes=32768;
 let reader:ReadableStreamDefaultReader<Uint8Array>|undefined;
 let rejectStopped!:(reason:Unavailable)=>void;
 const stopped=new Promise<never>((_,reject)=>{rejectStopped=reject;});
 void stopped.catch(()=>undefined);
 const stop=()=>rejectStopped(new Unavailable(true));
 signal.addEventListener('abort',stop,{once:true});
 try{
  if(signal.aborted)throw new Unavailable(true);
  const declared=response.headers.get('content-length');
  if(declared!==null&&(!/^\d+$/.test(declared)||!Number.isSafeInteger(Number(declared))||Number(declared)>maxBytes))
    throw new Unavailable(true);
  if(!response.body)throw new Unavailable(true);
  reader=response.body.getReader();
  let size=0,body='';const decoder=new TextDecoder('utf-8',{fatal:true});
  for(;;){
   if(signal.aborted)throw new Unavailable(true);
   // The one tick deadline also owns a body which does not react to Fetch abort.
   const part=await Promise.race([reader.read(),stopped]);
   if(signal.aborted)throw new Unavailable(true);
   if(part.done)break;
   size+=part.value.byteLength;
   if(size>maxBytes)throw new Unavailable(true);
   body+=decoder.decode(part.value,{stream:true});
  }
  body+=decoder.decode();
  const encoding=response.headers.get('content-encoding')?.trim().toLowerCase();
  if((!encoding||encoding==='identity')&&declared!==null&&Number(declared)!==size)
    throw new Unavailable(true);
  try{return JSON.parse(body);}catch{throw new Unavailable(true);}
 }catch{
  // A failed body stream or invalid UTF-8 is an uncertain transport receipt,
  // not a semantic rejection of the already signed review. Reuse its job key.
  throw new Unavailable(true);
 }finally{
  signal.removeEventListener('abort',stop);
  // Cancel header-rejected bodies too; cleanup must never extend the deadline.
  try{void (reader?reader.cancel():response.body?.cancel())?.catch(()=>undefined);}catch{/* best effort */}
 }
}
let running=false;
Deno.serve(async request=>{
 if(request.method!=='POST')return json({code:'METHOD_NOT_ALLOWED'},405);
 const secret=readSupabaseServiceKey(name=>Deno.env.get(name));
 if(!secret||secret.length<24||!isSupabaseServiceRequest(request.headers,name=>Deno.env.get(name)))return json({code:'FORBIDDEN'},403);
 // Separate, double-gated release: default OFF even if deployed accidentally.
 if(!devTaxonomyFlagP1('USKOCI_TAXONOMY_POSTSAVE_WORKER_ENABLED')||
   !devTaxonomyFlagP1('USKOCI_TAXONOMY_CATALOG_ONLY_ACK'))
   return json({kind:'DISABLED'});
 if(running)return json({kind:'BUSY'},429);
 const rawUrl=Deno.env.get('SUPABASE_URL');
 if(!rawUrl)return json({code:'INTERNAL_UNAVAILABLE'},503);
 let origin:string;
 try{
  const base=new URL(rawUrl);
  if(base.protocol!=='https:'||!/^[a-z0-9-]+\.supabase\.co$/.test(base.hostname)||
    base.username||base.password||base.port||base.pathname!=='/'||base.search||base.hash)
      throw new Unavailable();
  origin=base.origin;
 }catch{return json({code:'INTERNAL_UNAVAILABLE'},503);}
 running=true;
 const controller=new AbortController();
 const cancel=()=>controller.abort();
 request.signal.addEventListener('abort',cancel,{once:true});
 if(request.signal.aborted)cancel();
 const timeout=setTimeout(cancel,24000);
 try{
  const rpc=async(name:string,args:RpcArgs)=>{
   if(![
    'rpc_taxonomy_reconcile_reviewed_outbox_service',
    'rpc_taxonomy_claim_reviewed_batches_service',
    'rpc_taxonomy_commit_reviewed_batch_service',
    'rpc_taxonomy_finalize_reviewed_batch_service',
    'rpc_taxonomy_bind_ready_reviews_service',
   ].includes(name))throw new Unavailable();
   if(controller.signal.aborted)throw new Unavailable(true);
   let response:Response;
   try{
    response=await fetch(origin+'/rest/v1/rpc/'+name,{
     method:'POST',redirect:'error',signal:controller.signal,
     headers:supabaseServiceHeaders(secret,{'Content-Type':'application/json'}),
     body:JSON.stringify(args),
    });
   }catch{throw new Unavailable(true);}
   if(!response.ok){
    void response.body?.cancel().catch(()=>undefined);
    throw new Unavailable(response.status===408||response.status===429||response.status>=500);
   }
   return boundedJson(response,controller.signal);
  };
  const result=await processTaxonomyPostSaveTick(rpc,{limit:3,reconcileLimit:25});
  // Binding is a SEPARATE, third feature gate. The catalog COMMITTED receipt
  // does not authorize eligibility; each binder independently checks owner,
  // immutable Save, digest and current revision under a DB transaction.
  // Catalog-only mode preserves its exact legacy response contract.
  if(!devTaxonomyFlagP1('USKOCI_TAXONOMY_BINDING_ENABLED'))
    return json(result);
  const binding=await rpc('rpc_taxonomy_bind_ready_reviews_service',{p_limit:3});
  if(!binding||typeof binding!=='object'||Array.isArray(binding))throw new Unavailable();
  const b=binding as Record<string,unknown>;
  const validCount=(x:unknown)=>Number.isInteger(x)&&Number(x)>=0&&Number(x)<=3;
  if(!['BINDING_ONLY_TICK','BINDING_DISABLED'].includes(String(b.kind))
    ||!validCount(b.claimed)||!validCount(b.bound)||!validCount(b.retry)
    ||!validCount(b.reviewRequired)
    ||Number(b.bound)+Number(b.retry)+Number(b.reviewRequired)!==Number(b.claimed)
    ||b.dispatchAuthority!=='NONE'||b.notificationAuthority!=='NONE')
    throw new Unavailable();
  return json({...result,kind:'CATALOG_AND_BINDING_TICK',
    binding:{kind:b.kind,claimed:b.claimed,bound:b.bound,
      retry:b.retry,reviewRequired:b.reviewRequired},
    dispatchAuthority:'NONE',notificationAuthority:'NONE'});
 }catch{
  // Never log taxonomy plans, account IDs, token, task text or API details.
  return json({code:'TAXONOMY_INTERNAL_UNAVAILABLE'},503);
 }finally{
  clearTimeout(timeout);request.signal.removeEventListener('abort',cancel);
  controller.abort();running=false;
 }
});
