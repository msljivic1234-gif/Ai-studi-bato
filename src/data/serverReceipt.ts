import type { Ishod } from './ports';
import { calendarInstant } from '../lib/calendarTime';
import { sesijaSada } from '../store/sesija';
import { supabaseKlijent } from './supabaseClient';

export function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
}
export function uuid(value: unknown): value is string {
  return typeof value === 'string' && /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(value);
}
export function positiveInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0 && value <= 2_147_483_647;
}
export function sameId(value: unknown, expected: string): value is string {
  return uuid(value) && value.toLowerCase() === expected.toLowerCase();
}
/** An RPC instant must be real Gregorian civil time, not Date.parse's
 * normalized result for February 30 or an impossible zone offset. */
export function timestamp(value: unknown): value is string {
  return typeof value === 'string' && calendarInstant(value) !== null;
}
export function failure(kod: string, poruka: string): Ishod<never> { return { ok: false, kod, poruka }; }

export type ReceiptOptions<T> = {
  decode: (raw: unknown) => T | null;
  errors: Readonly<Record<string, string>>;
  fallback: string;
  invalid: string;
  write?: boolean;
  /** Closed opt-in for read-only local timeout / SDK no-response; never classifies server rejection. */
  readTransportUnavailable?: string;
};
export type ReceiptAccount = { accountId: string; accountRevision: number };

/** RPC wrapper retains the same server authority and receipt validation. */
export function readReceipt<T>(options: ReceiptOptions<T> & {
  account?: ReceiptAccount;
  rpc: string;
  args: Record<string, unknown>;
}): Promise<Ishod<T>> {
  return readOwnedResult({ ...options, request: () => supabaseKlijent().rpc(options.rpc, options.args) });
}

/** Shared Auth/REST/RPC result fence; not a second business writer. An explicit
 * scope keeps every stage of a multi-request command bound to its original user. */
export async function readOwnedResult<T>(options: ReceiptOptions<T> & {
  /** Forward this signal through transport AND response-body reads. The receipt owner bounds the whole request. */
  request: (signal: AbortSignal) => PromiseLike<unknown>;
  account?: ReceiptAccount;
  signal?: AbortSignal;
  /** Voice binary reads may take 30 seconds; AI/upload calls opt into 55. Ordinary RPCs retain 15 seconds. */
  timeoutMs?: 30_000 | 55_000;
}): Promise<Ishod<T>> {
  const owner = sesijaSada();
  const accountId = options.account?.accountId ?? owner.user?.id;
  const accountRevision = options.account?.accountRevision ?? owner.accountRevision;
  if (!accountId) return failure('AUTH_REQUIRED', 'Prijavite se da nastavite.');
  const current = () => sesijaSada().user?.id === accountId && sesijaSada().accountRevision === accountRevision;
  const changed = () => failure('AUTH_ACCOUNT_CHANGED', 'Nalog je promenjen. Ponovo otvorite prikaz.');
  const unconfirmed = () => failure(options.fallback, options.write
    ? 'Ishod radnje nije potvrđen. Osvežite prikaz pre ponovnog pokušaja.'
    : 'Podaci trenutno nisu dostupni. Pokušajte ponovo da ih učitate.');
  if (!current()) return changed();
  const localTimeout = new Error('RPC_RECEIPT_TIMEOUT');
  const localCancelled = new Error('RPC_RECEIPT_CANCELLED');
  const transportUnavailable = () => !options.write && options.readTransportUnavailable
    ? failure(options.readTransportUnavailable, 'Veza je prekinuta. Pokušajte ponovo.') : unconfirmed();
  if (options.signal?.aborted) return unconfirmed();
  const controller = new AbortController();
  let rejectCancelled: (reason: Error) => void = () => {};
  const cancelled = new Promise<never>((_resolve, reject) => { rejectCancelled = reject; });
  // Observe cancellation before dispatch: a request may synchronously abort and
  // throw before Promise.race is installed. Race the original rejected promise,
  // not this observer, so cancellation still settles the owned operation.
  void cancelled.catch(() => {});
  const cancel = (reason: Error) => {
    if (controller.signal.aborted) return;
    // Settle even when the native transport ignores abort. A dispatched write remains unknown, never replayable merely due to cancellation.
    rejectCancelled(reason);
    controller.abort();
  };
  const abort = () => cancel(localCancelled);
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    options.signal?.addEventListener('abort', abort);
    timer = setTimeout(() => cancel(localTimeout), options.timeoutMs ?? 15_000);
    // No automatic write replay. Aborting local transport does not establish server rollback.
    // Retain synchronous dispatch and the existing native-Promise resolution
    // timing; an extra adopting Promise delays chained Auth/read commands.
    const response: unknown = await Promise.race([Promise.resolve(options.request(controller.signal)), cancelled]);
    if (!current()) return changed();
    if (controller.signal.aborted) return unconfirmed();
    const result = record(response);
    if (!result || !Object.prototype.hasOwnProperty.call(result, 'error')) return unconfirmed();
    if (result.error !== null) {
      const error = record(result.error);
      const name = error?.message;
      // Never turn arbitrary backend/provider text into a public code or message.
      if (typeof name === 'string' && Object.prototype.hasOwnProperty.call(options.errors, name)) return failure(name, options.errors[name]);
      // PostgREST's own no-response sentinel. HTTP/auth/server errors keep the generic fail-closed path.
      if (result.status === 0 && result.data === null && error?.code === '') return transportUnavailable();
      return unconfirmed();
    }
    const decoded = options.decode(result.data);
    if (decoded === null) return failure(options.invalid, options.write
      ? 'Potvrda radnje nije stigla cela. Osvežite prikaz pre ponovnog pokušaja.'
      : 'Podaci nisu stigli u ispravnom obliku. Pokušajte ponovo.');
    return { ok: true, podatak: decoded };
  } catch (error) {
    if (!current()) return changed();
    return error === localTimeout ? transportUnavailable() : unconfirmed();
  } finally {
    if (timer !== undefined) clearTimeout(timer);
    options.signal?.removeEventListener('abort', abort);
  }
}
