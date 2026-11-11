import { useEffect, useRef, type ReactNode } from 'react';
import { Animated, Easing } from 'react-native';
import { useReducedMotion } from './motion';
import { sys } from './tokens';

/**
 * V41's "art arrive" (v17-art-arrive): the illustration of an empty state settles in once — a small rise, a
 * slight tilt that straightens, and full opacity — so an empty screen reads as ready, not broken. It runs once on
 * mount, on the native driver, and not at all under reduced motion. Only for illustrations, never for text or
 * controls. How long it takes and the curve it follows are `sys.motion.arrive` .
 *
 * It only SETTLES (owner, 2026-10-08, "bez odskoka"): the picture goes from where it starts (4 dp low, tilted 3° the other way, a little
 * transparent) to where it stays, and never goes past it. It used to rise 3 dp over its place and tilt 1° past straight before it came back;
 * now every value moves one way only, and the curve of `sys.motion.arrive` itself has no overshoot either (its control points stay in 0 to 1).
 * Under reduced motion it is simply there, at once, in its final place.
 */
export function Arrive({ children, delay = 80 }: { children: ReactNode; delay?: number }) {
  const reduced = useReducedMotion();
  const progress = useRef(new Animated.Value(reduced ? 1 : 0)).current;
  useEffect(() => {
    if (reduced) { progress.setValue(1); return; }
    const run = Animated.timing(progress, { toValue: 1, duration: sys.motion.arrive.duration, delay,
      easing: Easing.bezier(...sys.motion.arrive.easing), useNativeDriver: true });
    run.start();
    return () => run.stop();
  }, [reduced, delay, progress]);
  const translateY = progress.interpolate({ inputRange: [0, 1], outputRange: [4, 0] });
  const rotate = progress.interpolate({ inputRange: [0, 1], outputRange: ['-3deg', '0deg'] });
  const opacity = progress.interpolate({ inputRange: [0, 0.6, 1], outputRange: [0.65, 1, 1] });
  return <Animated.View style={{ opacity, transform: [{ translateY }, { rotate }] }}>{children}</Animated.View>;
}

/**
 * A loading placeholder that breathes (V41 skeleton), so a wait reads as work in progress. Opacity only, on the native
 * driver, stopped under reduced motion. A half-turn is `sys.motion.loop.breath` .
 */
export function useBreath(): Animated.Value | Animated.AnimatedInterpolation<number> {
  const reduced = useReducedMotion();
  const value = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (reduced) { value.setValue(1); return; }
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(value, { toValue: 0.78, duration: sys.motion.loop.breath, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      Animated.timing(value, { toValue: 1, duration: sys.motion.loop.breath, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [reduced, value]);
  return value;
}
