import { sesijaSada } from '../store/sesija';
import { createRecoveryTransport } from './supabaseClient';

/**
 * "Promeni lozinku" for a signed-in person (R22, UI/UX pass 2026-10-08). The person proves they know the current password, and the new
 * one is written, both on a TRANSIENT Auth client of their own (the one the password recovery uses: nothing persisted, no refresh, one
 * `AbortController` that ends it), so the app's own session is never touched, replaced or signed out, and nothing about this reaches the
 * marketplace. The account is the one that is signed in: its email is read from the session and is never typed or changed here.
 *
 * It sends a password only to Auth, over the same HTTPS client as every sign-in, and keeps none of it: no log, no storage, no echo of the
 * provider's own text (a refusal is a code, and the sentence is ours). Nothing is retried by itself: the verification may be read again
 * (it writes nothing), but the write is sent once, and a write whose answer was lost is said as "we do not know" and never as a failure
 * or a success, because the old password may or may not work now.
 */
export type PasswordChangeFailure = 'NO_ACCOUNT' | 'WEAK_PASSWORD' | 'SAME_PASSWORD' | 'WRONG_CURRENT' | 'RATE_LIMITED' | 'UNAVAILABLE' | 'UNKNOWN_OUTCOME';
export type PasswordChangeResult = { ok: true } | { ok: false; code: PasswordChangeFailure };

/** What a person reads for each refusal. The words are the app's, never the provider's. */
export const passwordChangeMessages: Readonly<Record<PasswordChangeFailure, string>> = {
  NO_ACCOUNT: 'Prijavi se da nastaviš.',
  WEAK_PASSWORD: 'Nova lozinka je preslaba. Izaberi drugu.',
  SAME_PASSWORD: 'Nova lozinka mora da bude drugačija od trenutne.',
  WRONG_CURRENT: 'Trenutna lozinka nije tačna.',
  RATE_LIMITED: 'Previše pokušaja. Probaj ponovo malo kasnije.',
  UNAVAILABLE: 'Lozinka nije promenjena. Proveri vezu i pokušaj ponovo.',
  UNKNOWN_OUTCOME: 'Ne znamo da li je lozinka promenjena. Odjavi se pa se prijavi novom lozinkom; ako ne uspe, starom.',
};

/** The shortest a password may be (the sign-up's own rule); the provider decides the rest. */
export const NEW_PASSWORD_MIN = 6;

type AuthLike = {
  signInWithPassword(input: { email: string; password: string }): Promise<{ data: { user: { id: string } | null }; error: unknown }>;
  updateUser(input: { password: string }): Promise<{ data: { user: { id: string } | null }; error: unknown }>;
};
type Transport = { auth: AuthLike; dispose: () => void };
type Dependencies = {
  account: () => { user: { id: string; email?: string | null } | null; accountRevision: number };
  transport: () => Transport;
  /** A bounded read or write, in milliseconds. */ deadlineMs: number;
};

const LOCAL_TIMEOUT = Symbol('PASSWORD_CHANGE_TIMEOUT');
const bounded = async <T,>(operation: () => Promise<T>, ms: number): Promise<T> => {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([operation(), new Promise<never>((_resolve, reject) => { timer = setTimeout(() => reject(LOCAL_TIMEOUT), ms); })]);
  } finally { if (timer !== undefined) clearTimeout(timer); }
};
const field = (error: unknown, key: string): unknown => error && typeof error === 'object' ? (error as Record<string, unknown>)[key] : undefined;
const rateLimited = (error: unknown) => field(error, 'status') === 429 || ['over_request_rate_limit', 'over_email_send_rate_limit'].includes(String(field(error, 'code')));

/** The service over its dependencies; the exported one below is wired to the app's session and Auth. */
export function createPasswordChange(deps: Dependencies) {
  return {
    async change(current: string, next: string): Promise<PasswordChangeResult> {
      const owner = deps.account(), email = owner.user?.email?.trim();
      if (!owner.user || !email) return { ok: false, code: 'NO_ACCOUNT' };
      const accountId = owner.user.id, revision = owner.accountRevision;
      const same = () => { const now = deps.account(); return now.user?.id === accountId && now.accountRevision === revision; };
      if (next.length < NEW_PASSWORD_MIN) return { ok: false, code: 'WEAK_PASSWORD' };
      if (next === current) return { ok: false, code: 'SAME_PASSWORD' };
      let transport: Transport;
      try { transport = deps.transport(); } catch { return { ok: false, code: 'UNAVAILABLE' }; }
      let writeStarted = false;
      try {
        // 1. The current password, on the transient client: it writes nothing, so a failure here is always safe to repeat.
        const verified = await bounded(() => transport.auth.signInWithPassword({ email, password: current }), deps.deadlineMs);
        if (!same()) return { ok: false, code: 'NO_ACCOUNT' };
        if (verified.error) {
          if (rateLimited(verified.error)) return { ok: false, code: 'RATE_LIMITED' };
          const status = field(verified.error, 'status'), code = String(field(verified.error, 'code') ?? '');
          return { ok: false, code: status === 400 || code === 'invalid_credentials' ? 'WRONG_CURRENT' : 'UNAVAILABLE' };
        }
        if (verified.data.user?.id !== accountId) return { ok: false, code: 'UNAVAILABLE' };
        // 2. The write: once.
        writeStarted = true;
        const written = await bounded(() => transport.auth.updateUser({ password: next }), deps.deadlineMs);
        if (!same()) return { ok: false, code: 'UNKNOWN_OUTCOME' };
        if (written.error) {
          if (rateLimited(written.error)) return { ok: false, code: 'RATE_LIMITED' };
          const code = String(field(written.error, 'code') ?? '');
          if (code === 'weak_password') return { ok: false, code: 'WEAK_PASSWORD' };
          if (code === 'same_password') return { ok: false, code: 'SAME_PASSWORD' };
          // The provider answered and refused it with something else: the write did not happen, but the reason is not ours to guess.
          const status = field(written.error, 'status');
          return { ok: false, code: typeof status === 'number' && status >= 400 && status < 500 ? 'UNAVAILABLE' : 'UNKNOWN_OUTCOME' };
        }
        return written.data.user?.id === accountId ? { ok: true } : { ok: false, code: 'UNKNOWN_OUTCOME' };
      } catch {
        // A thrown read is a read that did not happen; a thrown write is one whose outcome nobody knows.
        return { ok: false, code: writeStarted ? 'UNKNOWN_OUTCOME' : 'UNAVAILABLE' };
      } finally { try { transport.dispose(); } catch { /* the transient client is gone either way */ } }
    },
  };
}

export const passwordChangeClientService = createPasswordChange({ account: sesijaSada, transport: createRecoveryTransport as unknown as () => Transport, deadlineMs: 15_000 });
