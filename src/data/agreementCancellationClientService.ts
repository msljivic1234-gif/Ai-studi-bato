import { calendarInstant } from '../lib/calendarTime';
import { readReceipt, failure, record, timestamp, uuid, type ReceiptAccount } from './serverReceipt';
import type { Ishod } from './ports';

/**
 * CANCEL-INFO (server applied to canonical DEV 2026-10-07, ledger 229): when, by which side and why a Dogovor was cancelled.
 *
 * There is no cancellation record on the server. `rpc_agreement_cancellation_v1(uuid[])` reads back what the one writer
 * (`rpc_cancel_agreement`) already leaves behind - the status and its instant, the event sent to the other side, the canceller's
 * own reason message in the conversation - and answers each of up to 100 Dogovori of the caller's. A Dogovor that is not the
 * caller's (or does not exist) is LEFT OUT of the answer without an error, and an open one is answered with `cancelled: false`
 * and every other fact null. So this service returns only the Dogovori that are cancelled; for any other id there is simply
 * nothing to say, and a screen then says nothing: it never guesses a side, a time or a reason.
 *
 * Why a separate read and not a field of the Dogovor lists: the list and workspace readers are pinned by other open work, and an
 * old client cannot be affected by a function it never calls (`supabase/candidates/cancel-info-20261007/README.md`).
 *
 * The reason is the canceller's own chat message, which both sides already read in Poruke, so nothing beyond the Dogovor is
 * disclosed. `reasonState` says what became of it: KEPT (it is here), NOT_KEPT (the pair was blocked, or an account was closing,
 * when the Dogovor was cancelled, so the reason message never existed) and REMOVED (its text was erased when an account closed).
 */

/** The role of the canceller in that Dogovor. */
export type CancellationSide = 'REQUESTER' | 'WORKER';
export type CancellationReasonState = 'KEPT' | 'NOT_KEPT' | 'REMOVED';

export type AgreementCancellation = Readonly<{
  agreementId: string;
  /** The instant the server stamped when the Dogovor was cancelled. */
  cancelledAt: string;
  /** Who cancelled, as a role; null when the server no longer has the fact (never guessed). */
  by: CancellationSide | null;
  /** The caller is the one who cancelled; null together with `by`. */
  byMe: boolean | null;
  /** The reason as the canceller wrote it. Only with `reasonState` KEPT. */
  reason: string | null;
  reasonState: CancellationReasonState;
}>;

/** The server answers 1 to 100 ids in one call. */
export const CANCELLATION_BATCH = 100;
const SCHEMA = 'AGREEMENT_CANCELLATION_V1';
const ITEM_KEYS = ['agreementId', 'cancelled', 'cancelledAt', 'cancelledBy', 'cancelledByMe', 'reason', 'reasonState'] as const;
const ENVELOPE_KEYS = ['schema', 'items', 'asOf', 'authoritative'] as const;

/** A time the app's own strict reader accepts: a real calendar instant (the platform parser lets 30 February through). */
const instant = (value: unknown): value is string => timestamp(value) && calendarInstant(value) !== null;
const exactKeys = (row: Record<string, unknown>, keys: readonly string[]) =>
  Object.keys(row).length === keys.length && keys.every(key => Object.prototype.hasOwnProperty.call(row, key));

/** The refusals the function names. Only these leave this module as words; anything else is an unconfirmed read. */
const errors = {
  AUTH_REQUIRED: 'Prijavite se da nastavite.',
  ACCOUNT_CLOSING: 'Ovo ne možete da vidite dok se Vaš nalog zatvara.',
  INVALID_AGREEMENT_IDS: 'Dogovori nisu dostupni. Osvežite ekran.',
};

/** Keys of the answer are the lower-case ids, so a lookup does not depend on how an id was spelled. */
export type AgreementCancellations = ReadonlyMap<string, AgreementCancellation>;
export const cancellationOf = (all: AgreementCancellations | null | undefined, agreementId: string): AgreementCancellation | null =>
  all?.get(agreementId.toLowerCase()) ?? null;

/**
 * One answer, validated against the ids that were asked. Strict on purpose, like every receipt of this app: a wrong schema, an
 * answer that is not authoritative, an id that was not asked (or twice), a time that is not a time, a side without its "mine",
 * or a reason that does not agree with its state is a malformed answer - null - and never a half-trusted line. Returns the
 * cancelled Dogovori only.
 */
export function decodeAgreementCancellations(raw: unknown, asked: readonly string[]): Map<string, AgreementCancellation> | null {
  const answer = record(raw);
  if (!answer || !exactKeys(answer, ENVELOPE_KEYS) || answer.schema !== SCHEMA || answer.authoritative !== true
    || !instant(answer.asOf) || !Array.isArray(answer.items)) return null;
  const wanted = new Set(asked.map(id => id.toLowerCase())), seen = new Set<string>(), found = new Map<string, AgreementCancellation>();
  for (const value of answer.items) {
    const item = record(value);
    if (!item || !exactKeys(item, ITEM_KEYS) || !uuid(item.agreementId) || typeof item.cancelled !== 'boolean') return null;
    const id = item.agreementId.toLowerCase();
    if (!wanted.has(id) || seen.has(id)) return null;
    seen.add(id);
    if (!item.cancelled) {
      // An open Dogovor says nothing: all five facts are null.
      if (item.cancelledAt !== null || item.cancelledBy !== null || item.cancelledByMe !== null || item.reason !== null || item.reasonState !== null) return null;
      continue;
    }
    const { cancelledBy: by, cancelledByMe: byMe, reason, reasonState: state } = item;
    if (!instant(item.cancelledAt)) return null;
    if (by !== 'REQUESTER' && by !== 'WORKER' && by !== null) return null;
    // The side and "that side is me" are known together or not at all.
    if ((by === null) !== (byMe === null) || (byMe !== null && typeof byMe !== 'boolean')) return null;
    if (state !== 'KEPT' && state !== 'NOT_KEPT' && state !== 'REMOVED') return null;
    // A reason is there exactly when it was kept, and then it is words.
    if (state === 'KEPT' ? typeof reason !== 'string' || !reason.trim() : reason !== null) return null;
    found.set(id, { agreementId: item.agreementId, cancelledAt: item.cancelledAt, by, byMe, reasonState: state, reason: state === 'KEPT' ? (reason as string).trim() : null });
  }
  return found;
}

/**
 * The cancellations of the given Dogovori, one call per hundred. The ids are the caller's own list; each is asked once. A
 * failure anywhere is a failure of the whole read, and the screen then draws what it always drew: "Otkazan", and no line. Nothing
 * is cached and nothing is written.
 */
export const agreementCancellationService = {
  async read(agreementIds: readonly string[], account?: ReceiptAccount): Promise<Ishod<AgreementCancellations>> {
    if (!Array.isArray(agreementIds) || !agreementIds.every(uuid)) return failure('CANCELLATION_INVALID_IDS', errors.INVALID_AGREEMENT_IDS);
    const ids = [...new Set(agreementIds.map(id => id.toLowerCase()))];
    const all = new Map<string, AgreementCancellation>();
    for (let from = 0; from < ids.length; from += CANCELLATION_BATCH) {
      const batch = ids.slice(from, from + CANCELLATION_BATCH);
      const result = await readReceipt({ account, rpc: 'rpc_agreement_cancellation_v1', args: { p_agreement_ids: batch },
        errors, fallback: 'CANCELLATION_READ_FAILED', invalid: 'CANCELLATION_READ_INVALID',
        decode: raw => decodeAgreementCancellations(raw, batch) });
      if (!result.ok) return result;
      for (const [id, cancellation] of result.podatak) all.set(id, cancellation);
    }
    return { ok: true, podatak: all };
  },
};
