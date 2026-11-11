import type { PotrebaProjekcija, PrilikaProjekcija } from '../contracts/projections';
import { calendarInstant } from '../lib/calendarTime';
import { podrucjeTekst } from '../lib/location';
import { shiftDate, zonedParts } from '../ui/calendar/calendarPresentation';
export type MarketplaceItem = PotrebaProjekcija | PrilikaProjekcija;
export type PublicBounds = [west: number, south: number, east: number, north: number];
export type PublicViewport = { center: [number, number]; zoom: number; bounds: PublicBounds };
/**
 * Kada: the day the work can be done, read from the task's own schedule in the task's own zone. "Ovaj vikend" is the
 * coming Saturday and Sunday (the rest of it on a weekend day); "Narednih 7 dana" is today and the six days after it.
 */
export type WhenFilter = 'any' | 'today' | 'tomorrow' | 'week' | 'weekend' | 'next7';
/** Kada by dates: an inclusive range of civil days ("2026-09-26" to "2026-09-28"), chosen on the month grid. */
export type DateRange = { from: string; to: string };
/** Gde se radi: on the spot or remotely, from the task's own location mode. */
export type WhereFilter = 'any' | 'onsite' | 'remote';
/** Koliko vas dolazi: at least this many places still open. 1 is every open task (Discovery V47: it was 'any' | 'two'). */
export type PlacesFilter = number;
/** The most people "Koliko vas dolazi" counts up to. */
export const PLACES_MAX = 10;
/** Where the Zadaci list sheet rests: its top line only, half the map, or the whole list under the tools. */
export type DiscoverySnap = 'peek' | 'half' | 'full';
export type MarketplaceView = { query: string; section: 'active' | 'drafts' | 'history' | 'all'; attention: boolean;
  price: 'all' | 'MY_PRICE' | 'OFFERS'; mode: 'list' | 'map'; area: PublicBounds | null; viewport: PublicViewport | null; selectedId: string | null;
  /** P6 only: minimal stated fixed price, not a derived total or guaranteed income. With all, OFFERS remain eligible.
   * Null/absent means no minimum; OFFERS-only has no threshold.
   * Expose only after server capability verification; legacy loaded-page filtering does not implement this field. */
  minBudgetRsd?: number | null;
  /** Zadaci filters (2026-09-24). Absent means 'any': a view written before them filters exactly as it did. */
  when?: WhenFilter; where?: WhereFilter; places?: PlacesFilter;
  /**
   * Gde (Discovery V47): one public area text of the loaded tasks (`podrucjeTekst`), exactly as the read wrote it; null
   * is anywhere. Only a place some loaded task names can be chosen, never a typed or geocoded one.
   */
  place?: string | null;
  /** Kada by dates (Discovery V47). While it is set, `when` is 'any': the two are one choice. */
  dates?: DateRange | null;
  /**
   * "Za mene" (R28, DISCOVERY-ZAMENE): the server narrows the list, the map and their counts to the tasks that fit this person's work profile (the kind
   * of work, the area and the time: the rule of the notifications). Absent or false is every task, exactly as before. It is a scope and not a filter:
   * it is not counted by `discoveryConditions` and "Obriši sve" does not take it away. Only the P6 server reader understands it.
   */
  forMe?: boolean;
  /** A chosen place on the map where several tasks share one public point (its `pointKey`); null when none. */
  selectedPlace?: string | null;
  /**
   * Zadaci only: the list shows the tasks on one public point (its `pointKey`) first, from a place's
   * "Prikaži sve u listi". It is not an area: tasks without a public point follow in their own section.
   * The next move of the map the person makes takes it away, as does the search pill's "Prikaži sve zadatke".
   */
  pinPlace?: string | null;
  /**
   * Zadaci only, in memory (Discovery V47): where the list sheet rests and how far its list is scrolled, kept with the
   * camera (`viewport`) in the route's view so a return to the tab finds all three where they were.
   */
  sheet?: DiscoverySnap; listOffset?: number;
  /**
   * P6 server reads only, owned by the route coordinator (a screen never writes it): how many pages of the current traversal
   * the list had read. A return to the screen reads that many pages again, within a bound, before the list offset is restored;
   * otherwise an offset deeper than the first page would be clamped to its end. Absent means the first page only.
   */
  pages?: number };
/** The five server-owned sets of MY tasks, shared by the pager and its
 * presentation. Keeping this pure avoids loading auth/Data API from a gallery. */
export type OwnTasksScope = 'ALL' | 'ACTIVE' | 'DRAFTS' | 'HISTORY' | 'WAITING';
export function ownTasksScope(view: Pick<MarketplaceView, 'section' | 'attention'>): OwnTasksScope | null {
  if (view.attention) return view.section === 'drafts' || view.section === 'history' ? null : 'WAITING';
  return view.section === 'active' ? 'ACTIVE' : view.section === 'drafts' ? 'DRAFTS' : view.section === 'history' ? 'HISTORY' : 'ALL';
}

export const initialMarketplaceView = (): MarketplaceView => ({ query: '', section: 'active', attention: false,
  price: 'all', mode: 'list', area: null, viewport: null, selectedId: null, when: 'any', where: 'any', places: 1, selectedPlace: null,
  place: null, dates: null, pinPlace: null });
/** "At least n places": a whole number from 1 to `PLACES_MAX`; anything else is 1, every open task. */
export function atLeast(value: unknown): number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1 ? Math.min(value, PLACES_MAX) : 1;
}
/**
 * How many places the task still has open, when the read says: a finite count from 0 up. A read without the slot
 * counts leaves it unknown (null), which is never read as "none left" and never as "room for n".
 */
export function openPlaces(item: MarketplaceItem): number | null {
  const left = item.pokrivenost?.preostalo;
  return typeof left === 'number' && Number.isFinite(left) && left >= 0 ? left : null;
}
/** A civil date written as the calendar writes one ("2026-09-24"), and a real day of that calendar. */
export function civilDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T12:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
/** A date range the filter can read: two real civil days, the first not after the second; anything else is none. */
export function dateRange(value: unknown): DateRange | null {
  if (!value || typeof value !== 'object') return null;
  const { from, to } = value as Partial<DateRange>;
  return civilDate(from) && civilDate(to) && from <= to ? { from, to } : null;
}
export const isOwnedNeed = (item: MarketplaceItem): item is PotrebaProjekcija => 'stanje' in item;
/** Only the existing public approximation is admitted. This never reads private pins or asks for GPS. */
export function publicPoint(item: MarketplaceItem): { lat: number; lng: number } | null {
  if (item.detalji?.rezimLokacije === 'REMOTE') return null;
  if (!('priblizno' in item)) return null;
  const point = item.priblizno;
  return point && typeof point.lat === 'number' && Number.isFinite(point.lat) && Math.abs(point.lat) <= 90
    && typeof point.lng === 'number' && Number.isFinite(point.lng) && Math.abs(point.lng) <= 180
    ? { lat: Number(point.lat.toFixed(2)), lng: Number(point.lng.toFixed(2)) } : null;
}
export function publicBounds(raw: unknown): PublicBounds | null {
  if (!Array.isArray(raw) || raw.length !== 4 || !raw.every(value => typeof value === 'number' && Number.isFinite(value))) return null;
  const [west, south, east, north] = raw;
  return Math.abs(west) <= 180 && Math.abs(east) <= 180 && south >= -90 && north <= 90 && south <= north
    ? [west, south, east, north] : null;
}
export function publicViewport(raw: unknown): PublicViewport | null {
  if (!raw || typeof raw !== 'object') return null;
  const value = raw as Partial<PublicViewport>, bounds = publicBounds(value.bounds);
  return bounds && Array.isArray(value.center) && value.center.length === 2 && value.center.every(Number.isFinite)
    && Math.abs(value.center[0]) <= 180 && Math.abs(value.center[1]) <= 90 && typeof value.zoom === 'number'
    && Number.isFinite(value.zoom) && value.zoom >= 0 && value.zoom <= 24
    ? { center: [value.center[0], value.center[1]], zoom: value.zoom, bounds } : null;
}
export function hasNeedAttention(item: PotrebaProjekcija): boolean {
  return item.stanje !== 'NACRT' && item.stanje !== 'ZATVORENA' && item.pokrivenost.preostalo > 0 && (item.brojPrijavaZaIzbor ?? 0) > 0;
}
/**
 * One presentation subset of one existing read. No matching/eligibility/ranking authority. `now` is read only by the
 * Kada filter; a view without the Zadaci filters never looks at it.
 */
export function marketplaceItems(items: readonly MarketplaceItem[], view: MarketplaceView, owned: boolean, now: Date = new Date()): MarketplaceItem[] {
  const query = view.query.trim().toLocaleLowerCase('sr-Latn-RS');
  const when = view.when ?? 'any', where = view.where ?? 'any', places = atLeast(view.places), dates = dateRange(view.dates);
  const place = typeof view.place === 'string' && view.place.trim() ? placeKey(view.place) : null;
  return items.filter(item => {
    // Dates and the flexible words are one choice; a range wins over a stale word.
    if (dates ? !happensBetween(item, dates, now) : when !== 'any' && !happensIn(item, when, now)) return false;
    if (where !== 'any' && workMode(item) !== where) return false;
    // "Koliko vas dolazi": a task that says it has fewer open places than people coming is left out. A task whose open
    // places are unknown is KEPT (a count the read did not give is not "full", so it is never hidden silently); it is
    // simply never counted as having room for n: the "N+ mesta" chip is offered only on a known count (`openPlaces`).
    if (places > 1) { const left = openPlaces(item); if (left !== null && left < places) return false; }
    if (place !== null) { const area = publicArea(item); if (area === null || placeKey(area) !== place) return false; }
    if (owned) {
      if (!isOwnedNeed(item)) return false;
      if (view.section === 'drafts' && item.stanje !== 'NACRT' || view.section === 'history' && item.stanje !== 'ZATVORENA'
        || view.section === 'active' && (item.stanje === 'NACRT' || item.stanje === 'ZATVORENA')) return false;
      if (view.attention && !hasNeedAttention(item)) return false;
    }
    if (view.price !== 'all' && item.rezimCene !== view.price) return false;
    if (query && ![item.naslov, item.podrucjeTekst, ...item.uslovi].join(' ').toLocaleLowerCase('sr-Latn-RS').includes(query)) return false;
    if (view.area) {
      const point = publicPoint(item); if (!point || !inBounds(point, view.area)) return false;
    }
    return true;
  });
}
/** Whether a public point lies inside bounds, including bounds that cross the antimeridian (west > east). */
export function inBounds(point: { lat: number; lng: number }, [west, south, east, north]: PublicBounds): boolean {
  return point.lat >= south && point.lat <= north && (west <= east ? point.lng >= west && point.lng <= east : point.lng >= west || point.lng <= east);
}
/**
 * How many of my own tasks each set of "Moji zadaci" holds, and how many of the active ones wait for my choice among
 * applications. The list's own filter decides each set, so Početna's "Moji zadaci" row and the screen it opens can
 * never count differently (owner's information architecture, 2026-09-23).
 */
export type OwnedTaskCounts = { total: number; active: number; waiting: number; drafts: number; history: number };
export function ownedTaskCounts(items: readonly MarketplaceItem[]): OwnedTaskCounts {
  const count = (section: MarketplaceView['section']) => marketplaceItems(items, { ...initialMarketplaceView(), section }, true).length;
  return { total: count('all'), active: count('active'), drafts: count('drafts'), history: count('history'),
    waiting: items.filter(item => isOwnedNeed(item) && hasNeedAttention(item)).length };
}
/** IDs and rounded public points only; no titles, accounts, exact locations or other properties enter the map SDK. */
export function publicFeatures(items: readonly MarketplaceItem[]): GeoJSON.FeatureCollection<GeoJSON.Point, { needId: string }> {
  return { type: 'FeatureCollection', features: items.flatMap(item => {
    const point = publicPoint(item);
    return point ? [{ type: 'Feature' as const, id: item.id, properties: { needId: item.id }, geometry: { type: 'Point' as const, coordinates: [point.lng, point.lat] } }] : [];
  }) };
}
export function publicInitialBounds(items: readonly MarketplaceItem[]): PublicBounds | null {
  const points = items.flatMap(item => { const value = publicPoint(item); return value ? [value] : []; });
  if (!points.length) return null;
  return [Math.max(-180, Math.min(...points.map(point => point.lng)) - 0.02), Math.max(-85, Math.min(84.98, Math.min(...points.map(point => point.lat)) - 0.02)),
    Math.min(180, Math.max(...points.map(point => point.lng)) + 0.02), Math.min(85, Math.max(-84.98, Math.max(...points.map(point => point.lat)) + 0.02))];
}

/* ------------------------------------------------------------------------------------------- Zadaci (2026-09-24) */

/** How the task is done, from its own location mode; null when the task does not say. */
export function workMode(item: MarketplaceItem): 'onsite' | 'remote' | null {
  const mode = item.detalji?.rezimLokacije;
  return mode === 'REMOTE' ? 'remote' : typeof mode === 'string' && mode ? 'onsite' : null;
}
/** Whether any of these tasks says how it is done, so "Gde se radi" has something to choose from. */
export const saysWorkMode = (items: readonly MarketplaceItem[]) => items.some(item => workMode(item) !== null);

/** The civil day an instant falls on in `zone`; an end at exactly midnight belongs to the day before it. */
function civilDay(value: string | null | undefined, zone: string, end: boolean): string | null {
  const exact = calendarInstant(value);
  if (exact === null) return null;
  const ms = Number(exact >= 0n ? exact / 1000n : (exact - 999n) / 1000n);
  try {
    const parts = zonedParts(new Date(ms), zone);
    return end && parts.time === '00:00:00' ? zonedParts(new Date(ms - 1), zone).date : parts.date;
  } catch { return null; }
}
const FIRST_DAY = '0000-01-01', LAST_DAY = '9999-12-31';
/**
 * The days a task can be done on, in its own zone, as an inclusive [first, last] pair of civil dates; null when its
 * schedule does not say. A saved window or range is read as it is. Without dates, "danas / sutra / ove nedelje" mean
 * what the card says they mean, and a task that is flexible or remote at any time can be done on any day. A fixed
 * window without its start is incomplete ("Tačan termin nije potpun") and matches no particular day. A fixed window with
 * only its start is that one day; a flexible range with only its start is open-ended, as its card says ("Od 26. sep").
 */
function workDays(item: MarketplaceItem, now: Date): [string, string] | null {
  const schedule = item.schedule;
  if (!schedule) return null;
  const zone = item.taskTimezone ?? 'UTC';
  const first = civilDay(schedule.startsAt, zone, false), last = civilDay(schedule.endsAt, zone, true);
  if (first) return [first, last && last >= first ? last : schedule.kind === 'FIXED_WINDOW' ? first : LAST_DAY];
  if (last) return schedule.kind === 'FIXED_WINDOW' ? null : [FIRST_DAY, last];
  let today: string;
  try { today = zonedParts(now, zone).date; } catch { return null; }
  switch (schedule.kind) {
    case 'TODAY_FLEXIBLE': return [today, today];
    case 'TOMORROW_FLEXIBLE': return [shiftDate(today, 1), shiftDate(today, 1)];
    case 'WEEK_FLEXIBLE': return [today, weekEnd(today)];
    case 'FLEXIBLE': case 'REMOTE_ANYTIME': return [FIRST_DAY, LAST_DAY];
    default: return null;
  }
}
/** Sunday of the week `day` is in (the Serbian week runs Monday to Sunday). */
function weekEnd(day: string): string {
  const weekday = new Date(`${day}T12:00:00Z`).getUTCDay();
  return shiftDate(day, (7 - weekday) % 7);
}
/** "Ovaj vikend": the coming Saturday and Sunday; on a Saturday the two days left, on a Sunday that day alone. */
function weekendOf(day: string): [string, string] {
  const weekday = new Date(`${day}T12:00:00Z`).getUTCDay();
  if (weekday === 0) return [day, day];
  const saturday = shiftDate(day, 6 - weekday);
  return [saturday, shiftDate(saturday, 1)];
}
/** The civil days a flexible choice stands for, counted from `today`. */
function whenDays(when: Exclude<WhenFilter, 'any'>, today: string): [string, string] {
  switch (when) {
    case 'today': return [today, today];
    case 'tomorrow': return [shiftDate(today, 1), shiftDate(today, 1)];
    case 'week': return [today, weekEnd(today)];
    case 'weekend': return weekendOf(today);
    case 'next7': return [today, shiftDate(today, 6)];
  }
}
/** Whether the task can be done on the chosen day(s), each read in the task's own zone. */
export function happensIn(item: MarketplaceItem, when: WhenFilter, now: Date = new Date()): boolean {
  if (when === 'any') return true;
  const days = workDays(item, now);
  if (!days) return false;
  let today: string;
  try { today = zonedParts(now, item.taskTimezone ?? 'UTC').date; } catch { return false; }
  const [from, to] = whenDays(when, today);
  return days[0] <= to && days[1] >= from;
}
/**
 * Whether the task can be done on a day of a chosen range: its own work days (in its own zone) overlap the range. A task
 * whose schedule names no day matches no range; `undatedCount` says how many were left out that way.
 */
export function happensBetween(item: MarketplaceItem, range: DateRange, now: Date = new Date()): boolean {
  const days = workDays(item, now);
  return !!days && days[0] <= range.to && days[1] >= range.from;
}
/** Whether any of these tasks says on which days it can be done, so a Kada choice has something to read. */
export const saysWhen = (items: readonly MarketplaceItem[], now: Date = new Date()) => items.some(item => workDays(item, now) !== null);
/** Today's civil date in Serbian time: the day the Kada grid starts from and the days before it that are past. */
export function serbianToday(now: Date = new Date()): string {
  try { return zonedParts(now, 'Europe/Belgrade').date; } catch { return now.toISOString().slice(0, 10); }
}

/** Two spellings of one place ("Novi  Sad", "novi sad") are one place. */
export const placeKey = (text: string) => text.trim().replace(/\s+/g, ' ').toLocaleLowerCase('sr-Latn-RS');
/**
 * The public area a task names, as the read wrote it, when it names one: never a remote task's "Na daljinu" (whether the
 * task's mode says remote or only its words do) and never the "Lokacija nije navedena" the read writes for a task
 * without an area. The one source of "Gde" places.
 */
const NOT_A_PLACE = new Set([placeKey(podrucjeTekst(null, null)), placeKey('Na daljinu')]);
export function publicArea(item: MarketplaceItem): string | null {
  if (workMode(item) === 'remote' || typeof item.podrucjeTekst !== 'string') return null;
  const text = item.podrucjeTekst.trim().replace(/\s+/g, ' ');
  return text && !NOT_A_PLACE.has(placeKey(text)) ? text : null;
}

/**
 * Zadaci as the screen shows it (Discovery V47: the list follows the map). `mapped` is what every filter but the map's
 * area leaves, including my own tasks: ownership labels never alter public visibility or counts. The map draws these,
 * so moving the map never takes a pin away. The list follows
 * the area: with one, it holds the pinned tasks inside it (`inArea`), then every task that has no public point at all
 * (`withoutPoint`: online work, or a task placed nowhere), which an area can neither hold nor leave out, so they are
 * never lost. Without an area the list is `mapped`, in the read's order. No coordinate is ever invented.
 *
 * One public point (`pinPlace`, a place's "Prikaži sve u listi") shows that point first. Tasks
 * with no public point still follow in their own section: they must remain discoverable while
 * someone explores any part of the map.
 */
export type DiscoveryShown = { mapped: MarketplaceItem[]; inArea: MarketplaceItem[]; withoutPoint: MarketplaceItem[]; listed: MarketplaceItem[] };
/** Remote work has no geographic scope. Keep shared conditions and the remembered camera, never a stale place. */
export function remoteDiscoveryScope<T extends { where?: WhereFilter; place?: string | null; area?: PublicBounds | null; pinPlace?: string | null }>(view: T): T {
  return view.where === 'remote' ? { ...view, area: null, place: null, pinPlace: null } : view;
}
export function discoveryShown(items: readonly MarketplaceItem[], view: MarketplaceView, _mine: ReadonlySet<string> | undefined,
  now: Date = new Date()): DiscoveryShown {
  view = remoteDiscoveryScope(view);
  const mapped = marketplaceItems(items, { ...view, area: null }, false, now);
  return discoveryMapScope(mapped, view);
}
/**
 * Partition an already filtered public read for the current map area. Keep `mapped` unchanged: panning must not
 * rebuild the map's source or repeat time/text filtering. Both ordinary discovery and the retained map use this
 * same geographic rule; point-free work remains in the list and remote work never inherits a geographic scope.
 */
export function discoveryMapScope(mapped: MarketplaceItem[], scope: Pick<MarketplaceView, 'area' | 'pinPlace' | 'where'>): DiscoveryShown {
  const view = remoteDiscoveryScope(scope);
  const pin = typeof view.pinPlace === 'string' && view.pinPlace ? view.pinPlace : null;
  const inArea: MarketplaceItem[] = [], remote: MarketplaceItem[] = [], unlocated: MarketplaceItem[] = [];
  for (const item of mapped) {
    const point = publicPoint(item);
    if (!point) (workMode(item) === 'remote' ? remote : unlocated).push(item);
    else if (pin !== null ? pointKey(point) === pin : !view.area || inBounds(point, view.area)) inArea.push(item);
  }
  // The same stable groups exist with and without map bounds. Absence of a public point never
  // invents remote work, and the map keeps its original filtered source/order independently.
  const withoutPoint = [...remote, ...unlocated];
  return { mapped, inArea, withoutPoint, listed: [...inArea, ...withoutPoint] };
}
/** The Zadaci list: one filtered public subset; ownership affects labels and destination, never membership. */
export function discoveryItems(items: readonly MarketplaceItem[], view: MarketplaceView, mine: ReadonlySet<string> | undefined,
  now: Date = new Date()): MarketplaceItem[] {
  return discoveryShown(items, view, mine, now).listed;
}
/** Two areas that are the same bounds: a settle that did not move the map does not change the list. */
export const sameBounds = (a: PublicBounds | null | undefined, b: PublicBounds | null | undefined) =>
  a === b || (!!a && !!b && a.every((value, index) => value === b[index]));
/** How many of the conditions (Kada, Kako se radi, Koliko vas dolazi, Cena) are on: the count on "Uslovi pretrage". */
export function discoveryConditions(view: MarketplaceView): number {
  return Number((view.when ?? 'any') !== 'any' || !!dateRange(view.dates)) + Number((view.where ?? 'any') !== 'any')
    + Number(atLeast(view.places) > 1) + Number(view.price !== 'all' || view.minBudgetRsd != null);
}
/** Whether the Zadaci conditions (price and the time, work-mode and places choices) differ from "everything". */
export function discoveryFiltered(view: MarketplaceView): boolean {
  return discoveryConditions(view) > 0;
}
/**
 * How many tasks a time choice leaves out only because their schedule names no day. They are not hidden silently: the
 * Kada step and the list say how many. 0 when no time choice is on.
 */
export function undatedCount(items: readonly MarketplaceItem[], view: MarketplaceView, mine: ReadonlySet<string> | undefined,
  now: Date = new Date()): number {
  if ((view.when ?? 'any') === 'any' && !dateRange(view.dates)) return 0;
  return discoveryItems(items, { ...view, when: 'any', dates: null }, mine, now).filter(item => workDays(item, now) === null).length;
}

/** A "Gde" suggestion: a public area some loaded task names, and how many tasks there the other conditions leave. */
export type PlaceSuggestion = { text: string; count: number };
/**
 * The places "Gde?" offers, built from the loaded open tasks: each distinct public area text,
 * counted under the other conditions (Kada, Kako se radi, Koliko vas dolazi, Cena), most tasks first. A place the other
 * conditions leave empty is not offered. No geocoder and no device location: a place nobody's task names cannot be chosen.
 */
export function placeSuggestions(items: readonly MarketplaceItem[], view: MarketplaceView, mine: ReadonlySet<string> | undefined,
  now: Date = new Date()): PlaceSuggestion[] {
  const places = new Map<string, PlaceSuggestion>();
  for (const item of discoveryItems(items, { ...view, query: '', place: null, area: null, pinPlace: null }, mine, now)) {
    const text = publicArea(item);
    if (text === null) continue;
    const key = placeKey(text), known = places.get(key);
    if (known) known.count++; else places.set(key, { text, count: 1 });
  }
  return [...places.values()].sort((a, b) => b.count - a.count || a.text.localeCompare(b.text, 'sr-Latn-RS'));
}

/**
 * Where the list sheet starts: the map when most tasks are on it, the list when many are not or there are few.
 * Half when at least half of the shown tasks have no pin, or when three or fewer are shown; otherwise peek. When none
 * of them has a pin the map has nothing to show at all, so the list takes the screen (the same rule taken to its end).
 */
export function discoveryStartSnap(shown: number, withoutPin: number): DiscoverySnap {
  if (shown > 0 && withoutPin >= shown) return 'full';
  return shown <= 3 || withoutPin * 2 >= shown ? 'half' : 'peek';
}

/** One public point, as the map draws it: the rounded coarse point (~1 km) is the key. */
export const pointKey = (point: { lat: number; lng: number }) => `${point.lat.toFixed(2)},${point.lng.toFixed(2)}`;
export type PinPlace = { key: string; point: { lat: number; lng: number }; ids: string[] };
/**
 * Tasks grouped by their public point. Several tasks rounded to one point sit exactly on top of each other on the map,
 * so only the top one could be pressed; as a place they are reachable together. Order follows the list.
 */
export function pinPlaces(items: readonly MarketplaceItem[]): Map<string, PinPlace> {
  const places = new Map<string, PinPlace>();
  for (const item of items) {
    const point = publicPoint(item);
    if (!point) continue;
    const key = pointKey(point), place = places.get(key);
    if (place) place.ids.push(item.id); else places.set(key, { key, point, ids: [item.id] });
  }
  return places;
}

/**
 * What a pin says. An amount is money exactly as the read formatted it ("6.000 RSD", "120.000 RSD"): an amount never
 * loses its currency, whatever its length (the `Novac` contract: `prikaz` is already formatted and never a bare number);
 * the pill is as wide as its words. A task that asks for offers says so in a quiet word that never wears the money
 * colour or weight; a missing price says nothing on the pin and says why to a screen reader. Never an invented amount.
 */
export type PinLabel = { text: string; tone: 'money' | 'offer' | 'none'; spoken: string };
export function pinLabel(item: MarketplaceItem): PinLabel {
  if (item.rezimCene === 'OFFERS') return { text: 'Ponude', tone: 'offer', spoken: 'Tražim ponude' };
  const price = item.ponudjenaCena, full = typeof price?.prikaz === 'string' ? price.prikaz.trim() : '';
  if (!price || !full) return { text: '', tone: 'none', spoken: 'Cena nije navedena' };
  const basis = item.osnovaCene === 'HOURLY' ? ' po osobi po satu' : item.osnovaCene === 'TOTAL' ? ' ukupno' : item.osnovaCene === 'PER_PERSON' ? ' po osobi' : '';
  return { text: full + basis, tone: 'money', spoken: full + basis };
}
