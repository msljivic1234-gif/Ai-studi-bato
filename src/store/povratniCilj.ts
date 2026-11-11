import AsyncStorage from '@react-native-async-storage/async-storage';

const AUTH_RETURN_TARGET_STORAGE_VERSION = 2 as const;
export const AUTH_RETURN_TARGET_KEY = 'uskoci.auth.pending-intent.v2';

export type GuestReturnTarget =
  | { kind: 'NONE' }
  | { kind: 'REQUESTER_DRAFT'; draftKey: string }
  | { kind: 'NEED'; needId: string }
  | { kind: 'DOGOVOR'; agreementId: string };

export type GuestSessionIntent = {
  intent: 'REQUESTER' | 'WORKER';
  returnTarget?: GuestReturnTarget;
};

export type AuthReturnTargetRecordV2 = {
  storageVersion: typeof AUTH_RETURN_TARGET_STORAGE_VERSION;
  recordRevision: number;
  status: 'PENDING' | 'COMPLETED';
  intent: GuestSessionIntent;
  createdAt: string;
  updatedAt: string;
  completedByUserId: string | null;
};

export class AuthReturnTargetStore {
  private serial: Promise<void> = Promise.resolve();
  private nextPreparation = 0;
  private storedPreparation = 0;

  private runExclusive<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.serial.then(operation, operation);
    this.serial = result.then(() => undefined, () => undefined);
    return result;
  }

  private async loadUnlocked(): Promise<AuthReturnTargetRecordV2 | null> {
    const raw = await AsyncStorage.getItem(AUTH_RETURN_TARGET_KEY);
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw);
      if (parsed.storageVersion === AUTH_RETURN_TARGET_STORAGE_VERSION) {
        return parsed;
      }
    } catch {}
    return null;
  }

  private async restoreUnlocked(record: AuthReturnTargetRecordV2 | null) {
    if (record) await AsyncStorage.setItem(AUTH_RETURN_TARGET_KEY, JSON.stringify(record));
    else await AsyncStorage.removeItem(AUTH_RETURN_TARGET_KEY);
  }

  async snapshot() {
    return this.runExclusive(async () => this.loadUnlocked());
  }

  async prepare(input: GuestSessionIntent): Promise<AuthReturnTargetRecordV2>;
  async prepare(input: GuestSessionIntent, isCurrent: () => boolean): Promise<AuthReturnTargetRecordV2 | null>;
  async prepare(input: GuestSessionIntent, isCurrent: () => boolean = () => true) {
    const preparation = ++this.nextPreparation;
    return this.runExclusive(async () => {
      if (!isCurrent()) return null;
      const previous = await this.loadUnlocked();
      if (!isCurrent()) return null;
      const timestamp = new Date().toISOString();
      const next: AuthReturnTargetRecordV2 = {
        storageVersion: AUTH_RETURN_TARGET_STORAGE_VERSION,
        recordRevision: (previous?.recordRevision ?? 0) + 1,
        status: 'PENDING',
        intent: input,
        createdAt: timestamp,
        updatedAt: timestamp,
        completedByUserId: null,
      };
      await AsyncStorage.setItem(AUTH_RETURN_TARGET_KEY, JSON.stringify(next));
      if (!isCurrent()) {
        await this.restoreUnlocked(previous);
        return null;
      }
      this.storedPreparation = preparation;
      return next;
    });
  }

  async consumeCompleted(userId: string, isCurrent: () => boolean = () => true) {
    const normalizedUserId = userId.trim();
    if (!normalizedUserId) return null;
    return this.runExclusive(async () => {
      if (!isCurrent()) return null;
      const record = await this.loadUnlocked();
      if (!isCurrent() || !record || record.status !== 'COMPLETED') return null;
      await AsyncStorage.removeItem(AUTH_RETURN_TARGET_KEY);
      if (!isCurrent()) {
        // No other store operation can run until this serial section ends.
        await this.restoreUnlocked(record);
        return null;
      }
      if (record.completedByUserId !== normalizedUserId) return null;
      return record;
    });
  }

  async markCompleted(userId: string, input: GuestSessionIntent, owner?: {
    isCurrent: () => boolean;
    pendingRevision: number;
  }) {
    const normalizedUserId = userId.trim();
    if (!normalizedUserId) throw new Error('AUTH_RETURN_TARGET_USER_REQUIRED');
    return this.runExclusive(async () => {
      if (owner && !owner.isCurrent()) return null;
      const previous = await this.loadUnlocked();
      if (owner && (!owner.isCurrent() || previous?.status !== 'PENDING' ||
        previous.recordRevision !== owner.pendingRevision ||
        JSON.stringify(previous.intent) !== JSON.stringify(input))) return null;
      const timestamp = new Date().toISOString();
      const next: AuthReturnTargetRecordV2 = {
        storageVersion: AUTH_RETURN_TARGET_STORAGE_VERSION,
        recordRevision: (previous?.recordRevision ?? 0) + 1,
        status: 'COMPLETED',
        intent: input,
        createdAt: previous?.createdAt ?? timestamp,
        updatedAt: timestamp,
        completedByUserId: normalizedUserId,
      };
      await AsyncStorage.setItem(AUTH_RETURN_TARGET_KEY, JSON.stringify(next));
      if (owner && !owner.isCurrent()) {
        await this.restoreUnlocked(previous);
        return null;
      }
      return next;
    });
  }

  async clear() {
    return this.runExclusive(async () => {
      await AsyncStorage.removeItem(AUTH_RETURN_TARGET_KEY);
    });
  }

  captureSessionCleanup() {
    const boundary = this.nextPreparation;
    return () => this.runExclusive(async () => {
      // A retry must not erase an intent successfully prepared after logout or
      // the account switch. Failed/earlier prepares do not cross this boundary.
      if (this.storedPreparation > boundary) return;
      await AsyncStorage.removeItem(AUTH_RETURN_TARGET_KEY);
    });
  }
}

export const povratniCilj = new AuthReturnTargetStore();
