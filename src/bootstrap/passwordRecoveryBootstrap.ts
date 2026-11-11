import { passwordRecoveryIntent } from '../store/passwordRecoveryIntent';

interface RecoveryBrowser {
  location: Pick<Location, 'pathname' | 'hash' | 'search' | 'href' | 'replace'>;
  history: Pick<History, 'state' | 'replaceState'>;
}

/** Run before Expo Router reads location, not after it has retained a raw path. */
export function captureInitialWebRecovery(browser: RecoveryBrowser): void {
  if (browser.location.pathname !== '/oporavak' || (!browser.location.hash && !browser.location.search)) return;
  const link = browser.location.href;
  try {
    browser.history.replaceState(null, '', '/oporavak');
    passwordRecoveryIntent.publish(link);
  } catch {
    // A browser that refuses history replacement must not route credentials.
    // Lose the callback rather than persist it or fall through with its tokens.
    browser.location.replace('/oporavak');
  }
}

if (typeof window !== 'undefined' && window.location?.pathname === '/oporavak') {
  captureInitialWebRecovery(window);
}
