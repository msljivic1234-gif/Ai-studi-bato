// AF-D07. Original bytes live only in this request. Storage receives a sanitized
// JPEG under an immutable server-generated path; upload never publishes a Task.
import * as magick from 'npm:@imagemagick/magick-wasm@0.0.43';
import { configureImageLimits, sanitizeImage } from '../_shared/mediaImageSanitizer.mjs';
import { inspectVoiceM4a } from '../_shared/voiceM4a.mjs';
import { createMediaUploadAdmission } from '../_shared/mediaUploadAdmission.mjs';
import { readSupabasePublishableKey, readSupabaseServiceKey, supabaseServiceHeaders } from '../_shared/supabaseKeys.mjs';
declare const Deno:{env:{get(name:string):string|undefined};readFile(path:string|URL):Promise<Uint8Array>;serve(fn:(req:Request)=>Promise<Response>):void};
type Row=Record<string,any>;
const row=(v:unknown):Row|null=>v!==null&&typeof v==='object'&&!Array.isArray(v)?v as Row:null;
const id=(v:unknown):v is string=>typeof v==='string'&&/^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(v);
const hash=(v:unknown):v is string=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization,apikey,content-type,x-client-info,x-media-operation,x-media-scope,x-media-target,x-media-request-id,x-media-version',
 'Access-Control-Allow-Methods':'POST,OPTIONS','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};
const json=(status:number,data:unknown)=>new Response(JSON.stringify(data),{status,headers:{...cors,'Content-Type':'application/json'}});
const safeCodes=['MEDIA_INPUT_INVALID','MEDIA_FORMAT_UNSUPPORTED','MEDIA_DIMENSIONS_TOO_LARGE','MEDIA_SANITIZATION_FAILED','MEDIA_LIMIT_REACHED',
 'MEDIA_NOT_FOUND','MEDIA_NOT_EDITABLE','MEDIA_TURN_PENDING','MEDIA_UPLOAD_PENDING','IDEMPOTENCY_KEY_REUSED',
 'MEDIA_VERSION_CONFLICT','MEDIA_COMMAND_CONFLICT','MEDIA_COMMAND_CANCELLED','MEDIA_RATE_LIMITED','INTERACTION_BLOCKED','ACCOUNT_CLOSING'];
class Safe extends Error{constructor(readonly code:string,readonly status=400){super(code);}}
let initialized:Promise<void>|undefined;
// Isolate-local admission: one ImageMagick WASM operation, two bounded voice uploads.
// No raw request payload is buffered while queued.
const imageAdmission=createMediaUploadAdmission({activeLimit:1,waitingLimit:4,waitMs:4000});
const voiceAdmission=createMediaUploadAdmission({activeLimit:2,waitingLimit:4,waitMs:4000});
export async function loadMediaRuntime(){
 if(!initialized)initialized=(async()=>{await magick.initializeImageMagick(await Deno.readFile(new URL(import.meta.resolve('npm:@imagemagick/magick-wasm@0.0.43/magick.wasm'))));configureImageLimits(magick);})();
 await initialized;return magick;
}
async function bytes(message:Request|Response,max:number,signal:AbortSignal):Promise<Uint8Array>{
 const declared=message.headers.get('content-length');if(declared!==null&&(!/^\d+$/.test(declared)||Number(declared)>max))throw new Safe('MEDIA_INPUT_INVALID',413);
 const reader=message.body?.getReader();if(!reader)throw new Safe('MEDIA_INPUT_INVALID');
 const chunks:Uint8Array[]=[];let total=0;const stop=()=>{void reader.cancel().catch(()=>undefined);};signal.addEventListener('abort',stop,{once:true});
 try{for(;;){if(signal.aborted)throw new Error('CANCELLED');const part=await reader.read();
  // Own every delivered chunk before a cancellation or size refusal can throw.
  if(!part.done)chunks.push(part.value);
  if(signal.aborted)throw new Error('CANCELLED');if(part.done)break;
  total+=part.value.byteLength;if(total>max)throw new Safe('MEDIA_INPUT_INVALID',413);}
  if(declared!==null&&Number(declared)!==total)throw new Error('TRUNCATED');const out=new Uint8Array(total);let offset=0;for(const c of chunks){out.set(c,offset);offset+=c.length;}return out;
 }finally{
  signal.removeEventListener('abort',stop);
  // The returned compact copy owns the data. Clear the temporary streaming
  // chunks on success AND on truncation, cancellation or an oversize body.
  for(const chunk of chunks)chunk.fill(0);
  void reader.cancel().catch(()=>undefined);
 }
}
const digest=async(data:Uint8Array)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new Uint8Array(data).buffer)),v=>v.toString(16).padStart(2,'0')).join('');
const parse=(data:Uint8Array)=>JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(data));
function asset(raw:unknown,aid?:string):Row{
 const a=row(raw);if(!a||!id(a.assetId)||!id(a.accountId)||(aid&&a.accountId!==aid)||!id(a.clientRequestId)||!['TASK','AVATAR'].includes(a.scope)
  ||!['PROCESSING','STAGED','READY','FAILED'].includes(a.state)||a.authoritative!==true)throw new Error('INVALID_ASSET');
 if(a.state==='READY'&&(!hash(a.sha256)||a.ref!==`${a.accountId}/v5/${a.assetId}/${a.sha256}.jpg`||!Number.isInteger(a.byteSize)||a.byteSize<1||a.byteSize>5242880||a.contentType!=='image/jpeg'))throw new Error('INVALID_ASSET');
 return a;
}
function supportSession(authorization:string,accountId:string,origin:string):string{
 // Auth /user has already verified this exact bearer. Decode only its signed
 // human/session binding, never a client JSON/header account/session override.
 try{
  const parts=authorization.slice(7).split('.');if(parts.length!==3||parts.some(x=>!x||!/^[A-Za-z0-9_-]+$/.test(x)))throw new Error();
  const encoded=parts[1].replace(/-/g,'+').replace(/_/g,'/'),raw=atob(encoded+'='.repeat((4-encoded.length%4)%4));
  const claims=row(JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(Uint8Array.from(raw,x=>x.charCodeAt(0)))));
  if(!claims||claims.sub!==accountId||claims.role!=='authenticated'||!id(claims.session_id)||claims.iss!==origin+'/auth/v1'
   ||!Number.isSafeInteger(claims.exp)||claims.exp<=Math.floor(Date.now()/1000))throw new Error();return claims.session_id;
 }catch{throw new Safe('AUTH_REQUIRED',401);}
}
function supportMedia(raw:unknown,caseId:string,assetId:string):Row{
 const r=row(raw),path=typeof r?.path==='string'?r.path.split('/'):[];
 if(!r||Object.keys(r).length!==8||Object.keys(r).some(k=>!['assetId','caseId','bucket','path','sha256','contentType','byteSize','authoritative'].includes(k))
  ||r.assetId!==assetId||r.caseId!==caseId||r.bucket!=='profile-media'||!hash(r.sha256)||r.contentType!=='image/jpeg'||r.authoritative!==true
  ||!Number.isInteger(r.byteSize)||r.byteSize<1||r.byteSize>5242880||path.length!==4||!id(path[0])
  ||!['v5','agreement-v5'].includes(path[1])||r.path!==`${path[0]}/${path[1]}/${assetId}/${r.sha256}.jpg`)throw new Error('INVALID_SUPPORT_MEDIA');
 return r;
}
const exact=(v:Row,keys:string[])=>Object.keys(v).length===keys.length&&keys.every(k=>Object.hasOwn(v,k));
function photoReceipt(raw:unknown,accountId:string,agreementId:string,version?:number,key?:string):Row{
 const r=row(raw),p=row(r?.photo);if(!r||!exact(r,['accountId','agreementId','agreementVersion','clientRequestId','assetId','state','attachedMessageId','photo','authoritative'])
 ||r.accountId!==accountId||r.agreementId!==agreementId||!Number.isSafeInteger(r.agreementVersion)||r.agreementVersion<1||r.agreementVersion>2147483647
 ||(version!==undefined&&r.agreementVersion!==version)||!id(r.clientRequestId)||(key!==undefined&&r.clientRequestId!==key)||r.authoritative!==true
 ||!['ABSENT','PROCESSING','STAGED','READY','FAILED','CANCELLED'].includes(r.state)
 ||(r.state==='ABSENT'?r.assetId!==null:!id(r.assetId))||(r.attachedMessageId!==null&&(!id(r.attachedMessageId)||r.state!=='READY')))throw new Error('INVALID_PHOTO_RECEIPT');
 if(r.state==='READY'){
  if(!p||!exact(p,['assetId','width','height','byteSize','contentType'])||p.assetId!==r.assetId||p.contentType!=='image/jpeg'
  ||!Number.isInteger(p.width)||p.width<1||p.width>1600||!Number.isInteger(p.height)||p.height<1||p.height>1600
  ||!Number.isInteger(p.byteSize)||p.byteSize<1||p.byteSize>5242880)throw new Error('INVALID_PHOTO_RECEIPT');
 }else if(r.photo!==null)throw new Error('INVALID_PHOTO_RECEIPT');return r;
}
function photoTransfer(raw:unknown,accountId:string,agreementId:string,version:number,key:string):Row{
 const t=row(raw);if(!t)throw new Error('INVALID_PHOTO_TRANSFER');const r=photoReceipt(t.receipt,accountId,agreementId,version,key);
 if(r.state==='ABSENT'){if(!exact(t,['receipt']))throw new Error('INVALID_PHOTO_TRANSFER');return t;}
 if(!exact(t,['receipt','attemptId','path','sha256','byteSize','dispatchState','dispatchOutcome','acquired'])||!id(t.attemptId)||typeof t.acquired!=='boolean'
 ||!['NOT_DISPATCHED','DISPATCHING','SETTLED'].includes(t.dispatchState)||(t.dispatchState==='SETTLED'?!['STORED','REJECTED'].includes(t.dispatchOutcome):t.dispatchOutcome!==null))throw new Error('INVALID_PHOTO_TRANSFER');
 if(t.path!==null){if(!hash(t.sha256)||t.path!==`${accountId}/agreement-v5/${r.assetId}/${t.sha256}.jpg`||!Number.isInteger(t.byteSize)||t.byteSize<1||t.byteSize>5242880)throw new Error('INVALID_PHOTO_TRANSFER');}
 else if(t.sha256!==null||t.byteSize!==null||t.dispatchState!=='NOT_DISPATCHED'||r.state==='READY'||r.state==='STAGED')throw new Error('INVALID_PHOTO_TRANSFER');
 if(r.state==='READY'&&(t.dispatchOutcome!=='STORED'||r.photo.byteSize!==t.byteSize))throw new Error('INVALID_PHOTO_TRANSFER');return t;
}
const VOICE_MAX=4194304;
function voiceReceipt(raw:unknown,accountId:string,agreementId:string,version?:number,key?:string):Row{
 const r=row(raw),p=row(r?.voice);if(!r||!exact(r,['accountId','agreementId','agreementVersion','clientRequestId','assetId','state','attachedMessageId','voice','authoritative'])
 ||r.accountId!==accountId||r.agreementId!==agreementId||!Number.isSafeInteger(r.agreementVersion)||r.agreementVersion<1||r.agreementVersion>2147483647
 ||(version!==undefined&&r.agreementVersion!==version)||!id(r.clientRequestId)||(key!==undefined&&r.clientRequestId!==key)||r.authoritative!==true
 ||!['ABSENT','PROCESSING','STAGED','READY','FAILED','CANCELLED'].includes(r.state)
 ||(r.state==='ABSENT'?r.assetId!==null:!id(r.assetId))||(r.attachedMessageId!==null&&(!id(r.attachedMessageId)||r.state!=='READY')))throw new Error('INVALID_VOICE_RECEIPT');
 if(r.state==='READY'){
  if(!p||!exact(p,['assetId','durationMs','byteSize','contentType'])||p.assetId!==r.assetId||p.contentType!=='audio/mp4'
  ||!Number.isInteger(p.durationMs)||p.durationMs<300||p.durationMs>300000
  ||!Number.isInteger(p.byteSize)||p.byteSize<1||p.byteSize>VOICE_MAX)throw new Error('INVALID_VOICE_RECEIPT');
 }else if(r.voice!==null)throw new Error('INVALID_VOICE_RECEIPT');return r;
}
function voiceTransfer(raw:unknown,accountId:string,agreementId:string,version:number,key:string):Row{
 const t=row(raw);if(!t)throw new Error('INVALID_VOICE_TRANSFER');const r=voiceReceipt(t.receipt,accountId,agreementId,version,key);
 if(r.state==='ABSENT'){if(!exact(t,['receipt']))throw new Error('INVALID_VOICE_TRANSFER');return t;}
 if(!exact(t,['receipt','attemptId','path','sha256','byteSize','durationMs','dispatchState','dispatchOutcome','acquired'])||!id(t.attemptId)||typeof t.acquired!=='boolean'
 ||!['NOT_DISPATCHED','DISPATCHING','SETTLED'].includes(t.dispatchState)||(t.dispatchState==='SETTLED'?!['STORED','REJECTED'].includes(t.dispatchOutcome):t.dispatchOutcome!==null))throw new Error('INVALID_VOICE_TRANSFER');
 if(t.path!==null){if(!hash(t.sha256)||t.path!==`${accountId}/agreement-voice-v1/${r.assetId}/${t.sha256}.m4a`||!Number.isInteger(t.byteSize)||t.byteSize<1||t.byteSize>VOICE_MAX
  ||!Number.isInteger(t.durationMs)||t.durationMs<300||t.durationMs>300000)throw new Error('INVALID_VOICE_TRANSFER');}
 else if(t.sha256!==null||t.byteSize!==null||t.durationMs!==null||t.dispatchState!=='NOT_DISPATCHED'||r.state==='READY'||r.state==='STAGED')throw new Error('INVALID_VOICE_TRANSFER');
 if(r.state==='READY'&&(t.dispatchOutcome!=='STORED'||r.voice.byteSize!==t.byteSize||r.voice.durationMs!==t.durationMs))throw new Error('INVALID_VOICE_TRANSFER');return t;
}
export async function handleMedia(req:Request):Promise<Response>{
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers:cors});
 if(req.method!=='POST')return json(405,{code:'METHOD_NOT_ALLOWED'});
 const authorization=req.headers.get('authorization')??'',base=Deno.env.get('SUPABASE_URL')??'',anon=readSupabasePublishableKey(name=>Deno.env.get(name))??'',service=readSupabaseServiceKey(name=>Deno.env.get(name))??'';
 if(!/^Bearer [^\s]+$/.test(authorization)||authorization.length>16384)return json(401,{code:'AUTH_REQUIRED'});
 let url:URL;try{url=new URL(base);if(url.protocol!=='https:'||url.username||url.password||url.pathname!=='/'||url.search||url.hash||!anon||!service)throw new Error();}catch{return json(503,{code:'MEDIA_UNAVAILABLE'});}
 const abort=new AbortController(),stop=()=>abort.abort();let timer=setTimeout(stop,25000);req.signal.addEventListener('abort',stop,{once:true});if(req.signal.aborted)stop();
 const fetchBound=(path:string,init:RequestInit)=>fetch(path,{...init,redirect:'error',signal:abort.signal});
 const userHeaders={apikey:anon,Authorization:authorization,'Content-Type':'application/json'};
 const serviceHeaders=supabaseServiceHeaders(service,{'Content-Type':'application/json'});
 const rpc=async(name:string,args:Row,maxBytes=32768)=>{const r=await fetchBound(url.origin+'/rest/v1/rpc/'+name,{method:'POST',headers:serviceHeaders,body:JSON.stringify(args)});
  const v=parse(await bytes(r,maxBytes,abort.signal));if(!r.ok){const code=row(v)?.message;if(safeCodes.includes(code))throw new Safe(code,code==='MEDIA_NOT_FOUND'?403:code==='MEDIA_RATE_LIMITED'?429:409);throw new Error('MEDIA_RPC_FAILED');}return v;};
 const objectBytes=async(path:string,expected:string,size:number,strictMime=false)=>{const r=await fetchBound(url.origin+'/storage/v1/object/profile-media/'+path,{headers:supabaseServiceHeaders(service)});
  if(!r.ok||(strictMime&&r.headers.get('content-type')?.split(';')[0].trim().toLowerCase()!=='image/jpeg'))throw new Error('STORAGE_UNCONFIRMED');const b=await bytes(r,5242880,abort.signal);if(b.length!==size||await digest(b)!==expected)throw new Error('STORAGE_UNCONFIRMED');return b;};
 let releaseAdmission:(()=>void)|null=null;
 try{
  const auth=await fetchBound(url.origin+'/auth/v1/user',{headers:userHeaders});if(!auth.ok)return json(401,{code:'AUTH_REQUIRED'});
  const user=row(parse(await bytes(auth,65536,abort.signal)));if(!id(user?.id))return json(401,{code:'AUTH_REQUIRED'});const aid=user.id;
  const op=req.headers.get('x-media-operation'),preview=(a:Row)=>({assetId:a.assetId,width:a.width,height:a.height,contentType:'image/jpeg'});
  if(op?.startsWith('agreement-voice-')){
   // Voice messages (B1-c). The original bytes ARE the stored bytes: one validated self-contained mono AAC-LC M4A, no transcoding, never a URL.
   const sessionId=supportSession(authorization,aid,url.origin);
   const voiceBytes=async(path:string,expected:string,size:number)=>{const r=await fetchBound(url.origin+'/storage/v1/object/agreement-voice/'+path,{headers:supabaseServiceHeaders(service)});
    if(!r.ok||r.headers.get('content-type')?.split(';')[0].trim().toLowerCase()!=='audio/mp4')throw new Error('STORAGE_UNCONFIRMED');
    const b=await bytes(r,VOICE_MAX,abort.signal);if(b.length!==size||await digest(b)!==expected)throw new Error('STORAGE_UNCONFIRMED');return b;};
   if(op==='agreement-voice-read'){
    const i=row(parse(await bytes(req,2048,abort.signal)));if(!i||!id(i.agreementId)||!id(i.assetId)
    ||!(exact(i,['agreementId','assetId'])||(exact(i,['agreementId','assetId','messageId'])&&id(i.messageId))))throw new Safe('MEDIA_INPUT_INVALID');
    const args={p_account_id:aid,p_session_id:sessionId,p_agreement_id:i.agreementId,p_asset_id:i.assetId,p_message_id:i.messageId??null};
    const authorize=async()=>{const r=row(await rpc('rpc_agreement_voice_read_service_v1',args)),parts=typeof r?.path==='string'?r.path.split('/'):[];
     if(!r||!exact(r,['assetId','agreementId','messageId','bucket','path','sha256','contentType','byteSize','durationMs','authoritative'])||r.assetId!==i.assetId||r.agreementId!==i.agreementId
     ||r.messageId!==(i.messageId??null)||r.bucket!=='agreement-voice'||r.authoritative!==true||r.contentType!=='audio/mp4'||!hash(r.sha256)||parts.length!==4||!id(parts[0])
     ||r.path!==`${parts[0]}/agreement-voice-v1/${i.assetId}/${r.sha256}.m4a`||!Number.isInteger(r.byteSize)||r.byteSize<1||r.byteSize>VOICE_MAX
     ||!Number.isInteger(r.durationMs)||r.durationMs<300||r.durationMs>300000)throw new Error('INVALID_VOICE_READ');return r;};
    const r=await authorize(),b=await voiceBytes(r.path,r.sha256,r.byteSize);try{const after=await authorize();
     if(after.path!==r.path||after.sha256!==r.sha256||after.byteSize!==r.byteSize||abort.signal.aborted)throw new Error('VOICE_AUTH_CHANGED');
     return new Response(new Uint8Array(b),{headers:{...cors,'Content-Type':'audio/mp4','Content-Length':String(b.length)}});
    }finally{b.fill(0);}
   }
   const upload=op==='agreement-voice-upload';let agreementId:string,version:number|undefined,key:string|undefined,input:Uint8Array|undefined;
   if(upload){agreementId=req.headers.get('x-media-target')??'';key=req.headers.get('x-media-request-id')??'';const rawVersion=req.headers.get('x-media-version')??'';
    if(!id(agreementId)||!id(key)||!/^[1-9][0-9]{0,9}$/.test(rawVersion)||Number(rawVersion)>2147483647)throw new Safe('MEDIA_INPUT_INVALID');version=Number(rawVersion);
   }else{
    const i=row(parse(await bytes(req,2048,abort.signal)));if(!i||!id(i.agreementId))throw new Safe('MEDIA_INPUT_INVALID');agreementId=i.agreementId;
    if(op==='agreement-voice-upload-list'){if(!exact(i,['agreementId']))throw new Safe('MEDIA_INPUT_INVALID');}
    else{if(!['agreement-voice-upload-read','agreement-voice-upload-cancel'].includes(op)||!exact(i,['agreementId','agreementVersion','clientRequestId'])||!id(i.clientRequestId)
     ||!Number.isInteger(i.agreementVersion)||i.agreementVersion<1||i.agreementVersion>2147483647)throw new Safe('MEDIA_INPUT_INVALID');version=i.agreementVersion;key=i.clientRequestId;}
   }
   const rawCall=(operation:string,data:Row={})=>rpc('rpc_agreement_voice_upload_service_v1',{p_account_id:aid,p_session_id:sessionId,p_operation:operation,p_agreement_id:agreementId,p_version:version??null,p_key:key??null,p_input:data},65536);
   if(op==='agreement-voice-upload-list'){
    const list=row(await rawCall('LIST'));if(!list||!exact(list,['accountId','agreementId','uploads','authoritative'])||list.accountId!==aid||list.agreementId!==agreementId||list.authoritative!==true
    ||!Array.isArray(list.uploads)||list.uploads.length>20)throw new Error('INVALID_VOICE_LIST');const keys=new Set<string>();for(const r of list.uploads){const p=voiceReceipt(r,aid,agreementId);
     if(['ABSENT','FAILED','CANCELLED'].includes(p.state)||p.attachedMessageId!==null||keys.has(p.clientRequestId))throw new Error('INVALID_VOICE_LIST');keys.add(p.clientRequestId);}return json(200,list);
   }
   const call=async(operation:string,data:Row={})=>voiceTransfer(await rawCall(operation,data),aid,agreementId,version!,key!);
   if(!upload){
    let t=await call(op==='agreement-voice-upload-cancel'?'CANCEL':'READ');
    // A restart need not retain the recording to settle an already-issued upload: positive readback may advance this same immutable dispatch only.
    // Missing or unknown bytes stay unresolved; there is never a second POST.
    if(op==='agreement-voice-upload-read'&&t.dispatchState==='DISPATCHING'&&['STAGED','CANCELLED'].includes(t.receipt.state)){
     let stored:Uint8Array|undefined;try{stored=await voiceBytes(t.path,t.sha256,t.byteSize);}
     catch{if(abort.signal.aborted)throw new Error('VOICE_RECOVERY_ABORTED');}
     if(stored){stored.fill(0);t=await call('SETTLE',{sha256:t.sha256,outcome:'STORED'});}
    }return json(200,t.receipt);
   }
   releaseAdmission=await voiceAdmission.acquire(abort.signal);
   if(!releaseAdmission){if(abort.signal.aborted)throw new Error('MEDIA_WAIT_ABORTED');throw new Safe('MEDIA_BUSY',429);}
   // A recording takes longer to arrive than a photo: the body counts against this timer, so the voice upload gets its own bound.
   clearTimeout(timer);timer=setTimeout(stop,60000);
   const contentType=req.headers.get('content-type')?.split(';')[0].trim().toLowerCase();if(contentType!=='audio/mp4')throw new Safe('MEDIA_FORMAT_UNSUPPORTED');
   try{
    input=await bytes(req,VOICE_MAX,abort.signal);if(!input.length)throw new Safe('MEDIA_INPUT_INVALID');
    const sha256=await digest(input);
    let t=await call('CLAIM',{sha256,byteSize:input.length,contentType});
    if(!t.acquired){
     if(t.receipt.state==='STAGED'&&t.dispatchState==='DISPATCHING'){
      const existing=await voiceBytes(t.path,t.sha256,t.byteSize);existing.fill(0);t=await call('SETTLE',{sha256:t.sha256,outcome:'STORED'});
     }return json(200,t.receipt);
    }
    if(t.receipt.state!=='PROCESSING'||t.path!==null)throw new Error('INVALID_VOICE_CLAIM');
    let info:{durationMs:number;byteSize:number};
    try{info=inspectVoiceM4a(input);}catch(error){await call('FAIL');
     throw new Safe(row(error)?.message==='VOICE_SIZE_INVALID'?'MEDIA_INPUT_INVALID':'MEDIA_FORMAT_UNSUPPORTED');}
    if(info.byteSize!==input.length)throw new Error('INVALID_VOICE_INSPECTION');
    t=await call('STAGE',{attemptId:t.attemptId,sha256,byteSize:input.length,durationMs:info.durationMs});
    if(t.receipt.state==='CANCELLED')return json(200,t.receipt);
    if(t.receipt.state!=='STAGED'||t.sha256!==sha256||t.byteSize!==input.length||t.durationMs!==info.durationMs)throw new Error('INVALID_VOICE_STAGE');
    t=await call('DISPATCH');if(!t.acquired)return json(200,t.receipt);
    if(t.receipt.state!=='STAGED'||t.dispatchState!=='DISPATCHING'||t.sha256!==sha256||t.byteSize!==input.length)throw new Error('INVALID_VOICE_DISPATCH');
    const posted=await fetchBound(url.origin+'/storage/v1/object/agreement-voice/'+t.path,{method:'POST',headers:supabaseServiceHeaders(service,{'Content-Type':'audio/mp4','x-upsert':'false'}),body:new Uint8Array(input)});
    void posted.body?.cancel();
    // 4xx is a definitive rejected write; a timeout or 5xx stays DISPATCHING so a later closure cannot mistake an unknown upstream write for quiescence.
    if(!posted.ok&&posted.status!==409){if(posted.status>=400&&posted.status<500)await call('SETTLE',{sha256,outcome:'REJECTED'});throw new Error('VOICE_STORAGE_UNCONFIRMED');}
    const stored=await voiceBytes(t.path,sha256,t.byteSize);stored.fill(0);t=await call('SETTLE',{sha256,outcome:'STORED'});return json(200,t.receipt);
   }finally{input?.fill(0);}
  }
  if(op?.startsWith('agreement-')){
   const sessionId=supportSession(authorization,aid,url.origin);
   if(op==='agreement-read'){
    const i=row(parse(await bytes(req,2048,abort.signal)));if(!i||!id(i.agreementId)||!id(i.assetId)
    ||!(exact(i,['agreementId','assetId'])||(exact(i,['agreementId','assetId','messageId'])&&id(i.messageId))))throw new Safe('MEDIA_INPUT_INVALID');
    const args={p_account_id:aid,p_session_id:sessionId,p_agreement_id:i.agreementId,p_asset_id:i.assetId,p_message_id:i.messageId??null};
    const authorize=async()=>{const r=row(await rpc('rpc_agreement_photo_read_service_v5',args)),parts=typeof r?.path==='string'?r.path.split('/'):[];
     if(!r||!exact(r,['assetId','agreementId','messageId','bucket','path','sha256','contentType','byteSize','authoritative'])||r.assetId!==i.assetId||r.agreementId!==i.agreementId
     ||r.messageId!==(i.messageId??null)||r.bucket!=='profile-media'||r.authoritative!==true||r.contentType!=='image/jpeg'||!hash(r.sha256)||parts.length!==4||!id(parts[0])
     ||r.path!==`${parts[0]}/agreement-v5/${i.assetId}/${r.sha256}.jpg`||!Number.isInteger(r.byteSize)||r.byteSize<1||r.byteSize>5242880)throw new Error('INVALID_PHOTO_READ');return r;};
    const r=await authorize(),b=await objectBytes(r.path,r.sha256,r.byteSize,true);try{const after=await authorize();
     if(after.path!==r.path||after.sha256!==r.sha256||after.byteSize!==r.byteSize||abort.signal.aborted)throw new Error('PHOTO_AUTH_CHANGED');
     return new Response(new Uint8Array(b),{headers:{...cors,'Content-Type':'image/jpeg'}});
    }finally{b.fill(0);}
   }
   const upload=op==='agreement-upload';let agreementId:string,version:number|undefined,key:string|undefined,input:Uint8Array|undefined;
   if(upload){agreementId=req.headers.get('x-media-target')??'';key=req.headers.get('x-media-request-id')??'';const rawVersion=req.headers.get('x-media-version')??'';
    if(!id(agreementId)||!id(key)||!/^[1-9][0-9]{0,9}$/.test(rawVersion)||Number(rawVersion)>2147483647)throw new Safe('MEDIA_INPUT_INVALID');version=Number(rawVersion);
   }else{
    const i=row(parse(await bytes(req,2048,abort.signal)));if(!i||!id(i.agreementId))throw new Safe('MEDIA_INPUT_INVALID');agreementId=i.agreementId;
    if(op==='agreement-upload-list'){if(!exact(i,['agreementId']))throw new Safe('MEDIA_INPUT_INVALID');}
    else{if(!['agreement-upload-read','agreement-upload-cancel'].includes(op)||!exact(i,['agreementId','agreementVersion','clientRequestId'])||!id(i.clientRequestId)
     ||!Number.isInteger(i.agreementVersion)||i.agreementVersion<1||i.agreementVersion>2147483647)throw new Safe('MEDIA_INPUT_INVALID');version=i.agreementVersion;key=i.clientRequestId;}
   }
   const rawCall=(operation:string,data:Row={})=>rpc('rpc_agreement_photo_upload_service_v5',{p_account_id:aid,p_session_id:sessionId,p_operation:operation,p_agreement_id:agreementId,p_version:version??null,p_key:key??null,p_input:data},65536);
   if(op==='agreement-upload-list'){
    const list=row(await rawCall('LIST'));if(!list||!exact(list,['accountId','agreementId','uploads','authoritative'])||list.accountId!==aid||list.agreementId!==agreementId||list.authoritative!==true
    ||!Array.isArray(list.uploads)||list.uploads.length>120)throw new Error('INVALID_PHOTO_LIST');const keys=new Set<string>();for(const r of list.uploads){const p=photoReceipt(r,aid,agreementId);
     if(['ABSENT','FAILED','CANCELLED'].includes(p.state)||p.attachedMessageId!==null||keys.has(p.clientRequestId))throw new Error('INVALID_PHOTO_LIST');keys.add(p.clientRequestId);}return json(200,list);
   }
   const call=async(operation:string,data:Row={})=>photoTransfer(await rawCall(operation,data),aid,agreementId,version!,key!);
   if(!upload){
    let t=await call(op==='agreement-upload-cancel'?'CANCEL':'READ');
    // A restart need not retain the original image to settle an already-issued
    // upload. Positive readback may advance this same immutable dispatch only.
    // Missing/unknown bytes remain unresolved; there is never a second POST.
    if(op==='agreement-upload-read'&&t.dispatchState==='DISPATCHING'&&['STAGED','CANCELLED'].includes(t.receipt.state)){
     let stored:Uint8Array|undefined;try{stored=await objectBytes(t.path,t.sha256,t.byteSize,true);}
     catch{if(abort.signal.aborted)throw new Error('PHOTO_RECOVERY_ABORTED');}
     if(stored){stored.fill(0);t=await call('SETTLE',{sha256:t.sha256,outcome:'STORED'});}
    }return json(200,t.receipt);
   }
   releaseAdmission=await imageAdmission.acquire(abort.signal);
   if(!releaseAdmission){if(abort.signal.aborted)throw new Error('MEDIA_WAIT_ABORTED');throw new Safe('MEDIA_BUSY',429);}
   const contentType=req.headers.get('content-type')?.split(';')[0].trim().toLowerCase();if(!contentType||!['image/jpeg','image/png','image/webp'].includes(contentType))throw new Safe('MEDIA_FORMAT_UNSUPPORTED');
   try{
    input=await bytes(req,10485760,abort.signal);if(!input.length)throw new Safe('MEDIA_INPUT_INVALID');
    let t=await call('CLAIM',{sha256:await digest(input),byteSize:input.length,contentType});
    if(!t.acquired){
     if(t.receipt.state==='STAGED'&&t.dispatchState==='DISPATCHING'){
      const existing=await objectBytes(t.path,t.sha256,t.byteSize,true);existing.fill(0);t=await call('SETTLE',{sha256:t.sha256,outcome:'STORED'});
     }return json(200,t.receipt);
    }
    if(t.receipt.state!=='PROCESSING'||t.path!==null)throw new Error('INVALID_PHOTO_CLAIM');
    let clean:{bytes:Uint8Array;width:number;height:number};try{await loadMediaRuntime();clean=sanitizeImage(input,contentType,magick);}catch(error){await call('FAIL');
     const code=error instanceof Error?error.message:'';throw new Safe(safeCodes.includes(code)?code:'MEDIA_SANITIZATION_FAILED');}
    input.fill(0);try{
     const sha256=await digest(clean.bytes);t=await call('STAGE',{attemptId:t.attemptId,sha256,width:clean.width,height:clean.height,byteSize:clean.bytes.length});
     if(t.receipt.state==='CANCELLED')return json(200,t.receipt);
     if(t.receipt.state!=='STAGED'||t.sha256!==sha256||t.byteSize!==clean.bytes.length)throw new Error('INVALID_PHOTO_STAGE');
     t=await call('DISPATCH');if(!t.acquired)return json(200,t.receipt);
     if(t.receipt.state!=='STAGED'||t.dispatchState!=='DISPATCHING'||t.sha256!==sha256||t.byteSize!==clean.bytes.length)throw new Error('INVALID_PHOTO_DISPATCH');
     const posted=await fetchBound(url.origin+'/storage/v1/object/profile-media/'+t.path,{method:'POST',headers:supabaseServiceHeaders(service,{'Content-Type':'image/jpeg','x-upsert':'false'}),body:new Uint8Array(clean.bytes)});
     void posted.body?.cancel();
     if(!posted.ok&&posted.status!==409){if(posted.status>=400&&posted.status<500)await call('SETTLE',{sha256,outcome:'REJECTED'});throw new Error('PHOTO_STORAGE_UNCONFIRMED');}
     const stored=await objectBytes(t.path,sha256,t.byteSize,true);stored.fill(0);t=await call('SETTLE',{sha256,outcome:'STORED'});return json(200,t.receipt);
    }finally{clean.bytes.fill(0);}
   }finally{input?.fill(0);}
  }
  if(op==='list-need'||op==='list-profile'){
   const input=row(parse(await bytes(req,2048,abort.signal)));if(!input||Object.keys(input).length!==1)throw new Safe('MEDIA_INPUT_INVALID');
   if(op==='list-need'){
    if(!id(input.needId))throw new Safe('MEDIA_INPUT_INVALID');
    const visible=await fetchBound(url.origin+'/rest/v1/needs?id=eq.'+input.needId+'&select=id,revision,public_photo_paths',{headers:userHeaders});
    const rows=parse(await bytes(visible,32768,abort.signal));if(!visible.ok||!Array.isArray(rows)||rows.length!==1||rows[0].id!==input.needId)throw new Safe('MEDIA_NOT_FOUND',403);
    const assets=await rpc('rpc_read_need_media_assets_service',{p_need_id:input.needId,p_expected_revision:rows[0].revision});
    if(!Array.isArray(assets)||assets.length>6||!Array.isArray(rows[0].public_photo_paths)||assets.length!==rows[0].public_photo_paths.length)throw new Error('INVALID_ASSETS');
    const photos=assets.map(raw=>{const a=asset(raw);if(a.scope!=='TASK'||!rows[0].public_photo_paths.includes(a.ref))throw new Error('INVALID_ASSET');return preview(a);});
    return json(200,{needId:input.needId,photos,authoritative:true});
   }
   if(!id(input.profileId))throw new Safe('MEDIA_INPUT_INVALID');
   const visible=await fetchBound(url.origin+'/rest/v1/rpc/rpc_get_public_profile',{method:'POST',headers:userHeaders,body:JSON.stringify({p_profile_id:input.profileId})});
   const publicDocument=parse(await bytes(visible,32768,abort.signal));
   if(!visible.ok)throw new Safe('MEDIA_NOT_FOUND',403);
   let p=row(publicDocument);
   if(publicDocument===null){
    // An inactive profile has no public projection. Its owner may still see the
    // saved private avatar; the owner RPC uses the caller JWT, never service auth.
    const owned=await fetchBound(url.origin+'/rest/v1/rpc/rpc_read_profile_avatar',{method:'POST',headers:userHeaders,body:JSON.stringify({p_profile_id:input.profileId})});
    const doc=row(parse(await bytes(owned,8192,abort.signal)));
    if(!owned.ok||!doc||Object.keys(doc).length!==4||doc.profileId!==input.profileId||doc.accountId!==aid||doc.authoritative!==true)
     throw new Safe('MEDIA_NOT_FOUND',403);
    p=doc;
   }
   if(p?.profileId!==input.profileId)throw new Safe('MEDIA_NOT_FOUND',403);
   if(p.avatarPath===null)return json(200,{profileId:input.profileId,photo:null,authoritative:true});
   const path=typeof p.avatarPath==='string'?p.avatarPath.split('/'):[];
   if(path.length!==4||path[1]!=='v5'||!id(path[2]))return json(200,{profileId:input.profileId,photo:null,authoritative:true});
   const a=asset(await rpc('rpc_read_media_asset_service',{p_asset_id:path[2]}));if(a.scope!=='AVATAR'||a.profileId!==input.profileId||a.ref!==p.avatarPath)throw new Safe('MEDIA_NOT_FOUND',403);
   return json(200,{profileId:input.profileId,photo:preview(a),authoritative:true});
  }
  if(req.headers.get('x-media-operation')==='read'){
   const input=row(parse(await bytes(req,2048,abort.signal)));
   if(!input||!id(input.assetId)||Object.keys(input).some(k=>!['assetId','needId','profileId','caseId'].includes(k))
    ||(input.needId!==undefined&&!id(input.needId))||(input.profileId!==undefined&&!id(input.profileId))||(input.caseId!==undefined&&!id(input.caseId))
    ||[input.needId,input.profileId,input.caseId].filter(v=>v!==undefined).length>1)throw new Safe('MEDIA_INPUT_INVALID');
   if(input.caseId!==undefined){
    const caseId=input.caseId,assetId=input.assetId,sessionId=supportSession(authorization,aid,url.origin);
    const authorize=async()=>{
     const r=await fetchBound(url.origin+'/rest/v1/rpc/rpc_support_media_service_v5',{method:'POST',headers:serviceHeaders,
      body:JSON.stringify({p_account_id:aid,p_session_id:sessionId,p_case_id:caseId,p_asset_id:assetId})});
     const data=parse(await bytes(r,8192,abort.signal));if(!r.ok){
      if(row(data)?.message==='AUTH_REQUIRED')throw new Safe('AUTH_REQUIRED',401);
      if(row(data)?.message==='SUPPORT_REFERENCE_NOT_AVAILABLE')throw new Safe('MEDIA_NOT_FOUND',403);
      throw new Error('SUPPORT_MEDIA_UNCONFIRMED');
     }
     return supportMedia(data,caseId,assetId);
    };
    const admitted=await authorize();const b=await objectBytes(admitted.path,admitted.sha256,admitted.byteSize,true);
    try{
     // The private Storage await must not outlive a revoked grant/session. No
     // bytes reach the caller until the same exact authority is checked again.
     supportSession(authorization,aid,url.origin);const current=await authorize();
     if(current.path!==admitted.path||current.sha256!==admitted.sha256||current.byteSize!==admitted.byteSize)throw new Error('SUPPORT_MEDIA_CHANGED');
     if(abort.signal.aborted)throw new Error('CANCELLED');
     return new Response(new Uint8Array(b).buffer,{status:200,headers:{...cors,'Content-Type':'image/jpeg','Content-Length':String(b.length)}});
    }finally{b.fill(0);}
   }
   const a=asset(await rpc('rpc_read_media_asset_service',{p_asset_id:input.assetId}));
   if(a.accountId!==aid){
    if(a.scope==='TASK'&&id(input.needId)){
     const visible=await fetchBound(url.origin+'/rest/v1/needs?id=eq.'+input.needId+'&select=id,public_photo_paths',{headers:userHeaders});
     const rows=parse(await bytes(visible,32768,abort.signal));
     if(!visible.ok||!Array.isArray(rows)||rows.length!==1||rows[0].id!==input.needId||!Array.isArray(rows[0].public_photo_paths)||!rows[0].public_photo_paths.includes(a.ref))throw new Safe('MEDIA_NOT_FOUND',403);
    }else if(a.scope==='AVATAR'&&id(input.profileId)&&input.profileId===a.profileId){
     const visible=await fetchBound(url.origin+'/rest/v1/rpc/rpc_get_public_profile',{method:'POST',headers:userHeaders,body:JSON.stringify({p_profile_id:input.profileId})});
     const profile=row(parse(await bytes(visible,32768,abort.signal)));if(!visible.ok||profile?.profileId!==input.profileId||profile?.avatarPath!==a.ref)throw new Safe('MEDIA_NOT_FOUND',403);
    }else throw new Safe('MEDIA_NOT_FOUND',403);
   }
   const b=await objectBytes(a.ref,a.sha256,a.byteSize);
   return new Response(new Uint8Array(b).buffer,{status:200,headers:{...cors,'Content-Type':'image/jpeg','Content-Length':String(b.length)}});
  }
  const scope=req.headers.get('x-media-scope'),target=req.headers.get('x-media-target'),key=req.headers.get('x-media-request-id'),type=req.headers.get('content-type')?.split(';')[0];
  if(req.headers.get('x-media-operation')!=='upload'||!['TASK','AVATAR'].includes(scope??'')||!id(target)||!id(key)||!['image/jpeg','image/png','image/webp'].includes(type??''))throw new Safe('MEDIA_INPUT_INVALID');
  releaseAdmission=await imageAdmission.acquire(abort.signal);
  if(!releaseAdmission){if(abort.signal.aborted)throw new Error('MEDIA_WAIT_ABORTED');return json(429,{code:'MEDIA_UPLOAD_PENDING'});}
  const input=await bytes(req,10485760,abort.signal);
  // Legacy TASK/AVATAR transport also owns sensitive buffers on every early
  // receipt, SQL error, Storage timeout and failed sanitizer, not just success.
  const wipe:Uint8Array[]=[input];
  try{
  if(!input.length)throw new Safe('MEDIA_INPUT_INVALID');
  const claim=row(await rpc('rpc_claim_media_upload_service',{p_account_id:aid,p_scope:scope,p_target_id:target,p_client_request_id:key,
   p_input_sha256:await digest(input),p_input_bytes:input.length,p_input_type:type}));
  if(!claim||typeof claim.acquired!=='boolean')throw new Error('INVALID_CLAIM');const a=asset(claim.asset,aid);
  let staged:Row;
  if(!claim.acquired){
   if(a.state==='READY'||a.state==='FAILED'||a.state==='PROCESSING')return json(200,a);
   staged=row(claim.staged)??{};
   if(staged.dispatchState!=='DISPATCHING'&&!(staged.dispatchState==='SETTLED'&&staged.dispatchOutcome==='STORED'))return json(200,a);
  }else{
   if(!id(claim.attemptId)||a.state!=='PROCESSING')throw new Error('INVALID_CLAIM');
   let sanitized;try{sanitized=sanitizeImage(input,type,await loadMediaRuntime());wipe.push(sanitized.bytes);}
   catch(e){await rpc('rpc_fail_media_upload_service',{p_account_id:aid,p_asset_id:a.assetId,p_attempt_id:claim.attemptId});
    throw new Safe(e instanceof Error&&safeCodes.includes(e.message)?e.message:'MEDIA_SANITIZATION_FAILED');}
   input.fill(0);
   staged=row(await rpc('rpc_stage_media_upload_service',{p_account_id:aid,p_asset_id:a.assetId,p_attempt_id:claim.attemptId,
    p_sha256:await digest(sanitized.bytes),p_width:sanitized.width,p_height:sanitized.height,p_byte_size:sanitized.bytes.length}))??{};
   if(!hash(staged.sha256)||staged.path!==`${aid}/v5/${a.assetId}/${staged.sha256}.jpg`||staged.byteSize!==sanitized.bytes.length)throw new Error('INVALID_STAGE');
   const dispatch=await rpc('rpc_dispatch_media_upload_service',{p_account_id:aid,p_asset_id:a.assetId,p_attempt_id:claim.attemptId});if(dispatch!==true)throw new Error('DISPATCH_UNKNOWN');
   const stored=await fetchBound(url.origin+'/storage/v1/object/profile-media/'+staged.path,{method:'POST',headers:supabaseServiceHeaders(service,{'Content-Type':'image/jpeg','x-upsert':'false'}),body:new Uint8Array(sanitized.bytes).buffer});
   sanitized.bytes.fill(0);
   if(!stored.ok&&stored.status!==409){
    // 4xx is a definitive rejected write. Timeouts/5xx remain DISPATCHING: an
    // account cleanup cannot mistake an unknown upstream write for quiescence.
    if(stored.status>=400&&stored.status<500)await rpc('rpc_settle_media_upload_service',{p_account_id:aid,p_asset_id:a.assetId,p_storage_sha256:staged.sha256,p_outcome:'REJECTED'});
    throw new Error('STORAGE_UNCONFIRMED');
   }
   void stored.body?.cancel();
  }
  if(!hash(staged.sha256)||staged.path!==`${aid}/v5/${a.assetId}/${staged.sha256}.jpg`||!Number.isInteger(staged.byteSize)||staged.byteSize<1||staged.byteSize>5242880)throw new Error('INVALID_STAGE');
  const verified=await objectBytes(staged.path,staged.sha256,staged.byteSize);verified.fill(0);
  await rpc('rpc_settle_media_upload_service',{p_account_id:aid,p_asset_id:a.assetId,p_storage_sha256:staged.sha256,p_outcome:'STORED'});
  return json(200,asset(await rpc('rpc_complete_media_upload_service',{p_account_id:aid,p_asset_id:a.assetId,p_storage_sha256:staged.sha256}),aid));
  }finally{for(const data of wipe)data.fill(0);}
 }catch(e){return e instanceof Safe?json(e.status,{code:e.code}):json(503,{code:'MEDIA_UNCONFIRMED'});}
 finally{clearTimeout(timer);req.signal.removeEventListener('abort',stop);stop();releaseAdmission?.();}
}
Deno.serve(handleMedia);
