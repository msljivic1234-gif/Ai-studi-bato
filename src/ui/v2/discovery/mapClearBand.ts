import type { PublicBounds } from '../../../data/marketplaceView';

/**
 * Where things are on the Zadaci map, in pixels. The map is north-up and never pitched (rotation and pitch gestures are off), so a row of
 * pixels is one latitude and the view's bounds and height are enough: Web Mercator spaces latitudes by `ln(tan(π/4 + φ/2))`.
 */
const RADIANS = Math.PI / 180;
/** The latitude Web Mercator can draw at all. */
const MERCATOR_LIMIT = 85.0511287798;
const mercator = (lat: number) => Math.log(Math.tan(Math.PI / 4 + Math.max(-MERCATOR_LIMIT, Math.min(MERCATOR_LIMIT, lat)) * RADIANS / 2));
const latitude = (y: number) => (2 * Math.atan(Math.exp(y)) - Math.PI / 2) / RADIANS;
const SIX = 1_000_000;
const six = (value: number) => Math.round(value * SIX) / SIX + 0;

/** The row, in pixels from the top of a view `height` pixels tall that shows `bounds`, at which `lat` is drawn. */
export function rowOfLatitude(bounds: PublicBounds, height: number, lat: number): number {
  const north = mercator(bounds[3]), south = mercator(bounds[1]);
  return north === south ? height / 2 : (north - mercator(lat)) / (north - south) * height;
}

/** The latitude drawn at `row` pixels from the top of a view `height` pixels tall that shows `bounds`. */
export function latitudeAtRow(bounds: PublicBounds, height: number, row: number): number {
  const north = mercator(bounds[3]), south = mercator(bounds[1]);
  return latitude(north - (north - south) * (row / height));
}

/** A band thinner than this (a sheet at its full height, a frame not measured yet) says nothing about where the person looks. */
export const MIN_CLEAR_BAND = 48;

/**
 * The part of the map the person can actually see: below the floating search tools (`top`, pixels from the map's top) and above the list
 * sheet or a card (`bottom`, pixels from the map's top), across the whole width. The list follows this band; the map's own buckets keep the
 * whole view. The full bounds come back when the band is too thin to mean anything; an edge that is not covered keeps its exact bound.
 */
export function clearBandBounds(bounds: PublicBounds, height: number, top: number, bottom: number): PublicBounds {
  if (!(height > 0) || !Number.isFinite(top) || !Number.isFinite(bottom)) return bounds;
  const upper = Math.max(0, Math.min(height, top)), lower = Math.max(0, Math.min(height, bottom));
  if (lower - upper < MIN_CLEAR_BAND || (upper === 0 && lower === height)) return bounds;
  const north = upper > 0 ? six(latitudeAtRow(bounds, height, upper)) : bounds[3];
  const south = lower < height ? six(latitudeAtRow(bounds, height, lower)) : bounds[1];
  return north > south ? [bounds[0], south, bounds[2], north] : bounds;
}

/**
 * The map's furniture: the map's sources on the left and "moja lokacija" on the right stand in one row directly ABOVE the list sheet
 * and move with it (UX plan section P: "uvek iznad spiska"; the owner's phone of 8 Oct 2026: no + and − buttons, the map is zoomed with
 * two fingers, only "moja lokacija" stays). These are the numbers that keep the row there, as pure arithmetic: the sheet's position
 * is a shared value on the UI thread, so `sheetEdge` and `controlsTop` are worklets and run there frame by frame; nothing here waits
 * for React. When the list is full there is no map above it, and the row gives way (`controlsFade`).
 */

/** The touch size of one control in the row: a full 44 (the owner's floor), drawn as a circle. */
export const CONTROL_SIZE = 44;
/** The air between the two things of the row. */
export const CONTROL_GAP = 8;

/**
 * The line the controls must stay above: the list sheet's top edge, or the top of a pin's card when the card lies higher
 * (`cover` is how much of the map's bottom the card takes; 0 when there is none). `height` is the map's own height.
 */
export function sheetEdge(sheetTop: number, height: number, cover: number): number {
  'worklet';
  return Math.min(sheetTop, height - Math.max(0, cover));
}

/**
 * Where the row of controls is drawn: its top, in pixels from the top of the map. It stands `gap` above `edge`, and never
 * higher than `minTop`, the strip under the search pill where the row ends when the sheet is full (so it is never behind
 * the list, and never below it).
 */
export function controlsTop(edge: number, rowHeight: number, gap: number, minTop: number): number {
  'worklet';
  return Math.max(minTop, edge - gap - rowHeight);
}

/**
 * Where the list sheet's top edge rests at its FULL height, in pixels from the top of the body: directly under the floating tools (the
 * search pill and its row of capsules, which stay on top of the list), one `gap` below them. There is no strip of map between the tools
 * and the list (the owner, 8 Oct 2026: "lista ide do vrha"); the map's own row of furniture goes behind the list as it arrives.
 */
export function fullSheetTop(toolsBottom: number, gap: number): number {
  return toolsBottom + gap;
}

/** How far over which the row of furniture fades as the list covers the map. */
export const CONTROLS_FADE = 24;

/**
 * How much of the row of furniture is on show (0 to 1). The row stands `gap` above `edge` (the list's top or a card's), never higher than
 * `minTop`; where that would put it behind the list (the list is as high as it goes, so no map is left above it) it fades out over
 * `CONTROLS_FADE` pixels instead of sinking under the list's edge.
 */
export function controlsFade(edge: number, rowHeight: number, gap: number, minTop: number): number {
  'worklet';
  const free = edge - gap - rowHeight - minTop;
  return free >= CONTROLS_FADE ? 1 : free <= 0 ? 0 : free / CONTROLS_FADE;
}

/** The row of the map's furniture: the sources on the left, "moja lokacija" on the right (the width of that control and its air). */
export function controlsReserve(locate: boolean): number {
  return locate ? CONTROL_SIZE + CONTROL_GAP : 0;
}
