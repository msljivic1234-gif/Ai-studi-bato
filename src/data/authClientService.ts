import { configuredRecoveryRedirect } from './passwordRecoveryLink';
import { PasswordRecoveryError } from '../contracts/passwordRecovery';
import { recoveryDeadline, recoveryError } from './passwordRecoveryErrors';
import type { AuthAccountScope, AuthClientPort } from '../contracts/auth';
import { sesijaSada } from '../store/sesija';
import { supabaseKlijent } from './supabaseClient';
import { revokePushBeforeLogout } from './pushDeviceClientService';
import { forgetAgreementOutboxes } from './agreementOutbox';
import { recentSearchesKey } from './recentSearchesKey';
import { writeSettledMapPlace } from './confirmedDiscoveryMapPlace';
import { voiceMessagesBuilt } from './voiceMessagesGate';
import { signupConfirmationRedirect } from './authSignupRedirect';
import {
  PROVIDER_UNAVAILABLE_COPY, RATE_LIMITED_COPY, SignInFailureError, authFailureSignals, classifySignInFailure,
  isProviderUnavailable, isRateLimited, isRestrictedAccountSignal,
} from './authFailureClasses';

function assertCurrentAccount(expected: AuthAccountScope) {
  const current = sesijaSada();
  if (!expected.accountId || current.user?.id !== expected.accountId ||
    current.accountRevision !== expected.accountRevision) {
    throw new Error('AUTH_ACCOUNT_CHANGED');
  }
}

type UserAuthOperation = 'SIGN_IN' | 'SIGN_UP' | 'SIGNUP_RESEND' | 'PHONE_SEND' | 'PHONE_VERIFY';
function safeAuthFailure(error: unknown, operation: UserAuthOperation): Error {
  // EX-07 S02: a failed sign-in is one of six classes (authFailureClasses), each with its own message and recovery.
  if (operation === 'SIGN_IN') return new SignInFailureError(classifySignInFailure(error));
  // Owner decision 2026-10-07: a restricted account gets its own message on the phone way in too. The provider's code decides
  // first, as it does for email sign-in, so a banned answer is never shown as a wrong number or code.
  if ((operation === 'PHONE_SEND' || operation === 'PHONE_VERIFY') && isRestrictedAccountSignal(error)) {
    return new SignInFailureError('RESTRICTED_ACCOUNT');
  }
  // Every other operation keeps its copy exactly: sign-up, resend and phone are outside that slice.
  const signals = authFailureSignals(error);
  if (isRateLimited(signals)) return new Error(RATE_LIMITED_COPY);
  if (isProviderUnavailable(signals)) return new Error(PROVIDER_UNAVAILABLE_COPY);
  if (operation === 'SIGN_UP') return new Error('Registracija trenutno nije uspela. Proverite podatke i pokušajte ponovo.');
  if (operation === 'SIGNUP_RESEND') return new Error('Novu potvrdu trenutno nije moguće zatražiti. Pokušajte ponovo.');
  if (operation === 'PHONE_SEND') return new Error('Kod trenutno nije moguće poslati. Proverite broj i pokušajte ponovo.');
  return new Error('Kod nije potvrđen. Proverite kod i pokušajte ponovo.');
}

/** The existing Auth transport boundary; no provider, policy or session authority is added. */
export const authClientService: AuthClientPort = {
  async signInWithPassword(input) {
    // A rejection (client setup, storage, a listener) is as much a failed sign-in as a returned error, and neither may
    // reach the screen with its own text. The classified error is thrown outside the try so it is never classified again.
    let failure: unknown = null;
    try { ({ error: failure } = await supabaseKlijent().auth.signInWithPassword(input)); }
    catch (thrown) { throw safeAuthFailure(thrown, 'SIGN_IN'); }
    if (failure) throw safeAuthFailure(failure, 'SIGN_IN');
  },

  async signUp({ email, password, firstName, lastName, city }) {
    const emailRedirectTo = signupConfirmationRedirect();
    if (!emailRedirectTo) throw new Error('Potvrda registracije trenutno nije dostupna. Pokušajte ponovo malo kasnije.');
    let result: Awaited<ReturnType<ReturnType<typeof supabaseKlijent>['auth']['signUp']>>;
    try {
      result = await supabaseKlijent().auth.signUp({
        email, password,
        // The existing signup trigger reads full_name. Keep the split metadata
        // as well; neither credentials nor historical profile rows are rewritten.
        options: { emailRedirectTo, data: { first_name: firstName, last_name: lastName,
          full_name: [firstName.trim(), lastName.trim()].filter(Boolean).join(' '),
          ...(city === undefined ? {} : { city }) } },
      });
    } catch (thrown) { throw safeAuthFailure(thrown, 'SIGN_UP'); }
    const { data, error } = result;
    if (error) throw safeAuthFailure(error, 'SIGN_UP');
    return { hasSession: !!data.session };
  },

  async resendSignupConfirmation(email) {
    const owner = sesijaSada();
    if (owner.user) throw new Error('Potvrda registracije je namenjena neprijavljenom nalogu.');
    const emailRedirectTo = signupConfirmationRedirect();
    if (!emailRedirectTo) throw new Error('Potvrda registracije trenutno nije dostupna. Pokušajte ponovo malo kasnije.');
    const address = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address)) throw new Error('Unesite ispravnu email adresu.');
    let error: unknown;
    try { ({ error } = await supabaseKlijent().auth.resend({ type: 'signup', email: address, options: { emailRedirectTo } })); }
    catch (thrown) {
      const current = sesijaSada();
      if (current.user || current.accountRevision !== owner.accountRevision) throw new Error('AUTH_ACCOUNT_CHANGED');
      throw safeAuthFailure(thrown, 'SIGNUP_RESEND');
    }
    const current = sesijaSada();
    if (current.user || current.accountRevision !== owner.accountRevision) throw new Error('AUTH_ACCOUNT_CHANGED');
    if (error) throw safeAuthFailure(error, 'SIGNUP_RESEND');
  },

  async sendPhoneOtp(input) {
    let error: unknown;
    try { ({ error } = await supabaseKlijent().auth.signInWithOtp(input)); }
    catch (thrown) { throw safeAuthFailure(thrown, 'PHONE_SEND'); }
    if (error) throw safeAuthFailure(error, 'PHONE_SEND');
  },

  async verifyPhoneOtp(input) {
    let error: unknown;
    try { ({ error } = await supabaseKlijent().auth.verifyOtp({ ...input, type: 'sms' })); }
    catch (thrown) { throw safeAuthFailure(thrown, 'PHONE_VERIFY'); }
    if (error) throw safeAuthFailure(error, 'PHONE_VERIFY');
  },

  async requestPasswordRecovery(email) {
    const owner = sesijaSada();
    if (owner.user) throw new PasswordRecoveryError('SIGNED_IN');
    const redirectTo = configuredRecoveryRedirect();
    if (!redirectTo) throw new PasswordRecoveryError('UNCONFIGURED');
    const address = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address)) throw new PasswordRecoveryError('INVALID_EMAIL');
    try {
      const { error } = await recoveryDeadline(() => supabaseKlijent().auth.resetPasswordForEmail(address, { redirectTo }), 'request');
      if (sesijaSada().user || sesijaSada().accountRevision !== owner.accountRevision) {
        throw new PasswordRecoveryError('ACCOUNT_CHANGED');
      }
      if (error) throw error;
    } catch (error) { throw recoveryError(error, 'request'); }
  },

  async signOutLocal(expected) {
    assertCurrentAccount(expected);
    const client = supabaseKlijent();
    const { data, error: sessionError } = await client.auth.getSession();
    assertCurrentAccount(expected);
    if (sessionError) throw sessionError;
    if (data.session?.user.id !== expected.accountId) throw new Error('AUTH_ACCOUNT_CHANGED');
    // A missing network receipt cannot indefinitely prevent local logout. A
    // successful Auth signOut removes the bound server session independently;
    // an already accepted external push cannot be recalled by either operation.
    await revokePushBeforeLogout(expected);
    assertCurrentAccount(expected);
    // Only the captured current account may begin the SDK's local logout.
    // Its Auth event, not this command or the screen, owns session cleanup.
    const { error } = await client.auth.signOut({ scope: 'local' });
    if (error) throw error;
    // The device forgets this account's Agreement message text (deep read 7.28). A storage failure never
    // blocks a logout that has already happened.
    try {
      const storage = require('@react-native-async-storage/async-storage').default;
      await forgetAgreementOutboxes(expected.accountId, storage);
      // The recent searches of Zadaci belong to this account too and go with its session.
      await storage.removeItem(recentSearchesKey(expected.accountId));
    } catch { /* the text stays where it was; the session is gone either way */ }
    // The confirmed camera place is local account context, and leaves with this session.
    try { await writeSettledMapPlace(expected.accountId, null); } catch { /* logout already succeeded */ }
    // Voice recordings and downloaded voice messages exist only as files in the private cache; every one of them goes with the session.
    // A build without the voice flag never loads the file module.
    if (voiceMessagesBuilt()) {
      try { await require('../features/voiceMessages/nativeVoiceFiles').purgeVoiceFiles(); } catch { /* the operating system evicts the cache */ }
    }
  },
};
