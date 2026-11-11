import { useCallback, useRef, useState, useSyncExternalStore } from 'react';
import { AppState } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { activityMessageTargetService, type ActivityMessageTarget } from '../data/activityMessageTargetService';
import { activityOpportunityTargetService, type ActivityOpportunityTarget } from '../data/activityOpportunityTargetService';
import { activityApplicationPushTargetService, type ActivityApplicationPushTarget } from '../data/activityApplicationPushTargetService';
import { messagePushIntent, ownsMessagePush } from '../store/messagePushIntent';
import { pendingRoute } from '../store/pendingRoute';
import { sesijaSada, useSesija } from '../store/sesija';

type Target = Extract<ActivityMessageTarget, { kind: 'AGREEMENT_MESSAGE' | 'GROUP_MESSAGE' }> | Extract<ActivityOpportunityTarget, { kind: 'OPPORTUNITY' }> | Extract<ActivityApplicationPushTarget, { kind: 'APPLICATION' }>;
type Phase = 'loading' | 'error' | 'unavailable';

/** A tapped event is resolved by the visible Inbox, never an asynchronous global
 * navigator. Leaving this visit cancels the read; returning cannot replay it. */
export function useMessagePushIngress(onTarget: (target: Target) => void) {
  const intent = useSyncExternalStore(messagePushIntent.subscribe, messagePushIntent.snapshot, messagePushIntent.snapshot);
  const { user, accountRevision, sessionEpoch } = useSesija();
  const accountId = user?.id;
  const [attempt, setAttempt] = useState(0);
  const [status, setStatus] = useState<{ serial: number; phase: Phase } | null>(null);
  const rendered = useRef({ accountId, accountRevision, sessionEpoch, onTarget });
  const visitIntent = useRef<typeof intent>(null);
  rendered.current = { accountId, accountRevision, sessionEpoch, onTarget };
  const cancel = useCallback(() => {
    if (!intent) return;
    pendingRoute.delivered(intent.coldRoute, intent);
    messagePushIntent.retire(intent.serial);
  }, [intent]);

  useFocusEffect(useCallback(() => {
    if (!intent) return;
    if (!accountId || !ownsMessagePush(intent, { accountId, accountRevision, sessionEpoch })
      || Date.now() - intent.at >= 15 * 60_000) { cancel(); return; }
    visitIntent.current = intent;
    pendingRoute.delivered(intent.coldRoute, intent);
    let alive = true, started = false;
    let foreground = AppState.currentState === 'active';
    const controller = new AbortController();
    const current = () => {
      const session = sesijaSada(), render = rendered.current;
      return alive && foreground && AppState.currentState === 'active' && messagePushIntent.snapshot() === intent
        && session.user?.id === accountId && session.accountRevision === accountRevision && session.sessionEpoch === sessionEpoch
        && render.accountId === accountId && render.accountRevision === accountRevision && render.sessionEpoch === sessionEpoch;
    };
    const start = () => {
      if (started || !current()) return;
      started = true; setStatus({ serial: intent.serial, phase: 'loading' });
      const result = intent.eventType === 'RESPONSE_RECEIVED' || intent.eventType === 'RESPONSE_UPDATED'
        ? activityApplicationPushTargetService.resolve(intent.eventId, intent.eventType, { signal: controller.signal }, { accountId, accountRevision })
        : (intent.eventType === 'OPPORTUNITY_AVAILABLE' ? activityOpportunityTargetService : activityMessageTargetService)
          .resolve(intent.eventId, { signal: controller.signal }, { accountId, accountRevision });
      void result
        .then(result => {
          if (!current()) return;
          if (!result.ok) { setStatus({ serial: intent.serial, phase: 'error' }); return; }
          if (result.podatak.kind === 'UNAVAILABLE') { setStatus({ serial: intent.serial, phase: 'unavailable' }); return; }
          // Retire synchronously before navigation, without ACK or a guessed fallback.
          messagePushIntent.retire(intent.serial);
          rendered.current.onTarget(result.podatak);
        }).catch(() => { if (current()) setStatus({ serial: intent.serial, phase: 'error' }); });
    };
    const app = AppState.addEventListener('change', state => {
      foreground = state === 'active';
      if (foreground) start();
      else if (started) { controller.abort(); cancel(); }
    });
    start();
    return () => { alive = false; controller.abort(); app.remove(); };
  }, [intent, accountId, accountRevision, sessionEpoch, attempt, cancel]));

  // This separate visit owner survives retry renders; focus cleanup really means
  // leaving the Inbox, not changing an attempt on the same visible screen.
  useFocusEffect(useCallback(() => () => {
    const claimed = visitIntent.current; visitIntent.current = null;
    if (claimed) { pendingRoute.delivered(claimed.coldRoute, claimed); messagePushIntent.retire(claimed.serial); }
  }, []));
  const visible = !!intent && !!accountId && ownsMessagePush(intent, { accountId, accountRevision, sessionEpoch });
  const phase: Phase | null = visible ? status?.serial === intent.serial ? status.phase : 'loading' : null;
  return { phase, cancel, retry: () => { if (phase === 'error') setAttempt(value => value + 1); } };
}
