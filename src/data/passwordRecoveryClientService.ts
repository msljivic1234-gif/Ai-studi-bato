import type { PasswordRecoverySession } from '../contracts/passwordRecovery';
import { PasswordRecoveryError } from '../contracts/passwordRecovery';
import { sesijaSada } from '../store/sesija';
import { createRecoveryTransport } from './supabaseClient';
import { configuredRecoveryRedirect, parseRecoveryCallback } from './passwordRecoveryLink';
import { recoveryDeadline, recoveryError } from './passwordRecoveryErrors';

interface UserIdentity { id: string; email?: string }
interface RecoveryAuth {
  setSession(tokens: { access_token: string; refresh_token: string }): Promise<{
    data: { session: { user: UserIdentity } | null }; error: unknown;
  }>;
  getUser(): Promise<{ data: { user: UserIdentity | null }; error: unknown }>;
  updateUser(input: { password: string }): Promise<{ data: { user: UserIdentity | null }; error: unknown }>;
}
export interface RecoveryDependencies {
  redirect: () => string | null;
  account: () => { user: { id: string } | null; accountRevision: number };
  transport: () => { auth: RecoveryAuth; dispose: () => void };
}

/** One transient credential-recovery lease, with no marketplace login or persistence. */
export function createRecoverySession(deps: RecoveryDependencies): PasswordRecoverySession {
  const revision = deps.account().accountRevision;
  let state: 'new' | 'verifying' | 'ready' | 'saving' | 'closed' = 'new';
  let transport: ReturnType<RecoveryDependencies['transport']> | null = null;
  let verifiedId: string | null = null;
  const dispose = () => {
    state = 'closed';
    verifiedId = null;
    transport?.dispose();
    transport = null;
  };
  const stillOpen = () => state !== 'closed';
  const assertScope = () => {
    if (state === 'closed') throw new PasswordRecoveryError('INVALID_LINK');
    const current = deps.account();
    if (current.accountRevision !== revision) throw new PasswordRecoveryError('ACCOUNT_CHANGED');
    if (current.user) throw new PasswordRecoveryError('SIGNED_IN');
  };
  return {
    dispose,
    async verify(link) {
      assertScope();
      if (state !== 'new') throw new PasswordRecoveryError('BUSY');
      const redirect = deps.redirect();
      if (!redirect) throw new PasswordRecoveryError('UNCONFIGURED');
      const tokens = parseRecoveryCallback(link, redirect);
      state = 'verifying';
      try {
        transport = deps.transport();
        const auth = transport.auth;
        const result = await recoveryDeadline(async () => {
          const session = await auth.setSession(tokens);
          assertScope();
          if (session.error) throw session.error;
          if (!session.data.session) throw new PasswordRecoveryError('INVALID_LINK');
          const verified = await auth.getUser();
          assertScope();
          if (verified.error) throw verified.error;
          const user = verified.data.user;
          if (!user?.id || !user.email || user.id !== session.data.session.user.id) {
            throw new PasswordRecoveryError('INVALID_LINK');
          }
          return { id: user.id, email: user.email };
        }, 'verify');
        assertScope();
        verifiedId = result.id;
        state = 'ready';
        return { email: result.email };
      } catch (error) {
        dispose();
        throw recoveryError(error, 'verify');
      }
    },
    async updatePassword(password) {
      assertScope();
      if (state === 'saving' || state === 'verifying') throw new PasswordRecoveryError('BUSY');
      if (state !== 'ready' || !transport || !verifiedId) throw new PasswordRecoveryError('INVALID_LINK');
      if (password.length < 6) throw new PasswordRecoveryError('WEAK_PASSWORD');
      const auth = transport.auth;
      const expectedUser = verifiedId;
      state = 'saving';
      let writeStarted = false;
      try {
        // Revalidate on the server immediately before the password write.
        const checked = await recoveryDeadline(() => auth.getUser(), 'verify');
        assertScope();
        if (checked.error) throw checked.error;
        if (checked.data.user?.id !== expectedUser) throw new PasswordRecoveryError('INVALID_LINK');
        writeStarted = true;
        const result = await recoveryDeadline(() => auth.updateUser({ password }), 'update');
        assertScope();
        if (result.error) throw result.error;
        if (result.data.user?.id !== expectedUser) throw new PasswordRecoveryError('UPDATE_UNKNOWN');
        dispose();
      } catch (error) {
        const failure = recoveryError(error, writeStarted ? 'update' : 'verify');
        // A lost write response is not a safe retry. Only explicit validation
        // or throttling refusals retain this verified form for another attempt.
        if (stillOpen() && ['WEAK_PASSWORD', 'SAME_PASSWORD', 'RATE_LIMITED'].includes(failure.code)) state = 'ready';
        else dispose();
        throw failure;
      }
    },
  };
}

export const passwordRecoveryClientService = {
  createSession: (): PasswordRecoverySession => createRecoverySession({
    redirect: configuredRecoveryRedirect,
    account: sesijaSada,
    transport: createRecoveryTransport,
  }),
};
