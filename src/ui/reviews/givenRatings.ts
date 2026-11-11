import type { DogovorProjekcija } from '../../contracts/projections';
import type { Ishod } from '../../data/ports';
import type { ReviewContext } from '../../data/reviewsClientService';

/**
 * The ratings a person GAVE, built only from what the app can already read (T4a, 2026-10-07): the person's Dogovori that are
 * finished, and for each of them the review the person left (`rpc_get_my_agreement_review`, or its D12 twin when the build has
 * comments). Nothing is invented: a Dogovor whose review could not be read is counted as one that could not be read, never as
 * one that was not rated.
 *
 * The ratings a person RECEIVED are not here, because the backend has no read that lists them: it answers the average
 * (`rpc_get_account_reputation`) and, with D12, the written comments about a profile (`rpc_list_review_comments_v1`), and the
 * table of reviews itself is private. A list of received ratings (stars, date, the Dogovor, who gave it) needs one new read of
 * its own, `rpc_list_received_reviews_v1`, keyset-paged like the comments reader, that answers only the caller's own account.
 */

/** How many finished Dogovori are asked about in one step; the rest wait for "Prikaži starije". */
export const GIVEN_STEP = 15;
/** How many receipts are read at once. */
export const GIVEN_CONCURRENCY = 4;

export type GivenPerson = { name: string | null; initials: string | null; profileId: string | null };
export type GivenRating = {
  agreementId: string; rating: number; createdAt: string;
  /** The Dogovor's own title, as the list read it. */ title: string;
  /** The written comment (D12), only where the build and the backend carry comments. */ comment: string | null;
  /** The other side of the Dogovor, as the Dogovor named them; absent when it did not. */ person: GivenPerson | null;
};

/** The finished Dogovori of a list, in the order it came (newest first). Only a finished Dogovor can have been rated. */
export const finishedAgreements = (agreements: readonly DogovorProjekcija[]): DogovorProjekcija[] =>
  agreements.filter(agreement => agreement.stanje === 'COMPLETED');

/** One rating a person gave, or null when the receipt says there is none (the rating is still due, or its time has passed). */
export function givenRating(agreement: DogovorProjekcija, context: ReviewContext): GivenRating | null {
  const review = context.review;
  if (!review) return null;
  const other = agreement.ucesnici.find(participant => participant.id === context.targetAccountId);
  const comment = typeof review.comment === 'string' && review.comment.trim() ? review.comment : null;
  return {
    agreementId: agreement.id, rating: review.rating, createdAt: review.createdAt, title: agreement.naslov, comment,
    person: other ? { name: other.ime?.trim() || null, initials: other.inicijali?.trim() || null, profileId: other.profilId } : null,
  };
}

/** Newest rating first; the same instant keeps the order the Dogovori came in. */
export const newestFirst = (rows: readonly GivenRating[]): GivenRating[] =>
  rows.map((row, index) => ({ row, index })).sort((left, right) => Date.parse(right.row.createdAt) - Date.parse(left.row.createdAt) || left.index - right.index)
    .map(entry => entry.row);

export type GivenStep = { rows: GivenRating[]; failed: string[] };

/**
 * Asks about each Dogovor of a step, a few at a time. A receipt that cannot be read lands in `failed` (so the screen can say so
 * and offer to read exactly those again); a step that is no longer wanted (`isCurrent` turns false: another account, a newer
 * read, the screen left) answers null, and nothing of it is used.
 */
export async function readGivenStep(agreements: readonly DogovorProjekcija[], readContext: (agreementId: string) => Promise<Ishod<ReviewContext>>,
  isCurrent: () => boolean, concurrency = GIVEN_CONCURRENCY): Promise<GivenStep | null> {
  const rows: GivenRating[] = [], failed: string[] = [];
  let next = 0;
  async function worker() {
    while (next < agreements.length && isCurrent()) {
      const agreement = agreements[next++];
      // Anything that goes wrong with one Dogovor (the read, or a receipt that is not what it should be) is that Dogovor
      // not being read, never a rating that is not there and never a step that stops.
      let outcome: GivenRating | null | 'failed';
      try {
        const answer = await readContext(agreement.id);
        outcome = answer.ok ? givenRating(agreement, answer.podatak) : 'failed';
      } catch { outcome = 'failed'; }
      if (!isCurrent()) return;
      if (outcome === 'failed') failed.push(agreement.id);
      else if (outcome) rows.push(outcome);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, agreements.length) }, worker));
  return isCurrent() ? { rows: newestFirst(rows), failed } : null;
}

/** What the screen holds: the finished Dogovori, how many of them were asked about, and what came of it. */
export type GivenState = {
  finished: readonly DogovorProjekcija[]; asked: number; rows: readonly GivenRating[]; failed: readonly string[];
};
export const startGiven = (agreements: readonly DogovorProjekcija[]): GivenState => ({ finished: finishedAgreements(agreements), asked: 0, rows: [], failed: [] });

/** The next step's Dogovori: a step of those not yet asked about. */
export const nextGiven = (state: GivenState, size = GIVEN_STEP): DogovorProjekcija[] => state.finished.slice(state.asked, state.asked + size);
/** The Dogovori whose receipt could not be read, to be asked again. */
export const failedGiven = (state: GivenState): DogovorProjekcija[] => state.finished.filter(agreement => state.failed.includes(agreement.id));
export const hasOlderGiven = (state: GivenState) => state.asked < state.finished.length;

const merged = (state: GivenState, step: GivenStep) => {
  const seen = new Set(state.rows.map(row => row.agreementId));
  return newestFirst([...state.rows, ...step.rows.filter(row => !seen.has(row.agreementId))]);
};
/** The state after the next `asked` Dogovori were read: their ratings are in (a Dogovor never twice), their failures are added. */
export const afterNextGiven = (state: GivenState, step: GivenStep, asked: number): GivenState =>
  ({ finished: state.finished, asked: state.asked + asked, rows: merged(state, step), failed: [...state.failed, ...step.failed.filter(id => !state.failed.includes(id))] });
/** The state after the failed ones were read again: those that answered now are in, those that still did not stay failed. */
export const afterRetryGiven = (state: GivenState, step: GivenStep, reread: readonly string[]): GivenState =>
  ({ finished: state.finished, asked: state.asked, rows: merged(state, step), failed: [...state.failed.filter(id => !reread.includes(id)), ...step.failed] });
