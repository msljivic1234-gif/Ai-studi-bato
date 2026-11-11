import type { ConversationInboxCursor, ConversationInboxItem, ConversationInboxKind, ConversationInboxPage } from '../contracts/conversationInbox';
import { calendarInstant } from '../lib/calendarTime';
import type { Ishod } from './ports';
import { failure, readOwnedResult, record, sameId, uuid, type ReceiptAccount } from './serverReceipt';
import { supabaseKlijent } from './supabaseClient';

const exact = (value: Record<string, unknown>, keys: readonly string[]) =>
  Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key));
const id = (value: unknown): value is string => uuid(value) && value.length === 36;
const kind = (value: unknown): value is ConversationInboxKind => value === 'AGREEMENT' || value === 'GROUP';
const integer = (value: unknown, min: number, max: number): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= min && value <= max;
const instant = (value: unknown): value is string => calendarInstant(value) !== null;
function text(value: unknown, maximum: number): value is string {
  if (typeof value !== 'string' || value.includes('\0') || Array.from(value).length > maximum) return false;
  for (const point of value) {
    const code = point.codePointAt(0)!;
    if (code >= 0xd800 && code <= 0xdfff) return false;
  }
  return true;
}
/** Preserve timestamp spelling and all six fractional digits when sending the cursor back. */
export function decodeConversationInboxCursor(raw: unknown): ConversationInboxCursor | null {
  const value = record(raw);
  if (!value || !exact(value, ['snapshotAt', 'lastAt', 'kind', 'id']) || !instant(value.snapshotAt)
    || !instant(value.lastAt) || !kind(value.kind) || !id(value.id)
    || calendarInstant(value.lastAt)! > calendarInstant(value.snapshotAt)!) return null;
  return { snapshotAt: value.snapshotAt, lastAt: value.lastAt, kind: value.kind, id: value.id };
}
/** Matches PostgreSQL (timestamptz, kind COLLATE C, UUID), not rounded JavaScript milliseconds. */
export function compareConversationInboxCursors(left: ConversationInboxCursor, right: ConversationInboxCursor): number {
  const a = calendarInstant(left.lastAt), b = calendarInstant(right.lastAt);
  if (a === null || b === null || !kind(left.kind) || !kind(right.kind) || !id(left.id) || !id(right.id))
    throw new Error('INBOX_CURSOR_INVALID');
  if (a !== b) return a < b ? -1 : 1;
  if (left.kind !== right.kind) return left.kind < right.kind ? -1 : 1;
  const aid = left.id.toLowerCase(), bid = right.id.toLowerCase();
  return aid < bid ? -1 : aid > bid ? 1 : 0;
}
function item(raw: unknown): ConversationInboxItem | null {
  const value = record(raw);
  if (!value || !exact(value, ['kind', 'id', 'routeAgreementId', 'task', 'counterpart', 'lastMessage', 'unreadMessageCount'])
    || !kind(value.kind) || !id(value.id) || !id(value.routeAgreementId)) return null;
  const task = record(value.task), message = record(value.lastMessage), counterpart = record(value.counterpart);
  if (!task || !exact(task, ['id', 'title']) || !id(task.id) || !text(task.title, 1000)
    || !message || !exact(message, ['id', 'createdAt', 'mine', 'kind', 'preview']) || !id(message.id)
    || !instant(message.createdAt) || typeof message.mine !== 'boolean'
    || (message.kind !== 'TEXT' && message.kind !== 'PHOTO' && message.kind !== 'VOICE')
    || (message.preview !== null && !text(message.preview, 240))
    || (message.kind === 'VOICE' && message.preview !== null)
    || (value.unreadMessageCount !== null && !integer(value.unreadMessageCount, 0, Number.MAX_SAFE_INTEGER))) return null;
  if (value.counterpart !== null && (!counterpart || !exact(counterpart, ['profileId', 'displayName'])
    || !id(counterpart.profileId) || !text(counterpart.displayName, 200))) return null;
  if (value.kind === 'GROUP' ? value.counterpart !== null || message.kind !== 'TEXT'
    : value.unreadMessageCount !== null || !sameId(value.routeAgreementId, value.id)) return null;
  return {
    kind: value.kind, id: value.id, routeAgreementId: value.routeAgreementId,
    task: { id: task.id, title: task.title },
    counterpart: counterpart ? { profileId: counterpart.profileId as string, displayName: counterpart.displayName as string } : null,
    lastMessage: { id: message.id, createdAt: message.createdAt, mine: message.mine, kind: message.kind, preview: message.preview as string | null },
    unreadMessageCount: value.unreadMessageCount as number | null,
  };
}
const rowCursor = (row: ConversationInboxItem, snapshotAt: string): ConversationInboxCursor =>
  ({ snapshotAt, lastAt: row.lastMessage.createdAt, kind: row.kind, id: row.id });
export function decodeConversationInboxPage(raw: unknown, accountId: string,
  options: Readonly<{ limit?: number; cursor?: ConversationInboxCursor | null }> = {}): ConversationInboxPage | null {
  const value = record(raw), limit = options.limit ?? 30;
  const before = options.cursor == null ? null : decodeConversationInboxCursor(options.cursor);
  if (!value || !exact(value, ['schema', 'accountId', 'authoritative', 'asOf', 'snapshotAt', 'items', 'nextCursor'])
    || value.schema !== 'MY_CONVERSATIONS_PAGE_V1' || !id(accountId) || !sameId(value.accountId, accountId)
    || value.authoritative !== true || !instant(value.asOf) || !instant(value.snapshotAt)
    || calendarInstant(value.snapshotAt)! > calendarInstant(value.asOf)!
    || !integer(limit, 1, 50) || (options.cursor != null && !before)
    || (before && calendarInstant(before.snapshotAt) !== calendarInstant(value.snapshotAt))
    || !Array.isArray(value.items) || value.items.length > limit) return null;
  const rows = value.items.map(item);
  if (rows.some(row => row === null)) return null;
  const items = rows as ConversationInboxItem[];
  if (new Set(items.map(row => `${row.kind}:${row.id.toLowerCase()}`)).size !== items.length) return null;
  for (let index = 0; index < items.length; index++) {
    const current = rowCursor(items[index], value.snapshotAt);
    if (calendarInstant(current.lastAt)! > calendarInstant(value.snapshotAt)!
      || (before && compareConversationInboxCursors(current, before) >= 0)
      || (index > 0 && compareConversationInboxCursors(rowCursor(items[index - 1], value.snapshotAt), current) <= 0)) return null;
  }
  const nextCursor = value.nextCursor === null ? null : decodeConversationInboxCursor(value.nextCursor);
  if (value.nextCursor !== null && (!nextCursor || items.length !== limit
    || calendarInstant(nextCursor.snapshotAt) !== calendarInstant(value.snapshotAt)
    || compareConversationInboxCursors(nextCursor, rowCursor(items[items.length - 1], value.snapshotAt)) !== 0)) return null;
  return { schema: 'MY_CONVERSATIONS_PAGE_V1', accountId, authoritative: true, asOf: value.asOf,
    snapshotAt: value.snapshotAt, items, nextCursor };
}

export type ConversationInboxPort = Readonly<{
  list(cursor?: ConversationInboxCursor | null, signal?: AbortSignal): Promise<Ishod<ConversationInboxPage>>;
}>;
export type ConversationInboxRpc = (name: string, args: Record<string, unknown>, signal?: AbortSignal) => PromiseLike<unknown>;
const errors = {
  AUTH_REQUIRED: 'Prijavi se da nastaviš.', AUTH_CONTEXT_CHANGED: 'Nalog je promenjen. Ponovo otvori Poruke.',
  ACCOUNT_CLOSING: 'Nalog se zatvara. Razgovori nisu dostupni.',
  INBOX_CURSOR_INVALID: 'Lista razgovora je promenjena. Osveži Poruke.',
  INBOX_LIMIT_INVALID: 'Lista razgovora nije dostupna.',
};
const cancelled = () => failure('CONVERSATION_INBOX_CANCELLED', 'Čitanje razgovora je prekinuto.');
const defaultRpc: ConversationInboxRpc = (name, args, signal) => {
  const request = supabaseKlijent().rpc(name, args);
  return signal ? request.abortSignal(signal) : request;
};
/** One account/visit scope; no event ACK, read marker, persistence or automatic replay. */
export function createConversationInboxClientService(scope: ReceiptAccount,
  options: Readonly<{ limit?: number; isCurrent?: () => boolean; rpc?: ConversationInboxRpc }> = {}): ConversationInboxPort {
  const account = { ...scope }, limit = options.limit ?? 30, rpc = options.rpc ?? defaultRpc, isCurrent = options.isCurrent;
  return {
    async list(rawCursor = null, signal) {
      if (signal?.aborted || (isCurrent && !isCurrent())) return cancelled();
      if (!id(account.accountId) || !integer(account.accountRevision, 0, Number.MAX_SAFE_INTEGER))
        return failure('AUTH_REQUIRED', errors.AUTH_REQUIRED);
      const cursor = rawCursor === null ? null : decodeConversationInboxCursor(rawCursor);
      if (!integer(limit, 1, 50) || (rawCursor !== null && !cursor))
        return failure('CONVERSATION_INBOX_INPUT_INVALID', 'Lista razgovora nije dostupna.');
      const result = await readOwnedResult({ account, errors, fallback: 'CONVERSATION_INBOX_UNCONFIRMED',
        invalid: 'CONVERSATION_INBOX_INVALID_RESPONSE', readTransportUnavailable: 'CONVERSATION_INBOX_TRANSPORT_UNAVAILABLE',
        decode: raw => decodeConversationInboxPage(raw, account.accountId, { limit, cursor }),
        request: () => rpc('rpc_list_my_conversations_v1', {
          p_expected_user_id: account.accountId, p_limit: limit, p_cursor: cursor,
        }, signal),
      });
      return signal?.aborted || (isCurrent && !isCurrent()) ? cancelled() : result;
    },
  };
}
