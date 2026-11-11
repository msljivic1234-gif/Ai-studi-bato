import { Platform } from 'react-native';

const NATIVE_SIGNUP_REDIRECT = 'uskociapp://auth?form=login';

/**
 * Stable signup-confirmation destination. Native never depends on Expo Go or a caller-selected URL.
 * Supabase must still allowlist this redirect in the real project; code presence is not provider proof.
 */
export function signupConfirmationRedirect(): string | null {
  if (Platform.OS !== 'web') return NATIVE_SIGNUP_REDIRECT;
  if (typeof window === 'undefined') return null;
  try {
    const origin = window.location.origin;
    const url = new URL('/auth?form=login', origin);
    if (url.protocol !== 'https:' && !(url.hostname === 'localhost' || url.hostname === '127.0.0.1')) return null;
    return url.toString();
  } catch { return null; }
}
