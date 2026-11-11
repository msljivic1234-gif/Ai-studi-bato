import type { DiscoveryV1MapMarker } from './discoveryV1MarketplaceAdapter';
import { pointKey, publicPoint, type MarketplaceItem } from './marketplaceView';
import { novac } from '../lib/novac';
import { zadataka } from '../ui/system/plural';

/** The selected card is a separate, successful EXACT_PUBLIC read, never a MAP bucket fact. */
export type DiscoveryV1ExactSelectedTask = { key: string; item: MarketplaceItem };

export function discoveryV1SelectedTaskPrice(marker: DiscoveryV1MapMarker, selectedKey: string | null,
  selectedTask: DiscoveryV1ExactSelectedTask | null | undefined): string | null {
  if (marker.kind !== 'TASK' || marker.key !== selectedKey || marker.key !== `task:${marker.taskId}`
    || selectedTask?.key !== marker.key || selectedTask.item.id !== marker.taskId) return null;
  const item = selectedTask.item, point = publicPoint(item);
  if (!point || pointKey(point) !== pointKey(marker.point) || item.rezimCene !== 'MY_PRICE') return null;
  const price = item.ponudjenaCena, amount = price?.iznos;
  if (!price || price.valuta !== 'RSD' || typeof amount !== 'number' || !Number.isSafeInteger(amount) || amount < 1 || amount > 2_147_483_647
    || price.prikaz !== novac(amount)) return null;
  const basis = item.osnovaCene === 'HOURLY' ? 'po osobi po satu' : item.osnovaCene === 'TOTAL' ? 'ukupno' : item.osnovaCene === 'PER_PERSON' ? 'po osobi' : null;
  return basis ? `${price.prikaz} ${basis}` : null;
}

/** The sprite of a capsule: the mark alone for one task, the mark and room for 1 to 4 characters of count for several. */
export type DiscoveryV1PinImage = 'p6-pin-task' | 'p6-pin-count-1' | 'p6-pin-count-2' | 'p6-pin-count-3' | 'p6-pin-count-4';

export type DiscoveryV1ServerMarkerSpec = {
  id: string;
  marker: DiscoveryV1MapMarker;
  point: DiscoveryV1MapMarker['point'];
  label: string;
  content: { text: string; tone: 'count'; spoken: string };
  selected: boolean;
  /** What the capsule shows: its sprite and the count drawn on it ('' for one task, whose capsule is its mark). */
  pin: { image: DiscoveryV1PinImage; chosenImage: `${DiscoveryV1PinImage}-chosen`; count: string };
  /**
   * Draw order (MapLibre `symbol-sort-key`, higher drawn over lower): areas under places under single tasks, and within each kind the
   * northern capsule under the southern one, as a map stacks things that overlap. Unique per bucket, so one capsule's count is never drawn
   * over another capsule. The chosen bucket is drawn on its own layer above all of them.
   */
  order: number;
};

const labelFor = (marker: DiscoveryV1MapMarker) => marker.kind === 'TASK'
  ? 'Jedan zadatak na mapi'
  : marker.kind === 'PLACE' ? zadataka(marker.taskCount) + ' na ovom mestu'
    : zadataka(marker.taskCount) + ' u ovoj oblasti';

/** The count a capsule says: exact up to 999, then "999+" (more than 999, never an invented number). */
export const discoveryV1PinCount = (marker: DiscoveryV1MapMarker) =>
  marker.kind === 'TASK' ? '' : marker.taskCount > 999 ? '999+' : String(marker.taskCount);
const imageFor = (count: string): DiscoveryV1PinImage => count === '' ? 'p6-pin-task'
  : `p6-pin-count-${Math.min(4, Math.max(1, count.length)) as 1 | 2 | 3 | 4}`;
const KIND_ORDER = { CLUSTER: 0, PLACE: 1, TASK: 2 } as const;

export function discoveryV1ServerMarkerSpecs(markers: readonly DiscoveryV1MapMarker[], selectedKey: string | null)
  : DiscoveryV1ServerMarkerSpec[] {
  if (markers.length > 256) throw new Error('DISCOVERY_V1_SERVER_MARKER_BOUND');
  const keys = new Set<string>();
  for (const marker of markers) {
    if (keys.has(marker.key)) throw new Error('DISCOVERY_V1_SERVER_MARKER_DUPLICATE');
    keys.add(marker.key);
  }
  const ranked = [...markers].sort((a, b) => KIND_ORDER[a.kind] - KIND_ORDER[b.kind] || b.point.lat - a.point.lat
    || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
  const order = new Map(ranked.map((marker, index) => [marker.key, index] as const));
  return markers.map(marker => {
    const label = labelFor(marker), count = discoveryV1PinCount(marker), image = imageFor(count);
    return { id: 'p6:' + marker.key, marker, point: { ...marker.point }, label,
      content: { text: zadataka(marker.taskCount), tone: 'count', spoken: label }, selected: selectedKey === marker.key,
      pin: { image, chosenImage: `${image}-chosen`, count }, order: order.get(marker.key)! };
  });
}
