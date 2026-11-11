import type { Ishod } from './ports';
import { sesijaSada } from '../store/sesija';
import { supabaseKlijent } from './supabaseClient';
import { failure,readOwnedResult,record,sameId,timestamp,uuid,type ReceiptAccount } from './serverReceipt';
export const closureClassLabels:Readonly<Record<string,string>>={ACCOUNT_IDENTITY:'Nalog i identitet',PROFILE_DATA:'Podaci profila',NEED_PUBLIC:'Javni podaci zadatka',NEED_SENSITIVE:'Privatni podaci zadatka',RESPONSES_SELECTION:'Prijave i izbor',PRESELECTION_QA:'Pitanja pre Dogovora',AGREEMENT_CORE:'Dogovori',AGREEMENT_MESSAGES:'Poruke u Dogovoru',LEGAL_CONSENT:'Prihvatanje uslova',NOTIFICATION_DELIVERY:'Obaveštenja',AI_VOLATILE:'AI razgovori',MEDIA_OBJECTS:'Evidencija fotografija',COMMAND_LEDGERS:'Potvrde radnji',AUDIT_SECURITY_LOGS:'Aktivnosti i bezbednost',AGREEMENT_REVIEWS:'Ocene saradnje'};
export const closureBlockerLabels:Readonly<Record<string,string>>={ACTIVE_AGREEMENT:'Najpre završi aktivne Dogovore.',OPEN_TASK:'Najpre zatvori otvorene zadatke.',ACTIVE_APPLICATION:'Najpre povuci ili završi aktivne prijave.',PENDING_WORKFLOW:'Sačekaj završetak započete obrade.',RETENTION_HOLD:'Nalog ima aktivno zadržavanje podataka koje sprečava zatvaranje.',STORAGE_PRODUCER_UNSETTLED:'Ishod ranijeg slanja datoteke još nije potvrđen.',MEDIA_UPLOAD_PENDING:'Ishod slanja fotografije još nije potvrđen.',STORAGE_INVENTORY_UNSUPPORTED:'Datoteke ovog naloga zahtevaju dodatnu proveru pre zatvaranja.',MEDIA_EVIDENCE_POLICY_NOT_READY:'Za zaštićene podatke još nije odobreno pravilo čuvanja.'};
export const erasureExceptionLabels:Readonly<Record<string,string>>={SCOPED_EVIDENCE_REVIEW_REQUIRED:'Izdvojeni predmet ili dokaz zahteva zasebno rešavanje.',MEDIA_EVIDENCE_REVIEW_REQUIRED:'Zaštićena fotografija ili njena veza sa dokazom još zahteva proveru.',HISTORY_ATTRIBUTION_REVIEW_REQUIRED:'Izvor dela zajedničke istorije zahteva proveru.',SHARED_DECISION_REVIEW_REQUIRED:'Odluka koju koristi i drugi nalog još zahteva proveru.'};
export const erasureAdapter='OWNER_AF_D22_EVENT_ERASURE_V1' as const;
const errors:Readonly<Record<string,string>>={AUTH_CONTEXT_CHANGED:'Nalog je promenjen. Ponovo otvori privatnost.',CLOSURE_INPUT_INVALID:'Pregled zahteva nije potpun.',CLOSURE_REVISION_CONFLICT:'Stanje se promenilo. Otvori aktuelni pregled.',CLOSURE_POLICY_NOT_READY:'Potpuna pravila zatvaranja i čuvanja još nisu objavljena.',CLOSURE_POLICY_CHANGED:'Pravila su promenjena. Potreban je novi pregled.',CLOSURE_BLOCKED:'Najpre reši prikazane obaveze.',ACCOUNT_CLOSING:'Zatvaranje naloga je već pokrenuto.',REQUEST_ID_REUSED:'Proveri potvrdu istog zahteva.'};
export type RetainedClosureDataset={dataClass:string;action:'RETAIN_RESTRICTED';retentionSeconds:number;trigger:'CLOSURE_REQUESTED';ruleSha256:string};
export type ClosureExecutionReview={accountId:string;requestId:string|null;revision:number;ready:boolean;policySha256:string|null;blockers:string[];code:string|null;retainedDatasets:RetainedClosureDataset[]|null;adapterVersion?:typeof erasureAdapter;exceptions?:string[];authoritative:true};
export type ClosureStartIntent={kind:'START';accountId:string;requestId:string;expectedRevision:number;clientRequestId:string;policySha256:string};
export type ClosureExecutionState={accountId:string;requestId:string;generation:string;state:'EXECUTING'|'CLOSED';policySha256:string;authoritative:true;closedAt?:string;retainedDatasets?:RetainedClosureDataset[];adapterVersion?:typeof erasureAdapter;ordinaryContentErased?:boolean;completedSteps?:number;totalSteps?:number;exceptions?:string[];pseudonymousAuditRetained?:true};
export type ClosureStartReceipt=ClosureExecutionState&{state:'EXECUTING';clientRequestId:string;idempotentReplay:boolean};
const hash=(v:unknown):v is string=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
const revision=(v:unknown):v is number=>Number.isInteger(v)&&Number(v)>=0&&Number(v)<2147483647;
const only=(r:Record<string,unknown>,keys:string[])=>Object.keys(r).every(k=>keys.includes(k));
function exceptions(raw:unknown):string[]|null{return Array.isArray(raw)&&raw.length<=Object.keys(erasureExceptionLabels).length&&new Set(raw).size===raw.length&&raw.every(x=>typeof x==='string'&&Object.hasOwn(erasureExceptionLabels,x))?[...raw]:null;}
export function retainedDatasets(value:unknown):RetainedClosureDataset[]|null{
 if(!Array.isArray(value)||value.length!==Object.keys(closureClassLabels).length)return null;const seen=new Set<string>();
 for(const raw of value){const d=record(raw);if(!d||!only(d,['dataClass','action','retentionSeconds','trigger','ruleSha256'])||typeof d.dataClass!=='string'||!closureClassLabels[d.dataClass]||seen.has(d.dataClass)||d.action!=='RETAIN_RESTRICTED'||d.trigger!=='CLOSURE_REQUESTED'||!revision(d.retentionSeconds)||d.retentionSeconds===0||!hash(d.ruleSha256))return null;seen.add(d.dataClass);}
 return value as RetainedClosureDataset[];
}
function execution(raw:unknown,a:string):ClosureExecutionState|null{
 const r=record(raw);if(!r||!sameId(r.accountId,a)||!uuid(r.requestId)||!uuid(r.generation)||!hash(r.policySha256)||r.authoritative!==true)return null;
 if(r.adapterVersion!==undefined){
  if(r.adapterVersion!==erasureAdapter)return null;const ex=exceptions(r.exceptions);if(!ex)return null;
  const base={accountId:a,requestId:r.requestId,generation:r.generation,policySha256:r.policySha256,adapterVersion:erasureAdapter,exceptions:ex,authoritative:true as const};
  if(r.state==='EXECUTING'){
   if(!only(r,['accountId','requestId','generation','state','policySha256','adapterVersion','ordinaryContentErased','completedSteps','totalSteps','exceptions','authoritative'])
    ||typeof r.ordinaryContentErased!=='boolean'||!revision(r.completedSteps)||!revision(r.totalSteps)||r.totalSteps<1||r.totalSteps>1000||r.completedSteps>r.totalSteps||r.ordinaryContentErased!==(r.completedSteps===r.totalSteps))return null;
   return {...base,state:'EXECUTING',ordinaryContentErased:r.ordinaryContentErased,completedSteps:r.completedSteps,totalSteps:r.totalSteps};
  }
  if(r.state!=='CLOSED'||!only(r,['accountId','requestId','generation','state','closedAt','policySha256','authOutcome','mediaOutcome','relationalOutcome','retainedDatasets','authoritative','adapterVersion','pseudonymousAuditRetained','exceptions'])
   ||!timestamp(r.closedAt)||r.authOutcome!=='AUTH_IDENTITY_ERASED_SUBJECT_RETAINED'||r.mediaOutcome!=='OWNED_OBJECTS_DELETED'||r.relationalOutcome!=='ORDINARY_PERSONAL_CONTENT_ERASED'||r.pseudonymousAuditRetained!==true||!Array.isArray(r.retainedDatasets)||r.retainedDatasets.length!==0||ex.length!==0)return null;
  return {...base,state:'CLOSED',closedAt:r.closedAt,retainedDatasets:[],ordinaryContentErased:true,pseudonymousAuditRetained:true};
 }
 if(r.state==='EXECUTING')return {accountId:a,requestId:r.requestId,generation:r.generation,state:'EXECUTING',policySha256:r.policySha256,authoritative:true};
 if(r.state!=='CLOSED'||!timestamp(r.closedAt)||r.authOutcome!=='AUTH_IDENTITY_ERASED_SUBJECT_RETAINED'||r.mediaOutcome!=='OWNED_OBJECTS_DELETED'||r.relationalOutcome!=='RETAINED_RESTRICTED')return null;
 const retained=retainedDatasets(r.retainedDatasets);return retained?{accountId:a,requestId:r.requestId,generation:r.generation,state:'CLOSED',policySha256:r.policySha256,closedAt:r.closedAt,retainedDatasets:retained,authoritative:true}:null;
}
function startReceipt(raw:unknown,a:string,key:string):ClosureStartReceipt|null{const r=record(raw),s=execution(raw,a);return r&&s?.state==='EXECUTING'&&sameId(r.clientRequestId,key)&&typeof r.idempotentReplay==='boolean'?{...s,state:'EXECUTING',clientRequestId:key,idempotentReplay:r.idempotentReplay}:null;}
function owner(explicit?:ReceiptAccount){const s=sesijaSada();return explicit??(s.user?{accountId:s.user.id,accountRevision:s.accountRevision}:null);}
const bad=<T>():Promise<Ishod<T>>=>Promise.resolve(failure('AUTH_REQUIRED','Prijavi se da nastaviš.'));
export const closureExecutionClientService={
 review(explicit?:ReceiptAccount):Promise<Ishod<ClosureExecutionReview>>{
  const a=owner(explicit);if(!a)return bad();return readOwnedResult({account:a,errors,fallback:'CLOSURE_READ_UNAVAILABLE',invalid:'CLOSURE_INVALID_RESPONSE',request:()=>supabaseKlijent().rpc('rpc_review_account_closure_execution',{p_expected_user_id:a.accountId}),decode:raw=>{
   const r=record(raw);if(!r||!sameId(r.accountId,a.accountId)||(r.requestId!==null&&!uuid(r.requestId))||!revision(r.revision)||typeof r.ready!=='boolean'||(r.policySha256!==null&&!hash(r.policySha256))||!Array.isArray(r.blockers)||r.blockers.some(x=>typeof x!=='string'||!closureBlockerLabels[x])||new Set(r.blockers).size!==r.blockers.length||r.authoritative!==true||r.authAction!=='AUTH_IDENTITY_ERASED_SUBJECT_RETAINED'||(r.code!==null&&!['CLOSURE_POLICY_NOT_READY','CLOSURE_PREPARATION_REQUIRED','CLOSURE_BLOCKED'].includes(String(r.code))))return null;
   const erased=r.adapterVersion===erasureAdapter,ex=erased?exceptions(r.exceptions):null;
   if(r.adapterVersion!==undefined&&!erased||erased&&(!ex||r.mediaAction!=='DELETE_UNPROTECTED_OWNED_OBJECTS'||r.relationalAction!=='ERASE_ORDINARY_PERSONAL_CONTENT'||r.retainedDatasets!==null
    ||!only(r,['accountId','requestId','revision','ready','policySha256','blockers','code','adapterVersion','retainedDatasets','exceptions','authAction','mediaAction','relationalAction','authoritative']))||!erased&&r.mediaAction!=='DELETE_OWNED_OBJECTS')return null;
   const datasets=r.retainedDatasets===null?null:retainedDatasets(r.retainedDatasets);if(r.retainedDatasets!==null&&!datasets||r.ready&&(!r.requestId||!r.policySha256||r.revision===0||r.blockers.length>0||r.code!==null||!erased&&!datasets))return null;
   return {accountId:a.accountId,requestId:r.requestId as string|null,revision:r.revision,ready:r.ready,policySha256:r.policySha256 as string|null,blockers:r.blockers as string[],code:r.code as string|null,retainedDatasets:datasets,...(erased?{adapterVersion:erasureAdapter,exceptions:ex!}:{}),authoritative:true};}});
 },
 start(intent:ClosureStartIntent,explicit?:ReceiptAccount):Promise<Ishod<ClosureStartReceipt>>{
  const a=owner(explicit);if(!a)return bad();if(!sameId(intent.accountId,a.accountId)||!uuid(intent.requestId)||!uuid(intent.clientRequestId)||!revision(intent.expectedRevision)||intent.expectedRevision===0||!hash(intent.policySha256))return Promise.resolve(failure('CLOSURE_INPUT_INVALID',errors.CLOSURE_INPUT_INVALID));
  const i={...intent};return readOwnedResult({account:a,errors,write:true,fallback:'CLOSURE_OUTCOME_UNKNOWN',invalid:'CLOSURE_INVALID_RECEIPT',request:()=>supabaseKlijent().rpc('rpc_start_account_closure_execution',{p_expected_user_id:a.accountId,p_request_id:i.requestId,p_expected_revision:i.expectedRevision,p_client_request_id:i.clientRequestId,p_policy_sha256:i.policySha256}),decode:raw=>{const r=startReceipt(raw,a.accountId,i.clientRequestId);return r&&r.requestId===i.requestId&&r.policySha256===i.policySha256?r:null;}});
 },
 read(clientRequestId:string,explicit?:ReceiptAccount):Promise<Ishod<{found:boolean;receipt:ClosureStartReceipt|null;execution:ClosureExecutionState|null}>>{
  const a=owner(explicit);if(!a)return bad();if(!uuid(clientRequestId))return Promise.resolve(failure('CLOSURE_INPUT_INVALID',errors.CLOSURE_INPUT_INVALID));
  return readOwnedResult({account:a,errors,fallback:'CLOSURE_READ_UNAVAILABLE',invalid:'CLOSURE_INVALID_RECEIPT',request:()=>supabaseKlijent().rpc('rpc_read_account_closure_execution',{p_expected_user_id:a.accountId,p_client_request_id:clientRequestId}),decode:raw=>{
   const r=record(raw);if(!r||!sameId(r.accountId,a.accountId)||!sameId(r.clientRequestId,clientRequestId)||typeof r.found!=='boolean'||r.authoritative!==true)return null;
   if(!r.found)return r.receipt===null&&r.execution===null?{found:false,receipt:null,execution:null}:null;
   const start=startReceipt(r.receipt,a.accountId,clientRequestId),state=execution(r.execution,a.accountId);return start&&state&&start.generation===state.generation&&start.requestId===state.requestId&&start.policySha256===state.policySha256?{found:true,receipt:start,execution:state}:null;}});
 }
};
