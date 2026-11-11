import { useCallback, useMemo, useSyncExternalStore } from 'react';
import { AppState } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { createFocusedResource, type FocusedResourceOptions } from '../data/focusedResource';
import { sesijaSada, useSesija } from '../store/sesija';


export function useFocusedResource<T>(load: (signal: AbortSignal) => Promise<T>, options: FocusedResourceOptions = {}) {
  const { user, accountRevision } = useSesija();
  const accountId = user?.id;
  const model = useMemo(() => createFocusedResource(load,
    () => !!accountId && sesijaSada().user?.id === accountId &&
      sesijaSada().accountRevision === accountRevision, options),
  [load, accountId, accountRevision, options.retainOnRefresh, options.coalesce]);
  const state = useSyncExternalStore(model.subscribe, model.snapshot, model.snapshot);
  useFocusEffect(useCallback(() => {
    // Preserve startup behavior when RN has not reported an initial state yet,
    // but never start a known-background read. Every pause retires its generation.
    if (AppState.currentState !== 'background' && AppState.currentState !== 'inactive') model.start();
    const subscription = AppState.addEventListener('change', value => {
      // Leaving the app is not the same as leaving the screen: the recents switcher photographs
      // whatever is on it, so that one forgets, and moving between screens does not.
      if (value === 'active') model.start();
      else model.forget();
    });
    return () => { subscription.remove(); model.stop(); };
  }, [model]));
  return { ...state, refresh: model.refresh };
}
