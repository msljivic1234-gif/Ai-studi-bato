import { PasswordRecoveryError } from '../contracts/passwordRecovery';
import { isRestrictedAccountSignal } from './authFailureClasses';

export function recoveryError(error: unknown, stage: 'request' | 'verify' | 'update'): PasswordRecoveryError {
  if (error instanceof PasswordRecoveryError) return error;
  // The provider's restricted-account code decides before any status: a banned account's link is not "expired".
  if (isRestrictedAccountSignal(error)) return new PasswordRecoveryError('RESTRICTED_ACCOUNT');
  const raw = error && typeof error === 'object' ? error as Record<string, unknown> : {};
  if (raw.status === 429 || raw.code === 'over_email_send_rate_limit' || raw.code === 'over_request_rate_limit') {
    return new PasswordRecoveryError('RATE_LIMITED');
  }
  if (stage === 'update' && raw.code === 'weak_password') return new PasswordRecoveryError('WEAK_PASSWORD');
  if (stage === 'update' && raw.code === 'same_password') return new PasswordRecoveryError('SAME_PASSWORD');
  if (stage === 'request') return new PasswordRecoveryError('REQUEST_UNCONFIRMED');
  if (typeof raw.status === 'number' && raw.status >= 400 && raw.status < 500) {
    return new PasswordRecoveryError('INVALID_LINK');
  }
  return new PasswordRecoveryError(stage === 'update' ? 'UPDATE_UNKNOWN' : 'VERIFY_UNAVAILABLE');
}

/** A timeout never fabricates success and never automatically repeats a write. */
export async function recoveryDeadline<T>(operation: () => Promise<T>, stage: 'request' | 'verify' | 'update'): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      operation(),
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => reject(recoveryError(undefined, stage)), 15_000);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
