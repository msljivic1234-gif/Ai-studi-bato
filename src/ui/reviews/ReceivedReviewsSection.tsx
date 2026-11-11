import { ReceivedReviewsList, type ReceivedReviewPhoto, type ReceivedReviewsView } from './ReceivedReviewsList';
import { useReceivedReviews } from './useReceivedReviews';

/**
 * The reviews the signed-in person received (PROFILE-TRUST, R30), read page by page and drawn by `ReceivedReviewsList`. It reads when it
 * mounts and when the account changes; what was read for another account is never drawn for this one. The route draws it only in a
 * build that carries the written comments (`reviewCommentBuilt`), the same gate the comments always had.
 */
export function ReceivedReviewsSection({ photo, refreshRevision = 0 }: { photo?: ReceivedReviewPhoto; refreshRevision?: number }) {
  const { state, reload, loadMore } = useReceivedReviews(refreshRevision);
  const view: ReceivedReviewsView = state.phase === 'loading' ? { kind: 'loading' }
    : state.phase === 'error' ? { kind: 'error', onRetry: () => { void reload(); } }
      : { kind: 'ready', mode: state.mode, items: state.items, totalCount: state.totalCount, notListedCount: state.notListedCount, hasMore: state.hasMore,
        more: state.more, onMore: () => { void loadMore(); } };
  return <ReceivedReviewsList view={view} photo={photo} />;
}
