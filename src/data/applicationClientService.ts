import { legacyRpcFailure } from './legacyRpcFailure';
import type { ApplicationTaskFacts, MojaPrijavaProjekcija, StanjeMojePrijave } from '../contracts/projections';
import type { Ishod, Izvor, PovuciPrijavuKomanda } from './ports';
import { supabaseKlijent } from './supabaseClient';
import { novac } from '../lib/novac';
import { calendarInstant } from '../lib/calendarTime';
import { dogovorenoVreme } from '../lib/dogovorenoVreme';
import { podrucjeTekst } from '../lib/location';
import { timeZone } from '../lib/market';
import { needScheduleText } from './needDetailPresentation';
import { decodeOwnApplicationsPage, isOwnApplicationsPageRequest } from './ownApplicationsPage';
import { positiveInteger, readOwnedResult } from './serverReceipt';

const supabase = new Proxy({} as ReturnType<typeof supabaseKlijent>, {
  get: (_target, prop) => (supabaseKlijent() as never)[prop],
});

type ApplicationLifecycleService = Pick<Izvor, 'mojePrijave' | 'mojePrijaveStrana' | 'povuciPrijavu'>;

function fail<T>(error: unknown, code: string, message: string): Ishod<T> {
  return legacyRpcFailure(error, code, message);
}



const SCHEDULE_KINDS = ['FIXED_WINDOW', 'FLEXIBLE', 'REMOTE_ANYTIME', 'TODAY_FLEXIBLE', 'TOMORROW_FLEXIBLE', 'WEEK_FLEXIBLE'] as const;
const LOCATION_MODES = ['STATIONARY', 'POINT_TO_POINT', 'MULTI_STOP', 'AREA_BASED', 'REMOTE'] as const;
/** The keys the paged read adds to an application (EX-04 S2); `startsAt` is older and is read with them. */
const FACT_KEYS = ['scheduleKind', 'endsAt', 'executionLocationMode', 'taskTimezone', 'priceMode', 'priceBasis', 'requiredSlots'] as const;

/**
 * The facts of the task that the card needs (R18-E03): the full term, the execution mode, the zone, what the price is for and the people. All of them or
 * none: the whole-list read carries none and keeps its older wording; the paged read must carry all (`required`), and a part of them is an invalid
 * projection. Nothing is inferred (a missing point never makes a task remote), and a value that is not one of the task's own is no card.
 */
function readTaskFacts(raw: any, required: boolean): ApplicationTaskFacts | null {
  const invalid = (): never => { throw new Error('MY_APPLICATIONS_INVALID_PROJECTION'); };
  const present = FACT_KEYS.filter(key => Object.prototype.hasOwnProperty.call(raw ?? {}, key));
  if (present.length === 0) return required ? invalid() : null;
  if (present.length !== FACT_KEYS.length) return invalid();
  const instant = (value: unknown): string | null => value === null ? null
    : typeof value === 'string' && calendarInstant(value) !== null ? value : invalid();
  const startsAt = instant(raw.startsAt), endsAt = instant(raw.endsAt);
  if (startsAt && endsAt && calendarInstant(startsAt)! >= calendarInstant(endsAt)!) invalid();
  const kind = SCHEDULE_KINDS.find(value => value === raw.scheduleKind) ?? invalid();
  const mode = raw.executionLocationMode === null ? null : LOCATION_MODES.find(value => value === raw.executionLocationMode) ?? invalid();
  const zone = raw.taskTimezone === null ? null : typeof raw.taskTimezone === 'string' && timeZone(raw.taskTimezone) ? raw.taskTimezone : invalid();
  const priceMode = raw.priceMode === 'MY_PRICE' || raw.priceMode === 'OFFERS' ? raw.priceMode : invalid();
  const basis = raw.priceBasis === null ? null : raw.priceBasis === 'TOTAL' || raw.priceBasis === 'PER_PERSON' || raw.priceBasis === 'HOURLY' ? raw.priceBasis : invalid();
  if (priceMode === 'OFFERS' && basis !== null) invalid();
  if (!positiveInteger(raw.requiredSlots) || raw.requiredSlots > 50) invalid();
  return { raspored: { kind, startsAt, endsAt }, rezimLokacije: mode, vremenskaZona: zone, rezimCene: priceMode, osnovaCene: basis,
    potrebnoMesta: raw.requiredSlots };
}

function mapApplication(raw: any, options: { facts: 'optional' | 'required' } = { facts: 'optional' }): MojaPrijavaProjekcija {
  const state = String(raw?.state ?? '') as StanjeMojePrijave;
  const allowed: StanjeMojePrijave[] = [
    'SUBMITTED',
    'VIEWED',
    'SHORTLISTED',
    'STALE_REVIEW_REQUIRED',
    'WITHDRAWN',
    'SELECTED',
    'CLOSED',
  ];
  if (!allowed.includes(state)) {
    throw new Error(`MY_APPLICATIONS_INVALID_STATE:${state}`);
  }

  const amount = Number(raw?.priceRsd ?? 0);
  const currentNeedRevision = Number(raw?.needRevision ?? 0);
  const submittedNeedRevision = Number(raw?.submittedNeedRevision ?? 0);
  const version = Number(raw?.version ?? 0);
  const coveredSlots = Number(raw?.coveredSlots ?? 0);

  // PostgREST numeric fields can be number-like, but NaN/Infinity and fractional revisions/seats never become a valid card.
  if (!raw?.applicationId || !raw?.needId || !Number.isFinite(amount) || amount <= 0
    || !Number.isSafeInteger(currentNeedRevision) || currentNeedRevision < 1
    || !Number.isSafeInteger(submittedNeedRevision) || submittedNeedRevision < 1
    || !Number.isSafeInteger(version) || version < 1
    || !Number.isSafeInteger(coveredSlots) || coveredSlots < 1) {
    throw new Error('MY_APPLICATIONS_INVALID_PROJECTION');
  }
  if (raw.applicationPriceBasis != null && !['TOTAL', 'HOURLY'].includes(raw.applicationPriceBasis))
    throw new Error('APPLICATION_PRICE_BASIS_INVALID');
  if (raw.currency != null && raw.currency !== 'RSD') throw new Error('APPLICATION_CURRENCY_INVALID');
  if (raw.priceReviewRequired !== undefined && typeof raw.priceReviewRequired !== 'boolean') throw new Error('APPLICATION_PRICE_REVIEW_INVALID');
  const facts = readTaskFacts(raw, options.facts === 'required');
  if (raw.calendarConflict !== undefined && typeof raw.calendarConflict !== 'boolean') throw new Error('MY_APPLICATIONS_CALENDAR_INVALID');

  return {
    prijavaId: String(raw.applicationId),
    potrebaId: String(raw.needId),
    potrebaRevizija: currentNeedRevision,
    prijavaRevizija: submittedNeedRevision,
    prijavaVerzija: version,
    stanje: state,
    ...(raw.priceReviewRequired === undefined ? {} : { osnovicaZaProveru: raw.priceReviewRequired }),
    ...(raw.calendarConflict !== undefined ? { terminZauzet: raw.calendarConflict } : {}),
    naslov: String(raw?.title ?? 'Zadatak'),
    opis: String(raw?.description ?? ''),
    cena: {
      iznos: amount,
      valuta: 'RSD',
      prikaz: novac(amount),
    },
    pokrivaMesta: coveredSlots,
    ...(raw.applicationPriceBasis == null ? {} : { osnovaCene: raw.applicationPriceBasis }),
    napomena: String(raw?.scopeNote ?? ''),
    // With the task's facts the card says what the task says: remote is "Na daljinu" (never a city), and the term is written the way the task card writes it,
    // end date and zone included. Without them (the whole-list read) it keeps its older wording.
    podrucjeTekst: facts?.rezimLokacije === 'REMOTE' ? 'Na daljinu' : podrucjeTekst(raw?.approximateArea, raw?.approximateCity),
    vremeTekst: facts ? needScheduleText(facts.raspored, facts.vremenskaZona ?? undefined) : dogovorenoVreme(raw?.startsAt, 'Fleksibilno'),
    dogovorId: raw?.agreementId ? String(raw.agreementId) : null,
    promenjenaPotreba: raw?.requiresStaleReview === true,
    mozePovuci: raw?.canWithdraw === true,
    traziPaznju: raw?.attentionRequired === true,
    ...(facts ? { zadatak: facts } : {}),
  };
}

export const applicationClientService: ApplicationLifecycleService = {
  async mojePrijave() {
    const { data, error } = await supabase.rpc('rpc_list_my_applications');
    if (error) throw new Error('MY_APPLICATIONS_READ_FAILED');
    if (!Array.isArray(data)) throw new Error('MY_APPLICATIONS_INVALID_PROJECTION');
    return data.map(row => mapApplication(row));
  },

  /**
   * EX-04 S2 (B10): one keyset page of my applications in one of the screen's sets, in the whole-list read's own order, with the task facts the card needs and,
   * on the first page, the four counts of the tabs. A page that does not add up is an invalid read, never a short one. Needs the ex04b server contract: a build
   * flag keeps the screen on `mojePrijave` until DEV has it.
   */
  async mojePrijaveStrana(request) {
    if (!isOwnApplicationsPageRequest(request)) throw new Error('OWN_APPLICATIONS_PAGE_INVALID');
    const args: Record<string, unknown> = { p_scope: request.scope, p_limit: request.limit };
    if (request.cursor) { args.p_before_at = request.cursor.at; args.p_before_id = request.cursor.id; args.p_before_rank = request.cursor.rank; }
    const result = await readOwnedResult({
      request: () => supabase.rpc('rpc_list_my_applications_page', args),
      decode: raw => decodeOwnApplicationsPage(raw, request, document => mapApplication(document, { facts: 'required' })),
      errors: {}, fallback: 'OWN_APPLICATIONS_PAGE_UNAVAILABLE', invalid: 'OWN_APPLICATIONS_PAGE_INVALID',
    });
    if (!result.ok) throw new Error(result.kod);
    return result.podatak;
  },

  async povuciPrijavu(k: PovuciPrijavuKomanda): Promise<Ishod<{ stanje: 'WITHDRAWN'; verzija: number }>> {
    const { data, error } = await supabase.rpc('rpc_withdraw_response', {
      p_response_id: k.prijavaId,
      p_need_revision: k.potrebaRevizija,
      p_response_version: k.prijavaVerzija,
      p_client_request_id: k.clientRequestId,
      p_reason: k.razlog ?? null,
    });
    if (error) return fail(error, 'WITHDRAW_RESPONSE_FAILED', 'Prijava nije mogla da se povuče. Pokušaj ponovo.');
    // The version is the server's to state. It used to fall back to the one this command was sent
    // with, so a receipt that named no version still read as a confirmed withdrawal at a version
    // nobody had confirmed, and the next command against this Prijava would have carried it.
    const version: unknown = data?.version;
    if (String(data?.status ?? '') !== 'WITHDRAWN'
      || typeof version !== 'number' || !Number.isSafeInteger(version) || version < 1) {
      return { ok: false, kod: 'WITHDRAW_RESPONSE_INVALID_RESULT', poruka: 'Ne znamo da li je prijava povučena. Osveži listu.' };
    }
    return { ok: true, podatak: { stanje: 'WITHDRAWN', verzija: version } };
  },
};
