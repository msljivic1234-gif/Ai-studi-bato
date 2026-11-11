import {
  NotificationPreferenceError, type NotificationPreferenceErrorCode, type NotificationPreferences,
  type NotificationPreferencesPort, type NotificationRole, type NotificationSettings,
} from '../contracts/notificationPreferences';
import { supabaseKlijent } from './supabaseClient';

type Rpc = (name: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: unknown }>;
const booleanKeys = ['in_app_enabled', 'push_enabled', 'opportunities_enabled', 'responses_enabled',
  'dogovor_enabled', 'execution_enabled', 'recovery_enabled', 'account_enabled', 'quiet_hours_enabled',
  'urgent_overrides_quiet_hours'] as const;
const keys = [...booleanKeys, 'quiet_start', 'quiet_end', 'quiet_timezone'];
const object = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);
const fail = (code: NotificationPreferenceErrorCode): never => { throw new NotificationPreferenceError(code); };

function scope(accountId: string, role: NotificationRole) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(accountId)) fail('AUTH_CONTEXT_CHANGED');
  if (role !== 'REQUESTER' && role !== 'WORKER') fail('INVALID_SETTINGS');
}

function canonicalTime(value: unknown, error: NotificationPreferenceErrorCode): string | null {
  if (value === null) return null;
  if (typeof value !== 'string') return fail(error);
  const match = /^([01]\d|2[0-3]):([0-5]\d)(?::([0-5]\d)(?:\.(\d{1,6}))?)?$/.exec(value);
  if (!match) return fail(error);
  const fraction = match[4]?.replace(/0+$/, '');
  return `${match[1]}:${match[2]}:${match[3] ?? '00'}${fraction ? `.${fraction}` : ''}`;
}

function settings(value: unknown, error: NotificationPreferenceErrorCode): NotificationSettings {
  if (!object(value) || Object.keys(value).length !== keys.length || Object.keys(value).some(key => !keys.includes(key))
    || booleanKeys.some(key => typeof value[key] !== 'boolean')
    || typeof value.quiet_timezone !== 'string' || !value.quiet_timezone.trim()
    || value.quiet_timezone !== value.quiet_timezone.trim()) return fail(error);
  const quiet_start = canonicalTime(value.quiet_start, error);
  const quiet_end = canonicalTime(value.quiet_end, error);
  if (value.quiet_hours_enabled && (quiet_start === null || quiet_end === null)) return fail(error);
  // The server's pg_timezone_names catalog owns timezone eligibility. Clone all
  // allowed fields so caller edits cannot mutate an in-flight request/retry.
  return { ...Object.fromEntries(booleanKeys.map(key => [key, value[key]])),
    quiet_start, quiet_end, quiet_timezone: value.quiet_timezone } as NotificationSettings;
}

function projection(raw: unknown, accountId: string, role: NotificationRole): NotificationPreferences {
  if (!object(raw) || raw.userId !== accountId || raw.roleContext !== role
    || typeof raw.exists !== 'boolean' || !Number.isSafeInteger(raw.revision) || Number(raw.revision) < 0
    || (raw.exists ? typeof raw.updatedAt !== 'string' || !Number.isFinite(Date.parse(raw.updatedAt))
      : raw.revision !== 0 || raw.updatedAt !== null)) return fail('INVALID_RESPONSE');
  return { userId: accountId, roleContext: role, exists: raw.exists, revision: Number(raw.revision),
    updatedAt: raw.updatedAt as string | null, settings: settings(raw.settings, 'INVALID_RESPONSE') };
}

export function createNotificationPreferencesService(rpc: Rpc): NotificationPreferencesPort {
  async function call(name: string, args: Record<string, unknown>): Promise<unknown> {
    let result;
    try { result = await rpc(name, args); } catch { return fail('UNAVAILABLE'); }
    if (!object(result)) return fail('INVALID_RESPONSE');
    if (result.error) {
      const code = object(result.error) ? result.error.code : null;
      // B24: PT409 is the deliberate conflict since the server stopped raising 40001 (PostgREST 14 retries it without end); the old code stays accepted.
      if (code === '40001' || code === 'PT409') return fail('CONFLICT');
      if (code === '28000' || code === '42501') return fail('AUTH_CONTEXT_CHANGED');
      if (code === '22023') return fail('INVALID_SETTINGS');
      return fail('UNAVAILABLE');
    }
    return result.data;
  }
  return {
    async read(accountId, role) {
      scope(accountId, role);
      return projection(await call('rpc_get_notification_preferences', {
        p_role: role, p_expected_user_id: accountId,
      }), accountId, role);
    },
    async save(accountId, role, input, expectedRevision) {
      scope(accountId, role);
      if (!Number.isSafeInteger(expectedRevision) || expectedRevision < 0
        || expectedRevision >= Number.MAX_SAFE_INTEGER) return fail('INVALID_SETTINGS');
      const wanted = settings(input, 'INVALID_SETTINGS');
      const result = projection(await call('rpc_set_notification_preferences', {
        p_role: role, p_expected_user_id: accountId, p_settings: wanted, p_expected_revision: expectedRevision,
      }), accountId, role);
      if (!result.exists || result.revision !== expectedRevision + 1
        || keys.some(key => result.settings[key as keyof NotificationSettings] !== wanted[key as keyof NotificationSettings])) {
        return fail('INVALID_RESPONSE');
      }
      return result;
    },
  };
}

// The caller captures its account; the server rejects a later, different JWT
// owner. No direct table DML, implicit opt-in, retry with a new revision or push.
export const notificationPreferencesClientService = createNotificationPreferencesService(
  (name, args) => supabaseKlijent().rpc(name, args),
);
