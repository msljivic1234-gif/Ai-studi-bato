import type { Ishod } from './ports';
import type { PorukaProjekcija } from '../contracts/projections';
import { sesijaSada } from '../store/sesija';
import { supabaseKlijent } from './supabaseClient';
import { failure, positiveInteger, readOwnedResult, record, sameId, uuid, type ReceiptAccount } from './serverReceipt';

export type AgreementPhoto = Readonly<{ assetId: string; width: number; height: number; byteSize: number; contentType: 'image/jpeg' }>;
export type AgreementUploadRef = Readonly<{ agreementId: string; agreementVersion: number; clientRequestId: string }>;
export type AgreementPhotoUpload = AgreementUploadRef & Readonly<{ accountId: string; assetId: string | null;
  state: 'ABSENT' | 'PROCESSING' | 'STAGED' | 'READY' | 'FAILED' | 'CANCELLED'; attachedMessageId: string | null;
  photo: AgreementPhoto | null; authoritative: true }>;
export type AgreementPhotoMessage = Readonly<{ messageId: string; agreementVersion: number; clientMessageId: string | null;
  body: string; assetIds: readonly string[]; photos: readonly AgreementPhoto[] }>;
const exact = (v: Record<string, unknown>, keys: readonly string[]) => Object.keys(v).length === keys.length && keys.every(k => Object.hasOwn(v, k));
const boundedInt = (v: unknown, max: number): v is number => positiveInteger(v) && v <= max;
const agreementPhotoErrors = {
  AUTH_REQUIRED: 'Prijavi se da nastaviš.', MEDIA_NOT_FOUND: 'Fotografija nije dostupna.',
  MEDIA_INPUT_INVALID: 'Izaberi fotografiju do 10 MB.', MEDIA_SANITIZATION_FAILED: 'Fotografija nije mogla da se pripremi.',
  MEDIA_VERSION_CONFLICT: 'Uslovi Dogovora su promenjeni. Osveži Dogovor i ukloni stare pripremljene fotografije.',
  MEDIA_COMMAND_CONFLICT: 'Ovaj pokušaj pripada drugoj fotografiji. Proveri sačuvani ishod.',
  MEDIA_RATE_LIMITED: 'Trenutno je dostignuta zaštitna granica slanja. Pokušaj kasnije.',
  MEDIA_BUSY: 'Slanje fotografije je trenutno zauzeto. Sačekaj nekoliko sekundi pa pokušaj ponovo.', MEDIA_UPLOAD_PENDING: 'Slanje fotografije je trenutno zauzeto. Sačekaj nekoliko sekundi pa pokušaj ponovo.',
  INTERACTION_BLOCKED: 'U ovom Dogovoru nije dozvoljeno novo slanje.', ACCOUNT_CLOSING: 'Zatvaranje naloga ne dopušta novo slanje.',
};
function decodeAgreementPhoto(raw: unknown): AgreementPhoto | null {
  const p = record(raw);
  return p && exact(p, ['assetId', 'width', 'height', 'byteSize', 'contentType']) && uuid(p.assetId)
    && boundedInt(p.width, 1600) && boundedInt(p.height, 1600) && boundedInt(p.byteSize, 5242880) && p.contentType === 'image/jpeg'
    ? { assetId: p.assetId, width: p.width, height: p.height, byteSize: p.byteSize, contentType: 'image/jpeg' } : null;
}
export function decodeAgreementUpload(raw: unknown, accountId: string, ref?: AgreementUploadRef): AgreementPhotoUpload | null {
  const r = record(raw);
  if (!r || !exact(r, ['accountId', 'agreementId', 'agreementVersion', 'clientRequestId', 'assetId', 'state', 'attachedMessageId', 'photo', 'authoritative'])
    || !sameId(r.accountId, accountId) || !uuid(r.agreementId) || !positiveInteger(r.agreementVersion) || !uuid(r.clientRequestId)
    || r.authoritative !== true || !['ABSENT', 'PROCESSING', 'STAGED', 'READY', 'FAILED', 'CANCELLED'].includes(String(r.state))
    || (ref && (!sameId(r.agreementId, ref.agreementId) || r.agreementVersion !== ref.agreementVersion || !sameId(r.clientRequestId, ref.clientRequestId)))) return null;
  const photo = r.photo === null ? null : decodeAgreementPhoto(r.photo);
  if (r.state === 'ABSENT' ? r.assetId !== null : !uuid(r.assetId)) return null;
  if (r.state === 'READY' ? !photo || !sameId(photo.assetId, String(r.assetId)) : r.photo !== null) return null;
  if (r.attachedMessageId !== null && (r.state !== 'READY' || !uuid(r.attachedMessageId))) return null;
  return { accountId, agreementId: r.agreementId, agreementVersion: r.agreementVersion, clientRequestId: r.clientRequestId,
    assetId: r.assetId as string | null, state: r.state as AgreementPhotoUpload['state'], attachedMessageId: r.attachedMessageId as string | null,
    photo, authoritative: true };
}
export function decodeAgreementPhotoMessage(raw: unknown): AgreementPhotoMessage | null {
  const r = record(raw);
  if (!r || !exact(r, ['messageId', 'agreementVersion', 'clientMessageId', 'body', 'assetIds', 'photos']) || !uuid(r.messageId)
    || !positiveInteger(r.agreementVersion) || !(r.clientMessageId === null || (typeof r.clientMessageId === 'string'
      && /^[A-Za-z0-9][A-Za-z0-9_.:-]{7,199}$/.test(r.clientMessageId) && !/\s/.test(r.clientMessageId)))
    || typeof r.body !== 'string' || !Array.isArray(r.assetIds) || r.assetIds.length > 6 || r.assetIds.some(id => !uuid(id))
    || new Set(r.assetIds.map(id => id.toLowerCase())).size !== r.assetIds.length || !Array.isArray(r.photos) || r.photos.length !== r.assetIds.length) return null;
  const photos = r.photos.map(decodeAgreementPhoto);
  const assetIds = r.assetIds as string[];
  if (photos.some((p, i) => !p || !sameId(p.assetId, assetIds[i]))) return null;
  return { messageId: r.messageId, agreementVersion: r.agreementVersion, clientMessageId: r.clientMessageId,
    body: r.body, assetIds: [...assetIds], photos: photos as AgreementPhoto[] };
}
const validRef = (ref: AgreementUploadRef) => uuid(ref.agreementId) && positiveInteger(ref.agreementVersion) && uuid(ref.clientRequestId);
function owner(scope?: ReceiptAccount): ReceiptAccount | null {
  const session = sesijaSada(); return scope ?? (session.user ? { accountId: session.user.id, accountRevision: session.accountRevision } : null);
}
async function edge<T>(operation: string, body: ArrayBuffer | Record<string, unknown>, decode: (v: unknown) => T | null, scope?: ReceiptAccount, write = false,
  headers?: Record<string, string>, signal?: AbortSignal): Promise<Ishod<T>> {
  const account = owner(scope); if (!account) return failure('AUTH_REQUIRED', agreementPhotoErrors.AUTH_REQUIRED);
  return readOwnedResult({ account, write, errors: agreementPhotoErrors, fallback: 'AGREEMENT_PHOTO_UNCONFIRMED', invalid: 'AGREEMENT_PHOTO_INVALID_RESPONSE',
    decode, request: async () => {
      const result = await supabaseKlijent().functions.invoke('uskoci-media', { body, headers: { 'x-media-operation': operation, ...headers }, signal });
      if (result.error) {
        const context = record(result.error)?.context;
        if (context instanceof Response) { try { const error = record(await context.json());
          if (error && typeof error.code === 'string' && Object.hasOwn(agreementPhotoErrors, error.code)) return { data: null, error: { message: error.code } };
        } catch { /* Only finite safe codes are exposed. */ } }
      }
      return result;
    } });
}
export const agreementPhotoClientService = {
  list: (agreementId: string, scope?: ReceiptAccount): Promise<Ishod<readonly AgreementPhotoUpload[]>> => {
    const account = owner(scope); if (!account || !uuid(agreementId)) return Promise.resolve(failure('MEDIA_NOT_FOUND', agreementPhotoErrors.MEDIA_NOT_FOUND));
    return edge('agreement-upload-list', { agreementId }, raw => {
      const r = record(raw);
      if (!r || !exact(r, ['accountId', 'agreementId', 'uploads', 'authoritative']) || !sameId(r.accountId, account.accountId)
        || !sameId(r.agreementId, agreementId) || r.authoritative !== true || !Array.isArray(r.uploads) || r.uploads.length > 120) return null;
      const uploads = r.uploads.map(v => decodeAgreementUpload(v, account.accountId));
      if (uploads.some(v => !v || !sameId(v.agreementId, agreementId) || v.attachedMessageId !== null || ['ABSENT', 'FAILED', 'CANCELLED'].includes(v.state))
        || new Set(uploads.map(v => v!.clientRequestId)).size !== uploads.length || new Set(uploads.map(v => v!.assetId)).size !== uploads.length) return null;
      return uploads as AgreementPhotoUpload[];
    }, account);
  },
  upload: (ref: AgreementUploadRef, bytes: ArrayBuffer, scope?: ReceiptAccount, signal?: AbortSignal): Promise<Ishod<AgreementPhotoUpload>> => {
    const account = owner(scope);
    if (!account || !validRef(ref) || !(bytes instanceof ArrayBuffer) || bytes.byteLength < 1 || bytes.byteLength > 10485760 || signal?.aborted)
      return Promise.resolve(failure('MEDIA_INPUT_INVALID', agreementPhotoErrors.MEDIA_INPUT_INVALID));
    return edge('agreement-upload', bytes, v => decodeAgreementUpload(v, account.accountId, ref), account, true, {
      'Content-Type': 'image/jpeg', 'x-media-target': ref.agreementId, 'x-media-version': String(ref.agreementVersion), 'x-media-request-id': ref.clientRequestId,
    }, signal);
  },
  read: (ref: AgreementUploadRef, scope?: ReceiptAccount): Promise<Ishod<AgreementPhotoUpload>> => {
    const account = owner(scope); if (!account || !validRef(ref)) return Promise.resolve(failure('MEDIA_NOT_FOUND', agreementPhotoErrors.MEDIA_NOT_FOUND));
    return edge('agreement-upload-read', { ...ref }, v => decodeAgreementUpload(v, account.accountId, ref), account);
  },
  cancel: (ref: AgreementUploadRef, scope?: ReceiptAccount): Promise<Ishod<AgreementPhotoUpload>> => {
    const account = owner(scope); if (!account || !validRef(ref)) return Promise.resolve(failure('MEDIA_NOT_FOUND', agreementPhotoErrors.MEDIA_NOT_FOUND));
    return edge('agreement-upload-cancel', { ...ref }, v => decodeAgreementUpload(v, account.accountId, ref), account, true);
  },
  async messages(agreementId: string, messages: readonly PorukaProjekcija[], scope: ReceiptAccount): Promise<PorukaProjekcija[]> {
    if (!uuid(agreementId) || messages.some(m => !uuid(m.id)) || new Set(messages.map(m => m.id.toLowerCase())).size !== messages.length)
      throw new Error('AGREEMENT_PHOTO_SCOPE_INVALID');
    const snapshot = messages.map(m => ({ ...m })), result: PorukaProjekcija[] = [];
    for (let i = 0; i < snapshot.length; i += 50) {
      const batch = snapshot.slice(i, i + 50), ids = batch.map(m => m.id);
      const read = await readOwnedResult({ account: scope, errors: agreementPhotoErrors, fallback: 'AGREEMENT_PHOTO_UNCONFIRMED', invalid: 'AGREEMENT_PHOTO_INVALID_RESPONSE',
        request: () => supabaseKlijent().rpc('rpc_read_agreement_photo_messages_v5', { p_expected_user_id: scope.accountId,
          p_agreement_id: agreementId, p_message_ids: ids }), decode: raw => {
          const r = record(raw); if (!r || !exact(r, ['accountId', 'agreementId', 'messages', 'authoritative']) || !sameId(r.accountId, scope.accountId)
            || !sameId(r.agreementId, agreementId) || r.authoritative !== true || !Array.isArray(r.messages) || r.messages.length !== ids.length) return null;
          const decoded = r.messages.map(decodeAgreementPhotoMessage);
          if (decoded.some(m => !m) || new Set(decoded.map(m => m!.messageId.toLowerCase())).size !== ids.length) return null;
          return decoded as AgreementPhotoMessage[];
        } });
      if (!read.ok) throw new Error('AGREEMENT_PHOTO_READ_FAILED');
      for (const original of batch) {
        const p = read.podatak.find(m => sameId(m.messageId, original.id));
        if (!p || p.agreementVersion !== original.dogovorVerzija || p.clientMessageId !== (original.clientMessageId ?? null) || p.body !== original.telo)
          throw new Error('AGREEMENT_PHOTO_MESSAGE_CONFLICT');
        result.push({ ...original, fotografije: [...p.photos] });
      }
    }
    return result;
  },
};
