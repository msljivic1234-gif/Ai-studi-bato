import AsyncStorage from '@react-native-async-storage/async-storage';
import { record,uuid } from '../../data/serverReceipt';
import type { ClosureStartIntent } from '../../data/closureExecutionClientService';
export type ClosureIntent=ClosureStartIntent|{kind:'PREPARE';accountId:string;clientRequestId:string;expectedRevision:number};
const chains=new Map<string,Promise<unknown>>();const key=(a:string)=>'uskoci.closure.intent.v1.'+a;
function queue<T>(a:string,task:()=>Promise<T>):Promise<T>{const pending=(chains.get(a)??Promise.resolve()).catch(()=>undefined).then(task);chains.set(a,pending);void pending.finally(()=>{if(chains.get(a)===pending)chains.delete(a);}).catch(()=>undefined);return pending;}
function parse(raw:string|null,a:string):ClosureIntent|null{
 if(raw===null)return null;const i=record(JSON.parse(raw));
 if(!i||i.accountId!==a||!uuid(i.clientRequestId)||!Number.isInteger(i.expectedRevision)||Number(i.expectedRevision)<0||Number(i.expectedRevision)>=2147483647||!['START','PREPARE'].includes(String(i.kind)))throw new Error('CLOSURE_LOCAL_STATE_INVALID');
 if(Object.keys(i).some(k=>!(i.kind==='START'?['kind','accountId','clientRequestId','expectedRevision','requestId','policySha256']:['kind','accountId','clientRequestId','expectedRevision']).includes(k)))throw new Error('CLOSURE_LOCAL_STATE_INVALID');
 if(i.kind==='START'&&(!uuid(i.requestId)||Number(i.expectedRevision)===0||typeof i.policySha256!=='string'||!/^[a-f0-9]{64}$/.test(i.policySha256)))throw new Error('CLOSURE_LOCAL_STATE_INVALID');
 return i as ClosureIntent;
}
/** Opaque coordinates only, no transcript, identity, policy prose or secret. A
 * persisted unknown intent survives logout/restart; only its own account reads it. */
export const closureIntentJournal={
 load:(a:string)=>queue(a,async()=>{if(!uuid(a))throw new Error('CLOSURE_LOCAL_STATE_INVALID');return parse(await AsyncStorage.getItem(key(a)),a);}),
 save:(intent:ClosureIntent)=>queue(intent.accountId,async()=>{const existing=parse(await AsyncStorage.getItem(key(intent.accountId)),intent.accountId);if(existing&&JSON.stringify(existing)!==JSON.stringify(intent))throw new Error('CLOSURE_UNRESOLVED_INTENT');await AsyncStorage.setItem(key(intent.accountId),JSON.stringify(intent));}),
 clear:(a:string,clientRequestId:string,isCurrent:()=>boolean=()=>true)=>queue(a,async()=>{if(!isCurrent())return;const existing=parse(await AsyncStorage.getItem(key(a)),a);if(isCurrent()&&existing?.clientRequestId===clientRequestId)await AsyncStorage.removeItem(key(a));})
};
