import type { Ishod } from './ports';
import { sesijaSada } from '../store/sesija';
import { supabaseKlijent } from './supabaseClient';
import { failure, readOwnedResult, record, sameId, timestamp, uuid, type ReceiptAccount } from './serverReceipt';
import { safetyTargetNameBuilt } from './safetyTargetNameGate';
export const SAFETY_CATEGORIES = ['HARASSMENT', 'FRAUD', 'UNSAFE_WORK', 'DISCRIMINATION', 'OTHER'] as const;
export type SafetyCategory = typeof SAFETY_CATEGORIES[number];
export type AccountBlockState = { accountId: string; targetAccountId: string; blocked: boolean; revision: number; authoritative: true };
export type AccountBlockCommand = { targetAccountId: string; blocked: boolean; expectedRevision: number; clientRequestId: string };
export type AccountBlockReceipt = AccountBlockState & { clientRequestId: string; idempotentReplay: boolean };
export type SafetyReportCommand = { targetAccountId: string; needId: string | null; agreementId: string | null;
  category: SafetyCategory; reason: string; narrative: string; clientRequestId: string };
export type SafetyReportReceipt = { reportId: string; received: true; createdAt: string; clientRequestId: string; idempotentReplay: boolean; authoritative: true };
export type MyBlockedAccounts = { accountId: string; items: Array<AccountBlockState & { displayName: string | null }>; nextCursor: string | null; authoritative: true };
/** PKG-047: the person behind a public profile, so report and block can reach them from a screen that
 *  only ever knew the profile. `available` false is the server's own "this is not a target" — an unknown,
 *  inactive or hidden profile, the caller's own account, or a block in either direction — never an error.
 *  `displayName` (EX-07 S06) is the displayed name of THE profile that was asked for, as the server's result gives it: present only in a build compiled with the
 *  safety-target-name flag and only for an available target, `null` when the server gave no name the screen could draw. It is never read from a route and never logged. */
export type SafetyTargetState = { profileId: string; available: boolean; target: AccountBlockState | null; displayName?: string | null };
export type MySafetyReportCommand = { accountId: string; clientRequestId: string; found: boolean; receipt: SafetyReportReceipt | null; authoritative: true };
const errors: Readonly<Record<string, string>> = {
  AUTH_REQUIRED: 'Prijavi se da nastaviš.',
  BLOCK_INPUT_INVALID: 'Ponovo otvori profil osobe.',
  BLOCK_REVISION_CONFLICT: 'Izbor blokiranja je promenjen. Proveri aktuelno stanje.',
  TARGET_NOT_AVAILABLE: 'Osoba trenutno nije dostupna.',
  REQUEST_ID_REUSED: 'Zahtev je već upotrebljen. Proveri potvrdu prethodne radnje.',
  SAFETY_REPORT_INPUT_INVALID: 'Proveri kategoriju i dužinu privatne prijave.',
  SAFETY_TARGET_INPUT_INVALID: 'Ponovo otvori profil osobe.',
  SAFETY_CONTEXT_NOT_AVAILABLE: 'Ovaj kontekst nije dostupan za prijavu.',
  REPORT_NOT_AVAILABLE: 'Privatna prijava nije dostupna ovom nalogu.',
  INTERACTION_BLOCKED: 'Ova komunikacija trenutno nije dostupna.',
};
const revision = (x: unknown): x is number => typeof x === 'number' && Number.isInteger(x) && x >= 0 && x < 2_147_483_647;
const text = (x: unknown, max: number, required: boolean): x is string => typeof x === 'string' && !x.includes('\0') &&
  (!required || x.trim().length > 0) && [...x.trim()].length <= max && [...x].every(c => { const n = c.codePointAt(0)!; return n < 0xd800 || n > 0xdfff; });
function scope(explicit?: ReceiptAccount): ReceiptAccount | null {
  const s = sesijaSada(); const a = explicit ?? (s.user ? { accountId: s.user.id, accountRevision: s.accountRevision } : null);
  return a && uuid(a.accountId) ? { ...a } : null;
}
function block(raw: unknown, accountId: string, target: string): AccountBlockState | null {
  const r = record(raw);
  if (!r || !sameId(r.accountId, accountId) || !sameId(r.targetAccountId, target) || typeof r.blocked !== 'boolean' ||
      !revision(r.revision) || r.authoritative !== true) return null;
  return { accountId, targetAccountId: target, blocked: r.blocked, revision: r.revision, authoritative: true };
}
/** The name the server gave for the profile that was asked for, or null. A name is a decoration of the safety action, never a condition of it: one the screen could not
 *  draw safely (blank, over 200 characters, a control character, a lone surrogate) is null, and never a reason to refuse the target. */
function shownName(value: unknown): string | null {
  if (!text(value, 200, true)) return null;
  const name = value.trim();
  return /[\u0000-\u001f\u007f-\u009f]/.test(name) ? null : name;
}
function bad<T>(name: keyof typeof errors): Promise<Ishod<T>> { return Promise.resolve(failure(name, errors[name])); }
function reportReceipt(raw: unknown, requestId: string): SafetyReportReceipt | null {
  const r = record(raw);
  if (!r || !uuid(r.reportId) || r.received !== true || !timestamp(r.createdAt) || !sameId(r.clientRequestId, requestId) ||
      typeof r.idempotentReplay !== 'boolean' || r.authoritative !== true) return null;
  return { reportId: r.reportId, received: true, createdAt: r.createdAt, clientRequestId: requestId,
    idempotentReplay: r.idempotentReplay, authoritative: true };
}
/** Private report and outgoing block choice only. No narrative readback to a target,
 * incoming-block disclosure, UI optimism, automatic retry, or Agreement recovery writer. */
export const safetyClientService = {
  listMyBlocks(after: string | null = null, explicit?: ReceiptAccount): Promise<Ishod<MyBlockedAccounts>> {
    const account = scope(explicit); if (!account) return bad('AUTH_REQUIRED');
    if (after !== null && !uuid(after)) return bad('BLOCK_INPUT_INVALID');
    return readOwnedResult({ account, request: () => supabaseKlijent().rpc('rpc_list_my_account_blocks', { p_after: after }),
      errors, fallback: 'BLOCK_READ_UNAVAILABLE', invalid: 'BLOCK_INVALID_RECEIPT', decode: raw => {
        const r = record(raw);
        if (!r || !sameId(r.accountId, account.accountId) || r.authoritative !== true || !Array.isArray(r.items) || r.items.length > 50 ||
            (r.nextCursor !== null && !uuid(r.nextCursor))) return null;
        const items: MyBlockedAccounts['items'] = [];
        let previous = after?.toLowerCase() ?? '';
        for (const value of r.items) {
          const row = record(value); if (!row || !uuid(row.targetAccountId) || sameId(row.targetAccountId, account.accountId)) return null;
          const state = block(row, account.accountId, row.targetAccountId);
          if (!state || !state.blocked || state.revision < 1 || state.targetAccountId.toLowerCase() <= previous ||
              (row.displayName !== null && (typeof row.displayName !== 'string' || row.displayName.length > 200))) return null;
          previous = state.targetAccountId.toLowerCase(); items.push({ ...state, displayName: row.displayName as string | null });
        }
        if (r.nextCursor !== null && (items.length !== 50 || !sameId(r.nextCursor, previous))) return null;
        return { accountId: account.accountId, items, nextCursor: r.nextCursor, authoritative: true };
      } });
  },
  readTarget(profileId: string, explicit?: ReceiptAccount): Promise<Ishod<SafetyTargetState>> {
    const account = scope(explicit); if (!account) return bad('AUTH_REQUIRED');
    if (!uuid(profileId)) return bad('BLOCK_INPUT_INVALID');
    return readOwnedResult({ account, request: () => supabaseKlijent().rpc('rpc_read_safety_target', { p_profile_id: profileId }),
      errors, fallback: 'SAFETY_TARGET_READ_UNAVAILABLE', invalid: 'SAFETY_TARGET_INVALID_RECEIPT', decode: raw => {
        // A hidden profile is a legitimate answer, not a broken receipt.
        if (raw === null) return { profileId, available: false, target: null };
        const r = record(raw);
        if (!r || !sameId(r.profileId, profileId) || typeof r.targetAccountId !== 'string' || !uuid(r.targetAccountId) ||
            sameId(r.targetAccountId, account.accountId)) return null;
        const target = block(r, account.accountId, r.targetAccountId);
        if (!target) return null;
        const state: SafetyTargetState = { profileId, available: true, target };
        // EX-07 S06: only a build compiled with the flag looks at the name; without it the receipt is exactly what it always was.
        if (safetyTargetNameBuilt()) state.displayName = shownName(r.displayName);
        return state;
      } });
  },
  readReportCommand(requestId: string, explicit?: ReceiptAccount): Promise<Ishod<MySafetyReportCommand>> {
    const account = scope(explicit); if (!account) return bad('AUTH_REQUIRED');
    if (!uuid(requestId)) return bad('SAFETY_REPORT_INPUT_INVALID');
    return readOwnedResult({ account, request: () => supabaseKlijent().rpc('rpc_read_my_safety_report_command', { p_client_request_id: requestId }),
      errors, fallback: 'SAFETY_REPORT_READ_UNAVAILABLE', invalid: 'SAFETY_REPORT_INVALID_RECEIPT', decode: raw => {
        const r = record(raw);
        if (!r || !sameId(r.accountId, account.accountId) || !sameId(r.clientRequestId, requestId) || r.authoritative !== true || typeof r.found !== 'boolean') return null;
        const receipt = r.found ? reportReceipt(r.receipt, requestId) : null;
        if (r.found ? !receipt : r.receipt !== null) return null;
        return { accountId: account.accountId, clientRequestId: requestId, found: r.found, receipt, authoritative: true };
      } });
  },
  readBlock(target: string, explicit?: ReceiptAccount): Promise<Ishod<AccountBlockState>> {
    const account = scope(explicit); if (!account) return bad('AUTH_REQUIRED');
    if (!uuid(target) || sameId(target, account.accountId)) return bad('BLOCK_INPUT_INVALID');
    return readOwnedResult({ account, request: () => supabaseKlijent().rpc('rpc_get_account_block', { p_target_account_id: target }),
      decode: raw => block(raw, account.accountId, target), errors, fallback: 'BLOCK_READ_UNAVAILABLE', invalid: 'BLOCK_INVALID_RECEIPT' });
  },
  setBlock(input: AccountBlockCommand, explicit?: ReceiptAccount): Promise<Ishod<AccountBlockReceipt>> {
    const account = scope(explicit); if (!account) return bad('AUTH_REQUIRED');
    if (!input || !uuid(input.targetAccountId) || sameId(input.targetAccountId, account.accountId) || !uuid(input.clientRequestId) ||
        typeof input.blocked !== 'boolean' || !revision(input.expectedRevision) || input.expectedRevision >= 2_147_483_646) return bad('BLOCK_INPUT_INVALID');
    const args = { p_target_account_id: input.targetAccountId, p_blocked: input.blocked, p_expected_revision: input.expectedRevision, p_client_request_id: input.clientRequestId };
    return readOwnedResult({ account, write: true, request: () => supabaseKlijent().rpc('rpc_set_account_block', args),
      errors, fallback: 'BLOCK_OUTCOME_UNKNOWN', invalid: 'BLOCK_INVALID_RECEIPT', decode: raw => {
        const r = record(raw), state = block(raw, account.accountId, args.p_target_account_id);
        if (!state || !r || !sameId(r.clientRequestId, args.p_client_request_id) || typeof r.idempotentReplay !== 'boolean' ||
            state.revision !== args.p_expected_revision + 1 || state.blocked !== args.p_blocked) return null;
        return { ...state, clientRequestId: args.p_client_request_id, idempotentReplay: r.idempotentReplay };
      } });
  },
  report(input: SafetyReportCommand, explicit?: ReceiptAccount): Promise<Ishod<SafetyReportReceipt>> {
    const account = scope(explicit); if (!account) return bad('AUTH_REQUIRED');
    if (!input || !uuid(input.targetAccountId) || sameId(input.targetAccountId, account.accountId) || !uuid(input.clientRequestId) ||
        (input.needId !== null && !uuid(input.needId)) || (input.agreementId !== null && !uuid(input.agreementId)) ||
        !SAFETY_CATEGORIES.includes(input.category) || !text(input.reason, 200, true) || !text(input.narrative, 2000, false)) return bad('SAFETY_REPORT_INPUT_INVALID');
    const args = { p_target_account_id: input.targetAccountId, p_need_id: input.needId, p_agreement_id: input.agreementId,
      p_category: input.category, p_reason: input.reason.trim(), p_narrative: input.narrative.trim(), p_client_request_id: input.clientRequestId };
    return readOwnedResult({ account, write: true, request: () => supabaseKlijent().rpc('rpc_submit_safety_report', args), errors,
      fallback: 'SAFETY_REPORT_OUTCOME_UNKNOWN', invalid: 'SAFETY_REPORT_INVALID_RECEIPT', decode: raw => {
        return reportReceipt(raw, args.p_client_request_id);
      } });
  },
};
