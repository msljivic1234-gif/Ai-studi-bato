/**
 * EX-04 (S1 A09 Moji zadaci, S2 B10 Moje prijave): the ONE owner of a personal list that is read a keyset page at a time. React-free and clock-injected, so every
 * rule below is a plain test. The list-specific parts (the scopes, the cursor, the counts, the key of an item) are type parameters; the rules are the same for both lists.
 *
 * - One set per scope (the tabs of the screen), kept while the screen lives: coming back to a tab shows what it had and re-reads quietly, exactly as
 *   `createFocusedResource` does for a whole list. The app leaving the foreground forgets everything (the recents photograph).
 * - A read belongs to one epoch (focus), one set and one version of it. A page that started before the first page replaced the set, before a blur, a
 *   background or a change of account is discarded: an old cursor never meets a new set ("Insert/update tokom listanja ne prihvata stari cursor").
 * - A page never duplicates an item; an item seen twice stays where it was first seen (an item that moved to a later section between two pages is shown where the
 *   walk first met it, never twice).
 * - The counts come with the first page of ANY scope and are the only counts there are: a tab badge never counts what happens to be loaded.
 * - Returning to a screen re-reads as many pages as were loaded (bounded), so the reading position survives; a pull-to-refresh starts again from the top.
 * - `ensureComplete(true)` reads the rest of the set, one page at a time up to a bound, for as long as a search, a filter or a destination that must be found
 *   refines it: a refinement of an incomplete set would answer wrongly. With `until` it stops as soon as what is loaded satisfies it (the destination has been met),
 *   checked before every further page, so a page is never read for something that is already on screen.
 * - A first page that fails shows an error only when nothing is on screen; a later page that fails keeps the list and asks for a retry at its foot.
 * - `reload` is the first page asked for by a screen that owns its own read (it answers whether the page is now fresh and on screen); `start` is the focus of a screen that
 *   lets the pager read for it.
 */
export type PagedListPage<Item, Cursor, Counts> = { items: Item[]; hasMore: boolean; counts: Counts | null; cursor: Cursor | null };
export type PagedListRequest<Scope, Cursor> = { scope: Scope; limit: number; cursor: Cursor | null };
export type PagedListState<Item, Scope, Counts> = {
  scope: Scope | null;
  items: readonly Item[];
  /** The server's counts of the sets; null until some first page answered. */
  counts: Counts | null;
  /** The first page of the shown set has not answered yet and nothing is on screen. */
  loading: boolean;
  /** The first page is being read again while the set stays on screen. */
  refreshing: boolean;
  /** The first page failed and nothing is on screen. */
  error: boolean;
  hasMore: boolean; loadingMore: boolean; moreError: boolean;
  /** Automatic completion stopped at maxPages; manual Load more can continue. */
  pageBoundReached: boolean;
};
export type PagedListOptions<Item, Scope, Cursor, Counts> = {
  readPage: (request: PagedListRequest<Scope, Cursor>) => Promise<PagedListPage<Item, Cursor, Counts>>;
  isCurrent: () => boolean;
  keyOf: (item: Item) => string;
  limit: number;
  now?: () => number; maxPages?: number; reloadPages?: number;
};
/** How the first page of a set is read: `load` shows nothing until it answers, `keep` is a pull-to-refresh, `silent` is a return to the screen, `auto` picks between `silent` and `load`. */
export type PagedListReload = 'auto' | 'keep' | 'silent';

/** Coming back to a tab after this long loads it as if for the first time (the same bound as every focused list). */
export const PAGED_LIST_STALE_MS = 5 * 60_000;

type SetState<Item, Cursor> = {
  items: Item[]; ids: Set<string>; cursor: Cursor | null; hasMore: boolean; pages: number;
  loaded: boolean; loadedAt: number; version: number;
  firstToken: number; firstFlight: boolean; firstError: boolean;
  moreToken: number; moreFlight: boolean; moreError: boolean;
};

export function createPagedListPager<Item, Scope extends string, Cursor, Counts>(options: PagedListOptions<Item, Scope, Cursor, Counts>) {
  const { readPage, isCurrent, keyOf, limit, now = Date.now, maxPages = 50, reloadPages = 5 } = options;
  const sets = new Map<Scope, SetState<Item, Cursor>>();
  const listeners = new Set<() => void>();
  const EMPTY: readonly Item[] = Object.freeze([]);
  let scope: Scope | null = null, counts: Counts | null = null, complete = false, until: ((items: readonly Item[]) => boolean) | undefined, active = false, epoch = 0;
  let state: PagedListState<Item, Scope, Counts> = build();

  function ensure(key: Scope): SetState<Item, Cursor> {
    let set = sets.get(key);
    if (!set) { set = { items: [], ids: new Set(), cursor: null, hasMore: false, pages: 0, loaded: false, loadedAt: 0, version: 0,
      firstToken: 0, firstFlight: false, firstError: false, moreToken: 0, moreFlight: false, moreError: false }; sets.set(key, set); }
    return set;
  }
  function build(): PagedListState<Item, Scope, Counts> {
    const set = scope ? sets.get(scope) : undefined;
    if (!scope) return { scope, items: EMPTY, counts, loading: false, refreshing: false, error: false, hasMore: false, loadingMore: false, moreError: false, pageBoundReached: false };
    if (!set) return { scope, items: EMPTY, counts, loading: true, refreshing: false, error: false, hasMore: false, loadingMore: false, moreError: false, pageBoundReached: false };
    return { scope, items: set.items, counts, loading: !set.loaded && !set.firstError, refreshing: set.loaded && set.firstFlight,
      error: !set.loaded && set.firstError, hasMore: set.loaded && set.hasMore, loadingMore: set.moreFlight, moreError: set.moreError,
      pageBoundReached: set.loaded && set.hasMore && set.pages >= maxPages };
  }
  function show() { state = build(); listeners.forEach(listener => listener()); }
  function merge(set: SetState<Item, Cursor>, incoming: readonly Item[]) {
    const fresh = incoming.filter(item => !set.ids.has(keyOf(item)));
    if (!fresh.length) return;
    fresh.forEach(item => set.ids.add(keyOf(item)));
    set.items = [...set.items, ...fresh];
  }
  const howFor = (set: SetState<Item, Cursor> | undefined): 'load' | 'silent' => set && set.loaded && now() - set.loadedAt < PAGED_LIST_STALE_MS ? 'silent' : 'load';

  /**
   * The first page of a set. Resolves true when the page (or, for `silent`, as many pages as were loaded) was read and put on screen, false when it failed or was
   * retired by a newer read, a blur, a background or another account.
   */
  async function readFirst(key: Scope, how: 'load' | 'keep' | 'silent'): Promise<boolean> {
    if (!active || !isCurrent()) return false;
    const set = ensure(key), token = ++set.firstToken, captured = epoch;
    if (how === 'load' && set.loaded) { set.items = []; set.ids = new Set(); set.cursor = null; set.hasMore = false; set.pages = 0; set.loaded = false; }
    const depth = how === 'silent' ? Math.min(Math.max(set.pages, 1), reloadPages) : 1;
    const current = () => active && epoch === captured && set.firstToken === token && isCurrent();
    set.firstFlight = true; set.firstError = false; show();
    try {
      let page = await readPage({ scope: key, limit, cursor: null });
      if (!current()) return false;
      const firstCounts = page.counts, collected: Item[] = [...page.items];
      let cursor = page.cursor, hasMore = page.hasMore, pages = 1;
      while (pages < depth && hasMore && cursor) {
        page = await readPage({ scope: key, limit, cursor });
        if (!current()) return false;
        collected.push(...page.items); cursor = page.cursor ?? cursor; hasMore = page.hasMore; pages += 1;
      }
      const ids = new Set<string>(), items = collected.filter(item => !ids.has(keyOf(item)) && !!ids.add(keyOf(item)));
      Object.assign(set, { items, ids, cursor, hasMore, pages, loaded: true, loadedAt: now(), moreError: false, moreFlight: false });
      set.version += 1; set.moreToken += 1;
      if (firstCounts) counts = firstCounts;
      return true;
    } catch {
      if (!current()) return false;
      // What is on screen is the last thing the server said; only an empty screen turns into an error.
      if (!set.loaded) set.firstError = true;
      return false;
    } finally {
      if (set.firstToken === token && captured === epoch) { set.firstFlight = false; show(); pump(); }
    }
  }

  /** The next page of a set, from the cursor of its last item. */
  async function readMore(key: Scope): Promise<void> {
    const set = sets.get(key);
    if (!active || !isCurrent() || !set || !set.loaded || !set.hasMore || set.moreFlight || set.firstFlight || !set.cursor) return;
    const token = ++set.moreToken, version = set.version, captured = epoch;
    const live = () => active && epoch === captured && set.moreToken === token && set.version === version && isCurrent();
    set.moreFlight = true; set.moreError = false; show();
    try {
      const page = await readPage({ scope: key, limit, cursor: set.cursor });
      if (!live()) return;
      merge(set, page.items);
      set.cursor = page.cursor ?? set.cursor; set.hasMore = page.hasMore; set.pages += 1;
    } catch {
      if (live()) set.moreError = true;
    } finally {
      if (set.moreToken === token && captured === epoch && set.version === version) { set.moreFlight = false; show(); pump(); }
    }
  }
  /** While a refinement is on, the rest of the shown set is read, one page at a time, until it is complete or the bound is reached. */
  function pump() {
    if (!complete || !active || !scope) return;
    const set = sets.get(scope);
    if (set && set.loaded && set.hasMore && !set.moreFlight && !set.firstFlight && !set.moreError && set.pages < maxPages && !until?.(set.items)) void readMore(scope);
  }

  return {
    snapshot: () => state,
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    /** Focus: what the sets already hold is shown at once and read again quietly; a set older than the bound loads as if new. */
    start() {
      active = true;
      if (!isCurrent()) { epoch += 1; sets.clear(); counts = null; show(); return; }
      if (scope) void readFirst(scope, howFor(sets.get(scope)));
      else show();
    },
    /** Focus of a screen that owns its own read: the pager is live (it fences, it keeps what it holds) but reads nothing until `reload` or a scope change asks. */
    activate() {
      active = true;
      if (!isCurrent()) { epoch += 1; sets.clear(); counts = null; }
      show();
    },
    /** Blur: reads in flight are retired; what the sets hold stays. */
    stop() {
      active = false; epoch += 1;
      for (const set of sets.values()) { set.firstFlight = false; set.moreFlight = false; }
      show();
    },
    /** The app leaves the foreground: the recents photograph must not hold somebody's data. */
    forget() {
      active = false; epoch += 1; sets.clear(); counts = null; show();
    },
    /** The set the person is looking at (null: nothing to read). A set already held is shown at once and read again quietly. */
    setScope(next: Scope | null) {
      if (next === scope) return;
      scope = next;
      if (next && active) { const set = sets.get(next); void readFirst(next, set && set.loaded ? 'silent' : 'load'); }
      show();
    },
    /** The first page of the shown set again; true when it is fresh and on screen. `keep` (the default) reads from the top, `silent` keeps the loaded depth, `auto` is what focus does. */
    reload(how: PagedListReload = 'keep'): Promise<boolean> {
      if (!scope) return Promise.resolve(false);
      return readFirst(scope, how === 'auto' ? howFor(sets.get(scope)) : how);
    },
    /** Pull-to-refresh: the first page again, from the top; the set stays on screen while it is read. */
    refresh(): Promise<boolean> { return scope ? readFirst(scope, 'keep') : Promise.resolve(false); },
    /** After a command that moved an item between sections: the sets that are not shown are dropped, so each is read again as new when it is asked for. */
    forgetOtherSets() {
      for (const key of [...sets.keys()]) if (key !== scope) sets.delete(key);
      show();
    },
    /** The next page; after a failed one, the same call is the retry. */
    loadMore(): Promise<void> {
      if (!scope) return Promise.resolve();
      const set = sets.get(scope);
      if (set?.moreError) { set.moreError = false; show(); }
      return readMore(scope);
    },
    ensureComplete(on: boolean, stop?: (items: readonly Item[]) => boolean) { complete = on; until = on ? stop : undefined; pump(); },
  };
}
export type PagedListPager<Item, Scope extends string, Cursor, Counts> = ReturnType<typeof createPagedListPager<Item, Scope, Cursor, Counts>>;
