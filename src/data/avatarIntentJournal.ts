import AsyncStorage from '@react-native-async-storage/async-storage';

const queues = new Map<string, Promise<boolean>>();

/** Compare/replace the existing avatar journal, without changing its key or format.
 * This serializes mounted editors in this JS process, not other processes/devices.
 * The caller still owns decoding and authoritative server reconciliation; absence
 * of a local/server row is never itself permission to retire an upload command. */
export function replaceAvatarIntent(key: string, expected: string | null, next: string | null, current: () => boolean): Promise<boolean> {
  const task = (queues.get(key) ?? Promise.resolve()).catch(() => undefined).then(async () => {
    if (!current()) return false;
    const stored = await AsyncStorage.getItem(key);
    if (!current() || stored !== expected) return false;
    if (next === null) await AsyncStorage.removeItem(key);
    else await AsyncStorage.setItem(key, next);
    return true;
  });
  queues.set(key, task);
  void task.finally(() => { if (queues.get(key) === task) queues.delete(key); }).catch(() => undefined);
  return task;
}
