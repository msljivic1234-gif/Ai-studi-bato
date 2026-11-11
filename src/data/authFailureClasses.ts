/**
 * Sign-in failure classes (EX-07 S02, gap G04; plan card N01: bad data, a missing connection and a restricted account
 * each get their own recovery). A failed sign-in is told apart ONLY by what the Auth client reports, and a person sees
 * one plain message per class, never the provider's own text, code or status.
 *
 * What the installed @supabase/auth-js 2.112.4 reports (lib/fetch.ts):
 *  - no HTTP answer at all (offline, DNS, TLS, a socket timeout, an abort) is an AuthRetryableFetchError with status 0 and
 *    no code, and so is a 200 whose body is not JSON (a captive portal);
 *  - 500-504 and 520-530 are AuthRetryableFetchError with that status and NO code (the body is not read for one);
 *  - any other HTTP answer is an AuthApiError with the provider's own `code` (GoTrue: invalid_credentials,
 *    email_not_confirmed, user_banned, over_request_rate_limit, ...), or without one when the body carries none;
 *  - an error page that is not JSON, outside those statuses, is an AuthUnknownError with neither status nor code, so a
 *    rate-limit page from a proxy cannot be recognised as one.
 *
 * What the GoTrue password grant answers (supabase/auth internal/api/token.go ResourceOwnerPasswordGrant on master, read
 * 2026-10-02; the hosted DEV provider and its version were NOT probed):
 *  - an unknown email, an account without a password and a wrong password are all invalid_credentials, so no message can
 *    tell them apart; email_not_confirmed only comes after the password was right;
 *  - user_banned comes BEFORE the password is looked at (older tags, v2.100.0 and v2.158.1, answered a banned account with
 *    the generic invalid-credentials message instead). Where the provider behaves as master does, whoever types a
 *    restricted account's email, with any password, is told so. RESTRICTED_ACCOUNT relays what the provider already says
 *    to anyone who asks it and adds nothing. If that disclosure is not wanted, answer 'user_banned' with BAD_CREDENTIALS
 *    in classifySignInFailure; nothing else changes.
 *
 * Only sign-in is told apart. Sign-up and resend keep their one message each (authClientService.safeAuthFailure); phone sign-in
 * keeps its one message too, except that a restricted account is told apart there as well (owner decision 2026-10-07: signing in
 * to a banned, blocked or closed account gets its own clear message, not the generic sign-in error).
 */
export type SignInFailureClass =
  | 'BAD_CREDENTIALS' | 'CONNECTION' | 'EMAIL_NOT_CONFIRMED' | 'RESTRICTED_ACCOUNT' | 'RATE_LIMITED' | 'UNAVAILABLE';

/** Said by every Auth operation, so each has one spelling. */
export const RATE_LIMITED_COPY = 'Previše pokušaja. Sačekajte kratko pa pokušajte ponovo.';
export const PROVIDER_UNAVAILABLE_COPY = 'Prijava trenutno nije dostupna. Pokušajte ponovo.';

/**
 * One message per class: what happened in the person's terms, then the one thing to do that the sign-in screen already
 * offers (retry, check the connection, confirm the email, wait). No support entry is reachable from the signed-out
 * screen, so none is promised.
 */
export const SIGN_IN_FAILURE_COPY: Readonly<Record<SignInFailureClass, string>> = {
  BAD_CREDENTIALS: 'Prijava nije uspela. Proverite email i lozinku i pokušajte ponovo.',
  CONNECTION: 'Ne možemo da se povežemo, pa prijava nije uspela. Proverite vezu i pokušajte ponovo.',
  EMAIL_NOT_CONFIRMED: 'Email još nije potvrđen. Otvorite poruku za potvrdu (proverite i neželjenu poštu), pa se prijavite ponovo.',
  RESTRICTED_ACCOUNT: 'Pristup ovom nalogu je ograničen, pa prijava trenutno nije moguća. Pokušajte ponovo kada se ograničenje ukloni.',
  RATE_LIMITED: RATE_LIMITED_COPY,
  UNAVAILABLE: PROVIDER_UNAVAILABLE_COPY,
};

/** The two things an Auth failure may be classified by. Nothing else of it is read, and none of it is ever shown. */
export type AuthFailureSignals = { status: number | null; code: string };

export function authFailureSignals(error: unknown): AuthFailureSignals {
  const value = error && typeof error === 'object' ? error as { status?: unknown; code?: unknown } : {};
  return {
    status: typeof value.status === 'number' ? value.status : null,
    code: typeof value.code === 'string' ? value.code.toLowerCase() : '',
  };
}

export function isRateLimited({ status, code }: AuthFailureSignals): boolean {
  return status === 429 || code.includes('rate') || code.includes('over_request');
}

export function isProviderUnavailable({ status, code }: AuthFailureSignals): boolean {
  return (status !== null && status >= 500) || code.includes('unexpected_failure') || code.includes('service_unavailable');
}

export function classifySignInFailure(error: unknown): SignInFailureClass {
  const signals = authFailureSignals(error);
  // The provider's own code is the most specific word it gives, so it decides first and is compared whole.
  switch (signals.code) {
    case 'invalid_credentials': return 'BAD_CREDENTIALS';
    case 'email_not_confirmed': return 'EMAIL_NOT_CONFIRMED';
    case 'user_banned': return 'RESTRICTED_ACCOUNT';
  }
  if (isRateLimited(signals)) return 'RATE_LIMITED';
  // Status 0 is not an HTTP status: the client never got an answer.
  if (signals.status === 0) return 'CONNECTION';
  // 5xx, unexpected_failure, a rejection nobody here recognises, an error page, a thrown non-Auth error: the sign-in did
  // not happen for a reason the provider did not give, so it is not blamed on the person's credentials.
  return 'UNAVAILABLE';
}

/** The only error a failed sign-in throws: its message is the class's own, and it keeps nothing of the provider's. */
export class SignInFailureError extends Error {
  constructor(readonly failureClass: SignInFailureClass) {
    super(SIGN_IN_FAILURE_COPY[failureClass]);
    this.name = 'SignInFailureError';
  }
}

/** The provider's own word for a restricted (banned) account, compared whole like every code here. */
const RESTRICTED_ACCOUNT_CODE = 'user_banned';

/** Whether an Auth answer says the account is restricted. Only the code is read. */
export function isRestrictedAccountSignal(error: unknown): boolean {
  return authFailureSignals(error).code === RESTRICTED_ACCOUNT_CODE;
}

/**
 * Whether a failure the screens receive is to be drawn as the restricted-account panel rather than as an error line: a sign-in
 * (email or phone) the provider refused as restricted, or a password recovery it refused the same way. Duck-typed on the two
 * typed errors' own fields so that a screen test may throw either without the module that made it.
 */
export function isRestrictedAccountFailure(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const value = error as { name?: unknown; failureClass?: unknown; code?: unknown };
  return (value.name === 'SignInFailureError' && value.failureClass === 'RESTRICTED_ACCOUNT') ||
    (value.name === 'PasswordRecoveryError' && value.code === 'RESTRICTED_ACCOUNT');
}

/**
 * Signed out because the account is restricted. When the provider refuses a session refresh, the installed auth-js (2.112.4,
 * GoTrueClient._callRefreshToken) drops the session and reports only SIGNED_OUT, with no error. The refusal itself stays on the
 * client for the retry cooldown, as `lastRefreshFailure = { refreshToken, result: { error }, expiresAt }`, and every later sign-out
 * or successful refresh clears it. It is read here by exactly that shape, and nothing else of it: not the token, not the text,
 * not the status. A library that keeps it differently gives "no reason", which is the silent sign-out the app had before.
 * Returns the refusal itself (the same object a getSession that ran that refresh returned, so a caller can tell one refusal
 * from the next), or null.
 */
export function restrictedRefreshRefusal(auth: unknown, now = Date.now()): object | null {
  if (!auth || typeof auth !== 'object') return null;
  const failure = (auth as { lastRefreshFailure?: unknown }).lastRefreshFailure;
  if (!failure || typeof failure !== 'object') return null;
  const { result, expiresAt } = failure as { result?: unknown; expiresAt?: unknown };
  if (typeof expiresAt !== 'number' || !(expiresAt > now) || !result || typeof result !== 'object') return null;
  const error = (result as { error?: unknown }).error;
  return error && typeof error === 'object' && isRestrictedAccountSignal(error) ? error : null;
}
