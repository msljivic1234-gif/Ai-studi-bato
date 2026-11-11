import type { Ishod } from './ports';
import { sesijaSada } from '../store/sesija';
import { supabaseKlijent } from './supabaseClient';
import { failure, readOwnedResult, record, sameId, timestamp, uuid, type ReceiptAccount } from './serverReceipt';

const CLOSURE_BLOCKERS = ['ACTIVE_AGREEMENT', 'OPEN_TASK', 'ACTIVE_APPLICATION', 'PENDING_WORKFLOW', 'RETENTION_HOLD'] as const;
const CLOSURE_NOT_READY_REASONS = ['LEGAL_POLICY_NOT_READY', 'RETENTION_POLICY_NOT_READY', 'CLOSURE_EXECUTION_NOT_READY'] as const;
export type ClosureBlocker = typeof CLOSURE_BLOCKERS[number];
export type ClosureNotReadyReason = typeof CLOSURE_NOT_READY_REASONS[number];
export type ClosurePreparation = {
  observedAt: string; blockers: readonly ClosureBlocker[]; notReadyReasons: readonly ClosureNotReadyReason[];
  legalReady: boolean; retentionReady: boolean; executionReady: false; authClosureReady: false; mediaCleanupReady: false;
};
/** This source admits preparation only. A future policy-bound executor must add
 * its own validated terminal receipts; these types never invent READY/CLOSED. */
export type ClosureRequest = {
  accountId: string; requestId: string; state: 'BLOCKED' | 'NOT_READY'; revision: number;
  requestedAt: string; preparedAt: string; preparation: ClosurePreparation;
  restricted: false; canExecute: false; authoritative: true;
};
export type ClosureReceipt = ClosureRequest & { clientRequestId: string; idempotentReplay: boolean };
export type ClosureStatus = { accountId: string; request: ClosureRequest | null; revision: number;
  restricted: false; canExecute: false; authoritative: true };
export type ClosureCommand = { expectedRevision: number; clientRequestId: string };
export type ClosureReceiptLookup = { accountId: string; clientRequestId: string; found: boolean;
  receipt: ClosureReceipt | null; authoritative: true };
const errors: Readonly<Record<string, string>> = {
  AUTH_REQUIRED: 'Prijavi se da nastaviš.',
  AUTH_CONTEXT_CHANGED: 'Nalog je promenjen. Ponovo otvori podešavanja naloga.',
  CLOSURE_INPUT_INVALID: 'Zahtev nije potpun. Osveži stanje naloga.',
  CLOSURE_REVISION_CONFLICT: 'Stanje naloga se promenilo. Proveri ga pre novog zahteva.',
  REQUEST_ID_REUSED: 'Ovaj zahtev je već upotrebljen. Proveri njegovu postojeću potvrdu.',
  ACCOUNT_CLOSING: 'Nalog je već u ograničenoj fazi zatvaranja.',
};
const revision = (x: unknown): x is number => typeof x === 'number' && Number.isInteger(x) && x >= 0 && x <= 2_147_483_647;
function values<T extends string>(raw: unknown, catalog: readonly T[]): T[] | null {
  if (!Array.isArray(raw) || raw.length > catalog.length || new Set(raw).size !== raw.length ||
      raw.some(x => typeof x !== 'string' || !catalog.includes(x as T))) return null;
  return [...raw] as T[];
}
function account(explicit?: ReceiptAccount): ReceiptAccount | null {
  const s = sesijaSada(); const a = explicit ?? (s.user ? { accountId: s.user.id, accountRevision: s.accountRevision } : null);
  return a && uuid(a.accountId) ? { ...a } : null;
}
function request(raw: unknown, owner: string): ClosureRequest | null {
  const r = record(raw), p = record(r?.preparation);
  const blockers = values(p?.blockers, CLOSURE_BLOCKERS), reasons = values(p?.notReadyReasons, CLOSURE_NOT_READY_REASONS);
  if (!r || !p || !sameId(r.accountId, owner) || !uuid(r.requestId) || !revision(r.revision) || r.revision === 0 ||
      !timestamp(r.requestedAt) || !timestamp(r.preparedAt) || !timestamp(p.observedAt) ||
      Date.parse(r.preparedAt) !== Date.parse(p.observedAt) || Date.parse(r.preparedAt) < Date.parse(r.requestedAt) ||
      r.authoritative !== true || r.restricted !== false || r.canExecute !== false ||
      typeof p.legalReady !== 'boolean' || typeof p.retentionReady !== 'boolean' ||
      p.executionReady !== false || p.authClosureReady !== false || p.mediaCleanupReady !== false || blockers === null || reasons === null ||
      !reasons.includes('CLOSURE_EXECUTION_NOT_READY') ||
      reasons.includes('LEGAL_POLICY_NOT_READY') === p.legalReady || reasons.includes('RETENTION_POLICY_NOT_READY') === p.retentionReady ||
      (r.state !== 'BLOCKED' && r.state !== 'NOT_READY') || (r.state === 'BLOCKED') !== (blockers.length > 0)) return null;
  return { accountId: owner, requestId: r.requestId, state: r.state, revision: r.revision, requestedAt: r.requestedAt, preparedAt: r.preparedAt,
    preparation: { observedAt: p.observedAt, blockers, notReadyReasons: reasons, legalReady: p.legalReady, retentionReady: p.retentionReady,
      executionReady: false, authClosureReady: false, mediaCleanupReady: false }, restricted: false, canExecute: false, authoritative: true };
}
function receipt(raw: unknown, owner: string, key: string, expected?: number): ClosureReceipt | null {
  const r = record(raw), parsed = request(raw, owner);
  if (!r || !parsed || !sameId(r.clientRequestId, key) || typeof r.idempotentReplay !== 'boolean' ||
      (expected !== undefined && parsed.revision !== expected + 1)) return null;
  return { ...parsed, clientRequestId: key, idempotentReplay: r.idempotentReplay };
}
const bad = <T>(code: string): Promise<Ishod<T>> => Promise.resolve(failure(code, errors[code]));
export const accountClosureClientService = {
  read(explicit?: ReceiptAccount): Promise<Ishod<ClosureStatus>> {
    const a = account(explicit); if (!a) return bad('AUTH_REQUIRED');
    return readOwnedResult({ account: a, errors, fallback: 'CLOSURE_READ_UNAVAILABLE', invalid: 'CLOSURE_INVALID_RESPONSE',
      request: () => supabaseKlijent().rpc('rpc_get_account_closure', { p_expected_user_id: a.accountId }),
      decode: raw => {
        const r = record(raw); if (!r || !sameId(r.accountId, a.accountId) || !revision(r.revision) ||
          r.authoritative !== true || r.restricted !== false || r.canExecute !== false) return null;
        const parsed = r.request === null ? null : request(r.request, a.accountId);
        if ((r.request !== null && parsed === null) || r.revision !== (parsed?.revision ?? 0)) return null;
        return { accountId: a.accountId, request: parsed, revision: r.revision, restricted: false, canExecute: false, authoritative: true };
      } });
  },
  prepare(command: ClosureCommand, explicit?: ReceiptAccount): Promise<Ishod<ClosureReceipt>> {
    const a = account(explicit); if (!a) return bad('AUTH_REQUIRED');
    const c = { ...command };
    if (!uuid(c.clientRequestId) || !revision(c.expectedRevision) || c.expectedRevision >= 2_147_483_647) return bad('CLOSURE_INPUT_INVALID');
    return readOwnedResult({ account: a, errors, write: true, fallback: 'CLOSURE_OUTCOME_UNKNOWN', invalid: 'CLOSURE_INVALID_RECEIPT',
      request: () => supabaseKlijent().rpc('rpc_prepare_account_closure', { p_expected_user_id: a.accountId,
        p_expected_revision: c.expectedRevision, p_client_request_id: c.clientRequestId }),
      decode: raw => receipt(raw, a.accountId, c.clientRequestId, c.expectedRevision) });
  },
  readReceipt(clientRequestId: string, explicit?: ReceiptAccount): Promise<Ishod<ClosureReceiptLookup>> {
    const a = account(explicit); if (!a) return bad('AUTH_REQUIRED');
    if (!uuid(clientRequestId)) return bad('CLOSURE_INPUT_INVALID');
    return readOwnedResult({ account: a, errors, fallback: 'CLOSURE_READ_UNAVAILABLE', invalid: 'CLOSURE_INVALID_RECEIPT',
      request: () => supabaseKlijent().rpc('rpc_get_account_closure_receipt', { p_expected_user_id: a.accountId, p_client_request_id: clientRequestId }),
      decode: raw => {
        const r = record(raw); if (!r || !sameId(r.accountId, a.accountId) || !sameId(r.clientRequestId, clientRequestId) ||
          typeof r.found !== 'boolean' || r.authoritative !== true) return null;
        const parsed = r.found ? receipt(r.receipt, a.accountId, clientRequestId) : null;
        if ((r.found && parsed === null) || (!r.found && r.receipt !== null)) return null;
        return { accountId: a.accountId, clientRequestId, found: r.found, receipt: parsed, authoritative: true };
      } });
  },
};
