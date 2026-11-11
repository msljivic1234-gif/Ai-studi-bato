import { useRef } from 'react';
import { DiscoveryPresentation, type DiscoveryPresentationProps, type DiscoveryV1PresentationSeam } from '../ui/v2/DiscoveryPresentation';
import type { SearchDraft } from '../ui/v2/discovery/DiscoverySearchPanel';
import type { DiscoveryV1ScreenSnapshot } from './discoveryV1ScreenSession';
import { discoveryV1ApplyOverlayItem, discoveryV1ApplyOverlays, type DiscoveryV1OverlaySnapshot } from './discoveryV1OverlayOwner';
import type { DiscoveryV1MapMarker } from './discoveryV1MarketplaceAdapter';
import { pointKey, type MarketplaceView, type PublicBounds } from './marketplaceView';
import type { DiscoveryV1SearchSnapshot } from './discoveryV1SearchOwner';
import type { DiscoveryV1Item } from './discoveryV1Contract';

export type DiscoveryV1PresentationActions = {
  onSelectMarker: (marker: DiscoveryV1MapMarker) => void;
  /** A camera move that is not the person's own settled here: the markers are read again over that region (the list is not). */
  onViewportSettled?: (bounds: PublicBounds) => void;
  /** A settled move of the person's own: `bounds` is what they can see (the list's area), `frame` the map's whole view (its buckets). */
  onArea: (bounds: PublicBounds, frame?: PublicBounds) => void;
  onClearPeek: () => void;
  onShowPlace: () => void;
  onShowAll: () => void;
  onNextPage: () => void;
  /** Retries the MAP read without replacing the current PAGE or its filters. */
  onRetryMap?: () => void;
  onSearchDraft?: (draft: SearchDraft, mapArea: PublicBounds | null) => void;
  onNextSearchPlaces?: () => void;
  /** The list shows rows `first` to `last`: their optional details are read when they are outside the window read so far. */
  onVisibleRange?: (first: number, last: number) => void;
};

const NO_PUBLISHED: ReadonlyMap<string, string> = new Map();
const publishedCache = new WeakMap<readonly DiscoveryV1Item[], ReadonlyMap<string, string>>();
/**
 * When each row of the page was published, by id, straight from the page's own rows (`publishedAt`: the server orders the page by it). The same
 * array of rows gives the same map, so a card that asks its age is not asked to draw again by a parent that merely rendered.
 */
export function discoveryV1Published(items: readonly DiscoveryV1Item[]): ReadonlyMap<string, string> {
  if (!items.length) return NO_PUBLISHED;
  const known = publishedCache.get(items);
  if (known) return known;
  const made = new Map(items.map(item => [item.id, item.publishedAt] as const));
  publishedCache.set(items, made);
  return made;
}

export type DiscoveryV1PresentationBridgeModel = {
  items: DiscoveryPresentationProps['items'];
  relations: DiscoveryPresentationProps['relations'];
  relationsPending: boolean;
  relationsError: boolean;
  view: MarketplaceView;
  p6Seam: DiscoveryV1PresentationSeam;
};

export function discoveryV1PresentationBridgeModel(snapshot: DiscoveryV1ScreenSnapshot, overlay: DiscoveryV1OverlaySnapshot,
  selectedMarkerKey: string | null, loadingMore: boolean, actions: DiscoveryV1PresentationActions,
  search?: DiscoveryV1SearchSnapshot): DiscoveryV1PresentationBridgeModel {
  if (!snapshot.active || !snapshot.view) throw new Error('DISCOVERY_V1_PRESENTATION_INACTIVE');
  const items = discoveryV1ApplyOverlays(snapshot.wireItems, overlay);
  const peekItem = snapshot.peek?.kind === 'TASK' ? discoveryV1ApplyOverlayItem(snapshot.peek.item, overlay) : null;
  const peek = snapshot.peek?.kind === 'TASK' && peekItem
    ? { key: 'task:' + peekItem.id, item: peekItem, place: [] as const,
      priceUnverified: snapshot.exactTaskId !== peekItem.id }
    : snapshot.peek?.kind === 'PLACE'
      ? { key: 'place:' + snapshot.peek.point.lat + ':' + snapshot.peek.point.lng, item: null,
        place: snapshot.peek.items.map(row => discoveryV1ApplyOverlayItem(row, overlay)),
        placeTotalCount: snapshot.peek.totalCount, priceUnverified: snapshot.verifiedPlaceKey !== pointKey(snapshot.peek.point) }
      : null;
  const selectedTask = snapshot.peek?.kind === 'TASK' && peekItem && snapshot.exactTaskId === peekItem.id
    ? { key: 'task:' + peekItem.id, item: peekItem } : null;
  return {
    items,
    relations: overlay.relations ?? undefined,
    relationsPending: overlay.loading,
    relationsError: overlay.errors.relations,
    view: snapshot.view,
    p6Seam: {
      map: { markers: snapshot.mapMarkers, selectedKey: selectedMarkerKey, selectedTask, wholeBounds: snapshot.mapWholeBounds,
        onSelect: actions.onSelectMarker, ...(actions.onViewportSettled ? { onViewportSettled: actions.onViewportSettled } : {}) },
      ...(actions.onRetryMap ? { mapRead: { ...snapshot.mapRead, onRetry: actions.onRetryMap } } : {}),
      peek,
      counts: snapshot.counts,
      // Whole-filter facts of every published task the server knows (not of the loaded page): which quick chips have anything to say.
      availability: snapshot.availability,
      published: discoveryV1Published(snapshot.wireItems),
      ...(search && actions.onSearchDraft && actions.onNextSearchPlaces ? { search: {
        snapshot: search, onDraft: actions.onSearchDraft, onNextPlaces: actions.onNextSearchPlaces,
      } } : {}),
      pageHasMore: snapshot.pageHasMore,
      loadingMore,
      onArea: actions.onArea,
      onClearPeek: actions.onClearPeek,
      onShowPlace: actions.onShowPlace,
      onShowAll: actions.onShowAll,
      onNextPage: actions.onNextPage,
      ...(actions.onVisibleRange ? { onVisibleRange: actions.onVisibleRange } : {}),
    },
  };
}

/** The same array as last time when every row is the same object, so the list's memoised work (signatures, rows) is not redone for an unchanged read. */
function useStableRows<T>(rows: readonly T[]): readonly T[] {
  const last = useRef(rows);
  const previous = last.current;
  if (previous !== rows && (previous.length !== rows.length || rows.some((row, index) => row !== previous[index]))) last.current = rows;
  return last.current;
}

export type DiscoveryV1PresentationBridgeProps =
  Omit<DiscoveryPresentationProps, 'items' | 'view' | 'relations' | 'relationsPending' | 'relationsError' | 'p6Seam'> & {
    snapshot: DiscoveryV1ScreenSnapshot;
    overlay: DiscoveryV1OverlaySnapshot;
    selectedMarkerKey: string | null;
    loadingMore?: boolean;
    search?: DiscoveryV1SearchSnapshot;
    actions: DiscoveryV1PresentationActions;
  };

/**
 * P6 integration seam over the real DiscoveryPresentation. It is not an alternate screen: the existing
 * list/sheet/search/Peek/Map components remain the UI. The Zadaci route reaches it only through DiscoveryV1Route,
 * and only in a build compiled with the P6 reader (`selectDiscoveryReader`), against a backend that carries the rollout.
 */
export function DiscoveryV1PresentationBridge({ snapshot, overlay, selectedMarkerKey, loadingMore = false, search, actions, ...props }
  : DiscoveryV1PresentationBridgeProps) {
  const model = discoveryV1PresentationBridgeModel(snapshot, overlay, selectedMarkerKey, loadingMore, actions, search);
  const items = useStableRows(model.items);
  return <DiscoveryPresentation {...props} items={items} view={model.view} relations={model.relations}
    relationsPending={model.relationsPending} relationsError={model.relationsError} p6Seam={model.p6Seam} />;
}
