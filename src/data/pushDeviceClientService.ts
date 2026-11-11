import type { AuthAccountScope } from '../contracts/auth';
import { readOwnedResult, record, sameId, timestamp, uuid } from './serverReceipt';
import { supabaseKlijent } from './supabaseClient';
import { sesijaSada } from '../store/sesija';
export type PushDevice = { exists: boolean; id: string | null; revision: number; active: boolean; sessionBound: boolean; platform: 'IOS' | 'ANDROID' | null };
export type PushPlatform = 'IOS' | 'ANDROID';
export type PushSessionDevice = { kind: 'NONE' | 'AMBIGUOUS' } | { kind: 'DEVICE'; id: string; revision: number; token: string; platform: PushPlatform };
const tokenValid = (x: string) => x.length <= 256 && /^(ExpoPushToken|ExponentPushToken)\[[A-Za-z0-9_-]+\]$/.test(x);
const errors = { PUSH_REVISION_CONFLICT: 'Registracija je promenjena. Osveži stanje uređaja.', AUTH_CONTEXT_CHANGED: 'Nalog je promenjen. Ponovo otvori podešavanja.',
 AUTH_REQUIRED: 'Prijavi se ponovo da podesiš obaveštenja.', PUSH_DEVICE_LIMIT: 'Dostignut je broj povezanih uređaja.', INVALID_PUSH_REGISTRATION: 'Registracija uređaja nije ispravna.' };
function decode(raw: unknown, read: boolean): PushDevice | null {
 const x = record(raw); if (!x || typeof x.active !== 'boolean' || typeof x.sessionBound !== 'boolean' || !Number.isSafeInteger(x.revision) || Number(x.revision) < 0) return null;
 if (read && x.exists === false) return Object.keys(x).length === 4 && x.revision === 0 && !x.active && !x.sessionBound
  ? { exists: false, id: null, revision: 0, active: false, sessionBound: false, platform: null } : null;
 const keys = ['id', 'revision', 'active', 'platform', 'lastSeenAt', 'sessionBound', ...(read ? ['exists'] : [])];
 if (Object.keys(x).some(k => !keys.includes(k)) || keys.some(k => !(k in x)) || read && x.exists !== true
  || !uuid(x.id) || !['IOS', 'ANDROID'].includes(String(x.platform)) || !timestamp(x.lastSeenAt) || x.sessionBound && !x.active || Number(x.revision) < 1) return null;
 return { exists: true, id: x.id, revision: Number(x.revision), active: x.active, sessionBound: x.sessionBound, platform: x.platform as PushPlatform };
}
export const pushDeviceClientService = {
 sessionDevice(account: AuthAccountScope) {
  return readOwnedResult<PushSessionDevice>({ account, request: () => supabaseKlijent().rpc('rpc_get_push_session_device', { p_expected_user_id: account.accountId }),
   decode: raw => {
    const x = record(raw); if (!x) return null;
    if (Object.keys(x).length === 1 && (x.kind === 'NONE' || x.kind === 'AMBIGUOUS')) return { kind: x.kind };
    if (Object.keys(x).length !== 5 || x.kind !== 'DEVICE' || !uuid(x.id) || !Number.isSafeInteger(x.revision) || Number(x.revision) < 1
     || typeof x.expoPushToken !== 'string' || !tokenValid(x.expoPushToken) || !['IOS', 'ANDROID'].includes(String(x.platform))) return null;
    return { kind: 'DEVICE', id: x.id, revision: Number(x.revision), token: x.expoPushToken, platform: x.platform as PushPlatform };
   }, errors, fallback: 'PUSH_UNAVAILABLE', invalid: 'PUSH_INVALID_RESPONSE' });
 },
 rotate(account: AuthAccountScope, previous: Extract<PushSessionDevice, { kind: 'DEVICE' }>, token: string, platform: PushPlatform) {
  return readOwnedResult({ account, write: true, request: () => {
   if (!uuid(previous.id) || !Number.isSafeInteger(previous.revision) || previous.revision < 1 || previous.revision >= Number.MAX_SAFE_INTEGER || !tokenValid(token) || previous.token === token || previous.platform !== platform) throw Error('INVALID_ROTATION');
   return supabaseKlijent().rpc('rpc_rotate_push_device_owned', { p_expected_user_id: account.accountId, p_previous_device_id: previous.id, p_previous_revision: previous.revision, p_expo_push_token: token, p_platform: platform });
  }, decode: raw => {
   const x = record(raw); if (!x || !sameId(x.previousDeviceId, previous.id) || x.previousRevision !== previous.revision + 1) return null;
   const { previousDeviceId: _id, previousRevision: _revision, ...next } = x; const result = decode(next, false);
   return result?.active && result.sessionBound && result.id !== previous.id && result.platform === platform ? result : null;
  }, errors, fallback: 'PUSH_UNCONFIRMED', invalid: 'PUSH_INVALID_RESPONSE' });
 },
 read(account: AuthAccountScope, token: string) {
  return readOwnedResult({ account, request: () => {
   if (!tokenValid(token)) throw Error('INVALID_TOKEN');
   return supabaseKlijent().rpc('rpc_get_push_device_owned', { p_expected_user_id: account.accountId, p_expo_push_token: token });
  }, decode: raw => decode(raw, true), errors, fallback: 'PUSH_UNAVAILABLE', invalid: 'PUSH_INVALID_RESPONSE' });
 },
 set(account: AuthAccountScope, token: string, platform: PushPlatform, active: boolean, revision: number) {
  return readOwnedResult({ account, write: true, request: () => {
   if (!tokenValid(token) || !['IOS', 'ANDROID'].includes(platform) || typeof active !== 'boolean' || !Number.isSafeInteger(revision) || revision < 0 || revision >= Number.MAX_SAFE_INTEGER) throw Error('INVALID_REGISTRATION');
   return supabaseKlijent().rpc('rpc_set_push_device_owned', { p_expected_user_id: account.accountId, p_expo_push_token: token, p_platform: platform, p_active: active, p_expected_revision: revision });
  }, decode: raw => { const result = decode(raw, false); return result?.revision === revision + 1 && result.active === active && result.sessionBound === active && result.platform === platform ? result : null; },
  errors, fallback: 'PUSH_UNCONFIRMED', invalid: 'PUSH_INVALID_RESPONSE' });
 },
};

/** Best effort, bounded before Auth logout. A failed/unknown push revoke must not
 * hold the user signed in. Actual Auth signOut remains the session authority. */
export async function revokePushBeforeLogout(account: AuthAccountScope): Promise<boolean> {
 const current = () => sesijaSada().user?.id === account.accountId && sesijaSada().accountRevision === account.accountRevision;
 if (!current()) return false;
 let timer: ReturnType<typeof setTimeout> | undefined;
 try {
  const response = await Promise.race([Promise.resolve(supabaseKlijent().rpc('rpc_revoke_push_session', { p_expected_user_id: account.accountId })),
   new Promise<never>((_, reject) => { timer = setTimeout(() => reject(Error('TIMEOUT')), 4000); })]);
  if (!current() || response.error) return false;
  const result = record(response.data);
  return !!result && Object.keys(result).length === 2 && sameId(result.userId, account.accountId) && result.revoked === true;
 } catch { return false; } finally { if (timer !== undefined) clearTimeout(timer); }
}
