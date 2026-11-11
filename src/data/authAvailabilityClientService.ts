import { configuredRecoveryRedirect } from './passwordRecoveryLink';
import { readPublicSupabaseConfig } from './publicSupabaseConfig';
import type { AuthAvailability, AuthAvailabilityPort } from '../contracts/authAvailability';

function projectSettings(raw: unknown): AuthAvailability {
  if (!raw || typeof raw !== 'object') throw new Error('AUTH_SETTINGS_INVALID');
  const settings = raw as Record<string, unknown>;
  const external = settings.external;
  if (!external || typeof external !== 'object') throw new Error('AUTH_SETTINGS_INVALID');
  const providers = external as Record<string, unknown>;
  if (typeof providers.email !== 'boolean' || typeof providers.phone !== 'boolean' ||
    typeof settings.disable_signup !== 'boolean' || typeof settings.mailer_autoconfirm !== 'boolean') {
    throw new Error('AUTH_SETTINGS_INVALID');
  }
  // Intersect public server settings with the implemented password/SMS clients.
  // OAuth flags cannot create an unimplemented Google/Apple client flow.
  return {
    emailPassword: providers.email,
    emailSignup: providers.email && !settings.disable_signup,
    phoneOtp: providers.phone,
    emailConfirmationRequired: !settings.mailer_autoconfirm,
    passwordRecovery: providers.email && configuredRecoveryRedirect() !== null,
  };
}

export const authAvailabilityClientService: AuthAvailabilityPort = {
  async read(signal) {
    const config = readPublicSupabaseConfig();
    if (!config) throw new Error('AUTH_SETTINGS_UNCONFIGURED');
    const { url, anonKey: anon } = config;
    const controller = new AbortController();
    const abort = () => controller.abort();
    if (signal?.aborted) abort();
    signal?.addEventListener('abort', abort);
    const timeout = setTimeout(abort, 10_000);
    let rejectCancelled: (() => void) | undefined;
    try {
      if (controller.signal.aborted) throw new Error('AUTH_SETTINGS_CANCELLED');
      const cancelled = new Promise<never>((_resolve, reject) => {
        rejectCancelled = () => reject(new Error('AUTH_SETTINGS_CANCELLED'));
        controller.signal.addEventListener('abort', rejectCancelled);
      });
      const request = async () => {
        const response = await fetch(`${url.replace(/\/$/, '')}/auth/v1/settings`, {
          method: 'GET', headers: { apikey: anon }, signal: controller.signal,
        });
        if (!response.ok) throw new Error('AUTH_SETTINGS_UNAVAILABLE');
        const body: unknown = await response.json();
        if (controller.signal.aborted) throw new Error('AUTH_SETTINGS_CANCELLED');
        return projectSettings(body);
      };
      // Bound even a transport/body reader that fails to honor AbortSignal.
      return await Promise.race([request(), cancelled]);
    } finally {
      clearTimeout(timeout);
      signal?.removeEventListener('abort', abort);
      if (rejectCancelled) controller.signal.removeEventListener('abort', rejectCancelled);
    }
  },
};
