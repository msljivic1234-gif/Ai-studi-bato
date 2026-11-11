export type NotificationRole = 'REQUESTER' | 'WORKER';

export type NotificationSettings = {
  in_app_enabled: boolean;
  push_enabled: boolean;
  opportunities_enabled: boolean;
  responses_enabled: boolean;
  dogovor_enabled: boolean;
  execution_enabled: boolean;
  recovery_enabled: boolean;
  account_enabled: boolean;
  quiet_hours_enabled: boolean;
  quiet_start: string | null;
  quiet_end: string | null;
  quiet_timezone: string;
  urgent_overrides_quiet_hours: boolean;
};

export type NotificationPreferences = {
  userId: string;
  roleContext: NotificationRole;
  exists: boolean;
  revision: number;
  updatedAt: string | null;
  settings: NotificationSettings;
};

export type NotificationPreferenceErrorCode =
  | 'AUTH_CONTEXT_CHANGED' | 'CONFLICT' | 'INVALID_SETTINGS' | 'INVALID_RESPONSE' | 'UNAVAILABLE';

export class NotificationPreferenceError extends Error {
  constructor(readonly code: NotificationPreferenceErrorCode) { super(code); }
}

export type NotificationPreferencesPort = {
  read(accountId: string, role: NotificationRole): Promise<NotificationPreferences>;
  save(accountId: string, role: NotificationRole, settings: NotificationSettings, expectedRevision: number): Promise<NotificationPreferences>;
};
