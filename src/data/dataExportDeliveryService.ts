import { fetch as exportFetch } from 'expo/fetch';
import { DATA_EXPORT_MAX_BYTES, type DataExportDownloadRequest, type DataExportFile, type DataExportPreparation } from '../contracts/dataExport';
import { sesijaSada } from '../store/sesija';
import type { Ishod } from './ports';
import { failure, readOwnedResult, record, sameId, timestamp, uuid } from './serverReceipt';
import { supabaseKlijent } from './supabaseClient';

const codeSet = new Set(['POLICY_NOT_READY', 'BUSY', 'RETRY_REQUIRED', 'NOT_AVAILABLE']);
const changed = () => failure('AUTH_ACCOUNT_CHANGED', 'Nalog je promenjen. Ponovo otvori izvoz podataka.');
const interrupted = () => failure('DATA_EXPORT_INTERRUPTED', 'Preuzimanje je prekinuto. Izvoz možeš ponovo preuzeti dok je dostupan.');
const unavailable = () => failure('DATA_EXPORT_NOT_AVAILABLE', 'Izvoz trenutno nije dostupan. Učitaj trenutno stanje.');

export async function prepareExport(receiptId: string): Promise<Ishod<DataExportPreparation>> {
  if (!uuid(receiptId)) return failure('INVALID_RECEIPT_ID', 'Zahtev nije pronađen.');
  const identity = sesijaSada();
  if (!identity.user) return failure('AUTH_REQUIRED', 'Prijavi se da nastaviš.');
  const account = { accountId: identity.user.id, accountRevision: identity.accountRevision };
  const current = () => sesijaSada().user?.id === account.accountId && sesijaSada().accountRevision === account.accountRevision;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 14_000);
  try {
    return await readOwnedResult({
      account, write: true, errors: {}, fallback: 'DATA_EXPORT_PREPARE_UNCONFIRMED', invalid: 'DATA_EXPORT_INVALID_RESPONSE',
      request: async () => {
        const client = supabaseKlijent();
        const session = await client.auth.getSession();
        if (session.error || !sameId(session.data.session?.user.id, account.accountId) || !session.data.session?.access_token
          || !current() || controller.signal.aborted) throw new Error('EXPORT_SESSION_RETIRED');
        const result = await client.functions.invoke('uskoci-data-export-worker', {
          body: { action: 'prepare', receiptId }, headers: { Authorization: `Bearer ${session.data.session.access_token}` }, signal: controller.signal,
        });
        if (!current() || controller.signal.aborted) throw new Error('EXPORT_SESSION_RETIRED');
        return result;
      },
      decode(raw): DataExportPreparation | null {
        const value = record(raw);
        if (!value || Object.keys(value).some(key => !['receiptId', 'kind', 'code'].includes(key)) || !sameId(value.receiptId, receiptId)
          || !['READY', 'PROCESSING', 'NOT_READY'].includes(String(value.kind))) return null;
        if (value.kind === 'NOT_READY' ? !codeSet.has(String(value.code)) : value.code !== undefined) return null;
        return value as unknown as DataExportPreparation;
      },
    });
  } finally { clearTimeout(timeout); controller.abort(); }
}

/** Auth stays in headers; no signed URL, backend path or response body is logged. */
export async function downloadExport(input: DataExportDownloadRequest, signal?: AbortSignal): Promise<Ishod<DataExportFile>> {
  const command = { receiptId: input?.receiptId, artifactGeneration: input?.artifactGeneration };
  if (!uuid(command.receiptId) || !uuid(command.artifactGeneration)) return failure('INVALID_RECEIPT_ID', 'Zahtev nije pronađen.');
  const identity = sesijaSada(), accountId = identity.user?.id, revision = identity.accountRevision;
  if (!accountId) return failure('AUTH_REQUIRED', 'Prijavi se da preuzmeš izvoz.');
  const current = () => sesijaSada().user?.id === accountId && sesijaSada().accountRevision === revision;
  if (signal?.aborted) return interrupted();
  const controller = new AbortController();
  const stop = () => controller.abort();
  signal?.addEventListener('abort', stop, { once: true });
  let timer: ReturnType<typeof setTimeout> | undefined;
  let bytes: Uint8Array | undefined;
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
  const chunks: Uint8Array[] = [];
  const retired = () => !current() || controller.signal.aborted;
  try {
    const work = async (): Promise<Ishod<DataExportFile>> => {
      const client = supabaseKlijent(), session = await client.auth.getSession();
      if (!current()) return changed();
      if (controller.signal.aborted) return interrupted();
      if (session.error || !sameId(session.data.session?.user.id, accountId) || !session.data.session?.access_token) return unavailable();
      const urlValue = process.env.EXPO_PUBLIC_SUPABASE_URL, anon = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
      if (!urlValue || !anon) return unavailable();
      const origin = new URL(urlValue);
      if (origin.username || origin.password || origin.search || origin.hash || !['', '/'].includes(origin.pathname)
        || (origin.protocol !== 'https:' && !(origin.protocol === 'http:' && ['127.0.0.1', 'localhost', '[::1]'].includes(origin.hostname)))) return unavailable();
      const response = await exportFetch(`${origin.origin}/functions/v1/uskoci-data-export-download`, {
        method: 'POST', body: JSON.stringify(command), signal: controller.signal, redirect: 'error',
        headers: { apikey: anon, Authorization: `Bearer ${session.data.session.access_token}`, 'Content-Type': 'application/json' },
      });
      if (retired()) { await response.body?.cancel(); return current() ? interrupted() : changed(); }
      if (response.status !== 200 || response.headers.get('content-type')?.split(';')[0].trim() !== 'application/json') {
        await response.body?.cancel(); return unavailable();
      }
      const lengthText = response.headers.get('content-length'), sha256 = response.headers.get('x-uskoci-export-sha256'), md5 = response.headers.get('x-uskoci-export-md5');
      const expiresAt = response.headers.get('x-uskoci-export-expires-at');
      if (!sameId(response.headers.get('x-uskoci-export-receipt'), command.receiptId)
        || !sameId(response.headers.get('x-uskoci-export-generation'), command.artifactGeneration)
        || !lengthText || !/^[1-9][0-9]*$/.test(lengthText) || Number(lengthText) > DATA_EXPORT_MAX_BYTES
        || !sha256 || !/^[a-f0-9]{64}$/.test(sha256) || !md5 || !/^[a-f0-9]{32}$/.test(md5)
        || !timestamp(expiresAt) || Date.parse(expiresAt) <= Date.now() || !response.body) {
        await response.body?.cancel(); return unavailable();
      }
      const byteLength = Number(lengthText);
      reader = response.body.getReader(); let total = 0;
      while (true) {
        const part = await reader.read();
        if (retired() || Date.now() >= Date.parse(expiresAt)) {
          // A read may settle after abort or even after the caller's timeout.
          part.value?.fill(0);
          await reader.cancel(); return current() ? interrupted() : changed();
        }
        if (part.done) break;
        total += part.value.byteLength;
        if (total > byteLength || total > DATA_EXPORT_MAX_BYTES) { part.value.fill(0); await reader.cancel(); return unavailable(); }
        chunks.push(part.value);
      }
      if (total !== byteLength || retired()) return current() ? unavailable() : changed();
      bytes = new Uint8Array(total); let offset = 0;
      for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; chunk.fill(0); }
      chunks.length = 0;
      // The native save adapter verifies the physical file's MD5/size. SHA256
      // is the server's security binding, verified against Storage before release.
      return { ok: true, podatak: { ...command, bytes, byteLength, sha256, md5 } };
    };
    const result = await Promise.race([
      work(), new Promise<Ishod<DataExportFile>>(resolve => { timer = setTimeout(() => { controller.abort(); resolve(interrupted()); }, 60_000); }),
    ]);
    if (!current()) { bytes?.fill(0); return changed(); }
    if (!result.ok || controller.signal.aborted) { bytes?.fill(0); return result.ok ? interrupted() : result; }
    return result;
  } catch { bytes?.fill(0); return current() ? interrupted() : changed(); }
  finally {
    if (timer) clearTimeout(timer);
    controller.abort(); signal?.removeEventListener('abort', stop);
    for (const chunk of chunks) chunk.fill(0);
    if (reader) void reader.cancel().catch(() => undefined);
  }
}
