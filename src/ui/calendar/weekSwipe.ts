import { useMemo, useRef } from 'react';
import { PanResponder } from 'react-native';

/**
 * Swipe to change the period (owner, 2026-10-07: "swipe left/right changes the week"; since 8 Oct 2026 the period is a month, a week or
 * a day, whichever view is open: "prevlačenje menja mesec / nedelju"). The arrows stay; this is the same step.
 *
 * A finger moving LEFT turns to the NEXT period (the page comes towards you from the right), a finger moving RIGHT to the previous
 * one. It claims the touch only when the move is clearly sideways (twice as far across as down), so a person scrolling the page
 * is never taken over, and a tap on a day is never a swipe: a day press still goes through when the finger barely moves. It
 * changes the period at once, with no slide: nothing that states a time moves (motion rule), so reduced motion needs nothing of it.
 */

/** How far across, in dp, before a move is a swipe at all, and how far for a slow one to count. */
export const SWIPE_START = 16;
export const SWIPE_DISTANCE = 56;
/** A short, quick flick counts too: this far, this fast (dp per millisecond). */
export const SWIPE_FLICK_DISTANCE = 32;
export const SWIPE_FLICK_SPEED = 0.45;

/** The step a finished move makes: 1 for the next period, -1 for the previous, 0 for no swipe. */
export function swipeStep(dx: number, dy: number, vx: number): -1 | 0 | 1 {
  if (!(Math.abs(dx) > Math.abs(dy) * 2)) return 0;
  const far = Math.abs(dx) >= SWIPE_DISTANCE || (Math.abs(dx) >= SWIPE_FLICK_DISTANCE && Math.abs(vx) >= SWIPE_FLICK_SPEED);
  return far ? (dx < 0 ? 1 : -1) : 0;
}

/** Whether a move that is still going is sideways enough for the swipe to take the touch. */
export const startsSwipe = (dx: number, dy: number): boolean => Math.abs(dx) > SWIPE_START && Math.abs(dx) > Math.abs(dy) * 2;

/** The responder handlers to spread on the view a swipe happens over (the name is the week's, from before the month and the day had one). */
export function useWeekSwipe(onStep: (step: -1 | 1) => void) {
  const latest = useRef(onStep);
  latest.current = onStep;
  return useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponder: (_event, gesture) => startsSwipe(gesture.dx, gesture.dy),
    // Once it has the touch the day list's scroll must not take it back mid-swipe.
    onPanResponderTerminationRequest: () => false,
    onPanResponderRelease: (_event, gesture) => {
      const step = swipeStep(gesture.dx, gesture.dy, gesture.vx);
      if (step) latest.current(step);
    },
  }).panHandlers, []);
}
