import { useCallback } from 'react';
import { Easing, ReduceMotion, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { useReducedMotion } from './motion';
import { sys } from './tokens';

const EASE_OUT = Easing.bezier(...sys.motion.easeOut);

/**
 * The one give, settle and lift of a surface under a finger (UI/UX pass 2026-10-02, audit MO-M5). It was written out three
 * times, word for word, in `TaskCard`, `ApplicationFace` and `AgreementCollectionPresentation`, and `Press` carries its own
 * copy of the same two moves; this is the single home for them.
 *
 * - `give` begins to shrink the surface (the press duration, ease-out) and `settle` springs it back. Hand them to the
 *   `onPressIn` and `onPressOut` of the `Press` (with `scaleTo={1}`, so the inner target does not scale on its own) that sit
 *   inside a card, so that one frame — border, ground and everything on it — gives as ONE object.
 * - `style` goes on the `Animated.View` that is that frame. It is the only Reanimated view the press needs: one shared
 *   value and one animated style for the card, however many targets it holds.
 * - `to` is the rung of the press-scale ladder : a row or a card gives the `row` rung, a button the `button` one.
 *
 * Reduced motion  is read from the one store: `give` does nothing, and `settle` puts the surface back at once, even
 * when the setting changed in the middle of a press, so a card can never be left shrunk.
 */
export function usePressLift(to: number = sys.motion.scale.row) {
  const reduced = useReducedMotion();
  const scale = useSharedValue(1);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));
  const give = useCallback(() => {
    if (!reduced) scale.set(withTiming(to, { duration: sys.motion.press, easing: EASE_OUT }));
  }, [reduced, scale, to]);
  const settle = useCallback(() => {
    scale.set(reduced ? 1 : withSpring(1, { ...sys.motion.spring, reduceMotion: ReduceMotion.System }));
  }, [reduced, scale]);
  return { style, give, settle };
}
