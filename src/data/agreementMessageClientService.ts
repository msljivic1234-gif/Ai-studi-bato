import {
  AgreementMessageError, validMessagePhotos, validMessageVoice, type AgreementMessageCommand, type AgreementMessageErrorCode, type AgreementMessagePort,
} from '../contracts/agreementMessages';
import { supabaseKlijent } from './supabaseClient';

type Rpc = (name: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: unknown }>;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const key = /^[A-Za-z0-9][A-Za-z0-9_.:-]{7,199}$/;
const exactUuid = (value: string) => value.length === 36 && uuid.test(value);
function wellFormedUnicode(value: string): boolean {
  for (const point of value) {
    const code = point.codePointAt(0)!;
    if (code >= 0xd800 && code <= 0xdfff) return false;
  }
  return true;
}
const object = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);
const fail = (code: AgreementMessageErrorCode): never => { throw new AgreementMessageError(code); };

/** Capture before any await; neither a token switch nor an edited draft changes this intent. */
export function captureAgreementMessage(input: AgreementMessageCommand): AgreementMessageCommand {
  if (!input || typeof input.accountId !== 'string' || !exactUuid(input.accountId)) return fail('AUTH_CONTEXT_CHANGED');
  if (typeof input.agreementId !== 'string' || !exactUuid(input.agreementId)
    || typeof input.clientMessageId !== 'string' || !key.test(input.clientMessageId) || /\s/.test(input.clientMessageId)
    || typeof input.body !== 'string') return fail('INVALID_MESSAGE');
  const body = input.body.trim();
  // PostgreSQL char_length counts Unicode code points, not JavaScript UTF-16 units.
  if ((!body && !input.photos && !input.voice) || Array.from(body).length > 2000 || body.includes('\0') || !wellFormedUnicode(body)
    || (input.photos !== undefined && !validMessagePhotos(input.photos))) return fail('INVALID_MESSAGE');
  // A voice message is voice-only: exactly one valid asset, no body, no photos.
  if (input.voice !== undefined && (!validMessageVoice(input.voice) || body || input.photos)) return fail('INVALID_MESSAGE');
  return Object.freeze({ accountId: input.accountId, agreementId: input.agreementId,
    clientMessageId: input.clientMessageId, body, ...(input.photos ? { photos: Object.freeze({ agreementVersion: input.photos.agreementVersion,
      assetIds: Object.freeze([...input.photos.assetIds]) }) } : {}),
    ...(input.voice ? { voice: Object.freeze({ agreementVersion: input.voice.agreementVersion, assetId: input.voice.assetId }) } : {}) });
}

export function createAgreementMessageService(rpc: Rpc): AgreementMessagePort {
  return {
    async send(input) {
      const command = captureAgreementMessage(input);
      let response, timer: ReturnType<typeof setTimeout> | undefined;
      try {
        const request = command.voice
          ? rpc('rpc_send_agreement_voice_message_v1', { p_expected_user_id: command.accountId, p_agreement_id: command.agreementId,
            p_expected_version: command.voice.agreementVersion, p_client_message_id: command.clientMessageId, p_asset_id: command.voice.assetId })
          : rpc(command.photos ? 'rpc_send_agreement_photo_message_v5' : 'rpc_send_agreement_message_v2', {
            p_expected_user_id: command.accountId, p_agreement_id: command.agreementId,
            p_client_message_id: command.clientMessageId, p_body: command.body,
            ...(command.photos ? { p_expected_version: command.photos.agreementVersion, p_asset_ids: [...command.photos.assetIds] } : {}),
          });
        // A missing receipt is an unknown outcome for either kind of message.
        // The outbox keeps the captured intent for readback or an idempotent retry.
        response = await Promise.race([Promise.resolve(request), new Promise<never>((_, reject) => {
          timer = setTimeout(() => reject(new Error('MESSAGE_RECEIPT_TIMEOUT')), 15000);
        })]);
      } catch { return fail('UNAVAILABLE'); }
      finally { if (timer !== undefined) clearTimeout(timer); }
      if (!object(response)) return fail('INVALID_RESPONSE');
      if (response.error) {
        const error = object(response.error) ? response.error : {};
        if (error.code === '28000') return fail('AUTH_CONTEXT_CHANGED');
        // B24: a conflict the function raises on purpose is PT409 (HTTP 409) since the server stopped using 40001, which PostgREST 14 retries without end; the old code stays accepted.
        if (error.code === '40001' || error.code === 'PT409') return fail('CONFLICT');
        if (error.code === '42501' || error.code === 'P0002') return fail('NOT_AVAILABLE');
        if (error.message === 'CHAT_NOT_AVAILABLE') return fail('READ_ONLY');
        if (error.code === '22001' || error.code === '22023' || error.message === 'MESSAGE_REQUIRED') return fail('INVALID_MESSAGE');
        return fail('UNAVAILABLE');
      }
      if (command.voice) {
        const receipt = response.data;
        if (!object(receipt) || Object.keys(receipt).length !== 5 || typeof receipt.messageId !== 'string' || !exactUuid(receipt.messageId)
          || receipt.agreementId !== command.agreementId || receipt.agreementVersion !== command.voice.agreementVersion
          || receipt.clientMessageId !== command.clientMessageId || receipt.voiceAssetId !== command.voice.assetId) return fail('INVALID_RESPONSE');
        return { messageId: receipt.messageId };
      }
      if (command.photos) {
        const receipt = response.data;
        if (!object(receipt) || Object.keys(receipt).length !== 6 || typeof receipt.messageId !== 'string' || !exactUuid(receipt.messageId)
          || receipt.agreementId !== command.agreementId || receipt.agreementVersion !== command.photos.agreementVersion
          || receipt.clientMessageId !== command.clientMessageId || receipt.body !== command.body || !Array.isArray(receipt.assetIds)
          || receipt.assetIds.length !== command.photos.assetIds.length || receipt.assetIds.some((id, i) => id !== command.photos!.assetIds[i])) return fail('INVALID_RESPONSE');
        return { messageId: receipt.messageId };
      }
      if (typeof response.data !== 'string' || !exactUuid(response.data)) return fail('INVALID_RESPONSE');
      return { messageId: response.data };
    },
  };
}

// Inert until the accepted forward contract is live and the real screen is bound.
export const agreementMessageClientService = createAgreementMessageService(
  (name, args) => supabaseKlijent().rpc(name, args),
);
