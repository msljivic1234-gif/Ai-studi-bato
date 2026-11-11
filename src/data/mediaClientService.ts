import type { Ishod } from './ports';
import { sesijaSada } from '../store/sesija';
import { supabaseKlijent } from './supabaseClient';
import { failure, readOwnedResult, record, sameId, uuid } from './serverReceipt';
import { readMediaBinary } from './mediaBinaryRead';

export type MediaAsset = Readonly<{ assetId:string; accountId:string; scope:'TASK'|'AVATAR'; conversationId:string|null; profileId:string|null;
  clientRequestId:string; state:'PROCESSING'|'STAGED'|'READY'|'FAILED'; selected:boolean; ref:string|null; sha256:string|null;
  width:number|null; height:number|null; byteSize:number|null; contentType:'image/jpeg'; authoritative:true }>;
export type TaskPhotos = Readonly<{ conversationId:string; accountId:string; photos:MediaAsset[]; ready:boolean; authoritative:true }>;
export type MediaUpload = Readonly<{ clientRequestId:string; bytes:ArrayBuffer; contentType:'image/jpeg'|'image/png'|'image/webp' }>;
export type MediaRequestOptions = Readonly<{ signal?:AbortSignal }>;
export type MediaReadContext = Readonly<{needId?:string;profileId?:string;caseId?:string;agreementId?:string;messageId?:string}>;
export type MediaImage = Readonly<{ bytes:ArrayBuffer; contentType:'image/jpeg'; assetId:string }>;
export type AvatarSaved = Readonly<{ profileId:string; accountId:string; assetId:string; avatarPath:string; saved:true; authoritative:true }>;
export type ProfileAvatar = Readonly<{ profileId:string; accountId:string; avatarPath:string|null; authoritative:true }>;
export type MediaPreview = Readonly<{assetId:string;width:number;height:number;contentType:'image/jpeg'}>;
export type NeedPhotos = Readonly<{needId:string;photos:MediaPreview[];authoritative:true}>;
export type ProfilePhoto = Readonly<{profileId:string;photo:MediaPreview|null;authoritative:true}>;
export type AvatarDiscarded = Readonly<{assetId:string;profileId:string;accountId:string;discarded:true;authoritative:true}>;
/** PKG-008: the server's own cancellation receipt. `previousState:null` is the durable tombstone for a
 * command that never reached the claim; any other value is an admitted command that is now deselected. */
export type MediaUploadCancelled=Readonly<{accountId:string;conversationId:string;clientRequestId:string;previousState:MediaAsset['state']|null;
  assetId:string|null;selected:false;cancelled:true;authoritative:true}>;
const hash=(v:unknown):v is string=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
const integer=(v:unknown,max:number):v is number=>typeof v==='number'&&Number.isInteger(v)&&v>=1&&v<=max;
const errors={ AUTH_REQUIRED:'Prijavi se da nastaviš.',MEDIA_NOT_FOUND:'Fotografija nije dostupna.',
  MEDIA_INPUT_INVALID:'Fotografija mora biti JPEG, PNG ili WebP do 10 MB.',MEDIA_FORMAT_UNSUPPORTED:'Izaberi JPEG, PNG ili WebP fotografiju.',
  MEDIA_DIMENSIONS_TOO_LARGE:'Smanji fotografiju pre slanja.',MEDIA_LIMIT_REACHED:'Jedan zadatak može imati najviše šest fotografija.',
  // Deep read 11.3: the media worker serialises every upload on an isolate, so this refusal is usually
  // about someone else's photo; it must not claim the person's own upload is unconfirmed.
  MEDIA_UPLOAD_PENDING:'Slanje fotografije je trenutno zauzeto. Sačekaj nekoliko sekundi pa pokušaj ponovo.',MEDIA_BUSY:'Slanje fotografije je trenutno zauzeto. Sačekaj nekoliko sekundi pa pokušaj ponovo.',MEDIA_TURN_PENDING:'Sačekaj završetak AI poruke.',
  MEDIA_NOT_EDITABLE:'Fotografije sada ne mogu da se menjaju.',MEDIA_VERSION_CONFLICT:'Avatar je promenjen. Osveži profil.',
  IDEMPOTENCY_KEY_REUSED:'Zahtev pripada drugoj fotografiji. Osveži prikaz.',PUBLIC_MEDIA_NOT_READY:'Sačekaj da se fotografije obrade.',
  MEDIA_COMMAND_CONFLICT:'Ovaj zahtev pripada drugoj fotografiji ili zadatku. Osveži prikaz.',
  // PKG-046: a delayed first send of a command the owner already cancelled is refused by the server.
  MEDIA_COMMAND_CANCELLED:'Ovo slanje je otkazano. Fotografija nije prihvaćena.',
  MEDIA_SANITIZATION_FAILED:'Fotografija nije mogla bezbedno da se obradi.' };
export function decodeMediaAsset(raw:unknown,accountId?:string):MediaAsset|null{
  const a=record(raw);if(!a||Object.keys(a).length!==15||!uuid(a.assetId)||!uuid(a.accountId)||(accountId&&!sameId(a.accountId,accountId))
    ||!uuid(a.clientRequestId)||(a.scope!=='TASK'&&a.scope!=='AVATAR')||(a.scope==='TASK'?(!uuid(a.conversationId)||a.profileId!==null):(!uuid(a.profileId)||a.conversationId!==null))
    ||!['PROCESSING','STAGED','READY','FAILED'].includes(String(a.state))||typeof a.selected!=='boolean'||a.contentType!=='image/jpeg'||a.authoritative!==true)return null;
  if(a.state==='READY'){
    if(!hash(a.sha256)||typeof a.ref!=='string'||a.ref!==`${a.accountId}/v5/${a.assetId}/${a.sha256}.jpg`
      ||!integer(a.width,1600)||!integer(a.height,1600)||!integer(a.byteSize,5242880))return null;
  }else if(a.ref!==null||a.sha256!==null||a.width!==null||a.height!==null||a.byteSize!==null)return null;
  return {assetId:a.assetId,accountId:a.accountId,scope:a.scope,conversationId:a.conversationId as string|null,profileId:a.profileId as string|null,
    clientRequestId:a.clientRequestId,state:a.state as MediaAsset['state'],selected:a.selected,ref:a.ref as string|null,sha256:a.sha256 as string|null,
    width:a.width as number|null,height:a.height as number|null,byteSize:a.byteSize as number|null,contentType:'image/jpeg',authoritative:true};
}
export function decodeTaskPhotos(raw:unknown,accountId:string,cid:string):TaskPhotos|null{
  const r=record(raw);if(!r||Object.keys(r).length!==5||!sameId(r.accountId,accountId)||!sameId(r.conversationId,cid)
    ||!Array.isArray(r.photos)||r.photos.length>6||typeof r.ready!=='boolean'||r.authoritative!==true)return null;
  const photos=r.photos.map(p=>decodeMediaAsset(p,accountId));
  if(photos.some(a=>!a||a.scope!=='TASK'||!a.selected)||(r.ready&&photos.some(a=>a?.state!=='READY'))
    ||new Set(photos.map(a=>a?.assetId)).size!==photos.length)return null;
  return {conversationId:cid,accountId,photos:photos as MediaAsset[],ready:r.ready,authoritative:true};
}
function decodeMediaUploadCancelled(raw:unknown,accountId:string,cid:string,key:string):MediaUploadCancelled|null{
  const r=record(raw);if(!r||Object.keys(r).length!==8||!sameId(r.accountId,accountId)||!sameId(r.conversationId,cid)||!sameId(r.clientRequestId,key)
    ||!(r.previousState===null||['PROCESSING','STAGED','READY','FAILED'].includes(String(r.previousState)))
    ||(r.previousState===null?r.assetId!==null:!uuid(r.assetId))||r.selected!==false||r.cancelled!==true||r.authoritative!==true)return null;
  return {accountId,conversationId:cid,clientRequestId:key,previousState:r.previousState as MediaUploadCancelled['previousState'],
    assetId:r.assetId as string|null,selected:false,cancelled:true,authoritative:true};
}
function decodeProfileAvatar(raw:unknown,aid:string,pid:string):ProfileAvatar|null{
  const r=record(raw);return r&&Object.keys(r).length===4&&sameId(r.accountId,aid)&&sameId(r.profileId,pid)
    &&(r.avatarPath===null||(typeof r.avatarPath==='string'&&r.avatarPath.length<=2048))&&r.authoritative===true
    ?{profileId:pid,accountId:aid,avatarPath:r.avatarPath,authoritative:true}:null;
}
const preview=(raw:unknown):MediaPreview|null=>{const p=record(raw);return p&&Object.keys(p).length===4&&uuid(p.assetId)
  &&integer(p.width,1600)&&integer(p.height,1600)&&p.contentType==='image/jpeg'?{assetId:p.assetId,width:p.width,height:p.height,contentType:'image/jpeg'}:null;};
function gallery<T>(operation:string,input:Record<string,string>,decode:(v:unknown)=>T|null):Promise<Ishod<T>>{
  return readOwnedResult({errors,fallback:'MEDIA_UNAVAILABLE',invalid:'MEDIA_INVALID_RESPONSE',
    request:()=>supabaseKlijent().functions.invoke('uskoci-media',{body:input,headers:{'x-media-operation':operation}}),decode});
}
function call<T>(name:string,args:Record<string,unknown>,decode:(raw:unknown,aid:string)=>T|null,write=false):Promise<Ishod<T>>{
  const owner=sesijaSada();if(!owner.user?.id)return Promise.resolve(failure('AUTH_REQUIRED',errors.AUTH_REQUIRED));
  const account={accountId:owner.user.id,accountRevision:owner.accountRevision};
  return readOwnedResult({account,request:()=>supabaseKlijent().rpc(name,args),decode:v=>decode(v,account.accountId),errors,write,
    fallback:'MEDIA_UNCONFIRMED',invalid:'MEDIA_INVALID_RESPONSE'});
}
async function upload(scope:'TASK'|'AVATAR',targetId:string,input:MediaUpload,options:MediaRequestOptions={}):Promise<Ishod<MediaAsset>>{
  const owner=sesijaSada();if(!owner.user?.id)return failure('AUTH_REQUIRED',errors.AUTH_REQUIRED);
  if(!uuid(targetId)||!uuid(input.clientRequestId)||!(input.bytes instanceof ArrayBuffer)||input.bytes.byteLength<1||input.bytes.byteLength>10485760
    ||!['image/jpeg','image/png','image/webp'].includes(input.contentType)||options.signal?.aborted)return failure('MEDIA_INPUT_INVALID',errors.MEDIA_INPUT_INVALID);
  const account={accountId:owner.user.id,accountRevision:owner.accountRevision};
  return readOwnedResult({account,write:true,errors,fallback:'MEDIA_UNCONFIRMED',invalid:'MEDIA_INVALID_RESPONSE',
    request:async()=>{
      const result=await supabaseKlijent().functions.invoke('uskoci-media',{body:input.bytes,headers:{'Content-Type':input.contentType,
        'x-media-operation':'upload','x-media-scope':scope,'x-media-target':targetId,'x-media-request-id':input.clientRequestId},signal:options.signal});
      if(result.error){const context=record(result.error)?.context;if(context instanceof Response){try{const e=record(await context.json());
        if(e&&typeof e.code==='string'&&Object.hasOwn(errors,e.code))return {data:null,error:{message:e.code}};}catch{/* bounded safe fallback */}}}
      return result;
    },decode:v=>{const a=decodeMediaAsset(v,account.accountId);return a&&sameId(a.clientRequestId,input.clientRequestId)&&a.scope===scope
      &&sameId(scope==='TASK'?a.conversationId:a.profileId,targetId)?a:null;}});
}
export const mediaClientService={
  uploadTaskPhoto:(input:MediaUpload&{conversationId:string},options?:MediaRequestOptions)=>upload('TASK',input.conversationId,input,options),
  uploadAvatar:(input:MediaUpload&{profileId:string},options?:MediaRequestOptions)=>upload('AVATAR',input.profileId,input,options),
  readProfileAvatar:(profileId:string)=>call('rpc_read_profile_avatar',{p_profile_id:profileId},(v,a)=>decodeProfileAvatar(v,a,profileId)),
  readNeedPhotos:(needId:string)=>gallery<NeedPhotos>('list-need',{needId},v=>{const r=record(v);if(!r||Object.keys(r).length!==3||!sameId(r.needId,needId)
    ||!Array.isArray(r.photos)||r.photos.length>6||r.authoritative!==true)return null;const photos=r.photos.map(preview);
    return photos.some(p=>!p)||new Set(photos.map(p=>p?.assetId)).size!==photos.length?null:{needId,photos:photos as MediaPreview[],authoritative:true};}),
  readProfilePhoto:(profileId:string)=>gallery<ProfilePhoto>('list-profile',{profileId},v=>{const r=record(v),photo=r?.photo===null?null:preview(r?.photo);
    return r&&Object.keys(r).length===3&&sameId(r.profileId,profileId)&&r.authoritative===true&&(r.photo===null||photo)
      ?{profileId,photo,authoritative:true}:null;}),
  clearAvatar:(input:{profileId:string;expectedAvatarPath:string|null})=>call('rpc_clear_profile_avatar',
    {p_profile_id:input.profileId,p_expected_avatar_path:input.expectedAvatarPath},(v,a)=>decodeProfileAvatar(v,a,input.profileId),true),
  discardAvatar:({assetId,profileId}:{assetId:string;profileId:string})=>!uuid(assetId)||!uuid(profileId)
    ?Promise.resolve(failure('MEDIA_INPUT_INVALID',errors.MEDIA_INPUT_INVALID))
    :call<AvatarDiscarded>('rpc_discard_profile_avatar',{p_asset_id:assetId},(v,aid)=>{const r=record(v);
      return r&&Object.keys(r).length===5&&sameId(r.assetId,assetId)&&sameId(r.accountId,aid)&&sameId(r.profileId,profileId)&&r.discarded===true&&r.authoritative===true
        ?{assetId,profileId,accountId:aid,discarded:true,authoritative:true}:null;},true),
  readTaskPhotos:(conversationId:string)=>call('rpc_read_task_photos',{p_conversation_id:conversationId},(v,a)=>decodeTaskPhotos(v,a,conversationId)),
  readUploadCommand:(clientRequestId:string)=>call('rpc_read_media_upload',{p_client_request_id:clientRequestId},(v,a)=>{
    const result=decodeMediaAsset(v,a);return result&&sameId(result.clientRequestId,clientRequestId)?result:null;}),
  /** PKG-008: authoritative owner cancellation of one unconfirmed Task upload command. The server fences a
   * delayed first send (tombstone) or deselects an admitted one; the client never erases the identity itself. */
  cancelUploadCommand:(input:{conversationId:string;clientRequestId:string})=>!uuid(input.conversationId)||!uuid(input.clientRequestId)
    ?Promise.resolve(failure('MEDIA_INPUT_INVALID',errors.MEDIA_INPUT_INVALID))
    :call('rpc_cancel_media_upload',{p_conversation_id:input.conversationId,p_client_request_id:input.clientRequestId},
      (v,a)=>decodeMediaUploadCancelled(v,a,input.conversationId,input.clientRequestId),true),
  removeTaskPhoto:(input:{conversationId:string;assetId:string})=>call('rpc_remove_task_photo',{p_conversation_id:input.conversationId,p_asset_id:input.assetId},
    (v,a)=>decodeTaskPhotos(v,a,input.conversationId),true),
  applyAvatar:(input:{assetId:string;profileId:string;expectedAvatarPath:string|null})=>call<AvatarSaved>('rpc_apply_profile_avatar',
    {p_asset_id:input.assetId,p_expected_avatar_path:input.expectedAvatarPath},(v,aid)=>{const r=record(v);
      return r&&Object.keys(r).length===6&&sameId(r.profileId,input.profileId)&&sameId(r.accountId,aid)&&sameId(r.assetId,input.assetId)
        &&typeof r.avatarPath==='string'&&r.avatarPath.startsWith(`${aid}/v5/${input.assetId}/`)&&r.saved===true&&r.authoritative===true
        ?{profileId:input.profileId,accountId:aid,assetId:input.assetId,avatarPath:r.avatarPath,saved:true,authoritative:true}:null;},true),
  async readMedia(assetId:string,context:MediaReadContext={},options:MediaRequestOptions={}):Promise<Ishod<MediaImage>>{
    const owner=sesijaSada();if(!owner.user?.id)return failure('AUTH_REQUIRED',errors.AUTH_REQUIRED);
    const account={accountId:owner.user.id,accountRevision:owner.accountRevision};
    const input=record(context),values=input?Object.values(input).filter(v=>v!==undefined):[];
    const agreement = context.agreementId !== undefined;
    if(!uuid(assetId)||!input||Object.keys(input).some(k=>!['needId','profileId','caseId','agreementId','messageId'].includes(k))
      ||(agreement ? !uuid(context.agreementId)||context.needId!==undefined||context.profileId!==undefined||context.caseId!==undefined
        : values.length>1||context.messageId!==undefined)
      ||values.some(v=>!uuid(v))||options.signal?.aborted)return failure('MEDIA_NOT_FOUND',errors.MEDIA_NOT_FOUND);
    const readContext={...(context.needId?{needId:context.needId}:{}),...(context.profileId?{profileId:context.profileId}:{}),
      ...(context.caseId?{caseId:context.caseId}:{}), ...(context.agreementId?{agreementId:context.agreementId}:{}),
      ...(context.messageId?{messageId:context.messageId}:{})};
    return readOwnedResult({account,errors,fallback:'MEDIA_UNAVAILABLE',invalid:'MEDIA_INVALID_RESPONSE',request:async()=>{
      const result=await readMediaBinary({account,body:{assetId,...readContext},operation:agreement?'agreement-read':'read',signal:options.signal});
      return result.data ? {data:{...result.data,assetId},error:null} : result;
    },decode:raw=>{const r=record(raw);return r&&r.bytes instanceof ArrayBuffer&&r.contentType==='image/jpeg'&&sameId(r.assetId,assetId)
      ?{bytes:r.bytes,contentType:'image/jpeg',assetId}:null;}});
  },
};
