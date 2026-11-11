import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { useFocusEffect } from 'expo-router';
import Constants from 'expo-constants';
import { runOnJS, useAnimatedReaction } from 'react-native-reanimated';
import { Camera, GeoJSONSource, Images, Layer, Map, ViewAnnotation, type CameraOptions, type CameraRef, type GeoJSONSourceRef, type MapRef, type ViewAnnotationRef } from '@maplibre/maplibre-react-native';
import { pinLabel, pinPlaces, pointKey, publicFeatures, publicInitialBounds, publicPoint, publicViewport, publicBounds, type MarketplaceItem, type PinPlace, type PublicBounds }
  from '../../data/marketplaceView';
import { readableTitle } from '../../data/needDetailPresentation';
import { useMapStyle, type MapStyle } from '../location/mapStyle';
import { T } from '../Text';
import { Press } from '../Press';
import { V2Action } from './V2Action';
import { sys } from '../system/tokens';
import { zadataka } from '../system/plural';
import { useReducedMotion } from '../system/motion';
import { displaysUrgent } from '../../lib/needUrgency';
import { useUrgencyClock } from './NeedUrgencyBadge';
import { pinRelationWords, PricePill, type PillContent, type PinRelation } from './discovery/PricePill';
import type { DiscoveryMapProps } from './DiscoveryMap.types';
import { DISCOVERY_V1_PIN_IMAGES, DiscoveryV1ServerMarkerLayer } from './discovery/DiscoveryV1ServerMarkerLayer';
import { clearBandBounds } from './discovery/mapClearBand';
import { MapCredits, MapSources } from './discovery/MapCredits';
import { traceDiscoveryV1 } from '../../data/discoveryV1Trace';

type Owner = { key: string; active: boolean; epoch: number };
type LoadTraceEvent = 'map-mounted' | 'deadline' | 'native-error' | 'map-loaded' | 'frame-fully' | 'retired';
/** Rich labels are bounded; every other unclustered public point still has a native USKOČI logo marker. */
export const PILL_LIMIT = 40;
const PIN_IMAGES = {
  'uskoci-task': require('../../../assets/entry-splash-mark.png'),
  ...DISCOVERY_V1_PIN_IMAGES,
};
/**
 * Half the height of a P6 capsule as drawn when chosen (42 dp at 1.06), with a little air: a chosen pin is "seen" only when all of it is
 * clear of the search tools above and of the card or sheet below.
 */
const PIN_HALF = 26;
/** A changed list reaches the native source a moment later; the visible pins are read after it. */
const PILL_SETTLE_MS = 300;
/**
 * The list follows the map (Discovery V47): this long after a move of the person's own has settled, and only if the map
 * then stays still, the visible bounds become the list's area. A pan in several strokes asks once, for where it ended.
 */
export const AREA_SETTLE_MS = 450;
/**
 * A cluster tap or "moja lokacija" moves the camera by the app's hand, so the map reports that move as the app's; it is
 * still the person's intent, and counts as theirs when it settles within this long.
 */
const INTENT_MS = 1_500;
/**
 * A P6 cluster the person opened asked the camera for its members. A slow device reports the settle of that move seconds after the tap,
 * so the settle is taken as the person's own by what it shows (the members' bounds), for this long, not only by the clock above.
 */
const CLUSTER_OPEN_MS = 10_000;
const showsBounds = (view: PublicBounds, wanted: PublicBounds) => {
  const slackX = (view[2] - view[0]) * 0.01, slackY = (view[3] - view[1]) * 0.01;
  return view[0] <= wanted[0] + slackX && view[1] <= wanted[1] + slackY && view[2] >= wanted[2] - slackX && view[3] >= wanted[3] - slackY;
};
/** A pill's own press may also reach the map as a tap on empty ground; within this long it is not one. */
const PILL_TAP_MS = 400;
const GAP = sys.space.md;
/** A public pin selection opens at neighbourhood scale; this never increases coordinate precision. */
export const NEARBY_ZOOM = 12;
/** Five kilometres each way, fitted inside the usable map; camera framing is not a strict distance filter. */
export const NEARBY_RADIUS_KM = 5;
export function nearbyCameraBounds([lng, lat]: [number, number]): PublicBounds {
  const dy = NEARBY_RADIUS_KM / 111.195;
  const dx = Math.min(180, dy / Math.max(0.01, Math.cos(lat * Math.PI / 180)));
  return [Math.max(-180, lng - dx), Math.max(-85, lat - dy), Math.min(180, lng + dx), Math.min(85, lat + dy)];
}
const sheetZoomOffset = (detent: number | undefined) => detent === 2 ? 0.8 : detent === 1 ? 0.55 : 0;
/** Camera-only regional overview when no public points, saved view or work area is available. Never a location fact or filter. */
const EMPTY_OVERVIEW_BOUNDS: PublicBounds = [18.8, 42.2, 23, 46.2];

/** A single coarse public point still needs neighbourhood context, not a maximum-zoom fit.
 * Camera only: keep server bounds, result scope, saved viewports and marker coordinates untouched. */
function initialCameraBounds(bounds: PublicBounds | null): PublicBounds | null {
  if (!bounds) return null;
  const [west, south, east, north] = bounds;
  // Wrapped bounds describe a wide dateline view, not a tiny local cluster.
  if (west > east) return bounds;
  const span = (low: number, high: number, limit: number): [number, number] => {
    if (high - low >= 0.04) return [low, high];
    const start = Math.max(-limit, Math.min(limit - 0.04, (low + high) / 2 - 0.02));
    return [start, start + 0.04];
  };
  const x = span(west, east, 180), y = span(south, north, 85);
  return [x[0], y[0], x[1], y[1]];
}

const placeWords = (place: PinPlace) => `${zadataka(place.ids.length)} na ovom mestu`;

/** Snapshot native vector paths only after the annotation has a measured view in the active rendered map. */
export function PillAnnotation({ id, point, label, content, urgent, selected, relation, onPress, nativeReady, owns }: {
  id: string; point: { lng: number; lat: number }; label: string; content: PillContent;
  urgent?: boolean; selected?: boolean; relation?: PinRelation; onPress?: () => void; nativeReady: boolean; owns: () => boolean;
}) {
  const annotation = useRef<ViewAnnotationRef>(null), draw = useRef<number | null>(null), alive = useRef(true);
  const laidOut = useRef(false), latest = useRef({ nativeReady, owns }); latest.current = { nativeReady, owns };
  useEffect(() => { alive.current = true; return () => { alive.current = false; if (draw.current !== null) cancelAnimationFrame(draw.current); }; }, []);
  const canDraw = useCallback(() => alive.current && latest.current.owns() && latest.current.nativeReady && laidOut.current && annotation.current !== null, []);
  const refreshLogo = useCallback(() => {
    if (draw.current !== null) cancelAnimationFrame(draw.current);
    draw.current = null;
    if (!canDraw()) return;
    draw.current = requestAnimationFrame(() => { draw.current = null; if (canDraw()) annotation.current?.refresh(); });
  }, [canDraw]);
  const setAnnotation = useCallback((value: ViewAnnotationRef | null) => { annotation.current = value; refreshLogo(); }, [refreshLogo]);
  const onLayout = useCallback((event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    laidOut.current = Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0;
    refreshLogo();
  }, [refreshLogo]);
  // BrandMark's paths draw synchronously into the native snapshot: no image-load event is required or fabricated.
  // A retained annotation still needs a fresh snapshot after its map reattaches or its displayed terms change.
  useEffect(refreshLogo, [nativeReady, content.text, content.tone, urgent, selected, relation, refreshLogo]);
  return <ViewAnnotation ref={setAnnotation} id={id} lngLat={[point.lng, point.lat]} anchor="center" onPress={onPress}>
    <View collapsable={false} onLayout={onLayout} accessible accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={[label, content.tone === 'count' ? '' : pinRelationWords(relation)].filter(Boolean).join(', ')}>
      <PricePill content={content} urgent={urgent} selected={selected} relation={relation} />
    </View>
  </ViewAnnotation>;
}

/** The native SDK otherwise clips an over-padded fit to about one pixel. Keep a useful window at large text. */
function boundedFitPadding(frame: { width: number; height: number }, toolsBottom: number, fitBottom: number) {
  // What is fitted keeps clear of the tools over the top of the map (the pill and its capsules) by the half of a pin; the map's sources and
  // "moja lokacija" stand above the list at the bottom and are part of `fitBottom`.
  const top = PIN_HALF + toolsBottom, bottom = 24 + fitBottom;
  const verticalBudget = Math.max(0, frame.height - Math.min(96, frame.height / 2));
  const verticalScale = Math.min(1, verticalBudget / Math.max(1, top + bottom));
  const side = Math.floor(Math.min(50, Math.max(0, (frame.width - Math.min(96, frame.width / 2)) / 2)));
  return { top: Math.floor(top * verticalScale), right: side, bottom: Math.floor(bottom * verticalScale), left: side };
}

/**
 * Uses installed MapLibre v11 GeoJSON clustering; no map input becomes a business fact. The native source carries
 * only IDs and rounded public points (`publicFeatures`); what a pin says is drawn from the current read, by ID, as a
 * price pill over the pin once the map says which pins stand on their own at this zoom. Clusters stay the native
 * circles with their count.
 */
function MapSession(props: DiscoveryMapProps & { owns: () => boolean; onRetry: () => void; mapStyle: MapStyle; onLoadStatus: (status: 'loading' | 'ready' | 'failed') => void }) {
  const relationFor = (id: string): PinRelation | undefined => {
    const answer = props.relations?.relation(id);
    return answer?.kind === 'OWNER' ? 'OWNED' : answer?.kind === 'APPLIED' ? 'APPLIED' : undefined;
  };
  const reduced = useReducedMotion(), camera = useRef<CameraRef>(null), source = useRef<GeoJSONSourceRef>(null), map = useRef<MapRef>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'failed'>('loading');
  const [listDetent, setListDetent] = useState<number | undefined>(undefined);
  const failure = useRef<'deadline' | 'native-error' | null>(null);
  const workAreaMayApply = useRef(!props.viewport);
  const traceStart = useRef(Date.now()), traced = useRef(new Set<LoadTraceEvent>());
  const traceLoad = useCallback((event: LoadTraceEvent) => {
    // Next DEV checkpoint only: six fixed events at most, elapsed time and no map/user/request data.
    if (Constants.expoConfig?.android?.package !== 'rs.uskoci.dev' || traced.current.has(event)) return;
    traced.current.add(event);
    console.info(`[USKOCI_MAP_LOAD] ${JSON.stringify([event, Math.max(0, Math.round(Date.now() - traceStart.current))])}`);
  }, []);
  const [nativeFrameReady, setNativeFrameReady] = useState(false), focused = useRef(true);
  const [focusEpoch, setFocusEpoch] = useState(0);
  // A pin preview can keep the native map alive under task details. Its camera is temporary even if the
  // server clears the selected key while the route is away; restore the person's saved area on return.
  const previewCameraActive = useRef(false);
  useFocusEffect(useCallback(() => {
    focused.current = true; setNativeFrameReady(false); setFocusEpoch(epoch => epoch + 1);
    return () => {
      focused.current = false; traceLoad('retired');
      cancelArea(); query.current++; intent.current = 0; openedCluster.current = null;
      pendingFocus.current = null; pendingServerFocus.current = null; resetSheetCamera(); setSourcesOpen(false);
    };
  }, [traceLoad]));
  const [viewport, setViewport] = useState(props.viewport);
  // Discovery V47: there is no "Pretraži ovu oblast" any more. A move of the person's own settles, the map waits
  // `AREA_SETTLE_MS`, and the list follows the bounds; a new move of theirs before that starts the wait again.
  const areaTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancelArea = () => { if (areaTimer.current) { clearTimeout(areaTimer.current); areaTimer.current = null; } };
  /** When the person last asked the camera to move by a tap (a cluster, "moja lokacija"); 0 when nothing is asked. */
  const intent = useRef(0);
  /** The members' bounds a tapped P6 cluster asked the camera to show, and when (see CLUSTER_OPEN_MS). */
  const openedCluster = useRef<{ bounds: PublicBounds; at: number } | null>(null);
  const pendingFocus = useRef<{ key: string; dataKey: string; center: [number, number]; publicationToken?: string } | null>(null);
  const pendingServerFocus = useRef<{ key: string; dataKey: string; center: [number, number] } | null>(null);
  const sheetCamera = useRef<{ detent: number | undefined; baseZoom: number | null; center: [number, number] | null }>(
    { detent: listDetent, baseZoom: null, center: null });
  const resetSheetCamera = () => { sheetCamera.current = { detent: listDetent, baseZoom: null, center: null }; };
  const retirePublicationFocus = () => {
    if (!owns()) return;
    const token = latest.current.props.publicationCameraToken;
    if (token) latest.current.props.onPublicationCameraRetired?.(token, props.scopeKey);
    pendingFocus.current = null;
    pendingServerFocus.current = null;
  };
  const manualMapIntent = () => {
    if (!owns()) return;
    workAreaMayApply.current = false;
    resetSheetCamera();
    latest.current.props.onUserIntent?.();
    retirePublicationFocus();
  };
  const settledZoom = useRef(props.viewport?.zoom ?? null);
  const fitted = useRef<number | null>(null), centeredNearby = useRef<number | null>(null);
  /** The first fit is over the very bounds the server buckets were read for, so the settle that follows it needs no second read. */
  const skipSettledRefresh = useRef(false);
  /** When a pill was last pressed, so that the same touch is not also taken as a tap on the empty map. */
  const pillTap = useRef(0);
  const [visibleIds, setVisibleIds] = useState<readonly string[]>([]);
  const [frame, setFrame] = useState<{ width: number; height: number } | null>(null);
  const frameNow = useRef(frame); frameNow.current = frame;
  const [sourcesOpen, setSourcesOpen] = useState(false);
  const mounted = useRef(true), load = useRef(status);
  const serverMap = props.p6Server ?? null;
  const data = useMemo(() => publicFeatures(props.items), [props.items]);
  const places = useMemo(() => pinPlaces(props.items), [props.items]);
  const byId = useMemo(() => new globalThis.Map(props.items.map(item => [item.id, item] as const)), [props.items]);
  const stacked = useMemo(() => !serverMap && [...places.values()].some(place => place.ids.length > 1), [serverMap, places]);
  // P6 MAP buckets already own clustering. Geometry ownership intentionally excludes selectedKey/callbacks:
  // selecting a bucket must not remount the native map or lose its viewport.
  const dataKey = useMemo(() => serverMap
    ? JSON.stringify(serverMap.markers.map(marker => marker.kind === 'TASK'
      ? [marker.kind, marker.key, marker.point, marker.taskId]
      : marker.kind === 'PLACE' ? [marker.kind, marker.key, marker.point, marker.taskCount]
        : [marker.kind, marker.key, marker.point, marker.taskCount, marker.distinctPointCount, marker.memberBounds]))
    : JSON.stringify(data), [serverMap?.markers, data]);
  const latest = useRef({ props, dataKey, places, byId }); latest.current = { props, dataKey, places, byId };
  const owns = () => mounted.current && props.owns() && latest.current.dataKey === dataKey;
  const receiveDetent = useCallback((value: number | undefined) => {
    if (mounted.current && props.owns()) setListDetent(value);
  }, [props.owns]);
  const detentSignal = props.listDetent;
  useAnimatedReaction(() => detentSignal?.value, (value, prior) => {
    if (value !== prior) runOnJS(receiveDetent)(value);
  }, [detentSignal, receiveDetent]);
  /**
   * The part of `bounds` the person can see right now: below the floating search tools and above the list sheet or a chosen pin's card. The list
   * follows this band (a task under the sheet is not one they looked at); the server buckets keep the whole view.
   */
  const seenBounds = (bounds: PublicBounds) => {
    const now = latest.current.props, height = frameNow.current?.height ?? 0;
    const bottom = Math.min(now.sheetTop ? now.sheetTop.value : height, height - Math.max(0, now.coverBottom ?? 0));
    return clearBandBounds(bounds, height, now.toolsBottom ?? 0, bottom);
  };
  // Restore the actual visible bounds. Native camera `center` is the padded target after a pin/fit move; restoring
  // that target without its old padding moves the visible geography behind the sheet. Bounds already include that
  // offset, and need no new fit to the task dataset. This constructor runs only when this map session mounts.
  // A new map gets only an unoccluded provisional bounds view: the screen's
  // first render still holds whole-window sheet estimates, so those must never be frozen into the native camera.
  const serverInitialBounds = initialCameraBounds(serverMap?.wholeBounds ?? null);
  const initialFitPending = useRef(!props.viewport);
  const [initial] = useState(() => props.viewport ? { bounds: props.viewport.bounds, padding: { top: 0, right: 0, bottom: 0, left: 0 } }
    : { bounds: (serverMap ? serverInitialBounds : publicInitialBounds(props.items)) ?? EMPTY_OVERVIEW_BOUNDS,
      padding: { top: 24, right: 50, bottom: 24, left: 50 } });
  useEffect(() => {
    mounted.current = true;
    props.onLoadStatus('loading');
    traceLoad('map-mounted');
    const timer = setTimeout(() => { if (mounted.current && props.owns() && load.current === 'loading') { traceLoad('deadline'); failure.current = 'deadline'; load.current = 'failed'; props.onLoadStatus('failed'); setStatus('failed'); } }, 15_000);
    return () => { traceLoad('retired'); mounted.current = false; clearTimeout(timer); cancelArea(); };
  }, []);
  const mark = (value: 'ready' | 'failed') => {
    if (!mounted.current || (value === 'ready' && !owns())) return;
    // The display deadline offers recovery without retiring this native map. Only its actual load success may
    // dismiss that notice; an explicit native error stays terminal and retired owners cannot recover another map.
    if (value === 'ready' && load.current === 'failed' && failure.current !== 'deadline') return;
    failure.current = value === 'failed' ? 'native-error' : null;
    load.current = value; props.onLoadStatus(value); setStatus(value);
  };
  // Which pins stand on their own at this zoom: the map's own answer, read after it settles. Only IDs come back, and
  // only IDs of the current read become pills. A failed read leaves the native logo markers.
  const query = useRef(0);
  const readVisiblePins = async () => {
    if (serverMap || !owns() || load.current !== 'ready') return;
    const ask = ++query.current;
    try {
      const features = await map.current?.queryRenderedFeatures?.({ layers: ['need-pins'] });
      if (!owns() || ask !== query.current || !Array.isArray(features)) return;
      setVisibleIds([...new Set(features.flatMap(feature => typeof feature?.properties?.needId === 'string' ? [feature.properties.needId as string] : []))]);
    } catch { /* Native logo markers remain; nothing is invented. */ }
  };
  useEffect(() => {
    if (status !== 'ready') return;
    const timer = setTimeout(() => { void readVisiblePins(); }, PILL_SETTLE_MS);
    return () => clearTimeout(timer);
  }, [dataKey, status]); // eslint-disable-line react-hooks/exhaustive-deps
  const moveCamera = (options: { center: [number, number] } & CameraOptions, duration: number): boolean => {
    const nativeCamera = camera.current;
    if (!nativeCamera) return false;
    if (reduced) nativeCamera.jumpTo(options); else nativeCamera.easeTo({ ...options, duration });
    return true;
  };
  /** Several tasks on one point are one place: its cluster opens the place instead of zooming into a single spot. */
  const stackOf = async (clusterId: number, count: number): Promise<string | null> => {
    if (!stacked || !latest.current.props.onSelectPlace || !Number.isInteger(count) || count < 2 || count > 100) return null;
    try {
      const leaves = await source.current?.getClusterLeaves?.(clusterId, count, 0);
      if (!owns() || !Array.isArray(leaves)) return null;
      const keys = new Set(leaves.map(leaf => {
        const item = typeof leaf?.properties?.needId === 'string' ? latest.current.byId.get(leaf.properties.needId) : undefined, point = item && publicPoint(item);
        return point ? pointKey(point) : null;
      }));
      const [key] = [...keys];
      return leaves.length === count && keys.size === 1 && typeof key === 'string' && (latest.current.places.get(key)?.ids.length ?? 0) > 1 ? key : null;
    } catch { return null; }
  };
  const pressFeature = async (features: GeoJSON.Feature[]) => {
    if (serverMap || !owns() || load.current !== 'ready' || !Array.isArray(features)) return;
    const feature = features[0]; if (!feature || feature.geometry?.type !== 'Point') return;
    const coordinates = feature.geometry.coordinates;
    if (!Array.isArray(coordinates) || coordinates.length < 2 || !coordinates.slice(0, 2).every(Number.isFinite) || Math.abs(coordinates[0]) > 180 || Math.abs(coordinates[1]) > 90) return;
    const properties = feature.properties;
    if (properties?.cluster === true && Number.isInteger(properties.cluster_id)) {
      initialFitPending.current = false; manualMapIntent();
      const place = await stackOf(properties.cluster_id, Number(properties.point_count));
      if (!owns() || load.current !== 'ready') return;
      if (place) { latest.current.props.onSelectPlace?.(place); return; }
      try {
        const zoom = await source.current?.getClusterExpansionZoom(properties.cluster_id);
        if (!owns() || load.current !== 'ready' || typeof zoom !== 'number' || !Number.isFinite(zoom)) return;
        // Opening a cluster is the person's move, though the camera makes it: the list follows where it lands.
        intent.current = Date.now();
        moveCamera({ center: [coordinates[0], coordinates[1]] as [number, number], zoom: Math.min(18, Math.max(0, zoom)) }, sys.motion.camera);
      } catch { /* Native source may retire during a refresh; no invented selection. */ }
    } else if (typeof properties?.needId === 'string') {
      const actual = latest.current.props.items.find(item => item.id === properties.needId), point = actual && publicPoint(actual);
      // Android reports rendered/tile geometry, which need not equal source
      // doubles. Resolve the current public item by ID; its canonical coarse
      // point owns the selected annotation. Never adopt native coordinates.
      if (point) { initialFitPending.current = false; latest.current.props.onSelect(actual.id); }
    }
  };
  const selected = props.items.find(item => item.id === props.selectedId), point = selected && publicPoint(selected);
  const selectedPlace = props.selectedPlace ? places.get(props.selectedPlace) : undefined;
  const urgencyNow = useUrgencyClock(props.items.map(item => item.urgency));
  const urgentIds = props.items.filter(item => displaysUrgent(item.urgency, urgencyNow)).map(item => item.id);
  const urgentPlace = (place: PinPlace) => place.ids.some(id => displaysUrgent(byId.get(id)?.urgency, urgencyNow));
  // A new choice gets a neighborhood view, never a tighter location: the target is still the rounded public point.
  // Native padding and zoom are applied together, avoiding a geographic offset computed at the old, possibly
  // continent-wide zoom. A closer settled/user-requested zoom survives; a choice restored on mount stays put.
  const focus = useRef<string | null>(props.publicationCameraToken || props.focusSelectionOnMount ? null
    : props.selectedPlace ? `place:${props.selectedPlace}` : props.selectedId ? `task:${props.selectedId}` : null);
  const focusToken = useRef<string | null>(null);
  useEffect(() => {
    const key = props.selectedPlace ? `place:${props.selectedPlace}` : props.selectedId ? `task:${props.selectedId}` : null;
    const publicationToken = props.publicationCameraToken ?? null;
    if (pendingFocus.current?.publicationToken && pendingFocus.current.publicationToken !== publicationToken) pendingFocus.current = null;
    if (key !== focus.current || (publicationToken && publicationToken !== focusToken.current)) {
      focus.current = key; focusToken.current = publicationToken; pendingFocus.current = null;
      const target = selectedPlace?.point ?? point;
      if (key && target && owns()) {
        initialFitPending.current = false;
        cancelArea(); intent.current = 0; openedCluster.current = null;
        pendingFocus.current = { key, dataKey, center: [target.lng, target.lat], ...(publicationToken ? { publicationToken } : {}) };
      }
    }
    const request = pendingFocus.current;
    if (!request) return;
    // Layout may arrive later. A new dataset, destination, scope or user gesture retires this one request instead of
    // replaying it over the person's next move. Consumed search/Nearby requests do not prevent later pin choices.
    if (!owns() || request.key !== key || request.dataKey !== dataKey
      || (props.fitTo && props.fitTo.key !== fitted.current)
      || (props.centerNearby && props.centerNearby.key !== centeredNearby.current)) {
      if (request.publicationToken) props.onPublicationCameraRetired?.(request.publicationToken, props.scopeKey);
      pendingFocus.current = null; return;
    }
    if (status !== 'ready' || !frame || props.cameraLayoutReady === false || !camera.current) return;
    pendingFocus.current = null;
    cancelArea(); intent.current = 0; openedCluster.current = null;
    const zoom = Math.min(18, Math.max(12, settledZoom.current ?? 12));
    const dispatched = moveCamera({ center: request.center, zoom,
      padding: boundedFitPadding(frame, props.toolsBottom ?? 0, props.focusBottom ?? 0) }, sys.motion.camera);
    if (dispatched) previewCameraActive.current = true;
    if (dispatched && request.publicationToken) props.onPublicationCameraConsumed?.(request.publicationToken, props.scopeKey);
  }, [props.selectedId, props.selectedPlace, status, frame, props.cameraLayoutReady, props.toolsBottom, props.focusBottom,
    dataKey, props.fitTo?.key, props.centerNearby?.key, props.publicationCameraToken]); // eslint-disable-line react-hooks/exhaustive-deps
  // The pins that stand on their own become pills; a point shared by several tasks is one pill that says how many.
  const pills = useMemo(() => {
    const seen = new Set<string>(), shown: PinPlace[] = [];
    for (const id of visibleIds) {
      const item = byId.get(id), at = item && publicPoint(item);
      if (!at) continue;
      const key = pointKey(at), place = places.get(key);
      if (seen.has(key) || !place) continue;
      seen.add(key); shown.push(place);
      if (shown.length >= PILL_LIMIT) break;
    }
    return shown;
  }, [visibleIds, byId, places]);
  const chosenKey = selectedPlace?.key ?? (point ? pointKey(point) : null);
  const contentOf = (place: PinPlace): PillContent => place.ids.length > 1
    ? { text: zadataka(place.ids.length), tone: 'count', spoken: placeWords(place) } : pinLabel(byId.get(place.ids[0])!);
  // There are no zoom buttons: the map is zoomed with two fingers (or a double tap), as the map apps people know are (the owner, 8 Oct 2026).
  /**
   * A P6 cluster opens the way a native one does: the camera goes into it, and the list and the map follow where it lands, because
   * opening it is the person's own move. The tap itself reads nothing: the settled region does (`onArea`), over what is then visible.
   */
  const openServerCluster = (memberBounds: PublicBounds) => {
    if (!frame || !camera.current) return;
    initialFitPending.current = false; cancelArea();
    intent.current = Date.now();
    openedCluster.current = { bounds: memberBounds, at: Date.now() };
    camera.current.fitBounds(memberBounds, { padding: boundedFitPadding(frame, props.toolsBottom ?? 0, props.fitBottom ?? 56),
      duration: reduced ? 0 : sys.motion.camera });
  };
  // A new TASK or PLACE choice centers its public point once, at neighbourhood scale or the person's closer zoom.
  // A saved choice on return stays put; later card measurements or bucket reads cannot replay the flight.
  const serverChoice = useRef<string | null>(serverMap?.selectedKey ?? null);
  useEffect(() => {
    const key = serverMap?.selectedKey ?? null;
    if (key !== serverChoice.current) {
      serverChoice.current = key; pendingServerFocus.current = null; resetSheetCamera();
      const marker = serverMap?.markers.find(candidate => candidate.key === key);
      if (key && marker && marker.kind !== 'CLUSTER') pendingServerFocus.current = { key, dataKey, center: [marker.point.lng, marker.point.lat] };
    }
    const request = pendingServerFocus.current;
    if (!request) return;
    if (!owns() || key !== request.key || request.dataKey !== dataKey || (props.fitTo && props.fitTo.key !== fitted.current)
      || (props.centerNearby && props.centerNearby.key !== centeredNearby.current)) { pendingServerFocus.current = null; return; }
    if (status !== 'ready' || !frame || props.cameraLayoutReady === false || !camera.current) return;
    pendingServerFocus.current = null; initialFitPending.current = false;
    cancelArea(); intent.current = 0; openedCluster.current = null;
    const dispatched = moveCamera({ center: request.center, zoom: Math.min(18, Math.max(NEARBY_ZOOM, settledZoom.current ?? NEARBY_ZOOM)),
      padding: boundedFitPadding(frame, props.toolsBottom ?? 0, props.coverBottom || props.focusBottom || 0) }, sys.motion.camera);
    if (dispatched) previewCameraActive.current = true;
  }, [serverMap?.selectedKey, props.coverBottom, props.focusBottom, status, frame, props.cameraLayoutReady, props.toolsBottom,
    dataKey, props.fitTo?.key, props.centerNearby?.key]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!previewCameraActive.current || serverMap?.selectedKey || props.selectedId || props.selectedPlace
      || !props.viewport || status !== 'ready' || props.cameraLayoutReady === false || !frame || !owns() || !camera.current) return;
    previewCameraActive.current = false;
    setViewport(props.viewport);
    settledZoom.current = props.viewport.zoom;
    cancelArea(); intent.current = 0; openedCluster.current = null;
    camera.current.fitBounds(props.viewport.bounds, { padding: { top: 0, right: 0, bottom: 0, left: 0 }, duration: reduced ? 0 : sys.motion.camera });
  }, [serverMap?.selectedKey, props.selectedId, props.selectedPlace, props.viewport, status, props.cameraLayoutReady, frame, focusEpoch]); // eslint-disable-line react-hooks/exhaustive-deps
  // Settled detents produce one quiet camera move, never a frame-by-frame bridge call. The same base is used for both
  // directions, so repeated opening/closing cannot accumulate zoom or center drift. A new map gesture/destination wins.
  useEffect(() => {
    const previous = sheetCamera.current, detent = listDetent;
    if (previous.detent === detent) return;
    sheetCamera.current = { ...previous, detent };
    if (detent === undefined || previous.detent === undefined || status !== 'ready' || !owns() || !viewport || !frame
      || props.cameraLayoutReady === false || initialFitPending.current || serverMap?.selectedKey || props.selectedId || props.selectedPlace
      || props.fitTo || props.centerNearby || areaTimer.current !== null || (openedCluster.current && Date.now() - openedCluster.current.at <= CLUSTER_OPEN_MS)
      || pendingServerFocus.current || pendingFocus.current) { resetSheetCamera(); return; }
    const baseZoom = previous.baseZoom ?? Math.min(18, (settledZoom.current ?? viewport.zoom) + sheetZoomOffset(previous.detent));
    const center = previous.center ?? viewport.center;
    sheetCamera.current = { detent, baseZoom, center };
    cancelArea(); intent.current = 0; openedCluster.current = null;
    moveCamera({ center, zoom: Math.max(0, baseZoom - sheetZoomOffset(detent)), padding: { top: 0, right: 0, bottom: 0, left: 0 } }, sys.motion.camera);
  }, [listDetent]); // eslint-disable-line react-hooks/exhaustive-deps
  // Exactly one first fit after BOTH native frame and screen overlays are measured. It is not a live camera binding:
  // changing rows, sheet height, tools or font size later cannot take the map away from the person's chosen view.
  useEffect(() => {
    if (!initialFitPending.current || status !== 'ready' || !owns()) return;
    if (props.initialWorkArea && workAreaMayApply.current) return;
    // A deliberate camera destination always wins, even if it is still waiting for the layout below.
    if (props.fitTo || props.centerNearby) { initialFitPending.current = false; return; }
    if (!frame || props.cameraLayoutReady === false || !camera.current) return;
    const resultBounds = serverMap ? initialCameraBounds(serverMap.wholeBounds) : publicInitialBounds(props.items);
    const bounds = resultBounds ?? EMPTY_OVERVIEW_BOUNDS;
    initialFitPending.current = false;
    cancelArea(); intent.current = 0; openedCluster.current = null;
    if (serverMap && resultBounds) skipSettledRefresh.current = true;
    camera.current.fitBounds(bounds, { padding: boundedFitPadding(frame, props.toolsBottom ?? 0, props.fitBottom ?? 56), duration: 0 });
  }, [status, frame, props.cameraLayoutReady, props.toolsBottom, props.fitBottom, dataKey, props.fitTo?.key, props.centerNearby?.key, props.initialWorkArea?.key, serverMap?.wholeBounds]); // eslint-disable-line react-hooks/exhaustive-deps
  // The route owns this optional first-camera lifetime; fields and public GeoJSON never change.
  // Remembered viewport, publication, selected pin, search, Nearby and manual gestures win.
  useEffect(() => {
    if (!owns() || !workAreaMayApply.current) return;
    if (props.selectedId || props.selectedPlace || props.publicationCameraToken || props.fitTo || props.centerNearby) {
      workAreaMayApply.current = false; return;
    }
    const request = props.initialWorkArea;
    if (!request || status !== 'ready' || !frame || props.cameraLayoutReady === false || !camera.current) return;
    const bounds = publicBounds(request.bounds);
    workAreaMayApply.current = false;
    if (bounds && bounds[0] <= bounds[2]) {
      cancelArea(); intent.current = 0; openedCluster.current = null;
      try {
        camera.current.fitBounds(bounds, { padding: boundedFitPadding(frame, props.toolsBottom ?? 0, props.fitBottom ?? 56), duration: 0 });
        initialFitPending.current = false;
      } catch { /* Optional failure leaves the existing initial-fit/retry path intact. */ }
    }
    props.onInitialWorkAreaHandled?.(request.key);
  }, [props.initialWorkArea, status, frame, props.cameraLayoutReady, props.toolsBottom, props.fitBottom,
    props.selectedId, props.selectedPlace, props.publicationCameraToken, props.fitTo, props.centerNearby]); // eslint-disable-line react-hooks/exhaustive-deps
  // A place chosen in the search: the camera brings its pins into view once, as its own move (never an area).
  useEffect(() => {
    const request = props.fitTo;
    if (status !== 'ready' || !request || fitted.current === request.key || !owns() || !frame || props.cameraLayoutReady === false) return;
    initialFitPending.current = false; retirePublicationFocus();
    fitted.current = request.key;
    resetSheetCamera();
    intent.current = 0; openedCluster.current = null;
    camera.current?.fitBounds?.(request.bounds, { padding: boundedFitPadding(frame, props.toolsBottom ?? 0, request.bottom),
      duration: reduced ? 0 : sys.motion.camera });
    props.onFitted?.(request.key);
  }, [props.fitTo?.key, status, props.cameraLayoutReady, frame]); // eslint-disable-line react-hooks/exhaustive-deps
  // "Moja lokacija": one explicit location capture fits five kilometres each way around the person,
  // with the person in the middle of the map that is left clear between the tools above and the list below. It is never a pin or a stored place.
  // The move is the person's own (they asked for it), so the list follows where it settles and shows the tasks around them (`onArea`), as it does
  // after a drag or a cluster. The dot that shows where they are is drawn by the screen's own layer (`me`), only for as long as this visit lasts.
  useEffect(() => {
    const target = props.centerNearby;
    if (status !== 'ready' || !target || target.key === centeredNearby.current || !owns() || !camera.current || !frame || props.cameraLayoutReady === false) return;
    if (target.center.length !== 2 || !target.center.every(Number.isFinite) || Math.abs(target.center[0]) > 180 || Math.abs(target.center[1]) > 90) return;
    initialFitPending.current = false; retirePublicationFocus();
    centeredNearby.current = target.key;
    resetSheetCamera();
    cancelArea(); intent.current = 0; openedCluster.current = null;
    const bounds = nearbyCameraBounds(target.center);
    camera.current.fitBounds(bounds, { padding: boundedFitPadding(frame, props.toolsBottom ?? 0, props.nearbyFitBottom ?? props.fitBottom ?? 56), duration: reduced ? 0 : sys.motion.camera });
    intent.current = Date.now();
    openedCluster.current = { bounds, at: Date.now() };
    props.onNearbyConsumed?.(target.key);
  }, [props.centerNearby, status, frame, props.cameraLayoutReady, props.toolsBottom, props.nearbyFitBottom, props.fitBottom]); // eslint-disable-line react-hooks/exhaustive-deps
  // The map's furniture (UX plan section P; the owner's phone of 8 Oct 2026): the map's sources stand at the bottom left, in the one row
  // directly ABOVE the list sheet that "moja lokacija" (drawn by the screen) ends on the right, and the row moves with the sheet. A pin's
  // card that lies over the map's bottom lifts the row above the card; when the list is all the way up no map is left and the row fades.
  // All of it is arithmetic on the UI thread (`mapControls`), none of it springs.
  const height = frame?.height ?? 0, sheetTop = props.sheetTop, locked = !!props.locked;
  // Where the person is, for as long as this visit lasts: one point, never a track (see `useNearbyMap`). A native layer, as the markers are.
  const meSource = useMemo(() => props.me ? JSON.stringify({ type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: props.me } }) : null,
    [props.me?.[0], props.me?.[1]]); // eslint-disable-line react-hooks/exhaustive-deps
  return <View style={s.container} onLayout={event => { const { width, height: tall } = event.nativeEvent.layout; if (width > 0 && tall > 0) setFrame(current => current?.width === width && current.height === tall ? current : { width, height: tall }); }}>
    {/* With the list at its full height the map is a strip: it takes no gesture and a screen reader skips it (the strip below asks for the half height). */}
    <View testID="discovery-map-box" style={s.mapBox} pointerEvents={locked ? 'none' : 'auto'} accessibilityElementsHidden={locked}
      importantForAccessibility={locked ? 'no-hide-descendants' : 'auto'}>
    <Map ref={map} style={s.map} mapStyle={props.mapStyle} androidView="texture" logo={false}
      attribution={false} tintColor={sys.color.muted}
      touchPitch={false} touchRotate={false} accessibilityLabel="Mapa približnih lokacija zadatka"
      onDidFinishLoadingMap={() => { if (owns()) traceLoad('map-loaded'); mark('ready'); void readVisiblePins(); }}
      onDidFailLoadingMap={() => { if (owns()) traceLoad('native-error'); mark('failed'); }}
      // One real native frame per focus entry, not a timer or per-frame state updates. Map readiness alone
      // may survive a detached route while its annotation bitmap is stale. Stop listening as soon as it returns.
      onDidFinishRenderingFrameFully={nativeFrameReady ? undefined : () => { if (focused.current && owns()) { traceLoad('frame-fully'); setNativeFrameReady(true); } }}
      // A tap on the map where there is no pin closes an open pin's card. A pin's press stops at its source, and a price
      // pill's own press is not taken as a tap on the ground under it.
      onPress={() => { if (owns() && load.current === 'ready' && Date.now() - pillTap.current > PILL_TAP_MS) {
        manualMapIntent(); if (serverMap) latest.current.props.p6Server?.onClear?.(); else latest.current.props.onClear?.();
      } }}
      // The person takes hold of the map again before the last move's wait is over: that move was not where they stopped.
      onRegionWillChange={event => { if (owns() && event.nativeEvent?.userInteraction === true) { initialFitPending.current = false; previewCameraActive.current = false; openedCluster.current = null; manualMapIntent(); cancelArea(); } }}
      // The region the camera settles into on first load arrives BEFORE the map reports itself
      // ready, so this guard used to throw it away — and nothing else produces a viewport. The viewport
      // is known as soon as the map says where it is; persisting that position upward still waits for ready,
      // so a neutral world overview never becomes the remembered viewport, nor the list's area.
      onRegionDidChange={event => { if (!owns()) return; const value = publicViewport(event.nativeEvent); setViewport(value);
        if (value) settledZoom.current = value.zoom;
        if (event.nativeEvent?.userInteraction === true) { initialFitPending.current = false; previewCameraActive.current = false; manualMapIntent(); }
        if (value && load.current === 'ready' && !initialFitPending.current) {
          // A pin's quiet focus is temporary preview geometry. Persisting it made Back from details reopen
          // the map at the pin's artificial zoom instead of the person's previous area. A hand-driven move
          // still becomes the new remembered viewport, even while a preview is open.
          const previewFocus = !!(previewCameraActive.current || serverMap?.selectedKey || props.selectedId || props.selectedPlace
            || pendingServerFocus.current || pendingFocus.current);
          if (!previewFocus || event.nativeEvent?.userInteraction === true) latest.current.props.onViewport(value);
          // Only the person's own move makes the list follow the map: a drag or a pinch (the map says so), or a cluster or "moja
          // lokacija" they tapped. The camera's own moves (the first fit, a chosen pin, a chosen place) never.
          const opened = openedCluster.current;
          const showsOpened = !!opened && Date.now() - opened.at <= CLUSTER_OPEN_MS && showsBounds(value.bounds, opened.bounds);
          const own = event.nativeEvent?.userInteraction === true || (intent.current > 0 && Date.now() - intent.current <= INTENT_MS) || showsOpened;
          intent.current = 0;
          if (showsOpened || (opened && Date.now() - opened.at > CLUSTER_OPEN_MS)) openedCluster.current = null;
          if (serverMap) traceDiscoveryV1('settled', showsOpened ? 'OWN_CLUSTER' : own ? 'OWN_MOVE' : 'QUIET_MOVE');
          if (own) {
            cancelArea();
            const bounds = value.bounds;
            areaTimer.current = setTimeout(() => {
              areaTimer.current = null;
              if (mounted.current && props.owns() && load.current === 'ready') latest.current.props.onArea(seenBounds(bounds), bounds);
            }, AREA_SETTLE_MS);
          } else if (serverMap) {
            // A camera move that is not the person's own (a fit, a chosen place, Nearby, a saved work area, a restored view): the list
            // stays, but the server buckets must cover what is now on screen.
            if (skipSettledRefresh.current) skipSettledRefresh.current = false;
            else latest.current.props.p6Server?.onViewportSettled?.(value.bounds);
          }
        }
        void readVisiblePins(); }}>
      <Camera ref={camera} initialViewState={initial} minZoom={0} maxZoom={18} />
      <Images images={PIN_IMAGES} />
      {/* The person's own dot (after "moja lokacija"): under the pins, so a pin is always the thing that can be touched. */}
      {meSource ? <GeoJSONSource id="me" data={meSource}>
        <Layer id="me-halo" type="circle" paint={{ 'circle-radius': 22, 'circle-color': sys.color.artRole.location.front, 'circle-opacity': 0.18 }} />
        <Layer id="me-ring" type="circle" paint={{ 'circle-radius': 10, 'circle-color': sys.color.surface }} />
        <Layer id="me-dot" type="circle" paint={{ 'circle-radius': 7, 'circle-color': sys.color.artRole.location.front }} />
      </GeoJSONSource> : null}
      {/* The SDK accepts this same JSON text; reuse it instead of re-encoding every point on each pin selection. */}
      {!serverMap ? <GeoJSONSource id="public-needs" ref={source} data={dataKey} cluster clusterRadius={60} clusterMaxZoom={16}
        hitbox={{ top: 24, right: 24, bottom: 24, left: 24 }}
        onPress={event => { event.stopPropagation(); void pressFeature(event.nativeEvent.features); }}>
        {/* The SDK exposes no annotation-rendered/error event: query/layout success cannot prove a bitmap exists.
            Keep the fallback for failed/absent pills and beyond the label budget. Its 36dp outer disk fits wholly
            inside a rich pill's 40dp solid body, so the fallback never leaves a second ring around a successful pill. */}
        <Layer id="need-clusters" type="circle" filter={['has', 'point_count']} paint={{ 'circle-radius': 20, 'circle-color': sys.color.surface, 'circle-stroke-width': 2, 'circle-stroke-color': sys.color.green }} />
        <Layer id="need-cluster-count" type="symbol" filter={['has', 'point_count']}
          layout={{ 'text-field': ['to-string', ['get', 'point_count_abbreviated']], 'text-size': 14, 'text-font': ['literal', ['Noto Sans Regular']], 'text-allow-overlap': true }} paint={{ 'text-color': sys.color.green }} />
        <Layer id="need-pins" type="circle" filter={['!', ['has', 'point_count']]}
          paint={{ 'circle-radius': 16, 'circle-color': sys.color.surface, 'circle-stroke-width': 2,
            'circle-stroke-color': ['case', ['in', ['get', 'needId'], ['literal', urgentIds]], sys.color.danger, sys.color.green] }} />
        <Layer id="need-pin-marks" type="symbol" filter={['!', ['has', 'point_count']]}
          layout={{ 'icon-image': 'uskoci-task', 'icon-size': 30 / 640, 'icon-allow-overlap': true, 'icon-ignore-placement': true }} />
      </GeoJSONSource> : null}
      {/* The server buckets are native layers, not view annotations: a bitmap of a React view needs its child laid out inside MapLibre's
          offscreen container, and none was ever drawn on the emulator (queued annotations lost their size, later ones snapshot blank). */}
      {serverMap ? <DiscoveryV1ServerMarkerLayer markers={serverMap.markers} selectedKey={serverMap.selectedKey} selectedTask={serverMap.selectedTask}
        onSelect={marker => {
          if (!owns() || load.current !== 'ready') return;
          pillTap.current = Date.now(); manualMapIntent();
          if (marker.kind === 'CLUSTER') openServerCluster(marker.memberBounds);
          latest.current.props.p6Server?.onSelect(marker);
        }} /> : null}
      {!serverMap ? pills.filter(place => place.key !== chosenKey).map(place => {
        const content = contentOf(place), urgent = urgentPlace(place);
        const relation = place.ids.length === 1 ? relationFor(place.ids[0]) : undefined;
        // The native side keys its annotations by `id`: an id that changes with the content, as the React key does, keeps
        // an insert-before-remove in one commit from leaving a dead pill behind (review r3 item 8).
        const identity = `${place.key}-${content.text}-${urgent}${relation ? `-${relation}` : ''}`;
        return <PillAnnotation key={`pill:${identity}`} id={`pill-${identity}`} point={place.point}
          content={content} urgent={urgent} relation={relation} nativeReady={status === 'ready' && nativeFrameReady} owns={owns}
          label={place.ids.length > 1 ? placeWords(place) : `${urgent ? 'HITNO, ' : ''}${readableTitle(byId.get(place.ids[0])?.naslov)}, ${content.spoken}`}
          onPress={() => { if (!owns() || load.current !== 'ready') return;
            pillTap.current = Date.now();
            if (place.ids.length > 1 && latest.current.props.onSelectPlace) latest.current.props.onSelectPlace(place.key);
            else latest.current.props.onSelect(place.ids[0]); }} />;
      }) : null}
      {!serverMap && selectedPlace ? <PillAnnotation key={`selected-place:${selectedPlace.key}`} id="selected-place" point={selectedPlace.point}
        label={`${placeWords(selectedPlace)}, izabrano`} content={contentOf(selectedPlace)} urgent={urgentPlace(selectedPlace)} selected nativeReady={status === 'ready' && nativeFrameReady} owns={owns} />
        : point && selected ? <PillAnnotation key={`selected-need:${selected.id}`} id="selected-need" point={point}
          label={`${displaysUrgent(selected.urgency, urgencyNow) ? 'HITNO, ' : ''}${readableTitle(selected.naslov)}, ${pinLabel(selected).spoken}, približna lokacija`}
          content={pinLabel(selected)} urgent={displaysUrgent(selected.urgency, urgencyNow)} relation={relationFor(selected.id)} selected nativeReady={status === 'ready' && nativeFrameReady} owns={owns} /> : null}
    </Map>
    </View>
    {locked ? <Press testID="discovery-map-strip" accessibilityRole="button" accessibilityLabel="Prikaži više mape" accessibilityHint="Spušta listu do pola."
      haptic="select" scaleTo={1} onPress={() => { if (owns()) props.onStripPress?.(); }} style={StyleSheet.absoluteFill} /> : null}
    <MapCredits bottom={props.creditsBottom} covered={props.creditsCovered || locked}
      locate={!!props.locateShown} onPress={() => { if (owns()) setSourcesOpen(true); }} />
    {sourcesOpen ? <MapSources reduced={reduced} onClose={() => setSourcesOpen(false)} /> : null}
    {status !== 'ready' ? <View style={[s.feedback, { paddingTop: (props.toolsBottom ?? 0) + 24, paddingBottom: (props.focusBottom ?? 0) + 24 }]}>
      {status === 'loading' ? <><ActivityIndicator color={sys.color.green} /><T variant="body">Učitavamo mapu…</T></>
        : <><T variant="title" accessibilityRole="alert">Mapa nije učitana</T><T variant="body">Proveri vezu. Zadaci i filteri ostaju u listi.</T>
          <V2Action label="Pokušaj ponovo sa mapom" onPress={() => { if (owns()) props.onRetry(); }} />
          {/* A screen whose list is a sheet over the map already offers the list on the sheet's own top line. */}
          {sheetTop ? null : <V2Action label="Pogledaj listu" onPress={props.onList} />}</>}</View> : null}
  </View>;
}
export function DiscoveryMap(props: DiscoveryMapProps) {
  const [owner, setOwner] = useState<Owner | null>(null), [attempt, setAttempt] = useState(0);
  const current = useRef<Owner | null>(null), epoch = useRef(0), latestKey = useRef(props.scopeKey); latestKey.current = props.scopeKey;
  const surface = useRef(0), retained = useRef(false), ready = useRef(false);
  const latestRetention = useRef(props.canRetainMap); latestRetention.current = props.canRetainMap;
  // Place names in Serbian Latin: the map mounts once its style is known (read once for the whole app).
  const mapStyle = useMapStyle();
  useFocusEffect(useCallback(() => {
    const reuse = retained.current && ready.current && latestKey.current === props.scopeKey;
    retained.current = false;
    if (!reuse) { surface.current++; ready.current = false; }
    const scope = { active: true, key: props.scopeKey, epoch: ++epoch.current }; current.current = scope; setOwner(scope);
    return () => {
      // This scope stays dead forever. A new focus gets fresh callback closures even when the native view survives.
      scope.active = false;
      if (current.current === scope) {
        current.current = null;
        retained.current = ready.current && latestKey.current === scope.key && latestRetention.current?.() === true;
      }
    };
  }, [props.scopeKey]));
  const active = !!owner?.active && owner.key === props.scopeKey && current.current === owner;
  if (!owner || owner.key !== props.scopeKey || (!active && !retained.current))
    return <View style={s.feedback}><T>Mapa je dostupna dok je ovaj pregled otvoren.</T></View>;
  if (!mapStyle) return <View style={[s.feedback, { paddingTop: (props.toolsBottom ?? 0) + 24 }]}><ActivityIndicator color={sys.color.green} /><T variant="body">Učitavamo mapu…</T></View>;
  const owns = () => current.current === owner && owner.active && latestKey.current === owner.key;
  const surfaceId = surface.current;
  return <MapSession key={`${surfaceId}:${attempt}`} {...props} mapStyle={mapStyle} owns={owns}
    onLoadStatus={status => { if (surface.current === surfaceId && latestKey.current === owner.key) ready.current = status === 'ready'; }}
    onRetry={() => { if (owns()) { ready.current = false; setAttempt(value => value + 1); } }} />;
}
const s = StyleSheet.create({ container: { flex: 1, minHeight: 180, backgroundColor: sys.color.greenSoft }, mapBox: { flex: 1 }, map: { flex: 1 },
  feedback: { ...StyleSheet.absoluteFill, padding: 24, gap: 16, justifyContent: 'center', backgroundColor: sys.color.surface },
});
