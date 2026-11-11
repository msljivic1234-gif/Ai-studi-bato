import type { KandidatProjekcija } from '../contracts/projections';
import { calendarInstant } from '../lib/calendarTime';
import { record, uuid } from './serverReceipt';

const exactInstant = (value: unknown): value is string => typeof value === 'string' && calendarInstant(value) !== null;

/**
 * EX-04 S4 (A11 Kandidati i poređenje). The applications to one of my tasks, one keyset page at a time, in the order the whole-list read has always had (submission, then id). Every item
 * of a page IS the candidate document `rpc_list_need_candidates` returns plus its `sortAt` (the keyset value), so a card, a state and an exact selection binding (response, version,
 * hash, task revision) are the ones `mapCandidate` already reads. The first page carries the total; a page never carries more than it was asked for. Pure and React-free: the pager, the
 * service and the fake source share it.
 */
export type CandidatesScope = 'ALL';
export type CandidatesCursor = { at: string; id: string };
export type CandidatesPageRequest = { limit: number; cursor: CandidatesCursor | null };
export type CandidatesCounts = { total: number };
export type CandidatesPage = {
  items: KandidatProjekcija[]; hasMore: boolean;
  /** The number of applications to the task, only on the first page of a read; a later page never carries it. */
  counts: CandidatesCounts | null;
  /** Where the next page starts: the last item of this one. Null on an empty page. */
  cursor: CandidatesCursor | null; asOf: string;
};

/** A task rarely has more applications than one page holds; when it does, the rest is read a page at a time. The server accepts 1..100. */
export const CANDIDATES_PAGE_LIMIT = 50;

/** Reject malformed cursor/page input before any candidate RPC can be sent. */
export function isCandidatesPageRequest(value: unknown): value is CandidatesPageRequest {
  const input = record(value);
  if (!input || typeof input.limit !== 'number' || !Number.isSafeInteger(input.limit)
    || input.limit < 1 || input.limit > 100) return false;
  if (input.cursor === null) return true;
  const cursor = record(input.cursor);
  return !!cursor && exactInstant(cursor.at) && uuid(cursor.id);
}


type Position = { instant: bigint; id: string };
/** The server's order: the older submission first, the id ascending. Negative: `a` comes before `b`. */
const compare = (a: Position, b: Position): number => a.instant !== b.instant ? (a.instant < b.instant ? -1 : 1) : a.id < b.id ? -1 : a.id > b.id ? 1 : 0;

/**
 * Strict: anything that does not add up is no answer, never a short or a guessed one. The documents are mapped by the caller's `map` (the one `mapCandidate` the whole-list read uses), so an
 * invalid candidate makes the page invalid and is never skipped. A page must also keep the server's own order and start after the cursor it was asked from, so a contract drift can never
 * show a duplicate or a gap.
 */
export function decodeCandidatesPage(raw: unknown, request: CandidatesPageRequest, map: (document: any) => KandidatProjekcija): CandidatesPage | null {
  const data = record(raw);
  if (!isCandidatesPageRequest(request)) return null;
  if (!data || !Array.isArray(data.items) || typeof data.hasMore !== 'boolean' || !exactInstant(data.asOf) || data.items.length > request.limit
      || (data.hasMore && data.items.length !== request.limit)) return null;
  let counts: CandidatesCounts | null = null;
  if (request.cursor === null) {
    const c = record(data.counts);
    if (!c || !Number.isSafeInteger(c.total) || (c.total as number) < data.items.length || (!data.hasMore && c.total !== data.items.length)) return null;
    counts = { total: c.total as number };
  } else if (data.counts !== null && data.counts !== undefined) return null;
  let previous: Position | null = null;
  if (request.cursor) {
    const instant = calendarInstant(request.cursor.at);
    if (instant === null || !uuid(request.cursor.id)) return null;
    previous = { instant, id: request.cursor.id.toLowerCase() };
  }
  const items: KandidatProjekcija[] = [], seen = new Set<string>();
  let last: CandidatesCursor | null = null;
  for (const value of data.items) {
    const document = record(value);
    if (!document || !uuid(document.responseId) || !exactInstant(document.sortAt) || seen.has(document.responseId.toLowerCase())) return null;
    seen.add(document.responseId.toLowerCase());
    let row: KandidatProjekcija;
    try { row = map(document); } catch { return null; }
    const instant = calendarInstant(document.sortAt);
    if (instant === null || !uuid(row.prijavaId) || row.prijavaId.toLowerCase() !== document.responseId.toLowerCase()) return null;
    const position: Position = { instant, id: document.responseId.toLowerCase() };
    if (previous && compare(previous, position) >= 0) return null;
    previous = position;
    items.push(row);
    last = { at: document.sortAt, id: document.responseId };
  }
  // A page that promises more and gives none could never advance.
  if (data.hasMore && items.length === 0) return null;
  return { items, hasMore: data.hasMore, counts, asOf: data.asOf, cursor: last };
}
