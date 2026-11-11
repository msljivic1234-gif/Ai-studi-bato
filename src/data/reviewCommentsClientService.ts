import type { Ishod } from './ports';
import { reviewCommentBuilt } from './reviewCommentGate';
import { REVIEW_COMMENT_MAX_CODE_POINTS, REVIEW_COMMENT_MESSAGES, REVIEW_COMMENT_PAGE_MAX, REVIEW_COMMENT_PAGE_SIZE, prepareReviewComment } from './reviewCommentText';
import { decodeReviewContext, reviewInternals, reviewsClientService, type ReviewCommand, type ReviewContext, type ReviewReceipt } from './reviewsClientService';
import { failure, readOwnedResult, record, sameId, timestamp, uuid, type ReceiptAccount } from './serverReceipt';
import { supabaseKlijent } from './supabaseClient';

/**
 * The client of the optional written comment with a review (D12). The server contract is
 * `supabase/candidates/d12_review_comment.sql` (APPLIED to canonical DEV on 2026-10-02):
 *
 *   rpc_get_my_agreement_review_v2(p_agreement_id)
 *   rpc_submit_agreement_review_v2(p_agreement_id, p_target_account_id, p_rating jsonb, p_tags jsonb, p_client_request_id, p_comment jsonb default null)
 *   rpc_list_review_comments_v1(p_profile_id, p_limit default 20, p_after jsonb default null)  -- keyset {createdAt, reviewId}
 *
 * This is the one door the review screen and the profile use. Without the build flag (`reviewCommentGate`) it hands every call to the
 * legacy review service unchanged and sends nothing new, so a build without the flag behaves exactly as before. With the flag it
 * asks the backend whether it has the package: a missing v2 function (PostgREST `PGRST202`) means "no comments", the legacy pair is
 * used for the rest of the session, and the verdict is cached so nothing loops. Any other error is the ordinary error path.
 *
 * It keeps the legacy command discipline: one immutable command per attempt, the SAME client request id on a retry, no automatic
 * write replay, every answer fenced to the account that asked. A review is immutable: the comment is sent once, with the stars, and
 * the text the server echoes is compared with the text that was sent: a difference is an error state, never a success.
 *
 * PRIVACY (AGENTS 3.4): a comment is free text. It lives in the caller's component state and in the request body, and nowhere
 * else: no log, no analytics, no breadcrumb, no storage, no cache. An error carries its code only; the text of a backend error
 * (which may quote a fragment of the body) is never read. `review-comment-service.test.ts` spies every output channel on every failure.
 */
type Capability = 'unknown' | 'supported' | 'unsupported';
let capability: Capability = 'unknown';
/** What this session knows about the backend: `unknown` until the first v2 answer, then `supported` or `unsupported` for good. */
export const reviewCommentCapability = (): Capability => capability;
/** For tests: forget the verdict. */
export function resetReviewCommentCapability(): void { capability = 'unknown'; }

/** Where the page sizes are written down is `reviewCommentText` (the screens read them from there, without loading this service). */
export { REVIEW_COMMENT_PAGE_MAX, REVIEW_COMMENT_PAGE_SIZE };

export type ReviewCommentAuthor = { profileId: string; role: 'REQUESTER' | 'WORKER'; displayName: string | null; avatarPath: string | null };
export type ReviewCommentItem = { reviewId: string; rating: number; comment: string; createdAt: string;
  /** Only the reviewed person gets the Agreement id (so they can report through the existing channels). */
  agreementId: string | null; author: ReviewCommentAuthor };
export type ReviewCommentCursor = { createdAt: string; reviewId: string };
export type ReviewCommentPage = { profileId: string; items: ReviewCommentItem[]; hasMore: boolean; nextAfter: ReviewCommentCursor | null };

const COMMENTS_UNAVAILABLE = 'Komentari trenutno nisu dostupni.';
/** What a person reads when a page of comments is asked for and cannot be, apart from the shared sentences. */
const LIST_ERRORS: Readonly<Record<string, string>> = {
  AUTH_REQUIRED: REVIEW_COMMENT_MESSAGES.AUTH_REQUIRED,
  INVALID_PAGE: 'Komentari se nisu učitali kako treba. Pokušaj ponovo.',
  PROFILE_ID_REQUIRED: COMMENTS_UNAVAILABLE,
  REVIEW_COMMENTS_UNAVAILABLE: COMMENTS_UNAVAILABLE,
};
/** Every name the three D12 functions raise that a client can meet, with the sentence it becomes (nothing technical is shown). */
let submitErrorsMemo: Readonly<Record<string, string>> | null = null;
function submitErrors(): Readonly<Record<string, string>> {
  // Built on first use: the legacy sentences first (input and tag refusals, account closing), the D12 sentences over them.
  submitErrorsMemo ??= { ...reviewInternals.errors, ...REVIEW_COMMENT_MESSAGES };
  return submitErrorsMemo;
}

function refuse<T>(code: string, messages: Readonly<Record<string, string>> = REVIEW_COMMENT_MESSAGES): Promise<Ishod<T>> {
  return Promise.resolve(failure(code, messages[code] ?? COMMENTS_UNAVAILABLE));
}
const errorCode = (response: unknown): string | null => {
  const code = record(record(response)?.error)?.code;
  return typeof code === 'string' ? code : null;
};
/** PostgREST answers PGRST202 when the function is not in its schema cache: the backend has no D12 package. */
const functionMissing = (response: unknown) => errorCode(response) === 'PGRST202';
/** A comment as the server stores it: text of 1 to 500 code points (the table's own CHECK). Anything else is not a comment. */
const storedComment = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0 && Array.from(value).length <= REVIEW_COMMENT_MAX_CODE_POINTS;
const hasKey = (value: Record<string, unknown>, key: string) => Object.prototype.hasOwnProperty.call(value, key);

/** The own comment of a review inside a v2 context: the key is always there (text or null); undefined means malformed. */
function ownComment(review: Record<string, unknown> | null): string | null | undefined {
  if (!review || !hasKey(review, 'comment')) return undefined;
  return review.comment === null ? null : storedComment(review.comment) ? review.comment : undefined;
}

/** The legacy context plus what v2 adds: the comment policy (exactly the one this client implements) and the own comment. */
function decodeContextV2(raw: unknown, accountId: string, agreementId: string): ReviewContext | null {
  const base = decodeReviewContext(raw, accountId, agreementId), r = record(raw), policy = record(r?.commentPolicy);
  if (!base || !r || !policy || policy.supported !== true || policy.maxLength !== REVIEW_COMMENT_MAX_CODE_POINTS
    || policy.version !== 'REVIEW_COMMENT_V1') return null;
  let review = base.review;
  if (review) {
    const comment = ownComment(record(r.review));
    if (comment === undefined) return null;
    review = { ...review, comment };
  }
  return { ...base, review, commentPolicy: { supported: true, maxLength: 500, version: 'REVIEW_COMMENT_V1' } };
}

/** The legacy receipt (bound to the command that was sent) plus the echoed comment, which must be there as text or null. */
function decodeReceiptV2(raw: unknown, account: string, args: { p_agreement_id: string; p_target_account_id: string;
  p_rating: number; p_tags: readonly string[]; p_client_request_id: string }): ReviewReceipt | null {
  const r = record(raw), base = reviewInternals.decodeReceipt(raw, account, args.p_agreement_id, args.p_target_account_id);
  if (!r || !base || !sameId(base.clientRequestId, args.p_client_request_id) || base.rating !== args.p_rating
    || JSON.stringify(base.tags) !== JSON.stringify(args.p_tags)) return null;
  const comment = ownComment(r);
  return comment === undefined ? null : { ...base, comment };
}

function decodeItem(raw: unknown): ReviewCommentItem | null {
  const r = record(raw), author = record(r?.author);
  if (!r || !author || !uuid(r.reviewId) || !reviewInternals.isRating(r.rating) || !storedComment(r.comment) || !timestamp(r.createdAt)
    || !(r.agreementId === null || uuid(r.agreementId)) || !uuid(author.profileId) || (author.role !== 'REQUESTER' && author.role !== 'WORKER')
    || !(author.displayName === null || typeof author.displayName === 'string')
    || !(author.avatarPath === null || typeof author.avatarPath === 'string')) return null;
  // A name that is only white space is no name: the reader already says so with null, this keeps a stray blank from becoming letters.
  const name = typeof author.displayName === 'string' && author.displayName.trim() !== '' ? author.displayName : null;
  return { reviewId: r.reviewId, rating: r.rating, comment: r.comment, createdAt: r.createdAt, agreementId: r.agreementId as string | null,
    author: { profileId: author.profileId, role: author.role, displayName: name, avatarPath: author.avatarPath as string | null } };
}

/** The page the reader returned for THIS profile and THIS page size, or null when it is anything else. The cursor is kept verbatim. */
function decodePage(raw: unknown, profileId: string, limit: number): { page: ReviewCommentPage } | null {
  const r = record(raw);
  if (!r || !sameId(r.profileId, profileId) || r.authoritative !== true || !Array.isArray(r.items) || r.items.length > limit
    || typeof r.hasMore !== 'boolean') return null;
  const items: ReviewCommentItem[] = [];
  for (const entry of r.items) {
    const item = decodeItem(entry);
    if (!item || items.some(seen => seen.reviewId === item.reviewId)) return null;
    items.push(item);
  }
  let nextAfter: ReviewCommentCursor | null = null;
  if (r.hasMore) {
    const cursor = record(r.nextAfter), last = items[items.length - 1];
    // The reader's cursor IS the last item of the page; anything else would skip or repeat comments.
    if (!cursor || !last || !timestamp(cursor.createdAt) || !uuid(cursor.reviewId) || cursor.createdAt !== last.createdAt
      || cursor.reviewId !== last.reviewId) return null;
    nextAfter = { createdAt: cursor.createdAt, reviewId: cursor.reviewId };
  } else if (r.nextAfter !== null && r.nextAfter !== undefined) return null;
  return { page: { profileId, items, hasMore: r.hasMore, nextAfter } };
}

const pageLimit = (value: unknown): number => typeof value === 'number' && Number.isInteger(value) && value >= 1
  ? Math.min(value, REVIEW_COMMENT_PAGE_MAX) : REVIEW_COMMENT_PAGE_SIZE;

/** The one door for the review screen and the profile; see the header of this file. */
export const reviewCommentsClientService = {
  /**
   * The own review context. Flag off, or a backend known to lack D12: the legacy context, untouched. Otherwise the v2 context:
   * the legacy context plus `commentPolicy` (the field is drawn only when it is there) and the own comment inside `review`.
   */
  context(agreementId: string, explicit?: ReceiptAccount): Promise<Ishod<ReviewContext>> {
    if (!reviewCommentBuilt() || capability === 'unsupported') return reviewsClientService.context(agreementId, explicit);
    const account = reviewInternals.scope(explicit);
    if (!account) return refuse('AUTH_REQUIRED', reviewInternals.errors);
    if (!uuid(agreementId)) return refuse('REVIEW_NOT_ALLOWED', reviewInternals.errors);
    let missing = false;
    return readOwnedResult({ account, errors: reviewInternals.errors, fallback: 'REVIEW_READ_UNAVAILABLE', invalid: 'REVIEW_INVALID_RECEIPT',
      request: async () => {
        const response = await supabaseKlijent().rpc('rpc_get_my_agreement_review_v2', { p_agreement_id: agreementId });
        if (functionMissing(response)) missing = true;
        return response;
      },
      decode: raw => decodeContextV2(raw, account.accountId, agreementId) }).then(result => {
      if (missing) { capability = 'unsupported'; return reviewsClientService.context(agreementId, explicit); }
      if (result.ok) capability = 'supported';
      return result;
    });
  },

  /**
   * One review, sent once. Flag off: the legacy command, and a typed comment is REFUSED (never dropped silently). Flag on: v2, with
   * `p_comment` only when the person wrote one (trimmed, NFC), and the echoed comment compared with what was sent.
   */
  submit(input: ReviewCommand, explicit?: ReceiptAccount): Promise<Ishod<ReviewReceipt>> {
    const prepared = prepareReviewComment(input?.comment);
    if (!reviewCommentBuilt()) {
      return prepared.kind === 'none' ? reviewsClientService.submit(input, explicit) : refuse('REVIEW_COMMENT_UNAVAILABLE');
    }
    const account = reviewInternals.scope(explicit);
    if (!account) return refuse('AUTH_REQUIRED');
    if (!input || !uuid(input.agreementId) || !uuid(input.targetAccountId) || sameId(input.targetAccountId, account.accountId)
      || !uuid(input.clientRequestId) || !reviewInternals.isRating(input.rating)) return refuse('REVIEW_INPUT_INVALID', submitErrors());
    const safeTags = reviewInternals.normalizeTags(input.tags);
    if (safeTags === null) return refuse('REVIEW_TAGS_INVALID', submitErrors());
    if (prepared.kind === 'invalid') return refuse(prepared.code);
    const text = prepared.kind === 'text' ? prepared.text : null;
    const withoutComment = (): ReviewCommand => ({ agreementId: input.agreementId, targetAccountId: input.targetAccountId,
      rating: input.rating, tags: safeTags, clientRequestId: input.clientRequestId });
    if (capability === 'unsupported') return text === null ? reviewsClientService.submit(withoutComment(), explicit) : refuse('REVIEW_COMMENT_UNAVAILABLE');
    const args = { p_agreement_id: input.agreementId, p_target_account_id: input.targetAccountId, p_rating: input.rating,
      p_tags: safeTags, p_client_request_id: input.clientRequestId, ...(text !== null ? { p_comment: text } : null) };
    let missing = false;
    return readOwnedResult({ account, errors: submitErrors(), write: true, fallback: 'REVIEW_OUTCOME_UNKNOWN', invalid: 'REVIEW_INVALID_RECEIPT',
      request: async () => {
        const response = await supabaseKlijent().rpc('rpc_submit_agreement_review_v2', args);
        const code = errorCode(response);
        if (code === 'PGRST202') { missing = true; return response; }
        // A NUL or a lone surrogate in the comment is refused by PostgreSQL before the function runs: nothing was stored, and its
        // message may quote the body, so it is replaced by a name and never read.
        if (text !== null && (code === '22P05' || code === '22P02')) return { error: { message: 'REVIEW_COMMENT_INVALID' } };
        return response;
      },
      decode: raw => decodeReceiptV2(raw, account.accountId, args) }).then(result => {
      if (missing) {
        capability = 'unsupported';
        return text === null ? reviewsClientService.submit(withoutComment(), explicit) : refuse('REVIEW_COMMENT_UNAVAILABLE');
      }
      if (!result.ok) return result;
      capability = 'supported';
      return result.podatak.comment === text ? result : failure('REVIEW_COMMENT_MISMATCH', REVIEW_COMMENT_MESSAGES.REVIEW_COMMENT_MISMATCH);
    });
  },

  /**
   * One page of the comments ABOUT a person, keyed by their profile (the reader is gated like the public profile). `podatak: null`
   * is "nothing here" (a blocked pair, a closed account, another world, or a backend without D12), not an error and not an empty
   * list. The cursor of `nextAfter` goes back as `after` exactly as it came.
   */
  list(profileId: string, page?: { after?: ReviewCommentCursor | null; limit?: number }, explicit?: ReceiptAccount): Promise<Ishod<ReviewCommentPage | null>> {
    if (!reviewCommentBuilt()) return refuse('REVIEW_COMMENTS_UNAVAILABLE', LIST_ERRORS);
    if (capability === 'unsupported') return Promise.resolve({ ok: true, podatak: null });
    const account = reviewInternals.scope(explicit);
    if (!account) return refuse('AUTH_REQUIRED', LIST_ERRORS);
    const after = page?.after ?? null;
    if (!uuid(profileId) || (after !== null && (!timestamp(after.createdAt) || !uuid(after.reviewId)))) {
      return refuse('REVIEW_COMMENTS_UNAVAILABLE', LIST_ERRORS);
    }
    const limit = pageLimit(page?.limit);
    let missing = false;
    return readOwnedResult<{ page: ReviewCommentPage | null }>({ account, errors: LIST_ERRORS, fallback: 'REVIEW_COMMENTS_READ_UNAVAILABLE',
      invalid: 'REVIEW_COMMENTS_INVALID_RECEIPT',
      request: async () => {
        const response = await supabaseKlijent().rpc('rpc_list_review_comments_v1',
          { p_profile_id: profileId, p_limit: limit, ...(after !== null ? { p_after: after } : null) });
        if (functionMissing(response)) missing = true;
        return response;
      },
      decode: raw => raw === null ? { page: null } : decodePage(raw, profileId, limit) }).then((result): Ishod<ReviewCommentPage | null> => {
      if (missing) { capability = 'unsupported'; return { ok: true, podatak: null }; }
      if (!result.ok) return result;
      capability = 'supported';
      return { ok: true, podatak: result.podatak.page };
    });
  },
};
