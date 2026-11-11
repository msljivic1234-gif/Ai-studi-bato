import { failure, readReceipt, record, sameId, timestamp, uuid, type ReceiptAccount } from './serverReceipt';
import { agreementPayloadHash } from '../ui/agreements/agreementActionsModel';
export type GroupMember={accountId:string;profileId:string;displayName:string;role:'REQUESTER'|'PARTICIPANT'};
export type GroupManagement={agreementId:string;accountId:string;status:'CONFIRMED'|'COMPLETED'|'CANCELLED';executionState:'CONFIRMED'|'AWAITING_REQUESTER'|'COMPLETED'|'CANCELLED'|null;problemOpened:boolean};
export type GroupContext={accountId:string;agreementId:string;needId:string;available:boolean;authoritative:true;
 group:null|{groupId:string;title:string;canSend:boolean;terminal:boolean;role:'REQUESTER'|'PARTICIPANT';members:GroupMember[];
 management:GroupManagement[]|null;managementNextId:string|null;unreadCount:number}};
export type GroupMessage={messageId:string;sequence:string;senderAccountId:string;body:string;createdAt:string;mine:boolean};
export type GroupPage={accountId:string;groupId:string;messages:GroupMessage[];nextBeforeSequence:string|null;nextAfterSequence:string|null;authoritative:true};
export type GroupJournal={version:1;groupId:string;clientRequestId:string;bodySha256:string};
export type GroupReceipt={accountId:string;groupId:string;clientRequestId:string;messageId:string;sequence:string;bodySha256:string;createdAt:string;idempotentReplay:boolean;authoritative:true};
const keys=(r:Record<string,unknown>,names:string[])=>Object.keys(r).length===names.length&&names.every(k=>Object.hasOwn(r,k));
const integer=(n:unknown)=>typeof n==='number'&&Number.isSafeInteger(n)&&n>=0;
const groupSequence=(s:unknown,zero=false):s is string=>typeof s==='string'&&(zero?/^(0|[1-9][0-9]{0,15})$/:/^[1-9][0-9]{0,15}$/).test(s)&&Number(s)<=9007199254740990;
export const groupBody=(s:unknown):s is string=>typeof s==='string'&&s===s.trim()&&Array.from(s).length>=1&&Array.from(s).length<=2000;
export const normalizeGroupBody=(s:string)=>s.trim().normalize('NFC');
export const groupBodyHash=(s:string)=>agreementPayloadHash(normalizeGroupBody(s));
export function parseGroupJournal(raw:string):GroupJournal{
 if(raw.length>512)throw new Error('GROUP_JOURNAL_INVALID');const j=record(JSON.parse(raw));
 if(!j||!keys(j,['version','groupId','clientRequestId','bodySha256'])||j.version!==1||!uuid(j.groupId)||!uuid(j.clientRequestId)
 ||typeof j.bodySha256!=='string'||!/^[a-f0-9]{64}$/.test(j.bodySha256))throw new Error('GROUP_JOURNAL_INVALID');return j as GroupJournal;
}
const options={errors:{AUTH_CONTEXT_CHANGED:'Nalog je promenjen.',GROUP_NOT_AVAILABLE:'Grupni razgovor nije dostupan.',
 GROUP_READ_ONLY:'Nove poruke trenutno nisu dostupne. Ranije dostupne poruke možeš pročitati.',GROUP_MESSAGE_INVALID:'Poruka može imati do 2.000 znakova.',
 GROUP_MESSAGE_KEY_REUSED:'Tekst se razlikuje od poslate poruke. Upiši istu poruku, bez izmena.',GROUP_CURSOR_INVALID:'Ponovo osveži razgovor.',ACCOUNT_CLOSING:'Nalog je u postupku zatvaranja.'},
 fallback:'GROUP_UNCONFIRMED',invalid:'GROUP_RECEIPT_INVALID'};
function envelope(r:Record<string,unknown>|null,account:ReceiptAccount,groupId?:string){return !!r&&sameId(r.accountId,account.accountId)&&r.authoritative===true&&(!groupId||sameId(r.groupId,groupId));}
function decodeReceipt(raw:unknown,j:GroupJournal,account:ReceiptAccount):GroupReceipt|null{
 const r=record(raw);if(!envelope(r,account,j.groupId)||!r||!keys(r,['accountId','groupId','clientRequestId','messageId','sequence','bodySha256','createdAt','idempotentReplay','authoritative'])
 ||!sameId(r.clientRequestId,j.clientRequestId)||!uuid(r.messageId)||!groupSequence(r.sequence)||r.bodySha256!==j.bodySha256||!timestamp(r.createdAt)||typeof r.idempotentReplay!=='boolean')return null;
 return r as GroupReceipt;
}
export const groupConversationService={
 context(agreementId:string,account:ReceiptAccount,managementAfterId:string|null=null){
  account={...account};
  if(!uuid(agreementId)||(managementAfterId!==null&&!uuid(managementAfterId)))return Promise.resolve(failure('GROUP_NOT_AVAILABLE','Razgovor nije dostupan.'));
  return readReceipt<GroupContext>({...options,readTransportUnavailable:'GROUP_CONTEXT_TRANSPORT_UNAVAILABLE',account,rpc:'rpc_read_group_context_v5',args:{p_expected_user_id:account.accountId,p_agreement_id:agreementId,p_management_after_id:managementAfterId},decode:raw=>{
   const r=record(raw);if(!envelope(r,account)||!r||!keys(r,['accountId','agreementId','needId','available','group','authoritative'])||!sameId(r.agreementId,agreementId)||!uuid(r.needId)||typeof r.available!=='boolean')return null;
   if(!r.available)return r.group===null?r as GroupContext:null;
   const g=record(r.group);if(!g||!keys(g,['groupId','title','canSend','terminal','role','members','management','managementNextId','unreadCount'])||!uuid(g.groupId)
    ||typeof g.title!=='string'||!g.title.trim()||typeof g.canSend!=='boolean'||typeof g.terminal!=='boolean'||(g.terminal&&g.canSend)
    ||!['REQUESTER','PARTICIPANT'].includes(g.role as string)||!Array.isArray(g.members)||g.members.length>51||!integer(g.unreadCount))return null;
   const memberIds=new Set<string>();for(const value of g.members){const m=record(value);if(!m||!keys(m,['accountId','profileId','displayName','role'])||!uuid(m.accountId)||!uuid(m.profileId)
    ||typeof m.displayName!=='string'||!m.displayName.trim()||!['REQUESTER','PARTICIPANT'].includes(m.role as string)||memberIds.has(m.accountId.toLowerCase()))return null;memberIds.add(m.accountId.toLowerCase());}
   if(g.role==='PARTICIPANT'){if(g.management!==null||g.managementNextId!==null)return null;}
   else {if(!Array.isArray(g.management)||g.management.length>50||(g.managementNextId!==null&&!uuid(g.managementNextId)))return null;
    const ids=new Set<string>();for(const value of g.management){const m=record(value);if(!m||!keys(m,['agreementId','accountId','status','executionState','problemOpened'])||!uuid(m.agreementId)||!uuid(m.accountId)
     ||!['CONFIRMED','COMPLETED','CANCELLED'].includes(m.status as string)||!(m.executionState===null||['CONFIRMED','AWAITING_REQUESTER','COMPLETED','CANCELLED'].includes(m.executionState as string))
     ||typeof m.problemOpened!=='boolean'||ids.has(m.agreementId))return null;ids.add(m.agreementId);}
    if(g.managementNextId!==null&&(g.management.length!==50||!ids.has(g.managementNextId as string)))return null;
   }return r as GroupContext;
  }});
 },
 messages(groupId:string,account:ReceiptAccount,cursor:{after?:string;before?:string}={}){
  account={...account};
  if(!uuid(groupId)||(cursor.after!==undefined&&(!groupSequence(cursor.after,true)||cursor.before!==undefined))||(cursor.before!==undefined&&!groupSequence(cursor.before)))
   return Promise.resolve(failure('GROUP_CURSOR_INVALID','Osveži razgovor.'));
  const after=cursor.after??null,before=cursor.before??null;
  return readReceipt<GroupPage>({...options,readTransportUnavailable:'GROUP_PAGE_TRANSPORT_UNAVAILABLE',account,rpc:'rpc_read_group_messages_v5',args:{p_expected_user_id:account.accountId,p_group_id:groupId,p_after_sequence:after,p_before_sequence:before},decode:raw=>{
   const r=record(raw);if(!envelope(r,account,groupId)||!r||!keys(r,['accountId','groupId','messages','nextBeforeSequence','nextAfterSequence','authoritative'])||!Array.isArray(r.messages)||r.messages.length>50)return null;
   let last=0;const ids=new Set<string>();for(const value of r.messages){const m=record(value);if(!m||!keys(m,['messageId','sequence','senderAccountId','body','createdAt','mine'])||!uuid(m.messageId)||!uuid(m.senderAccountId)
    ||!groupSequence(m.sequence)||!groupBody(m.body)||!timestamp(m.createdAt)||typeof m.mine!=='boolean'||m.mine!==sameId(m.senderAccountId,account.accountId)||ids.has(m.messageId)
    ||Number(m.sequence)<=last||(after!==null&&Number(m.sequence)<=Number(after))||(before!==null&&Number(m.sequence)>=Number(before)))return null;ids.add(m.messageId);last=Number(m.sequence);}
   for(const field of ['nextBeforeSequence','nextAfterSequence'])if(r[field]!==null&&!groupSequence(r[field]))return null;
   if(r.messages.length===0){if(r.nextBeforeSequence!==null||r.nextAfterSequence!==null)return null;}
   else if((r.nextBeforeSequence!==null&&r.nextBeforeSequence!==(r.messages[0] as GroupMessage).sequence)
    ||(r.nextAfterSequence!==null&&r.nextAfterSequence!==(r.messages.at(-1) as GroupMessage).sequence))return null;
   return r as GroupPage;
  }});
 },
 recover(j:GroupJournal,account:ReceiptAccount){j={...j};account={...account};return readReceipt<{found:boolean;receipt:GroupReceipt|null}>({...options,account,rpc:'rpc_read_group_command_v5',
  args:{p_expected_user_id:account.accountId,p_group_id:j.groupId,p_client_request_id:j.clientRequestId},decode:raw=>{const r=record(raw);
   if(!envelope(r,account,j.groupId)||!r||!keys(r,['accountId','groupId','clientRequestId','found','receipt','authoritative'])||!sameId(r.clientRequestId,j.clientRequestId)||typeof r.found!=='boolean')return null;
   if(!r.found)return r.receipt===null?{found:false,receipt:null}:null;const receipt=decodeReceipt(r.receipt,j,account);return receipt?{found:true,receipt}:null;
  }});},
 send(j:GroupJournal,body:string,account:ReceiptAccount){
  j={...j};account={...account};
  if(!groupBody(body)||groupBodyHash(body)!==j.bodySha256)return Promise.resolve(failure('GROUP_MESSAGE_KEY_REUSED','Tekst se razlikuje od poslate poruke. Upiši istu poruku, bez izmena.'));
  return readReceipt<GroupReceipt>({...options,account,write:true,rpc:'rpc_send_group_message_v5',args:{p_expected_user_id:account.accountId,p_group_id:j.groupId,p_client_request_id:j.clientRequestId,p_body:body},decode:raw=>decodeReceipt(raw,j,account)});
 },
 markRead(groupId:string,ids:string[],account:ReceiptAccount){
  ids=[...ids];account={...account};
  if(!uuid(groupId)||ids.length<1||ids.length>50||ids.some(id=>!uuid(id))||new Set(ids).size!==ids.length)return Promise.resolve(failure('GROUP_MESSAGE_INVALID','Potvrda čitanja nije dostupna.'));
  return readReceipt<{markedCount:number}>({...options,account,write:true,rpc:'rpc_mark_group_messages_read_v5',args:{p_expected_user_id:account.accountId,p_group_id:groupId,p_message_ids:[...ids]},decode:raw=>{
   const r=record(raw);return envelope(r,account,groupId)&&r&&keys(r,['accountId','groupId','markedCount','authoritative'])&&integer(r.markedCount)&&Number(r.markedCount)<=ids.length?{markedCount:r.markedCount as number}:null;
  }});
 },
};
