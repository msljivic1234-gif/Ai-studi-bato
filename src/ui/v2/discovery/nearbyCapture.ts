/** Foreground, one-shot map centering. No storage, network, geocoder, or background location API. */
export type NearbyPoint = { latitude: number; longitude: number };
export type NearbyStatus = 'idle' | 'locating' | 'denied' | 'services-off' | 'timeout' | 'unavailable' | 'unsupported';
type Subscription = { remove: () => void };
type Position = { timestamp: number; coords: NearbyPoint };
export type NearbyLocationAdapter = {
  Accuracy: { Balanced: number };
  getForegroundPermissionsAsync: () => Promise<{ granted: boolean }>;
  requestForegroundPermissionsAsync: () => Promise<{ granted: boolean }>;
  hasServicesEnabledAsync: () => Promise<boolean>;
  watchPositionAsync: (options: { accuracy: number; distanceInterval: number; timeInterval: number; mayShowUserSettingsDialog: boolean },
    onPosition: (position: Position) => void, onError: (reason: string) => void) => Promise<Subscription>;
};
/** Includes permission/module waits, so a delayed native response cannot keep an attempt alive indefinitely. */
export const NEARBY_TIMEOUT_MS = 30_000;
type Attempt = { subscription: Subscription | null; timer: ReturnType<typeof setTimeout> | null };

export function createNearbyCapture(options: {
  load: () => Promise<NearbyLocationAdapter>; owns: () => boolean;
  onStatus: (status: NearbyStatus) => void; onPoint: (point: NearbyPoint) => void;
  /** The app's own question before the system's location window (ui/permissions/locationPermission.askForLocation). `later` means: do not
   *  read the position now and say nothing. Absent (or a permission already held) it changes nothing. */
  beforePermission?: () => Promise<'allow' | 'later'>;
}) {
  let active: Attempt | null = null;
  const remove = (subscription: Subscription | null) => {
    try { subscription?.remove(); } catch { /* Retired callbacks stay fenced even if native cleanup fails. */ }
  };
  const cancel = () => {
    const attempt = active; active = null;
    if (!attempt) return;
    if (attempt.timer !== null) clearTimeout(attempt.timer);
    attempt.timer = null;
    remove(attempt.subscription); attempt.subscription = null;
  };
  const current = (attempt: Attempt) => active === attempt && options.owns();
  const finish = (attempt: Attempt, status: NearbyStatus, point?: NearbyPoint) => {
    if (!current(attempt)) { if (active === attempt) cancel(); return; }
    cancel();
    options.onStatus(status);
    if (point) options.onPoint(point);
  };
  const start = () => {
    if (active || !options.owns()) return false;
    const attempt: Attempt = { subscription: null, timer: null }; active = attempt;
    options.onStatus('locating');
    attempt.timer = setTimeout(() => finish(attempt, 'timeout'), NEARBY_TIMEOUT_MS);
    void (async () => {
      try {
        // Called only from an explicit tap, never while the map or hook is mounting.
        const location = await options.load();
        if (!current(attempt)) return;
        // Expo's Android request delegates to an Activity even for an existing grant. On HONOR this backgrounds
        // the route and correctly retires capture. Read first; never reopen a permission window for a held grant.
        let permission = await location.getForegroundPermissionsAsync();
        if (!current(attempt)) return;
        if (!permission.granted) {
          if (options.beforePermission && (await options.beforePermission()) === 'later') { finish(attempt, 'idle'); return; }
          if (!current(attempt)) return;
          permission = await location.requestForegroundPermissionsAsync();
        }
        if (!current(attempt)) return;
        if (!permission.granted) { finish(attempt, 'denied'); return; }
        const enabled = await location.hasServicesEnabledAsync();
        if (!current(attempt)) return;
        if (!enabled) { finish(attempt, 'services-off'); return; }
        const startedAt = Date.now();
        const subscription = await location.watchPositionAsync({ accuracy: location.Accuracy.Balanced,
          distanceInterval: 0, timeInterval: 1_000, mayShowUserSettingsDialog: false }, position => {
          if (!current(attempt)) { if (active === attempt) cancel(); return; }
          const { latitude, longitude } = position.coords ?? {};
          // A watch can first deliver a cached fix: wait for a fresh one, never fall back to last-known location.
          if (!Number.isFinite(position.timestamp) || position.timestamp < startedAt || position.timestamp > Date.now() + 1_000
            || !Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return;
          finish(attempt, 'idle', { latitude, longitude });
        }, () => finish(attempt, 'unavailable'));
        // Native setup can resolve after a result, timeout or cancellation. Retire its handle immediately in every case.
        if (current(attempt)) attempt.subscription = subscription;
        else remove(subscription);
      } catch { finish(attempt, 'unavailable'); }
    })();
    return true;
  };
  return { start, cancel };
}
