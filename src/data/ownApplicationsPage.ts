import type { MojaPrijavaProjekcija } from '../contracts/projections';
import { calendarInstant } from '../lib/calendarTime';
import { applicationSection, type ApplicationCounts, type ApplicationSection } from './myApplicationsView';
import { record, uuid } from './serverReceipt';

/** Reject nonexistent civil instants and narrow decoded JSON values to strings. */
const exactInstant = (value: unknown): value is string => typeof value === 'string' && calendarInstant(value) !== null;

/**
 * EX-04 S2 (B10 Moje prijave). The server's own sets of my applications, one keyset page at a time: the four tabs of the screen (Sve, Čeka te, Aktivne,
 * Završene). The order is the one the whole-list read has always had: what waits for me first (rank 0), then the open applications (rank 1), then the
 * rest (rank 2), each newest submission first, the id as the last tie-breaker; the cursor carries all three values, so a page boundary can fall inside a
 * tie or between two sections and nothing is skipped or repeated for a reason of the order itself. Pure and React-free: the pager, the service and the
 * fake source share it.
 */
export type OwnApplicationsScope = 'ALL' | 'ATTENTION' | 'ACTIVE' | 'HISTORY';
export type ApplicationRank = 0 | 1 | 2;
export type OwnApplicationsCursor = { at: string; id: string; rank: ApplicationRank };
export type OwnApplicationsPageRequest = { scope: OwnApplicationsScope; limit: number; cursor: OwnApplicationsCursor | null };
export type OwnApplicationsPage = {
  items: MojaPrijavaProjekcija[]; hasMore: boolean;
  /** The four counts of the tabs, only on the first page of a read; a later page never carries them. */
  counts: ApplicationCounts | null;
  /** Where the next page starts: the last item of this one. Null on an empty page. */
  cursor: OwnApplicationsCursor | null; asOf: string;
};

/** The server accepts 1..100; thirty cards are a few screens of this list. */
export const OWN_APPLICATIONS_PAGE_LIMIT = 30;
/** The tab the person is on, in the words of the screen. */
export type ApplicationsTabKey = 'all' | ApplicationSection;

const RANK: Record<ApplicationSection, ApplicationRank> = { attention: 0, active: 1, finished: 2 };
const SCOPE_RANK: Record<Exclude<OwnApplicationsScope, 'ALL'>, ApplicationRank> = { ATTENTION: 0, ACTIVE: 1, HISTORY: 2 };

/** Only a valid scope, page size, microsecond instant and same-scope rank
 * may travel to PostgREST; a stale tab cursor cannot claim a terminal page. */
export function isOwnApplicationsPageRequest(value: unknown): value is OwnApplicationsPageRequest {
  const input = record(value);
  if (!input || !['ALL', 'ATTENTION', 'ACTIVE', 'HISTORY'].includes(input.scope as string)
    || typeof input.limit !== 'number' || !Number.isSafeInteger(input.limit)
    || input.limit < 1 || input.limit > 100) return false;
  if (input.cursor === null) return true;
  const cursor = record(input.cursor);
  if (!cursor || !exactInstant(cursor.at) || !uuid(cursor.id)
    || ![0, 1, 2].includes(cursor.rank as number)) return false;
  const wanted = ownApplicationsScopeRank(input.scope as OwnApplicationsScope);
  return wanted === null || cursor.rank === wanted;
}
/** The rank of an application in the server's order: the same rule that puts it on its tab. */
export const applicationRank = (row: Pick<MojaPrijavaProjekcija, 'traziPaznju' | 'stanje'>): ApplicationRank => RANK[applicationSection(row)];
export const ownApplicationsScope = (tab: ApplicationsTabKey): OwnApplicationsScope =>
  tab === 'all' ? 'ALL' : tab === 'attention' ? 'ATTENTION' : tab === 'active' ? 'ACTIVE' : 'HISTORY';
/** The one rank a single-section scope holds; null for ALL, which holds all three. */
export const ownApplicationsScopeRank = (scope: OwnApplicationsScope): ApplicationRank | null => scope === 'ALL' ? null : SCOPE_RANK[scope];

const COUNT_KEYS = ['total', 'attention', 'active', 'finished'] as const;
type Position = { rank: number; instant: bigint; id: string };
/** The server's order: rank ascending, the newest instant first, the id ascending. Negative: `a` comes before `b`. */
const compare = (a: Position, b: Position): number =>
  a.rank !== b.rank ? a.rank - b.rank : a.instant !== b.instant ? (a.instant > b.instant ? -1 : 1) : a.id < b.id ? -1 : a.id > b.id ? 1 : 0;

/**
 * Strict: anything that does not add up is no answer, never a short or a guessed one. The documents are mapped by the caller's `map` (the one mapper
 * of the application card, with the task facts required), so an invalid document makes the page invalid and is never skipped. A page must also keep the
 * server's own order and start after the cursor it was asked from, so a contract drift can never show a duplicate or a gap.
 */
export function decodeOwnApplicationsPage(raw: unknown, request: Pick<OwnApplicationsPageRequest, 'scope' | 'limit' | 'cursor'>,
  map: (document: any) => MojaPrijavaProjekcija): OwnApplicationsPage | null {
  const data = record(raw);
  if (!isOwnApplicationsPageRequest(request)) return null;
  if (!data || !Array.isArray(data.items) || typeof data.hasMore !== 'boolean' || !exactInstant(data.asOf) || data.items.length > request.limit
      || (data.hasMore && data.items.length !== request.limit)) return null;
  let counts: ApplicationCounts | null = null;
  if (request.cursor === null) {
    const c = record(data.counts);
    if (!c || !COUNT_KEYS.every(key => Number.isSafeInteger(c[key]) && (c[key] as number) >= 0)) return null;
    const n = c as Record<typeof COUNT_KEYS[number], number>;
    // The three sections partition my applications.
    if (n.attention + n.active + n.finished !== n.total) return null;
    counts = { total: n.total, attention: n.attention, active: n.active, finished: n.finished };
  } else if (data.counts !== null && data.counts !== undefined) return null;
  const wanted = ownApplicationsScopeRank(request.scope);
  let previous: Position | null = null;
  if (request.cursor) {
    const instant = calendarInstant(request.cursor.at);
    if (instant === null || !uuid(request.cursor.id)) return null;
    previous = { rank: request.cursor.rank, instant, id: request.cursor.id.toLowerCase() };
  }
  const items: MojaPrijavaProjekcija[] = [], seen = new Set<string>();
  let last: { at: string; id: string; rank: ApplicationRank } | null = null;
  for (const value of data.items) {
    const document = record(value);
    if (!document || !uuid(document.id) || !uuid(document.applicationId) || document.applicationId.toLowerCase() !== document.id.toLowerCase()
        || !exactInstant(document.sortAt) || seen.has(document.id.toLowerCase())) return null;
    seen.add(document.id.toLowerCase());
    let row: MojaPrijavaProjekcija;
    try { row = map(document); } catch { return null; }
    const rank = applicationRank(row), instant = calendarInstant(document.sortAt);
    if (instant === null || !uuid(row.prijavaId) || row.prijavaId.toLowerCase() !== document.id.toLowerCase() || (wanted !== null && rank !== wanted)) return null;
    const position: Position = { rank, instant, id: document.id.toLowerCase() };
    if (previous && compare(previous, position) >= 0) return null;
    previous = position;
    items.push(row);
    last = { at: document.sortAt, id: document.id, rank };
  }
  // A page that promises more and gives none could never advance.
  if (data.hasMore && items.length === 0) return null;
  return { items, hasMore: data.hasMore, counts, asOf: data.asOf, cursor: last };
}
