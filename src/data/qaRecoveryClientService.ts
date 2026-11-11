import type {Ishod} from './ports';
import {supabaseKlijent} from './supabaseClient';
import {sesijaSada} from '../store/sesija';
import {readOwnedResult,record,sameId,uuid,positiveInteger,failure,type ReceiptAccount} from './serverReceipt';
import type {AskQuestionReceipt,AnswerQuestionReceipt,DispositionReceipt} from '../contracts/preselectionQa';
export type QaContext={accountId:string;needId:string;needRevision:number;title:string;mode:'OWNER'|'PUBLIC';publicRevision:boolean;activeWorker:boolean;canAsk:boolean;canComposeAnswer:boolean;ratePolicyState:'NOT_READY'|'READY';questionMaxChars:number|null;answerMaxChars:number|null;authoritative:true};
export type QaRecoveredCommand={type:'ASK'|'ANSWER'|'DISPOSITION';needRevision:number;textSha256:string|null;receipt:AskQuestionReceipt|AnswerQuestionReceipt|DispositionReceipt};
const errors={AUTH_CONTEXT_CHANGED:'Nalog je promenjen. Otvori zadatak ponovo.',NEED_NOT_FOUND:'Zadatak nije dostupan ovom nalogu.',QA_INPUT_INVALID:'Ponovo otvori zadatak.',ACCOUNT_CLOSING:'Nalog je u postupku zatvaranja.',INTERACTION_BLOCKED:'Pitanja za ovaj zadatak nisu dostupna.',QA_RECEIPT_UNAVAILABLE:'Potvrda trenutno nije dostupna.'};
const hash=(x:unknown):x is string=>typeof x==='string'&&/^[a-f0-9]{64}$/.test(x);
function owner(explicit?:ReceiptAccount){const s=sesijaSada();return explicit??(s.user?{accountId:s.user.id,accountRevision:s.accountRevision}:null);}
const invalid=<T>():Promise<Ishod<T>>=>Promise.resolve(failure('QA_INPUT_INVALID',errors.QA_INPUT_INVALID));
export const qaRecoveryClientService={
 context(needId:string,explicit?:ReceiptAccount):Promise<Ishod<QaContext>>{
  const a=owner(explicit);if(!a||!uuid(needId))return invalid();return readOwnedResult({account:a,errors,fallback:'QA_CONTEXT_UNAVAILABLE',invalid:'QA_CONTEXT_INVALID',request:()=>supabaseKlijent().rpc('rpc_read_preselection_qa_context',{p_expected_user_id:a.accountId,p_need_id:needId}),decode:raw=>{
   const r=record(raw);if(!r||!sameId(r.accountId,a.accountId)||!sameId(r.needId,needId)||!positiveInteger(r.needRevision)||typeof r.title!=='string'||!['OWNER','PUBLIC'].includes(String(r.mode))||['publicRevision','activeWorker','canAsk','canComposeAnswer'].some(k=>typeof r[k]!=='boolean')||!['NOT_READY','READY'].includes(String(r.ratePolicyState))||(r.questionMaxChars!==null&&!positiveInteger(r.questionMaxChars))||(r.answerMaxChars!==null&&!positiveInteger(r.answerMaxChars))||r.contentDecision!=='EXACT_SERVER_DECISION_REQUIRED'||r.authoritative!==true)return null;
   if(r.canAsk&&(r.mode!=='PUBLIC'||!r.publicRevision||!r.activeWorker||r.ratePolicyState!=='READY'||r.questionMaxChars===null))return null;
   if(r.canComposeAnswer&&(r.mode!=='OWNER'||!r.publicRevision))return null;
   if(r.ratePolicyState==='NOT_READY'&&r.ratePolicyCode!=='RU4B_RATE_POLICY_NOT_READY')return null;
   return {accountId:a.accountId,needId,needRevision:r.needRevision,title:r.title,mode:r.mode as QaContext['mode'],publicRevision:r.publicRevision as boolean,activeWorker:r.activeWorker as boolean,canAsk:r.canAsk as boolean,canComposeAnswer:r.canComposeAnswer as boolean,ratePolicyState:r.ratePolicyState as QaContext['ratePolicyState'],questionMaxChars:r.questionMaxChars as number|null,answerMaxChars:r.answerMaxChars as number|null,authoritative:true};}});
 },
 read(needId:string,clientRequestId:string,explicit?:ReceiptAccount):Promise<Ishod<{found:boolean;command:QaRecoveredCommand|null}>>{
  const a=owner(explicit);if(!a||!uuid(needId)||!uuid(clientRequestId))return invalid();return readOwnedResult({account:a,errors,fallback:'QA_RECEIPT_UNAVAILABLE',invalid:'QA_RECEIPT_INVALID',request:()=>supabaseKlijent().rpc('rpc_read_preselection_qa_command',{p_expected_user_id:a.accountId,p_need_id:needId,p_client_request_id:clientRequestId}),decode:raw=>{
   const r=record(raw);if(!r||!sameId(r.accountId,a.accountId)||!sameId(r.needId,needId)||!sameId(r.clientRequestId,clientRequestId)||typeof r.found!=='boolean'||r.authoritative!==true)return null;
   if(!r.found)return r.command===null?{found:false,command:null}:null;
   const c=record(r.command),receipt=record(c?.receipt);if(!c||!receipt||!positiveInteger(c.needRevision)||!uuid(receipt.questionId)||receipt.idempotentReplay!==true)return null;
   let value:QaRecoveredCommand['receipt'];
   if(c.type==='ASK'&&receipt.status==='PENDING_ANSWER'&&receipt.needRevision===c.needRevision&&hash(c.textSha256))value={questionId:receipt.questionId,status:'PENDING_ANSWER',needRevision:c.needRevision,idempotentReplay:true};
   else if(c.type==='ANSWER'&&receipt.status==='ANSWERED_PUBLIC'&&positiveInteger(receipt.answerVersion)&&receipt.edited===(receipt.answerVersion>1)&&hash(c.textSha256))value={questionId:receipt.questionId,status:'ANSWERED_PUBLIC',answerVersion:receipt.answerVersion,edited:receipt.edited as boolean,idempotentReplay:true};
   else if(c.type==='DISPOSITION'&&['IGNORED','REPORTED'].includes(String(receipt.status))&&c.textSha256===null)value={questionId:receipt.questionId,status:receipt.status as 'IGNORED'|'REPORTED',idempotentReplay:true};
   else return null;
   return {found:true,command:{type:c.type as QaRecoveredCommand['type'],needRevision:c.needRevision,textSha256:c.textSha256 as string|null,receipt:value}};}});
 }
};
