import AsyncStorage from '@react-native-async-storage/async-storage';
import type { PodnesiPrijavuKomanda } from './ports';
import { positiveInteger, record, uuid } from './serverReceipt';
import { calendarInstant } from '../lib/calendarTime';

/** PKG-006 / GAP-0031: one unresolved application command per account and Need.
 * The record is the exact frozen command (its key and the offered terms), so a
 * remounted or cold-restored composer can replay the same rpc_submit_response
 * command instead of allocating a new key. It stores no server receipt and no
 * cross-account state; the owner's own offer lives only on the owner's device. */
export type ApplicationCommandRecord = Readonly<{ version: 1; accountId: string; needId: string; applicationPriceBasis?: 'TOTAL' | 'HOURLY'; command: PodnesiPrijavuKomanda }>;
export type ApplicationCommandLoad = { state: 'ABSENT' } | { state: 'PRESENT'; record: ApplicationCommandRecord } | { state: 'CORRUPT' };

const commandKeys = ['clientRequestId', 'potrebaId', 'potrebaRevizija', 'radnikProfilId', 'pokrivenaMesta', 'cenaRsd',
  'predlozeniPocetak', 'predlozeniKraj', 'napomena'] as const;
const accountKey = (value: unknown): value is string => typeof value === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(value);
const requestKey = (value: unknown): value is string => typeof value === 'string' && value.trim().length >= 8 && value.length <= 200 && !/\s/.test(value);
const instant = (value: unknown): value is string | null => value === null || (typeof value === 'string' && calendarInstant(value) !== null);
const storageKey = (accountId: string, needId: string) => `uskoci.application.command.v1.${accountId}.${needId}`;
const chains = new Map<string, Promise<unknown>>();
function queue<T>(key: string, work: () => Promise<T>): Promise<T> {
  const next = (chains.get(key) ?? Promise.resolve()).catch(() => undefined).then(work);
  chains.set(key, next);
  void next.finally(() => { if (chains.get(key) === next) chains.delete(key); }).catch(() => undefined);
  return next;
}

export function parseApplicationCommand(raw: string, accountId: string, needId: string): ApplicationCommandRecord {
  if (raw.length > 6000) throw new Error('APPLICATION_COMMAND_JOURNAL_INVALID');
  const value = record(JSON.parse(raw)), command = record(value?.command);
  if (!value || Object.keys(value).some(key => !['version', 'accountId', 'needId', 'command', 'applicationPriceBasis'].includes(key))
    || (value.applicationPriceBasis !== undefined && value.applicationPriceBasis !== 'TOTAL' && value.applicationPriceBasis !== 'HOURLY') || value.version !== 1 || !accountKey(accountId) || value.accountId !== accountId
    || !uuid(needId) || value.needId !== needId || !command || Object.keys(command).length !== commandKeys.length
    || commandKeys.some(key => !Object.hasOwn(command, key)) || !requestKey(command.clientRequestId)
    || !uuid(command.potrebaId) || command.potrebaId.toLowerCase() !== needId.toLowerCase() || !positiveInteger(command.potrebaRevizija)
    || !uuid(command.radnikProfilId) || !positiveInteger(command.pokrivenaMesta) || !positiveInteger(command.cenaRsd)
    || !instant(command.predlozeniPocetak) || !instant(command.predlozeniKraj)
    || (command.napomena !== null && (typeof command.napomena !== 'string' || command.napomena.length > 4000))) {
    throw new Error('APPLICATION_COMMAND_JOURNAL_INVALID');
  }
  return { version: 1, accountId, needId, ...(value.applicationPriceBasis === undefined ? {} : { applicationPriceBasis: value.applicationPriceBasis }), command: Object.freeze({
    clientRequestId: command.clientRequestId, potrebaId: command.potrebaId, potrebaRevizija: command.potrebaRevizija,
    radnikProfilId: command.radnikProfilId, pokrivenaMesta: command.pokrivenaMesta, cenaRsd: command.cenaRsd,
    predlozeniPocetak: command.predlozeniPocetak, predlozeniKraj: command.predlozeniKraj, napomena: command.napomena,
  }) };
}
function scope(accountId: string, needId: string) {
  if (!accountKey(accountId) || !uuid(needId)) throw new Error('APPLICATION_COMMAND_JOURNAL_INVALID');
  return storageKey(accountId, needId);
}
async function read(accountId: string, needId: string): Promise<ApplicationCommandLoad> {
  const raw = await AsyncStorage.getItem(scope(accountId, needId));
  if (raw === null) return { state: 'ABSENT' };
  try { return { state: 'PRESENT', record: parseApplicationCommand(raw, accountId, needId) }; }
  catch { return { state: 'CORRUPT' }; }
}
/** Serialized per account/Need. A storage failure propagates (nothing is sent
 * without a durable identity); a corrupt value is reported, never replayed. */
export const applicationCommandJournal = {
  load: async (accountId: string, needId: string) => queue(scope(accountId, needId), () => read(accountId, needId)),
  save: async (value: ApplicationCommandRecord, current: () => boolean = () => true) => {
    const next = parseApplicationCommand(JSON.stringify(value), value.accountId, value.needId);
    return queue(scope(next.accountId, next.needId), async () => {
      const old = await read(next.accountId, next.needId);
      if (!current()) throw new Error('APPLICATION_COMMAND_SCOPE_CHANGED');
      // Preserve the exact intent, not only its request key. Corrupt state needs its explicit exit.
      if (old.state === 'CORRUPT') throw new Error('APPLICATION_COMMAND_JOURNAL_INVALID');
      if (old.state === 'PRESENT') {
        if (old.record.command.clientRequestId !== next.command.clientRequestId) throw new Error('APPLICATION_COMMAND_UNRESOLVED');
        if (commandKeys.some(key => old.record.command[key] !== next.command[key])
          || old.record.applicationPriceBasis !== next.applicationPriceBasis) throw new Error('APPLICATION_COMMAND_PAYLOAD_CHANGED');
      }
      await AsyncStorage.setItem(storageKey(next.accountId, next.needId), JSON.stringify(next));
    });
  },
  /** Retires only the exact command; a stale acknowledgement cannot erase a newer intent. */
  clear: async (accountId: string, needId: string, clientRequestId: string, current: () => boolean = () => true): Promise<boolean> => queue(scope(accountId, needId), async () => {
    const old = await read(accountId, needId);
    if (!current()) throw new Error('APPLICATION_COMMAND_SCOPE_CHANGED');
    if (old.state === 'ABSENT') return true;
    if (old.state !== 'PRESENT' || old.record.command.clientRequestId !== clientRequestId) return false;
    await AsyncStorage.removeItem(storageKey(accountId, needId));
    // Keep the per-scope queue until absence is observed, so a queued newer save cannot be removed by this acknowledgement.
    return (await read(accountId, needId)).state === 'ABSENT';
  }),
  /** Explicit exit for a value that can never be reconciled or replayed. */
  discard: async (accountId: string, needId: string) => queue(scope(accountId, needId), async () => {
    const old = await read(accountId, needId);
    if (old.state === 'CORRUPT') await AsyncStorage.removeItem(storageKey(accountId, needId));
  }),
};
