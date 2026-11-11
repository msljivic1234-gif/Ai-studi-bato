import { useMemo, useState, type ReactNode } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { DogovorProjekcija, MojaPrijavaProjekcija, PotrebaProjekcija } from '../../contracts/projections';
import { Press } from '../Press';
import { T } from '../Text';
import { GroupHeader } from '../agreements/GroupHeader';
import { DetailTopBar } from '../system/DetailTopBar';
import { layout } from '../system/layout';
import { Segmented } from '../system/Segmented';
import { StateView } from '../system/StateView';
import { Surface } from '../system/Surface';
import { useTextScale } from '../system/textScale';
import { sys } from '../system/tokens';
import { usePressLift } from '../system/usePressLift';
import { usePullRefresh } from '../system/usePullRefresh';
import { V2Action } from '../v2/V2Action';
import { QuietReadState } from '../v2/QuietReadState';
import { ARCHIVE_FILTERS, DRAFTS_NOT_KEPT, EMPTY_ARCHIVE, REASON_NOT_KEPT, archiveEntries, archiveGroups, hasUnkeptReason,
  type ArchiveEntry, type ArchiveFilter, type ArchiveGroup } from './archive';
import { PlannerChip, statusSpoken } from './PlannerChip';

/** One of the three reads the archive is made of: what the planner already reads, nothing new. */
export type ArchiveSource<Row> = { state: 'loading' } | { state: 'error' } | { state: 'ready'; rows: readonly Row[] };

type Item = { type: 'heading'; group: ArchiveGroup } | { type: 'row'; entry: ArchiveEntry };

/** What a row says it opens (a Dogovor without a title is not called confirmed: it is over). */
function nameOf(entry: ArchiveEntry): string {
  const noun = entry.kind === 'dogovor' ? 'Dogovor' : entry.kind === 'zadatak' ? 'zadatak' : 'prijavu';
  return entry.title ? `Otvori ${noun} ${entry.title}` : `Otvori ${noun}`;
}

/**
 * "Arhiva" (owner, 2026-10-07; plan 2.2): the things of mine that are over, read-only, for both sides at once. Finished and cancelled
 * Dogovori, closed tasks, withdrawn and closed applications, in three groups, each row with the shared chip and a press that opens
 * the detail it belongs to. A quiet row of chips, "Sve · Otkazani · Istekli · Završeni", narrows it. It makes no command of its own.
 * Each thing is a `record` (a card that is touched, the same one the Raspored draws) under a group heading of the one rhythm: 24 above it, 12 below.
 *
 * A read that failed is said and never drawn as a short archive: with one source down the others are drawn under a line that says
 * which, and "Nema …" is never claimed while a source is missing. Under the list stands the one sentence that tells where a deleted
 * draft went.
 */
export function ArchiveScreen({ agreements, needs, applications, refreshing, onBack, onRefresh, onRetry, onOpen }: {
  agreements: ArchiveSource<DogovorProjekcija>; needs: ArchiveSource<PotrebaProjekcija>; applications: ArchiveSource<MojaPrijavaProjekcija>;
  /** A pull re-reads all three while what is on screen stays. */ refreshing: boolean;
  onBack: () => void; onRefresh: () => void;
  /** Read again what failed. */ onRetry: () => void;
  onOpen: (entry: ArchiveEntry) => void;
}) {
  const scale = useTextScale();
  const [filter, setFilter] = useState<ArchiveFilter>('all');
  // The pull spinner is for a pull only (a read the screen starts by itself must not raise Android's white disc at the top of the list).
  const pull = usePullRefresh(onRefresh, refreshing);
  const sources = [agreements, needs, applications];
  const entries = useMemo(() => archiveEntries({
    agreements: agreements.state === 'ready' ? agreements.rows : null, needs: needs.state === 'ready' ? needs.rows : null,
    applications: applications.state === 'ready' ? applications.rows : null,
  }), [agreements, needs, applications]);
  const groups = useMemo(() => archiveGroups(entries, filter), [entries, filter]);
  const items: Item[] = groups.flatMap((group): Item[] => [{ type: 'heading', group }, ...group.entries.map((entry): Item => ({ type: 'row', entry }))]);
  const failed = [agreements.state === 'error' ? 'Dogovori nisu učitani.' : null, needs.state === 'error' ? 'Moji zadaci nisu učitani.' : null,
    applications.state === 'error' ? 'Moje prijave nisu učitane.' : null].filter((line): line is string => line !== null);
  const loading = sources.some(source => source.state === 'loading');
  const everythingFailed = sources.every(source => source.state === 'error');
  const notes = failed.length ? <View style={s.notes}>
    <View style={s.noteLines}>{failed.map(line => <T key={line} variant="note" tone="muted">{line}</T>)}</View>
    <V2Action label="Pokušaj ponovo" kind="quiet" compact onPress={onRetry} />
  </View> : null;

  let empty: ReactNode;
  if (everythingFailed) empty = <StateView kind="error" art="document" title="Arhiva nije učitana." body="Proveri vezu pa probaj ponovo."
    primary={{ label: 'Pokušaj ponovo', onPress: onRetry }} />;
  // Never say the archive is empty before every read it is made of has answered.
  else if (loading) empty = <>
    <QuietReadState art="document" title="Učitavamo arhivu…" body="Proveravamo završene Dogovore, zadatke i prijave." />
    {notes}
  </>;
  else if (failed.length) empty = notes;
  else if (filter === 'all') empty = <StateView kind="empty" art="document" title="Arhiva je prazna." body={EMPTY_ARCHIVE.all} />;
  else empty = <View style={s.none}>
    <T variant="note" tone="muted">{EMPTY_ARCHIVE[filter]}</T>
    {hasUnkeptReason(entries) ? <T variant="note" tone="muted">{REASON_NOT_KEPT}</T> : null}
  </View>;

  const header = <View style={s.header}>
    <Segmented value={filter} onChange={setFilter} options={ARCHIVE_FILTERS.map(({ key, label }) => ({ key, label }))} />
    {items.length && filter !== 'all' && hasUnkeptReason(entries) ? <T variant="note" tone="muted" style={s.reason}>{REASON_NOT_KEPT}</T> : null}
    {items.length ? notes : null}
  </View>;
  return <SafeAreaView edges={['top', 'bottom']} style={s.screen}>
    <DetailTopBar title="Arhiva" onBack={onBack} />
    <FlatList data={items} keyExtractor={item => item.type === 'heading' ? `group:${item.group.kind}` : item.entry.key}
      renderItem={({ item, index }) => item.type === 'heading'
        ? <GroupHeader title={item.group.heading} count={item.group.count} first={index === 0} />
        : <ArchiveRow entry={item.entry} scale={scale} onOpen={onOpen} />}
      ListHeaderComponent={header} ListEmptyComponent={<View style={s.empty}>{empty}</View>}
      ListFooterComponent={everythingFailed || (loading && !items.length) ? null : <T variant="note" tone="muted" style={s.foot}>{DRAFTS_NOT_KEPT}</T>}
      refreshing={pull.refreshing} onRefresh={pull.onRefresh} contentContainerStyle={s.content} ItemSeparatorComponent={Gap} />
  </SafeAreaView>;
}

const Gap = () => <View style={s.gap} />;

/** One thing that is over: its title, the shared chip with role · person, when and where it was. The whole card is the press. */
function ArchiveRow({ entry, scale, onOpen }: { entry: ArchiveEntry; scale: number; onOpen: (entry: ArchiveEntry) => void }) {
  const { style: lift, give, settle } = usePressLift();
  const others = [entry.role, entry.person].filter((part): part is string => !!part).join(' · ');
  const spoken = [statusSpoken(entry.status), entry.role, entry.timeText || null, entry.person, entry.place || null].filter((part): part is string => !!part).join(', ');
  return <Animated.View style={lift}>
    <Surface kind="record">
      <Press accessibilityRole="button" accessibilityLabel={nameOf(entry)} accessibilityValue={{ text: spoken }} haptic="select"
        scaleTo={1} onPressIn={give} onPressOut={settle} onPress={() => onOpen(entry)} style={s.body}>
        <T variant="cardTitleCompact" numberOfLines={scale >= 1.3 ? 3 : 2}>{entry.title ?? entry.fallbackTitle}</T>
        <View style={s.facts}>
          <PlannerChip status={entry.status} />
          {others ? <T variant="note" style={s.factText}>{others}</T> : null}
        </View>
        {entry.timeText ? <T variant="note" style={s.factText}>{entry.timeText}</T> : null}
        {entry.place ? <T variant="note" style={s.factText}>{entry.place}</T> : null}
      </Press>
    </Surface>
  </Animated.View>;
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: sys.color.ground },
  // The frame of every screen: the edge 20, 8 under the bar, 32 under the last thing (`Screen`; a FlatList cannot stand inside its scroll).
  content: { paddingHorizontal: layout.gutter, paddingTop: sys.space.sm, paddingBottom: layout.zone },
  header: { gap: sys.space.md, marginBottom: layout.section },
  reason: { marginTop: sys.space.xs },
  gap: { height: sys.space.md },
  body: { gap: sys.space.xs },
  facts: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: sys.space.sm, rowGap: sys.space.xs },
  factText: { flexShrink: 1, color: sys.color.fact },
  empty: { paddingTop: sys.space.sm },
  none: { gap: sys.space.sm },
  notes: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: sys.space.sm },
  noteLines: { flexShrink: 1, gap: sys.space.xs },
  foot: { marginTop: layout.section },
});
