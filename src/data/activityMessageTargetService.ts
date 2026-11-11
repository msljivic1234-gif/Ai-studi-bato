import { sesijaSada } from '../store/sesija';
import type { Ishod } from './ports';
import { failure, readOwnedResult, record, sameId, uuid as receiptUuid, type ReceiptAccount } from './serverReceipt';
import { supabaseKlijent } from './supabaseClient';

type TargetEnvelope = Readonly<{ schema: 'ACTIVITY_MESSAGE_TARGET_V1'; accountId: string; authoritative: true }>;
export type ActivityMessageTarget = TargetEnvelope & (
  | Readonly<{ kind: 'AGREEMENT_MESSAGE'; eventId: string; agreementId: string; messageId: string; role: 'REQUESTER' | 'WORKER' }>
  | Readonly<{ kind: 'GROUP_MESSAGE'; eventId: string; agreementId: string; groupId: string; messageId: string; sequence: string; role: 'REQUESTER' | 'WORKER' }>
  | Readonly<{ kind: 'UNAVAILABLE' }>
);
export type ActivityMessageTargetOptions = Readonly<{ signal?: AbortSignal }>;

const uuid = (value: unknown): value is string => receiptUuid(value) && value.length === 36;
const exact = (value: Record<string, unknown>, keys: readonly string[]) =>
  Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key));
const errors = {
  AUTH_REQUIRED: 'Prijavi se da nastaviš.',
  AUTH_CONTEXT_CHANGED: 'Nalog je promenjen. Ponovo otvori Dogovor.',
};
const changed = () => failure('AUTH_ACCOUNT_CHANGED', 'Nalog je promenjen. Ponovo otvori Dogovor.');
const cancelled = () => failure('ACTIVITY_MESSAGE_TARGET_CANCELLED', 'Čitanje poruke je prekinuto.');

/** An event is only a hint until this exact, body-free server envelope has been admitted. */
export function decodeActivityMessageTarget(raw: unknown, accountId: string, eventId: string): ActivityMessageTarget | null {
  const value = record(raw);
  if (!value || !uuid(accountId) || !uuid(eventId) || !uuid(value.accountId) || !sameId(value.accountId, accountId)
    || value.schema !== 'ACTIVITY_MESSAGE_TARGET_V1' || value.authoritative !== true) return null;
  const envelope: TargetEnvelope = { schema: 'ACTIVITY_MESSAGE_TARGET_V1', accountId: accountId.toLowerCase(), authoritative: true };
  if (value.kind === 'UNAVAILABLE') return exact(value, ['schema', 'accountId', 'kind', 'authoritative'])
    ? { ...envelope, kind: 'UNAVAILABLE' } : null;
  if (value.kind === 'GROUP_MESSAGE') {
    if (!exact(value, ['schema','accountId','kind','eventId','agreementId','groupId','messageId','sequence','role','authoritative'])
      || !uuid(value.eventId) || !sameId(value.eventId,eventId) || !uuid(value.agreementId) || !uuid(value.groupId) || !uuid(value.messageId)
      || typeof value.sequence !== 'string' || !/^[1-9][0-9]{0,15}$/.test(value.sequence) || Number(value.sequence)>9007199254740990
      || (value.role !== 'REQUESTER' && value.role !== 'WORKER')) return null;
    return {...envelope,kind:'GROUP_MESSAGE',eventId:eventId.toLowerCase(),agreementId:value.agreementId.toLowerCase(),
      groupId:value.groupId.toLowerCase(),messageId:value.messageId.toLowerCase(),sequence:value.sequence,role:value.role};
  }
  if (value.kind !== 'AGREEMENT_MESSAGE' || !exact(value, ['schema', 'accountId', 'kind', 'eventId', 'agreementId', 'messageId', 'role', 'authoritative'])
    || !uuid(value.eventId) || !sameId(value.eventId, eventId) || !uuid(value.agreementId) || !uuid(value.messageId)
    || (value.role !== 'REQUESTER' && value.role !== 'WORKER')) return null;
  return { ...envelope, kind: 'AGREEMENT_MESSAGE', eventId: eventId.toLowerCase(),
    agreementId: value.agreementId.toLowerCase(), messageId: value.messageId.toLowerCase(), role: value.role };
}

function owner(scope?: ReceiptAccount): ReceiptAccount | null {
  const session = sesijaSada(), account = scope ?? (session.user ? { accountId: session.user.id, accountRevision: session.accountRevision } : null);
  return account && uuid(account.accountId) && Number.isSafeInteger(account.accountRevision) && account.accountRevision >= 0
    ? { accountId: account.accountId, accountRevision: account.accountRevision } : null;
}
function current(account: ReceiptAccount): boolean {
  const session = sesijaSada();
  return session.user?.id === account.accountId && session.accountRevision === account.accountRevision;
}
type Rpc = (name: string, args: Record<string, unknown>, signal: AbortSignal) => PromiseLike<unknown>;

/** P4 body-free resolver; callers own navigation. Resolving alone performs no message read or ACK. */
export function createActivityMessageTargetService(rpc: Rpc) {
  return {
    async resolve(eventId: string, options: ActivityMessageTargetOptions = {}, scope?: ReceiptAccount): Promise<Ishod<ActivityMessageTarget>> {
      const account = owner(scope), signal = options.signal;
      if (!account) return failure('AUTH_REQUIRED', errors.AUTH_REQUIRED);
      if (!current(account)) return changed();
      if (!uuid(eventId)) return failure('ACTIVITY_MESSAGE_TARGET_INPUT_INVALID', 'Izabrana poruka nije dostupna.');
      if (signal?.aborted) return cancelled();
      const controller = new AbortController();
      let removeAbort = () => {};
      try {
        const result = await readOwnedResult({ account, errors, fallback: 'ACTIVITY_MESSAGE_TARGET_UNCONFIRMED',
          invalid: 'ACTIVITY_MESSAGE_TARGET_INVALID_RESPONSE', decode: raw => decodeActivityMessageTarget(raw, account.accountId, eventId),
          // The shared receipt reader provides the 15s deadline and before/after account fence. Race caller abort
          // as well: even a transport that ignores AbortSignal must release this abandoned visit immediately.
          request: () => new Promise<unknown>((resolve, reject) => {
            const abort = () => { controller.abort(); reject(new Error('ACTIVITY_MESSAGE_TARGET_CANCELLED')); };
            signal?.addEventListener('abort', abort, { once: true });
            removeAbort = () => signal?.removeEventListener('abort', abort);
            if (signal?.aborted) { abort(); return; }
            try {
              Promise.resolve(rpc('rpc_resolve_activity_message_v1', {
                p_expected_user_id: account.accountId, p_event_id: eventId.toLowerCase(),
              }, controller.signal)).then(resolve, reject);
            } catch { reject(new Error('ACTIVITY_MESSAGE_TARGET_UNCONFIRMED')); }
          }) });
        if (!current(account)) return changed();
        return signal?.aborted ? cancelled() : result;
      } finally {
        removeAbort();
        // Also stop a request abandoned by the deadline; late results have no second consumer or retry.
        controller.abort();
      }
    },
  };
}

export const activityMessageTargetService = createActivityMessageTargetService((name, args, signal) =>
  supabaseKlijent().rpc(name, args).abortSignal(signal));
