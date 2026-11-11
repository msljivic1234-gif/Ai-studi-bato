import { useCallback, useEffect, useRef, useState } from 'react';

/** How long a pull waits for its read to start before it lets go (a read already running, or one the screen refused). */
export const PULL_GRACE_MS = 600;

/**
 * The pull-to-refresh spinner, shown only for a pull. A list that reads again on its own (a tab switched, a screen focused, a page
 * that follows) must not raise it: on Android the spinner is a white disc at the top centre of the list, and the owner's phone
 * caught it half grown over the Aktivni/Završeni switch of Poruke (8 Oct 2026, the "dot" on his screenshot), because the list
 * passed every background read to `refreshing`.
 *
 * `busy` is the screen's own "a read is running". The spinner stays while the read the pull started runs and goes when it ends;
 * a pull that starts nothing lets go after `PULL_GRACE_MS`, so a later background read never borrows it.
 */
export function usePullRefresh(onRefresh: (() => void) | undefined, busy: boolean): { refreshing: boolean; onRefresh: (() => void) | undefined } {
  const [pulled, setPulled] = useState(false);
  const started = useRef(false);
  useEffect(() => {
    if (!pulled) return;
    if (busy) { started.current = true; return; }
    if (started.current) { started.current = false; setPulled(false); return; }
    const timer = setTimeout(() => setPulled(false), PULL_GRACE_MS);
    return () => clearTimeout(timer);
  }, [pulled, busy]);
  const pull = useCallback(() => { started.current = false; setPulled(true); onRefresh?.(); }, [onRefresh]);
  return { refreshing: pulled && busy, onRefresh: onRefresh ? pull : undefined };
}
