import { useCallback, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { sesijaSada, useSesija } from '../../store/sesija';

import { initialSupportState, SupportController, type SupportTarget } from './SupportController';

export function useSupportController(target: SupportTarget) {
  const { user, accountRevision } = useSesija(), accountId = user?.id ?? '';
  const identity = target.type === 'DETAIL' ? `DETAIL:${target.caseId}` : target.type === 'INBOX' ? `INBOX:${target.mode}` : 'NEW';
  const [state, setState] = useState(initialSupportState), [epoch, setEpoch] = useState(0);
  const owner = useRef<{ id: number; accountId: string; accountRevision: number; identity: string } | null>(null), generation = useRef(0);
  const engine = useRef<SupportController | null>(null), leaving = useRef(false);
  useFocusEffect(useCallback(() => {
    const token = { id: ++generation.current, accountId, accountRevision, identity }; owner.current = token; leaving.current = false; setState(initialSupportState);
    const current = () => owner.current === token && !leaving.current && !!accountId
      && !['background', 'inactive'].includes(AppState.currentState)
      && sesijaSada().user?.id === accountId && sesijaSada().accountRevision === accountRevision;
    const controller = new SupportController({ target, scope: { accountId, accountRevision, isCurrent: current } });
    engine.current = controller;
    const unsubscribe = controller.subscribe(() => { if (current()) setState(controller.snapshot()); });
    if (current()) void controller.load();
    const listener = AppState.addEventListener('change', next => {
      if (next !== 'active') { controller.dispose(); owner.current = null; setState(initialSupportState); }
      else setEpoch(value => value + 1);
    });
    return () => {
      listener.remove(); unsubscribe(); controller.dispose();
      if (owner.current === token) owner.current = null;
      if (engine.current === controller) engine.current = null;
      setState(initialSupportState);
    };
  // Target identity encodes every route input. A new focus creates a new owner
  // token; no promise from the previous screen may update this one.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [identity, accountId, accountRevision, epoch]));
  const candidate = owner.current;
  const renderedOwner = candidate?.accountId === accountId && candidate.accountRevision === accountRevision && candidate.identity === identity ? candidate : null;
  const controller = engine.current;
  const current = () => renderedOwner !== null && renderedOwner === owner.current && engine.current === controller
    && !!accountId && !leaving.current && controller?.snapshot() === state
    && !['background', 'inactive'].includes(AppState.currentState)
    && sesijaSada().user?.id === accountId && sesijaSada().accountRevision === accountRevision;
  const navigate = (action: () => void) => {
    if (!current()) return;
    leaving.current = true; controller?.dispose(); setState(initialSupportState); action();
  };
  return { state: renderedOwner === null ? initialSupportState : state, controller, current, navigate, accountId, accountRevision,
    incarnation: renderedOwner, incarnationId: renderedOwner?.id ?? null, focused: renderedOwner !== null };
}
