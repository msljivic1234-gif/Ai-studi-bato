import type { ReceiptAccount } from './serverReceipt';
import type { Ishod } from './ports';
import { compareAgreementMessageCursors, type AgreementHistoryMessage, type AgreementMessageCursor,
  type AgreementMessageHistoryPage, type AgreementMessageWindow } from './agreementMessageHistoryService';

export const AGREEMENT_HISTORY_LIMIT = 200;
export type AgreementHistoryPosition = { following: boolean; anchor?: { messageId: string } };
export type AgreementHistoryState = {
  data: AgreementHistoryMessage[] | null;
  olderCursor: AgreementMessageCursor | null;
  newerCursor: AgreementMessageCursor | null;
  loading: boolean;
  error: boolean;
  refreshing: boolean;
  refreshError: boolean;
  loadingOlder: boolean;
  loadingNewer: boolean;
  historyErrorDirection?: 'older' | 'newer';
};
type Port = {
  page(agreementId: string, options: { limit?: number; before?: AgreementMessageCursor; signal?: AbortSignal }, account: ReceiptAccount): Promise<Ishod<AgreementMessageHistoryPage>>;
  window(agreementId: string, targetMessageId: string, options: { beforeCount?: number; afterCount?: number; signal?: AbortSignal }, account: ReceiptAccount): Promise<Ishod<AgreementMessageWindow>>;
};
type Operation = 'restore' | 'refresh' | 'older' | 'newer' | 'latest';
const cursor = (message: AgreementHistoryMessage): AgreementMessageCursor => ({ createdAt: message.createdAt, messageId: message.id });
const compare = (left: AgreementHistoryMessage, right: AgreementHistoryMessage) => compareAgreementMessageCursors(cursor(left), cursor(right));
const authorityRefused = (code: string) => ['MEDIA_NOT_FOUND', 'AUTH_REQUIRED', 'AUTH_CONTEXT_CHANGED', 'AUTH_ACCOUNT_CHANGED', 'ACCOUNT_CLOSING'].includes(code);
const empty = (): AgreementHistoryState => ({ data: null, olderCursor: null, newerCursor: null,
  loading: true, error: false, refreshing: false, refreshError: false, loadingOlder: false, loadingNewer: false });

/** A contiguous, bounded interval. Eviction creates a resumable boundary, never a gap in the middle. */
export function mergeAgreementHistory(state: AgreementHistoryState, rows: readonly AgreementHistoryMessage[],
  before: AgreementMessageCursor | null, after: AgreementMessageCursor | null,
  operation: Operation, position: AgreementHistoryPosition, preserveMovedAnchor = false): Pick<AgreementHistoryState, 'data' | 'olderCursor' | 'newerCursor'> {
  if (operation === 'restore' || operation === 'latest' || !state.data?.length) return { data: [...rows], olderCursor: before, newerCursor: after };
  const previous = state.data;
  if (!rows.length) return { data: previous, olderCursor: operation === 'older' ? before : state.olderCursor, newerCursor: state.newerCursor };
  const first = rows[0], last = rows[rows.length - 1];
  // Replace the covered interval with this statement's rows. This also handles a removed row
  // inside a reread window; untouched sides remain the previously authorized projection.
  const byId = new Map(previous.filter(row => (compare(row, first) < 0 && before !== null)
    || (compare(row, last) > 0 && (operation === 'older' || after !== null))).map(row => [row.id, row]));
  for (const row of rows) byId.set(row.id, row);
  const merged = [...byId.values()].sort(compare);
  let olderCursor = before === null || compare(first, previous[0]) <= 0 ? before : state.olderCursor;
  let newerCursor = (operation !== 'older' && after === null) || compare(last, previous[previous.length - 1]) >= 0 ? after : state.newerCursor;
  let start = 0;
  if (merged.length > AGREEMENT_HISTORY_LIMIT) {
    if (operation === 'newer' || (operation === 'refresh' && position.following)) start = merged.length - AGREEMENT_HISTORY_LIMIT;
    else if (operation === 'refresh' && position.anchor) {
      const anchor = merged.findIndex(row => row.id === position.anchor!.messageId);
      // Preserve the reading anchor and its older context during an incoming refresh.
      start = Math.max(0, Math.min(merged.length - AGREEMENT_HISTORY_LIMIT, anchor - 24));
    }
    if (preserveMovedAnchor && position.anchor) {
      const anchor = merged.findIndex(row => row.id === position.anchor!.messageId);
      if (anchor >= 0 && anchor < start) start = anchor;
      else if (anchor >= start + AGREEMENT_HISTORY_LIMIT) start = anchor - AGREEMENT_HISTORY_LIMIT + 1;
    }
  }
  const data = merged.slice(start, start + AGREEMENT_HISTORY_LIMIT);
  if (start > 0) olderCursor = cursor(data[0]);
  if (start + data.length < merged.length) newerCursor = cursor(data[data.length - 1]);
  return { data, olderCursor, newerCursor };
}

/** B3 pages/window reads own one foreground visit; transport completion is never display authority. */
export function createAgreementHistoryModel(options: {
  account: ReceiptAccount; agreementId: string; port: Port; isCurrent: () => boolean;
  position: () => AgreementHistoryPosition;
}) {
  let state = empty(), active = false, generation = 0;
  const listeners = new Set<() => void>();
  let controller: AbortController | null = null;
  type Flight = { again: boolean; promise: Promise<void> };
  let flight: Flight | null = null;
  const publish = (next: AgreementHistoryState) => { state = next; listeners.forEach(listener => listener()); };
  const current = () => active && options.isCurrent();
  const retire = () => { active = false; generation++; flight = null; controller?.abort(); controller = null; };
  async function read(operation: Operation, silent: boolean) {
    if (!current()) return;
    const request = ++generation, abort = new AbortController();
    controller?.abort(); controller = abort;
    const previous = state, position = options.position();
    const rows = previous.data;
    const anchor = !position.following ? position.anchor?.messageId : undefined;
    const target = operation === 'restore' ? anchor
      : operation === 'newer' ? rows?.[rows.length - 1]?.id
        : operation === 'refresh' ? anchor && rows?.some(row => row.id === anchor) ? anchor : rows?.[rows.length - 1]?.id : undefined;
    const holding = rows !== null && operation !== 'restore';
    publish({ ...previous, loading: !holding, error: false, refreshing: holding && (operation === 'refresh' || operation === 'latest') && !silent,
      refreshError: false, loadingOlder: operation === 'older', loadingNewer: operation === 'newer', historyErrorDirection: undefined });
    let timeout: ReturnType<typeof setTimeout> | undefined;
    try {
      const requestPromise = operation === 'older' && previous.olderCursor
        ? options.port.page(options.agreementId, { limit: 50, before: previous.olderCursor, signal: abort.signal }, options.account)
        : target ? options.port.window(options.agreementId, target,
          { beforeCount: operation === 'newer' || (operation === 'refresh' && !anchor) ? 0 : 24,
            afterCount: operation === 'newer' || (operation === 'refresh' && !anchor) ? 49 : 25, signal: abort.signal }, options.account)
          : options.port.page(options.agreementId, { limit: 50, signal: abort.signal }, options.account);
      // A newest probe notices arrivals while the person reads an older anchor. It is
      // merged only on overlap; a disconnected newest page must never hide a gap.
      const newestPromise = operation === 'refresh' && rows?.length
        ? options.port.page(options.agreementId, { limit: 50, signal: abort.signal }, options.account) : null;
      const [result, newest] = await Promise.race([Promise.all([requestPromise, newestPromise]), new Promise<never>((_, reject) => {
        timeout = setTimeout(() => { abort.abort(); reject(new Error('CHAT_HISTORY_TIMEOUT')); }, 15_000);
      })]);
      if (!current() || request !== generation || abort.signal.aborted) return;
      if (!result.ok) throw new Error(result.kod);
      if (newest && !newest.ok && authorityRefused(newest.kod)) throw new Error(newest.kod);
      const response = result.podatak;
      const before = 'olderCursor' in response ? response.olderCursor : response.beforeCursor;
      // An older page says nothing about the retained newer boundary.
      const after = 'afterCursor' in response ? response.afterCursor : operation === 'older' ? previous.newerCursor : null;
      const livePosition = options.position();
      const movedWhilePaging = (operation === 'older' || operation === 'newer')
        && livePosition.anchor?.messageId !== position.anchor?.messageId;
      let next = mergeAgreementHistory(previous, response.messages, before, after, operation, livePosition, movedWhilePaging);
      // Concurrent reads can complete in either order. A probe from an older statement
      // must not overwrite a fresher window's removal/arrival evidence.
      const probeCurrent = newest?.ok && compareAgreementMessageCursors(
        { createdAt: newest.podatak.asOf, messageId: options.agreementId },
        { createdAt: response.asOf, messageId: options.agreementId }) >= 0;
      if (newest?.ok && probeCurrent && !newest.podatak.messages.length) next = { data: [], olderCursor: null, newerCursor: null };
      else if (newest?.ok && probeCurrent && next.data?.length && newest.podatak.messages.length) {
        const page = newest.podatak;
        const loaded = new Set(next.data.map(row => row.id));
        if (page.messages.some(row => loaded.has(row.id))) {
          next = mergeAgreementHistory({ ...previous, ...next }, page.messages, page.olderCursor, null, 'refresh', options.position());
        } else if (compare(page.messages[page.messages.length - 1], next.data[next.data.length - 1]) > 0) {
          next.newerCursor = cursor(next.data[next.data.length - 1]);
        }
      }
      publish({ ...empty(), ...next, loading: false, refreshError: newest !== null && !newest.ok });
    } catch (error) {
      if (!current() || request !== generation) return;
      publish(holding && !(error instanceof Error && authorityRefused(error.message)) ? { ...previous, loading: false, error: false, refreshing: false, loadingOlder: false, loadingNewer: false,
        refreshError: operation === 'refresh' || operation === 'latest', historyErrorDirection: operation === 'older' || operation === 'newer' ? operation : undefined }
        : { ...empty(), loading: false, error: true });
    } finally {
      if (timeout !== undefined) clearTimeout(timeout);
      abort.abort(); if (controller === abort) controller = null;
    }
  }
  function run(operation: Operation, silent = false): Promise<void> {
    if (!current()) return Promise.resolve();
    if (flight) {
      if (operation === 'refresh') flight.again = true;
      return flight.promise;
    }
    if ((operation === 'older' && !state.olderCursor) || (operation === 'newer' && !state.newerCursor)) return Promise.resolve();
    const own: Flight = { again: false, promise: Promise.resolve() };
    flight = own;
    own.promise = (async () => {
      try {
        await read(operation, silent);
        while (flight === own && own.again && current()) { own.again = false; await read('refresh', silent); }
      } finally { if (flight === own) flight = null; }
    })();
    return own.promise;
  }
  return {
    snapshot: () => state,
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    start() { retire(); active = true; if (!options.isCurrent()) { publish(empty()); return Promise.resolve(); } return run('restore'); },
    stop() { retire(); publish({ ...state, refreshing: false, loadingOlder: false, loadingNewer: false }); },
    forget() { retire(); publish(empty()); },
    refresh: (mode?: 'silent') => run(state.error || state.data === null ? 'restore' : 'refresh', mode === 'silent'),
    loadOlder: () => run('older'),
    loadNewer: () => run('newer'),
    showLatest: () => {
      if (!current()) return Promise.resolve();
      generation++; flight = null; controller?.abort(); controller = null;
      return run('latest');
    },
  };
}
