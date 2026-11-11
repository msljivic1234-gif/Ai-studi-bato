import type { NeedFactV2Key } from '../contracts/needFactsV2';
import { decodeServiceHandoff } from '../contracts/serviceHandoff';
import { calendarInstant } from '../lib/calendarTime';
import { normalizeTaskGeography } from '../lib/location';

/** The server's own refusals for these facts, in the words the review shows before the tap. */
export const REVIEW_FACT_COPY = {
  MY_PRICE_AMOUNT_REQUIRED: 'Unesi iznos ili izaberi prikupljanje ponuda.',
  FIXED_WINDOW_BOUNDS_REQUIRED: 'Tačan termin mora imati početak; ako je kraj naveden, mora biti posle početka.',
  FIXED_WINDOW_START_PASSED: 'Početak termina je već prošao. Izmeni termin u pregledu, pa objavi.',
  HANDOFF_REQUIRED: 'Reci kako se rezultat predaje: samo onlajn, lično preuzimanje ili slanje.',
} as const;

type ReviewFacts = Readonly<{
  publicProjection: readonly Readonly<{ key: NeedFactV2Key; value: unknown; status?: string }>[];
  location?: Readonly<{ geography?: unknown }> | null;
}>;

/** Defence for historical immutable reviews: current DEV prepares also include
 * the typed REMOTE handoff in missingRequired. Keep older reviews readable and
 * show the missing answer before Save/Publish, without changing their digest. */
export function reviewMissingRemoteHandoff(review: ReviewFacts): boolean {
  const active = (key: NeedFactV2Key) => review.publicProjection.find(f => f.key === key && f.status !== 'UNKNOWN')?.value;
  const geography = normalizeTaskGeography(review.location?.geography ?? active('need.task_geography'));
  return geography?.mode === 'REMOTE' && decodeServiceHandoff(active('need.handoff')) === null;
}

/** A fixed time that has already begun cannot be offered to anyone (deep read 5.1). */
export function reviewStartPassed(review: ReviewFacts, now = Date.now()): boolean {
  const fact = (key: NeedFactV2Key) => review.publicProjection.find(f => f.key === key)?.value;
  if (fact('need.schedule_kind') !== 'FIXED_WINDOW') return false;
  const start = calendarInstant(fact('need.starts_at'));
  return start !== null && start <= BigInt(now) * 1000n;
}

/** Facts that the signed draft writer refuses as well as publication. A past,
 * otherwise valid start can still be kept in a private draft for correction. */
export function reviewDraftWriteProblem(review: ReviewFacts): string | null {
  const fact = (key: NeedFactV2Key) => review.publicProjection.find(f => f.key === key)?.value;
  if (reviewMissingRemoteHandoff(review)) return REVIEW_FACT_COPY.HANDOFF_REQUIRED;
  if (fact('need.price_mode') === 'MY_PRICE') {
    const amount = fact('need.price_rsd');
    if (typeof amount !== 'number' || !Number.isSafeInteger(amount) || amount < 1) return REVIEW_FACT_COPY.MY_PRICE_AMOUNT_REQUIRED;
  }
  if (fact('need.schedule_kind') === 'FIXED_WINDOW') {
    const start = calendarInstant(fact('need.starts_at'));
    const endValue = fact('need.ends_at');
    // Optional end is different from an explicitly supplied but invalid end.
    const hasEnd = endValue !== null && endValue !== undefined;
    const end = hasEnd ? calendarInstant(endValue) : null;
    if (start === null || (hasEnd && (end === null || end <= start))) return REVIEW_FACT_COPY.FIXED_WINDOW_BOUNDS_REQUIRED;
  }
  return null;
}

/** What the server would refuse about the reviewed facts or publication timing,
 * said before the tap without mutating the signed review. */
export function reviewFactProblem(review: ReviewFacts, now = Date.now()): string | null {
  return reviewDraftWriteProblem(review)
    ?? (reviewStartPassed(review, now) ? REVIEW_FACT_COPY.FIXED_WINDOW_START_PASSED : null);
}
