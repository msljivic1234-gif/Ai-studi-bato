import { memo, useEffect, useMemo, useRef, useState, type MutableRefObject } from 'react';
import { Animated, AppState, Easing, View } from 'react-native';
import { Image } from 'expo-image';
import { useReducedMotion } from '../system/motion';
import { sys } from '../system/tokens';

const SOURCE = require('../../../assets/ai/uskoci-assistant.png');

/** Existing USKOČI robot identity, shared by task and work-profile interviews.
 * Static art identifies the assistant; it never signals capture, speech or a completed action. It stands at 24 beside what it says in the
 * thread, at 44 in compact context, and at 88 or 128 for an opening. The same
 * character identifies the assistant without implying a server result. */
export type AiAssistantArtProps = {
  size: 24 | 44 | 88 | 128;
  animated?: boolean;
};

/** Static transcript markers have no animation values, timers or AppState subscription.
 * Only an explicitly animated illustration owns motion; no layout or brand changes. */
export const AiAssistantArt = memo(function AiAssistantArt({ size, animated }: AiAssistantArtProps) {
  if (animated ?? (size >= 88)) return <AnimatedAssistantArt size={size} />;
  return <View accessible={false} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden
    style={{ width: size, height: size, flexShrink: 0 }}><AssistantImage size={size} /></View>;
});

function AssistantImage({ size }: Pick<AiAssistantArtProps, 'size'>) {
  return <Image source={SOURCE} contentFit="contain" transition={0} cachePolicy="memory" allowDownscaling
    accessible={false} style={{ width: size, height: size }} />;
}

function AnimatedAssistantArt({ size }: Pick<AiAssistantArtProps, 'size'>) {
  const reduced = useReducedMotion();
  // Lazy allocation also avoids constructing unused native values on every re-render.
  const [{ floatAnim, blinkAnim, winkAnim }] = useState(() => ({
    floatAnim: new Animated.Value(0), blinkAnim: new Animated.Value(0), winkAnim: new Animated.Value(0),
  }));

  useEffect(() => {
    let floatLoop: Animated.CompositeAnimation | null = null;
    let eyeRun: Animated.CompositeAnimation | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let running = false, generation = 0;
    const stop = () => {
      // Invalidate callbacks before stopping: native stop may call completion synchronously.
      running = false; generation++;
      if (timer !== undefined) clearTimeout(timer);
      timer = undefined;
      floatLoop?.stop(); eyeRun?.stop();
      floatLoop = null; eyeRun = null;
      for (const value of [floatAnim, blinkAnim, winkAnim]) {
        value.stopAnimation(); value.setValue(0);
      }
    };
    if (reduced) { stop(); return; }

    const scheduleBlink = (owner: number) => {
      if (!running || owner !== generation) return;
      const delay = sys.motion.assistant.nextBlinkMin + Math.random() * sys.motion.assistant.nextBlinkJitter;
      timer = setTimeout(() => {
        timer = undefined;
        if (!running || owner !== generation || AppState.currentState !== 'active') return;
        const wink = Math.random() < 0.3, value = wink ? winkAnim : blinkAnim;
        eyeRun = Animated.sequence([
          Animated.timing(value, { toValue: 1,
            duration: wink ? sys.motion.assistant.winkClose : sys.motion.assistant.blinkClose,
            easing: Easing.ease, useNativeDriver: true, isInteraction: false }),
          Animated.timing(value, { toValue: 0,
            duration: wink ? sys.motion.assistant.winkOpen : sys.motion.assistant.blinkOpen,
            easing: Easing.ease, useNativeDriver: true, isInteraction: false }),
        ]);
        eyeRun.start(({ finished }) => {
          if (!running || owner !== generation) return;
          eyeRun = null;
          if (finished) scheduleBlink(owner);
        });
      }, delay);
    };
    const start = () => {
      if (running) return;
      running = true;
      const owner = ++generation;
      floatLoop = Animated.loop(Animated.sequence([
        Animated.timing(floatAnim, { toValue: 1, duration: sys.motion.assistant.floatHalf,
          easing: Easing.inOut(Easing.sin), useNativeDriver: true, isInteraction: false }),
        Animated.timing(floatAnim, { toValue: 0, duration: sys.motion.assistant.floatHalf,
          easing: Easing.inOut(Easing.sin), useNativeDriver: true, isInteraction: false }),
      ]));
      floatLoop.start(); scheduleBlink(owner);
    };
    // Stop immediately on the native lifecycle event, not after a React state update.
    const subscription = AppState.addEventListener('change', state => state === 'active' ? start() : stop());
    if (AppState.currentState === 'active') start();
    return () => { subscription.remove(); stop(); };
  }, [reduced, floatAnim, blinkAnim, winkAnim]);

  const { translateY, rotate, scale, rightLidOpacity } = useMemo(() => ({
    translateY: floatAnim.interpolate({ inputRange: [0, 1], outputRange: [0, -size * 0.045] }),
    rotate: floatAnim.interpolate({ inputRange: [0, 0.5, 1], outputRange: ['0deg', '1.2deg', '-0.8deg'] }),
    scale: floatAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.02] }),
    rightLidOpacity: Animated.add(blinkAnim, winkAnim),
  }), [size, floatAnim, blinkAnim, winkAnim]);

  const leftEyeStyle = {
    position: 'absolute' as const,
    left: size * 0.33,
    top: size * 0.53,
    width: size * 0.19,
    height: size * 0.19,
    borderRadius: size * 0.095,
    backgroundColor: '#0F1215',
  };

  const rightEyeStyle = {
    position: 'absolute' as const,
    left: size * 0.61,
    top: size * 0.54,
    width: size * 0.18,
    height: size * 0.18,
    borderRadius: size * 0.09,
    backgroundColor: '#0F1215',
  };

  const slitColor = '#3FF3B8';
  const leftSlitStyle = {
    position: 'absolute' as const,
    left: size * 0.35,
    top: size * 0.62,
    width: size * 0.15,
    height: Math.max(2, size * 0.02),
    borderRadius: size * 0.01,
    backgroundColor: slitColor,
  };
  const rightSlitStyle = {
    position: 'absolute' as const,
    left: size * 0.63,
    top: size * 0.63,
    width: size * 0.14,
    height: Math.max(2, size * 0.02),
    borderRadius: size * 0.01,
    backgroundColor: slitColor,
  };

  const leftLidOpacity = blinkAnim;

  return (
    <Animated.View
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
      style={{
        width: size,
        height: size,
        flexShrink: 0,
        transform: [{ translateY }, { rotate }, { scale }],
      }}
    >
      <AssistantImage size={size} />
      {size >= 88 ? (
        <>
          <Animated.View style={[leftEyeStyle, { opacity: leftLidOpacity }]} />
          <Animated.View style={[leftSlitStyle, { opacity: leftLidOpacity }]} />
          <Animated.View style={[rightEyeStyle, { opacity: rightLidOpacity }]} />
          <Animated.View style={[rightSlitStyle, { opacity: rightLidOpacity }]} />
        </>
      ) : null}
    </Animated.View>
  );
}

export type AssistantWelcomeMemory = { key: string | undefined; consumed: boolean };

/** One short opacity arrival for an empty conversation. Not a hand-wave or listening animation.
 * The shell owns the memory so hiding the opening for the keyboard cannot replay it. */
export function AiAssistantWelcome({ conversationKey, memory }: {
  conversationKey?: string;
  memory: MutableRefObject<AssistantWelcomeMemory>;
}) {
  const reduced = useReducedMotion();
  const opacity = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const first = memory.current.key !== conversationKey || !memory.current.consumed;
    memory.current = { key: conversationKey, consumed: true };
    opacity.stopAnimation(); opacity.setValue(1);
    if (!first || reduced || AppState.currentState !== 'active') return;
    opacity.setValue(0);
    // Follow the app's B22 native-driver policy; no Reanimated view lifecycle or per-frame JS.
    const run = Animated.timing(opacity, { toValue: 1, duration: sys.motion.enter,
      easing: Easing.bezier(...sys.motion.easeOut), useNativeDriver: true, isInteraction: false });
    const settle = () => { run.stop(); opacity.setValue(1); };
    const subscription = AppState.addEventListener('change', state => { if (state !== 'active') settle(); });
    run.start();
    return () => { subscription.remove(); settle(); };
  }, [conversationKey, memory, opacity, reduced]);
  return <Animated.View style={{ opacity }}><AiAssistantArt size={88} /></Animated.View>;
}
