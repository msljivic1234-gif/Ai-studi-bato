import { useCallback, useEffect, useState } from 'react';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import type { AiHistoryPurpose } from '../../../data/aiHistoryClientService';
import { uuid } from '../../../data/serverReceipt';
import { useSesija } from '../../../store/sesija';
import { AiHistoryTranscriptScreen } from '../../../ui/aiHistory/AiHistoryTranscriptScreen';
import { admittedClosedHistory, retireClosedHistory } from '../../../ui/aiHistory/historyUiModel';
import { AccountHeader } from '../../../ui/profile/AccountHeader';
import { Screen } from '../../../ui/system/Screen';
import { T } from '../../../ui/Text';
import { V2Action } from '../../../ui/v2/V2Action';

export default function AiHistoryTranscriptRoute() {
  const session = useSesija(), params = useLocalSearchParams<{ conversationId?: string | string[]; purpose?: string | string[] }>();
  const purpose: AiHistoryPurpose | null = params.purpose === 'NEED_INTAKE' || params.purpose === 'PROFILE' ? params.purpose : null;
  const conversationId = typeof params.conversationId === 'string' && uuid(params.conversationId) ? params.conversationId : null;
  const row = purpose && conversationId ? admittedClosedHistory(purpose, conversationId) : null;
  const [focused, setFocused] = useState(false);
  useFocusEffect(useCallback(() => { setFocused(true); return () => setFocused(false); }, []));
  useEffect(() => () => retireClosedHistory(), []);
  const back = () => {
    if (router.canGoBack()) router.back();
    else router.replace({ pathname: '/ai-istorija', params: { purpose: purpose ?? 'NEED_INTAKE' } });
  };
  // A raw CID or an H1 row without canRead never mounts H2, even if an H2 RPC exists.
  if (!row || !purpose || !session.user?.id) return <Screen kind="detail" background="wash"
    header={<AccountHeader title="AI razgovori" onBack={back} />}>
    <View style={s.unavailable}>
      <T variant="title" accessibilityRole="header">Razgovor nije dostupan za pregled.</T>
      <T variant="note" tone="muted">Vrati se na svoju istoriju i proveri dostupne razgovore.</T>
      <V2Action label="Nazad na istoriju" onPress={back} />
    </View>
  </Screen>;
  return <AiHistoryTranscriptScreen purpose={purpose} row={row} accountId={session.user.id}
    accountRevision={session.accountRevision} focused={focused} onBack={back} />;
}

const s = StyleSheet.create({ unavailable: { gap: 12, paddingVertical: 32 } });
