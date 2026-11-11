import type { AiNeedSafety, AiNeedV2FactSource, AiNeedV2FactStatus } from '../contracts/aiNeedV2';
import type { NeedLocationInput } from '../contracts/location';
import { decodeServiceHandoff, type ServiceHandoff } from '../contracts/serviceHandoff';
import { decodeTaxonomySemanticReviewCandidates, type TaxonomySemanticReviewCandidate } from '../contracts/taxonomySemanticReview';
import { isNeedFactV2Key, MAX_NEED_FACT_V2_PAYLOAD, NEED_FACT_V2_DEFINITIONS, type NeedFactV2Key } from '../contracts/needFactsV2';
import type { PublicationEvaluation, PublishNeedReceipt } from '../contracts/publication';
import { normalizeNeedLocation, normalizeTaskGeography, locationRevision } from '../lib/location';
import { calendarInstant } from '../lib/calendarTime';
import { countryCode } from '../lib/market';
import { sesijaSada } from '../store/sesija';
import type { Ishod } from './ports';
import { decodePublicationEvaluation } from './publicationClientService';
import { slotLabel } from './aiNeedV2Ui';
import { REVIEW_FACT_COPY, reviewStartPassed } from './reviewFactProblem';
export { reviewFactProblem } from './reviewFactProblem';
import type { LocationSlot } from '../contracts/needFactsV2';
import { failure, positiveInteger, readOwnedResult, record, sameId, timestamp, uuid, type ReceiptAccount } from './serverReceipt';
import { applicationDeadlineIso, decodeTaskApplicationDeadlineFact } from '../contracts/taskApplicationDeadline';
import { supabaseKlijent } from './supabaseClient';

export type AiTaskReviewFact = Readonly<{
  id: string | null; key: NeedFactV2Key; value: unknown; displayValue: string;
  privacyClass: 'PUBLIC' | 'PRIVATE'; source: AiNeedV2FactSource; status: AiNeedV2FactStatus;
}>;
export type SignedNeedClassification = Readonly<{handoff?:ServiceHandoff} & (
  {action:'REUSE_EXISTING';service:string;mode:'ON_SITE'|'REMOTE';categoryId:string;categoryLabel?:string;categoryParentId?:string|null;catalogVersion:number;reason:string}|
  {action:'EXTEND_MODE';service:string;mode:'ON_SITE'|'REMOTE';categoryId:string;categoryLabel:string;categoryParentId:string|null;
    catalogVersion:number;reason:string}|
  {action:'CREATE_CHILD';service:string;mode:'ON_SITE'|'REMOTE';parentId:string;parentLabel:string;
    path:string[];catalogVersion:number;reason:string}|
  {action:'CREATE_NEW_BRANCH';service:string;mode:'ON_SITE'|'REMOTE';parentId:null;parentLabel:null;
    path:string[];catalogVersion:number;reason:string})>;
/** Owner-only server snapshot. Never persist or send these projections to public analytics. */
export type AiTaskReplacement = Readonly<{
  version: 'TASK_REPLACEMENT_V1'; sourceNeedId: string; sourceRevision: number; sourceFingerprint: string;
  targetNeedId: string; targetBaseRevision: number;
}>;
export type AiTaskReviewEnvelope = Readonly<{
  reviewId: string; accountId: string; conversationId: string; schemaVersion: 'NEED_FACT_V2'; draftId: string | null; draftRevision: number;
  displayedContentDigest: string; factsRevision: string; sourceTurnRevision: number; geographyRevision: string;
  expiresAt: string; responseDeadline: string | null;
  publicProjection: readonly AiTaskReviewFact[]; ownerPrivateProjection: readonly AiTaskReviewFact[];
  location: NeedLocationInput | null; missingRequired: readonly NeedFactV2Key[]; canAccept: boolean; safety: AiNeedSafety;
  /** Optional during the staged rollout; all five classification fields arrive together. */
  classificationState?: string;
  classificationCandidates?: readonly SignedNeedClassification[];
  classificationCatalogVersion?: number | null;
  classificationCatalogFingerprint?: string | null;
  reviewedServiceModes?: readonly [];
  /** Signed source-bound comparison; no category admission, alias or matching right. */
  semanticReviewCandidates?: readonly TaxonomySemanticReviewCandidate[];
  /** Server-owned ancestry included in the immutable displayed-content digest. */
  replacement?: AiTaskReplacement;
}>;
export type AiTaskPublicationCommand = Readonly<{
  reviewId: string; clientRequestId: string; needId: string; needRevision: number;
  state: 'ACCEPTED' | 'EVALUATING' | 'UNKNOWN_OUTCOME' | 'EVALUATED' | 'PUBLISHED';
  evaluation: PublicationEvaluation | null; published: PublishNeedReceipt | null; authoritative: true;
}>;
export type AiTaskReviewRead = Readonly<{ review: AiTaskReviewEnvelope; command: AiTaskPublicationCommand | null }>;
export type AiTaskReviewPrepare = Readonly<{
  conversationId: string; responseDeadline: string | null;
  location?: Readonly<{ expectedRevision: string; value: NeedLocationInput }>;
}>;

const COPY: Readonly<Record<string, string>> = {
  REPLACEMENT_SOURCE_STALE: 'Postojeći zadatak je u međuvremenu promenjen. Otvori ga i proveri stanje pre novih izmena.',
  PUBLISHED_TASK_EDIT_NOT_READY: 'Objavljivanje izmena trenutno nije dostupno. Postojeća objava nije promenjena; izmene ostaju u razgovoru.',
  IDENTITY_VERIFICATION_UNAVAILABLE: 'Provera identiteta nije dostupna. U pregledu ukloni taj uslov da nastaviš običnim zadatkom.',
  AUTH_REQUIRED: 'Prijavi se da nastaviš.', AUTH_ACCOUNT_CHANGED: 'Nalog je promenjen. Ponovo otvori zadatak.',
  TASK_REVIEW_NOT_FOUND: 'Pregled nije pronađen. Ponovo otvori zadatak.',
  TASK_REVIEW_NOT_EDITABLE: 'Ovaj razgovor je već sačuvan. Učitaj njegov zadatak.',
  TASK_REVIEW_DIGEST_MISMATCH: 'Pregled je promenjen. Učitaj tačnu verziju pre objave.',
  TASK_REVIEW_STALE: 'Podaci su promenjeni posle pregleda. Pregledaj novu verziju.',
  TASK_REVIEW_EXPIRED: 'Pregled je istekao. Osveži ga pre objave.',
  TASK_REVIEW_POLICY_STALE: 'Uslovi za objavu su promenjeni. Osveži pregled.',
  TASK_REVIEW_INCOMPLETE: 'Dopuni podatke koji nedostaju pre objave.',
  TASK_REVIEW_COMMAND_MISMATCH: 'Zahtev za objavu više ne odgovara ovom pregledu.',
  TASK_REVIEW_ATTEMPT_STALE: 'Ishod provere još nije potvrđen. Učitaj stanje zahteva.',
  TASK_REVIEW_INPUT_INVALID: 'Proveri podatke i ponovo otvori pregled.',
  IDEMPOTENCY_KEY_REUSED: 'Ovaj zahtev već pripada drugom pregledu. Učitaj sačuvano stanje.',
  LOCATION_VERSION_CONFLICT: 'Mesto je promenjeno. Pregledaj novu lokaciju.',
  LOCATION_INPUT_INVALID: 'Proveri mesto i privatne tačke lokacije.',
  LOCATION_BINDING_CHANGED: 'Mesto je promenjeno. Ponovo označi potrebne tačke.',
  ACCOUNT_CLOSING: 'Nalog se zatvara i ne može da objavi novi zadatak.',
  REQUESTER_PROFILE_NOT_READY: 'Dopuni svoj profil pre objave.',
  RESPONSE_DEADLINE_INVALID: 'Rok za prijave mora biti u budućnosti.',
  ...REVIEW_FACT_COPY,
  // Refusals a person causes on the accept path (deep read 7.21); unmapped they read "Ishod radnje nije potvrđen".
  NO_MATERIAL_CHANGE: 'Nijedan podatak nije promenjen. Izmeni nešto ili se vrati na zadatak.',
  PUBLICATION_DECISION_NOT_ALLOW: 'Zadatak još nije odobren za objavu.',
  NEED_REVISION_STALE: 'Zadatak je promenjen. Pregledaj novu verziju.',
  STALE_REVIEW_REQUIRED: 'Zadatak je promenjen. Ponovo otvori uređivanje.',
  NEED_NOT_EDITABLE_PUBLIC_STATE: 'Ovaj zadatak trenutno ne može da se menja.',
  NEED_EDIT_LOCKED_AFTER_FIRST_DOGOVOR: 'Uslovi zadatka su već deo Dogovora i ne mogu ovde da se menjaju.',
  EVALUATOR_UNAVAILABLE: 'Provera objave trenutno nije dostupna. Nacrt je sačuvan.',
  RATE_LIMITED: 'Sačekaj pre sledeće provere. Nacrt je sačuvan.',
};
const hash = (x: unknown): x is string => typeof x === 'string' && /^[a-f0-9]{64}$/.test(x);
const only = (x: Record<string, unknown>, keys: readonly string[]) => Object.keys(x).length === keys.length && keys.every(k => Object.hasOwn(x, k));
const text = (x: unknown, max: number): x is string => typeof x === 'string' && x.trim().length > 0 && Array.from(x).length <= max && !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(x);
const scope = (): ReceiptAccount | null => { const s = sesijaSada(); return s.user ? { accountId: s.user.id, accountRevision: s.accountRevision } : null; };
const current = (s: ReceiptAccount) => { const now = sesijaSada(); return now.user?.id === s.accountId && now.accountRevision === s.accountRevision; };
const invalid = <T>(): Promise<Ishod<T>> => Promise.resolve(failure('TASK_REVIEW_INPUT_INVALID', COPY.TASK_REVIEW_INPUT_INVALID));
function validValue(key: NeedFactV2Key, value: unknown): boolean {
  if (key === 'need.response_deadline') return decodeTaskApplicationDeadlineFact(value) !== null;
  const type = NEED_FACT_V2_DEFINITIONS[key].valueType;
  if (type === 'TEXT_ARRAY') return Array.isArray(value) && value.length <= 100 && value.every(x => text(x, 1000));
  if (type === 'BOOLEAN') return typeof value === 'boolean';
  if (type === 'INTEGER') return typeof value === 'number' && Number.isSafeInteger(value) && value >= (key === 'need.minimum_experience_years' ? 0 : 1) && value <= (key === 'need.price_rsd' ? 100_000_000 : key === 'need.people_needed' ? 50 : 60);
  if (type === 'TIMESTAMPTZ') return timestamp(value);
  if (key === 'need.task_country_code') return typeof value === 'string' && countryCode(value) === value;
  if (key === 'need.task_geography') return normalizeTaskGeography(value) !== null;
  if (key === 'need.handoff') return decodeServiceHandoff(value) !== null;
  if (key === 'need.resolved_location') { const v = record(value); return !!v && !!normalizeNeedLocation({ ...record(v.binding), accessNotes: null, resolvedLocation: value })?.resolvedLocation; }
  if (key === 'need.price_mode') return ['FASTEST', 'MY_PRICE', 'OFFERS'].includes(String(value));
  if (key === 'need.price_basis') return ['TOTAL', 'PER_PERSON', 'HOURLY'].includes(String(value));
  if (key === 'need.schedule_kind') return ['FIXED_WINDOW', 'FLEXIBLE', 'REMOTE_ANYTIME', 'TODAY_FLEXIBLE', 'TOMORROW_FLEXIBLE', 'WEEK_FLEXIBLE'].includes(String(value));
  return text(value, key === 'need.title' ? 140 : key === 'need.category' ? 120 : key === 'need.exact_address' ? 1000 : key === 'need.access_notes' ? 2000 : 6000);
}
function fact(raw: unknown, privacy: 'PUBLIC' | 'PRIVATE'): AiTaskReviewFact | null {
  const f = record(raw);
  if (!f || !only(f, ['id', 'key', 'value', 'displayValue', 'privacyClass', 'source', 'status']) || (f.id !== null && !uuid(f.id))
    || typeof f.key !== 'string' || !isNeedFactV2Key(f.key) || f.privacyClass !== privacy || NEED_FACT_V2_DEFINITIONS[f.key].privacyClass !== privacy
    || !text(f.displayValue, 2000) || !validValue(f.key, f.value)
    || !['EXPLICIT_USER_ANSWER', 'CONFIRMED_PROFILE', 'AI_INFERENCE', 'SYSTEM', 'SYSTEM_DERIVED'].includes(String(f.source))
    || !['NEEDS_CONFIRMATION', 'INFERRED', 'CONFIRMED', 'UNKNOWN'].includes(String(f.status))) return null;
  return f as unknown as AiTaskReviewFact;
}
export function decodeAiTaskReview(raw: unknown, accountId: string): AiTaskReviewEnvelope | null {
  const r = record(raw);
  const baseKeys = ['reviewId', 'accountId', 'conversationId', 'schemaVersion', 'draftId', 'draftRevision',
    'displayedContentDigest', 'factsRevision', 'sourceTurnRevision', 'geographyRevision', 'expiresAt',
    'responseDeadline', 'publicProjection', 'ownerPrivateProjection', 'location', 'missingRequired',
    'canAccept', 'safety'];
  const classificationKeys = ['classificationState','classificationCandidates','classificationCatalogVersion',
    'classificationCatalogFingerprint','reviewedServiceModes'];
  const hasClassification = !!r && Object.hasOwn(r,'classificationState');
  const hasReplacement = !!r && Object.hasOwn(r, 'replacement');
  const hasSemantic = !!r && Object.hasOwn(r,'semanticReviewCandidates');
  const expectedKeys = [...baseKeys, ...(hasClassification ? classificationKeys : []),
    ...(hasSemantic?['semanticReviewCandidates']:[]), ...(hasReplacement ? ['replacement'] : [])];
  if (!r || (hasSemantic&&!hasClassification) || !only(r, expectedKeys)
    || !uuid(r.reviewId) || !sameId(r.accountId, accountId) || !uuid(r.conversationId) || r.schemaVersion !== 'NEED_FACT_V2'
    || (r.draftId === null ? r.draftRevision !== 0 : !uuid(r.draftId) || !positiveInteger(r.draftRevision))
    || !hash(r.displayedContentDigest) || !hash(r.factsRevision) || !locationRevision(r.geographyRevision)
    || typeof r.sourceTurnRevision !== 'number' || !Number.isSafeInteger(r.sourceTurnRevision) || r.sourceTurnRevision < 0
    || !timestamp(r.expiresAt) || (r.responseDeadline !== null && !timestamp(r.responseDeadline))
    || typeof r.canAccept !== 'boolean' || !['ALLOW', 'CLARIFY', 'REVIEW', 'BLOCK'].includes(String(r.safety))
    || !Array.isArray(r.publicProjection) || !Array.isArray(r.ownerPrivateProjection) || r.publicProjection.length + r.ownerPrivateProjection.length > MAX_NEED_FACT_V2_PAYLOAD
    || !Array.isArray(r.missingRequired) || r.missingRequired.length > MAX_NEED_FACT_V2_PAYLOAD
    || !r.missingRequired.every(k => typeof k === 'string' && isNeedFactV2Key(k) && (
      NEED_FACT_V2_DEFINITIONS[k].requiredForDraft
      // The server also reports conditional price/time requirements; an end remains optional unless invalid when supplied.
      || k === 'need.price_rsd' || k === 'need.starts_at' || k === 'need.ends_at'
      || k === 'need.handoff' || k === 'need.response_deadline'))) return null;
  let replacement: AiTaskReplacement | undefined;
  if (hasReplacement) {
    const value = record(r.replacement);
    if (!value || !only(value, ['version', 'sourceNeedId', 'sourceRevision', 'sourceFingerprint', 'targetNeedId', 'targetBaseRevision'])
      || value.version !== 'TASK_REPLACEMENT_V1' || !uuid(value.sourceNeedId) || !positiveInteger(value.sourceRevision)
      || !hash(value.sourceFingerprint) || !uuid(value.targetNeedId) || sameId(value.sourceNeedId, value.targetNeedId)
      || typeof value.targetBaseRevision !== 'number' || !Number.isSafeInteger(value.targetBaseRevision) || value.targetBaseRevision < 0
      || (value.targetBaseRevision === 0
        ? !sameId(r.draftId, value.sourceNeedId) || r.draftRevision !== value.sourceRevision
        : !sameId(r.draftId, value.targetNeedId) || r.draftRevision !== value.targetBaseRevision)) return null;
    replacement = value as AiTaskReplacement;
  }
  const publicProjection = r.publicProjection.map(x => fact(x, 'PUBLIC')), ownerPrivateProjection = r.ownerPrivateProjection.map(x => fact(x, 'PRIVATE'));
  const all = [...publicProjection, ...ownerPrivateProjection];
  if (all.some(x => !x) || new Set(all.map(x => x?.key)).size !== all.length || new Set(r.missingRequired).size !== r.missingRequired.length) return null;
  const deadlineFact = publicProjection.find(x => x?.key === 'need.response_deadline' && x.status !== 'UNKNOWN');
  if (deadlineFact) {
    const decision = decodeTaskApplicationDeadlineFact(deadlineFact.value);
    if (!decision || (applicationDeadlineIso(decision) === null ? r.responseDeadline !== null
      : Date.parse(applicationDeadlineIso(decision)!) !== Date.parse(String(r.responseDeadline)))) return null;
  }
  if (r.missingRequired.includes('need.response_deadline') && (deadlineFact || r.responseDeadline !== null)) return null;
  const location = r.location === null ? null : normalizeNeedLocation(r.location);
  if (r.missingRequired.includes('need.handoff') && location?.geography.mode !== 'REMOTE') return null;
  if ((r.location !== null && !location) || (r.canAccept && (r.safety === 'BLOCK' || !location || r.missingRequired.length > 0))) return null;
  let signedClassification: Pick<AiTaskReviewEnvelope,'classificationState'|'classificationCandidates'|
    'classificationCatalogVersion'|'classificationCatalogFingerprint'|'reviewedServiceModes'|'semanticReviewCandidates'> = {};
  let signedSemantic:TaxonomySemanticReviewCandidate[]|undefined;
  if (hasClassification) {
    if (typeof r.classificationState !== 'string' ||
        !['READY','PENDING_CLASSIFICATION','REVIEW_REQUIRED','SERVICE_MODE_CONFIRMATION_REQUIRED',
          'CATALOG_UNAVAILABLE','STALE_CATALOG'].includes(r.classificationState) ||
        !Array.isArray(r.classificationCandidates) || !Array.isArray(r.reviewedServiceModes) ||
        r.reviewedServiceModes.length !== 0) return null;
    const items = r.classificationCandidates;
    if (r.classificationState === 'READY') {
      if(hasSemantic)return null;
      const candidate = record(items[0]);
      const category = publicProjection.find(f => f?.key === 'need.category');
      const mode = location?.geography.mode === 'REMOTE' ? 'REMOTE' :
        ['STATIONARY','POINT_TO_POINT','MULTI_STOP','AREA_BASED'].includes(String(location?.geography.mode)) ? 'ON_SITE' : null;
      const hasHandoff=!!candidate&&Object.hasOwn(candidate,'handoff');
      if(hasHandoff&&(candidate?.mode!=='REMOTE'||!decodeServiceHandoff(candidate.handoff)))return null;
      // A bound handoff must be the same public fact the owner is reviewing.
      // Hidden classification metadata cannot silently add a pickup restriction.
      const visibleHandoff=publicProjection.find(f=>f?.key==='need.handoff'&&f.status!=='UNKNOWN');
      if(hasHandoff&&JSON.stringify(decodeServiceHandoff(candidate!.handoff))!==JSON.stringify(decodeServiceHandoff(visibleHandoff?.value)))return null;
      const candidateKeys=(keys:string[])=>hasHandoff?[...keys,'handoff']:keys;
      const hasLabel=!!candidate&&Object.hasOwn(candidate,'categoryLabel');
      const reuseKeys=hasLabel
        ? ['action','service','mode','categoryId','categoryLabel','categoryParentId','catalogVersion','reason']
        : ['action','service','mode','categoryId','catalogVersion','reason'];
      const reuse=!!candidate&&candidate.action==='REUSE_EXISTING'&&only(candidate,
        candidateKeys(reuseKeys))&&uuid(candidate.categoryId)
        &&(!hasLabel||(text(candidate.categoryLabel,120)&&(candidate.categoryParentId===null||uuid(candidate.categoryParentId))));
      const extend=!!candidate&&candidate.action==='EXTEND_MODE'&&only(candidate,
        candidateKeys(['action','service','mode','categoryId','categoryLabel','categoryParentId','catalogVersion','reason']))
        &&uuid(candidate.categoryId)&&text(candidate.categoryLabel,120)
        &&(candidate.categoryParentId===null||uuid(candidate.categoryParentId));
      const child=!!candidate&&candidate.action==='CREATE_CHILD'&&only(candidate,
        candidateKeys(['action','service','mode','parentId','parentLabel','path','catalogVersion','reason']))
        &&uuid(candidate.parentId)&&text(candidate.parentLabel,120)
        &&Array.isArray(candidate.path)&&candidate.path.length>=1&&JSON.stringify(candidate.path).length<=12000
        &&candidate.path.every(x=>text(x,120))&&candidate.path[candidate.path.length-1]===candidate.service;
      const root=!!candidate&&candidate.action==='CREATE_NEW_BRANCH'&&only(candidate,
        candidateKeys(['action','service','mode','parentId','parentLabel','path','catalogVersion','reason']))
        &&candidate.parentId===null&&candidate.parentLabel===null
        &&Array.isArray(candidate.path)&&candidate.path.length>=1&&JSON.stringify(candidate.path).length<=12000
        &&candidate.path.every(x=>text(x,120))&&candidate.path[candidate.path.length-1]===candidate.service;
      if (items.length !== 1 || !candidate || (!reuse&&!extend&&!child&&!root) ||
        !text(candidate.service,120) || candidate.service !== category?.value ||
        candidate.mode !== mode || !text(candidate.reason,1000) ||
        typeof candidate.catalogVersion !== 'number' || !Number.isSafeInteger(candidate.catalogVersion) ||
        candidate.catalogVersion <= 0 || candidate.catalogVersion !== r.classificationCatalogVersion ||
        typeof r.classificationCatalogFingerprint !== 'string' ||
        !/^[a-f0-9]{32}$/.test(r.classificationCatalogFingerprint)) return null;
    } else if(hasSemantic){
      if(r.classificationState!=='REVIEW_REQUIRED'||items.length!==0
        ||typeof r.classificationCatalogFingerprint!=='string'
        ||!/^[a-f0-9]{32}$/.test(r.classificationCatalogFingerprint))return null;
      const category=publicProjection.find(f=>f?.key==='need.category'&&f.status!=='UNKNOWN');
      const mode=location?.geography.mode==='REMOTE'?'REMOTE'
        :['STATIONARY','POINT_TO_POINT','MULTI_STOP','AREA_BASED'].includes(String(location?.geography.mode))?'ON_SITE':null;
      signedSemantic=decodeTaxonomySemanticReviewCandidates(r.semanticReviewCandidates,
        r.classificationCatalogVersion,typeof category?.value==='string'?[category.value]:[],mode)??undefined;
      if(!signedSemantic)return null;
    } else if (items.length !== 0 || r.classificationCatalogVersion !== null ||
      r.classificationCatalogFingerprint !== null) return null;
    signedClassification = {
      classificationState:r.classificationState,
      classificationCandidates:items as SignedNeedClassification[],
      classificationCatalogVersion:r.classificationCatalogVersion as number | null,
      classificationCatalogFingerprint:r.classificationCatalogFingerprint as string | null,
      reviewedServiceModes:[],
      ...(signedSemantic?{semanticReviewCandidates:signedSemantic}:{}),
    };
  }
  return { reviewId: r.reviewId, accountId: r.accountId, conversationId: r.conversationId, schemaVersion: 'NEED_FACT_V2',
    draftId: r.draftId as string | null, draftRevision: r.draftRevision as number,
    displayedContentDigest: r.displayedContentDigest, factsRevision: r.factsRevision, sourceTurnRevision: r.sourceTurnRevision,
    geographyRevision: r.geographyRevision, expiresAt: r.expiresAt, responseDeadline: r.responseDeadline as string | null,
    publicProjection: publicProjection as AiTaskReviewFact[], ownerPrivateProjection: ownerPrivateProjection as AiTaskReviewFact[],
    location, missingRequired: r.missingRequired as NeedFactV2Key[], canAccept: r.canAccept, safety: r.safety as AiNeedSafety,
    ...signedClassification, ...(replacement ? { replacement } : {}) };
}
function decodeAiTaskPublicationCommand(raw: unknown, reviewId?: string): AiTaskPublicationCommand | null {
  const c = record(raw);
  if (!c || !only(c, ['reviewId', 'clientRequestId', 'needId', 'needRevision', 'state', 'evaluation', 'published', 'authoritative'])
    || !uuid(c.reviewId) || (reviewId && !sameId(c.reviewId, reviewId)) || !uuid(c.clientRequestId) || !uuid(c.needId) || !positiveInteger(c.needRevision)
    || !['ACCEPTED', 'EVALUATING', 'UNKNOWN_OUTCOME', 'EVALUATED', 'PUBLISHED'].includes(String(c.state)) || c.authoritative !== true) return null;
  const evaluation = c.evaluation === null ? null : decodePublicationEvaluation(c.evaluation, { needId: c.needId, expectedRevision: c.needRevision });
  if ((c.evaluation !== null && !evaluation) || (['EVALUATED', 'PUBLISHED'].includes(String(c.state)) !== (evaluation !== null))) return null;
  const p = record(c.published);
  if (c.state === 'PUBLISHED') {
    if (!p || !only(p, ['needId', 'status', 'publishedAt', 'responseDeadline', 'idempotentReplay']) || !sameId(p.needId, c.needId)
      || p.status !== 'PUBLISHED' || !timestamp(p.publishedAt) || (p.responseDeadline !== null && !timestamp(p.responseDeadline))
      || typeof p.idempotentReplay !== 'boolean' || evaluation?.kind !== 'DECISION' || evaluation.decision.outcome !== 'ALLOW') return null;
  } else if (c.published !== null) return null;
  return { ...c, evaluation, published: p } as AiTaskPublicationCommand;
}
function decodeRead(raw: unknown, accountId: string, reviewId?: string): AiTaskReviewRead | null {
  const v = record(raw); if (!v || !only(v, ['review', 'command'])) return null;
  const review = decodeAiTaskReview(v.review, accountId); if (!review || (reviewId && !sameId(review.reviewId, reviewId))) return null;
  const command = v.command === null ? null : decodeCommandForReview(v.command, review);
  return v.command !== null && !command ? null : { review, command };
}
function decodeCommandForReview(raw: unknown, review: AiTaskReviewEnvelope): AiTaskPublicationCommand | null {
  const command = decodeAiTaskPublicationCommand(raw, review.reviewId);
  if (!command) return null;
  if (review.replacement) {
    if (!sameId(command.needId, review.replacement.targetNeedId)
      || command.needRevision !== review.replacement.targetBaseRevision + 1) return null;
  } else if (command.needRevision !== review.draftRevision + 1 || (review.draftId && !sameId(command.needId, review.draftId))) return null;
  if (command.published && (review.responseDeadline === null ? command.published.responseDeadline !== null
    : calendarInstant(command.published.responseDeadline) !== calendarInstant(review.responseDeadline))) return null;
  return command;
}
function rpc<T>(s: ReceiptAccount, name: string, args: Record<string, unknown>, decode: (raw: unknown) => T | null, write = false): Promise<Ishod<T>> {
  return readOwnedResult({ account: s, request: () => supabaseKlijent().rpc(name, args), decode, errors: COPY, write,
    fallback: write ? 'TASK_REVIEW_OUTCOME_UNCONFIRMED' : 'TASK_REVIEW_READ_FAILED', invalid: 'TASK_REVIEW_INVALID_RESPONSE' });
}
async function readFor(s: ReceiptAccount, reviewId: string): Promise<Ishod<AiTaskReviewRead>> {
  return rpc(s, 'rpc_read_ai_task_review', { p_review_id: reviewId }, raw => decodeRead(raw, s.accountId, reviewId));
}
/** A refusal is only useful if it says what to do next. Codes come from
 *  rpc_get_need_publication_context and from the evaluator's own readiness gates. */
function notReadyCopy(code: string, missing?: readonly string[], stationary = false): string {
  // The evaluator names slots by their internal keys ("start", "waypoints/0"); a person reads "Polazište" (7.25).
  const names = (missing ?? []).map(slot => /^(?:start|end|serviceArea|waypoints\/\d{1,2})$/.test(slot) ? slotLabel(slot as LocationSlot, stationary) : null)
    .filter((name): name is string => name !== null);
  const slots = names.length ? ' (' + names.join(', ') + ')' : '';
  switch (code) {
    case 'LOCATION_INCOMPLETE':
      return 'Lokacija nije potvrđena na mapi' + slots + '. Dodirni lokaciju u pregledu i postavi je, pa objavi.';
    case 'COUNTRY_NOT_READY':
      return 'Država nije potvrđena. Dodirni je u pregledu i potvrdi.';
    case 'PUBLIC_MEDIA_NOT_READY':
      return 'Fotografije još nisu proverene. Sačekaj proveru ili ih ukloni, pa objavi.';
    case 'POLICY_NOT_READY':
    case 'POLICY_CONTENT_NOT_READY':
      return 'Objava trenutno nije moguća. Nije do tebe — nacrt je sačuvan, pokušaj kasnije.';
    case 'EVALUATOR_UNAVAILABLE':
      return 'Provera objave trenutno nije dostupna. Nacrt je sačuvan, pokušaj ponovo za koji minut.';
    default:
      return 'Objava još nije moguća' + slots + '. Nacrt je sačuvan; učitaj pregled ponovo.';
  }
}

async function resumeFor(s: ReceiptAccount, command: AiTaskPublicationCommand): Promise<Ishod<AiTaskPublicationCommand>> {
  const expectedKey = command.clientRequestId;
  const read = await readFor(s, command.reviewId);
  if (!read.ok) return read;
  let stored = read.podatak.command;
  if (!stored || !sameId(stored.clientRequestId, expectedKey)) return failure('TASK_REVIEW_COMMAND_MISMATCH', COPY.TASK_REVIEW_COMMAND_MISMATCH);
  if ((stored.state === 'ACCEPTED' || stored.state === 'EVALUATED')
    && read.podatak.review.publicProjection.some(f => f.key === 'need.verified_identity_required' && f.value === true)) {
    return failure('IDENTITY_VERIFICATION_UNAVAILABLE', COPY.IDENTITY_VERIFICATION_UNAVAILABLE);
  }
  if (stored.state === 'ACCEPTED') {
    const request = { needId: stored.needId, expectedRevision: stored.needRevision, acceptedReviewId: stored.reviewId };
    const evaluated = await readOwnedResult({ account: s, errors: COPY, write: true, timeoutMs: 55_000,
      fallback: 'TASK_REVIEW_OUTCOME_UNCONFIRMED', invalid: 'TASK_REVIEW_INVALID_RESPONSE',
      decode: raw => decodePublicationEvaluation(raw, request), request: async () => {
        const client = supabaseKlijent(), session = await client.auth.getSession();
        if (!current(s) || session.error || session.data.session?.user.id !== s.accountId) return { data: null, error: { message: 'AUTH_ACCOUNT_CHANGED' } };
        return client.functions.invoke('uskoci-publication-evaluate', { body: request, headers: { Authorization: `Bearer ${session.data.session.access_token}` } });
      } });
    // Resolve the durable claim even when the Edge response was lost. Never
    // launch another evaluator attempt from a response/error/timeout callback.
    const refreshed = await readFor(s, stored.reviewId);
    if (!refreshed.ok) return refreshed;
    stored = refreshed.podatak.command;
    if (!stored || !sameId(stored.clientRequestId, expectedKey))
      return failure('TASK_REVIEW_COMMAND_MISMATCH', COPY.TASK_REVIEW_COMMAND_MISMATCH);
    if (stored.state === 'ACCEPTED') {
      if (!evaluated.ok) return evaluated;
      // The server says exactly what is missing. Repeating a generic "reload" left the
      // owner stuck on a real device: reloading can never satisfy a missing location.
      return failure(evaluated.podatak.kind === 'NOT_READY' ? evaluated.podatak.code : 'TASK_REVIEW_OUTCOME_UNCONFIRMED',
        evaluated.podatak.kind === 'NOT_READY' ? notReadyCopy(evaluated.podatak.code, evaluated.podatak.missingSlots,
          read.podatak.review.location?.geography?.mode === 'STATIONARY')
          : 'Ishod objave nije potvrđen. Nacrt je sačuvan; učitaj pregled ponovo.');
    }
  }
  if (stored.state !== 'EVALUATED' || stored.evaluation?.kind !== 'DECISION' || stored.evaluation.decision.outcome !== 'ALLOW') return { ok: true, podatak: stored };
  const publishingKey = stored.clientRequestId;
  return rpc(s, 'rpc_publish_accepted_ai_task_review', { p_review_id: stored.reviewId, p_client_request_id: publishingKey }, raw => {
    const receipt = decodeCommandForReview(raw, read.podatak.review);
    return receipt && sameId(receipt.clientRequestId, publishingKey) ? receipt : null;
  }, true);
}
async function acceptFor(s: ReceiptAccount, command: Readonly<{ review: AiTaskReviewEnvelope; clientRequestId: string }>): Promise<Ishod<AiTaskPublicationCommand>> {
  if (!uuid(command?.clientRequestId) || !decodeAiTaskReview(command.review, s.accountId)) return invalid();
  const frozenReview = { ...command.review };
  // Acceptance is idempotent by review: an existing canonical command may have
  // an earlier request key. Only resume/publish are bound to that selected key.
  return rpc(s, 'rpc_accept_ai_task_review', { p_review_id: command.review.reviewId,
    p_displayed_content_digest: command.review.displayedContentDigest, p_client_request_id: command.clientRequestId },
    raw => decodeCommandForReview(raw, frozenReview), true);
}
// DEV-only opt-in to signed requester classification. Old APKs and builds
// remain on the unmodified V2 review RPC unless explicitly configured.
const signedNeedReviewEnabled=()=>process.env.EXPO_PUBLIC_USKOCI_NEED_SIGNED_REVIEW==='true';
const deadlineFactEnabled=()=>process.env.EXPO_PUBLIC_USKOCI_TASK_AI_APPLICATION_DEADLINE_V1==='true';
export const aiTaskReviewClientService = {
  prepare(request: AiTaskReviewPrepare): Promise<Ishod<AiTaskReviewEnvelope>> {
    const s = scope(); if (!s) return Promise.resolve(failure('AUTH_REQUIRED', COPY.AUTH_REQUIRED));
    if (!uuid(request?.conversationId) || (request.responseDeadline !== null && !timestamp(request.responseDeadline))) return invalid();
    const location = request.location ? normalizeNeedLocation(request.location.value) : null;
    if (request.location && (!location || !locationRevision(request.location.expectedRevision))) return invalid();
    const deadlineMode = deadlineFactEnabled();
    const prepareRpc = deadlineMode
      ? signedNeedReviewEnabled() ? 'rpc_prepare_ai_task_review_deadline_taxonomy' : 'rpc_prepare_ai_task_review_deadline'
      : signedNeedReviewEnabled() ? 'rpc_prepare_ai_task_review_taxonomy' : 'rpc_prepare_ai_task_review';
    // The candidate RPC derives the deadline from the locked conversation. The
    // old argument stays only on the old RPC for older deployed servers.
    return rpc(s, prepareRpc, { p_conversation_id: request.conversationId,
      ...(!deadlineMode ? { p_response_deadline: request.responseDeadline } : {}),
      p_location: request.location ? { expectedRevision: request.location.expectedRevision, value: location } : null }, raw => {
      const review = decodeAiTaskReview(raw, s.accountId); return review && sameId(review.conversationId, request.conversationId) ? review : null;
    }, true);
  },
  read(reviewId: string): Promise<Ishod<AiTaskReviewRead>> {
    const s = scope(); return !s ? Promise.resolve(failure('AUTH_REQUIRED', COPY.AUTH_REQUIRED)) : !uuid(reviewId) ? invalid() : readFor(s, reviewId);
  },
  readLatest(conversationId: string): Promise<Ishod<AiTaskReviewRead | null>> {
    const s = scope(); if (!s) return Promise.resolve(failure('AUTH_REQUIRED', COPY.AUTH_REQUIRED)); if (!uuid(conversationId)) return invalid();
    // Wrap a nullable success because the shared receipt decoder reserves null
    // for invalid server replies.
    return rpc(s, 'rpc_read_latest_ai_task_review', { p_conversation_id: conversationId }, raw => {
      const value = raw === null ? null : decodeRead(raw, s.accountId);
      return raw !== null && (!value || !sameId(value.review.conversationId, conversationId)) ? null : { value };
    }).then(r => r.ok ? { ok: true, podatak: r.podatak.value } : r);
  },
  async acceptAndPublish(command: Readonly<{ review: AiTaskReviewEnvelope; clientRequestId: string }>): Promise<Ishod<AiTaskPublicationCommand>> {
    const s = scope(); if (!s) return failure('AUTH_REQUIRED', COPY.AUTH_REQUIRED);
    // A fixed time that has already begun: say so before the paid publication check that could only refuse it (5.1).
    if (Array.isArray(command?.review?.publicProjection) && reviewStartPassed(command.review)) {
      return failure('FIXED_WINDOW_START_PASSED', COPY.FIXED_WINDOW_START_PASSED);
    }
    const accepted = await acceptFor(s, command);
    return accepted.ok ? resumeFor(s, accepted.podatak) : accepted;
  },
  /**
   * "Sačuvaj nacrt": the first half of publishing and nothing after it. Accepting the displayed
   * review is what writes the private DRAFT Zadatak on the server; the evaluator and the publish
   * are separate steps that `resume` runs later, from the same stored command, when the person
   * asks for them. No second writer and no second meaning of "draft".
   */
  async acceptAsDraft(command: Readonly<{ review: AiTaskReviewEnvelope; clientRequestId: string }>): Promise<Ishod<AiTaskPublicationCommand>> {
    const s = scope(); if (!s) return failure('AUTH_REQUIRED', COPY.AUTH_REQUIRED);
    return acceptFor(s, command);
  },
  resume(command: AiTaskPublicationCommand): Promise<Ishod<AiTaskPublicationCommand>> {
    const s = scope(); return !s ? Promise.resolve(failure('AUTH_REQUIRED', COPY.AUTH_REQUIRED)) : !decodeAiTaskPublicationCommand(command) ? invalid() : resumeFor(s, command);
  },
};
