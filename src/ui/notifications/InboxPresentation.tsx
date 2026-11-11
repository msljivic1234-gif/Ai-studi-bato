import { memo, useCallback, useEffect, useMemo, useRef } from 'react';
import { AccessibilityInfo, ActivityIndicator, FlatList, StyleSheet, View } from 'react-native';
import type { InboxItem, InboxRole } from '../../contracts/inbox';
import type { InboxState } from '../../data/inboxModel';
import { trenutak, type Trenutak } from '../../lib/trenutak';
import { Press } from '../Press';
import { T } from '../Text';
import { V2Action } from '../v2/V2Action';
import { Appear, useAppear } from '../system/Appear';
import { FactArt, type FactArtKind } from '../system/FactArt';
import { Glyph } from '../system/Glyph';
import { ConversationArt } from '../system/ConversationArt';
import { layout } from '../system/layout';
import { neprocitanih } from '../system/plural';
import { Segmented } from '../system/Segmented';
import { StateView } from '../system/StateView';
import { Surface } from '../system/Surface';
import { sys } from '../system/tokens';
import { usePullRefresh } from '../system/usePullRefresh';
import { INBOX_SET_LABEL, canMarkRead, inboxActionLabel, inboxDestination, inboxTaskTitle, readableServerCopy } from './inboxCopy';
import { NotificationLoading } from './NotificationLoading';
import { SwipeToRead, type SwipeableRowHandle } from './SwipeToRead';
import { TimedRow } from './TimedRow';

/**
 * Chronological events, grouped by the server moment, on the one rhythm of the app (UI/UX pass, 2026-10-08, composition spec 4.13):
 * the edge is 20, a day is a group heading (16/24, grey) with 24 above it and 12 under it, and "Označi sve" is the action at the end of
 * the first day's heading, not a row of its own. An event is a `TimedRow`: the picture (32, in a 40 slot) with the unread dot on it, the
 * event and clock, task context below, then a quiet cue for a known destination. The whole row remains one target.
 * Each event now sits on its own white card, matching the reviewed notification composition while the existing read and target
 * behavior stays on the row's single press.
 *
 * The route/model still own read acknowledgment, target resolution and exact navigation. An event has no actor/avatar contract: none is
 * invented here. An unread row is the one with the dot (and its picture in colour); a pull to the left shows "Pročitano", which settles
 * that one notification without opening it (T4a, 2026-10-07).
 */
export type InboxView = Pick<InboxState, 'page' | 'loading' | 'paging' | 'acting' | 'error' | 'unavailable'>;

/** The three sets, in the owner's words: the same names the notification settings give their two sets. */
export const INBOX_FILTERS: { label: string; role: InboxRole | null }[] = [
  { label: INBOX_SET_LABEL.ALL, role: null }, { label: INBOX_SET_LABEL.REQUESTER, role: 'REQUESTER' }, { label: INBOX_SET_LABEL.WORKER, role: 'WORKER' },
];

/** The command of the swipe, in its own word and for a screen reader. */
export const MARK_READ_LABEL = 'Pročitano';
const MARK_READ_HINT = 'Označava obaveštenje kao pročitano.';
/** "Označi sve", the word at the end of the first day's heading; the screen reader says the whole of it, and how many that is. */
const READ_ALL_LABEL = 'Označi sve';
const readAllSpoken = (unread: number) => `Označi sve kao pročitano, ${neprocitanih(unread)}`;
/** The same command, in the actions menu of a screen reader (a swipe is never the only way). */
const MARK_READ_ACTION = 'markRead';
const MARK_READ_ACTIONS = [{ name: MARK_READ_ACTION, label: 'Označi kao pročitano' }];

const EMPTY_TITLE: Record<'ALL' | InboxRole, string> = {
  ALL: 'Još nema obaveštenja',
  REQUESTER: 'Još nema obaveštenja o Vašim zadacima',
  WORKER: 'Još nema obaveštenja o Vašim prijavama',
};
const AGAIN = 'Proverite vezu i pokušajte ponovo. Do tada vidite poslednja učitana obaveštenja.';

type DayRow = { kind: 'day'; id: string; label: string; first: boolean };
type EventRow = { kind: 'event'; id: string; item: InboxItem; moment: Trenutak | null; last: boolean };
export type InboxRowModel = DayRow | EventRow;

/**
 * The list's rows in the server's order: a day header before the first event of each civil day, then that day's
 * events. Every row carries `id` (the event's own id, or `day:` and the day). An event without a readable moment joins
 * the day before it and gets no header of its own: no day is made up for it.
 */
export function inboxRows(items: readonly InboxItem[], options: { zona?: string; sada?: Date } = {}): InboxRowModel[] {
  const rows: InboxRowModel[] = [];
  let day: string | null = null, previous: EventRow | null = null;
  for (const item of items) {
    const moment = trenutak(item.occurredAt, options);
    if (moment && moment.kljuc !== day) {
      if (previous) previous.last = true;
      day = moment.kljuc;
      rows.push({ kind: 'day', id: `day:${moment.kljuc}`, label: moment.dan, first: rows.length === 0 });
    }
    previous = { kind: 'event', id: item.id, item, moment, last: false };
    rows.push(previous);
  }
  if (previous) previous.last = true;
  return rows;
}

/**
 * What each event is drawn with: the event type decides first, the family after it. The server sends six families
 * (opportunities, responses, dogovor, execution, recovery, account); two of them hide more than one thing — 'dogovor'
 * carries a message and a review beside the Agreement itself, 'responses' carries a task's change, its cancellation and
 * a question beside the offers — so a message is a speech bubble and a cancelled task is the task, whatever family the
 * server files it under.
 */
export function inboxEventArt(eventType: string, family: string): FactArtKind {
  switch (eventType) {
    case 'MESSAGE_RECEIVED': case 'CLARIFICATION_CREATED': case 'CLARIFICATION_ANSWERED': return 'chat';
    case 'REVIEW_RECEIVED': return 'star';
    case 'PRIVATE_ACCESS_GRANTED': return 'lock';
    case 'OPPORTUNITY_AVAILABLE': case 'NEED_REVISED': case 'NEED_CANCELLED': return 'tasks';
    case 'COMPLETION_REQUIRED': return 'check';
  }
  return family === 'responses' ? 'applications' : family === 'dogovor' ? 'agreements' : family === 'execution' ? 'check'
    : family === 'recovery' ? 'shield' : family === 'opportunities' ? 'tasks' : 'bell';
}

/**
 * Lead and second line of a row. A new task for you leads with the task itself (the data has it: its own title is the body). For
 * every other event the event leads, and the second line is its words — or the TASK, when the read says which one (R11): "Nova
 * prijava" over "Montaža police u hodniku" says more than "Imaš novu prijavu za zadatak." says. The server's stored words have a
 * capital in the middle of a sentence in three places ("za Zadatak"); they are shown as the sentence they are.
 */
function rowCopy(item: InboxItem): { primary: string; secondary: string } {
  if (item.eventType === 'OPPORTUNITY_AVAILABLE' && item.body.trim()) return { primary: item.body, secondary: item.title };
  const task = inboxTaskTitle(item);
  return { primary: readableServerCopy(item.title), secondary: task ?? readableServerCopy(item.body) };
}

type RowProps = { item: InboxItem; moment: Trenutak | null; last: boolean; acting: boolean;
  /** Another command is running: the revealed swipe command waits. */ busy: boolean;
  onOpen: (item: InboxItem) => void;
  /** Settles this one notification without opening it. Absent: the row cannot be swiped. */ onMarkRead?: (item: InboxItem) => void;
  /** A swiped row opened: the list closes the one that was open before. */ onSwipeOpen?: (row: SwipeableRowHandle) => void };

function InboxRowBase({ item, moment, last, acting, busy, onOpen, onMarkRead, onSwipeOpen }: RowProps) {
  const unread = !item.readAt;
  const art = inboxEventArt(item.eventType, item.family);
  const { primary, secondary } = rowCopy(item);
  const when = moment ? `. ${moment.dan}, ${moment.sat}` : '';
  const where = inboxDestination(item);
  const actionLabel = inboxActionLabel(item);
  const markable = canMarkRead(item, !!onMarkRead);
  // One picture, 32: the event's own, a spinner while this row is being opened, and the unread dot on its corner (the dot shares the
  // picture's footprint instead of taking a gutter of its own). The picture keeps its colour once the row is read: what is read is said
  // by the dot that goes and the weight of the name, never by a grey picture (the owner's phone: "siva ikona razgovora").
  const leading = <View accessible={false} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden style={s.art}>
    {acting ? <ActivityIndicator size="small" color={sys.color.green} />
      : art === 'chat' ? <ConversationArt size={32} /> : <FactArt kind={art} size={32} />}
    {unread ? <View testID="inbox-unread-dot" style={s.dot} /> : null}
  </View>;
  // The swipe is never the only way: a screen reader is offered the same command in the row's actions menu, for an unread row only.
  const menu = markable ? { accessibilityActions: MARK_READ_ACTIONS,
    onAccessibilityAction: (event: { nativeEvent: { actionName: string } }) => { if (event.nativeEvent.actionName === MARK_READ_ACTION) onMarkRead!(item); } } : {};
  const row = <TimedRow leading={leading} slot={layout.slot} title={primary} titleLines={2} strong={unread} time={moment?.sat} last={last} card disabled={acting}
    onPress={() => onOpen(item)} {...menu}
    accessibilityLabel={`${unread ? 'Nepročitano' : 'Pročitano'}. ${readableServerCopy(item.title)}. ${readableServerCopy(item.body)}${when}`}
    accessibilityHint={where ? `${where}.` : undefined}>
    {secondary ? <T variant="note" tone="muted" numberOfLines={2}>{secondary}</T> : null}
    {actionLabel ? <View testID="inbox-destination-cue" accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={s.destination}>
      <T variant="note" tone="green" style={s.destinationLabel}>{actionLabel}</T><Glyph name="arrow-right" size={16} tone="green" />
    </View> : null}
  </TimedRow>;
  // Decided when the row mounts and never switched (a stable handler is handed down): a row that is read keeps its element type
  // and slides back, instead of being rebuilt under the finger.
  return onMarkRead ? <SwipeToRead enabled={markable} label={MARK_READ_LABEL} hint={MARK_READ_HINT} busy={busy}
    onRead={() => onMarkRead(item)} onOpen={onSwipeOpen}>{row}</SwipeToRead> : row;
}
const InboxRow = memo(InboxRowBase);

/** The heading of a day. The first one may carry "Označi sve" at its end: a 48 dp touch, so the line is as high as the touch. */
function DayHeader({ label, first, readAll }: { label: string; first: boolean;
  readAll?: { unread: number; busy: boolean; disabled: boolean; onPress: () => void } }) {
  return <View style={[s.day, first ? s.dayFirst : s.dayLater]}>
    <T variant="bodyStrong" tone="muted" accessibilityRole="header" style={s.dayLabel}>{label}</T>
    {readAll ? <Press accessibilityRole="button" accessibilityLabel={readAllSpoken(readAll.unread)} accessibilityState={{ disabled: readAll.disabled, busy: readAll.busy }}
      disabled={readAll.disabled} haptic="select" scaleTo={sys.motion.scale.button} onPress={readAll.onPress} style={s.readAll}>
      {readAll.busy ? <ActivityIndicator size="small" color={sys.color.green} /> : null}
      <T variant="copy" tone="green" style={s.readAllText}>{READ_ALL_LABEL}</T>
    </Press> : null}
  </View>;
}

/**
 * One quiet notice at the top of the list: a flat tint, never an orange fill. Only an error offers a way forward, and its button says
 * what it does: after an unconfirmed action it reads the list again, it does not repeat the action.
 */
function Banner({ title, sentence, retry, retryLabel = 'Pokušaj ponovo', disabled }: {
  title: string; sentence: string; retry?: () => void; retryLabel?: string; disabled: boolean;
}) {
  return <Surface kind="note" style={s.banner}>
    <Glyph name="info" size={20} tone="muted" />
    <View style={s.bannerCopy}>
      <T variant="bodyStrong" accessibilityRole="alert">{title}</T>
      <T variant="note" tone="muted">{sentence}</T>
      {retry ? <V2Action kind="quiet" compact label={retryLabel} disabled={disabled} onPress={retry} style={s.inlineAction} /> : null}
    </View>
  </Surface>;
}

/** An event's moment in milliseconds, or null when it cannot be read (such an event is never treated as new). */
const occurredMs = (item: InboxItem): number | null => { const ms = Date.parse(item.occurredAt); return Number.isFinite(ms) ? ms : null; };

/**
 * Which events are arrivals. `useAppear` settles the first list it is given and animates every id it has not seen; an
 * older page ("Učitaj starija obaveštenja") is also made of ids it has not seen, and those did not arrive, they were
 * fetched. So an unseen event is an arrival only when it is newer than the newest one already on screen; every other
 * unseen event is marked seen here, before the rows ask, and stays still. Called once per render, before the rows.
 *
 * `list` names the list being shown (the filter). Another filter is another list, so its first page is what was there,
 * not news: the newest moment is forgotten, and every event of that filter's first page is then marked seen. The list
 * itself stays mounted across a filter switch (round 5c, 2026-09-24): remounting it threw away the tab a screen reader
 * had just pressed, and rebuilt every row and the header for nothing.
 */
function useArrivals(items: readonly InboxItem[], list: string) {
  const appear = useAppear();
  const newest = useRef<number | null>(null);
  const shown = useRef(list);
  if (shown.current !== list) { shown.current = list; newest.current = null; }
  appear.settle(items.map(item => item.id));
  const before = newest.current;
  for (const item of items) {
    const ms = occurredMs(item);
    if (ms === null || before === null || ms <= before) appear.isNew(item.id);
    if (ms !== null && (newest.current === null || ms > newest.current)) newest.current = ms;
  }
  return appear;
}

export function InboxList({ state, role, onRole, onOpen, onMarkRead, onReadAll, onRefresh, onMore, onSettings, zona, sada }: {
  state: InboxView; role: InboxRole | null; onRole: (role: InboxRole | null) => void;
  onOpen: (item: InboxItem) => void;
  /** Reads ONE notification without opening it (the swipe). Hand down a stable function; absent, the rows cannot be swiped. */
  onMarkRead?: (item: InboxItem) => void;
  onReadAll: () => void; onRefresh: () => void; onMore: () => void; onSettings: () => void;
  /** Fixed only by the gallery and tests; the phone's zone and "now" otherwise. */ zona?: string; sada?: Date;
}) {
  const { page, loading, paging, acting, error, unavailable } = state;
  const busy = loading || paging || !!acting;
  const items = page?.items;
  const rows = useMemo(() => inboxRows(items ?? [], { zona, sada }), [items, zona, sada]);
  // At most one row stays pulled open: when another opens, the earlier one slides back.
  const swiped = useRef<SwipeableRowHandle | null>(null);
  const onSwipeOpen = useCallback((row: SwipeableRowHandle) => {
    if (swiped.current && swiped.current !== row) swiped.current.close();
    swiped.current = row;
  }, []);
  // An event that arrives while the Inbox is open is worth a moment of motion; the ones that were there when it opened,
  // the ones a refresh returns unchanged and an older page are not. Only event rows take part, never a day header. Each
  // filter is its own list, so a filter's first page is what was there, too.
  const appear = useArrivals(items ?? [], role ?? 'ALL');
  const unreadCount = page?.unreadCount;
  useReadAllAnnouncement(unreadCount);
  // The pull spinner is for a pull only (a tab switched or a read of the screen's own used to raise it: the white dot of 8 Oct 2026).
  const pull = usePullRefresh(onRefresh, loading);

  const banner = unavailable ? <Banner title="Sadržaj više nije dostupan." sentence="Možda je uklonjen ili mu više nemate pristup." disabled={busy} />
    : error === 'action' ? <Banner title="Ne znamo da li je radnja uspela." sentence={AGAIN} retry={onRefresh} retryLabel="Osvežite obaveštenja" disabled={busy} />
      : error === 'load' && page ? <Banner title="Obaveštenja nisu osvežena." sentence={AGAIN} retry={onRefresh} disabled={busy} /> : null;

  // "Označi sve" stands at the end of the heading of the first day. A list whose first row is not a day (an event that has no readable
  // moment) has no heading to carry it, and then it stands alone above the rows, so it is never missing while something is unread.
  const hasUnread = !!page && page.unreadCount > 0;
  const readAll = hasUnread ? { unread: page.unreadCount, busy: acting === 'all', disabled: busy, onPress: onReadAll } : undefined;
  const firstIsDay = rows[0]?.kind === 'day';

  const header = <View style={s.header}>
    <Segmented appearance="underline" value={role ?? 'ALL'} onChange={key => onRole(key === 'ALL' ? null : key as InboxRole)}
      options={INBOX_FILTERS.map(filter => ({ key: filter.role ?? 'ALL', label: filter.label }))} />
    {loading && page ? <View accessibilityLiveRegion="polite" style={s.refreshing}>
      <ActivityIndicator size="small" color={sys.color.green} />
      <T variant="note" tone="muted">Proveravamo nova obaveštenja…</T>
    </View> : null}
    {banner}
    {readAll && !firstIsDay && rows.length > 0 ? <DayHeader label="Obaveštenja" first readAll={readAll} /> : null}
  </View>;

  const empty = !page && (loading || !error)
    ? <NotificationLoading label="Učitavamo obaveštenja…" />
    : !page ? <StateView kind="error" title="Obaveštenja nisu učitana" body="Proverite vezu i pokušajte ponovo da učitate obaveštenja."
        primary={{ label: 'Pokušajte ponovo', onPress: onRefresh, disabled: busy }} />
      // A failed refresh has no current empty result to claim. Keep the last confirmed empty page and date its meaning.
      : error ? <StateView kind="empty" art="bell" title="U poslednjem pregledu nije bilo obaveštenja"
          body={error === 'load' ? 'Nismo uspeli da proverimo ima li novih. Osvežite obaveštenja kada budete mogli.'
            : error === 'page' ? 'Starija obaveštenja nisu učitana.' : 'Ishod radnje još nije potvrđen.'} />
        // A filtered empty is only this view, not proof that the whole inbox is empty. During a refresh it remains the last confirmed result.
        : <StateView kind="empty" hero={!role} art="bell" title={EMPTY_TITLE[role ?? 'ALL']}
            body={!role ? 'Nove prijave, poruke i važne promene stižu ovde.' : undefined}
            primary={!role ? { label: 'Podesi obaveštenja', onPress: onSettings }
              : { label: 'Prikaži sva obaveštenja', onPress: () => onRole(null), disabled: busy }} />;

  const footer = error === 'page' || page?.hasMore ? <View style={s.footer}>
    {error === 'page' ? <>
      <T variant="note" tone="danger" accessibilityRole="alert">Starija obaveštenja nisu učitana.</T>
      <T variant="note" tone="muted">{AGAIN}</T>
    </> : null}
    {page?.hasMore ? <V2Action kind="secondary" label="Učitaj starija obaveštenja" loading={paging} disabled={busy && !paging} onPress={onMore} /> : null}
  </View> : null;

  // One stable row renderer while nothing a row draws has changed, so a switch of the filter or a refresh does not
  // re-render every row the list already holds.
  const renderItem = useCallback(({ item: row }: { item: InboxRowModel }) => row.kind === 'day'
    ? <DayHeader label={row.label} first={row.first} readAll={row.first ? readAll : undefined} />
    : <Appear animate={appear.isNew(row.item.id)}>
      <InboxRow item={row.item} moment={row.moment} last={row.last} acting={acting === row.item.id} busy={busy}
        onOpen={onOpen} onMarkRead={onMarkRead} onSwipeOpen={onSwipeOpen} />
    </Appear>, [appear, acting, busy, unreadCount, onOpen, onMarkRead, onSwipeOpen, onReadAll]); // eslint-disable-line react-hooks/exhaustive-deps

  return <FlatList data={rows} keyExtractor={rowKey}
    contentContainerStyle={s.content} showsVerticalScrollIndicator={false}
    refreshing={pull.refreshing && !!page} onRefresh={pull.onRefresh}
    ListHeaderComponent={header} ListEmptyComponent={empty} ListFooterComponent={footer}
    renderItem={renderItem} />;
}
const rowKey = (row: InboxRowModel) => row.id;

/** Said once when the last unread notification is read while the list is open: the dots and the "Označi sve" leave quietly. */
function useReadAllAnnouncement(unreadCount: number | undefined) {
  const before = useRef(unreadCount);
  useEffect(() => {
    const previous = before.current; before.current = unreadCount;
    if (previous !== undefined && previous > 0 && unreadCount === 0) AccessibilityInfo.announceForAccessibility('Nema nepročitanih obaveštenja.');
  }, [unreadCount]);
}

const s = StyleSheet.create({
  // The edge of every screen, the end of the scroll 32 from the last row; a column on a tablet.
  content: { paddingHorizontal: layout.gutter, paddingTop: sys.space.sm, paddingBottom: layout.zone, flexGrow: 1, width: '100%', maxWidth: layout.maxWidth, alignSelf: 'center' },
  header: { gap: layout.group },
  // The note of a failed read, on its quiet tint; its picture, words and one action 12 apart.
  banner: { flexDirection: 'row', gap: sys.space.md },
  bannerCopy: { flex: 1, minWidth: 0, gap: sys.space.xs },
  refreshing: { flexDirection: 'row', alignItems: 'center', gap: sys.space.sm },
  destination: { flexDirection: 'row', alignItems: 'center', gap: sys.space.xs, paddingTop: sys.space.sm },
  destinationLabel: { flexShrink: 1 },
  inlineAction: { paddingHorizontal: 0, alignSelf: 'flex-start' },
  // A day: 24 above, and 12 under it before the first row's own 12; the first one stands 12 under the sets and is as high as its action.
  day: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: sys.space.md },
  dayLater: { paddingTop: layout.section, paddingBottom: layout.group },
  dayFirst: { paddingTop: layout.group, minHeight: layout.touch + layout.group },
  dayLabel: { flexShrink: 1 },
  readAll: { minWidth: layout.touch, minHeight: layout.touch, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: sys.space.sm,
    paddingLeft: sys.space.md },
  readAllText: { fontWeight: '600' },
  // One footprint for the event picture, the working indicator and the unread dot; the dot sits on the corner of the picture.
  art: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  dot: { position: 'absolute', top: 0, right: 0, width: sys.space.sm, height: sys.space.sm, borderRadius: sys.radius.pill, backgroundColor: sys.color.green,
    borderWidth: 1, borderColor: sys.color.surface },
  footer: { paddingTop: sys.space.base, gap: sys.space.sm },
});
