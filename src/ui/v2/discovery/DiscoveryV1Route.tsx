import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useDiscoveryWorkArea } from '../../../hooks/useDiscoveryWorkArea';
import { initialMarketplaceView, type MarketplaceItem, type MarketplaceView } from '../../../data/marketplaceView';
import type { DiscoveryV1RouteCoordinator } from '../../../data/discoveryV1RouteCoordinator';
import { createDiscoveryV1WarmReturn, DISCOVERY_V1_WARM_RETURN_MS, type DiscoveryV1WarmReturn } from '../../../data/discoveryV1WarmReturn';
import type { TaskRelation } from '../../../data/taskRelation';
import { sesijaSada, useSesija } from '../../../store/sesija';
import { izvorSada, useIzvor } from '../../../store/uloga';
import { QuietReadState } from '../QuietReadState';
import { FOR_ME_SWITCH_EXISTS } from '../../workerProfile/workerProfileFacts';
import { DiscoveryV1Screen } from './DiscoveryV1Screen';
import { useDiscoveryNativeTrace } from './discoveryNativeTrace';

/**
 * The P6 server-read Zadaci route: the real presentation components over the P6 coordinator. Which reader a build mounts is decided
 * only by `selectDiscoveryReader` (compile-time production flag, or the fail-closed native proof gate); this component never reads
 * a route parameter itself, and an authentic publication handoff never reaches it.
 */
export function DiscoveryV1Route() {
  const source = useIzvor(), { user, accountRevision } = useSesija();
  const focus = useRef<object | null>(null), navigating = useRef(false);
  const [scope, setScope] = useState<object | null>(null);
  const [view, setView] = useState<MarketplaceView>(() => ({ ...initialMarketplaceView(), mode: 'map', where: 'onsite' }));
  // A source/account ABA creates a different surface even when its displayed key repeats.
  const identitySequence = useRef(0);
  const identity = useMemo(() => ({ number: ++identitySequence.current }), [source, user?.id, accountRevision]);
  const latestIdentity = useRef(identity); latestIdentity.current = identity;
  const held = useRef<{ identity: object; until: number } | null>(null);
  const deadline = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [surfaceAttempt, setSurfaceAttempt] = useState(0);
  const clearHold = useCallback(() => {
    held.current = null;
    if (deadline.current) clearTimeout(deadline.current);
    deadline.current = null;
  }, []);
  const retireSurface = useCallback(() => { clearHold(); setSurfaceAttempt(value => value + 1); }, [clearHold]);
  const canRetainMap = useCallback(() => latestIdentity.current === identity && !!held.current && held.current.identity === identity
    && Date.now() < held.current.until && !!user?.id && sesijaSada().user?.id === user.id
    && sesijaSada().accountRevision === accountRevision && izvorSada() === source
    && AppState.currentState !== 'background' && AppState.currentState !== 'inactive',
  [identity, user?.id, accountRevision, source]);
  // This observer outlives route focus: the app may background while the detail covers a held map.
  useEffect(() => {
    const subscription = AppState.addEventListener('change', state => {
      if (state !== 'active') { focus.current = null; setScope(null); retireSurface(); }
    });
    return () => { subscription.remove(); clearHold(); };
  }, [retireSurface, clearHold]);
  const trace = useDiscoveryNativeTrace();
  const traceRef = useRef(trace); traceRef.current = trace;
  // EX-03 (owner approval 2026-09-30): what this route keeps of a screen that left, for the next screen of the same account (see discoveryV1WarmReturn). It goes with the route.
  const warmReturn = useRef<DiscoveryV1WarmReturn<DiscoveryV1RouteCoordinator> | null>(null);
  if (!warmReturn.current) warmReturn.current = createDiscoveryV1WarmReturn<DiscoveryV1RouteCoordinator>();
  useEffect(() => { const kept = warmReturn.current!; kept.reopen(); return () => kept.dispose(); }, []);
  const persistView = useCallback((next: MarketplaceView) => {
    traceRef.current?.('route-view', next.listOffset ?? 0, next.sheet === 'full' ? 2 : next.sheet === 'half' ? 1 : next.sheet === 'peek' ? 0 : -1);
    setView(next);
  }, []);

  useFocusEffect(useCallback(() => {
    let owner: object | null = null;
    const enter = () => {
      if (owner) return;
      if (held.current && Date.now() >= held.current.until) setSurfaceAttempt(value => value + 1);
      clearHold();
      owner = {};
      focus.current = owner;
      navigating.current = false;
      traceRef.current?.('route-focus');
      setScope(owner);
    };
    const leave = () => {
      if (!owner) return;
      if (focus.current === owner) focus.current = null;
      owner = null;
      traceRef.current?.('route-blur');
      setScope(null);
    };
    if (AppState.currentState !== 'background' && AppState.currentState !== 'inactive') enter();
    const subscription = AppState.addEventListener('change', state =>
      state === 'active' ? enter() : leave());
    return () => { subscription.remove(); leave(); };
  }, [clearHold]));

  const workArea = useDiscoveryWorkArea({
    accountId: user?.id ?? null,
    accountRevision,
    source,
    focus: scope,
    focusRef: focus,
    view,
    publication: false,
  });

  const current = useCallback(() => latestIdentity.current === identity && !!scope && focus.current === scope && !!user?.id
    && sesijaSada().user?.id === user.id && sesijaSada().accountRevision === accountRevision
    && izvorSada() === source && AppState.currentState !== 'background' && AppState.currentState !== 'inactive',
  [scope, user?.id, accountRevision, source, identity]);

  const navigate = useCallback((action: () => void, retainDetail = false) => {
    if (!current() || navigating.current) return;
    workArea.retire();
    clearHold();
    if (retainDetail) {
      held.current = { identity, until: Date.now() + DISCOVERY_V1_WARM_RETURN_MS };
      deadline.current = setTimeout(retireSurface, DISCOVERY_V1_WARM_RETURN_MS);
    }
    navigating.current = true;
    try { action(); } catch (failure) { navigating.current = false; clearHold(); throw failure; }
  }, [current, workArea, clearHold, identity, retireSurface]);

  const open = useCallback((item: MarketplaceItem, relation: TaskRelation) => {
    navigate(() => router.navigate({
      pathname: relation.kind === 'OWNER' ? '/potrebe/[id]/pregled' : '/prilike/[id]',
      params: { id: item.id },
    }), true);
  }, [navigate]);

  if ((!scope && !canRetainMap()) || !user?.id) return <View style={{ paddingHorizontal: 16, paddingVertical: 24 }}>
    <QuietReadState art="map" title="Otvaramo mapu zadataka…"
      body="Proveravamo zadatke za ovaj nalog pre prikaza mape." />
  </View>;

  return <DiscoveryV1Screen key={`${user.id}:${accountRevision}:${identity.number}:${surfaceAttempt}`}
    activity={scope} canRetainMap={canRetainMap} onRetentionFailed={retireSurface}
    source={source} scopeKey={`${user.id}:${accountRevision}`} initialView={view}
    initialWorkArea={workArea.target} onInitialWorkAreaHandled={workArea.handled}
    isCurrent={current} onPersistView={persistView} onOpen={open} trace={trace} warmReturn={warmReturn.current!}
    onBack={() => navigate(() => router.canGoBack() ? router.back() : router.navigate('/'))}
    onProfile={() => navigate(() => router.navigate('/profil'))}
    onNotifications={() => navigate(() => router.navigate('/obavestenja'))}
    onNew={() => navigate(() => router.navigate('/nova'))} forMeAvailable={FOR_ME_SWITCH_EXISTS} onWorkProfile={() => navigate(() => router.navigate('/profil/radnik'))} />;
}
