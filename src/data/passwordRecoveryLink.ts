import { Platform } from 'react-native';
import { PasswordRecoveryError } from '../contracts/passwordRecovery';

const NATIVE_RECOVERY_REDIRECT = 'uskociapp://oporavak';

/** Exact deployment target; no wildcard, caller-selected redirect or Expo Go URL. */
export function configuredRecoveryRedirect(): string | null {
  const raw = process.env.EXPO_PUBLIC_AUTH_RECOVERY_REDIRECT_URL;
  if (!raw) return null;
  if (Platform.OS !== 'web') return raw === NATIVE_RECOVERY_REDIRECT ? raw : null;
  if (typeof window === 'undefined') return null;
  try {
    const target = new URL(raw);
    const local = target.hostname === 'localhost' || target.hostname === '127.0.0.1';
    if ((target.protocol !== 'https:' && !(local && target.protocol === 'http:')) ||
      target.origin !== window.location.origin || target.pathname !== '/oporavak' ||
      target.username || target.password || target.search || target.hash || raw !== `${target.origin}/oporavak`) return null;
    return raw;
  } catch { return null; }
}

export function parseRecoveryCallback(link: string, redirect: string): { access_token: string; refresh_token: string } {
  const invalid = () => new PasswordRecoveryError('INVALID_LINK');
  if (link.length > 24_576) throw invalid();
  let url: URL;
  try { url = new URL(link); } catch { throw invalid(); }
  const base = `${url.protocol}//${url.host}${url.pathname}`;
  if (base !== redirect || url.username || url.password || url.search) throw invalid();
  const params = new URLSearchParams(url.hash.slice(1));
  const seen = new Set<string>();
  for (const [name] of params) {
    if (seen.has(name)) throw invalid();
    seen.add(name);
  }
  // The existing client uses the implicit flow. Do not treat signup, OAuth,
  // PKCE codes, or arbitrary URL parameters as password recovery authority.
  if (params.has('error') || params.has('error_code') || params.get('type') !== 'recovery' ||
    (params.has('token_type') && params.get('token_type') !== 'bearer')) throw invalid();
  const access_token = params.get('access_token');
  const refresh_token = params.get('refresh_token');
  if (!access_token || !refresh_token || /\s/.test(access_token + refresh_token) ||
    access_token.length > 16_384 || refresh_token.length > 4_096) throw invalid();
  return { access_token, refresh_token };
}
