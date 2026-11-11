/**
 * The Zadaci list sheet's three heights as plain numbers (UX plan 2.14, section O7 and P of the visual proposal, 2026-10-07;
 * the owner's phone of 8 Oct 2026).
 *
 * The sheet rests lowered ("mapa je glavna": only its top line over the map), at half (map and
 * list) or full ("lista je glavna": the whole list directly under the filter control and its row of capsules,
 * which stay on top; no strip of map is left between). A drag of the handle, of the list header or of the list moves between
 * them, and a tap on the handle goes to the next one. Everything below is arithmetic on measured pixels, so it can be tested
 * without a phone; the screen only hands in what it has measured.
 */

/** The three stops, in this order: the index Gorhom's `snapPoints` use. */
export type SheetIndex = 0 | 1 | 2;
export const SHEET_LOWERED: SheetIndex = 0;
export const SHEET_HALF: SheetIndex = 1;
export const SHEET_FULL: SheetIndex = 2;

/**
 * Where a tap on the handle goes: lowered to half, half to full, and from full back to lowered, so repeated taps cycle through
 * all three. A stop that is not one of the three (the sheet has not reported yet) starts the cycle at half.
 */
export function nextSheetIndex(index: number): SheetIndex {
  if (index === SHEET_LOWERED) return SHEET_HALF;
  if (index === SHEET_HALF) return SHEET_FULL;
  if (index === SHEET_FULL) return SHEET_LOWERED;
  return SHEET_HALF;
}

/** What the handle tells a screen reader a tap does from this stop, in the words the person reads. */
export function handleHint(index: number): string {
  if (index === SHEET_LOWERED) return 'Podiže listu do pola.';
  if (index === SHEET_HALF) return 'Otvara celu listu.';
  return 'Spušta listu i prikazuje mapu.';
}

export type SheetHeightsInput = {
  /** The body under the chrome; 0 until it is measured. */
  bodyHeight: number;
  /** Where the sheet's top edge rests at its full height, in pixels from the top of the body (`fullSheetTop`). */
  fullTop: number;
  /** Expanded quick filters still cover the map at HALF; keep that stop below their full measured edge. */
  halfTop?: number;
  /** The lowest stop with no card over it: the sheet's top line (grab bar and count, and what belongs to it). */
  collapsed: number;
  /** The one pixel the lowest stop shrinks to while a pin's card lies over it (the sheet steps out of sight). */
  hidden: number;
  cardShown: boolean;
  /** How much of the sheet's room the half stop leaves free below the full one at the least. */
  margin: number;
  /**
   * How tall the bottom navigation is while it stands over the lower part of the screen (it remains visible at all three list stops,
   * and lies OVER the sheet, which reaches the bottom of the screen at every height). The half stop is half of what the navigation leaves,
   * so the map above the sheet and the list between the sheet's top and the navigation are about as tall as each other. 0 where there
   * is no such navigation (a gallery, a test).
   */
  bar?: number;
};

/**
 * The sheet's three snap points: the lowest, half and full, as heights from the bottom of the body (Gorhom's own unit). Before
 * the body is measured they are the percentages the sheet can start from. The half stop is half what the navigation leaves of the
 * body, never below the lowest and never as tall as the full one, so the three are always apart.
 */
export function snapHeights({ bodyHeight, fullTop, halfTop = fullTop, collapsed, hidden, cardShown, margin, bar = 0 }: SheetHeightsInput): [number | string, number | string, number | string] {
  const low = cardShown ? hidden : collapsed;
  if (!bodyHeight) return [low, '50%', '88%'];
  const full = Math.max(3, bodyHeight - fullTop);
  const clear = Math.max(3, bodyHeight - Math.max(fullTop, halfTop) - margin);
  const half = Math.round((bodyHeight + Math.max(0, bar)) / 2);
  return [low, Math.min(full - 1, Math.max(collapsed + 1, Math.min(clear, half))), full];
}

/**
 * How tall the list's own viewport is at the full stop: the full sheet less what stays pinned above the rows (the top line, unless
 * the header scrolls with the rows).
 */
export function listViewport(full: number, pinnedHeader: number): number {
  return Math.max(0, full - pinnedHeader);
}
