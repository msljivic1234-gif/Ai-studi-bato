import { useCallback, useEffect, useRef } from 'react';
import { BackHandler } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { sesijaSada, useSesija } from '../store/sesija';
import { useConfirmSheet } from '../ui/system/ConfirmSheet';

type LeaveState = { dirty: boolean; busy: boolean; uncertain: boolean; revision: string | number | null; onBack: () => void };
const asks = (state: LeaveState) => state.dirty && !state.busy && !state.uncertain;

/** Both profile editors ask before dropping a local draft. An unconfirmed write is not an unsaved draft. */
export function useUnsavedProfileBack(state: LeaveState) {
  const { user, accountRevision } = useSesija(), accountId = user?.id;
  const confirmation = useConfirmSheet(), close = confirmation.close;
  const focus = useRef<object | null>(null), question = useRef<object | null>(null);
  const latest = useRef(state); latest.current = state;
  const current = (visit: object | null) => visit !== null && focus.current === visit && !!accountId
    && sesijaSada().user?.id === accountId && sesijaSada().accountRevision === accountRevision;
  const exit = (visit: object | null) => {
    if (!current(visit)) return;
    focus.current = null; question.current = null; close(); latest.current.onBack();
  };
  const back = () => {
    const visit = focus.current;
    if (!current(visit)) return;
    if (!asks(latest.current)) { exit(visit); return; }
    if (question.current) return;
    const token = {}, revision = latest.current.revision; question.current = token;
    confirmation.ask({ title: 'Odbaciti izmene?', message: 'Unete izmene neće biti sačuvane.',
      confirmLabel: 'Odbaci izmene', cancelLabel: 'Nastavi uređivanje', tone: 'danger',
      onCancel: () => { if (question.current === token) question.current = null; },
      onConfirm: () => {
        if (question.current !== token || !current(visit) || latest.current.revision !== revision || !asks(latest.current)) return;
        exit(visit);
      } });
  };
  const latestBack = useRef(back); latestBack.current = back;
  useFocusEffect(useCallback(() => {
    const visit = {}; focus.current = visit;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (focus.current !== visit || !asks(latest.current)) return false;
      latestBack.current(); return true;
    });
    return () => {
      subscription.remove();
      if (focus.current === visit) focus.current = null;
      question.current = null; close();
    };
  }, [accountId, accountRevision, close]));
  // A new saved revision or save outcome retires the old question, never confirms it.
  useEffect(() => { question.current = null; close(); }, [state.revision, state.dirty, state.busy, state.uncertain, close]);
  return { back, sheet: confirmation.sheet };
}
