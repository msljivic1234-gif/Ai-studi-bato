import type { ReactNode } from 'react';
import { ActivityIndicator, FlatList, KeyboardAvoidingView, Platform, StyleSheet, TextInput, View, type ListRenderItemInfo } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { MojaPrijavaProjekcija } from '../../contracts/projections';
import type { ApplicationEditPricing } from '../../data/myApplicationsClientService';
// The same rule Početna's "Moje prijave" row counts by (2026-09-23).
import { applicationSection, type ApplicationCounts, type ApplicationSection } from '../../data/myApplicationsView';
import { fixedApplicationPrice, needScheduleText } from '../../data/needDetailPresentation';
import { Appear, useAppear } from '../system/Appear';
import { DetailTopBar } from '../system/DetailTopBar';
import { layout, ruleWidth } from '../system/layout';
import { ListRow } from '../system/ListRow';
import { Segmented } from '../system/Segmented';
import { osobuAkuz, prijava } from '../system/plural';
import { StateView } from '../system/StateView';
import { Surface } from '../system/Surface';
import { brandAction, field, sys } from '../system/tokens';
import { usePullRefresh } from '../system/usePullRefresh';
import { T } from '../Text';
import { ApplicationCard } from './ApplicationFace';
import { ApplicationPeopleInput, applicationPeopleCount } from './ApplicationPeopleInput';
import { V2Action } from './V2Action';
import { QuietReadState } from './QuietReadState';

export type ApplicationsTab = 'all' | ApplicationSection;
/**
 * EX-04 S2: what a paged read of my own applications says besides the applications. Absent, the list is the whole list and counts itself; present, the rows are the ones
 * loaded so far of the tab's own set, the counts are the server's, and the foot offers the next page.
 */
export type ApplicationsPaging = { counts: ApplicationCounts | null; hasMore: boolean; loadingMore: boolean; moreError: boolean; onLoadMore: () => void };
export type OfferEdit = { price: string; people: string; note: string; start: string | null; end: string | null; pricing: ApplicationEditPricing };
type Props = {
  refreshing?: boolean;
  rows: MojaPrijavaProjekcija[]; loading: boolean; unavailable: boolean; message: string | null; notice: string | null;
  tab: ApplicationsTab; onTab: (tab: ApplicationsTab) => void; expanded: string | null; draft: OfferEdit | null; draftStale?: boolean;
  busy: boolean; editingLoading: boolean; pending: boolean; pendingAction?: 'withdraw' | 'update' | 'keep' | null;
  canRetry: boolean; canReset: boolean;
  onRefresh: () => void; onExplore: () => void; onProfile: () => void; onBack: () => void;
  onReview: (p: MojaPrijavaProjekcija) => void; onClose: () => void; onEdit: (p: MojaPrijavaProjekcija) => void;
  onChange: (draft: OfferEdit) => void; onCancelEdit: () => void; onKeep: (p: MojaPrijavaProjekcija) => void;
  onUpdate: (p: MojaPrijavaProjekcija) => void; onWithdraw: (p: MojaPrijavaProjekcija) => void;
  onAgreement: (p: MojaPrijavaProjekcija) => void; onRetry: () => void; onReset: () => void;
  /** The task the application belongs to. Without it a worker who applied cannot get back to it. */
  onTask: (p: MojaPrijavaProjekcija) => void;
  /** Optional profile action, separate from withdrawal/edit/selection. */
  onService?: (p: MojaPrijavaProjekcija) => void;
  /** An application arrived at from a notification, brought into view once. */
  focusId?: string | null;
  /** Requested destination, including a row that the current owned read cannot return. */
  requestedId?: string | null;
  /** The application the person has just sent (the list was opened from its receipt): its chip adds "upravo" for this visit. */
  freshId?: string | null;
  /** The internal gallery draws the large-text card layout without changing the phone's setting. */
  largeText?: boolean;
  /** Paged builds only (the ex04b package). */
  paging?: ApplicationsPaging;
};
// The existing server sets stay separate: ACTIVE is a sent application waiting for a decision;
// ATTENTION includes a changed application or a selected one leading to its Dogovor.
const TABS: readonly { key: ApplicationsTab; label: string }[] = [{ key: 'active', label: 'Čekaju odgovor' }, { key: 'attention', label: 'Čeka te' },
  { key: 'finished', label: 'Istorija' }, { key: 'all', label: 'Sve' }];
/**
 * The three groups of the list (the approved draft U8): what waits for the other side, what was chosen, what is over. An application whose task
 * changed is still waiting: its card asks for the decision, and it stands first in its group.
 */
export type ApplicationGroup = 'waiting' | 'selected' | 'finished';
export const APPLICATION_GROUPS: readonly { key: ApplicationGroup; title: string }[] = [
  { key: 'waiting', title: 'Čeka odgovor' }, { key: 'selected', title: 'Izabrana' }, { key: 'finished', title: 'Istorija' }];
export function applicationGroup(p: Pick<MojaPrijavaProjekcija, 'stanje'>): ApplicationGroup {
  return p.stanje === 'SELECTED' ? 'selected' : p.stanje === 'WITHDRAWN' || p.stanje === 'CLOSED' ? 'finished' : 'waiting';
}
type Entry = { kind: 'head'; group: ApplicationGroup; title: string; count: number; first: boolean } | { kind: 'row'; p: MojaPrijavaProjekcija };
const entryKey = (entry: Entry) => entry.kind === 'head' ? `head:${entry.group}` : entry.p.prijavaId;
/** What an empty set says. "Čeka te" keeps its meaning: what waits for my decision (a changed task, a Dogovor to open). */
const TAB_EMPTY: Record<ApplicationSection, string> = { attention: 'Ništa te ne čeka', active: 'Nema prijava koje čekaju odgovor', finished: 'Istorija prijava je prazna' };
const Separator = () => <View style={s.separator} />;
/** A sentence that has to stand out above the list: a flat tint, never a card among the cards. */
function Note({ children, tone = 'wash' }: { children: ReactNode; tone?: 'wash' | 'warn' }) {
  return <Surface kind="note" tone={tone}><T accessibilityRole="alert" variant="body">{children}</T></Surface>;
}
const keyOf = (p: MojaPrijavaProjekcija) => p.prijavaId;
const deviceZone = (): string | undefined => {
  try { return Intl.DateTimeFormat().resolvedOptions().timeZone || undefined; } catch { return undefined; }
};

/**
 * Moje prijave — what I applied to and where each application stands (owner's step 5c, 2026-09-24; one record since 2026-10-08, composition spec
 * 4.5 and 4.7; groups since the approved draft U8). A detail screen: the arrow back and the name, then the applications in three groups, each with
 * its name and its count ("Čeka odgovor · 2", "Izabrana · 1", "Završene · 3"), then one `Surface record` per application (`ApplicationFace`, the
 * worker's side of the shared `PrijavaCard`), 12 apart. The legacy whole-list read draws groups. A paged read keeps the SERVER'S own sets even after the final page, which are chips (Sve · Čeka te ·
 * Aktivne · Završene, the one control that scrolls sideways) with the count of the set as the first line of the list: what happens to be loaded is
 * never counted or grouped as if it were everything. No card edge carries a state: the card's chip says it, in the owner's five words (Poslata,
 * Viđena, Izabrana, Nije izabrana, Povučena). Empty and error use StateView; loading shows a calm non-result. Presentation only: every callback
 * is the route's existing guarded command.
 *
 * What opens under a card whose task changed is a short list of what the person can do, each with what it means (keep it, change it,
 * withdraw it) instead of four buttons of one look, and the form to change it when that is chosen.
 */
export function MyApplicationsPresentation(props: Props) {
  const filtered = props.tab === 'all' ? props.rows : props.rows.filter(p => applicationSection(p) === props.tab);
  // Loading the last page must not remove filters or reorder the cards under the finger.
  // Only the legacy whole-list read uses groups; paged reads keep their server set and order.
  const whole = !props.paging;
  // The whole-list fallback also needs a route from Sve back to current applications and history.
  const chips = true;
  // Put the explicitly requested row first. Unlike scrollToIndex this also works before variable-height
  // cards outside the initial virtualized window have been measured. Never change the user's filter.
  const focused = props.focusId ? filtered.find(p => p.prijavaId === props.focusId) : undefined;
  const visible = focused ? [focused, ...filtered.filter(p => p.prijavaId !== focused.prijavaId)] : filtered;
  const missingNamed = !!props.requestedId && !props.rows.some(p => p.prijavaId === props.requestedId);
  const appear = useAppear();
  appear.settle(visible.map(keyOf));
  // The entries of the list: the groups with their heads, and in each group the row that was asked for first, then what asks for the person (the
  // server's own flag), then the order the read gave. Not whole: the rows as they are.
  const entries: Entry[] = !whole ? visible.map(p => ({ kind: 'row' as const, p })) : APPLICATION_GROUPS.reduce<Entry[]>((out, group) => {
    const rows = filtered.map((p, at) => ({ p, at })).filter(entry => applicationGroup(entry.p) === group.key);
    if (!rows.length) return out;
    const rank = (p: MojaPrijavaProjekcija) => p.prijavaId === props.focusId ? 0 : p.traziPaznju ? 1 : 2;
    rows.sort((a, b) => rank(a.p) - rank(b.p) || a.at - b.at);
    out.push({ kind: 'head', group: group.key, title: group.title, count: rows.length, first: out.length === 0 });
    rows.forEach(entry => out.push({ kind: 'row', p: entry.p }));
    return out;
  }, []);
  // The spinner of the pull is for a pull: a read the screen makes by itself (a tab switched, a focus) must not raise it (the owner's phone, 8 Oct 2026).
  const pull = usePullRefresh(props.onRefresh, props.loading || !!props.refreshing);
  const disabled = props.busy || props.pending || props.editingLoading || !!props.refreshing;
  // The route's handlers are fresh closures every render and are handed to the cards as such, on
  // purpose: each carries the guards of the render that made it, and a handle captured before an
  // account change is refused by them. The card's text is what stays memoised (ApplicationSummary).
  // The review of changed conditions belongs to one row at most; it is composed once per render, here.
  // Keep a retained edit visible after a background refresh changes the row, so its text can be copied.
  // The route refuses submission against a different row revision.
  const expandedRow = props.expanded ? visible.find(p => p.prijavaId === props.expanded &&
    (p.stanje === 'STALE_REVIEW_REQUIRED' || !!props.draft)) ?? null : null;
  function reviewOf(p: MojaPrijavaProjekcija) {
    const draft = props.draft;
    const people = draft ? applicationPeopleCount(draft.people) : null;
    const invalidPeople = !!draft && (people === null || people > draft.pricing.pokrivenost.ukupno);
    const invalidFixedPrice = !!draft && draft.pricing.rezimCene === 'MY_PRICE' && !invalidPeople
      && fixedApplicationPrice(draft.pricing, people!) === null;
    return <View testID="application-review">
      <View pointerEvents="none" style={s.rule} />
      <View style={s.review}>
          <T accessibilityRole="header" variant="heading">{props.draftStale ? 'Nesačuvan unos prijave' : 'Trenutni uslovi zadatka'}</T>
          {props.draftStale ? <T accessibilityRole="alert" variant="body">Prijava se promenila tokom uređivanja. Vaš unos je sačuvan na ovom ekranu, ali ga ne možete poslati. Kopirajte tekst koji želite da zadržite, pa započnite novi pregled.</T>
            : <><T variant="body">{p.opis || 'Dodatni opis nije naveden.'}</T>
              <T variant="note" tone="muted">{p.osnovicaZaProveru
                ? 'Uz raniju cenu nije potvrđen način obračuna. Pregledajte iznos, osnovicu i broj ljudi, pa potvrdite ažuriranu prijavu.'
                : 'Prijava je poslata pre nego što je zadatak izmenjen. Ako je zadržite, ostaju ponuđena cena, obim, termin i napomena.'}</T></>}
        {props.editingLoading ? <ActivityIndicator accessibilityLabel="Učitavanje sačuvanog termina" color={sys.color.green} /> : null}
        {draft ? <View style={s.fields}>
          <T accessibilityRole="header" variant="heading">Izmenite svoju prijavu</T>
          <T variant="note" tone="muted">{draft.pricing.rezimCene === 'OFFERS' ? 'Cena važi za ceo ponuđeni obim.'
            : draft.pricing.osnovaCene === 'HOURLY' ? 'Satnica važi za svaku osobu za jedan sat rada. Ukupan iznos zavisi od trajanja.'
            : draft.pricing.osnovaCene === 'PER_PERSON' ? 'Cena po osobi iz zadatka množi se brojem ljudi u Vašoj prijavi.'
            : draft.pricing.osnovaCene === 'TOTAL' ? 'Vaša cena se računa srazmerno broju ljudi, zaokruženo na najbliži dinar.' : 'Cena je određena u zadatku.'}</T>
          <T variant="meta" tone="muted">{draft.pricing.osnovaCene === 'HOURLY' ? 'Satnica po osobi (RSD po satu)' : 'Cena prijave ukupno (RSD)'}</T>
          <TextInput accessibilityLabel={draft.pricing.osnovaCene === 'HOURLY' ? 'Satnica po osobi (RSD po satu)' : 'Cena ponude (RSD)'} value={draft.price} keyboardType="number-pad" editable={!disabled && draft.pricing.rezimCene === 'OFFERS'} onChangeText={price => props.onChange({ ...draft, price })} style={s.input} />
          {invalidFixedPrice ? <T accessibilityRole="alert" variant="note">Cena za ovaj broj ljudi mora biti najmanje 1 RSD. Proverite broj ljudi.</T> : null}
          <T variant="meta" tone="muted">Ljudi koje obezbeđujete</T>
          <ApplicationPeopleInput label="Broj ljudi" value={draft.people} maximum={draft.pricing.pokrivenost.ukupno} disabled={disabled}
            onChange={people => props.onChange({ ...draft, people })} help={`Zadatak traži ${osobuAkuz(draft.pricing.pokrivenost.ukupno)}.`} />
          <T variant="meta" tone="muted">Napomena</T>
          <TextInput accessibilityLabel="Napomena uz ponudu" value={draft.note} multiline editable={!disabled} onChangeText={note => props.onChange({ ...draft, note })} style={[s.input, s.multiline]} />
          <T variant="note" tone="muted">Ponuđeni termin ostaje nepromenjen: {draft.start || draft.end
            ? needScheduleText({ kind: 'FIXED_WINDOW', startsAt: draft.start, endsAt: draft.end }, p.zadatak?.vremenskaZona || deviceZone()) : 'Nije naveden u prijavi.'}</T>
          <V2Action label="Potvrdite ažuriranu prijavu" onPress={() => props.onUpdate(p)} disabled={disabled || props.draftStale || invalidPeople || invalidFixedPrice} style={brandAction} />
          <V2Action label="Odustani od izmene" onPress={props.onCancelEdit} disabled={disabled} kind="quiet" />
        </View> : <View>
          {/* The sentence above says what keeping keeps; each row says what it does by its name, and no row explains itself (J4). */}
          {p.osnovaCene === 'TOTAL' || p.osnovaCene === 'HOURLY' ? <ListRow title="Zadržite prijavu" accessibilityLabel="Zadržite prijavu" onPress={() => props.onKeep(p)} disabled={disabled} /> : null}
          <ListRow title="Pregledajte i izmenite prijavu" accessibilityLabel="Pregledajte i izmenite prijavu" onPress={() => props.onEdit(p)} disabled={disabled} />
          <ListRow title="Povuci izmenjenu prijavu" tone="danger" accessibilityLabel="Povuci izmenjenu prijavu" onPress={() => props.onWithdraw(p)} disabled={disabled} />
        </View>}
        <V2Action label="Zatvori pregled izmena" onPress={props.onClose} disabled={props.busy || props.pending} kind="quiet" style={s.quietLeft} />
      </View>
    </View>;
  }
  const review = expandedRow ? reviewOf(expandedRow) : null;
  const renderItem = ({ item, index }: ListRenderItemInfo<Entry>) => {
    if (item.kind === 'head') return <T accessibilityRole="header" variant="heading" style={item.first ? undefined : s.groupGap}>{`${item.title} · ${item.count}`}</T>;
    const p = item.p;
    return <Appear index={index} animate={appear.isNew(p.prijavaId)}>
      <ApplicationCard row={p} expanded={props.expanded === p.prijavaId && review !== null} disabled={disabled} large={props.largeText}
        fresh={!!props.freshId && props.freshId === p.prijavaId}
        onReview={() => props.onReview(p)} onAgreement={() => props.onAgreement(p)} onWithdraw={() => props.onWithdraw(p)} onTask={() => props.onTask(p)}>
        {props.expanded === p.prijavaId ? review : null}
        {props.onService && ['SUBMITTED', 'VIEWED', 'SHORTLISTED', 'SELECTED'].includes(p.stanje) ?
          <V2Action compact kind="quiet" label="Usluga u radnom profilu" disabled={disabled}
            onPress={() => props.onService?.(p)} /> : null}
      </ApplicationCard>
    </Appear>;
  };
  // Paged: the server's own counts, never the number that happens to be loaded.
  const paging = props.paging, serverCounts = paging?.counts ?? null;
  const count = (tab: ApplicationsTab) => paging ? (serverCounts ? (tab === 'all' ? serverCounts.total : serverCounts[tab]) : 0)
    : tab === 'all' ? props.rows.length : props.rows.filter(p => applicationSection(p) === tab).length;
  // Whether there is any application at all: a tab of a paged set can be empty while the others are not.
  const hasAny = paging ? (serverCounts ? serverCounts.total > 0 : props.rows.length > 0) : props.rows.length > 0;
  // A last page may be cut short by concurrent changes or a server read-contract fault.
  // The first-page count is authoritative; a terminal cursor alone is not evidence
  // that every application in this specific scope was returned.
  const expectedSetCount = serverCounts ? props.tab === 'all' ? serverCounts.total : serverCounts[props.tab] : null;
  const finalCountMismatch = !!paging && !props.loading && !props.unavailable && !props.refreshing &&
    !paging.hasMore && !paging.loadingMore && !paging.moreError &&
    (expectedSetCount === null || expectedSetCount !== filtered.length);
  // A number is drawn only for what waits for the person ("Čeka te"); the others are spoken (`Segmented`).
  const tabs = TABS.map(option => ({ ...option, badge: count(option.key) || undefined, badgeLabel: prijava(count(option.key)),
    badgeTone: option.key === 'attention' ? 'attention' as const : undefined }));
  // Reading, a failed read, an empty filtered set and a first empty list remain distinct.
  const empty = <View style={s.empty}>
    {props.loading ? <QuietReadState art="applications" title="Učitavamo Vaše prijave…" body="Proveravamo njihova aktuelna stanja." />
      // The fallback names no cause nobody checked (review r4 item 4). The retry greys out while a command is in flight
      // (`busy` is a write, item 3); a read in flight shows the loading state above instead of this one.
      : props.unavailable ? <StateView kind="error" art="applications" title="Prijave trenutno nisu dostupne" body={props.message ?? 'Pokušajte ponovo za trenutak.'}
        primary={{ label: 'Pokušajte ponovo', onPress: props.onRefresh, disabled: props.busy }} quiet={{ label: 'Nazad', onPress: props.onBack }} />
    : finalCountMismatch ? <StateView kind="error" art="applications" title="Spisak prijava nije potpun"
        body="Broj učitanih prijava ne odgovara serverskom stanju. Proverite prijave ponovo."
        primary={{ label: 'Proverite spisak prijava', onPress: props.onRefresh, disabled: props.busy }} />
    : hasAny && props.tab !== 'all' ? <StateView art="applications" title={TAB_EMPTY[props.tab]}
          primary={props.tab === 'active' && count('attention') > 0
            ? { label: 'Pogledajte šta Vas čeka', onPress: () => props.onTab('attention') }
            : props.tab === 'active' && count('finished') > 0
              ? { label: 'Pogledajte istoriju', onPress: () => props.onTab('finished') }
              : { label: 'Prikaži sve prijave', onPress: () => props.onTab('all') }} />
          : <StateView hero art="applications" title="Još nemate prijavu" primary={{ label: 'Pronađite zadatak', onPress: props.onExplore }} />}
  </View>;
  const shown = count(props.tab);
  const showsFeedback = !props.loading && !props.unavailable &&
    (props.message || props.notice || props.pending || missingNamed || (finalCountMismatch && visible.length > 0));
  const showsCount = chips && !props.loading && !props.unavailable && shown > 0;
  return <SafeAreaView edges={['top', 'bottom']} style={s.screen}>
    <DetailTopBar title="Moje prijave" onBack={props.onBack} />
    {/* ONE control row: four existing server sets, and chips are the one control that scrolls sideways (they run out to the edges). With no
        application there is nothing to switch, so the first-run state stands alone under the bar. */}
    {chips && !props.unavailable && (hasAny || props.loading) ? <View testID="applications-tabs" style={s.controls}>
      <Segmented value={props.tab} onChange={props.onTab} options={tabs} />
    </View> : null}
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={s.grow}>
      <FlatList<Entry> data={props.loading || props.unavailable ? [] : entries} keyExtractor={entryKey}
        // Six of these cards are more than one phone screen. Off-screen cells are NOT detached here:
        // the expanded review holds text inputs, and a detached input loses the keyboard on Android. FlatList
        // detaches them by default on Android, so it is said explicitly.
        removeClippedSubviews={false} initialNumToRender={6} maxToRenderPerBatch={6} windowSize={7}
        keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" showsVerticalScrollIndicator={false} contentContainerStyle={s.list}
        refreshing={pull.refreshing} onRefresh={pull.onRefresh} ListEmptyComponent={empty} ItemSeparatorComponent={Separator}
        onEndReached={!props.refreshing && paging && paging.hasMore && !paging.loadingMore && !paging.moreError ? paging.onLoadMore : undefined} onEndReachedThreshold={0.6}
        ListFooterComponent={paging && !props.refreshing && !props.loading && !props.unavailable && visible.length > 0 && (paging.hasMore || paging.loadingMore || paging.moreError) ? <View style={s.foot}>
          {paging.moreError ? <>
            <T variant="note" tone="muted">Ne možemo da učitamo ostale prijave.</T>
            <V2Action label="Pokušajte ponovo" kind="quiet" onPress={paging.onLoadMore} />
          </> : paging.loadingMore ? <T variant="note" tone="muted">Učitavamo još prijava…</T>
            : <V2Action label="Prikaži još" kind="quiet" onPress={paging.onLoadMore} />}
        </View> : null}
        ListHeaderComponent={showsFeedback || showsCount || props.refreshing ? <View style={s.head}>
          {props.refreshing ? <T accessibilityLiveRegion="polite" variant="note" tone="muted">Osvežavamo Vaše prijave… Sačekajte proveru pre izmene ili povlačenja.</T> : null}
          {showsFeedback ? <View style={s.feedback}>
            {finalCountMismatch && visible.length > 0 ? <Surface kind="note" tone="warn">
              <T accessibilityRole="alert" variant="body">Spisak prijava nije potpun. Broj učitanih prijava ne odgovara serverskom stanju.</T>
              <V2Action label="Proverite spisak prijava" onPress={props.onRefresh} kind="quiet" disabled={props.busy} />
            </Surface> : null}
            {missingNamed ? <Surface kind="note"><T variant="body" accessibilityRole="alert">Ova prijava trenutno nije dostupna</T>
              <V2Action label="Osvežite prijave" onPress={props.onRefresh} disabled={props.busy} /></Surface> : null}
            {props.message ? <Note tone="warn">{props.message}</Note> : null}{props.notice ? <Note>{props.notice}</Note> : null}
            {/* A command waits for its readback: a flat tint above the list, never a card among the cards. */}
            {props.pending ? <Surface kind="note"><T variant="body">{props.busy ? 'Čekamo potvrdu radnje…'
              : props.pendingAction === 'withdraw' ? 'Proverite da li je prijava povučena. Ponovni pokušaj koristi isti zahtev za povlačenje.'
                : props.pendingAction === 'update' ? 'Proverite da li je izmenjena prijava sačuvana. Ponovni pokušaj koristi isti zahtev.'
                  : props.pendingAction === 'keep' ? 'Proverite da li je potvrda izmenjenog zadatka sačuvana. Ponovni pokušaj koristi isti zahtev.'
                    : 'Proverite stanje prijave pre nastavka. Ponovni pokušaj koristi isti zahtev.'}</T>
              <V2Action label="Proverite stanje prijave" onPress={props.onRefresh} disabled={props.busy} />
              {props.canRetry ? <V2Action label="Ponovi istu radnju" onPress={props.onRetry} disabled={props.busy} /> : null}
              {props.canReset ? <V2Action label="Pregledaj trenutnu prijavu" onPress={props.onReset} disabled={props.busy} /> : null}</Surface> : null}
          </View> : null}
          {/* How many applications the set shows: the list's first line, which scrolls away with it. */}
          {showsCount ? <T testID="applications-count" variant="note" tone="muted">{prijava(shown)}</T> : null}
        </View> : null}
        renderItem={renderItem} />
    </KeyboardAvoidingView>
  </SafeAreaView>;
}
const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: sys.color.ground }, grow: { flex: 1, minWidth: 0 },
  // The control row under the bar: the screen's edge each side and 8 under the bar; the chips bleed to the edges by that same width.
  controls: { paddingHorizontal: layout.gutter, paddingTop: sys.space.sm },
  // The list: the edge, 12 under the control row, 32 under the last card; a card from the next 12 below it.
  list: { flexGrow: 1, paddingHorizontal: layout.gutter, paddingTop: sys.space.md, paddingBottom: layout.zone },
  separator: { height: layout.group },
  // A group other than the first starts 12 lower than the 12 the separator gives: 24 between the groups, 12 between a head and its cards.
  groupGap: { paddingTop: layout.group },
  empty: { flex: 1, paddingVertical: sys.space.sm },
  head: { gap: sys.space.md, paddingBottom: sys.space.sm },
  feedback: { gap: sys.space.md },
  // The review of a changed task opens under the card's body, below the one line that parts two touch zones.
  rule: { height: ruleWidth, backgroundColor: sys.color.line },
  review: { gap: sys.space.md, padding: layout.card },
  fields: { gap: sys.space.sm },
  input: { ...field },
  multiline: { minHeight: 96, textAlignVertical: 'top' },
  quietLeft: { alignSelf: 'flex-start', paddingHorizontal: 0 },
  foot: { paddingTop: sys.space.base, alignItems: 'center', gap: sys.space.sm },
});
