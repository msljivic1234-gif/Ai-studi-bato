import type { ConfirmedLocationPoint, LocationSlot } from '../../contracts/location';
import type { NeedTaskGeography, NeedTaskGeographyPoint } from '../../contracts/needFactsV2';
import { locationSlots } from '../../lib/location';

/**
 * The words for a place: what each slot is called, the conversation's own search seed and the short line a confirmed
 * point becomes in the thread. Pure and map-free, so the conversation can import it without the native map
 * (ConversationPointAsk, which reaches the map, is loaded lazily).
 */

import { toSerbianLatin } from '../../lib/serbianLatin';
export { toSerbianLatin } from '../../lib/serbianLatin';

export const normalizedPlaceText = (value: string): string => toSerbianLatin(value).normalize('NFKD').replace(/[̀-ͯ]/g, '')
  .toLocaleLowerCase('sr-Latn-RS').replace(/đ/g, 'd').replace(/[^a-z0-9]+/g, ' ').trim();

const CASE_LOCALE = 'sr-Latn-RS';
// A letter is upper case when lowering it changes it, lower case when raising it does; this reads Serbian Latin and Cyrillic alike
// and needs no Unicode property escapes.
const isUpperLetter = (char: string): boolean => char.toLocaleLowerCase(CASE_LOCALE) !== char;
const isLowerLetter = (char: string): boolean => char.toLocaleUpperCase(CASE_LOCALE) !== char;
/** The small words of a name that stay small after its first word: "Beograd na vodi", "Kovilj kod Novog Sada". */
const SMALL_WORDS: ReadonlySet<string> = new Set(['na', 'kod', 'pod', 'od', 'uz', 'pri', 'iza', 'ispod', 'iznad', 'pored', 'do', 'za', 'sa', 'iz']);

type WordCase = 'NONE' | 'ACRONYM' | 'SHOUT' | 'LOWER' | 'TITLE' | 'ODD';
/** No letters; capitals of one or two letters ("MZ"); capitals of three or more ("NOVI"); lower case; one capital then lower case; any other mix ("NovI"). */
function wordCase(word: string): WordCase {
  const letters = [...word].filter(char => isUpperLetter(char) || isLowerLetter(char));
  if (!letters.length) return 'NONE';
  const uppers = letters.filter(isUpperLetter).length, lowers = letters.length - uppers;
  if (lowers === 0) return uppers <= 2 ? 'ACRONYM' : 'SHOUT';
  if (uppers === 0) return 'LOWER';
  return uppers === 1 && isUpperLetter(letters[0]) ? 'TITLE' : 'ODD';
}

/**
 * A place or city label as it is SHOWN, with its case tidied when it was typed carelessly: "NovI SAD", "NOVI SAD" and "novi sad" all read
 * "Novi Sad". A label that is already well formed comes back as it is, byte for byte ("Novi Sad", "Sremska Kamenica", "Beograd - Zemun", and
 * also "Stari grad" or "Žitni trg", whose lower-case word is the name's own: only the person who typed it knows that "Novi sad" is a slip). Only a
 * label with a word in mixed case or in capitals of three letters or more ("MZ" and "NS" are abbreviations), or one that is entirely lower case,
 * is changed. Then every word takes a capital first letter and a lower-case rest, Serbian letters, Cyrillic and hyphens included, the
 * separators exactly as typed; the small words of a name after its first word stay small ("Beograd na vodi"), and abbreviations stay as they are.
 * DISPLAY ONLY: what is stored, sent or searched is never passed through here.
 */
export function tidyPlaceLabel(label: string): string {
  const parts = label.split(/([\s\-‐–—\/,.;:()]+)/);        // words at the even places, separators (kept as typed) at the odd ones
  const kinds = parts.map((part, index): WordCase => index % 2 === 0 ? wordCase(part) : 'NONE');
  const careless = kinds.some(kind => kind === 'SHOUT' || kind === 'ODD')
    || (kinds.includes('LOWER') && !kinds.includes('TITLE') && !kinds.includes('ACRONYM'));
  if (!careless) return label;
  let named = false;
  return parts.map((part, index) => {
    if (kinds[index] === 'NONE') return part;
    const first = !named; named = true;
    if (!first && SMALL_WORDS.has(part.toLocaleLowerCase(CASE_LOCALE))) return part.toLocaleLowerCase(CASE_LOCALE);
    if (kinds[index] === 'ACRONYM') return part;
    const chars = [...part], at = chars.findIndex(char => isUpperLetter(char) || isLowerLetter(char));
    return chars.map((char, i) => i === at ? char.toLocaleUpperCase(CASE_LOCALE) : char.toLocaleLowerCase(CASE_LOCALE)).join('');
  }).join('');
}

type PlaceValue = Readonly<{ geography: NeedTaskGeography | null; exactAddress: string | null }>;

export const slotTitle = (slot: LocationSlot, geography: NeedTaskGeography | null): string => {
  if (slot === 'start') return geography?.mode === 'STATIONARY' ? 'Mesto zadatka' : 'Polazište';
  if (slot === 'end') return 'Odredište';
  if (slot === 'serviceArea') return 'Područje rada';
  return `Stanica ${Number(slot.slice('waypoints/'.length)) + 1}`;
};

const slotPlace = (slot: LocationSlot, geography: NeedTaskGeography | null): NeedTaskGeographyPoint | undefined =>
  slot === 'start' ? geography?.start
    : slot === 'end' ? geography?.end
      : slot === 'serviceArea' ? geography?.serviceArea
        : geography?.waypoints?.[Number(slot.slice('waypoints/'.length))];

export const exactAddressForSlot = (slot: LocationSlot, value: PlaceValue): string | null => {
  const geography = value.geography, exact = value.exactAddress?.trim();
  if (!geography || !exact) return null;
  if (geography.mode === 'STATIONARY' && slot === 'start') return exact;
  const place = slotPlace(slot, geography);
  if (!place) return null;
  // A route has one legacy private exact-address fact, so bind it only when the street/POI
  // text itself matches this slot. City is deliberately excluded: both ends often share it.
  const exactNormalized = normalizedPlaceText(exact);
  const identities = [place.label, place.area].filter((part): part is string => typeof part === 'string')
    .map(part => normalizedPlaceText(part)).filter(part => part.length >= 4);
  return identities.some(identity => exactNormalized.includes(identity)) ? exact : null;
};

const uniqueSeedParts = (parts: readonly (string | null | undefined)[]): string[] => {
  const result: string[] = [];
  for (const raw of parts) {
    if (typeof raw !== 'string') continue;
    for (const piece of raw.split(',').map(part => part.trim()).filter(Boolean)) {
      const normalized = normalizedPlaceText(piece);
      if (!normalized || result.some(existing => {
        const existingTokens = new Set(normalizedPlaceText(existing).split(' ').filter(Boolean));
        const candidateTokens = normalized.split(' ').filter(Boolean);
        return candidateTokens.length > 0 && candidateTokens.every(token => existingTokens.has(token));
      })) continue;
      result.push(piece);
    }
  }
  return result;
};

/** The most precise thing already known for this slot, used only as a search seed. */
export const slotSeed = (slot: LocationSlot, value: PlaceValue): string => {
  const place = slotPlace(slot, value.geography);
  // Use the private house/street string only when it can be bound to this slot by the slot's
  // own street/POI identity. That gives the geocoder the exact spoken address without ever
  // copying one endpoint's private address onto another endpoint.
  return uniqueSeedParts([exactAddressForSlot(slot, value), place?.label, place?.area, place?.city]).join(', ');
};

/** A known city may frame the map, but is not a street address or an automatic pin. */
export const slotIsCityOnly = (slot: LocationSlot, value: PlaceValue): boolean => {
  if (value.geography?.mode === 'AREA_BASED') return false;
  const city = normalizedPlaceText(slotPlace(slot, value.geography)?.city ?? '');
  return !!city && normalizedPlaceText(slotSeed(slot, value)) === city;
};

/** A city is context, not an address. Area-wide work intentionally needs an area rather than a street. */
export const slotNeedsCloserPlace = (slot: LocationSlot, value: PlaceValue): boolean => {
  if (value.geography?.mode === 'AREA_BASED') return false;
  const place = slotPlace(slot, value.geography);
  const label = normalizedPlaceText(place?.label ?? '');
  if (slotIsCityOnly(slot, value)) return true;
  return !exactAddressForSlot(slot, value)
    && ['ovde', 'moja lokacija', 'trenutna lokacija', 'ovde gde sam', 'gde se nalazim'].includes(label);
};

/** A confirmed point's own words: its address, or for a provider point the conversation's place. A hand-placed pin with no
 *  address has none: a manually confirmed coordinate is not a resolved address. */
export const confirmedPointText = (point: ConfirmedLocationPoint, value: PlaceValue): string | null =>
  point.address?.trim() || (point.origin.kind === 'MANUAL_PIN' ? null : slotSeed(point.slot, value) || null);

const HOUSE_NUMBER = /^\d+\s?[a-zA-ZčćžšđČĆŽŠĐ]?(?:\s?[/-]\s?\d+\s?[a-zA-ZčćžšđČĆŽŠĐ]?)?$/;

/** Candidate choices retain every locality/district: two places with the same street must stay distinguishable.
 * Only a leading house number changes order for reading; no provider segment is guessed or discarded. */
export function candidatePlaceLabel(label: string): { main: string; detail: string | null } {
  const parts = toSerbianLatin(label).replace(/\s+/g, ' ').trim().split(',').map(part => part.trim()).filter(Boolean);
  const leadingNumber = parts.length > 1 && HOUSE_NUMBER.test(parts[0]) && !HOUSE_NUMBER.test(parts[1]);
  return { main: leadingNumber ? `${parts[1]} ${parts[0]}` : parts[0] ?? '',
    detail: parts.slice(leadingNumber ? 2 : 1).join(', ') || null };
}

/**
 * Street and number, then the locality, from a label that may be the provider's whole address line ("65, Bulevar
 * oslobođenja, MZ Žitni trg, Rotkvarija, Novi Sad, …"). Only the label's own parts are used: the locality is the part that
 * names one of the given places (the conversation's city for this slot), never a guess among neighbourhoods, districts and
 * postcodes. A short text (one or two parts, as a person says or types it) is kept whole.
 */
export function shortPlaceLabel(label: string, localities: readonly (string | null | undefined)[] = []): { main: string; locality: string | null } {
  const text = toSerbianLatin(label).replace(/\s+/g, ' ').trim();
  const parts = text.split(',').map(part => part.trim()).filter(Boolean);
  if (parts.length < 2) return { main: parts[0] ?? text, locality: null };
  const leadingNumber = HOUSE_NUMBER.test(parts[0]) && !!parts[1] && !HOUSE_NUMBER.test(parts[1]);
  const main = leadingNumber ? `${parts[1]} ${parts[0]}` : parts[0];
  const rest = parts.slice(leadingNumber ? 2 : 1);
  const wanted = new Set(localities.filter((place): place is string => typeof place === 'string')
    .map(place => normalizedPlaceText(toSerbianLatin(place))).filter(Boolean));
  const named = rest.find(part => wanted.has(normalizedPlaceText(part)));
  // Two parts are what a person says ("Bulevar oslobođenja 65, Novi Sad"); nothing of it is dropped.
  const locality = named ?? (parts.length === 2 && rest.length === 1 ? rest[0] : null);
  const repeats = locality !== null && ` ${normalizedPlaceText(main)} `.includes(` ${normalizedPlaceText(locality)} `);
  return { main, locality: repeats ? null : locality };
}

/** Where the words of an owner's place line come from. */
export type OwnerPlaceSource =
  /** The confirmed point's own address (or, for a provider point without one, the conversation's place): what the person confirmed. */
  | 'POINT'
  /** A hand-placed pin with no address: the pin is the place, and no other text is put in its mouth. */
  | 'MAP'
  /** No confirmed point for this slot yet: the task's own words (label, city, area), the only text there is. */
  | 'GEOGRAPHY';

export type OwnerPlace = Readonly<{
  slot: LocationSlot;
  source: OwnerPlaceSource;
  /** Street and number, or the place: the bold part of a line. */
  main: string;
  /** The city (the part of the label that names the slot's city), never a guess; null when the main part already says it. */
  locality: string | null;
  /** The whole line: "Pavla Ivića 6, Novi Sad". */
  text: string;
  /** What a screen reader hears: the whole label when there is one. */
  spoken: string;
}>;

/** What an owner's place line is made of: the task's words for its places and, when they exist, its confirmed points. */
export type OwnerPlaceInput = PlaceValue & Readonly<{ points?: readonly ConfirmedLocationPoint[] | null }>;

const present = (value: string | undefined): value is string => typeof value === 'string' && value.trim().length > 0;

/**
 * THE place line of one slot of the OWNER's own task (owner, 2026-10-07: he typed "Lenke Dunđerski 11, Novi Sad", moved the pin
 * elsewhere, the conversation said the new place, and after publishing the task still said "Lenke Dunđerski").
 *
 * A slot has two sources of words and they stop agreeing the moment a pin moves. The task's geography (label, city, area) was written
 * from the first text and is PUBLIC: it travels as one value that `normalizeResolvedLocation` binds to every confirmed point, so
 * nothing rewrites it when a point is confirmed somewhere else. The confirmed point's own address is what the person actually
 * confirmed. For the owner's own reading the point wins, in the short form the conversation already uses ("Pavla Ivića 6, Novi
 * Sad", `shortPlaceLabel`), and the geography's words are used only for a slot that has no confirmed point at all. A hand-placed
 * pin without an address says "Tačka na mapi" and nothing else: its slot's geography text is exactly what such a pin outdates.
 *
 * THIS IS FOR THE OWNER ONLY. It reads a private address; a public surface (a task card, the detail a stranger reads, discovery)
 * takes its words from the public topology and the approximate area and never calls this (`place-line-privacy.test.ts` holds that).
 */
export function ownerPlace(slot: LocationSlot, input: OwnerPlaceInput): OwnerPlace | null {
  const place = slotPlace(slot, input.geography);
  const point = input.points?.find(item => item.slot === slot);
  if (point) {
    const own = confirmedPointText(point, input);
    if (!own) return { slot, source: 'MAP', main: 'tačka na mapi', locality: null, text: 'Tačka na mapi', spoken: 'tačka na mapi' };
    const short = shortPlaceLabel(own, [place?.city]);
    return { slot, source: 'POINT', main: short.main, locality: short.locality,
      text: short.locality ? `${short.main}, ${short.locality}` : short.main, spoken: toSerbianLatin(own) };
  }
  const words = [place?.label, place?.city, place?.area].filter(present);
  if (!words.length) return null;
  const text = words.join(' · ');
  return { slot, source: 'GEOGRAPHY', main: text, locality: null, text, spoken: text };
}

/** The same line as plain text, or null when the slot has neither a confirmed point nor a place of its own. */
export const ownerPlaceLine = (slot: LocationSlot, input: OwnerPlaceInput): string | null => ownerPlace(slot, input)?.text ?? null;

/** One place per slot of the geography, in route order (start, the stops, the end, a service area). */
export function ownerPlaces(input: OwnerPlaceInput): OwnerPlace[] {
  return input.geography ? locationSlots(input.geography).flatMap(slot => ownerPlace(slot, input) ?? []) : [];
}

export type ConfirmedPlaceEntry = Readonly<{
  slot: LocationSlot;
  /** "Potvrđeno mesto", "Potvrđeno polazište", "Potvrđena stanica 1". */
  lead: string;
  /** The same place inside a sentence: "mesto zadatka", "polazište", "stanica 1". */
  noun: string;
  main: string; locality: string | null;
  /** False for a hand-placed pin without an address: "tačka na mapi" is not a street to set in bold. */
  exact: boolean;
  /** The person set this point by hand just now: the line acknowledges it. */
  ack: boolean;
  /** The whole label, for a screen reader; the line joins its entries into sentences. */
  spoken: string;
}>;

const lead = (slot: LocationSlot, geography: NeedTaskGeography | null): string => {
  if (slot === 'start' && geography?.mode === 'STATIONARY') return 'Potvrđeno mesto';
  return slot.startsWith('waypoints/') ? `Potvrđena ${slotTitle(slot, geography).toLocaleLowerCase('sr-Latn-RS')}`
    : `Potvrđeno ${slotTitle(slot, geography).toLocaleLowerCase('sr-Latn-RS')}`;
};

/** Route order: start, the stops in order (at most 22 points), end, then a service area. */
const slotOrder = (slot: LocationSlot): number =>
  slot === 'start' ? 0 : slot === 'end' ? 2_000 : slot === 'serviceArea' ? 3_000
    : 1 + Number(slot.slice('waypoints/'.length));

/** One entry per confirmed point, in route order, for the conversation's confirmed-place line. */
export function confirmedPlaceEntries(points: readonly ConfirmedLocationPoint[], value: PlaceValue,
  acknowledged: ReadonlySet<LocationSlot> = new Set()): ConfirmedPlaceEntry[] {
  const geography = value.geography;
  return [...points].sort((a, b) => slotOrder(a.slot) - slotOrder(b.slot)).map(point => {
    // The words are the shared owner place line's (a point always has some); this adds only what the sentence around them needs.
    const place = ownerPlace(point.slot, { ...value, points: [point] }) as OwnerPlace;
    const noun = slotTitle(point.slot, geography).toLocaleLowerCase('sr-Latn-RS');
    const ack = acknowledged.has(point.slot);
    const entryLead = lead(point.slot, geography);
    return { slot: point.slot, lead: entryLead, noun, main: place.main, locality: place.locality, exact: place.source === 'POINT', ack,
      spoken: ack ? `U redu, ${noun} je sada: ${place.spoken}` : `${entryLead}: ${place.spoken}` };
  });
}
