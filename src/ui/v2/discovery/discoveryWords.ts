import { atLeast, dateRange, type DateRange, type MarketplaceView, type WhenFilter, type WhereFilter } from '../../../data/marketplaceView';
import { civilDay, weekLabel } from '../../calendar/calendarPresentation';
import { plural, zadataka } from '../../system/plural';

/**
 * The words of the Zadaci search (Discovery V47), in one place: the search pill, the capsules over the map, the search and the filters all
 * say a choice the same way. They are the words of the owner-approved plan of 8 Oct 2026 (NACRT_PROIZVODA, U1 to U5): "Svejedno" is the
 * "everything" choice of a set, an amount is "Sa iznosom" or "Tražim ponude" (what the card says of a task that takes offers), and a task's work
 * is done "Na licu mesta" or "Na daljinu".
 */
export const WHEN: readonly (readonly [WhenFilter, string])[] = [['any', 'Bilo kada'], ['today', 'Danas'], ['tomorrow', 'Sutra'],
  ['week', 'Ove nedelje'], ['weekend', 'Ovaj vikend'], ['next7', 'Narednih 7 dana']];
/** The time choices a capsule over the map toggles; "Sutra" is the filters' (and, once chosen there, a capsule of its own that takes itself away). */
export const QUICK_WHEN: readonly WhenFilter[] = ['today', 'weekend'];
/** The days the filters offer: three choices, and "Izaberi datume" for the rest (a range of days). */
export const FILTER_WHEN: readonly (readonly [WhenFilter, string])[] = [['today', 'Danas'], ['tomorrow', 'Sutra'], ['weekend', 'Ovaj vikend']];
export const WHERE: readonly (readonly [WhereFilter, string])[] = [['any', 'Svejedno'], ['onsite', 'Na licu mesta'], ['remote', 'Na daljinu']];
export const PRICE: readonly (readonly [MarketplaceView['price'], string])[] = [['all', 'Svejedno'], ['MY_PRICE', 'Sa iznosom'], ['OFFERS', 'Tražim ponude']];
/** The one reset of the list when it is empty under its conditions: it takes the search and the filters away (the sheets' own is `CLEAR`). */
export const CLEAR_ALL = 'Poništi filtere';
/** The quiet action at the foot of the search and of the filters: each takes away only its own half and leaves the other as it was. */
export const CLEAR = 'Očisti';
/** What the pill says while nothing is searched: the two things a search is, the one thing it opens (the owner-approved plan, U1). */
export const SEARCH_PLACEHOLDER = 'Grad ili zadatak';
/** What the pill does, for a screen reader: it opens the search (a word and a place) and nothing of the filters (they have their own button beside it). */
export const SEARCH_HINT = 'Otvara pretragu po reči i mestu.';
/** The filters button says its name always, and how many are on when any is: "Filteri", "Filteri, 2 aktivna". */
export const filtersSpoken = (count: number) => count > 0 ? `Filteri, ${plural(count, 'aktivan', 'aktivna', 'aktivnih')}` : 'Filteri';
/** The only primary map control names the actual groups in its dialog for a screen reader. */
export const FILTERS_HINT = 'Otvara filtere za mesto, način rada, cenu i termin.';
/** The tasks that are not on the map (work done remotely, or a task placed nowhere): the capsule that is on, and its ✕ is the way back. */
export const OFF_MAP_CHIP = 'Nisu na mapi';
/** How many are not on the map, as the row under the list's count says it: "1 nije na mapi", "3 nisu na mapi". Never a count that was not read. */
export const offMapWords = (count: number) => plural(count, 'nije na mapi', 'nisu na mapi', 'nisu na mapi');
/**
 * What the search and the filters call their parts, the one word each. The SEARCH is the field "Šta tražiš?" and "Gde" (the cities, with how many tasks each, and the
 * work done remotely), then what was searched before; the FILTERS are "Kada", "Gde" (how the work is done) and "Iznos". A person is spoken to as "ti": there is no "vas" here.
 */
export const SEARCH_WORDS = { what: 'Grad ili zadatak', whatPlaceholder: 'Grad ili naziv zadatka', where: 'Gde', recent: 'Skorašnje pretrage',
  searchTitle: 'Pretraga', filtersTitle: 'Filteri', all: 'Svi zadaci', remote: 'Na daljinu',
  /** City search locates the work itself; the separate handoff can still name a city. */
  remoteNote: 'Bez dolaska kod domaćina: onlajn ili rad kod pomagača. Uslove slanja ili preuzimanja pogledajte u zadatku.' } as const;
export const FILTER_GROUP = { when: 'Kada', where: 'Gde', amount: 'Iznos' } as const;
/** Where the list is narrowed to one public point (a place's "Prikaži sve u listi"). */
export const PIN_PLACE = 'Na ovom mestu';

/** The words of one choice of a set, or '' for a value the set does not have. */
export function said<K extends string>(options: readonly (readonly [K, string])[], key: K | undefined): string {
  return options.find(([value]) => value === key)?.[1] ?? '';
}

/** "Broj ljudi": "Za 2 i više" for a task with room for at least two, "Bilo koliko" for every open task. */
export const placesWords = (places: number | undefined) => atLeast(places) > 1 ? `Za ${atLeast(places)} i više` : 'Bilo koliko';

/** The word over the list for how it is ordered: the server reads the open tasks newest first (UX plan 2.14). */
export const NEWEST_FIRST = 'Najnovije prvo';

/**
 * "Za mene" asked of a person whose work profile is not active (R28; the server refuses with P6_FOR_ME_PROFILE_REQUIRED): the switch goes back off and the
 * screen says why in this one sentence, with the one way out, the same entry to the work profile that an application and the availability offer.
 */
export const FOR_ME_REFUSED = 'Za mene radi kad je radni profil aktivan.';
export const WORK_PROFILE_ENTRY = 'Dopuni radni profil';

/** A count with the thousands set apart by a dot, as the app writes money and as the person reads it: 1.248. */
export const groupDigits = (count: number) => String(Math.trunc(count)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
/** "1.248 zadataka": the plural of the tasks with the number grouped. */
export const countWords = (count: number) => zadataka(count).replace(String(count), groupDigits(count));

/** A chosen range of days: "26. sep" for one day, "26–28. sep" inside a month, "30. sep – 2. okt" across two. */
export function datesWords(range: DateRange, now: Date = new Date()): string {
  return range.from === range.to ? civilDay(range.from, now) : weekLabel([range.from, range.to], now);
}

/** Kada in words: the chosen days, or the flexible choice ("Bilo kada" when nothing is chosen). */
export function whenWords(view: Pick<MarketplaceView, 'when' | 'dates'>, now: Date = new Date()): string {
  const dates = dateRange(view.dates);
  return dates ? datesWords(dates, now) : said(WHEN, view.when ?? 'any') || 'Bilo kada';
}

/** A searched word as it is shown back: in Serbian quotation marks, so it never reads as a place. */
export const quoted = (text: string) => `„${text.trim()}“`;

/**
 * What the search pill says (the owner's phone of 8 Oct 2026: the pill is the SEARCH, the filters have their own button beside it): what is searched,
 * in one line and in the order of the pill's own words, "Šta tražiš · Gde": the searched words, then the chosen place, or the map's area, or one public
 * point (a place's whole set, "Na ovom mestu"); null when nothing is searched. It never says a filter ("Na daljinu", "Za mene", the days, the price): those
 * are capsules, and a word said twice is a word too many.
 */
export function searchWords(view: Pick<MarketplaceView, 'place' | 'query' | 'area' | 'pinPlace'> & { where?: MarketplaceView['where'] }): string | null {
  const place = typeof view.place === 'string' ? view.place.trim() : '', query = view.query.trim();
  // The work done remotely has no place, and the list ignores a place, an area or a point left over from before it: the pill does not claim them.
  if (view.where === 'remote') return query ? quoted(query) : null;
  const where = view.pinPlace ? PIN_PLACE : place;
  if (where) return query ? `${quoted(query)} · ${where}` : where;
  if (query) return quoted(query);
  return view.area ? 'Ova oblast' : null;
}

/** Tasks a time choice leaves out because they name no day: said, never hidden silently. */
export const undatedWords = (count: number) => plural(count, 'zadatak bez datuma nije u ovom izboru.',
  'zadatka bez datuma nisu u ovom izboru.', 'zadataka bez datuma nije u ovom izboru.');

/**
 * The list sheet's top line, never blank (Discovery V47 review): while the list is read (or while it is still read which
 * tasks are mine) it says so; a read that failed says so; nothing found is "Nema zadataka" (the empty list under it says
 * why, in its own words). Otherwise one format, every count through the plural: the tasks listed, then apart and quieter
 * (`extra`) the tasks the map cannot show — "12 zadataka · 3 zadatka bez tačke na mapi", under an area
 * "2 zadatka u oblasti · 2 zadatka bez tačke na mapi" or "U oblasti nema zadataka"; on one point,
 * the point's count is followed by the separate count of point-free tasks when present.
 */
export function countLineWords({ status, listed, inArea, withoutPoint, pinless, area, pinPlace }: {
  status: 'loading' | 'error' | 'ready'; listed: number; inArea: number; withoutPoint: number;
  /** Without an area: how many of the listed tasks have no point on the map. */ pinless: number;
  area: boolean; pinPlace: boolean;
}): { words: string; extra: string } {
  if (status === 'loading') return { words: 'Učitavamo zadatke…', extra: '' };
  if (status === 'error') return { words: 'Zadaci nisu učitani', extra: '' };
  const without = (count: number) => count ? ` · ${countWords(count)} bez tačke na mapi` : '';
  if (pinPlace) return { words: inArea ? `${countWords(inArea)} na ovom mestu` : 'Na ovom mestu nema zadataka', extra: without(withoutPoint) };
  if (area) return { words: inArea ? `${countWords(inArea)} u oblasti` : 'U oblasti nema zadataka', extra: without(withoutPoint) };
  return listed ? { words: countWords(listed), extra: without(pinless) } : { words: 'Nema zadataka', extra: '' };
}
