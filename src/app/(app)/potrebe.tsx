import { useCallback, useRef, useState } from 'react';
import { ScreenHeader } from '../../ui/system/ScreenHeader';
import { ActualUserAvatar } from '../../ui/system/ActualUserAvatar';
import { AppState } from 'react-native';
import { noviUuidZahtevId } from '../../lib/idempotencija';
import { router, useFocusEffect } from 'expo-router';
import type { PotrebaProjekcija } from '../../contracts/projections';
import { useFocusedResource } from '../../hooks/useFocusedResource';
import { useOwnTasksPager } from '../../hooks/useOwnTasksPager';
import { initialMarketplaceView, type MarketplaceItem, type MarketplaceView } from '../../data/marketplaceView';
import { ownTasksRefined, ownTasksScope, type OwnTasksPageRequest } from '../../data/ownTasksPage';
import { ownTasksPagedBuilt } from '../../data/ownTasksPagedGate';
import type { Izvor } from '../../data/ports';
import { sesijaSada, useSesija } from '../../store/sesija';
import { izvorSada, useIzvor } from '../../store/uloga';
import { MarketplacePresentation, type MarketplacePaging } from '../../ui/v2/MarketplacePresentation';

export default function Potrebe() {
  const { user, accountRevision } = useSesija();
  return <OwnedCollection key={`${user?.id ?? ''}:${accountRevision}`} />;
}

/** What the screen needs from either read of my own tasks: the list, how it is doing, and (paged builds only) what the pages say. */
type OwnedTasks = { items: readonly PotrebaProjekcija[]; loading: boolean; refreshing: boolean; error: boolean; refresh: () => void; paging?: MarketplacePaging };

/** The whole list in one read: every build before the backend carries the ex04a package. */
function useWholeListTasks(source: Izvor, _view: MarketplaceView): OwnedTasks {
  const load = useCallback(async () => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try { return await Promise.race([source.mojePotrebe(), new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error('MARKETPLACE_READ_TIMEOUT')), 15_000);
    })]); } finally { if (timer) clearTimeout(timer); }
  }, [source]);
  const resource = useFocusedResource(load);
  return { items: resource.data ?? [], loading: resource.loading, refreshing: resource.refreshing, error: !!resource.error,
    refresh: () => { void resource.refresh(true); } };
}

const NO_TASKS: readonly PotrebaProjekcija[] = [];
/**
 * EX-04 S1 (A09): the same list a page at a time, in the server's own sets. The set follows the section and the "Treba moja radnja" filter; while a
 * search or the price filter is on, the rest of the set is read so what they say is complete. Until the pager has answered for the set now asked for,
 * the screen is loading, never showing another set's tasks under this one's title.
 */
function usePagedTasks(source: Izvor, view: MarketplaceView): OwnedTasks {
  const readPage = useCallback((request: OwnTasksPageRequest) => source.mojePotrebeStrana(request), [source]);
  const scope = ownTasksScope(view);
  const pager = useOwnTasksPager(readPage, scope, ownTasksRefined(view));
  const settled = pager.scope === scope;
  return { items: settled ? pager.items : NO_TASKS, loading: !settled || pager.loading, refreshing: settled && pager.refreshing, error: settled && pager.error,
    refresh: () => { void pager.refresh(); },
    paging: { counts: pager.counts, hasMore: settled && pager.hasMore, loadingMore: settled && pager.loadingMore, moreError: settled && pager.moreError,
      onLoadMore: () => { void pager.loadMore(); } } };
}
// One reader per build: a compile-time flag, so the order of hooks never changes while the app runs.
const useOwnedTasks = ownTasksPagedBuilt() ? usePagedTasks : useWholeListTasks;

function OwnedCollection() {
  const source = useIzvor(), { user, accountRevision } = useSesija();
  const focus = useRef<object | null>(null), navigating = useRef(false);
  const [scope, setScope] = useState<object | null>(null);
  const [view, setView] = useState(initialMarketplaceView);
  useFocusEffect(useCallback(() => {
    const owner = {}; focus.current = owner; navigating.current = false;
    // Publish the focus token as state, exactly as Početna does. A ref written inside an effect
    // re-renders nothing, so a screen that read it during render kept the token of its FIRST
    // visit: come back to the screen and the guard compared an old token against a new one and
    // refused every press, silently, for the rest of that screen's life.
    setScope(owner);
    return () => { if (focus.current === owner) focus.current = null; };
  }, []));
  const owned = useOwnedTasks(source, view);
  const latestOwned = useRef(owned); latestOwned.current = owned;
  const current = () => !!scope && focus.current === scope && !!user?.id && sesijaSada().user?.id === user.id
    && sesijaSada().accountRevision === accountRevision && izvorSada() === source
    && AppState.currentState !== 'background' && AppState.currentState !== 'inactive';
  const navigate = (action: () => void) => { if (current() && !navigating.current) { navigating.current = true; action(); } };
  // Only a task of the latest successful read opens, and only once per visit: a stale card from before a refresh is
  // refused like a blurred or backgrounded screen.
  const known = (item: MarketplaceItem) => {
    const latest = latestOwned.current;
    return !latest.loading && !latest.error && latest.items.some(row => row.id === item.id);
  };
  const open = (item: MarketplaceItem) => {
    if (known(item)) navigate(() => router.navigate({ pathname: '/potrebe/[id]/pregled', params: { id: item.id } }));
  };
  // The card's foot goes straight to the applications that wait for my choice, the same entry Početna and the
  // notifications use; that screen owns its own read and guards.
  const applications = (item: MarketplaceItem) => {
    if (known(item)) navigate(() => router.navigate({ pathname: '/potrebe/[id]/kandidati', params: { id: item.id } }));
  };
  // Moji zadaci is the whole of this presentation since Zadaci became its own map-and-sheet screen (owner step 4,
  // 2026-09-24): there is no discovery mode to switch off and no map scope to hand down.
  const onProfile = () => navigate(() => router.navigate('/profil'));
  return <MarketplacePresentation header={<ScreenHeader title="Moji zadaci" onProfile={onProfile} profileEntry={<ActualUserAvatar onPress={onProfile} />} />} items={owned.items} loading={owned.loading} refreshing={owned.refreshing} error={owned.error}
    view={view} paging={owned.paging}
    onView={next => { if (current()) setView(next); }} onRefresh={() => { if (current()) owned.refresh(); }} onOpen={open}
    onApplications={applications}
    onProfile={onProfile}
    onBack={() => navigate(() => { if (router.canGoBack()) router.back(); else router.replace('/'); })}
    onNew={() => navigate(() => router.push({ pathname: '/nova', params: { entryKey: noviUuidZahtevId() } }))}
    // The first encounter's quiet way ("Pogledaj zadatke", "Papir na stolu", 2026-10-08): other people's tasks, the Zadaci tab. Same guard as every press here.
    onExplore={() => navigate(() => router.navigate('/zadaci'))} />;
}
