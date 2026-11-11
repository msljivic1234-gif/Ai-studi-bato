/** Internal bounded worker. Starting closure requires the separate owned reviewed SQL command. */
import {bounded,json,parseJSON,preflight,row,only,uuid} from '../_shared/data-export.ts';
import {ClosureRejected,executeClosureStep} from './closure.ts';
declare const Deno:{env:{get(name:string):string|undefined};serve(handler:(request:Request)=>Promise<Response>):void};
Deno.serve(async req=>{
 const early=preflight(req);if(early)return early;
 return bounded(req,async(t,signal)=>{
  if(!t.isInternal())return json({code:'SERVICE_ROLE_REQUIRED'},403);
  if(Deno.env.get('USKOCI_ACCOUNT_CLOSURE_WORKER_ENABLED')!=='true')return json({kind:'DISABLED'});
  const input=row(await parseJSON(req.body,2048,signal));
  if(input?.action==='maintenance'){
   if(!only(input,['action','maxSteps'])||!Number.isInteger(input.maxSteps)||Number(input.maxSteps)<1||Number(input.maxSteps)>8)return json({code:'CLOSURE_INPUT_INVALID'},400);
   const jobs=await t.rpc('rpc_list_account_closure_work_service',{p_limit:input.maxSteps},true);
   if(signal.aborted||!Array.isArray(jobs)||jobs.length>Number(input.maxSteps))return json({code:'CLOSURE_NOT_AVAILABLE'},409);
   const seen=new Set<string>();for(const item of jobs){const j=row(item);if(!j||!only(j,['accountId','generation'])||!uuid(j.accountId)||!uuid(j.generation)||seen.has(j.accountId))return json({code:'CLOSURE_RESPONSE_INVALID'},502);seen.add(j.accountId);}
   const result={kind:'MAINTENANCE_CHECKED',checked:0,verified:0,pending:0,closed:0,blocked:0};
   for(const item of jobs){if(signal.aborted)break;const j=row(item)!;try{
    const value=await executeClosureStep(t,String(j.accountId),String(j.generation));result.checked++;
    if(value.kind==='STEP_VERIFIED')result.verified++;else if(value.state==='CLOSED')result.closed++;else result.pending++;
   }catch{result.blocked++;}}
   return json(result);
  }
  if(!input||!only(input,['accountId','generation'])||!uuid(input.accountId)||!uuid(input.generation))return json({code:'CLOSURE_INPUT_INVALID'},400);
  try{return json(await executeClosureStep(t,input.accountId,input.generation));}
  catch(e){return json({code:e instanceof ClosureRejected?e.code:'CLOSURE_NOT_AVAILABLE'},409);}
 });
});
