import { calendarInstant } from '../lib/calendarTime';
import { sesijaSada } from '../store/sesija';
import type { Ishod } from './ports';
import type { AiHistoryPurpose } from './aiHistoryClientService';
import { failure, readReceipt, record, sameId, timestamp, uuid } from './serverReceipt';

export type AiHistoryMessageCursor = string;
export type AiHistoryMessage = Readonly<{
  id: string; role: 'USER' | 'ASSISTANT'; body: string; createdAt: string;
}>;
/** Rows are newest first. A read-only view reverses each loaded page for display. */
export type AiHistoryMessagesPage = Readonly<{
  schemaVersion: 'AI_HISTORY_MESSAGES_V1'; accountId: string; purpose: AiHistoryPurpose;
  conversationId: string; status: 'COMPLETED' | 'ABANDONED'; observedAt: string;
  rows: AiHistoryMessage[]; hasMore: boolean; nextBeforeMessageId: AiHistoryMessageCursor | null;
  authoritative: true;
}>;
export const AI_HISTORY_MESSAGES_PAGE_SIZE = 50;
const exact = (value: Record<string, unknown>, keys: readonly string[]) =>
  Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key));
const pageKeys = ['schemaVersion', 'accountId', 'purpose', 'conversationId', 'status',
  'observedAt', 'rows', 'hasMore', 'nextBeforeMessageId', 'authoritative'] as const;
const messageKeys = ['id', 'role', 'body', 'createdAt'] as const;

/** The server resolves this opaque ID against the same owner and conversation. */
export function aiHistoryMessageCursor(value: unknown): value is AiHistoryMessageCursor {
  return uuid(value);
}

export function decodeAiHistoryMessagesPage(raw: unknown, accountId: string,
  purpose: AiHistoryPurpose, conversationId: string, limit = AI_HISTORY_MESSAGES_PAGE_SIZE,
  before: AiHistoryMessageCursor | null = null): AiHistoryMessagesPage | null {
  const page = record(raw);
  if (!uuid(accountId) || !uuid(conversationId) || (purpose !== 'NEED_INTAKE' && purpose !== 'PROFILE')
    || !Number.isInteger(limit) || limit < 1 || limit > AI_HISTORY_MESSAGES_PAGE_SIZE
    || (before !== null && !aiHistoryMessageCursor(before))
    || !page || !exact(page, pageKeys) || page.schemaVersion !== 'AI_HISTORY_MESSAGES_V1'
    || !sameId(page.accountId, accountId) || page.purpose !== purpose
    || !sameId(page.conversationId, conversationId)
    || (page.status !== 'COMPLETED' && page.status !== 'ABANDONED')
    || !timestamp(page.observedAt) || calendarInstant(page.observedAt) === null
    || !Array.isArray(page.rows) || page.rows.length > limit
    || typeof page.hasMore !== 'boolean' || page.authoritative !== true) return null;

  const rows: AiHistoryMessage[] = [], ids = new Set<string>();
  for (const rawRow of page.rows) {
    const row = record(rawRow);
    if (!row || !exact(row, messageKeys) || !uuid(row.id) || ids.has(row.id.toLowerCase())
      || (before !== null && sameId(row.id, before))
      || (row.role !== 'USER' && row.role !== 'ASSISTANT')
      || typeof row.body !== 'string' || !row.body.trim()
      || Array.from(row.body).length > 4000 || row.body.includes('\u0000')
      || !timestamp(row.createdAt) || calendarInstant(row.createdAt) === null) return null;
    ids.add(row.id.toLowerCase());
    rows.push({ id: row.id, role: row.role, body: row.body, createdAt: row.createdAt });
  }
  const next = page.nextBeforeMessageId;
  if (page.hasMore
    ? rows.length !== limit || !aiHistoryMessageCursor(next) || !sameId(next, rows[rows.length - 1].id)
    : next !== null) return null;
  return { schemaVersion: 'AI_HISTORY_MESSAGES_V1', accountId: page.accountId, purpose,
    conversationId: page.conversationId, status: page.status, observedAt: page.observedAt,
    rows, hasMore: page.hasMore, nextBeforeMessageId: next as string | null, authoritative: true };
}

/** Deployed DEV H2 read: closed text transcript only, opened from the owner-admitted history route. */
export function listAiHistoryMessages(purpose: AiHistoryPurpose, conversationId: string,
  before: AiHistoryMessageCursor | null = null,
  limit = AI_HISTORY_MESSAGES_PAGE_SIZE): Promise<Ishod<AiHistoryMessagesPage>> {
  const session = sesijaSada(), accountId = session.user?.id;
  if (!uuid(accountId) || !Number.isSafeInteger(session.accountRevision) || session.accountRevision < 0)
    return Promise.resolve(failure('AUTH_REQUIRED', 'Prijavi se da vidiš razgovor.'));
  if (purpose !== 'NEED_INTAKE' && purpose !== 'PROFILE')
    return Promise.resolve(failure('AI_HISTORY_PURPOSE_INVALID', 'Ponovo otvori istoriju razgovora.'));
  if (!uuid(conversationId) || !Number.isInteger(limit) || limit < 1 || limit > AI_HISTORY_MESSAGES_PAGE_SIZE
    || (before !== null && !aiHistoryMessageCursor(before)))
    return Promise.resolve(failure('AI_HISTORY_MESSAGES_PAGE_INVALID', 'Ponovo otvori razgovor.'));
  const account = { accountId, accountRevision: session.accountRevision };
  return readReceipt({ account, rpc: 'rpc_list_owned_ai_history_messages_v1',
    args: { p_purpose: purpose, p_conversation_id: conversationId,
      p_before_message_id: before, p_limit: limit },
    errors: {
      ACCOUNT_CLOSING: 'Nalog se zatvara. Istorija trenutno nije dostupna.',
      AI_HISTORY_NOT_FOUND: 'Razgovor nije dostupan.',
      AI_HISTORY_NOT_CLOSED: 'Otvoreni razgovor nastavi iz njegovog aktivnog prikaza.',
      AI_HISTORY_CURSOR_INVALID: 'Starije poruke trenutno nisu dostupne. Osveži razgovor.',
    },
    fallback: 'AI_HISTORY_MESSAGES_UNAVAILABLE', invalid: 'AI_HISTORY_MESSAGES_INVALID_RESPONSE',
    readTransportUnavailable: 'AI_HISTORY_MESSAGES_OFFLINE',
    decode: raw => decodeAiHistoryMessagesPage(raw, accountId, purpose, conversationId, limit, before) });
}
