import { sesijaSada } from '../store/sesija';
import type { Ishod } from './ports';
import { failure, readOwnedResult, record, sameId, uuid, type ReceiptAccount } from './serverReceipt';
import { supabaseKlijent } from './supabaseClient';

type EventReader = (eventId: string, accountId: string, signal: AbortSignal) => PromiseLike<unknown>;
type ApplicationEvent = Readonly<{ responseId: string }>;

/** The owned event is only a second read after rpc_resolve_activity_event confirmed this Need. */
export function decodeOwnedApplicationEvent(raw: unknown, eventId: string, needId: string, accountId: string): ApplicationEvent | null {
  const event = record(raw), payload = record(event?.payload);
  if (!event || !payload || !sameId(event.id, eventId) || !sameId(event.recipient_user_id, accountId)
    || event.recipient_role !== 'REQUESTER' || !['RESPONSE_RECEIVED', 'RESPONSE_UPDATED'].includes(String(event.event_type))
    || event.entity_type !== 'RESPONSE' || !uuid(event.entity_id) || !sameId(payload.responseId, event.entity_id)
    || !sameId(payload.needId, needId)) return null;
  return { responseId: event.entity_id.toLowerCase() };
}

export function createActivityApplicationTargetService(readEvent: EventReader) {
  return {
    async resolve(eventId: string, needId: string, signal: AbortSignal, scope: ReceiptAccount): Promise<Ishod<ApplicationEvent>> {
      if (!uuid(eventId) || !uuid(needId) || !uuid(scope.accountId))
        return failure('ACTIVITY_APPLICATION_TARGET_INPUT_INVALID', 'Prijava nije dostupna.');
      const current = () => sesijaSada().user?.id === scope.accountId
        && sesijaSada().accountRevision === scope.accountRevision;
      if (!current()) return failure('AUTH_ACCOUNT_CHANGED', 'Nalog je promenjen.');
      if (signal.aborted) return failure('ACTIVITY_APPLICATION_TARGET_CANCELLED', 'Čitanje je prekinuto.');
      const controller = new AbortController();
      let removeAbort = () => {};
      try {
        const result = await readOwnedResult({ account: scope, errors: {},
          fallback: 'ACTIVITY_APPLICATION_TARGET_UNCONFIRMED', invalid: 'ACTIVITY_APPLICATION_TARGET_INVALID',
          decode: raw => decodeOwnedApplicationEvent(raw, eventId, needId, scope.accountId),
          request: () => new Promise<unknown>((resolve, reject) => {
            const abort = () => { controller.abort(); reject(new Error('ACTIVITY_APPLICATION_TARGET_CANCELLED')); };
            signal.addEventListener('abort', abort, { once: true });
            removeAbort = () => signal.removeEventListener('abort', abort);
            if (signal.aborted) { abort(); return; }
            try { Promise.resolve(readEvent(eventId.toLowerCase(), scope.accountId, controller.signal)).then(resolve, reject); }
            catch { reject(new Error('ACTIVITY_APPLICATION_TARGET_UNCONFIRMED')); }
          }),
        });
        return !current() ? failure('AUTH_ACCOUNT_CHANGED', 'Nalog je promenjen.')
          : signal.aborted ? failure('ACTIVITY_APPLICATION_TARGET_CANCELLED', 'Čitanje je prekinuto.') : result;
      } finally { removeAbort(); controller.abort(); }
    },
  };
}

export const activityApplicationTargetService = createActivityApplicationTargetService((eventId, accountId, signal) =>
  supabaseKlijent().from('user_activity_events')
    .select('id,recipient_user_id,recipient_role,event_type,entity_type,entity_id,payload')
    .eq('id', eventId).eq('recipient_user_id', accountId).abortSignal(signal).maybeSingle());
