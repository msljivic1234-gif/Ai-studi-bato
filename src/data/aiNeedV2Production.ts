import { AI_CREDITS_UNAVAILABLE, AI_CREDITS_UNAVAILABLE_COPY, AI_DIAGNOSTICS_HEADER, AI_DIAGNOSTICS_VERSION } from '../contracts/aiAvailability';
import type {
  AiNeedConversationAbandoned, AiNeedConversationOpened, AiNeedDraftSaved,
  AiNeedEditConfirmed, AiNeedEditOpened, AiNeedMessage, AiNeedSafety,
  AiNeedTurnReceipt, AiNeedTurnStatus, AiNeedTurnRecovery, AiNeedV2Conversation, AiNeedV2Fact, AiNeedV2Review,
} from '../contracts/aiNeedV2';
import { MAX_AI_NEED_FACT_V2_PROPOSALS, MAX_NEED_FACT_V2_PAYLOAD, NEED_FACT_SCHEMA_V2, NEED_FACT_TURN_CAPABILITY_HEADER, NEED_FACT_TURN_CAPABILITY_VERSION, NEED_FACT_V2_DEFINITIONS, isNeedFactV2Key } from '../contracts/needFactsV2';
import { decodeTaskApplicationDeadlineFact } from '../contracts/taskApplicationDeadline';
import { decodeServiceHandoff } from '../contracts/serviceHandoff';
import type { AiConversationIntent } from '../contracts/aiConversationIntent';
import type { Ishod } from './ports';
import { supabaseKlijent } from './supabaseClient';
import { readPublicSupabaseConfig } from './publicSupabaseConfig';
import { listOpenIntakes } from './aiOpenIntakes';
import { sesijaSada } from '../store/sesija';
import { aiAvailabilityFromSdkError, requestAiTurnStream, type AiTurnStreamOptions } from './aiNeedTurnStream';
import { capabilityTerms } from '../lib/capabilityTerms';
import { countryCode } from '../lib/market';
import { locationPayloadFits, normalizeNeedLocation, normalizeTaskGeography } from '../lib/location';
import { failure as fail, positiveInteger, readOwnedResult, readReceipt, record, sameId, timestamp, uuid,
  type ReceiptAccount } from './serverReceipt';

const NEED_EDIT_COPY: Record<string, string> = {
  PUBLISHED_TASK_EDIT_NOT_READY: 'Objavljivanje izmena trenutno nije dostupno. Postojeća objava nije promenjena; izmene ostaju u razgovoru.',
  NEED_EDIT_LOCKED_AFTER_FIRST_DOGOVOR:
    'Zadatak više ne može da se menja jer je već sklopljen Dogovor. Promene idu kroz izmenu Dogovora.',
  NEED_NOT_EDITABLE_PUBLIC_STATE: 'Ovaj zadatak trenutno nije u stanju u kom može da se menja.',
  NEED_EDIT_GEOGRAPHY_NOT_READY: 'Lokacija zadatka još nije spremna za izmenu.',
  NEED_NOT_OWNED: 'Samo vlasnik zadatka može da ga menja.',
  NOT_OWNER: 'Samo vlasnik zadatka može da ga menja.',
  NEED_NOT_FOUND: 'Zadatak nije pronađen.',
  STALE_REVIEW_REQUIRED: 'Zadatak je u međuvremenu promenjen. Otvorite ga ponovo i proverite podatke.',
  NEED_EDIT_CONFLICT: 'Zadatak je u međuvremenu promenjen. Otvorite ga ponovo i proverite podatke.',
  NEED_EDIT_BUSY: 'Razgovor o ovom zadatku trenutno obrađuje drugu radnju. Sačekajte kratko i osvežite prikaz pre ponovnog otvaranja izmene.',
  EDIT_FACTS_REQUIRE_HUMAN_CONFIRMATION: 'Potvrdite podatke u pregledu pre čuvanja izmena.',
  REQUIRED_CONFIRMED_FACTS_MISSING: 'Nedostaju obavezni podaci. Dopunite ih pre čuvanja.',
  NO_MATERIAL_CHANGE: 'Nijedan podatak nije promenjen.',
  EDIT_CONVERSATION_NOT_CONFIRMABLE: 'Ova izmena više nije otvorena. Pokrenite izmenu ponovo iz zadatka.',
  EDIT_CONVERSATION_NEED_MISMATCH: 'Ova izmena ne pripada ovom zadatku.',
  MY_PRICE_AMOUNT_REQUIRED: 'Unesite cenu ili izaberite prikupljanje ponuda.',
  FIXED_WINDOW_BOUNDS_REQUIRED: 'Unesite početak termina. Kraj je opcioni; ako ga navedete, mora biti kasnije.',
};


const ERRORS: Readonly<Record<string, string>> = {
  ...NEED_EDIT_COPY,
  IDENTITY_VERIFICATION_UNAVAILABLE: 'Provera identiteta nije dostupna. U pregledu uklonite taj uslov da nastavite običnim zadatkom.',
  AUTH_REQUIRED: 'Prijavite se da nastavite.',
  AUTH_ACCOUNT_CHANGED: 'Nalog je promenjen. Ponovo otvorite razgovor.',
  CONVERSATION_NOT_FOUND: 'Razgovor nije pronađen.',
  CONVERSATION_NOT_OPEN: 'Ovaj razgovor više nije otvoren.',
  CONVERSATION_PURPOSE_MISMATCH: 'Ovaj razgovor ne pripada unosu zadatka.',
  CONVERSATION_SCHEMA_MISMATCH: 'Ovaj razgovor nije spreman za ovaj unos.',
  REQUESTER_PROFILE_NOT_READY: 'Profil za objavu zadataka nije spreman.',
  NEED_REVISION_STALE: 'Zadatak je u međuvremenu promenjen. Ponovo proverite podatke.',
  CLIENT_REQUEST_ID_INVALID: 'Zahtev nije ispravan. Ponovo otvorite razgovor.',
  AI_RATE_LIMITED: 'Zahtevi su trenutno ograničeni. Proverite ishod pre ponovnog pokušaja.',
  AI_ACCESS_DENIED: 'Pristup razgovoru nije odobren. Ponovo otvorite razgovor.',
  AI_SERVICE_UNAVAILABLE: 'AI trenutno nije dostupan.',
  [AI_CREDITS_UNAVAILABLE]: AI_CREDITS_UNAVAILABLE_COPY,
  AI_REQUEST_ID_REUSED: 'Ovaj zahtev već pripada drugoj poruci. Proverite prethodni rezultat.',
  CONVERSATION_NOT_ABANDONABLE: 'Ovaj razgovor više ne može da se napusti. Proverite njegovo stanje.',
  CLIENT_REQUEST_ID_REUSED_WITH_DIFFERENT_SNAPSHOT: 'Ovaj zahtev već pripada drugom pregledu. Proverite sačuvano stanje.',
  DRAFT_SAVE_BLOCKED_BY_SAFETY: 'Proverite zahtev pre čuvanja nacrta.',
  FACT_NOT_FOUND: 'Podatak više nije dostupan. Osvežite pregled.',
  FACT_SUPERSEDED: 'Podatak je u međuvremenu promenjen. Osvežite pregled.',
  // What the server actually raises on a correction or a confirmation (deep read 7.24). Each of these is
  // an answer "no, because…", not a lost reply, so it must not read "Ishod radnje nije potvrđen".
  SUPERSEDED: 'Podatak je u međuvremenu promenjen. Osvežite pregled.',
  AI_NEED_DRAFT_BLOCKED: 'Proverite zahtev pre čuvanja nacrta.',
  CONVERSATION_CLOSED: 'Ovaj razgovor je zatvoren. Otvorite zadatak ponovo.',
  CONVERSATION_NOT_EDITABLE: 'Ovaj razgovor više ne može da se menja.',
  FACT_SCOPE_NOT_EDITABLE: 'Ovaj podatak ne može da se menja ovde.',
  LOCATION_EDITOR_REQUIRED: 'Mesto izmenite na mapi, u delu za lokaciju.',
  CONFIRMED_PROVENANCE_INVALID: 'Ovaj podatak ne može da se potvrdi ovde. Izmenite ga, pa potvrdite.',
  V2_FACT_DISPLAY_INVALID: 'Tekst nije ispravan ili je predugačak.',
  V2_FACT_VALUE_REQUIRED: 'Unesite vrednost.',
  V2_FACT_INTEGER_REQUIRED: 'Unesite ceo broj.',
  V2_FACT_TYPE_INVALID: 'Vrednost nije odgovarajućeg oblika.',
  V2_FACT_ARRAY_ITEM_INVALID: 'Proverite listu: najviše 50 stavki, do 500 znakova po stavci.',
  V2_FACT_TIMESTAMP_SHAPE_INVALID: 'Termin nije ispravan. Proverite datum i vreme.',
  V2_TIMESTAMP_INVALID: 'Termin nije ispravan. Proverite datum i vreme.',
  V2_PRICE_INVALID: 'Iznos mora biti između 1 i 100.000.000 RSD.',
  V2_PEOPLE_INVALID: 'Broj ljudi mora biti između 1 i 50.',
  V2_EXPERIENCE_INVALID: 'Iskustvo može biti od 0 do 60 godina.',
  V2_TITLE_INVALID: 'Naslov može imati najviše 140 znakova.',
  V2_CATEGORY_INVALID: 'Tekst nije ispravan ili je predugačak.',
  V2_DESCRIPTION_INVALID: 'Opis može imati najviše 6.000 znakova.',
  V2_EXACT_ADDRESS_INVALID: 'Adresa može imati najviše 1.000 znakova.',
  V2_ACCESS_NOTES_INVALID: 'Napomena o pristupu može imati najviše 2.000 znakova.',
  V2_PRICE_MODE_INVALID: 'Cena može biti „moja cena“ ili „ponude“.',
  V2_PRICE_BASIS_INVALID: 'Cena može biti „ukupno“, „po osobi“ ili „po osobi po satu“.',
  V2_SCHEDULE_KIND_INVALID: 'Termin izmenite prirodnim jezikom kroz razgovor.',
  V2_AREA_GEOGRAPHY_INVALID: 'Lokaciju izmenite kroz razgovor.',
  V2_STATIONARY_GEOGRAPHY_INVALID: 'Lokaciju izmenite kroz razgovor.',
  V2_POINT_TO_POINT_GEOGRAPHY_INVALID: 'Lokaciju izmenite kroz razgovor.',
  V2_MULTI_STOP_GEOGRAPHY_INVALID: 'Lokaciju izmenite kroz razgovor.',
  V2_TASK_GEOGRAPHY_MODE_INVALID: 'Lokaciju izmenite kroz razgovor.',
  V2_TASK_GEOGRAPHY_LOCATION_INVALID: 'Lokaciju izmenite kroz razgovor.',
  V2_TASK_GEOGRAPHY_WAYPOINTS_INVALID: 'Lokaciju izmenite kroz razgovor.',
  V2_REMOTE_MUST_HAVE_NO_PHYSICAL_GEOGRAPHY: 'Zadatak na daljinu nema mesto izvođenja. Lokaciju izmenite kroz razgovor.',
};
const SAFETY = ['ALLOW', 'CLARIFY', 'REVIEW', 'BLOCK'] as const;
const STATUS = ['OPEN', 'COMPLETED', 'ABANDONED'] as const;
const REQUEST_TIMEOUT_MS = 15_000;
const FAILED_ENVELOPE_MAX_BYTES = 8192;
const safety = (value: unknown): value is AiNeedSafety => SAFETY.some(item => item === value);
function exact(raw: unknown, keys: readonly string[]): Record<string, unknown> | null {
  const value = record(raw);
  return value && Object.keys(value).length === keys.length && keys.every(key => Object.prototype.hasOwnProperty.call(value, key)) ? value : null;
}
function boundedText(raw: unknown, max: number): raw is string {
  return typeof raw === 'string' && raw.trim().length > 0 && Array.from(raw).length <= max
    && !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(raw);
}
function commandKey(value: unknown): value is string {
  return boundedText(value, 200) && value.replace(/^ +| +$/g, '').length >= 8;
}
function scope(): ReceiptAccount | undefined {
  const state = sesijaSada();
  return state.user?.id ? { accountId: state.user.id, accountRevision: state.accountRevision } : undefined;
}
function scopeCurrent(account: ReceiptAccount): boolean {
  const current = sesijaSada();
  return current.user?.id === account.accountId && current.accountRevision === account.accountRevision;
}
// `null` is reserved for an actual missing owned conversation, never a malformed DTO.
const invalidResponse = () => ({ data: undefined, error: null });
const scopeChanged = () => ({ data: null, error: { message: 'AUTH_ACCOUNT_CHANGED' } });
function uuidList(value: unknown, max: number): value is string[] {
  return Array.isArray(value) && value.length <= max && value.every(uuid)
    && new Set(value.map(id => id.toLowerCase())).size === value.length;
}
function safeJson(value: unknown, depth = 0): boolean {
  if (depth > 8) return false;
  if (value === null || typeof value === 'boolean' || typeof value === 'string') return true;
  if (typeof value === 'number') return Number.isFinite(value);
  if (Array.isArray(value)) return value.length <= 1000 && value.every(item => safeJson(item, depth + 1));
  const object = record(value);
  return !!object && Object.keys(object).length <= 100 && Object.values(object).every(item => safeJson(item, depth + 1));
}

function turnReceipt(raw: unknown): AiNeedTurnReceipt | null {
  const r = exact(raw, ['userMessageId', 'assistantMessageId', 'proposedCount', 'safety', 'schemaVersion', 'authoritative']);
  if (!r || !uuid(r.userMessageId) || !uuid(r.assistantMessageId) || sameId(r.userMessageId, r.assistantMessageId)
    || typeof r.proposedCount !== 'number' || !Number.isInteger(r.proposedCount) || r.proposedCount < 0 || r.proposedCount > MAX_AI_NEED_FACT_V2_PROPOSALS
    || !safety(r.safety) || r.schemaVersion !== NEED_FACT_SCHEMA_V2 || r.authoritative !== true) return null;
  return { userMessageId: r.userMessageId, assistantMessageId: r.assistantMessageId, proposedCount: r.proposedCount,
    safety: r.safety, schemaVersion: NEED_FACT_SCHEMA_V2, authoritative: true };
}
function turnStatus(raw: unknown, conversationId: string, clientRequestId: string): AiNeedTurnStatus | null {
  const r = exact(raw, ['conversationId', 'clientRequestId', 'state', 'turnId', 'retryAllowed', 'receipt']);
  if (!r || !sameId(r.conversationId, conversationId) || !sameId(r.clientRequestId, clientRequestId)
    || typeof r.retryAllowed !== 'boolean') return null;
  const ids = { conversationId: r.conversationId, clientRequestId: r.clientRequestId };
  if (r.state === 'ABSENT') return r.turnId === null && r.receipt === null
    ? { ...ids, state: r.state, turnId: null, retryAllowed: r.retryAllowed, receipt: null } : null;
  if (!uuid(r.turnId)) return null;
  if (r.state === 'PROCESSING' || r.state === 'FAILED') return r.receipt === null && (r.state !== 'PROCESSING' || r.retryAllowed === false)
    ? { ...ids, state: r.state, turnId: r.turnId, retryAllowed: r.retryAllowed, receipt: null } : null;
  const receipt = turnReceipt(r.receipt);
  return r.state === 'SUCCEEDED' && r.retryAllowed === false && receipt
    ? { ...ids, state: r.state, turnId: r.turnId, retryAllowed: false, receipt } : null;
}

/** Contextual location replies use the same owned turn receipt, never a looser decoder. */
export { turnStatus as decodeAiNeedTurnStatus };

function turnRecovery(raw: unknown, accountId: string, conversationId: string, clientRequestId: string): AiNeedTurnRecovery | null {
  const r = exact(raw, ['accountId', 'conversationId', 'clientRequestId', 'conversationStatus', 'turn',
    'providerDispatched', 'cancelled', 'canCancel', 'authoritative']);
  if (!r || !sameId(r.accountId, accountId) || !sameId(r.conversationId, conversationId)
    || !sameId(r.clientRequestId, clientRequestId) || !STATUS.includes(r.conversationStatus as typeof STATUS[number])
    || typeof r.providerDispatched !== 'boolean' || typeof r.cancelled !== 'boolean' || typeof r.canCancel !== 'boolean'
    || r.authoritative !== true) return null;
  const turn = turnStatus(r.turn, conversationId, clientRequestId);
  if (!turn || (r.providerDispatched && turn.retryAllowed)
    || (r.cancelled && (turn.state !== 'FAILED' || turn.retryAllowed || r.canCancel))
    || (r.canCancel && (r.conversationStatus !== 'OPEN' || turn.state === 'SUCCEEDED'
      || (r.providerDispatched && turn.state !== 'PROCESSING')))
    || (turn.state === 'ABSENT' && (r.providerDispatched || r.cancelled))) return null;
  return { accountId: r.accountId, conversationId: r.conversationId, clientRequestId: r.clientRequestId,
    conversationStatus: r.conversationStatus as AiNeedTurnRecovery['conversationStatus'], turn,
    providerDispatched: r.providerDispatched, cancelled: r.cancelled, canCancel: r.canCancel, authoritative: true };
}

/** HTTP status is diagnostic, never a write receipt or permission to retry.
 * Do not read provider/Auth response bodies to obtain user-facing copy. */
function transportErrorName(error: unknown): string | null {
  const status = record(record(error)?.context)?.status;
  if (status === 401) return 'AUTH_REQUIRED';
  if (status === 403) return 'AI_ACCESS_DENIED';
  if (status === 429) return 'AI_RATE_LIMITED';
  if (status === 502 || status === 503 || status === 504) return 'AI_SERVICE_UNAVAILABLE';
  return null;
}

/** Only the documented HTTP409 terminal envelope can turn an SDK error into a
 * receipt. Never inspect provider/auth/rate-limit error bodies or reflect text. */
async function failedTurnEnvelope(error: unknown, conversationId: string, clientRequestId: string,
  deadline: number, account: ReceiptAccount): Promise<AiNeedTurnStatus | null> {
  const context = record(record(error)?.context);
  const retired = () => Date.now() >= deadline || !scopeCurrent(account);
  if (retired() || !context || context.status !== 409 || typeof context.clone !== 'function') return null;
  const response = (context.clone as () => Response).call(context);
  const length = response.headers?.get('content-length');
  if ((length && (!/^\d+$/.test(length) || Number(length) > FAILED_ENVELOPE_MAX_BYTES)) || !response.body) {
    void response.body?.cancel().catch(() => undefined); return null;
  }
  const reader = response.body.getReader();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const cancel = () => { void reader.cancel().catch(() => undefined); };
  try {
    const read = async (): Promise<AiNeedTurnStatus | null> => {
      let text = '', total = 0;
      while (true) {
        const part = await reader.read();
        if (retired()) { part.value?.fill(0); return null; }
        if (part.done) break;
        total += part.value.byteLength;
        // This exact envelope contains UUIDs, enum tokens, booleans and ASCII
        // JSON syntax only. Reject other bytes without an unbounded text read.
        if (total > FAILED_ENVELOPE_MAX_BYTES || part.value.some(byte => byte > 127)) { part.value.fill(0); return null; }
        text += String.fromCharCode(...part.value); part.value.fill(0);
      }
      if (retired() || (length !== null && length !== undefined && Number(length) !== total)) return null;
      const result = turnStatus(JSON.parse(text), conversationId, clientRequestId);
      return result?.state === 'FAILED' ? result : null;
    };
    return await Promise.race([read(), new Promise<null>(resolve => {
      timer = setTimeout(() => { cancel(); resolve(null); }, Math.max(0, deadline - Date.now()));
    })]);
  } finally { if (timer) clearTimeout(timer); cancel(); }
}

function validFactValue(key: AiNeedV2Fact['key'], value: unknown): boolean {
  if (key === 'need.response_deadline') return decodeTaskApplicationDeadlineFact(value) !== null;
  const type = NEED_FACT_V2_DEFINITIONS[key].valueType;
  if (type === 'TEXT_ARRAY') return capabilityTerms(value) !== null;
  if (type === 'BOOLEAN') return typeof value === 'boolean';
  if (type === 'INTEGER') {
    const max = key === 'need.price_rsd' ? 100_000_000 : key === 'need.people_needed' ? 50 : 60;
    return typeof value === 'number' && Number.isInteger(value) && value >= (key === 'need.minimum_experience_years' ? 0 : 1) && value <= max;
  }
  if (key === 'need.task_country_code') return typeof value === 'string' && countryCode(value) === value;
  if (key === 'need.task_geography') return normalizeTaskGeography(value) !== null;
  if (key === 'need.handoff') return decodeServiceHandoff(value) !== null;
  if (key === 'need.resolved_location') {
    const resolved = record(value);
    return !!resolved && !!normalizeNeedLocation({ ...record(resolved.binding), accessNotes: null, resolvedLocation: value })?.resolvedLocation;
  }
  if (type === 'TIMESTAMPTZ') return timestamp(value);
  if (key === 'need.price_mode') return ['FASTEST', 'MY_PRICE', 'OFFERS'].some(item => item === value);
  if (key === 'need.price_basis') return ['TOTAL', 'PER_PERSON', 'HOURLY'].some(item => item === value);
  if (key === 'need.schedule_kind') return ['FIXED_WINDOW', 'FLEXIBLE', 'REMOTE_ANYTIME', 'TODAY_FLEXIBLE', 'TOMORROW_FLEXIBLE', 'WEEK_FLEXIBLE'].some(item => item === value);
  const max = key === 'need.title' ? 140 : key === 'need.category' ? 120 : key === 'need.exact_address' ? 1000 : key === 'need.access_notes' ? 2000 : 6000;
  return boundedText(value, max);
}
function mapFact(raw: unknown): AiNeedV2Fact | null {
  const r = exact(raw, ['id', 'key', 'value', 'displayValue', 'status', 'source', 'evidence', 'schemaVersion', 'valueType', 'privacyClass', 'requiredForDraft', 'material']);
  if (!r || !uuid(r.id) || typeof r.key !== 'string' || !isNeedFactV2Key(r.key) || r.schemaVersion !== NEED_FACT_SCHEMA_V2
    || !boundedText(r.displayValue, 1000) || typeof r.material !== 'boolean'
    || !['NEEDS_CONFIRMATION', 'INFERRED', 'CONFIRMED', 'UNKNOWN'].some(item => item === r.status)
    || !['EXPLICIT_USER_ANSWER', 'CONFIRMED_PROFILE', 'AI_INFERENCE', 'SYSTEM', 'SYSTEM_DERIVED'].some(item => item === r.source)
    || !(r.evidence === null || boundedText(r.evidence, 4000))) return null;
  const definition = NEED_FACT_V2_DEFINITIONS[r.key];
  if (r.valueType !== definition.valueType || r.privacyClass !== definition.privacyClass
    || r.requiredForDraft !== definition.requiredForDraft || !validFactValue(r.key, r.value)) return null;
  const manual = r.key === 'need.resolved_location';
  if (manual && (r.status !== 'CONFIRMED' || r.source !== 'EXPLICIT_USER_ANSWER' || r.evidence !== null)) return null;
  return { id: r.id, key: r.key, value: r.value,
    displayValue: manual ? `Potvrđene privatne tačke: ${(r.value as { points: unknown[] }).points.length}` : r.displayValue,
    valueType: definition.valueType, privacyClass: definition.privacyClass, requiredForDraft: r.requiredForDraft,
    status: r.status as AiNeedV2Fact['status'], source: r.source as AiNeedV2Fact['source'], evidence: r.evidence as string | null };
}
function mapReview(raw: unknown, conversationId: string): (AiNeedV2Review & { status: string; safety: AiNeedSafety }) | null {
  const r = exact(raw, ['conversationId', 'schemaVersion', 'status', 'boundNeedId', 'facts', 'missingRequired', 'safety', 'canSaveDraft']);
  if (!r || !sameId(r.conversationId, conversationId) || r.schemaVersion !== NEED_FACT_SCHEMA_V2
    || !STATUS.some(item => item === r.status) || !(r.boundNeedId === null || uuid(r.boundNeedId))
    || !safety(r.safety) || typeof r.canSaveDraft !== 'boolean' || !Array.isArray(r.facts) || r.facts.length > MAX_NEED_FACT_V2_PAYLOAD
    || !Array.isArray(r.missingRequired) || r.missingRequired.length > MAX_NEED_FACT_V2_PAYLOAD
    || !r.missingRequired.every(key => typeof key === 'string' && isNeedFactV2Key(key) && NEED_FACT_V2_DEFINITIONS[key].requiredForDraft)
    || new Set(r.missingRequired).size !== r.missingRequired.length) return null;
  const facts: AiNeedV2Fact[] = [];
  for (const rawFact of r.facts) { const fact = mapFact(rawFact); if (!fact) return null; facts.push(fact); }
  if (new Set(facts.map(fact => fact.id.toLowerCase())).size !== facts.length || new Set(facts.map(fact => fact.key)).size !== facts.length) return null;
  const missing = Object.entries(NEED_FACT_V2_DEFINITIONS).filter(([key, definition]) => definition.requiredForDraft
    && !facts.some(fact => fact.key === key && fact.status === 'CONFIRMED')).map(([key]) => key);
  const missingRequired = r.missingRequired;
  if (missing.length !== missingRequired.length || missing.some(key => !missingRequired.includes(key))
    || (r.canSaveDraft && (r.status !== 'OPEN' || missing.length !== 0 || r.safety === 'BLOCK'))) return null;
  return { conversationId: r.conversationId, schemaVersion: NEED_FACT_SCHEMA_V2, status: r.status as string,
    boundNeedId: r.boundNeedId as string | null, canSaveDraft: r.canSaveDraft,
    missingRequired: r.missingRequired as AiNeedV2Review['missingRequired'], facts, safety: r.safety };
}
function mapConversation(raw: unknown, conversationId: string, accountId: string): { conversation: AiNeedV2Conversation | null } | null {
  if (raw === null) return { conversation: null };
  const data = exact(raw, ['conversation', 'messages', 'messageCount', 'review']);
  const c = exact(data?.conversation, ['id', 'account_id', 'purpose', 'status', 'fact_schema_version', 'bound_need_id']);
  const review = mapReview(data?.review, conversationId);
  if (!data || !c || !sameId(c.id, conversationId) || !sameId(c.account_id, accountId) || c.purpose !== 'NEED_INTAKE'
    || c.fact_schema_version !== NEED_FACT_SCHEMA_V2 || !review || c.status !== review.status || c.bound_need_id !== review.boundNeedId
    || !Array.isArray(data.messages) || data.messages.length > 1000 || data.messageCount !== data.messages.length) return null;
  const messages: AiNeedMessage[] = []; let previous = 0; let latest: AiNeedSafety = 'REVIEW';
  for (const row of data.messages) {
    const r = exact(row, ['id', 'account_id', 'conversation_id', 'role', 'body', 'safety', 'proposed_fact_ids', 'sequence_no']);
    if (!r || !uuid(r.id) || !sameId(r.account_id, accountId) || !sameId(r.conversation_id, conversationId)
      || !['USER', 'ASSISTANT'].some(role => role === r.role) || !boundedText(r.body, r.role === 'ASSISTANT' ? 1500 : 4000)
      || !(r.safety === null || safety(r.safety)) || !uuidList(r.proposed_fact_ids, MAX_AI_NEED_FACT_V2_PROPOSALS)
      || typeof r.sequence_no !== 'number' || !Number.isSafeInteger(r.sequence_no) || r.sequence_no <= previous) return null;
    previous = r.sequence_no;
    if (r.role === 'ASSISTANT' && safety(r.safety)) latest = r.safety;
    messages.push({ id: r.id, fromAi: r.role === 'ASSISTANT', body: r.body, safety: r.safety as AiNeedSafety | null, proposedFactIds: r.proposed_fact_ids });
  }
  if (new Set(messages.map(message => message.id.toLowerCase())).size !== messages.length || review.safety !== latest) return null;
  return { conversation: { conversationId: c.id, schemaVersion: NEED_FACT_SCHEMA_V2,
    status: c.status as 'OPEN' | 'COMPLETED' | 'ABANDONED', messages, facts: review.facts, review, safety: review.safety } };
}

export const aiNeedV2Production = {
  listOpenIntakes,
  async openConversation(clientRequestId: string): Promise<Ishod<AiNeedConversationOpened>> {
    if (!uuid(clientRequestId)) return fail('CLIENT_REQUEST_ID_INVALID', ERRORS.CLIENT_REQUEST_ID_INVALID);
    return readReceipt({ rpc: 'rpc_ai_open_need_conversation_owned_v2', args: { p_client_request_id: clientRequestId }, errors: ERRORS,
      write: true, fallback: 'AI_V2_OPEN_FAILED', invalid: 'AI_V2_OPEN_INVALID_RESPONSE', decode(raw) {
        const r = exact(raw, ['conversationId', 'clientRequestId', 'authoritative', 'idempotentReplay']);
        return r && uuid(r.conversationId) && sameId(r.clientRequestId, clientRequestId) && r.authoritative === true && typeof r.idempotentReplay === 'boolean'
          ? { conversationId: r.conversationId, clientRequestId: r.clientRequestId, authoritative: true, idempotentReplay: r.idempotentReplay } : null;
      } });
  },

  async loadConversation(conversationId: string): Promise<AiNeedV2Conversation | null> {
    if (!uuid(conversationId)) throw new Error('Razgovor nije ispravan. Ponovo otvori unos.');
    const account = scope(), deadline = Date.now() + REQUEST_TIMEOUT_MS;
    const result = await readOwnedResult({ account, errors: ERRORS, fallback: 'AI_V2_CONVERSATION_READ_FAILED', invalid: 'AI_V2_CONVERSATION_INVALID_RESPONSE',
      request: async () => {
        if (!account) return scopeChanged();
        const client = supabaseKlijent();
        const first = await client.from('ai_conversations').select('id,account_id,purpose,status,fact_schema_version,bound_need_id')
          .eq('id', conversationId).eq('account_id', account.accountId).eq('purpose', 'NEED_INTAKE').maybeSingle();
        if (first.error || first.data === null) return first;
        const header = exact(first.data, ['id', 'account_id', 'purpose', 'status', 'fact_schema_version', 'bound_need_id']);
        if (!header || !sameId(header.id, conversationId) || !sameId(header.account_id, account.accountId)
          || header.purpose !== 'NEED_INTAKE' || header.fact_schema_version !== NEED_FACT_SCHEMA_V2
          || !STATUS.some(status => status === header.status) || !(header.bound_need_id === null || uuid(header.bound_need_id))) return invalidResponse();
        if (!scopeCurrent(account)) return scopeChanged();
        if (Date.now() >= deadline) return invalidResponse();
        const [messages, review] = await Promise.all([
          client.from('ai_messages').select('id,account_id,conversation_id,role,body,safety,proposed_fact_ids,sequence_no', { count: 'exact' })
            .eq('conversation_id', conversationId).eq('account_id', account.accountId).order('sequence_no', { ascending: true }),
          client.rpc('rpc_ai_need_review_v2', { p_conversation_id: conversationId }),
        ]);
        if (messages.error) return messages;
        if (review.error) return review;
        return { data: { conversation: first.data, messages: messages.data, messageCount: messages.count, review: review.data }, error: null };
      }, decode: raw => account ? mapConversation(raw, conversationId, account.accountId) : null });
    if (!result.ok) throw new Error(result.poruka);
    return result.podatak.conversation;
  },

  async readTurn(conversationId: string, clientRequestId: string): Promise<Ishod<AiNeedTurnStatus>> {
    if (!uuid(conversationId) || !uuid(clientRequestId)) return fail('AI_TURN_IDENTITY_INVALID', 'Ponovo otvorite razgovor.');
    return readReceipt({ rpc: 'rpc_ai_read_need_turn_v2', args: { p_conversation_id: conversationId, p_client_request_id: clientRequestId },
      errors: ERRORS, fallback: 'AI_TURN_READ_FAILED', invalid: 'AI_TURN_INVALID_RESPONSE', decode: raw => turnStatus(raw, conversationId, clientRequestId) });
  },

  async recoverTurn(conversationId: string, clientRequestId: string): Promise<Ishod<AiNeedTurnRecovery>> {
    const account = scope();
    if (!account || !uuid(conversationId) || !uuid(clientRequestId)) return fail('AI_TURN_IDENTITY_INVALID', 'Ponovo otvorite razgovor.');
    return readReceipt({ rpc: 'rpc_ai_recover_need_turn_v2',
      args: { p_conversation_id: conversationId, p_client_request_id: clientRequestId },
      errors: ERRORS, fallback: 'AI_TURN_READ_FAILED', invalid: 'AI_TURN_INVALID_RESPONSE',
      decode: raw => turnRecovery(raw, account.accountId, conversationId, clientRequestId) });
  },

  async cancelTurn(conversationId: string, clientRequestId: string): Promise<Ishod<AiNeedTurnRecovery>> {
    const account = scope();
    if (!account || !uuid(conversationId) || !uuid(clientRequestId)) return fail('AI_TURN_IDENTITY_INVALID', 'Ponovo otvorite razgovor.');
    return readReceipt({ write: true, rpc: 'rpc_ai_cancel_need_turn_v2',
      args: { p_conversation_id: conversationId, p_client_request_id: clientRequestId },
      errors: ERRORS, fallback: 'AI_TURN_CANCEL_UNCONFIRMED', invalid: 'AI_TURN_INVALID_RESPONSE',
      decode: raw => turnRecovery(raw, account.accountId, conversationId, clientRequestId) });
  },

  async sendMessage(conversationId: string, body: string, clientRequestId: string, stream?: AiTurnStreamOptions, image?: { base64: string; mimeType: string }): Promise<Ishod<AiNeedTurnStatus>> {
    if (!uuid(conversationId) || !uuid(clientRequestId)) return fail('AI_TURN_IDENTITY_INVALID', 'Ponovo otvorite razgovor.');
    const text = typeof body === 'string' ? body.trim() : '';
    if (!text && !image) return fail('MESSAGE_REQUIRED', 'Unesite poruku ili priložite fotografiju.');
    if (text && !boundedText(text, 4000)) return fail('MESSAGE_TOO_LONG', 'Poruka može imati najviše 4000 znakova i ispravan tekst.');
    const account = scope(), deadline = Date.now() + 55_000;
    const hint: { value: AiConversationIntent | null } = { value: null };
    const completed = await readOwnedResult({ account, write: true, timeoutMs: 55_000, errors: ERRORS, fallback: 'AI_TURN_SEND_UNCONFIRMED', invalid: 'AI_TURN_INVALID_RESPONSE',
      request: async () => {
        if (!account) return scopeChanged();
        if (stream) {
          const session = sesijaSada().session;
          const config = readPublicSupabaseConfig();
          const url = config?.url, anonKey = config?.anonKey;
          if (!session?.access_token || !url || !anonKey) return scopeChanged();
          const response = await requestAiTurnStream({ ...stream, url, anonKey, accessToken: session.access_token,
            conversationId, clientRequestId, text, deadline, current: () => scopeCurrent(account),
            imageBase64: image?.base64, imageMime: image?.mimeType });
          hint.value = response.conversationIntent ?? null;
          return response;
        }
        const response = await supabaseKlijent().functions.invoke('uskoci-ai-interview', {
          body: {
            conversationId,
            text,
            clientRequestId,
            ...(image ? { imageBase64: image.base64, imageMime: image.mimeType } : {}),
          },
          headers: { [AI_DIAGNOSTICS_HEADER]: AI_DIAGNOSTICS_VERSION, [NEED_FACT_TURN_CAPABILITY_HEADER]: NEED_FACT_TURN_CAPABILITY_VERSION },
        });
        if (!scopeCurrent(account)) return scopeChanged();
        if (Date.now() >= deadline) return invalidResponse();
        if (response.error) {
          const envelope = await failedTurnEnvelope(response.error, conversationId, clientRequestId, deadline, account);
          if (envelope) return { data: envelope, error: null };
          const name = aiAvailabilityFromSdkError(response.error) ?? transportErrorName(response.error);
          return name ? { data: null, error: { message: name } } : response;
        }
        const envelope = turnStatus(response.data, conversationId, clientRequestId);
        return envelope && (envelope.state === 'SUCCEEDED' || envelope.state === 'PROCESSING') ? { data: envelope, error: null } : invalidResponse();
      }, decode: raw => turnStatus(raw, conversationId, clientRequestId) });
    if (completed.ok && completed.podatak.state === 'SUCCEEDED' && account && scopeCurrent(account)
      && !stream?.signal?.aborted && hint.value) {
      try { stream?.onConversationIntent?.(hint.value); } catch { /* A UI suggestion cannot invalidate a confirmed turn. */ }
    }
    return completed;
  },

  async abandonConversation(conversationId: string): Promise<Ishod<AiNeedConversationAbandoned>> {
    if (!uuid(conversationId)) return fail('CONVERSATION_REQUIRED', 'Ponovo otvorite razgovor.');
    return readReceipt({ rpc: 'rpc_ai_abandon_need_conversation_v2', args: { p_conversation_id: conversationId }, errors: ERRORS,
      write: true, fallback: 'AI_CONVERSATION_ABANDON_UNCONFIRMED', invalid: 'AI_CONVERSATION_ABANDON_INVALID_RESPONSE', decode(raw) {
        const r = exact(raw, ['conversationId', 'status', 'authoritative', 'idempotentReplay']);
        return r && sameId(r.conversationId, conversationId) && r.status === 'ABANDONED' && r.authoritative === true && typeof r.idempotentReplay === 'boolean'
          ? { conversationId: r.conversationId, status: 'ABANDONED', authoritative: true, idempotentReplay: r.idempotentReplay } : null;
      } });
  },

  async confirmFact(factId: string): Promise<Ishod<null>> {
    if (!uuid(factId)) return fail('FACT_REQUIRED', 'Osveži pregled podataka.');
    const result = await readReceipt({ rpc: 'rpc_ai_confirm_fact', args: { p_fact_id: factId }, errors: ERRORS, write: true,
      fallback: 'AI_FACT_CONFIRM_FAILED', invalid: 'AI_FACT_CONFIRM_INVALID_RESPONSE', decode: raw => sameId(raw, factId) ? { factId: raw } : null });
    return result.ok ? { ok: true, podatak: null } : result;
  },

  async correctFact(factId: string, value: unknown, displayValue: string): Promise<Ishod<{ newFactId: string }>> {
    if (!uuid(factId)) return fail('FACT_REQUIRED', 'Osveži pregled podataka.');
    const display = typeof displayValue === 'string' ? displayValue.trim() : '';
    if (!boundedText(display, 1000) || value === null || !safeJson(value) || !locationPayloadFits(value)) return fail('FACT_VALUE_INVALID', 'Unesi ispravnu vrednost.');
    return readReceipt({ rpc: 'rpc_ai_correct_fact_v2', args: { p_fact_id: factId, p_value: value, p_display_value: display }, errors: ERRORS, write: true,
      fallback: 'AI_V2_FACT_CORRECTION_FAILED', invalid: 'AI_V2_FACT_CORRECTION_INVALID_RESPONSE', decode: raw => uuid(raw) && !sameId(raw, factId) ? { newFactId: raw } : null });
  },

  async saveDraft(conversationId: string, clientRequestId: string): Promise<Ishod<AiNeedDraftSaved>> {
    if (!uuid(conversationId) || !commandKey(clientRequestId)) return fail('DRAFT_IDENTITY_REQUIRED', 'Ponovo otvori pregled nacrta.');
    const account = scope(), deadline = Date.now() + REQUEST_TIMEOUT_MS;
    return readOwnedResult({ account, errors: ERRORS, write: true, fallback: 'NEED_V2_DRAFT_SAVE_FAILED', invalid: 'NEED_V2_DRAFT_INVALID_RESPONSE',
      request: async () => {
        if (!account) return scopeChanged();
        const client = supabaseKlijent();
        const response = await client.from('app_profiles').select('id').eq('account_id', account.accountId).eq('kind', 'REQUESTER').eq('profile_status', 'ACTIVE').maybeSingle();
        if (response.error) return response;
        const profile = exact(response.data, ['id']);
        if (!profile || !uuid(profile.id)) return { data: null, error: { message: 'REQUESTER_PROFILE_NOT_READY' } };
        if (!scopeCurrent(account)) return scopeChanged();
        if (Date.now() >= deadline) return invalidResponse();
        return client.rpc('rpc_save_need_draft_from_review', { p_conversation_id: conversationId, p_requester_profile_id: profile.id, p_client_request_id: clientRequestId });
      }, decode(raw) {
        const r = exact(raw, ['needId', 'status', 'revision', 'conversationId', 'authoritative']);
        return r && uuid(r.needId) && r.status === 'DRAFT' && r.revision === 1 && sameId(r.conversationId, conversationId) && r.authoritative === true
          ? { needId: r.needId, status: 'DRAFT', revision: 1, conversationId: r.conversationId, authoritative: true } : null;
      } });
  },

  async openEditConversation(needId: string): Promise<Ishod<AiNeedEditOpened>> {
    if (!uuid(needId)) return fail('NEED_REQUIRED', 'Učitajte zadatak pre izmene.');
    return readOwnedResult({ errors: ERRORS, request: async () => {
      const result = await supabaseKlijent().rpc('rpc_ai_open_need_edit_conversation_v2', { p_need_id: needId });
      // This opener uses NOWAIT on the existing conversation. A returned
      // PostgreSQL lock refusal is different from a lost response; translate
      // only that closed SQLSTATE, never arbitrary database text or a timeout.
      // The editor still requires a read before a new attempt; no auto replay.
      return result.data === null && result.error?.code === '55P03'
        ? { data: null, error: { message: 'NEED_EDIT_BUSY' } } : result;
    },
      write: true, fallback: 'NEED_EDIT_OPEN_FAILED', invalid: 'NEED_EDIT_INVALID_RESPONSE', decode(raw) {
        const r = exact(raw, ['conversationId', 'needId', 'revision', 'status', 'authoritative']);
        return r && uuid(r.conversationId) && sameId(r.needId, needId) && positiveInteger(r.revision)
          && ['DRAFT', 'PUBLISHED', 'SELECTION'].some(status => status === r.status) && r.authoritative === true
          ? { conversationId: r.conversationId, needId: r.needId, revision: r.revision, needStatus: r.status as AiNeedEditOpened['needStatus'], authoritative: true } : null;
      } });
  },

  async confirmEdit(needId: string, expectedRevision: number, conversationId: string, clientRequestId: string): Promise<Ishod<AiNeedEditConfirmed>> {
    if (!uuid(needId) || !uuid(conversationId) || !positiveInteger(expectedRevision) || expectedRevision === 2_147_483_647 || !commandKey(clientRequestId))
      return fail('NEED_EDIT_IDENTITY_INVALID', 'Ponovo otvorite pregled izmene.');
    return readReceipt({ rpc: 'rpc_confirm_need_edit_from_review_v2', args: { p_need_id: needId, p_expected_revision: expectedRevision,
      p_conversation_id: conversationId, p_client_request_id: clientRequestId }, errors: ERRORS, write: true, fallback: 'NEED_EDIT_CONFIRM_FAILED', invalid: 'NEED_EDIT_INVALID_RESPONSE', decode(raw) {
        const r = exact(raw, ['needId', 'fromRevision', 'revision', 'status', 'revisionEventId', 'conversationId', 'requiresReadmission', 'idempotentReplay', 'authoritative']);
        return r && sameId(r.needId, needId) && r.fromRevision === expectedRevision && r.revision === expectedRevision + 1 && r.status === 'DRAFT'
          && uuid(r.revisionEventId) && sameId(r.conversationId, conversationId) && r.requiresReadmission === true && typeof r.idempotentReplay === 'boolean' && r.authoritative === true
          ? { needId: r.needId, fromRevision: expectedRevision, revision: r.revision, status: 'DRAFT', revisionEventId: r.revisionEventId,
            conversationId: r.conversationId, requiresReadmission: r.requiresReadmission, idempotentReplay: r.idempotentReplay, authoritative: true } : null;
      } });
  },
};
