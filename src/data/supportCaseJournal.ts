import AsyncStorage from '@react-native-async-storage/async-storage';
import { positiveInteger, record, uuid } from './serverReceipt';
import { supportKinds, type SupportIntent } from './supportCaseTypes';

const storageKey = (accountId: string) => `uskoci.support.command.v1.${accountId}`;
const chains = new Map<string, Promise<unknown>>();
function queue<T>(accountId: string, work: () => Promise<T>): Promise<T> {
  const next = (chains.get(accountId) ?? Promise.resolve()).catch(() => undefined).then(work);
  chains.set(accountId, next);
  void next.finally(() => { if (chains.get(accountId) === next) chains.delete(accountId); }).catch(() => undefined);
  return next;
}
const lowerUuid = (v: unknown): v is string => uuid(v) && v === v.toLowerCase();
export function parseSupportIntent(raw: string, accountId: string): SupportIntent {
  if (raw.length > 700) throw new Error('SUPPORT_INTENT_INVALID');
  const v = record(JSON.parse(raw));
  const keys = ['version', 'accountId', 'clientRequestId', 'kind', 'caseId', 'expectedRevision', 'inputSha256'];
  if (!v || Object.keys(v).length !== keys.length || keys.some(k => !Object.hasOwn(v, k))
    || v.version !== 1 || !lowerUuid(accountId) || v.accountId !== accountId || !lowerUuid(v.clientRequestId)
    || !supportKinds.includes(v.kind as SupportIntent['kind']) || typeof v.inputSha256 !== 'string'
    || !/^[a-f0-9]{64}$/.test(v.inputSha256)
    || (v.kind === 'CREATE' ? v.caseId !== null || v.expectedRevision !== null
      : !lowerUuid(v.caseId) || !positiveInteger(v.expectedRevision))) throw new Error('SUPPORT_INTENT_INVALID');
  return v as SupportIntent;
}
function sameSupportIntent(a: SupportIntent, b: SupportIntent): boolean {
  return a.version === b.version && a.accountId === b.accountId && a.clientRequestId === b.clientRequestId
    && a.kind === b.kind && a.caseId === b.caseId && a.expectedRevision === b.expectedRevision && a.inputSha256 === b.inputSha256;
}
async function read(accountId: string) {
  if (!lowerUuid(accountId)) throw new Error('SUPPORT_INTENT_INVALID');
  const raw = await AsyncStorage.getItem(storageKey(accountId));
  return raw === null ? null : parseSupportIntent(raw, accountId);
}
/** Serialize opaque per-account state. A stale acknowledgement cannot erase a
 * newer intent; an unresolved command cannot be overwritten or silently retried. */
export const supportCaseJournal = {
  load: (accountId: string) => queue(accountId, () => read(accountId)),
  save: (value: SupportIntent, current: () => boolean = () => true) => {
    const intent = parseSupportIntent(JSON.stringify(value), value.accountId);
    return queue(intent.accountId, async () => {
      const old = await read(intent.accountId);
      if (!current()) throw new Error('SUPPORT_SCOPE_CHANGED');
      if (old && !sameSupportIntent(old, intent)) throw new Error('SUPPORT_UNRESOLVED_INTENT');
      await AsyncStorage.setItem(storageKey(intent.accountId), JSON.stringify(intent));
    });
  },
  clear: (value: SupportIntent, current: () => boolean = () => true) => {
    const intent = parseSupportIntent(JSON.stringify(value), value.accountId);
    return queue(intent.accountId, async () => {
      const old = await read(intent.accountId);
      if (!current()) throw new Error('SUPPORT_SCOPE_CHANGED');
      if (old && sameSupportIntent(old, intent)) await AsyncStorage.removeItem(storageKey(intent.accountId));
    });
  },
};
