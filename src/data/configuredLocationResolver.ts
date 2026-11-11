import type { LocationPinOrigin } from '../contracts/location';
import type { CountryCode } from '../contracts/market';
import { locationText } from '../lib/location';
import { countryCode } from '../lib/market';

/** Client configuration for an explicitly approved server proxy; never a geocoder secret. */
export type ConfiguredLocationResolverConfig = Readonly<{
  endpoint: string;
  providerHint: string;
  /** Current user access token, read for each request. Null never falls back to anonymous. */
  getAccessToken?: () => Promise<string | null>;
}>;
export type ConfiguredLocationQuery = Readonly<{
  text: string;
  countryCode: CountryCode;
  /** Local account incarnation + point/input lifetime. Never sent to the server. */
  scopeKey: string;
}>;
export type ConfiguredReverseLocationQuery = Readonly<{
  position: Readonly<{ latitude: number; longitude: number }>;
  countryCode: CountryCode;
  scopeKey: string;
}>;
export type LocationResolverCandidate = Readonly<{
  /** A private candidate label, never an automatic public place/address assignment. */
  label: string;
  countryCode: CountryCode;
  position: Readonly<{ latitude: number; longitude: number }>;
  origin: Extract<LocationPinOrigin, { kind: 'PROVIDER_CANDIDATE' }>;
}>;
export type ConfiguredLocationResolution =
  | Readonly<{ status: 'PROPOSALS'; candidates: readonly LocationResolverCandidate[]; requiresConfirmation: true }>
  | Readonly<{ status: 'PROVIDER_ACTIVATION_BLOCKED' | 'INVALID_QUERY' | 'UNAVAILABLE' | 'RATE_LIMITED' | 'CANCELLED' }>;
export type LocationResolverFetch = (url: string, init: RequestInit) => Promise<Pick<Response, 'ok' | 'redirected' | 'json'> & Partial<Pick<Response, 'status'>>>;

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
}
function only(value: Record<string, unknown>, keys: readonly string[]): boolean {
  return Object.keys(value).every(key => keys.includes(key));
}
function configured(raw: ConfiguredLocationResolverConfig | undefined): ConfiguredLocationResolverConfig | null {
  if (!raw || typeof raw.endpoint !== 'string') return null;
  const providerHint = locationText(raw.providerHint, 64);
  if (!providerHint || !/^[A-Za-z0-9][A-Za-z0-9_.-]*$/.test(providerHint)
    || (raw.getAccessToken !== undefined && typeof raw.getAccessToken !== 'function')) return null;
  try {
    const endpoint = new URL(raw.endpoint);
    if (endpoint.protocol !== 'https:' || endpoint.username || endpoint.password || endpoint.search || endpoint.hash
      || endpoint.hostname === 'nominatim.openstreetmap.org') return null;
    return { endpoint: endpoint.toString(), providerHint, getAccessToken: raw.getAccessToken };
  } catch { return null; }
}
function query(raw: unknown): ConfiguredLocationQuery | null {
  const input = record(raw);
  if (!input || !only(input, ['text', 'countryCode', 'scopeKey'])) return null;
  const text = locationText(input.text, 1000), code = countryCode(input.countryCode);
  const scopeKey = locationText(input.scopeKey, 8192);
  return text && code && scopeKey ? { text, countryCode: code, scopeKey } : null;
}
function reverseQuery(raw: unknown): ConfiguredReverseLocationQuery | null {
  const input = record(raw), position = record(input?.position);
  if (!input || !only(input, ['position', 'countryCode', 'scopeKey']) || !position || !only(position, ['latitude', 'longitude'])) return null;
  const code = countryCode(input.countryCode), scopeKey = locationText(input.scopeKey, 8192);
  const { latitude, longitude } = position;
  return code && scopeKey && typeof latitude === 'number' && Number.isFinite(latitude) && Math.abs(latitude) <= 90
    && typeof longitude === 'number' && Number.isFinite(longitude) && Math.abs(longitude) <= 180
    ? { position: { latitude, longitude }, countryCode: code, scopeKey } : null;
}

/** The approved proxy normalizes its provider-specific response to this bounded envelope:
 * { candidates: [{ label, countryCode, position: {latitude, longitude}, providerHint, candidateId? }] }
 * No response fields are copied wholesale and no missing coordinates/identity are inferred.
 */
function candidates(raw: unknown, input: Pick<ConfiguredLocationQuery, 'countryCode'>, providerHint: string): readonly LocationResolverCandidate[] | null {
  const envelope = record(raw);
  if (!envelope || !only(envelope, ['candidates']) || !Array.isArray(envelope.candidates) || envelope.candidates.length > 20) return null;
  const result: LocationResolverCandidate[] = [];
  const identities = new Set<string>();
  for (const item of envelope.candidates) {
    const candidate = record(item);
    if (!candidate || !only(candidate, ['label', 'countryCode', 'position', 'providerHint', 'candidateId'])
      || candidate.countryCode !== input.countryCode || candidate.providerHint !== providerHint) return null;
    const label = locationText(candidate.label, 1000), position = record(candidate.position);
    if (!label || !position || !only(position, ['latitude', 'longitude'])) return null;
    const { latitude, longitude } = position;
    if (typeof latitude !== 'number' || !Number.isFinite(latitude) || Math.abs(latitude) > 90
      || typeof longitude !== 'number' || !Number.isFinite(longitude) || Math.abs(longitude) > 180) return null;
    const candidateHint = candidate.candidateId == null ? null : locationText(candidate.candidateId, 160);
    if (candidateHint === null && candidate.candidateId != null) return null;
    // An opaque provider ID cannot name two candidates in one response.
    if (candidateHint !== null) {
      if (identities.has(candidateHint)) return null;
      identities.add(candidateHint);
    }
    result.push({ label, countryCode: input.countryCode, position: { latitude, longitude },
      origin: { kind: 'PROVIDER_CANDIDATE', providerHint, candidateHint } });
  }
  return result;
}

/** Precise, explicitly submitted lookup beside the unchanged public/coarse LocationResolverPort.
 * One instance belongs to one editor. Call cancel on input/point/account changes and blur.
 * New searches cancel earlier ones, even when their scope string repeats (A -> B -> A).
 * No storage, GPS, address autofill, provider fallback or confirmation occurs here.
 */
export function createConfiguredLocationResolver(rawConfig?: ConfiguredLocationResolverConfig, fetcher: LocationResolverFetch = fetch) {
  const config = configured(rawConfig);
  let generation = 0;
  let active: { generation: number; scopeKey: string; controller: AbortController } | null = null;
  const cancel = () => {
    generation++;
    const previous = active;
    active = null;
    previous?.controller.abort();
  };
  const lookup = async (rawQuery: unknown, signal?: AbortSignal, reverse = false): Promise<ConfiguredLocationResolution> => {
      cancel();
      const input = reverse ? reverseQuery(rawQuery) : query(rawQuery);
      if (!input) return { status: 'INVALID_QUERY' };
      if (signal?.aborted) return { status: 'CANCELLED' };
      if (!config) return { status: 'PROVIDER_ACTIVATION_BLOCKED' };
      const controller = new AbortController();
      const requestScope = { generation, scopeKey: input.scopeKey, controller };
      active = requestScope;
      const owns = () => active === requestScope && generation === requestScope.generation && !controller.signal.aborted;
      let timedOut = false;
      const abort = () => controller.abort();
      signal?.addEventListener('abort', abort);
      let rejectCancelled: (() => void) | undefined;
      const cancelled = new Promise<never>((_resolve, reject) => {
        rejectCancelled = () => reject(new Error('LOCATION_CANCELLED'));
        controller.signal.addEventListener('abort', rejectCancelled);
      });
      const timer = setTimeout(() => { timedOut = true; abort(); }, 10_000);
      try {
        const request = async (): Promise<ConfiguredLocationResolution> => {
          const token = config.getAccessToken ? await config.getAccessToken() : undefined;
          if (!owns()) throw new Error('LOCATION_CANCELLED');
          if (config.getAccessToken && (typeof token !== 'string' || !token.length || /\s/.test(token))) {
            throw new Error('LOCATION_AUTH_UNAVAILABLE');
          }
          const response = await fetcher(config.endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Accept: 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
            // Neither local scope/account metadata nor access notes accompany the
            // text the user expressly submitted to the configured private proxy.
            body: JSON.stringify('position' in input ? { mode: 'reverse', countryCode: input.countryCode, position: input.position }
              : { countryCode: input.countryCode, text: input.text }),
            signal: controller.signal, credentials: 'omit', redirect: 'error', cache: 'no-store', referrerPolicy: 'no-referrer',
          });
          if (!owns()) throw new Error('LOCATION_CANCELLED');
          if (!response.redirected && response.status === 429) return { status: 'RATE_LIMITED' };
          if (!response.ok || response.redirected) throw new Error('LOCATION_UNAVAILABLE');
          const raw: unknown = await response.json();
          if (!owns()) throw new Error('LOCATION_CANCELLED');
          const normalized = candidates(raw, input, config.providerHint);
          if (normalized === null || reverse && normalized.length > 1) throw new Error('LOCATION_INVALID_RESPONSE');
          return { status: 'PROPOSALS', candidates: normalized, requiresConfirmation: true };
        };
        return await Promise.race([request(), cancelled]);
      } catch {
        // Do not expose provider text, endpoint details, submitted text or tokens.
        return { status: generation !== requestScope.generation || signal?.aborted || (!timedOut && controller.signal.aborted)
          ? 'CANCELLED' : 'UNAVAILABLE' };
      } finally {
        clearTimeout(timer);
        signal?.removeEventListener('abort', abort);
        if (rejectCancelled) controller.signal.removeEventListener('abort', rejectCancelled);
        if (active === requestScope) active = null;
      }
    };
  return {
    cancel,
    search: (rawQuery: unknown, signal?: AbortSignal) => lookup(rawQuery, signal),
    reverse: (rawQuery: unknown, signal?: AbortSignal) => lookup(rawQuery, signal, true),
  };
}
