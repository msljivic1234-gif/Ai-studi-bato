import type { NeedTaskGeography, NeedTaskGeographyPoint } from '../contracts/needFactsV2';
import type { CoarsePosition, ConfirmedLocationPoint, LocationPinOrigin, LocationSlot, NeedLocationInput, ResolvedLocationValue, WorkerLocationInput } from '../contracts/location';
import { countryCode } from './market';

function object(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown> : null;
}
function only(value: Record<string, unknown>, keys: readonly string[]): boolean {
  return Object.keys(value).every(key => keys.includes(key));
}
/** Keep Unicode text verbatim except SQL btrim-compatible outer spaces. No guessing. */
export function locationText(value: unknown, max: number): string | null {
  if (typeof value !== 'string' || /[\u0000-\u001f\u007f]/.test(value)) return null;
  const text = value.replace(/^ +| +$/g, '');
  return text.length > 0 && Array.from(text).length <= max ? text : null;
}
export function locationPrivateText(value: unknown, max: number): string | null | undefined {
  if (value === null) return null;
  if (typeof value !== 'string' || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value)) return undefined;
  const text = value.replace(/^ +| +$/g, '');
  return text.length && Array.from(text).length <= max ? text : undefined;
}
function point(value: unknown): NeedTaskGeographyPoint | null {
  const input = object(value);
  if (!input || !only(input, ['city', 'area', 'label'])) return null;
  const result: NeedTaskGeographyPoint = {};
  for (const key of ['city', 'area', 'label'] as const) {
    if (!Object.prototype.hasOwnProperty.call(input, key)) continue;
    const text = locationText(input[key], key === 'label' ? 240 : 160);
    if (!text) return null;
    result[key] = text;
  }
  return Object.keys(result).length ? result : null;
}
export function normalizeTaskGeography(value: unknown): NeedTaskGeography | null {
  const input = object(value);
  if (!input || !only(input, ['mode', 'start', 'end', 'waypoints', 'serviceArea'])) return null;
  const modes = ['STATIONARY', 'POINT_TO_POINT', 'MULTI_STOP', 'AREA_BASED', 'REMOTE'] as const;
  if (!modes.some(mode => mode === input.mode)) return null;
  // Null optional endpoints from old V2 providers mean absent, never GPS (0,0).
  const start = input.start == null ? undefined : point(input.start);
  const end = input.end == null ? undefined : point(input.end);
  const serviceArea = input.serviceArea == null ? undefined : point(input.serviceArea);
  if (start === null || end === null || serviceArea === null) return null;
  let waypoints: NeedTaskGeographyPoint[] = [];
  if (input.waypoints != null) {
    if (!Array.isArray(input.waypoints) || input.waypoints.length > 20) return null;
    for (const raw of input.waypoints) {
      const item = point(raw);
      if (!item) return null;
      waypoints.push(item);
    }
  }
  switch (input.mode) {
    case 'REMOTE': return start || end || serviceArea || waypoints.length ? null : { mode: 'REMOTE' };
    case 'STATIONARY': return !start || end || serviceArea || waypoints.length ? null : { mode: 'STATIONARY', start };
    case 'POINT_TO_POINT': return !start || !end || serviceArea || waypoints.length ? null : { mode: 'POINT_TO_POINT', start, end };
    case 'MULTI_STOP': return !start || serviceArea || (!end && !waypoints.length) ? null
      : { mode: 'MULTI_STOP', start, ...(end ? { end } : {}), ...(waypoints.length ? { waypoints } : {}) };
    case 'AREA_BASED': return end || waypoints.length || (!start && !serviceArea) ? null
      : { mode: 'AREA_BASED', ...(start ? { start } : {}), ...(serviceArea ? { serviceArea } : {}) };
    default: return null;
  }
}
export function normalizeNeedLocation(value: unknown): NeedLocationInput | null {
  const input = object(value);
  if (!input || !locationPayloadFits(input) || !only(input, ['taskCountryCode', 'geography', 'exactAddress', 'accessNotes', 'resolvedLocation'])) return null;
  const taskCountryCode = countryCode(input.taskCountryCode);
  const geography = normalizeTaskGeography(input.geography);
  const exactAddress = locationPrivateText(input.exactAddress, 1000);
  const accessNotes = locationPrivateText(input.accessNotes, 2000);
  if (!taskCountryCode || !geography || exactAddress === undefined || accessNotes === undefined) return null;
  if (geography.mode === 'REMOTE' && (exactAddress !== null || accessNotes !== null)) return null;
  const resolvedLocation = normalizeResolvedLocation(input.resolvedLocation, { taskCountryCode, geography, exactAddress });
  if (resolvedLocation === undefined) return null;
  return { taskCountryCode, geography, exactAddress, accessNotes, resolvedLocation };
}

export function locationPayloadFits(value: unknown): boolean {
  try {
    const json = JSON.stringify(value);
    if (typeof json !== 'string') return false;
    // PostgreSQL jsonb text uses a space after each structural comma/colon.
    // Count those too so a UTF-8 payload accepted here fits the server boundary.
    let bytes = 0, quoted = false, escaped = false;
    for (const character of json) {
      const code = character.codePointAt(0)!;
      bytes += code <= 0x7f ? 1 : code <= 0x7ff ? 2 : code <= 0xffff ? 3 : 4;
      if (quoted) {
        if (escaped) escaped = false;
        else if (character === '\\') escaped = true;
        else if (character === '"') quoted = false;
      } else if (character === '"') quoted = true;
      else if (character === ',' || character === ':') bytes++;
      if (bytes > 65_536) return false;
    }
    return true;
  } catch { return false; }
}

export function locationSlots(geography: NeedTaskGeography): LocationSlot[] {
  if (geography.mode === 'REMOTE') return [];
  return [
    ...(geography.start ? ['start' as const] : []),
    ...(geography.waypoints ?? []).map((_, index) => `waypoints/${index}` as LocationSlot),
    ...(geography.end ? ['end' as const] : []),
    ...(geography.serviceArea ? ['serviceArea' as const] : []),
  ];
}

/** undefined is invalid; null is an honest unresolved or legacy value. */
export function normalizeResolvedLocation(value: unknown, target: ResolvedLocationValue['binding']): ResolvedLocationValue | null | undefined {
  if (value == null) return null;
  const input = object(value), binding = object(input?.binding);
  if (!input || !binding || !locationPayloadFits(value) || input.version !== 1 || target.geography.mode === 'REMOTE'
    || !only(input, ['version', 'binding', 'points']) || !only(binding, ['taskCountryCode', 'geography', 'exactAddress'])) return undefined;
  const boundCountry = countryCode(binding.taskCountryCode), boundGeography = normalizeTaskGeography(binding.geography);
  const boundAddress = locationPrivateText(binding.exactAddress, 1000);
  if (boundCountry !== target.taskCountryCode || !boundGeography || boundAddress !== target.exactAddress
    || JSON.stringify(boundGeography) !== JSON.stringify(target.geography)) return undefined;
  const slots = locationSlots(target.geography), seen = new Set<string>();
  if (!Array.isArray(input.points) || !input.points.length || input.points.length > slots.length || input.points.length > 22) return undefined;
  const points: ConfirmedLocationPoint[] = [];
  for (const item of input.points) {
    const pin = object(item), origin = object(pin?.origin);
    if (!pin || !origin || !only(pin, ['slot', 'latitudeE6', 'longitudeE6', 'origin', 'address', 'accessNotes'])
      || typeof pin.slot !== 'string' || !slots.includes(pin.slot as LocationSlot) || seen.has(pin.slot)) return undefined;
    const { latitudeE6, longitudeE6 } = pin;
    if (typeof latitudeE6 !== 'number' || typeof longitudeE6 !== 'number' || !Number.isSafeInteger(latitudeE6)
      || !Number.isSafeInteger(longitudeE6) || Math.abs(latitudeE6) > 90_000_000 || Math.abs(longitudeE6) > 180_000_000) return undefined;
    let normalizedOrigin: LocationPinOrigin;
    if (origin.kind === 'MANUAL_PIN' && only(origin, ['kind'])) normalizedOrigin = { kind: 'MANUAL_PIN' };
    else if (origin.kind === 'PROVIDER_CANDIDATE' && only(origin, ['kind', 'providerHint', 'candidateHint'])) {
      const providerHint = locationText(origin.providerHint, 64);
      const candidateHint = origin.candidateHint === null ? null : locationText(origin.candidateHint, 160);
      if (!providerHint || !/^[A-Za-z0-9][A-Za-z0-9_.-]*$/.test(providerHint) || (candidateHint === null && origin.candidateHint !== null)) return undefined;
      normalizedOrigin = { kind: 'PROVIDER_CANDIDATE', providerHint, candidateHint };
    } else return undefined;
    const address = pin.address == null ? null : locationPrivateText(pin.address, 1000);
    const accessNotes = pin.accessNotes == null ? null : locationPrivateText(pin.accessNotes, 2000);
    if (address === undefined || accessNotes === undefined) return undefined;
    seen.add(pin.slot);
    points.push({ slot: pin.slot as LocationSlot, latitudeE6, longitudeE6, origin: normalizedOrigin,
      ...(address !== null ? { address } : {}), ...(accessNotes !== null ? { accessNotes } : {}) });
  }
  points.sort((a, b) => slots.indexOf(a.slot) - slots.indexOf(b.slot));
  return { version: 1, binding: { taskCountryCode: target.taskCountryCode, geography: target.geography, exactAddress: target.exactAddress }, points };
}
export function coarsePosition(value: unknown): CoarsePosition | null {
  const input = object(value);
  if (!input || !only(input, ['latitude', 'longitude'])) return null;
  const { latitude, longitude } = input;
  const bounded = (x: unknown, bound: number): x is number => typeof x === 'number' && Number.isFinite(x)
    && Math.abs(x) <= bound && x === Number(x.toFixed(2));
  return bounded(latitude, 90) && bounded(longitude, 180) ? { latitude, longitude } : null;
}
export function normalizeWorkerLocation(value: unknown, allowIncomplete = false): WorkerLocationInput | null {
  const input = object(value);
  if (!input || !only(input, ['operatingCountryCode', 'city', 'radiusKm', 'approximatePosition'])) return null;
  const operatingCountryCode = countryCode(input.operatingCountryCode);
  const city = allowIncomplete && input.city === '' ? '' : locationText(input.city, 160);
  const radiusKm = input.radiusKm;
  const position = input.approximatePosition === null ? null : coarsePosition(input.approximatePosition);
  if (!operatingCountryCode || city === null || typeof radiusKm !== 'number' || !Number.isInteger(radiusKm) || radiusKm < 1 || radiusKm > 200
    || (input.approximatePosition !== null && !position)) return null;
  return { operatingCountryCode, city, radiusKm, approximatePosition: position };
}
export const locationRevision = (value: unknown): value is string => typeof value === 'string' && /^[0-9a-f]{64}$/.test(value);
export function sameNeedLocation(left: NeedLocationInput, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(normalizeNeedLocation(right));
}
export function sameWorkerLocation(left: WorkerLocationInput, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(normalizeWorkerLocation(right));
}

/**
 * How many of a topology's required points are already confirmed.
 *
 * Kept here, beside locationSlots and away from any map import, so a caller can ask the question
 * without pulling the native map into its module graph.
 */
export function pointsMissing(geography: unknown, resolved: unknown): { done: number; total: number } {
  const topology = geography && typeof geography === 'object' ? geography as NeedTaskGeography : null;
  const slots = topology && typeof topology.mode === 'string' ? locationSlots(topology) : [];
  const record = resolved && typeof resolved === 'object' ? resolved as { points?: unknown } : null;
  const points = Array.isArray(record?.points) ? record.points : [];
  const confirmed = new Set(points
    .map(point => (point && typeof point === 'object' ? (point as { slot?: unknown }).slot : null))
    .filter((slot): slot is LocationSlot => typeof slot === 'string' && slots.includes(slot as LocationSlot)));
  return { done: confirmed.size, total: slots.length };
}

/**
 * The approximate place of a Task, as one line.
 *
 * Three client services each wrote this out: `formatLocation` in the application service,
 * `podrucje` in the need service, `fLoc` in the Supabase source. All three said exactly the same
 * thing, which is the only reason no screen disagreed with another — three copies that happened to
 * still match. The wording, including what is shown when there is no place, is one decision.
 */
/**
 * Some stored areas arrive wrapped in quotation marks (`"Vračar, Beograd"`), the same way six stored titles do,
 * because the interview wrote them so. The stored value stays; the reader sees it without a PAIR of wrapping
 * quotes (seen on Moje prijave, 2026-09-23). A value that quotes something inside keeps it.
 */
function unwrapQuotes(value: string | null | undefined): string | null {
  if (typeof value !== 'string') return null;
  const text = value.trim();
  for (const [open, close] of [['"', '"'], ['„', '“'], ['“', '”'], ["'", "'"]] as const) {
    if (text.length > 1 && text.startsWith(open) && text.endsWith(close)) {
      const inner = text.slice(1, -1);
      // '"Vračar" i "Zvezdara"' starts and ends with a quote but is not one quoted value; it stays as written.
      if (/["„“”]/.test(inner) || (open === "'" && inner.includes("'"))) return text;
      return inner.trim() || null;
    }
  }
  return text || null;
}

export function podrucjeTekst(area: string | null | undefined, city: string | null | undefined): string {
  const parts = [unwrapQuotes(area), unwrapQuotes(city)].filter((part): part is string => !!part);
  // "Vračar, Beograd" as the area and "Beograd" as the city would read the city twice. Only a whole part of the
  // area counts: "Bor" is not inside "Kod Sabornog hrama".
  const key = (value: string) => value.trim().toLocaleLowerCase('sr-Latn-RS');
  const unique = parts.filter((part, index) => index === 0 || !parts[0].split(',').some(piece => key(piece) === key(part)));
  return unique.join(', ') || 'Lokacija nije navedena';
}
