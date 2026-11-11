import type { LocationOverviewPoint } from './LocationOverviewMap.types';

const valid = (point: LocationOverviewPoint) => Number.isFinite(point.latitude) && Number.isFinite(point.longitude)
  && Math.abs(point.latitude) <= 90 && Math.abs(point.longitude) <= 180;
const coordinate = (point: LocationOverviewPoint, coarse = false) => encodeURIComponent(
  `${coarse ? Number(point.latitude.toFixed(2)) : point.latitude},${coarse ? Number(point.longitude.toFixed(2)) : point.longitude}`);

/** Only coordinates leave the app, after an explicit tap. Never append a task,
 * account, grant, private address or access note to an external map URL. */
export function pointMapUrl(point: LocationOverviewPoint, coarse: boolean): string | null {
  if (!valid(point)) return null;
  return coarse ? `https://www.google.com/maps/search/?api=1&query=${coordinate(point, true)}`
    : `https://www.google.com/maps/dir/?api=1&destination=${coordinate(point)}&dir_action=navigate`;
}

/** Mobile-browser Maps URLs support at most three intermediate stops. Do not
 * silently drop any stop: longer tasks keep per-point navigation instead. */
export function routeMapUrl(points: readonly LocationOverviewPoint[]): string | null {
  if (points.length < 2 || points.length > 5 || !points.every(valid)) return null;
  const stops = points.slice(1, -1);
  return `https://www.google.com/maps/dir/?api=1&origin=${coordinate(points[0])}&destination=${coordinate(points[points.length - 1])}`
    + (stops.length ? `&waypoints=${encodeURIComponent(stops.map(p => `${p.latitude},${p.longitude}`).join('|'))}` : '');
}
