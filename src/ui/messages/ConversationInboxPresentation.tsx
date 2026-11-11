import { memo, useCallback, useMemo, useState, type ReactNode } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, View, type ListRenderItemInfo } from 'react-native';
import type { ConversationInboxItem } from '../../contracts/conversationInbox';
import { DOGOVORENA_ZONA } from '../../lib/dogovorenoVreme';
import { inicijali } from '../../lib/inicijali';
import { trenutak, type Trenutak } from '../../lib/trenutak';
import { T } from '../Text';
import { Avatar } from '../system/Avatar';
import { FactArt } from '../system/FactArt';
import { Segmented } from '../system/Segmented';
import { StateView } from '../system/StateView';
import { Surface } from '../system/Surface';
import { layout } from '../system/layout';
import { neprocitanih, osoba } from '../system/plural';
import { useLayoutClass } from '../system/textScale';
import { sys } from '../system/tokens';
import { usePullRefresh } from '../system/usePullRefresh';
import { V2Action } from '../v2/V2Action';
import { TimedRow } from '../notifications/TimedRow';

/**
 * The admitted reader's contract owns these facts (`MY_CONVERSATIONS_PAGE_V1`). Two things the Poruke design draws are NOT in that
 * projection today, so nothing supplies them yet and nothing is invented: that the conversation is closed, and how
 * many people a group has ("Grupa · 3 osobe"). A reader that learns them fills these optional fields and the row draws them; the route
 * fills private Agreement closure from the Dogovori it already reads. Group lifecycle needs its own witness.
 */
export type ConversationInboxRow = ConversationInboxItem & Readonly<{ closed?: boolean; memberCount?: number }>;
export const conversationRowKey = (row: ConversationInboxRow): string => `${row.kind}:${row.id}`;

export type ConversationInboxPresentationProps = {
  /** null means no authoritative page yet; [] is a successfully read empty inbox. Order is the server's order. */
  items: readonly ConversationInboxRow[] | null;
  loading: boolean; refreshing: boolean; error: boolean;
  paging: boolean; pageError: boolean; hasMore: boolean;
  /** Account/focus retirement and navigation admission belong to the caller. */
  disabled?: boolean; openingDisabled?: boolean; openingKey?: string | null;
  unavailableKeys?: ReadonlySet<string>; openErrorKey?: string | null;
  onOpen: (row: ConversationInboxRow) => void; onRefresh: () => void; onLoadMore: () => void;
  /** Only supply an already-authorized photo node, drawn at 48. The presentation never fetches photos or message media. */
  renderAvatar?: (row: ConversationInboxRow) => ReactNode;
  /** Optional route chrome, outside the scrolling list. Does not create a bell or any data read. */
  header?: ReactNode;
  /** The supplied chrome already contains the visible section heading. Default keeps standalone/gallery rendering. */
  titleInHeader?: boolean;
  /** The existing Dogovori screen includes Agreements without messages. Optional real route callback only. */
  onAgreements?: () => void;
  /**
   * R17: the Dogovori that are over (ids), read by the route from the Dogovori the app already reads. An explicit `closed` on a row takes
   * precedence. Only rows with a known status are separated into "Aktivni" and "Istorija"; unknown rows remain visible in both views.
   * With `null` (not read yet, or the read failed) and no `closed` on the rows there is one list and no control: nothing is guessed.
   */
  closedAgreements?: ReadonlySet<string> | null;
  bottomInset?: number; zona?: string; sada?: Date;
};

type ListItem = { key: string; item: ConversationInboxRow; moment: Trenutak | null; closed: boolean | undefined };

/**
 * One row per conversation, in the server's order. Do not sort/group by counterpart or event time: multiple tasks with one
 * person are distinct conversations. The moment of the last message is read in SERBIAN time unless the caller names a zone.
 */
export function conversationInboxRows(items: readonly ConversationInboxRow[], options: { zona?: string; sada?: Date;
  closedAgreements?: ReadonlySet<string> | null } = {}): ListItem[] {
  const zone = { zona: options.zona ?? DOGOVORENA_ZONA, ...(options.sada ? { sada: options.sada } : {}) };
  // Whether the Dogovor is over: what the row says, else what the Dogovori read says; undefined is "not known", never "open".
  const closedOf = (item: ConversationInboxRow) => item.closed !== undefined ? item.closed
    // A group's route points at one bilateral Agreement. Its completion/cancellation says nothing
    // about the remaining group members; only an explicit group status may classify that row.
    : item.kind === 'AGREEMENT' && options.closedAgreements ? options.closedAgreements.has(item.routeAgreementId) : undefined;
  return items.map(item => ({ key: conversationRowKey(item), item, moment: trenutak(item.lastMessage.createdAt, zone), closed: closedOf(item) }));
}

/**
 * What stands at the end of the name's line (proposal J2): the clock for a message of today, otherwise the day as the app says it
 * ("Juče", "3. okt"). Never both: the list has no day headings, so the stamp carries the day.
 */
export const conversationStamp = (moment: Trenutak | null): string | null => moment ? moment.dan === 'Danas' ? moment.sat : moment.dan : null;

/** The row's first line: the other person, or the group (with its size when the reader knows it). */
export function conversationTitle(item: ConversationInboxRow): string {
  if (item.kind === 'GROUP') return item.memberCount && item.memberCount > 0 ? `Grupa · ${osoba(item.memberCount)}` : 'Grupa';
  return item.counterpart?.displayName?.trim() || 'Razgovor';
}

/** Preserve a media caption as well as kind. No invented duration, sender identity or delivery/read status. */
export function conversationPreview(message: ConversationInboxRow['lastMessage']): string {
  const caption = message.preview?.trim();
  const content = message.kind === 'PHOTO' ? ['Fotografija', caption].filter(Boolean).join(' · ')
    : message.kind === 'VOICE' ? ['Glasovna poruka', caption].filter(Boolean).join(' · ')
      : caption || 'Tekst poruke nije dostupan';
  return `${message.mine ? 'Vi: ' : ''}${content}`;
}

/** Keep message punctuation when joining facts for a screen reader; a preview ending in a full stop must not become "..". */
const spokenFacts = (facts: (string | null)[]): string => facts.filter((fact): fact is string => Boolean(fact))
  .reduce((speech, fact) => speech ? `${speech}${/[.!?…]$/u.test(speech) ? ' ' : '. '}${fact}` : fact, '');

const EMPTY_KEYS: ReadonlySet<string> = new Set();
const EMPTY_ITEMS: readonly ConversationInboxRow[] = [];
const rowKey = (row: ListItem) => row.key;

export function ConversationInboxPresentation({ items, loading, refreshing, error, paging, pageError, hasMore,
  disabled = false, openingDisabled = false, openingKey = null, unavailableKeys = EMPTY_KEYS, openErrorKey = null,
  onOpen, onRefresh, onLoadMore, renderAvatar, header, titleInHeader = false, onAgreements, closedAgreements = null, bottomInset = 0, zona, sada,
}: ConversationInboxPresentationProps) {
  const rows = useMemo(() => conversationInboxRows(items ?? EMPTY_ITEMS, { zona, sada, closedAgreements }), [items, zona, sada, closedAgreements]);
  const shown = rows;
  const reading = loading || refreshing;
  const readDisabled = disabled || reading || paging;
  const openDisabled = disabled || openingDisabled || openingKey !== null;
  // Keep RefreshControl mounted while reading; the caller still owns async single-flight admission.
  const refresh = useCallback(() => { if (!readDisabled) onRefresh(); }, [readDisabled, onRefresh]);
  // The pull spinner is for a pull only: a read the screen starts by itself (a tab switched back, a focus) used to raise it, and on Android
  // it is a white disc over the top of the list, which sat half grown on the Aktivni/Završeni switch on the owner's phone (8 Oct 2026).
  const pull = usePullRefresh(refresh, reading);
  const renderItem = useCallback(({ item: row }: ListRenderItemInfo<ListItem>) => <View style={s.conversationCard}>
    <ConversationRow item={row.item} moment={row.moment} closed={row.closed === true}
    unavailable={unavailableKeys.has(row.key)} failed={openErrorKey === row.key} opening={openingKey === row.key}
    openDisabled={openDisabled} onOpen={onOpen} photo={renderAvatar?.(row.item)} />
  </View>,
  [unavailableKeys, openErrorKey, openingKey, openDisabled, onOpen, renderAvatar]);

  const notice = items !== null && error ? <Surface kind="note" style={s.notice}>
    <T variant="note" accessibilityRole="alert">Razgovori nisu osveženi.</T>
    <T variant="note" tone="muted">{items.length > 0
      ? 'Poslednji učitani razgovori ostaju prikazani. Osvežite ih da nastavite.'
      : 'Pokušajte ponovo da proverite ima li novih razgovora.'}</T>
    <V2Action label="Osvežite razgovore" kind="quiet" compact onPress={onRefresh} disabled={readDisabled} loading={reading} />
  </Surface> : null;
  const listHeader = <View style={s.heading}>
    {!titleInHeader ? <T variant="pageTitle" accessibilityRole="header">Poruke</T> : null}
    <T variant="note" tone="muted">Razgovori o Vašim zadacima</T>
    {notice}
  </View>;

  const incomplete = hasMore || pageError || paging;
  const emptyTitle = incomplete ? 'Razgovori još nisu učitani do kraja' : 'Još nema razgovora';
  const emptyBody = incomplete ? 'Učitajte starije razgovore da nastavite pregled.' : 'Razgovor započinjete iz Dogovora.';
  const empty = items === null
    ? error && !reading
      ? <StateView kind="error" title="Razgovori nisu učitani" body="Pokušajte ponovo da učitate razgovore."
          primary={{ label: 'Pokušajte ponovo', onPress: onRefresh, disabled: readDisabled }} />
      // A calm, explicit read state; no pulsing grey conversation placeholders.
      : <View accessibilityLiveRegion="polite" style={s.loading}>
        <View style={[s.conversationCard, s.loadingCard]}>
          <ActivityIndicator size="small" color={sys.color.green} accessibilityElementsHidden />
          <T variant="bodyStrong">Učitavamo razgovore…</T>
        </View>
      </View>
    : error ? null
      // Nobody has talked yet: clean empty state with direct action to Agreements
      : <StateView kind="empty" hero compact={false} art="chat" title={emptyTitle} body={emptyBody}
          primary={onAgreements && emptyTitle === 'Još nema razgovora' ? { label: 'Otvorite Dogovore', onPress: onAgreements, disabled: openDisabled } : undefined} />;
  const footer = items !== null && (hasMore || pageError || paging) ? <View style={s.footer}>
    {pageError ? <T variant="note" accessibilityRole="alert">Stariji razgovori nisu učitani. Pokušajte ponovo da nastavite.</T> : null}
    <V2Action label={pageError ? 'Pokušajte ponovo' : 'Učitajte starije razgovore'} kind="quiet" onPress={onLoadMore}
      disabled={readDisabled} loading={paging} accessibilityLabel={pageError ? 'Ponovo učitajte starije razgovore' : undefined} />
  </View> : null;

  return <View style={s.screen}>
    {header}
    <FlatList data={shown} keyExtractor={rowKey} renderItem={renderItem}
      ListHeaderComponent={listHeader} ListEmptyComponent={empty} ListFooterComponent={footer}
      contentContainerStyle={[s.content, { paddingBottom: Math.max(0, bottomInset) + layout.zone }]}
      refreshing={items !== null && pull.refreshing} onRefresh={pull.onRefresh}
      keyboardShouldPersistTaps="handled" initialNumToRender={12} />
  </View>;
}

type RowProps = { item: ConversationInboxRow; moment: Trenutak | null; closed: boolean;
  openDisabled: boolean; opening: boolean; unavailable: boolean; failed: boolean; photo?: ReactNode;
  onOpen: (row: ConversationInboxRow) => void };

/** The face of a row, and the whole of its slot: the face stands on the edge of the screen, in line with the control and the bar above it. */
const FACE = 48;

/**
 * The task leads because several group conversations otherwise have the same heading ("Grupa") and one person can have several jobs.
 * Three compact lines preserve the existing density: task and time, last message, then person/group context. The entire text remains
 * in the accessible label when a visual line is clipped. A closed private conversation carries Istorija even in a mixed list where
 * group lifecycle is unknown. A row draws no arrow: its full content area opens the conversation.
 */
const ConversationRow = memo(function ConversationRow({ item, moment, closed, openDisabled, opening, unavailable, failed, photo, onOpen }: RowProps) {
  const { stacked } = useLayoutClass();
  const context = item.kind === 'GROUP' ? conversationTitle(item) : `Privatno · ${conversationTitle(item)}`;
  const preview = conversationPreview(item.lastMessage);
  // Private unread is explicitly unknown in V1, even if an upstream caller accidentally supplies a number.
  const unread = item.kind === 'GROUP' && item.unreadMessageCount !== null && Number.isSafeInteger(item.unreadMessageCount)
    && item.unreadMessageCount > 0 ? item.unreadMessageCount : null;
  const status = unavailable ? 'Razgovor trenutno nije dostupan.' : failed ? 'Razgovor nije otvoren. Pokušajte ponovo.' : null;
  const stamp = conversationStamp(moment);
  const time = moment ? `${moment.dan}, ${moment.sat}` : null;
  const label = spokenFacts([item.task.title, context, closed ? `${item.kind === 'GROUP' ? 'Razgovor je završen' : 'Dogovor je zatvoren'}. Samo za čitanje` : null, preview, time,
    unread === null ? null : neprocitanih(unread), status]);
  // Keep the counterpart visible even when the row is about the task; only authoritative closure earns Istorija.
  const about = opening ? 'Otvaramo razgovor…' : status ?? `${closed ? 'Samo za čitanje · ' : ''}${context}`;
  const aboutLine = stacked && stamp && !opening && !status ? `${stamp} · ${about}` : about;
  const off = unavailable || opening;
  // The face is the one thing of the row's slot: a photo, the person's letters, or the picture of a group. Decoration only: the row speaks.
  const face = <View accessible={false} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden style={s.face}>
    {photo ?? (item.kind === 'GROUP' ? <FactArt kind="users" size={FACE} /> : <Avatar initials={inicijali(item.counterpart?.displayName)} size={FACE} />)}
  </View>;
  return <TimedRow leading={face} slot={FACE} title={item.task.title} titleLines={stacked ? 2 : 1} time={stacked ? null : stamp} last disabled={off}
    interactionDisabled={openDisabled}
    onPress={() => { if (!openDisabled) onOpen(item); }} accessibilityLabel={label}
    accessibilityHint={unavailable ? undefined : failed ? 'Pokušajte ponovo da otvorite razgovor.' : 'Otvara razgovor uz ovaj zadatak.'}>
    <View style={s.line}>
      <T variant="note" tone="muted" numberOfLines={1} style={s.grow}>{preview}</T>
      {unread !== null ? <View style={s.unread}><T variant="meta" style={s.unreadText}>{unread.toLocaleString('sr-Latn-RS')}</T></View> : null}
    </View>
    <T variant="meta" tone="muted" numberOfLines={1}>{aboutLine}</T>
  </TimedRow>;
});

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: sys.color.surface },
  // The edge of every screen (20), the first row 8 under the bar, the end of the scroll 32 from the last row; a column on a tablet.
  content: { flexGrow: 1, width: '100%', maxWidth: layout.maxWidth, alignSelf: 'center', paddingHorizontal: layout.gutter, paddingTop: sys.space.sm },
  heading: { gap: layout.group, paddingBottom: sys.space.sm },
  notice: { gap: sys.space.xs },
  conversationCard: { backgroundColor: sys.color.surface, borderWidth: 1, borderColor: sys.color.cardLine,
    borderRadius: sys.radius.cardCompact, paddingHorizontal: sys.space.md, marginBottom: sys.space.sm },
  face: { width: FACE, height: FACE, alignItems: 'center', justifyContent: 'center' },
  line: { flexDirection: 'row', alignItems: 'center', gap: sys.space.sm },
  grow: { flex: 1, minWidth: 0 },
  // The count of a group is 20 high, the height of the line it stands in, so a group's row is as tall as any other.
  unread: { minWidth: 20, height: 20, paddingHorizontal: sys.space.xs, borderRadius: sys.radius.pill, backgroundColor: sys.color.ink, alignItems: 'center', justifyContent: 'center' },
  unreadText: { color: sys.color.surface, textAlign: 'center', fontVariant: ['tabular-nums'] },
  loading: { paddingTop: sys.space.sm },
  loadingCard: { minHeight: 86, flexDirection: 'row', alignItems: 'center', gap: sys.space.md },
  footer: { paddingVertical: sys.space.base, gap: sys.space.sm },
});
