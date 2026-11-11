import { isNeedFactV2Key, MAX_NEED_FACT_V2_PAYLOAD, NEED_FACT_V2_DEFINITIONS } from '../contracts/needFactsV2';
import { decodeServiceHandoff } from '../contracts/serviceHandoff';
import { positiveInteger, record, timestamp } from './serverReceipt';
import { supportKinds, type SupportDetail, type SupportInbox, type SupportMode, type SupportSnapshot } from './supportCaseTypes';
import { decodeSupportReference, supportEnvelope, supportKeys as keys, supportSequence as sequence, supportUuid as uuid } from './supportCaseWire';

const member = (value: unknown, choices: readonly string[]) => typeof value === 'string' && choices.includes(value);
const str = (v: unknown, limit: number) => typeof v === 'string' && Array.from(v).length <= limit && !v.includes('\0');
const nullableText = (v: unknown, limit: number) => v === null || str(v, limit);
const nullableUuid = (v: unknown) => v === null || uuid(v);
const hash = (v: unknown) => typeof v === 'string' && /^[a-f0-9]{64}$/.test(v);
const states = ['RECEIVED', 'IN_REVIEW', 'WAITING_FOR_AUTHOR', 'DECIDED', 'CLOSED'];
const topics: Record<string, string[]> = { SERVICE: ['TECHNICAL', 'SERVICE_COMPLAINT', 'OTHER'],
  TASK: ['COLLABORATION', 'NO_SHOW', 'PUBLICATION_REVIEW'], LEGAL_PRIVACY: ['CONTENT_NOTICE', 'PRIVACY_RIGHTS'], SAFETY: ['SAFETY_REPORT'] };
const classified = (r: Record<string, unknown>) => typeof r.channel === 'string' && Object.hasOwn(topics, r.channel)
  && member(r.topic, topics[r.channel]) && member(r.status, states);
const unique = (items: unknown[], field = 'id') => new Set(items.map(x => record(x)?.[field])).size === items.length;
function media(value: unknown) {
  if (!Array.isArray(value) || value.length > 6 || !unique(value, 'assetId')) return false;
  return value.every(raw => { const m = record(raw); return !!m && keys(m, ['assetId', 'sha256', 'width', 'height'])
    && uuid(m.assetId) && hash(m.sha256) && positiveInteger(m.width) && m.width <= 1600 && positiveInteger(m.height) && m.height <= 1600; });
}
function publicPoint(raw: unknown) {
  const r = record(raw); return !!r && keys(r, ['label', 'city', 'area']) && Object.values(r).every(v => nullableText(v, 1000));
}
function publicFacts(value: unknown) {
  if (!Array.isArray(value) || value.length > MAX_NEED_FACT_V2_PAYLOAD || !unique(value, 'key')) return false;
  return value.every(raw => {
    const f = record(raw);
    if (!f || !keys(f, ['key', 'value', 'displayValue', 'status']) || typeof f.key !== 'string' || !isNeedFactV2Key(f.key)
      || NEED_FACT_V2_DEFINITIONS[f.key].privacyClass !== 'PUBLIC' || f.key === 'need.public_photo_paths'
      || !nullableText(f.displayValue, 2000) || !member(f.status, ['NEEDS_CONFIRMATION', 'INFERRED', 'CONFIRMED', 'UNKNOWN'])) return false;
    const v = f.value, kind = NEED_FACT_V2_DEFINITIONS[f.key].valueType;
    if (v === null) return true;
    if (kind === 'TEXT_ARRAY') return Array.isArray(v) && v.length <= 100 && v.every(x => str(x, 1000));
    if (kind === 'BOOLEAN') return typeof v === 'boolean';
    if (kind === 'INTEGER') return typeof v === 'number' && Number.isSafeInteger(v) && v >= (f.key === 'need.minimum_experience_years' ? 0 : 1)
      && v <= (f.key === 'need.price_rsd' ? 100_000_000 : f.key === 'need.people_needed' ? 50 : 60);
    if (kind === 'TIMESTAMPTZ') return timestamp(v);
    if (f.key === 'need.handoff') return decodeServiceHandoff(v) !== null;
    if (f.key === 'need.price_mode') return member(v, ['FASTEST', 'MY_PRICE', 'OFFERS']);
    if (f.key === 'need.schedule_kind') return member(v, ['FIXED_WINDOW', 'FLEXIBLE', 'REMOTE_ANYTIME', 'TODAY_FLEXIBLE', 'TOMORROW_FLEXIBLE', 'WEEK_FLEXIBLE']);
    if (kind !== 'OBJECT') return str(v, 6000);
    const g = record(v);
    return !!g && keys(g, ['mode', 'start', 'end', 'serviceArea', 'waypoints'])
      && member(g.mode, ['STATIONARY', 'POINT_TO_POINT', 'MULTI_STOP', 'AREA_BASED', 'REMOTE'])
      && publicPoint(g.start) && publicPoint(g.end) && publicPoint(g.serviceArea)
      && Array.isArray(g.waypoints) && g.waypoints.length <= 50 && g.waypoints.every(publicPoint);
  });
}
/** Explicit snapshot allowlists prevent a new nested server field from becoming
 * a route, image URL or private-data dump in the support UI. */
export function decodeSupportSnapshot(raw: unknown): SupportSnapshot | null {
  const r = record(raw);
  if (!r || !keys(r, ['kind', 'id', 'revision', 'content']) || !decodeSupportReference({ kind: r.kind, id: r.id, revision: r.revision })) return null;
  const c = record(r.content); if (!c) return null;
  let valid = false;
  if (r.kind === 'TASK') valid = keys(c, ['title', 'description', 'status', 'createdAt', 'executionMode', 'countryCode', 'submitterRole', 'media'])
    && nullableText(c.title, 140) && nullableText(c.description, 6000) && member(c.status, ['DRAFT', 'PUBLISHED', 'SELECTION', 'ACTIVE', 'COMPLETED', 'CANCELLED', 'EXPIRED', 'ARCHIVED'])
    && timestamp(c.createdAt) && (c.executionMode === null || member(c.executionMode, ['STATIONARY', 'POINT_TO_POINT', 'MULTI_STOP', 'AREA_BASED', 'REMOTE']))
    && (c.countryCode === null || typeof c.countryCode === 'string' && /^[A-Z]{2}$/.test(c.countryCode))
    && member(c.submitterRole, ['REQUESTER', 'READER']) && media(c.media);
  else if (r.kind === 'AGREEMENT') valid = keys(c, ['needId', 'status', 'createdAt', 'submitterRole']) && uuid(c.needId)
    && member(c.status, ['CONFIRMED', 'COMPLETED', 'CANCELLED']) && timestamp(c.createdAt) && member(c.submitterRole, ['REQUESTER', 'WORKER']);
  else if (r.kind === 'AGREEMENT_MESSAGE') valid = (keys(c, ['agreementId', 'body', 'createdAt', 'mine'])
    || keys(c, ['agreementId', 'body', 'createdAt', 'mine', 'media']) && media(c.media)) && uuid(c.agreementId)
    && str(c.body, 6000) && timestamp(c.createdAt) && typeof c.mine === 'boolean';
  else if (r.kind === 'GROUP_MESSAGE') valid = keys(c, ['groupId', 'sequence', 'body', 'createdAt', 'mine']) && uuid(c.groupId)
    && sequence(c.sequence) && str(c.body, 2000) && timestamp(c.createdAt) && typeof c.mine === 'boolean';
  else if (r.kind === 'SAFETY_REPORT') valid = keys(c, ['category', 'needId', 'agreementId', 'createdAt'])
    && member(c.category, ['HARASSMENT', 'FRAUD', 'UNSAFE_WORK', 'DISCRIMINATION', 'OTHER'])
    && nullableUuid(c.needId) && nullableUuid(c.agreementId) && timestamp(c.createdAt);
  else if (r.kind === 'TASK_REVIEW') {
    const p = record(c.policy), e = record(c.evaluation);
    valid = keys(c, ['draftId', 'draftRevision', 'displayedContentDigest', 'publicFacts', 'safety', 'createdAt', 'policy', 'evaluation', 'media'])
      && nullableUuid(c.draftId) && (c.draftRevision === null || typeof c.draftRevision === 'number' && Number.isSafeInteger(c.draftRevision) && c.draftRevision >= 0)
      && hash(c.displayedContentDigest) && publicFacts(c.publicFacts) && member(c.safety, ['ALLOW', 'CLARIFY', 'REVIEW', 'BLOCK']) && timestamp(c.createdAt)
      && !!p && keys(p, ['bundleId', 'version', 'contentSha256']) && nullableUuid(p.bundleId)
      && (p.version === null || positiveInteger(p.version)) && (p.contentSha256 === null || hash(p.contentSha256))
      && (c.evaluation === null || !!e && keys(e, ['kind', 'outcome', 'safeReasonCodes'])
        && nullableText(e.kind, 100) && nullableText(e.outcome, 100) && (e.safeReasonCodes === null
          || Array.isArray(e.safeReasonCodes) && e.safeReasonCodes.length <= 50 && e.safeReasonCodes.every(v => typeof v === 'string' && /^[A-Z][A-Z0-9_]{0,127}$/.test(v))))
      && media(c.media);
  }
  return valid ? r as SupportSnapshot : null;
}
export function decodeSupportInbox(raw: unknown, accountId: string, mode: SupportMode, before: string | null): SupportInbox | null {
  const r = record(raw);
  if (!supportEnvelope(r, accountId) || !keys(r, ['accountId', 'mode', 'operatorAvailable', 'cases', 'nextBeforeCaseNumber', 'authoritative'])
    || r.mode !== mode || typeof r.operatorAvailable !== 'boolean' || mode !== 'OWN' && !r.operatorAvailable
    || !Array.isArray(r.cases) || r.cases.length > 50 || !unique(r.cases) || !unique(r.cases, 'caseNumber')) return null;
  let previous = before === null ? Infinity : Number(before);
  for (const rawCase of r.cases) {
    const c = record(rawCase);
    if (!c || !keys(c, ['id', 'caseNumber', 'channel', 'topic', 'status', 'revision', 'lastSequence', 'createdAt', 'updatedAt', 'context', 'unread'])
      || !uuid(c.id) || !sequence(c.caseNumber) || Number(c.caseNumber) >= previous || !classified(c)
      || mode === 'SAFETY' && c.channel !== 'SAFETY' || !positiveInteger(c.revision) || !sequence(c.lastSequence)
      || !timestamp(c.createdAt) || !timestamp(c.updatedAt) || typeof c.unread !== 'boolean'
      || c.context !== null && !decodeSupportReference(c.context)) return null;
    previous = Number(c.caseNumber);
  }
  if (r.nextBeforeCaseNumber !== null && (r.cases.length !== 50 || r.nextBeforeCaseNumber !== record(r.cases.at(-1))?.caseNumber)) return null;
  return r as SupportInbox;
}
export function decodeSupportDetail(raw: unknown, accountId: string, caseId: string, after: string): SupportDetail | null {
  const r = record(raw);
  if (!supportEnvelope(r, accountId) || !keys(r, ['accountId', 'case', 'viewerRole', 'operatorAvailable', 'allowedActions', 'events',
    'decisions', 'appeals', 'evidence', 'nextAfterSequence', 'authoritative']) || !member(r.viewerRole, ['AUTHOR', 'OPERATOR'])
    || typeof r.operatorAvailable !== 'boolean' || r.viewerRole === 'OPERATOR' && !r.operatorAvailable) return null;
  const c = record(r.case);
  if (!c || !keys(c, ['id', 'caseNumber', 'authorAccountId', 'channel', 'topic', 'title', 'desiredOutcome', 'context', 'status', 'revision', 'lastSequence', 'createdAt', 'updatedAt'])
    || c.id !== caseId || !sequence(c.caseNumber) || !uuid(c.authorAccountId) || !classified(c) || !positiveInteger(c.revision)
    || !sequence(c.lastSequence) || !str(c.title, 200) || !(c.title as string).trim() || !nullableText(c.desiredOutcome, 1000)
    || !timestamp(c.createdAt) || !timestamp(c.updatedAt) || !record(c.context)
    || Object.keys(c.context as object).length > 0 && !decodeSupportSnapshot(c.context)
    || (r.viewerRole === 'AUTHOR') !== (c.authorAccountId === accountId)) return null;
  const actions = r.allowedActions;
  if (!Array.isArray(actions) || actions.length > 9 || new Set(actions).size !== actions.length
    || actions.some(a => a === 'CREATE' || !member(a, supportKinds))
    || actions.some(a => r.viewerRole === 'AUTHOR' ? !['AUTHOR_REPLY', 'APPEAL', 'CLOSE'].includes(a) : ['AUTHOR_REPLY', 'APPEAL'].includes(a))) return null;
  for (const field of ['events', 'decisions', 'appeals', 'evidence']) {
    const items = r[field]; if (!Array.isArray(items) || items.length > (field === 'evidence' ? 2500 : 50) || !unique(items)) return null;
  }
  const events = r.events as unknown[], decisions = r.decisions as unknown[], appeals = r.appeals as unknown[], evidence = r.evidence as unknown[];
  let last = Number(after);
  for (const rawEvent of events) {
    const e = record(rawEvent);
    if (!e || !keys(e, ['id', 'caseId', 'sequence', 'kind', 'authorRole', 'body', 'createdAt', 'decisionId', 'appealId']) || !uuid(e.id)
      || e.caseId !== caseId || !sequence(e.sequence) || Number(e.sequence) <= last || Number(e.sequence) > Number(c.lastSequence)
      || !member(e.kind, [...supportKinds, 'SAFETY_REPORT']) || !member(e.authorRole, ['AUTHOR', 'OPERATOR'])
      || !nullableText(e.body, 4000) || !timestamp(e.createdAt) || !nullableUuid(e.decisionId) || !nullableUuid(e.appealId)) return null;
    last = Number(e.sequence);
  }
  if (r.nextAfterSequence !== null && (events.length !== 50 || r.nextAfterSequence !== record(events.at(-1))?.sequence)) return null;
  for (const rawDecision of decisions) {
    const d = record(rawDecision);
    if (!d || !keys(d, ['id', 'caseId', 'caseRevision', 'outcome', 'reasonCode', 'explanation', 'effect', 'evidenceIds', 'priorDecisionId', 'createdAt', 'reviewType'])
      || !uuid(d.id) || d.caseId !== caseId || !positiveInteger(d.caseRevision) || d.caseRevision > c.revision
      || !member(d.outcome, ['ACCEPTED', 'REJECTED']) || typeof d.reasonCode !== 'string' || !/^[A-Z][A-Z0-9_]{0,63}$/.test(d.reasonCode)
      || !str(d.explanation, 4000) || d.effect !== 'NONE' || !Array.isArray(d.evidenceIds) || d.evidenceIds.length > 50
      || d.evidenceIds.some(x => !uuid(x)) || new Set(d.evidenceIds).size !== d.evidenceIds.length || !nullableUuid(d.priorDecisionId)
      || !timestamp(d.createdAt) || !member(d.reviewType, ['INITIAL', 'RECONSIDERATION'])
      || (d.reviewType === 'INITIAL') !== (d.priorDecisionId === null)
      || !events.some(e => record(e)?.decisionId === d.id)) return null;
  }
  for (const rawAppeal of appeals) {
    const a = record(rawAppeal);
    if (!a || !keys(a, ['id', 'caseId', 'decisionId', 'status', 'decisionResultId', 'createdAt']) || !uuid(a.id) || a.caseId !== caseId
      || !uuid(a.decisionId) || !member(a.status, ['RECEIVED', 'IN_REVIEW', 'DECIDED']) || !nullableUuid(a.decisionResultId)
      || (a.status === 'DECIDED') !== (a.decisionResultId !== null) || !timestamp(a.createdAt)
      || !events.some(e => record(e)?.appealId === a.id)) return null;
  }
  for (const rawEvidence of evidence) {
    const e = record(rawEvidence);
    if (!e || !keys(e, ['id', 'eventId', 'reference', 'createdAt']) || !uuid(e.id) || !uuid(e.eventId)
      || !decodeSupportSnapshot(e.reference) || !timestamp(e.createdAt) || !events.some(x => record(x)?.id === e.eventId)) return null;
  }
  return r as SupportDetail;
}
