import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, View } from 'react-native';
import type { ListRenderItemInfo } from 'react-native';
import { listAiHistory, type AiHistoryCursor, type AiHistoryPurpose, type AiHistoryRow } from '../../data/aiHistoryClientService';
import { sesijaSada } from '../../store/sesija';
import { Press } from '../Press';
import { T } from '../Text';
import { AccountHeader } from '../profile/AccountHeader';
import { Glyph } from '../system/Glyph';
import { Screen } from '../system/Screen';
import { sys } from '../system/tokens';
import { V2Action } from '../v2/V2Action';
import { historyActionLabel, historyDate, historyPurposeLabel, historyStatusLabel } from './historyUiModel';

type Phase = 'idle' | 'loading' | 'ready' | 'refreshing' | 'loadingMore' | 'error' | 'offline';
type PageState = { rows: AiHistoryRow[]; nextCursor: AiHistoryCursor | null; phase: Phase;
  loaded: boolean; moreFailed: boolean };
const initial = (): PageState => ({ rows: [], nextCursor: null, phase: 'idle', loaded: false, moreFailed: false });
const purposes: readonly AiHistoryPurpose[] = ['NEED_INTAKE', 'PROFILE'];

export function AiHistoryListScreen({ accountId, accountRevision, focused, initialPurpose = 'NEED_INTAKE', onBack, onOpen }: {
  accountId: string | undefined; accountRevision: number; focused: boolean; initialPurpose?: AiHistoryPurpose; onBack: () => void;
  onOpen: (purpose: AiHistoryPurpose, row: AiHistoryRow) => void;
}) {
  const [selected, setSelected] = useState<AiHistoryPurpose>(initialPurpose);
  return <Screen kind="detail" background="wash" scroll={false} contentStyle={s.screen}
    header={<AccountHeader title="AI razgovori" onBack={onBack} />}>
    <View style={s.intro}>
      <T variant="bodyStrong">Vaši razgovori</T>
      <T variant="note" tone="muted">Započeti razgovor možete da nastavite. Stariji razgovori ostaju odvojeni po nameni.</T>
    </View>
    <View accessibilityRole="tablist" style={s.tabs}>
      {purposes.map(purpose => <Press key={purpose} accessibilityRole="tab"
        accessibilityLabel={historyPurposeLabel(purpose)} accessibilityState={{ selected: selected === purpose }}
        onPress={() => setSelected(purpose)} haptic="select"
        style={[s.tab, selected === purpose && s.tabSelected]}>
        <T variant="note" tone={selected === purpose ? 'green' : 'muted'} style={s.tabLabel}>
          {purpose === 'NEED_INTAKE' ? 'Zadaci' : 'Radni profil'}
        </T>
      </Press>)}
    </View>
    <View style={s.panes}>
      {purposes.map(purpose => <View key={purpose} style={[s.pane, selected !== purpose && s.hidden]}
        accessibilityElementsHidden={selected !== purpose} importantForAccessibility={selected !== purpose ? 'no-hide-descendants' : 'auto'}>
        <HistoryPane purpose={purpose} accountId={accountId} accountRevision={accountRevision}
          active={focused && selected === purpose} onOpen={onOpen} />
      </View>)}
    </View>
  </Screen>;
}

function HistoryPane({ purpose, accountId, accountRevision, active, onOpen }: {
  purpose: AiHistoryPurpose; accountId: string | undefined; accountRevision: number; active: boolean;
  onOpen: (purpose: AiHistoryPurpose, row: AiHistoryRow) => void;
}) {
  const [page, setPage] = useState<PageState>(initial);
  const pageRef = useRef(page), request = useRef(0), activeRef = useRef(active);
  activeRef.current = active;
  const commit = useCallback((next: PageState) => { pageRef.current = next; setPage(next); }, []);
  const owns = useCallback(() => !!accountId && sesijaSada().user?.id === accountId
    && sesijaSada().accountRevision === accountRevision, [accountId, accountRevision]);
  const load = useCallback(async (mode: 'initial' | 'refresh' | 'more') => {
    if (!activeRef.current || !owns()) return;
    const previous = pageRef.current;
    if (mode === 'more' && !previous.nextCursor) return;
    const before = mode === 'more' ? previous.nextCursor : null;
    const flight = ++request.current;
    commit({ ...previous, phase: mode === 'more' ? 'loadingMore' : previous.loaded ? 'refreshing' : 'loading', moreFailed: false });
    const result = await listAiHistory(purpose, before);
    if (request.current !== flight || !activeRef.current || !owns()) return;
    if (!result.ok) {
      commit({ ...pageRef.current, phase: result.kod === 'AI_HISTORY_OFFLINE' ? 'offline' : 'error',
        moreFailed: mode === 'more' });
      return;
    }
    const current = pageRef.current;
    const existingIds = new Set(current.rows.map(row => row.conversationId.toLowerCase()));
    if (mode === 'more' && result.podatak.rows.some(row => existingIds.has(row.conversationId.toLowerCase()))) {
      commit({ ...current, phase: 'error', moreFailed: true });
      return;
    }
    commit({ rows: mode === 'more' ? [...current.rows, ...result.podatak.rows] : result.podatak.rows,
      nextCursor: result.podatak.nextCursor, phase: 'ready', loaded: true, moreFailed: false });
  }, [commit, owns, purpose]);

  useEffect(() => {
    if (active && owns()) {
      if (pageRef.current !== page) commit(pageRef.current);
      if (!pageRef.current.loaded) void load('initial');
    }
    return () => {
      request.current++;
      const current = pageRef.current;
      if (current.phase === 'loading' || current.phase === 'loadingMore' || current.phase === 'refreshing')
        pageRef.current = { ...current, phase: current.loaded ? 'ready' : 'idle' };
    };
  }, [active, commit, load, owns]);

  const open = useCallback((row: AiHistoryRow) => onOpen(purpose, row), [onOpen, purpose]);
  const renderItem = useCallback(({ item }: ListRenderItemInfo<AiHistoryRow>) =>
    <HistoryRow purpose={purpose} row={item} onOpen={open} />, [open, purpose]);
  const hasRows = page.rows.length > 0;
  const waiting = page.phase === 'loading' || page.phase === 'refreshing';
  const failed = page.phase === 'error' || page.phase === 'offline';
  return <View style={s.listArea}>
    <T variant="title" accessibilityRole="header" style={s.listHeading}>{historyPurposeLabel(purpose)}</T>
    <FlatList style={s.listFlex} data={page.rows} renderItem={renderItem} keyExtractor={row => row.conversationId}
      contentContainerStyle={[s.listContent, !hasRows && s.emptyFill]}
      refreshControl={<RefreshControl refreshing={page.phase === 'refreshing'}
        onRefresh={() => { if (active && page.phase !== 'loading' && page.phase !== 'loadingMore') void load('refresh'); }} />}
      ListEmptyComponent={waiting || page.phase === 'idle'
        ? <View style={s.state} accessibilityLiveRegion="polite" accessibilityState={{ busy: true }}>
            <ActivityIndicator color={sys.color.green} />
            <T variant="bodyStrong">Učitavamo razgovore…</T>
            <T variant="note" tone="muted">Proveravamo Vašu istoriju.</T>
          </View>
        : failed ? <HistoryFailure offline={page.phase === 'offline'} onRetry={() => { void load('refresh'); }} />
        : <View style={s.state}>
            <Glyph name={purpose === 'NEED_INTAKE' ? 'messages' : 'profile'} size={32} tone="green" />
            <T variant="bodyStrong">Ovde još nema razgovora.</T>
            <T variant="note" tone="muted">Kada započnete razgovor, pojaviće se ovde.</T>
          </View>}
      ListFooterComponent={hasRows ? <View style={s.footer}>
        {failed ? <HistoryFailure offline={page.phase === 'offline'} compact onRetry={() => {
          void load(page.moreFailed ? 'more' : 'refresh');
        }} /> : null}
        {page.nextCursor && !failed ? <V2Action label={page.phase === 'loadingMore' ? 'Učitavamo…' : 'Prikaži još'}
          loading={page.phase === 'loadingMore'} disabled={waiting} onPress={() => { void load('more'); }} /> : null}
      </View> : null}
      initialNumToRender={8} maxToRenderPerBatch={8} windowSize={7} />
  </View>;
}

const HistoryRow = memo(function HistoryRow({ purpose, row, onOpen }: {
  purpose: AiHistoryPurpose; row: AiHistoryRow; onOpen: (row: AiHistoryRow) => void;
}) {
  const action = historyActionLabel(purpose, row);
  const detail = row.status === 'OPEN'
    ? row.canContinue ? null : 'Nastavak trenutno nije dostupan.'
    : row.canRead ? 'Sačuvan tekst razgovora.' : 'Pregled poruka trenutno nije dostupan.';
  return <Press accessibilityRole="button" accessibilityLabel={`${row.title}, ${historyStatusLabel(purpose, row)}`}
    accessibilityHint={action ?? detail ?? undefined} accessibilityState={{ disabled: !action }}
    disabled={!action} onPress={() => onOpen(row)} haptic={action ? 'select' : 'none'} style={s.row}>
    <View style={s.rowTop}>
      <T variant="bodyStrong" style={s.rowTitle}>{row.title}</T>
      {action ? <Glyph name="caret-right" size={20} tone="green" /> : null}
    </View>
    <T variant="meta" tone="muted">{historyStatusLabel(purpose, row)} · {historyDate(row.closedAt ?? row.createdAt)}</T>
    {row.titleSource === 'LINKED_TASK_TITLE' ? <T variant="meta" tone="muted">Naziv povezanog zadatka</T> : null}
    {detail ? <T variant="note" tone="muted">{detail}</T> : null}
    {action ? <T variant="note" tone="green" style={s.action}>{action}</T> : null}
  </Press>;
});

function HistoryFailure({ offline, compact = false, onRetry }: { offline: boolean; compact?: boolean; onRetry: () => void }) {
  return <View style={[s.state, compact && s.compactState]} accessibilityLiveRegion="polite">
    <Glyph name={offline ? 'remote' : 'info'} size={24} tone="warn" />
    <T variant="bodyStrong">{offline ? 'Nema veze sa serverom.' : 'Istorija trenutno nije dostupna.'}</T>
    <T variant="note" tone="muted">{offline ? 'Proverite vezu i pokušajte ponovo.' : 'Pokušajte ponovo malo kasnije.'}</T>
    <V2Action label="Pokušajte ponovo" onPress={onRetry} style={s.retry} />
  </View>;
}

const s = StyleSheet.create({
  screen: { flex: 1, gap: 16, paddingBottom: 12 },
  intro: { gap: 4 },
  tabs: { flexDirection: 'row', gap: 8, backgroundColor: sys.color.surface, borderRadius: 18, padding: 4 },
  tab: { flex: 1, minHeight: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
  tabSelected: { backgroundColor: sys.color.greenSoft },
  tabLabel: { textAlign: 'center', fontWeight: '600' },
  panes: { flex: 1, minHeight: 0 }, pane: { flex: 1 }, hidden: { display: 'none' },
  listArea: { flex: 1, gap: 12 }, listFlex: { flex: 1 }, listHeading: { paddingHorizontal: 4 },
  listContent: { gap: 12, paddingBottom: 24 }, emptyFill: { flexGrow: 1 },
  row: { backgroundColor: sys.color.surface, borderWidth: 1, borderColor: sys.color.cardLine,
    borderRadius: 20, padding: 16, minHeight: 96, gap: 7 },
  rowTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  rowTitle: { flex: 1, minWidth: 0 }, action: { fontWeight: '600' },
  state: { flex: 1, minHeight: 220, alignItems: 'center', justifyContent: 'center', gap: 10,
    paddingHorizontal: 20, paddingVertical: 24 },
  compactState: { minHeight: 0, flex: 0, backgroundColor: sys.color.surface, borderRadius: 18 },
  retry: { alignSelf: 'stretch', marginTop: 6 }, footer: { gap: 12, paddingTop: 4 },
});
