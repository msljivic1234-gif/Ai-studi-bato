import { useCallback, useEffect, useMemo, useSyncExternalStore } from 'react';
import { AppState, Platform } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { createConversationInboxModel } from '../data/conversationInboxModel';
import { createConversationInboxClientService } from '../data/conversationInboxClientService';
import { createAgreementIncomingRefresh, subscribeAgreementIncomingRefresh } from '../data/agreementIncomingRefresh';
import { subscribeInboxAgreementInvalidations } from '../data/agreementInvalidationService';
import { publicInboxNotificationId } from '../ui/notifications/publicInboxCopy';
import { sesijaSada, useSesija } from '../store/sesija';

export function useConversationInbox() {
  const { user, accountRevision, sessionEpoch } = useSesija();
  const accountId = user?.id ?? '';
  const model = useMemo(() => {
    const current = () => !!accountId && sesijaSada().user?.id === accountId
      && sesijaSada().accountRevision === accountRevision;
    return createConversationInboxModel(createConversationInboxClientService({ accountId, accountRevision }, { isCurrent: current }), current);
  }, [accountId, accountRevision]);
  const state = useSyncExternalStore(model.subscribe, model.snapshot, model.snapshot);
  // Tabs remain mounted while another route owns focus. Clear private previews on background
  // even when the inbox is blurred; this observer never starts reads or notification listeners.
  useEffect(() => {
    const subscription = AppState.addEventListener('change', value => {
      if (value !== 'active') model.forget();
    });
    return () => subscription.remove();
  }, [model]);
  useFocusEffect(useCallback(() => {
    let alive = true, foreground = !AppState.currentState || AppState.currentState === 'active';
    let stopIncoming: (() => void) | undefined;
    let stopRealtime: (() => void) | undefined;
    let coordinator: ReturnType<typeof createAgreementIncomingRefresh> | undefined;
    const current = () => {
      const session = sesijaSada();
      return alive && foreground && AppState.currentState === 'active' && !!accountId
        && session.user?.id === accountId && session.accountRevision === accountRevision
        && session.sessionEpoch === sessionEpoch;
    };
    const stopHints = () => {
      coordinator?.stop(); coordinator = undefined;
      stopIncoming?.(); stopIncoming = undefined;
      stopRealtime?.(); stopRealtime = undefined;
    };
    const listen = () => {
      stopHints();
      if (!current() || (Platform.OS !== 'ios' && Platform.OS !== 'android')) return;
      coordinator = createAgreementIncomingRefresh({ refresh: model.revalidate, isCurrent: current });
      stopRealtime = subscribeInboxAgreementInvalidations({
        accountId, accountRevision, sessionEpoch, isCurrent: current,
        refresh: model.revalidate, onHint: coordinator.hint,
      });
      stopIncoming = subscribeAgreementIncomingRefresh({
        load: () => import('expo-notifications'), identifier: publicInboxNotificationId,
        refresh: model.revalidate, isCurrent: current, onHint: coordinator.hint,
      });
    };
    if (foreground) { void model.start(); listen(); }
    const subscription = AppState.addEventListener('change', value => {
      foreground = value === 'active';
      if (foreground) { void model.start(); listen(); }
      else { stopHints(); model.forget(); }
    });
    return () => { alive = false; stopHints(); subscription.remove(); model.stop(); };
  }, [model, accountId, accountRevision, sessionEpoch]));
  return { state, model };
}
