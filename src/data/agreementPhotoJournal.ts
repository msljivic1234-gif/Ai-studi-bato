import AsyncStorage from '@react-native-async-storage/async-storage';
import type { AgreementUploadRef } from './agreementPhotoClientService';
import { positiveInteger, record, uuid } from './serverReceipt';

type Storage = { getItem(key: string): Promise<string | null>; setItem(key: string, value: string): Promise<void> };
/** One journal per upload kind: its own key space (an older build that only knows photos never reads a voice key), its own capacity and error names. */
type Kind = Readonly<{ namespace: 'photos' | 'voice'; capacity: number; prefix: 'PHOTO' | 'VOICE' }>;
const PHOTOS: Kind = { namespace: 'photos', capacity: 6, prefix: 'PHOTO' };
const VOICE: Kind = { namespace: 'voice', capacity: 3, prefix: 'VOICE' };
const queues = new Map<string, Promise<unknown>>();
const exactRef = (a: AgreementUploadRef, b: AgreementUploadRef) => a.agreementId === b.agreementId
  && a.agreementVersion === b.agreementVersion && a.clientRequestId === b.clientRequestId;
function parse(kind: Kind, raw: string | null, accountId: string, agreementId: string): AgreementUploadRef[] {
  const invalid = () => new Error(`${kind.prefix}_JOURNAL_INVALID`);
  if (raw === null) return [];
  if (raw.length > 3000) throw invalid();
  const r = record(JSON.parse(raw));
  if (!r || Object.keys(r).length !== 4 || r.version !== 1 || r.accountId !== accountId || r.agreementId !== agreementId
    || !Array.isArray(r.uploads) || r.uploads.length > kind.capacity) throw invalid();
  const refs = r.uploads.map(rawRef => {
    const v = record(rawRef);
    if (!v || Object.keys(v).length !== 3 || v.agreementId !== agreementId || !positiveInteger(v.agreementVersion)
      || !uuid(v.clientRequestId) || v.clientRequestId !== v.clientRequestId.toLowerCase()) throw invalid();
    return { agreementId, agreementVersion: v.agreementVersion, clientRequestId: v.clientRequestId };
  });
  if (new Set(refs.map(ref => ref.clientRequestId)).size !== refs.length) throw invalid();
  return refs;
}
/** Opaque identities only. A per-account/Agreement queue prevents stale cleanup
 * or two mounted editors from overwriting an unresolved upload. */
function createJournal(kind: Kind, storage: Storage) {
  function run<T>(accountId: string, agreementId: string, work: (key: string) => Promise<T>): Promise<T> {
    if (!uuid(accountId) || !uuid(agreementId) || accountId !== accountId.toLowerCase() || agreementId !== agreementId.toLowerCase())
      return Promise.reject(new Error(`${kind.prefix}_JOURNAL_INVALID`));
    const key = `uskoci.agreement.${kind.namespace}.v1.${accountId}.${agreementId}`;
    const task = (queues.get(key) ?? Promise.resolve()).catch(() => undefined).then(() => work(key));
    queues.set(key, task); void task.finally(() => { if (queues.get(key) === task) queues.delete(key); }).catch(() => undefined); return task;
  }
  async function mutate(accountId: string, ref: AgreementUploadRef, current: () => boolean, remove: boolean) {
    const captured = { ...ref };
    parse(kind, JSON.stringify({ version: 1, accountId, agreementId: captured.agreementId, uploads: [captured] }), accountId, captured.agreementId);
    return run(accountId, captured.agreementId, async key => {
      const old = parse(kind, await storage.getItem(key), accountId, captured.agreementId);
      if (!current()) throw new Error(`${kind.prefix}_SCOPE_CHANGED`);
      const found = old.find(v => v.clientRequestId === captured.clientRequestId);
      if (found && !exactRef(found, captured)) throw new Error(`${kind.prefix}_JOURNAL_CONFLICT`);
      const uploads = remove ? old.filter(v => !exactRef(v, captured)) : found ? old : [...old, captured];
      if (uploads.length > kind.capacity) throw new Error(`${kind.prefix}_JOURNAL_CAPACITY`);
      await storage.setItem(key, JSON.stringify({ version: 1, accountId, agreementId: captured.agreementId, uploads }));
      return uploads;
    });
  }
  return { load: (accountId: string, agreementId: string) => run(accountId, agreementId, async key => parse(kind, await storage.getItem(key), accountId, agreementId)),
    save: (accountId: string, ref: AgreementUploadRef, current: () => boolean) => mutate(accountId, ref, current, false),
    clear: (accountId: string, ref: AgreementUploadRef, current: () => boolean) => mutate(accountId, ref, current, true) };
}
export const createAgreementPhotoJournal = (storage: Storage = AsyncStorage) => createJournal(PHOTOS, storage);
export const agreementPhotoJournal = createAgreementPhotoJournal();
/** Unsent recordings only (at most three): identities, never audio. The audio bytes live in the recorder's temporary file until the upload is READY. */
export const createAgreementVoiceJournal = (storage: Storage = AsyncStorage) => createJournal(VOICE, storage);
export const agreementVoiceJournal = createAgreementVoiceJournal();
