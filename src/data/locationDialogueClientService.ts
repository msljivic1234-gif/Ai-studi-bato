import { AI_CREDITS_UNAVAILABLE, AI_CREDITS_UNAVAILABLE_COPY, AI_DIAGNOSTICS_HEADER, AI_DIAGNOSTICS_VERSION } from '../contracts/aiAvailability';
import { aiAvailabilityFromSdkError } from './aiNeedTurnStream';
import type { LocationDialogueRequest, LocationDialogueResult } from '../contracts/locationDialogue';
import { parseLocationDialogueContext, parseLocationDialogueReceipt } from '../contracts/locationDialogue';
import { decodeAiNeedTurnStatus } from './aiNeedV2Production';
import type { Ishod } from './ports';
import { failure, readOwnedResult, record, uuid } from './serverReceipt';
import { sesijaSada } from '../store/sesija';
import { supabaseKlijent } from './supabaseClient';

/** Enable only with the matching, explicitly applied server package. */
export const locationDialogueEnabled = (): boolean => process.env.EXPO_PUBLIC_AI_LOCATION_DIALOGUE === '1';

export async function resolveLocationDialogue(
  request: LocationDialogueRequest,
  options: { signal?: AbortSignal; isCurrent?: () => boolean } = {},
): Promise<Ishod<LocationDialogueResult>> {
  if (!locationDialogueEnabled()) return failure('LOCATION_DIALOGUE_DISABLED', 'Lokaciju potvrdi na mapi.');
  const context = parseLocationDialogueContext(request.locationContext);
  const text = typeof request.text === 'string' ? request.text.trim() : '';
  if (request.mode !== 'locationReply' || !uuid(request.conversationId) || !uuid(request.clientRequestId) || !context
    || !text || Array.from(text).length > 4000 || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(text)) {
    return failure('LOCATION_DIALOGUE_INVALID', 'Ponovo proveri lokaciju i poruku.');
  }
  const owner = sesijaSada();
  if (!owner.user?.id) return failure('AUTH_REQUIRED', 'Prijavi se da nastaviš.');
  const account = { accountId: owner.user.id, accountRevision: owner.accountRevision };
  const body: LocationDialogueRequest = { mode: 'locationReply', conversationId: request.conversationId,
    clientRequestId: request.clientRequestId, text, locationContext: context };
  // The existing Edge body limit is measured in UTF-8 bytes, not JS characters.
  let bytes = 0;
  for (const character of JSON.stringify(body)) {
    const code = character.codePointAt(0)!;
    bytes += code <= 0x7f ? 1 : code <= 0x7ff ? 2 : code <= 0xffff ? 3 : 4;
  }
  if (bytes > 18_000) return failure('LOCATION_DIALOGUE_TOO_LONG', 'Skrati poruku o lokaciji pa pokušaj ponovo.');
  const controller = new AbortController();
  const current = () => !controller.signal.aborted && !options.signal?.aborted && (options.isCurrent?.() ?? true)
    && sesijaSada().user?.id === account.accountId && sesijaSada().accountRevision === account.accountRevision;
  const cancelled = () => failure('LOCATION_DIALOGUE_INTERRUPTED', 'Obrada je prekinuta. Proveri ishod poruke pre ponavljanja.');
  const abort = () => controller.abort();
  if (!current()) return cancelled();
  options.signal?.addEventListener('abort', abort, { once: true });
  const timer = setTimeout(abort, 55_000);
  try {
    const result = await readOwnedResult<LocationDialogueResult>({ account, write: true, timeoutMs: 55_000,
      errors: { [AI_CREDITS_UNAVAILABLE]: AI_CREDITS_UNAVAILABLE_COPY }, fallback: 'AI_TURN_SEND_UNCONFIRMED', invalid: 'AI_TURN_INVALID_RESPONSE',
      request: async () => {
        if (!current()) return { data: null, error: { message: 'LOCATION_DIALOGUE_INTERRUPTED' } };
        const response = await supabaseKlijent().functions.invoke('uskoci-ai-interview', {
          body, signal: controller.signal, headers: { Accept: 'application/json', [AI_DIAGNOSTICS_HEADER]: AI_DIAGNOSTICS_VERSION },
        });
        if (!current()) return { data: null, error: { message: 'LOCATION_DIALOGUE_INTERRUPTED' } };
        const availability = response.error ? aiAvailabilityFromSdkError(response.error) : null;
        return availability ? { data: null, error: { message: availability } } : response;
      },
      decode: raw => {
        if (!current()) return null;
        const value = record(raw);
        if (!value || Object.keys(value).length !== 2 || !Object.hasOwn(value, 'turn') || !Object.hasOwn(value, 'location')) return null;
        const turn = decodeAiNeedTurnStatus(value.turn, body.conversationId, body.clientRequestId);
        if (!turn) return null;
        if (turn.state !== 'SUCCEEDED') return value.location === null ? { turn, location: null } : null;
        const location = parseLocationDialogueReceipt(value.location, context);
        if (!location || (location.action === 'CONFIRM_DISPLAYED' && (turn.receipt.proposedCount !== 0 || turn.receipt.safety !== 'ALLOW'))) return null;
        return { turn, location };
      },
    });
    return current() ? result : cancelled();
  } finally {
    clearTimeout(timer);
    options.signal?.removeEventListener('abort', abort);
    controller.abort();
  }
}
