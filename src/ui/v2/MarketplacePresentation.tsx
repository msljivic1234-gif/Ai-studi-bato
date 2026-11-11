import { memo, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { FlatList, Keyboard, Platform, StyleSheet, TextInput, View, type ListRenderItemInfo } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { PotrebaProjekcija } from '../../contracts/projections';
import type { MarketplaceItem, MarketplaceView, OwnedTaskCounts } from '../../data/marketplaceView';
import { initialMarketplaceView, isOwnedNeed, marketplaceItems, ownedTaskCounts, ownTasksScope } from '../../data/marketplaceView';
import { Press } from '../Press';
import { Appear, useAppear } from '../system/Appear';
import { FactArt } from '../system/FactArt';
import { Glyph } from '../system/Glyph';
import { layout } from '../system/layout';
import { ListRow } from '../system/ListRow';
import { useReducedMotion } from '../system/motion';
import { ProductHeader } from '../product/ProductDetails';
import { ProductSheet } from '../product/ProductSheet';
import { plural, zadataka } from '../system/plural';
import { Section } from '../system/Section';
import { HeaderIconButton, ScreenHeader } from '../system/ScreenHeader';
import { StateView } from '../system/StateView';
import { Surface } from '../system/Surface';
import { brandAction, fieldBox, sys } from '../system/tokens';
import { usePullRefresh } from '../system/usePullRefresh';
import { T } from '../Text';
import { withInter } from '../interFont';
import { ChoiceRow } from './offer/ChoiceRow';
import { OwnTaskCard } from './OwnTaskCard';
import { ownTaskPhases } from './ownTaskPhases';
import { QuietReadState } from './QuietReadState';
import { V2Action } from './V2Action';

/**
 * EX-04 S1: what a paged read of my own tasks says besides the tasks. Absent, the list is the whole list and counts itself; present, the tasks are the
 * ones loaded so far, the counts are the server's, and the foot offers the next page.
 */
export type MarketplacePaging = { counts: OwnedTaskCounts | null; hasMore: boolean; loadingMore: boolean; moreError: boolean; onLoadMore: () => void };

export type MarketplacePresentationProps = { items: readonly MarketplaceItem[]; loading: boolean; refreshing?: boolean; error: boolean;
  /** A route-owned root header. Pushed screens still keep their existing Back header. */
  header?: ReactNode;
  /** Paged builds only (the ex04a package). */
  paging?: MarketplacePaging;
  view: MarketplaceView; onView: (value: MarketplaceView) => void; onRefresh: () => void;
  onOpen: (item: MarketplaceItem) => void; onProfile: () => void; onNew?: () => void;
  /** The first encounter's quiet way: "Pogledaj zadatke" opens other people's tasks (Zadaci). Without it that way is not drawn. */
  onExplore?: () => void;
  /** The card's foot opens the applications that wait for my choice. */
  onApplications?: (item: MarketplaceItem) => void;
  /** Set when the screen was pushed rather than being a tab: my own tasks are reached from Početna. */
  onBack?: () => void };

const PRICES = [['all', 'Svi načini'], ['MY_PRICE', 'Navedena cena'], ['OFFERS', 'Tražim ponude']] as const;
const keyOf = (item: MarketplaceItem) => item.id;
/** Cells scrolled out of view are detached on Android; iOS gains nothing from it. Rows here hold no text input that could lose focus. */
const CLIP_OFFSCREEN = Platform.OS === 'android';

/**
 * One row of the list. Memoised on primitives and the row's own object, so a keystroke in the
 * search field or an open filter sheet re-renders the screen and not every card under it; the
 * `onOpen` it receives is the list's one stable function, and the closure over `item` is made here.
 */
const MarketplaceRow = memo(function MarketplaceRow({ item, index, animate, sectionSays, onOpen, onApplications }: {
  item: MarketplaceItem; index: number; animate: boolean; sectionSays: boolean; onOpen: (item: MarketplaceItem) => void;
  onApplications?: (item: MarketplaceItem) => void;
}) {
  const open = useCallback(() => onOpen(item), [onOpen, item]);
  const applications = useMemo(() => onApplications ? () => onApplications(item) : undefined, [onApplications, item]);
  // This list is made of my own tasks only (`marketplaceItems(…, owned = true)`); a task of someone else has no row here.
  return isOwnedNeed(item) ? <Appear index={index} animate={animate}><OwnTaskCard item={item} sectionSays={sectionSays} onOpen={open} onApplications={applications} /></Appear> : null;
});

/** What the list is made of: the name of a group, a task, the one line that says there is no active task, the foot of a paged read, the two quiet rows. */
type Row =
  | { id: string; kind: 'head'; title: string; spoken: string; first: boolean }
  | { id: string; kind: 'card'; item: PotrebaProjekcija; index: number; first: boolean; sectionSays: boolean }
  | { id: 'none'; kind: 'none' }
  | { id: 'foot'; kind: 'foot'; state: 'more' | 'loading' | 'error' }
  | { id: 'sets'; kind: 'sets'; drafts: number; history: number; counted: boolean };

/**
 * Moji zadaci, "Papir na stolu" (the owner's pick of 2026-10-08): the person's own ACTIVE tasks in groups by what each one is doing now
 * ("Čeka tvoj izbor · 2", "Objavljeno · 2", "Dogovoreno · 1"; `ownTaskPhases`), the cards under each group's name, and under the groups two
 * quiet rows, "Nacrti" and "Istorija", each with how many it holds. There are no tabs: either groups or tabs, never both. A group says the
 * state, so the card does not wear the state chip a second time (`sectionSays`); HITNO keeps its badge. A row that is touched opens that set
 * in this screen (`view.section` is `drafts` or `history`): the bar then says its name and its arrow comes back to the groups. In the list
 * of drafts the card says nothing about its state either (the list is that state); in the history it keeps its chip, because Istorija holds
 * three different endings (Završen, Otkazan, Istekao).
 *
 * The FIRST ENCOUNTER is a promise (B6, "Predmet vrata"): a person with no task at all sees the paper with the pin and the pencil at 144,
 * the same object as the door "Objavi zadatak" on Početna, "Još nemaš zadatak", one sentence, one green action and one quiet way.
 *
 * The cards are `Surface record`s of about 200 dp, 12 apart, three to a screen (composition spec 4.5). A group's name is 12 above its first
 * card and 24 below the last card of the one before; the rows of the finished stand 24 under the last. A number in a group's name is the
 * count of what the list holds, and is drawn only when it is exact: the whole list's own count, or a paged read that has read to its end (never
 * the number that happens to be loaded). The counts of Nacrti and Istorija are the whole list's own or the server's, and a set that holds
 * nothing has no row; while a filter is on they say only their names (a count of everything would not be what the set will show).
 *
 * FILTERI stays what it was (decision of 2026-10-08: the look is A, the function is not lost): the one control of the bar, at its end,
 * with its word beside the drawing. It opens the sheet with the search field, the way of pricing and "Čeka tvoj izbor", and applies them
 * together to the set that is shown (the groups, or the list of drafts or of the history); the sheet promises how many tasks the list will
 * show, by the same rule Apply uses. The control is not drawn for a person who has nothing to narrow down, and a filter that came back empty
 * keeps it, because it is how the filter is cleared. A filter that is on says so in the control ("Filteri, aktivni").
 *
 * Other people's tasks are the Zadaci tab (`DiscoveryPresentation`). My own tasks carry no creation action over their cards
 * (Početna has "Objavi zadatak"); an empty list still offers it inline. Presentation only: every callback is the route's existing command.
 *
 * No eyebrow above the title (owner, 2026-09-23): "Moje aktivnosti" over "Moji zadaci" only said where you are, and that destination is retired.
 */
export function MarketplacePresentation(props: MarketplacePresentationProps) {
  const { items, loading, error, view, onOpen, paging } = props, reduced = useReducedMotion();
  // The spinner of the pull is for a pull: a list that reads again by itself (a tab switched, a screen focused, a page that follows) must not raise it
  // (the owner's phone, 8 Oct 2026: a white disc over the list at every background read).
  const pull = usePullRefresh(props.onRefresh, props.refreshing ?? loading);
  // The route hands down a fresh `onOpen` closure on every render (its guards read the latest
  // read). The rows get one function that never changes and calls whatever is current at press time.
  const openRef = useRef(onOpen); openRef.current = onOpen;
  const openItem = useCallback((item: MarketplaceItem) => openRef.current(item), []);
  // The same for the card's foot, which opens the applications that wait for my choice.
  const applicationsRef = useRef(props.onApplications); applicationsRef.current = props.onApplications;
  const hasApplications = !!props.onApplications;
  const openApplications = useCallback((item: MarketplaceItem) => applicationsRef.current?.(item), []);
  const [filterOpen, setFilterOpen] = useState(false), [priceDraft, setPriceDraft] = useState(view.price);
  const [attentionDraft, setAttentionDraft] = useState(view.attention), [queryDraft, setQueryDraft] = useState(view.query);
  const listRef = useRef<FlatList<Row>>(null);
  const criteria = JSON.stringify([view.section, view.query, view.price, view.attention]);
  const previousCriteria = useRef(criteria);
  useEffect(() => {
    // FlatList retains its native offset when rows change. A new set starts at the top; a reread or return to the
    // same set keeps the reading position, including while an unapplied filter draft is opened or cancelled.
    if (previousCriteria.current !== criteria) listRef.current?.scrollToOffset({ offset: 0, animated: false });
    previousCriteria.current = criteria;
  }, [criteria]);
  const visible = useMemo(() => marketplaceItems(items, view, true), [items, view]);
  // The sheet promises what the list will show: the same search, section, price and attention as Apply.
  const draftCount = useMemo(() => loading || error ? null
    : marketplaceItems(items, { ...view, query: queryDraft, price: priceDraft, attention: attentionDraft }, true).length,
  [items, view, queryDraft, priceDraft, attentionDraft, loading, error]);
  // The counts of Nacrti and Istorija (and what the whole list holds): the server's own for a paged build (unknown until it answered), otherwise the counts
  // of the whole list this build holds, and none while that is read or failed to read, so no stale number stands over an error.
  const counts = useMemo<OwnedTaskCounts | null>(() => paging ? paging.counts : loading || error ? null : ownedTaskCounts(items),
    [items, paging, loading, error]);
  const grouped = view.section === 'active';
  // The final keyset cursor cannot certify a complete owned-task set on its own.
  // First-page counts belong to the selected server scope, not the local search/price
  // refinement; compare them against ALL received rows before making any claim
  // about group totals, empty filters or the number promised by the filter sheet.
  const scope = ownTasksScope(view);
  const expectedSetCount = !paging?.counts || !scope ? null : scope === 'ALL' ? paging.counts.total
    : scope === 'ACTIVE' ? paging.counts.active : scope === 'WAITING' ? paging.counts.waiting
      : scope === 'DRAFTS' ? paging.counts.drafts : paging.counts.history;
  const terminal = !!paging && !loading && !error && !props.refreshing && !paging.hasMore && !paging.loadingMore && !paging.moreError;
  const incompleteFinal = terminal && (expectedSetCount === null || expectedSetCount !== items.length);
  const exact = !paging || (terminal && !incompleteFinal);
  const hasOthers = !!counts && (counts.drafts > 0 || counts.history > 0);
  // What the person chose to narrow the list with. A set is not a refinement: an empty Nacrti or Istorija says what that set is, and has
  // nothing to "clear" (plan 2.2). Search is one of the filters now, so it counts as one.
  const filterActive = !!view.query || view.price !== 'all' || view.attention;
  const change = (patch: Partial<MarketplaceView>) => props.onView({ ...view, ...patch });
  const openFilters = () => { Keyboard.dismiss(); setQueryDraft(view.query); setPriceDraft(view.price); setAttentionDraft(view.attention); setFilterOpen(true); };
  // A refinement of a set that is still being read has no answer yet, so it says it is reading instead of saying there is nothing.
  const reading = loading || (!!paging && visible.length === 0 && !paging.moreError && (paging.hasMore || paging.loadingMore));
  const filterLabel = filterActive ? 'Filteri, aktivni' : 'Filteri';
  // A task that arrives while you are looking says so; the ones that were already there do not
  // replay every time the list is pulled. `Appear` holds that distinction.
  const appear = useAppear();
  appear.settle(visible.map(keyOf), criteria);
  // `useAppear` returns a new object each render over the same two refs; read it through a ref so
  // `renderItem` keeps its identity and the list does not re-render every cell on every render.
  const appearRef = useRef(appear); appearRef.current = appear;

  const rows = useMemo<Row[]>(() => {
    if (reading || error || (paging?.moreError && visible.length === 0)) return [];
    const out: Row[] = [];
    if (grouped) {
      let n = 0;
      for (const group of ownTaskPhases(visible.filter(isOwnedNeed))) {
        if (!group.items.length) continue;
        const count = group.items.length;
        out.push({ id: `head:${group.key}`, kind: 'head', first: out.length === 0,
          title: exact ? `${group.title} · ${count}` : group.title, spoken: exact ? `${group.title}, ${zadataka(count)}` : group.title });
        group.items.forEach((item, at) => out.push({ id: `card:${item.id}`, kind: 'card', item, index: n++, first: at === 0, sectionSays: true }));
      }
      // Nothing is active, but there are drafts or finished tasks: say so once, and the two rows are right under it.
      if (!out.length && hasOthers && !filterActive) out.push({ id: 'none', kind: 'none' });
    } else {
      visible.filter(isOwnedNeed).forEach((item, at) => out.push({ id: `card:${item.id}`, kind: 'card', item, index: at, first: at === 0, sectionSays: view.section === 'drafts' }));
    }
    // The next page is offered right after the last task, before the two rows of the other sets.
    if (paging && out.length > 0 && (paging.hasMore || paging.loadingMore || paging.moreError)) {
      out.push({ id: 'foot', kind: 'foot', state: paging.moreError ? 'error' : paging.loadingMore ? 'loading' : 'more' });
    }
    // The two rows stay reachable while a filter is on (they say only their names then: a count of the whole list is not what the set will show);
    // a filter that came back empty draws the empty answer and its way back instead, never rows of other sets under it.
    if (grouped && counts && hasOthers && (!filterActive || out.length > 0)) {
      out.push({ id: 'sets', kind: 'sets', drafts: counts.drafts, history: counts.history, counted: !filterActive });
    }
    return out;
  }, [reading, error, grouped, visible, exact, hasOthers, filterActive, counts, paging, view.section]);

  // What the rows call is the route's latest, read at press time, so `renderItem` never changes and the cards under it stay as they are.
  const show = (section: MarketplaceView['section']) => change({ section, selectedId: null });
  const latest = useRef({ onNew: props.onNew, onLoadMore: paging?.onLoadMore, show });
  latest.current = { onNew: props.onNew, onLoadMore: paging?.onLoadMore, show };
  const renderItem = useCallback(({ item: row }: ListRenderItemInfo<Row>) => {
    switch (row.kind) {
      case 'head': return <T variant="heading" accessibilityRole="header" accessibilityLabel={row.spoken} style={row.first ? s.head : s.headAfter}>{row.title}</T>;
      case 'card': return <View style={row.first ? undefined : s.cardAfter}>
        <MarketplaceRow item={row.item} index={row.index} animate={appearRef.current.isNew(keyOf(row.item))} sectionSays={row.sectionSays} onOpen={openItem}
          onApplications={hasApplications ? openApplications : undefined} />
      </View>;
      case 'none': return <StateView compact art="tasks" title="Nema aktivnih zadataka" body="Nacrti i završeni zadaci su ispod."
        primary={latest.current.onNew ? { label: 'Objavi novi zadatak', onPress: latest.current.onNew } : undefined} />;
      case 'foot': return <View style={s.foot}>
        {row.state === 'error' ? <>
          <T variant="note" tone="muted">Ne možemo da učitamo ostale zadatke.</T>
          <V2Action label="Pokušaj ponovo" kind="quiet" onPress={() => latest.current.onLoadMore?.()} />
        </> : row.state === 'loading' ? <T variant="note" tone="muted">Učitavamo još zadataka…</T>
          : <V2Action label="Prikaži još" kind="quiet" onPress={() => latest.current.onLoadMore?.()} />}
      </View>;
      case 'sets': {
        const drafts = plural(row.drafts, 'nacrt', 'nacrta', 'nacrta'), history = zadataka(row.history);
        return <View style={s.sets}>
          {row.drafts > 0 ? <ListRow leading={<FactArt kind="tasks" size={32} />} title="Nacrti" value={row.counted ? drafts : undefined}
            onPress={() => latest.current.show('drafts')} last={row.history === 0} accessibilityLabel={row.counted ? `Nacrti, ${drafts}` : 'Nacrti'}
            accessibilityHint="Otvara nacrte." /> : null}
          {row.history > 0 ? <ListRow leading={<FactArt kind="document" size={32} />} title="Istorija" value={row.counted ? history : undefined}
            onPress={() => latest.current.show('history')} last accessibilityLabel={row.counted ? `Istorija, ${history}` : 'Istorija'}
            accessibilityHint="Otvara završene, otkazane i istekle zadatke." /> : null}
        </View>;
      }
    }
  }, [openItem, hasApplications, openApplications]);

  // Reading, a failed read, an empty filtered view and a first empty list remain distinct.
  const empty = <View style={s.empty}>
    {reading ? <QuietReadState art="tasks" title="Učitavamo zadatke…" body="Proveravamo Vaše objave, nacrte i istoriju." />
      : error ? <StateView kind="error" art="tasks" title="Ne možemo da učitamo zadatke" body="Učitavanje nije uspelo. Pokušajte ponovo."
        primary={{ label: 'Pokušajte ponovo', onPress: props.onRefresh }} />
        : incompleteFinal ? <StateView kind="error" art="tasks" title="Spisak zadataka nije potpun"
          body="Broj učitanih zadataka ne odgovara serverskom stanju. Proverite spisak ponovo."
          primary={{ label: 'Proverite spisak zadataka', onPress: props.onRefresh }} />
        : paging?.moreError ? <StateView kind="error" art="tasks" title="Nismo učitali sve rezultate" body="Preostali zadaci trenutno nisu dostupni."
          primary={{ label: 'Pokušajte ponovo', onPress: paging.onLoadMore }} />
        : filterActive ? <StateView art="map" title="Nema zadataka u ovom prikazu" body="Promenite pretragu ili filtere."
          primary={{ label: 'Poništi filtere', onPress: () => change({ query: '', price: 'all', attention: false, selectedId: null }) }} />
          : view.section === 'drafts' ? <StateView art="tasks" title="Nemate nacrt" body="Nacrt pregledate pre objave." />
          : view.section === 'history' ? <StateView art="tasks" title="Istorija je prazna" body="Ovde su završeni, otkazani i istekli zadaci." />
          : items.length ? <StateView art="tasks" title="Nema aktivnih zadataka"
            primary={props.onNew ? { label: 'Objavite novi zadatak', onPress: props.onNew } : undefined} />
            // The first encounter: the paper with the pin and the pencil, the object of the door that fulfils it.
            : <StateView hero art="publish" title="Još nemate zadatak" body="Navedite šta Vam treba. Nacrt pregledate pre objave."
              primary={props.onNew ? { label: 'Objavite zadatak', onPress: props.onNew } : undefined}
              quiet={props.onExplore ? { label: 'Pogledajte zadatke', onPress: props.onExplore } : undefined} />}
  </View>;

  // The one control of the bar. A control nobody can guess from a drawing says its word beside it (the sliders icon alone says nothing).
  // A person who has no task, or whose tasks could not be read, has nothing to narrow down: the control is not drawn then (a filtered list
  // that came back empty keeps it, because it is how the filter is cleared).
  const canFilter = filterActive || (!loading && !error && items.length > 0);
  const control = canFilter ? <HeaderIconButton label={filterLabel} glyph="filters" active={filterActive} caption="Filteri" onPress={openFilters} /> : undefined;
  // A set that was opened from the two rows says its name in the bar and takes the arrow back to the groups; the control stays at its end.
  // A screen that was pushed has the arrow; a route that hands its own root header keeps it, and the control stands under it.
  const sub = view.section !== 'active';
  const subTitle = view.section === 'drafts' ? 'Nacrti' : view.section === 'history' ? 'Istorija' : 'Svi zadaci';
  const bar = sub ? <ProductHeader title={subTitle} back={() => show('active')} right={control} />
    : props.onBack ? <ProductHeader title="Moji zadaci" back={props.onBack} right={control} />
      : props.header ? <>{props.header}{control ? <View style={s.controlRow}>{control}</View> : null}</>
        : <ScreenHeader title="Moji zadaci" onProfile={props.onProfile} right={control} />;

  return <SafeAreaView edges={props.onBack ? ['top', 'bottom'] : ['top']} style={s.screen}>
    <View aria-hidden={filterOpen} accessibilityElementsHidden={filterOpen} importantForAccessibility={filterOpen ? 'no-hide-descendants' : 'auto'} style={s.screen}>
      {bar}
      <FlatList<Row> ref={listRef} data={loading || error ? [] : rows} keyExtractor={row => row.id} refreshing={pull.refreshing} onRefresh={pull.onRefresh}
        keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" showsVerticalScrollIndicator={false} contentContainerStyle={s.list}
        // Six cards are more than one phone screen of this card; the window stays modest so a fast
        // scroll fills in quickly without holding the whole list mounted.
        initialNumToRender={6} maxToRenderPerBatch={6} windowSize={7} removeClippedSubviews={CLIP_OFFSCREEN}
        ListHeaderComponent={incompleteFinal && rows.length > 0 ? <Surface kind="note" tone="warn">
          <T accessibilityRole="alert" variant="body">Spisak zadataka nije potpun. Broj učitanih zadataka ne odgovara serverskom stanju.</T>
          <V2Action label="Proveri spisak zadataka" kind="quiet" onPress={props.onRefresh} />
        </Surface> : undefined}
        ListEmptyComponent={empty} renderItem={renderItem}
        onEndReached={paging && paging.hasMore && !paging.loadingMore && !paging.moreError ? paging.onLoadMore : undefined} onEndReachedThreshold={0.6} />
      {/* No floating "+" over my own tasks (owner's information architecture, 2026-09-23): it sat on the cards and
          covered a price, and creating a task lives on Početna's "Objavi zadatak". An empty list still offers it inline. */}
    </View>
    {filterOpen ? <ProductSheet title="Filteri" closeLabel="Zatvori filtere" reduced={reduced} onClose={() => setFilterOpen(false)}
      footer={dismiss => <>
        <V2Action label={draftCount === null || !exact ? 'Prikaži zadatke' : `Prikaži ${zadataka(draftCount)}`} disabled={draftCount === null}
          onPress={() => { change({ query: queryDraft, price: priceDraft, attention: attentionDraft, selectedId: null }); dismiss(); }} style={brandAction} />
        <V2Action label="Poništi izbor" kind="quiet" onPress={() => { setQueryDraft(''); setPriceDraft('all'); setAttentionDraft(false); }} />
      </>}>{() => <View style={s.sheetBody}>
        <Section title="Pretraga">
          <View style={s.search}>
            <Glyph name="search" size={20} tone="green" />
            <TextInput accessibilityLabel="Pretraži zadatke" placeholder="Pretraži zadatke" placeholderTextColor={sys.color.muted}
              value={queryDraft} onChangeText={query => setQueryDraft(query.slice(0, 1000))} maxLength={1000} style={s.input}
              returnKeyType="search" onSubmitEditing={() => Keyboard.dismiss()} />
            {queryDraft ? <Press accessibilityRole="button" accessibilityLabel="Obriši pretragu" onPress={() => setQueryDraft('')} haptic="select" style={s.clear}>
              <Glyph name="close" size={20} /></Press> : null}
          </View>
        </Section>
        <Section title="Način cene">
          <View accessibilityRole="radiogroup" style={s.options}>
            {PRICES.map(([value, label]) => <ChoiceRow key={value} kind="radio" label={label} checked={priceDraft === value} onPress={() => setPriceDraft(value)} />)}
          </View>
        </Section>
        <ChoiceRow kind="checkbox" label="Čeka Vaš izbor" hint="Zadaci sa prijavama koje možete da izaberete." checked={attentionDraft}
          onPress={() => setAttentionDraft(value => !value)} />
      </View>}</ProductSheet> : null}
  </SafeAreaView>;
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: sys.color.ground },
  // A route that keeps its own root header gets the one control on a line of its own, at the end.
  controlRow: { flexDirection: 'row', justifyContent: 'flex-end', paddingHorizontal: layout.gutter },
  // The list: the edge, 8 under the bar (the screen's own), 32 under the last thing. What is in it spaces itself (a group's name, a card, the rows of the finished).
  list: { paddingHorizontal: layout.gutter, paddingTop: sys.space.sm, paddingBottom: layout.zone, flexGrow: 1 },
  // A group's name is 12 above its first card; the next group's name stands 24 below the last card of the one before.
  head: { paddingBottom: layout.group },
  headAfter: { paddingTop: layout.section, paddingBottom: layout.group },
  cardAfter: { paddingTop: layout.group },
  // The two rows of Nacrti and Istorija: 24 under the last card, one group of rows.
  sets: { paddingTop: layout.section },
  foot: { paddingTop: sys.space.base, alignItems: 'center', gap: sys.space.sm },
  empty: { paddingVertical: sys.space.sm, flex: 1 },
  // The sheet: the search field, the way of pricing, the checkbox; a section from the next 24 below it.
  sheetBody: { gap: layout.section },
  search: { ...fieldBox, flexDirection: 'row', alignItems: 'center', gap: sys.space.sm, paddingVertical: 0, paddingRight: 0, backgroundColor: sys.color.wash },
  input: withInter({ ...sys.type.body, color: sys.color.ink, flex: 1, minHeight: layout.touch, paddingVertical: sys.space.sm }),
  clear: { width: layout.touch, height: layout.touch, alignItems: 'center', justifyContent: 'center' },
  options: { gap: sys.space.xs },
});
