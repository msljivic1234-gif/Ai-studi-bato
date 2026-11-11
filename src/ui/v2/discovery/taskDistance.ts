import { createContext, useContext } from 'react';
import { publicPoint, type MarketplaceItem } from '../../../data/marketplaceView';

/**
 * How far a task is (the owner-approved plan, U2, U3 and U6: "mesto · udaljenost"), said only when it can be said from what the app really has: the task's PUBLIC
 * point (a point rounded on purpose, about a kilometre, so the distance is never finer than that) and the one place the person said they are, the point
 * "Moja lokacija" found for them in this visit (`DistanceFromContext`). Without both there is no distance: nothing is invented, a task that is not on the map
 * (remote work, a task placed nowhere) never has one, and a person who has not asked for their position is not told how far anything is. The reading is
 * "oko 3 km": whole kilometres (a finer figure would be false), and "manje od 1 km" under one.
 */
export type DistanceFrom = readonly [longitude: number, latitude: number];
export const DistanceFromContext = createContext<DistanceFrom | null>(null);
export const useDistanceFrom = () => useContext(DistanceFromContext);

const EARTH_KM = 6371.0088;
const RAD = Math.PI / 180;

/** The great-circle distance between two points, in kilometres. */
export function distanceKm(from: DistanceFrom, to: { lat: number; lng: number }): number {
  const dLat = (to.lat - from[1]) * RAD, dLng = (to.lng - from[0]) * RAD;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(from[1] * RAD) * Math.cos(to.lat * RAD) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_KM * Math.asin(Math.min(1, Math.sqrt(a)));
}

/** "manje od 1 km", "oko 3 km": never more exact than the point it is measured to. */
export function distanceWords(km: number): string {
  return km < 1 ? 'manje od 1 km' : `oko ${Math.round(km)} km`;
}

/** How far a task is from where the person is, in words; null when either point is not there. */
export function distanceOf(from: DistanceFrom | null, item: MarketplaceItem): string | null {
  const point = publicPoint(item);
  if (!from || !point || ![from[0], from[1], point.lat, point.lng].every(Number.isFinite)) return null;
  return distanceWords(distanceKm(from, point));
}
