import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, View } from 'react-native';
import type { ListRenderItemInfo } from 'react-native';
import { listAiHistoryMessages, type AiHistoryMessage, type AiHistoryMessageCursor } from '../../data/aiHistoryMessagesClientService';
import type { AiHistoryPurpose, AiHistoryRow } from '../../data/aiHistoryClientService';
import { sesijaSada } from '../../store/sesija';
import { T } from '../Text';
import { AccountHeader } from '../profile/AccountHeader';
import { Screen } from '../system/Screen';
import { sys } from '../system/tokens';
import { V2Action } from '../v2/V2Action';
import { historyDate, historyStatusLabel } from './historyUiModel';

type Phase = 'loading' | 'ready' | 'loadingMore' | 'error' | 'offline';
type TranscriptState = { messages: AiHistoryMessage[]; cursor: AiHistoryMessageCursor | null;
  phase: Phase; loaded: boolean; moreFailed: boolean };
const initial = (): TranscriptState => ({ messages: [], cursor: null, phase: 'loading', loaded: false, moreFailed: false });

/** Closed text only. No composer, draft, review, save, publish or account write is mounted here. */
export function AiHistoryTranscriptScreen({ purpose, row, accountId, accountRevision, focused, onBack }: {
  purpose: AiHistoryPurpose; row: AiHistoryRow; accountId: string; accountRevision: number;
  focused: boolean; onBack: () => void;
}) {
  const [state, setState] = useState<TranscriptState>(initial);
  const stateRef = useRef(state), request = useRef(0), focusedRef = useRef(focused);
  const list = useRef<FlatList<AiHistoryMessage>>(null), scrollToLatest = useRef(false);
  focusedRef.current = focused;
  const commit = useCallback((next: TranscriptState) => { stateRef.current = next; setState(next); }, []);
  const owns = useCallback(() => sesijaSada().user?.id === accountId
    && sesijaSada().accountRevision === accountRevision, [accountId, accountRevision]);
  const load = useCallback(async (older: boolean) => {
    if (!focusedRef.current || !owns() || row.status === 'OPEN' || !row.canRead) return;
    const previous = stateRef.current;
    if (older && !previous.cursor) return;
    const before = older ? previous.cursor : null;
    const flight = ++request.current;
    commit({ ...previous, phase: older ? 'loadingMore' : 'loading', moreFailed: false });
    const result = await listAiHistoryMessages(purpose, row.conversationId, before);
    if (request.current !== flight || !focusedRef.current || !owns()) return;
    if (!result.ok) {
      commit({ ...stateRef.current, phase: result.kod === 'AI_HISTORY_MESSAGES_OFFLINE' ? 'offline' : 'error',
        moreFailed: older });
      return;
    }
    // A conversation that changed after H1 admission must be reopened from the list.
    if (result.podatak.status !== row.status) {
      commit({ ...stateRef.current, phase: 'error', moreFailed: older });
      return;
    }
    const incoming = [...result.podatak.rows].reverse();
    const existing = new Set(stateRef.current.messages.map(message => message.id.toLowerCase()));
    if (older && incoming.some(message => existing.has(message.id.toLowerCase()))) {
      commit({ ...stateRef.current, phase: 'error', moreFailed: true });
      return;
    }
    if (!older) scrollToLatest.current = true;
    commit({ messages: older ? [...incoming, ...stateRef.current.messages] : incoming,
      cursor: result.podatak.nextBeforeMessageId, phase: 'ready', loaded: true, moreFailed: false });
  }, [commit, owns, purpose, row]);

  useEffect(() => {
    if (focused && owns()) {
      if (stateRef.current !== state) commit(stateRef.current);
      if (!stateRef.current.loaded) void load(false);
    }
    return () => {
      request.current++;
      const current = stateRef.current;
      if (current.phase === 'loading' || current.phase === 'loadingMore')
        stateRef.current = { ...current, phase: current.loaded ? 'ready' : 'loading' };
    };
  }, [focused, commit, load, owns]);

  const renderMessage = useCallback(({ item }: ListRenderItemInfo<AiHistoryMessage>) =>
    <View style={[s.message, item.role === 'USER' ? s.mine : s.assistant]}>
      <T variant="meta" tone={item.role === 'USER' ? 'onGreen' : 'muted'}>
        {item.role === 'USER' ? 'Ti' : 'USKOČI AI'}</T>
      <T tone={item.role === 'USER' ? 'onGreen' : 'ink'} selectable>{item.body}</T>
    </View>, []);
  const failed = state.phase === 'error' || state.phase === 'offline';
  return <Screen kind="detail" background="wash" scroll={false} contentStyle={s.screen}
    header={<AccountHeader title="Sačuvan razgovor" onBack={onBack} />}>
    <View style={s.intro}>
      <T variant="title" accessibilityRole="header">{row.title}</T>
      <T variant="meta" tone="muted">{historyStatusLabel(purpose, row)} · {historyDate(row.closedAt ?? row.createdAt)}</T>
      <T variant="note" tone="muted">Prikazan je sačuvan tekst poruka. Fotografije, nacrt i pregled nisu deo ovog zapisa.</T>
    </View>
    {state.phase === 'loading' && !state.loaded ? <View style={s.state} accessibilityState={{ busy: true }}>
      <ActivityIndicator color={sys.color.green} />
      <T variant="bodyStrong">Učitavamo razgovor…</T>
    </View> : failed && !state.loaded ? <TranscriptFailure offline={state.phase === 'offline'} onRetry={() => { void load(false); }} />
      : <FlatList ref={list} style={s.listFlex} data={state.messages} renderItem={renderMessage} keyExtractor={message => message.id}
        contentContainerStyle={[s.messages, state.messages.length === 0 && s.emptyFill]}
        maintainVisibleContentPosition={{ minIndexForVisible: 0 }}
        onContentSizeChange={() => {
          if (scrollToLatest.current && stateRef.current.loaded) {
            scrollToLatest.current = false;
            list.current?.scrollToEnd({ animated: false });
          }
        }}
        ListHeaderComponent={<View style={s.older}>
          {failed ? <TranscriptFailure offline={state.phase === 'offline'} compact
            onRetry={() => { void load(state.moreFailed); }} /> : null}
          {state.cursor && !failed ? <V2Action label="Učitaj starije poruke" loading={state.phase === 'loadingMore'}
            onPress={() => { void load(true); }} /> : null}
          {!state.cursor && !failed && state.loaded && state.messages.length > 0
            ? <T variant="meta" tone="muted" style={s.beginning}>Početak sačuvanog razgovora</T> : null}
        </View>}
        ListEmptyComponent={<View style={s.state}>
          <T variant="bodyStrong">Nema sačuvanih tekstualnih poruka.</T>
        </View>}
        initialNumToRender={16} maxToRenderPerBatch={16} windowSize={9} />}
  </Screen>;
}

function TranscriptFailure({ offline, compact = false, onRetry }: { offline: boolean; compact?: boolean; onRetry: () => void }) {
  return <View style={[s.state, compact && s.compactState]} accessibilityLiveRegion="polite">
    <T variant="bodyStrong">{offline ? 'Nema veze sa serverom.' : 'Razgovor trenutno nije dostupan.'}</T>
    <T variant="note" tone="muted">{offline ? 'Proveri vezu i pokušaj ponovo.' : 'Pokušaj ponovo ili se vrati na istoriju.'}</T>
    <V2Action label="Pokušaj ponovo" onPress={onRetry} style={s.retry} />
  </View>;
}

const s = StyleSheet.create({
  screen: { flex: 1, gap: 14, paddingBottom: 12 },
  listFlex: { flex: 1 },
  intro: { gap: 5, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: sys.color.line },
  messages: { gap: 12, paddingBottom: 24 }, emptyFill: { flexGrow: 1 },
  message: { padding: 14, borderRadius: 18, gap: 6, maxWidth: '88%' },
  mine: { alignSelf: 'flex-end', backgroundColor: sys.color.green },
  assistant: { alignSelf: 'flex-start', backgroundColor: sys.color.surface, borderWidth: 1, borderColor: sys.color.cardLine },
  older: { gap: 10, marginBottom: 4, minHeight: 48 },
  beginning: { minHeight: 48, textAlign: 'center', textAlignVertical: 'center' },
  state: { flex: 1, minHeight: 200, alignItems: 'center', justifyContent: 'center', gap: 10, padding: 20 },
  compactState: { minHeight: 0, flex: 0, backgroundColor: sys.color.surface, borderRadius: 18 },
  retry: { alignSelf: 'stretch', marginTop: 4 },
});
