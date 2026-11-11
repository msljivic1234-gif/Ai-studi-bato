import { useCallback, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { workerExecutionModeClientService, type WorkerExecutionMode } from '../data/workerExecutionModeClientService';
import { sesijaSada, useSesija } from '../store/sesija';
import type { WorkerSavedService } from '../contracts/workerSavedServices';

/** Display consent only. This receipt grants no category or matching authority. */
export type WorkerExecutionModeView = { kind: 'loading' | 'unavailable' }
  | { kind: 'unconfirmed'; services?: readonly WorkerSavedService[] }
  | { kind: 'confirmed'; modes: readonly WorkerExecutionMode[]; services?: readonly WorkerSavedService[] };

/** A fresh owned read on focus and after a profile readback; never retain a previous visit's area claim. */
export function useWorkerExecutionModes(profileId: string | null, profileRead = 0) {
  const { user, accountRevision } = useSesija();
  const accountId = user?.id;
  const key = `${accountId}:${accountRevision}:${profileId}:${profileRead}`;
  const [state, setState] = useState<{ key: string; view: WorkerExecutionModeView }>({ key, view: { kind: 'loading' } });
  const refreshRef = useRef<() => void>(() => undefined);
  useFocusEffect(useCallback(() => {
    let alive = true, request = 0;
    const owned = () => alive && !!accountId && sesijaSada().user?.id === accountId
      && sesijaSada().accountRevision === accountRevision;
    const read = () => {
      const turn = ++request;
      setState({ key, view: { kind: 'loading' } });
      if (!owned() || !profileId || AppState.currentState === 'background' || AppState.currentState === 'inactive') return;
      void workerExecutionModeClientService.read(accountId!, accountRevision).then(receipt => {
        if (!owned() || turn !== request) return;
        const details = receipt.services ? { services: receipt.services } : {};
        setState({ key, view: receipt.workerProfileId !== profileId ? { kind: 'unavailable' }
          : receipt.confirmed ? { kind: 'confirmed', modes: receipt.modes, ...details } : { kind: 'unconfirmed', ...details } });
      }).catch(() => { if (owned() && turn === request) setState({ key, view: { kind: 'unavailable' } }); });
    };
    refreshRef.current = read;
    read();
    const subscription = AppState.addEventListener('change', next => {
      if (next === 'active') read();
      else { request++; setState({ key, view: { kind: 'loading' } }); }
    });
    return () => {
      alive = false; request++; refreshRef.current = () => undefined; subscription.remove();
      setState({ key, view: { kind: 'loading' } });
    };
  }, [accountId, accountRevision, profileId, profileRead, key]));
  return { view: state.key === key ? state.view : { kind: 'loading' } as WorkerExecutionModeView,
    refresh: useCallback(() => refreshRef.current(), []) };
}
