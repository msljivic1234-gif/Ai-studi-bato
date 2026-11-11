import { useCallback, useRef } from 'react';
import { AppState, Platform } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { createAgreementIncomingRefresh, subscribeAgreementIncomingRefresh } from '../data/agreementIncomingRefresh';
import { subscribeAgreementInvalidations } from '../data/agreementInvalidationService';
import type { Izvor } from '../data/ports';
import { sesijaSada, useSesija } from '../store/sesija';
import { publicInboxNotificationId } from '../ui/notifications/publicInboxCopy';

/** Foreground incoming hints complement the focused resource's existing focus /
 * foreground re-read. No permission prompt, registration, polling or read receipt.
 */
export function useAgreementIncomingRefresh({ accountId, accountRevision, agreementId, enabled, source, refresh }: {
  accountId: string; accountRevision: number; agreementId: string; enabled: boolean;
  source: Pick<Izvor, 'poreklo'>; refresh: () => Promise<void>;
}): void {
  const { sessionEpoch } = useSesija();
  const rendered = useRef({ accountId, accountRevision, agreementId, enabled, source, refresh, sessionEpoch });
  rendered.current = { accountId, accountRevision, agreementId, enabled, source, refresh, sessionEpoch };
  useFocusEffect(useCallback(() => {
    if (!enabled || (Platform.OS !== 'ios' && Platform.OS !== 'android')) return;
    let alive = true, foreground = AppState.currentState === 'active';
    let stopIncoming: (() => void) | undefined;
    let stopInvalidations: (() => void) | undefined;
    let coordinator: ReturnType<typeof createAgreementIncomingRefresh> | undefined;
    const stop = () => {
      coordinator?.stop(); coordinator = undefined;
      stopIncoming?.(); stopIncoming = undefined;
      stopInvalidations?.(); stopInvalidations = undefined;
    };
    const current = () => {
      const owner = rendered.current, session = sesijaSada();
      return alive && foreground && AppState.currentState === 'active' && owner.enabled
        && owner.accountId === accountId && owner.accountRevision === accountRevision && owner.agreementId === agreementId
        && owner.source === source && owner.refresh === refresh && owner.sessionEpoch === sessionEpoch
        && session.user?.id === accountId && session.accountRevision === accountRevision && session.sessionEpoch === sessionEpoch;
    };
    const listen = () => {
      stop();
      if (!current()) return;
      coordinator = createAgreementIncomingRefresh({ refresh, isCurrent: current });
      const onHint = coordinator.hint;
      try {
        stopIncoming = subscribeAgreementIncomingRefresh({
          load: () => import('expo-notifications'), identifier: publicInboxNotificationId, refresh, isCurrent: current, onHint,
        });
        if (source.poreklo === 'supabase' && current()) {
          stopInvalidations = subscribeAgreementInvalidations({
            accountId, accountRevision, sessionEpoch, agreementId, refresh, isCurrent: current, onHint,
          });
        }
      } catch { stop(); }
    };
    const app = AppState.addEventListener('change', state => {
      const nextForeground = state === 'active';
      if (nextForeground === foreground) return;
      foreground = nextForeground;
      if (foreground) listen();
      else stop();
    });
    listen();
    return () => { alive = false; stop(); app.remove(); };
  }, [accountId, accountRevision, agreementId, enabled, source, refresh, sessionEpoch]));
}
