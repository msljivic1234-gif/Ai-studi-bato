import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, AppState, Linking, StyleSheet, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Camera, Map, Marker, type CameraRef, type LngLatBounds } from '@maplibre/maplibre-react-native';
import { sesijaSada, useSesija } from '../../store/sesija';
import { T } from '../Text';
import { FactArt } from '../system/FactArt';
import { sys } from '../system/tokens';
import { useReducedMotion } from '../system/motion';
import { MapCredits, MapSources } from '../v2/discovery/MapCredits';
import { V2Action } from '../v2/V2Action';
import { useMapStyle } from './mapStyle';
import { overviewDisplayPoints, type LocationOverviewMapProps, type OverviewDisplayPoint } from './LocationOverviewMap.types';
export type { LocationOverviewMapProps, LocationOverviewPoint } from './LocationOverviewMap.types';

/** A place on its own is a pin of 40; a numbered stop is a pin of 24 beside its number. */
const PIN = 40, PIN_SMALL = 24;
type Owner = { active: boolean; epoch: number; accountId: string; accountRevision: number; scopeKey: string };
type Status = 'loading' | 'ready' | 'deadline' | 'failed';
type Frame = { width: number; height: number };
const foreground = () => AppState.currentState !== 'background' && AppState.currentState !== 'inactive';

function OverviewSession({ points, owns, retry, ...props }: Omit<LocationOverviewMapProps, 'points'> & {
  points: readonly OverviewDisplayPoint[]; owns: () => boolean; retry: () => void;
}) {
  const mapStyle = useMapStyle(), reduced = useReducedMotion();
  const [sourcesOpen, setSourcesOpen] = useState(false);
  const camera = useRef<CameraRef>(null), mounted = useRef(true);
  const state = useRef<Status>('loading');
  const [status, setStatus] = useState<Status>('loading');
  const [linkError, setLinkError] = useState(false);
  const [frame, setFrame] = useState<Frame | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const latest = useRef({ owns, props }); latest.current = { owns, props };
  const current = () => mounted.current && owns();
  const fail = () => { if (current()) { state.current = 'failed'; clearTimeout(timer.current); setStatus('failed'); } };
  useEffect(() => {
    mounted.current = true;
    timer.current = setTimeout(() => {
      if (mounted.current && latest.current.owns() && state.current === 'loading') {
        state.current = 'deadline'; setStatus('deadline');
      }
    }, 15_000);
    return () => { mounted.current = false; clearTimeout(timer.current); };
  }, []);
  // Coincident stops share a numbered pin instead of hiding one another. Coordinates
  // stay unchanged; grouping happens after coarse rounding, including bounds.
  const groups = useMemo(() => {
    const values = new globalThis.Map<string, OverviewDisplayPoint[]>();
    for (const point of points) {
      const key = `${point.longitude}:${point.latitude}`;
      values.set(key, [...(values.get(key) ?? []), point]);
    }
    return [...values.values()];
  }, [points]);
  const bounds: LngLatBounds = [Math.min(...points.map(point => point.longitude)), Math.min(...points.map(point => point.latitude)),
    Math.max(...points.map(point => point.longitude)), Math.max(...points.map(point => point.latitude))];
  const zoom = props.coarse ? 10 : 15;
  const first = points[0];
  const selectedPoint = points.find(point => point.id === props.selectedId);
  useEffect(() => {
    if (!frame || status !== 'ready' || !current() || !camera.current) return;
    // Installed 11.3.10 API: flat [west,south,east,north] plus an options object.
    const padding = { top: Math.min(52, frame.height / 4), bottom: Math.min(52, frame.height / 4),
      left: Math.min(52, frame.width / 4), right: Math.min(52, frame.width / 4) };
    try {
      const center = selectedPoint ?? (groups.length === 1 ? first : undefined);
      if (center) camera.current.jumpTo({ center: [center.longitude, center.latitude], zoom, padding });
      else camera.current.fitBounds(bounds, { padding, duration: 0 });
    } catch { fail(); }
  }, [status, frame, points, props.coarse, selectedPoint, props.cameraIntent]);
  const loaded = () => {
    if (!current() || (state.current !== 'loading' && state.current !== 'deadline')) return;
    state.current = 'ready'; clearTimeout(timer.current); setStatus('ready');
  };
  const select = (group: readonly OverviewDisplayPoint[]) => {
    if (!current() || state.current !== 'ready' || !latest.current.props.interactive) return;
    const selected = group.find(point => point.id === latest.current.props.selectedId) ?? group[0];
    latest.current.props.onSelectPoint?.(selected.id);
  };
  const openCredit = async (url: string) => {
    if (!current()) return;
    setLinkError(false);
    try { await Linking.openURL(url); }
    catch { if (current()) setLinkError(true); }
  };
  const linkProblem = linkError ? <T variant="meta" accessibilityRole="alert">Veza ka izvoru mape nije otvorena. Pokušaj ponovo.</T> : null;
  return <View testID={props.testID} style={[s.container, props.height === 'fill' && s.fill]}>
    <View testID="location-overview-frame" style={[s.frame, props.height === 'fill' ? s.fill : { height: props.height }]}
      onLayout={event => {
        if (!current()) return;
        const { width, height } = event.nativeEvent.layout;
        if (Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0)
          setFrame(previous => previous?.width === width && previous.height === height ? previous : { width, height });
      }}>
      {/* Keep the owned native attempt behind the deadline notice so its actual late success can recover. */}
      {mapStyle && status !== 'failed' ? <Map style={s.map} mapStyle={mapStyle} androidView="texture"
        attribution={false} logo={false} compass={false} dragPan={props.interactive} touchZoom={props.interactive}
        doubleTapZoom={props.interactive} doubleTapHoldZoom={props.interactive} touchPitch={false} touchRotate={false}
        accessibilityLabel={props.coarse ? 'Mapa približnih mesta' : 'Mapa potvrđenih mesta'}
        onDidFinishLoadingMap={loaded} onDidFailLoadingMap={fail}>
        <Camera ref={camera} initialViewState={{ center: [first.longitude, first.latitude], zoom }} minZoom={0} maxZoom={props.coarse ? 13 : 18} />
        {groups.map((group, index) => {
          const selected = group.some(point => point.id === props.selectedId);
          const spoken = group.map(point => `${point.number}. ${point.label}`).join('; ');
          return <Marker key={`${index}:${selected}`} id={`location-overview-${index}`} lngLat={[group[0].longitude, group[0].latitude]}
            anchor={points.length > 1 ? 'center' : 'bottom'} onPress={() => select(group)}>
            <View collapsable={false} accessible accessibilityRole={props.interactive && props.onSelectPoint ? 'button' : 'image'}
              accessibilityLabel={`${props.coarse ? 'Približno mesto' : 'Potvrđeno mesto'}: ${spoken}`}
              accessibilityState={{ selected }} onAccessibilityTap={() => select(group)}
              style={points.length > 1 ? [s.pin, selected && s.selectedPin] : s.place}>
              {/* One place is a place pin and nothing else (the owner, 8 Oct 2026: "običan pin mesta"); the stops of a route are numbered pins. */}
              {points.length > 1 ? <>
                <FactArt kind="pin" size={PIN_SMALL} />
                <T variant="meta" style={[s.number, selected && s.selectedNumber]}>{group.map(point => point.number).join(', ')}</T>
              </> : <FactArt kind="pin" size={PIN} />}
            </View>
          </Marker>;
        })}
      </Map> : null}
      {status !== 'ready' ? <View style={s.feedback}>
        {status === 'loading' ? <><ActivityIndicator color={sys.color.green} accessibilityLabel="Učitavanje mape" /><T variant="meta">Učitavamo mapu…</T></>
          : <><T accessibilityRole="alert" variant="bodyStrong">Mapa nije učitana.</T>
            <V2Action label="Pokušaj ponovo sa mapom" kind="secondary" onPress={() => { if (current()) retry(); }} /></>}
      </View> : null}
      {status === 'ready' ? <MapCredits locate={false} onPress={() => {
        if (current() && state.current === 'ready') setSourcesOpen(true);
      }} /> : null}
    </View>
    {linkProblem}
    {sourcesOpen && status === 'ready' ? <MapSources reduced={reduced} onClose={() => setSourcesOpen(false)}
      onOpenUrl={url => { void openCredit(url); }} /> : null}
  </View>;
}

export function LocationOverviewMap(props: LocationOverviewMapProps) {
  const { user, accountRevision } = useSesija(), accountId = user?.id;
  const parsed = overviewDisplayPoints(props.points, props.coarse), geometryKey = JSON.stringify(parsed);
  // Equal refreshed rows must not reset a person's pan. Selection is a separate camera intent.
  const points = useMemo(() => parsed, [geometryKey]);
  // A→B→A geometry is a new rendered visit, even if its final coordinates match.
  const identity = useMemo(() => ({}), [accountId, accountRevision, props.scopeKey, props.coarse, geometryKey]);
  const latestIdentity = useRef(identity); latestIdentity.current = identity;
  const [owner, setOwner] = useState<Owner | null>(null), ownerRef = useRef<Owner | null>(null), epoch = useRef(0);
  const [attempt, setAttempt] = useState(0);
  useFocusEffect(useCallback(() => {
    const enter = (active = foreground()) => {
      if (ownerRef.current) ownerRef.current.active = false;
      const next = accountId && props.scopeKey && active ? { active: true, epoch: ++epoch.current, accountId, accountRevision, scopeKey: props.scopeKey } : null;
      ownerRef.current = next; setOwner(next);
    };
    enter();
    const subscription = AppState.addEventListener('change', value => enter(value === 'active'));
    return () => { subscription.remove(); if (ownerRef.current) ownerRef.current.active = false; ownerRef.current = null; setOwner(null); };
  }, [accountId, accountRevision, props.scopeKey]));
  const owns = () => !!owner && owner.active && ownerRef.current === owner && owner.accountId === accountId
    && owner.accountRevision === accountRevision && owner.scopeKey === props.scopeKey && latestIdentity.current === identity
    && foreground() && !!accountId && sesijaSada().user?.id === accountId && sesijaSada().accountRevision === accountRevision;
  if (!owns()) return <View testID={props.testID}><T variant="meta" tone="muted">Mapa je dostupna dok je ovaj prikaz otvoren.</T></View>;
  if (!points.length) return <View testID={props.testID} style={s.empty}><T variant="meta" tone="muted">Nema potvrđenih tačaka za prikaz na mapi.</T></View>;
  const height = props.height === 'fill' ? 'fill' : Number.isFinite(props.height) && props.height > 0 ? props.height : 240;
  return <View style={[s.container, height === 'fill' && s.fill]}>
    <OverviewSession key={`${owner!.epoch}:${attempt}:${props.coarse}:${geometryKey}`} {...props} height={height} points={points} owns={owns}
      retry={() => { if (owns()) setAttempt(value => value + 1); }} />
    {points.length !== props.points.length ? <T variant="meta" accessibilityRole="alert">Neka mesta nemaju potvrđenu tačku na mapi.</T> : null}
  </View>;
}

const s = StyleSheet.create({
  container: { gap: sys.space.xs }, frame: { backgroundColor: sys.color.wash, borderRadius: sys.radius.card, overflow: 'hidden' },
  fill: { flex: 1, minHeight: 0 },
  map: { flex: 1 }, empty: { padding: sys.space.md },
  feedback: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: sys.color.surface, alignItems: 'center', justifyContent: 'center', gap: sys.space.sm, padding: sys.space.md },
  // A place on its own is the pin and its soft shadow; a stop of a route is a white pill with a small pin and its number.
  place: { alignItems: 'center', justifyContent: 'flex-end' },
  pin: { flexDirection: 'row', alignItems: 'center', gap: sys.space.xs, minHeight: 48, paddingHorizontal: sys.space.sm, paddingVertical: sys.space.xs,
    borderRadius: sys.radius.pill, backgroundColor: sys.color.surface, borderWidth: 1, borderColor: sys.color.lineStrong, ...sys.elevation.soft },
  selectedPin: { borderWidth: 2, borderColor: sys.color.orange, backgroundColor: sys.color.surface },
  number: { color: sys.color.ink, fontWeight: '700', flexShrink: 1 }, selectedNumber: { color: sys.color.orangeInk },

});
