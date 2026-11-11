import { useCallback, useEffect, useRef, useState } from 'react';
import { RECEIVED_REVIEWS_PAGE_SIZE, workTrustClientService, type ReceivedReview, type ReceivedReviewsMode } from '../../data/workTrustClientService';
import { useSesija } from '../../store/sesija';

/** What the list holds for ONE account: nothing from another account or another visit is ever shown, not even for a frame. */
export type ReceivedReviewsState = {
  scope: string;
  phase: 'loading' | 'error' | 'ready';
  mode: ReceivedReviewsMode;
  items: readonly ReceivedReview[];
  hasMore: boolean;
  cursor: string | null;
  totalCount: number;
  notListedCount: number;
  /** The next page: waiting, or failed (the page already shown stays). */
  more: 'idle' | 'loading' | 'error';
};

const waiting = (scope: string, phase: ReceivedReviewsState['phase'] = 'loading'): ReceivedReviewsState => ({ scope, phase, mode: 'COMMENTED_ONLY', items: [],
  hasMore: false, cursor: null, totalCount: 0, notListedCount: 0, more: 'idle' });

/**
 * The received reviews of the signed-in account, a page of 20 at a time (PROFILE-TRUST, R30). The server decides what is listed one by
 * one (`mode`) and says how many reviews it does not list (`notListedCount`); this only keeps what came back, never merges a review
 * twice, and drops everything when the account changes. A failed first read is an error (never an empty list); a failed next page keeps
 * the page that was read and offers it again.
 */
export function useReceivedReviews(refreshRevision = 0) {
  const { user, accountRevision } = useSesija();
  const accountId = user?.id;
  const scope = `${accountId ?? ''}:${accountRevision}`;
  const [held, setHeld] = useState<ReceivedReviewsState>(() => waiting(scope));
  const state = held.scope === scope ? held : waiting(scope);
  // A read belongs to the account that asked: a later load, another account or an unmount retires it.
  const generation = useRef(0), asking = useRef(false);

  const load = useCallback(async () => {
    const mine = ++generation.current;
    asking.current = false;
    if (!accountId) { setHeld(waiting(scope, 'error')); return; }
    // A return to the screen must re-read the first page, but must not blank the last good page.
    setHeld(current => current.scope === scope && current.phase === 'ready' ? { ...current, more: 'idle' } : waiting(scope));
    let result;
    try { result = await workTrustClientService.receivedReviews({ limit: RECEIVED_REVIEWS_PAGE_SIZE }, { accountId, accountRevision }); } catch { result = null; }
    if (mine !== generation.current) return;
    if (!result || !result.ok) {
      setHeld(current => current.scope === scope && current.phase === 'ready' ? { ...current, more: 'idle' } : waiting(scope, 'error'));
      return;
    }
    const page = result.podatak;
    setHeld({ scope, phase: 'ready', mode: page.mode, items: page.items, hasMore: page.hasMore, cursor: page.nextAfter, totalCount: page.totalCount,
      notListedCount: page.notListedCount, more: 'idle' });
  }, [scope, accountId, accountRevision]);
  useEffect(() => { void load(); return () => { generation.current += 1; }; }, [load, refreshRevision]);

  const loadMore = useCallback(async () => {
    const cursor = state.cursor;
    if (!accountId || asking.current || state.phase !== 'ready' || !state.hasMore || !cursor) return;
    const mine = generation.current;
    asking.current = true;
    setHeld(current => current.scope === scope ? { ...current, more: 'loading' } : current);
    let result;
    try { result = await workTrustClientService.receivedReviews({ limit: RECEIVED_REVIEWS_PAGE_SIZE, after: cursor }, { accountId, accountRevision }); } catch { result = null; }
    if (mine !== generation.current) return;
    asking.current = false;
    setHeld(current => {
      if (current.scope !== scope) return current;
      if (!result || !result.ok) return { ...current, more: 'error' };
      const page = result.podatak;
      // A review that came twice is shown once; the totals are the newest the server said.
      const fresh = page.items.filter(item => !current.items.some(seen => seen.reviewId === item.reviewId));
      return { ...current, more: 'idle', mode: page.mode, items: [...current.items, ...fresh], hasMore: page.hasMore, cursor: page.nextAfter,
        totalCount: page.totalCount, notListedCount: page.notListedCount };
    });
  }, [state.cursor, state.hasMore, state.phase, scope, accountId, accountRevision]);

  return { state, reload: load, loadMore };
}
