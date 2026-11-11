import { useCallback, useRef, useState } from 'react';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import type { AiHistoryPurpose, AiHistoryRow } from '../../../data/aiHistoryClientService';
import { sesijaSada, useSesija } from '../../../store/sesija';
import { AiHistoryListScreen } from '../../../ui/aiHistory/AiHistoryListScreen';
import { admitClosedHistory } from '../../../ui/aiHistory/historyUiModel';

export default function AiHistoryRoute() {
  const session = useSesija();
  const params = useLocalSearchParams<{ purpose?: string | string[] }>();
  const initialPurpose: AiHistoryPurpose = params.purpose === 'PROFILE' ? 'PROFILE' : 'NEED_INTAKE';
  return <OwnedHistory key={`${session.user?.id ?? 'signed-out'}:${session.accountRevision}`}
    accountId={session.user?.id} accountRevision={session.accountRevision} initialPurpose={initialPurpose} />;
}

function OwnedHistory({ accountId, accountRevision, initialPurpose }: {
  accountId: string | undefined; accountRevision: number; initialPurpose: AiHistoryPurpose;
}) {
  const focus = useRef<object | null>(null), navigating = useRef(false);
  const [focused, setFocused] = useState(false);
  useFocusEffect(useCallback(() => {
    const token = {}; focus.current = token; navigating.current = false; setFocused(true);
    return () => { if (focus.current === token) focus.current = null; setFocused(false); };
  }, []));
  const owns = () => !!focus.current && !!accountId && sesijaSada().user?.id === accountId
    && sesijaSada().accountRevision === accountRevision;
  const back = () => {
    if (!owns() || navigating.current) return;
    navigating.current = true;
    if (router.canGoBack()) router.back(); else router.replace('/profil/podesavanja');
  };
  const open = (purpose: AiHistoryPurpose, row: AiHistoryRow) => {
    if (!owns() || navigating.current) return;
    if (row.status === 'OPEN') {
      if (!row.canContinue) return;
      navigating.current = true;
      // The existing editors own pending-turn journal reconciliation and final write admission.
      if (purpose === 'NEED_INTAKE') router.push({ pathname: '/nova', params: { conversationId: row.conversationId } });
      else router.push({ pathname: '/profil/razgovor', params: { conversationId: row.conversationId } });
      return;
    }
    if (!admitClosedHistory(purpose, row)) return;
    navigating.current = true;
    router.push({ pathname: '/ai-istorija/[conversationId]', params: { conversationId: row.conversationId, purpose } });
  };
  return <AiHistoryListScreen accountId={accountId} accountRevision={accountRevision} focused={focused}
    initialPurpose={initialPurpose} onBack={back} onOpen={open} />;
}
