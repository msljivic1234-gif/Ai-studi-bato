/** Authenticated, read-only LocationIQ forward/reverse adapter. Deploy with verify_jwt=true.
 * The owner-approved EU endpoint is fixed; only LOCATIONIQ_ACCESS_TOKEN is secret.
 * These are proposals, never pin attestation. Manual map selection stays separate.
 * API: https://docs.locationiq.com/reference/search (format=json, query key).
 * Reverse: https://docs.locationiq.com/reference/reverse-api (lat/lon, query key).
 * place_id is an opaque, nonpersistent provider hint, not a durable place identity.
 */
import { readSupabasePublishableKey } from '../_shared/supabaseKeys.mjs';
export {};
// Keep the Edge entry in the native repository's strict TypeScript check without
// adding ambient Deno globals to the Expo compilation.
declare const Deno: {
  env: { get(name: string): string | undefined };
  serve(handler: (request: Request) => Response | Promise<Response>): unknown;
};
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const deadlineMs = 7_000;
const responseBytes = 131_072;
const providerEndpoint = 'https://eu1.locationiq.com/v1/search';
const reverseEndpoint = 'https://eu1.locationiq.com/v1/reverse';
const providerHint = 'locationiq';
type SearchWindow = { start: number; last: number; count: number; busy: boolean };
const searchWindows = new Map<string, SearchWindow>();
type RecordValue = Record<string, unknown>;
type Candidate = {
  label: string; countryCode: string; position: { latitude: number; longitude: number };
  providerHint: string; candidateId: string;
};
class Rejected extends Error {
  constructor(readonly status: number, readonly code: string) { super(code); }
}
const failureStages = ['REQUEST', 'CONFIG', 'AUTH_FETCH', 'AUTH_BODY', 'MARKETS_FETCH', 'MARKETS_BODY',
  'PROVIDER_CONFIG', 'RATE_LIMIT', 'PROVIDER_FETCH', 'PROVIDER_BODY', 'PROVIDER_NORMALIZE'] as const;
const failureReasons = ['INVALID_QUERY', 'AUTH_REQUIRED', 'CONFIG_UNAVAILABLE', 'COUNTRY_NOT_AVAILABLE',
  'PROVIDER_ACTIVATION_BLOCKED', 'RATE_LIMITED', 'NETWORK_ERROR', 'REDIRECT_BLOCKED', 'HTTP_ERROR',
  'BODY_LIMIT', 'BODY_UNAVAILABLE', 'BODY_CANCELLED', 'BODY_READ_FAILED', 'INVALID_JSON',
  'MARKET_ROWS_INVALID', 'PROVIDER_404_UNRECOGNIZED', 'NORMALIZED_ROWS_INVALID', 'DEADLINE_EXCEEDED', 'CANCELLED'] as const;
type FailureStage = typeof failureStages[number];
type FailureReason = typeof failureReasons[number];
const normalizationReasons = ['ARRAY_SHAPE', 'ROW_LIMIT', 'ROW_SHAPE', 'COUNTRY_MISMATCH',
  'LABEL_INVALID', 'COORDINATE_INVALID', 'ID_INVALID', 'DUPLICATE_ID'] as const;
type NormalizationReason = typeof normalizationReasons[number];
const coordinateReasons = ['JSON_NUMBER', 'MISSING_OR_TYPE', 'LENGTH', 'EMPTY', 'WHITESPACE_DECIMAL',
  'SCIENTIFIC', 'LEADING_PLUS', 'LEADING_ZERO', 'MALFORMED', 'NON_FINITE', 'OUT_OF_RANGE'] as const;
type CoordinateReason = typeof coordinateReasons[number];
class BodyReadFailure extends Error {
  constructor(readonly reason: Extract<FailureReason, 'BODY_LIMIT' | 'BODY_UNAVAILABLE' | 'BODY_CANCELLED' | 'INVALID_JSON'>) { super(reason); }
}
/** Failure metadata only. Never accept free-form errors, request fields or provider bodies. */
function logFailure(stage: FailureStage, reason: FailureReason, upstreamStatus: number | null,
  normalizationReason: NormalizationReason | null, coordinateReason: CoordinateReason | null): void {
  if (!failureStages.includes(stage) || !failureReasons.includes(reason)) return;
  const safeStatus = Number.isInteger(upstreamStatus) && upstreamStatus !== null && upstreamStatus >= 100 && upstreamStatus <= 599
    ? upstreamStatus : null;
  try {
    console.warn(JSON.stringify({ event: 'LOCATION_SEARCH_FAILURE', stage, reason, upstreamStatus: safeStatus,
      ...(reason === 'NORMALIZED_ROWS_INVALID' && normalizationReason !== null && normalizationReasons.includes(normalizationReason)
        ? { normalizationReason } : {}),
      ...(reason === 'NORMALIZED_ROWS_INVALID' && normalizationReason === 'COORDINATE_INVALID'
        && coordinateReason !== null && coordinateReasons.includes(coordinateReason) ? { coordinateReason } : {}),
    }));
  } catch { /* Diagnostics cannot change the caller's response. */ }
}
function response(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: {
    ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  } });
}
function record(value: unknown): RecordValue | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as RecordValue : null;
}
function only(value: RecordValue, keys: readonly string[]): boolean {
  return Object.keys(value).every(key => keys.includes(key));
}
// Same Unicode-character/control/ASCII-space rules as the native location owner.
function locationText(value: unknown, max: number): string | null {
  if (typeof value !== 'string' || /[\u0000-\u001f\u007f]/.test(value)) return null;
  const text = value.replace(/^ +| +$/g, '');
  return text.length && Array.from(text).length <= max ? text : null;
}
function providerToken(): string | null {
  const token = Deno.env.get('LOCATIONIQ_ACCESS_TOKEN');
  return token && token.length <= 4096 && /^[\x21-\x7e]+$/.test(token) ? token : null;
}
/** Per authenticated user: one in flight, >=1s between calls, <=10/minute.
 * Bounded isolate-local burst protection, not a distributed quota or provider-plan
 * guarantee. Cold starts reset this cache; upstream 429 remains authoritative.
 * No addresses, session tokens or provider responses are retained here.
 */
function reserveSearch(userId: string): () => void {
  const now = Date.now();
  for (const [id, window] of searchWindows) {
    if (!window.busy && now - window.last >= 60_000) searchWindows.delete(id);
  }
  let window = searchWindows.get(userId);
  if (window?.busy || (window && now - window.last < 1000)) throw new Rejected(429, 'RATE_LIMITED');
  if (!window) {
    if (searchWindows.size >= 1024) throw new Rejected(429, 'RATE_LIMITED');
    window = { start: now, last: now, count: 0, busy: false };
    searchWindows.set(userId, window);
  } else if (now - window.start >= 60_000) {
    window.start = now;
    window.count = 0;
  }
  if (window.count >= 10) throw new Rejected(429, 'RATE_LIMITED');
  window.last = now;
  window.count++;
  window.busy = true;
  const reserved = window;
  return () => { reserved.busy = false; };
}
async function boundedJson(message: Request | Response, maxBytes: number, signal: AbortSignal): Promise<unknown> {
  const length = message.headers.get('content-length');
  if (length !== null && (!/^\d+$/.test(length) || Number(length) > maxBytes)) throw new BodyReadFailure('BODY_LIMIT');
  if (!message.body || signal.aborted) throw new BodyReadFailure('BODY_UNAVAILABLE');
  const reader = message.body.getReader(), decoder = new TextDecoder('utf-8', { fatal: true });
  let size = 0, text = '';
  const abort = () => { void reader.cancel().catch(() => {}); };
  signal.addEventListener('abort', abort, { once: true });
  try {
    while (true) {
      const chunk = await reader.read();
      if (signal.aborted) throw new BodyReadFailure('BODY_CANCELLED');
      if (chunk.done) break;
      size += chunk.value.byteLength;
      if (size > maxBytes) throw new BodyReadFailure('BODY_LIMIT');
      text += decoder.decode(chunk.value, { stream: true });
    }
    text += decoder.decode();
    try { return JSON.parse(text); } catch { throw new BodyReadFailure('INVALID_JSON'); }
  } finally {
    signal.removeEventListener('abort', abort);
    void reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}
function availableCountry(raw: unknown, requested: string): boolean | null {
  if (!Array.isArray(raw) || raw.length > 250) return null;
  const seen = new Set<string>();
  let available = false;
  for (const item of raw) {
    const market = record(item);
    if (!market || !only(market, ['countryCode', 'productStatus', 'defaultCurrencyCode', 'defaultLanguageTag', 'defaultTimezone'])
      || typeof market.countryCode !== 'string' || !/^[A-Z]{2}$/.test(market.countryCode) || seen.has(market.countryCode)
      || typeof market.productStatus !== 'string' || !['BUILDING', 'LIVE', 'WAITLIST', 'COMING'].includes(market.productStatus)
      || typeof market.defaultCurrencyCode !== 'string' || !/^[A-Z]{3}$/.test(market.defaultCurrencyCode)
      || typeof market.defaultLanguageTag !== 'string' || market.defaultLanguageTag.length > 35 || !/^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/.test(market.defaultLanguageTag)
      || typeof market.defaultTimezone !== 'string' || market.defaultTimezone.length > 100
      || !/^[A-Za-z_]+(?:\/[A-Za-z0-9_+.-]+)*$/.test(market.defaultTimezone)) return null;
    try { new Intl.DateTimeFormat('en', { timeZone: market.defaultTimezone }); } catch { return null; }
    seen.add(market.countryCode);
    if (market.countryCode === requested && ['BUILDING', 'LIVE'].includes(market.productStatus)) available = true;
  }
  return available;
}
function coordinate(raw: unknown, bound: number): number | null {
  if (typeof raw !== 'string' || raw.length > 40 || !/^-?(?:0|[1-9]\d*)(?:\.\d+)?$/.test(raw)) return null;
  const value = Number(raw);
  return Number.isFinite(value) && Math.abs(value) <= bound ? value : null;
}
/** Describe a rejection without retaining its value or changing coordinate admission. */
function coordinateRejection(raw: unknown, bound: number): CoordinateReason {
  if (typeof raw === 'number') {
    if (!Number.isFinite(raw)) return 'NON_FINITE';
    return Math.abs(raw) > bound ? 'OUT_OF_RANGE' : 'JSON_NUMBER';
  }
  if (typeof raw !== 'string') return 'MISSING_OR_TYPE';
  if (raw.length > 40) return 'LENGTH';
  if (raw.length === 0) return 'EMPTY';
  const trimmed = raw.trim();
  if (/^[+-]?(?:Infinity|NaN)$/.test(trimmed)) return 'NON_FINITE';
  // Classification of recognized numeric representations only; no coercion of
  // booleans, empty strings, hex or arbitrary objects into usable coordinates.
  if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(trimmed)) return 'MALFORMED';
  const value = Number(trimmed);
  if (!Number.isFinite(value)) return 'NON_FINITE';
  if (Math.abs(value) > bound) return 'OUT_OF_RANGE';
  if (raw !== trimmed && /^-?(?:0|[1-9]\d*)(?:\.\d+)?$/.test(trimmed)) return 'WHITESPACE_DECIMAL';
  if (/[eE]/.test(trimmed)) return 'SCIENTIFIC';
  if (trimmed.startsWith('+')) return 'LEADING_PLUS';
  if (/^-?0\d+(?:\.\d+)?$/.test(trimmed)) return 'LEADING_ZERO';
  return 'MALFORMED';
}
function candidateId(raw: unknown): string | null {
  if (typeof raw === 'number') return Number.isSafeInteger(raw) && raw > 0 ? String(raw) : null;
  return typeof raw === 'string' && /^[1-9]\d{0,159}$/.test(raw) ? raw : null;
}
function normalizeCandidates(raw: unknown, country: string, hint: string,
  rejected: (reason: NormalizationReason, coordinateReason?: CoordinateReason) => void): Candidate[] | null {
  const invalid = (reason: NormalizationReason, coordinateReason?: CoordinateReason): null => { rejected(reason, coordinateReason); return null; };
  if (!Array.isArray(raw)) return invalid('ARRAY_SHAPE');
  if (raw.length > 10) return invalid('ROW_LIMIT');
  const result: Candidate[] = [], ids = new Set<string>();
  for (const item of raw) {
    const row = record(item), address = record(row?.address);
    if (!row || !address) return invalid('ROW_SHAPE');
    if (address.country_code !== country.toLowerCase()) return invalid('COUNTRY_MISMATCH');
    const label = locationText(row.display_name, 1000), latitude = coordinate(row.lat, 90), longitude = coordinate(row.lon, 180);
    const id = candidateId(row.place_id);
    if (!label) return invalid('LABEL_INVALID');
    if (latitude === null) return invalid('COORDINATE_INVALID', coordinateRejection(row.lat, 90));
    if (longitude === null) return invalid('COORDINATE_INVALID', coordinateRejection(row.lon, 180));
    if (!id) return invalid('ID_INVALID');
    if (ids.has(id)) return invalid('DUPLICATE_ID');
    ids.add(id);
    // Provider extras (including bounding boxes, licence URLs and names) never
    // become arbitrary wire fields. A malformed row rejects the entire response.
    result.push({ label, countryCode: country, position: { latitude, longitude }, providerHint: hint, candidateId: id });
  }
  return result;
}
Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return response(405, { code: 'METHOD_NOT_ALLOWED' });
  const authorization = req.headers.get('Authorization') ?? '';
  if (!/^Bearer [^\s]+$/.test(authorization) || authorization.length > 8192) return response(401, { code: 'AUTH_REQUIRED' });
  if (req.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json') return response(400, { code: 'INVALID_QUERY' });
  const controller = new AbortController();
  const abort = () => controller.abort();
  req.signal.addEventListener('abort', abort, { once: true });
  if (req.signal.aborted) abort();
  const timer = setTimeout(abort, deadlineMs);
  let failureStage: FailureStage = 'REQUEST';
  let failureReason: FailureReason = 'INVALID_QUERY';
  let upstreamStatus: number | null = null;
  let normalizationReason: NormalizationReason | null = null;
  let coordinateReason: CoordinateReason | null = null;
  let releaseSearch: (() => void) | undefined;
  let rejectAborted: (() => void) | undefined;
  const aborted = new Promise<never>((_resolve, reject) => {
    rejectAborted = () => reject(new Rejected(req.signal.aborted ? 499 : 504, req.signal.aborted ? 'CANCELLED' : 'UNAVAILABLE'));
    controller.signal.addEventListener('abort', rejectAborted, { once: true });
    if (controller.signal.aborted) rejectAborted();
  });
  try {
    const work = async (): Promise<Response> => {
      let body: RecordValue | null;
      try { body = record(await boundedJson(req, 8192, controller.signal)); } catch { throw new Rejected(400, 'INVALID_QUERY'); }
      const text = locationText(body?.text, 1000), country = body?.countryCode;
      const reverse = body?.mode === 'reverse', position = record(body?.position);
      const validPosition = position && only(position, ['latitude', 'longitude'])
        && typeof position.latitude === 'number' && Number.isFinite(position.latitude) && Math.abs(position.latitude) <= 90
        && typeof position.longitude === 'number' && Number.isFinite(position.longitude) && Math.abs(position.longitude) <= 180;
      if (!body || typeof country !== 'string' || !/^[A-Z]{2}$/.test(country)
        || (reverse ? !only(body, ['mode', 'position', 'countryCode']) || !validPosition : !only(body, ['text', 'countryCode']) || !text)) throw new Rejected(400, 'INVALID_QUERY');
      failureStage = 'CONFIG'; failureReason = 'CONFIG_UNAVAILABLE';
      const supabaseUrl = Deno.env.get('SUPABASE_URL'), anonKey = readSupabasePublishableKey(name => Deno.env.get(name));
      if (!supabaseUrl || !anonKey) throw new Rejected(503, 'SERVER_CONFIG_ERROR');
      const authenticatedHeaders = { apikey: anonKey, Authorization: authorization, Accept: 'application/json' };
      const fetchBound = async (url: string | URL, init: RequestInit): Promise<Response> => {
        if (controller.signal.aborted) throw new Error('CANCELLED');
        const result = await fetch(url, { ...init, signal: controller.signal, redirect: 'error', cache: 'no-store', credentials: 'omit', referrerPolicy: 'no-referrer' });
        if (controller.signal.aborted || result.redirected) {
          if (result.redirected) failureReason = 'REDIRECT_BLOCKED';
          throw new Error('CANCELLED_OR_REDIRECT');
        }
        return result;
      };
      // A syntactically plausible JWT/anon/service key is not an authenticated
      // user. Ask Auth for the current user, then let the same JWT invoke the RPC.
      failureStage = 'AUTH_FETCH'; failureReason = 'NETWORK_ERROR';
      const auth = await fetchBound(`${supabaseUrl.replace(/\/$/, '')}/auth/v1/user`, { method: 'GET', headers: authenticatedHeaders });
      failureReason = 'HTTP_ERROR';
      if ([401, 403].includes(auth.status)) throw new Rejected(401, 'AUTH_REQUIRED');
      if (!auth.ok) throw new Rejected(502, 'UNAVAILABLE');
      failureStage = 'AUTH_BODY'; failureReason = 'BODY_READ_FAILED';
      const user = record(await boundedJson(auth, responseBytes, controller.signal));
      if (!user || typeof user.id !== 'string' || !uuidPattern.test(user.id) || user.role !== 'authenticated') throw new Rejected(401, 'AUTH_REQUIRED');
      failureStage = 'MARKETS_FETCH'; failureReason = 'NETWORK_ERROR';
      const markets = await fetchBound(`${supabaseUrl.replace(/\/$/, '')}/rest/v1/rpc/rpc_list_location_markets`, {
        method: 'POST', headers: { ...authenticatedHeaders, 'Content-Type': 'application/json' }, body: '{}',
      });
      failureReason = 'HTTP_ERROR';
      if ([401, 403].includes(markets.status)) throw new Rejected(401, 'AUTH_REQUIRED');
      if (!markets.ok) throw new Rejected(502, 'UNAVAILABLE');
      failureStage = 'MARKETS_BODY'; failureReason = 'BODY_READ_FAILED';
      const marketRows = await boundedJson(markets, responseBytes, controller.signal);
      failureReason = 'MARKET_ROWS_INVALID';
      const available = availableCountry(marketRows, country);
      if (available === null) throw new Rejected(502, 'UNAVAILABLE');
      if (!available) throw new Rejected(403, 'COUNTRY_NOT_AVAILABLE');
      failureStage = 'PROVIDER_CONFIG'; failureReason = 'PROVIDER_ACTIVATION_BLOCKED';
      const token = providerToken();
      if (!token) throw new Rejected(503, 'PROVIDER_ACTIVATION_BLOCKED');
      if (controller.signal.aborted) throw new Error('CANCELLED');
      failureStage = 'RATE_LIMIT'; failureReason = 'RATE_LIMITED';
      releaseSearch = reserveSearch(user.id);
      const endpoint = new URL(reverse ? reverseEndpoint : providerEndpoint);
      endpoint.search = new URLSearchParams(reverse
        ? { key: token, format: 'json', addressdetails: '1', lat: String(position!.latitude), lon: String(position!.longitude), zoom: '18' }
        : { key: token, format: 'json', addressdetails: '1', countrycodes: country.toLowerCase(), limit: '10', q: text! }).toString();
      // The URL now contains the provider key and submitted address. It must never
      // enter logs, errors, receipts or client output. Caller JWT/anon key stay out.
      failureStage = 'PROVIDER_FETCH'; failureReason = 'NETWORK_ERROR';
      const upstream = await fetchBound(endpoint, { method: 'GET', headers: { Accept: 'application/json' } });
      upstreamStatus = upstream.status;
      failureReason = 'HTTP_ERROR';
      if (upstream.status === 429) throw new Rejected(429, 'RATE_LIMITED');
      if (upstream.status === 404) {
        failureStage = 'PROVIDER_BODY'; failureReason = 'BODY_READ_FAILED';
        const missing = record(await boundedJson(upstream, responseBytes, controller.signal));
        // Only the documented geocoder no-match response is an empty result.
        if (missing && only(missing, ['error']) && missing.error === 'Unable to geocode') return response(200, { candidates: [] });
        failureReason = 'PROVIDER_404_UNRECOGNIZED';
        throw new Rejected(502, 'UNAVAILABLE');
      }
      if (!upstream.ok) throw new Rejected(502, 'UNAVAILABLE');
      failureStage = 'PROVIDER_BODY'; failureReason = 'BODY_READ_FAILED';
      const raw = await boundedJson(upstream, responseBytes, controller.signal);
      // Reverse returns one object. Its country is still checked against the
      // user's admitted market; a nearest-place coordinate never attests a pin.
      failureStage = 'PROVIDER_NORMALIZE'; failureReason = 'NORMALIZED_ROWS_INVALID';
      const candidates = normalizeCandidates(reverse ? [raw] : raw, country, providerHint, (reason, coordinate) => {
        normalizationReason = reason; coordinateReason = coordinate ?? null;
      });
      if (candidates === null) throw new Rejected(502, 'UNAVAILABLE');
      return response(200, { candidates });
    };
    return await Promise.race([work(), aborted]);
  } catch (error) {
    // Never log or expose submitted addresses, provider bodies/URLs, credentials
    // or Auth responses. No database writer exists in this handler.
    if (req.signal.aborted) failureReason = 'CANCELLED';
    else if (controller.signal.aborted) failureReason = 'DEADLINE_EXCEEDED';
    else if (error instanceof BodyReadFailure) failureReason = error.reason;
    else if (error instanceof Rejected) {
      switch (error.code) {
        case 'AUTH_REQUIRED': failureReason = 'AUTH_REQUIRED'; break;
        case 'INVALID_QUERY': failureReason = 'INVALID_QUERY'; break;
        case 'COUNTRY_NOT_AVAILABLE': failureReason = 'COUNTRY_NOT_AVAILABLE'; break;
        case 'RATE_LIMITED': failureReason = 'RATE_LIMITED'; break;
      }
    }
    logFailure(failureStage, failureReason, upstreamStatus, normalizationReason, coordinateReason);
    return error instanceof Rejected ? response(error.status, { code: error.code }) : response(502, { code: 'UNAVAILABLE' });
  } finally {
    releaseSearch?.();
    clearTimeout(timer);
    req.signal.removeEventListener('abort', abort);
    if (rejectAborted) controller.signal.removeEventListener('abort', rejectAborted);
    controller.abort();
  }
});
