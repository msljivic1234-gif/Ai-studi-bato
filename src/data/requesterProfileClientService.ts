import type { Ishod } from './ports';
import { sesijaSada } from '../store/sesija';
import { supabaseKlijent } from './supabaseClient';
import { failure, readOwnedResult, record, sameId, uuid, type ReceiptAccount } from './serverReceipt';

export type RequesterIdentity = {
  schema: 'REQUESTER_IDENTITY_V1'; accountId: string; profileId: string;
  displayName: string; revision: string; writableFields: readonly ['displayName'];
};
export type RequesterIdentityCommand = { expectedRevision: string; displayName: string; clientRequestId: string };
export type RequesterIdentityReceipt = { saved: true; idempotentReplay: boolean; clientRequestId: string; identity: RequesterIdentity };
const revision = (x: unknown): x is string => typeof x === 'string' && /^[a-f0-9]{64}$/.test(x);
const display = (x: unknown): x is string => typeof x === 'string' && [...x.trim()].length >= 1 && [...x.trim()].length <= 200 && !/[\x00-\x1f\x7f-\x9f]/.test(x);
const COPY: Readonly<Record<string, string>> = {
  AUTH_REQUIRED: 'Prijavi se da urediš profil.',
  REQUESTER_PROFILE_REQUIRED: 'Profil nije pronađen. Osveži prikaz.',
  REQUESTER_PROFILE_RESTRICTED: 'Profil trenutno nije dostupan za izmenu.',
  REQUESTER_PROFILE_INPUT_INVALID: 'Unesi ime do 200 znakova, bez kontrolnih znakova.',
  REQUESTER_PROFILE_STALE: 'Profil je promenjen. Učitaj ga pre nove izmene.',
  REQUEST_ID_REUSED: 'Zahtev je već upotrebljen za druge podatke. Prvo proveri potvrdu prethodne radnje.',
};
function scope(explicit?: ReceiptAccount): ReceiptAccount | null {
  const s = sesijaSada();
  const account = explicit ?? (s.user ? { accountId: s.user.id, accountRevision: s.accountRevision } : null);
  return account && uuid(account.accountId) ? { ...account } : null;
}
function identity(raw: unknown, accountId: string): RequesterIdentity | null {
  const x = record(raw);
  // Historical names may be blank or longer than new edit limits. Do not rewrite
  // or fabricate them on read; bounds apply when a new command is submitted.
  if (!x || x.schema !== 'REQUESTER_IDENTITY_V1' || !sameId(x.accountId, accountId) || !uuid(x.profileId) ||
      typeof x.displayName !== 'string' || x.displayName.length > 8000 || !revision(x.revision) ||
      !Array.isArray(x.writableFields) || x.writableFields.length !== 1 || x.writableFields[0] !== 'displayName') return null;
  return { schema: 'REQUESTER_IDENTITY_V1', accountId, profileId: x.profileId, displayName: x.displayName,
    revision: x.revision, writableFields: ['displayName'] };
}
/** Only the existing REQUESTER public display name. Not a second Worker,
 * account legal identity, location, verification or reputation writer. */
export const requesterProfileClientService = {
  read(explicit?: ReceiptAccount): Promise<Ishod<RequesterIdentity>> {
    const account = scope(explicit);
    if (!account) return Promise.resolve(failure('AUTH_REQUIRED', COPY.AUTH_REQUIRED));
    return readOwnedResult({ account, request: () => supabaseKlijent().rpc('rpc_get_requester_profile_for_edit', {}),
      decode: raw => identity(raw, account.accountId), errors: COPY,
      fallback: 'REQUESTER_PROFILE_READ_FAILED', invalid: 'REQUESTER_PROFILE_INVALID_RECEIPT' });
  },
  save(command: RequesterIdentityCommand, explicit?: ReceiptAccount): Promise<Ishod<RequesterIdentityReceipt>> {
    const account = scope(explicit);
    if (!account) return Promise.resolve(failure('AUTH_REQUIRED', COPY.AUTH_REQUIRED));
    if (!command || !revision(command.expectedRevision) || !uuid(command.clientRequestId) || !display(command.displayName)) {
      return Promise.resolve(failure('REQUESTER_PROFILE_INPUT_INVALID', COPY.REQUESTER_PROFILE_INPUT_INVALID));
    }
    const args = { p_expected_revision: command.expectedRevision, p_display_name: command.displayName.trim(), p_client_request_id: command.clientRequestId };
    return readOwnedResult({ account, request: () => supabaseKlijent().rpc('rpc_save_requester_profile', args), write: true,
      errors: COPY, fallback: 'REQUESTER_PROFILE_OUTCOME_UNKNOWN', invalid: 'REQUESTER_PROFILE_INVALID_RECEIPT',
      decode: raw => {
        const x = record(raw), person = identity(x?.identity, account.accountId);
        if (!x || x.saved !== true || typeof x.idempotentReplay !== 'boolean' || !sameId(x.clientRequestId, args.p_client_request_id) ||
            !person || person.displayName !== args.p_display_name) return null;
        return { saved: true, idempotentReplay: x.idempotentReplay, clientRequestId: args.p_client_request_id, identity: person };
      } });
  },
};
