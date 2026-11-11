import type { NeedLocationInput } from '../../contracts/location';
import type { NeedFactV2Key } from '../../contracts/needFactsV2';
import { serviceHandoffText } from '../../contracts/serviceHandoff';
import type { JavniProfilProjekcija, NeedScheduleProjection, PrilikaProjekcija } from '../../contracts/projections';
import { needScheduleText } from '../../data/needDetailPresentation';
import { calendarInstant } from '../../lib/calendarTime';
import { capabilityTerms } from '../../lib/capabilityTerms';
import { DOGOVORENA_ZONA } from '../../lib/dogovorenoVreme';
import { normalizeTaskGeography, podrucjeTekst } from '../../lib/location';
import { novac } from '../../lib/novac';
import { publicAnchorPoint } from './reviewFacts';

/**
 * The task of a review as the people who will read it get it: the same projection the list, the map and the detail are drawn from
 * (`PrilikaProjekcija`), made of the review's PUBLIC facts alone, so the publish review can draw the real task card and the real
 * detail from what the owner is about to publish (owner, 8 Oct 2026: "on vidi kako će drugi videti taj zadatak").
 *
 * Pure: no service, no Supabase. The rules are the server's own, written the way it materialises a task when it publishes it
 * (`approximate_city` and `approximate_area` come from the start of the topology, else from its service area; remote work says "Na
 * daljinu"; the amount is the task's only under "Moja cena"; the approximate point is the one `publicAnchorPoint` computes), and the
 * words are the ones the published task is drawn in (`podrucjeTekst`, `needScheduleText`, `novac`). Nothing is invented:
 * - a fact the review does not carry, or marks UNKNOWN, is not a value (no title, no description, no schedule, no point);
 * - a private fact (the exact address, the access notes, the confirmed points) is never read here; the only thing taken from the
 *   place is the point rounded to two decimals, exactly what a stranger's map shows;
 * - the person is the owner as the public profile read says it, and nobody when it could not be read (no name, no rating).
 */

/** The part of a review this needs: the public facts, the deadline and the place (for the approximate point only). */
export type ReviewSource = Readonly<{
  reviewId: string; draftId: string | null; responseDeadline: string | null; location: NeedLocationInput | null;
  publicProjection: readonly Readonly<{ key: NeedFactV2Key; value: unknown; privacyClass: 'PUBLIC' | 'PRIVATE'; status: string }>[];
}>;

/** The owner as others read them: the name, and the rating with the reviews it stands on, only when the public read says so. */
export type PreviewPerson = Readonly<{
  profileId: string; name: string; rating: string | null; reviewCount: number | null; avatarId?: string | null;
}>;

/** The words of a term that is not set yet. A card never leaves the calendar row empty. */
export const SCHEDULE_NOT_SET = 'Termin još nije naveden';

const SCHEDULE_KINDS: readonly NeedScheduleProjection['kind'][] = ['FIXED_WINDOW', 'FLEXIBLE', 'REMOTE_ANYTIME', 'TODAY_FLEXIBLE', 'TOMORROW_FLEXIBLE', 'WEEK_FLEXIBLE'];

const wholeNumber = (value: unknown, least: number): number | null =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= least ? value : null;
const trimmed = (value: unknown): string => typeof value === 'string' ? value.trim() : '';

export function reviewAsTask(review: ReviewSource, person: PreviewPerson | null = null): PrilikaProjekcija {
  const fact = (key: NeedFactV2Key): unknown =>
    review.publicProjection.find(item => item.key === key && item.privacyClass === 'PUBLIC' && item.status !== 'UNKNOWN')?.value;
  const text = (key: NeedFactV2Key): string | null => { const value = fact(key); return typeof value === 'string' && value.trim() ? value : null; };
  const has = (key: NeedFactV2Key): boolean => fact(key) !== undefined && fact(key) !== null;
  const terms = (key: NeedFactV2Key): string[] => capabilityTerms(fact(key)) ?? [];
  const instant = (key: NeedFactV2Key): string | null => { const value = fact(key); return typeof value === 'string' && calendarInstant(value) !== null ? value : null; };

  const geography = normalizeTaskGeography(fact('need.task_geography'));
  const remote = geography?.mode === 'REMOTE';
  // The server keeps the start's city and area, and the service area's where the start has none.
  const city = trimmed(geography?.start?.city) || trimmed(geography?.serviceArea?.city);
  const area = trimmed(geography?.start?.area) || trimmed(geography?.serviceArea?.area);

  const kind = SCHEDULE_KINDS.find(item => item === fact('need.schedule_kind'));
  const schedule: NeedScheduleProjection | undefined = kind ? { kind, startsAt: instant('need.starts_at'), endsAt: instant('need.ends_at') } : undefined;

  const people = wholeNumber(fact('need.people_needed'), 1) ?? 1;
  const mode = fact('need.price_mode');
  const priceMode = mode === 'MY_PRICE' || mode === 'OFFERS' ? mode : undefined;
  const amount = wholeNumber(fact('need.price_rsd'), 1);
  const basis = fact('need.price_basis');
  const anchor = publicAnchorPoint(review.location);

  const skills = terms('need.required_skills'), tools = terms('need.required_tools'), vehicles = terms('need.required_vehicles');
  const description = text('need.description');
  const handoff = serviceHandoffText(fact('need.handoff'));
  const conditions = [...terms('need.critical_conditions'), ...(handoff ? [`Predaja: ${handoff}`] : [])];

  return {
    id: review.draftId ?? review.reviewId,
    naslov: text('need.title') ?? '',
    ...(description ? { opis: description } : {}),
    statusTekst: 'Traži ponude',
    // `null` is "no cutoff"; the review's own deadline is exactly what the published task will carry.
    rokZaPrijaveIso: review.responseDeadline,
    detalji: {
      kategorija: text('need.category') ?? '', geografija: geography, rezimLokacije: geography?.mode ?? null,
      zahtevi: { vestine: skills, alati: tools, vozila: vehicles, dozvole: terms('need.required_licenses'),
        bitniUslovi: conditions.length || has('need.critical_conditions') ? [...new Set(conditions)] : null,
        iskustvoGodina: wholeNumber(fact('need.minimum_experience_years'), 0), potvrdjenIdentitet: fact('need.verified_identity_required') === true },
    },
    podrucjeTekst: remote ? 'Na daljinu' : podrucjeTekst(area, city),
    ...(text('need.task_country_code') ? { taskCountryCode: text('need.task_country_code')! } : {}),
    // Every moment of the review is stated in Serbian time; the published card reads the same zone.
    taskTimezone: DOGOVORENA_ZONA,
    ...(schedule ? { schedule } : {}),
    vremeTekst: schedule ? needScheduleText(schedule, DOGOVORENA_ZONA) : SCHEDULE_NOT_SET,
    pokrivenost: { ukupno: people, popunjeno: 0, preostalo: people, udeo: 0 },
    uslovi: [...skills, ...tools, ...vehicles],
    narucilacProfilId: person?.profileId ?? '',
    narucilacIme: person?.name ?? '',
    narucilacOcena: person?.rating ?? null,
    ...(person ? { narucilacBrojOcena: person.reviewCount } : {}),
    ...(person?.avatarId ? { narucilacAvatarId: person.avatarId } : {}),
    priblizno: anchor ? { lat: anchor.latitude, lng: anchor.longitude } : null,
    ...(priceMode ? { rezimCene: priceMode } : {}),
    osnovaCene: basis === 'TOTAL' || basis === 'PER_PERSON' || basis === 'HOURLY' ? basis : null,
    // An amount left from before is not the price of a task that asks for offers: it is no price at all.
    ...(priceMode === 'MY_PRICE' && amount ? { ponudjenaCena: { iznos: amount, valuta: 'RSD', prikaz: novac(amount) } } : {}),
  };
}

/**
 * The owner as the public profile read says it (what the others read: the name, the rating and how many reviews it stands on).
 * The rating is drawn only when the server marks it available, the count only when it discloses reviews: nothing is guessed, so a
 * rating of one review cannot pass for fifty. `fallbackName` is the name of the account when the profile read could not be made.
 */
export function previewPerson(profileId: string, fallbackName: string, profile: JavniProfilProjekcija | null): PreviewPerson {
  const trust = profile?.poverenje;
  const average = trust?.ocenaDostupna && typeof trust.ocenaProsek === 'number' && Number.isFinite(trust.ocenaProsek) ? trust.ocenaProsek : null;
  const count = trust?.recenzijeDostupne && typeof trust.brojRecenzija === 'number' && Number.isSafeInteger(trust.brojRecenzija) && trust.brojRecenzija >= 0
    ? trust.brojRecenzija : null;
  return { profileId, name: trimmed(profile?.ime) || trimmed(fallbackName),
    rating: average === null ? null : average.toLocaleString('sr-Latn-RS', { minimumFractionDigits: 1, maximumFractionDigits: 1 }), reviewCount: count };
}
