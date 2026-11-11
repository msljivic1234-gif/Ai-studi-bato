import { workerCapacityRevision, workerCapacityValue } from '../contracts/workerCapacity';
import { decodeWorkerAreas } from '../contracts/workerAreas';
import { noTaskRelations, taskRelationIndex } from './taskRelation';
import { legacyRpcFailure } from './legacyRpcFailure';
import { Izvor, Ishod } from './ports';
import { calendarFailure } from './calendarErrors';
import { positiveInteger, readOwnedResult, record, sameId, uuid } from './serverReceipt';
import { sesijaSada } from '../store/sesija';
import { publicProfileClientService } from './publicProfileClientService';
import { enrichPublicProfiles } from './publicProfileEnrichment';
import { mediaAssetId } from './mediaAssetId';
import { readPublicNeedDetail } from './needClientService';
import { needScheduleText } from './needDetailPresentation';
import { readNeedUrgencies } from './needUrgencyClientService';
import { supabaseKlijent } from './supabaseClient';
import type {
  JavniProfilProjekcija,
  Novac,
  Pokrivenost,
  PrilikaProjekcija,
} from '../contracts/projections';
import { novac } from '../lib/novac';
import { podrucjeTekst } from '../lib/location';
import { vreme } from '../lib/vreme';
import { calendarInstant } from '../lib/calendarTime';

const supabase = new Proxy({} as ReturnType<typeof supabaseKlijent>, {
  get: (_t, prop) => (supabaseKlijent() as never)[prop],
});

function handleRpcError<T>(error: unknown, defaultCode: string, defaultMessage: string): Ishod<T> {
  const calendar = calendarFailure(error);
  if (calendar) return calendar;
  return legacyRpcFailure(error, defaultCode, defaultMessage);
}

const rsd = (iznos: number): Novac => ({
  iznos,
  valuta: 'RSD',
  prikaz: novac(iznos),
});

function pokrivenost(ukupno: number, popunjeno: number): Pokrivenost {
  const preostalo = Math.max(0, ukupno - popunjeno);
  return { ukupno, popunjeno, preostalo, udeo: ukupno ? popunjeno / ukupno : 0 };
}

/**
 * The time under a message bubble. A message is a moment in the reader's own day, so it reads in the
 * reader's zone (see dogovorenoVreme.ts for why an agreed TERM does not): the clock alone when it is
 * today, the day and month in front of it otherwise, and never seconds — a conversation is not a log.
 */
function vremePoruke(iso: string): string {
  return vreme(iso, { danas: true });
}


/**
 * One item of public.rpc_list_open_tasks_v3, shaped like the row the shared public projection reads, so
 * that the list keeps exactly one way of reading a public task. The reader's allowlist is narrower than
 * the table on purpose: there is no description here, because a list of two hundred tasks has no business
 * shipping two hundred descriptions to every viewer, and the detail screen reads the one a person opens.
 */
function openTaskRow(item: Record<string, any>) {
  return {
    id: item.id, title: item.title, status: item.status, urgent: item.urgent,
    category: item.category, schedule_kind: item.scheduleKind, starts_at: item.startsAt, ends_at: item.endsAt,
    execution_location_mode: item.executionLocationMode,
    approximate_area: item.approximateArea ?? '', approximate_city: item.approximateCity ?? '',
    approximate_lat: item.pin?.lat ?? null, approximate_lng: item.pin?.lng ?? null,
    required_slots: item.requiredSlots, covered_slots: item.coveredSlots,
    required_skills: item.requiredSkills, required_tools: item.requiredTools,
    required_vehicles: item.requiredVehicles, required_licenses: item.requiredLicenses,
    minimum_experience_years: item.minimumExperienceYears, verified_identity_required: item.verifiedIdentityRequired,
    task_country_code: item.taskCountryCode, task_timezone: item.taskTimezone,
    mode: item.priceMode, requester_price_rsd: item.requesterPriceRsd, price_basis: item.priceBasis,
    requester_profile_id: item.requesterProfileId, response_deadline: item.responseDeadline,
    remaining_search_closed_at: null,
    // The list RPC does not authorize a description. Keep the safe fallback for
    // downstream readers, but never promote an unexpected server field to public UI.
    description: '',
    need_geography: item.publicTopology == null ? null : { public_topology: item.publicTopology },
    need_requirement_details: item.criticalConditions == null ? null : { critical_conditions: item.criticalConditions },
  };
}

function publicTaskContext(raw: Record<string, any>) {
  const { detail: detalji, schedule } = readPublicNeedDetail(raw);
  const opis = typeof raw.description === 'string' ? raw.description : '';
  const remote = detalji.rezimLokacije === 'REMOTE';
  const lat = raw.approximate_lat, lng = raw.approximate_lng;
  const priblizno = !remote && typeof lat === 'number' && Number.isFinite(lat) && Math.abs(lat) <= 90
    && typeof lng === 'number' && Number.isFinite(lng) && Math.abs(lng) <= 180
    ? { lat: Number(lat.toFixed(2)), lng: Number(lng.toFixed(2)) } : null;
  return { opis, detalji, schedule, taskCountryCode: raw.task_country_code ?? undefined,
    taskTimezone: raw.task_timezone ?? undefined, vremeTekst: needScheduleText(schedule, raw.task_timezone ?? undefined),
    podrucjeTekst: remote ? 'Na daljinu' : podrucjeTekst(raw.approximate_area, raw.approximate_city), priblizno };
}

function validPublicInstant(value: unknown): value is string {
  return typeof value === 'string'
    && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value)
    && Number.isFinite(Date.parse(value));
}

function formatPublicRating(profile: JavniProfilProjekcija | null | undefined): string | null {
  if (!profile?.poverenje.ocenaDostupna || profile.poverenje.ocenaProsek === null) return null;
  return profile.poverenje.ocenaProsek.toLocaleString('sr-Latn-RS', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
}

/**
 * How many reviews the rating stands on, only when the same profile read discloses reviews. The read already carries
 * it (the validated reviewCount); the list used to drop it, so a rating from one review read the same as from fifty.
 * Unknown stays null: nothing is counted or guessed here.
 */
function publicReviewCount(profile: JavniProfilProjekcija | null | undefined): number | null {
  if (!profile?.poverenje.recenzijeDostupne) return null;
  const count = profile.poverenje.brojRecenzija;
  return typeof count === 'number' && Number.isSafeInteger(count) && count >= 0 ? count : null;
}

/**
 * One narrow RPC per distinct profile id. A profile projection failure must not
 * erase otherwise-public Need/Application rows, so marketplace list consumers
 * degrade to unavailable trust while the explicit javniProfil() port itself
 * still fails loudly when called directly by a profile screen.
 */
async function safePublicProfiles(profileIds: Array<string | null | undefined>, signal?: AbortSignal) {
  const owner = sesijaSada();
  const accountId = owner.user?.id;
  const revision = owner.accountRevision;
  return enrichPublicProfiles(
    profileIds,
    (id, signal) => publicProfileClientService.javniProfil(id, signal),
    () => {
      const current = sesijaSada();
      return !!accountId && current.user?.id === accountId && current.accountRevision === revision;
    },
    signal,
  );
}

/** Shared allowlisted row mapping for the collection and exact public reader. */
async function projectOpenTasks(items: Record<string, unknown>[], assertCurrent: () => void, signal?: AbortSignal): Promise<PrilikaProjekcija[]> {
  const openData = items.map(openTaskRow);
  assertCurrent();
  const [profiles, urgency] = await Promise.all([
    safePublicProfiles(openData.map(r => r.requester_profile_id), signal), readNeedUrgencies(openData, signal),
  ]);
  assertCurrent();
  return openData.map(r => {
    const narucilac = profiles.get(r.requester_profile_id) ?? null;
    return {
      id: r.id,
      urgency: urgency.get(r.id),
      naslov: r.title,
      statusTekst: r.status === 'ACTIVE' ? 'Aktivno' : 'Traži ponude',
      ...publicTaskContext(r),
      pokrivenost: pokrivenost(r.required_slots || 1, r.covered_slots || 0),
      uslovi: [...(r.required_skills || []), ...(r.required_tools || []), ...(r.required_vehicles || [])],
      narucilacProfilId: r.requester_profile_id,
      narucilacAvatarId: narucilac?.avatarPutanja ? mediaAssetId(narucilac.avatarPutanja) : null,
      narucilacIme: narucilac?.ime || '',
      narucilacOcena: formatPublicRating(narucilac),
      narucilacBrojOcena: publicReviewCount(narucilac),
      rezimCene: r.mode,
      osnovaCene: r.price_basis === 'TOTAL' || r.price_basis === 'PER_PERSON' || r.price_basis === 'HOURLY' ? r.price_basis : null,
      ponudjenaCena: r.requester_price_rsd ? rsd(r.requester_price_rsd) : undefined,
    };
  });
}

type SupabaseIzvor = Omit<
  Izvor,
  | 'mojiDogovori'
  | 'dogovor'
  | 'predloziIzmenu'
  | 'odgovoriNaIzmenu'
  | 'posaljiPoruku'
  | 'mojePotrebe'
  | 'mojePotrebeStrana'
  | 'potreba'
  | 'prijaveZaPotrebu'
  | 'prijaveZaPotrebuStrana'
  | 'oznaciPrijavuVidjenom'
  | 'podeliTelefon'
  | 'opoziviTelefon'
  | 'prijaviProblem'
  | 'oznaciZavrsetak'
  | 'potvrdiZavrsetak'
  | 'otkrijTacnuLokaciju'
  | 'lokacijskaDozvola'
  | 'podeliTacnuLokaciju'
  | 'opoziviTacnuLokaciju'
  | 'azurirajRadnikProfil'
  | 'javniProfil'
  | 'mojePrijave'
  | 'mojePrijaveStrana'
  | 'paznjaZaPocetnu'
  | 'povuciPrijavu'
  | 'podnesiPrijavu'
  | 'izaberiPrijavu'
>;

export const supabaseIzvor: SupabaseIzvor = {
  poreklo: 'supabase',

  async otvorenePrilike(options) {
    const signal = options?.signal;
    const owner = sesijaSada(), accountId = owner.user?.id, accountRevision = owner.accountRevision;
    console.warn('[OTVORENE_PRILIKE_ENTER]', accountId, accountRevision);
    if (!accountId) {
      console.warn('[OTVORENE_PRILIKE_AUTH_REQUIRED]');
      throw new Error('AUTH_REQUIRED');
    }
    // The whole walk belongs to one account visit. A token refresh keeps it; logout or A -> B -> A
    // retires it before another page/enrichment can start, even if the route already ignored it.
    const assertCurrent = () => {
      if (signal?.aborted) throw new Error('OPPORTUNITIES_READ_ABORTED');
      const current = sesijaSada();
      if (current.user?.id !== accountId || current.accountRevision !== accountRevision) throw new Error('AUTH_ACCOUNT_CHANGED');
    };
    // PKG-023d/i. The list and the map used to read every open task straight from the table, with the
    // description of each and no bound at all. They now read the server's allowlisted projection, ordered
    // by the server-owned published_at, in pages of two hundred. The page walk is a keyset, so nothing
    // repeats and nothing is hidden, and it keeps going until the server says there is no more: the
    // screen shows what it always showed, and the ceiling below is a refusal, never a silent truncation.
    const items: Record<string, unknown>[] = [], seen = new Set<string>();
    let cursor: { at: string; id: string; instant: bigint } | null = null;
    for (let page = 0; ; page++) {
      assertCurrent();
      if (page >= 25) throw new Error('OPPORTUNITIES_TOO_MANY_PAGES');
      const request = supabase.rpc('rpc_list_open_tasks_v3', {
        p_bbox: null, p_filters: {}, p_limit: 200, p_before_at: cursor?.at ?? null, p_before_id: cursor?.id ?? null,
      });
      const { data, error } = await (signal && typeof request.abortSignal === 'function' ? request.abortSignal(signal) : request);
      assertCurrent();
      if (error) {
        console.error('[RPC_LIST_OPEN_TASKS_V3_ERROR]', error.message, error.code, (error as any).details);
        throw error;
      }
      const result = record(data);
      if (!result || !Array.isArray(result.items) || result.items.length > 200 || typeof result.hasMore !== 'boolean'
        || calendarInstant(result.asOf) === null || (result.hasMore && result.items.length === 0)) {
        throw new Error('OPPORTUNITIES_RESPONSE_INVALID');
      }
      // Validate every key before treating the walk as complete. Missing pagination metadata cannot
      // turn a partial read into a successful list; repeated rows cannot inflate its map/list count.
      for (const raw of result.items) {
        const row = record(raw), instant = calendarInstant(row?.sortAt);
        if (!row || !uuid(row.id) || typeof row.sortAt !== 'string' || instant === null) {
          throw new Error('OPPORTUNITIES_RESPONSE_INVALID');
        }
        const id = row.id.toLowerCase();
        // PostgreSQL orders the published instant down to microseconds, then UUID bytes. Canonical
        // UUID strings have the same byte order; locale collation and Date's millisecond loss do not.
        if (seen.has(id) || (cursor && (instant > cursor.instant || (instant === cursor.instant && id >= cursor.id)))) {
          throw new Error('OPPORTUNITIES_RESPONSE_INVALID');
        }
        seen.add(id);
        items.push(row);
        cursor = { at: row.sortAt, id, instant };
      }
      if (!result.hasMore) break;
    }
    // The server already refuses a task whose remaining search is closed, so no client-side filter can
    // decide it any more; every row here is an open one.
    return projectOpenTasks(items, assertCurrent, signal);
  },

  async prilikeZaPocetnu(options) {
    const signal = options?.signal;
    const owner = sesijaSada(), accountId = owner.user?.id, revision = owner.accountRevision;
    if (!accountId) throw new Error('AUTH_REQUIRED');
    const assertCurrent = () => {
      if (signal?.aborted) throw new Error('HOME_OPPORTUNITIES_READ_ABORTED');
      const current = sesijaSada();
      if (current.user?.id !== accountId || current.accountRevision !== revision) throw new Error('AUTH_ACCOUNT_CHANGED');
    };
    assertCurrent();
    // One bounded preview through the same invoker/RLS public reader as discovery.
    // Ownership and application eligibility are filtered BEFORE the server limit.
    // An older server refuses this mode: do not fall back to walking the marketplace.
    const request = supabase.rpc('rpc_list_open_tasks_v3', {
      p_bbox: null, p_filters: { homePreview: true }, p_limit: 3, p_before_at: null, p_before_id: null,
    });
    let response;
    try { response = await (signal && typeof request.abortSignal === 'function' ? request.abortSignal(signal) : request); }
    catch (error) { assertCurrent(); throw error; }
    assertCurrent();
    const envelope = record(response);
    if (envelope?.error) throw envelope.error;
    const result = record(envelope?.data);
    const invalid = () => new Error('HOME_OPPORTUNITIES_RESPONSE_INVALID');
    if (!envelope || envelope.error !== null || !result || !Array.isArray(result.items) || result.items.length > 3
      || typeof result.hasMore !== 'boolean' || (result.hasMore && result.items.length !== 3)
      || calendarInstant(result.asOf) === null) throw invalid();
    const items: Record<string, unknown>[] = [], seen = new Set<string>();
    let previous: { instant: bigint; id: string } | null = null;
    for (const raw of result.items) {
      const row = record(raw), instant = calendarInstant(row?.sortAt);
      if (!row || !uuid(row.id) || instant === null || calendarInstant(row.publishedAt) !== instant
        || !positiveInteger(row.revision) || (row.status !== 'PUBLISHED' && row.status !== 'SELECTION')
        || typeof row.title !== 'string' || !row.title.trim() || typeof row.urgent !== 'boolean'
        || !positiveInteger(row.requiredSlots) || !Number.isSafeInteger(row.coveredSlots)
        || typeof row.coveredSlots !== 'number' || row.coveredSlots < 0 || row.coveredSlots >= row.requiredSlots
        || row.acceptsApplications !== true || !uuid(row.requesterProfileId)
        || (row.priceMode !== 'MY_PRICE' && row.priceMode !== 'OFFERS')) throw invalid();
      const id = row.id.toLowerCase(), pin = record(row.pin);
      if (seen.has(id) || (previous && (instant > previous.instant || (instant === previous.instant && id >= previous.id)))
        || (row.pin !== null && (!pin || pin.precision !== 'COARSE_1KM'
          || typeof pin.lat !== 'number' || !Number.isFinite(pin.lat) || Math.abs(pin.lat) > 90
          || typeof pin.lng !== 'number' || !Number.isFinite(pin.lng) || Math.abs(pin.lng) > 180))) throw invalid();
      // Decode before optional author/urgency IO; malformed rows are not empty state.
      publicTaskContext(openTaskRow(row));
      seen.add(id); previous = { instant, id }; items.push({ ...row, id });
    }
    const projected = await projectOpenTasks(items, assertCurrent, signal);
    assertCurrent();
    return projected.map(item => ({ ...item, primaNovePrijave: true }));
  },

  async otvorenaPrilika(id, options) {
    const signal = options?.signal;
    const owner = sesijaSada(), accountId = owner.user?.id, accountRevision = owner.accountRevision;
    if (!accountId) throw new Error('AUTH_REQUIRED');
    const assertCurrent = () => {
      if (signal?.aborted) throw new Error('EXACT_OPPORTUNITY_READ_ABORTED');
      const current = sesijaSada();
      if (current.user?.id !== accountId || current.accountRevision !== accountRevision) throw new Error('AUTH_ACCOUNT_CHANGED');
    };
    assertCurrent();
    if (!uuid(id)) throw new Error('EXACT_OPPORTUNITY_ID_INVALID');
    const request = supabase.rpc('rpc_list_open_tasks_v3', {
      p_bbox: null, p_filters: { needId: id.toLowerCase() }, p_limit: 1, p_before_at: null, p_before_id: null,
    });
    let response;
    try { response = await (signal && typeof request.abortSignal === 'function' ? request.abortSignal(signal) : request); }
    catch (error) { assertCurrent(); throw error; }
    assertCurrent();
    // An older server refuses needId. Propagate that refusal; neither a list walk nor
    // an owner/private task reader can substitute for this exact public read.
    const envelope = record(response);
    if (envelope?.error) throw envelope.error;
    if (!envelope || envelope.error !== null) throw new Error('EXACT_OPPORTUNITY_RESPONSE_INVALID');
    const result = record(envelope.data);
    if (!result || !Array.isArray(result.items) || result.items.length > 1 || result.hasMore !== false
      || typeof result.asOf !== 'string' || calendarInstant(result.asOf) === null) {
      throw new Error('EXACT_OPPORTUNITY_RESPONSE_INVALID');
    }
    if (result.items.length === 0) return { item: null, asOf: result.asOf };
    const row = record(result.items[0]);
    if (!row || !sameId(row.id, id) || !positiveInteger(row.revision)
      || calendarInstant(row.sortAt) === null || calendarInstant(row.publishedAt) === null
      || (row.status !== 'PUBLISHED' && row.status !== 'SELECTION') || typeof row.title !== 'string' || !row.title.trim()
      || typeof row.urgent !== 'boolean' || !positiveInteger(row.requiredSlots)
      || typeof row.coveredSlots !== 'number' || !Number.isSafeInteger(row.coveredSlots) || row.coveredSlots < 0
      || (row.priceMode !== 'MY_PRICE' && row.priceMode !== 'OFFERS') || !uuid(row.requesterProfileId)) {
      throw new Error('EXACT_OPPORTUNITY_RESPONSE_INVALID');
    }
    const pin = record(row.pin);
    if (row.pin !== null && (!pin || pin.precision !== 'COARSE_1KM'
      || typeof pin.lat !== 'number' || !Number.isFinite(pin.lat) || Math.abs(pin.lat) > 90
      || typeof pin.lng !== 'number' || !Number.isFinite(pin.lng) || Math.abs(pin.lng) > 180)) {
      throw new Error('EXACT_OPPORTUNITY_RESPONSE_INVALID');
    }
    // Reuse the existing strict schedule/capability/location decoder before optional IO.
    // No legacy defaults can turn a malformed exact row into publication evidence.
    publicTaskContext(openTaskRow(row));
    const [item] = await projectOpenTasks([{ ...row, id: row.id.toLowerCase() }], assertCurrent, signal);
    assertCurrent();
    return { item: { ...item, revision: row.revision }, asOf: result.asOf };
  },

  /**
   * PKG-023b. One bounded call per page of tasks instead of my whole task list and my whole
   * application list for one label. The server answers only for the ids asked and says nothing
   * about any other task; a failure throws, so the caller shows no labels rather than wrong ones.
   */
  async odnosiPremaZadacima(idovi: readonly string[], options) {
    const signal = options?.signal;
    const owner = sesijaSada(), accountId = owner.user?.id, accountRevision = owner.accountRevision;
    if (!accountId) throw new Error('AUTH_REQUIRED');
    const assertCurrent = () => {
      if (signal?.aborted) throw new Error('TASK_RELATIONS_READ_ABORTED');
      const current = sesijaSada();
      if (current.user?.id !== accountId || current.accountRevision !== accountRevision) throw new Error('AUTH_ACCOUNT_CHANGED');
    };
    assertCurrent();
    const asked = [...new Set(idovi.filter((id): id is string => typeof id === 'string' && id.length > 0))];
    if (asked.length === 0) return noTaskRelations;
    const items: unknown[] = [];
    // The server refuses more than a hundred in one call; a screen that shows more asks again.
    for (let from = 0; from < asked.length; from += 100) {
      assertCurrent();
      const request = supabase.rpc('rpc_get_my_task_relations', { p_need_ids: asked.slice(from, from + 100) });
      const { data, error } = await (signal && typeof request.abortSignal === 'function' ? request.abortSignal(signal) : request);
      assertCurrent();
      if (error) throw new Error('TASK_RELATIONS_READ_FAILED');
      const page = (data as { items?: unknown } | null)?.items;
      if (!Array.isArray(page)) throw new Error('TASK_RELATIONS_INVALID_PROJECTION');
      items.push(...page);
    }
    assertCurrent();
    return taskRelationIndex(items, asked);
  },

  async prilika(id: string) {
    const { data, error } = await supabase.rpc('rpc_read_task', { p_need_id: id });

    if (error) throw error;
    if (!data) return null;

    // Missing/malformed capacity is an invalid read, never implicit free space.
    if (!Number.isSafeInteger(data.required_slots) || data.required_slots <= 0
      || !Number.isSafeInteger(data.covered_slots) || data.covered_slots < 0) {
      throw new Error('TASK_CAPACITY_INVALID');
    }
    const rok = data.response_deadline;
    if (rok !== null && !validPublicInstant(rok)) throw new Error('TASK_DEADLINE_INVALID');
    const remainingClosedAt = data.remaining_search_closed_at;
    if (remainingClosedAt !== null && !validPublicInstant(remainingClosedAt)) throw new Error('TASK_REMAINING_SEARCH_STATE_INVALID');
    const remainingClosed = remainingClosedAt !== null;

    const [profiles, urgency] = await Promise.all([safePublicProfiles([data.requester_profile_id]), readNeedUrgencies([data])]);
    const narucilac = profiles.get(data.requester_profile_id) ?? null;

    return {
      id: data.id,
      revision: Number.isSafeInteger(data.revision) && data.revision > 0 ? data.revision : undefined,
      urgency: urgency.get(data.id),
      naslov: data.title,
      statusTekst: !remainingClosed && ['PUBLISHED', 'SELECTION'].includes(data.status) ? 'Traži ponude' : 'Prijave zatvorene',
      primaNovePrijave: !remainingClosed && ['PUBLISHED', 'SELECTION'].includes(data.status)
        && data.required_slots > data.covered_slots && (rok === null || Date.parse(rok) > Date.now()),
      rokZaPrijaveIso: rok,
      ...publicTaskContext(data),
      pokrivenost: pokrivenost(data.required_slots, data.covered_slots),
      uslovi: [...(data.required_skills || []), ...(data.required_tools || []), ...(data.required_vehicles || [])],
      narucilacProfilId: data.requester_profile_id,
      narucilacAvatarId: narucilac?.avatarPutanja ? mediaAssetId(narucilac.avatarPutanja) : null,
      narucilacIme: narucilac?.ime || '',
      narucilacOcena: formatPublicRating(narucilac),
      narucilacBrojOcena: publicReviewCount(narucilac),
      rezimCene: data.mode as any,
      osnovaCene: data.price_basis === 'TOTAL' || data.price_basis === 'PER_PERSON' || data.price_basis === 'HOURLY' ? data.price_basis : null,
      ponudjenaCena: data.requester_price_rsd ? rsd(data.requester_price_rsd) : undefined,
    };
  },

  async poruke(dogovorId: string, expectedAccountId?: string) {
    const uuid = (value: unknown): value is string => typeof value === 'string' && value.length === 36
      && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
    if (!uuid(dogovorId) || (expectedAccountId !== undefined && !uuid(expectedAccountId))) {
      throw new Error('MESSAGE_SCOPE_INVALID');
    }
    const { data: user, error: authError } = await supabase.auth.getUser();
    const accountId = user?.user?.id;
    if (authError || !accountId || (expectedAccountId && expectedAccountId !== accountId)) {
      throw new Error('MESSAGE_AUTH_CONTEXT_CHANGED');
    }
    const { data, error } = await supabase.from('agreement_messages')
      .select(`id, agreement_version, sender_account_id, client_message_id, body, created_at`)
      .eq('agreement_id', dogovorId)
      .order('created_at', { ascending: true })
      .order('id', { ascending: true });

    if (error || !Array.isArray(data)) throw new Error('MESSAGE_READ_FAILED');
    const { data: current, error: currentError } = await supabase.auth.getUser();
    if (currentError || current?.user?.id !== accountId) throw new Error('MESSAGE_AUTH_CONTEXT_CHANGED');

    return data.map((r: any) => {
      if (!uuid(r?.id) || !positiveInteger(r?.agreement_version) || !uuid(r?.sender_account_id) || typeof r.body !== 'string'
        || typeof r.created_at !== 'string' || !Number.isFinite(Date.parse(r.created_at))
        || !(r.client_message_id === null || (typeof r.client_message_id === 'string'
          && /^[A-Za-z0-9][A-Za-z0-9_.:-]{7,199}$/.test(r.client_message_id) && !/\s/.test(r.client_message_id)))) {
        throw new Error('MESSAGE_PROJECTION_INVALID');
      }
      return {
        id: r.id,
        dogovorVerzija: r.agreement_version,
        clientMessageId: r.client_message_id,
        posiljalacAccountId: r.sender_account_id,
        posiljalacIme: r.sender_account_id === accountId ? 'Ja' : 'Sagovornik',
        moja: r.sender_account_id === accountId,
        telo: r.body,
        vremeTekst: vremePoruke(r.created_at),
        procitano: null,
      };
    });
  },

  async oznaciPorukeProcitanim(dogovorId: string) {
    // PKG-050. The conversation itself is what a person reads, so showing it settles the "Nova poruka" events
    // about this Dogovor — this one only, never a sweep. The caller treats a throw as "not settled" and moves on.
    const { data, error } = await supabase.rpc('rpc_mark_agreement_messages_read', { p_agreement_id: dogovorId });
    if (error || !Number.isSafeInteger(data) || Number(data) < 0) throw new Error('MESSAGES_READ_UNCONFIRMED');
    return Number(data);
  },

  async otkaziDogovor(dogovorId: string, razlog: string) {
    const { error } = await supabase.rpc('rpc_cancel_agreement', { p_agreement_id: dogovorId, p_reason: razlog });
    if (error) return handleRpcError(error, 'RPC_ERROR', 'Greška.');
    return { ok: true, podatak: null };
  },

  async mojRadnikProfil() {
    const owner = sesijaSada();
    if (!owner.user) throw new Error('WORKER_PROFILE_AUTH_REQUIRED');
    const account = { accountId: owner.user.id, accountRevision: owner.accountRevision };
    const options = { account, errors: {}, fallback: 'WORKER_PROFILE_READ_FAILED', invalid: 'WORKER_PROFILE_INVALID' };
    const auth = await readOwnedResult({ ...options, request: () => supabase.auth.getUser(),
      decode: raw => sameId(record(record(raw)?.user)?.id, account.accountId) ? true : null });
    if (!auth.ok) throw new Error('WORKER_PROFILE_READ_FAILED');
    const result = await readOwnedResult({ ...options, request: () => supabase.rpc('rpc_get_worker_profile_for_edit', {}),
      decode: raw => {
        if (raw === null) return { profile: null };
        const data = record(raw);
        const workAreas=data&&Object.hasOwn(data,'work_areas')?decodeWorkerAreas(data.work_areas):undefined;
        if(workAreas===null)return null;
        if (!data || !uuid(data.id) || !workerCapacityValue(data.team_capacity) || !workerCapacityRevision(data.capacity_revision) || !sameId(data.account_id, account.accountId) || data.kind !== 'WORKER' ||
          !['DRAFT', 'ACTIVE', 'SUSPENDED'].includes(String(data.profile_status)) || typeof data.available_now !== 'boolean' ||
          typeof data.radius_km !== 'number' || !Number.isInteger(data.radius_km) || data.radius_km < 1 || data.radius_km > 200 ||
          !['display_name', 'city', 'bio'].every(key => data[key] === null || typeof data[key] === 'string') ||
          !['skills', 'tools', 'vehicles', 'licenses'].every(key => Array.isArray(data[key]) && data[key].every((item: unknown) => typeof item === 'string'))) return null;
        return { profile: { ...(workAreas?{workAreas}:{}),id: data.id, ime: data.display_name as string ?? '', grad: data.city as string ?? '',
          biografija: data.bio as string ?? '', vestine: data.skills as string[], alati: data.tools as string[], vozila: data.vehicles as string[], licence: data.licenses as string[],
          stanje: data.profile_status as 'DRAFT' | 'ACTIVE' | 'SUSPENDED', dostupanOdmah: data.available_now, radijusKm: data.radius_km,
          kapacitetTima: data.team_capacity as number, capacityRevision: data.capacity_revision as string } };
      },
    });
    if (!result.ok) throw new Error('WORKER_PROFILE_READ_FAILED');
    return result.podatak.profile;
  },

};
