import { normalizeTaskGeography } from '../lib/location';
import { countryCode, timeZone } from '../lib/market';

export const DISCOVERY_V1 = 'DISCOVERY_V1' as const;
export type DiscoveryV1Price = 'all' | 'MY_PRICE' | 'OFFERS';
export type DiscoveryV1Where = 'any' | 'onsite' | 'remote';
export type DiscoveryV1When = 'any' | 'today' | 'tomorrow' | 'week' | 'weekend' | 'next7';
export type DiscoveryV1Filter = {
  text: string; price: DiscoveryV1Price; where: DiscoveryV1Where; places: number; when: DiscoveryV1When;
  dates: null | { from: string; to: string }; place: string | null;
  /** Minimal stated fixed price in RSD. With all, OFFERS remain eligible; OFFERS-only rejects it. No basis conversion. */
  minBudgetRsd?: number;
  /**
   * "Za mene": an OPTIONAL key (DISCOVERY-ZAMENE, applied to DEV 2026-10-07). It is present only when true: left out, the request, its `filterKey`, its
   * anchors and its cursors are exactly those of the reader without it. A change of it is a new traversal (a new anchor, never an old one reused).
   */
  forMe?: true;
};
/** Same bound as needs.requester_price_rsd (PostgreSQL integer). Empty UI state omits the wire key. */
export function discoveryV1MinBudgetRsd(value: unknown): number | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 1 || value > 2_147_483_647)
    throw new Error('DISCOVERY_V1_MIN_BUDGET_INVALID');
  return value;
}
export type DiscoveryV1Anchor = {
  version: typeof DISCOVERY_V1; filterKey: string; timeAt: string; publishedThrough: string; expiresAt: string;
};
export type DiscoveryV1Cursor = { scopeKey: string; section: 0 | 1; sortAt: string; id: string };
export type DiscoveryV1Pin = { lat: number; lng: number; precision: 'COARSE_1KM' };
export type DiscoveryV1Item = {
  id: string; revision: number; sortAt: string; publishedAt: string; title: string; category: string;
  status: 'PUBLISHED' | 'SELECTION'; urgent: boolean; scheduleKind: string; startsAt: string | null; endsAt: string | null;
  executionLocationMode: string | null; taskCountryCode: string | null; taskTimezone: string | null;
  verifiedIdentityRequired: boolean; approximateCity: string | null; approximateArea: string | null; pin: DiscoveryV1Pin | null;
  requiredSlots: number; coveredSlots: number; requiredSkills: string[]; requiredTools: string[]; requiredVehicles: string[];
  requiredLicenses: string[]; minimumExperienceYears: number | null; priceMode: 'MY_PRICE' | 'OFFERS';
  requesterPriceRsd: number | null; priceBasis: 'TOTAL' | 'PER_PERSON' | 'HOURLY' | null; requesterProfileId: string;
  responseDeadline: string | null; acceptsApplications: boolean; publicTopology: Record<string, unknown> | null;
  criticalConditions: string[] | null;
};
export type DiscoveryV1Counts = {
  kind: 'exact_live'; observedAt: string; mapped: number; listed: number; inArea: number; withoutPoint: number; undated: number;
};
export type DiscoveryV1Availability = {
  hasKnownWorkMode: boolean; hasKnownSchedule: boolean; priceModes: Array<'MY_PRICE' | 'OFFERS'>;
};
export type DiscoveryV1PageResponse = {
  version: typeof DISCOVERY_V1; mode: 'PAGE'; asOf: string; filterKey: string; anchor: DiscoveryV1Anchor;
  items: DiscoveryV1Item[]; hasMore: boolean; nextCursor: DiscoveryV1Cursor | null;
  counts: DiscoveryV1Counts; availability: DiscoveryV1Availability;
};
export type DiscoveryV1ExactResponse = {
  version: typeof DISCOVERY_V1; mode: 'EXACT_PUBLIC'; asOf: string; items: DiscoveryV1Item[];
  hasMore: false; nextCursor: null;
};

const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const md5Re = /^[0-9a-f]{32}$/;
const instantRe = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/;
const scheduleKinds = new Set(['FIXED_WINDOW','FLEXIBLE','REMOTE_ANYTIME','TODAY_FLEXIBLE','TOMORROW_FLEXIBLE','WEEK_FLEXIBLE']);
const locationModes = new Set(['STATIONARY','POINT_TO_POINT','MULTI_STOP','AREA_BASED','REMOTE']);
const priceModes = new Set(['MY_PRICE','OFFERS']);

type Obj = Record<string, unknown>;
const invalid = (code: string): never => { throw new Error(code); };
const object = (value: unknown): Obj => value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Obj : invalid('DISCOVERY_V1_OBJECT_INVALID');
const exact = (value: Obj, keys: readonly string[], code = 'DISCOVERY_V1_SHAPE_INVALID') => {
  const actual = Object.keys(value).sort(), expected = [...keys].sort();
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) invalid(code);
};
const text = (value: unknown, code: string, max = 16_000) => typeof value === 'string' && value.length <= max ? value : invalid(code);
const nullableText = (value: unknown, code: string, max = 16_000) => value === null ? null : text(value, code, max);
const bool = (value: unknown, code: string) => typeof value === 'boolean' ? value : invalid(code);
const finiteNumber = (value: unknown, code: string): number =>
  typeof value === 'number' && Number.isFinite(value) ? value : invalid(code);
const integer = (value: unknown, code: string, min = 0) =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= min ? value : invalid(code);
const instant = (value: unknown, code: string) => {
  const result = text(value, code, 64);
  return instantRe.test(result) && Number.isFinite(Date.parse(result)) ? result : invalid(code);
};
const nullableInstant = (value: unknown, code: string) => value === null ? null : instant(value, code);
const uuid = (value: unknown, code: string) => {
  const result = text(value, code, 36).toLowerCase();
  return uuidRe.test(result) ? result : invalid(code);
};
const strings = (value: unknown, code: string): string[] => {
  const array: unknown[] = Array.isArray(value) ? value : invalid(code);
  if (array.length > 100) invalid(code);
  return array.map((item: unknown) => typeof item === 'string' && item.length > 0 && item.length <= 160 ? item : invalid(code));
};
const nullableStrings = (value: unknown, code: string) => value === null ? null : strings(value, code);
const coarse = (value: number) => Math.round(value * 100) / 100 === value;

function decodePin(value: unknown): DiscoveryV1Pin | null {
  if (value === null) return null;
  const row = object(value); exact(row, ['lat','lng','precision'], 'DISCOVERY_V1_PIN_SHAPE');
  const lat = finiteNumber(row.lat, 'DISCOVERY_V1_PIN_INVALID');
  const lng = finiteNumber(row.lng, 'DISCOVERY_V1_PIN_INVALID');
  if (row.precision !== 'COARSE_1KM' || Math.abs(lat) > 90 || Math.abs(lng) > 180
    || !coarse(lat) || !coarse(lng)) invalid('DISCOVERY_V1_PIN_INVALID');
  return { lat, lng, precision: 'COARSE_1KM' };
}

function decodeItem(value: unknown, asOf: string): DiscoveryV1Item {
  const row = object(value);
  exact(row, ['id','revision','sortAt','publishedAt','title','category','status','urgent','scheduleKind','startsAt','endsAt',
    'executionLocationMode','taskCountryCode','taskTimezone','verifiedIdentityRequired','approximateCity','approximateArea','pin',
    'requiredSlots','coveredSlots','requiredSkills','requiredTools','requiredVehicles','requiredLicenses','minimumExperienceYears',
    'priceMode','requesterPriceRsd','priceBasis','requesterProfileId','responseDeadline','acceptsApplications','publicTopology','criticalConditions'],
    'DISCOVERY_V1_ITEM_SHAPE');

  const id = uuid(row.id, 'DISCOVERY_V1_ITEM_ID');
  const revision = integer(row.revision, 'DISCOVERY_V1_ITEM_REVISION');
  const sortAt = instant(row.sortAt, 'DISCOVERY_V1_ITEM_SORT');
  const publishedAt = instant(row.publishedAt, 'DISCOVERY_V1_ITEM_PUBLISHED');
  if (Date.parse(sortAt) !== Date.parse(publishedAt)) invalid('DISCOVERY_V1_ITEM_SORT_MISMATCH');
  const title = text(row.title, 'DISCOVERY_V1_ITEM_TITLE', 500);
  const category = text(row.category, 'DISCOVERY_V1_ITEM_CATEGORY', 120);
  if (!title.trim() || !category.trim()) invalid('DISCOVERY_V1_ITEM_TEXT_EMPTY');
  if (row.status !== 'PUBLISHED' && row.status !== 'SELECTION') invalid('DISCOVERY_V1_ITEM_STATUS');
  const urgent = bool(row.urgent, 'DISCOVERY_V1_ITEM_URGENT');
  const scheduleKind = text(row.scheduleKind, 'DISCOVERY_V1_ITEM_SCHEDULE', 32);
  if (!scheduleKinds.has(scheduleKind)) invalid('DISCOVERY_V1_ITEM_SCHEDULE');
  const startsAt = nullableInstant(row.startsAt, 'DISCOVERY_V1_ITEM_START');
  const endsAt = nullableInstant(row.endsAt, 'DISCOVERY_V1_ITEM_END');
  if (startsAt && endsAt && Date.parse(startsAt) >= Date.parse(endsAt)) invalid('DISCOVERY_V1_ITEM_INTERVAL');
  const executionLocationMode = nullableText(row.executionLocationMode, 'DISCOVERY_V1_ITEM_LOCATION_MODE', 32);
  if (executionLocationMode !== null && !locationModes.has(executionLocationMode)) invalid('DISCOVERY_V1_ITEM_LOCATION_MODE');
  const taskCountryCode = row.taskCountryCode === null ? null : countryCode(row.taskCountryCode);
  if (row.taskCountryCode !== null && taskCountryCode !== row.taskCountryCode) invalid('DISCOVERY_V1_ITEM_COUNTRY');
  const taskTimezone = row.taskTimezone === null ? null : timeZone(row.taskTimezone);
  if (row.taskTimezone !== null && taskTimezone !== row.taskTimezone) invalid('DISCOVERY_V1_ITEM_TIMEZONE');
  const verifiedIdentityRequired = bool(row.verifiedIdentityRequired, 'DISCOVERY_V1_ITEM_IDENTITY');
  const approximateCity = nullableText(row.approximateCity, 'DISCOVERY_V1_ITEM_CITY', 500);
  const approximateArea = nullableText(row.approximateArea, 'DISCOVERY_V1_ITEM_AREA', 500);
  const pin = decodePin(row.pin);
  if (executionLocationMode === 'REMOTE' && pin !== null) invalid('DISCOVERY_V1_REMOTE_PIN');
  const requiredSlots = integer(row.requiredSlots, 'DISCOVERY_V1_ITEM_REQUIRED_SLOTS', 1);
  const coveredSlots = integer(row.coveredSlots, 'DISCOVERY_V1_ITEM_COVERED_SLOTS');
  if (coveredSlots > requiredSlots) invalid('DISCOVERY_V1_ITEM_COVERAGE');
  const requiredSkills = strings(row.requiredSkills, 'DISCOVERY_V1_ITEM_SKILLS');
  const requiredTools = strings(row.requiredTools, 'DISCOVERY_V1_ITEM_TOOLS');
  const requiredVehicles = strings(row.requiredVehicles, 'DISCOVERY_V1_ITEM_VEHICLES');
  const requiredLicenses = strings(row.requiredLicenses, 'DISCOVERY_V1_ITEM_LICENSES');
  const minimumExperienceYears = row.minimumExperienceYears === null ? null
    : integer(row.minimumExperienceYears, 'DISCOVERY_V1_ITEM_EXPERIENCE');
  if (!priceModes.has(row.priceMode as string)) invalid('DISCOVERY_V1_ITEM_PRICE_MODE');
  const priceMode = row.priceMode as 'MY_PRICE' | 'OFFERS';
  const requesterPriceRsd = row.requesterPriceRsd === null ? null : integer(row.requesterPriceRsd, 'DISCOVERY_V1_ITEM_PRICE');
  if ((priceMode === 'MY_PRICE') !== (requesterPriceRsd !== null)) invalid('DISCOVERY_V1_ITEM_PRICE_CONTRACT');
  if (row.priceBasis !== null && row.priceBasis !== 'TOTAL' && row.priceBasis !== 'PER_PERSON' && row.priceBasis !== 'HOURLY') invalid('DISCOVERY_V1_ITEM_PRICE_BASIS');
  const priceBasis = row.priceBasis as 'TOTAL' | 'PER_PERSON' | 'HOURLY' | null;
  const requesterProfileId = uuid(row.requesterProfileId, 'DISCOVERY_V1_ITEM_PROFILE');
  const responseDeadline = nullableInstant(row.responseDeadline, 'DISCOVERY_V1_ITEM_DEADLINE');
  const acceptsApplications = bool(row.acceptsApplications, 'DISCOVERY_V1_ITEM_ACCEPTS');
  const expectedAccepts = coveredSlots < requiredSlots && (responseDeadline === null || Date.parse(responseDeadline) > Date.parse(asOf));
  if (acceptsApplications !== expectedAccepts) invalid('DISCOVERY_V1_ITEM_ACCEPTS_MISMATCH');
  let publicTopology: Record<string, unknown> | null = null;
  if (row.publicTopology !== null) {
    publicTopology = object(row.publicTopology);
    const normalized = normalizeTaskGeography(publicTopology);
    if (!normalized || normalized.mode !== executionLocationMode) invalid('DISCOVERY_V1_ITEM_TOPOLOGY');
  }
  const criticalConditions = nullableStrings(row.criticalConditions, 'DISCOVERY_V1_ITEM_CONDITIONS');
  return { id, revision, sortAt, publishedAt, title, category, status: row.status as 'PUBLISHED'|'SELECTION', urgent, scheduleKind,
    startsAt, endsAt, executionLocationMode, taskCountryCode, taskTimezone, verifiedIdentityRequired, approximateCity,
    approximateArea, pin, requiredSlots, coveredSlots, requiredSkills, requiredTools, requiredVehicles, requiredLicenses,
    minimumExperienceYears, priceMode, requesterPriceRsd, priceBasis, requesterProfileId, responseDeadline, acceptsApplications,
    publicTopology, criticalConditions };
}

function decodeItems(value: unknown, asOf: string, limit: number): DiscoveryV1Item[] {
  const array: unknown[] = Array.isArray(value) ? value : invalid('DISCOVERY_V1_ITEMS_INVALID');
  if (array.length > limit) invalid('DISCOVERY_V1_ITEMS_INVALID');
  const items = array.map((item: unknown) => decodeItem(item, asOf));
  if (new Set(items.map((item: DiscoveryV1Item) => item.id)).size !== items.length) invalid('DISCOVERY_V1_ITEMS_DUPLICATE');
  return items;
}

function decodeCursor(value: unknown): DiscoveryV1Cursor | null {
  if (value === null) return null;
  const row = object(value); exact(row, ['scopeKey','section','sortAt','id'], 'DISCOVERY_V1_CURSOR_SHAPE');
  const scopeKey = text(row.scopeKey, 'DISCOVERY_V1_CURSOR_SCOPE', 64);
  if (!md5Re.test(scopeKey) || (row.section !== 0 && row.section !== 1)) invalid('DISCOVERY_V1_CURSOR_INVALID');
  const section = row.section as 0 | 1;
  return { scopeKey, section, sortAt: instant(row.sortAt, 'DISCOVERY_V1_CURSOR_SORT'),
    id: uuid(row.id, 'DISCOVERY_V1_CURSOR_ID') };
}

function decodeAnchor(value: unknown, filterKey: string): DiscoveryV1Anchor {
  const row = object(value); exact(row, ['version','filterKey','timeAt','publishedThrough','expiresAt'], 'DISCOVERY_V1_ANCHOR_SHAPE');
  if (row.version !== DISCOVERY_V1 || row.filterKey !== filterKey) invalid('DISCOVERY_V1_ANCHOR_BINDING');
  const timeAt = instant(row.timeAt, 'DISCOVERY_V1_ANCHOR_TIME');
  const publishedThrough = instant(row.publishedThrough, 'DISCOVERY_V1_ANCHOR_THROUGH');
  const expiresAt = instant(row.expiresAt, 'DISCOVERY_V1_ANCHOR_EXPIRY');
  if (Date.parse(timeAt) !== Date.parse(publishedThrough) || Date.parse(expiresAt) - Date.parse(timeAt) !== 30 * 60_000)
    invalid('DISCOVERY_V1_ANCHOR_WINDOW');
  return { version: DISCOVERY_V1, filterKey, timeAt, publishedThrough, expiresAt };
}

function decodeCounts(value: unknown): DiscoveryV1Counts {
  const row = object(value); exact(row, ['kind','observedAt','mapped','listed','inArea','withoutPoint','undated'], 'DISCOVERY_V1_COUNTS_SHAPE');
  if (row.kind !== 'exact_live') invalid('DISCOVERY_V1_COUNTS_KIND');
  const mapped = integer(row.mapped, 'DISCOVERY_V1_COUNTS_VALUE'), listed = integer(row.listed, 'DISCOVERY_V1_COUNTS_VALUE');
  const inArea = integer(row.inArea, 'DISCOVERY_V1_COUNTS_VALUE'), withoutPoint = integer(row.withoutPoint, 'DISCOVERY_V1_COUNTS_VALUE');
  const undated = integer(row.undated, 'DISCOVERY_V1_COUNTS_VALUE');
  if (inArea > listed || withoutPoint > listed || undated > mapped) invalid('DISCOVERY_V1_COUNTS_RELATION');
  return { kind: 'exact_live', observedAt: instant(row.observedAt, 'DISCOVERY_V1_COUNTS_TIME'), mapped, listed, inArea, withoutPoint, undated };
}

function decodeAvailability(value: unknown): DiscoveryV1Availability {
  const row = object(value); exact(row, ['hasKnownWorkMode','hasKnownSchedule','priceModes'], 'DISCOVERY_V1_AVAILABILITY_SHAPE');
  const rawModes: unknown[] = Array.isArray(row.priceModes) ? row.priceModes : invalid('DISCOVERY_V1_AVAILABILITY_PRICE');
  const modes: Array<'MY_PRICE' | 'OFFERS'> = rawModes.map((mode: unknown) => {
    if (mode !== 'MY_PRICE' && mode !== 'OFFERS') invalid('DISCOVERY_V1_AVAILABILITY_PRICE');
    return mode as 'MY_PRICE' | 'OFFERS';
  });
  if (new Set(modes).size !== modes.length) invalid('DISCOVERY_V1_AVAILABILITY_PRICE');
  return { hasKnownWorkMode: bool(row.hasKnownWorkMode, 'DISCOVERY_V1_AVAILABILITY_MODE'),
    hasKnownSchedule: bool(row.hasKnownSchedule, 'DISCOVERY_V1_AVAILABILITY_SCHEDULE'), priceModes: modes };
}

/**
 * Decoder only. It is deliberately not imported by the production Supabase source yet: PAGE cannot replace today's
 * complete collection until MAP/PLACES, authenticated runtime proof and the client paging owner are finished.
 */
export function decodeDiscoveryV1Page(value: unknown, expectedLimit = 100): DiscoveryV1PageResponse {
  if (!Number.isSafeInteger(expectedLimit) || expectedLimit < 1 || expectedLimit > 100) invalid('DISCOVERY_V1_LIMIT');
  const row = object(value);
  exact(row, ['version','mode','asOf','filterKey','anchor','items','hasMore','nextCursor','counts','availability']);
  if (row.version !== DISCOVERY_V1 || row.mode !== 'PAGE') invalid('DISCOVERY_V1_MODE');
  const asOf = instant(row.asOf, 'DISCOVERY_V1_ASOF');
  const filterKey = text(row.filterKey, 'DISCOVERY_V1_FILTER_KEY', 32);
  if (!md5Re.test(filterKey)) invalid('DISCOVERY_V1_FILTER_KEY');
  const anchor = decodeAnchor(row.anchor, filterKey);
  const items = decodeItems(row.items, asOf, expectedLimit);
  const hasMore = bool(row.hasMore, 'DISCOVERY_V1_HAS_MORE');
  const nextCursor = decodeCursor(row.nextCursor);
  if (hasMore !== (nextCursor !== null)) invalid('DISCOVERY_V1_CURSOR_PRESENCE');
  const counts = decodeCounts(row.counts);
  if (items.length > counts.listed) invalid('DISCOVERY_V1_COUNT_UNDERFLOW');
  return { version: DISCOVERY_V1, mode: 'PAGE', asOf, filterKey, anchor, items, hasMore, nextCursor, counts,
    availability: decodeAvailability(row.availability) };
}

export function decodeDiscoveryV1Exact(value: unknown, expectedNeedId?: string): DiscoveryV1ExactResponse {
  const row = object(value); exact(row, ['version','mode','asOf','items','hasMore','nextCursor']);
  if (row.version !== DISCOVERY_V1 || row.mode !== 'EXACT_PUBLIC' || row.hasMore !== false || row.nextCursor !== null)
    invalid('DISCOVERY_V1_EXACT_SHAPE');
  const asOf = instant(row.asOf, 'DISCOVERY_V1_ASOF');
  const items = decodeItems(row.items, asOf, 1);
  if (expectedNeedId !== undefined) {
    const expected = uuid(expectedNeedId, 'DISCOVERY_V1_EXPECTED_ID');
    if (items[0] && items[0].id !== expected) invalid('DISCOVERY_V1_EXACT_ID_MISMATCH');
  }
  return { version: DISCOVERY_V1, mode: 'EXACT_PUBLIC', asOf, items, hasMore: false, nextCursor: null };
}
