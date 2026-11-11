import { sesijaSada } from '../store/sesija';
import { supabaseKlijent } from './supabaseClient';
import { sameId, type ReceiptAccount } from './serverReceipt';

export const VOICE_MAX_BYTES = 4_194_304;
const unavailable = () => ({ data: null, error: { message: 'MEDIA_UNAVAILABLE' } });
const invalid = () => ({ data: null, error: null });

/** The bytes of ONE authorized voice message, read as a binary body (the Functions SDK would decode an audio response as text and destroy it).
 * Same fences as the photo reader: the current session only, no second auth client, no stored URL, no persistent cache, no redirect. The body carries
 * the Agreement, the asset and (for a received or already sent message) the canonical message id; the server authorizes that exact message twice.
 * The service receipt owner supplies the one deadline/cancellation signal, covering session lookup, fetch and the complete body read. */
export async function readVoiceBinary(input: {
  account: ReceiptAccount; body: Readonly<Record<string, string>>; signal: AbortSignal;
}) {
  let retired = false;
  const current = () => !retired && !input.signal.aborted
    && sesijaSada().user?.id === input.account.accountId && sesijaSada().accountRevision === input.account.accountRevision;
  let rejectAborted: (() => void) | undefined;
  const aborted = new Promise<never>((_resolve, reject) => {
    rejectAborted = () => reject(new Error('MEDIA_READ_CANCELLED'));
    input.signal.addEventListener('abort', rejectAborted);
  });
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
        method: 'POST', signal: input.signal, cache: 'no-store', credentials: 'omit', redirect: 'error',
        headers: { 'Content-Type': 'application/json', Accept: 'audio/mp4', apikey: publicKey,
          Authorization: `Bearer ${session.access_token}`, 'x-media-operation': 'agreement-voice-read' },
        body: JSON.stringify(input.body),
      });
      if (!current() || !response.ok || response.redirected || response.headers.get('x-relay-error') === 'true') return unavailable();
      const type = (response.headers.get('Content-Type') ?? '').split(';')[0].trim().toLowerCase();
      const declared = response.headers.get('Content-Length');
      if (type !== 'audio/mp4' || (declared !== null && (!/^\d+$/.test(declared) || Number(declared) > VOICE_MAX_BYTES))) return invalid();
      const bytes = await response.arrayBuffer();
      if (!current()) return unavailable();
      if (!(bytes instanceof ArrayBuffer) || bytes.byteLength < 1 || bytes.byteLength > VOICE_MAX_BYTES) return invalid();
      return { data: { bytes, contentType: 'audio/mp4' as const }, error: null };
    };
    return await Promise.race([request(), aborted]);
  } catch {
    // HTTP bodies, URLs and auth/provider details never become a public error.
    return unavailable();
  } finally {
    retired = true;
    if (rejectAborted) input.signal.removeEventListener('abort', rejectAborted);
  }
}
