import { useCallback, useMemo, useSyncExternalStore } from 'react';
import { AppState } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { createAgreementHistoryModel, type AgreementHistoryPosition } from '../data/agreementHistoryModel';
import { agreementMessageHistoryService } from '../data/agreementMessageHistoryService';
import { sesijaSada } from '../store/sesija';

export function useAgreementHistory(accountId: string, accountRevision: number, agreementId: string,
  readingPosition: { current: AgreementHistoryPosition }) {
  const model = useMemo(() => createAgreementHistoryModel({ account: { accountId, accountRevision }, agreementId,
    port: agreementMessageHistoryService, position: () => readingPosition.current,
    isCurrent: () => sesijaSada().user?.id === accountId && sesijaSada().accountRevision === accountRevision,
  }), [accountId, accountRevision, agreementId, readingPosition]);
  const state = useSyncExternalStore(model.subscribe, model.snapshot, model.snapshot);
  useFocusEffect(useCallback(() => {
    let foreground = AppState.currentState !== 'background' && AppState.currentState !== 'inactive';
    if (foreground) model.start();
    const subscription = AppState.addEventListener('change', value => {
      const nextForeground = value === 'active';
      // A duplicate foreground event is not a restore request; keep the current transcript/read owner.
      if (nextForeground && foreground) return;
      foreground = nextForeground;
      if (nextForeground) model.start(); else model.forget();
    });
    return () => { subscription.remove(); model.stop(); };
  }, [model]));
  return { ...state, refresh: model.refresh, loadOlder: model.loadOlder, loadNewer: model.loadNewer, showLatest: model.showLatest };
}
