import type { PotrebaProjekcija } from '../contracts/projections';
import { calendarInstant } from '../lib/calendarTime';
import type { MarketplaceView, OwnedTaskCounts, OwnTasksScope } from './marketplaceView';
export { ownTasksScope } from './marketplaceView';
export type { OwnTasksScope } from './marketplaceView';
import { record, uuid } from './serverReceipt';

/** Reject nonexistent civil instants and narrow decoded JSON values to strings. */
const exactInstant = (value: unknown): value is string => typeof value === 'string' && calendarInstant(value) !== null;

/**
 * EX-04 S1 (A09 Moji zadaci). The server's own sets of my tasks, one keyset page at a time: the three tabs (Aktivni, Nacrti, Istorija), all of them,
 * and the tasks that wait for my choice. Every item of a page IS the `rpc_read_task` document the whole-list read returns, so the card, the price
 * basis and the selectable count are the ones `mapNeed` already reads; `sortAt` is the keyset value. Pure and React-free: the pager, the service and
 * the fake source share it.
 */
export type OwnTasksCursor = { at: string; id: string };
export type OwnTasksPageRequest = { scope: OwnTasksScope; limit: number; cursor: OwnTasksCursor | null };
export type OwnTasksPage = {
  items: PotrebaProjekcija[]; hasMore: boolean;
  /** The five counts of the sets, only on the first page of a read; a later page never carries them. */
  counts: OwnedTaskCounts | null;
  /** Where the next page starts: the last item of this one. Null on an empty page. */
  cursor: OwnTasksCursor | null; asOf: string };

/** The server accepts 1..100; thirty cards are a few screens of this list. */
export const OWN_TASKS_PAGE_LIMIT = 30;
/** One validated task document of a page: the `rpc_read_task` document plus the keyset value. */
export type OwnTaskDocument = Record<string, unknown> & { id: string; sortAt: string };
const SCOPES: readonly OwnTasksScope[] = ['ALL', 'ACTIVE', 'DRAFTS', 'HISTORY', 'WAITING'];
export const isOwnTasksScope = (value: unknown): value is OwnTasksScope => SCOPES.includes(value as OwnTasksScope);

/** Search and the price filter are refinements of the loaded set: while one is on, the rest of the set is read so the answer is complete. */
export const ownTasksRefined = (view: Pick<MarketplaceView, 'query' | 'price'>): boolean => view.query.trim() !== '' || view.price !== 'all';

const COUNT_KEYS = ['total', 'active', 'drafts', 'history', 'waiting'] as const;

/** Guard requested set before RPC. Invalid input must not be an empty success. */
export function isOwnTasksPageRequest(value: unknown): value is OwnTasksPageRequest {
  const input = record(value);
  if (!input || !isOwnTasksScope(input.scope) || typeof input.limit !== 'number'
    || !Number.isSafeInteger(input.limit) || input.limit < 1 || input.limit > 100) return false;
  if (input.cursor === null) return true;
  const cursor = record(input.cursor);
  return !!cursor && exactInstant(cursor.at) && uuid(cursor.id);
}

/** PostgreSQL keyset (created_at DESC, id DESC): compare full microsecond
 * instants, including offsets; Date.parse can normalize an invalid civil day. */
function strictlyBeforeCursor(next: OwnTasksCursor, previous: OwnTasksCursor): boolean {
  const a = calendarInstant(next.at), b = calendarInstant(previous.at);
  if (a === null || b === null) return false;
  return a === b ? next.id.toLowerCase() < previous.id.toLowerCase() : a < b;
}

/**
 * Strict: anything that does not add up is no answer, never a short or a guessed one. The documents are mapped by the caller's `map` (the one
 * `mapNeed` the whole-list read uses), so an invalid task document makes the page invalid and is never skipped.
 */
export function decodeOwnTasksPage(raw: unknown, request: Pick<OwnTasksPageRequest, 'limit' | 'cursor'>, map: (document: any) => PotrebaProjekcija):
  (OwnTasksPage & { documents: OwnTaskDocument[] }) | null {
  const data = record(raw);
  if (!Number.isSafeInteger(request.limit) || request.limit < 1 || request.limit > 100
      || (request.cursor !== null && (!record(request.cursor)
        || !exactInstant(request.cursor.at) || !uuid(request.cursor.id)))) return null;
  if (!data || !Array.isArray(data.items) || typeof data.hasMore !== 'boolean' || !exactInstant(data.asOf) || data.items.length > request.limit
      || (data.hasMore && data.items.length !== request.limit)) return null;
  let counts: OwnedTaskCounts | null = null;
  if (request.cursor === null) {
    const c = record(data.counts);
    if (!c || !COUNT_KEYS.every(key => Number.isSafeInteger(c[key]) && (c[key] as number) >= 0)) return null;
    const n = c as Record<typeof COUNT_KEYS[number], number>;
    // The three tabs partition my tasks, and what waits for my choice is active.
    if (n.active + n.drafts + n.history !== n.total || n.waiting > n.active) return null;
    counts = { total: n.total, active: n.active, waiting: n.waiting, drafts: n.drafts, history: n.history };
  } else if (data.counts !== null && data.counts !== undefined) return null;
  const items: PotrebaProjekcija[] = [], documents: OwnTaskDocument[] = [], seen = new Set<string>();
  let previous: OwnTasksCursor | null = request.cursor;
  for (const value of data.items) {
    const document = record(value);
    if (!document || !uuid(document.id) || !exactInstant(document.sortAt) || seen.has(document.id.toLowerCase())) return null;
    const next = { at: document.sortAt, id: document.id };
    if (previous && !strictlyBeforeCursor(next, previous)) return null;
    previous = next;
    seen.add(document.id.toLowerCase());
    let mapped:PotrebaProjekcija;
    try { mapped=map(document); } catch { return null; }
    // The public owner reader's cursor/document identity and the rendered task
    // identity are one authority. A mismatched mapper output must never become
    // an actionable row under a different task ID.
    if(!mapped||!uuid(mapped.id)||mapped.id.toLowerCase()!==document.id.toLowerCase())return null;
    items.push(mapped);
    documents.push(document as OwnTaskDocument);
  }
  // A page that promises more and gives none could never advance.
  if (data.hasMore && items.length === 0) return null;
  const last = documents[documents.length - 1];
  return { items, documents, hasMore: data.hasMore, counts, asOf: data.asOf,
    cursor: last ? { at: last.sortAt, id: last.id } : null };
}
