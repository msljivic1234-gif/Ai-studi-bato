import type { AuthAvailability } from '../../contracts/authAvailability';
import { configuredRecoveryRedirect } from '../../data/passwordRecoveryLink';

/**
 * What the sign-in sheet offers while it does not (yet) know what the server offers.
 *
 * The check of the available ways in is a public read of the server's settings, bounded at ten seconds. Until now the whole
 * form waited for it, and when it failed ("Ne možemo da proverimo dostupne načine prijave") the form never came: a person
 * with a working connection to nothing but a slow one saw a spinner and then a locked screen (owner, on the phone and on the
 * emulator, 2026-10-07). Email and password is the way in the app always has, so it is the default; what the check finds only
 * ADDS to it (the phone) or takes something away that the server has switched off (signing up). Whatever the server then says
 * about the commands themselves (a refused sign-up, a wrong password) is said at the command, which is the one place that is
 * never a guess.
 *
 * - Email and password: on. It is the way in; a settings read that failed does not turn it off.
 * - Signing up: offered. If the server has closed it, the answer to the command says so, and a check that succeeds later hides it.
 * - Phone: off. It is only ever drawn when the server says it is on, so a failed check never shows a dead button.
 * - Confirmation of the email: expected, which is the cautious thing to say after a sign-up.
 * - Recovery of the password: on exactly when this build has the one redirect it needs (a fact of the build, not of the server).
 */
export function defaultAuthMethods(): AuthAvailability {
  return {
    emailPassword: true,
    emailSignup: true,
    phoneOtp: false,
    emailConfirmationRequired: true,
    passwordRecovery: configuredRecoveryRedirect() !== null,
  };
}
