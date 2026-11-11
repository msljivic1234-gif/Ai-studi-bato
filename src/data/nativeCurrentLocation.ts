import { PermissionsAndroid, Platform } from 'react-native';
import type { GeolocationPosition } from '@maplibre/maplibre-react-native';

export type CurrentLocationPoint = {
  latitude: number; longitude: number; accuracyMeters: number; capturedAt: string;
};
export type CurrentLocationResult =
  | { kind: 'POINT'; point: CurrentLocationPoint }
  | { kind: 'DENIED' | 'CANCELLED' | 'UNAVAILABLE' | 'UNSUPPORTED' };

/** One foreground observation through the already installed native MapLibre
 * location module. No geocoder, profile update, last-known-position request,
 * background listener, file or network request is started by this adapter. */
export async function captureCurrentLocation(signal: AbortSignal, current: () => boolean): Promise<CurrentLocationResult> {
  if (Platform.OS !== 'android' && Platform.OS !== 'ios') return { kind: 'UNSUPPORTED' };
  if (signal.aborted || !current()) return { kind: 'CANCELLED' };
  let LocationManager: typeof import('@maplibre/maplibre-react-native')['LocationManager'];
  try { ({ LocationManager } = await import('@maplibre/maplibre-react-native')); }
  catch { return { kind: signal.aborted || !current() ? 'CANCELLED' : 'UNAVAILABLE' }; }
  if (signal.aborted || !current()) return { kind: 'CANCELLED' };
  return new Promise(resolve => {
    let finished = false, listening = false, registering = false;
    const alive = () => !finished && !signal.aborted && current();
    const finish = (result: CurrentLocationResult) => {
      if (finished) return;
      finished = true; clearTimeout(timer); signal.removeEventListener('abort', abort);
      // Remove this observation only; another explicitly active Map view owns
      // its own listener. MapLibre stops native updates when the last one leaves.
      if (listening) {
        listening = false;
        try { LocationManager.removeListener(update); }
        catch {
          // The installed manager removes our JS listener before native stop.
          // Retry that same cleanup once; a bridge failure cannot strand the
          // caller or license publishing a sensor observation as successful.
          try { LocationManager.removeListener(update); } catch { /* no raw native error */ }
          if (result.kind === 'POINT') result = { kind: 'UNAVAILABLE' };
        }
      }
      resolve(result);
    };
    const abort = () => finish({ kind: 'CANCELLED' });
    const timer = setTimeout(() => finish({ kind: alive() ? 'UNAVAILABLE' : 'CANCELLED' }), 20_000);
    let startedAt = 0;
    const update = (value: GeolocationPosition) => {
      if (!alive()) { abort(); return; }
      if (registering) return; // MapLibre synchronously replays its cached value.
      if (!value || typeof value !== 'object') return;
      const { latitude, longitude, accuracy } = value.coords ?? {};
      // addListener may synchronously emit MapLibre's cached sample. Require
      // an observation taken after this explicit capture actually started.
      if (!Number.isFinite(value.timestamp) || value.timestamp < startedAt || value.timestamp > Date.now() + 5_000
        || !Number.isFinite(latitude) || Math.abs(latitude) > 90 || !Number.isFinite(longitude) || Math.abs(longitude) > 180
        || !Number.isFinite(accuracy) || accuracy < 0) return;
      finish({ kind: 'POINT', point: { latitude, longitude, accuracyMeters: accuracy, capturedAt: new Date(value.timestamp).toISOString() } });
    };
    signal.addEventListener('abort', abort, { once: true });
    if (!alive()) { abort(); return; }
    void (async () => {
      try {
        let permitted: boolean;
        if (Platform.OS === 'android') {
          const permissions = [
            PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
            PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION,
          ];
          const held = await Promise.all(permissions.map(permission => PermissionsAndroid.check(permission)));
          if (!alive()) { abort(); return; }
          permitted = held.some(Boolean);
          // Approximate foreground access is enough. Do not reopen Android's dialog to upgrade a held coarse grant.
          if (!permitted) {
            const permission = await PermissionsAndroid.requestMultiple(permissions);
            permitted = permission[PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION] === PermissionsAndroid.RESULTS.GRANTED
              || permission[PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION] === PermissionsAndroid.RESULTS.GRANTED;
          }
        } else permitted = await LocationManager.requestPermissions();
        // A permission dialog can finish after navigation, background, logout
        // or the deadline. It must never start a late native listener.
        if (!alive()) { abort(); return; }
        if (!permitted) { finish({ kind: 'DENIED' }); return; }
        startedAt = Date.now(); listening = true; registering = true;
        try { LocationManager.addListener(update); } finally { registering = false; }
      } catch { finish({ kind: alive() ? 'UNAVAILABLE' : 'CANCELLED' }); }
    })();
  });
}
