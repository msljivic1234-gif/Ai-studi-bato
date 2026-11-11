import type { Ishod, IzborKomanda, Izvor, PodnesiPrijavuKomanda } from './ports';
import { calendarFailure } from './calendarErrors';
import { calendarInstant } from '../lib/calendarTime';
import { failure, positiveInteger, readOwnedResult, record, sameId, uuid, type ReceiptAccount } from './serverReceipt';
import { supabaseKlijent } from './supabaseClient';
import { sesijaSada } from '../store/sesija';

export const applicationSelectionErrors: Readonly<Record<string, string>> = {
  AUTH_REQUIRED: 'Prijavite se da nastavite.',
  OWN_NEED: 'Ne možete da se prijavite na svoj zadatak.',
  NOT_REQUESTER: 'Ove prijave vidi samo osoba koja je objavila zadatak.',
  NEED_NOT_FOUND: 'Zadatak više nije dostupan.',
  NEED_NOT_OPEN: 'Zadatak više ne prima prijave.',
  NEED_REMAINING_SEARCH_CLOSED: 'Zadatak više ne prima nove prijave. Osvežite zadatak.',
  RESPONSE_WINDOW_EXPIRED: 'Rok za prijave je istekao.',
  NEED_EXECUTION_WINDOW_EXPIRED: 'Vreme za ovaj zadatak je prošlo. Nove prijave i izbor više nisu dostupni.',
  STALE_REVIEW_REQUIRED: 'Zadatak ili prijava su promenjeni. Pregledajte trenutne podatke pre novog izbora.',
  NEED_REVISION_MISMATCH: 'Zadatak je promenjen. Pregledajte trenutne uslove pre nove prijave.',
  RESPONSE_NOT_SELECTABLE: 'Ova prijava više nije dostupna za izbor.',
  RESPONSE_NOT_FOUND: 'Prijava više nije dostupna.',
  RESPONSE_ALREADY_SELECTED: 'Ova prijava je već izabrana. Otvorite svoje Dogovore.',
  PROFILE_NOT_OWNED_BY_ACCOUNT: 'Ponovo otvorite svoj radni profil pre prijave.',
  NEED_FULL: 'Sva mesta na ovom zadatku su popunjena.',
  NEED_REMAINING_CAPACITY_EXCEEDED: 'Broj ljudi premašuje preostala mesta na zadatku.',
  INVALID_COVERED_SLOTS: 'Unesite ceo broj ljudi koje obezbeđujete.',
  INVALID_PRICE: 'Unesite iznos u dinarima, bez decimala.',
  FIXED_PRICE_NOT_READY: 'Cena zadatka trenutno nije spremna. Ponovo otvorite zadatak.',
  FIXED_PRICE_MISMATCH: 'Cena prijave mora da prati cenu zadatka i broj ljudi koje obezbeđujete. Izmenite prijavu.',
  // Legacy pkg025b compatibility until the proportional TOTAL server package is applied.
  TOTAL_PRICE_REQUIRES_ALL_SLOTS: 'Cena ovog zadatka važi za ceo zadatak, pa prijava mora da pokrije sva mesta.',
  UNKNOWN_PRICE_BASIS: 'Ova verzija aplikacije ne podržava način računanja cene na ovom zadatku. Ažurirajte aplikaciju.',
  APPLICATION_PRICE_BASIS_REVIEW_REQUIRED: 'Osnovica cene nije potvrđena. Podnosilac treba da pregleda cenu i broj ljudi i potvrdi ažuriranu prijavu.',
  APPLICATION_PRICE_BASIS_CHANGED: 'Način obračuna cene je promenjen. Pregledajte i potvrdite ažuriranu prijavu.',
  INVALID_PROPOSED_INTERVAL: 'Kraj predloženog termina mora biti posle početka.',
  NEED_FIXED_INTERVAL_INVALID: 'Termin zadatka nije potpun. Ponovo otvorite zadatak.',
  WORKER_PROFILE_NOT_READY: 'Radni profil još ne ispunjava uslove za ovu prijavu.',
  WORKER_NOT_ELIGIBLE: 'Radni profil ili dostupnost ne ispunjavaju uslove zadatka.',
  WORKER_NO_LONGER_ELIGIBLE: 'Radni profil ili dostupnost su promenjeni. Pregledajte prijave ponovo.',
  TEAM_CAPACITY_EXCEEDED: 'Broj ljudi u prijavi premašuje kapacitet radnog profila.',
  OVERFILL: 'Prijava pokriva više ljudi nego što je još potrebno.',
  CONNECTION_POLICY_NOT_READY: 'Povezivanje trenutno nije dostupno. Pokušajte kasnije.',
  IDEMPOTENCY_KEY_REUSED: 'Ova prijava je već poslata sa drugom ponudom. Osvežite Moje prijave.',
  WORKER_CALENDAR_CONFLICT: 'Termin se preklapa sa drugim Dogovorom. Proverite Raspored i izaberite drugi termin.',
  CALENDAR_RECHECK_REQUIRED: 'Raspored se upravo promenio. Osvežite podatke pre ponovnog pokušaja.',
  AGREEMENT_CALENDAR_INTERVAL_INVALID: 'Proverite tačan početak i kraj predloženog termina.',
  ACCOUNT_CLOSING: 'Ova radnja nije dostupna dok se Vaš nalog zatvara.',
  SELECTION_RESULT_UNAVAILABLE: 'Potvrda izbora trenutno nije dostupna. Otvorite svoje Dogovore ili ponovo proverite stanje.',
};
export const APPLICATION_ELIGIBILITY_BLOCKERS = [
  'ACCOUNT_OR_PROFILE_RESTRICTED', 'OWN_NEED', 'IDENTITY_VERIFICATION_NOT_ADMITTED',
  'MISSING_REQUIRED_TOOL', 'MISSING_REQUIRED_LICENSE', 'MISSING_REQUIRED_VEHICLE',
  'INSUFFICIENT_EXPERIENCE', 'PROFILE_EXCLUSION', 'CALENDAR_CONFLICT',
  'NEED_NOT_FOUND', 'WORKER_PROFILE_NOT_FOUND',
] as const;
export type ApplicationEligibilityBlocker = typeof APPLICATION_ELIGIBILITY_BLOCKERS[number];
const blockerCopy: Readonly<Record<ApplicationEligibilityBlocker, string>> = {
  ACCOUNT_OR_PROFILE_RESTRICTED: 'Radni profil trenutno nije aktivan za prijave.',
  OWN_NEED: 'Ne možete da se prijavite na sopstveni zadatak.',
  IDENTITY_VERIFICATION_NOT_ADMITTED: 'Ovaj zadatak traži potvrdu identiteta koja trenutno nije dostupna za ovu prijavu.',
  MISSING_REQUIRED_TOOL: 'Radnom profilu nedostaje alat koji ovaj zadatak zahteva.',
  MISSING_REQUIRED_LICENSE: 'Radnom profilu nedostaje licenca koju ovaj zadatak zahteva.',
  MISSING_REQUIRED_VEHICLE: 'Radnom profilu nedostaje vozilo koje ovaj zadatak zahteva.',
  INSUFFICIENT_EXPERIENCE: 'Navedeno iskustvo ne ispunjava minimum ovog zadatka.',
  PROFILE_EXCLUSION: 'Ovaj zadatak je među isključenim vrstama zadataka u radnom profilu.',
  CALENDAR_CONFLICT: 'Termin se preklapa sa već potvrđenim Dogovorom.',
  NEED_NOT_FOUND: 'Zadatak više nije dostupan.',
  WORKER_PROFILE_NOT_FOUND: 'Radni profil više nije dostupan.',
};
const profileBlockers = new Set<ApplicationEligibilityBlocker>([
  'ACCOUNT_OR_PROFILE_RESTRICTED', 'MISSING_REQUIRED_TOOL', 'MISSING_REQUIRED_LICENSE',
  'MISSING_REQUIRED_VEHICLE', 'INSUFFICIENT_EXPERIENCE', 'PROFILE_EXCLUSION', 'WORKER_PROFILE_NOT_FOUND',
]);
/** Exact no-write refusals observed in the deployed rpc_submit_response body.
 * Message text alone is not evidence; ID reuse and concurrency/transport errors are deliberately absent. */
const conclusiveSubmitSqlstate: Readonly<Record<string, string>> = {
  NEED_NOT_FOUND: 'P0002',
  NEED_NOT_OPEN: '22023',
  OWN_NEED: '42501',
  RESPONSE_WINDOW_EXPIRED: '22023',
  NEED_EXECUTION_WINDOW_EXPIRED: 'PT409',
  STALE_REVIEW_REQUIRED: 'P0001',
  PROFILE_NOT_OWNED_BY_ACCOUNT: '42501',
  WORKER_PROFILE_NOT_READY: 'P0001',
  NEED_FULL: 'P0001',
  INVALID_COVERED_SLOTS: '22023',
  TEAM_CAPACITY_EXCEEDED: '22023',
  NEED_REMAINING_CAPACITY_EXCEEDED: '22023',
  INVALID_PROPOSED_INTERVAL: '22023',
  RESPONSE_ALREADY_SELECTED: 'P0001',
  NEED_FIXED_INTERVAL_INVALID: '22023',
  AGREEMENT_CALENDAR_INTERVAL_INVALID: '22023',
  WORKER_NOT_ELIGIBLE: 'P0001',
};
export type ApplicationSubmitRefusal = {
  ok: false; kod: string; poruka: string; applicationRefusal: true;
  hardBlockers: readonly ApplicationEligibilityBlocker[];
};
function decodeHardBlockers(raw: unknown): ApplicationEligibilityBlocker[] | null {
  if (typeof raw !== 'string' || raw.length > 1000) return null;
  try {
    const value: unknown = JSON.parse(raw);
    if (!Array.isArray(value) || value.length < 1 || value.length > APPLICATION_ELIGIBILITY_BLOCKERS.length
      || new Set(value).size !== value.length
      || value.some(code => typeof code !== 'string' || !(APPLICATION_ELIGIBILITY_BLOCKERS as readonly string[]).includes(code))) return null;
    return value as ApplicationEligibilityBlocker[];
  } catch { return null; }
}
function decodeSubmitRefusal(raw: unknown): ApplicationSubmitRefusal | null {
  const error = record(raw);
  const kod = typeof error?.message === 'string' ? error.message : '';
  const sqlstate = typeof error?.code === 'string' ? error.code : '';
  if (!Object.prototype.hasOwnProperty.call(conclusiveSubmitSqlstate, kod)
    || conclusiveSubmitSqlstate[kod] !== sqlstate
    || !Object.prototype.hasOwnProperty.call(applicationSelectionErrors, kod)) return null;
  let hardBlockers: ApplicationEligibilityBlocker[] = [];
  if (kod === 'WORKER_NOT_ELIGIBLE') {
    const decoded = decodeHardBlockers(error?.details);
    if (!decoded) return null;
    hardBlockers = decoded;
  }
  return { ok: false, kod, poruka: applicationSelectionErrors[kod], applicationRefusal: true, hardBlockers };
}
export function conclusiveApplicationRefusal(result: Ishod<unknown>): result is ApplicationSubmitRefusal {
  if (result.ok) return false;
  const value = record(result);
  if (value?.applicationRefusal !== true || !Object.prototype.hasOwnProperty.call(conclusiveSubmitSqlstate, result.kod)
    || !Array.isArray(value.hardBlockers)) return false;
  if (result.kod === 'WORKER_NOT_ELIGIBLE') return decodeHardBlockers(JSON.stringify(value.hardBlockers)) !== null;
  return value.hardBlockers.length === 0;
}
/** Only observed no-write failures from the current selection writer settle a
 * refusal. A matching message without its SQLSTATE, transport failure, key
 * collision or concurrency error remains an unknown outcome. */
const conclusiveSelectionSqlstate: Readonly<Record<string, string>> = {
  NEED_NOT_FOUND: 'P0002', NOT_REQUESTER: '42501', NEED_NOT_OPEN: 'P0001',
  RESPONSE_WINDOW_EXPIRED: 'P0001', NEED_EXECUTION_WINDOW_EXPIRED: 'PT409',
  STALE_REVIEW_REQUIRED: 'P0001', RESPONSE_NOT_FOUND: 'P0002', RESPONSE_NOT_SELECTABLE: 'P0001',
  WORKER_PROFILE_NOT_READY: 'P0001', WORKER_NO_LONGER_ELIGIBLE: 'P0001',
  WORKER_CALENDAR_CONFLICT: 'P0001', NEED_FIXED_INTERVAL_INVALID: '22023',
  AGREEMENT_CALENDAR_INTERVAL_INVALID: '22023', OVERFILL: 'P0001',
  APPLICATION_PRICE_BASIS_REVIEW_REQUIRED: 'PT409', APPLICATION_PRICE_BASIS_CHANGED: 'PT409',
  CONNECTION_POLICY_NOT_READY: '55000',
};
export type SelectionRefusal = { ok: false; kod: string; poruka: string; selectionRefusal: true };
function decodeSelectionRefusal(raw: unknown): SelectionRefusal | null {
  const error = record(raw), name = error?.message;
  return typeof name === 'string' && Object.hasOwn(conclusiveSelectionSqlstate, name)
    && conclusiveSelectionSqlstate[name] === error?.code
    ? { ok: false, kod: name, poruka: applicationSelectionErrors[name], selectionRefusal: true } : null;
}
export function conclusiveSelectionRefusal(result: Ishod<unknown>): result is SelectionRefusal {
  return !result.ok && record(result)?.selectionRefusal === true && Object.hasOwn(conclusiveSelectionSqlstate, result.kod);
}
export function applicationRefusalGuidance(result: Ishod<unknown>): {
  messages: string[]; profile: boolean; calendar: boolean;
} | null {
  if (!conclusiveApplicationRefusal(result)) return null;
  const messages = result.hardBlockers.map(code => blockerCopy[code]);
  const profile = result.hardBlockers.some(code => profileBlockers.has(code))
    || ['WORKER_PROFILE_NOT_READY', 'PROFILE_NOT_OWNED_BY_ACCOUNT', 'TEAM_CAPACITY_EXCEEDED'].includes(result.kod);
  const calendar = result.hardBlockers.includes('CALENDAR_CONFLICT');
  if (!messages.length && !profile && !calendar) return null;
  return { messages: messages.length ? messages : [result.poruka], profile, calendar };
}

const hash = (value: unknown): value is string => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const key = (value: string) => value.trim().length >= 8 && value.trim().length <= 200;
function interval(start: string | null, end: string | null) {
  if (start === null || end === null) return start === null && end === null;
  const from = calendarInstant(start), to = calendarInstant(end);
  return from !== null && to !== null && from < to;
}
const invalid = () => failure('APPLICATION_COMMAND_INVALID', 'Proveri cenu, broj ljudi i termin svoje ponude.');
function submitArguments(k: PodnesiPrijavuKomanda): Record<string, unknown> | null {
  if (!uuid(k.potrebaId) || !uuid(k.radnikProfilId) || !positiveInteger(k.potrebaRevizija) ||
      !positiveInteger(k.pokrivenaMesta) || !positiveInteger(k.cenaRsd) || !key(k.clientRequestId) ||
      !interval(k.predlozeniPocetak, k.predlozeniKraj) ||
      (k.napomena !== null && (typeof k.napomena !== 'string' || k.napomena.length > 4000))) return null;
  // The original payload, including whitespace in scopeNote, also owns the
  // ledger read. Neither retry nor recovery may normalize its request digest.
  return {
    p_need_id: k.potrebaId, p_need_revision: k.potrebaRevizija, p_worker_profile_id: k.radnikProfilId,
    p_covered_slots: k.pokrivenaMesta, p_price_rsd: k.cenaRsd,
    p_proposed_start_at: k.predlozeniPocetak, p_proposed_end_at: k.predlozeniKraj,
    p_scope_note: k.napomena, p_client_request_id: k.clientRequestId,
  };
}
export type ApplicationSubmitReceipt = { prijavaId: string; verzija: number; hash: string; osnovaCene: 'TOTAL' | 'HOURLY' };
type ApplicationSubmitIdentity = Pick<ApplicationSubmitReceipt, 'prijavaId' | 'verzija' | 'hash'>;
export type ApplicationSubmitReadback =
  | { state: 'NOT_FOUND' }
  | { state: 'CONFIRMED'; receipt: ApplicationSubmitReceipt }
  | { state: 'LEGACY_REVIEW_REQUIRED'; receipt: ApplicationSubmitIdentity };
type DecodedSubmitResult = Exclude<ApplicationSubmitReadback, { state: 'NOT_FOUND' }>;
function decodeSubmitResult(raw: unknown, k: PodnesiPrijavuKomanda): DecodedSubmitResult | null {
  const value = record(raw);
  if (!value || !uuid(value.responseId) || !sameId(value.applicationId, value.responseId) ||
      !positiveInteger(value.version) || value.needRevision !== k.potrebaRevizija || !hash(value.contentHash) ||
      !['SUBMITTED', 'VIEWED', 'SHORTLISTED'].includes(String(value.status)) ||
      !['MY_PRICE', 'OFFERS'].includes(String(value.pricingMode)) || value.coveredSlots !== k.pokrivenaMesta ||
      value.snapshotSchema !== 'APPLICATION_V1_SELF_DECLARED' || value.authoritative !== true ||
      typeof value.idempotentReplay !== 'boolean') return null;
  const identity = { prijavaId: value.responseId, verzija: value.version, hash: value.contentHash };
  // The captured old writer returned none of these three keys. Its exact replay
  // proves that this command was saved, not whether its amount meant a total or
  // a rate. Partial or contradictory metadata is never accepted as legacy.
  if (value.idempotentReplay === true && ['applicationPriceBasis', 'currency', 'priceRsd'].every(field => !Object.hasOwn(value, field)))
    return { state: 'LEGACY_REVIEW_REQUIRED', receipt: identity };
  if ((value.applicationPriceBasis !== 'TOTAL' && value.applicationPriceBasis !== 'HOURLY') ||
      value.currency !== 'RSD' || value.priceRsd !== k.cenaRsd ||
      value.pricingMode === 'OFFERS' && value.applicationPriceBasis === 'HOURLY') return null;
  return { state: 'CONFIRMED', receipt: { ...identity, osnovaCene: value.applicationPriceBasis } };
}

/** Only the account's exact request key AND original request digest may prove
 * a saved submit. NOT_FOUND is one observation, not proof that an earlier
 * in-flight request cannot commit; it never authorizes changing the old intent. */
export function readApplicationSubmitResult(k: PodnesiPrijavuKomanda, account: ReceiptAccount): Promise<Ishod<ApplicationSubmitReadback>> {
  const args = submitArguments(k);
  if (!args) return Promise.resolve(invalid());
  return readOwnedResult({ account, errors: applicationSelectionErrors,
    fallback: 'APPLICATION_SUBMIT_RESULT_UNAVAILABLE', invalid: 'APPLICATION_SUBMIT_RESULT_INVALID',
    request: () => supabaseKlijent().rpc('rpc_read_response_submit_result', args),
    decode(raw): ApplicationSubmitReadback | null {
      const envelope = record(raw);
      if (!envelope || envelope.authoritative !== true || typeof envelope.found !== 'boolean') return null;
      if (!envelope.found) return envelope.result == null ? { state: 'NOT_FOUND' } : null;
      if (record(envelope.result)?.idempotentReplay !== true) return null;
      return decodeSubmitResult(envelope.result, k);
    },
  });
}
export type SelectionAgreementStatus = 'CONFIRMED' | 'CANCELLED' | 'COMPLETED' | 'SUPERSEDED';
export type SelectionReceipt = { dogovorId: string; agreementStatus?: SelectionAgreementStatus };
export type SelectionReadback = { state: 'NOT_FOUND' } | { state: 'CONFIRMED'; receipt: SelectionReceipt };
function selectionArguments(k: IzborKomanda): Record<string, unknown> | null {
  if (!uuid(k.potrebaId) || !uuid(k.prijavaId) || !positiveInteger(k.potrebaRevizija)
    || !positiveInteger(k.prijavaVerzija) || !positiveInteger(k.mesta) || !hash(k.prijavaHash) || !key(k.clientRequestId)) return null;
  return { p_need_id: k.potrebaId, p_need_revision: k.potrebaRevizija,
    p_response_id: k.prijavaId, p_response_version: k.prijavaVerzija,
    p_content_hash: k.prijavaHash, p_client_request_id: k.clientRequestId };
}
/** A read-only lookup of the exact selection ledger entry. It never selects a
 * candidate. NOT_FOUND cannot rule out an earlier request that is still running. */
export function readSelectionResult(k: IzborKomanda, account: ReceiptAccount): Promise<Ishod<SelectionReadback>> {
  const args = selectionArguments(k);
  if (!args) return Promise.resolve(failure('SELECTION_COMMAND_INVALID', 'Ponovo otvorite konkretnu prijavu pre izbora.'));
  const exact = (row: Record<string, unknown>, keys: readonly string[]) => Object.keys(row).length === keys.length && keys.every(key => Object.hasOwn(row, key));
  return readOwnedResult({ account, errors: applicationSelectionErrors,
    fallback: 'SELECTION_RESULT_UNAVAILABLE', invalid: 'SELECTION_RESULT_INVALID',
    request: () => supabaseKlijent().rpc('rpc_read_selection_result', { ...args, p_covered_slots: k.mesta }),
    decode(raw): SelectionReadback | null {
      const envelope = record(raw);
      if (!envelope || !exact(envelope, ['schema', 'authoritative', 'found', 'result'])
        || envelope.schema !== 'SELECTION_RESULT_V1' || envelope.authoritative !== true || typeof envelope.found !== 'boolean') return null;
      if (!envelope.found) return envelope.result === null ? { state: 'NOT_FOUND' } : null;
      const value = record(envelope.result);
      if (!value || !exact(value, ['agreementId', 'agreementStatus', 'needId', 'needRevision', 'responseId', 'responseVersion', 'contentHash', 'coveredSlots', 'clientRequestId'])
        || !uuid(value.agreementId) || !sameId(value.needId, k.potrebaId) || value.needRevision !== k.potrebaRevizija
        || !sameId(value.responseId, k.prijavaId) || value.responseVersion !== k.prijavaVerzija
        || value.contentHash !== k.prijavaHash || value.coveredSlots !== k.mesta || value.clientRequestId !== k.clientRequestId
        || typeof value.agreementStatus !== 'string' || !['CONFIRMED', 'CANCELLED', 'COMPLETED', 'SUPERSEDED'].includes(value.agreementStatus)) return null;
      return { state: 'CONFIRMED', receipt: { dogovorId: value.agreementId, agreementStatus: value.agreementStatus as SelectionAgreementStatus } };
    },
  });
}
/** Bounds the two composed screen reads, including legacy SDK readers. The
 * caller's existing focus/account/generation guard owns the result. A deadline
 * stops waiting; it does not claim cancellation of an already issued request. */
export async function boundedApplicationSelectionRead<T>(read: Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([read, new Promise<never>((_resolve, reject) => {
      timer = setTimeout(() => reject(new Error('APPLICATION_SELECTION_READ_TIMEOUT')), 15_000);
    })]);
  } finally { if (timer !== undefined) clearTimeout(timer); }
}
async function command<T>(rpc: string, args: Record<string, unknown>, decode: (raw: unknown) => T | null): Promise<Ishod<T>> {
  type Envelope = { kind: 'SUCCESS'; value: T } | { kind: 'REFUSAL'; refusal: SelectionRefusal };
  const outcome = await readOwnedResult<Envelope>({ write: true, errors: applicationSelectionErrors,
    fallback: 'APPLICATION_SELECTION_UNCONFIRMED', invalid: 'APPLICATION_SELECTION_INVALID_RECEIPT',
    request: async () => {
      const result = await supabaseKlijent().rpc(rpc, args);
      const refusal = decodeSelectionRefusal(result.error);
      if (refusal) return { data: { kind: 'REFUSAL', refusal }, error: null };
      const calendar = calendarFailure(result.error);
      if (calendar && !calendar.ok) return { data: null, error: { message: calendar.kod } };
      return result.error ? result : { data: { kind: 'SUCCESS', raw: result.data }, error: null };
    },
    decode(raw) {
      const envelope = record(raw);
      if (envelope?.kind === 'REFUSAL') {
        const refusal = envelope.refusal as Ishod<unknown>;
        return conclusiveSelectionRefusal(refusal) ? { kind: 'REFUSAL', refusal } : null;
      }
      if (envelope?.kind !== 'SUCCESS') return null;
      const value = decode(envelope.raw);
      return value === null ? null : { kind: 'SUCCESS', value };
    },
  });
  if (!outcome.ok) return outcome;
  return outcome.podatak.kind === 'REFUSAL' ? outcome.podatak.refusal : { ok: true, podatak: outcome.podatak.value };
}

/** Sole canonical submit/select adapter. Explicit retries reuse the caller's
 * immutable request. Server still owns eligibility, calendar and atomic Agreement. */
export const applicationSelectionClientService: Pick<Izvor, 'podnesiPrijavu' | 'izaberiPrijavu'> = {
  async podnesiPrijavu(k: PodnesiPrijavuKomanda) {
    const args = submitArguments(k);
    if (!args) return invalid();
    type Envelope =
      | { kind: 'SUCCESS'; result: DecodedSubmitResult }
      | { kind: 'REFUSAL'; refusal: ApplicationSubmitRefusal };
    const outcome = await readOwnedResult<Envelope>({ write: true, errors: applicationSelectionErrors,
      fallback: 'APPLICATION_SELECTION_UNCONFIRMED', invalid: 'APPLICATION_SELECTION_INVALID_RECEIPT',
      request: async () => {
        const response = await supabaseKlijent().rpc('rpc_submit_response', args);
        const refusal = decodeSubmitRefusal(response.error);
        if (refusal) return { data: { kind: 'REFUSAL', refusal }, error: null };
        const calendar = calendarFailure(response.error);
        if (calendar && !calendar.ok) return { data: null, error: { message: calendar.kod } };
        return response.error ? response : { data: { kind: 'SUCCESS', raw: response.data }, error: null };
      },
      decode(raw) {
        const envelope = record(raw);
        if (envelope?.kind === 'REFUSAL') {
          const refusal = envelope.refusal as Ishod<unknown>;
          return conclusiveApplicationRefusal(refusal) ? { kind: 'REFUSAL', refusal } : null;
        }
        if (envelope?.kind !== 'SUCCESS') return null;
        const result = decodeSubmitResult(envelope.raw, k);
        return result ? { kind: 'SUCCESS', result } : null;
      },
    });
    if (!outcome.ok) return outcome;
    if (outcome.podatak.kind === 'REFUSAL') return outcome.podatak.refusal;
    return outcome.podatak.result.state === 'LEGACY_REVIEW_REQUIRED'
      ? failure('APPLICATION_PRICE_BASIS_REVIEW_REQUIRED', applicationSelectionErrors.APPLICATION_PRICE_BASIS_REVIEW_REQUIRED)
      : { ok: true as const, podatak: outcome.podatak.result.receipt };
  },
  izaberiPrijavu(k: IzborKomanda) {
    const args = selectionArguments(k);
    if (!args) return Promise.resolve(failure('SELECTION_COMMAND_INVALID', 'Ponovo otvorite konkretnu prijavu pre izbora.'));
    return command('rpc_select_response', args, raw => uuid(raw) ? { dogovorId: raw } : null);
  },
};

/** Existing requester/participant SELECT policies remain the authority. A null
 * link means no visible matching Agreement; it never proves the selection absent. */
export function readSelectedAgreement(potrebaId: string, prijavaId: string): Promise<Ishod<{ dogovorId: string | null }>> {
  if (!uuid(potrebaId) || !uuid(prijavaId)) return Promise.resolve(failure('SELECTION_LINK_INVALID', 'Ponovo otvorite konkretnu prijavu.'));
  const owner = sesijaSada();
  if (!owner.user?.id) return Promise.resolve(failure('AUTH_REQUIRED', 'Prijavite se da otvorite Dogovor.'));
  const account = { accountId: owner.user.id, accountRevision: owner.accountRevision };
  return readOwnedResult({ account, errors: {}, fallback: 'SELECTION_LINK_UNAVAILABLE', invalid: 'SELECTION_LINK_INVALID',
    request: () => supabaseKlijent().from('need_selections')
      .select('need_id,response_id,status,agreements(id,need_id,selected_response_id)')
      .eq('need_id', potrebaId).eq('response_id', prijavaId).eq('status', 'SELECTED')
      .eq('selected_by_account_id', account.accountId).maybeSingle(),
    decode(raw) {
      if (raw === null) return { dogovorId: null };
      const selection = record(raw);
      if (!selection || selection.status !== 'SELECTED' || !sameId(selection.need_id, potrebaId) || !sameId(selection.response_id, prijavaId)) return null;
      const linked = selection.agreements;
      if (linked === null || (Array.isArray(linked) && linked.length === 0)) return { dogovorId: null };
      if (Array.isArray(linked) && linked.length !== 1) return null;
      const agreement = record(Array.isArray(linked) ? linked[0] : linked);
      return agreement && uuid(agreement.id) && sameId(agreement.need_id, potrebaId) && sameId(agreement.selected_response_id, prijavaId)
        ? { dogovorId: agreement.id } : null;
    },
  });
}
