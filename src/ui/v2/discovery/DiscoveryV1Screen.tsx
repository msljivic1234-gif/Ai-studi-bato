import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View } from 'react-native';
import type { Izvor } from '../../../data/ports';
import { createDiscoveryV1SupabaseTransport, DISCOVERY_V1_FOR_ME_REFUSED } from '../../../data/discoveryV1ClientTransport';
import { discoveryV1ErrorCode, traceDiscoveryV1 } from '../../../data/discoveryV1Trace';
import { createDiscoveryV1ExistingOverlayLoaders, discoveryV1OverlayRelation } from '../../../data/discoveryV1OverlayOwner';
import { createDiscoveryV1RouteCoordinator, type DiscoveryV1RouteSnapshot } from '../../../data/discoveryV1RouteCoordinator';
import type { DiscoveryV1MapMarker } from '../../../data/discoveryV1MarketplaceAdapter';
import type { MarketplaceItem, MarketplaceView, PublicBounds } from '../../../data/marketplaceView';
import type { WorkAreaCamera } from '../../../data/discoveryWorkArea';
import type { TaskRelation } from '../../../data/taskRelation';
import { discoveryWorkMode } from '../../../data/discoveryWorkMode';
import { DiscoveryV1PresentationBridge } from '../../../data/discoveryV1PresentationBridge';
import type { DiscoveryV1WarmReturn } from '../../../data/discoveryV1WarmReturn';
import type { SearchDraft } from './DiscoverySearchPanel';
import { SafeAreaView } from 'react-native-safe-area-context';
import { layout } from '../../system/layout';
import { DiscoveryListState } from './DiscoveryListState';
import { CLEAR_ALL } from './discoveryWords';
import type { DiscoveryTrace } from '../DiscoveryPresentation';

type Coordinator = ReturnType<typeof createDiscoveryV1RouteCoordinator>;

export type DiscoveryV1ScreenProps = {
  /** Optional route visit lease. null suspends a retained surface; undefined preserves standalone behavior. */
  activity?: object | null;
  canRetainMap?: () => boolean;
  onRetentionFailed?: () => void;
  source: Pick<Izvor, 'odnosiPremaZadacima'>;
  scopeKey: string;
  initialView: MarketplaceView;
  initialWorkArea?: WorkAreaCamera | null;
  onInitialWorkAreaHandled?: (key: string) => void;
  isCurrent: () => boolean;
  onPersistView: (view: MarketplaceView) => void;
  onOpen: (item: MarketplaceItem, relation: TaskRelation) => void;
  onBack?: () => void;
  onProfile: () => void;
  onNew: () => void;
  onNotifications: () => void;
  /**
   * R28 ("Za mene"): the route says whether the switch exists in this build (the server package is applied and the client switch is on). Without it the
   * request never carries the key and nothing is drawn.
   */
  forMeAvailable?: boolean;
  /** The way into the work profile, offered beside the refusal when "Za mene" is asked of a person without an active one. */
  onWorkProfile?: () => void;
  trace?: DiscoveryTrace;
  /** What the route keeps of a screen that left (EX-03 warm return). Without it the screen retires its coordinator on the way out, as before. */
  warmReturn?: DiscoveryV1WarmReturn<Coordinator>;
};

const SEARCH_SETTLE_MS = 250;
/** The next frame (or the next turn where there is no frame clock, as in a test): what must not share a commit with the work that came first. */
const nextFrame = (work: () => void) => { if (typeof requestAnimationFrame === 'function') requestAnimationFrame(() => work()); else setTimeout(work, 0); };

export function DiscoveryV1Screen(props: DiscoveryV1ScreenProps) {
  const initialViewRef = useRef(discoveryWorkMode(props.initialView));
  const currentRef = useRef(props.isCurrent); currentRef.current = props.isCurrent;
  const persistRef = useRef(props.onPersistView); persistRef.current = props.onPersistView;
  const optionalCommitRef = useRef<() => void>(() => {});
  // EX-03 (owner approval 2026-09-30): the coordinator the route kept from the last visit, if it is still warm for this account and this view, is shown again without a read. It is picked
  // once, in the first render (a pure read); the effect below takes it over.
  const kept = useRef<{ coordinator: Coordinator; ageMs: number; source: DiscoveryV1ScreenProps['source'] } | null | undefined>(undefined);
  if (kept.current === undefined) {
    const offered = props.warmReturn?.candidate(props.scopeKey, props.source, props.initialView) ?? null;
    kept.current = offered && { ...offered, source: props.source };
  }
  const [replaced, setReplaced] = useState(false);
  const coordinator = useMemo<Coordinator>(() => (!replaced && kept.current && kept.current.source === props.source ? kept.current.coordinator : null) ?? createDiscoveryV1RouteCoordinator(
    createDiscoveryV1SupabaseTransport(),
    createDiscoveryV1ExistingOverlayLoaders(props.source),
    () => currentRef.current(),
    () => optionalCommitRef.current(),
  ), [props.source, replaced]);
  const warmStart = !replaced && !!kept.current && coordinator === kept.current.coordinator;
  const [state, setState] = useState<DiscoveryV1RouteSnapshot | null>(() => warmStart ? coordinator.snapshot() : null);
  const [loading, setLoading] = useState(!warmStart), [error, setError] = useState(false);
  // "Za mene" was refused (no active work profile): the switch is back off and the screen says why, once, until the person closes it.
  const [forMeRefused, setForMeRefused] = useState(false);
  const errorRef = useRef(false); errorRef.current = error;
  const mounted = useRef(true), searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null), searchGeneration = useRef(0);

  const visit = useMemo(() => ({}), [props.activity, coordinator]);
  const latestVisit = useRef(visit); latestVisit.current = visit;
  const resumed = useRef(false);
  const activityRef = useRef(props.activity); activityRef.current = props.activity;
  const live = useCallback(() => mounted.current && latestVisit.current === visit
    && props.activity !== null && currentRef.current(), [visit, props.activity]);
  const commit = useCallback(() => {
    if (!live()) return;
    const next = coordinator.snapshot();
    setState(next);
    if (next.view) persistRef.current(next.view);
  }, [coordinator, live]);
  optionalCommitRef.current = commit;

  const execute = useCallback(async (action: () => Promise<unknown>, busy = false, publishPending = false) => {
    if (!live()) return;
    if (busy && live()) { setLoading(true); setError(false); }
    try {
      const pending = action();
      // Only replacement/paging actions publish their start. Pin feedback deliberately keeps
      // the halo in its own frame before the known card, even while another read is pending.
      if (publishPending) commit();
      const result = await pending;
      // A read that failed keeps the error state until a later read APPLIES: a passive or superseded action proves nothing.
      if (live() && (result as { kind?: string } | undefined)?.kind === 'applied') setError(false);
    } catch (failure) {
      if (live()) {
        // The one refusal that is about the person and not about the read: the list is read again WITHOUT "Za mene" and the reason is said beside it.
        if (failure instanceof Error && failure.message === DISCOVERY_V1_FOR_ME_REFUSED) { refuseForMe(); return; }
        traceDiscoveryV1('read-failed', discoveryV1ErrorCode(failure)); setError(true);
      }
    } finally {
      if (busy && live()) setLoading(false);
      commit();
    }
  }, [commit, live]);

  // MAP has its own status. Only anchor recovery that actually accepted a new PAGE can clear a list failure.
  const executeMap = useCallback(async (action: () => Promise<unknown>) => {
    if (!live()) return;
    try {
      const pending = action(); commit();
      const result = await pending as { kind?: string; pageApplied?: boolean };
      if (live() && result.kind === 'applied' && result.pageApplied) setError(false);
    } catch (failure) {
      // Ordinary MAP failures are contained by the session; rejection here is a failed traversal renewal.
      if (live()) {
        if (failure instanceof Error && failure.message === DISCOVERY_V1_FOR_ME_REFUSED) { refuseForMe(); return; }
        traceDiscoveryV1('read-failed', discoveryV1ErrorCode(failure)); setError(true);
      }
    } finally { commit(); }
  }, [commit, live]);

  const refuseForMe = () => {
    setForMeRefused(true);
    const view = coordinator.snapshot().view;
    if (view?.forMe) handleView({ ...view, forMe: false });
  };

  useEffect(() => {
    if (props.activity === null) return;
    mounted.current = true;
    let parkable = true;
    if (resumed.current) {
      const view = coordinator.snapshot().view;
      const candidate = view && props.warmReturn?.candidate(props.scopeKey, props.source, view);
      if (!candidate || candidate.coordinator !== coordinator) {
        props.onRetentionFailed?.();
        return;
      }
    }
    if (warmStart || resumed.current) {
      resumed.current = false;
      if (coordinator.attach({ isCurrent: () => currentRef.current(), onOptionalState: () => optionalCommitRef.current() })) {
        // The kept picture is already on screen (first render). Nothing is read: attaching asks the optional overlay again in the background.
        props.warmReturn?.claim(coordinator);
        const read = coordinator.snapshot().screen, rows = Math.min(read.items.length, 9999);
        traceDiscoveryV1('restored', `${rows}/${Math.min(read.mapMarkers.length, 9999)}`);
        traceDiscoveryV1('warm', `${Math.min(Math.round((kept.current?.ageMs ?? 0) / 1000), 9999)}/${rows}`);
        commit();
      } else {
        // Retired in the meantime: a fresh coordinator of our own reads this visit like a first one.
        parkable = false; kept.current = null; setState(null); setReplaced(true);
      }
    } else {
      props.warmReturn?.discard(coordinator);
      setLoading(true); setError(false);
      const restoreFrom = (from: MarketplaceView): Promise<void> => coordinator.restore(from).then(() => {
        if (!live()) return;
        const read = coordinator.snapshot().screen;
        traceDiscoveryV1('restored', `${Math.min(read.items.length, 9999)}/${Math.min(read.mapMarkers.length, 9999)}`);
        commit(); setLoading(false);
      }, failure => {
        if (!live()) return;
        // A view kept from before the work profile went inactive still asks "Za mene": the list is read again without it, and the refusal is said.
        if (from.forMe && failure instanceof Error && failure.message === DISCOVERY_V1_FOR_ME_REFUSED) {
          setForMeRefused(true);
          return restoreFrom({ ...from, forMe: false });
        }
        traceDiscoveryV1('restore-failed', discoveryV1ErrorCode(failure));
        setError(true); setLoading(false);
      });
      void restoreFrom(initialViewRef.current);
    }
    return () => {
      mounted.current = false;
      if (searchTimer.current) clearTimeout(searchTimer.current);
      searchGeneration.current++; touches.current++; tap.current = null; askedView.current = null;
      if (activityRef.current === null) setPendingKey(null);
      // The route may keep the coordinator for the next screen (a screen that leaves in its error state is not worth keeping).
      if (parkable && props.warmReturn && !errorRef.current) {
        props.warmReturn.park(props.scopeKey, props.source, coordinator);
        resumed.current = true;
        const view = coordinator.snapshot().view;
        if (activityRef.current === null && (!view || !props.warmReturn.candidate(props.scopeKey, props.source, view)))
          props.onRetentionFailed?.();
      } else {
        coordinator.retire();
        if (activityRef.current === null) props.onRetentionFailed?.();
      }
    };
  }, [coordinator, commit]);

  // The view the person has just asked for, until the read for it lands. The presentation builds its next change on the view it was last
  // handed, and the committed view is one read behind: the search panel applied a place, the sheet then settled, and that change (built on the
  // old view) read the place away again (found on the emulator: the place was read and, next, read away). The asked view is handed back at once.
  const askedView = useRef<MarketplaceView | null>(null);
  const [, showAsked] = useState(0);
  const handleView = useCallback((requested: MarketplaceView) => {
    if (!live()) return;
    const view = discoveryWorkMode(requested);
    // Asking "Za mene" again is a new attempt: the last refusal is not repeated until this one is refused too.
    if (view.forMe) setForMeRefused(false);
    askedView.current = view; showAsked(count => count + 1);
    void execute(() => coordinator.updateView(view), false, true).finally(() => {
      if (askedView.current === view) { askedView.current = null; if (live()) showAsked(count => count + 1); }
    });
  }, [coordinator, execute, live]);
  const handleRefresh = useCallback(() => {
    const view = coordinator.snapshot().view;
    if (view) void execute(() => coordinator.open(view), true, true);
  }, [coordinator, execute]);
  // A cluster is navigation only: the map's camera goes into it and the settled region reads the list and the map (`onArea`).
  // A touch on a task or a place answers at once: the bucket's halo shows while the exact read is on its way and the card follows when that lands. The halo
  // is the map layer's own filter (no geometry, no card); the read still owns the selection, so one that does not apply takes the halo away again, and the
  // newest touch keeps it when an older read finishes late. The DEV package traces the milliseconds to the halo and to the card data (P6-10).
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const touches = useRef(0);
  const tap = useRef<{ key: string; at: number; feedback: number | null; touch: number; cardAt: number | null } | null>(null);
  useEffect(() => {
    const touch = tap.current;
    if (pendingKey !== null && touch && touch.key === pendingKey && touch.feedback === null) touch.feedback = Date.now() - touch.at;
  }, [pendingKey]);
  const selectMarker = useCallback((marker: DiscoveryV1MapMarker) => {
    if (!live()) return;
    const touch = ++touches.current;
    const record = { key: marker.key, at: Date.now(), feedback: null as number | null, touch, cardAt: null as number | null };
    tap.current = record;
    if (marker.kind !== 'CLUSTER') setPendingKey(marker.key);
    let applied = false;
    // EX-03: a task or place the list already holds sets its card in this very call (before the read's first await), so the card is handed over in the touch's own turn instead
    // of when the read lands; the read goes on and only confirms or refreshes it. A new card object is the sign that one was set (the cheap look: no snapshot of the list and
    // the map). The halo is the first thing the person sees, so it commits alone and the card follows one frame later (the BEFORE/AFTER on the HONOR showed the halo slipping
    // from 63 to 140 ms when both shared one commit). A newer touch takes over its own frame.
    const shown = coordinator.peekNow();
    const reading = coordinator.selectMarker(marker);
    if (marker.kind !== 'CLUSTER') {
      const known = coordinator.peekNow();
      if (known && known !== shown) nextFrame(() => { if (live() && tap.current === record) { record.cardAt = Date.now(); commit(); } });
    }
    void execute(async () => {
      const result = await reading;
      applied = (result.kind === 'TASK' || result.kind === 'PLACE') && result.applied;
    }).then(() => {
      if (!live()) return;
      const latest = tap.current;
      if (applied && latest && latest.touch === touch) {
        const content = Math.min((latest.cardAt ?? Date.now()) - latest.at, 9999);
        traceDiscoveryV1('pin', `${Math.min(latest.feedback ?? content, 9999)}/${content}`);
      }
      if (live() && touches.current === touch) setPendingKey(null);
    });
  }, [coordinator, execute]);
  // The list reads what the person can see; the map reads its whole frame.
  const onArea = useCallback((bounds: PublicBounds, frame?: PublicBounds) => { void execute(() => coordinator.settleMap(bounds, frame), false, true); }, [coordinator, execute]);
  // The rows the list shows: their details are read in the background when they are outside the window read so far; the overlay commits when it lands.
  const onVisibleRange = useCallback((first: number, last: number) => { if (live()) coordinator.showRows(first, last); }, [coordinator, live]);
  // The markers follow a camera move that is not the person's own; the list and the peek are not touched, and a read that proves nothing about
  // the list never clears its error.
  const onViewportSettled = useCallback((bounds: PublicBounds) => { void executeMap(() => coordinator.refreshMap(bounds)); }, [coordinator, executeMap]);
  const onRetryMap = useCallback(() => { void executeMap(() => coordinator.retryMap()); }, [coordinator, executeMap]);
  const onShowPlace = useCallback(() => {
    const peek = coordinator.snapshot().screen.peek;
    if (peek?.kind === 'PLACE') void execute(() => coordinator.showPoint(peek.point), false, true);
  }, [coordinator, execute]);
  const onShowAll = useCallback(() => { void execute(() => coordinator.showAll(), false, true); }, [coordinator, execute]);
  const onNextPage = useCallback(() => { void execute(() => coordinator.nextPage(), false, true); }, [coordinator, execute]);
  const onClearPeek = useCallback(() => { if (!live()) return; coordinator.clearPeek(); commit(); }, [coordinator, commit, live]);

  const onSearchDraft = useCallback((draft: SearchDraft, mapArea: PublicBounds | null) => {
    if (!live()) return;
    const generation = ++searchGeneration.current;
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      if (generation !== searchGeneration.current || !live()) return;
      void execute(async () => { await coordinator.previewSearch(draft, mapArea); });
    }, SEARCH_SETTLE_MS);
  }, [coordinator, execute]);
  const onNextSearchPlaces = useCallback(() => {
    if (!live()) return;
    void (async () => {
      try {
        const pending = coordinator.nextSearchPlaces();
        commit();
        await pending;
      } catch (failure) {
        // The search owner retains its rows and exposes facetError for this retry.
        // A places read cannot set or clear the independent list/map error.
        if (live()) traceDiscoveryV1('read-failed', discoveryV1ErrorCode(failure));
      } finally { commit(); }
    })();
  }, [coordinator, commit, live]);

  // Before the first read lands (or when it failed) there is no list to hold the state, so the state stands on its own, in the words of the list's own states.
  if (!state?.screen.active || !state.screen.view) {
    return <SafeAreaView edges={['top']} style={{ flex: 1 }}><View style={{ paddingHorizontal: layout.gutter, paddingVertical: layout.section }}>
      <DiscoveryListState state={error ? { kind: 'error', onRetry: handleRefresh } : { kind: 'loading' }} clearAllLabel={CLEAR_ALL} />
    </View></SafeAreaView>;
  }

  return <DiscoveryV1PresentationBridge snapshot={pendingKey
      ? { ...state.screen, view: askedView.current ?? state.screen.view, exactTaskId: null, verifiedPlaceKey: null }
      : askedView.current ? { ...state.screen, view: askedView.current } : state.screen} overlay={state.overlay} search={state.search}
    selectedMarkerKey={pendingKey ?? state.selectedMarkerKey} loadingMore={state.loadingMore}
    actions={{ onSelectMarker: selectMarker, onViewportSettled, onRetryMap, onArea, onClearPeek, onShowPlace, onShowAll, onNextPage, onSearchDraft, onNextSearchPlaces, onVisibleRange }}
    canRetainMap={props.canRetainMap}
    loading={loading} refreshing={state.replacing} error={error} scopeKey={props.scopeKey}
    initialWorkArea={props.initialWorkArea} onInitialWorkAreaHandled={props.onInitialWorkAreaHandled}
    trace={props.trace} onView={handleView} onRefresh={handleRefresh}
    onOpen={item => { if (live()) props.onOpen(item, discoveryV1OverlayRelation(state.overlay, item.id)); }}
    onBack={props.onBack} onProfile={props.onProfile} onNew={props.onNew} onNotifications={props.onNotifications}
    arriveAfterLoading={!warmStart} forMeAvailable={props.forMeAvailable} forMeRefused={forMeRefused} onWorkProfile={props.onWorkProfile} onDismissForMeRefused={() => setForMeRefused(false)} />;
}
