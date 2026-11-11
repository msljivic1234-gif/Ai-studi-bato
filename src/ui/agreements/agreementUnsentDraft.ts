import type { AgreementActionForm } from './AgreementActionsPresentation';

/** Unsent editor input only; no command, signed review, request id, agreement snapshot or journal.
 * One account/Agreement incarnation at a time, held in process RAM, never AsyncStorage.
 */
export type AgreementUnsentFields = Pick<AgreementActionForm,
  'kind' | 'price' | 'scope' | 'reason' | 'zone' | 'startDate' | 'startTime' | 'endDate' | 'endTime' |
  'priceChanged' | 'scopeChanged' | 'startChanged' | 'endChanged'>;
export type AgreementUnsentDraft = { agreementVersion: number; form: AgreementUnsentFields };
let cached: { scope: string; value: AgreementUnsentDraft } | null = null;
export const agreementUnsentDraftScope = (accountId: string, accountRevision: number, agreementId: string) =>
  JSON.stringify([accountId, accountRevision, agreementId]);
export function readAgreementUnsentDraft(scope: string): AgreementUnsentDraft | null {
  if (cached && cached.scope !== scope) cached = null;
  return cached ? { agreementVersion: cached.value.agreementVersion, form: { ...cached.value.form } } : null;
}
export function rememberAgreementUnsentDraft(scope: string, agreementVersion: number, form: AgreementActionForm): void {
  if (form.reentry || !Number.isSafeInteger(agreementVersion) || agreementVersion < 1) return;
  const { kind, price, scope: note, reason, zone, startDate, startTime, endDate, endTime,
    priceChanged, scopeChanged, startChanged, endChanged } = form;
  if ([price, note, reason, zone, startDate, startTime, endDate, endTime].some(v => v.length > 4000)) return;
  cached = { scope, value: { agreementVersion, form: { kind, price, scope: note, reason, zone, startDate, startTime,
    endDate, endTime, priceChanged, scopeChanged, startChanged, endChanged } } };
}
export function clearAgreementUnsentDraft(scope?: string): void {
  if (scope === undefined || cached?.scope === scope) cached = null;
}
