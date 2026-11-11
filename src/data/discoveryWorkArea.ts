import type { WorkerLocation } from '../contracts/location';
import type { MarketplaceView, PublicBounds } from './marketplaceView';

/** An optional first camera fit, not a task, a GPS sample, an area filter or a matching decision. */
export type WorkAreaCamera = Readonly<{ key: string; bounds: PublicBounds }>;
const EARTH_KM = 6371.0088;
const DEG = 180 / Math.PI;

/** Use only the explicitly saved coarse point. A city name alone never manufactures coordinates. */
export function workAreaBounds(location: Pick<WorkerLocation, 'city' | 'operatingCountryCode' | 'radiusKm' | 'approximatePosition'>): PublicBounds | null {
  const point = location.approximatePosition, radius = location.radiusKm;
  if (!location.city?.trim() || !location.operatingCountryCode || !point || !Number.isInteger(radius) || radius < 1 || radius > 200
    || !Number.isFinite(point.latitude) || !Number.isFinite(point.longitude)
    || Math.abs(point.latitude) > 85 || Math.abs(point.longitude) > 180) return null;
  const lat = Number(point.latitude.toFixed(2)), lng = Number(point.longitude.toFixed(2));
  const angular = radius / EARTH_KM, latitudeDelta = angular * DEG;
  const ratio = Math.sin(angular) / Math.cos(lat / DEG);
  if (Math.abs(ratio) >= 1) return null;
  const longitudeDelta = Math.asin(ratio) * DEG;
  const bounds: PublicBounds = [lng - longitudeDelta, lat - latitudeDelta, lng + longitudeDelta, lat + latitudeDelta];
  // This optional locality fallback supports a single ordinary Mercator rectangle. Unsupported pole/dateline
  // footprints leave the existing neutral/task camera alone; never turn a small work area into a world-wide fit.
  return bounds[0] >= -180 && bounds[2] <= 180 && bounds[1] >= -85 && bounds[3] <= 85 ? bounds : null;
}

/** Capture once before reading. Subsequent automatic camera observations are not a new user choice. */
export function maySeedWorkArea(view: MarketplaceView): boolean {
  return view.mode === 'map' && !view.attention && !view.viewport && !view.area && !view.selectedId && !view.selectedPlace && !view.pinPlace
    && !view.query.trim() && !view.place && !view.dates && (view.when ?? 'any') === 'any'
    && (view.where ?? 'any') === 'any' && view.price === 'all' && (view.places ?? 1) === 1 && (view.listOffset ?? 0) === 0;
}
