import { createContext, useContext, useMemo } from 'react';
import { useWindowDimensions } from 'react-native';

/**
 * The text size the person chose, rounded to hundredths. Android hands its font scale over as a float, so its
 * "Large" setting arrives as 1.2999999523 and a layout keyed on `fontScale >= 1.3` never switched there (seen on the
 * emulator, 2026-09-24: Početna kept its tiles side by side and wrapped them to four lines). Read the scale through
 * this helper, never compare the raw value against a step.
 */
export function roundTextScale(fontScale: number): number {
  return Number.isFinite(fontScale) && fontScale > 0 ? Math.round(fontScale * 100) / 100 : 1;
}

/** The rounded text scale of the current window. */
export function useTextScale(): number {
  return roundTextScale(useWindowDimensions().fontScale);
}

/** From this text scale up a layout has no room for its designed shape ("Large" in Android's font settings). */
export const LARGE_TEXT_SCALE = 1.3;
/** Below this window width, in dp, a layout has no room for its designed shape. The owner's phone is 361 dp. */
export const NARROW_WIDTH = 340;

/**
 * What kind of room a layout has (UI/UX pass, 2026-10-02; audit Z11). Until now 26 components each decided for
 * themselves, at 340, 360, 375, 380 and 390 dp, so on the owner's 361 dp phone neighbouring components made different
 * choices on one screen and nothing was ever in the state it was designed for.
 *
 * - `compact`: the designed layout. Every phone from 340 dp up at ordinary text sizes, the owner's included.
 * - `narrow`: a window under 340 dp.
 * - `large`: text scale 1.3 or more. Wins over `narrow` when both are true, because large text needs more room than a
 *   narrow window does.
 *
 * `stacked` is the one answer a component acts on: it is true for `narrow` and for `large`, and a component stacks its
 * head, foot or actions in that case and in no other. Design the default for `compact` at scale 1.0 to 1.15; stacking is
 * the resilience fallback, not the look.
 */
export type LayoutClass = 'compact' | 'narrow' | 'large';
export type LayoutClassResult = { readonly cls: LayoutClass; readonly stacked: boolean };

// One shared, frozen answer per class: a component can use the result as a dependency without it changing on every render.
const COMPACT: LayoutClassResult = Object.freeze({ cls: 'compact', stacked: false });
const NARROW: LayoutClassResult = Object.freeze({ cls: 'narrow', stacked: true });
const LARGE: LayoutClassResult = Object.freeze({ cls: 'large', stacked: true });

/** The class of a window `width` dp wide at `textScale`; a value that is not a measurement never stacks a layout. */
export function layoutClassFor(width: number, textScale: number): LayoutClassResult {
  if (roundTextScale(textScale) >= LARGE_TEXT_SCALE) return LARGE;
  return Number.isFinite(width) && width < NARROW_WIDTH ? NARROW : COMPACT;
}

/** The answer a screen gets at text scale 1.3 and more: stack. The one the galleries hand to `LayoutClassOverride`. */
export const LARGE_LAYOUT: LayoutClassResult = LARGE;

/**
 * For the internal galleries only (`dizajn-*`, UI/UX pass 2026-10-08): a screen drawn inside this provider gets THIS class from
 * `useLayoutClass`, whatever the window says. A gallery cannot change the system's font, and the design lab (Expo web) has no text
 * scale at all, so without it the large layout of a component could not be drawn at the phone's own text size to be looked at.
 * Nothing in the app provides one, so in a store build the value is always `null` and the window decides, as it always did.
 */
export const LayoutClassOverride = createContext<LayoutClassResult | null>(null);

/**
 * The layout class of the current window. THE one place the window width is read: a component asks this, never
 * `useWindowDimensions().width`, and `__tests__/one-token-source.test.ts` fails when a file that is not on its shrinking
 * list reads the width itself. A gallery may force the answer (`LayoutClassOverride`); nothing else does.
 */
export function useLayoutClass(): LayoutClassResult {
  const forced = useContext(LayoutClassOverride);
  const { width, fontScale } = useWindowDimensions();
  return forced ?? layoutClassFor(width, fontScale);
}

/** The room itself: the window width in dp and the rounded text scale it was measured at. */
export type WindowRoom = { readonly width: number; readonly scale: number };

/**
 * The window's width and text scale, for the rare rule that has to know HOW MUCH room there is and not only whether there
 * is enough (the task card's head decides from the measured width of the title beside the price, `v2/cardHeadFit.ts`). It
 * sits beside `useLayoutClass` so the width is still read in this one file; a component that only needs to stack asks
 * `useLayoutClass`. The object is stable while the window and the text size are.
 */
export function useWindowRoom(): WindowRoom {
  const { width, fontScale } = useWindowDimensions();
  const scale = roundTextScale(fontScale);
  return useMemo(() => ({ width, scale }), [width, scale]);
}
