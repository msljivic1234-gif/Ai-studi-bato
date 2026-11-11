import { memo, useEffect, useMemo } from 'react';
import { GeoJSONSource, Layer } from '@maplibre/maplibre-react-native';
import type { DiscoveryV1MapMarker } from '../../../data/discoveryV1MarketplaceAdapter';
import { discoveryV1SelectedTaskPrice, discoveryV1ServerMarkerSpecs,
  type DiscoveryV1ExactSelectedTask } from '../../../data/discoveryV1ServerMarkerPresentation';
import { traceDiscoveryV1 } from '../../../data/discoveryV1Trace';
import { sys } from '../../system/tokens';

export type DiscoveryV1ServerMarkerLayerProps = {
  markers: readonly DiscoveryV1MapMarker[];
  selectedKey: string | null;
  selectedTask?: DiscoveryV1ExactSelectedTask | null;
  onSelect: (marker: DiscoveryV1MapMarker) => void;
};

export const SERVER_MARKER_SOURCE_ID = 'p6-buckets';

/** The capsule sprites (scripts/design/generate_p6_pins.py), 4 px per dp. The map registers them with its other pin images. */
export const DISCOVERY_V1_PIN_IMAGES = {
  'p6-pin-task': require('../../../../assets/discovery/p6-pin-task.png'),
  'p6-pin-task-chosen': require('../../../../assets/discovery/p6-pin-task-chosen.png'),
  'p6-pin-count-1': require('../../../../assets/discovery/p6-pin-count-1.png'),
  'p6-pin-count-1-chosen': require('../../../../assets/discovery/p6-pin-count-1-chosen.png'),
  'p6-pin-count-2': require('../../../../assets/discovery/p6-pin-count-2.png'),
  'p6-pin-count-2-chosen': require('../../../../assets/discovery/p6-pin-count-2-chosen.png'),
  'p6-pin-count-3': require('../../../../assets/discovery/p6-pin-count-3.png'),
  'p6-pin-count-3-chosen': require('../../../../assets/discovery/p6-pin-count-3-chosen.png'),
  'p6-pin-count-4': require('../../../../assets/discovery/p6-pin-count-4.png'),
  'p6-pin-count-4-chosen': require('../../../../assets/discovery/p6-pin-count-4-chosen.png'),
} as const;
/** The sprites are drawn at 4 px per dp. */
export const PIN_ICON_SIZE = 1 / 4;
/** The chosen capsule is 6 % larger (AGENTS §3.6.7, as PricePill's SELECTED_SCALE). */
export const PIN_CHOSEN_SCALE = 1.06;
const COUNT_SIZE = 14;
/** The count's centre is 15 dp right of the capsule's centre: after the mark well, before the right padding (PricePill's geometry). */
const COUNT_OFFSET: [number, number] = [15 / COUNT_SIZE, 0];
// The count's font is a literal list: MLRNStyleValue reads a string-first array as an expression, also for text-font. A place (several tasks
// on one public point) says its count in ink, as PricePill's count does; an area says it in green, as the clusters of the map always have.
// The halo in the same colour gives the regular face the weight of PricePill's 600.

/**
 * The server's MAP buckets as native map layers: one GeoJSON point per bucket, drawn on the GL surface. A bucket is at most 256 points, and a
 * view annotation (a bitmap of a React view) is the wrong tool for that many: it needs its child laid out inside an offscreen container and
 * snapshot again on every change, and on the emulator none was ever drawn. A layer has no such dependency, survives a style swap (the source
 * is added to the new style), and needs no accessibility node of its own: the list beside the map stays the readable path to every task.
 *
 * Every bucket is the PricePill capsule (AGENTS §3.6.7): white, a hairline edge and the USKOČI mark; a task is the mark alone (the bucket
 * carries no price), a place or an area adds its count. Each capsule is one symbol, its count drawn with it, and `order` stacks them (areas,
 * then places, then single tasks; north under south), so where capsules overlap one is drawn whole over the other. The chosen bucket leaves
 * that layer for its own layer on top: the same capsule 6 % larger, with the orange edge and halo and its count in orange.
 * Only a selected TASK with an ID-matched EXACT_PUBLIC answer gains a separate price line below that capsule.
 */
export const DiscoveryV1ServerMarkerLayer = memo(function DiscoveryV1ServerMarkerLayer(props: DiscoveryV1ServerMarkerLayerProps) {
  // Validates the bound and the keys (a duplicate or an oversized set is refused, never truncated). Selection plays no part in the data.
  const specs = useMemo(() => discoveryV1ServerMarkerSpecs(props.markers, null), [props.markers]);
  const byKey = useMemo(() => new Map(props.markers.map(marker => [marker.key, marker] as const)), [props.markers]);
  const chosen = props.selectedKey ?? '';
  const selectedPrice = useMemo(() => {
    const marker = byKey.get(chosen);
    return marker ? discoveryV1SelectedTaskPrice(marker, props.selectedKey, props.selectedTask) : null;
  }, [byKey, chosen, props.selectedKey, props.selectedTask]);
  const data = useMemo(() => JSON.stringify({ type: 'FeatureCollection', features: specs.map(spec => ({
    type: 'Feature', geometry: { type: 'Point', coordinates: [spec.point.lng, spec.point.lat] },
    properties: { key: spec.marker.key, kind: spec.marker.kind, count: spec.marker.taskCount, label: spec.pin.count,
      image: spec.pin.image, chosenImage: spec.pin.chosenImage, order: spec.order,
      ...(selectedPrice && spec.marker.key === chosen ? { selectedPrice } : {}) },
  })) }), [specs, chosen, selectedPrice]);
  // DEV package only: how many buckets are on the native map.
  useEffect(() => { traceDiscoveryV1('markers', `${Math.min(specs.length, 9999)}/1`); }, [specs.length]);
  return <GeoJSONSource id={SERVER_MARKER_SOURCE_ID} data={data} hitbox={{ top: 24, right: 24, bottom: 24, left: 24 }}
    onPress={event => {
      event.stopPropagation();
      const key = event.nativeEvent?.features?.[0]?.properties?.key;
      const marker = typeof key === 'string' ? byKey.get(key) : undefined;
      if (marker) props.onSelect(marker);
    }}>
    <Layer id="p6-pins" type="symbol" filter={['!=', ['get', 'key'], chosen]}
      layout={{ 'symbol-sort-key': ['get', 'order'], 'icon-image': ['get', 'image'], 'icon-size': PIN_ICON_SIZE,
        'icon-allow-overlap': true, 'icon-ignore-placement': true,
        'text-field': ['get', 'label'], 'text-font': ['literal', ['Noto Sans Regular']], 'text-size': COUNT_SIZE, 'text-offset': COUNT_OFFSET,
        'text-allow-overlap': true, 'text-ignore-placement': true }}
      paint={{ 'text-color': ['case', ['==', ['get', 'kind'], 'CLUSTER'], sys.color.green, sys.color.ink],
        'text-halo-color': ['case', ['==', ['get', 'kind'], 'CLUSTER'], sys.color.green, sys.color.ink], 'text-halo-width': 0.4 }} />
    <Layer id="p6-chosen" type="symbol" filter={['==', ['get', 'key'], chosen]}
      layout={{ 'icon-image': ['get', 'chosenImage'], 'icon-size': PIN_ICON_SIZE * PIN_CHOSEN_SCALE,
        'icon-allow-overlap': true, 'icon-ignore-placement': true,
        'text-field': ['get', 'label'], 'text-font': ['literal', ['Noto Sans Regular']], 'text-size': COUNT_SIZE * PIN_CHOSEN_SCALE, 'text-offset': COUNT_OFFSET,
        'text-allow-overlap': true, 'text-ignore-placement': true }}
      paint={{ 'text-color': sys.color.orangeInk, 'text-halo-color': sys.color.orangeInk, 'text-halo-width': 0.4 }} />
    {selectedPrice ? <Layer id="p6-selected-price" type="symbol" filter={['==', ['get', 'key'], chosen]}
      layout={{ 'text-field': ['get', 'selectedPrice'], 'text-font': ['literal', ['Noto Sans Regular']], 'text-size': 14,
        'text-anchor': 'top', 'text-offset': [0, 2.5], 'text-max-width': 18, 'text-justify': 'center',
        'text-allow-overlap': true, 'text-ignore-placement': true }}
      paint={{ 'text-color': sys.color.orangeInk, 'text-halo-color': sys.color.surface, 'text-halo-width': 2.5 }} /> : null}
  </GeoJSONSource>;
});
