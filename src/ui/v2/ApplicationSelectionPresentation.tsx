import { memo, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { readableTitle } from '../../data/needDetailPresentation';
import { novac } from '../../lib/novac';
import { FlatList, StyleSheet, View, type ListRenderItemInfo } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { JavniProfilProjekcija, KandidatProjekcija, PotrebaProjekcija } from '../../contracts/projections';
import type { Ishod } from '../../data/ports';
import type { SelectionAgreementStatus, SelectionReceipt } from '../../data/applicationSelectionClientService';
import type { PublicWorkTrust } from '../../data/workTrustClientService';
import { Press } from '../Press';
import { Appear, useAppear } from '../system/Appear';
import { Avatar, type AvatarSize } from '../system/Avatar';
import { useConfirmSheet } from '../system/ConfirmSheet';
import { PublicProfileSheet, type PublicProfileState, type SafetyEntry } from '../system/PublicProfileSheet';
import { ProductHeader } from '../product/ProductDetails';
import { ProductSheet } from '../product/ProductSheet';
import { Glyph } from '../system/Glyph';
import { FactRow } from '../system/FactRow';
import { MoneySummary } from '../system/MoneySummary';
import { layout } from '../system/layout';
import { ListRow } from '../system/ListRow';
import { osoba, osobuAkuz, prijava } from '../system/plural';
import { Screen } from '../system/Screen';
import { Section } from '../system/Section';
import { StateView } from '../system/StateView';
import { Surface } from '../system/Surface';
import { LARGE_TEXT_SCALE, useLayoutClass, useWindowRoom } from '../system/textScale';
import { brandAction, sys } from '../system/tokens';
import { usePullRefresh } from '../system/usePullRefresh';
import { T } from '../Text';
import { CandidateCard, CandidateCompareCard, CandidatePerson, UNPRICED, candidateChip, candidateHas, candidateStatus, candidateTime, candidateValue } from './CandidateFace';
import { candidateRatingValue } from '../../data/candidateRating';
import { DogovorenoMoment } from './DogovorenoMoment';
import { ChoiceRow } from './offer/ChoiceRow';
import { PrijavaState } from './PrijavaCard';
import { V2Action } from './V2Action';
import { splitFirstSentence } from './ApplicationComposerPresentation';
import { QuietReadState } from './QuietReadState';
import { TaskCapacity } from './detail/TaskCapacity';

/**
 * The worker's application composer lives in its own module since round 6 (unit `prijava`, 2026-09-24). It is re-exported
 * here under its old name, as the same function, so every caller and test that found it here still finds it.
 */
export { ApplicationComposerPresentation as ApplicationSelectionPresentation, type ApplicationDraft } from './ApplicationComposerPresentation';

/**
 * While the read runs, a quiet non-result holds the list's place, so it never invents people or offers before rows
 * arrive; a read that failed says so the one way every screen does (`StateView`): its first sentence as the title, the
 * rest under it, and the retry as the green action.
 */
export function SelectionUnavailable({ loading, message, retry, back }: { loading: boolean; message: string; retry?: () => void; back: () => void }) {
  const [title, body] = splitFirstSentence(message);
  return <Screen kind="detail" header={<ProductHeader backLabel="Nazad na zadatak" title="Prijave" back={back} />}>
    {loading ? <QuietReadState art="applications" title="Učitavamo prijave…" body="Proveravamo ko se prijavio i koliko mesta je još dostupno." />
      : <StateView kind="error" title={title} body={body ?? undefined} primary={retry ? { label: 'Pokušajte ponovo', onPress: retry } : undefined} />}
  </Screen>;
}
/** A cold-restored command has no retained private offer. Its exact receipt is
 * still useful without that snapshot; absence never invents new terms or a new
 * selection. Resend is the previously confirmed immutable command only. */
export function SelectionRecoveryPresentation({ receipt, busy, uncertain, refresh, resend, back, openAgreement, error, reset }: {
  receipt: SelectionReceipt | null; busy: boolean; uncertain: boolean; refresh: () => void;
  resend: () => void | Promise<unknown>; back: () => void; openAgreement: () => void; error: string | null; reset?: () => void;
}) {
  const statuses: Record<SelectionAgreementStatus, string> = {
    CONFIRMED: 'Dogovor je pronađen. Otvorite ga da vidite aktuelne uslove saradnje.',
    CANCELLED: 'Izbor je bio sačuvan, a saradnja je u međuvremenu otkazana. Otvorite Dogovor za detalje.',
    COMPLETED: 'Izbor je bio sačuvan, a saradnja je u međuvremenu završena. Otvorite Dogovor za detalje.',
    SUPERSEDED: 'Izbor je bio sačuvan. Ovaj Dogovor više nije aktuelan; otvorite ga da vidite detalje.',
  };
  const primary = receipt ? { label: 'Otvorite Dogovor', onPress: openAgreement }
    : reset ? { label: 'Pregledajte prijave', onPress: reset }
    : uncertain ? { label: 'Proverite da li je izabrano', onPress: refresh }
    : { label: 'Pošaljite isti izbor ponovo', onPress: () => { void resend(); } };
  const quiet = !reset && ((!receipt && !uncertain) || (receipt && error))
    ? { label: 'Proverite ponovo', onPress: refresh, disabled: busy } : undefined;
  const body = receipt ? (receipt.agreementStatus ? statuses[receipt.agreementStatus] : statuses.CONFIRMED)
    : reset ? 'Prethodni izbor je odbijen. Pregledajte aktuelne prijave pre novog izbora.'
    : uncertain ? 'Prethodni zahtev je sačuvan na ovom telefonu. Proverite da li je izbor stigao; provera ga ne šalje ponovo.'
    : 'Potvrda izbora još nije pronađena. Možete proveriti ponovo ili izričito poslati isti ranije potvrđeni izbor, bez promene prijave ili uslova.';
  return <Screen kind="detail" header={<ProductHeader backLabel="Nazad na zadatak" title="Prethodni izbor" back={back} />}>
    <StateView kind={receipt ? 'empty' : 'uncertain'} art={receipt ? 'agreements' : 'info'}
      title={receipt ? 'Izbor je sačuvan' : reset ? 'Izbor nije prihvaćen' : 'Proverite prethodni izbor'}
      body={error ? `${body} ${error}` : body} primary={{ ...primary, disabled: busy, busy }} quiet={quiet} />
  </Screen>;
}
/** `loading` is this action's own write in flight: the button keeps its green and its words, with a spinner. */
function BrandAction({ label, onPress, disabled, loading }: { label: string; onPress: () => void; disabled?: boolean; loading?: boolean }) {
  return <V2Action label={label} onPress={onPress} disabled={disabled} loading={loading} style={brandAction} />;
}
function ErrorMessage({ error }: { error?: string | null }) {
  return error ? <Surface kind="note" tone="warn"><T accessibilityRole="alert" accessibilityLiveRegion="polite" variant="body">{error}</T></Surface> : null;
}
/** A person's picture at the size its place asks for, handed in by the screen; the Avatar with their letters when absent. */
export type CandidatePhoto = (candidate: KandidatProjekcija, size: AvatarSize) => ReactNode;

const candidateKey = (k: KandidatProjekcija) => k.prijavaId;
const CandidateSeparator = () => <View style={s.separator} />;
/**
 * One candidate in the list, as a card or as a comparison column. Memoised on the row's own object
 * and primitives so a re-render of the screen touches only the rows whose offer changed; the
 * closure over `candidate` is made here, from the list's one stable `open`.
 */
const CandidateItem = memo(function CandidateItem({ candidate, need, index, animate, compare, columnWidth, large, narrow, open, photo, viewed, measure, disabled }: {
  disabled: boolean;
  candidate: KandidatProjekcija; need: PotrebaProjekcija; index: number; animate: boolean; compare: boolean;
  /** The width of one of two comparison columns; null in one column. A lone last application keeps it instead of the whole row. */
  columnWidth: number | null; large: boolean; narrow: boolean; open: (candidate: KandidatProjekcija) => void; photo?: CandidatePhoto;
  /** The server confirmed that this application was seen (opened on this phone): its chip says "Viđena". */
  viewed: boolean;
  /** What the whole list says about this application ("Najniža cena"), or null: only a list that is whole says anything. */
  measure: string | null;
}) {
  const openThis = useCallback(() => open(candidate), [open, candidate]);
  const face = photo?.(candidate, compare ? 40 : layout.slotFace);
  // An application is somebody else's: a new one arrives from above (owner's pick "Ponude preko stola", rule B1).
  return <Appear index={index} animate={animate} from="above" style={columnWidth ? { width: columnWidth } : undefined}>
    {compare ? <CandidateCompareCard candidate={candidate} timezone={need.taskTimezone} fallbackTime={need.vremeTekst} viewed={viewed} onOpen={openThis}
      photo={face} aligned={columnWidth !== null} disabled={disabled} />
      : <CandidateCard candidate={candidate} timezone={need.taskTimezone} fallbackTime={need.vremeTekst} viewed={viewed} onOpen={openThis}
        photo={face} large={large} narrow={narrow} measure={measure} disabled={disabled} />}
  </Appear>;
});

/** Exact comparison unit: TOTAL is the amount for every person in that application,
 * so rank by RSD per person. HOURLY is already per person per hour, never divide
 * it by headcount or compare it against a TOTAL. A hidden/malformed price cannot rank. */
type ComparablePrice = { amount: number; people: number; unit: 'TOTAL_PER_PERSON' | 'HOURLY_PER_PERSON_HOUR' };
function comparablePrice(k: KandidatProjekcija): ComparablePrice | null {
  if (candidateValue(k).kind !== 'amount' || k.cena.valuta !== 'RSD'
    || (k.osnovaCene !== 'TOTAL' && k.osnovaCene !== 'HOURLY')
    || !Number.isSafeInteger(k.pokrivaMesta) || k.pokrivaMesta < 1) return null;
  return { amount: k.cena.iznos, people: k.osnovaCene === 'HOURLY' ? 1 : k.pokrivaMesta,
    unit: k.osnovaCene === 'HOURLY' ? 'HOURLY_PER_PERSON_HOUR' : 'TOTAL_PER_PERSON' };
}
/** Compare without rounding displayed dinars or creating fictitious accepted terms.
 * The normal product (RSD <= INT32, people <= 50) is exact in a JS safe integer. */
function comparePrices(a: ComparablePrice, b: ComparablePrice): number {
  const left = a.amount * b.people, right = b.amount * a.people;
  if (Number.isSafeInteger(left) && Number.isSafeInteger(right)) return left < right ? -1 : left > right ? 1 : 0;
  const divided = a.amount / a.people - b.amount / b.people;
  return divided < 0 ? -1 : divided > 0 ? 1 : 0;
}
function incomparablePrices(prices: readonly (ComparablePrice | null)[]): boolean {
  return prices.some(price => price === null)
    || new Set(prices.filter((price): price is ComparablePrice => price !== null).map(price => price.unit)).size > 1;
}

/** The two things a whole list can say about an application that can still be chosen, in the owner's words. */
export const MEASURE_LOWEST_PRICE = 'Najniža cena';
export const MEASURE_BEST_RATING = 'Najbolja ocena';
/**
 * What a list says about its applications by comparing them, and only what is true: among the applications that can still be chosen, the
 * one with the lowest comparable per-person price (when at least two have one) and the one with the best rating (when at least two have a rating that stands on
 * at least one rating: a lone rating is not "the best" of anything). A tie is a tie: both are said. An application that cannot be chosen,
 * one without a stored total and one without a rating are never ranked, and nothing is said for a list that is not whole, because a
 * lower price or a better rating may be on the page that has not been read. The lowest price takes the one mark when an application is both.
 */
export function candidateMeasures(candidates: readonly KandidatProjekcija[], whole: boolean): ReadonlyMap<string, string> {
  const marks = new Map<string, string>();
  if (!whole) return marks;
  // The server may return SELECTABLE while denying selection (calendar, account,
  // closed capacity); state alone is not a grant of authority to mark "best".
  const open = candidates.filter(k => k.stanje === 'SELECTABLE' && k.mozeIzabrati === true);
  const priced = open.map(k => ({ k, price: comparablePrice(k) }))
    .filter((entry): entry is { k: KandidatProjekcija; price: ComparablePrice } => entry.price !== null);
  const comparable = !incomparablePrices(open.map(comparablePrice));
  const lowest = comparable && priced.length > 1
    ? priced.reduce((best, entry) => comparePrices(entry.price, best.price) < 0 ? entry : best) : null;
  const rated = open.map(k => ({ k, figure: candidateRatingFigure(k) })).filter(entry => entry.figure && entry.figure.count > 0);
  const best = rated.length > 1 ? Math.max(...rated.map(entry => entry.figure!.rating)) : null;
  for (const k of open) {
    if (lowest !== null && priced.some(entry => entry.k === k && comparePrices(entry.price, lowest.price) === 0))
      marks.set(k.prijavaId, MEASURE_LOWEST_PRICE);
    else if (best !== null && rated.some(entry => entry.k === k && entry.figure!.rating === best)) marks.set(k.prijavaId, MEASURE_BEST_RATING);
  }
  return marks;
}

/**
 * How the loaded offers are ordered, on the phone and without a new request. The rows carry no time of
 * sending, so there is no "newest" to promise: the first order is the server's own, which
 * `rpc_list_need_candidates` sends by `submitted_at asc` (earliest first); the others are by the comparable per-person price and by the rating the
 * person has. All are stable, so offers that tie keep their order of arrival.
 */
export type CandidateSort = 'ARRIVAL' | 'PRICE' | 'RATING';
const SORTS: readonly CandidateSort[] = ['ARRIVAL', 'PRICE', 'RATING'];
/** The three orders in the approved draft's words (R4): the earliest, the lowest price, the best rating. One name for one thing: the marks on the cards say the same two. */
const SORT_LABEL: Record<CandidateSort, string> = { ARRIVAL: 'Najranije', PRICE: 'Najniža cena', RATING: 'Najbolja ocena' };
/**
 * The rating a candidate stands on, from the words the read gave ("4,8", the count "11 ocena"): the figure, and how many ratings it
 * stands on. A person with no rating ("—", "Još nema ocena") has none (null), which is not a bad one: they come after everyone who has one.
 */
export function candidateRatingFigure(k: Pick<KandidatProjekcija, 'ocenaTekst' | 'recenzijeTekst'>): { rating: number; count: number } | null {
  const rating = candidateRatingValue(k.ocenaTekst);
  if (rating === null || k.recenzijeTekst?.trim() === '0 ocena') return null;
  const countMatch = /^\s*(\d+)\s+(?:ocen|recenzij)/.exec(k.recenzijeTekst ?? '');
  const count = countMatch ? Number(countMatch[1]) : 0;
  return { rating, count: Number.isSafeInteger(count) && count >= 0 ? count : 0 };
}
export function sortCandidates(candidates: readonly KandidatProjekcija[], sort: CandidateSort): readonly KandidatProjekcija[] {
  // The server's order is the list exactly as read: the same array, so the default draws what it always drew.
  if (sort === 'ARRIVAL') return candidates;
  const indexed = candidates.map((k, at) => ({ k, at }));
  if (sort === 'PRICE') {
    const entries = indexed.map(entry => ({ ...entry, price: comparablePrice(entry.k) }));
    // Unlike units have no meaningful common "cheapest" ranking.
    if (incomparablePrices(entries.map(entry => entry.price))) return candidates;
    return entries.sort((a, b) => a.price && b.price ? comparePrices(a.price, b.price) || a.at - b.at
      : a.price ? -1 : b.price ? 1 : a.at - b.at).map(({ k }) => k);
  }
  // The best rating first; the same rating, the one that stands on more ratings; the same again, the earlier application. No rating, last.
  return indexed.map(entry => ({ ...entry, figure: candidateRatingFigure(entry.k) })).sort((a, b) => a.figure && b.figure
    ? b.figure.rating - a.figure.rating || b.figure.count - a.figure.count || a.at - b.at : a.figure ? -1 : b.figure ? 1 : a.at - b.at).map(({ k }) => k);
}

/**
 * Task context stays above the applications. Capacity counts selected people;
 * the separate list toolbar counts applications, including offers for several people.
 */
function TaskBrief({ need, open }: { need: PotrebaProjekcija; open?: () => void }) {
  const title = readableTitle(need.naslov);
  return <View style={s.taskBrief}>
    {open ? <ListRow title={title} last accessibilityLabel={`Otvorite zadatak: ${title}`} onPress={open} />
      : <T variant="heading" accessibilityRole="header">{title}</T>}
    <TaskCapacity capacity={need.pokrivenost} />
  </View>;
}

/**
 * EX-04 S4 (A11): what a list read a page at a time says besides its rows. `total` is the number of applications the server counted on the first page (null until it answered);
 * the rows are the ones loaded so far, in the whole-list order, and the foot offers the next page, or says it failed and offers the same call again. A list without this prop is the
 * whole list and draws exactly what it always drew.
 */
export type CandidatesPaging = { total: number | null; hasMore: boolean; loadingMore: boolean; moreError: boolean; onLoadMore: () => void };

/**
 * Candidates of one Task (owner's step 7, 2026-09-24; one record and one rhythm since 2026-10-08, composition spec 4.7): the offers as
 * person-first `Surface record`s (`CandidateFace`), 12 apart, or side by side for a fast decision (owner decision 3, TARGET-034). Two
 * columns only while each has at least 200 dp after the list's padding and gap, and text is under Large (read rounded, since Android
 * hands Large over as 1.2999999523). An offer opens as a sheet over this list, so the list is still where the person left it when they
 * close it.
 *
 * The screen is the bar (the arrow, "Prijave" and, with two or more, "Uporedi"), the Task these offers answer as one row that opens it,
 * one line that says how many there are and how they are ordered, and the cards. No line stands between them: the space is the only
 * divider. The order is changed in a sheet of three choices (the arrival, the price, the rating), not in a menu that opens in the list.
 */
export function CandidateListPresentation({ need, candidates, open, back, refresh, openTask, sort: chosenSort, onSort, comparison, onComparison, photo, textScale: forcedScale, paging, viewed, targetNotice, refreshing = false }: {
  refreshing?: boolean;
  need: PotrebaProjekcija; candidates: KandidatProjekcija[]; open: (candidate: KandidatProjekcija) => void; back: () => void; refresh: () => void;
  /** Present only when the list is read a page at a time (EX-04 S4); `candidates` are then the ones loaded so far. */
  paging?: CandidatesPaging;
  /**
   * The ids of the applications the server confirmed as seen on this phone (opened by the requester): their chip says "Viđena". The
   * candidate read carries no viewed flag, so nothing else can say it; an id that is not here is "Poslata", which is still true.
   */
  viewed?: ReadonlySet<string>;
  /** A verified event can outlive the particular offer; the owner still sees their task's other applications. */
  targetNotice?: string;
  /** The row at the top opens the Task these offers answer. */
  openTask?: () => void;
  /** The order the route keeps, so it survives opening an offer and coming back. Held here when absent. */
  sort?: CandidateSort; onSort?: (sort: CandidateSort) => void;
  /** Keep this browsing choice through a current-data reread; offers themselves are read again. */
  comparison?: boolean; onComparison?: (compare: boolean) => void;
  /** The person's photo in a row; the Avatar with their letters when absent. */
  photo?: CandidatePhoto;
  /** The text size the layout follows; the phone's own (rounded) when absent. Only the internal gallery sets it. */
  textScale?: number;
}) {
  const [ownCompare, setOwnCompare] = useState(false);
  const compare = comparison ?? ownCompare;
  const setCompare = (value: boolean) => { if (onComparison) onComparison(value); else setOwnCompare(value); };
  const [ownSort, setOwnSort] = useState<CandidateSort>('ARRIVAL');
  const [sorting, setSorting] = useState(false);
  // Reading the applications again is a pull on the list, not a button under it: the screen shows its own loading state while it reads.
  const pull = usePullRefresh(refresh, refreshing);
  // Read a page at a time, the number of applications is the server's, and how many of them can still be chosen is only known once every one is loaded.
  // Server completion alone is insufficient: a later cursor may end early
  // after concurrent edits. Never label a partial set "cheapest/best" or sort it.
  // Recheck the authoritative first-page count against every unique loaded row.
  const known = !refreshing && (!paging || (paging.total !== null && !paging.hasMore
    && !paging.loadingMore && !paging.moreError && paging.total === candidates.length));
  const incompleteFinal = !!paging && !paging.hasMore && !paging.loadingMore &&
    (paging.total === null || paging.total !== candidates.length);
  // The lowest price and the best rating are orders of the WHOLE list: the server sorts only by arrival, so while a page is still to come the list is
  // not ordered by price or rating at all and the control is not drawn (the approved draft R4: only when the list is whole). Arrival is the server's own order.
  const sort: CandidateSort = known ? chosenSort ?? ownSort : 'ARRIVAL';
  const visiblePrices = candidates.map(comparablePrice);
  const priceUnitsMixed = incomparablePrices(visiblePrices);
  const priceUnitUnknown = visiblePrices.some(price => price === null);
  const hourlyOnly = visiblePrices.some(p => p?.unit === 'HOURLY_PER_PERSON_HOUR') && !priceUnitsMixed;
  // The comparison has to know how much room there is (two columns of at least 200 dp), so it reads the width through the one hook that may; the
  // kind of room (the owner's large text, a window under 340 dp) is the layout class. A gallery that gives its own text size decides by it.
  const room = useWindowRoom();
  const { cls } = useLayoutClass();
  const large = forcedScale !== undefined ? forcedScale >= LARGE_TEXT_SCALE : cls === 'large', narrow = cls === 'narrow';
  // Two columns share the list's width less its side padding and the gap between them.
  const availableColumnWidth = Math.floor((room.width - 2 * layout.gutter - sys.space.md) / 2);
  const columns = compare && !large && availableColumnWidth >= 200 ? 2 : 1;
  const columnWidth = columns === 2 ? availableColumnWidth : null;
  // A new offer arriving is the news this screen exists to carry, so it is the one thing that moves.
  // The list that was already there settles silently, and switching to the comparison and back is
  // not an arrival either — `seen` belongs to this component, not to the FlatList it remounts.
  const appear = useAppear();
  appear.settle(candidates.map(candidateKey));
  // The route's `open` is a fresh closure every render (its guards read the latest read); the rows
  // get one function that never changes. `useAppear` is read through a ref for the same reason.
  const appearRef = useRef(appear); appearRef.current = appear;
  const openRef = useRef(open); openRef.current = open;
  const openCandidate = useCallback((k: KandidatProjekcija) => openRef.current(k), []);
  // PKG-035: the list keeps every application, historical ones included; the ones that can still be
  // chosen are a different number and are named as such, never mixed into the total.
  // What the whole list says by comparing ("Najniža cena"): nothing until every application has been read, then one mark at most per card.
  const measures = useMemo(() => candidateMeasures(candidates, known), [candidates, known]);
  const renderItem = useCallback(({ item: k, index }: ListRenderItemInfo<KandidatProjekcija>) =>
    <CandidateItem candidate={k} need={need} index={index} animate={appearRef.current.isNew(candidateKey(k))} compare={compare} columnWidth={columnWidth}
      large={large} narrow={narrow} open={openCandidate} photo={photo} viewed={viewed?.has(candidateKey(k)) ?? false} measure={measures.get(candidateKey(k)) ?? null} disabled={refreshing} />,
  [need, compare, columnWidth, large, narrow, openCandidate, photo, viewed, measures, refreshing]);
  // Ordering only rearranges the row objects already read; a memoised row redraws only if its place changed.
  const rows = useMemo(() => sortCandidates(candidates, sort), [candidates, sort]);
  const choose = (value: CandidateSort) => { setSorting(false); if (onSort) onSort(value); else setOwnSort(value); };
  const selectable = candidates.filter(k => k.stanje === 'SELECTABLE' && k.mozeIzabrati === true).length;
  const counts = `${prijava(known ? candidates.length : paging?.total ?? candidates.length)}${known && selectable !== candidates.length ? ` · ${selectable} za izbor` : ''}`;
  return <SafeAreaView edges={['top', 'bottom']} style={s.screen}>
    <ProductHeader backLabel={compare ? 'Nazad na prijave' : 'Nazad na zadatak'} title={compare ? 'Uporedite prijave' : 'Prijave'} back={compare ? () => setCompare(false) : back}
      right={candidates.length > 1 ? <V2Action label={compare ? 'Prikažite listu' : 'Uporedite'} kind="quiet" compact onPress={() => setCompare(!compare)} /> : undefined} />
    <View style={s.grow}>
      <FlatList key={`${compare ? 'comparison' : 'offers'}:${columns}`} numColumns={columns} data={rows} keyExtractor={candidateKey} initialNumToRender={8} maxToRenderPerBatch={8} windowSize={7}
        refreshing={pull.refreshing} onRefresh={pull.onRefresh}
        contentContainerStyle={s.content} ItemSeparatorComponent={CandidateSeparator} columnWrapperStyle={columns > 1 ? s.columnRow : undefined}
        ListHeaderComponent={<View style={s.listHeader}>
          <TaskBrief need={need} open={openTask} />
          {refreshing ? <T accessibilityLiveRegion="polite" variant="note" tone="muted">Osvežavamo prijave… Izbor je dostupan kada proverimo trenutna stanja.</T> : null}
          {targetNotice ? <Surface kind="note" tone="warn"><T accessibilityRole="alert" variant="body">{targetNotice}</T></Surface> : null}
          {candidates.length ? <View style={s.toolbar}>
            <T variant="note" tone="muted" style={s.counts}>{counts}</T>
            {candidates.length > 1 && known ? <Press accessibilityRole="button" accessibilityLabel={`Redosled prijava: ${SORT_LABEL[sort]}`}
              accessibilityHint="Otvara izbor redosleda" accessibilityState={{ expanded: sorting }} haptic="select"
              onPress={() => setSorting(true)} style={s.sortButton}>
              <T variant="copy" tone="green" style={s.sortText}>{SORT_LABEL[sort]}</T><Glyph name="caret-down" size={16} tone="green" />
            </Press> : null}</View> : null}
          {known && sort === 'PRICE' ? <T variant="note" tone="muted">
            {priceUnitUnknown ? 'Za neke prijave iznos ili osnovica cene nisu potvrđeni; prikazan je redosled prijava.'
              : priceUnitsMixed ? 'Cene sa različitim jedinicama nisu uporedive; prikazan je redosled prijava.'
              : hourlyOnly ? 'Poređenje je po osobi po satu; iznos na kartici je satnica.'
              : 'Poređenje je po osobi; iznos na kartici ostaje ukupna ponuda.'}
          </T> : null}
          {incompleteFinal ? <Surface kind="note" tone="warn">
            <T variant="note" tone="muted">Broj prijava ne odgovara učitanom spisku. Proverite prijave ponovo pre poređenja ili izbora najniže cene.</T>
            <V2Action label="Proverite prijave ponovo" kind="quiet" compact disabled={refreshing} onPress={refresh} />
          </Surface> : null}
          {!known && compare ? <View accessibilityLiveRegion="polite" style={s.notes}>
            <T variant="note" tone="muted">Poredite učitane prijave. Još nisu prikazane sve prijave.</T>
            {paging?.moreError ? <V2Action label="Učitajte preostale prijave" kind="quiet" compact onPress={paging.onLoadMore} />
              : paging?.loadingMore ? <T variant="meta" tone="muted">Učitavamo preostale…</T> : null}
          </View> : null}
        </View>}
        // The empty list is an object and one sentence: no promise of what will happen, and no button (the list is read again by pulling it).
        ListEmptyComponent={<StateView kind="empty" art="applications" title="Još nema prijava" />}
        renderItem={renderItem}
        onEndReached={!refreshing && paging && paging.hasMore && !paging.loadingMore && !paging.moreError ? paging.onLoadMore : undefined} onEndReachedThreshold={0.6}
        ListFooterComponent={candidates.length ? <View style={s.listFooter}>
          {!refreshing && paging && (paging.hasMore || paging.loadingMore || paging.moreError) ? <View style={s.pagingFoot}>
            {paging.moreError ? <>
              <T variant="note" tone="muted">Ne možemo da učitamo ostale prijave.</T>
              <V2Action label="Pokušajte ponovo" kind="quiet" onPress={paging.onLoadMore} />
            </> : paging.loadingMore ? <T variant="note" tone="muted">Učitavamo još prijava…</T>
              : <V2Action label="Prikažite još" kind="quiet" onPress={paging.onLoadMore} />}</View> : null}
        </View> : null} />
    </View>
    {sorting && candidates.length > 1 && known ? <ProductSheet title="Redosled prijava" closeLabel="Zatvorite izbor redosleda" onClose={() => setSorting(false)}>
      {dismiss => <View accessibilityRole="radiogroup" style={s.sortOptions}>
        {SORTS.map(option => <ChoiceRow key={option} kind="radio" label={SORT_LABEL[option]} checked={sort === option} onPress={() => { choose(option); dismiss(); }} />)}
      </View>}
    </ProductSheet> : null}
  </SafeAreaView>;
}
function SelectedAgreementAction({ load, open }: { load: () => Promise<Ishod<{ dogovorId: string | null }>>; open: (id: string) => void }) {
  const [state, setState] = useState<{ loading: boolean; id: string | null }>({ loading: true, id: null });
  const request = useRef(0);
  const read = async () => {
    const generation = ++request.current;
    setState({ loading: true, id: null });
    try {
      const result = await load();
      if (request.current === generation) setState({ loading: false, id: result.ok ? result.podatak.dogovorId : null });
    } catch { if (request.current === generation) setState({ loading: false, id: null }); }
  };
  useEffect(() => { void read(); return () => { request.current++; }; }, [load]);
  if (state.id) return <BrandAction label="Otvorite Dogovor" onPress={() => { if (state.id) open(state.id); }} />;
  return <><T variant="meta" tone="muted" style={s.center}>{state.loading ? 'Proveravamo Dogovor uz ovu prijavu…' : 'Veza sa Dogovorom trenutno nije dostupna.'}</T>
    <V2Action label="Proverite Dogovor" onPress={() => { if (!state.loading) void read(); }} loading={state.loading} /></>;
}

/** The words that stand before the one choice that forms the Dogovor, while it is retried; the question itself is `CHOICE_QUESTION`. */
const CHOICE_TITLE = 'Kada izaberete prijavu, nastaje Dogovor.';
/** The question the dialog asks: a verb with a question mark, and under it what is accepted and what follows (plan 2.3). */
const CHOICE_QUESTION = 'Izabrati ovog kandidata?';
/** What is accepted: the price, the people and the term that applies (the person's proposal, or else the task's own), then what follows. */
const choiceTerms = (candidate: KandidatProjekcija, term: string) => {
  const price = candidateValue(candidate);
  return `Prihvatate: ${price.kind === 'amount' ? `${price.amount} ${price.basis}` : UNPRICED} · ${osoba(candidate.pokrivaMesta)} · ${term}. Dogovor odmah važi za obe strane.`;
};
const CHOICE_NOTE = 'Pri izboru proveravamo da li izabrana osoba i dalje ima slobodan termin.';
/** The one name of the choice: the green button of the application and the confirm of the question it asks. */
const CHOOSE_LABEL = 'Izaberite kandidata';

/**
 * One application in full, as a sheet over the list (owner's step 7, 2026-09-24; it was a page of its own with a review page
 * behind it; sections instead of bands since 2026-10-08, spec 4.7). The person leads — their name as the sheet's title, then their
 * picture and rating, which open their public profile — then the state (the same chip as the card), then the offer as a short section
 * of terms (the total and whom it is for, the time, what they have) and their whole message as another. Space is the only divider
 * between the sections; the terms are rows of one kind and stand on the system's inset lines.
 *
 * The sheet's pinned footer holds the ONE green action. "Izaberi osobu" asks first, in a centred dialog that says what
 * is accepted (price, people, term) and what follows; only its confirm runs the route's `choose`, which keeps every guard it
 * had (the read revision and account, the offer's own version and hash, the selectable classifier, one idempotent
 * command). A retained confirmation is retired the moment the offer it asked about changes. After a choice the footer
 * carries its outcome: a check of an unknown outcome, or the same command again; and once the Dogovor is made the sheet gives way to the
 * moment "Dogovoreno!" (`DogovorenoMoment`), whose one green action is this sheet's `Otvori Dogovor`.
 *
 * Closing the sheet is the screen's Back: it returns to the list, or, once a choice was made, leaves as Back always did.
 * Nothing closes it while the choice runs.
 */
export function CandidateSelectionPresentation({ need, candidate, back, chooseNext, publicProfile, publicTrust, choose, busy, pending, uncertain, refresh, error, confirmed, confirmedStatus, openAgreement, reset, readAgreement, openLinkedAgreement, publicPhoto, safety, photo, ownFace, themFace, viewed = false }: {
  need: PotrebaProjekcija; candidate: KandidatProjekcija; back: () => void;
  /** In multi-worker tasks: return to the candidate list to select the next helper. */
  chooseNext?: () => void;
  publicProfile: () => Promise<JavniProfilProjekcija | null>;
  /** The server confirmed that this application was seen (it was opened on this phone): the chip says "Viđena" instead of "Poslata". */
  viewed?: boolean;
  /** The route's one choice. A returned promise keeps the confirmation busy until the command settles. */
  choose: () => void | Promise<unknown>;
  busy: boolean; pending: boolean; uncertain: boolean; refresh: () => void; error: string | null; confirmed: boolean;
  /** Present only after exact readback; it may describe a now-terminal cooperation. */
  confirmedStatus?: SelectionAgreementStatus;
  openAgreement: () => void; reset?: () => void;
  readAgreement: () => Promise<Ishod<{ dogovorId: string | null }>>; openLinkedAgreement: (id: string) => void;
  publicPhoto?: (profileId: string, size?: number) => ReactNode;
  /**
   * The trust block of this person's profile, as the SERVER answers it for this viewer (`rpc_public_work_trust_v1`; PROFILE-TRUST, R24): read
   * when the person's public profile is opened, and drawn by the profile sheet only if the server lets this viewer have it ("Dolazi kako je
   * dogovoreno N%"; for a visitor it is hidden until the owner switches it on, and then nothing is drawn, no placeholder either). It never
   * delays the profile or fails it: an answer that does not come is no answer.
   */
  publicTrust?: (profileId: string) => Promise<PublicWorkTrust | null>;
  /** PKG-047 (F05): report or block this candidate from their own public profile. */
  safety?: SafetyEntry;
  /** The person's picture at the head of the offer (56); the Avatar with their letters when absent. */
  photo?: ReactNode;
  /** YOUR face at 72, for the moment "Dogovoreno!" (the screen reads it from your own profile); the drawn person when absent. */
  ownFace?: ReactNode;
  /** The chosen person's face at 72, for the same moment: their photo, or their letters when there is none. Absent: their public portrait at 72 (`publicPhoto`), then their letters. */
  themFace?: ReactNode;
}) {
  const [profile, setProfile] = useState<PublicProfileState>(null);
  const [trust, setTrust] = useState<PublicWorkTrust | null>(null);
  const confirmedAtMount = useRef(confirmed).current;
  const profileRequest = useRef(0);
  useEffect(() => () => { profileRequest.current++; }, []);
  const closeProfile = () => { profileRequest.current++; setProfile(null); setTrust(null); };
  const openProfile = async () => {
    if (profile?.loading) return;
    const request = ++profileRequest.current;
    setProfile({ loading: true, data: null }); setTrust(null);
    try {
      const value = await publicProfile();
      if (request !== profileRequest.current) return;
      const mine = value?.profilId === candidate.radnikProfilId ? value : null;
      setProfile({ loading: false, data: mine });
      // The trust block is read after the profile, for that profile only, and is optional: whatever happens to it, the profile stays as it is.
      if (mine && publicTrust) {
        void Promise.resolve().then(() => publicTrust(candidate.radnikProfilId)).then(answer => { if (request === profileRequest.current) setTrust(answer); }, () => {});
      }
    } catch { if (request === profileRequest.current) setProfile({ loading: false, data: null }); }
  };
  const confirmation = useConfirmSheet(), retireConfirmation = confirmation.close;
  // A question asked about one exact offer is not an answer about a changed one.
  const offerKey = [need.id, need.revizija, candidate.prijavaId, candidate.verzija, candidate.hash, candidate.stanje, candidate.mozeIzabrati].join(':');
  useEffect(() => { retireConfirmation(); }, [offerKey, retireConfirmation]);
  const value = candidateValue(candidate), time = candidateTime(candidate, need.taskTimezone), reason = candidateStatus(candidate), has = candidateHas(candidate);
  // The term that applies if this application is chosen: the person's own proposal, or else the task's.
  const term = time ?? need.vremeTekst;
  const askToChoose = () => {
    if (!candidate.mozeIzabrati || busy || pending || confirmed) return;
    // The confirm says the words of the button that asked (review r4 rk item 5): one command, one name.
    confirmation.ask({ title: CHOICE_QUESTION, message: `${choiceTerms(candidate, term)} ${CHOICE_NOTE}`, confirmLabel: CHOOSE_LABEL,
      onConfirm: () => choose() });
  };
  const message = candidate.napomena?.trim() ?? '';
  const selected = candidate.stanje === 'SELECTED' && !pending;
  // An offer that cannot be chosen has no green action; the note says so and carries the one thing to do about it.
  const blocked = !candidate.mozeIzabrati && !pending && !confirmed && !selected;
  const primary = confirmed ? <BrandAction label="Otvorite Dogovor" onPress={openAgreement} />
    : selected ? <SelectedAgreementAction load={readAgreement} open={openLinkedAgreement} />
    : busy ? <BrandAction label="Povezivanje…" onPress={() => { void choose(); }} disabled loading />
    : uncertain ? <BrandAction label="Proverite da li je izabrano" onPress={refresh} disabled={busy} />
    : reset ? <BrandAction label="Pregledajte prijave" onPress={reset} />
    : pending ? <BrandAction label="Pošaljite izbor ponovo" onPress={() => { void choose(); }} />
    : candidate.mozeIzabrati ? <BrandAction label={CHOOSE_LABEL} onPress={askToChoose} />
    : null;
  const quiet = pending && !confirmed && !uncertain && !reset
    ? <V2Action label="Proverite ponovo" kind="quiet" onPress={refresh} disabled={busy} /> : null;
  const priceWords = value.kind === 'amount' ? value.amount : UNPRICED;
  if (confirmed && confirmedStatus) {
    const statusCopy: Record<SelectionAgreementStatus, string> = {
      CONFIRMED: 'Dogovor je pronađen. Otvorite ga da vidite aktuelne uslove saradnje.',
      CANCELLED: 'Izbor je bio sačuvan, a saradnja je u međuvremenu otkazana. Otvorite Dogovor za detalje.',
      COMPLETED: 'Izbor je bio sačuvan, a saradnja je u međuvremenu završena. Otvorite Dogovor za detalje.',
      SUPERSEDED: 'Izbor je bio sačuvan. Ovaj Dogovor više nije aktuelan; otvorite ga da vidite detalje.',
    };
    return <ProductSheet title="Izbor je sačuvan" onClose={back} closeLabel="Nazad na zadatak" footer={() => primary}>
      {() => <View style={s.offerContent}><T variant="heading">{readableTitle(need.naslov)}</T>
        <T variant="body" accessibilityRole="alert">{statusCopy[confirmedStatus]}</T></View>}
    </ProductSheet>;
  }
  // "Dogovoreno!" (owner's pick of 2026-10-08, "Susret dva lica"): once the Dogovor is made the offer is not what the person needs to see, so
  // the sheet gives way to the moment, a whole screen with two faces, the task's title, the word, three rows and the one green way on, which
  // is this sheet's own `Otvori Dogovor` with every guard it had. Fresh only when the choice was confirmed while this sheet was open: reopened
  // on an outcome that was already confirmed (back from the profile's safety screen) it is the last frame at once, and nothing ticks.
  if (confirmed) {
    const remainingSlots = Math.max(0, (need.pokrivenost?.preostalo ?? 0) - (candidate?.pokrivaMesta ?? 1));
    const secondaryAction = chooseNext && remainingSlots > 0 ? (
      <V2Action
        label={`Izaberite sledećeg pomoćnika (još ${remainingSlots} ${remainingSlots === 1 ? 'mesto' : 'mesta'})`}
        kind="quiet"
        onPress={chooseNext}
      />
    ) : undefined;
    return <DogovorenoMoment fresh={!confirmedAtMount} onBack={back} action={primary}
      secondaryAction={secondaryAction}
      // Both faces are handed in by the screen, from the sources the app already has (your own profile, the candidate's public portrait); without
      // one, yours is the drawn person and theirs their letters, never letters that belong to nobody.
      youFace={ownFace ?? <Avatar initials={null} size={72} />}
      themFace={themFace ?? (publicPhoto ? publicPhoto(candidate.radnikProfilId, 72) : <Avatar initials={candidate.inicijali || null} size={72} />)}
      // A candidate whose name the read could not give has no letters: the pair is just "vas dvoje", never "Ti i Ime nije dostupno".
      people={candidate.inicijali ? `Vi i ${candidate.ime}` : 'Vas dvoje'} taskTitle={readableTitle(need.naslov)} term={term}
      amount={value.kind === 'amount' ? `${value.amount} ${value.basis}` : UNPRICED} />;
  }
  // The person's name is the sheet's title (review r4 rk item 3): a real heading for a screen reader, and the sheet's own
  // visible × beside it, which a sighted person on iOS had no way to find before (only the handle, a tap outside and
  // Android Back closed it). The row under it keeps the picture and the rating, and opens the public profile.
  return <ProductSheet title={candidate.ime} closeLabel={pending ? 'Nazad na zadatak' : 'Zatvorite prijavu'}
    backdropHint={pending ? 'Vraća na zadatak.' : 'Zatvara prijavu i vraća na prijave.'} dismissible={!busy} onClose={back}
    footer={primary || quiet ? () => <>{primary}{quiet}</> : undefined}>
    {() => <View style={s.offerContent}>
      <View style={s.notes}>
        <T variant="note" tone="muted">Prijava za zadatak</T>
        <T variant="heading" accessibilityRole="header">{readableTitle(need.naslov)}</T>
        <TaskCapacity capacity={need.pokrivenost} />
      </View>
      <CandidatePerson candidate={candidate} photo={photo} onPress={() => { void openProfile(); }} disabled={busy} />
      {/* The same state as the card, always: the chip (the sheet is where a person decides, so it says where the application stands),
          the reason beside it when it is not simply open, and the one thing to do when it cannot be chosen now. */}
      <View style={s.state}>
        <PrijavaState status={candidateChip(candidate, viewed)} reason={!reason ? null : { text: reason.text, tone: reason.tone }} />
        {blocked ? <V2Action label="Osvežite prijave" kind="quiet" compact onPress={refresh} disabled={busy} style={s.noteAction} /> : null}
      </View>
      {value.kind === 'amount'
        ? <MoneySummary label={candidate.osnovaCene === 'HOURLY' ? 'Satnica po osobi' : candidate.osnovaCene === 'TOTAL' ? 'Ukupna ponuda' : 'Ponuđeni iznos'} amount={priceWords}
          basis={candidate.osnovaCene === 'HOURLY'
            ? (candidate.pokrivaMesta > 1 && Number.isSafeInteger(candidate.cena?.iznos)
                ? `Po osobi po satu (${candidate.pokrivaMesta} pomagača × ${priceWords} = ${novac(candidate.pokrivaMesta * candidate.cena.iznos)}/h ukupno)`
                : 'Po osobi po satu')
            : candidate.osnovaCene === 'TOTAL' ? `Ukupno za ${osobuAkuz(candidate.pokrivaMesta)}` : 'Osnovica cene nije potvrđena'} />
        : <FactRow art="money" size="detail" label="Ukupna ponuda" value={priceWords} />}
      <Surface kind="panel" variant="tinted" tone="wash" density="comfortable" style={s.offerFacts}>
        <FactRow art="users" size="detail" label="Dolazi" value={osoba(candidate.pokrivaMesta)} />
        <FactRow art="calendar" size="detail" label={time ? 'Predloženi termin' : 'Termin zadatka'} value={term} />
        {has ? <FactRow art={has.art} size="detail" label="Ima" value={has.text.replace(/^Ima: /, '')} /> : null}
      </Surface>
      {message ? <Section title="Poruka"><T selectable variant="body">{candidate.napomena}</T></Section> : null}
      {/* No "Sposobnosti" here (owner decision 2026-09-24): the applicant's self-declared skills are not shown to the task
          owner as labels; the vehicle and the tools they have are (owner, 2026-10-07), and what the applicant wants to say is in the
          message above. */}
      {pending && !confirmed ? <Surface kind="note" tone="warn"><T accessibilityRole="alert" variant="heading">{CHOICE_TITLE}</T>
        <T variant="body">{choiceTerms(candidate, term)}</T><T variant="meta" tone="muted">{CHOICE_NOTE}</T></Surface> : null}
      <ErrorMessage error={error} />
      {confirmation.sheet}
      <PublicProfileSheet state={profile} onClose={closeProfile} onRetry={() => { void openProfile(); }} photo={publicPhoto} safety={safety} trust={trust} />
    </View>}
  </ProductSheet>;
}
const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: sys.color.surface }, grow: { flex: 1, minWidth: 0 },
  center: { textAlign: 'center' },
  // The list: the edge, the Task and the line that counts and orders, then the cards 12 apart, 32 under the last thing.
  content: { paddingHorizontal: layout.gutter, paddingTop: sys.space.sm, paddingBottom: layout.zone },
  listHeader: { gap: sys.space.sm, marginBottom: sys.space.sm },
  // The line that says how many there are is as high as the control that orders them (48 dp), and the control is the end of it.
  toolbar: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: sys.space.md, minHeight: layout.touch },
  counts: { flexGrow: 1, flexShrink: 1 },
  sortButton: { minHeight: layout.touch, flexShrink: 1, flexDirection: 'row', alignItems: 'center', gap: sys.space.xs },
  sortText: { flexShrink: 1, fontWeight: '600' },
  sortOptions: { gap: sys.space.xs },
  notes: { gap: sys.space.xs },
  separator: { height: layout.group },
  columnRow: { gap: sys.space.md },
  listFooter: { gap: sys.space.xs, paddingTop: sys.space.md },
  pagingFoot: { alignItems: 'center', gap: sys.space.sm, paddingBottom: sys.space.xs },
  // Keep identity, total, facts and the full message distinct within the existing sheet.
  offerContent: { gap: layout.section },
  offerFacts: { gap: sys.space.lg },
  taskBrief: { gap: sys.space.sm },
  state: { gap: sys.space.sm },
  noteAction: { alignSelf: 'flex-start', paddingHorizontal: 0 },
});
