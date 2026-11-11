import { readFailureReason, type ReadFailureReason } from './readFailure';

export type ResourceState<T> = { data: T | null; loading: boolean; error: boolean;
  /** Safe category for the current failed read; error remains the existing boolean state. */
  errorReason?: ReadFailureReason;
  /** A user-asked re-read while what is on screen stays on screen. Never true on a first load. */
  refreshing: boolean;
  /** Opt-in retained refresh failed; data is still the last successfully read snapshot. */
  refreshError?: boolean };

export type FocusedResourceOptions = {
  /** Preserve an already loaded snapshot through an explicit re-read and its failure. */
  retainOnRefresh?: boolean;
  /** One active read; requests during it share one trailing re-read, never overlap. */
  coalesce?: boolean;
};
type RefreshMode = boolean | 'load' | 'keep' | 'silent';

/** Coming back to a screen after this long is not "coming back"; it loads as if for the first time. */
const STALE_MS = 5 * 60_000;

/** A read belongs to one focused account/intent and one request generation. */
export function createFocusedResource<T>(load: (signal: AbortSignal) => Promise<T>, isCurrent: () => boolean, options: FocusedResourceOptions = {}) {
  let state: ResourceState<T> = { data: null, loading: true, error: false, refreshing: false };
  let active = false;
  let generation = 0;
  let leftAt = 0;
  const listeners = new Set<() => void>();
  const empty: ResourceState<T> = { data: null, loading: true, error: false, refreshing: false };
  type Flight = { again: boolean; mode: RefreshMode; promise: Promise<void> };
  let flight: Flight | null = null;
  let readAbort: AbortController | null = null;
  const abortRead = () => { const previous = readAbort; readAbort = null; previous?.abort(); };
  const publish = (next: ResourceState<T>) => {
    state = next;
    listeners.forEach(listener => listener());
  };
  /**
   * Three ways to read, and the difference between them is only what the person sees while it runs.
   *
   * `'load'` is a first read: there is nothing to show, so the screen shows that it is loading.
   * `'keep'` is a re-read the person asked for: pulling a list down used to delete every card, the
   * count and the create button and replace them with skeletons, so what is on screen stays and is
   * marked `refreshing`. `'silent'` is the one that runs when you come back to a screen: it shows
   * what the screen had and replaces it when the answer lands, with nothing flashing in between.
   *
   * The authority rule is unchanged and lives in `isCurrent`: nothing from another account or intent
   * is ever published, and a change of either builds a new resource that starts empty.
   */
  async function read(mode: RefreshMode) {
    if (!active || !isCurrent()) return;
    const how = mode === true ? 'keep' : mode === false ? 'load' : mode;
    const request = ++generation;
    const controller = new AbortController(), previous = readAbort;
    readAbort = controller;
    previous?.abort();
    // A load may ignore abort; generation/account guards remain the publication authority.
    if (!active || request !== generation || !isCurrent()) { controller.abort(); return; }
    const holding = how !== 'load' && state.data !== null && !state.error;
    if (!holding) publish(empty);
    else if (how === 'keep') publish({ ...state, refreshing: true, ...(options.retainOnRefresh ? { refreshError: false, errorReason: undefined } : {}) });
    try {
      const data = await load(controller.signal);
      if (active && request === generation && isCurrent()) publish({ data, loading: false, error: false, refreshing: false });
    } catch (error) {
      if (!active || request !== generation || !isCurrent()) return;
      // A re-read nobody asked for must not turn a screen that was working into an error. What is
      // on it is the last thing the server actually said; the refresh control can be asked again.
      publish(holding && options.retainOnRefresh ? { ...state, refreshing: false, refreshError: true, errorReason: readFailureReason(error) }
        : holding && how === 'silent' ? { ...state, refreshing: false }
        : { data: null, loading: false, error: true, refreshing: false, errorReason: readFailureReason(error) });
    } finally {
      // Also retires a reader abandoned by its caller's timeout race. Never abort a newer read.
      controller.abort();
      if (readAbort === controller) readAbort = null;
    }
  }
  function refresh(mode: RefreshMode = options.retainOnRefresh ? 'keep' : 'load'): Promise<void> {
    if (!active || !isCurrent()) return Promise.resolve();
    if (!options.coalesce) return read(mode);
    if (flight) {
      // A send may finish after the active read began. Joining that read alone could miss the
      // newly accepted message, so callers share one trailing read and await the whole drain.
      flight.again = true;
      if (mode !== 'silent') flight.mode = mode;
      return flight.promise;
    }
    const current: Flight = { again: false, mode, promise: Promise.resolve() };
    flight = current;
    current.promise = (async () => {
      try {
        do {
          current.again = false;
          await read(current.mode);
        } while (flight === current && current.again && active && isCurrent());
      } finally { if (flight === current) flight = null; }
    })();
    return current.promise;
  }
  return {
    snapshot: () => state,
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    /**
     * Focus. What the screen already had is shown at once and replaced when the new read lands,
     * because leaving a screen for a moment and coming back is not a reason to forget it. Two taps
     * between tabs used to cost two round trips and two skeletons.
     */
    start() {
      active = true;
      if (!isCurrent()) { abortRead(); publish(empty); return; }
      const recent = state.data !== null && !state.error && Date.now() - leftAt < STALE_MS;
      void refresh(recent ? 'silent' : 'load');
    },
    /**
     * Blur — another screen in the same app. The read is retired; what it produced stays, because
     * stepping to the next screen and back is not a reason to forget what you were looking at.
     */
    stop() {
      active = false;
      generation++;
      flight = null;
      abortRead();
      leftAt = Date.now();
      if (state.refreshing) publish({ ...state, refreshing: false });
    },
    /**
     * The app itself leaves the foreground. Here the wipe is the point: Android photographs the
     * screen for the recents switcher, and that photograph must not be somebody's private data. The
     * next focus loads it again from the server.
     */
    forget() {
      active = false;
      generation++;
      flight = null;
      abortRead();
      leftAt = 0;
      publish(empty);
    },
    refresh,
  };
}
