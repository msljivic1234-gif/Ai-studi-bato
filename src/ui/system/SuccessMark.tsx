import { useEffect, useRef, type ReactNode } from 'react';
import { Animated, StyleSheet } from 'react-native';
import { Check } from 'phosphor-react-native';
import { tick } from './haptics';
import { useReducedMotion } from './motion';
import { sys } from './tokens';

/**
 * A finished thing, confirmed once: a Zadatak published, a rating saved.
 *
 * Motion is feedback here, never decoration (DESIGN_SKILLS.md). The mark settles in with one spring and
 * one success haptic only when the thing has JUST happened (`fresh`). The same receipt opened again later
 * is still, because nothing new happened then. Reduced motion keeps the haptic and drops the movement.
 *
 * Core `Animated` with the native driver, not Reanimated: this sits on route screens whose tests isolate
 * the Reanimated runtime, and a transform plus an opacity is exactly what the native driver runs off the
 * JS thread.
 */
export function SuccessMark({ fresh = false, tone = 'green', size = 64, children }: {
  fresh?: boolean; tone?: 'green' | 'orange'; size?: number; children?: ReactNode;
}) {
  const reduced = useReducedMotion();
  const scale = useRef(new Animated.Value(fresh ? 0.6 : 1)).current;
  const opacity = useRef(new Animated.Value(fresh ? 0 : 1)).current;
  useEffect(() => {
    // The tick of an outcome that has JUST happened; how it is made, and that it never throws, is `system/haptics`.
    if (fresh) tick('success');
  }, [fresh]);
  useEffect(() => {
    if (!fresh || reduced) { scale.setValue(1); opacity.setValue(1); return; }
    const settle = Animated.parallel([
      // No overshoot (the owner's board, 8 Oct 2026: a bounce in moments = NE): damping 13 at stiffness 240 and mass 0.8 is under-damped and
      // crossed 1 once before settling. overshootClamping stops the value at 1 the first time it gets there; the spring still eases in.
      Animated.spring(scale, { toValue: 1, damping: 13, stiffness: 240, mass: 0.8, overshootClamping: true, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 1, duration: sys.motion.toggle, useNativeDriver: true }),
    ]);
    settle.start();
    return () => settle.stop();
  }, [fresh, reduced, scale, opacity]);
  const soft = tone === 'orange' ? sys.color.orangeSoft : sys.color.greenSoft;
  return <Animated.View importantForAccessibility="no-hide-descendants" accessibilityElementsHidden
    style={[s.mark, { width: size, height: size, borderRadius: size / 2, backgroundColor: soft, opacity, transform: [{ scale }] }]}>
    {children ?? <Check size={Math.round(size * 0.5)} weight="bold" color={sys.color.green} />}
  </Animated.View>;
}

const s = StyleSheet.create({
  mark: { alignItems: 'center', justifyContent: 'center' },
});
