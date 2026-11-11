/** Confirmed presentation points only; this canvas cannot choose or save geography. */
export type LocationOverviewPoint = Readonly<{ id: string; label: string; latitude: number; longitude: number }>;
export type LocationOverviewMapProps = Readonly<{
  points: readonly LocationOverviewPoint[];
  /** Account/record/revision ownership. Never passed to the native map or tile source. */
  scopeKey: string;
  coarse: boolean;
  interactive: boolean;
  /** Numeric canvas height for previews; fill consumes a bounded parent's remainder. */
  height: number | 'fill';
  selectedId?: string;
  /** Explicit camera action, including reselecting a point after a manual pan. */
  cameraIntent?: number;
  onSelectPoint?: (id: string) => void;
  testID?: string;
}>;
export type OverviewDisplayPoint = LocationOverviewPoint & Readonly<{ number: number }>;

/** Round before geometry, bounds, native props or accessible coordinate text is constructed. */
export function overviewDisplayPoints(points: readonly LocationOverviewPoint[], coarse: boolean): OverviewDisplayPoint[] {
  const seen = new Set<string>();
  return points.flatMap((point, index) => {
    if (!point || typeof point.id !== 'string' || !point.id.trim() || seen.has(point.id)
      || typeof point.label !== 'string' || typeof point.latitude !== 'number' || typeof point.longitude !== 'number'
      || !Number.isFinite(point.latitude) || !Number.isFinite(point.longitude)
      || Math.abs(point.latitude) > 90 || Math.abs(point.longitude) > 180) return [];
    seen.add(point.id);
    return [{ id: point.id, label: point.label.trim() || `Mesto ${index + 1}`, number: index + 1,
      latitude: coarse ? Number(point.latitude.toFixed(2)) : point.latitude,
      longitude: coarse ? Number(point.longitude.toFixed(2)) : point.longitude }];
  });
}

export const LOCATION_MAP_CREDITS = [
  { text: '© OpenStreetMap', url: 'https://www.openstreetmap.org/copyright' },
  { text: '© OpenMapTiles', url: 'https://www.openmaptiles.org/' },
  { text: 'OpenFreeMap', url: 'https://openfreemap.org/' },
] as const;
