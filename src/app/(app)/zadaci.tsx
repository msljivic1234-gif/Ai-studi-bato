import { useDiscoveryWorkArea } from '../../hooks/useDiscoveryWorkArea';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { noviUuidZahtevId } from '../../lib/idempotencija';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import Constants from 'expo-constants';
import { useFocusedResource } from '../../hooks/useFocusedResource';
import { readFailureReason } from '../../data/readFailure';
import { initialMarketplaceView, type MarketplaceItem, type MarketplaceView } from '../../data/marketplaceView';
import { sesijaSada, useSesija } from '../../store/sesija';
import { izvorSada, useIzvor } from '../../store/uloga';
import { DiscoveryPresentation, type DiscoveryTrace } from '../../ui/v2/DiscoveryPresentation';
import { selectDiscoveryReader } from '../../data/discoveryV1ReaderGate';
import { DiscoveryV1Route } from '../../ui/v2/discovery/DiscoveryV1Route';

/**
 * Zadaci, the middle tab: open tasks with this account's relationship labeled (Početna | Zadaci |
 * Dogovori). The Mapa tab and the root `/prilike` used to show this same discovery twice, under two names; both
 * addresses now redirect here, so an old notification, a remembered route or a deep link still lands on it. Since owner
 * step 4 (2026-09-24) the map and the list are one screen: the map under a list sheet (DiscoveryPresentation).
 *
 * A confirmed publication no longer lands here: it lands on the task's own overview (`publishedTaskRoute`), so this route reads no
 * publication hand-off any more (2026-10-07). An old link that still carries those parameters opens Zadaci as it is.
 */
export default function Zadaci() {
  const { user, accountRevision } = useSesija();
  const proofParams = useLocalSearchParams<{ p6Proof?: string | string[] }>();
  const proofParam = Array.isArray(proofParams.p6Proof) ? proofParams.p6Proof[0] : proofParams.p6Proof;
  const reader = selectDiscoveryReader({ publicationHandoff: false, proofParam });
  return reader === 'P6'
    ? <DiscoveryV1Route key={`p6:${user?.id ?? ''}:${accountRevision}`} />
    : <Discovery key={`${user?.id ?? ''}:${accountRevision}`} />;
}
/** The same empty list every render, so an unread collection does not hand the presentation a new array each time. */
const NO_ITEMS: readonly MarketplaceItem[] = [];
function Discovery() {
  const params = useLocalSearchParams<{ discoveryTrace?: string }>();
  // Bounded native diagnosis only: the gallery's package gate, narrowed to this exact DEV package.
  // No __DEV__ override, persisted flag, UI entry, identifiers, free text or native event objects.
  const traceEnabled = Constants.expoConfig?.android?.package === 'rs.uskoci.dev' && params.discoveryTrace === '1';
  const traceGate = useRef(traceEnabled); traceGate.current = traceEnabled;
  const traceCount = useRef(0);
  const traceSamples = useRef(0);
  const trace = useCallback<DiscoveryTrace>((event, ...values) => {
    if (!traceGate.current || traceCount.current >= 120 || !TRACE_EVENTS.has(event) || values.length > 20
      || values.some(value => typeof value !== 'boolean' && (typeof value !== 'number' || !Number.isFinite(value)))) return;
    // A swipe/initial map layout cannot consume the allowance reserved for opening and returning.
    if (TRACE_SAMPLES.has(event)) { if (traceSamples.current >= 32) return; traceSamples.current++; }
    const safe = values.map(value => typeof value === 'boolean' ? value : Math.round(Math.max(-10_000_000, Math.min(10_000_000, value)) * 10) / 10);
    console.info(`[USKOCI_DISCOVERY_TRACE] ${JSON.stringify([++traceCount.current, event, ...safe])}`);
  }, []);
  const source = useIzvor(), { user, accountRevision } = useSesija();
  const focus = useRef<object | null>(null), navigating = useRef(false);
  const [scope, setScope] = useState<object | null>(null);
  const [view, setView] = useState<MarketplaceView>(() => ({ ...initialMarketplaceView(), mode: 'map' }));
  const workArea = useDiscoveryWorkArea({ accountId: user?.id ?? null, accountRevision, source,
    focus: scope, focusRef: focus, view, publication: false });
  const traceView = useRef(view); traceView.current = view;
  useEffect(() => { if (traceEnabled) trace('route-trace', traceView.current.listOffset ?? 0, traceSheet(traceView.current)); }, [traceEnabled, trace]);
  useFocusEffect(useCallback(() => {
    let owner: object | null = null;
    // Publish the focus token as state, exactly as Početna does. A ref written inside an effect
    // re-renders nothing, so a screen that read it during render kept the token of its FIRST
    // visit: come back to the screen and the guard compared an old token against a new one and
    // refused every press, silently, for the rest of that screen's life.
    const enter = () => {
      if (owner) return;
      owner = {}; focus.current = owner; navigating.current = false;
      trace('route-focus', traceView.current.listOffset ?? 0, traceSheet(traceView.current));
      setScope(owner);
    };
    const leave = () => {
      if (!owner) return;
      trace('route-blur', traceView.current.listOffset ?? 0, traceSheet(traceView.current));
      if (focus.current === owner) focus.current = null;
      owner = null; setScope(null);
    };
    if (AppState.currentState !== 'background' && AppState.currentState !== 'inactive') enter();
    const subscription = AppState.addEventListener('change', state => state === 'active' ? enter() : leave());
    return () => { subscription.remove(); leave(); };
  }, [trace]));
  const load = useCallback(async (signal: AbortSignal) => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([source.otvorenePrilike({ signal }), new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error('MARKETPLACE_READ_TIMEOUT')), 15_000);
      })]);
    } catch (err) {
      console.error('[ZADACI_LOAD_ERROR]', readFailureReason(err));
      throw err;
    } finally { if (timer) clearTimeout(timer); }
  }, [source]);
  const resource = useFocusedResource(load, { coalesce: true });
  const items = resource.data ?? NO_ITEMS;
  // Which of these tasks are mine and which I have applied to: labels only, read beside the list so
  // that a failure here costs the labels and never the list. Since PKG-023b it is one bounded call
  // for the tasks actually on this page, instead of my whole task list and my whole application
  // list; the server answers for those ids and says nothing about any other task.
  const visible = items.map(row => row.id).join(',');
  // The same 15 s limit as the list read: a read that never answers is a failed read, not one still running, so it costs
  // the labels and never the count, the sheet's start or the map (review r3b).
  const loadRelations = useCallback(async (signal: AbortSignal) => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try { return await Promise.race([source.odnosiPremaZadacima(visible ? visible.split(',') : [], { signal }), new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error('TASK_RELATIONS_READ_TIMEOUT')), 15_000);
    })]); } finally { if (timer) clearTimeout(timer); }
  }, [source, visible]);
  const relations = useFocusedResource(loadRelations, { coalesce: true });
  // Ownership is an overlay, never a visibility filter. A missing answer stays unknown while the
  // public rows, counts and map remain usable. Every explicit refresh retries both reads, even if
  // the public task IDs did not change since a failed overlay read.
  const relationsPending = relations.loading || relations.refreshing;
  const latestResource = useRef(resource); latestResource.current = resource;
  const latestItems = useRef(items); latestItems.current = items;
  const latestRelations = useRef(relations); latestRelations.current = relations;
  const current = () => !!scope && focus.current === scope && !!user?.id && sesijaSada().user?.id === user.id
    && sesijaSada().accountRevision === accountRevision && izvorSada() === source
    && AppState.currentState !== 'background' && AppState.currentState !== 'inactive';
  const navigate = (action: () => void) => {
    if (current() && !navigating.current) { workArea.retire(); navigating.current = true; action(); }
  };
  const open = (item: MarketplaceItem) => {
    const latest = latestResource.current;
    trace('route-open', current(), navigating.current, latest.loading, !!latest.error, traceView.current.listOffset ?? 0, traceSheet(traceView.current));
    if (latest.loading || latest.error || !latestItems.current.some(row => row.id === item.id)) return;
    const owned = latestRelations.current.data?.relation(item.id).kind === 'OWNER';
    navigate(() => router.navigate({ pathname: owned ? '/potrebe/[id]/pregled' : '/prilike/[id]', params: { id: item.id } }));
  };
  // Looking for work, seeing my own tasks and publishing a new one are three things one account
  // does; none of them switches the app into another mode first (owner decision 1, 2026-09-19).
  return <DiscoveryPresentation items={items} loading={resource.loading} refreshing={resource.refreshing || relations.refreshing} error={!!resource.error}
      errorReason={resource.error ? resource.errorReason : undefined}
      initialWorkArea={workArea.target} onInitialWorkAreaHandled={workArea.handled}
      scopeKey={`${user?.id ?? ''}:${accountRevision}`} view={view} relations={relations.data ?? undefined} relationsPending={relationsPending}
      relationsError={relations.error}
      trace={traceEnabled ? trace : undefined}
      onUserIntent={() => { if (current()) workArea.retire(); }}
      onView={next => { const accepted = current(); trace('route-view', accepted, traceView.current.listOffset ?? 0, next.listOffset ?? 0, traceSheet(next)); if (accepted) setView(next); }} onRefresh={() => {
        if (current()) {
          void resource.refresh(true);
          void relations.refresh(true);
        }
      }} onOpen={open}
      onBack={() => navigate(() => router.canGoBack() ? router.back() : router.navigate('/'))}
      onProfile={() => navigate(() => router.navigate('/profil'))}
      onNotifications={() => navigate(() => router.navigate('/obavestenja'))}
      onNew={() => navigate(() => router.push({ pathname: '/nova', params: { entryKey: noviUuidZahtevId() } }))} />;
}

const traceSheet = (view: MarketplaceView) => view.sheet === 'full' ? 2 : view.sheet === 'half' ? 1 : view.sheet === 'peek' ? 0 : -1;
const TRACE_EVENTS = new Set<Parameters<DiscoveryTrace>[0]>(['route-trace', 'route-focus', 'route-blur', 'route-open', 'route-view',
  'focus', 'blur', 'preopen', 'write-offset', 'seed', 'ready', 'geometry', 'index', 'content', 'layout',
  'restore-check', 'clamp0', 'request', 'ack', 'scroll0', 'scroll', 'scroll-reject', 'search-change', 'drag', 'refresh']);
const TRACE_SAMPLES = new Set<Parameters<DiscoveryTrace>[0]>(['scroll', 'scroll0', 'scroll-reject', 'restore-check', 'content', 'layout', 'geometry']);
