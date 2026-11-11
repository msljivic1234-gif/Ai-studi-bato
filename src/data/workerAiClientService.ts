import { AI_CREDITS_UNAVAILABLE, AI_CREDITS_UNAVAILABLE_COPY } from '../contracts/aiAvailability';
import { decodeWorkerAreas, type WorkerArea } from '../contracts/workerAreas';
import { decodeServiceHandoff } from '../contracts/serviceHandoff';
import type { AiConversationIntent } from '../contracts/aiConversationIntent';
import { decodeTaxonomySemanticReviewCandidates, type TaxonomySemanticReviewCandidate } from '../contracts/taxonomySemanticReview';
import type { WorkerLocation } from '../contracts/location';
import type { WorkerAvailabilityInput, AvailabilityRule, AvailabilityWindow } from '../contracts/workerAvailability';
import type { Ishod } from './ports';
import { capabilityTerms } from '../lib/capabilityTerms';
import { countryCode } from '../lib/market';
import { normalizeWorkerAvailability } from '../lib/workerAvailability';
import { calendarInstant } from '../lib/calendarTime';
import { sesijaSada } from '../store/sesija';
import { failure, readOwnedResult, record, sameId, uuid, type ReceiptAccount } from './serverReceipt';
import { supabaseKlijent } from './supabaseClient';
import { readPublicSupabaseConfig } from './publicSupabaseConfig';
import { requestAiTurnStream, type AiTurnStreamOptions } from './aiNeedTurnStream';

export type WorkerAiProfile = Readonly<{
  displayName: string; bio: string; skills: string[]; tools: string[]; vehicles: string[]; licenses: string[];
  teamCapacity: number; location: Omit<WorkerLocation,'profileId'|'accountId'|'revision'>; availability: WorkerAvailabilityInput;
  workAreas?:WorkerArea[];
}>;
export type WorkerAiPatch = Partial<Pick<WorkerAiProfile,'displayName'|'bio'|'skills'|'tools'|'vehicles'|'licenses'|'teamCapacity'>> & {
  location?: Partial<WorkerAiProfile['location']>;
  availability?: Partial<Pick<WorkerAvailabilityInput,'timezone'|'availableNow'>> & {
    ruleChanges?: { ruleId: string | null; weekdays: number[]; value: Omit<AvailabilityRule,'id'|'weekdays'> | null }[];
    windowsUpsert?: (Omit<AvailabilityWindow,'id'> & { id: string | null })[]; windowIdsRemove?: string[];
  };
};
export type WorkerAiTurn = Readonly<{ turnId: string; conversationId: string; clientRequestId: string; attemptId: string;
  state: 'PROCESSING'|'SUCCEEDED'|'FAILED'|'UNKNOWN_OUTCOME'; retryAllowed: false; authoritative: true }>;
export type WorkerAiTurnRecovery = Readonly<{ schemaVersion:'WORKER_PROFILE_V1'; accountId:string; conversationId:string; profileId:string;
  conversationStatus:'OPEN'|'COMPLETED'|'ABANDONED'; clientRequestId:string; turn:WorkerAiTurn|null;
  providerDispatched:boolean; cancelled:boolean; canCancel:boolean; retryAllowed:boolean; authoritative:true }>;
export type WorkerAiReviewedMode = Readonly<{service:string;mode:'ON_SITE'|'REMOTE'}>;
export type WorkerAiModeChoice = 'ON_SITE'|'REMOTE'|'BOTH';
// Client never assumes a scope from the skill label, city or AI text.
export function explicitWorkerModes(skills:readonly string[],choices:Readonly<Record<string,WorkerAiModeChoice|undefined>>):WorkerAiReviewedMode[]|null {
  if(!skills.length||skills.length>12||new Set(skills).size!==skills.length)return null;
  const result:WorkerAiReviewedMode[]=[];
  for(const service of skills){
    const value=choices[service];
    if(!['ON_SITE','REMOTE','BOTH'].includes(value??''))return null;
    if(value==='ON_SITE'||value==='BOTH')result.push({service,mode:'ON_SITE'});
    if(value==='REMOTE'||value==='BOTH')result.push({service,mode:'REMOTE'});
  }
  return result.length<=24?result:null;
}
export type WorkerAiClassificationCandidate = Readonly<{handoff?:import('../contracts/serviceHandoff').ServiceHandoff} & (
  {action:'REUSE_EXISTING';service:string;mode:'ON_SITE'|'REMOTE';categoryId:string;categoryLabel?:string;categoryParentId?:string|null;catalogVersion:number;reason:string}|
  {action:'EXTEND_MODE';service:string;mode:'ON_SITE'|'REMOTE';categoryId:string;categoryLabel:string;categoryParentId:string|null;
    catalogVersion:number;reason:string}|
  {action:'CREATE_CHILD';service:string;mode:'ON_SITE'|'REMOTE';parentId:string;parentLabel:string;
    path:string[];catalogVersion:number;reason:string}|
  {action:'CREATE_NEW_BRANCH';service:string;mode:'ON_SITE'|'REMOTE';parentId:null;parentLabel:null;
    path:string[];catalogVersion:number;reason:string})>;
export type WorkerAiClassificationState = 'READY'|'PENDING_CLASSIFICATION'|'REVIEW_REQUIRED'|
  'SERVICE_MODE_CONFIRMATION_REQUIRED'|'CATALOG_UNAVAILABLE'|'STALE_CATALOG';
export type WorkerAiReviewClassification = Readonly<{
  classificationState:WorkerAiClassificationState;
  classificationCandidates:WorkerAiClassificationCandidate[];
  reviewedServiceModes:WorkerAiReviewedMode[];
  classificationCatalogVersion:number|null;
  classificationCatalogFingerprint:string|null;
  /** A signed but unapproved existing-ID meaning comparison, never READY. */
  semanticReviewCandidates?:TaxonomySemanticReviewCandidate[];
}>;
export type WorkerAiReview = Readonly<{ schemaVersion:'WORKER_PROFILE_V1'; reviewId:string; conversationId:string; accountId:string;
  profileId:string; revision:number; profile:WorkerAiProfile; activate:boolean; missingRequired:string[]; canAccept:boolean;
  expiresAt:string; displayedContentDigest:string; equipmentPolicy?:'PRESERVE_LEGACY_NO_WRITE_V1'; workAreaPolicy?:'SIGNED_WORK_AREAS_V1' }> & Partial<WorkerAiReviewClassification>;
export type WorkerAiSaved = Readonly<{ reviewId:string; conversationId:string; accountId:string; profileId:string;
  profileStatus:'DRAFT'|'ACTIVE'; saved:true; authoritative:true }>;
export type WorkerAiSnapshot = Readonly<{ schemaVersion:'WORKER_PROFILE_V1'; conversationId:string; accountId:string; profileId:string;
  status:'OPEN'|'COMPLETED'|'ABANDONED'; profileStatus:'DRAFT'|'ACTIVE'; revision:number; candidate:WorkerAiProfile;
  safety:'ALLOW'|'CLARIFY'|'REVIEW'|'BLOCK'; stale:boolean;
  messages:{ id:string; role:'USER'|'ASSISTANT'; body:string; sequence:number }[];
  turn:WorkerAiTurn|null; review:WorkerAiReview|null; saved:WorkerAiSaved|null }>;
const exact=(v:Record<string,unknown>,fields:string[])=>Object.keys(v).length===fields.length&&fields.every(k=>Object.hasOwn(v,k));
const revision=(v:unknown):v is number=>typeof v==='number'&&Number.isSafeInteger(v)&&v>=0&&v<=2_147_483_647;
const text=(v:unknown,max:number):v is string=>typeof v==='string'&&v.length<=max&&!/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(v);
const digest=(v:unknown):v is string=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
export function decodeWorkerAiProfile(raw:unknown):WorkerAiProfile|null {
  const v=record(raw),loc=record(v?.location);
  const hasAreas=!!v&&Object.hasOwn(v,'workAreas');
  const fields=['displayName','bio','skills','tools','vehicles','licenses','teamCapacity','location','availability'];
  const workAreas=hasAreas?decodeWorkerAreas(v!.workAreas):undefined;
  if(!v||!exact(v,hasAreas?[...fields,'workAreas']:fields)||(hasAreas&&!workAreas)
    ||!text(v.displayName,160)||!text(v.bio,4000)||!revision(v.teamCapacity)||v.teamCapacity<1||v.teamCapacity>50
    ||!loc||!exact(loc,['operatingCountryCode','city','radiusKm','approximatePosition'])||!text(loc.city,160)
    ||!revision(loc.radiusKm)||loc.radiusKm<1||loc.radiusKm>200) return null;
  const country=loc.operatingCountryCode===null?null:countryCode(loc.operatingCountryCode);
  if(loc.operatingCountryCode!==null&&!country)return null;
  let approximatePosition:WorkerAiProfile['location']['approximatePosition']=null;
  if(loc.approximatePosition!==null) {
    const point=record(loc.approximatePosition);
    if(!point||!exact(point,['latitude','longitude'])||typeof point.latitude!=='number'||!Number.isFinite(point.latitude)
      ||typeof point.longitude!=='number'||!Number.isFinite(point.longitude)||Math.abs(point.latitude)>90||Math.abs(point.longitude)>180
      ||Math.abs(Math.round(point.latitude*100)/100-point.latitude)>1e-10||Math.abs(Math.round(point.longitude*100)/100-point.longitude)>1e-10)return null;
    approximatePosition={latitude:point.latitude,longitude:point.longitude};
  }
  const skills=capabilityTerms(v.skills),tools=capabilityTerms(v.tools),vehicles=capabilityTerms(v.vehicles),licenses=capabilityTerms(v.licenses);
  const availability=normalizeWorkerAvailability(v.availability);
  if(!skills||!tools||!vehicles||!licenses||!availability)return null;
  return {displayName:v.displayName,bio:v.bio,skills,tools,vehicles,licenses,teamCapacity:v.teamCapacity,...(hasAreas?{workAreas:workAreas!}:{}),
    location:{operatingCountryCode:country,city:loc.city,radiusKm:loc.radiusKm,approximatePosition},availability};
}
function decodeWorkerAiTurn(raw:unknown,cid:string,key?:string):WorkerAiTurn|null {
  const v=record(raw);
  if(!v||!exact(v,['turnId','conversationId','clientRequestId','attemptId','state','retryAllowed','authoritative'])
    ||!uuid(v.turnId)||!sameId(v.conversationId,cid)||!uuid(v.clientRequestId)||(key&&!sameId(v.clientRequestId,key))||!uuid(v.attemptId)
    ||(v.state!=='PROCESSING'&&v.state!=='SUCCEEDED'&&v.state!=='FAILED'&&v.state!=='UNKNOWN_OUTCOME')||v.retryAllowed!==false||v.authoritative!==true)return null;
  return {turnId:v.turnId,conversationId:v.conversationId,clientRequestId:v.clientRequestId,attemptId:v.attemptId,state:v.state,retryAllowed:false,authoritative:true};
}
export function decodeWorkerAiTurnRecovery(raw:unknown,account:string,cid:string,key:string):WorkerAiTurnRecovery|null {
  const v=record(raw);
  if(!v||!exact(v,['schemaVersion','accountId','conversationId','profileId','conversationStatus','clientRequestId','turn',
    'providerDispatched','cancelled','canCancel','retryAllowed','authoritative'])||v.schemaVersion!=='WORKER_PROFILE_V1'
    ||!sameId(v.accountId,account)||!sameId(v.conversationId,cid)||!sameId(v.clientRequestId,key)||!uuid(v.profileId)
    ||(v.conversationStatus!=='OPEN'&&v.conversationStatus!=='COMPLETED'&&v.conversationStatus!=='ABANDONED')
    ||typeof v.providerDispatched!=='boolean'||typeof v.cancelled!=='boolean'||typeof v.canCancel!=='boolean'
    ||typeof v.retryAllowed!=='boolean'||v.authoritative!==true)return null;
  const turn=v.turn===null?null:decodeWorkerAiTurn(v.turn,cid,key);
  if(v.turn!==null&&!turn)return null;
  if((!turn&&(v.providerDispatched||v.cancelled))||(v.cancelled&&(turn?.state!=='FAILED'||v.canCancel||v.retryAllowed))
    ||(v.retryAllowed&&(!!turn||!v.canCancel||v.conversationStatus!=='OPEN'))
    ||(v.canCancel&&(v.conversationStatus!=='OPEN'||v.cancelled||!!turn&&!['PROCESSING','UNKNOWN_OUTCOME'].includes(turn.state))))return null;
  return {schemaVersion:'WORKER_PROFILE_V1',accountId:v.accountId,conversationId:v.conversationId,profileId:v.profileId,
    conversationStatus:v.conversationStatus,clientRequestId:v.clientRequestId,turn,providerDispatched:v.providerDispatched,
    cancelled:v.cancelled,canCancel:v.canCancel,retryAllowed:v.retryAllowed,authoritative:true};
}
// Gate A: strict dual-wire parser. An old installed APK still receives its exact
// WORKER_PROFILE_V1 review; a new signed projection must display EVERY mode that
// can later be bound. Neither Gemini hints nor global mode heuristics grant it.
const classKeys=['classificationState','classificationCandidates','reviewedServiceModes',
  'classificationCatalogVersion','classificationCatalogFingerprint'] as const;
const knownStates:readonly WorkerAiClassificationState[]=['READY','PENDING_CLASSIFICATION','REVIEW_REQUIRED',
  'SERVICE_MODE_CONFIRMATION_REQUIRED','CATALOG_UNAVAILABLE','STALE_CATALOG'];
function decodeClassification(v:Record<string,unknown>,profile:WorkerAiProfile):WorkerAiReviewClassification|null {
  if(!knownStates.includes(v.classificationState as WorkerAiClassificationState)
    ||!Array.isArray(v.classificationCandidates)||v.classificationCandidates.length>24
    ||!Array.isArray(v.reviewedServiceModes)||v.reviewedServiceModes.length>24)return null;
  const state=v.classificationState as WorkerAiClassificationState;
  const result:WorkerAiReviewClassification={classificationState:state,
    classificationCandidates:[],reviewedServiceModes:[],
    classificationCatalogVersion:null,classificationCatalogFingerprint:null};
  if(state!=='READY'){
    if(Object.hasOwn(v,'semanticReviewCandidates')){
      if(state!=='REVIEW_REQUIRED'||v.classificationCandidates.length!==0||v.reviewedServiceModes.length!==0
        ||!revision(v.classificationCatalogVersion)||Number(v.classificationCatalogVersion)<1
        ||typeof v.classificationCatalogFingerprint!=='string'
        ||!/^[a-f0-9]{32}$/.test(v.classificationCatalogFingerprint))return null;
      const candidate=decodeTaxonomySemanticReviewCandidates(
        v.semanticReviewCandidates,v.classificationCatalogVersion,profile.skills);
      return candidate?{...result,semanticReviewCandidates:candidate,
        classificationCatalogVersion:v.classificationCatalogVersion as number,
        classificationCatalogFingerprint:v.classificationCatalogFingerprint}:null;
    }
    return v.classificationCandidates.length===0&&v.reviewedServiceModes.length===0
      &&v.classificationCatalogVersion===null&&v.classificationCatalogFingerprint===null?result:null;
  }
  if(Object.hasOwn(v,'semanticReviewCandidates'))return null;
  const version=v.classificationCatalogVersion;
  if(!revision(version)||version<1||typeof v.classificationCatalogFingerprint!=='string'
    ||!/^([a-f0-9]{32})$/.test(v.classificationCatalogFingerprint))return null;
  const seen=new Set<string>(),covered=new Set<string>(),canonicalSkills=new Set(profile.skills);
  for(const rawMode of v.reviewedServiceModes){
    const m=record(rawMode);
    if(!m||!exact(m,['service','mode'])||typeof m.service!=='string'||!canonicalSkills.has(m.service)
      ||(m.mode!=='ON_SITE'&&m.mode!=='REMOTE'))return null;
    const key=m.service+'|'+m.mode;
    if(seen.has(key))return null;
    seen.add(key);covered.add(m.service);
    result.reviewedServiceModes.push({service:m.service,mode:m.mode});
  }
  if(covered.size!==canonicalSkills.size||!seen.size||v.classificationCandidates.length!==seen.size)return null;
  const plans=new Set<string>();
  for(const rawPlan of v.classificationCandidates){
    const c=record(rawPlan);
    if(!c||typeof c.service!=='string'
      ||(c.mode!=='ON_SITE'&&c.mode!=='REMOTE')
      ||c.catalogVersion!==version||!text(c.reason,1000)||!c.reason.trim())return null;
    const hasHandoff=Object.hasOwn(c,'handoff');
    if(hasHandoff&&(c.mode!=='REMOTE'||!decodeServiceHandoff(c.handoff)))return null;
    const candidateKeys=(keys:string[])=>hasHandoff?[...keys,'handoff']:keys;
    const hasLabel=Object.hasOwn(c,'categoryLabel');
    const reuseKeys=hasLabel
      ? ['action','service','mode','categoryId','categoryLabel','categoryParentId','catalogVersion','reason']
      : ['action','service','mode','categoryId','catalogVersion','reason'];
    const reuse=c.action==='REUSE_EXISTING'&&exact(c,candidateKeys(reuseKeys))
      &&uuid(c.categoryId)
      &&(!hasLabel||(text(c.categoryLabel,120)&&c.categoryLabel.trim().length>=3&&(c.categoryParentId===null||uuid(c.categoryParentId))));
    const extend=c.action==='EXTEND_MODE'&&exact(c,candidateKeys(['action','service','mode','categoryId','categoryLabel','categoryParentId','catalogVersion','reason']))
      &&uuid(c.categoryId)&&text(c.categoryLabel,120)&&c.categoryLabel.trim().length>=3
      &&(c.categoryParentId===null||uuid(c.categoryParentId));
    const child=c.action==='CREATE_CHILD'&&exact(c,candidateKeys(['action','service','mode','parentId','parentLabel','path','catalogVersion','reason']))
      &&uuid(c.parentId)&&text(c.parentLabel,120)&&c.parentLabel.trim().length>=3
      &&Array.isArray(c.path)&&c.path.length>=1&&JSON.stringify(c.path).length<=12000
      &&c.path.every(x=>text(x,120)&&x.trim().length>=3)
      &&c.path[c.path.length-1]===c.service;
    const root=c.action==='CREATE_NEW_BRANCH'&&exact(c,candidateKeys(['action','service','mode','parentId','parentLabel','path','catalogVersion','reason']))
      &&c.parentId===null&&c.parentLabel===null
      &&Array.isArray(c.path)&&c.path.length>=1&&JSON.stringify(c.path).length<=12000
      &&c.path.every(x=>text(x,120)&&x.trim().length>=3)
      &&c.path[c.path.length-1]===c.service;
    if(!reuse&&!extend&&!child&&!root)return null;
    const key=c.service+'|'+c.mode;
    if(!seen.has(key)||plans.has(key))return null;
    plans.add(key);
    const handoff=hasHandoff?{handoff:decodeServiceHandoff(c.handoff)!}:{};
    const extraReuse=hasLabel
      ?{categoryLabel:c.categoryLabel as string,categoryParentId:c.categoryParentId as string|null}
      :{};
    result.classificationCandidates.push(reuse
      ?{...handoff,action:'REUSE_EXISTING',service:c.service,mode:c.mode,categoryId:c.categoryId as string,
        ...extraReuse,catalogVersion:version,reason:c.reason}
      :extend?{...handoff,action:'EXTEND_MODE',service:c.service,mode:c.mode,categoryId:c.categoryId as string,
        categoryLabel:c.categoryLabel as string,categoryParentId:c.categoryParentId as string|null,catalogVersion:version,reason:c.reason}
      :child?{...handoff,action:'CREATE_CHILD',service:c.service,mode:c.mode,parentId:c.parentId as string,
        parentLabel:c.parentLabel as string,path:c.path as string[],catalogVersion:version,reason:c.reason}
      :{...handoff,action:'CREATE_NEW_BRANCH',service:c.service,mode:c.mode,parentId:null,parentLabel:null,
        path:c.path as string[],catalogVersion:version,reason:c.reason});
  }
  return {...result,classificationCatalogVersion:version,
    classificationCatalogFingerprint:v.classificationCatalogFingerprint};
}
export function decodeWorkerAiReview(raw:unknown,account:string,cid:string):WorkerAiReview|null {
  const v=record(raw),profile=decodeWorkerAiProfile(v?.profile);
  const legacy=['schemaVersion','reviewId','conversationId','accountId','profileId','revision','profile','activate','missingRequired','canAccept','expiresAt','displayedContentDigest'];
  const extra=!!v&&classKeys.some(key=>Object.hasOwn(v,key));
  const equipment=!!v&&Object.hasOwn(v,'equipmentPolicy');
  const areas=!!v&&Object.hasOwn(v,'workAreaPolicy');
  const semantic=!!v&&Object.hasOwn(v,'semanticReviewCandidates');
  const keys=[...(extra?[...legacy,...classKeys]:legacy),...(semantic?['semanticReviewCandidates']:[]),...(areas?['workAreaPolicy']:[])];
  if(!v||(semantic&&!extra)||!exact(v,equipment?[...keys,'equipmentPolicy']:keys)
    ||(equipment&&v.equipmentPolicy!=='PRESERVE_LEGACY_NO_WRITE_V1')
    ||(areas&&v.workAreaPolicy!=='SIGNED_WORK_AREAS_V1')
    ||v.schemaVersion!=='WORKER_PROFILE_V1'||!uuid(v.reviewId)||!sameId(v.conversationId,cid)||!sameId(v.accountId,account)||!uuid(v.profileId)
    ||!revision(v.revision)||!profile||typeof v.activate!=='boolean'||typeof v.canAccept!=='boolean'||!Array.isArray(v.missingRequired)
    ||v.missingRequired.length>4||v.missingRequired.some(x=>!['Ime','Mesto rada','Veštine','Država i mesto rada','Potvrda usluga za rad na daljinu'].includes(x))
    ||v.canAccept!==(v.missingRequired.length===0)||!text(v.expiresAt,40)||calendarInstant(v.expiresAt)===null||!digest(v.displayedContentDigest))return null;
  const classification=extra?decodeClassification(v,profile):null;
  if(extra&&!classification)return null;
  // This is an activation refusal in the signed cityless REMOTE review, not a
  // missing location or permission to activate a proposed category on the client.
  if(v.missingRequired.includes('Potvrda usluga za rad na daljinu')
    &&(!v.activate||profile.location.city.trim().length>=2||classification?.classificationState!=='READY'
      ||!classification.reviewedServiceModes.length||classification.reviewedServiceModes.some(mode=>mode.mode!=='REMOTE')))return null;
  return {schemaVersion:'WORKER_PROFILE_V1',reviewId:v.reviewId,conversationId:v.conversationId,accountId:v.accountId,profileId:v.profileId,
    revision:v.revision,profile,activate:v.activate,missingRequired:[...v.missingRequired],canAccept:v.canAccept,expiresAt:v.expiresAt,displayedContentDigest:v.displayedContentDigest,
    ...classification,...(equipment?{equipmentPolicy:'PRESERVE_LEGACY_NO_WRITE_V1' as const}:{}),...(areas?{workAreaPolicy:'SIGNED_WORK_AREAS_V1' as const}:{})};
}
function decodeWorkerAiSaved(raw:unknown,review:WorkerAiReview):WorkerAiSaved|null {
  const v=record(raw);
  if(!v||!exact(v,['reviewId','conversationId','accountId','profileId','profileStatus','saved','authoritative'])
    ||!sameId(v.reviewId,review.reviewId)||!sameId(v.conversationId,review.conversationId)||!sameId(v.accountId,review.accountId)||!sameId(v.profileId,review.profileId)
    ||(v.profileStatus!=='DRAFT'&&v.profileStatus!=='ACTIVE')||(review.activate&&v.profileStatus!=='ACTIVE')||v.saved!==true||v.authoritative!==true)return null;
  return {reviewId:v.reviewId,conversationId:v.conversationId,accountId:v.accountId,profileId:v.profileId,profileStatus:v.profileStatus,saved:true,authoritative:true};
}
export function decodeWorkerAiSnapshot(raw:unknown,account:string,cid?:string):WorkerAiSnapshot|null {
  const v=record(raw),candidate=decodeWorkerAiProfile(v?.candidate);
  if(!v||!exact(v,['schemaVersion','conversationId','accountId','profileId','status','profileStatus','revision','candidate','safety','stale','messages','turn','review','saved'])
    ||v.schemaVersion!=='WORKER_PROFILE_V1'||!uuid(v.conversationId)||(cid&&!sameId(v.conversationId,cid))||!sameId(v.accountId,account)||!uuid(v.profileId)
    ||!revision(v.revision)||!candidate||typeof v.stale!=='boolean'||(v.status!=='OPEN'&&v.status!=='COMPLETED'&&v.status!=='ABANDONED')
    ||(v.profileStatus!=='DRAFT'&&v.profileStatus!=='ACTIVE')||(v.safety!=='ALLOW'&&v.safety!=='CLARIFY'&&v.safety!=='REVIEW'&&v.safety!=='BLOCK')
    ||!Array.isArray(v.messages)||v.messages.length>100)return null;
  const messages:WorkerAiSnapshot['messages']=[];const ids=new Set<string>();let seq=0;
  for(const rawMessage of v.messages){const m=record(rawMessage);
    if(!m||!exact(m,['id','role','body','sequence'])||!uuid(m.id)||ids.has(m.id)||(m.role!=='USER'&&m.role!=='ASSISTANT')||!text(m.body,4000)||!m.body.trim()
      ||!revision(m.sequence)||m.sequence<=seq)return null;
    ids.add(m.id);seq=m.sequence;messages.push({id:m.id,role:m.role,body:m.body,sequence:m.sequence});
  }
  const turn=v.turn===null?null:decodeWorkerAiTurn(v.turn,v.conversationId);
  const review=v.review===null?null:decodeWorkerAiReview(v.review,account,v.conversationId);
  const saved=v.saved===null?null:review?decodeWorkerAiSaved(v.saved,review):null;
  if((v.turn!==null&&!turn)||(v.review!==null&&!review)||(v.saved!==null&&!saved)|| (review&&!sameId(review.profileId,v.profileId))
    ||(saved&&v.status!=='COMPLETED'))return null;
  return {schemaVersion:'WORKER_PROFILE_V1',conversationId:v.conversationId,accountId:v.accountId,profileId:v.profileId,status:v.status,
    profileStatus:v.profileStatus,revision:v.revision,candidate,safety:v.safety,stale:v.stale,messages,turn,review,saved};
}
const ERRORS:Readonly<Record<string,string>>={
  AI_SERVICE_UNAVAILABLE:'AI trenutno nije dostupan.',[AI_CREDITS_UNAVAILABLE]:AI_CREDITS_UNAVAILABLE_COPY,
  AUTH_REQUIRED:'Prijavite se da uredite radni profil.',WORKER_AI_DENIED:'Ponovo otvorite svoj radni profil.',
  WORKER_AI_STALE:'Profil je promenjen. Sačuvani podaci ostaju; pokrenite nov razgovor iz aktuelnog profila.',
  WORKER_AI_NOT_EDITABLE:'Ovaj razgovor se ne može menjati. Otvorite sačuvani profil.',
  WORKER_PROFILE_RESTRICTED:'Profil trenutno ne može da se menja.',WORKER_AI_TURN_PENDING:'Prethodna poruka je još u obradi. Proverite razgovor pre čuvanja profila; provera ne šalje novu poruku.',
  WORKER_AI_PATCH_INVALID:'Proverite unos profila, radnog područja i dostupnosti.',WORKER_AI_REQUEST_CONFLICT:'Ovaj zahtev je već vezan za drugi unos. Proverite sačuvano stanje.',
  WORKER_EQUIPMENT_RETIRED:'Alat i vozila se više ne uređuju u radnom profilu. Nastavite sa uslugama, područjem rada i dostupnošću.',
  WORKER_AREA_INVALID:'Područje rada još nije razjašnjeno. Nastavite razgovor sa gradovima i dometom koji Vam odgovaraju.',
  WORKER_AREA_REQUIRES_CONVERSATION:'Područje rada promenite kroz razgovor i potvrdite u pregledu profila.',
  WORKER_AI_RATE_LIMITED:'Poslato je previše poruka zaredom. Sačekajte kratko i proverite razgovor.',
};
const scope=():ReceiptAccount|undefined=>{const s=sesijaSada();return s.user?{accountId:s.user.id,accountRevision:s.accountRevision}:undefined;};
/** Only a proved local read timeout or SDK no-response may keep a last-good interview visible. */
export const WORKER_AI_READ_TRANSPORT_UNAVAILABLE='WORKER_AI_READ_TRANSPORT_UNAVAILABLE';
function call<T>(name:string,args:Record<string,unknown>,decode:(v:unknown,aid:string)=>T|null,write=false,
  readTransportUnavailable?:string):Promise<Ishod<T>>{
  const account=scope(); if(!account)return Promise.resolve(failure('AUTH_REQUIRED',ERRORS.AUTH_REQUIRED));
  return readOwnedResult({account,errors:ERRORS,write,readTransportUnavailable,fallback:'WORKER_AI_UNCONFIRMED',invalid:'WORKER_AI_INVALID_RESPONSE',
    request:()=>supabaseKlijent().rpc(name,args),decode:v=>decode(v,account.accountId)});
}
function recoveryCall(name:'rpc_read_worker_ai_turn_recovery'|'rpc_cancel_worker_ai_turn',conversationId:string,clientRequestId:string){
  const owner=scope();
  if(!owner||!uuid(conversationId)||!uuid(clientRequestId))return Promise.resolve(failure('WORKER_AI_ID_REQUIRED','Ponovo otvorite razgovor.'));
  return readOwnedResult({account:owner,errors:ERRORS,write:name==='rpc_cancel_worker_ai_turn',fallback:'WORKER_AI_UNCONFIRMED',invalid:'WORKER_AI_INVALID_RESPONSE',
    request:()=>supabaseKlijent().rpc(name,{p_expected_user_id:owner.accountId,p_conversation_id:conversationId,p_client_request_id:clientRequestId}),
    decode:v=>decodeWorkerAiTurnRecovery(v,owner.accountId,conversationId,clientRequestId)});
}
// Default OFF. Only an OTA/build explicitly targeting the versioned server
// contract may opt into signed worker classification. Existing APKs keep the
// original exact V1 RPC, read shape and Save behavior unchanged.
const signedWorkerReviewEnabled=()=>process.env.EXPO_PUBLIC_USKOCI_WORKER_SIGNED_REVIEW==='true';
export const workerExplicitModeReviewEnabled=()=>signedWorkerReviewEnabled()
  &&process.env.EXPO_PUBLIC_USKOCI_WORKER_CONFIRMED_MODES==='true';
export const workerAiClientService={
  recoverTurn:(conversationId:string,clientRequestId:string)=>recoveryCall('rpc_read_worker_ai_turn_recovery',conversationId,clientRequestId),
  cancelTurn:(conversationId:string,clientRequestId:string)=>recoveryCall('rpc_cancel_worker_ai_turn',conversationId,clientRequestId),
  open:(clientRequestId:string)=>!uuid(clientRequestId)?Promise.resolve(failure('WORKER_AI_ID_REQUIRED','Ponovo otvorite radni profil.')):
    call('rpc_open_worker_ai',{p_client_request_id:clientRequestId},decodeWorkerAiSnapshot,true),
  read:(conversationId:string)=>!uuid(conversationId)?Promise.resolve(failure('WORKER_AI_ID_REQUIRED','Ponovo otvorite razgovor.')):
    call(signedWorkerReviewEnabled()?'rpc_read_worker_ai_taxonomy':'rpc_read_worker_ai',
      {p_conversation_id:conversationId},(v,a)=>decodeWorkerAiSnapshot(v,a,conversationId),false,WORKER_AI_READ_TRANSPORT_UNAVAILABLE),
  patch:(conversationId:string,expectedRevision:number,patch:WorkerAiPatch)=>call('rpc_patch_worker_ai',
    {p_conversation_id:conversationId,p_expected_revision:expectedRevision,p_patch:JSON.parse(JSON.stringify(patch))},(v,a)=>decodeWorkerAiSnapshot(v,a,conversationId),true),
  prepare:(conversationId:string,expectedRevision:number,activate:boolean)=>call(
    signedWorkerReviewEnabled()?'rpc_prepare_worker_ai_review_taxonomy':'rpc_prepare_worker_ai_review',
    {p_conversation_id:conversationId,p_expected_revision:expectedRevision,p_activate:activate},(v,a)=>decodeWorkerAiReview(v,a,conversationId),true),
  // A new, separately gated signed review uses ONLY modes explicitly selected
  // by this authenticated worker. It cannot modify existing signed or legacy reviews.
  prepareConfirmed:(conversationId:string,expectedRevision:number,activate:boolean,modes:WorkerAiReviewedMode[])=>{
    if(!workerExplicitModeReviewEnabled())return Promise.resolve(failure('WORKER_MODE_CONFIRMATION_OFF','Potvrda načina rada nije dostupna u ovoj verziji.'));
    if(!uuid(conversationId)||!revision(expectedRevision)||!Array.isArray(modes)||!modes.length||modes.length>24||
      modes.some(x=>!x||typeof x.service!=='string'||!x.service.trim()||!['ON_SITE','REMOTE'].includes(x.mode)))
      return Promise.resolve(failure('WORKER_MODE_CONFIRMATION_INVALID','Izaberite način rada za svaku uslugu.'));
    return call('rpc_prepare_worker_ai_review_taxonomy_confirmed',
      {p_conversation_id:conversationId,p_expected_revision:expectedRevision,p_activate:activate,
        p_selected_modes:modes.map(x=>({service:x.service,mode:x.mode}))},
      (v,a)=>decodeWorkerAiReview(v,a,conversationId),true);
  },
  save:(review:WorkerAiReview,clientRequestId:string)=>{
    const owner=scope(),frozen=owner?decodeWorkerAiReview(review,owner.accountId,review.conversationId):null;
    if(!frozen||!uuid(clientRequestId)||!frozen.canAccept)return Promise.resolve(failure('WORKER_AI_REVIEW_REQUIRED','Otvorite potpun pregled profila.'));
    return call('rpc_save_worker_ai_review',{p_review_id:frozen.reviewId,p_displayed_digest:frozen.displayedContentDigest,p_client_request_id:clientRequestId},
      (v,a)=>a===frozen.accountId?decodeWorkerAiSaved(v,frozen):null,true);
  },
  abandon:(conversationId:string)=>call('rpc_abandon_worker_ai',{p_conversation_id:conversationId},(v,a)=>decodeWorkerAiSnapshot(v,a,conversationId),true),
  async send(conversationId:string,body:string,clientRequestId:string,stream:AiTurnStreamOptions):Promise<Ishod<WorkerAiTurn>>{
    const account=scope(),session=sesijaSada().session,config=readPublicSupabaseConfig();
    const url=config?.url,anonKey=config?.anonKey;
    if(!account||!session?.access_token||!url||!anonKey)return failure('AUTH_REQUIRED',ERRORS.AUTH_REQUIRED);
    if(!uuid(conversationId)||!uuid(clientRequestId)||!text(body,4000)||!body.trim())return failure('WORKER_AI_INPUT_INVALID','Unesite poruku do 4000 znakova.');
    const hint:{value:AiConversationIntent|null}={value:null};
    const completed=await readOwnedResult({account,errors:ERRORS,write:true,timeoutMs:55_000,fallback:'WORKER_AI_UNCONFIRMED',invalid:'WORKER_AI_INVALID_RESPONSE',
      request:async()=>{const response=await requestAiTurnStream({...stream,endpoint:'uskoci-worker-interview',url,anonKey,accessToken:session.access_token,
        conversationId,clientRequestId,text:body,deadline:Date.now()+55000,
        current:()=>sesijaSada().user?.id===account.accountId&&sesijaSada().accountRevision===account.accountRevision});
        hint.value=response.conversationIntent??null;return response;},
      decode:v=>decodeWorkerAiTurn(v,conversationId,clientRequestId)});
    if(completed.ok&&completed.podatak.state==='SUCCEEDED'&&hint.value&&!stream.signal?.aborted
      &&sesijaSada().user?.id===account.accountId&&sesijaSada().accountRevision===account.accountRevision){
      try{stream.onConversationIntent?.(hint.value);}catch{/* A suggestion cannot invalidate the confirmed turn. */}
    }
    return completed;
  },
};
