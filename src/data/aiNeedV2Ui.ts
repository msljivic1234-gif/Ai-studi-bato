import { capabilityTerms } from '../lib/capabilityTerms';
import { novac } from '../lib/novac';
import { serviceHandoffText } from '../contracts/serviceHandoff';
import { calendarInstant } from '../lib/calendarTime';
import { locationSlots, normalizeNeedLocation, normalizeTaskGeography } from '../lib/location';
import { displayDate, zonedParts } from '../ui/calendar/calendarPresentation';
import type { AiNeedSafety, AiNeedV2Fact } from '../contracts/aiNeedV2';
import {
  NEED_FACT_V2_DEFINITIONS,
  type NeedFactV2Key,
  type NeedTaskGeography,
  type NeedTaskGeographyPoint,
  type LocationSlot,
} from '../contracts/needFactsV2';

export function factLabel(key: NeedFactV2Key): string {
  return NEED_FACT_V2_DEFINITIONS[key].label;
}

export function sortFacts(facts: AiNeedV2Fact[]): AiNeedV2Fact[] {
  const order = new Map(
    Object.keys(NEED_FACT_V2_DEFINITIONS).map((key, index) => [key, index]),
  );
  return [...facts].sort((a, b) => (order.get(a.key) ?? 999) - (order.get(b.key) ?? 999));
}

const PRICE_LABELS: Record<string, string> = { MY_PRICE: 'Moja cena', OFFERS: 'Ponude', FASTEST: 'Najbrže (raniji način)' };
const PRICE_BASIS_LABELS: Record<string, string> = { TOTAL: 'Ukupno za ceo zadatak', PER_PERSON: 'Po osobi', HOURLY: 'Po osobi po satu' };
const SCHEDULE_LABELS: Record<string, string> = { FIXED_WINDOW: 'Tačan termin', FLEXIBLE: 'Fleksibilno', REMOTE_ANYTIME: 'Daljinski bilo kada',
  TODAY_FLEXIBLE: 'Danas', TOMORROW_FLEXIBLE: 'Sutra', WEEK_FLEXIBLE: 'Ove nedelje' };

/** What an amount row reads under "Ponude": the task carries no amount, so none is shown, not even a stale one. */
export const AMOUNT_WITH_OFFERS = 'Bez iznosa: tražiš ponude';
/** An amount "Moja cena" still needs, said in words where the number would stand; never "0 RSD". */
export const AMOUNT_NOT_ENTERED = 'Iznos još nije unet';
/**
 * The amount row beside its price mode. Under "Ponude" there is no amount to read, so even an amount left from before is
 * not shown as one; under "Moja cena" an amount that is missing says so in words. Null: the row reads its value as usual.
 */
export function priceAmountRowValue(priceMode: unknown, fact: Pick<AiNeedV2Fact, 'key' | 'value'>): string | null {
  if (fact.key !== 'need.price_rsd') return null;
  if (priceMode === 'OFFERS') return AMOUNT_WITH_OFFERS;
  const amount = fact.value;
  if (priceMode === 'MY_PRICE' && !(typeof amount === 'number' && Number.isSafeInteger(amount) && amount >= 1)) return AMOUNT_NOT_ENTERED;
  return null;
}

const GEOGRAPHY_LABELS: Record<NeedTaskGeography['mode'], string> = { STATIONARY: 'Na jednom mestu', POINT_TO_POINT: 'Od mesta do mesta',
  MULTI_STOP: 'Više stanica', AREA_BASED: 'Na području', REMOTE: 'Na daljinu' };
const REVIEW_TIMEZONE = 'Europe/Belgrade';
export function slotLabel(slot: LocationSlot, stationary = false): string {
  return slot === 'start' ? stationary ? 'Mesto' : 'Polazište' : slot === 'end' ? 'Odredište'
    : slot === 'serviceArea' ? 'Područje' : `Stanica ${Number(slot.split('/')[1]) + 1}`;
}
/**
 * Each place of a task's geography as the review reads it, "Polazište: Lenke Dunđerski · Novi Sad": the STORED words of the public
 * topology (label, city, area), exactly, which is also what the published task will say. This is the reading of that fact and it
 * stays so, even when a pin was moved after the words were written. The owner's reading of a place he has CONFIRMED is
 * `ownerPlace` (ui/location/placeText), which prefers the point's own address; a public surface never uses that one.
 */
export function geographyPlaceLines(geography: NeedTaskGeography): { slot: LocationSlot; parts: string[]; line: string }[] {
  const words = (value: NeedTaskGeographyPoint) => [value.label, value.city, value.area].filter((part): part is string => part !== undefined);
  return locationSlots(geography).flatMap(slot => {
    const place = slot === 'start' ? geography.start : slot === 'end' ? geography.end
      : slot === 'serviceArea' ? geography.serviceArea : geography.waypoints?.[Number(slot.split('/')[1])];
    if (!place) return [];
    const parts = words(place);
    return [{ slot, parts, line: `${slotLabel(slot, geography.mode === 'STATIONARY')}: ${parts.join(' · ')}` }];
  });
}
function geographyReview(geography: NeedTaskGeography): string {
  return [GEOGRAPHY_LABELS[geography.mode], ...geographyPlaceLines(geography).map(place => place.line)].join('\n');
}

/** Human review always reads the typed value, never model-supplied displayValue.
 * Caller controls private-row disclosure; this formatter does not grant access. */
export function factReviewValue(fact: AiNeedV2Fact): string {
  const value = fact.value;
  if (fact.key === 'need.handoff') return serviceHandoffText(value) ?? 'Predaja još nije razjašnjena';
  if (fact.key === 'need.task_geography') {
    const geography = normalizeTaskGeography(value);
    return geography ? geographyReview(geography) : 'Lokacija nije dostupna';
  }
  if (fact.key === 'need.resolved_location') {
    const raw = value as { binding?: { taskCountryCode?: unknown; geography?: unknown; exactAddress?: unknown } } | null;
    const location = normalizeNeedLocation({ ...raw?.binding, accessNotes: null, resolvedLocation: value });
    if (!location?.resolvedLocation) return 'Potvrđene tačke nisu dostupne';
    const points = location.resolvedLocation.points;
    return [`${points.length} od ${locationSlots(location.geography).length} tačaka · ${location.taskCountryCode}`,
      geographyReview(location.geography), ...(location.exactAddress ? [`Tačna adresa: ${location.exactAddress}`] : []),
      ...points.map(point => [
        `${slotLabel(point.slot, location.geography.mode === 'STATIONARY')}: ${(point.latitudeE6 / 1e6).toFixed(6)}, ${(point.longitudeE6 / 1e6).toFixed(6)}`,
        ...(point.address ? [`Adresa tačke: ${point.address}`] : []), ...(point.accessNotes ? [`Pristup: ${point.accessNotes}`] : []),
      ].join('\n'))].join('\n');
  }
  if (fact.valueType === 'TEXT_ARRAY') {
    const values = capabilityTerms(value);
    return values ? values.length ? values.map(item => `• ${item}`).join('\n') : 'Nema navedenih stavki' : 'Podatak nije dostupan';
  }
  if (fact.valueType === 'BOOLEAN') return value === true ? 'Da' : value === false ? 'Ne' : 'Podatak nije dostupan';
  if (fact.valueType === 'INTEGER') {
    if (typeof value !== 'number' || !Number.isInteger(value)) return 'Podatak nije dostupan';
    if (fact.key === 'need.price_rsd') {
      // The typed key owns the currency, including for historical display copies.
      return novac(value, 'RSD');
    }
    return String(value);
  }
  if (fact.valueType === 'TIMESTAMPTZ') {
    const instant = calendarInstant(value);
    if (instant === null) return 'Termin nije dostupan';
    try {
      const milliseconds = instant >= 0 ? instant / 1000n : (instant - 999n) / 1000n;
      const parts = zonedParts(new Date(Number(milliseconds)), REVIEW_TIMEZONE);
      // Include date/year/seconds and exact fractional precision, never device timezone.
      const fraction = typeof value === 'string' ? /\.(\d+)(?:Z|[+-])/.exec(value)?.[1] : undefined;
      return `${displayDate(parts.date)} ${parts.date.slice(0, 4)} · ${parts.time}${fraction ? `.${fraction}` : ''} (vreme u Beogradu)`;
    } catch { return 'Termin nije dostupan'; }
  }
  if (fact.key === 'need.price_mode') return typeof value === 'string' ? PRICE_LABELS[value] ?? 'Način cene nije dostupan' : 'Način cene nije dostupan';
  if (fact.key === 'need.price_basis') return typeof value === 'string' ? PRICE_BASIS_LABELS[value] ?? 'Osnova cene nije dostupna' : 'Osnova cene nije dostupna';
  if (fact.key === 'need.schedule_kind') return typeof value === 'string' ? SCHEDULE_LABELS[value] ?? 'Vrsta termina nije dostupna' : 'Vrsta termina nije dostupna';
  return typeof value === 'string' ? value : 'Podatak nije dostupan';
}

export function safetyMessage(safety: AiNeedSafety): string | null {
  switch (safety) {
    case 'BLOCK':
      return 'Ovaj zahtev ne može da nastavi kroz AI unos.';
    case 'REVIEW':
      return 'Zahtev traži dodatnu proveru pre objavljivanja. Nacrt možete pregledati i sačuvati.';
    case 'CLARIFY':
      return 'AI još razjašnjava važan podatak. Odgovorite u razgovoru pre završnog pregleda.';
    case 'ALLOW':
    default:
      return null;
  }
}
