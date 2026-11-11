import { useCallback, useMemo, useSyncExternalStore } from 'react';
import { AppState } from 'react-native';
import { useFocusEffect } from 'expo-router';
import type { InboxRole } from '../contracts/inbox';
import { createInboxModel } from '../data/inboxModel';
import { inboxClientService } from '../data/inboxClientService';
import { activityMessageTargetService } from '../data/activityMessageTargetService';
import { activityApplicationTargetService } from '../data/activityApplicationTargetService';
import { sesijaSada, useSesija } from '../store/sesija';

export function useInbox(role: InboxRole | null) {
  const {user, accountRevision} = useSesija();
  const accountId = user?.id;
  const model = useMemo(() => createInboxModel(inboxClientService,role,
    () => !!accountId && sesijaSada().user?.id===accountId && sesijaSada().accountRevision===accountRevision,
    async (eventId,signal) => {
      if (!accountId) throw new Error('AUTH_REQUIRED');
      const result = await activityMessageTargetService.resolve(eventId,{signal},{accountId,accountRevision});
      if (!result.ok) throw new Error(result.kod);
      const target = result.podatak;
      return target.kind === 'UNAVAILABLE' ? {kind:'UNAVAILABLE'} : target.kind === 'GROUP_MESSAGE'
        ? {kind:'GROUP_MESSAGE',id:target.agreementId,groupId:target.groupId,messageId:target.messageId,sequence:target.sequence,eventId:target.eventId,role:target.role} : {
        kind:'AGREEMENT_MESSAGE',id:target.agreementId,messageId:target.messageId,eventId:target.eventId,role:target.role,
      };
    }, async (eventId, needId, signal) => {
      if (!accountId) return { kind: 'CANDIDATES', id: needId, role: 'REQUESTER' };
      const result = await activityApplicationTargetService.resolve(eventId, needId, signal, { accountId, accountRevision });
      // The legacy authorized Need remains a safe landing when direct owned-event
      // SELECT is unavailable; never guess which of several applications arrived.
      return result.ok ? { kind: 'CANDIDATE', id: needId, responseId: result.podatak.responseId, role: 'REQUESTER' }
        : { kind: 'CANDIDATES', id: needId, role: 'REQUESTER' };
    }),[accountId,accountRevision,role]);
  const state = useSyncExternalStore(model.subscribe,model.snapshot,model.snapshot);
  useFocusEffect(useCallback(() => {
    if (!AppState.currentState || AppState.currentState==='active') model.start();
    const sub = AppState.addEventListener('change', value => {
      if (value==='active') model.start(); else model.stop();
    });
    return () => {sub.remove(); model.stop();};
  },[model]));
  return {state,model};
}
