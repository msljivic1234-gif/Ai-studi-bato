import type { NeedDetailProjection, NeedScheduleProjection, PotrebaProjekcija, StanjePotrebe } from '../contracts/projections';
import type { Izvor } from './ports';
import { capabilityTerms } from '../lib/capabilityTerms';
import { calendarInstant } from '../lib/calendarTime';
import { countryCode, timeZone } from '../lib/market';
import { normalizeTaskGeography, podrucjeTekst } from '../lib/location';
import { needScheduleText } from './needDetailPresentation';
import { supabaseKlijent } from './supabaseClient';
import { readNeedUrgencies } from './needUrgencyClientService';
import { novac } from '../lib/novac';
import { decodeOwnTasksPage, isOwnTasksPageRequest } from './ownTasksPage';
import { endingOfStatus, type WithEnding } from './needEnding';
import { readOwnedResult, record, timestamp } from './serverReceipt';
import { sesijaSada } from '../store/sesija';

const supabase = new Proxy({} as ReturnType<typeof supabaseKlijent>, {
  get: (_target, prop) => (supabaseKlijent() as never)[prop],
});

type NeedReadService = Pick<Izvor, 'mojePotrebe' | 'potreba' | 'mojePotrebeStrana'>;


function stanje(
  raw: string,
  popunjeno: number,
  ukupno: number,
  brojPrijavaZaIzbor: number | null,
): StanjePotrebe {
  switch (raw) {
    case 'DRAFT':
      return 'NACRT';
    case 'PUBLISHED':
      return (brojPrijavaZaIzbor ?? 0) > 0 ? 'CEKA_PRIJAVE' : 'OBJAVLJENA';
    case 'SELECTION':
      if (popunjeno >= ukupno) return 'POPUNJENA';
      return popunjeno > 0 ? 'DELIMICNO_POPUNJENA' : (brojPrijavaZaIzbor ?? 0) > 0 ? 'CEKA_PRIJAVE' : 'OBJAVLJENA';
    case 'ACTIVE':
      return 'POPUNJENA';
    case 'COMPLETED':
    case 'CANCELLED':
    case 'EXPIRED':
    case 'ARCHIVED':
      return 'ZATVORENA';
    default:
      throw new Error(`NEED_STATUS_UNSUPPORTED:${raw}`);
  }
}

export function readPublicNeedDetail(raw: Record<string, any>): { detail: NeedDetailProjection; schedule: NeedScheduleProjection } {
  const invalid = (): never => { throw new Error('NEED_DETAIL_INVALID_PROJECTION'); };
  const array = (value: unknown): string[] => capabilityTerms(value) ?? invalid();
  const nullableDate = (value: unknown): string | null => value === null ? null
    : typeof value === 'string' && calendarInstant(value) !== null ? value : invalid();
  const relation = (value: unknown): Record<string, unknown> | null => value === null ? null
    : value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : invalid();
  const geographyRow = relation(raw.need_geography), conditions = relation(raw.need_requirement_details);
  const topology = geographyRow ? relation(geographyRow.public_topology) ?? invalid() : null;
  const normalizedGeography = topology ? normalizeTaskGeography(topology) : null;
  // Historical rows predate current normalized topology and may have no witness.
  // Keep the Need readable; never invent or display an incompatible topology.
  const geography = normalizedGeography?.mode === raw.execution_location_mode ? normalizedGeography : null;
  const category = typeof raw.category === 'string' ? raw.category.replace(/^ +| +$/g, '') : null;
  const kinds = ['FIXED_WINDOW','FLEXIBLE','REMOTE_ANYTIME','TODAY_FLEXIBLE','TOMORROW_FLEXIBLE','WEEK_FLEXIBLE'];
  const modes = ['STATIONARY','POINT_TO_POINT','MULTI_STOP','AREA_BASED','REMOTE'];
  if (category === null || Array.from(category).length < 1 || Array.from(category).length > 120
    || !kinds.includes(raw.schedule_kind) || (raw.execution_location_mode !== null && !modes.includes(raw.execution_location_mode))
    || typeof raw.verified_identity_required !== 'boolean'
    || (raw.minimum_experience_years !== null && (!Number.isInteger(raw.minimum_experience_years) || raw.minimum_experience_years < 0))
    || (raw.task_country_code !== null && countryCode(raw.task_country_code) !== raw.task_country_code)
    || (raw.task_timezone !== null && !timeZone(raw.task_timezone))) invalid();
  const od = nullableDate(raw.starts_at), end = nullableDate(raw.ends_at);
  if (od && end && calendarInstant(od)! >= calendarInstant(end)!) invalid();
  return { schedule: { kind: raw.schedule_kind, startsAt: od, endsAt: end },
    detail: { kategorija: raw.category, geografija: geography, rezimLokacije: raw.execution_location_mode,
    zahtevi: { vestine: array(raw.required_skills), alati: array(raw.required_tools), vozila: array(raw.required_vehicles),
      dozvole: array(raw.required_licenses), bitniUslovi: conditions ? array(conditions.critical_conditions) : null,
      iskustvoGodina: raw.minimum_experience_years, potvrdjenIdentitet: raw.verified_identity_required } } };
}

/**
 * `stanje` folds COMPLETED, CANCELLED, EXPIRED and ARCHIVED into the one ZATVORENA (kept as it was: the Istorija tab, the filters and the
 * lifecycle menu read it). How the task ended is a different fact the screens need ("Završen", "Otkazan", "Istekao"), so it rides beside it
 * as `kraj`, present only on a task that ended (`needEnding.ts`).
 */
function mapNeed(raw: any): WithEnding<PotrebaProjekcija> {
  const { detail: detalji, schedule } = readPublicNeedDetail(raw);
  const kraj = endingOfStatus(raw.status);
  // Canonical Need rows always supply the 1–50 required slots and an exact
  // nonnegative covered count. Missing, fractional or overfilled wire values
  // cannot silently become 1/0 or be clamped into false capacity facts.
  const ukupno = raw.required_slots, popunjeno = raw.covered_slots;
  if (!Number.isSafeInteger(ukupno) || ukupno < 1 || ukupno > 50
    || !Number.isSafeInteger(popunjeno) || popunjeno < 0 || popunjeno > ukupno)
    throw new Error('NEED_CAPACITY_INVALID');
  // This owner reader always returns a concrete list of response IDs. An
  // unavailable or malformed collection is not proof of zero applications.
  if (!Array.isArray(raw.marketplace_responses) || raw.marketplace_responses.some(
    (row: unknown) => !row || typeof row !== 'object' || Array.isArray(row)
      || typeof (row as { id?: unknown }).id !== 'string' || !(row as { id: string }).id.trim()))
    throw new Error('NEED_RESPONSE_COUNT_INVALID');
  const brojPrijava = raw.marketplace_responses.length;
  const cena = raw.requester_price_rsd;
  const revizija = raw.revision;
  if (!Number.isSafeInteger(revizija) || revizija < 1) throw new Error('NEED_REVISION_INVALID');
  if (cena !== null && cena !== undefined && (!Number.isSafeInteger(cena) || cena < 1))
    throw new Error('NEED_PRICE_INVALID');
  const brojPrijavaZaIzbor = raw.selectable_application_count;
  if (brojPrijavaZaIzbor !== null && (!Number.isSafeInteger(brojPrijavaZaIzbor) || brojPrijavaZaIzbor < 0)) {
    throw new Error('NEED_ACTIONABLE_COUNT_INVALID');
  }
  const mode = raw.mode === 'MY_PRICE' || raw.mode === 'OFFERS' ? raw.mode : undefined;

  return {
    id: raw.id,
    // rpc_read_task already includes updated_at for the owner. Keep it typed and
    // validated so Home can avoid promoting an old draft over current actions.
    ...(timestamp(raw.updated_at) ? { azurirano: raw.updated_at } : {}),
    ...(timestamp(raw.published_at) ? { objavljeno: raw.published_at } : {}),
    brojFotografija: Array.isArray(raw.public_photo_paths) ? raw.public_photo_paths.length : 0,
    revizija,
    naslov: raw.title ?? '',
    opis: raw.description ?? '',
    stanje: stanje(String(raw.status), popunjeno, ukupno, brojPrijavaZaIzbor),
    ...(kraj ? { kraj } : {}),
    pokrivenost: {
      ukupno,
      popunjeno,
      preostalo: Math.max(0, ukupno - popunjeno),
      udeo: ukupno > 0 ? popunjeno / ukupno : 0,
    },
    vremeTekst: needScheduleText(schedule, raw.task_timezone ?? undefined),
    taskCountryCode: raw.task_country_code ?? undefined, taskTimezone: raw.task_timezone ?? undefined,
    schedule,
    detalji,
    podrucjeTekst: detalji.rezimLokacije === 'REMOTE' ? 'Na daljinu' : podrucjeTekst(raw.approximate_area, raw.approximate_city),
    // The same two columns the public reader hands to every signed-in viewer as `pin`, and their
    // type is the coarseness: numeric(6,2)/(7,2), about a kilometre. Asking for them here only
    // means the owner can see their own Task where a stranger already sees it — on a map.
    priblizno: typeof raw.approximate_lat === 'number' && typeof raw.approximate_lng === 'number'
      ? { lat: raw.approximate_lat, lng: raw.approximate_lng }
      : raw.approximate_lat !== null && raw.approximate_lng !== null
        && Number.isFinite(Number(raw.approximate_lat)) && Number.isFinite(Number(raw.approximate_lng))
        ? { lat: Number(raw.approximate_lat), lng: Number(raw.approximate_lng) } : null,
    uslovi: [
      ...(raw.required_skills ?? []),
      ...(raw.required_tools ?? []),
      ...(raw.required_vehicles ?? []),
    ],
    brojPrijava,
    brojPrijavaZaIzbor,
    rezimCene: mode,
    osnovaCene: raw.price_basis === 'TOTAL' || raw.price_basis === 'PER_PERSON' || raw.price_basis === 'HOURLY' ? raw.price_basis : null,
    ponudjenaCena:
      cena === null || cena === undefined
        ? undefined
        : {
            iznos: cena,
            valuta: 'RSD',
            prikaz: novac(cena),
          },
  };
}

/**
 * Canonical production client boundary for Need read operations.
 * Detail keeps existing RLS; the owner list scopes auth.uid() on the server.
 * Explicit documents include topology/requirements in the same statement, without
 * requiring access to internal account IDs or a whole-row computed-field argument.
 * Publication still uses its separate context/decision/command authority.
 */
export const needClientService: NeedReadService = {
  async mojePotrebe(options) {
    // The Home resource owns a single focus/timeout signal. Retiring that read
    // must also retire the expensive owner-list transport, not merely its UI result.
    const signal = options?.signal;
    if (signal?.aborted) throw new Error('NEED_LIST_RETIRED');
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (signal?.aborted) throw new Error('NEED_LIST_RETIRED');
    if (authError) throw new Error(authError.message || 'AUTH_READ_FAILED');
    if (!authData.user) throw new Error('AUTH_REQUIRED');

    const request = supabase.rpc('rpc_list_my_tasks');
    const { data, error } = await (signal ? request.abortSignal(signal) : request);
    if (signal?.aborted) throw new Error('NEED_LIST_RETIRED');
    if (error) throw new Error(error.message || 'NEED_LIST_FAILED');
    if (!Array.isArray(data)) throw new Error('NEED_LIST_INVALID_PROJECTION');
    // Home counts do not consume urgency badges. A skipped read stays unobserved, never inferred NORMAL.
    const urgency = options?.includeUrgency === false ? null : await readNeedUrgencies(data);
    return data.map(row => ({ ...mapNeed(row), urgency: urgency?.get(row.id) }));
  },

  /**
   * EX-04 S1 (A09): one keyset page of my own tasks, read by `rpc_list_my_needs_page`. Each item is the same `rpc_read_task` document the whole list
   * returns and goes through the same `mapNeed`, so a card cannot differ from the one the whole-list read draws. The first page also answers the five
   * counts of the sets. A page that does not add up is an invalid read, never a short one; the optional urgency badges share their own 4 s budget.
   */
  async mojePotrebeStrana(request, options) {
    if (!isOwnTasksPageRequest(request)) throw new Error('OWN_TASKS_PAGE_INVALID');
    const args: Record<string, unknown> = { p_scope: request.scope, p_limit: request.limit };
    if (request.cursor) { args.p_before_at = request.cursor.at; args.p_before_id = request.cursor.id; }
    const result = await readOwnedResult({
      request: () => supabase.rpc('rpc_list_my_needs_page', args),
      decode: raw => decodeOwnTasksPage(raw, request, mapNeed),
      errors: {}, fallback: 'OWN_TASKS_PAGE_UNAVAILABLE', invalid: 'OWN_TASKS_PAGE_INVALID',
    });
    if (!result.ok) throw new Error(result.kod);
    const { documents, ...page } = result.podatak;
    const urgency = options?.includeUrgency === false ? null : await readNeedUrgencies(documents);
    return { ...page, items: page.items.map(item => ({ ...item, urgency: urgency?.get(item.id) })) };
  },

  async potreba(id) {
    const needId = id.trim();
    if (!needId) return null;

    const owner = sesijaSada();
    const result = await readOwnedResult({
      request: async signal => {
        const request = supabase.rpc('rpc_read_task', { p_need_id: needId });
        // Bound the whole transport, including an SDK that does not settle on
        // abort. Keep the existing Error/mapping API outside the receipt decoder.
        return { data: await (typeof request.abortSignal === 'function' ? request.abortSignal(signal) : request), error: null };
      },
      decode: raw => {
        const response = record(raw);
        return response && Object.prototype.hasOwnProperty.call(response, 'data')
          && (response.error === null || record(response.error)) ? response : null;
      },
      errors: {}, fallback: 'NEED_READ_FAILED', invalid: 'NEED_DETAIL_INVALID_PROJECTION',
    });
    if (!result.ok) throw new Error(result.kod);
    const { data, error } = result.podatak;
    const message = record(error)?.message;
    if (error) throw new Error(typeof message === 'string' && message || 'NEED_READ_FAILED');
    if (data === null) return null;
    const document = record(data);
    if (!document) throw new Error('NEED_DETAIL_INVALID_PROJECTION');
    const need = mapNeed(document);
    const urgency = await readNeedUrgencies([{ id: document.id, urgent: document.urgent }]);
    if (sesijaSada().user?.id !== owner.user?.id || sesijaSada().accountRevision !== owner.accountRevision)
      throw new Error('AUTH_ACCOUNT_CHANGED');
    return { ...need, urgency: urgency.get(need.id) };
  },
};
