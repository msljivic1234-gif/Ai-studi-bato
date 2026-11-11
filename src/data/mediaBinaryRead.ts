import { sesijaSada } from '../store/sesija';
import { supabaseKlijent } from './supabaseClient';
import { sameId, type ReceiptAccount } from './serverReceipt';

const MAX_BYTES = 5_242_880;
const unavailable = () => ({ data: null, error: { message: 'MEDIA_UNAVAILABLE' } });
const invalid = () => ({ data: null, error: null });

/** The installed Functions SDK decodes image/jpeg with response.text(), irreversibly consuming
 * its bytes. Only contextual media reads use this binary transport. Uploads and JSON lists keep
 * functions.invoke. Auth remains the existing client's current session; no second auth client,
 * storage URL, persistent image cache, SDK patch or text-to-byte reconstruction is introduced. */
export async function readMediaBinary(input: {
  account: ReceiptAccount; body: Readonly<Record<string, string>>;
  operation: 'read' | 'agreement-read'; signal?: AbortSignal;
}) {
  const controller = new AbortController();
  let retired = false;
  const current = () => !retired && !controller.signal.aborted && !input.signal?.aborted
    && sesijaSada().user?.id === input.account.accountId && sesijaSada().accountRevision === input.account.accountRevision;
  const abort = () => controller.abort();
  let rejectAborted: (() => void) | undefined;
  const aborted = new Promise<never>((_resolve, reject) => {
    rejectAborted = () => reject(new Error('MEDIA_READ_CANCELLED'));
    controller.signal.addEventListener('abort', rejectAborted);
  });
  const timer = setTimeout(abort, 15_000);
  input.signal?.addEventListener('abort', abort);
  try {
    if (!current()) return unavailable();
    const request = async () => {
      const configuredUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
      const publicKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
      if (!configuredUrl || !publicKey || publicKey.startsWith('sb_secret_')) return unavailable();
      const base = new URL(configuredUrl);
      if (base.protocol !== 'https:' || base.username || base.password || base.search || base.hash) return unavailable();
      const endpoint = new URL('/functions/v1/uskoci-media', base);
      const auth = await supabaseKlijent().auth.getSession();
      if (!current()) return unavailable();
      const session = auth.data.session;
      if (auth.error || !session || !sameId(session.user.id, input.account.accountId)
        || typeof session.access_token !== 'string' || !session.access_token || /\s/.test(session.access_token)) return unavailable();
      const response = await fetch(endpoint.href, {
        method: 'POST', signal: controller.signal, cache: 'no-store', credentials: 'omit', redirect: 'error',
        headers: { 'Content-Type': 'application/json', Accept: 'image/jpeg', apikey: publicKey,
          Authorization: `Bearer ${session.access_token}`, 'x-media-operation': input.operation },
        body: JSON.stringify(input.body),
      });
      if (!current() || !response.ok || response.redirected || response.headers.get('x-relay-error') === 'true') return unavailable();
      const type = (response.headers.get('Content-Type') ?? '').split(';')[0].trim().toLowerCase();
      const declared = response.headers.get('Content-Length');
      if (type !== 'image/jpeg' || (declared !== null && (!/^\d+$/.test(declared) || Number(declared) > MAX_BYTES))) return invalid();
      // React Native's bundled whatwg-fetch supports Response.arrayBuffer via its Blob/FileReader
      // path. Read the untouched response body, not Blob.arrayBuffer or an already parsed SDK string.
      const bytes = await response.arrayBuffer();
      if (!current()) return unavailable();
      if (!(bytes instanceof ArrayBuffer) || bytes.byteLength < 1 || bytes.byteLength > MAX_BYTES) return invalid();
      return { data: { bytes, contentType: 'image/jpeg' as const }, error: null };
    };
    return await Promise.race([request(), aborted]);
  } catch {
    // HTTP bodies, URLs and auth/provider details never become a public error.
    return unavailable();
  } finally {
    retired = true;
    clearTimeout(timer);
    input.signal?.removeEventListener('abort', abort);
    if (rejectAborted) controller.signal.removeEventListener('abort', rejectAborted);
  }
}
