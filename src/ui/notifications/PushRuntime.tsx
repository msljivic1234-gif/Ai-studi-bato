import { useEffect, useRef } from 'react';
import { AppState, Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { pendingRoute } from '../../store/pendingRoute';
import { messagePushIntent, ownsMessagePush } from '../../store/messagePushIntent';
import { publicPushTarget } from './pushTarget';
import { useSesija, sesijaSada } from '../../store/sesija';
import { nativePushDevice } from '../../data/nativePushDevice';
import { pushDeviceClientService, revokePushBeforeLogout } from '../../data/pushDeviceClientService';
import { isPublicInboxNotification as publicInbox } from './publicInboxCopy';

/** Fixed owned Inbox navigation + rotation of an already explicit registration.
 * Mount once under the existing router/Auth runtime. Never asks OS permission,
 * enables a preference, accepts a payload URL or interprets push as delivery.
 */
export function PushRuntime({ ready = false }: { ready?: boolean }) {
 const { user, accountRevision, sessionEpoch } = useSesija(); const accountId = user?.id;
 const seen = useRef(new Set<string>()), coldStarted = useRef(false), blocked = useRef(new Set<string>());
 const rendered = useRef({ ready, accountId, accountRevision, sessionEpoch });
 rendered.current = { ready, accountId, accountRevision, sessionEpoch };
 useEffect(() => {
  if (!ready || !accountId || (Platform.OS !== 'ios' && Platform.OS !== 'android')) return;
  let alive = true, pending = false, generation = 0, tapGeneration = 0;
  let activeTimer: ReturnType<typeof setTimeout> | undefined;
  const scope = { accountId, accountRevision };
  const identity = { ...scope, sessionEpoch };
  const owned = () => {
   const owner = rendered.current;
   // Auth/recovery or account closure can retire readiness in the render before
   // passive cleanup. Retained token callbacks and in-flight native reads must
   // stop at the same boundary as notification presentation and navigation.
   return alive && owner.ready && owner.accountId === accountId && owner.accountRevision === accountRevision
    && owner.sessionEpoch === sessionEpoch && sesijaSada().user?.id === accountId
    && sesijaSada().accountRevision === accountRevision && sesijaSada().sessionEpoch === sessionEpoch;
  };
  let foreground = AppState.currentState === 'active';
  Notifications.setNotificationHandler({ handleNotification: async notification => {
   const owner = rendered.current;
   const show = owned() && owner.ready && owner.accountId === accountId && owner.accountRevision === accountRevision
    && owner.sessionEpoch === sessionEpoch && foreground && publicInbox(notification);
   // Immediate local presentation only: no permission, RPC, navigation, badge or
   // read/delivery acknowledgment. Sound still obeys native permission/channel.
   return { shouldShowBanner: show, shouldShowList: show, shouldPlaySound: show, shouldSetBadge: false };
  } });
  const remember = (set: Set<string>, value: string, max: number) => { set.add(value); if (set.size > max) set.delete(set.values().next().value!); };
  function tap(response: Notifications.NotificationResponse | null, cold = false) {
   const request = response?.notification?.request, data = request?.content?.data;
   const target = publicPushTarget(data);
   if (!request || typeof request.identifier !== 'string' || request.identifier.length < 1 || request.identifier.length > 256 || !target) return;
   if (seen.current.has(request.identifier)) return;
   // A late old-account event is consumed, so a new account cannot replay it.
   remember(seen.current, request.identifier, 128);
   // Rendering Auth/recovery retires navigation before the old listener's effect cleanup.
   const owner = rendered.current;
   if (!owned() || !owner.ready || owner.accountId !== accountId || owner.accountRevision !== accountRevision
    || owner.sessionEpoch !== sessionEpoch) return;
   // On a cold start this runs beside the root layout's return-target consumer, and neither waits
   // for the other: the consumer resolves a stored intent and replaces the route, which lands on
   // top of the Inbox this push just opened. Recording the same destination makes the order stop
   // mattering — whichever of the two finishes last, both of them mean the Inbox.
   tapGeneration++;
   const prior = messagePushIntent.snapshot();
   if (prior && ownsMessagePush(prior, identity)) pendingRoute.delivered(prior.coldRoute, prior);
   const coldRoute = cold ? pendingRoute.remember('/obavestenja') : null;
   if (target.kind === 'MESSAGE_EVENT') messagePushIntent.remember(target.eventId, identity, coldRoute);
   else if (target.kind === 'OPPORTUNITY_EVENT') messagePushIntent.rememberOpportunity(target.eventId, identity, coldRoute);
   else if (target.kind === 'APPLICATION_EVENT') messagePushIntent.rememberApplication(target.eventId, target.eventType, identity, coldRoute);
   else messagePushIntent.clear();
   // Reuse an already open Inbox instead of stacking another copy on each tap.
   router.navigate('/obavestenja');
   void Notifications.clearLastNotificationResponseAsync().catch(() => undefined);
  }
  function reconcile() {
   if (!owned() || pending) return;
   pending = true; const operation = ++generation;
   const current = () => owned() && operation === generation;
   const timer = setTimeout(() => { if (operation === generation) { generation++; pending = false; } }, 20000);
   activeTimer = timer;
   void (async () => {
    const existing = await pushDeviceClientService.sessionDevice(scope);
    if (!current() || !existing.ok || existing.podatak.kind !== 'DEVICE') return;
    const previous = existing.podatak;
    const native = await nativePushDevice(false, current);
    if (!current()) return;
    if (native.kind === 'DENIED' || native.kind === 'PERMISSION_REQUIRED') { await revokePushBeforeLogout(scope); return; }
    if (native.kind !== 'READY' || previous.platform !== native.platform || previous.token === native.token) return;
    const key = `${accountId}:${accountRevision}:${previous.id}:${previous.revision}:${native.token}`;
    if (blocked.current.has(key)) return;
    // Persist an immutable uncertainty fence before the write. Readback can
    // discover the new registration; an unchanged old row isn't a retry receipt.
    remember(blocked.current, key, 32);
    const result = await pushDeviceClientService.rotate(scope, previous, native.token, native.platform);
    if (!current()) return;
    if (result.ok) blocked.current.delete(key);
    else await pushDeviceClientService.sessionDevice(scope); // read only; no replay
   })().catch(() => undefined).finally(() => { clearTimeout(timer); if (activeTimer === timer) activeTimer = undefined; if (operation === generation) pending = false; });
  }
  const responseListener = Notifications.addNotificationResponseReceivedListener(tap);
  const tokenListener = Notifications.addPushTokenListener(reconcile);
  const appListener = AppState.addEventListener('change', state => { foreground = state === 'active'; if (foreground) reconcile(); });
  if (!coldStarted.current) {
   coldStarted.current = true; const startedAtTap = tapGeneration;
   void Notifications.getLastNotificationResponseAsync().then(response => {
    if (tapGeneration === startedAtTap) tap(response, true);
   }).catch(() => undefined);
  }
  reconcile();
  return () => {
   alive = false; generation++; Notifications.setNotificationHandler(null);
   const intent = messagePushIntent.snapshot();
   if (intent && ownsMessagePush(intent, identity)) {
    pendingRoute.delivered(intent.coldRoute, intent); messagePushIntent.retire(intent.serial);
   }
   if (activeTimer !== undefined) clearTimeout(activeTimer); responseListener.remove(); tokenListener.remove(); appListener.remove();
  };
 }, [ready, accountId, accountRevision, sessionEpoch]);
 return null;
}
