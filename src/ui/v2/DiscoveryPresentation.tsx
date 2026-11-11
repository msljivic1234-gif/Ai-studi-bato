import type { WorkAreaCamera } from '../../data/discoveryWorkArea';
import type { ReadFailureReason } from '../../data/readFailure';
import { createContext, memo, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, type Context, type ReactNode } from 'react';
import { AccessibilityInfo, ActivityIndicator, Animated as NativeAnimated, BackHandler, Easing, Keyboard, Platform, StyleSheet, View, useWindowDimensions, type ListRenderItemInfo,
  type CellRendererProps, type NativeScrollEvent, type ViewToken } from 'react-native';
import * as SafeArea from 'react-native-safe-area-context';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useIsFocused } from 'expo-router';
import Animated, { runOnJS, useAnimatedReaction, useAnimatedStyle, useSharedValue, type SharedValue } from 'react-native-reanimated';
import { State as GestureState } from 'react-native-gesture-handler';
import { ANIMATION_STATUS, BottomSheetFlatList, SCROLLABLE_STATUS, SHEET_STATE, useBottomSheetInternal, useScrollEventsHandlersDefault,
  type BottomSheetFlatListMethods, type ScrollEventsHandlersHookType } from '@gorhom/bottom-sheet';
import { Crosshair } from 'phosphor-react-native';
import { atLeast, dateRange, discoveryConditions, discoveryFiltered, discoveryMapScope, discoveryShown, discoveryStartSnap, initialMarketplaceView, inBounds,
  pinPlaces, placeKey, pointKey, publicBounds, publicInitialBounds, publicPoint, remoteDiscoveryScope, sameBounds, saysWhen, saysWorkMode, undatedCount, workMode, type DiscoveryShown,
  type DiscoverySnap, type MarketplaceItem, type MarketplaceView, type PublicBounds, type WhenFilter } from '../../data/marketplaceView';
import { readSettledMapPlace, settledMapPlaceMatches, writeSettledMapPlace, type SettledMapPlace } from '../../data/confirmedDiscoveryMapPlace';
import { discoveryV1RouteIntentKey } from '../../data/discoveryV1RouteCoordinator';
import { novac } from '../../lib/novac';
import { Press } from '../Press';
import { T } from '../Text';
import { Glyph } from '../system/Glyph';
import { Appear, useAppear } from '../system/Appear';
import { useReducedMotion } from '../system/motion';
import { zadataka } from '../system/plural';
import { Surface } from '../system/Surface';
import { sys } from '../system/tokens';
import { layout } from '../system/layout';
import { DiscoveryMap } from './DiscoveryMap';
import type { DiscoveryV1ServerMapSeam, NearbyCameraTarget } from './DiscoveryMap.types';
import type { DiscoveryV1Availability, DiscoveryV1Counts } from '../../data/discoveryV1Contract';
import { DiscoveryListSheet, SNAP } from './discovery/DiscoveryListSheet';
import { DiscoveryPeek } from './discovery/DiscoveryPeek';
import { DiscoveryListState, type DiscoveryListStateKind } from './discovery/DiscoveryListState';
import { BAR_TOP, DiscoverySearchBar, ForMeNotice, NearbyNotice } from './discovery/DiscoverySearchBar';
import { DiscoveryChipRow, type QuickChip, type ScopeKey } from './discovery/DiscoveryChipRow';
import { CONTROL_SIZE, fullSheetTop } from './discovery/mapClearBand';
import { capsuleCollapse, chromeJoin } from './discovery/discoveryChrome';
import { useCoverValue, useRidingStyle } from './discovery/mapControls';
import { handleHint, listViewport, nextSheetIndex, snapHeights } from './discovery/sheetSnaps';
import { TaskAgeContext, taskAgeOf, type PublishedAt } from './discovery/taskAge';
import { useNearbyMap } from './discovery/useNearbyMap';
import { useZadaciBar, useZadaciBarMotion } from './discovery/zadaciBar';
import { DiscoverySearchPanel, type ConfirmedMapPlace, type DiscoveryV1SearchPanelSeam, type PanelMode, type SearchDraft, type SearchReadiness } from './discovery/DiscoverySearchPanel';
import { useRecentSearches } from './discovery/recentSearches';
import { DistanceFromContext } from './discovery/taskDistance';
import { CLEAR_ALL, FOR_ME_REFUSED, NEWEST_FIRST, OFF_MAP_CHIP, PRICE, QUICK_WHEN, WHEN, WHERE, WORK_PROFILE_ENTRY, countLineWords, countWords, datesWords, offMapWords,
  placesWords, said, searchWords, undatedWords } from './discovery/discoveryWords';
import { TaskCard } from './TaskCard';
import type { TaskCardRelation } from './TaskFace';
import type { TaskRelationIndex } from '../../data/taskRelation';
import { TaskPublisherPortrait } from './TaskPublisherPortrait';

/** Internal diagnosis. Route owns the exact package gate, numeric validation and per-visit limit. */
export type DiscoveryTrace = (event: 'route-trace' | 'route-focus' | 'route-blur' | 'route-open' | 'route-view' | 'focus' | 'blur'
  | 'preopen' | 'write-offset' | 'seed' | 'ready' | 'geometry' | 'index' | 'content' | 'layout' | 'restore-check'
  | 'clamp0' | 'request' | 'ack' | 'scroll0' | 'scroll' | 'scroll-reject' | 'search-change' | 'drag' | 'refresh' | 'kick' | 'stall' | 'want' | 'fit' | 'bar' | 'bar-value',
  ...values: (number | boolean)[]) => void;

export type DiscoveryV1PresentationSeam = {
  /** Server MAP geometry; legacy client GeoJSON clustering is bypassed only while this quarantined seam is supplied. */
  map: Omit<DiscoveryV1ServerMapSeam, 'onClear'>;
  /** Business MAP read only; PAGE and the native map renderer keep their own status and recovery. */
  mapRead?: { loading: boolean; error: ReadFailureReason | null; onRetry: () => void };
  /** Exact TASK or bounded POINT_MEMBERS rows already owned by the P6 screen session. */
  peek: { key: string; item: MarketplaceItem | null; place: readonly MarketplaceItem[]; placeTotalCount?: number;
    priceUnverified?: boolean } | null;
  /** Exact live PAGE counts; loaded rows may be only the first bounded pages. */
  counts: DiscoveryV1Counts | null;
  /**
   * What the server says about every published task (not the loaded page): whether any names its work mode or its days, and which price modes exist.
   * The quick chips are offered from it, so they do not come and go as the map moves. Null until a page has been read.
   */
  availability?: DiscoveryV1Availability | null;
  /**
   * When each task of the loaded page was published, by id (the page rows' own `publishedAt`). The list is ordered by it, newest first, and a card
   * may ask how old its task is (`useTaskAge`); a task not in it has no age.
   */
  published?: PublishedAt;
  /** Server-owned draft count/locality facets. Loaded PAGE rows are never used as its fallback. */
  search?: DiscoveryV1SearchPanelSeam;
  pageHasMore: boolean;
  loadingMore?: boolean;
  /** A settled move of the person's own: `bounds` is what they can see (the list's area), `frame` the map's whole view (its buckets). */
  onArea: (bounds: PublicBounds, frame?: PublicBounds) => void;
  onClearPeek: () => void;
  onShowPlace: () => void;
  onShowAll: () => void;
  onNextPage: () => void;
  /** The list shows rows `first` to `last` (indexes of `items`), so their optional details can be read. */
  onVisibleRange?: (first: number, last: number) => void;
};

export type DiscoveryPresentationProps = { items: readonly MarketplaceItem[]; loading: boolean; refreshing?: boolean; error: boolean;
  errorReason?: ReadFailureReason;
  /** An exact published row can be shown while the independent collection is incomplete. */
  collectionStatus?: 'loading' | 'error';
  /** One-shot locality fallback, never a filter, task point or GPS marker. */
  initialWorkArea?: WorkAreaCamera | null; onInitialWorkAreaHandled?: (key: string) => void;
  /** P6 task-detail return only. Native map still requires ready state and a retired interaction lease. */
  canRetainMap?: () => boolean;
  scopeKey: string; view: MarketplaceView; onView: (value: MarketplaceView) => void; onRefresh: () => void;
  /** Explicit interaction supersedes an automatic publication landing still waiting for its read. */
  onUserIntent?: () => void;
  onBack?: () => void; onOpen: (item: MarketplaceItem) => void; onProfile: () => void; onNew?: () => void; onNotifications?: () => void;
  /** A confirmed publication, resolved against a fresh public list by the route. */
  publicationFocus?: { token: string; id: string; kind: 'map' | 'list' };
  publicationUnavailable?: 'missing' | 'error'; onOpenPublishedTask?: () => void;
  /** Account-owned answers, only for the IDs the read covered. Missing coverage remains UNKNOWN. */
  relations?: TaskRelationIndex;
  /** These labels do not delay public rows, counts, map fit or the sheet's initial position. */
  relationsPending?: boolean; relationsError?: boolean;
  /** P6-only presentation seam. No production route supplies this until rollout/native gates explicitly close. */
  p6Seam?: DiscoveryV1PresentationSeam;
  /**
   * "Za mene" (the tasks that match the person's own work profile; R28): the server has the filter key (DISCOVERY-ZAMENE), and the switch "Svi zadaci | Za mene"
   * is drawn only when the route says it exists in this build (`forMeAvailable`), because a control that does nothing is not shown. The scope is the view's own
   * `forMe` unless the route owns one (`scope` and `onScope`). `forMeRefused` is set when the server refused it (no active work profile): the switch is already
   * back off, and a line under the search says why, with `onWorkProfile` as the way out and `onDismissForMeRefused` as its close.
   */
  forMeAvailable?: boolean; scope?: ScopeKey; onScope?: (scope: ScopeKey) => void;
  forMeRefused?: boolean; onWorkProfile?: () => void; onDismissForMeRefused?: () => void;
  /**
   * M-02 (UI/UX pass 2026-10-08): the list is drawn for the first time after a skeleton, so its first rows are news: the first few (at most six) arrive once, and a warm return
   * (rows kept from the last visit) or a filter that changes the rows stays still. When the route does not say, a presentation that mounted while it was still reading is the one.
   */
  arriveAfterLoading?: boolean;
  trace?: DiscoveryTrace };

const GAP = sys.space.md;
/** The row of capsules before it is measured: a 48 capsule with 2 above it and 8 under it (the air its lift needs). */
const CHIPS_ROW = 2 + 48 + sys.space.sm;
/** The tools' lower edge before it has been measured: the pill's distance from the top, the pill, the gap, and the row of capsules. */
const TOOLS_ESTIMATE = BAR_TOP + 56 + sys.space.sm + CHIPS_ROW;
/** The list at its full height stands this far under the tools (the capsules already carry 8 of air under them). */
const LIST_GAP = sys.space.xs;
/** The sheet's top line before it has been measured: the grab bar and one line of count. */
const PEEK_ESTIMATE = 68;
/**
 * While a pin's card covers the bottom of the map, the list sheet sinks to this sliver behind it (Discovery V47): its top
 * line is not a second strip under the card. Closing the card brings the top line back.
 */
export const HIDDEN = 1;
/**
 * The pin card's gap above the bottom of the screen. The card stands at the very bottom (the owner, 8 Oct 2026): the bottom navigation is away
 * while it is there, so this is 12, or the system's own inset when that is more.
 */
const CARD_BOTTOM = sys.space.md;
/**
 * The window's bottom inset (the gesture bar or the navigation keys), read from the provider's context: the screen reaches the bottom of the window
 * (the bottom navigation is drawn over it and withdraws for a selected pin), so what stands at the bottom clears that inset itself. A test double
 * that leaves the context out reads 0, as the search panel's frame does.
 */
const InsetsContext = (SafeArea as { SafeAreaInsetsContext?: Context<{ bottom: number } | null> }).SafeAreaInsetsContext;
const useBottomInset: () => number = InsetsContext ? () => useContext(InsetsContext)?.bottom ?? 0 : () => 0;
/** The list scrolled at least this far is scrolled (said in the diagnosis only). */
const SCROLLED = 8;
/** How long after the list stops moving its offset is written into the route's view, to be found again on return. */
export const OFFSET_SETTLE_MS = 250;
/** How long the list's area stays still before iOS VoiceOver hears the new count (Android hears it by the live region). */
export const AREA_ANNOUNCE_MS = 1000;
const Separator = () => <View style={s.separator} />;
/** What the list says while the next page is read (UX plan 2.16: a list of a thousand tasks is read page by page). */
export const PAGING_WORDS = 'Učitavamo još zadataka…';
const keyOf = (item: MarketplaceItem) => item.id;
/** Cells scrolled out of view are detached on Android; iOS gains nothing from it. Rows here hold no text input. */
const CLIP_OFFSCREEN = Platform.OS === 'android';
const INDEX = { peek: SNAP.peek, half: SNAP.half, full: SNAP.full } as const;
/** When the P6 sheet is nudged after it mounts (the last one is an even count, so it rests on its exact snap points), and by how much. */
const SHEET_KICKS_MS = [400, 1_200, 2_600, 5_000, 8_000, 12_000] as const;
const SHEET_KICK_PX = 0.01;
/**
 * A restore that has not been acknowledged is given this long to see the list grow or to hear the native list. Then, in this order: the same request again (React Native's
 * layout can be ahead of the native content, and a scroll past the native end lands there without any later event, also for the last exact request), the tail (`scrollToEnd`
 * renders the rows the estimate stops short of; asked only while the target is NOT reachable, since it would overshoot a reachable saved offset), and finally it settles: on
 * the saved offset when it was reachable, else where the list is.
 */
export const RESTORE_STALL_MS = 4_000;
const RESTORE_STALL_RETRIES = 2;
const SNAP_NAME: readonly DiscoverySnap[] = ['peek', 'half', 'full'];
/** Nothing to show yet (reading) or at all (a failed read). */
const NOTHING: DiscoveryShown = { mapped: [], inArea: [], withoutPoint: [], listed: [] };
type ListSection = { kind: 'map' | 'remote' | 'unlocated' | 'offMap'; label: string; count: number; partial?: boolean };
const listKind = (item: MarketplaceItem): ListSection['kind'] => publicPoint(item) ? 'map' : workMode(item) === 'remote' ? 'remote' : 'unlocated';

const DiscoveryRow = memo(function DiscoveryRow({ item, index, animate, relation, onOpen, section, portraitVisible }: {
  item: MarketplaceItem; index: number; animate: boolean; relation?: TaskCardRelation; onOpen: (item: MarketplaceItem) => void;
  portraitVisible: boolean;
  /** A real work/location group; missing public geography is not a claim of remote work. */
  section?: ListSection;
}) {
  const open = useCallback(() => onOpen(item), [onOpen, item]);
  return <>
    {section ? <View testID={`section-${section.kind}`} accessible accessibilityRole="header"
      accessibilityLabel={`${section.label}, ${section.partial ? 'učitano: ' : ''}${zadataka(section.count)}`} style={[s.section, index === 0 && s.sectionFirst]}>
      <T variant="bodyStrong" style={s.sectionTitle}>{section.label}</T><T variant="meta" style={s.sectionCount}>{section.partial ? `Učitano: ${section.count}` : section.count}</T>
    </View> : null}
    <Appear index={index} animate={animate}><TaskCard item={item} onOpen={open} relation={relation}
      portrait={portraitVisible ? <TaskPublisherPortrait item={item} size={40} /> : undefined} /></Appear>
  </>;
});

/**
 * Zadaci as one screen (owner step 4, 2026-09-24; critique A5–A7, B8–B12; Discovery V47, Airbnb's interaction in
 * USKOČI's look; recomposed on the owner's phone of 8 Oct 2026 and by the approved plan, U1 to U5). The map is the whole screen. Its top control opens Filteri;
 * the search is reached from there. The filter control names the active place or words and clears them, while quick choices toggle supported conditions directly.
 * The list and its sheet remain available below these controls in every resting position.
 *
 * The list is a sheet over the map with peek, half and full stops. A settled user move changes its AREA; camera-only moves do not.
 * A place's "Prikaži sve u listi" narrows the list to one public point, while the filter control can clear search context.
 * The list header gives the result count and a return to the map when the full sheet covers it. Main navigation remains accessible
 * at each resting stop. The route keeps the sheet, list offset and viewport for a return from task detail. A selected pin opens its
 * card above the list, and the native map retains ownership of camera and gestures.
 *
 * Own tasks remain visible with "Tvoj zadatak"; applied and unknown relationships are labeled distinctly.
 * Presentation only: every callback is the route's own guarded command.
 */
// Observe the newly mounted sheet's own state, not the previous visit's exported position or a requested index.
// Gorhom 5.2.14 locks scroll to zero until EXTENDED/FILL_PARENT; issuing scrollToOffset earlier loses the restore.
type NativeScrollWitness = { extent: number; offset: number; dragging: boolean; momentum: boolean };
type NativeListSnapshot = { ready: boolean; canRestore: boolean; gestureStarted: boolean; state: number; settledIndex: number; offset: number; command: number };
const NativeScrollContext = createContext<{ extent: number; witness: SharedValue<NativeScrollWitness>; chromeOffset: SharedValue<number>; alive: SharedValue<boolean> } | null>(null);
const useDiscoveryScrollEvents: ScrollEventsHandlersHookType = (ref, contentOffset) => {
  const defaults = useScrollEventsHandlersDefault(ref, contentOffset);
  const probe = useContext(NativeScrollContext)!;
  const { extent, witness, chromeOffset, alive } = probe;
  const { animatedSheetState, animatedScrollableStatus } = useBottomSheetInternal();
  const observe = useCallback((event: NativeScrollEvent, dragging?: boolean, momentum?: boolean) => {
    'worklet';
    if (!alive.value) return;
    const ready = animatedSheetState.value === SHEET_STATE.EXTENDED || animatedSheetState.value === SHEET_STATE.FILL_PARENT;
    const y = event.contentOffset.y;
    if (ready && animatedScrollableStatus.value === SCROLLABLE_STATUS.UNLOCKED && Number.isFinite(y)) chromeOffset.value = Math.max(0, y);
    // A LOCKED handler may itself scroll to another position: its incoming y is not evidence of that result.
    witness.value = { extent, offset: ready && animatedScrollableStatus.value === SCROLLABLE_STATUS.UNLOCKED && Number.isFinite(y)
      ? Math.max(0, y) : -1, dragging: dragging ?? witness.value.dragging, momentum: momentum ?? witness.value.momentum };
  }, [extent, witness, chromeOffset, alive, animatedSheetState, animatedScrollableStatus]);
  // Gorhom can reset (or lock) native content itself while the sheet is below FULL. Its incoming event is not
  // the resulting position. Mirror only that explicit lock target for the chrome; it never acknowledges a restore.
  const lockedChrome = useCallback((context: { shouldLockInitialPosition?: boolean; initialContentOffsetY?: number }) => {
    'worklet';
    if (alive.value && animatedScrollableStatus.value === SCROLLABLE_STATUS.LOCKED) {
      const y = context.shouldLockInitialPosition ? context.initialContentOffsetY ?? 0 : 0;
      if (Number.isFinite(y)) chromeOffset.value = Math.max(0, y);
    }
  }, [alive, animatedScrollableStatus, chromeOffset]);
  // Preserve every Gorhom handler and its context. This witness reads actual native deliveries, including hidden
  // ones; animatedScrollableState.contentOffsetY is only updated at drag/momentum boundaries in Gorhom 5.2.14.
  return useMemo<ReturnType<ScrollEventsHandlersHookType>>(() => ({
    handleOnScroll: (event, context) => { 'worklet'; defaults.handleOnScroll?.(event, context); observe(event); lockedChrome(context); },
    handleOnBeginDrag: (event, context) => { 'worklet'; defaults.handleOnBeginDrag?.(event, context); observe(event, true, false); },
    handleOnEndDrag: (event, context) => { 'worklet'; defaults.handleOnEndDrag?.(event, context); observe(event, false); lockedChrome(context); },
    handleOnMomentumBegin: (event, context) => { 'worklet'; defaults.handleOnMomentumBegin?.(event, context); observe(event, false, true); },
    handleOnMomentumEnd: (event, context) => { 'worklet'; defaults.handleOnMomentumEnd?.(event, context); observe(event, false, false); lockedChrome(context); },
  }), [defaults, observe, lockedChrome]);
};

function DiscoveryScrollReadiness({ owner, extent, command, requestedIndex, pendingRequest, onReady, chromeOffset, children }: {
  owner: number; extent: number; command: number; requestedIndex: number; pendingRequest: boolean;
  onReady: (snapshot: NativeListSnapshot) => void; children: ReactNode;
  chromeOffset: SharedValue<number>;
}) {
  // This provider is inside the keyed sheet: a native replacement can never inherit the previous list's witness.
  const witness = useSharedValue<NativeScrollWitness>({ extent: -1, offset: -1, dragging: false, momentum: false });
  const alive = useSharedValue(true);
  useEffect(() => { alive.value = true; return () => { alive.value = false; }; }, [alive]);
  const context = useMemo(() => ({ extent, witness, chromeOffset, alive }), [extent, witness, chromeOffset, alive]);
  const { animatedSheetState, animatedIndex, animatedPosition, animatedDetentsState, animatedAnimationState,
    animatedContentGestureState, animatedHandleGestureState, isInTemporaryPosition, animatedScrollableStatus } = useBottomSheetInternal();
  useAnimatedReaction(() => {
    const state = animatedSheetState.value;
    const unlocked = animatedScrollableStatus.value === SCROLLABLE_STATUS.UNLOCKED;
    const ready = unlocked && (state === SHEET_STATE.EXTENDED || state === SHEET_STATE.FILL_PARENT);
    const index = animatedIndex.value, detent = animatedDetentsState.value.detents?.[index];
    const status = animatedAnimationState.value.status;
    const content = animatedContentGestureState.value, handle = animatedHandleGestureState.value;
    const gesture = content === GestureState.BEGAN || content === GestureState.ACTIVE || handle === GestureState.BEGAN || handle === GestureState.ACTIVE;
    const idle = (status === ANIMATION_STATUS.STOPPED || status === ANIMATION_STATUS.UNDETERMINED)
      && !gesture && !isInTemporaryPosition.value;
    const settled = idle && Number.isInteger(index) && index >= 0 && detent !== undefined && Number.isFinite(detent)
      && Number.isFinite(animatedPosition.value) && Math.abs(animatedPosition.value - detent) <= 0.5;
    const observed = witness.value;
    const canRestore = ready && idle && !observed.dragging && !observed.momentum;
    return { owner, extent, command, requestedIndex, pendingRequest, state, ready, canRestore, gesture, unlocked, settledIndex: settled ? index : -1,
      offset: canRestore && settled && observed.extent === extent ? observed.offset : -1 };
  }, (next, previous) => {
    if ((!next.ready || !next.unlocked || witness.value.extent !== extent) && witness.value.offset >= 0) {
      witness.value = { ...witness.value, offset: -1 };
    }
    // Sample on focus/geometry/native settlement, not every scroll frame or React index request. Otherwise an
    // old physical stop could undo a new button command before its native animation begins.
    // Only a new native gesture observed after this exact command can supersede its explicit target.
    const gestureStarted = !!previous && next.gesture && !previous.gesture && next.command === previous.command
      && next.owner === previous.owner && next.extent === previous.extent;
    if (gestureStarted || next.ready !== previous?.ready || next.owner !== previous?.owner || next.extent !== previous?.extent
      || next.canRestore !== previous?.canRestore || next.settledIndex !== previous?.settledIndex
      || (next.command !== previous?.command && next.settledIndex >= 0 && (!next.pendingRequest || next.settledIndex === next.requestedIndex))
      || (next.offset >= 0) !== ((previous?.offset ?? -1) >= 0)) runOnJS(onReady)({ ...next, gestureStarted });
  }, [owner, extent, command, requestedIndex, pendingRequest, onReady, witness, animatedSheetState, animatedIndex, animatedPosition, animatedDetentsState,
    animatedAnimationState, animatedContentGestureState, animatedHandleGestureState, isInTemporaryPosition, animatedScrollableStatus]);
  return <NativeScrollContext.Provider value={context}>{children}</NativeScrollContext.Provider>;
}

// Keep the native cell type stable across focus owners. Context refreshes its layout handler without
// replacing the host View; a handler already queued still carries its original owner's guard.
const CellLayoutContext = createContext<{ sequence: number; receiveLayout: (index: number, bottom: number) => void } | null>(null);
function DiscoveryCell({ cellKey: _key, index, item: _item, onLayout, ...nativeProps }: CellRendererProps<MarketplaceItem>) {
  const layout = useContext(CellLayoutContext);
  return <View key={layout?.sequence} {...nativeProps} onLayout={event => {
    onLayout?.(event); // Preserve RN's own cell metrics, window expansion and viewability.
    layout?.receiveLayout(index, event.nativeEvent.layout.y + event.nativeEvent.layout.height);
  }} />;
}

/**
 * The fade of the "Mapa" pill (M-06, UI/UX pass 2026-10-08): in over `enter` and out over `exit` on the decelerating curve, with React Native's own Animated on the native driver (opacity only).
 * It used a Reanimated layout animation (`entering` and `exiting`), which the motion rules (R4, B22) keep out of everything that sits over a list. The pill stays mounted
 * while it fades out and is gone after; under reduced motion it is simply there, and simply gone.
 */
function usePillFade(shown: boolean, reduced: boolean) {
  const opacity = useRef(new NativeAnimated.Value(shown ? 1 : 0)).current;
  const [leaving, setLeaving] = useState(false);
  const was = useRef(shown);
  useEffect(() => {
    // Only a change of state is animated: a pill that is there when the screen opens is simply there, and one that is not there leaves nothing behind.
    const changed = was.current !== shown; was.current = shown;
    if (reduced || !changed) { opacity.setValue(shown ? 1 : 0); setLeaving(false); return; }
    setLeaving(!shown);
    const run = NativeAnimated.timing(opacity, { toValue: shown ? 1 : 0, duration: shown ? sys.motion.enter : sys.motion.exit,
      easing: Easing.bezier(...sys.motion.easeOut), useNativeDriver: true });
    run.start(() => { if (!shown) setLeaving(false); });
    return () => { run.stop(); if (!shown) setLeaving(false); };
  }, [shown, reduced, opacity]);
  return { opacity, mounted: shown || leaving };
}

export function DiscoveryPresentation(props: DiscoveryPresentationProps) {
  const { items, loading, error, refreshing = false } = props, view = remoteDiscoveryScope(props.view), reduced = useReducedMotion(), focused = useIsFocused();
  const pendingFacetPlace = useRef<{ scopeKey: string; place: string; intentKey: string } | null>(null);
  const userIntent = useCallback(() => { pendingFacetPlace.current = null; props.onUserIntent?.(); }, [props.onUserIntent]);
  const placeAccount = props.scopeKey.split(':')[0];
  const [activeMapPlace, setActiveMapPlace] = useState<{ scopeKey: string; place: ConfirmedMapPlace | null } | null>(null);
  const [restoredMapPlace, setRestoredMapPlace] = useState<{ scopeKey: string; place: SettledMapPlace | null } | null>(null);
  const placeMutation = useRef(0);
  const pendingMapPlace = useRef<{ scopeKey: string; place: ConfirmedMapPlace } | null>(null);
  const p6PlaceStorage = !!props.p6Seam;
  useEffect(() => {
    if (!p6PlaceStorage) return;
    let current = true;
    const mutation = placeMutation.current;
    setRestoredMapPlace({ scopeKey: props.scopeKey, place: null });
    void readSettledMapPlace(placeAccount).then(place => {
      if (current && placeMutation.current === mutation) setRestoredMapPlace({ scopeKey: props.scopeKey, place });
    }, () => {
      if (current && placeMutation.current === mutation) setRestoredMapPlace({ scopeKey: props.scopeKey, place: null });
    });
    return () => { current = false; };
  }, [placeAccount, props.scopeKey, p6PlaceStorage]);
  const savedPlace = restoredMapPlace?.scopeKey === props.scopeKey && settledMapPlaceMatches(restoredMapPlace.place, view.area)
    ? restoredMapPlace.place : null;
  const appliedMapPlace = activeMapPlace?.scopeKey === props.scopeKey ? activeMapPlace.place : savedPlace;
  const setAppliedMapPlace = (place: ConfirmedMapPlace | null) => {
    placeMutation.current++;
    setActiveMapPlace({ scopeKey: props.scopeKey, place });
    if (p6PlaceStorage) {
      const mayBeStored = (activeMapPlace?.scopeKey === props.scopeKey && !!activeMapPlace.place)
        || restoredMapPlace?.scopeKey !== props.scopeKey || !!restoredMapPlace.place;
      setRestoredMapPlace({ scopeKey: props.scopeKey, place: null });
      if (mayBeStored) void writeSettledMapPlace(placeAccount, null).catch(() => undefined);
    }
  };
  const rememberSettledMapPlace = (place: ConfirmedMapPlace, area: PublicBounds) => {
    const settled: SettledMapPlace = { ...place, area: [...area] as PublicBounds };
    placeMutation.current++;
    setRestoredMapPlace({ scopeKey: props.scopeKey, place: settled });
    if (p6PlaceStorage) void writeSettledMapPlace(placeAccount, settled).catch(() => undefined);
  };
  const traceRef = useRef(props.trace); traceRef.current = props.trace;
  const trace = useCallback<DiscoveryTrace>((...args) => traceRef.current?.(...args), []);
  const traceState = useRef({ scrolled: false, index: -1 });
  const nearby = useNearbyMap(props.scopeKey, focused);
  const { width: windowWidth, height: windowHeight, fontScale } = useWindowDimensions();
  // The navigator owns the bar: it withdraws at the map's lowered PEEK stop and returns at HALF/FULL.
  // Only the Android system inset is reserved under the count at PEEK.
  const bar = useZadaciBar(), barHeight = bar?.height ?? 0, bottomInset = useBottomInset();
  // A selected pin takes over the map's bottom edge. Its preview clears the Android gesture area,
  // while the tab bar leaves the screen; reserving the bar's height here stranded the card mid-map.
  const cardBottom = Math.max(CARD_BOTTOM, bottomInset);
  const relations = props.relations;
  const pending = !!props.relationsPending;
  // Every change goes through the route's latest guarded `onView`, and two changes in one turn (a chip that also closes a
  // pin's card) build on each other, not on the same render's view.
  const latestView = useRef(view); latestView.current = view;
  const onViewRef = useRef(props.onView); onViewRef.current = props.onView;
  const change = useCallback((patch: Partial<MarketplaceView>) => {
    const next = remoteDiscoveryScope({ ...latestView.current, ...patch });
    latestView.current = next;
    onViewRef.current(next);
  }, []);
  // The list's scroll offset, written into the route's view a moment after the list stops (see the list below).
  const offset = useRef(view.listOffset ?? 0), offsetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const writeOffset = useCallback(() => {
    offsetTimer.current = null;
    const at = Math.round(offset.current);
    trace('write-offset', latestView.current.listOffset ?? 0, at);
    if (Math.abs((latestView.current.listOffset ?? 0) - at) > 1) change({ listOffset: at });
  }, [change, trace]);
  // The route hands down a fresh `onOpen` closure on every render (its guards read the latest read); rows get one
  // stable function that calls whatever is current at press time. A scroll that is not written yet is written first:
  // once the task is open, this screen is not in front and the route takes no more changes of its view.
  const openRef = useRef(props.onOpen); openRef.current = props.onOpen;
  const openItem = useCallback((item: MarketplaceItem) => {
    trace('preopen', latestView.current.listOffset ?? 0, offset.current, traceState.current.scrolled, traceState.current.index, !!offsetTimer.current);
    if (offsetTimer.current) { clearTimeout(offsetTimer.current); writeOffset(); }
    openRef.current(item);
  }, [writeOffset, trace]);

  // The map opens FILTERS from one visible control. SEARCH remains reachable inside filters and fills the screen.
  // What the person searched before is read from the phone only once search is open, and kept when a search is made.
  const [panel, setPanel] = useState<PanelMode | null>(null);
  const recents = useRecentSearches(props.scopeKey, panel === 'search');
  // "Nisu na mapi" is a view of actual point-free rows, not a new server filter. A total is shown only
  // when the scope's server count is usable or the complete result has been read.
  const [offMap, setOffMap] = useState(false);
  useEffect(() => { setOffMap(false); }, [props.scopeKey]);
  const searchBlurTarget = useRef<View | null>(null);
  // The list is read from what filters it and nothing else: moving the map or choosing a pin changes the view, and must
  // not hand the map a new list (the native source would be set again on every pan). The map's own set leaves the area
  // out, so a move of the map never takes a pin away; only the list follows the area. "Now" is read again with every new
  // read, every time choice and every opening of the panel, so "Danas" and the past days of its grid are today's.
  const { query, price, area, when, where, places: freePlaces, place: chosenPlace, dates, pinPlace } = view;
  // The screen outlives each native MapSession. Keep the publication camera's acknowledgement here so returning from
  // a task detail restores the saved viewport instead of treating the same publication as a fresh camera command.
  const cameraFilterKey = JSON.stringify([query, price, area, when, where, freePlaces, chosenPlace, dates, pinPlace, view.forMe === true]);
  const [cameraIntent, setCameraIntent] = useState<{ token: string; scopeKey: string; filterKey: string;
    status: 'pending' | 'consumed' | 'retired' } | null>(null);
  const publicationToken = props.publicationFocus?.kind === 'map' ? props.publicationFocus.token : null;
  const cameraOwner = useRef({ token: publicationToken, scopeKey: props.scopeKey, filterKey: cameraFilterKey,
    selected: !!publicationToken && props.publicationFocus?.id === view.selectedId, focused });
  cameraOwner.current = { token: publicationToken, scopeKey: props.scopeKey, filterKey: cameraFilterKey,
    selected: !!publicationToken && props.publicationFocus?.id === view.selectedId, focused };
  useEffect(() => {
    setCameraIntent(current => {
      const owner = cameraOwner.current;
      if (owner.token !== publicationToken || owner.scopeKey !== props.scopeKey) return current;
      return publicationToken ? current?.token === publicationToken && current.scopeKey === props.scopeKey ? current
        : { token: publicationToken, scopeKey: props.scopeKey, filterKey: owner.filterKey, status: 'pending' } : null;
    });
  }, [publicationToken, props.scopeKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const retireCameraIntent = useCallback((token?: string, sourceScopeKey?: string) => {
    const owner = cameraOwner.current, target = token ?? owner.token;
    if (!target || target !== owner.token || (sourceScopeKey && sourceScopeKey !== owner.scopeKey)) return;
    setCameraIntent(current => {
      const live = cameraOwner.current;
      if (live.token !== target || live.scopeKey !== owner.scopeKey) return current;
      if (current?.token === target && current.scopeKey === live.scopeKey) return current.status === 'pending'
        ? { ...current, status: 'retired' } : current;
      return { token: target, scopeKey: live.scopeKey, filterKey: live.filterKey, status: 'retired' };
    });
  }, []);
  useEffect(() => {
    if (!focused || (cameraIntent?.token === publicationToken && cameraIntent.scopeKey === props.scopeKey
      && cameraIntent.filterKey !== cameraFilterKey)) retireCameraIntent(publicationToken ?? undefined, props.scopeKey);
  }, [focused, props.scopeKey, cameraFilterKey, cameraIntent, publicationToken, retireCameraIntent]);
  // A newly arrived token is already actionable on this render: the native map's effect can run before this screen's
  // initializing effect. Its acknowledgement below still wins whichever state updater runs first.
  const activeIntent = cameraIntent?.token === publicationToken && cameraIntent.scopeKey === props.scopeKey ? cameraIntent : null;
  const cameraRequestToken = focused && publicationToken && props.publicationFocus?.id === view.selectedId
    && (!activeIntent || (activeIntent.status === 'pending' && activeIntent.filterKey === cameraFilterKey))
    ? publicationToken : null;
  const consumeCameraIntent = useCallback((token: string, sourceScopeKey: string) => {
    const owner = cameraOwner.current;
    if (token !== owner.token || sourceScopeKey !== owner.scopeKey || !owner.selected || !owner.focused) return;
    setCameraIntent(current => {
      const live = cameraOwner.current;
      if (live.token !== token || live.scopeKey !== owner.scopeKey || !live.selected || !live.focused) return current;
      if (current?.token === token && current.scopeKey === live.scopeKey) return current.status === 'pending'
        ? { ...current, status: 'consumed' } : current;
      return { token, scopeKey: live.scopeKey, filterKey: live.filterKey, status: 'consumed' };
    });
  }, []);
  const now = useMemo(() => new Date(), [items, when, dates, panel]); // eslint-disable-line react-hooks/exhaustive-deps
  const sharedFilters = useMemo(() => ({ ...initialMarketplaceView(), query, price, when, where, places: freePlaces, place: chosenPlace, dates }),
    [query, price, when, where, freePlaces, chosenPlace, dates]);
  const filters = useMemo(() => ({ ...sharedFilters, area, pinPlace: pinPlace ?? null }), [sharedFilters, area, pinPlace]);
  const serverOwned = !!props.p6Seam;
  const mapped = useMemo(() => loading || error ? NOTHING.mapped
    : serverOwned ? [...items] : discoveryShown(items, sharedFilters, undefined, now).mapped,
    [loading, error, items, sharedFilters, now, serverOwned]);
  const { inArea, withoutPoint, listed: ordinaryList } = useMemo(() => serverOwned
    ? { inArea: mapped.filter(item => !!publicPoint(item)), withoutPoint: mapped.filter(item => !publicPoint(item)), listed: mapped }
    : discoveryMapScope(mapped, { area, pinPlace, where }),
    [mapped, area, pinPlace, where, serverOwned]);
  const [retiredListFocus, setRetiredListFocus] = useState<{ token: string; scopeKey: string } | null>(null);
  const retireListFocus = () => {
    const request = props.publicationFocus;
    if (request?.kind === 'list') setRetiredListFocus(current => current?.token === request.token && current.scopeKey === props.scopeKey
      ? current : { token: request.token, scopeKey: props.scopeKey });
  };
  // A published task without a public point cannot be selected on the map. Put its existing
  // public row first in the open list; membership and the count remain exactly those of the read.
  // A later map-area choice restores the usual area-first / point-free section order.
  const listFocusId = props.publicationFocus?.kind === 'list' && !view.area && !view.pinPlace
    && (retiredListFocus?.token !== props.publicationFocus.token || retiredListFocus.scopeKey !== props.scopeKey)
    ? props.publicationFocus.id : null;
  // P6's ALL page interleaves map and point-free work by publication time. Present two distinct sections,
  // preserving the server order within each; pagination/cursors and the map's own rows stay untouched.
  const groupedList = useMemo(() => serverOwned ? [...inArea, ...withoutPoint] : ordinaryList,
    [serverOwned, inArea, withoutPoint, ordinaryList]);
  const lensed = useMemo(() => offMap ? groupedList.filter(item => !publicPoint(item)) : groupedList, [groupedList, offMap]);
  const listed = useMemo(() => {
    if (!listFocusId) return lensed;
    const chosen = lensed.find(item => item.id === listFocusId);
    return chosen ? [chosen, ...lensed.filter(item => item.id !== listFocusId)] : lensed;
  }, [lensed, listFocusId]);
  const p6WholeList = !!props.p6Seam && !area && !pinPlace;
  const sections = useMemo(() => {
    const result = new Map<number, ListSection>();
    if (serverOwned) {
      // No public point is not evidence of REMOTE: cards retain their own execution mode.
      // The heading counts only loaded rows when the authoritative page has a continuation.
      let at = 0;
      while (at < listed.length) {
        const kind = publicPoint(listed[at]) ? 'map' : 'offMap';
        let end = at + 1;
        while (end < listed.length && !!publicPoint(listed[end]) === (kind === 'map')) end++;
        if (kind === 'offMap' || withoutPoint.length) result.set(at, { kind, count: end - at,
          label: kind === 'offMap' ? OFF_MAP_CHIP : pinPlace ? 'Na ovom mestu' : area ? 'U ovoj oblasti' : 'Na mapi',
          partial: props.p6Seam?.pageHasMore === true });
        at = end;
      }
      return result;
    }
    // Publication remains the first, highlighted row; its temporary promotion does not turn
    // following map tasks into remote work or create a duplicate remote section above it.
    let at = listFocusId && listed[0]?.id === listFocusId ? 1 : 0;
    while (at < listed.length) {
      const kind = listKind(listed[at]);
      let end = at + 1;
      while (end < listed.length && listKind(listed[end]) === kind) end++;
      if (kind !== 'map' || withoutPoint.length) result.set(at, { kind, count: end - at,
        label: kind === 'remote' ? 'Na daljinu' : kind === 'unlocated' ? 'Bez označenog mesta'
          : pinPlace ? 'Na ovom mestu' : area ? 'U ovoj oblasti' : 'Na mapi' });
      at = end;
    }
    return result;
  }, [listed, listFocusId, withoutPoint.length, pinPlace, area, serverOwned, props.p6Seam?.pageHasMore]);
  const sectionsSignature = JSON.stringify([...sections]);
  const mappedWithoutPin = useMemo(() => mapped.filter(item => !publicPoint(item)).length, [mapped]);
  const groups = useMemo(() => pinPlaces(mapped), [mapped]);
  const byId = useMemo(() => new Map(mapped.map(item => [item.id, item] as const)), [mapped]);
  const relation = useCallback((item: MarketplaceItem): TaskCardRelation | undefined => {
    const answer = relations?.relation(item.id);
    return answer?.kind === 'OWNER' ? 'OWNED' : answer?.kind === 'APPLIED' ? 'APPLIED'
      : answer?.kind === 'NONE' ? undefined : pending ? 'PENDING' : 'UNKNOWN';
  }, [relations, pending]);
  const undated = useMemo(() => loading || error ? 0 : props.p6Seam?.counts?.undated
    ?? undatedCount(items, filters, undefined, now), [loading, error, items, filters, now, props.p6Seam?.counts?.undated]);
  const conditionCount = discoveryConditions(view) + Number(!!view.query.trim()) + Number(!!view.place || !!appliedMapPlace);
  // "Za mene" is on: the list is narrowed to the tasks that fit the person's work profile (the switch is drawn only when the route says it exists).
  const scope: ScopeKey = props.scope ?? (view.forMe ? 'forMe' : 'all');
  const forMeOn = !!props.forMeAvailable && scope === 'forMe';
  // Ownership only labels rows: counts describe the same public subset before and after the overlay arrives.
  const readiness: SearchReadiness = loading || props.collectionStatus === 'loading' ? 'loading'
    : error || props.collectionStatus === 'error' ? 'error' : 'ready';

  // Where the sheet rests is remembered in the route's view; a view that has one is where the sheet starts again.
  // A ready cold screen must give native its actual first detent at mount. Previously it mounted at half, then the
  // effect requested peek before Android had drawn the sheet; native reported index 0 while its header stayed absent.
  const [sheet, applySheet] = useState(() => ({ index: view.sheet ? INDEX[view.sheet] as number
    : !loading && !error ? INDEX[discoveryStartSnap(mapped.length, mappedWithoutPin)] as number : SNAP.half,
  sequence: 0, pending: false }));
  const sheetIndex = sheet.index, sheetCommand = useRef(sheet);
  const cameraListDetent = useSharedValue(sheetIndex);
  const sheetAnimatedIndex = useSharedValue(sheetIndex);
  const setSheetIndex = useCallback((index: number) => {
    if (sheetCommand.current.index === index) return;
    trace('want', index, sheetCommand.current.index);
    const next = { index, sequence: sheetCommand.current.sequence + 1, pending: true };
    sheetCommand.current = next; applySheet(next);
    sheetAnimatedIndex.value = index;
  }, [trace, sheetAnimatedIndex]);
  const appliedPublication = useRef<string | null>(null);
  useEffect(() => {
    const request = props.publicationFocus;
    if (!focused || !request || loading || error || appliedPublication.current === request.token) return;
    appliedPublication.current = request.token;
    setSheetIndex(request.kind === 'map' ? SNAP.peek : SNAP.full);
  }, [focused, props.publicationFocus, loading, error, setSheetIndex]);
  const acceptSheetIndex = useCallback((index: number) => {
    const command = sheetCommand.current;
    // Native observations may reconcile a drag, but cannot cancel an explicit target before its spring starts.
    if (command.pending && command.index !== index) return false;
    cameraListDetent.value = index;
    sheetAnimatedIndex.value = index;
    if (command.index !== index) {
      const next = { index, sequence: command.sequence + 1, pending: false };
      sheetCommand.current = next; applySheet(next);
    } else if (command.pending) {
      // Matching settlement fulfills the command without recommitting the unchanged native subtree.
      // A later changed index or retired gesture still renders its new command ownership.
      sheetCommand.current = { ...command, pending: false };
    }
    return true;
  }, [cameraListDetent, sheetAnimatedIndex]);
  // Requested React index and physically settled native index are deliberately separate.
  // This lets a quiet return keep native FlatList geometry, while an interrupted spring still forces a fresh mount.
  const nativeSettledIndex = useRef(sheetIndex), nativeSpringMoving = useRef(false);
  const started = useRef(!!view.sheet);
  useEffect(() => {
    if (!started.current) return;
    const name = SNAP_NAME[sheetIndex];
    if (name && latestView.current.sheet !== name) change({ sheet: name });
  }, [sheetIndex, change]);
  // Where the sheet starts is decided once from public pin coverage; labels cannot move it afterward.
  useEffect(() => {
    if (started.current || loading || refreshing || error) return;
    started.current = true;
    const start = discoveryStartSnap(mapped.length, mappedWithoutPin);
    setSheetIndex(INDEX[start]);
    // Remembered at once: a start equal to the height the sheet already had changes no state to remember it by later.
    if (latestView.current.sheet !== start) change({ sheet: start });
  }, [loading, refreshing, error, mapped.length, mappedWithoutPin, change]);
  // What is found must be seen. A sheet resting at its top line rises to show why nothing is found; and when nothing found
  // has a point on the map (a filter left only "Na daljinu"), it takes the screen, over a map with nothing on it. The map's
  // area is not a reason: moving the map never moves the sheet the person is looking past.
  useEffect(() => {
    if (refreshing) return;
    if (!loading && where === 'remote') { setSheetIndex(SNAP.full); return; }
    if (!started.current || loading) return;
    if (mapped.length > 0 && mappedWithoutPin === mapped.length) setSheetIndex(SNAP.full);
    else if (!mapped.length && !area && !pinPlace && sheetIndex === SNAP.peek) setSheetIndex(SNAP.half);
  }, [loading, refreshing, mapped.length, mappedWithoutPin, where, sharedFilters]); // eslint-disable-line react-hooks/exhaustive-deps

  // Empty results still belong on a map: keep geography available without requiring GPS or a first task.
  // Relations never remove a public pin, so the first map fit does not wait for the account overlay.
  const mapShown = where !== 'remote' && !loading && !error;
  // An empty full list keeps its own recovery action and a quiet, gesture-free return to the map.
  const emptyOverMap = !loading && !error && !props.collectionStatus && !listed.length && mapShown;

  // A chosen pin: one task, or a place several tasks share, of what the map shows. The list's area never takes it away;
  // a new read that no longer has it does.
  const selectedPoint = useRef<{ id: string; key: string } | null>(null);
  const pointWitnessOwner = useRef<{ scopeKey: string; token: string | null }>({ scopeKey: props.scopeKey, token: null });
  useEffect(() => {
    if (props.p6Seam || loading || error) return;
    const publication = props.publicationFocus?.token ?? null;
    if (pointWitnessOwner.current.scopeKey !== props.scopeKey
      || (publication && pointWitnessOwner.current.token !== publication)) {
      selectedPoint.current = null;
      pointWitnessOwner.current = { scopeKey: props.scopeKey, token: publication };
    }
    const { selectedId, selectedPlace } = latestView.current;
    const item = selectedId ? byId.get(selectedId) : null;
    const point = item ? publicPoint(item) : null;
    const key = point ? pointKey(point) : null;
    const prior = selectedPoint.current;
    const lostTask = !!selectedId && (!key || (prior?.id === selectedId && prior.key !== key));
    selectedPoint.current = !lostTask && selectedId && key ? { id: selectedId, key } : null;
    const lostPlace = !!selectedPlace && !groups.has(selectedPlace);
    if (lostTask || lostPlace) change({ ...(lostTask ? { selectedId: null } : {}), ...(lostPlace ? { selectedPlace: null } : {}) });
  }, [loading, error, byId, groups, change, props.scopeKey, props.publicationFocus?.token, view.selectedId, view.selectedPlace, props.p6Seam]);
  const selectedItem = view.selectedId ? byId.get(view.selectedId) ?? null : null;
  const place = view.selectedPlace ? groups.get(view.selectedPlace) : undefined;
  const legacyPlaceTasks = useMemo(() => place && place.ids.length > 1 ? place.ids.flatMap(id => byId.get(id) ?? []) : [], [place, byId]);
  const legacyChosen = selectedItem && publicPoint(selectedItem) ? selectedItem : null;
  const placeTasks = props.p6Seam?.peek?.place ?? legacyPlaceTasks;
  const chosen = props.p6Seam ? props.p6Seam.peek?.item ?? null : legacyChosen;
  const select = (id: string) => {
    const item = byId.get(id), point = item && publicPoint(item);
    if (!point) return;
    userIntent?.(); retireCameraIntent();
    const shared = groups.get(pointKey(point));
    change(shared && shared.ids.length > 1 ? { selectedId: null, selectedPlace: shared.key } : { selectedId: id, selectedPlace: null });
    setSheetIndex(SNAP.peek);
  };
  const selectPlace = (key: string) => {
    const shared = groups.get(key);
    if (!shared) return;
    userIntent?.(); retireCameraIntent();
    change(shared.ids.length > 1 ? { selectedId: null, selectedPlace: key } : { selectedId: shared.ids[0], selectedPlace: null });
    setSheetIndex(SNAP.peek);
  };
  // P6: a touch on a server task or place is the same choice as a legacy pin, so the list sinks to its top line the same way (the coordinator
  // remembers `sheet: 'peek'` for it; a card over a half-height sheet and a return to another sheet were found by the independent review).
  // A cluster is navigation only: the map's camera goes into it and the sheet stays where it is.
  const selectServerMarker: DiscoveryV1ServerMapSeam['onSelect'] = marker => {
    const seam = props.p6Seam;
    if (!seam) return;
    if (marker.kind === 'CLUSTER') { seam.map.onSelect(marker); return; }
    userIntent?.(); retireCameraIntent();
    seam.map.onSelect(marker);
    setSheetIndex(SNAP.peek);
  };
  const clearSelection = () => {
    if (props.p6Seam) { retireCameraIntent(); props.p6Seam.onClearPeek(); return; }
    if (latestView.current.selectedId || latestView.current.selectedPlace) {
      retireCameraIntent(); change({ selectedId: null, selectedPlace: null });
    }
  };
  // "Prikaži sve u listi": the mapped part narrows to this one public point; tasks without a
  // point remain below in their own section. The search pill names the chosen point and clears it.
  const showPlace = () => {
    if (props.p6Seam) {
      if (!props.p6Seam.peek?.place.length) return;
      userIntent?.(); retireCameraIntent(); retireListFocus(); props.p6Seam.onShowPlace(); setSheetIndex(SNAP.full); return;
    }
    if (!place) return;
    userIntent?.(); retireCameraIntent(); retireListFocus();
    change({ pinPlace: place.key, selectedId: null, selectedPlace: null });
    setSheetIndex(SNAP.full);
  };
  // Every task again: the map's area and the one point are gone (the pill's "×", or an empty list's way back).
  const showAll = () => {
    userIntent?.(); retireCameraIntent(); retireListFocus(); setAppliedMapPlace(null); pendingMapPlace.current = null;
    if (props.p6Seam) props.p6Seam.onShowAll(); else change({ area: null, pinPlace: null });
  };
  const announceBarRef = useRef<((next: boolean) => void) | null>(null);
  const onIndex = (index: number) => {
    trace('index', index, sheetIndex, currentSheet());
    // A spring completion can already be queued when this screen loses focus. It belongs to that visit,
    // not to the requested stop or selected pin restored when the person comes back.
    if (!currentSheet()) return;
    if (sheetCommand.current.pending) sheetCommand.current = { ...sheetCommand.current, pending: false };
    if (!acceptSheetIndex(index)) return;
    nativeSettledIndex.current = index; nativeSpringMoving.current = false;
    // Pulling the list up is looking at the list: a pin's card does not stay over it.
    if (index > SNAP.peek) clearSelection();
    announceBarRef.current?.(!cardShown && index > SNAP.peek);
    if (bar) {
      if (index === SNAP.peek) {
        bar.hidden.setValue(1);
        bar.setVisible?.(false);
      } else if (!cardShown) {
        bar.hidden.setValue(0);
        bar.setVisible?.(true);
      }
    }
  };
  // The list follows the map: a settled move of the person's own hands up the bounds it shows, and it is a new "where",
  // so the one point a place's list was narrowed to is let go.
  const followArea = (bounds: PublicBounds, frame?: PublicBounds) => {
    userIntent?.(); retireListFocus();
    const pending = pendingMapPlace.current;
    pendingMapPlace.current = null;
    if (pending?.scopeKey === props.scopeKey) {
      if (inBounds({ lat: pending.place.position.latitude, lng: pending.place.position.longitude }, frame ?? bounds)) {
        rememberSettledMapPlace(pending.place, bounds);
      } else {
        setAppliedMapPlace(null);
        setGeocodedTarget(null);
      }
    } else if (!sameBounds(bounds, latestView.current.area)) setAppliedMapPlace(null);
    if (props.p6Seam) { props.p6Seam.onArea(bounds, frame); return; }
    const current = latestView.current;
    if (!sameBounds(bounds, current.area) || current.pinPlace) change({ area: bounds, pinPlace: null });
  };

  // Layout: the body (it reaches the bottom of the screen), the tools' lower edge (the search pill and its row of capsules) and the sheet's measured top line.
  const [bodyHeight, setBodyHeight] = useState(0), [toolsBottom, setToolsBottom] = useState(TOOLS_ESTIMATE), [peek, setPeek] = useState(PEEK_ESTIMATE);
  const [toolsMeasured, setToolsMeasured] = useState(false);
  const [searchBottom, setSearchBottom] = useState(BAR_TOP + 56);
  const [headerLeadHeight, setHeaderLeadHeight] = useState(PEEK_ESTIMATE);
  // The list at its full height ends directly under the tools: no strip of map is left between them (the owner, 8 Oct 2026: "lista ide do vrha").
  // The map's furniture (its sources on the left, "moja lokacija" on the right) is one row high and rides the list's top edge, above it; where
  // the list is as high as it goes the row has no map to stand on and gives way. A tall count header joins the list scroll instead of pinning it.
  const canLocate = where !== 'remote';
  const footerRow = CONTROL_SIZE;
  const listTop = fullSheetTop(searchBottom, LIST_GAP);
  const capsuleSpace = Math.max(0, toolsBottom + LIST_GAP - listTop);
  const mapClearSheet = bodyHeight ? Math.max(3, bodyHeight - fullSheetTop(toolsBottom, LIST_GAP) - GAP) : 0;
  // The count belongs to the scroll now. A constant capsule spacer is hidden by transform below FULL;
  // at FULL native scrolling consumes it first, then continues through rows, with no detent/layout writes per frame.
  const tallHeader = !!mapClearSheet && peek + 2 > mapClearSheet;
  const scrollHeader = true;
  // A chosen pin's card, at the very bottom of the screen: the list's top line steps out of sight behind it; the row of map furniture stands above the card.
  const cardShown = mapShown && (!!chosen || placeTasks.length > 1) && panel === null;
  const [cardHeight, setCardHeight] = useState(0);
  const coverBottom = cardShown && cardHeight ? cardHeight + cardBottom + GAP : 0;
  // Android: Reanimated writes a view's opacity and transform by a synchronous update that is lost when Fabric has not mounted the view yet, and nothing
  // writes it again: a freshly mounted Gorhom body then stays at its hidden mount props (opacity 0 / off-screen) while the shared index and position already
  // report the requested stop (found on the CI emulator after returns from a task: a dimmed empty screen with only the "Mapa" pill). The P6 screen is rebuilt
  // on every return, so its sheet is nudged by a hundredth of a pixel a few times after it mounts: Gorhom re-evaluates the position and Reanimated writes
  // the body's style again, this time to a view that is there. The other logic of this screen reads the unnudged snap points.
  const [kick, setKick] = useState(0);
  // A hand on the list ends the nudging: a later nudge would move the sheet under the scroll (Gorhom locks the list while the sheet moves).
  const interacted = useRef(false);
  // The low stop exposes just the handle and count. The rest of the header and first card stay below the screen.
  const collapsedLead = tallHeader ? Math.min(headerLeadHeight, mapClearSheet - 2) : headerLeadHeight;
  const collapsedSnap = tallHeader ? Math.min(collapsedLead + bottomInset, Math.max(3, mapClearSheet - 2)) : collapsedLead + bottomInset;
  const snapPoints = useMemo(() => snapHeights({ bodyHeight, fullTop: listTop, halfTop: fullSheetTop(toolsBottom, LIST_GAP),
    collapsed: collapsedSnap, hidden: HIDDEN, cardShown, margin: GAP, bar: barHeight }),
    [bodyHeight, listTop, toolsBottom, collapsedSnap, cardShown, barHeight]);
  const sheetSnapPoints = useMemo(() => kick % 2 === 1
    ? snapPoints.map((value, at) => at === sheetIndex && typeof value === 'number' ? value - SHEET_KICK_PX : value) : snapPoints, [snapPoints, kick, sheetIndex]);
  // Empty results use the same full-height recovery surface, with a secondary map return.
  const highest = SNAP.full;
  // Match the native sheet's initial off-screen position; zero before its first layout would mean falsely covered.
  const position = useSharedValue(windowHeight);
  const chromeOffset = useSharedValue(0);
  const listMotion = useAnimatedStyle(() => ({
    transform: [{ translateY: -capsuleSpace * (1 - chromeJoin(position.value, listTop, capsuleSpace)) }],
  }), [position, listTop, capsuleSpace]);
  const expanded = sheetIndex === SNAP.full;
  // "Moja lokacija" stands at the right end of the map's row of furniture, directly above the list, and moves with it: the same arithmetic as
  // the map's sources on the left of that row (`mapControls`), drawn here because it must also be there while no map is mounted.
  const locateCover = useCoverValue(coverBottom, reduced);
  const locateRide = useRidingStyle({ sheetTop: position, cover: locateCover, height: bodyHeight, rowHeight: footerRow, gap: GAP, minTop: toolsBottom + GAP });
  // Requested index is not physical coverage: a button's spring can return to its old stop without onChange.
  // Only crossing the actual full-height boundary reaches JS. New scope/focus owners reject already queued work.
  const coverageSequence = useRef(0);
  const coverageOwner = useMemo(() => ({ sequence: ++coverageSequence.current, active: true }), [props.scopeKey, focused]);
  const currentCoverageOwner = useRef(coverageOwner); currentCoverageOwner.current = coverageOwner;
  useEffect(() => { coverageOwner.active = true; return () => { coverageOwner.active = false; }; }, [coverageOwner]);
  const currentSheet = useCallback(() => focused && coverageOwner.active && currentCoverageOwner.current === coverageOwner,
    [focused, coverageOwner]);
  const contentHeight = useRef(0), listHeight = useRef(0), listReady = useRef(false), listRestoreReady = useRef(false);
  const restore = useRef<number | null>(null), restoreTarget = useRef<number | null>(null), restoreAttempted = useRef(false);
  // A fresh focus owner retires stale callbacks, but it no longer automatically replaces the native list.
  // Retain the exact BottomSheet/FlatList mount only when departure was physically settled and account scope,
  // row layout facts and viewport geometry are unchanged. That keeps RN's measured-cell cache for deep returns.
  // Interrupted springs, scope changes, changed rows or changed layout still remount fail-closed.
  const rowMountSignature = useMemo(() => JSON.stringify(listed.map(item => [item, relation(item)])), [listed, relation]);
  const snapSignature = (points: ReadonlyArray<number | string>) => points.map(value => typeof value === 'number' ? Math.round(value * 10) / 10 : value);
  const layoutMountSignature = [
    windowWidth, windowHeight, fontScale, bodyHeight, toolsBottom, peek, scrollHeader, headerLeadHeight, barHeight, cardShown,
    undated, sectionsSignature,
    ...snapSignature(snapPoints),
  ].join(':');
  // EX-03: what keys the native rows (through the measurement owner below) is the geometry that sizes and places them. Whether a pin's card has sunk the list's top line is not part of it:
  // the rows keep their size and place, and the viewport is the full stop. Keyed by the signature above, every card that opened or closed re-created every row, a burst of native views
  // and Reanimated tags that died at once (measured on the HONOR). The signature above still guards a native sheet that comes back after a departure.
  const rowGeometrySignature = [
    windowWidth, windowHeight, fontScale, bodyHeight, toolsBottom, peek, scrollHeader, headerLeadHeight, barHeight,
    undated, sectionsSignature,
    ...snapSignature([collapsedSnap, ...snapPoints.slice(1)]),
  ].join(':');
  const sheetMount = useRef({
    key: 1, focused, scopeKey: props.scopeKey, rows: rowMountSignature, layout: layoutMountSignature, reusable: true,
  });
  const previousFocused = sheetMount.current.focused;
  const unchangedMount = sheetMount.current.scopeKey === props.scopeKey
    && sheetMount.current.rows === rowMountSignature && sheetMount.current.layout === layoutMountSignature;
  if (previousFocused && !focused) {
    // Round31 proved a retained FULL Android sheet can come back with its native body reset to Gorhom's hidden
    // mount props (alpha 0 / off-screen translation) while shared index/position and the saved list offset still
    // report the correct FULL state. Retire only that native FULL mount on route departure. The logical view,
    // viewport, filters, selection and listOffset live above this keyed boundary; the existing bounded restore
    // rebuilds the list at the saved offset after the fresh native sheet becomes unlocked. Peek/half mounts may
    // still be retained when their physical state is settled. Do not replace this with a global Reanimated flag.
    const nativeMountMaySurviveReturn = sheetIndex !== SNAP.full;
    sheetMount.current.reusable = nativeMountMaySurviveReturn && unchangedMount && !nativeSpringMoving.current
      && nativeSettledIndex.current === sheetIndex && restore.current === null
      && Math.abs(offset.current - (latestView.current.listOffset ?? 0)) <= 1;
  } else if (!previousFocused && focused) {
    const reusable = sheetMount.current.reusable && unchangedMount;
    if (!reusable) {
      sheetMount.current.key++;
      nativeSettledIndex.current = sheetIndex; nativeSpringMoving.current = false;
    }
  } else if (focused && sheetMount.current.scopeKey !== props.scopeKey) {
    sheetMount.current.key++;
    nativeSettledIndex.current = sheetIndex; nativeSpringMoving.current = false;
  }
  // A changed-away-and-back dataset has already disturbed native cell geometry while hidden.
  if (!focused && !unchangedMount) sheetMount.current.reusable = false;
  sheetMount.current.focused = focused;
  if (focused) {
    sheetMount.current.scopeKey = props.scopeKey;
    sheetMount.current.rows = rowMountSignature;
    sheetMount.current.layout = layoutMountSignature;
  }
  const nativeMountKey = sheetMount.current.key;
  useEffect(() => { chromeOffset.value = 0; }, [nativeMountKey, props.scopeKey, chromeOffset]);
  const chipsOwner = useMemo(() => ({ visit: coverageOwner, mount: nativeMountKey }), [coverageOwner, nativeMountKey]);
  const currentChipsOwner = useRef(chipsOwner); currentChipsOwner.current = chipsOwner;
  const [chipsState, setChipsState] = useState<{ owner: typeof chipsOwner; hidden: boolean } | null>(null);
  const receiveChipsHidden = useCallback((hidden: boolean) => {
    if (currentSheet() && currentChipsOwner.current === chipsOwner)
      setChipsState(previous => previous?.owner === chipsOwner && previous.hidden === hidden ? previous : { owner: chipsOwner, hidden });
  }, [currentSheet, chipsOwner]);
  const chipsVisit = coverageOwner.sequence;
  useAnimatedReaction(() => ({ visit: chipsVisit, mount: nativeMountKey,
    hidden: capsuleSpace > 0 && chromeJoin(position.value, listTop, capsuleSpace) >= 1
      && capsuleCollapse(chromeOffset.value, capsuleSpace) >= capsuleSpace }),
  (next, previous) => {
    if (next.hidden !== previous?.hidden || next.visit !== previous?.visit || next.mount !== previous?.mount)
      runOnJS(receiveChipsHidden)(next.hidden);
  }, [position, listTop, capsuleSpace, chromeOffset, chipsVisit, nativeMountKey, receiveChipsHidden]);
  const chipsHidden = chipsState?.owner === chipsOwner && chipsState.hidden;
  const kickable = !!props.p6Seam && Platform.OS === 'android' && focused && bodyHeight > 0;
  useEffect(() => {
    if (!kickable) return;
    interacted.current = false;
    const timers = SHEET_KICKS_MS.map((ms, at) => setTimeout(() => {
      if (interacted.current) return;
      trace('kick', at + 1, ms); setKick(at + 1);
    }, ms));
    return () => { timers.forEach(clearTimeout); setKick(0); };
  }, [kickable, nativeMountKey, trace]);
  useLayoutEffect(() => {
    if (!props.trace || !bar) return;
    const listener = bar.hidden.addListener(({ value }) => trace('bar-value', value));
    return () => bar.hidden.removeListener(listener);
  }, [props.trace, trace, bar]);
  const { announce: announceBar } = useZadaciBarMotion({ bar, shown: !cardShown && sheetIndex > SNAP.peek, active: focused, reduced });
  announceBarRef.current = announceBar;
  const onSheetAnimate = useCallback((_fromIndex: number, toIndex: number) => {
    if (!currentSheet()) return;
    nativeSpringMoving.current = true; // A same-index geometry spring can also be interrupted.
    announceBar(!cardShown && toIndex > SNAP.peek);
  }, [currentSheet, announceBar, cardShown]);
  const hasBar = !!bar;
  const receiveBarProgress = useCallback((progress: number) => {
    if (!bar || !focused || coverageOwner.sequence !== currentCoverageOwner.current.sequence) return;
    bar.hidden.setValue(progress);
    bar.setVisible?.(progress < 0.95);
  }, [bar, focused, coverageOwner]);
  const barVisit = coverageOwner.sequence;
  useAnimatedReaction(() => {
    const visit = barVisit;
    if (!hasBar || !focused || cardShown) return { progress: 1, visit };
    const animIdx = sheetAnimatedIndex.value;
    const hasAnimIdx = typeof animIdx === 'number' && Number.isFinite(animIdx) && animIdx >= 0;
    if (bodyHeight > 0 && typeof snapPoints[0] === 'number' && typeof snapPoints[1] === 'number') {
      const current = position.value;
      const halfTop = bodyHeight - snapPoints[1];
      const peekTop = bodyHeight - snapPoints[0];
      if (peekTop > halfTop) {
        if (current <= halfTop + 4 || (hasAnimIdx && animIdx >= 0.95)) return { progress: 0, visit };
        if (current >= peekTop - 4 || (hasAnimIdx && animIdx <= 0.05)) return { progress: 1, visit };
        const raw = (current - halfTop) / (peekTop - halfTop);
        return { progress: Math.max(0, Math.min(1, Math.round(raw * 50) / 50)), visit };
      }
    }
    if (hasAnimIdx) {
      if (animIdx <= 0.05) return { progress: 1, visit };
      if (animIdx >= 0.95) return { progress: 0, visit };
      const raw = 1 - Math.min(1, animIdx);
      return { progress: Math.max(0, Math.min(1, Math.round(raw * 50) / 50)), visit };
    }
    return { progress: sheetIndex > SNAP.peek ? 0 : 1, visit };
  }, (next, previous) => {
    if (!previous || next.progress !== previous.progress || next.visit !== previous.visit) {
      runOnJS(receiveBarProgress)(next.progress);
    }
  }, [hasBar, focused, cardShown, sheetIndex, windowHeight, bodyHeight, snapPoints, position, sheetAnimatedIndex, barVisit, coverageOwner, receiveBarProgress]);
  const [coverage, setCoverage] = useState<{ owner: typeof coverageOwner; covered: boolean } | null>(null);
  const receiveCoverage = useCallback((covered: boolean) => {
    if (!focused || !coverageOwner.active || currentCoverageOwner.current !== coverageOwner) return;
    setCoverage(previous => previous?.owner === coverageOwner && previous.covered === covered ? previous : { owner: coverageOwner, covered });
  }, [coverageOwner, focused]);
  const coverageSequenceValue = coverageOwner.sequence;
  useAnimatedReaction(() => ({ covered: mapShown && bodyHeight > 0 && position.value <= listTop + 0.5, owner: coverageSequenceValue }),
    (next, previous) => {
      if (next.covered !== previous?.covered || next.owner !== previous?.owner) runOnJS(receiveCoverage)(next.covered);
    }, [position, mapShown, bodyHeight, listTop, coverageSequenceValue, receiveCoverage]);
  const mapCovered = coverage?.owner === coverageOwner && coverage.covered;
  // Mapa belongs to the full-list header, beside the result count.
  const pillShown = expanded && mapShown && mapCovered;
  const pillFade = usePillFade(pillShown, reduced);
  // The first fit of the pins keeps them above where the sheet starts: its top line, or half the map (review r3 item 3).
  const halfSheet = typeof snapPoints[1] === 'number' ? snapPoints[1] : Math.round(windowHeight / 2);
  // The row of the map's furniture (its sources and "moja lokacija") stands above the list, so a fit keeps one row and a gap of it clear.
  const fitBottom = (discoveryStartSnap(mapped.length, mappedWithoutPin) === 'peek' ? snapPoints[0] as number : halfSheet) + GAP + footerRow;
  // Nearby always asks for PEEK, including an empty list that initially opens at HALF. A fast GPS response must
  // use its destination geometry, not the initial fit or the in-flight sheet position.
  const nearbyFitBottom = collapsedSnap + GAP + footerRow;
  // The card at the bottom may take what the map leaves between the tools above it and the row of furniture over it (the pin stays above the card).
  const previewMaxHeight = bodyHeight ? Math.max(48, bodyHeight - toolsBottom - footerRow - cardBottom - 3 * GAP - HIDDEN) : undefined;
  // Android Back lowers either raised list stop to its top line; the map stays in context.
  useEffect(() => {
    if (!focused || sheetIndex === SNAP.peek || !mapShown || cardShown || panel !== null) return;
    const back = BackHandler.addEventListener('hardwareBackPress', () => { userIntent?.(); setSheetIndex(SNAP.peek); return true; });
    return () => back.remove();
  }, [focused, sheetIndex, mapShown, cardShown, panel, userIntent, setSheetIndex]);

  // The panel's draft applies all at once; a newly chosen place brings its pins into view (the camera's own move, never an area).
  const openPanel = (mode: PanelMode) => { userIntent?.(); Keyboard.dismiss(); setPanel(mode); };
  const [fit, setFit] = useState<{ key: number; bounds: PublicBounds; bottom: number } | null>(null);
  const fits = useRef(0);
  // P6's PLACES facet has names and exact counts, but no coordinates. A different place must first read its own MAP seed;
  // the bounded PAGE from the previous city cannot decide where the camera goes. Manual map intent cancels this one shot.
  useEffect(() => {
    const pending = pendingFacetPlace.current;
    if (!pending || !props.p6Seam) return;
    if (pending.scopeKey !== props.scopeKey || !view.place || placeKey(view.place) !== pending.place
      || discoveryV1RouteIntentKey(view) !== pending.intentKey) {
      pendingFacetPlace.current = null; return;
    }
    if (refreshing || loading || error) return;
    pendingFacetPlace.current = null;
    const bounds = publicBounds(props.p6Seam.map.wholeBounds);
    if (bounds) setFit({ key: ++fits.current, bounds, bottom: (sheetIndex === SNAP.peek ? collapsedSnap : halfSheet) + GAP + footerRow });
  }, [props.p6Seam?.map.wholeBounds, props.scopeKey, view.place, refreshing, loading, error, sheetIndex, collapsedSnap, halfSheet, footerRow]);
  const [geocodedTarget, setGeocodedTarget] = useState<NearbyCameraTarget | null>(null);
  const geocodedKey = useRef(0);
  const findNearby = () => {
    if (!nearby.start()) return;
    userIntent?.(); Keyboard.dismiss(); clearSelection(); setFit(null); setGeocodedTarget(null);
    setAppliedMapPlace(null); pendingMapPlace.current = null; setSheetIndex(SNAP.peek);
  };
  const apply = (draft: SearchDraft, options?: { clearMapPlace?: boolean }) => {
    const before = latestView.current.place;
    userIntent?.(); retireCameraIntent(); retireListFocus();
    if (options?.clearMapPlace || draft.where === 'remote' || (panel === 'search' && (!draft.area || !!draft.place))) {
      setAppliedMapPlace(null); pendingMapPlace.current = null;
    }
    // A search that was made is kept for the next time (the search only: the filters change no word and no place).
    if (panel === 'search') recents.remember({ query: draft.query, place: draft.place });
    const newFacetPlace = !!props.p6Seam && panel === 'search' && !!draft.place && (!before || placeKey(before) !== placeKey(draft.place));
    // A chosen P6 place starts a fresh MAP seed for that filter. The former viewport belongs to the previous city.
    change({ ...draft, ...(newFacetPlace ? { viewport: null } : {}), selectedId: null, selectedPlace: null });
    if (newFacetPlace) pendingFacetPlace.current = { scopeKey: props.scopeKey, place: placeKey(draft.place!),
      intentKey: discoveryV1RouteIntentKey(latestView.current) };
    if (!draft.place || (before && placeKey(before) === placeKey(draft.place))) return;
    if (newFacetPlace) return;
    const bounds = publicInitialBounds(discoveryShown(items, latestView.current, undefined, now).mapped);
    trace('fit', sheetIndex, bounds ? 1 : 0, sheetIndex === SNAP.peek ? collapsedSnap : halfSheet);
    if (bounds) setFit({ key: ++fits.current, bounds, bottom: (sheetIndex === SNAP.peek ? collapsedSnap : halfSheet) + GAP + footerRow });
  };
  const centerOnConfirmedPlace = (place: ConfirmedMapPlace) => {
    const { position } = place;
    if (!Number.isFinite(position.latitude) || !Number.isFinite(position.longitude)) return;
    userIntent?.(); clearSelection(); setFit(null); setSheetIndex(SNAP.peek);
    setAppliedMapPlace(place); pendingMapPlace.current = { scopeKey: props.scopeKey, place };
    setGeocodedTarget({ key: --geocodedKey.current, center: [position.longitude, position.latitude] });
  };
  // "Poništi filtere" takes the conditions away, not the scope: "Za mene" is a choice of which tasks the list is about, so it stays.
  const reset = () => { userIntent?.(); retireCameraIntent(); retireListFocus(); setOffMap(false); setAppliedMapPlace(null); pendingMapPlace.current = null;
    props.onView({ ...initialMarketplaceView(), mode: view.mode, viewport: view.viewport, sheet: view.sheet, ...(view.forMe ? { forMe: true } : {}) }); };

  // Quick chips: each toggles one existing filter at once, and is offered only when the tasks carry the fact it reads (or it is
  // already on and must be removable). The legacy reader holds every task, so its loaded rows say it. P6 holds one area's pages,
  // which change with every move of the map, so a chip read from them came and went while the person panned: there the server's
  // whole-filter availability says it (kept through a read that has not answered yet).
  const p6 = props.p6Seam;
  const lastAvailability = useRef<{ scopeKey: string; value: DiscoveryV1Availability } | null>(null);
  if (p6?.availability) lastAvailability.current = { scopeKey: props.scopeKey, value: p6.availability };
  const availability = p6 && lastAvailability.current?.scopeKey === props.scopeKey ? lastAvailability.current.value : null;
  const timed = useMemo(() => p6 ? !!availability?.hasKnownSchedule : saysWhen(items, now), [p6, availability, items, now]);
  const workModes = useMemo(() => p6 ? !!availability?.hasKnownWorkMode : saysWorkMode(items), [p6, availability, items]);
  const priceSaid = (key: 'MY_PRICE' | 'OFFERS') => p6 ? !!availability?.priceModes.includes(key) : items.some(item => item.rezimCene === key);
  const toggle = (patch: Partial<MarketplaceView>) => { userIntent?.(); retireCameraIntent(); retireListFocus();
    if (patch.where === 'remote') { setAppliedMapPlace(null); pendingMapPlace.current = null; }
    change({ ...patch, selectedId: null, selectedPlace: null }); };
  // The scope is the route's when it owns one; otherwise it is the view's own `forMe`, which the server reader sends as the filter's one optional key.
  const chooseScope = (next: ScopeKey) => { if (props.onScope) props.onScope(next); else toggle({ forMe: next === 'forMe' }); };
  const currentWhen = dateRange(view.dates) ? 'any' : view.when ?? 'any';
  const range = dateRange(view.dates);
  // What is on and has no capsule of its own says itself once, in the same row, and removes itself: the days of a range and a time the quick capsules do
  // not carry ("Sutra", "26–28. sep"), the work done on the spot, "Tražim ponude" and the number of people. A quick capsule removes its own filter. What the pill says
  // (the place, the words, the map's area) is taken away by the pill's "×", and what the filters button counts is shown by its number: nothing is said twice.
  const taken = 'Isključuje ovaj izbor.';
  const alsoOn: QuickChip[] = [
    ...(range ? [{ key: 'dates', label: datesWords(range, now), selected: true, removable: true, hint: taken, onPress: () => toggle({ dates: null }) }]
      : currentWhen !== 'any' && !QUICK_WHEN.includes(currentWhen) ? [{ key: 'when', label: said(WHEN, currentWhen), selected: true, removable: true, hint: taken,
        onPress: () => toggle({ when: 'any' }) }] : []),
    ...(!p6 && view.where === 'onsite' ? [{ key: 'where:onsite', label: said(WHERE, 'onsite'), selected: true, removable: true, hint: taken, onPress: () => toggle({ where: 'any' }) }] : []),
    ...(view.price === 'OFFERS' ? [{ key: 'price:OFFERS', label: said(PRICE, 'OFFERS'), selected: true, removable: true, hint: taken, onPress: () => toggle({ price: 'all' }) }] : []),
    ...(view.minBudgetRsd != null ? [{ key: 'price:min', label: `Od ${novac(view.minBudgetRsd)}`, selected: true, removable: true,
      hint: 'Ukloni najmanju fiksnu cenu.', onPress: () => toggle({ minBudgetRsd: null }) }] : []),
    ...(atLeast(freePlaces) > 1 ? [{ key: 'places', label: placesWords(freePlaces), selected: true, removable: true, hint: taken, onPress: () => toggle({ places: 1 }) }] : []),
  ];
  const chips: QuickChip[] = [
    // "Nisu na mapi" is first while it is on: it is the choice that changes what the list is about, and the one thing a tap takes away at once.
    ...(offMap ? [{ key: 'offMap', label: OFF_MAP_CHIP, selected: true, removable: true, hint: taken, onPress: () => setOffMap(false) }] : []),
    ...alsoOn,
    // "Na daljinu" comes first of the quick capsules (the owner, 8 Oct 2026: remote tasks must be marked and easy to reach): the tasks the map
    // cannot show are one tap away and visible without scrolling the row at his phone's width. Then Danas, Ovaj vikend, Sa iznosom, each only
    // where the tasks can back it. Remote work has no stale map scope.
    ...(p6 ? [{ key: 'where:onsite', label: 'Na lokaciji', selected: view.where === 'onsite', onPress: () => toggle({ where: 'onsite' }) }] : []),
    ...(p6 || workModes || view.where === 'remote' ? [{ key: 'where:remote', label: said(WHERE, 'remote'), selected: view.where === 'remote',
      onPress: () => toggle({ where: p6 ? 'remote' : view.where === 'remote' ? 'any' : 'remote' }) }] : []),
    ...(p6 ? [{ key: 'where:any', label: 'Oba', selected: view.where === 'any', onPress: () => toggle({ where: 'any' }) }] : []),
    ...QUICK_WHEN.filter(key => timed || currentWhen === key).map(key => ({ key: `when:${key}`, label: said(WHEN, key), selected: currentWhen === key,
      onPress: () => toggle({ when: currentWhen === key ? 'any' : key as WhenFilter, dates: null }) })),
    ...(view.price === 'MY_PRICE' || priceSaid('MY_PRICE') ? [{ key: 'price:MY_PRICE', label: said(PRICE, 'MY_PRICE'), selected: view.price === 'MY_PRICE',
      onPress: () => toggle({ price: view.price === 'MY_PRICE' ? 'all' : 'MY_PRICE' }) }] : []),
  ];

  // The one row of capsules under Filteri stays over ordinary map/list browsing. A chosen pin gives the map to its task card;
  // its date/quick-filter row steps away until the card closes. The full Filteri entry and the selected criteria remain available.
  const chipRow = <DiscoveryChipRow forMeAvailable={props.forMeAvailable} scope={scope} onScope={chooseScope} chips={chips} />;

  // The list's scroll offset: remembered in the route's view a moment after the list stops, found again when the list
  // is read anew (a return after a while, or after the app was away), and back at the top when the search changes. A
  // restore still waiting for the rows is dropped the moment the person takes hold of the list or refreshes it.
  const listRef = useRef<BottomSheetFlatListMethods | null>(null);
  const scrolledRef = useRef((view.listOffset ?? 0) > SCROLLED);
  // Gorhom's BottomSheetContent sizes its mask from the highest detent at every stop.
  // Give the native list that exact viewport, less our pinned header (a scrolling header
  // is inside the list). Otherwise Android's refresh wrapper can leave FlatList content-
  // sized on remount; EXTENDED then arrives without another bounded list onLayout.
  const listWindow = typeof snapPoints[2] === 'number' ? listViewport(snapPoints[2], scrollHeader ? 0 : peek) : 0;
  const restoreAck = useRef<number | null>(null);
  // The last scroll position the native list reported (a pending restore ignores events that are not its target), for a restore that has to settle.
  const observedY = useRef(0), stalls = useRef(0), stallTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const armStallRef = useRef<() => void>(() => {});
  const clearStall = useCallback(() => { if (stallTimer.current) { clearTimeout(stallTimer.current); stallTimer.current = null; } }, []);
  const retainedRestoreOwner = useRef<number | null>(null);
  const restoreFrame = useRef(0);
  const restoreCommand = useRef(-1);
  const hasRows = listed.length > 0;
  // RN limits the unmeasured tail spacer to measured cells. Content size alone cannot
  // prove that an offset is unreachable: only the actual final cell and footer can.
  const extentSequence = useRef(0);
  const extent = useMemo(() => ({ sequence: ++extentSequence.current, bottom: null as number | null, footer: undated ? null as number | null : 0 }),
    [rowMountSignature, nativeMountKey, rowGeometrySignature, undated]);
  const currentExtent = useRef(extent);
  if (currentExtent.current !== extent) {
    // Keep this mount's last native content height as a provisional bound: unchanged dimensions produce no
    // new content-size event. Fresh final-cell/footer geometry must agree before it can certify a shorter end.
    // A previous data/layout owner's scroll acknowledgement cannot settle the new restore.
    restoreTarget.current = null; restoreAck.current = null; restoreAttempted.current = false;
    retainedRestoreOwner.current = null;
    currentExtent.current = extent;
  }
  const currentList = useCallback(() => currentSheet() && currentExtent.current === extent, [currentSheet, extent]);
  // What the list leaves under its last card: room for the bottom navigation, which lies over the lower part
  // of the sheet at every list stop. It does not depend on whether a pin preview hides navigation, so the rows' geometry stays stable.
  const endPadding = sys.space.xxl + barHeight;
  const minimumListContent = listWindow > 0 ? listWindow + capsuleSpace : 0;
  const listPadding = useMemo(() => ({ paddingHorizontal: sys.space.lg, paddingTop: sys.space.xs, paddingBottom: endPadding, flexGrow: 1,
    ...(minimumListContent ? { minHeight: minimumListContent } : {}) }), [endPadding, minimumListContent]);
  const hasMeasuredEnd = useCallback(() => {
    if (extent.bottom === null || extent.footer === null) return false;
    const end = extent.bottom + extent.footer + endPadding;
    return contentHeight.current >= end - 1
      && (contentHeight.current <= minimumListContent || Math.abs(contentHeight.current - end) <= 1);
  }, [extent, endPadding, minimumListContent]);
  const restoreVisit = useRef<number | null>(null), restoreMount = useRef<number | null>(null), restoreHadRows = useRef(hasRows);
  traceState.current = { scrolled: scrolledRef.current, index: sheetIndex };
  const tracedScroll = useRef<number | null>(null);
  const tracedRejectedScroll = useRef<string | null>(null);
  const tracedZero = useRef<string | null>(null);
  // Seed before mounting children: initial native scroll/layout events may precede the parent's effect.
  // A newly empty loading surface must not replace a retained logical offset with its synthetic zero either.
  if (focused && (restoreVisit.current !== coverageOwner.sequence || (restoreHadRows.current && !hasRows))) {
    if (restoreVisit.current !== coverageOwner.sequence) { listReady.current = false; listRestoreReady.current = false; }
    retainedRestoreOwner.current = restoreMount.current === nativeMountKey && sheetMount.current.reusable && hasRows ? coverageOwner.sequence : null;
    if (restoreMount.current !== nativeMountKey || !hasRows) { listHeight.current = 0; contentHeight.current = 0; }
    restoreVisit.current = coverageOwner.sequence; restoreMount.current = nativeMountKey;
    const at = latestView.current.listOffset ?? 0;
    trace('seed', coverageOwner.sequence, at, offset.current, hasRows, scrolledRef.current, sheetIndex);
    offset.current = at; restore.current = at > 0 ? at : null;
    restoreTarget.current = null; restoreAck.current = null; restoreAttempted.current = false; stalls.current = 0;
  }
  if (hasRows && !restoreHadRows.current) contentHeight.current = 0; // the loading/empty view's height is not row geometry
  restoreHadRows.current = hasRows;
  const tryRestore = useCallback(() => {
    const at = restore.current;
    if (at !== null) trace('restore-check', currentSheet(), hasRows, listReady.current, at, restoreAttempted.current, !!listRef.current,
      listHeight.current, contentHeight.current);
    if (!currentList() || at === null) return;
    if (!hasRows && !loading && !error) {
      restore.current = null; restoreTarget.current = null; offset.current = 0;
      scrolledRef.current = false; writeOffset();
      return;
    }
    if (!hasRows || !listReady.current || !listRestoreReady.current || nativeSettledIndex.current !== sheetIndex || !listRef.current
      || listWindow <= 0 || contentHeight.current <= 0) return;
    const target = Math.min(at, Math.max(0, contentHeight.current - listWindow));
    const terminal = hasMeasuredEnd();
    if (restoreTarget.current !== target) restoreAck.current = null;
    restoreTarget.current = target;
    if (target === 0) {
      if (!terminal) return;
      trace('clamp0', at, contentHeight.current, listWindow, latestView.current.listOffset ?? 0);
      // The measured current list fits in its window: there can be no offset event to acknowledge.
      restore.current = null; restoreTarget.current = null; offset.current = 0;
      scrolledRef.current = false; writeOffset();
      return;
    }
    // A provisional scroll may have arrived before the last cell's layout. Once its
    // matching extent is known, that acknowledgement is enough; scrolling to the same
    // offset again need not produce another native event.
    if (terminal && restoreCommand.current === sheetCommand.current.sequence && restoreAck.current !== null && Math.abs(restoreAck.current - target) <= 1) {
      trace('ack', restoreAck.current, at, target);
      offset.current = restoreAck.current; restore.current = null; restoreTarget.current = null;
      restoreAttempted.current = false; writeOffset();
      return;
    }
    if (restoreAttempted.current && restoreFrame.current === listWindow && restoreCommand.current === sheetCommand.current.sequence) return;
    restoreAttempted.current = true;
    restoreFrame.current = listWindow;
    restoreCommand.current = sheetCommand.current.sequence;
    trace('request', at, target, contentHeight.current, listWindow);
    listRef.current.scrollToOffset({ offset: target, animated: false });
    if (props.p6Seam) armStallRef.current();
  }, [currentSheet, currentList, hasRows, loading, error, listWindow, hasMeasuredEnd, writeOffset, trace, sheetIndex]);
  const retryRestore = useRef(tryRestore); retryRestore.current = tryRestore;
  const armStall = useCallback(() => {
    clearStall();
    stallTimer.current = setTimeout(() => {
      stallTimer.current = null;
      if (!currentList() || restore.current === null || !listRef.current) return;
      // A list that cannot restore (locked under a sheet that is not at its stop, or not settled there) was asked for nothing, so nothing has stalled. Counting it would end the
      // restore, or ask the locked list for its tail (which resets it to the top), without the list ever having been where it was saved. Its next request arms this again.
      if (!listReady.current || !listRestoreReady.current || nativeSettledIndex.current !== sheetCommand.current.index) return;
      const wanted = restore.current;
      const reachable = restoreTarget.current !== null && restoreTarget.current >= wanted;
      stalls.current += 1;
      trace('stall', stalls.current, wanted, restoreTarget.current ?? -1, contentHeight.current, observedY.current, extent.bottom ?? -1, extent.footer ?? -1);
      if (stalls.current <= RESTORE_STALL_RETRIES) {
        restoreAttempted.current = false;
        if (stalls.current === 1 || reachable) retryRestore.current(); else listRef.current.scrollToEnd?.({ animated: false });
        armStallRef.current();
        return;
      }
      const reached = reachable ? wanted : Math.round(observedY.current);
      restore.current = null; restoreTarget.current = null; restoreAck.current = null; restoreAttempted.current = false;
      trace('ack', reached, reached, reached, false);
      offset.current = reached; writeOffset();
    }, RESTORE_STALL_MS);
  }, [clearStall, currentList, extent, trace, writeOffset]);
  armStallRef.current = armStall;
  useEffect(() => clearStall, [coverageOwner, clearStall]);
  const receiveCellLayout = useCallback((index: number, bottom: number) => {
    if (!currentSheet() || currentExtent.current !== extent || index !== listed.length - 1) return;
    extent.bottom = bottom;
    retryRestore.current();
  }, [currentSheet, extent, listed.length]);
  const cellLayoutContext = useMemo(() => ({ sequence: extent.sequence, receiveLayout: receiveCellLayout }), [extent, receiveCellLayout]);
  const receiveListReady = useCallback(({ ready, canRestore, gestureStarted, state, settledIndex, offset: observed, command }: NativeListSnapshot) => {
    trace('ready', ready, state, currentSheet(), restore.current ?? -1, offset.current, position.value,
      focused, coverageOwner.active, currentCoverageOwner.current === coverageOwner, listHeight.current, contentHeight.current, listWindow, settledIndex, observed, canRestore);
    if (!currentList() || command !== sheetCommand.current.sequence) return;
    if (gestureStarted) { interacted.current = true; userIntent?.(); }
    if (gestureStarted && sheetCommand.current.pending) {
      const next = { ...sheetCommand.current, sequence: command + 1, pending: false };
      sheetCommand.current = next; applySheet(next); // Retire queued observations of the interrupted request too.
    }
    if (sheetCommand.current.pending && settledIndex !== sheetCommand.current.index) {
      listReady.current = ready; listRestoreReady.current = false;
      restoreAttempted.current = false; restoreAck.current = null;
      return;
    }
    if (settledIndex >= 0 && settledIndex <= highest) {
      acceptSheetIndex(settledIndex);
      nativeSettledIndex.current = settledIndex; nativeSpringMoving.current = false;
    }
    listReady.current = ready; listRestoreReady.current = canRestore;
    if (!canRestore) { restoreAttempted.current = false; restoreAck.current = null; }
    else {
      const at = restore.current;
      // No scroll event is emitted when the retained native list already sits at the saved target. Only this
      // mount/extent's actual unlocked, idle native event witness can confirm that exact original offset.
      // A lower provisional target still needs command acknowledgement and measured final-cell/footer proof.
      if (retainedRestoreOwner.current === coverageOwner.sequence && at !== null && observed >= 0 && Math.abs(observed - at) <= 1) {
        trace('ack', observed, at, at, true);
        offset.current = observed; restore.current = null; restoreTarget.current = null; restoreAck.current = null;
        restoreAttempted.current = false; retainedRestoreOwner.current = null; writeOffset();
      } else tryRestore();
    }
  }, [currentSheet, currentList, tryRestore, trace, position, focused, coverageOwner, listWindow, highest, writeOffset, acceptSheetIndex, userIntent]);
  const onScroll = useCallback((event: { nativeEvent: NativeScrollEvent }) => {
    const y = Math.max(0, event?.nativeEvent?.contentOffset?.y ?? 0);
    observedY.current = y;
    if (y === 0) {
      const values = [currentSheet(), listReady.current, restore.current ?? -1, restoreTarget.current ?? -1,
        restoreAttempted.current, offset.current, scrolledRef.current, focused, coverageOwner.active, currentCoverageOwner.current === coverageOwner];
      const signature = values.join(':');
      if (signature !== tracedZero.current) { tracedZero.current = signature; trace('scroll0', ...values); }
    } else tracedZero.current = null;
    if (!currentList() || !listReady.current) {
      const rejected = [Math.floor(y / 64), focused, coverageOwner.active, currentCoverageOwner.current === coverageOwner, listReady.current].join(':');
      if (rejected !== tracedRejectedScroll.current) {
        tracedRejectedScroll.current = rejected;
        trace('scroll-reject', y, focused, coverageOwner.active, currentCoverageOwner.current === coverageOwner, listReady.current);
      }
      return;
    }
    tracedRejectedScroll.current = null;
    // Native mount/layout and locked-scroll resets can emit zero after content was measured. Only the
    // acknowledged target completes restoration; these synthetic events must never overwrite the saved view.
    if (restore.current !== null) {
      if (!listRestoreReady.current || !restoreAttempted.current || restoreCommand.current !== sheetCommand.current.sequence
        || restoreTarget.current === null || Math.abs(y - restoreTarget.current) > 1) return;
      restoreAck.current = y;
      // Reaching the current rendered window drives RN to render more cells. Keep the
      // original logical target until it is reached or the actual data end is measured.
      if (restoreTarget.current < restore.current && !hasMeasuredEnd()) return;
      trace('ack', y, restore.current, restoreTarget.current);
      restore.current = null; restoreTarget.current = null; restoreAttempted.current = false;
    }
    offset.current = y;
    if (y > 0 && (tracedScroll.current === null || Math.abs(y - tracedScroll.current) >= 64)) {
      trace('scroll', y, latestView.current.listOffset ?? 0, scrolledRef.current); tracedScroll.current = y;
    }
    scrolledRef.current = y > SCROLLED;
    if (offsetTimer.current) clearTimeout(offsetTimer.current);
    // An accepted user scroll still belongs to this visit if folding the chips changes the viewport before saving.
    offsetTimer.current = setTimeout(() => { if (currentSheet()) writeOffset(); }, OFFSET_SETTLE_MS);
  }, [writeOffset, currentSheet, currentList, hasMeasuredEnd, trace, focused, coverageOwner]);
  // Opening a row flushes deliberately before navigation; background scroll deliveries and a pending
  // debounce from the retired visit must not overwrite the position restored on the next visit.
  useEffect(() => () => {
    if (offsetTimer.current) { clearTimeout(offsetTimer.current); offsetTimer.current = null; }
  }, [coverageOwner]);
  // gorhom 5.2.14 takes `onScroll` and calls it on the JS thread with `{ nativeEvent }` (useScrollHandler, runOnJS), but its
  // list types leave the prop out; it is handed over as the library reads it.
  const scrollProps = { onScroll } as object;
  useEffect(() => {
    trace(focused ? 'focus' : 'blur', coverageOwner.sequence, latestView.current.listOffset ?? 0, offset.current,
      traceState.current.scrolled, traceState.current.index, hasRows, loading, error);
    if (!focused) {
      restore.current = null; restoreTarget.current = null; restoreAttempted.current = false; listReady.current = false;
      // Keep settled native geometry for a possible retained return; a new mount clears it before children render.
    } else tryRestore();
  }, [hasRows, focused, tryRestore, trace]);
  useEffect(() => {
    trace('geometry', bodyHeight, toolsBottom, listTop, peek, barHeight, scrolledRef.current, sheetIndex, listHeight.current, contentHeight.current);
  }, [bodyHeight, toolsBottom, listTop, peek, barHeight, sheetIndex, trace]);
  const onContentSizeChange = (_width: number, height: number) => {
    trace('content', currentSheet(), height, contentHeight.current, listHeight.current, restore.current ?? -1);
    if (!currentList()) return;
    if (contentHeight.current !== height) { restoreAttempted.current = false; stalls.current = 0; clearStall(); }
    contentHeight.current = height;
    tryRestore();
  };
  const refreshList = () => { trace('refresh', currentSheet(), restore.current ?? -1); if (currentList()) { restore.current = null; props.onRefresh(); } };
  const searchKey = JSON.stringify([query, price, area, when, where, freePlaces, chosenPlace, dates, pinPlace ?? null, offMap]);
  const lastSearch = useRef(searchKey);
  useEffect(() => {
    if (lastSearch.current === searchKey) return;
    trace('search-change', latestView.current.listOffset ?? 0, offset.current, restore.current ?? -1);
    lastSearch.current = searchKey;
    restore.current = null; offset.current = 0; scrolledRef.current = false;
    listRef.current?.scrollToOffset?.({ offset: 0, animated: false });
    if ((latestView.current.listOffset ?? 0) !== 0) change({ listOffset: 0 });
  }, [searchKey, change, trace]);

  // How old the tasks are, as of this read of the list: the moment is fixed with the page, so a card does not change its words while it is on screen.
  const published = props.p6Seam?.published;
  const ageOf = useMemo(() => taskAgeOf(published, new Date()), [published]);
  const appear = useAppear();
  const cameFromSkeleton = useRef(props.arriveAfterLoading ?? props.loading).current;
  appear.settle(listed.map(keyOf), searchKey, { afterLoading: cameFromSkeleton });
  const appearRef = useRef(appear); appearRef.current = appear;
  const sectionsRef = useRef(sections); sectionsRef.current = sections;
  // The render window is wider than the visible list. Start authorized photo reads only for settled visible rows,
  // and unmount them when the sheet is hidden or this route loses focus; AuthorizedPhoto aborts on unmount.
  // Gorhom sizes its content to the highest detent even at half height, so native viewability is trusted only at full.
  const [portraitIds, setPortraitIds] = useState<ReadonlySet<string>>(() => new Set());
  const portraitViewability = useRef({ itemVisiblePercentThreshold: 30, minimumViewTime: 180 }).current;
  const visibleRangeRef = useRef(props.p6Seam?.onVisibleRange); visibleRangeRef.current = props.p6Seam?.onVisibleRange;
  const sourceIndexes = useMemo(() => new Map(mapped.map((item, index) => [item.id, index])), [mapped]);
  const sourceIndexesRef = useRef(sourceIndexes); sourceIndexesRef.current = sourceIndexes;
  // One function for the life of the list: React Native refuses a FlatList whose `onViewableItemsChanged` changes on the fly ("Changing
  // onViewableItemsChanged on the fly is not supported", in development builds and on the web), so the current guard is read through a ref.
  const currentListRef = useRef(currentList); currentListRef.current = currentList;
  const onVisibleRows = useCallback(({ viewableItems }: { viewableItems: ViewToken<MarketplaceItem>[] }) => {
    if (!currentListRef.current()) return;
    const shown = viewableItems.filter(token => token.isViewable);
    const next = new Set(shown.slice(0, 6).map(token => token.item.id));
    setPortraitIds(current => current.size === next.size && [...next].every(id => current.has(id)) ? current : next);
    // P6: the rows on screen get their optional details (relation, publisher), not only the first hundred of the list.
    // A section, publication promotion or point-free lens changes display indexes, never the P6 source indexes.
    const indexes = shown.map(token => sourceIndexesRef.current.get(token.item.id)).filter((index): index is number => index !== undefined);
    if (indexes.length) visibleRangeRef.current?.(Math.min(...indexes), Math.max(...indexes));
  }, []);
  useEffect(() => { setPortraitIds(new Set()); }, [props.scopeKey]);
  const showPortraits = focused && !cardShown && sheetIndex > SNAP.peek;
  const renderItem = useCallback(({ item, index }: ListRenderItemInfo<MarketplaceItem>) =>
    <DiscoveryRow item={item} index={index} animate={appearRef.current.isNew(keyOf(item))} relation={relation(item)} onOpen={openItem}
      portraitVisible={showPortraits && (portraitIds.has(item.id) || index < 6)}
      section={sectionsRef.current.get(index)} />, [relation, openItem, showPortraits, portraitIds]);

  // The count says what is listed, honestly: under a map area, the area's tasks and, apart, those with no point at all;
  // on one point, that point's tasks. It is independent of the account overlay.
  const p6Counts = p6?.counts;
  const exactListed = p6Counts?.listed ?? listed.length;
  const exactInArea = p6Counts?.inArea ?? inArea.length;
  const exactWithoutPoint = p6Counts?.withoutPoint ?? withoutPoint.length;
  // The current P6 ALL contract counts section=1 as withoutPoint, but ALL puts every row in section=0.
  // Its zero is not an exact count of point-free work. Until a complete page set is present, do not invent a total.
  const pinlessCountKnown = !p6WholeList || !p6?.pageHasMore && mapped.length >= (p6Counts?.listed ?? mapped.length);
  const exactPinless = view.where === 'remote' ? 0 : p6WholeList ? mappedWithoutPin : p6Counts?.withoutPoint ?? mappedWithoutPin;
  // Continue through the same authorized pages until the point-free section is complete. An unknown
  // ALL total must not hide later point-free rows or stop after a page containing only mapped work.
  const offMapNeeded = offMap ? exactPinless : 0;
  const offMapMore = !!p6 && offMap && !loading && !refreshing && !error && p6.pageHasMore && !p6.loadingMore
    && (!pinlessCountKnown || listed.length < offMapNeeded);
  useEffect(() => { if (offMapMore && currentList()) p6?.onNextPage(); }, [offMapMore, listed.length, mapped.length]); // eslint-disable-line react-hooks/exhaustive-deps
  // The way in is a row under the count, only while some tasks are not on the map; the way out is its capsule. When nothing is left off the map (the
  // conditions changed, the remote filter came on) the choice has nothing to say and goes.
  useEffect(() => { if (offMap && !loading && !refreshing && !error && !props.collectionStatus && pinlessCountKnown && exactPinless === 0) setOffMap(false); }, [offMap, loading, refreshing, error, props.collectionStatus, exactPinless, pinlessCountKnown]);

  // The one state view: reading, not read, nothing here, nothing for these conditions, nothing at all. The map and the list always show every
  // published task (owner, 2026-10-07); the explicit 'Za mene' subset also requires a current confirmed worker profile.
  // Tasks under these conditions exist elsewhere when the legacy read holds them, or when P6's whole-filter count says so.
  const elsewhere = p6 ? (p6.counts?.mapped ?? 0) > 0 : mapped.length > 0;
  const conditionsOn = !!view.query.trim() || (p6 ? conditionCount > 0 : discoveryFiltered(view)) || !!view.place;
  // "Za mene" on, and nothing else narrowing the list: what the person asked for is what leaves nothing, and the way on is every task again.
  const emptyKey = JSON.stringify([props.scopeKey, query, price, when, where, freePlaces, chosenPlace, dates, forMeOn, offMap]);
  type EmptyDescriptor = { kind: 'place'; point: boolean } | { kind: 'forMe' | 'filtered' | 'none' };
  const confirmedEmpty = useRef<{ key: string; value: EmptyDescriptor | null }>({ key: emptyKey, value: null });
  if (confirmedEmpty.current.key !== emptyKey) confirmedEmpty.current = { key: emptyKey, value: null };
  const heldEmpty = refreshing && !loading && !error && !props.collectionStatus ? confirmedEmpty.current.value : null;
  const computedState: DiscoveryListStateKind = loading || (refreshing && !heldEmpty) || props.collectionStatus === 'loading' || offMapMore || (offMap && !!p6?.loadingMore && !listed.length) ? { kind: 'loading' }
    : error || props.collectionStatus === 'error' ? { kind: 'error', onRetry: refreshList, errorReason: props.errorReason }
      // Only the map's area or its one point leaves nothing: the tasks are elsewhere on the map, one move or one tap away.
      : (pinPlace || area) && elsewhere && !offMap ? { kind: 'place', point: !!pinPlace, onShowAll: showAll }
        : forMeOn && !conditionsOn ? { kind: 'forMe', onShowAll: () => chooseScope('all'), onWorkProfile: props.onWorkProfile }
          : conditionsOn ? { kind: 'filtered', remote: where === 'remote', onClear: reset }
            : { kind: 'none', onRefresh: refreshList, onNew: props.onNew };
  // Keep the last confirmed empty picture during a map pan, just as the coordinator retains its rows.
  // Store facts only: callbacks always belong to this render and account; a first read still shows loading.
  const listState: DiscoveryListStateKind = !heldEmpty ? computedState
    : heldEmpty.kind === 'place' ? { ...heldEmpty, onShowAll: showAll }
      : heldEmpty.kind === 'forMe' ? { kind: 'forMe', onShowAll: () => chooseScope('all'), onWorkProfile: props.onWorkProfile }
        : heldEmpty.kind === 'filtered' ? { kind: 'filtered', remote: where === 'remote', onClear: reset }
          : { kind: 'none', onRefresh: refreshList, onNew: props.onNew };
  useLayoutEffect(() => {
    if (loading || refreshing || props.collectionStatus || offMapMore || p6?.loadingMore) return;
    confirmedEmpty.current.value = error || listed.length || computedState.kind === 'loading' || computedState.kind === 'error' ? null
      : computedState.kind === 'place' ? { kind: 'place', point: computedState.point } : { kind: computedState.kind };
  });
  const empty = <View style={s.empty}><DiscoveryListState state={listState} clearAllLabel={CLEAR_ALL} compact={mapShown} /></View>;
  // A time choice leaves out the tasks whose schedule names no day; the list says how many instead of hiding them silently.
  const footer = undated ? <View key={extent.sequence} onLayout={event => {
    if (!currentSheet() || currentExtent.current !== extent) return;
    extent.footer = event.nativeEvent.layout.height; tryRestore();
  }}><T variant="note" tone="muted" style={s.undated}>{undatedWords(undated)}</T></View> : null;

  const line = countLineWords({ status: loading ? 'loading' : error ? 'error' : 'ready', listed: exactListed, inArea: exactInArea,
    withoutPoint: exactWithoutPoint, pinless: exactPinless, area: !!area, pinPlace: !!pinPlace });
  const collectionWords = props.collectionStatus === 'loading' ? 'Učitavamo ostale zadatke…'
    : props.collectionStatus === 'error' ? 'Ostali zadaci nisu učitani' : null;
  const replacingWords = refreshing && !loading ? 'Osvežavamo zadatke…' : null;
  // The focused point-free list distinguishes an exact total from a still-partial loaded count.
  const shownCount = offMap && !loading && !error ? exactPinless : exactListed;
  const offMapCountWords = pinlessCountKnown ? countWords(shownCount) : `${OFF_MAP_CHIP} · učitano: ${listed.length}`;
  const spoken = replacingWords ?? collectionWords ?? (offMap && !loading && !error
    ? pinlessCountKnown ? `${offMapCountWords} · ${OFF_MAP_CHIP.toLocaleLowerCase('sr-Latn-RS')}` : offMapCountWords : `${line.words}${line.extra}`);
  // The top edge is a glanceable count of the actual list. Area and pinless context remain in its
  // accessible name, the search summary and the list's own section heading.
  const count = <T variant="note" style={s.count}>
    {replacingWords ?? collectionWords ?? (loading || error ? line.words : offMap ? offMapCountWords : countWords(shownCount))}
  </T>;
  // The server reads the open tasks newest first (UX plan 2.14), and says so over the list: only a P6 page that holds more than one.
  const sorted = !!p6 && !loading && !refreshing && !error && !collectionWords && shownCount > 1;
  const sortedWords = !offMap && inArea.length > 0 && withoutPoint.length > 0 ? 'Najnovije prvo u odeljku' : NEWEST_FIRST;
  // A passive map pan must not grow the top bar or move its chips. Its reset belongs beside the list count.
  const areaOnly = !!area && !view.place && !view.query.trim() && !pinPlace;
  // The filter control summarizes a selected place, words or one point; its "×" takes that context away in one step. A place has taken
  // over the area, so it goes with the area; words alone leave the area as it was (the list still follows the map); a point and the area go through the reader's own command.
  const searchedWords = appliedMapPlace ? searchWords({ ...view, place: appliedMapPlace.label }) : areaOnly ? null : searchWords(view);
  const clearSearch = () => {
    const words = view.query.trim() !== '';
    if (appliedMapPlace || view.place) {
      setAppliedMapPlace(null); pendingMapPlace.current = null; setGeocodedTarget(null);
      toggle({ place: null, query: '', area: null, pinPlace: null }); return;
    }
    if (words) toggle({ query: '' });
    if (pinPlace || (!words && area)) showAll();
  };
  // The row under the top line (the way in to "Nisu na mapi"): only while some are not on the map and the list is the whole list.
  const showOffMap = !offMap && where !== 'remote' && !loading && !refreshing && !error && !collectionWords
    && (!pinlessCountKnown || exactPinless > 0);
  const offMapEntryWords = pinlessCountKnown ? offMapWords(exactPinless) : OFF_MAP_CHIP;
  const openOffMap = () => { userIntent?.(); retireCameraIntent(); retireListFocus(); clearSelection(); setOffMap(true); setSheetIndex(SNAP.half); };
  // iOS has no live region: a screen reader hears the new count once the list's area has stayed still for a second.
  const spokenRef = useRef(spoken); spokenRef.current = spoken;
  const whereKey = JSON.stringify([area ?? null, pinPlace ?? null]), lastWhere = useRef(whereKey);
  useEffect(() => {
    if (lastWhere.current === whereKey) return;
    lastWhere.current = whereKey;
    if (Platform.OS !== 'ios' || !focused) return;
    const timer = setTimeout(() => { AccessibilityInfo.announceForAccessibility?.(spokenRef.current); }, AREA_ANNOUNCE_MS);
    return () => clearTimeout(timer);
  }, [whereKey, focused]);
  // The top line is the sheet's handle: a tap goes to the next height (lowered, half, full, and round again); a drag of it, of the header
  // or of the list moves the same sheet, and the sheet never overshoots.
  // Another page of the server's list is being read, and the person is looking at the list (not at the map under a lowered sheet).
  const paging = !!props.p6Seam?.loadingMore && !loading && !refreshing && !error && hasRows && sheetIndex > SNAP.peek;
  const cycleSheet = () => { userIntent?.(); Keyboard.dismiss(); clearSelection(); setSheetIndex(nextSheetIndex(sheetIndex)); };
  const header = <View testID="discovery-list-header" style={s.header}
    onLayout={event => { const next = Math.ceil(event.nativeEvent.layout.height); if (next > 0) setPeek(current => current === next ? current : next); }}>
    <View testID="discovery-list-header-lead" onLayout={event => {
      const next = Math.ceil(event.nativeEvent.layout.height) + sys.space.sm;
      const capped = Math.min(next, 96);
      if (capped > sys.space.sm) setHeaderLeadHeight(current => current === capped ? current : capped);
    }}>
    <View style={s.grab} />
    {/* A polite live region: TalkBack hears the count when it changes (a new area, a new read), without moving its focus. */}
    <View style={s.countLine}>
    <Press testID="list-count" accessibilityRole="button" accessibilityLabel={spoken} accessibilityValue={sorted ? { text: sortedWords } : undefined}
      accessibilityState={{ expanded: sheetIndex > SNAP.peek, busy: loading || refreshing }} accessibilityHint={handleHint(sheetIndex)} accessibilityLiveRegion="polite"
      haptic="select" scaleTo={sys.motion.scale.row} onPress={cycleSheet} style={s.countRow}>
      {count}{sheetIndex > SNAP.peek && sorted && !areaOnly && !pillShown ? <T variant="note" tone="muted" style={s.sortedBy}>{sortedWords}</T> : null}
    </Press>
    {sheetIndex > SNAP.peek && !loading && !refreshing ? <Press testID="discovery-refresh" accessibilityRole="button" accessibilityLabel="Osveži zadatke"
      haptic="select" scaleTo={sys.motion.scale.button} hitSlop={0} onPress={refreshList} style={s.headerIcon}>
      <Glyph name="refresh" size={20} tone="green" />
    </Press> : null}
    {pillFade.mounted ? <NativeAnimated.View pointerEvents={pillShown ? 'box-none' : 'none'} style={[s.mapPillSlot, { opacity: pillFade.opacity }, !pillShown && s.mapPillSlotHidden]}
      accessibilityElementsHidden={!pillShown} importantForAccessibility={pillShown ? 'auto' : 'no-hide-descendants'}>
      <Surface kind="float" style={[s.mapPillSurface, emptyOverMap && s.mapPillQuiet]}>
        <Press accessibilityRole="button" accessibilityLabel="Mapa" accessibilityHint="Spušta listu i prikazuje mapu." haptic="select" scaleTo={sys.motion.scale.button}
          onPress={() => { userIntent?.(); setSheetIndex(SNAP.peek); }} style={s.mapPill}>
          <Glyph name="map" size={20} tone={emptyOverMap ? 'green' : 'onGreen'} on />
          <T variant="action" style={[s.mapPillText, emptyOverMap && s.mapPillQuietText]}>Mapa</T>
        </Press>
      </Surface>
    </NativeAnimated.View> : null}
    </View>
    {areaOnly ? <Press testID="clear-map-area" accessibilityRole="button" accessibilityLabel="Prikaži sve zadatke"
      haptic="select" hitSlop={0} onPress={showAll} style={s.areaReset}>
      <T variant="note" style={s.areaResetText}>Sve oblasti</T>
    </Press> : null}
    {/* The focused point-free list remains reachable even before an ALL page set has a known count. */}
    {showOffMap ? <Press testID="off-map-entry" accessibilityRole="button" accessibilityLabel={`${offMapEntryWords}. Prikaži samo te zadatke.`}
      haptic="select" scaleTo={sys.motion.scale.row} onPress={openOffMap} style={s.offMapRow}>
      <T variant="note" style={s.offMapText}>{offMapEntryWords}</T><Glyph name="caret-right" size={16} tone="muted" />
    </Press> : null}
    </View>
    {p6?.mapRead && (p6.mapRead.loading || p6.mapRead.error) ? <View style={s.mapRecovery}>
      <T variant="note" tone="muted" accessibilityLiveRegion="polite">{p6.mapRead.loading
        ? 'Učitavamo oznake na mapi…' : p6.map.markers.length
          ? 'Oznake zadataka na mapi nisu osvežene.' : 'Oznake zadataka na mapi nisu učitane.'}</T>
      <Press accessibilityRole="button" accessibilityLabel="Pokušajte ponovo sa mapom" hitSlop={0}
        accessibilityState={{ disabled: p6.mapRead.loading, busy: p6.mapRead.loading }} disabled={p6.mapRead.loading}
        onPress={p6.mapRead.loading ? undefined : p6.mapRead.onRetry} style={s.mapRetry}>
        <T variant="action" style={p6.mapRead.loading ? s.mapRetryBusy : s.relationsRetryText}>Pokušajte ponovo sa mapom</T>
      </Press>
    </View> : null}
    {props.collectionStatus === 'error' ? <View style={s.relationsRecovery}>
      <T variant="note" style={s.relationsMessage}>Vaš zadatak je objavljen. Osvežite listu da vidite i ostale.</T>
      <Press accessibilityRole="button" accessibilityLabel="Osvežite ostale zadatke" onPress={refreshList}
        style={s.relationsRetry}><T variant="action" style={s.relationsRetryText}>Osvežite</T></Press>
    </View> : null}
    {props.publicationUnavailable ? <View style={s.relationsRecovery}>
      <T variant="note" style={s.relationsMessage}>{props.publicationUnavailable === 'missing'
        ? 'Objavljen zadatak trenutno nije dostupan u pretrazi.' : 'Prikaz objavljenog zadatka nije potvrđen.'}</T>
      {props.onOpenPublishedTask ? <Press accessibilityRole="button" accessibilityLabel="Otvorite Vaš objavljen zadatak"
        onPress={props.onOpenPublishedTask} style={s.relationsRetry}><T variant="action" style={s.relationsRetryText}>Otvorite Vaš zadatak</T></Press> : null}
    </View> : null}
    {!loading && !error && items.length > 0 && props.relationsError ? <View style={s.relationsRecovery}>
      <T variant="note" tone="muted" style={s.relationsMessage}>Vaš status uz zadatke nije učitan.</T>
      <Press accessibilityRole="button" accessibilityLabel="Proverite status zadataka" onPress={refreshList}
        style={s.relationsRetry}><T variant="action" style={s.relationsRetryText}>Proverite</T></Press>
    </View> : null}
  </View>;

  return <TaskAgeContext.Provider value={ageOf}><DistanceFromContext.Provider value={nearby.me}><SafeAreaView edges={['top']} style={s.screen}>
    {/* Search is this screen's header. Identity belongs to Home; the existing account/publication entries stay in Još. */}
    <View ref={searchBlurTarget} testID="discovery-body" style={s.body} onLayout={event => { const next = Math.round(event.nativeEvent.layout.height); if (next > 0) setBodyHeight(next); }}>
      {/* The map is the whole screen at every height of the list. When the list is all the way up it covers the map and the map locks; a tap on what
          is left of it (a gap by the tools) lowers the list to half. */}
      <View testID="discovery-map-layer" style={StyleSheet.absoluteFill}>
        {mapShown ? <DiscoveryMap canRetainMap={props.canRetainMap} items={mapped} selectedId={props.p6Seam ? null : chosen?.id ?? null}
          selectedPlace={props.p6Seam ? null : placeTasks.length > 1 ? place!.key : null}
          p6Server={props.p6Seam ? { ...props.p6Seam.map, onSelect: selectServerMarker, onClear: props.p6Seam.onClearPeek } : undefined}
          relations={relations}
          onUserIntent={userIntent}
          publicationCameraToken={cameraRequestToken && props.publicationFocus?.id === chosen?.id ? cameraRequestToken : null}
          onPublicationCameraConsumed={consumeCameraIntent} onPublicationCameraRetired={retireCameraIntent}
          initialWorkArea={props.initialWorkArea} onInitialWorkAreaHandled={props.onInitialWorkAreaHandled}
          viewport={view.viewport} scopeKey={props.scopeKey} onSelect={select} onSelectPlace={selectPlace} onClear={clearSelection}
          onViewport={viewport => change({ viewport })} onArea={followArea} fitTo={fit} centerNearby={geocodedTarget ?? nearby.target} me={nearby.me}
          onNearbyConsumed={key => { if (key < 0) setGeocodedTarget(current => current?.key === key ? null : current); else nearby.consume(key); }}
          onFitted={key => setFit(current => current?.key === key ? null : current)}
          onList={() => { userIntent?.(); setSheetIndex(SNAP.full); }} sheetTop={position} toolsBottom={toolsBottom} fitBottom={fitBottom} nearbyFitBottom={nearbyFitBottom}
          listDetent={cameraListDetent}
          controlsMinTop={toolsBottom + GAP} locked={mapCovered} locateShown={canLocate}
          onStripPress={() => { userIntent?.(); setSheetIndex(SNAP.half); }}
          cameraLayoutReady={bodyHeight > 0 && toolsMeasured}
          coverBottom={coverBottom} creditsBottom={collapsedSnap} creditsCovered={cardShown || sheetIndex > SNAP.peek}
          focusBottom={cardBottom + GAP + Math.min(360, Math.round(windowHeight / 2))} />
          : <View style={s.ground} />}
      </View>
      {/* "Moja lokacija": the right end of the map's row of furniture, directly above the list sheet, riding it like the map's sources on the left. */}
      {canLocate && bodyHeight ? <Animated.View testID="discovery-locate-layer" pointerEvents="box-none" style={[s.locateLayer, { height: footerRow }, locateRide]}>
        {/* Everything over the map is a float: white, one line, one shadow. */}
        <Surface kind="float" style={[s.locate, { top: Math.round((footerRow - CONTROL_SIZE) / 2) }]}>
          <Press testID="locate" accessibilityRole="button" accessibilityLabel="Moja lokacija"
            accessibilityHint="Jednom koristi lokaciju da centrira mapu. Ne čuva je i ne menja uslove pretrage."
            accessibilityState={{ disabled: nearby.busy, busy: nearby.busy }} disabled={nearby.busy}
            haptic="select" scaleTo={sys.motion.scale.button} hitSlop={2} onPress={findNearby} style={s.locateTouch}>
            {nearby.busy ? <ActivityIndicator size="small" color={sys.color.ink} /> : <Crosshair size={22} color={sys.color.ink} />}
          </Press>
        </Surface>
      </Animated.View> : null}
      <DiscoveryListSheet key={nativeMountKey} index={sheetIndex} snapPoints={sheetSnapPoints} position={position} animatedIndex={sheetAnimatedIndex} reduced={reduced}
        compactTop={listTop} capsuleSpace={capsuleSpace}
        // Gorhom's `index` effect returns early while `animateOnMount` is set and its mount animation has not FINISHED (an interrupted one never
        // sets `didAnimateOnMount`), and nothing re-runs it: a later request for another detent is lost, React says FULL and the native sheet stays
        // where it is (a dimmed empty screen with only the "Mapa" pill; found on the emulator, on the first open of the list and after a return).
        // The P6 screen is rebuilt on every return and started while the map is still initialising, so it never depends on that animation.
        animateOnMount={nativeMountKey === 1 && !props.p6Seam}
        onIndex={onIndex} onAnimate={onSheetAnimate} header={scrollHeader ? null : header}
        sunk={cardShown}>
        <DiscoveryScrollReadiness owner={coverageOwner.sequence} extent={extent.sequence} command={sheetCommand.current.sequence}
          requestedIndex={sheetIndex} pendingRequest={sheetCommand.current.pending} onReady={receiveListReady} chromeOffset={chromeOffset}>
        {/* The content drag raises the sheet, then scrolls the list; at offset zero a downward drag lowers it again.
            An onRefresh prop makes Gorhom reserve that FULL gesture for refresh. Refresh has its own action beside the list count. */}
        <CellLayoutContext.Provider value={cellLayoutContext}>
        <BottomSheetFlatList<MarketplaceItem> ref={listRef} data={listed} keyExtractor={keyOf} renderItem={renderItem} CellRendererComponent={DiscoveryCell}
          scrollEventsHandlersHook={useDiscoveryScrollEvents}
          style={[listWindow > 0 ? { height: listWindow, flexGrow: 0, flexShrink: 0 } : undefined, listMotion]}
          viewabilityConfig={portraitViewability} onViewableItemsChanged={onVisibleRows}
          ListHeaderComponent={<View testID="discovery-scrolling-header" style={s.scrollingHeader}>
            <View pointerEvents="none" accessible={false} style={{ height: capsuleSpace }} />{header}</View>}
          extraData={sectionsSignature}
          onEndReached={!refreshing && props.p6Seam?.pageHasMore && !props.p6Seam.loadingMore ? () => { if (currentList()) props.p6Seam?.onNextPage(); } : undefined}
          onEndReachedThreshold={props.p6Seam?.pageHasMore ? 0.4 : undefined}
          {...scrollProps} onContentSizeChange={onContentSizeChange}
          onLayout={event => {
            trace('layout', currentSheet(), event.nativeEvent.layout.height, listHeight.current, contentHeight.current, restore.current ?? -1);
            if (!currentList()) return;
            const height = event.nativeEvent.layout.height;
            listHeight.current = height; tryRestore();
          }}
          onScrollBeginDrag={() => { interacted.current = true; trace('drag', currentSheet(), listReady.current, restore.current ?? -1, offset.current); tracedScroll.current = null; if (currentList()) { userIntent?.(); restore.current = null; } }}
          keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" showsVerticalScrollIndicator={false}
          // The bottom navigation overlays the lower list; the last card clears it through `endPadding`.
          contentContainerStyle={listPadding}
          // Six cards are more than one phone screen of this card; the window stays modest so a fast
          // scroll fills in quickly without holding the whole list mounted.
          initialNumToRender={6} maxToRenderPerBatch={6} windowSize={7} removeClippedSubviews={CLIP_OFFSCREEN}
          ItemSeparatorComponent={Separator} ListEmptyComponent={empty} ListFooterComponent={footer} />
        </CellLayoutContext.Provider>
        </DiscoveryScrollReadiness>
      </DiscoveryListSheet>
      <DiscoverySearchBar where={searchedWords} onBack={bar ? undefined : props.onBack}
        onClearWhere={searchedWords ? clearSearch : undefined}
        filters={{ count: conditionCount, onPress: () => openPanel('filters') }}
        onLayout={bottom => { setToolsBottom(current => current === bottom ? current : bottom); setToolsMeasured(true); }}
        onSearchLayout={bottom => setSearchBottom(current => current === bottom ? current : bottom)}
        motion={{ sheetTop: position, offset: chromeOffset, compactTop: listTop, capsules: capsuleSpace, hidden: chipsHidden }}
        chips={cardShown ? undefined : chipRow}
        below={<>
          {canLocate && nearby.message ? <NearbyNotice message={nearby.message} onSettings={nearby.settings} /> : null}
          {props.forMeRefused ? <ForMeNotice message={FOR_ME_REFUSED} entry={WORK_PROFILE_ENTRY} onEntry={props.onWorkProfile}
            onClose={() => props.onDismissForMeRefused?.()} /> : null}
        </>} />
      {/* The next page of a long list is on its way. It is said over the list's end and not inside it, so the end the list measures (and the
          place a return restores to) never moves; a quiet line, since a spinner lives only inside a button. */}
      {paging ? <View pointerEvents="none" accessible accessibilityLabel={PAGING_WORDS} accessibilityLiveRegion="polite"
        style={[s.pagingRow, { bottom: sys.space.base + barHeight }]}>
        <Surface kind="float" style={s.paging}><T variant="note" style={s.pagingText}>{PAGING_WORDS}</T></Surface>
      </View> : null}
      {cardShown ? <DiscoveryPeek selectionKey={props.p6Seam?.peek?.key ?? (chosen ? `task:${chosen.id}` : `place:${place!.key}`)}
        item={chosen} place={placeTasks} placeTotalCount={props.p6Seam?.peek?.placeTotalCount} relation={relation} active={focused} bottomInset={cardBottom} reduced={reduced}
        priceUnverified={props.p6Seam?.peek?.priceUnverified}
        maxHeight={previewMaxHeight}
        onOpen={openItem} onShowPlace={showPlace} onClose={clearSelection}
        onHeight={next => setCardHeight(current => current === next ? current : next)} /> : null}
    </View>
    {panel ? <DiscoverySearchPanel blurTarget={searchBlurTarget} items={items} view={view} mine={relations?.owned} now={now} mapArea={view.viewport?.bounds ?? null}
      mode={panel} reduced={reduced} readiness={readiness} p6Search={props.p6Seam?.search} recent={recents.items}
      placeScopeKey={props.scopeKey} appliedMapPlace={appliedMapPlace} onCenterPlace={centerOnConfirmedPlace} onOpenSearch={() => setPanel('search')}
      onApply={apply} onClose={() => setPanel(null)} onOpenTask={openItem} /> : null}
  </SafeAreaView></DistanceFromContext.Provider></TaskAgeContext.Provider>;
}

const s = StyleSheet.create({
  mapRecovery: { paddingHorizontal: sys.space.md, paddingTop: sys.space.xs },
  mapRetry: { alignSelf: 'flex-start', minHeight: layout.touch, minWidth: layout.touch, justifyContent: 'center' },
  mapRetryBusy: { color: sys.color.muted },
  relationsRecovery: { flexDirection: 'row', alignItems: 'center', gap: sys.space.sm, paddingHorizontal: sys.space.md },
  relationsMessage: { flex: 1 },
  relationsRetry: { minHeight: 44, justifyContent: 'center', paddingHorizontal: sys.space.sm },
  relationsRetryText: { color: sys.color.green },
  screen: { flex: 1, backgroundColor: sys.color.ground },
  body: { flex: 1 },
  separator: { height: sys.space.md },
  ground: { flex: 1, backgroundColor: sys.color.ground },
  // The layer of "moja lokacija": as wide as the map and as tall as the row of furniture; the UI thread moves it with the sheet.
  locateLayer: { position: 'absolute', left: 0, right: 0, top: 0 },
  locate: { position: 'absolute', right: sys.space.base, width: CONTROL_SIZE, height: CONTROL_SIZE, borderRadius: sys.radius.pill },
  // The touch fills the float (its line takes 1 dp each side) and keeps the round shape.
  locateTouch: { flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: sys.radius.pill },
  header: { paddingHorizontal: sys.space.lg, paddingBottom: sys.space.sm },
  // Cancel the list's side inset so the moved header keeps the same measured width and cannot oscillate between modes.
  scrollingHeader: { marginHorizontal: -sys.space.lg },
  grab: { alignSelf: 'center', width: 36, height: 4, borderRadius: 2, marginTop: sys.space.sm, marginBottom: 0, backgroundColor: sys.color.lineStrong },
  // Area reset is a separate row so the count and Mapa fit at 360 dp.
  countLine: { flexDirection: 'row', alignItems: 'center', gap: sys.space.md },
  headerIcon: { width: 48, minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  publishSurface: { borderRadius: sys.radius.pill, backgroundColor: sys.color.orange, borderColor: sys.color.orange },
  areaReset: { minHeight: 48, alignSelf: 'flex-start', justifyContent: 'center' },
  areaResetText: { color: sys.color.green, fontWeight: '600' },
  countRow: { flex: 1, minWidth: 0, minHeight: 48, paddingVertical: sys.space.sm, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    gap: sys.space.md, borderRadius: sys.radius.control },
  count: { color: sys.color.ink, fontWeight: '600', flexShrink: 1 },
  sortedBy: { textAlign: 'right' },
  // The way to the tasks that are not on the map: a quiet row under the count, 40 high (the press reaches 4 more above and under it, so 48 to a finger),
  // on the count's own left edge, with its caret right after the words.
  offMapRow: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: sys.space.xs, minHeight: 40, paddingRight: sys.space.sm },
  offMapText: { color: sys.color.ink, fontWeight: '500' },
  // The list's own padding is `listPadding` (it clears the bottom navigation).
  empty: { flex: 1, paddingVertical: sys.space.sm },
  undated: { paddingTop: sys.space.base, textAlign: 'center' },
  // The heading of a group of tasks (on the map, remote, with no point): the list's own words, never a card. 24 above it (12 of the gap between cards and 12 of its own), 12 under it.
  section: { flexDirection: 'row', alignItems: 'baseline', gap: sys.space.sm, paddingTop: sys.space.md, paddingBottom: sys.space.md },
  // The first heading stands right under the top line's own rows (the count, and the way to what is not on the map), which already end in their own air.
  sectionFirst: { paddingTop: 0 },
  sectionTitle: { fontWeight: '600', color: sys.color.ink },
  sectionCount: { color: sys.color.muted, fontVariant: ['tabular-nums'] },
  mapPillSlot: { flexShrink: 0 },
  mapPillSlotHidden: { position: 'absolute', right: 0 },
  // The quiet note while the next page is read, above the bottom navigation.
  pagingRow: { position: 'absolute', left: 0, right: 0, bottom: sys.space.base, alignItems: 'center' },
  paging: { paddingHorizontal: sys.space.base, paddingVertical: sys.space.sm, borderRadius: sys.radius.pill },
  pagingText: { color: sys.color.ink },
  // The green pill is a float like the rest: its own colour for ground and line, the system's shadow.
  mapPillSurface: { borderRadius: sys.radius.pill, backgroundColor: sys.color.green, borderColor: sys.color.green },
  mapPill: { flexDirection: 'row', alignItems: 'center', gap: sys.space.sm, minHeight: 48 - 2, paddingHorizontal: sys.space.md, borderRadius: sys.radius.pill },
  mapPillText: { color: sys.color.onGreen },
  mapPillQuiet: { backgroundColor: sys.color.surface, borderColor: sys.color.lineStrong },
  mapPillQuietText: { color: sys.color.green },
});
