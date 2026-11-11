import { hasSignupReturnData, signupReturnKind } from '../data/signupConfirmationReturn';
import { signupConfirmationIntent } from '../store/signupConfirmationIntent';

interface SignupBrowser {
  location: Pick<Location, 'pathname' | 'href' | 'replace'>;
  history: Pick<History, 'replaceState'>;
}

/** Credentials must leave browser history before Expo Router reads its first location. */
export function captureInitialWebSignup(browser: SignupBrowser): void {
  if (browser.location.pathname !== '/auth') return;
  let url: URL;
  try { url = new URL(browser.location.href); } catch { return; }
  if (!hasSignupReturnData(url)) return;
  const clean = '/auth?form=login';
  const local = url.hostname === 'localhost' || url.hostname === '127.0.0.1';
  const allowed = url.protocol === 'https:' || (url.protocol === 'http:' && local);
  const kind = allowed ? signupReturnKind(url.href, `${url.origin}${clean}`) : 'INVALID_LINK';
  try {
    browser.history.replaceState(null, '', clean);
    signupConfirmationIntent.publish(kind);
  } catch {
    browser.location.replace(clean);
  }
}

if (typeof window !== 'undefined' && window.location?.pathname === '/auth') captureInitialWebSignup(window);
