import AsyncStorage from '@react-native-async-storage/async-storage';
import {record, uuid, positiveInteger} from '../../data/serverReceipt';
import type {QaRecoveredCommand} from '../../data/qaRecoveryClientService';

type Coordinates = {accountId:string;needId:string;needRevision:number;clientRequestId:string};
export type QaIntent = Coordinates & (
  {type:'ASK';textSha256:string} |
  {type:'ANSWER';questionId:string;textSha256:string} |
  {type:'DISPOSITION';questionId:string;action:'IGNORE'|'REPORT';textSha256:null}
);
const chains = new Map<string,Promise<unknown>>();
const key = (a:string,n:string) => `uskoci.qa.intent.v1.${a}.${n}`;
function queue<T>(id:string,work:()=>Promise<T>):Promise<T> {
  const p = (chains.get(id)??Promise.resolve()).catch(()=>undefined).then(work);
  chains.set(id,p);
  void p.finally(()=>{if(chains.get(id)===p)chains.delete(id);}).catch(()=>undefined);
  return p;
}
function parse(raw:string|null,a:string,n:string):QaIntent|null {
  if(raw===null)return null;
  const i=record(JSON.parse(raw));
  const common=['accountId','needId','needRevision','clientRequestId','type','textSha256'];
  if(!i||!uuid(a)||!uuid(n)||i.accountId!==a||i.needId!==n||!uuid(i.clientRequestId)||!positiveInteger(i.needRevision))throw new Error('QA_INTENT_INVALID');
  if(i.type==='ASK'||i.type==='ANSWER') {
    if(typeof i.textSha256!=='string'||!/^[a-f0-9]{64}$/.test(i.textSha256)||(i.type==='ANSWER'&&!uuid(i.questionId)))throw new Error('QA_INTENT_INVALID');
  } else if(i.type!=='DISPOSITION'||!uuid(i.questionId)||!['IGNORE','REPORT'].includes(String(i.action))||i.textSha256!==null)throw new Error('QA_INTENT_INVALID');
  const fields=[...common,...(i.type==='ASK'?[]:i.type==='ANSWER'?['questionId']:['questionId','action'])];
  if(Object.keys(i).some(k=>!fields.includes(k)))throw new Error('QA_INTENT_INVALID');
  return i as QaIntent;
}
/** Only opaque coordinates and an equality hash are persisted. Leaving the route
 * never submits or cancels an already dispatched server transaction. */
export const qaIntentJournal={
  load:(a:string,n:string)=>queue(key(a,n),async()=>parse(await AsyncStorage.getItem(key(a,n)),a,n)),
  save:(i:QaIntent)=>queue(key(i.accountId,i.needId),async()=>{
    const encoded=JSON.stringify(i);parse(encoded,i.accountId,i.needId);
    const old=parse(await AsyncStorage.getItem(key(i.accountId,i.needId)),i.accountId,i.needId);
    if(old&&JSON.stringify(old)!==encoded)throw new Error('QA_INTENT_UNRESOLVED');
    await AsyncStorage.setItem(key(i.accountId,i.needId),encoded);
  }),
  clear:(a:string,n:string,k:string)=>queue(key(a,n),async()=>{
    const old=parse(await AsyncStorage.getItem(key(a,n)),a,n);
    if(old?.clientRequestId===k)await AsyncStorage.removeItem(key(a,n));
  }),
};
export function matchesQaReceipt(i:QaIntent,c:QaRecoveredCommand):boolean {
  if(c.type!==i.type||c.needRevision!==i.needRevision||c.textSha256!==i.textSha256)return false;
  if(i.type!=='ASK'&&c.receipt.questionId!==i.questionId)return false;
  return i.type!=='DISPOSITION'||c.receipt.status===(i.action==='IGNORE'?'IGNORED':'REPORTED');
}
