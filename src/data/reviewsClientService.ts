import type { Ishod } from './ports';
import { sesijaSada } from '../store/sesija';
import { supabaseKlijent } from './supabaseClient';
import { plural } from '../ui/system/plural';
import { failure, readOwnedResult, record, sameId, timestamp, uuid, type ReceiptAccount } from './serverReceipt';

/** Versioned client decoder mirror. Only the server catalog admits submissions. */
export const REVIEW_TAGS = ['AS_AGREED', 'CAREFUL', 'CLEAR_COMMUNICATION', 'ON_TIME', 'RELIABLE', 'RESPECTFUL'] as const;
export type ReviewTag = typeof REVIEW_TAGS[number];
export type ReviewCommand = { agreementId: string; targetAccountId: string; rating: number;
  tags: readonly ReviewTag[]; clientRequestId: string;
  /** D12 (build flag EXPO_PUBLIC_D12_REVIEW_COMMENT): the optional written comment, already prepared by `reviewCommentText`.
   *  THIS service never reads, sends or echoes it: only `reviewCommentsClientService` does, and it refuses to drop one silently. */
  comment?: string | null };
export type ReviewReceipt = ReviewCommand & { reviewId: string; reviewerAccountId: string;
  createdAt: string; idempotentReplay: boolean; authoritative: true };
/** What the v2 context says about comments (D12); only `reviewCommentsClientService` ever fills it, so a legacy read has none. */
export type ReviewCommentPolicy = { supported: true; maxLength: 500; version: 'REVIEW_COMMENT_V1' };
export type ReviewContext = { accountId: string; agreementId: string; targetAccountId: string;
  eligible: boolean; review: ReviewReceipt | null; authoritative: true;
  tagCatalog: { version: 'PRE_V3_REVIEW_TAGS_V1'; maxTags: 3; tags: readonly ReviewTag[] };
  commentPolicy?: ReviewCommentPolicy };
export type AccountReputation = { accountId: string; reviewCount: number; averageRating: number | null;
  state: 'NO_REVIEWS' | 'RATED'; authoritative: true };
const errors: Readonly<Record<string, string>> = {
  AUTH_REQUIRED: 'Prijavite se da nastavite.',
  REVIEW_INPUT_INVALID: 'Ocena mora biti ceo broj od 1 do 5.',
  REVIEW_TAGS_INVALID: 'Izaberite najviše tri različite ponuđene oznake.',
  REVIEW_NOT_ALLOWED: 'Možete oceniti samo drugu stranu svog Dogovora.',
  REVIEW_NOT_COMPLETED: 'Ocena je dostupna tek po završetku Dogovora.',
  REVIEW_WINDOW_CLOSED: 'Istekao je rok od 14 dana za ocenjivanje ove saradnje.',
  REVIEW_ALREADY_SUBMITTED: 'Ovaj Dogovor je već ocenjen. Uspešna ocena se ne menja.',
  REQUEST_ID_REUSED: 'Zahtev je već upotrebljen. Proverite potvrdu prethodne ocene.',
  REPUTATION_NOT_AVAILABLE: 'Reputacija ovog naloga trenutno nije dostupna.',
  ACCOUNT_CLOSING: 'Nalog je u postupku zatvaranja.',
  ACCOUNT_CLOSURE_RESTRICTED: 'Nalog je u postupku zatvaranja.',
};
const rating = (x: unknown): x is number => typeof x === 'number' && Number.isInteger(x) && x >= 1 && x <= 5;
function tags(raw: unknown): ReviewTag[] | null {
  if (!Array.isArray(raw) || raw.length > 3 || new Set(raw).size !== raw.length ||
      raw.some(x => typeof x !== 'string' || !(REVIEW_TAGS as readonly string[]).includes(x))) return null;
  return [...raw].sort() as ReviewTag[];
}
function scope(explicit?: ReceiptAccount): ReceiptAccount | null {
  const s = sesijaSada(); const owner = explicit ?? (s.user ? { accountId: s.user.id, accountRevision: s.accountRevision } : null);
  return owner && uuid(owner.accountId) ? { ...owner } : null;
}
function receipt(raw: unknown, account: string, agreement: string, target: string): ReviewReceipt | null {
  const r = record(raw), safeTags = tags(r?.tags);
  if (!r || !uuid(r.reviewId) || !sameId(r.agreementId, agreement) || !sameId(r.reviewerAccountId, account) ||
      !sameId(r.targetAccountId, target) || sameId(target, account) || !rating(r.rating) || safeTags === null ||
      !uuid(r.clientRequestId) || !timestamp(r.createdAt) || typeof r.idempotentReplay !== 'boolean' || r.authoritative !== true) return null;
  return { reviewId: r.reviewId, agreementId: agreement, reviewerAccountId: account, targetAccountId: target,
    rating: r.rating, tags: safeTags, clientRequestId: r.clientRequestId, createdAt: r.createdAt,
    idempotentReplay: r.idempotentReplay, authoritative: true };
}
function bad<T>(code: string): Promise<Ishod<T>> { return Promise.resolve(failure(code, errors[code])); }
/** The collection and the review screen admit the same account-bound server receipt. */
export function decodeReviewContext(raw: unknown, accountId: string, agreementId: string): ReviewContext | null {
  const r = record(raw), catalog = record(r?.tagCatalog);
  if (!r || !sameId(r.accountId, accountId) || !sameId(r.agreementId, agreementId) ||
      !uuid(r.targetAccountId) || sameId(r.targetAccountId, accountId) || typeof r.eligible !== 'boolean' ||
      r.authoritative !== true || !catalog || catalog.version !== 'PRE_V3_REVIEW_TAGS_V1' || catalog.maxTags !== 3 ||
      !Array.isArray(catalog.tags) || JSON.stringify(catalog.tags) !== JSON.stringify(REVIEW_TAGS)) return null;
  const ownReview = r.review === null ? null : receipt(r.review, accountId, agreementId, r.targetAccountId);
  if ((r.review !== null && ownReview === null) || (ownReview !== null && r.eligible)) return null;
  return { accountId, agreementId, targetAccountId: r.targetAccountId, eligible: r.eligible,
    review: ownReview, tagCatalog: { version: 'PRE_V3_REVIEW_TAGS_V1', maxTags: 3, tags: [...REVIEW_TAGS] }, authoritative: true };
}
export function accountReputationLabel(value: AccountReputation): string {
  return value.reviewCount === 0 ? 'Još nema ocena' : `${value.averageRating?.toLocaleString('sr-Latn-RS', { minimumFractionDigits: 1, maximumFractionDigits: 2 })} · ${plural(value.reviewCount, 'ocena', 'ocene', 'ocena')}`;
}
/** One own-review receipt and one account aggregate. No optimistic review,
 * inferred reciprocal state, raw table access, or automatic mutation replay. */
export const reviewsClientService = {
  context(agreementId: string, explicit?: ReceiptAccount): Promise<Ishod<ReviewContext>> {
    const account = scope(explicit); if (!account) return bad('AUTH_REQUIRED');
    if (!uuid(agreementId)) return bad('REVIEW_NOT_ALLOWED');
    return readOwnedResult({ account, errors, fallback: 'REVIEW_READ_UNAVAILABLE', invalid: 'REVIEW_INVALID_RECEIPT',
      request: () => supabaseKlijent().rpc('rpc_get_my_agreement_review', { p_agreement_id: agreementId }),
      decode: raw => decodeReviewContext(raw, account.accountId, agreementId) });
  },
  submit(input: ReviewCommand, explicit?: ReceiptAccount): Promise<Ishod<ReviewReceipt>> {
    const account = scope(explicit); if (!account) return bad('AUTH_REQUIRED');
    if (!input || !uuid(input.agreementId) || !uuid(input.targetAccountId) || sameId(input.targetAccountId, account.accountId) ||
        !uuid(input.clientRequestId) || !rating(input.rating)) return bad('REVIEW_INPUT_INVALID');
    const safeTags = tags(input.tags); if (safeTags === null) return bad('REVIEW_TAGS_INVALID');
    const args = { p_agreement_id: input.agreementId, p_target_account_id: input.targetAccountId, p_rating: input.rating,
      p_tags: safeTags, p_client_request_id: input.clientRequestId };
    return readOwnedResult({ account, errors, write: true, fallback: 'REVIEW_OUTCOME_UNKNOWN', invalid: 'REVIEW_INVALID_RECEIPT',
      request: () => supabaseKlijent().rpc('rpc_submit_agreement_review', args), decode: raw => {
        const r = receipt(raw, account.accountId, args.p_agreement_id, args.p_target_account_id);
        if (!r || !sameId(r.clientRequestId, args.p_client_request_id) || r.rating !== args.p_rating ||
            JSON.stringify(r.tags) !== JSON.stringify(args.p_tags)) return null;
        return r;
      } });
  },
  reputation(accountId: string, explicit?: ReceiptAccount): Promise<Ishod<AccountReputation>> {
    const account = scope(explicit); if (!account) return bad('AUTH_REQUIRED');
    if (!uuid(accountId)) return bad('REPUTATION_NOT_AVAILABLE');
    return readOwnedResult({ account, errors, fallback: 'REPUTATION_READ_UNAVAILABLE', invalid: 'REPUTATION_INVALID_RECEIPT',
      request: () => supabaseKlijent().rpc('rpc_get_account_reputation', { p_account_id: accountId }), decode: raw => {
        const r = record(raw);
        if (!r || !sameId(r.accountId, accountId) || r.authoritative !== true || typeof r.reviewCount !== 'number' ||
            !Number.isSafeInteger(r.reviewCount) || r.reviewCount < 0) return null;
        if (r.reviewCount === 0) return r.averageRating === null && r.state === 'NO_REVIEWS'
          ? { accountId, reviewCount: 0, averageRating: null, state: 'NO_REVIEWS', authoritative: true } : null;
        const avg = r.averageRating;
        if (r.state !== 'RATED' || typeof avg !== 'number' || !Number.isFinite(avg) || avg < 1 || avg > 5 ||
            Math.abs(Math.round(avg * 100) - avg * 100) > 1e-8) return null;
        return { accountId, reviewCount: r.reviewCount, averageRating: avg, state: 'RATED', authoritative: true };
      } });
  },
};
/**
 * The pieces the D12 comment client (`reviewCommentsClientService`) shares with this service, so the comment path validates
 * and decodes exactly as the legacy path does and there is one copy of each rule. Nothing here changes what this service does.
 */
export const reviewInternals = { errors, isRating: rating, normalizeTags: tags, scope, decodeReceipt: receipt } as const;
