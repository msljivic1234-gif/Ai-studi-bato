import type { Ishod } from './ports';
import { sesijaSada } from '../store/sesija';
import { supabaseKlijent } from './supabaseClient';
import type { AgreementUploadRef } from './agreementPhotoClientService';
import { failure, positiveInteger, readOwnedResult, record, sameId, uuid, type ReceiptAccount } from './serverReceipt';
import { readVoiceBinary, VOICE_MAX_BYTES } from './voiceBinaryRead';

/** The metadata of one stored voice message. Never a path, URL or hash: the bytes only come through the authenticated playback read. */
export type AgreementVoiceAsset = Readonly<{ assetId: string; durationMs: number; byteSize: number; contentType: 'audio/mp4' }>;
export type AgreementVoiceUpload = AgreementUploadRef & Readonly<{ accountId: string; assetId: string | null;
  state: 'ABSENT' | 'PROCESSING' | 'STAGED' | 'READY' | 'FAILED' | 'CANCELLED'; attachedMessageId: string | null;
  voice: AgreementVoiceAsset | null; authoritative: true }>;
export type AgreementVoicePlayback = Readonly<{ assetId: string; bytes: ArrayBuffer; contentType: 'audio/mp4' }>;
export const VOICE_MIN_BYTES = 32;

const exact = (v: Record<string, unknown>, keys: readonly string[]) => Object.keys(v).length === keys.length && keys.every(k => Object.hasOwn(v, k));
const inRange = (v: unknown, min: number, max: number): v is number => typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max;
const agreementVoiceErrors = {
  AUTH_REQUIRED: 'Prijavi se da nastaviš.', MEDIA_NOT_FOUND: 'Glasovna poruka nije dostupna.',
  MEDIA_INPUT_INVALID: 'Snimak nije ispravan. Snimi ponovo.', MEDIA_FORMAT_UNSUPPORTED: 'Snimak nije u podržanom obliku. Snimi ponovo.',
  MEDIA_VERSION_CONFLICT: 'Uslovi Dogovora su promenjeni. Osveži Dogovor pa snimi ponovo.',
  MEDIA_COMMAND_CONFLICT: 'Ovaj pokušaj pripada drugom snimku. Proveri sačuvani ishod.',
  MEDIA_RATE_LIMITED: 'Previše snimaka u kratkom roku. Pokušaj malo kasnije.',
  MEDIA_BUSY: 'Slanje je trenutno zauzeto. Sačekaj nekoliko sekundi pa pokušaj ponovo.', MEDIA_UPLOAD_PENDING: 'Slanje je trenutno zauzeto. Sačekaj nekoliko sekundi pa pokušaj ponovo.',
  INTERACTION_BLOCKED: 'U ovom Dogovoru nije dozvoljeno novo slanje.', ACCOUNT_CLOSING: 'Zatvaranje naloga ne dopušta novo slanje.',
};
function decodeVoiceAsset(raw: unknown): AgreementVoiceAsset | null {
  const v = record(raw);
  return v && exact(v, ['assetId', 'durationMs', 'byteSize', 'contentType']) && uuid(v.assetId) && inRange(v.durationMs, 300, 300_000)
    && inRange(v.byteSize, 1, VOICE_MAX_BYTES) && v.contentType === 'audio/mp4'
    ? { assetId: v.assetId, durationMs: v.durationMs, byteSize: v.byteSize, contentType: 'audio/mp4' } : null;
}
export function decodeVoiceUpload(raw: unknown, accountId: string, ref?: AgreementUploadRef): AgreementVoiceUpload | null {
  const r = record(raw);
  if (!r || !exact(r, ['accountId', 'agreementId', 'agreementVersion', 'clientRequestId', 'assetId', 'state', 'attachedMessageId', 'voice', 'authoritative'])
    || !sameId(r.accountId, accountId) || !uuid(r.agreementId) || !positiveInteger(r.agreementVersion) || !uuid(r.clientRequestId)
    || r.authoritative !== true || !['ABSENT', 'PROCESSING', 'STAGED', 'READY', 'FAILED', 'CANCELLED'].includes(String(r.state))
    || (ref && (!sameId(r.agreementId, ref.agreementId) || r.agreementVersion !== ref.agreementVersion || !sameId(r.clientRequestId, ref.clientRequestId)))) return null;
  const voice = r.voice === null ? null : decodeVoiceAsset(r.voice);
  if (r.state === 'ABSENT' ? r.assetId !== null : !uuid(r.assetId)) return null;
  if (r.state === 'READY' ? !voice || !sameId(voice.assetId, String(r.assetId)) : r.voice !== null) return null;
  if (r.attachedMessageId !== null && (r.state !== 'READY' || !uuid(r.attachedMessageId))) return null;
  return { accountId, agreementId: r.agreementId, agreementVersion: r.agreementVersion, clientRequestId: r.clientRequestId,
    assetId: r.assetId as string | null, state: r.state as AgreementVoiceUpload['state'], attachedMessageId: r.attachedMessageId as string | null,
    voice, authoritative: true };
}
const validRef = (ref: AgreementUploadRef) => uuid(ref.agreementId) && positiveInteger(ref.agreementVersion) && uuid(ref.clientRequestId);
function owner(scope?: ReceiptAccount): ReceiptAccount | null {
  const session = sesijaSada(); return scope ?? (session.user ? { accountId: session.user.id, accountRevision: session.accountRevision } : null);
}
async function edge<T>(operation: string, body: ArrayBuffer | Record<string, unknown>, decode: (v: unknown) => T | null, scope?: ReceiptAccount, write = false,
  headers?: Record<string, string>, signal?: AbortSignal, slow = false): Promise<Ishod<T>> {
  const account = owner(scope); if (!account) return failure('AUTH_REQUIRED', agreementVoiceErrors.AUTH_REQUIRED);
  return readOwnedResult({ account, write, errors: agreementVoiceErrors, fallback: 'AGREEMENT_VOICE_UNCONFIRMED', invalid: 'AGREEMENT_VOICE_INVALID_RESPONSE',
    decode, signal, ...(slow ? { timeoutMs: 55_000 as const } : {}), request: async ownedSignal => {
      const result = await supabaseKlijent().functions.invoke('uskoci-media', { body, headers: { 'x-media-operation': operation, ...headers }, signal: ownedSignal });
      if (result.error) {
        const context = record(result.error)?.context;
        if (context instanceof Response) { try { const error = record(await context.json());
          if (error && typeof error.code === 'string' && Object.hasOwn(agreementVoiceErrors, error.code)) return { data: null, error: { message: error.code } };
        } catch { /* Only finite safe codes are exposed. */ } }
      }
      return result;
    } });
}
export const agreementVoiceClientService = {
  list: (agreementId: string, scope?: ReceiptAccount, signal?: AbortSignal): Promise<Ishod<readonly AgreementVoiceUpload[]>> => {
    const account = owner(scope); if (!account || !uuid(agreementId)) return Promise.resolve(failure('MEDIA_NOT_FOUND', agreementVoiceErrors.MEDIA_NOT_FOUND));
    return edge('agreement-voice-upload-list', { agreementId }, raw => {
      const r = record(raw);
      if (!r || !exact(r, ['accountId', 'agreementId', 'uploads', 'authoritative']) || !sameId(r.accountId, account.accountId)
        || !sameId(r.agreementId, agreementId) || r.authoritative !== true || !Array.isArray(r.uploads) || r.uploads.length > 20) return null;
      const uploads = r.uploads.map(v => decodeVoiceUpload(v, account.accountId));
      if (uploads.some(v => !v || !sameId(v.agreementId, agreementId) || v.attachedMessageId !== null || ['ABSENT', 'FAILED', 'CANCELLED'].includes(v.state))
        || new Set(uploads.map(v => v!.clientRequestId)).size !== uploads.length || new Set(uploads.map(v => v!.assetId)).size !== uploads.length) return null;
      return uploads as AgreementVoiceUpload[];
    }, account, false, undefined, signal);
  },
  /** The recording's bytes as they were recorded: the server validates the container and stores exactly these bytes. */
  upload: (ref: AgreementUploadRef, bytes: ArrayBuffer, scope?: ReceiptAccount, signal?: AbortSignal): Promise<Ishod<AgreementVoiceUpload>> => {
    const account = owner(scope);
    if (!account || !validRef(ref) || !(bytes instanceof ArrayBuffer) || bytes.byteLength < VOICE_MIN_BYTES || bytes.byteLength > VOICE_MAX_BYTES || signal?.aborted)
      return Promise.resolve(failure('MEDIA_INPUT_INVALID', agreementVoiceErrors.MEDIA_INPUT_INVALID));
    return edge('agreement-voice-upload', bytes, v => decodeVoiceUpload(v, account.accountId, ref), account, true, {
      'Content-Type': 'audio/mp4', 'x-media-target': ref.agreementId, 'x-media-version': String(ref.agreementVersion), 'x-media-request-id': ref.clientRequestId,
    }, signal, true);
  },
  read: (ref: AgreementUploadRef, scope?: ReceiptAccount, signal?: AbortSignal): Promise<Ishod<AgreementVoiceUpload>> => {
    const account = owner(scope); if (!account || !validRef(ref)) return Promise.resolve(failure('MEDIA_NOT_FOUND', agreementVoiceErrors.MEDIA_NOT_FOUND));
    return edge('agreement-voice-upload-read', { ...ref }, v => decodeVoiceUpload(v, account.accountId, ref), account, false, undefined, signal);
  },
  cancel: (ref: AgreementUploadRef, scope?: ReceiptAccount, signal?: AbortSignal): Promise<Ishod<AgreementVoiceUpload>> => {
    const account = owner(scope); if (!account || !validRef(ref)) return Promise.resolve(failure('MEDIA_NOT_FOUND', agreementVoiceErrors.MEDIA_NOT_FOUND));
    return edge('agreement-voice-upload-cancel', { ...ref }, v => decodeVoiceUpload(v, account.accountId, ref), account, true, undefined, signal);
  },
  /** The authenticated bytes of a voice message. A message id is required for anything already sent (received messages included); an own unsent recording
   * may be played back without one. The caller writes the bytes to a temporary file and removes it on stop, blur and logout. */
  async playback(input: Readonly<{ agreementId: string; assetId: string; messageId?: string }>, scope?: ReceiptAccount, signal?: AbortSignal): Promise<Ishod<AgreementVoicePlayback>> {
    const account = owner(scope); if (!account) return failure('AUTH_REQUIRED', agreementVoiceErrors.AUTH_REQUIRED);
    if (!uuid(input.agreementId) || !uuid(input.assetId) || (input.messageId !== undefined && !uuid(input.messageId)) || signal?.aborted)
      return failure('MEDIA_NOT_FOUND', agreementVoiceErrors.MEDIA_NOT_FOUND);
    return readOwnedResult({ account, signal, timeoutMs: 30_000, errors: agreementVoiceErrors, fallback: 'MEDIA_UNAVAILABLE', invalid: 'MEDIA_INVALID_RESPONSE', request: async ownedSignal => {
      const result = await readVoiceBinary({ account, signal: ownedSignal, body: { agreementId: input.agreementId, assetId: input.assetId, ...(input.messageId ? { messageId: input.messageId } : {}) } });
      return result.data ? { data: { ...result.data, assetId: input.assetId }, error: null } : result;
    }, decode: raw => {
      const r = record(raw);
      return r && r.bytes instanceof ArrayBuffer && r.contentType === 'audio/mp4' && sameId(r.assetId, input.assetId)
        ? { assetId: input.assetId, bytes: r.bytes, contentType: 'audio/mp4' as const } : null;
    } });
  },
};
