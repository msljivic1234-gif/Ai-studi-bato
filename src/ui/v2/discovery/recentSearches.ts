import { useCallback, useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { placeKey } from '../../../data/marketplaceView';
import { recentSearchesKey } from '../../../data/recentSearchesKey';
import { foldPlace } from './popularCities';

/**
 * What was searched before (the owner-approved plan, U4: "skorašnje pretrage"): the last few searches the person made, each the words and/or the place, newest first,
 * so a search they made is one tap away. It is theirs alone and stays on this phone: it is kept per account, in the app's own small storage (the same as the other
 * small things the app remembers on a phone), never sent anywhere and never read by anything but the search. A search with neither words nor a place is not a search
 * and is not kept; the same search again moves to the top instead of standing twice; and the list never holds more than `RECENT_MAX`.
 */
export type RecentSearch = { query: string; place: string | null };
export const RECENT_MAX = 5;
/** A word or a place longer than this was never typed to be found again. */
const TEXT_MAX = 60;
// The local sign-out forgets this same key (authClientService.signOutLocal).
const storageKey = recentSearchesKey;
const placeOf = (value: string | null | undefined) => typeof value === 'string' && value.trim() ? value.trim().slice(0, TEXT_MAX) : null;
const same = (a: RecentSearch, b: RecentSearch) => foldPlace(a.query) === foldPlace(b.query) && (a.place ? placeKey(a.place) : '') === (b.place ? placeKey(b.place) : '');

/** The list after one more search: the new one first, an equal one gone from where it was, at most `RECENT_MAX`. A search of nothing leaves the list as it was. */
export function rememberRecent(list: readonly RecentSearch[], next: RecentSearch): RecentSearch[] {
  const entry: RecentSearch = { query: next.query.trim().slice(0, TEXT_MAX), place: placeOf(next.place) };
  if (!entry.query && !entry.place) return [...list];
  return [entry, ...list.filter(item => !same(item, entry))].slice(0, RECENT_MAX);
}

/** What was stored, as a list that can be trusted: anything that is not a list of searches is nothing, and every entry is cut to what the search itself would keep. */
export function parseRecent(raw: string | null | undefined): RecentSearch[] {
  if (typeof raw !== 'string') return [];
  let value: unknown;
  try { value = JSON.parse(raw); } catch { return []; }
  if (!Array.isArray(value)) return [];
  let list: RecentSearch[] = [];
  for (const entry of [...value].reverse()) {
    if (!entry || typeof entry !== 'object') continue;
    const { query, place } = entry as { query?: unknown; place?: unknown };
    list = rememberRecent(list, { query: typeof query === 'string' ? query : '', place: typeof place === 'string' ? place : null });
  }
  return list;
}

/** The account the searches belong to: the part of the screen's scope before the revision, so a new session of the same account keeps them and another account never sees them. */
export const recentAccount = (scopeKey: string) => scopeKey.split(':')[0] || 'anonymous';

/**
 * The recent searches of this account. They are read only once the search is opened (`enabled`), so a screen that is never searched never touches the storage;
 * `remember` keeps one more. A storage that fails is not an error the person can do anything about: the search simply has no recent searches.
 */
export function useRecentSearches(scopeKey: string, enabled: boolean): { items: readonly RecentSearch[]; remember: (next: RecentSearch) => void } {
  const account = recentAccount(scopeKey);
  // Storage stays per account; in-memory reads and callbacks belong to the current session revision.
  const [snapshot, setSnapshot] = useState<{ scopeKey: string; items: readonly RecentSearch[] }>({ scopeKey, items: [] });
  const current = useRef(snapshot), loaded = useRef<string | null>(null);
  const liveScope = useRef(scopeKey), mounted = useRef(true);
  liveScope.current = scopeKey;
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => {
    if (current.current.scopeKey !== scopeKey) {
      current.current = { scopeKey, items: [] }; loaded.current = null;
      setSnapshot(current.current);
    }
    if (!enabled || loaded.current === scopeKey) return;
    let alive = true;
    try {
      Promise.resolve(AsyncStorage.getItem(storageKey(account))).then(raw => {
        if (!alive || liveScope.current !== scopeKey) return;
        const stored = parseRecent(raw);
        // A search made while the list was still being read stays on top of it.
        const merged = current.current.items.reduceRight<RecentSearch[]>((all, entry) => rememberRecent(all, entry), stored);
        current.current = { scopeKey, items: merged }; setSnapshot(current.current);
        // Only an accepted read is loaded. Closing early or storage failure can retry on reopening.
        loaded.current = scopeKey;
      }, () => undefined);
    } catch { /* no storage: no recent searches */ }
    return () => { alive = false; };
  }, [scopeKey, account, enabled]);
  const remember = useCallback((next: RecentSearch) => {
    if (!mounted.current || liveScope.current !== scopeKey) return;
    const list = rememberRecent(current.current.scopeKey === scopeKey ? current.current.items : [], next);
    current.current = { scopeKey, items: list }; setSnapshot(current.current);
    try { Promise.resolve(AsyncStorage.setItem(storageKey(account), JSON.stringify(list))).catch(() => undefined); } catch { /* the list stays on screen for this visit */ }
  }, [scopeKey, account]);
  return { items: snapshot.scopeKey === scopeKey ? snapshot.items : [], remember };
}
