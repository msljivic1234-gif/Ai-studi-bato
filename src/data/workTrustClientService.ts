import { calendarInstant } from '../lib/calendarTime';
import type { Ishod } from './ports';
import { REVIEW_TAGS, type ReviewTag } from './reviewsClientService';
import { failure, readReceipt, record, timestamp, uuid, type ReceiptAccount } from './serverReceipt';

/**
 * PROFILE-TRUST (server applied to canonical DEV 2026-10-07, ledger 230): the worker's trust profile, in three reads.
 * The contract is `supabase/candidates/profile-trust-20261007/README.md`; this file only reads it and says what it means.
 *
 *   rpc_public_work_trust_v1(p_profile_id)  the trust block of ONE worker profile (null when there is nothing to say)
 *   rpc_my_work_stats_v1()                  the caller's own funnel "poslate prijave -> dogovoreno -> zavrseno" and reliability
 *   rpc_list_received_reviews_v1(limit, after)   the caller's received reviews, newest first, keyset-paged
 *
 * WHO SEES WHAT is the owner's open privacy decision, and the server answers it, not this client: `visibility` is `OWN_ONLY`
 * (the default: only the person themself reads the agreed count, the reliability and "member since") or `PUBLIC`; a viewer who
 * may not read them gets `reliabilityState: "HIDDEN"` and nulls, and a screen then says nothing about them. The received reviews
 * are `COMMENTED_ONLY` (the default: star-only reviews stay aggregate-only) or `ALL`. A screen draws exactly what comes back, and
 * promises nothing the server did not return (A10: no sentence may promise anonymity either).
 *
 * Every answer is validated like every receipt of this app: exact keys, the schema, `authoritative`, the account it was asked for, and
 * the states that must go together (a percentage only with AVAILABLE, nulls only with HIDDEN). A malformed answer is a failure and never
 * a half-trusted figure. Nothing is cached and nothing is written.
 */

/** HIDDEN: this viewer may not read it. TOO_FEW: fewer than `reliabilityMinimum` Dogovori to say a percentage. AVAILABLE: a percentage. */
export type ReliabilityState = 'HIDDEN' | 'TOO_FEW' | 'AVAILABLE';
export type TrustVisibility = 'OWN_ONLY' | 'PUBLIC';
export type ReceivedReviewsMode = 'COMMENTED_ONLY' | 'ALL';

export type PublicWorkTrust = Readonly<{
  profileId: string;
  /** The profile is the caller's own. */
  self: boolean;
  visibility: TrustVisibility;
  /** The same count as `trust.completedCount` of the public profile: always there. */
  completedCount: number;
  /** Only when the viewer may read it (the person themself, or `PUBLIC`); otherwise null. */
  agreedCount: number | null;
  /** floor(100 * completed / (completed + cancelled by the worker)); null while fewer than `reliabilityMinimum` of those, and null when HIDDEN. */
  reliabilityPercent: number | null;
  reliabilityState: ReliabilityState;
  reliabilityMinimum: number;
  /** The first day of the month of the profile ("2026-10-01"); null when HIDDEN. */
  memberSince: string | null;
}>;
/** What a read of a trust block says: `trust: null` is the server's "nothing here" (not an active worker profile, a blocked pair, ...). */
export type PublicWorkTrustAnswer = Readonly<{ trust: PublicWorkTrust | null }>;

export type MyWorkStats = Readonly<{
  /** False for an account without a work profile: every count is then zero and the screen says nothing about work. */
  hasWorkerProfile: boolean;
  profileId: string | null;
  profileStatus: string | null;
  /** Applications that left the draft state, any later status. Never part of a public read. */
  applicationsSent: number;
  agreementsMade: number;
  agreementsCompleted: number;
  agreementsActive: number;
  cancelledByMe: number;
  cancelledByRequester: number;
  cancelledSideUnknown: number;
  reliabilityPercent: number | null;
  /** Never HIDDEN: it is the person's own. */
  reliabilityState: 'TOO_FEW' | 'AVAILABLE';
  reliabilityMinimum: number;
  memberSince: string | null;
  asOf: string;
}>;

export type ReceivedReviewer = Readonly<{
  /** Null when the face is masked (a blocked pair, a closing or another-world account, a profile that is not active). */
  profileId: string | null;
  role: 'REQUESTER' | 'WORKER';
  displayName: string | null;
  avatarPath: string | null;
  masked: boolean;
}>;
export type ReceivedReview = Readonly<{
  reviewId: string;
  rating: number;
  tags: readonly ReviewTag[];
  createdAt: string;
  agreementId: string;
  taskTitle: string;
  /** In which role the reviewed person was rated: `WORKER` = the requester rated their work. */
  receivedAs: 'WORKER' | 'REQUESTER';
  reviewer: ReceivedReviewer;
  /** Only when the reviewed person may read it. */
  comment: string | null;
}>;
export type ReceivedReviewsPage = Readonly<{
  mode: ReceivedReviewsMode;
  items: readonly ReceivedReview[];
  hasMore: boolean;
  /** The opaque cursor of the next page, to be handed back as `after` and never read. */
  nextAfter: string | null;
  limit: number;
  /** Every review the person has; `notListedCount` of them are not listed one by one (they count in the average all the same). */
  totalCount: number;
  notListedCount: number;
  asOf: string;
}>;

/** The page sizes the function accepts (it clamps 1 to 50, null means 20). */
export const RECEIVED_REVIEWS_PAGE_SIZE = 20;
export const RECEIVED_REVIEWS_PAGE_MAX = 50;

const errors: Readonly<Record<string, string>> = {
  AUTH_REQUIRED: 'Prijavite se da nastavite.',
  ACCOUNT_CLOSING: 'Ovo ne možete da vidite dok se Vaš nalog zatvara.',
  INVALID_PAGE: 'Ocene se nisu učitale kako treba. Pokušajte ponovo.',
  PROFILE_ID_REQUIRED: 'Profil nije dostupan.',
};

const exactKeys = (row: Record<string, unknown>, keys: readonly string[]) =>
  Object.keys(row).length === keys.length && keys.every(key => Object.prototype.hasOwnProperty.call(row, key));
const count = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
const percent = (value: unknown): value is number => count(value) && value <= 100;
/** A time the app's own strict reader accepts: a real calendar instant (the platform parser lets 30 February through). */
const instant = (value: unknown): value is string => timestamp(value) && calendarInstant(value) !== null;
/** "2026-10-01": a real first day of a month. */
const monthStart = (value: unknown): value is string => typeof value === 'string' && /^\d{4}-(?:0[1-9]|1[0-2])-01$/.test(value);
const text = (value: unknown): value is string => typeof value === 'string' && value.trim() !== '';

/* ---------------------------------------------------------------------------------------------------------- public trust */

const TRUST_KEYS = ['schema', 'profileId', 'role', 'self', 'visibility', 'completedCount', 'agreedCount', 'reliabilityPercent', 'reliabilityState',
  'reliabilityMinimum', 'memberSince', 'definition', 'authoritative'] as const;

/**
 * One answer about the profile that was asked for. `null` is the server's "nothing here" and is kept as such (`trust: null`); anything
 * that is not a valid trust block of exactly that profile is a malformed answer (null). The three states keep their facts together:
 * HIDDEN has no figure at all, TOO_FEW has the count and the month but no percentage, AVAILABLE has all of them.
 */
export function decodePublicWorkTrust(raw: unknown, profileId: string): PublicWorkTrustAnswer | null {
  if (raw === null) return { trust: null };
  const row = record(raw);
  if (!row || !exactKeys(row, TRUST_KEYS) || row.schema !== 'PUBLIC_WORK_TRUST_V1' || row.definition !== 'WORK_TRUST_V1' || row.authoritative !== true
    || row.role !== 'WORKER' || !uuid(row.profileId) || row.profileId.toLowerCase() !== profileId.toLowerCase() || typeof row.self !== 'boolean'
    || (row.visibility !== 'OWN_ONLY' && row.visibility !== 'PUBLIC') || !count(row.completedCount)
    || !count(row.reliabilityMinimum) || row.reliabilityMinimum < 1) return null;
  const { reliabilityState: state, agreedCount, reliabilityPercent, memberSince } = row;
  // The person themself and a PUBLIC profile are open; an OWN_ONLY profile seen by anyone else is HIDDEN, and only then.
  const open = row.self || row.visibility === 'PUBLIC';
  if (state === 'HIDDEN') {
    if (open || agreedCount !== null || reliabilityPercent !== null || memberSince !== null) return null;
  } else if (state === 'TOO_FEW' || state === 'AVAILABLE') {
    if (!open || !count(agreedCount) || agreedCount < row.completedCount || !monthStart(memberSince)) return null;
    if (state === 'TOO_FEW' ? reliabilityPercent !== null : !percent(reliabilityPercent)) return null;
  } else return null;
  return { trust: { profileId: row.profileId, self: row.self, visibility: row.visibility, completedCount: row.completedCount,
    agreedCount: state === 'HIDDEN' ? null : agreedCount as number, reliabilityPercent: state === 'AVAILABLE' ? reliabilityPercent as number : null,
    reliabilityState: state, reliabilityMinimum: row.reliabilityMinimum, memberSince: state === 'HIDDEN' ? null : memberSince as string } };
}

/* ------------------------------------------------------------------------------------------------------------- my stats */

const STATS_KEYS = ['schema', 'hasWorkerProfile', 'profileId', 'profileStatus', 'applicationsSent', 'agreementsMade', 'agreementsCompleted',
  'agreementsActive', 'cancelledByMe', 'cancelledByRequester', 'cancelledSideUnknown', 'reliabilityPercent', 'reliabilityState',
  'reliabilityMinimum', 'memberSince', 'definition', 'asOf', 'authoritative'] as const;

/** The caller's own funnel. An account without a work profile answers zeros and nulls, and says so with `hasWorkerProfile: false`. */
export function decodeMyWorkStats(raw: unknown): MyWorkStats | null {
  const row = record(raw);
  if (!row || !exactKeys(row, STATS_KEYS) || row.schema !== 'MY_WORK_STATS_V1' || row.definition !== 'WORK_TRUST_V1' || row.authoritative !== true
    || !instant(row.asOf) || typeof row.hasWorkerProfile !== 'boolean') return null;
  const counts = [row.applicationsSent, row.agreementsMade, row.agreementsCompleted, row.agreementsActive, row.cancelledByMe,
    row.cancelledByRequester, row.cancelledSideUnknown];
  if (!counts.every(count) || !count(row.reliabilityMinimum) || row.reliabilityMinimum < 1
    || (row.reliabilityState !== 'TOO_FEW' && row.reliabilityState !== 'AVAILABLE')) return null;
  const [sent, made, completed, active, byMe, byRequester, unknown] = counts as number[];
  // Every Dogovori count is a part of "agreed"; completed and the three cancelled kinds and the open ones never add up to more.
  if (completed + active + byMe + byRequester + unknown > made) return null;
  if (row.reliabilityState === 'TOO_FEW' ? row.reliabilityPercent !== null : !percent(row.reliabilityPercent)) return null;
  if (!row.hasWorkerProfile) {
    // Nothing is made up for an account without a work profile.
    if (row.profileId !== null || row.profileStatus !== null || row.memberSince !== null || counts.some(value => value !== 0)
      || row.reliabilityState !== 'TOO_FEW') return null;
  } else if (!uuid(row.profileId) || !text(row.profileStatus) || !monthStart(row.memberSince)) return null;
  return { hasWorkerProfile: row.hasWorkerProfile, profileId: row.profileId as string | null, profileStatus: row.profileStatus as string | null,
    applicationsSent: sent, agreementsMade: made, agreementsCompleted: completed, agreementsActive: active, cancelledByMe: byMe,
    cancelledByRequester: byRequester, cancelledSideUnknown: unknown, reliabilityPercent: row.reliabilityPercent as number | null,
    reliabilityState: row.reliabilityState, reliabilityMinimum: row.reliabilityMinimum, memberSince: row.memberSince as string | null, asOf: row.asOf };
}

/* ------------------------------------------------------------------------------------------------------ received reviews */

const PAGE_KEYS = ['schema', 'mode', 'items', 'hasMore', 'nextAfter', 'limit', 'totalCount', 'notListedCount', 'asOf', 'authoritative'] as const;
const ITEM_KEYS = ['reviewId', 'rating', 'tags', 'createdAt', 'agreementId', 'taskTitle', 'receivedAs', 'reviewer', 'comment'] as const;
const REVIEWER_KEYS = ['profileId', 'role', 'displayName', 'avatarPath', 'masked'] as const;
/** The opaque cursor the function itself accepts: an instant with six decimals, a bar and the review id. Handed back as it came. */
const CURSOR = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[.]\d{6}Z[|][0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

function decodeReviewer(value: unknown): ReceivedReviewer | null {
  const row = record(value);
  if (!row || !exactKeys(row, REVIEWER_KEYS) || (row.role !== 'REQUESTER' && row.role !== 'WORKER') || typeof row.masked !== 'boolean') return null;
  // A masked face carries nothing of the person; a face that is shown names the profile and may lack a name or a photo.
  if (row.masked) return row.profileId === null && row.displayName === null && row.avatarPath === null
    ? { profileId: null, role: row.role, displayName: null, avatarPath: null, masked: true } : null;
  if (!uuid(row.profileId) || !(row.displayName === null || text(row.displayName)) || !(row.avatarPath === null || typeof row.avatarPath === 'string')) return null;
  return { profileId: row.profileId, role: row.role, displayName: row.displayName as string | null, avatarPath: row.avatarPath as string | null, masked: false };
}

function decodeReceivedReview(value: unknown): ReceivedReview | null {
  const row = record(value);
  if (!row || !exactKeys(row, ITEM_KEYS) || !uuid(row.reviewId) || !uuid(row.agreementId) || !instant(row.createdAt)
    || typeof row.rating !== 'number' || !Number.isInteger(row.rating) || row.rating < 1 || row.rating > 5
    || !Array.isArray(row.tags) || row.tags.length > 3 || new Set(row.tags).size !== row.tags.length
    || row.tags.some(tag => typeof tag !== 'string' || !(REVIEW_TAGS as readonly string[]).includes(tag))
    || !(row.taskTitle === null || typeof row.taskTitle === 'string') || (row.receivedAs !== 'WORKER' && row.receivedAs !== 'REQUESTER')
    || !(row.comment === null || text(row.comment))) return null;
  const reviewer = decodeReviewer(row.reviewer);
  if (!reviewer) return null;
  return { reviewId: row.reviewId, rating: row.rating, tags: [...row.tags].sort() as ReviewTag[], createdAt: row.createdAt, agreementId: row.agreementId,
    // A task without a title says nothing: the line is left out, never made up.
    taskTitle: typeof row.taskTitle === 'string' ? row.taskTitle.trim() : '', receivedAs: row.receivedAs, reviewer, comment: row.comment === null ? null : (row.comment as string).trim() };
}

/**
 * One page of received reviews, for the page size that was asked. Strict: a list longer than the limit, a review twice, a cursor that
 * is not the function's own, a page that says it has more without a cursor (or a cursor without more), or counts that do not add up
 * (the listed ones are never more than the total, the not-listed ones are the rest) is a malformed answer.
 */
export function decodeReceivedReviews(raw: unknown, asked: number): ReceivedReviewsPage | null {
  const row = record(raw);
  if (!row || !exactKeys(row, PAGE_KEYS) || row.schema !== 'RECEIVED_REVIEWS_V1' || row.authoritative !== true || !instant(row.asOf)
    || (row.mode !== 'COMMENTED_ONLY' && row.mode !== 'ALL') || !Array.isArray(row.items) || typeof row.hasMore !== 'boolean'
    || !count(row.limit) || row.limit !== asked || row.items.length > row.limit || !count(row.totalCount) || !count(row.notListedCount)
    || row.notListedCount > row.totalCount || row.items.length > row.totalCount - row.notListedCount) return null;
  const items: ReceivedReview[] = [], seen = new Set<string>();
  for (const value of row.items) {
    const item = decodeReceivedReview(value);
    if (!item || seen.has(item.reviewId)) return null;
    seen.add(item.reviewId);
    items.push(item);
  }
  if (row.hasMore ? typeof row.nextAfter !== 'string' || !CURSOR.test(row.nextAfter) || items.length === 0 : row.nextAfter !== null) return null;
  // ALL lists every review: nothing is then left out.
  if (row.mode === 'ALL' && row.notListedCount !== 0) return null;
  return { mode: row.mode, items, hasMore: row.hasMore, nextAfter: row.nextAfter as string | null, limit: row.limit, totalCount: row.totalCount,
    notListedCount: row.notListedCount, asOf: row.asOf };
}

const pageSize = (value: unknown): number => typeof value === 'number' && Number.isInteger(value) && value >= 1
  ? Math.min(value, RECEIVED_REVIEWS_PAGE_MAX) : RECEIVED_REVIEWS_PAGE_SIZE;

export const workTrustClientService = {
  /** The trust block of one worker profile. `ok` with `trust: null` is the server's "nothing here". */
  publicTrust(profileId: string, account?: ReceiptAccount): Promise<Ishod<PublicWorkTrustAnswer>> {
    if (!uuid(profileId)) return Promise.resolve(failure('PROFILE_ID_REQUIRED', errors.PROFILE_ID_REQUIRED));
    return readReceipt({ account, rpc: 'rpc_public_work_trust_v1', args: { p_profile_id: profileId }, errors,
      fallback: 'WORK_TRUST_READ_FAILED', invalid: 'WORK_TRUST_READ_INVALID', decode: raw => decodePublicWorkTrust(raw, profileId) });
  },
  /** The caller's own funnel and reliability. */
  myStats(account?: ReceiptAccount): Promise<Ishod<MyWorkStats>> {
    return readReceipt({ account, rpc: 'rpc_my_work_stats_v1', args: {}, errors,
      fallback: 'WORK_STATS_READ_FAILED', invalid: 'WORK_STATS_READ_INVALID', decode: decodeMyWorkStats });
  },
  /** One page of the caller's received reviews. `after` is the `nextAfter` of the page before, as it came. */
  receivedReviews(options: { limit?: number; after?: string | null } = {}, account?: ReceiptAccount): Promise<Ishod<ReceivedReviewsPage>> {
    const limit = pageSize(options.limit), after = options.after ?? null;
    if (after !== null && (typeof after !== 'string' || !CURSOR.test(after))) return Promise.resolve(failure('INVALID_PAGE', errors.INVALID_PAGE));
    return readReceipt({ account, rpc: 'rpc_list_received_reviews_v1', args: { p_limit: limit, p_after: after }, errors,
      fallback: 'RECEIVED_REVIEWS_READ_FAILED', invalid: 'RECEIVED_REVIEWS_READ_INVALID', decode: raw => decodeReceivedReviews(raw, limit) });
  },
};
