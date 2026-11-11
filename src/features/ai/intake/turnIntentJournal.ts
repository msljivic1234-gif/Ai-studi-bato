import AsyncStorage from '@react-native-async-storage/async-storage';
import { record, uuid } from '../../../data/serverReceipt';

/** Persist ONLY opaque IDs for an unknown AI turn outcome, never text, facts or addresses.
 * Both interviews use the same recovery contract but retain distinct storage keys,
 * errors and per-account serial queues. Server readback remains the only authority. */
export type TurnIntent = { accountId: string; conversationId: string; clientRequestId: string };

export function createTurnIntentJournal(kind: 'need' | 'worker') {
  const prefix = kind === 'worker' ? 'uskoci.worker.ai.turn.intent.v1.' : 'uskoci.ai.turn.intent.v1.';
  const invalid = kind === 'worker' ? 'WORKER_AI_LOCAL_INTENT_INVALID' : 'AI_LOCAL_INTENT_INVALID';
  const unresolved = kind === 'worker' ? 'WORKER_AI_UNRESOLVED_INTENT' : 'AI_UNRESOLVED_INTENT';
  const key = (accountId: string) => prefix + accountId;
  // The queues are intentionally owned by each journal instance, not shared by
  // requesters/workers. An older pending turn cannot block the other interview.
  const chains = new Map<string, Promise<unknown>>();
  function queue<T>(accountId: string, work: () => Promise<T>): Promise<T> {
    const next = (chains.get(accountId) ?? Promise.resolve()).catch(() => undefined).then(work);
    chains.set(accountId, next);
    void next.finally(() => { if (chains.get(accountId) === next) chains.delete(accountId); }).catch(() => undefined);
    return next;
  }
  function parse(raw: string | null, accountId: string): TurnIntent | null {
    if (!uuid(accountId)) throw new Error(invalid);
    if (raw === null) return null;
    let parsed: unknown;
    try { parsed = JSON.parse(raw); }
    catch { throw new Error(invalid); }
    const value = record(parsed);
    if (!value || Object.keys(value).length !== 3 || value.accountId !== accountId
      || !uuid(value.conversationId) || !uuid(value.clientRequestId)) throw new Error(invalid);
    return { accountId, conversationId: value.conversationId, clientRequestId: value.clientRequestId };
  }

  return {
    load: (accountId: string) =>
      queue(accountId, async () => parse(await AsyncStorage.getItem(key(accountId)), accountId)),
    save: (intent: TurnIntent) => queue(intent.accountId, async () => {
      const encoded = JSON.stringify(intent);
      parse(encoded, intent.accountId);
      const old = parse(await AsyncStorage.getItem(key(intent.accountId)), intent.accountId);
      if (old && (old.conversationId !== intent.conversationId || old.clientRequestId !== intent.clientRequestId))
        throw new Error(unresolved);
      await AsyncStorage.setItem(key(intent.accountId), encoded);
    }),
    /** A valid unresolved command must survive; discard ONLY a corrupt local record. */
    discardCorrupt: (accountId: string) => queue(accountId, async () => {
      if (!uuid(accountId)) throw new Error(invalid);
      const storageKey = key(accountId);
      const raw = await AsyncStorage.getItem(storageKey);
      if (raw === null) return false;
      try {
        parse(raw, accountId);
        return false;
      } catch (error) {
        if (!(error instanceof SyntaxError)
          && !(error instanceof Error && error.message === invalid)) throw error;
      }
      if (await AsyncStorage.getItem(storageKey) !== raw) return false;
      await AsyncStorage.removeItem(storageKey);
      return true;
    }),
    clear: (intent: TurnIntent) => queue(intent.accountId, async () => {
      const old = parse(await AsyncStorage.getItem(key(intent.accountId)), intent.accountId);
      if (old?.conversationId === intent.conversationId && old.clientRequestId === intent.clientRequestId)
        await AsyncStorage.removeItem(key(intent.accountId));
    }),
  };
}
