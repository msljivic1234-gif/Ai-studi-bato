import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { pinLabel, pinPlaces, publicPoint, type MarketplaceItem } from '../../data/marketplaceView';
import type { DiscoveryMapProps } from './DiscoveryMap.types';
import { T } from '../Text';
import { Press } from '../Press';
import { V2Action } from './V2Action';
import { useReducedMotion } from '../system/motion';
import { zadataka } from '../system/plural';
import { sys } from '../system/tokens';
import { MapCredits, MapSources } from './discovery/MapCredits';
import { PricePill } from './discovery/PricePill';

/**
 * The map on the web. A web build has no map (it is the phone's), and says so; the design lab (the Expo web server in development) draws a
 * SKETCH of one instead, so that the screen around it can be looked at: the ground and a few streets in the map's own colours, and the tasks'
 * pins where their public points fall. It is not geography: its points are spread over the room that is left between the tools and the list, and
 * nothing here moves, zooms or reads a place. It exists only while the app runs in development (`__DEV__`), and it is the same furniture as the
 * phone's (the sources above the list, a tap on the ground that closes a card), so that is what the lab can judge.
 */
const PIN_LIMIT = 60;
type Spot = { key: string; at: { lat: number; lng: number }; content: ReturnType<typeof pinLabel> | { text: string; tone: 'count'; spoken: string }; selected: boolean;
  onPress: () => void; label: string };

function useSpots(props: DiscoveryMapProps): Spot[] {
  const { items, selectedId, selectedPlace, p6Server, onSelect, onSelectPlace } = props;
  return useMemo(() => {
    const byId = new Map<string, MarketplaceItem>(items.map(item => [item.id, item]));
    if (p6Server) return p6Server.markers.slice(0, PIN_LIMIT).map(marker => {
      const task = marker.kind === 'TASK' ? byId.get(marker.taskId) : undefined;
      return { key: marker.key, at: marker.point, selected: p6Server.selectedKey === marker.key, onPress: () => p6Server.onSelect(marker),
        content: task ? pinLabel(task) : { text: String(marker.taskCount), tone: 'count' as const, spoken: zadataka(marker.taskCount) },
        label: task ? task.naslov : zadataka(marker.taskCount) };
    });
    return [...pinPlaces(items).values()].slice(0, PIN_LIMIT).map(place => {
      const one = place.ids.length === 1 ? byId.get(place.ids[0]) : undefined;
      return { key: place.key, at: place.point, selected: place.ids.length > 1 ? selectedPlace === place.key : selectedId === place.ids[0],
        onPress: () => { if (one) onSelect(one.id); else onSelectPlace?.(place.key); },
        content: one ? pinLabel(one) : { text: zadataka(place.ids.length), tone: 'count' as const, spoken: zadataka(place.ids.length) },
        label: one ? one.naslov : zadataka(place.ids.length) };
    });
  }, [items, selectedId, selectedPlace, p6Server, onSelect, onSelectPlace]);
}

function MapSketch(props: DiscoveryMapProps) {
  const reduced = useReducedMotion();
  const [frame, setFrame] = useState<{ width: number; height: number } | null>(null);
  const [sourcesOpen, setSourcesOpen] = useState(false);
  const spots = useSpots(props);
  const placed = useMemo(() => {
    if (!frame || !spots.length) return [];
    const lats = spots.map(spot => spot.at.lat), lngs = spots.map(spot => spot.at.lng);
    const [south, north, west, east] = [Math.min(...lats), Math.max(...lats), Math.min(...lngs), Math.max(...lngs)];
    // The room between the tools and where the list rests at its middle: the pins are spread over it, whatever the points are.
    const top = (props.toolsBottom ?? 0) + 48, bottom = Math.max(top + 60, frame.height * 0.58), side = 56;
    return spots.map(spot => ({ spot,
      x: east === west ? frame.width / 2 : side + (spot.at.lng - west) / (east - west) * (frame.width - 2 * side),
      y: north === south ? (top + bottom) / 2 : top + (north - spot.at.lat) / (north - south) * (bottom - top) }));
  }, [frame, spots, props.toolsBottom]);
  return <View testID="discovery-map-sketch" style={s.container}
    onLayout={event => { const { width, height } = event.nativeEvent.layout; if (width > 0 && height > 0) setFrame(current => current?.width === width && current.height === height ? current : { width, height }); }}>
    <Press accessibilityRole="button" accessibilityLabel="Mapa približnih lokacija zadatka" haptic="none" scaleTo={1} hitSlop={0}
      onPress={() => props.onClear?.()} style={StyleSheet.absoluteFill}>
      <View pointerEvents="none" style={[s.shape, s.park]} />
      <View pointerEvents="none" style={[s.shape, s.water]} />
      <View pointerEvents="none" style={[s.road, s.roadA]} />
      <View pointerEvents="none" style={[s.road, s.roadB]} />
      <View pointerEvents="none" style={[s.road, s.roadC]} />
      <View pointerEvents="none" style={[s.road, s.main, s.roadD]} />
    </Press>
    {placed.map(({ spot, x, y }) => <View key={spot.key} style={[s.pin, { left: x, top: y }]}>
      <Press accessibilityRole="button" accessibilityLabel={spot.label} haptic="none" scaleTo={1} hitSlop={0} onPress={spot.onPress}>
        <PricePill content={spot.content} selected={spot.selected} />
      </Press>
    </View>)}
    <View pointerEvents="none" style={[s.note, { top: (props.toolsBottom ?? 0) + sys.space.sm }]}>
      <T variant="label" tone="muted">Skica mape za laboratoriju</T>
    </View>
    {props.locked ? <Press testID="discovery-map-strip" accessibilityRole="button" accessibilityLabel="Prikaži više mape" accessibilityHint="Spušta listu do pola."
      haptic="none" scaleTo={1} onPress={() => props.onStripPress?.()} style={StyleSheet.absoluteFill} /> : null}
    <MapCredits bottom={props.creditsBottom} covered={props.creditsCovered || props.locked} locate={!!props.locateShown}
      onPress={() => setSourcesOpen(true)} />
    {sourcesOpen ? <MapSources reduced={reduced} onClose={() => setSourcesOpen(false)} /> : null}
  </View>;
}

export function DiscoveryMap(props: DiscoveryMapProps) {
  if (__DEV__) return <MapSketch {...props} />;
  return <View style={s.web}>
    <T variant="title" accessibilityRole="header">Mapa je dostupna u mobilnoj aplikaciji</T>
    <T variant="body">Isti zadaci i izabrani filteri su u listi.</T>
    <V2Action label="Pogledaj listu" onPress={props.onList} />
  </View>;
}

const s = StyleSheet.create({
  web: { flex: 1, padding: 24, gap: 16, justifyContent: 'center' },
  container: { flex: 1, minHeight: 180, backgroundColor: sys.map.ground, overflow: 'hidden' },
  // A pin is centred on its point: the wrapper has no size of its own, so it is moved back by half of what it holds.
  pin: { position: 'absolute', transform: [{ translateX: -48 }, { translateY: -28 }] },
  note: { position: 'absolute', left: sys.space.base },
  shape: { position: 'absolute' },
  park: { left: '6%', top: '30%', width: '34%', height: '17%', borderRadius: 40, backgroundColor: sys.map.park },
  water: { right: '-6%', top: '44%', width: '46%', height: '14%', borderRadius: 60, backgroundColor: sys.map.water },
  road: { position: 'absolute', height: 7, borderRadius: 4, backgroundColor: sys.map.road, borderWidth: 1, borderColor: sys.map.roadEdge },
  main: { height: 10, backgroundColor: sys.map.roadMajor, borderColor: sys.map.roadMajorEdge },
  roadA: { left: '-10%', top: '38%', width: '130%', transform: [{ rotate: '-14deg' }] },
  roadB: { left: '-10%', top: '24%', width: '130%', transform: [{ rotate: '9deg' }] },
  roadC: { left: '20%', top: '30%', width: '90%', transform: [{ rotate: '72deg' }] },
  roadD: { left: '-10%', top: '52%', width: '130%', transform: [{ rotate: '-4deg' }] },
});
