import type { Ishod } from './ports';
import { failure, positiveInteger, readReceipt, record, sameId, timestamp, uuid, type ReceiptAccount } from './serverReceipt';
import { decodeNeedUrgency } from './needUrgencyClientService';
import { decodeUrgentPreview, type UrgentPreview } from './urgentActivationPreviewClientService';

export type UrgentActivationReceipt = { needId: string; revision: number; expiresAt: string; idempotentReplay: boolean };
const ERRORS: Readonly<Record<string, string>> = {
  AUTH_REQUIRED: 'Prijavi se da nastaviš.',
  FORBIDDEN: 'HITNO može da uključi samo osoba koja je objavila zadatak.',
  ACCOUNT_CLOSING: 'Nalog je u postupku zatvaranja.',
  NEED_NOT_FOUND: 'Zadatak više nije dostupan.',
  NEED_VERSION_MISMATCH: 'Zadatak je promenjen. Osveži ga i ponovo pregledaj uslove.',
  URGENT_ACTIVATION_NOT_ALLOWED: 'Uslovi za HITNO su promenjeni. Ponovo pregledaj dostupnost.',
};
export const urgentActivationRefused = (code: string) => Object.prototype.hasOwnProperty.call(ERRORS, code);
export const urgentReasonText = (codes: readonly string[]) => {
  const copy: Readonly<Record<string, string>> = {
    URGENT_POLICY_DISABLED: 'HITNO trenutno nije uključen.',
    URGENT_POLICY_VERSION_MISSING: 'Uslovi za HITNO trenutno nisu dostupni.',
    URGENT_CATEGORIES_NOT_ADMITTED: 'Vrste zadataka za HITNO još nisu određene.',
    URGENT_CATEGORY_NOT_ADMITTED: 'HITNO nije dostupan za ovu vrstu zadatka.',
    URGENT_POLICY_BOUNDS_INVALID: 'Uslovi za HITNO trenutno nisu dostupni.',
    NEED_NOT_OPEN: 'HITNO je dostupan samo za otvoren zadatak.',
    URGENT_PHYSICAL_TASK_REQUIRED: 'HITNO je namenjen zadatku koji se obavlja na lokaciji.',
    NEED_RESPONSE_WINDOW_EXPIRED: 'Rok za prijave je istekao.',
    NEED_ALREADY_FILLED: 'Sva mesta su već dogovorena.',
    URGENT_START_ALREADY_PASSED: 'Termin početka je prošao.',
    URGENT_TOO_EARLY: 'Još je rano za HITNO. Približi se terminu početka.',
    URGENT_CURRENT_TIME_WINDOW_REQUIRED: 'HITNO traži aktuelan termin početka.',
    NEED_NOT_FOUND: ERRORS.NEED_NOT_FOUND,
    FORBIDDEN: ERRORS.FORBIDDEN,
  };
  return [...new Set(codes.map(code => copy[code] ?? 'HITNO trenutno nije dostupan za ovaj zadatak.'))].join(' ');
};
export function sameUrgentTerms(a: UrgentPreview, b: UrgentPreview): boolean {
  // candidateExpiresAt moves with the preview clock; it is an estimate, not a reserved deadline.
  return a.allowed && b.allowed && a.policyVersion === b.policyVersion && a.chargesFee === b.chargesFee
    && a.maxLifetimeMinutes === b.maxLifetimeMinutes && a.maxMinutesToStart === b.maxMinutesToStart && a.minChoice === b.minChoice;
}
export const urgentActivationClientService = {
  preview(needId: string, account: ReceiptAccount): Promise<Ishod<UrgentPreview>> {
    if (!uuid(needId)) return Promise.resolve(failure('URGENT_INPUT_INVALID', 'Ponovo otvori zadatak.'));
    return readReceipt({ account, rpc: 'rpc_urgent_activation_preview', args: { p_need_id: needId }, errors: ERRORS,
      fallback: 'URGENT_PREVIEW_UNAVAILABLE', invalid: 'URGENT_PREVIEW_INVALID', decode: decodeUrgentPreview });
  },
  read(needId: string, account: ReceiptAccount) {
    return readReceipt({ account, rpc: 'fn_need_urgency', args: { p_need_id: needId }, errors: ERRORS,
      fallback: 'URGENT_READ_UNAVAILABLE', invalid: 'URGENT_READ_INVALID', decode: raw => decodeNeedUrgency(raw, needId) });
  },
  activate(needId: string, revision: number, account: ReceiptAccount): Promise<Ishod<UrgentActivationReceipt>> {
    if (!uuid(needId) || !positiveInteger(revision)) return Promise.resolve(failure('URGENT_INPUT_INVALID', 'Ponovo otvori zadatak.'));
    return readReceipt({ account, rpc: 'rpc_activate_urgent', args: { p_need_id: needId, p_expected_revision: revision },
      write: true, errors: ERRORS, fallback: 'URGENT_OUTCOME_UNKNOWN', invalid: 'URGENT_RECEIPT_INVALID',
      decode(raw): UrgentActivationReceipt | null {
        const value = record(raw);
        if (!value || value.authoritative !== true || !sameId(value.needId, needId) || value.revision !== revision
            || value.urgent !== true || !timestamp(value.urgentExpiresAt) || typeof value.idempotentReplay !== 'boolean') return null;
        return { needId: value.needId, revision, expiresAt: value.urgentExpiresAt, idempotentReplay: value.idempotentReplay };
      } });
  },
};

