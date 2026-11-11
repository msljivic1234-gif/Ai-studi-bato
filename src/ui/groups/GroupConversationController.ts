import { groupConversationService, parseGroupJournal, groupBody, groupBodyHash, normalizeGroupBody,
 type GroupContext, type GroupJournal, type GroupMessage, type GroupReceipt } from '../../data/groupConversationService';
import { uuid } from '../../data/serverReceipt';
import type { ReceiptAccount } from '../../data/serverReceipt';
import { noviUuidZahtevId } from '../../lib/idempotencija';
export type GroupState={phase:'LOADING'|'READY'|'SENDING'|'UNKNOWN'|'CONFIRMED'|'ERROR';context:GroupContext|null;messages:GroupMessage[];
 before:string|null;olderPageUnavailable:boolean;journal:GroupJournal|null;receipt:GroupReceipt|null;canRetry:boolean;message:string|null;syncUnavailable?:boolean;targetMessageId?:string};
export const initialGroupState:GroupState={phase:'LOADING',context:null,messages:[],before:null,olderPageUnavailable:false,journal:null,receipt:null,canRetry:false,message:null};
export class GroupConversationController{
 private state:GroupState={...initialGroupState};private busy=false;private disposed=false;private journalLoaded=false;private inMemoryBody:string|null=null;private listeners=new Set<()=>void>();
 private operationRevision=0;private marking=false;private visible:{groupId:string;ids:string[]}|null=null;
 private syncing=false;private syncHasMore=false;private targetPending=true;
 readonly key:string;
 constructor(private deps:{agreementId:string;initialTarget?:{groupId:string;messageId:string;sequence:string};account:ReceiptAccount;current:()=>boolean;storage:{getItem(k:string):Promise<string|null>;setItem(k:string,v:string):Promise<unknown>;removeItem(k:string):Promise<unknown>};
 service?:typeof groupConversationService;uuid?:()=>string}){this.key=`uskoci:group-message:v5:${deps.account.accountId}:${deps.agreementId}`;}
 private get service(){return this.deps.service??groupConversationService;}
 private current=()=>!this.disposed&&this.deps.current();snapshot=()=>this.state;
 subscribe=(fn:()=>void)=>{this.listeners.add(fn);return()=>{this.listeners.delete(fn);};};
 dispose=()=>{this.disposed=true;this.inMemoryBody=null;this.visible=null;this.state={...initialGroupState};this.listeners.clear();};
 private update(patch:Partial<GroupState>){if(!this.current())return;this.state={...this.state,...patch};this.listeners.forEach(fn=>fn());}
 private async run(fn:()=>Promise<void>){if(this.busy||!this.current())return;this.busy=true;this.operationRevision++;try{await fn();}
 catch{this.update({phase:this.state.journal?'UNKNOWN':'ERROR',canRetry:false,message:'Provera još nije završena. Osveži razgovor.'});}finally{this.busy=false;void this.flushVisible();}}
 load=()=>this.run(async()=>{
  this.journalLoaded=false;this.update({...initialGroupState});const raw=await this.deps.storage.getItem(this.key);if(!this.current())return;
  const journal=raw===null?null:parseGroupJournal(raw);this.journalLoaded=true;this.update({journal});
  if(!await this.context())return;
  if(journal){if(journal.groupId!==this.state.context?.group?.groupId){this.update({phase:'ERROR',message:'Sačuvani zahtev ne pripada ovom razgovoru.'});return;}await this.recover();}
  else await this.page();
 });
 private async context(accept:()=>boolean=()=>true,keepManagement=false){
  const previous=this.state.context;
  const result=await this.service.context(this.deps.agreementId,this.deps.account);if(!this.current()||!accept())return false;
  if(!result.ok){this.update({phase:this.state.journal?'UNKNOWN':'ERROR',context:null,messages:[],before:null,canRetry:false,message:result.poruka});return false;}
  if(this.state.journal&&this.state.journal.groupId!==result.podatak.group?.groupId){
   this.update({phase:'ERROR',context:null,messages:[],before:null,canRetry:false,message:'Sačuvani zahtev ne pripada ovom razgovoru.'});return false;
  }
  let next=result.podatak;
  const old=previous?.group,fresh=next.group;
  // A read ACK refreshes authority/roster/unread, not the person's pagination choice. Keep the
  // explicitly loaded tail as its last-read snapshot, just as managementNext does. An explicit
  // refresh still replaces it. Cancelled bilateral agreements remain valid requester targets.
  if(keepManagement&&previous?.accountId===next.accountId&&previous.agreementId===next.agreementId&&previous.needId===next.needId
   &&old?.groupId===fresh?.groupId&&old?.role==='REQUESTER'&&fresh?.role==='REQUESTER'
   &&old.management&&old.management.length>50&&fresh.management&&fresh.managementNextId){
   const boundary=fresh.managementNextId.toLowerCase(),seen=new Set(fresh.management.map(row=>row.agreementId.toLowerCase()));
   const tail=old.management.filter(row=>row.agreementId.toLowerCase()>boundary&&!seen.has(row.agreementId.toLowerCase()));
   if(tail.length)next={...next,group:{...fresh,management:[...fresh.management,...tail],managementNextId:old.managementNextId}};
  }
  this.update({context:next,...(!next.group?{messages:[],before:null}:{})});return true;
 }
 private async page(before?:string){const context=this.state.context,group=context?.group;if(!group){this.update({phase:'READY'});return;}
  let result:Awaited<ReturnType<typeof groupConversationService.messages>>;
  const target=!before&&this.targetPending?this.deps.initialTarget:undefined;
  if(target&&(!uuid(target.messageId)||!uuid(target.groupId)||target.groupId!==group.groupId
    ||!/^[1-9][0-9]{0,15}$/.test(target.sequence)||Number(target.sequence)>9007199254740990)){
    this.update({phase:'ERROR',messages:[],message:'Izabrana poruka nije dostupna. Osveži razgovor.'});return;
  }
  try{result=await this.service.messages(group.groupId,this.deps.account,before?{before}:target?{after:String(Number(target.sequence)-1)}:{});}
  catch{this.visible=null;this.update({phase:'ERROR',context:null,messages:[],before:null,olderPageUnavailable:false,message:'Razgovor nije učitan. Pokušaj ponovo.'});return;}
  if(!this.current())return;
  if(!result.ok){
   this.visible=null;
   // Only an older page's proven transport failure may keep this owned in-memory history. No fresh-send or read-mark permission.
   const retain=!!before&&result.kod==='GROUP_PAGE_TRANSPORT_UNAVAILABLE'&&this.state.context===context&&this.state.messages.length>0;
   this.update({phase:'ERROR',canRetry:false,olderPageUnavailable:retain,...(retain?{}:{context:null,messages:[],before:null}),
    message:retain?'Starije poruke nisu učitane. Prikazane poruke ostaju dostupne.':result.poruka});return;
  }
  if(target&&(result.podatak.messages[0]?.messageId!==target.messageId||result.podatak.messages[0]?.sequence!==target.sequence)){
   this.update({phase:'ERROR',messages:[],message:'Izabrana poruka nije dostupna. Osveži razgovor.'});return;
  }
  this.targetPending=false;
  const merged=before?[...result.podatak.messages,...this.state.messages]:result.podatak.messages;
  // De-duplicate a boundary without inventing messages from the command receipt.
  const ids=new Set<string>(),messages=merged.filter(m=>!ids.has(m.messageId)&&!!ids.add(m.messageId));
  this.update({phase:'READY',messages,...(target?{targetMessageId:target.messageId}:{}),before:result.podatak.nextBeforeSequence,olderPageUnavailable:false,message:null});
 }
 refresh=()=>!this.journalLoaded?this.load():this.run(async()=>{
  this.targetPending=false;this.update({targetMessageId:undefined});
  this.update({phase:'LOADING',canRetry:false,olderPageUnavailable:false,message:null,syncUnavailable:false});if(!await this.context())return;
  if(this.state.journal)await this.recover();else await this.page();
 });
 /** A foreground read never owns the command lock, resets the draft, or replaces older history.
  * Any intervening user action/read ACK wins over this response. At most one bounded page per tick. */
 syncLatest=async()=>{
  const start=this.state,g=start.context?.group,revision=this.operationRevision;
  if(this.syncing||this.busy||this.marking||!this.current()||start.phase!=='READY'||start.journal||!g||(g.terminal&&!this.syncHasMore))return;
  this.syncing=true;
  const unchanged=()=>this.current()&&!this.busy&&this.operationRevision===revision&&this.state===start;
  try{
   const context=await this.service.context(this.deps.agreementId,this.deps.account);
   if(!unchanged())return;
   if(!context.ok){
    if(context.kod==='GROUP_CONTEXT_TRANSPORT_UNAVAILABLE')this.update({syncUnavailable:true});
    else this.update({phase:'ERROR',context:null,messages:[],before:null,message:context.poruka,syncUnavailable:false});
    return;
   }
   const fresh=context.podatak.group;
   if(!fresh||fresh.groupId!==g.groupId){
    this.update({phase:'ERROR',context:null,messages:[],before:null,message:'Razgovor više nije dostupan. Ponovo otvori Dogovor.',syncUnavailable:false});return;
   }
   const after=start.messages.at(-1)?.sequence??'0';
   const result=await this.service.messages(g.groupId,this.deps.account,{after});
   if(!unchanged())return;
   if(!result.ok){
    if(result.kod==='GROUP_PAGE_TRANSPORT_UNAVAILABLE')this.update({syncUnavailable:true});
    else this.update({phase:'ERROR',context:null,messages:[],before:null,message:result.poruka,syncUnavailable:false});
    return;
   }
   // Keep the explicitly paged management tail; refresh() remains the full reload action.
   if(g.role==='REQUESTER'&&fresh.role==='REQUESTER'&&g.management&&g.management.length>50&&fresh.management&&fresh.managementNextId){
    const boundary=fresh.managementNextId.toLowerCase(),seen=new Set(fresh.management.map(row=>row.agreementId.toLowerCase()));
    fresh.management=[...fresh.management,...g.management.filter(row=>row.agreementId.toLowerCase()>boundary&&!seen.has(row.agreementId.toLowerCase()))];
    fresh.managementNextId=g.managementNextId;
   }
   const seen=new Set(start.messages.map(row=>row.messageId));
   const added=result.podatak.messages.filter(row=>!seen.has(row.messageId)&&Number(row.sequence)>Number(after));
   this.syncHasMore=added.length===50;
   this.update({context:context.podatak,messages:added.length?[...start.messages,...added]:start.messages,syncUnavailable:false});
  }catch{if(unchanged())this.update({phase:'ERROR',context:null,messages:[],before:null,message:'Razgovor nije učitan. Pokušaj ponovo.',syncUnavailable:false});}
  finally{this.syncing=false;}
 };
 older=()=>this.run(async()=>{if((this.state.phase==='READY'||(this.state.phase==='ERROR'&&this.state.olderPageUnavailable))&&this.state.before){
  const before=this.state.before;this.update({phase:'LOADING',olderPageUnavailable:false,message:null});await this.page(before);}});
 managementNext=()=>this.run(async()=>{const g=this.state.context?.group;if(this.state.phase!=='READY'||g?.role!=='REQUESTER'||!g.managementNextId)return;
  const result=await this.service.context(this.deps.agreementId,this.deps.account,g.managementNextId);if(!this.current())return;
  if(!result.ok){this.update({message:result.poruka});return;}const next=result.podatak.group;
  if(!next||next.groupId!==g.groupId||next.role!=='REQUESTER'){this.update({phase:'ERROR',context:null,message:'Upravljanje nije dostupno.'});return;}
  this.update({context:{...result.podatak,group:{...next,management:[...(g.management??[]),...(next.management??[])]}}});
 });
 private async recover(){const j=this.state.journal;if(!j)return;this.update({canRetry:false});
  const result=await this.service.recover(j,this.deps.account);if(!this.current())return;
  if(!result.ok){this.update({phase:'UNKNOWN',canRetry:false,message:result.poruka});return;}
  if(result.podatak.found){await this.confirm(result.podatak.receipt!);return;}
  this.update({phase:'UNKNOWN',canRetry:!!this.state.context?.group?.canSend,message:'Ne znamo da li je poruka stigla. Za novi pokušaj upiši istu poruku.'});
 }
 private async confirm(receipt:GroupReceipt){
  this.inMemoryBody=null;this.update({phase:'CONFIRMED',receipt,canRetry:false,message:'Poruka je sačuvana u ovom grupnom razgovoru.'});
  await this.resumeConfirmed();
 }
 send=(input:string)=>this.run(async()=>{
  const body=normalizeGroupBody(input),g=this.state.context?.group;if(this.state.phase!=='READY'||this.state.syncUnavailable||this.state.journal||!g?.canSend||!groupBody(body))return;
  const journal:GroupJournal={version:1,groupId:g.groupId,clientRequestId:(this.deps.uuid??noviUuidZahtevId)(),bodySha256:groupBodyHash(body)};
  this.update({phase:'SENDING',message:null,canRetry:false});
  // Persist four opaque identity/hash fields before dispatch. No group text is
  // written locally. A restart may recover a receipt or require exact re-entry.
  await this.deps.storage.setItem(this.key,JSON.stringify(journal));if(!this.current())return;
  this.inMemoryBody=body;this.update({journal});await this.write(body);
 });
 private async write(body:string){const j=this.state.journal;if(!j)return;
  this.update({phase:'SENDING',canRetry:false,message:null});const result=await this.service.send(j,body,this.deps.account);if(!this.current())return;
  if(result.ok)await this.confirm(result.podatak);else this.update({phase:'UNKNOWN',canRetry:false,message:result.poruka});
 }
 retry=(reentry?:string)=>this.run(async()=>{
  const j=this.state.journal,body=reentry===undefined?this.inMemoryBody:normalizeGroupBody(reentry);
  if(this.state.phase!=='UNKNOWN'||!this.state.canRetry||!j||!this.state.context?.group?.canSend)return;
  if(!groupBody(body)||groupBodyHash(body)!==j.bodySha256){this.update({message:'Tekst se razlikuje od poslate poruke. Upiši istu poruku, bez izmena.'});return;}
  await this.write(body);
 });
 // The receipt is final: continue reading without another tap, never dispatch again.
 // If local cleanup fails, keep that confirmed receipt and its explicit recovery action.
 private async resumeConfirmed(){if(!this.current()||this.state.phase!=='CONFIRMED')return;
  try{await this.deps.storage.removeItem(this.key);}catch{
   this.update({phase:'CONFIRMED',canRetry:false,message:'Poruka je poslata. Nastavi razgovor kada bude moguće.'});return;
  }
  if(!this.current())return;
  this.update({journal:null,receipt:null,phase:'LOADING',message:null});if(await this.context())await this.page();
 }
 acknowledge=()=>this.run(()=>this.resumeConfirmed());
 markVisible=async(ids:string[])=>{
  const g=this.state.context?.group;if(!this.current()||!g)return;
  const allowed=new Set(this.state.messages.map(m=>m.messageId)),unique=[...new Set(ids)].filter(id=>allowed.has(id)).slice(0,50);if(!unique.length)return;
  // The native list supplies only presently viewable rows. No page-wide mark
  // for off-screen content, no new visibility grants and no optimistic count.
  // Keep the newest bounded observation while a page or command is in flight.
  this.visible={groupId:g.groupId,ids:unique};await this.flushVisible();
 };
 private async flushVisible(){
  if(this.marking||this.busy||!this.current()||this.state.phase!=='READY'||this.state.syncUnavailable)return;
  this.marking=true;
  try{
   while(this.visible&&this.current()&&!this.busy&&this.state.phase==='READY'){
    const observed=this.visible;this.visible=null;
    const g=this.state.context?.group;if(!g||g.groupId!==observed.groupId)continue;
    const allowed=new Set(this.state.messages.map(m=>m.messageId)),ids=observed.ids.filter(id=>allowed.has(id));if(!ids.length)continue;
    // Read receipts have their own lock: a slow acknowledgement must not drop
    // a send/refresh tap. Its optional context read cannot replace newer work.
    const revision=this.operationRevision,context=this.state.context;
    const result=await this.service.markRead(g.groupId,ids,this.deps.account);if(!this.current())return;
    const unchanged=()=>this.operationRevision===revision&&!this.busy&&this.state.phase==='READY'&&this.state.context===context;
    if(result.ok&&unchanged())await this.context(unchanged,true);
   }
  }catch{/* Best effort only; an unconfirmed read never changes message or command state. */}
  finally{this.marking=false;if(this.visible&&!this.state.syncUnavailable)void this.flushVisible();}
 }
}
