/** Private export transport. No response bodies, credentials or object paths are logged. */
import { isSupabaseServiceRequest, readSupabasePublishableKey, readSupabaseServiceKey, supabaseServiceHeaders } from './supabaseKeys.mjs';
declare const Deno: { env: { get(name: string): string | undefined } };
export const MAX_BYTES = 8 * 1024 * 1024;
export const BUCKET = 'data-export-artifacts';
export type Row = Record<string, unknown>;
export const row = (value: unknown): Row | null => value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Row : null;
export const only = (value: Row, keys: string[]) => Object.keys(value).every(key => keys.includes(key));
export const uuid = (v: unknown): v is string => typeof v === 'string' && /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/.test(v);
export const hash = (v: unknown): v is string => typeof v === 'string' && /^[0-9a-f]{64}$/.test(v);
export const md5 = (v: unknown): v is string => typeof v === 'string' && /^[0-9a-f]{32}$/.test(v);
export const bytesCount = (v: unknown): v is number => typeof v === 'number' && Number.isSafeInteger(v) && v > 0 && v <= MAX_BYTES;
export const instant = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/.test(v) && Number.isFinite(Date.parse(v));
export const liveInstant = (v: unknown): v is string => instant(v) && Date.parse(v) > Date.now();
export function expectedPath(accountId: string, receiptId: string, generation: string) {
  return `${accountId}/${receiptId}/${generation}.json`;
}
export const cors = {
  'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Expose-Headers': 'content-length, x-uskoci-export-receipt, x-uskoci-export-generation, x-uskoci-export-sha256, x-uskoci-export-md5, x-uskoci-export-expires-at',
};
export class Rejected extends Error { constructor(public status: number, public code: string) { super(code); } }
export function json(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), { status, headers: { ...cors, 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });
}
export function preflight(req: Request) {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (req.method !== 'POST') return json({ code: 'METHOD_NOT_ALLOWED' }, 405);
  if (req.headers.has('range')) return json({ code: 'RANGE_NOT_SUPPORTED' }, 416);
  if (req.headers.get('content-type')?.split(';')[0].trim() !== 'application/json') return json({ code: 'JSON_REQUIRED' }, 415);
  return null;
}
export async function readBytes(body: ReadableStream<Uint8Array> | null, limit: number, signal: AbortSignal): Promise<Uint8Array<ArrayBuffer>> {
  if (!body) throw new Rejected(502, 'EXPORT_INVALID_RESPONSE');
  const reader = body.getReader(); const chunks: Uint8Array[] = []; let total = 0;
  const stop = () => { void reader.cancel().catch(() => undefined); };
  signal.addEventListener('abort', stop, { once: true });
  try {
    while (true) {
      if (signal.aborted) throw new Rejected(503, 'EXPORT_UNAVAILABLE');
      const part = await reader.read();
      if (signal.aborted) { part.value?.fill(0); throw new Rejected(503, 'EXPORT_UNAVAILABLE'); }
      if (part.done) break;
      total += part.value.byteLength;
      if (total > limit) { part.value.fill(0); throw new Rejected(413, 'EXPORT_TOO_LARGE'); }
      chunks.push(part.value);
    }
    const value = new Uint8Array(total); let offset = 0;
    for (const chunk of chunks) { value.set(chunk, offset); offset += chunk.byteLength; }
    return value;
  } finally {
    signal.removeEventListener('abort', stop);
    for (const chunk of chunks) chunk.fill(0);
    void reader.cancel().catch(() => undefined);
  }
}
export async function parseJSON(body: ReadableStream<Uint8Array> | null, limit: number, signal: AbortSignal) {
  const bytes = await readBytes(body, limit, signal);
  try { return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)); }
  catch { throw new Rejected(502, 'EXPORT_INVALID_RESPONSE'); }
  finally { bytes.fill(0); }
}
export async function sha256(bytes: Uint8Array) {
  const digest = await crypto.subtle.digest('SHA-256', bytes as Uint8Array<ArrayBuffer>);
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}
/** Storage v1.70.3 renders NoSuchKey/404 in an HTTP400 envelope; retain
 * its explicit object code and payload status, never infer absence from a 4xx.
 * https://github.com/supabase/storage/blob/v1.70.3/src/internal/errors/storage-error.ts */
export async function objectAbsent(response: Response, signal: AbortSignal) {
  if (![400, 404].includes(response.status)) { void response.body?.cancel().catch(() => undefined); return false; }
  const error = row(await parseJSON(response.body, 4096, signal));
  const code = error?.code ?? error?.error;
  if (code !== 'NoSuchKey' && code !== 'not_found') return false;
  if (error?.error !== undefined && error.error !== 'NoSuchKey' && error.error !== 'not_found') return false;
  const statuses = [error?.statusCode, error?.httpStatusCode].filter(value => value !== undefined);
  if (statuses.some(value => String(value) !== '404')) return false;
  return response.status === 404 || statuses.length > 0;
}
type Window = { busy: boolean; count: number; start: number; last: number };
const windows = new Map<string, Window>();
export function reserve(accountId: string) {
  const now = Date.now();
  for (const [key, value] of windows) if (!value.busy && now - value.last >= 60_000) windows.delete(key);
  let value = windows.get(accountId);
  if (!value) { if (windows.size >= 1024) throw new Rejected(429, 'RATE_LIMITED'); value = { busy: false, count: 0, start: now, last: 0 }; windows.set(accountId, value); }
  if (now - value.start >= 60_000) { value.start = now; value.count = 0; }
  if (value.busy || now - value.last < 1000 || value.count >= 10) throw new Rejected(429, 'RATE_LIMITED');
  value.busy = true; value.count++; value.last = now;
  return () => { value.busy = false; };
}
export class Transport {
  readonly base: string;
  readonly authorization: string;
  private readonly incoming: Headers;
  private readonly anon: string;
  constructor(readonly signal: AbortSignal, req: Request) {
    const raw = Deno.env.get('SUPABASE_URL'), anon = readSupabasePublishableKey(name => Deno.env.get(name));
    if (!raw || !anon) throw new Rejected(503, 'EXPORT_UNAVAILABLE');
    const url = new URL(raw);
    if (url.username || url.password || url.search || url.hash || !['', '/'].includes(url.pathname)
      || (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['127.0.0.1', 'localhost', '[::1]', 'kong'].includes(url.hostname)))) throw new Rejected(503, 'EXPORT_UNAVAILABLE');
    this.base = url.origin; this.anon = anon; this.authorization = req.headers.get('authorization') ?? '';
    this.incoming = new Headers(req.headers);
    // A person comes with a Bearer session token. The scheduled tick comes with the server key on `apikey`: on a
    // project whose server key is a secret key (sb_secret_), a Bearer that is not a JWT never passes the gateway.
    const session = /^Bearer [A-Za-z0-9._~-]{16,4096}$/.test(this.authorization) && !this.authorization.startsWith('Bearer sb_');
    if (!session && !this.isInternal()) throw new Rejected(401, 'AUTH_REQUIRED');
  }
  private service() { const key = readSupabaseServiceKey(name => Deno.env.get(name)); if (!key) throw new Rejected(503, 'EXPORT_UNAVAILABLE'); return key; }
  isInternal() { return isSupabaseServiceRequest(this.incoming, name => Deno.env.get(name)); }
  async request(path: string, init: RequestInit, service = false) {
    if (this.signal.aborted || !path.startsWith('/') || path.includes('..') || path.startsWith('//')) throw new Rejected(503, 'EXPORT_UNAVAILABLE');
    const key = service ? this.service() : this.anon;
    const headers = new Headers(service ? supabaseServiceHeaders(key, init.headers) : init.headers);
    if (!service) { headers.set('apikey', key); headers.set('authorization', this.authorization); }
    const response = await fetch(this.base + path, { ...init, signal: this.signal, redirect: 'error', cache: 'no-store', credentials: 'omit',
      headers });
    if (this.signal.aborted) { void response.body?.cancel().catch(() => undefined); throw new Rejected(503, 'EXPORT_UNAVAILABLE'); }
    return response;
  }
  async user() {
    const response = await this.request('/auth/v1/user', { method: 'GET' });
    if (!response.ok) { void response.body?.cancel().catch(() => undefined); throw new Rejected(401, 'AUTH_REQUIRED'); }
    const value = row(await parseJSON(response.body, 65536, this.signal));
    if (!value || !uuid(value.id) || value.role !== 'authenticated') throw new Rejected(401, 'AUTH_REQUIRED');
    return value.id;
  }
  async rpc(name: string, args: Row, service = false, limit = 65536) {
    if (!/^rpc_[a-z_]+$/.test(name)) throw new Rejected(503, 'EXPORT_UNAVAILABLE');
    const response = await this.request(`/rest/v1/rpc/${name}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(args) }, service);
    if (!response.ok) { void response.body?.cancel().catch(() => undefined); throw new Rejected(response.status === 401 ? 401 : response.status === 403 ? 403 : 409, 'EXPORT_NOT_AVAILABLE'); }
    return parseJSON(response.body, limit, this.signal);
  }
  storagePath(objectPath: string) {
    if (!/^[0-9a-f-]{36}\/[0-9a-f-]{36}\/[0-9a-f-]{36}\.json$/.test(objectPath)) throw new Rejected(502, 'EXPORT_INVALID_RESPONSE');
    return `/storage/v1/object/${BUCKET}/${objectPath}`;
  }
}
export async function bounded(req: Request, task: (transport: Transport, signal: AbortSignal) => Promise<Response>, ms = 55_000) {
  const controller = new AbortController(); const stop = () => controller.abort();
  req.signal.addEventListener('abort', stop, { once: true }); if (req.signal.aborted) controller.abort();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      task(new Transport(controller.signal, req), controller.signal),
      new Promise<Response>(resolve => { timer = setTimeout(() => { controller.abort(); resolve(json({ code: 'EXPORT_UNAVAILABLE' }, 503)); }, ms); }),
    ]);
  } catch (error) { return error instanceof Rejected ? json({ code: error.code }, error.status) : json({ code: 'EXPORT_UNAVAILABLE' }, 503); }
  finally { if (timer) clearTimeout(timer); controller.abort(); req.signal.removeEventListener('abort', stop); }
}
