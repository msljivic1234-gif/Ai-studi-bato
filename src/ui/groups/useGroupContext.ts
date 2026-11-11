import { useCallback, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { groupConversationService, type GroupContext } from '../../data/groupConversationService';
import { sesijaSada, useSesija } from '../../store/sesija';

/** One authorized roster read for the overview and its private chat; no peer-to-peer messaging authority. */
export function useGroupContext(agreementId: string, enabled = true) {
  const session = useSesija(), accountId = session.user?.id ?? '', revision = session.accountRevision;
  const [context, setContext] = useState<GroupContext | null>(null), [error, setError] = useState(false), [epoch, setEpoch] = useState(0);
  const owner = useRef<object | null>(null), latest = useRef<GroupContext | null>(null);
  const paging = useRef<object | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  useFocusEffect(useCallback(() => {
    setContext(null); latest.current = null; setError(false); paging.current = null; setLoadingMore(false);
    if (!enabled) { owner.current = null; return; }
    const scope = {}; owner.current = scope;
    const current = () => owner.current === scope && !['inactive', 'background'].includes(AppState.currentState)
      && sesijaSada().user?.id === accountId && sesijaSada().accountRevision === revision;
    void groupConversationService.context(agreementId, { accountId, accountRevision: revision }).then(result => {
      if (!current()) return;
      if (result.ok) { latest.current = result.podatak; setContext(result.podatak); }
      else setError(true);
    }).catch(() => { if (current()) setError(true); });
    const listener = AppState.addEventListener('change', next => {
      if (next !== 'active') { owner.current = null; latest.current = null; setContext(null); }
      else setEpoch(value => value + 1);
    });
    return () => { listener.remove(); if (owner.current === scope) owner.current = null; };
  }, [agreementId, accountId, revision, epoch, enabled]));
  const renderedOwner = owner.current;
  const current = () => enabled && renderedOwner !== null && owner.current === renderedOwner && latest.current === context
    && !['inactive', 'background'].includes(AppState.currentState) && sesijaSada().user?.id === accountId && sesijaSada().accountRevision === revision;
  const more = async () => {
    const group = context?.group;
    if (!current() || paging.current || group?.role !== 'REQUESTER' || !group.managementNextId) return;
    const request = {}; paging.current = request; setLoadingMore(true); setError(false);
    try {
      const result = await groupConversationService.context(agreementId, { accountId, accountRevision: revision }, group.managementNextId);
      if (!current() || paging.current !== request) return;
      if (!result.ok) { setError(true); return; }
      const next = result.podatak.group;
      if (!next || next.groupId !== group.groupId || next.role !== 'REQUESTER' || result.podatak.needId !== context?.needId) {
        latest.current = null; setContext(null); setError(true); return;
      }
      const management = [...new Map([...(group.management ?? []), ...(next.management ?? [])].map(item => [item.agreementId, item])).values()];
      const merged = { ...result.podatak, group: { ...next, management } };
      latest.current = merged; setContext(merged);
    } catch { if (current()) setError(true); }
    finally { if (paging.current === request) { paging.current = null; setLoadingMore(false); } }
  };
  return { context: current() ? context : null, error: current() && error, current, more, loadingMore,
    refresh: () => { if (current()) setEpoch(value => value + 1); } };
}
export type GroupContextModel = ReturnType<typeof useGroupContext>;
