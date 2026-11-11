import { calendarInstant } from '../lib/calendarTime';
import { sesijaSada } from '../store/sesija';
import type { Ishod } from './ports';
import { failure, readReceipt, record, sameId, timestamp, uuid } from './serverReceipt';

export type AiHistoryPurpose = 'NEED_INTAKE' | 'PROFILE';
export type AiHistoryStatus = 'OPEN' | 'COMPLETED' | 'ABANDONED';
export type AiHistoryCursor = Readonly<{ createdAt: string; conversationId: string }>;
/** H2 enables a closed row to open the owner-only text transcript. */
export type AiHistoryRow = Readonly<AiHistoryCursor & {
  closedAt: string | null; status: AiHistoryStatus; title: string;
  titleSource: 'GENERIC' | 'CONFIRMED_NEED_TITLE' | 'LINKED_TASK_TITLE'; hasSavedProfile: boolean;
  visibility: 'VISIBLE'; canContinue: boolean; canRead: boolean;
}>;
export type AiHistoryPage = Readonly<{
  schemaVersion: 'AI_HISTORY_V1'; accountId: string; purpose: AiHistoryPurpose;
  observedAt: string; rows: AiHistoryRow[]; nextCursor: AiHistoryCursor | null; authoritative: true;
}>;
export const AI_HISTORY_PAGE_SIZE = 20;
const exact = (value: Record<string, unknown>, keys: readonly string[]) =>
  Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key));
const cursorKeys = ['createdAt', 'conversationId'] as const;
const rowKeys = ['conversationId', 'createdAt', 'closedAt', 'status', 'title', 'titleSource',
  'hasSavedProfile', 'visibility', 'canContinue', 'canRead'] as const;
const pageKeys = ['schemaVersion', 'accountId', 'purpose', 'observedAt', 'rows', 'nextCursor', 'authoritative'] as const;
const genericTitle = (purpose: AiHistoryPurpose) => purpose === 'PROFILE' ? 'Razgovor o radnom profilu' : 'Razgovor o zadatku';
const safeTitle = (value: unknown) => typeof value === 'string' && value === value.trim()
  && Array.from(value).length >= 1 && Array.from(value).length <= 80
  && !/[\u0000-\u001f\u007f]/.test(value);

export function decodeAiHistoryCursor(raw: unknown): AiHistoryCursor | null {
  const value = record(raw);
  return value && exact(value, cursorKeys) && timestamp(value.createdAt) && uuid(value.conversationId)
    && calendarInstant(value.createdAt) !== null
    ? { createdAt: value.createdAt, conversationId: value.conversationId } : null;
}

/** PostgreSQL keyset order, including microseconds. JS Date would collapse distinct rows in one millisecond. */
function compareCursor(left: AiHistoryCursor, right: AiHistoryCursor): number {
  const a = calendarInstant(left.createdAt)!, b = calendarInstant(right.createdAt)!;
  if (a !== b) return a > b ? 1 : -1;
  const ids = [left.conversationId.toLowerCase(), right.conversationId.toLowerCase()];
  return ids[0] > ids[1] ? 1 : ids[0] < ids[1] ? -1 : 0;
}

export function decodeAiHistoryPage(raw: unknown, accountId: string, purpose: AiHistoryPurpose,
  limit = AI_HISTORY_PAGE_SIZE, before: AiHistoryCursor | null = null): AiHistoryPage | null {
  const page = record(raw);
  if (!uuid(accountId) || !Number.isInteger(limit) || limit < 1 || limit > AI_HISTORY_PAGE_SIZE
    || !page || !exact(page, pageKeys) || page.schemaVersion !== 'AI_HISTORY_V1'
    || !sameId(page.accountId, accountId) || page.purpose !== purpose
    || !timestamp(page.observedAt) || calendarInstant(page.observedAt) === null
    || page.authoritative !== true || !Array.isArray(page.rows) || page.rows.length > limit
    || (before !== null && !decodeAiHistoryCursor(before))) return null;
  const rows: AiHistoryRow[] = [], seen = new Set<string>();
  let previous: AiHistoryCursor | null = before;
  for (const rawRow of page.rows) {
    const value = record(rawRow);
    const cursor = decodeAiHistoryCursor({ createdAt: value?.createdAt, conversationId: value?.conversationId });
    if (!value || !exact(value, rowKeys) || !cursor || seen.has(cursor.conversationId.toLowerCase())
      || (previous && compareCursor(cursor, previous) >= 0)
      || (value.closedAt !== null && (!timestamp(value.closedAt) || calendarInstant(value.closedAt) === null))
      || (value.status !== 'OPEN' && value.status !== 'COMPLETED' && value.status !== 'ABANDONED')
      || (value.status === 'OPEN' && value.closedAt !== null)
      || !safeTitle(value.title)
      || (value.titleSource !== 'GENERIC' && value.titleSource !== 'CONFIRMED_NEED_TITLE' && value.titleSource !== 'LINKED_TASK_TITLE')
      || (value.titleSource === 'GENERIC' && value.title !== genericTitle(purpose))
      || (purpose === 'PROFILE' && value.titleSource !== 'GENERIC')
      || typeof value.hasSavedProfile !== 'boolean' || (purpose === 'NEED_INTAKE' && value.hasSavedProfile)
      || (value.hasSavedProfile && value.status !== 'COMPLETED')
      || value.visibility !== 'VISIBLE' || typeof value.canContinue !== 'boolean'
      || (value.status !== 'OPEN' && value.canContinue)
      || (purpose === 'PROFILE' && value.status === 'OPEN' && !value.canContinue)
      || typeof value.canRead !== 'boolean'
      || (value.status === 'OPEN' && value.canRead)) return null;
    seen.add(cursor.conversationId.toLowerCase());
    rows.push({ ...cursor, closedAt: value.closedAt as string | null, status: value.status,
      title: value.title as string, titleSource: value.titleSource,
      hasSavedProfile: value.hasSavedProfile, visibility: 'VISIBLE',
      canContinue: value.canContinue, canRead: value.canRead });
    previous = cursor;
  }
  const nextCursor = page.nextCursor === null ? null : decodeAiHistoryCursor(page.nextCursor);
  if (page.nextCursor !== null && (!nextCursor || rows.length !== limit
    || compareCursor(nextCursor, rows[rows.length - 1]) !== 0)) return null;
  return { schemaVersion: 'AI_HISTORY_V1', accountId: page.accountId, purpose,
    observedAt: page.observedAt, rows, nextCursor, authoritative: true };
}

/** Metadata list; closed rows can advertise the H2 text view after server capability readback. */
export function listAiHistory(purpose: AiHistoryPurpose, before: AiHistoryCursor | null = null,
  limit = AI_HISTORY_PAGE_SIZE): Promise<Ishod<AiHistoryPage>> {
  const session = sesijaSada(), accountId = session.user?.id;
  if (!uuid(accountId) || !Number.isSafeInteger(session.accountRevision) || session.accountRevision < 0)
    return Promise.resolve(failure('AUTH_REQUIRED', 'Prijavi se da vidiš razgovore.'));
  if (purpose !== 'NEED_INTAKE' && purpose !== 'PROFILE')
    return Promise.resolve(failure('AI_HISTORY_PURPOSE_INVALID', 'Ponovo otvori istoriju razgovora.'));
  if (!Number.isInteger(limit) || limit < 1 || limit > AI_HISTORY_PAGE_SIZE || (before !== null && !decodeAiHistoryCursor(before)))
    return Promise.resolve(failure('AI_HISTORY_PAGE_INVALID', 'Ponovo otvori istoriju razgovora.'));
  const account = { accountId, accountRevision: session.accountRevision };
  return readReceipt({ account, rpc: 'rpc_list_owned_ai_history_v1',
    args: { p_purpose: purpose, p_before_created_at: before?.createdAt ?? null,
      p_before_id: before?.conversationId ?? null, p_limit: limit },
    errors: { ACCOUNT_CLOSING: 'Nalog se zatvara. Istorija trenutno nije dostupna.' },
    fallback: 'AI_HISTORY_UNAVAILABLE', invalid: 'AI_HISTORY_INVALID_RESPONSE',
    readTransportUnavailable: 'AI_HISTORY_OFFLINE',
    decode: raw => decodeAiHistoryPage(raw, accountId, purpose, limit, before) });
}
