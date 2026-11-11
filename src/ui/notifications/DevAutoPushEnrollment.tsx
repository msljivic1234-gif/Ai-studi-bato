import { useEffect } from 'react';
import { AppState, Platform } from 'react-native';
import { useSesija, sesijaSada } from '../../store/sesija';
import { nativePushDevice } from '../../data/nativePushDevice';
import { pushDeviceClientService } from '../../data/pushDeviceClientService';
import { notificationPreferencesClientService } from '../../data/notificationPreferencesClientService';
import type { NotificationRole } from '../../contracts/notificationPreferences';

/**
 * Dedicated Android DEV push-proof build ONLY. A signed-in test account receives
 * the native Android permission prompt once per session. Consent grants a token
 * and registers this device without requiring a visit to Settings.
 *
 * Existing registrations/preferences are authoritative: never re-enable a
 * disabled device after the person opts out. Production/normal preview builds
 * must NOT include this feature flag.
 */
const DEV_AUTO_ENROLL = process.env.EXPO_PUBLIC_USKOCI_DEV_AUTO_PUSH_ENROLL === '1';
const ROLES: readonly NotificationRole[] = ['REQUESTER', 'WORKER'];

export function DevAutoPushEnrollment({ ready = false }: { ready?: boolean }) {
  const { user, accountRevision, sessionEpoch } = useSesija();
  const accountId = user?.id;
  useEffect(() => {
    if (!DEV_AUTO_ENROLL || Platform.OS !== 'android' || !ready || !accountId) return;
    const scope = { accountId, accountRevision };
    let live = true, attempted = false;
    const owns = () => live
      && sesijaSada().user?.id === accountId
      && sesijaSada().accountRevision === accountRevision
      && sesijaSada().sessionEpoch === sessionEpoch;
    async function registerAfterConsent() {
      // Registration is per native token, not per account. An account may
      // legitimately own another phone; that must not block enrollment here.
      // Never rotate or overwrite another phone's existing registration.
      // Android owns the permission decision. No permission means no RPC.
      const native = await nativePushDevice(true, owns);
      if (!owns() || native.kind !== 'READY') return;

      const existing = await pushDeviceClientService.read(scope, native.token);
      if (!owns() || !existing.ok) return;
      // Explicitly disabled registrations must stay disabled.
      if (existing.podatak.exists && !existing.podatak.active) return;
      if (existing.podatak.exists && existing.podatak.sessionBound) return;

      // Read both revisions before starting any writes. On a new DEV device,
      // the OS permission is the user's opt-in for this test build.
      const preferences = await Promise.all(ROLES.map(role =>
        notificationPreferencesClientService.read(scope.accountId, role)));
      if (!owns()) return;
      // A saved PUSH_OFF decision is not replaced by an OS permission grant.
      // Auto-opt-in is restricted to the first, as-yet-unconfigured DEV setup.
      if (preferences.some(item => item.exists && !item.settings.push_enabled)) return;

      const result = await pushDeviceClientService.set(
        scope, native.token, native.platform, true, existing.podatak.revision);
      if (!owns() || !result.ok) return;
      // Never broaden granular event subscriptions (opportunities, messages
      // etc.). Only enable the transport switch for the consenting DEV user.
      for (let i = 0; i < ROLES.length; i++) {
        if (!owns()) return;
        const saved = preferences[i];
        if (!saved.settings.push_enabled) {
          await notificationPreferencesClientService.save(
            scope.accountId, ROLES[i], { ...saved.settings, push_enabled: true }, saved.revision);
        }
      }
      // Let Settings perform the ordinary readback. Never log push tokens.
    }
    function attempt() {
      if (attempted || !owns() || AppState.currentState !== 'active') return;
      attempted = true;
      void registerAfterConsent().catch(() => {
        // Non-blocking: the existing Settings screen permits explicit retry.
        // Do not leak device tokens or identifiers to a diagnostic log.
        console.warn('USKOCI_DEV_PUSH_AUTO_ENROLL_UNCONFIRMED');
      });
    }
    const listener = AppState.addEventListener('change', state => {
      if (state === 'active') attempt();
    });
    attempt();
    return () => { live = false; listener.remove(); };
  }, [ready, accountId, accountRevision, sessionEpoch]);
  return null;
}
