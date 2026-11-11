import type { PublicationDecision, PublicationEvaluation, PublicationNotReadyCode, PublicationRequest, PublishNeedCommand, PublishNeedReceipt } from '../contracts/publication';
import type { LocationSlot } from '../contracts/location';
import { calendarInstant } from '../lib/calendarTime';
import { sesijaSada } from '../store/sesija';
import type { Ishod } from './ports';
import { failure, positiveInteger, readOwnedResult, readReceipt, record, sameId, timestamp, uuid } from './serverReceipt';
import { supabaseKlijent } from './supabaseClient';

const COPY: Readonly<Record<string, string>> = {
  AUTH_REQUIRED: 'Prijavi se da objaviš zadatak.',
  NEED_NOT_OWNED: 'Ovaj zadatak ne možeš da objaviš.',
  NEED_NOT_FOUND: 'Ovaj zadatak više ne postoji. Vrati se na zadatke.',
  NEED_NOT_DRAFT: 'Zadatak više nije nacrt.',
  NEED_REVISION_STALE: 'Zadatak je izmenjen. Učitaj novu verziju i ponovi proveru.',
  PUBLICATION_CONTEXT_STALE: 'Zadatak ili pravila su promenjeni. Ponovi proveru pre objave.',
  PUBLICATION_CONTEXT_NOT_READY: 'Uslovi za objavu su se promenili. Otvori zadatak i ponovi proveru.',
  PUBLICATION_DECISION_STALE: 'Pre objave je potrebna nova provera. Otvori pregled.',
  PUBLICATION_DECISION_CONTEXT_STALE: 'Zadatak ili pravila su promenjeni. Ponovi proveru pre objave.',
  PUBLICATION_DECISION_FINGERPRINT_STALE: 'Zadatak je promenjen. Ponovi proveru pre objave.',
  PUBLICATION_DECISION_NOT_ALLOW: 'Ovaj zadatak još nije odobren za objavu.',
  PUBLICATION_POLICY_STALE: 'Pravila su promenjena. Ponovi proveru pre objave.',
  POLICY_BUNDLE_NOT_READY: 'Provera pravila trenutno nije dostupna. Nacrt je sačuvan.',
  POLICY_CONTENT_NOT_READY: 'Provera pravila trenutno nije dostupna. Nacrt je sačuvan.',
  PUBLICATION_LOCATION_INCOMPLETE: 'Potvrdi sve potrebne tačke lokacije pre objave.',
  RESPONSE_DEADLINE_INVALID: 'Rok za prijave mora biti u budućnosti.',
  FIXED_WINDOW_START_PASSED: 'Početak termina je već prošao. Izmeni termin, pa objavi zadatak.',
  IDEMPOTENCY_KEY_REUSED: 'Zadatak se promenio od prethodnog pokušaja.',
};
const NOT_READY = new Set<PublicationNotReadyCode>(['POLICY_NOT_READY', 'POLICY_CONTENT_NOT_READY', 'LOCATION_INCOMPLETE', 'COUNTRY_NOT_READY', 'PUBLIC_MEDIA_NOT_READY', 'EVALUATOR_UNAVAILABLE', 'EVALUATOR_INVALID_RESPONSE', 'RATE_LIMITED', 'NEED_CHANGED']);
const outcomes = ['ALLOW', 'CLARIFY', 'REVIEW', 'BLOCK'] as const;
const only = (value: Record<string, unknown>, keys: readonly string[]) => Object.keys(value).every(key => keys.includes(key));
const sequence = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
const hash = (value: unknown): value is string => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const slot = (value: unknown): value is LocationSlot => typeof value === 'string' && /^(?:start|end|serviceArea|waypoints\/(?:[0-9]|1[0-9]))$/.test(value);
function codes(value: unknown, min: number): value is string[] {
  return Array.isArray(value) && value.length >= min && value.length <= 64 && new Set(value).size === value.length
    && value.every(code => typeof code === 'string' && /^[A-Z][A-Z0-9_-]{0,63}$/.test(code));
}
function decodePublicationDecision(raw: unknown, request: PublicationRequest): PublicationDecision | null {
  const value = record(raw);
  if (!value || !only(value, ['decisionId', 'decisionSequence', 'needId', 'needRevision', 'canonicalFingerprint', 'policyBundleId', 'policyVersion', 'jurisdiction', 'outcome', 'decisionAt', 'ruleIds', 'safeReasonCodes', 'publishable', 'authoritative'])
    || !uuid(value.decisionId) || !sequence(value.decisionSequence) || !sameId(value.needId, request.needId)
    || value.needRevision !== request.expectedRevision || !hash(value.canonicalFingerprint) || !uuid(value.policyBundleId)
    || !positiveInteger(value.policyVersion) || typeof value.jurisdiction !== 'string' || !/^[A-Z]{2}$/.test(value.jurisdiction)
    || !outcomes.includes(value.outcome as typeof outcomes[number]) || !timestamp(value.decisionAt)
    || !codes(value.ruleIds, 1) || !codes(value.safeReasonCodes, 0)
    || value.authoritative !== true || value.publishable !== (value.outcome === 'ALLOW')) return null;
  return value as unknown as PublicationDecision;
}
export function decodePublicationEvaluation(raw: unknown, request: PublicationRequest): PublicationEvaluation | null {
  const value = record(raw);
  if (!value) return null;
  if (value.kind === 'DECISION' && only(value, ['kind', 'decision'])) {
    const decision = decodePublicationDecision(value.decision, request);
    return decision ? { kind: 'DECISION', decision } : null;
  }
  if (value.kind !== 'NOT_READY' || !only(value, ['kind', 'needId', 'needRevision', 'authoritativeDecision', 'code', 'missingSlots'])
    || !sameId(value.needId, request.needId) || value.needRevision !== request.expectedRevision
    || value.authoritativeDecision !== false || !NOT_READY.has(value.code as PublicationNotReadyCode)) return null;
  if (value.missingSlots !== undefined && (!Array.isArray(value.missingSlots) || value.missingSlots.length > 22
    || new Set(value.missingSlots).size !== value.missingSlots.length || !value.missingSlots.every(slot))) return null;
  return { kind: 'NOT_READY', needId: value.needId, needRevision: request.expectedRevision,
    authoritativeDecision: false, code: value.code as PublicationNotReadyCode,
    ...(value.missingSlots === undefined ? {} : { missingSlots: value.missingSlots as LocationSlot[] }) };
}
function validRequest(request: PublicationRequest): boolean { return uuid(request?.needId) && positiveInteger(request?.expectedRevision); }
const invalid = () => Promise.resolve(failure('PUBLICATION_INPUT_INVALID', 'Otvori zadatak i proveri podatke pre objave.'));

export const publicationClientService = {
  evaluate(request: PublicationRequest): Promise<Ishod<PublicationEvaluation>> {
    if (!validRequest(request)) return invalid();
    request = { ...request };
    const owner = sesijaSada(), accountId = owner.user?.id, accountRevision = owner.accountRevision;
    if (!accountId) return Promise.resolve(failure('AUTH_REQUIRED', COPY.AUTH_REQUIRED));
    const current = () => sesijaSada().user?.id === accountId && sesijaSada().accountRevision === accountRevision;
    return readOwnedResult({ account: { accountId, accountRevision }, errors: COPY, write: true,
      fallback: 'PUBLICATION_EVALUATION_UNCONFIRMED', invalid: 'PUBLICATION_INVALID_RESPONSE',
      decode: raw => decodePublicationEvaluation(raw, request),
      request: async () => {
        const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 14_000);
        try {
          const client = supabaseKlijent(), { data, error } = await client.auth.getSession();
          if (!current() || controller.signal.aborted) throw new Error('PUBLICATION_SCOPE_CHANGED');
          if (error || !data.session || data.session.user.id !== accountId) return { error: { message: 'AUTH_REQUIRED' }, data: null };
          const result = await client.functions.invoke('uskoci-publication-evaluate', {
            body: { needId: request.needId, expectedRevision: request.expectedRevision },
            headers: { Authorization: `Bearer ${data.session.access_token}` }, signal: controller.signal,
          });
          if (!current() || controller.signal.aborted) throw new Error('PUBLICATION_SCOPE_CHANGED');
          if (result.error && 'context' in result.error && result.error.context instanceof Response) {
            const status = result.error.context.status;
            const message = status === 401 ? 'AUTH_REQUIRED' : status === 403 ? 'NEED_NOT_OWNED' : status === 409 ? 'NEED_REVISION_STALE' : null;
            if (message) return { data: null, error: { message } };
          }
          return result;
        } finally { clearTimeout(timer); }
      },
    });
  },
  publish(command: PublishNeedCommand): Promise<Ishod<PublishNeedReceipt>> {
    if (!validRequest(command) || !sequence(command?.decisionSequence) || command.confirmed !== true
      || typeof command.clientRequestId !== 'string' || command.clientRequestId.trim() !== command.clientRequestId
      || command.clientRequestId.length < 8 || command.clientRequestId.length > 200
      || (command.responseDeadline !== null && calendarInstant(command.responseDeadline) === null)) return invalid();
    command = { ...command };
    // An elapsed deadline may recover an already committed receipt. Only B07 can
    // distinguish recovery from a new publication; do not reject it on the client.
    return readReceipt({ rpc: 'rpc_publish_need_canonical', args: { p_need_id: command.needId,
      p_expected_revision: command.expectedRevision, p_decision_sequence: command.decisionSequence,
      p_response_deadline: command.responseDeadline, p_client_request_id: command.clientRequestId },
      errors: COPY, write: true, fallback: 'NEED_PUBLISH_UNCONFIRMED', invalid: 'PUBLICATION_INVALID_RESPONSE',
      decode(raw): PublishNeedReceipt | null {
        const value = record(raw);
        if (!value || !only(value, ['needId', 'status', 'publishedAt', 'responseDeadline', 'idempotentReplay'])
          || !sameId(value.needId, command.needId) || value.status !== 'PUBLISHED' || !timestamp(value.publishedAt)
          || typeof value.idempotentReplay !== 'boolean'
          || (command.responseDeadline === null ? value.responseDeadline !== null
            : calendarInstant(value.responseDeadline) === null || calendarInstant(value.responseDeadline) !== calendarInstant(command.responseDeadline))) return null;
        return value as unknown as PublishNeedReceipt;
      },
    });
  },
};
