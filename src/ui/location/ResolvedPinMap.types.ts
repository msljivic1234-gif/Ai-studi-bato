/** Presentation only: this pair is a candidate until the containing form confirms it. */
export type ResolvedPinPosition = Readonly<{ latitude: number; longitude: number }>;
export type ResolvedPinMapProps = Readonly<{
  position: ResolvedPinPosition | null;
  /** Initial camera context from actual resolver results; never draws, selects or saves a point.
   *  Scope-owned and bounded to 20 positions. Ignored once a real position exists. */
  cameraHint?: readonly ResolvedPinPosition[];
  /** Optional street-level camera for one resolver hint. This changes only zoom, never selection/confirmation. */
  cameraHintZoom?: number;
  onChoose: (position: ResolvedPinPosition) => void;
  disabled?: boolean;
  /** Account incarnation + reviewed point/input identity; never sent to the map SDK. */
  scopeKey: string;
  /** Worker base / public approximation: only two-decimal positions are displayed or emitted. */
  coarse?: boolean;
  /** The frame's height; a read-only map on a detail screen is a glance, not the picker's 320. */
  height?: number;
  /** Conversation-only density: keeps legal attribution but lets the parent own the explanatory copy. */
  compact?: boolean;
  /** Full-screen editor: the native frame fills the available safe-area body without owning point state. */
  fill?: boolean;
  /** The conversation's small map: an expand control in the frame's top-right corner that opens the caller's
   *  full-screen editor. It never moves, selects or saves a point. */
  expand?: Readonly<{ label: string; onPress: () => void; disabled?: boolean }>;
  /** Optional slot/role: 'start' | 'end' | 'serviceArea' */
  slot?: string;
}>;

// Public style configuration reused from the reviewed PR67 renderer. No address,
// account identifier, geocoder query or provider credential is included in this URL.
export const RESOLVED_PIN_MAP_STYLE = 'https://tiles.openfreemap.org/styles/positron';

export function displayedPinPosition(value: ResolvedPinPosition | null, coarse = false): ResolvedPinPosition | null {
  if (!value || typeof value.latitude !== 'number' || typeof value.longitude !== 'number'
    || !Number.isFinite(value.latitude) || !Number.isFinite(value.longitude)
    || Math.abs(value.latitude) > 90 || Math.abs(value.longitude) > 180) return null;
  return coarse ? { latitude: Number(value.latitude.toFixed(2)), longitude: Number(value.longitude.toFixed(2)) }
    : { latitude: value.latitude, longitude: value.longitude };
}


/** Validated camera-only extent. A little viewport padding keeps coincident results usable, without inventing a pin. */
export function cameraHintBounds(values: readonly ResolvedPinPosition[] | undefined, coarse = false): [number, number, number, number] | null {
  if (!Array.isArray(values) || values.length < 1 || values.length > 20) return null;
  const points = values.map(value => displayedPinPosition(value, coarse));
  if (points.some(point => !point)) return null;
  const longitudes = points.map(point => point!.longitude), latitudes = points.map(point => point!.latitude);
  const west = Math.min(...longitudes), east = Math.max(...longitudes), south = Math.min(...latitudes), north = Math.max(...latitudes);
  // Bounds are presentation geometry, not proposed coordinates. A zero-span native bounds fit may overzoom.
  const horizontal = Math.max(0, (0.01 - (east - west)) / 2), vertical = Math.max(0, (0.01 - (north - south)) / 2);
  return [Math.max(-180, west - horizontal), Math.max(-90, south - vertical),
    Math.min(180, east + horizontal), Math.min(90, north + vertical)];
}
