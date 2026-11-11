import * as SplashScreen from 'expo-splash-screen';

// Imported once, after recovery URL capture and before Router. Its navigation
// readiness can precede the first Entry layout, so native auto-hide is held here.
let released = false;
let request: Promise<void> | undefined;
let fallback: ReturnType<typeof setTimeout> | undefined;

export function releaseEntrySplash(): Promise<void> {
  if (released) return Promise.resolve();
  if (request) return request;
  request = Promise.resolve().then(() => SplashScreen.hideAsync()).then(() => {
    released = true;
    clearTimeout(fallback);
  }, error => {
    request = undefined;
    throw error;
  });
  return request;
}

try {
  SplashScreen.setOptions({ duration: 0, fade: false });
} catch {
  // Cosmetic bridge configuration must never stop Auth startup.
}
try {
  void SplashScreen.preventAutoHideAsync().catch(() => {});
} catch {
  // Older/unavailable bridges retain the existing route readiness fallback.
}
// Bound only the native cover, never session restoration or link verification.
// Root's real branded loader remains underneath if those are still pending.
fallback = setTimeout(() => {
  if (released) return;
  try { SplashScreen.hide(); released = true; } catch { /* Native bridge unavailable. */ }
}, 4000);
