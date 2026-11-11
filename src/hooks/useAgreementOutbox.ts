import { useCallback, useMemo, useRef, useSyncExternalStore } from 'react';
import { useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createAgreementOutbox } from '../data/agreementOutbox';
import { agreementMessageClientService } from '../data/agreementMessageClientService';
import { noviZahtevId } from '../lib/idempotencija';
import { sesijaSada, useSesija } from '../store/sesija';


/** `voice` keeps the voice-message intents in their own journal keys (older builds never read them); everything else is identical. */
function useOutbox(accountId: string, agreementId: string, canSendNew: boolean, namespace: 'text' | 'voice') {
  const accountRevision = useSesija().accountRevision;
  const writable = useRef(canSendNew);
  writable.current = canSendNew;
  const model = useMemo(() => createAgreementOutbox({
    accountId, agreementId, storage: AsyncStorage, messagePort: agreementMessageClientService,
    namespace, newId: () => noviZahtevId(namespace === 'voice' ? 'glas' : 'poruka'),
    isCurrent: () => sesijaSada().user?.id === accountId && sesijaSada().accountRevision === accountRevision,
    canSendNew: () => writable.current,
  }), [accountId, agreementId, accountRevision, namespace]);
  const state = useSyncExternalStore(model.subscribe, model.getSnapshot, model.getSnapshot);
  useFocusEffect(useCallback(() => {
    void model.start();
    return () => model.stop();
  }, [model]));
  return { model, state };
}

export const useAgreementOutbox = (accountId: string, agreementId: string, canSendNew: boolean) => useOutbox(accountId, agreementId, canSendNew, 'text');
export const useAgreementVoiceOutbox = (accountId: string, agreementId: string, canSendNew: boolean) => useOutbox(accountId, agreementId, canSendNew, 'voice');
