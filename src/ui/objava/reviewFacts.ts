import type { AiNeedV2Fact } from '../../contracts/aiNeedV2';
import type { NeedLocationInput } from '../../contracts/location';
import { NEED_FACT_V2_DEFINITIONS, type LocationSlot, type NeedFactV2Key } from '../../contracts/needFactsV2';
import { factLabel, factReviewValue, slotLabel } from '../../data/aiNeedV2Ui';
import { REVIEW_FACT_COPY } from '../../data/reviewFactProblem';
import { capabilityTerms } from '../../lib/capabilityTerms';
import { dogovorenoVreme } from '../../lib/dogovorenoVreme';
import { locationSlots, normalizeNeedLocation, normalizeTaskGeography, pointsMissing } from '../../lib/location';
import { novac } from '../../lib/novac';
import type { LocationOverviewPoint } from '../location/LocationOverviewMap.types';
import { normalizedPlaceText, ownerPlaces } from '../location/placeText';

/** Owner-only review points in task order. Never use this for a public projection. */
export function privateReviewMap(location: NeedLocationInput | null | undefined): {
  points: readonly LocationOverviewPoint[]; route: boolean;
} {
  const value = normalizeNeedLocation(location);
  if (!value?.resolvedLocation || value.geography.mode === 'REMOTE') return { points: [], route: false };
  const slots = locationSlots(value.geography);
  const stationary = value.geography.mode === 'STATIONARY';
  const points = slots.flatMap(slot => {
    const point = value.resolvedLocation!.points.find(item => item.slot === slot);
    return point ? [{ id: slot, label: slotLabel(slot, stationary),
      latitude: point.latitudeE6 / 1e6, longitude: point.longitudeE6 / 1e6 }] : [];
  });
  return { points, route: (value.geography.mode === 'POINT_TO_POINT' || value.geography.mode === 'MULTI_STOP')
    && slots.length === points.length };
}

/**
 * The places the owner CONFIRMED, as the short lines he reads at the top of the private half of the review: "Pavla Ivića 6, Novi Sad",
 * with the role of the place when there are several ("Polazište", "Odredište"). They come from the confirmed points' own addresses (the
 * shared owner place line), never from the task's public words, which the first text wrote and a moved pin does not rewrite (owner,
 * 2026-10-07). A slot with no confirmed point has no line here: "Još treba" already says so. Owner only; never a public surface.
 */
export function ownerPlaceLines(location: NeedLocationInput | null | undefined): { slot: LocationSlot; title: string; text: string }[] {
  const value = normalizeNeedLocation(location);
  if (!value?.resolvedLocation || value.geography.mode === 'REMOTE') return [];
  const stationary = value.geography.mode === 'STATIONARY';
  return ownerPlaces({ geography: value.geography, exactAddress: value.exactAddress, points: value.resolvedLocation.points })
    .filter(place => place.source !== 'GEOGRAPHY')
    .map(place => ({ slot: place.slot, title: slotLabel(place.slot, stationary), text: place.text }));
}

/**
 * What the publish review shows in a fact's row. Pure (no service, no Supabase), so a screen suite can import it.
 *
 * `factReviewValue` stays the exact reading a correction is seeded from; this is only what a person reads: a moment in
 * the app's one time format (no seconds, "po vremenu u Srbiji" only on a phone in another zone), money with its grouping
 * and currency, and the confirmed points as a count and their private details, never coordinates or a country code.
 */
export function reviewRowValue(fact: AiNeedV2Fact): string {
  if (fact.valueType === 'TIMESTAMPTZ') return dogovorenoVreme(fact.value, 'Termin nije naveden');
  if (fact.key === 'need.price_rsd') return typeof fact.value === 'number' && Number.isSafeInteger(fact.value)
    ? novac(fact.value) : 'Nije navedeno';
  if (fact.key === 'need.resolved_location') {
    const raw = fact.value as { binding?: { taskCountryCode?: unknown; geography?: unknown; exactAddress?: unknown } } | null;
    const location = normalizeNeedLocation({ ...raw?.binding, accessNotes: null, resolvedLocation: fact.value });
    if (!location?.resolvedLocation) return 'Potvrđene tačke nisu dostupne';
    const points = location.resolvedLocation.points, total = locationSlots(location.geography).length;
    const stationary = location.geography.mode === 'STATIONARY';
    // One point needs no name; several say which one each detail belongs to.
    const named = (slot: typeof points[number]['slot'], text: string) => total > 1 ? `${slotLabel(slot, stationary)} · ${text}` : text;
    return [`Potvrđeno tačaka: ${points.length} od ${total}`, ...points.flatMap(point => [
      ...(point.address ? [named(point.slot, `Adresa tačke: ${point.address}`)] : []),
      ...(point.accessNotes ? [named(point.slot, `Pristup: ${point.accessNotes}`)] : []),
    ])].join('\n');
  }
  return factReviewValue(fact);
}

export type PublicAnchor = { latitude: number; longitude: number };

/**
 * The approximate point the public map will show once the task is published, computed the way the server does it
 * (`private.materialize_resolved_location`, migration 20260910130851): the service area's point for work on an area
 * that has one, otherwise the start point, rounded to two decimals half away from zero (Postgres `round`). No confirmed
 * anchor point, or remote work, means no point: nothing is invented.
 */
export function publicAnchorPoint(location: NeedLocationInput | null | undefined): PublicAnchor | null {
  if (!location || location.geography.mode === 'REMOTE' || !location.resolvedLocation) return null;
  const slot = location.geography.mode === 'AREA_BASED' && location.geography.serviceArea ? 'serviceArea' : 'start';
  const point = location.resolvedLocation.points.find(item => item.slot === slot);
  if (!point) return null;
  const round = (e6: number) => Math.sign(e6) * Math.round(Math.abs(e6) / 1e4) / 100;
  return { latitude: round(point.latitudeE6), longitude: round(point.longitudeE6) };
}

/** One thing that still stands between the review and publication, and where it is fixed. */
export type ReviewTodo = { key: string; text: string;
  /** `conversation` goes back to the conversation, `location` opens the place, a fact key opens that row's editor. */
  target: 'conversation' | 'location' | NeedFactV2Key | null };

type ReviewLocation = { location: unknown; publicProjection?: readonly { key: string; value: unknown; status?: string }[] };

/** Map readiness only: a draft may be accepted before all physical slots are confirmed.
 * Count only points whose complete country/geography/address binding passes the existing decoder.
 * This does not grant publication authority; the server still checks the signed review and publication. */
export function reviewLocationReadiness(review: ReviewLocation) {
  const normalized = normalizeNeedLocation(review.location);
  const raw = review.location && typeof review.location === 'object'
    ? review.location as { geography?: unknown } : null;
  const geography = normalizeTaskGeography(raw?.geography
    ?? review.publicProjection?.find(fact => fact.key === 'need.task_geography' && fact.status !== 'UNKNOWN')?.value);
  const remote = geography?.mode === 'REMOTE';
  const points = pointsMissing(geography, normalized?.resolvedLocation);
  return { geography, ...points, ready: remote || (!!normalized && points.total > 0 && points.done === points.total) };
}

/**
 * "Još treba", in order: a safety block, what is missing (never naming the category, owner decision 2026-09-21), the
 * place on the map, then what the server would refuse about the facts themselves. The unavailable identity condition is
 * its own block with its own action, not a row here.
 */
export function reviewTodos(review: ReviewLocation & { safety: string; missingRequired: readonly NeedFactV2Key[]; canAccept?: boolean },
  factProblem: string | null, identityBlock = false): ReviewTodo[] {
  const todos: ReviewTodo[] = [];
  if (review.safety === 'BLOCK') todos.push({ key: 'safety', text: 'Zadatak ne može da se objavi ovako. Izmenite ga u razgovoru.', target: 'conversation' });
  // Plain-language fact remedies already explain these below; do not say the same missing fact twice.
  const missing = review.missingRequired.filter(key => key !== 'need.category'
    && !(factProblem === REVIEW_FACT_COPY.HANDOFF_REQUIRED && key === 'need.handoff')
    && !(factProblem === REVIEW_FACT_COPY.MY_PRICE_AMOUNT_REQUIRED && key === 'need.price_rsd')
    && !((factProblem === REVIEW_FACT_COPY.FIXED_WINDOW_BOUNDS_REQUIRED || factProblem === REVIEW_FACT_COPY.FIXED_WINDOW_START_PASSED)
      && (key === 'need.starts_at' || key === 'need.ends_at')));
  if (missing.length) todos.push({ key: 'missing', text: `Nedostaje: ${missing.map(factLabel).join(', ')}.`, target: 'conversation' });
  else if (review.missingRequired.includes('need.category')) todos.push({ key: 'missing', text: 'Treba još malo o samom zadatku.', target: 'conversation' });
  if (!reviewLocationReadiness(review).ready) todos.push({ key: 'location', text: 'Mesto na mapi nije potvrđeno.', target: 'location' });
  if (factProblem) todos.push({ key: 'fact', text: factProblem, target: factProblem === REVIEW_FACT_COPY.MY_PRICE_AMOUNT_REQUIRED
    ? 'need.price_rsd' : factProblem === REVIEW_FACT_COPY.FIXED_WINDOW_BOUNDS_REQUIRED || factProblem === REVIEW_FACT_COPY.FIXED_WINDOW_START_PASSED
      ? 'need.starts_at' : factProblem === REVIEW_FACT_COPY.HANDOFF_REQUIRED ? 'conversation' : null });
  // A refusal the rows above do not name still says where it is fixed, so a grey publish never stands without a reason.
  if (review.canAccept === false && !todos.length && !identityBlock)
    todos.push({ key: 'other', text: 'Zadatku je potrebna dopuna u razgovoru.', target: 'conversation' });
  return todos;
}

/**
 * The word of the way out of a "Još treba" row, drawn under its sentence in the action's green so the row reads as what it is (owner's
 * phone, 2026-10-07: "Početak termina je već prošao. Izmeni termin u pregledu, pa objavi." stood beside a grey publish with only a faint
 * arrow). The time and the amount open their own editor in place, the place opens the place step, and `viaConversation` is a row whose
 * fix is made in the conversation: a safety block, what is missing, or a fact this screen has no row to edit.
 */
export function todoActionLabel(todo: ReviewTodo, viaConversation = todo.target === 'conversation'): string | undefined {
  if (todo.text === REVIEW_FACT_COPY.HANDOFF_REQUIRED) return 'Izaberite predaju';
  if (viaConversation) return todo.key === 'safety' ? 'Izmenite u razgovoru' : 'Dopunite u razgovoru';
  if (todo.target === 'location') return 'Dodajte mesto';
  if (todo.target === 'need.starts_at' || todo.target === 'need.ends_at') return 'Izmenite termin';
  if (todo.target === 'need.price_rsd') return 'Unesite iznos';
  return todo.target ? 'Izmenite' : undefined;
}

/**
 * Whether support has an operator on duty to take a task held for a manual check (deep read 8.7: it has none yet). Owner decision
 * d07, 2026-10-07: while it has none, the review offers ONLY "Izmeni zadatak" for that situation. "Zatraži pregled podrške" stood
 * right under the sentence that says nobody is on duty, and a request nobody reads is a promise the app cannot keep. The day an
 * operator exists this is the one line to change; the entry and the sentence below follow it.
 */
export const SUPPORT_HAS_DUTY_OPERATOR = false;

/** What the review says when the check ended in "REVIEW": the fact, and, while nobody is on duty, the way that works. */
export function manualCheckCopy(operatorOnDuty: boolean = SUPPORT_HAS_DUTY_OPERATOR): string {
  const held = 'Zadatak zahteva ručnu proveru i još nije objavljen.';
  return operatorOnDuty ? held : `${held} Podrška još nema dežurnog operatera, pa je najbrže da ga izmenite i ponovo pošaljete.`;
}

/* ------------------------------------------------------------------------------------------------ the parts of the preview */

/** What a part of the preview needs of a fact: where it is corrected (`id`), which fact it is and what it holds. */
export type PartFactLike = Readonly<{ id: string | null; key: NeedFactV2Key; value: unknown }>;

/**
 * The facts that ONE line of the task is made of. The price is three facts (how it works, the amount, what it is for) and the
 * time is three (what kind of time, the start, the end), but the task draws each as one line, so the line has one pencil and the
 * others are one tap away inside the editor it opens (`groupedFacts`). Nothing about how a fact is corrected changes: each is
 * still corrected one at a time, with its own editor and its own command.
 */
const PART_GROUPS = {
  value: ['need.price_rsd', 'need.price_mode', 'need.price_basis'],
  time: ['need.schedule_kind', 'need.starts_at', 'need.ends_at'],
} as const satisfies Record<string, readonly NeedFactV2Key[]>;
export type GroupedPart = keyof typeof PART_GROUPS;

/** What each fact of a grouped line is called when a person chooses between them. */
export const GROUPED_FACT_LABEL: Readonly<Partial<Record<NeedFactV2Key, string>>> = {
  'need.price_rsd': 'Iznos', 'need.price_mode': 'Način cene', 'need.price_basis': 'Osnova cene',
  'need.schedule_kind': 'Vrsta termina', 'need.starts_at': 'Početak', 'need.ends_at': 'Kraj',
};

/** The facts of a grouped line that can be corrected here (they have an id), in the group's own order. */
export function groupedFacts<T extends PartFactLike>(part: GroupedPart, facts: readonly T[]): T[] {
  return PART_GROUPS[part].flatMap(key => facts.filter(fact => fact.key === key && !!fact.id));
}

/**
 * The fact the pencil of a grouped line opens first: what a person most likely means by "change it". Under "Moja cena" that is the
 * amount and under "Ponude" the way the price works (there is no amount to change); for a fixed time it is the start, for any other
 * time the kind of time. A fact with no id cannot be corrected here, so the pencil falls to whatever can be; none at all means no
 * pencil (the conversation is the way then).
 */
export function partFact<T extends PartFactLike>(part: GroupedPart, facts: readonly T[]): T | undefined {
  const editable = groupedFacts(part, facts);
  const valueOf = (key: NeedFactV2Key) => facts.find(fact => fact.key === key)?.value;
  const order: readonly NeedFactV2Key[] = part === 'value'
    ? valueOf('need.price_mode') === 'MY_PRICE' ? ['need.price_rsd', 'need.price_mode', 'need.price_basis'] : ['need.price_mode', 'need.price_rsd', 'need.price_basis']
    : valueOf('need.schedule_kind') === 'FIXED_WINDOW' ? ['need.starts_at', 'need.schedule_kind', 'need.ends_at'] : ['need.schedule_kind', 'need.starts_at', 'need.ends_at'];
  for (const key of order) {
    const found = editable.find(fact => fact.key === key);
    if (found) return found;
  }
  return undefined;
}

/** The grouped line a fact belongs to, or null when it stands alone. */
export function groupOf(key: NeedFactV2Key): GroupedPart | null {
  return (Object.keys(PART_GROUPS) as GroupedPart[]).find(part => (PART_GROUPS[part] as readonly NeedFactV2Key[]).includes(key)) ?? null;
}

/**
 * The requirement lines of the detail (`needRequirementRows`) and the fact each is corrected in. "Identitet" has no entry: its row is
 * not a fact to correct, and its way out is its own block ("Ukloni uslov i nastavi").
 */
export const REQUIREMENT_FACT: Readonly<Record<string, NeedFactV2Key>> = {
  'Veštine': 'need.required_skills', 'Alat': 'need.required_tools', 'Vozilo': 'need.required_vehicles', 'Dozvole': 'need.required_licenses',
  'Bitni uslovi': 'need.critical_conditions', 'Najmanje iskustva': 'need.minimum_experience_years',
};

/** A list fact with nothing in it: the detail draws no line for it, so the review names it among what can still be added. */
export function blankList(fact: Readonly<{ key: NeedFactV2Key; value: unknown }>): boolean {
  return NEED_FACT_V2_DEFINITIONS[fact.key].valueType === 'TEXT_ARRAY' && (capabilityTerms(fact.value)?.length ?? 0) === 0;
}

/**
 * The words of the application deadline, as the people who apply read them ("Prijave do 12. okt · 12:15", in Serbian time, named so on a
 * phone in another zone). No deadline is "Bez posebnog roka" and no more: the part is named "Prijave", and what it means that there is none (the
 * search goes on until the task is filled or its owner stops it) is a sentence the screen does not need (rule J5, one sentence of explanation).
 */
export function deadlineWords(responseDeadline: string | null, decision?: 'UNSPECIFIED' | 'NONE' | 'AT'): string {
  return decision === 'UNSPECIFIED' ? 'Rok za prijave još nije određen'
    : responseDeadline ? `Prijave do ${dogovorenoVreme(responseDeadline)}` : 'Bez posebnog roka';
}

/**
 * What the owner reads in the frame of the exact address (his and nobody else's, until a Dogovor): the confirmed places in their short
 * words, the address as it was stored when it says more than those lines, what he wrote about getting in, and how many of the points
 * are still to be confirmed. The words of the places are the confirmed points' own (`ownerPlaceLines`), so a pin moved after the
 * first text is what is read. Owner only; never a public surface.
 */
export type AddressFrame = {
  places: { slot: LocationSlot; title: string; text: string }[];
  /** The address as stored. It stays only when it is not the very line a confirmed point already says. */
  fullAddress: string | null;
  notes: { title: string | null; text: string }[];
  /** Only while some of the points are confirmed and some are not. */
  unconfirmed: { done: number; total: number } | null;
};
export function ownerAddressFrame(location: NeedLocationInput | null | undefined,
  privateFacts: readonly Readonly<{ key: NeedFactV2Key; value: unknown }>[]): AddressFrame {
  const places = ownerPlaceLines(location);
  const read = (key: NeedFactV2Key): string | null => {
    const value = privateFacts.find(fact => fact.key === key)?.value;
    return typeof value === 'string' && value.trim() ? value.trim() : null;
  };
  const stored = read('need.exact_address'), access = read('need.access_notes');
  const fullAddress = stored && !places.some(place => normalizedPlaceText(place.text) === normalizedPlaceText(stored)) ? stored : null;
  const value = normalizeNeedLocation(location);
  const stationary = value?.geography.mode === 'STATIONARY';
  const pointNotes = (value?.resolvedLocation?.points ?? []).flatMap(point => point.accessNotes?.trim() ? [{ slot: point.slot, text: point.accessNotes.trim() }] : [])
    .filter(note => note.text !== access);
  const notes = [...(access ? [{ title: null, text: access }] : []),
    ...pointNotes.map(note => ({ title: access || pointNotes.length > 1 ? slotLabel(note.slot, stationary) : null, text: note.text }))];
  const missing = value ? pointsMissing(value.geography, value.resolvedLocation) : null;
  return { places, fullAddress, notes, unconfirmed: missing && missing.done > 0 && missing.done < missing.total ? missing : null };
}
