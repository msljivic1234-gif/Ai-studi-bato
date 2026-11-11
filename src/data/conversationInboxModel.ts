import type { ConversationInboxItem, ConversationInboxPage } from '../contracts/conversationInbox';
import type { ConversationInboxPort } from './conversationInboxClientService';
import { calendarInstant } from '../lib/calendarTime';

export type ConversationInboxState = Readonly<{
  page: ConversationInboxPage | null;
  loadedPages: number;
  loading: boolean;
  refreshing: boolean;
  paging: boolean;
  stale: boolean;
  error: 'load' | 'refresh' | 'page' | null;
  errorCode: string | null;
}>;
const EMPTY: ConversationInboxState = {
  page: null, loadedPages: 0, loading: false, refreshing: false, paging: false,
  stale: true, error: null, errorCode: null,
};
const TRANSPORT = 'CONVERSATION_INBOX_TRANSPORT_UNAVAILABLE';
const INVALID = 'CONVERSATION_INBOX_INVALID_RESPONSE';
const key = (row: ConversationInboxItem) => `${row.kind}:${row.id.toLowerCase()}`;

/** The port validates each page. This model also rejects duplicate/mismatched page chains. */
function append(previous: ConversationInboxPage, next: ConversationInboxPage): ConversationInboxPage {
  if (previous.accountId.toLowerCase() !== next.accountId.toLowerCase()
    || calendarInstant(previous.snapshotAt) !== calendarInstant(next.snapshotAt)) throw new Error(INVALID);
  const seen = new Set(previous.items.map(key));
  if (next.items.some(row => seen.has(key(row)))) throw new Error(INVALID);
  return { ...next, snapshotAt: previous.snapshotAt, items: [...previous.items, ...next.items] };
}

/** In-memory, account-owned inbox. No ACK, message reads, persistence, polling or replay. */
export function createConversationInboxModel(port: ConversationInboxPort, isCurrent: () => boolean) {
  let state = EMPTY;
  let active = false, generation = 0;
  let controller: AbortController | null = null;
  type Flight = { promise: Promise<void> };
  type Trailing = { promise: Promise<void>; resolve: () => void };
  let flight: Flight | null = null, trailing: Trailing | null = null;
  const cancelHints = () => {
    flight = null;
    const pending = trailing; trailing = null; pending?.resolve();
  };
  const listeners = new Set<() => void>();
  const publish = (next: ConversationInboxState) => {
    state = next;
    listeners.forEach(listener => listener());
  };
  function retire() {
    generation++;
    const previous = controller; controller = null;
    previous?.abort();
  }
  function forget() {
    active = false; cancelHints(); retire(); publish(EMPTY);
  }
  function owned(token: number) {
    if (!active || token !== generation) return false;
    if (isCurrent()) return true;
    forget(); return false;
  }
  function available() {
    if (!isCurrent()) { forget(); return false; }
    return active;
  }
  const busy = () => state.loading || state.refreshing || state.paging;

  async function read(mode: 'load' | 'refresh' | 'page', targetPages: number, add: boolean) {
    if (!available()) return;
    const retained = state;
    retire();
    const token = generation, request = new AbortController(); controller = request;
    publish({ ...state, loading: state.page === null, refreshing: state.page !== null && mode !== 'page',
      paging: state.page !== null && mode === 'page', stale: true, error: null, errorCode: null });
    const fail = (code: string) => {
      if (!owned(token)) return;
      const keep = code === TRANSPORT && retained.page !== null;
      publish({ ...(keep ? retained : EMPTY), loading: false, refreshing: false, paging: false,
        stale: true, error: mode, errorCode: code });
    };
    try {
      let page: ConversationInboxPage | null = add ? retained.page : null;
      let depth = add ? retained.loadedPages : 0;
      do {
        if (!owned(token)) return;
        const cursor = page?.nextCursor ?? null;
        // Revalidation always starts at the current first page, never an old snapshot cursor.
        const result = await port.list(cursor, request.signal);
        if (!owned(token)) return;
        if (!result.ok) { fail(result.kod); return; }
        page = page ? append(page, result.podatak) : result.podatak;
        depth++;
      } while (depth < targetPages && page.nextCursor !== null);
      if (owned(token)) publish({ page, loadedPages: depth, loading: false, refreshing: false, paging: false,
        stale: false, error: null, errorCode: null });
    } catch (error) {
      // An arbitrary exception (including one named "offline") is not proof of a transport-only failure.
      fail(error instanceof Error && error.message === INVALID ? INVALID : 'CONVERSATION_INBOX_UNCONFIRMED');
    } finally {
      request.abort();
      if (controller === request) controller = null;
    }
  }
  // Hints join the current read, then request one fresh chain after it. They never abort pagination.
  function run(mode: 'load' | 'refresh' | 'page', targetPages: number, add: boolean): Promise<void> {
    if (!available()) return Promise.resolve();
    const owner: Flight = { promise: Promise.resolve() };
    flight = owner;
    owner.promise = read(mode, targetPages, add).finally(() => {
      if (flight !== owner) return;
      flight = null;
      const pending = trailing; trailing = null;
      if (!pending) return;
      // An already queued hint is not permission to replay an invalid/auth-failed read.
      if (!available() || (state.error !== null && state.errorCode !== TRANSPORT)) { pending.resolve(); return; }
      const depth = Math.max(1, state.loadedPages, mode === 'page' ? targetPages : 0);
      void run(state.page ? 'refresh' : 'load', depth, false).then(pending.resolve, pending.resolve);
    });
    return owner.promise;
  }
  function revalidate(): Promise<void> {
    if (!available()) return Promise.resolve();
    if (!flight) return run(state.page ? 'refresh' : 'load', Math.max(1, state.loadedPages), false);
    if (!trailing) {
      let resolve!: () => void;
      const promise = new Promise<void>(done => { resolve = done; });
      trailing = { promise, resolve };
    }
    return trailing.promise;
  }
  return {
    // A retained old model cannot expose another account's data during the owner's replacement render.
    snapshot: (): ConversationInboxState => isCurrent() ? state : EMPTY,
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    start(): Promise<void> {
      if (!isCurrent()) { forget(); return Promise.resolve(); }
      if (active) return Promise.resolve();
      active = true;
      return run(state.page ? 'refresh' : 'load', Math.max(1, state.loadedPages), false);
    },
    // Short in-app Back retains all loaded rows and depth; start revalidates them atomically.
    stop() {
      if (!isCurrent()) { forget(); return; }
      active = false; cancelHints(); retire();
      publish({ ...state, loading: false, refreshing: false, paging: false, stale: true });
    },
    // Background or account teardown is deliberately stronger than an ordinary blur.
    forget,
    refresh(): Promise<void> { return run(state.page ? 'refresh' : 'load', 1, false); },
    revalidate,
    more(): Promise<void> {
      if (!available() || flight || busy() || !state.page?.nextCursor) return Promise.resolve();
      if (state.stale) {
        // After a page transport failure, revalidate the whole chain before admitting row opens again.
        return state.error === 'page' && state.errorCode === TRANSPORT
          ? run('page', state.loadedPages + 1, false) : Promise.resolve();
      }
      return run('page', state.loadedPages + 1, true);
    },
    canOpen(row: ConversationInboxItem): boolean {
      return active && isCurrent() && !trailing && !state.stale && !busy() && !state.error && !!state.page?.items.includes(row);
    },
  };
}
