import { useEffect, useRef, useState } from 'react';
import { AppState, Linking, Platform } from 'react-native';
import { createNearbyCapture, type NearbyStatus } from './nearbyCapture';
import type { NearbyCameraTarget } from '../DiscoveryMap.types';
import { loadNearbyLocation } from './nearbyLocation';
import { askForLocation } from '../../permissions/locationPermission';

export const NEARBY_COPY: Partial<Record<NearbyStatus, string>> = {
  locating: 'Tražimo Vašu lokaciju…',
  denied: 'Dozvolite lokaciju u podešavanjima ili pomerite mapu ručno.',
  'services-off': 'Lokacija je isključena na uređaju. Uključite je pa pokušajte ponovo.',
  timeout: 'Lokacija nije pronađena na vreme. Pokušajte ponovo ili pomerite mapu.',
  unavailable: 'Lokacija trenutno nije dostupna. Pokušajte ponovo ili pomerite mapu.',
  unsupported: 'U blizini je dostupno u mobilnoj aplikaciji. Ovde pomerite mapu ručno.',
};

/**
 * The target lives only in this screen's memory. Account/focus/background retirement discards it and stops capture. `me` is where the person was
 * the one time they asked ("moja lokacija"), kept for as long as this visit lasts so the map can show a dot there: one point, never a track, never
 * stored or sent, and gone with the same retirements as the target (the next capture replaces it).
 */
export function useNearbyMap(scopeKey: string, focused: boolean) {
  const [status, setStatus] = useState<NearbyStatus>('idle');
  const [located, setLocated] = useState<{ scopeKey: string; owner: object; target: NearbyCameraTarget | null; me: [number, number] } | null>(null);
  const latest = useRef({ scopeKey, focused }); latest.current = { scopeKey, focused };
  const incarnation = useRef<object | null>(null), sequence = useRef(0);
  const capture = useRef<ReturnType<typeof createNearbyCapture> | null>(null);
  const [foreground, setForeground] = useState(AppState.currentState !== 'background');
  useEffect(() => {
    const owner = {}; incarnation.current = owner;
    let active = focused && AppState.currentState !== 'background';
    const owns = () => incarnation.current === owner && active && latest.current.focused && latest.current.scopeKey === scopeKey
      && AppState.currentState !== 'background';
    const controller = createNearbyCapture({
      load: loadNearbyLocation, owns, onStatus: setStatus, beforePermission: askForLocation,
      onPoint: point => { if (owns()) setLocated({ scopeKey, owner, target: { key: ++sequence.current, center: [point.longitude, point.latitude] },
        me: [point.longitude, point.latitude] }); },
    });
    capture.current = controller;
    setStatus('idle'); setLocated(null);
    const listener = AppState.addEventListener('change', next => {
      // Native permission dialogs may report inactive on iOS. Only leaving for the background retires the attempt.
      if (next === 'background') {
        active = false; controller.cancel(); setStatus('idle'); setLocated(null); setForeground(false);
      } else if (next === 'active') { active = focused; setForeground(true); }
    });
    return () => {
      active = false; controller.cancel(); listener.remove();
      if (incarnation.current === owner) incarnation.current = null;
      if (capture.current === controller) capture.current = null;
    };
  }, [scopeKey, focused]);
  const start = () => {
    if (latest.current.scopeKey !== scopeKey || !latest.current.focused || !foreground || AppState.currentState === 'background') return false;
    if (Platform.OS === 'web') { setStatus('unsupported'); return false; }
    return capture.current?.start() ?? false;
  };
  // Camera requests are commands, not a remembered location. A native map remount must restore its normal viewport,
  // never replay a previous Nearby command. Keep only the fact that a map was requested until its first region arrives.
  const consume = (key: number) => {
    if (latest.current.scopeKey !== scopeKey || !latest.current.focused || AppState.currentState === 'background') return;
    setLocated(current => current?.scopeKey === scopeKey && current.owner === incarnation.current && current.target?.key === key
      ? { ...current, target: null } : current);
  };
  const settings = status === 'denied' || status === 'services-off' ? () => {
    if (latest.current.scopeKey !== scopeKey || !latest.current.focused || AppState.currentState === 'background') return;
    const owner = incarnation.current;
    const action = status === 'services-off' && Platform.OS === 'android'
      ? Linking.sendIntent('android.settings.LOCATION_SOURCE_SETTINGS') : Linking.openSettings();
    void action.catch(() => {
      if (owner === incarnation.current && latest.current.scopeKey === scopeKey && latest.current.focused) setStatus('unavailable');
    });
  } : undefined;
  const mapRequested = focused && foreground && located?.scopeKey === scopeKey && located.owner === incarnation.current;
  return { status, target: mapRequested ? located.target : null, me: mapRequested ? located.me : null, mapRequested, start, consume, settings,
    message: NEARBY_COPY[status], busy: status === 'locating' };
}
