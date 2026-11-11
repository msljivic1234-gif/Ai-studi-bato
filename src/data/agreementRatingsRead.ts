import type { DogovorProjekcija } from '../contracts/projections';
import { sesijaSada } from '../store/sesija';
import { decodeReviewContext } from './reviewsClientService';
import { record, type ReceiptAccount } from './serverReceipt';
import { supabaseKlijent } from './supabaseClient';

export const AGREEMENT_RATING_CONCURRENCY = 4;
export const AGREEMENT_RATING_BUDGET_MS = 4_000;

export const ratingReadOwnerCurrent = (owner: ReceiptAccount) => {
  const now = sesijaSada();
  return now.user?.id === owner.accountId && now.accountRevision === owner.accountRevision;
};

/** Bound enrichment, not the underlying Agreement list. Unknown is never "already rated".
 * The budget covers the whole pool, not each row: a stalled receipt cannot withhold active work.
 * A future server aggregate is still required to reduce the worst-case P + C total RPC count.
 */
export async function withAgreementRatings(rows: DogovorProjekcija[], owner: ReceiptAccount): Promise<DogovorProjekcija[]> {
  if (!ratingReadOwnerCurrent(owner)) throw new Error('AUTH_ACCOUNT_CHANGED');
  const finished = rows.filter(row => row.stanje === 'COMPLETED');
  if (!finished.length) return rows;
  const states = new Map<string, boolean>();
  const abort = new AbortController();
  const deadline = Date.now() + AGREEMENT_RATING_BUDGET_MS;
  let stopped = false, next = 0;
  let finish!: () => void;
  const stop = () => { if (!stopped) { stopped = true; abort.abort(); finish(); } };
  const boundary = new Promise<void>(resolve => { finish = resolve; });
  const timer = setTimeout(stop, AGREEMENT_RATING_BUDGET_MS);
  // Account retirement also stops a stalled request before the budget expires. Token refresh
  // does not retire this owner; an A -> B -> A switch does through accountRevision.
  const accountWatch = setInterval(() => { if (!ratingReadOwnerCurrent(owner)) stop(); }, 100);
  const current = () => !stopped && Date.now() < deadline && ratingReadOwnerCurrent(owner);
  const worker = async () => {
    while (current() && next < finished.length) {
      const row = finished[next++];
      try {
        const request = supabaseKlijent().rpc('rpc_get_my_agreement_review', { p_agreement_id: row.id });
        // Real PostgREST reads support abortSignal. The PromiseLike fallback accommodates
        // offline/test adapters; stop/current still fence their late answers and queue.
        const response = await (typeof request.abortSignal === 'function' ? request.abortSignal(abort.signal) : request);
        if (!current()) return;
        const result = record(response);
        const context = result?.error === null ? decodeReviewContext(result.data, owner.accountId, row.id) : null;
        if (context) states.set(row.id, context.eligible);
      } catch { /* The row remains explicitly unavailable; there is no automatic retry. */ }
    }
  };
  try {
    await Promise.race([Promise.all(Array.from({ length: Math.min(AGREEMENT_RATING_CONCURRENCY, finished.length) }, worker)), boundary]);
  } finally {
    stop(); clearTimeout(timer); clearInterval(accountWatch);
  }
  if (!ratingReadOwnerCurrent(owner)) throw new Error('AUTH_ACCOUNT_CHANGED');
  return rows.map(row => {
    if (row.stanje !== 'COMPLETED') return row;
    const due = states.get(row.id);
    return { ...row, ocenaMoguca: due === true,
      stanjeProvereOcene: due === undefined ? 'UNAVAILABLE' : due ? 'DUE' : 'NOT_DUE' };
  });
}
