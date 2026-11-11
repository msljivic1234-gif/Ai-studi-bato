import { useCallback } from 'react';
import { router, useFocusEffect } from 'expo-router';
import { rememberAiCorrection } from '../../data/aiCorrectionIntent';
import { useSesija } from '../../store/sesija';
import { QuietReadState } from '../v2/QuietReadState';
import { WorkerProfileFrame } from './WorkerProfilePresentation';

/** Compatibility entry for old links: a local owned topic, never a profile write or AI message. */
export function WorkerAiTopicEntry({ part }: { part: 'area' | 'time' }) {
  const { user, accountRevision } = useSesija();
  const accountId = user?.id;
  useFocusEffect(useCallback(() => {
    if (!accountId) return;
    const correction = rememberAiCorrection({ accountId, accountRevision }, `worker.${part}`);
    // This screen lives in Tabs: its adapter supports REPLACE, not stack-only POP_TO.
    // Reuse the conversation route and leave the compatibility address out of Back history.
    if (correction) router.replace({ pathname: '/profil/razgovor', params: { aiCorrection: correction.token } });
  }, [accountId, accountRevision, part]));
  return <WorkerProfileFrame title={part === 'time' ? 'Dostupnost' : 'Područje rada'}
    back={() => router.canGoBack() ? router.back() : router.replace('/profil')}>
    <QuietReadState art="chat" title="Otvaramo razgovor…" body="Pripremamo Vaš radni profil za izmenu." />
  </WorkerProfileFrame>;
}
