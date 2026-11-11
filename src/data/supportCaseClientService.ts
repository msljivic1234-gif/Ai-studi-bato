import { noviUuidZahtevId } from '../lib/idempotencija';
import { sesijaSada } from '../store/sesija';
import { agreementPayloadHash } from '../ui/agreements/agreementActionsModel';
import type { Ishod } from './ports';
import { failure, positiveInteger, readReceipt, record, sameId, timestamp } from './serverReceipt';
import { parseSupportIntent, supportCaseJournal } from './supportCaseJournal';
import { type PreparedSupportCommand, type SupportCapabilities, type SupportCommand, type SupportDetail,
  type SupportInbox, type SupportIntent, type SupportKind, type SupportMode, type SupportPayloads,
  type SupportReference, type SupportScope } from './supportCaseTypes';
import { decodeSupportDetail, decodeSupportInbox } from './supportCaseReadDecoders';
import { decodeSupportReference, supportEnvelope, supportKeys, supportSequence, supportUuid as lowerUuid } from './supportCaseWire';
export type * from './supportCaseTypes';
export { decodeSupportReference, supportSequence } from './supportCaseWire';
const nullableUuid = (v: unknown) => v === null || lowerUuid(v);
function current(scope: SupportScope) {
  const s = sesijaSada();
  return s.user?.id === scope.accountId && s.accountRevision === scope.accountRevision && (scope.isCurrent?.() ?? true);
}
const changed = () => failure('SUPPORT_SCOPE_CHANGED', 'Ponovo otvori podršku da nastaviš.');
const invalid = () => failure('SUPPORT_INPUT_INVALID', 'Proveri podatke zahteva.');
const options = { fallback: 'SUPPORT_UNCONFIRMED', invalid: 'SUPPORT_RECEIPT_INVALID', errors: {
  AUTH_REQUIRED: 'Prijavi se ponovo da otvoriš podršku.', AUTH_CONTEXT_CHANGED: 'Nalog je promenjen. Ponovo otvori podršku.',
  SUPPORT_CASE_NOT_AVAILABLE: 'Zahtev nije dostupan ovom nalogu.', SUPPORT_OPERATOR_REQUIRED: 'Operaterski pristup više nije dostupan.',
  SUPPORT_REVISION_STALE: 'Zahtev je promenjen. Osveži ga pre sledeće radnje.',
  SUPPORT_KEY_REUSED: 'Ovaj zahtev za slanje pripada prvobitnom sadržaju.', SUPPORT_INPUT_INVALID: 'Proveri podatke zahteva.',
  SUPPORT_CASE_DAILY_LIMIT: 'Dostignut je limit od 5 novih običnih zahteva za 24 sata.',
  SUPPORT_CREATE_COOLDOWN: 'Sačekaj najmanje 60 sekundi između novih običnih zahteva.',
  SUPPORT_REPLY_DAILY_LIMIT: 'Dostignut je limit od 50 dopuna običnih zahteva za 24 sata.',
  SUPPORT_REFERENCE_NOT_AVAILABLE: 'Odabrani kontekst više nije dostupan.', SUPPORT_REFERENCE_INVALID: 'Proveri odabrani kontekst.',
  SUPPORT_REFERENCE_STALE: 'Odabrani kontekst je promenjen. Učitaj njegovu trenutnu verziju.',
  SUPPORT_MEDIA_REFERENCE_NOT_AVAILABLE: 'Izabrane fotografije još nisu dostupne za ovaj zahtev.',
  SUPPORT_CONTEXT_REQUIRED: 'Odaberi saradnju ili pregled na koji se zahtev odnosi.',
  SUPPORT_ACTION_NOT_AVAILABLE: 'Radnja trenutno nije dostupna.', SUPPORT_CURSOR_INVALID: 'Ponovo osveži prikaz podrške.',
  SUPPORT_APPEAL_ALREADY_OPEN: 'Za ovu odluku već postoji otvorena žalba.', SUPPORT_APPEAL_NOT_AVAILABLE: 'Žalba trenutno nije dostupna.',
  SUPPORT_DECISION_NOT_AVAILABLE: 'Odabrana odluka nije dostupna.', ACCOUNT_CLOSING: 'Nalog je u postupku zatvaranja.',
} };
async function request<T>(rpc: string, args: Record<string, unknown>, scope: SupportScope,
  decode: (raw: unknown) => T | null, write = false): Promise<Ishod<T>> {
  scope = { ...scope };
  if (!lowerUuid(scope.accountId) || !current(scope)) return changed();
  const result = await readReceipt({ ...options, rpc, args: { p_expected_user_id: scope.accountId, ...args },
    account: scope, decode, write });
  return current(scope) ? result : changed();
}
const text = (value: unknown, max: number, empty = false): value is string => typeof value === 'string'
  && value === value.trim() && Array.from(value).length >= (empty ? 0 : 1) && Array.from(value).length <= max
  && !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value)
  && !Array.from(value).some(c => c.length === 1 && c.charCodeAt(0) >= 0xd800 && c.charCodeAt(0) <= 0xdfff);
function reference(value: unknown) {
  const v = decodeSupportReference(value);
  if (!v) throw new Error('SUPPORT_INPUT_INVALID');
  return { kind: v.kind, id: v.id, revision: v.revision };
}
function refs(value: unknown) {
  if (!Array.isArray(value) || value.length > 50) throw new Error('SUPPORT_INPUT_INVALID');
  const parsed = value.map(reference);
  if (new Set(parsed.map(v => `${v.kind}:${v.id}:${v.revision}`)).size !== parsed.length) throw new Error('SUPPORT_INPUT_INVALID');
  return parsed;
}
function cleaned(v: unknown, limit: number) {
  if (typeof v !== 'string') throw new Error('SUPPORT_INPUT_INVALID');
  const result = v.trim().normalize('NFC');
  if (!text(result, limit)) throw new Error('SUPPORT_INPUT_INVALID');
  return result;
}
/** Fixed-key serialization binds exactly the UTF-8 text SQL receives. */
export function serializeSupportPayload<K extends SupportKind>(kind: K, raw: SupportPayloads[K]): string {
  const p = record(raw); if (!p) throw new Error('SUPPORT_INPUT_INVALID');
  const shape = (names: string[]) => { if (!supportKeys(p, names)) throw new Error('SUPPORT_INPUT_INVALID'); };
  let ordered: unknown;
  if (kind === 'CREATE') {
    shape(['channel', 'topic', 'title', 'body', 'desiredOutcome', 'context', 'evidence']);
    const topics: Record<string, string[]> = { SERVICE: ['TECHNICAL', 'SERVICE_COMPLAINT', 'OTHER'],
      TASK: ['COLLABORATION', 'NO_SHOW', 'PUBLICATION_REVIEW'], LEGAL_PRIVACY: ['CONTENT_NOTICE', 'PRIVACY_RIGHTS'] };
    if (!Object.hasOwn(topics, p.channel as string) || !topics[p.channel as string].includes(p.topic as string)) throw new Error('SUPPORT_INPUT_INVALID');
    const context = p.context === null ? null : reference(p.context);
    if (['COLLABORATION', 'NO_SHOW'].includes(p.topic as string) && context?.kind !== 'AGREEMENT'
      || p.topic === 'PUBLICATION_REVIEW' && context?.kind !== 'TASK_REVIEW') throw new Error('SUPPORT_INPUT_INVALID');
    ordered = { channel: p.channel, topic: p.topic, title: cleaned(p.title, 200), body: cleaned(p.body, 4000),
      desiredOutcome: p.desiredOutcome === null ? null : cleaned(p.desiredOutcome, 1000), context, evidence: refs(p.evidence) };
  } else if (kind === 'AUTHOR_REPLY') {
    shape(['body', 'evidence']); ordered = { body: cleaned(p.body, 4000), evidence: refs(p.evidence) };
  } else if (kind === 'CLAIM' || kind === 'CLOSE') { shape([]); ordered = {}; }
  else if (kind === 'OPERATOR_REPLY' || kind === 'REQUEST_INFO') { shape(['body']); ordered = { body: cleaned(p.body, 4000) }; }
  else if (kind === 'APPEAL') {
    shape(['decisionId', 'body']); if (!lowerUuid(p.decisionId)) throw new Error('SUPPORT_INPUT_INVALID');
    ordered = { decisionId: p.decisionId, body: cleaned(p.body, 4000) };
  } else if (kind === 'CLAIM_APPEAL') {
    shape(['appealId']); if (!lowerUuid(p.appealId)) throw new Error('SUPPORT_INPUT_INVALID'); ordered = { appealId: p.appealId };
  } else if (kind === 'DECIDE' || kind === 'DECIDE_APPEAL') {
    shape(['outcome', 'reasonCode', 'body', 'evidenceIds', 'appealId']);
    if (!['ACCEPTED', 'REJECTED'].includes(p.outcome as string) || typeof p.reasonCode !== 'string'
      || !/^[A-Z][A-Z0-9_]{0,63}$/.test(p.reasonCode) || !Array.isArray(p.evidenceIds) || p.evidenceIds.length > 50
      || !p.evidenceIds.every(lowerUuid) || new Set(p.evidenceIds).size !== p.evidenceIds.length
      || (kind === 'DECIDE' ? p.appealId !== null : !lowerUuid(p.appealId))) throw new Error('SUPPORT_INPUT_INVALID');
    ordered = { outcome: p.outcome, reasonCode: p.reasonCode, body: cleaned(p.body, 4000), evidenceIds: [...p.evidenceIds], appealId: p.appealId };
  } else throw new Error('SUPPORT_INPUT_INVALID');
  return JSON.stringify(ordered);
}
export const supportInputHash = (kind: SupportKind, caseId: string | null, revision: number | null, payloadText: string) =>
  agreementPayloadHash(`${kind}\n${caseId ?? ''}\n${revision?.toString() ?? ''}\n${payloadText}`);
export function decodeSupportCommand(raw: unknown, j: SupportIntent): SupportCommand | null {
  const r = record(raw);
  if (!supportEnvelope(r, j.accountId) || !supportKeys(r, ['accountId', 'clientRequestId', 'kind', 'state', 'caseId',
    'expectedRevision', 'inputSha256', 'receipt', 'authoritative']) || !sameId(r.clientRequestId, j.clientRequestId)) return null;
  if (r.state === 'ABSENT' || r.state === 'CANCELLED') return ['kind', 'caseId', 'expectedRevision', 'inputSha256', 'receipt']
    .every(k => r[k] === null) ? r as SupportCommand : null;
  if (r.state !== 'COMMITTED' || r.kind !== j.kind || !lowerUuid(r.caseId) || j.caseId !== null && r.caseId !== j.caseId
    || r.expectedRevision !== j.expectedRevision || r.inputSha256 !== j.inputSha256) return null;
  const x = record(r.receipt);
  if (!supportEnvelope(x, j.accountId) || !supportKeys(x, ['accountId', 'clientRequestId', 'kind', 'caseId', 'caseNumber',
    'expectedRevision', 'inputSha256', 'eventId', 'sequence', 'caseRevision', 'createdAt', 'authoritative'])
    || !sameId(x.clientRequestId, j.clientRequestId) || x.kind !== j.kind || x.caseId !== r.caseId
    || x.expectedRevision !== j.expectedRevision || x.inputSha256 !== j.inputSha256 || !lowerUuid(x.eventId)
    || !supportSequence(x.caseNumber) || !supportSequence(x.sequence) || !positiveInteger(x.caseRevision)
    || (j.kind === 'CREATE' ? x.caseRevision !== 1 || x.sequence !== '1' : x.caseRevision !== j.expectedRevision! + 1)
    || !timestamp(x.createdAt)) return null;
  return r as SupportCommand;
}
function freezeIntent(value: SupportIntent, scope: SupportScope) {
  return parseSupportIntent(JSON.stringify(value), scope.accountId);
}
async function recover(value: SupportIntent, scope: SupportScope): Promise<Ishod<SupportCommand>> {
  scope = { ...scope }; let intent: SupportIntent;
  try { intent = freezeIntent(value, scope); } catch { return invalid(); }
  const result = await request('rpc_support_read_command_v5', { p_client_request_id: intent.clientRequestId }, scope,
    raw => decodeSupportCommand(raw, intent));
  if (result.ok && result.podatak.state !== 'ABSENT' && current(scope)) {
    try { await supportCaseJournal.clear(intent, () => current(scope)); }
    catch { return failure('SUPPORT_LOCAL_RECOVERY_FAILED', 'Potvrda postoji, ali oporavak na uređaju nije dovršen. Proveri ponovo.'); }
  }
  return current(scope) ? result : changed();
}
const inFlight = new Set<string>();
export const supportCaseClientService = {
  capabilities(scope: SupportScope) {
    scope = { ...scope };
    return request<SupportCapabilities>('rpc_support_capabilities_v5', {}, scope, raw => {
      const r = record(raw); return supportEnvelope(r, scope.accountId) && supportKeys(r, ['accountId', 'operatorAvailable', 'canCreate', 'authoritative'])
        && typeof r.operatorAvailable === 'boolean' && typeof r.canCreate === 'boolean' ? r as SupportCapabilities : null;
    });
  },
  inbox(mode: SupportMode, before: string | null, scope: SupportScope) {
    scope = { ...scope };
    if (!['OWN', 'OPERATOR', 'SAFETY'].includes(mode) || before !== null && !supportSequence(before)) return Promise.resolve(invalid());
    return request<SupportInbox>('rpc_support_inbox_v5', { p_mode: mode, p_before_case_number: before }, scope,
      raw => decodeSupportInbox(raw, scope.accountId, mode, before));
  },
  detail(caseId: string, afterSequence: string, scope: SupportScope) {
    scope = { ...scope };
    if (!lowerUuid(caseId) || !supportSequence(afterSequence, true)) return Promise.resolve(invalid());
    return request<SupportDetail>('rpc_support_detail_v5', { p_case_id: caseId, p_after_sequence: afterSequence }, scope,
      raw => decodeSupportDetail(raw, scope.accountId, caseId, afterSequence));
  },
  prepare<K extends SupportKind>(kind: K, caseId: string | null, revision: number | null, payload: SupportPayloads[K], scope: SupportScope): PreparedSupportCommand {
    if (!current(scope)) throw new Error('SUPPORT_SCOPE_CHANGED');
    const payloadText = serializeSupportPayload(kind, payload);
    const intent = parseSupportIntent(JSON.stringify({ version: 1, accountId: scope.accountId,
      clientRequestId: noviUuidZahtevId().toLowerCase(), kind, caseId, expectedRevision: revision,
      inputSha256: supportInputHash(kind, caseId, revision, payloadText) }), scope.accountId);
    return { intent, payloadText };
  },
  async loadPending(scope: SupportScope) {
    scope = { ...scope }; if (!current(scope)) throw new Error('SUPPORT_SCOPE_CHANGED');
    const intent = await supportCaseJournal.load(scope.accountId);
    if (!current(scope)) throw new Error('SUPPORT_SCOPE_CHANGED'); return intent;
  },
  async submit(value: PreparedSupportCommand, scope: SupportScope): Promise<Ishod<SupportCommand>> {
    scope = { ...scope }; let intent: SupportIntent; let payloadText: string;
    try {
      intent = freezeIntent(value.intent, scope); payloadText = value.payloadText;
      if (serializeSupportPayload(intent.kind, JSON.parse(payloadText)) !== payloadText
        || supportInputHash(intent.kind, intent.caseId, intent.expectedRevision, payloadText) !== intent.inputSha256) return invalid();
    } catch { return invalid(); }
    if (!current(scope)) return changed();
    const lock = `${intent.accountId}:${intent.clientRequestId}`;
    if (inFlight.has(lock)) return failure('SUPPORT_BUSY', 'Slanje već traje.');
    inFlight.add(lock);
    try {
      try { await supportCaseJournal.save(intent, () => current(scope)); }
      catch { return failure('SUPPORT_UNRESOLVED_INTENT', 'Najpre proveri ili otkaži prethodno slanje.'); }
      if (!current(scope)) return changed();
      const acknowledgement = await request('rpc_support_submit_v5', { p_client_request_id: intent.clientRequestId, p_kind: intent.kind,
        p_case_id: intent.caseId, p_expected_revision: intent.expectedRevision, p_payload_text: payloadText }, scope,
      raw => decodeSupportCommand(raw, intent), true);
      // A transport ACK never clears the intent. A single canonical read does
      // not replay the submission, including after an unknown HTTP outcome.
      if (!current(scope)) return changed();
      const recovered = await recover(intent, scope);
      // A known validation/quota error remains useful copy, but ABSENT still
      // cannot retire a possibly delayed request. Its journal stays unresolved.
      return recovered.ok && recovered.podatak.state === 'ABSENT' && !acknowledgement.ok ? acknowledgement : recovered;
    } finally { inFlight.delete(lock); }
  },
  recover,
  async cancel(value: SupportIntent, scope: SupportScope): Promise<Ishod<SupportCommand>> {
    scope = { ...scope }; let intent: SupportIntent;
    try { intent = freezeIntent(value, scope); } catch { return invalid(); }
    if (!current(scope)) return changed();
    await request('rpc_support_cancel_command_v5', { p_client_request_id: intent.clientRequestId }, scope,
      raw => decodeSupportCommand(raw, intent), true);
    return current(scope) ? recover(intent, scope) : changed();
  },
  markRead(caseId: string, sequence: string, scope: SupportScope) {
    scope = { ...scope };
    if (!lowerUuid(caseId) || !supportSequence(sequence)) return Promise.resolve(invalid());
    return request('rpc_support_mark_read_v5', { p_case_id: caseId, p_sequence: sequence }, scope, raw => {
      const r = record(raw); return supportEnvelope(r, scope.accountId) && supportKeys(r, ['accountId', 'caseId', 'sequence', 'authoritative'])
        && r.caseId === caseId && supportSequence(r.sequence) && Number(r.sequence) >= Number(sequence)
        ? r as { accountId: string; caseId: string; sequence: string; authoritative: true } : null;
    }, true);
  },
  findContext(kind: SupportReference['kind'], id: string, scope: SupportScope) {
    scope = { ...scope };
    if (!['TASK', 'AGREEMENT', 'AGREEMENT_MESSAGE', 'GROUP_MESSAGE', 'TASK_REVIEW', 'SAFETY_REPORT'].includes(kind) || !lowerUuid(id)) return Promise.resolve(invalid());
    return request('rpc_support_find_context_v5', { p_kind: kind, p_id: id }, scope, raw => {
      const r = record(raw); return supportEnvelope(r, scope.accountId) && supportKeys(r, ['accountId', 'caseId', 'authoritative'])
        && nullableUuid(r.caseId) ? r as { accountId: string; caseId: string | null; authoritative: true } : null;
    });
  },
};
