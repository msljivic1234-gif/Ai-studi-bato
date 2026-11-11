import AsyncStorage from '@react-native-async-storage/async-storage';
import type { CoarsePosition } from '../contracts/location';
import { locationText } from '../lib/location';
import { sameBounds, type PublicBounds } from './marketplaceView';

/** A geocoder choice moves the camera. It is never a task locality, public pin or server search term. */
export type ConfirmedMapPlace = { label: string; position: CoarsePosition };
export type SettledMapPlace = ConfirmedMapPlace & { area: PublicBounds };

type Storage = Pick<typeof AsyncStorage, 'getItem' | 'setItem' | 'removeItem'>;
const PREFIX = 'uskoci.zadaci.confirmed-map-place.v1.';
const pending = new Map<string, Promise<void>>();

export const confirmedDiscoveryMapPlaceKey = (accountId: string) => `${PREFIX}${accountId}`;

/** Storage is local and may be old or damaged. Only a bounded label and valid coarse geography can be shown. */
export function parseSettledMapPlace(raw: string | null | undefined): SettledMapPlace | null {
  if (!raw) return null;
  let value: unknown;
  try { value = JSON.parse(raw); } catch { return null; }
  if (!value || typeof value !== 'object') return null;
  const { label, position, area } = value as Record<string, unknown>;
  // The resolver accepts private provider labels up to 1000 Unicode characters. A
  // shorter storage bound would silently discard a valid confirmed choice on return.
  const safeLabel = locationText(label, 1000);
  if (!safeLabel || !position || typeof position !== 'object'
    || !Array.isArray(area) || area.length !== 4) return null;
  const { latitude, longitude } = position as Record<string, unknown>;
  if (typeof latitude !== 'number' || !Number.isFinite(latitude) || latitude < -90 || latitude > 90
    || typeof longitude !== 'number' || !Number.isFinite(longitude) || longitude < -180 || longitude > 180
    || !area.every(item => typeof item === 'number' && Number.isFinite(item))) return null;
  const [west, south, east, north] = area as number[];
  if (west < -180 || east > 180 || south < -90 || north > 90 || west >= east || south >= north) return null;
  return { label: safeLabel, position: { latitude, longitude }, area: [west, south, east, north] };
}

const afterWrites = (key: string) => pending.get(key)?.catch(() => undefined) ?? Promise.resolve();
const enqueue = (key: string, action: () => Promise<void>) => {
  const task = afterWrites(key).then(action);
  pending.set(key, task.catch(() => undefined));
  return task;
};

export async function readSettledMapPlace(accountId: string, storage: Storage = AsyncStorage): Promise<SettledMapPlace | null> {
  const key = confirmedDiscoveryMapPlaceKey(accountId);
  await afterWrites(key);
  return parseSettledMapPlace(await storage.getItem(key));
}

export function writeSettledMapPlace(accountId: string, place: SettledMapPlace | null, storage: Storage = AsyncStorage): Promise<void> {
  const key = confirmedDiscoveryMapPlaceKey(accountId);
  return enqueue(key, () => place ? storage.setItem(key, JSON.stringify(place)) : storage.removeItem(key));
}

export function settledMapPlaceMatches(place: SettledMapPlace | null, area: PublicBounds | null): boolean {
  return !!place && !!area && sameBounds(place.area, area);
}
