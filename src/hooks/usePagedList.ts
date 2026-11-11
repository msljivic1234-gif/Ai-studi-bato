import { useCallback, useEffect, useMemo, useSyncExternalStore } from 'react';
import { AppState } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { sesijaSada, useSesija } from '../store/sesija';

/** What the lifecycle needs from a paged-list pager (`createPagedListPager` and its wrappers). */
type PagerLike<Scope> = {
  snapshot: () => unknown; subscribe: (listener: () => void) => () => void;
  setScope: (scope: Scope | null) => void; ensureComplete: (on: boolean, until?: (items: readonly any[]) => boolean) => void;
  start: () => void; activate: () => void; stop: () => void; forget: () => void;
};

/**
 * The lifecycle of a personal list that is read a page at a time (EX-04 S1 Moji zadaci, S2 Moje prijave): the lifecycle of `useFocusedResource`. Focus starts it, blur
 * retires its reads, the app leaving the foreground forgets it, and a different account is a different pager that starts empty. The scope and the "read the whole set"
 * flag are inputs; everything a page may or may not do is the pager's.
 *
 * `focus: 'start'` — the pager reads for the screen at focus (Moji zadaci). `'activate'` — the screen owns its first read (Moje prijave, whose editor reads, reconciles a pending
 * command and then asks the pager for the first page): the pager is live and fences, and reads only when a scope change or a `reload` asks.
 */
export function usePagedList<Scope, Pager extends PagerLike<Scope>>(create: (isCurrent: () => boolean) => Pager,
  scope: Scope | null, complete: boolean, focus: 'start' | 'activate', until?: (items: readonly any[]) => boolean) {
  const { user, accountRevision } = useSesija();
  const accountId = user?.id;
  const pager = useMemo(() => create(() => !!accountId && sesijaSada().user?.id === accountId && sesijaSada().accountRevision === accountRevision),
    [create, accountId, accountRevision]);
  const snapshot = pager.snapshot as () => ReturnType<Pager['snapshot']>;
  const state = useSyncExternalStore(pager.subscribe, snapshot, snapshot);
  useEffect(() => { pager.setScope(scope); }, [pager, scope]);
  useEffect(() => { pager.ensureComplete(complete, until); }, [pager, complete, until]);
  useFocusEffect(useCallback(() => {
    const begin = () => { if (focus === 'start') pager.start(); else pager.activate(); };
    // Never start a known-background read; every pause retires its epoch.
    if (AppState.currentState !== 'background' && AppState.currentState !== 'inactive') begin();
    const subscription = AppState.addEventListener('change', value => {
      // Leaving the app is not leaving the screen: the recents switcher photographs what is on it, so that one forgets.
      if (value === 'active') begin();
      else pager.forget();
    });
    return () => { subscription.remove(); pager.stop(); };
  }, [pager, focus]));
  return { state, pager };
}
