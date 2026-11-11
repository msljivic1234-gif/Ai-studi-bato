import type { PorukaProjekcija } from '../contracts/projections';
import { vreme } from '../lib/vreme';
import { sesijaSada } from '../store/sesija';
import { decodeAgreementPhotoMessage } from './agreementPhotoClientService';
import type { Ishod } from './ports';
import { failure, readOwnedResult, record, sameId, timestamp, uuid as receiptUuid, type ReceiptAccount } from './serverReceipt';
import { supabaseKlijent } from './supabaseClient';
import { voiceMessagesBuilt } from './voiceMessagesGate';

/** Keep the server timestamp verbatim: Date/ISO round trips discard microseconds. */
export type AgreementMessageCursor = Readonly<{ createdAt: string; messageId: string }>;
export type AgreementHistoryMessage = PorukaProjekcija & Readonly<{ createdAt: string; kind: 'TEXT' | 'PHOTO' | 'VOICE' }>;
type HistoryEnvelope = Readonly<{ accountId: string; agreementId: string; messages: readonly AgreementHistoryMessage[];
  asOf: string; authoritative: true }>;
export type AgreementMessageHistoryPage = HistoryEnvelope & Readonly<{ olderCursor: AgreementMessageCursor | null }>;
export type AgreementMessageWindow = HistoryEnvelope & Readonly<{ targetMessageId: string;
  beforeCursor: AgreementMessageCursor | null; afterCursor: AgreementMessageCursor | null }>;
export type AgreementDisplayedMessagesReceipt = Readonly<{ accountId: string; agreementId: string;
  displayedMessageIds: readonly string[]; markedEventCount: number; authoritative: true }>;
/** `voice` selects the V2 contract (kind VOICE and a voice object); without it the decoders are the V1 ones, byte for byte. */
export type AgreementHistoryPageOptions = Readonly<{ limit?: number; before?: AgreementMessageCursor | null; signal?: AbortSignal; voice?: boolean }>;
export type AgreementMessageWindowOptions = Readonly<{ beforeCount?: number; afterCount?: number; signal?: AbortSignal; voice?: boolean }>;

const exact = (value: Record<string, unknown>, keys: readonly string[]) =>
  Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key));
const uuid = (value: unknown): value is string => receiptUuid(value) && value.length === 36;
const bounded = (value: unknown, min: number, max: number): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max;
const errors = {
  AUTH_REQUIRED: 'Prijavi se da nastaviš.', AUTH_CONTEXT_CHANGED: 'Nalog je promenjen. Ponovo otvori Dogovor.',
  MEDIA_NOT_FOUND: 'Poruke nisu dostupne.', CHAT_MESSAGE_NOT_AVAILABLE: 'Poruka više nije dostupna.',
  CHAT_CURSOR_INVALID: 'Istorija poruka je promenjena. Osveži razgovor.',
  CHAT_WINDOW_INVALID: 'Izabrani deo razgovora nije dostupan.',
  CHAT_DISPLAYED_IDS_INVALID: 'Prikazane poruke nisu potvrđene.',
  CHAT_MESSAGE_PROJECTION_CHANGED: 'Poruke su promenjene. Osveži razgovor.',
  ACCOUNT_CLOSING: 'Nalog se zatvara. Potvrda čitanja nije dostupna.',
};
const invalidInput = () => failure('CHAT_HISTORY_INPUT_INVALID', 'Izabrani deo razgovora nije dostupan.');
const cancelled = () => failure('CHAT_HISTORY_CANCELLED', 'Čitanje razgovora je prekinuto.');

function instant(value: unknown): { second: number; fraction: number } | null {
  if (!timestamp(value)) return null;
  const match = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})(?:\.(\d{1,6}))?(Z|[+-]\d{2}:\d{2})$/.exec(value);
  if (!match || match[0] !== value) return null;
  // Date.parse normalizes impossible dates such as February 30; reject those too.
  const local = Date.parse(`${match[1]}Z`);
  if (!Number.isFinite(local) || new Date(local).toISOString().slice(0, 19) !== match[1]) return null;
  return { second: Date.parse(`${match[1]}${match[3]}`), fraction: Number((match[2] ?? '').padEnd(6, '0')) };
}

/** PostgreSQL timestamptz/UUID tuple order, including equal milliseconds and offset spelling. */
export function compareAgreementMessageCursors(left: AgreementMessageCursor, right: AgreementMessageCursor): number {
  const a = instant(left.createdAt), b = instant(right.createdAt);
  if (!a || !b || !uuid(left.messageId) || !uuid(right.messageId)) throw new Error('CHAT_CURSOR_INVALID');
  const aid = left.messageId.toLowerCase(), bid = right.messageId.toLowerCase();
  return a.second - b.second || a.fraction - b.fraction || (aid < bid ? -1 : aid > bid ? 1 : 0);
}
function cursor(raw: unknown): AgreementMessageCursor | null {
  const value = record(raw);
  return value && exact(value, ['createdAt', 'messageId']) && instant(value.createdAt) && uuid(value.messageId)
    ? { createdAt: value.createdAt as string, messageId: value.messageId } : null;
}
const messageCursor = (message: AgreementHistoryMessage): AgreementMessageCursor => ({ createdAt: message.createdAt, messageId: message.id });
function boundary(raw: unknown, message: AgreementHistoryMessage | undefined): AgreementMessageCursor | null | false {
  if (raw === null) return null;
  const value = cursor(raw);
  return value && message && sameId(value.messageId, message.id) && value.createdAt === message.createdAt ? value : false;
}
function validBody(value: unknown): value is string {
  if (typeof value !== 'string' || value.includes('\0') || Array.from(value).length > 2000) return false;
  for (const point of value) { const code = point.codePointAt(0)!; if (code >= 0xd800 && code <= 0xdfff) return false; }
  return true;
}
const MESSAGE_KEYS = ['messageId', 'agreementVersion', 'senderAccountId', 'clientMessageId', 'body', 'createdAt', 'kind', 'mine', 'photos'] as const;
/** The voice metadata of a V2 row: exactly these four keys, bounded, audio/mp4 only. Never a path, URL or hash. */
function voiceMetadata(raw: unknown): { assetId: string; trajanjeMs: number; velicina: number } | null {
  const value = record(raw);
  if (!value || !exact(value, ['assetId', 'durationMs', 'byteSize', 'contentType']) || !uuid(value.assetId) || !bounded(value.durationMs, 300, 300_000)
    || !bounded(value.byteSize, 1, 4_194_304) || value.contentType !== 'audio/mp4') return null;
  return { assetId: value.assetId, trajanjeMs: value.durationMs, velicina: value.byteSize };
}
function message(raw: unknown, accountId: string, voiceContract = false): AgreementHistoryMessage | null {
  const value = record(raw);
  if (!value || !exact(value, voiceContract ? [...MESSAGE_KEYS, 'voice'] : MESSAGE_KEYS)
    || !uuid(value.messageId) || !uuid(value.senderAccountId) || !instant(value.createdAt) || !validBody(value.body)
    || (value.kind !== 'TEXT' && value.kind !== 'PHOTO' && !(voiceContract && value.kind === 'VOICE')) || value.mine !== sameId(value.senderAccountId, accountId)
    || !Array.isArray(value.photos) || value.photos.length > 6 || value.photos.some(item => !uuid(record(item)?.assetId))) return null;
  // A voice row is voice-only: empty body, no photos, a voice object. TEXT and PHOTO rows never carry one. The V1 contract has no voice key at all.
  const glas = voiceContract && value.kind === 'VOICE' ? voiceMetadata(value.voice) : null;
  if (voiceContract && (value.kind === 'VOICE' ? !glas || value.body !== '' || value.photos.length !== 0 : value.voice !== null)) return null;
  if (value.kind === 'TEXT' ? value.photos.length !== 0 || !value.body.trim() : value.kind === 'PHOTO' && value.photos.length === 0) return null;
  // Reuse the existing strict metadata/link decoder; never admit paths, URLs or unknown media kinds.
  const photo = decodeAgreementPhotoMessage({ messageId: value.messageId, agreementVersion: value.agreementVersion,
    clientMessageId: value.clientMessageId, body: value.body, photos: value.photos,
    assetIds: value.photos.map(item => record(item)?.assetId) });
  if (!photo) return null;
  return { id: photo.messageId, dogovorVerzija: photo.agreementVersion, clientMessageId: photo.clientMessageId,
    posiljalacAccountId: value.senderAccountId, posiljalacIme: value.mine ? 'Ja' : 'Sagovornik', moja: value.mine === true,
    telo: photo.body, vremeTekst: vreme(value.createdAt as string, { danas: true }), procitano: null,
    fotografije: photo.photos, ...(glas ? { glas } : {}), createdAt: value.createdAt as string, kind: value.kind };
}
function envelope(value: Record<string, unknown>, accountId: string, agreementId: string, maximum: number, voiceContract = false): HistoryEnvelope | null {
  if (!uuid(accountId) || !uuid(agreementId) || !sameId(value.accountId, accountId) || !sameId(value.agreementId, agreementId)
    || value.authoritative !== true || !instant(value.asOf) || !Array.isArray(value.messages) || value.messages.length > maximum) return null;
  const messages = value.messages.map(row => message(row, accountId, voiceContract));
  if (messages.some(row => !row) || new Set(messages.map(row => row!.id.toLowerCase())).size !== messages.length) return null;
  const decoded = messages as AgreementHistoryMessage[];
  if (decoded.some((row, index) => index > 0 && compareAgreementMessageCursors(messageCursor(decoded[index - 1]), messageCursor(row)) >= 0)) return null;
  return { accountId, agreementId, messages: decoded, asOf: value.asOf as string, authoritative: true };
}
export function decodeAgreementMessageHistoryPage(raw: unknown, accountId: string, agreementId: string,
  options: AgreementHistoryPageOptions = {}): AgreementMessageHistoryPage | null {
  const value = record(raw), limit = options.limit === undefined ? 50 : options.limit, before = options.before == null ? null : cursor(options.before);
  if (!value || !exact(value, ['schema', 'accountId', 'agreementId', 'messages', 'olderCursor', 'asOf', 'authoritative'])
    || value.schema !== (options.voice ? 'AGREEMENT_MESSAGES_PAGE_V2' : 'AGREEMENT_MESSAGES_PAGE_V1') || !bounded(limit, 1, 50) || (options.before != null && !before)) return null;
  const page = envelope(value, accountId, agreementId, limit, options.voice === true);
  if (!page || (before && page.messages.some(row => compareAgreementMessageCursors(messageCursor(row), before) >= 0))) return null;
  const olderCursor = boundary(value.olderCursor, page.messages[0]);
  if (olderCursor === false || (olderCursor && page.messages.length !== limit)) return null;
  return { ...page, olderCursor };
}
export function decodeAgreementMessageWindow(raw: unknown, accountId: string, agreementId: string, targetMessageId: string,
  options: AgreementMessageWindowOptions = {}): AgreementMessageWindow | null {
  const value = record(raw), beforeCount = options.beforeCount === undefined ? 24 : options.beforeCount, afterCount = options.afterCount === undefined ? 25 : options.afterCount;
  if (!value || !exact(value, ['schema', 'accountId', 'agreementId', 'targetMessageId', 'messages', 'beforeCursor', 'afterCursor', 'asOf', 'authoritative'])
    || value.schema !== (options.voice ? 'AGREEMENT_MESSAGE_WINDOW_V2' : 'AGREEMENT_MESSAGE_WINDOW_V1') || !uuid(targetMessageId) || !sameId(value.targetMessageId, targetMessageId)
    || !bounded(beforeCount, 0, 49) || !bounded(afterCount, 0, 49) || beforeCount + afterCount > 49) return null;
  const page = envelope(value, accountId, agreementId, beforeCount + afterCount + 1, options.voice === true);
  if (!page) return null;
  const target = page.messages.findIndex(row => sameId(row.id, targetMessageId)), after = page.messages.length - target - 1;
  if (target < 0 || target > beforeCount || after > afterCount) return null;
  const beforeCursor = boundary(value.beforeCursor, page.messages[0]), afterCursor = boundary(value.afterCursor, page.messages[page.messages.length - 1]);
  if (beforeCursor === false || afterCursor === false || (beforeCursor && target !== beforeCount) || (afterCursor && after !== afterCount)) return null;
  return { ...page, targetMessageId, beforeCursor, afterCursor };
}
function validIds(ids: unknown): ids is readonly string[] {
  return Array.isArray(ids) && ids.length > 0 && ids.length <= 50 && ids.every(uuid)
    && new Set(ids.map(id => id.toLowerCase())).size === ids.length;
}
export function decodeAgreementDisplayedMessagesReceipt(raw: unknown, accountId: string, agreementId: string,
  displayedMessageIds: readonly string[]): AgreementDisplayedMessagesReceipt | null {
  const value = record(raw);
  if (!value || !exact(value, ['schema', 'accountId', 'agreementId', 'displayedMessageIds', 'markedEventCount', 'authoritative'])
    || value.schema !== 'AGREEMENT_MESSAGE_READ_V1' || !uuid(accountId) || !uuid(agreementId)
    || !sameId(value.accountId, accountId) || !sameId(value.agreementId, agreementId) || value.authoritative !== true
    || !validIds(displayedMessageIds) || !validIds(value.displayedMessageIds) || value.displayedMessageIds.length !== displayedMessageIds.length
    || value.displayedMessageIds.some((id, i) => !sameId(id, displayedMessageIds[i])) || !bounded(value.markedEventCount, 0, displayedMessageIds.length)) return null;
  return { accountId, agreementId, displayedMessageIds: [...value.displayedMessageIds], markedEventCount: value.markedEventCount, authoritative: true };
}

function owner(scope?: ReceiptAccount): ReceiptAccount | null {
  const session = sesijaSada(), account = scope ?? (session.user ? { accountId: session.user.id, accountRevision: session.accountRevision } : null);
  return account && uuid(account.accountId) && bounded(account.accountRevision, 0, Number.MAX_SAFE_INTEGER) ? { ...account } : null;
}
type Rpc = (name: string, args: Record<string, unknown>, signal?: AbortSignal) => PromiseLike<unknown>;
/** `voice` picks the V2 readers; by default the build flag decides (off everywhere the backend does not carry the voice package). */
export function createAgreementMessageHistoryService(rpc: Rpc, config: Readonly<{ voice?: boolean }> = {}) {
  const voice = config.voice ?? voiceMessagesBuilt();
  async function request<T>(name: string, args: Record<string, unknown>, account: ReceiptAccount, decode: (raw: unknown) => T | null,
    signal?: AbortSignal, write = false): Promise<Ishod<T>> {
    if (signal?.aborted) return cancelled();
    const result = await readOwnedResult({ account, write, errors, fallback: 'CHAT_HISTORY_UNCONFIRMED', invalid: 'CHAT_HISTORY_INVALID_RESPONSE', decode,
      request: () => rpc(name, args, signal) });
    return signal?.aborted ? cancelled() : result;
  }
  return {
    page(agreementId: string, options: AgreementHistoryPageOptions = {}, scope?: ReceiptAccount): Promise<Ishod<AgreementMessageHistoryPage>> {
      const account = owner(scope), limit = options.limit === undefined ? 50 : options.limit, before = options.before == null ? null : cursor(options.before), signal = options.signal;
      if (!account) return Promise.resolve(failure('AUTH_REQUIRED', errors.AUTH_REQUIRED));
      if (!uuid(agreementId) || !bounded(limit, 1, 50) || (options.before != null && !before)) return Promise.resolve(invalidInput());
      const captured = { limit, before, voice };
      return request(voice ? 'rpc_read_agreement_messages_page_v2' : 'rpc_read_agreement_messages_page_v1', { p_expected_user_id: account.accountId, p_agreement_id: agreementId,
        p_limit: limit, p_before_created_at: before?.createdAt ?? null, p_before_id: before?.messageId ?? null }, account,
      raw => decodeAgreementMessageHistoryPage(raw, account.accountId, agreementId, captured), signal);
    },
    window(agreementId: string, targetMessageId: string, options: AgreementMessageWindowOptions = {}, scope?: ReceiptAccount): Promise<Ishod<AgreementMessageWindow>> {
      const account = owner(scope), beforeCount = options.beforeCount === undefined ? 24 : options.beforeCount,
        afterCount = options.afterCount === undefined ? 25 : options.afterCount, signal = options.signal;
      if (!account) return Promise.resolve(failure('AUTH_REQUIRED', errors.AUTH_REQUIRED));
      if (!uuid(agreementId) || !uuid(targetMessageId) || !bounded(beforeCount, 0, 49) || !bounded(afterCount, 0, 49) || beforeCount + afterCount > 49)
        return Promise.resolve(invalidInput());
      const captured = { beforeCount, afterCount, voice };
      return request(voice ? 'rpc_read_agreement_message_window_v2' : 'rpc_read_agreement_message_window_v1', { p_expected_user_id: account.accountId, p_agreement_id: agreementId,
        p_target_message_id: targetMessageId, p_before_count: beforeCount, p_after_count: afterCount }, account,
      raw => decodeAgreementMessageWindow(raw, account.accountId, agreementId, targetMessageId, captured), signal);
    },
    /** Call only with IDs measured as displayed in the current account/Agreement visit. */
    markDisplayed(agreementId: string, displayedMessageIds: readonly string[], scope?: ReceiptAccount): Promise<Ishod<AgreementDisplayedMessagesReceipt>> {
      const account = owner(scope);
      if (!account) return Promise.resolve(failure('AUTH_REQUIRED', errors.AUTH_REQUIRED));
      if (!uuid(agreementId) || !validIds(displayedMessageIds)) return Promise.resolve(invalidInput());
      const ids = [...displayedMessageIds];
      return request('rpc_mark_displayed_agreement_messages_v1', { p_expected_user_id: account.accountId, p_agreement_id: agreementId, p_message_ids: [...ids] },
        account, raw => decodeAgreementDisplayedMessagesReceipt(raw, account.accountId, agreementId, ids), undefined, true);
    },
  };
}
export const agreementMessageHistoryService = createAgreementMessageHistoryService((name, args, signal) => {
  const request = supabaseKlijent().rpc(name, args);
  return signal ? request.abortSignal(signal) : request;
});
