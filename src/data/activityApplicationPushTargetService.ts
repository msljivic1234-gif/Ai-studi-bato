import type { Ishod } from './ports';
import { sesijaSada } from '../store/sesija';
import { failure, readOwnedResult, record, sameId, uuid, type ReceiptAccount } from './serverReceipt';
import { supabaseKlijent } from './supabaseClient';

export type ApplicationPushEventType = 'RESPONSE_RECEIVED' | 'RESPONSE_UPDATED';
export type ActivityApplicationPushTarget =
  | Readonly<{ schema: 'ACTIVITY_APPLICATION_TARGET_V1'; accountId: string; authoritative: true; kind: 'UNAVAILABLE' }>
  | Readonly<{ schema: 'ACTIVITY_APPLICATION_TARGET_V1'; accountId: string; authoritative: true; kind: 'APPLICATION'; eventId: string; eventType: ApplicationPushEventType; needId: string; responseId: string; role: 'REQUESTER' }>;
type Rpc = (name: string, args: Record<string, unknown>, signal: AbortSignal) => PromiseLike<unknown>;
const exact = (value: Record<string, unknown>, fields: readonly string[]) => Object.keys(value).length === fields.length && fields.every(field => Object.hasOwn(value, field));

/** The event UUID is an untrusted provider hint. Only a recipient-bound RPC can name an application. */
export function decodeActivityApplicationPushTarget(raw: unknown, accountId: string, eventId: string, eventType: ApplicationPushEventType): ActivityApplicationPushTarget | null {
  const value = record(raw);
  if (!value || !uuid(accountId) || !uuid(eventId) || value.schema !== 'ACTIVITY_APPLICATION_TARGET_V1'
    || !sameId(value.accountId, accountId) || value.authoritative !== true) return null;
  const envelope = { schema: 'ACTIVITY_APPLICATION_TARGET_V1' as const, accountId: accountId.toLowerCase(), authoritative: true as const };
  if (value.kind === 'UNAVAILABLE') return exact(value, ['schema', 'accountId', 'authoritative', 'kind']) ? { ...envelope, kind: 'UNAVAILABLE' } : null;
  if (value.kind !== 'APPLICATION' || !exact(value, ['schema', 'accountId', 'authoritative', 'kind', 'eventId', 'eventType', 'needId', 'responseId', 'role'])
    || !sameId(value.eventId, eventId) || value.eventType !== eventType || !uuid(value.needId) || !uuid(value.responseId) || value.role !== 'REQUESTER') return null;
  return { ...envelope, kind: 'APPLICATION', eventId: eventId.toLowerCase(), eventType, needId: value.needId.toLowerCase(), responseId: value.responseId.toLowerCase(), role: 'REQUESTER' };
}

export function createActivityApplicationPushTargetService(rpc: Rpc) {
  return {
    async resolve(eventId: string, eventType: ApplicationPushEventType, options: { signal?: AbortSignal } = {}, scope?: ReceiptAccount): Promise<Ishod<ActivityApplicationPushTarget>> {
      const session = sesijaSada();
      const account = scope ?? (session.user ? { accountId: session.user.id, accountRevision: session.accountRevision } : null);
      if (!account || !uuid(account.accountId)) return failure('AUTH_REQUIRED', 'Prijavi se da nastaviš.');
      if (session.user?.id !== account.accountId || session.accountRevision !== account.accountRevision)
        return failure('AUTH_ACCOUNT_CHANGED', 'Nalog je promenjen. Ponovo otvori zadatak.');
      if (!uuid(eventId) || (eventType !== 'RESPONSE_RECEIVED' && eventType !== 'RESPONSE_UPDATED'))
        return failure('ACTIVITY_APPLICATION_INPUT_INVALID', 'Obaveštenje nije dostupno.');
      if (options.signal?.aborted) return failure('ACTIVITY_APPLICATION_CANCELLED', 'Čitanje je prekinuto.');
      const controller = new AbortController();
      let removeAbort = () => {};
      try {
        const result = await readOwnedResult({ account, errors: {}, fallback: 'ACTIVITY_APPLICATION_UNCONFIRMED', invalid: 'ACTIVITY_APPLICATION_INVALID_RESPONSE',
          decode: raw => decodeActivityApplicationPushTarget(raw, account.accountId, eventId, eventType),
          request: () => new Promise<unknown>((resolve, reject) => {
            const abort = () => { controller.abort(); reject(new Error('ACTIVITY_APPLICATION_CANCELLED')); };
            options.signal?.addEventListener('abort', abort, { once: true });
            removeAbort = () => options.signal?.removeEventListener('abort', abort);
            if (options.signal?.aborted) { abort(); return; }
            try {
              Promise.resolve(rpc('rpc_resolve_activity_application_v1',
                { p_expected_user_id: account.accountId, p_event_id: eventId.toLowerCase() }, controller.signal)).then(resolve, reject);
            } catch { reject(new Error('ACTIVITY_APPLICATION_UNCONFIRMED')); }
          }),
        });
        return options.signal?.aborted ? failure('ACTIVITY_APPLICATION_CANCELLED', 'Čitanje je prekinuto.') : result;
      } finally { removeAbort(); controller.abort(); }
    },
  };
}

export const activityApplicationPushTargetService = createActivityApplicationPushTargetService((name, args, signal) =>
  supabaseKlijent().rpc(name, args).abortSignal(signal));
