import { useEffect, useState, type RefObject } from 'react';
import { AccessibilityInfo, AppState, PixelRatio, Platform, Pressable, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, type SharedValue } from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import { sys } from '../../system/tokens';

/**
 * What lies behind the search panel: the screen it opened over, softly blurred (`blur`), or the same screen only dimmed
 * (`dim`). It is never a white page: the first panel hid its own blur under an opaque white frame, and its fallback was a
 * 90 % white veil, so the person never saw the screen behind it (owner, 2026-10-07).
 */
export type BackdropKind = 'blur' | 'dim';

/** The blur's strength (it also sets how light the tint over it is): soft enough that the map is still the map. */
export const BLUR_INTENSITY = 35;
/**
 * How soft the blur is on Android, in dp. The native blur takes its radius in PIXELS (the intensity divided by the
 * reduction factor, 4 by default), which on the owner's 560 dpi phone is about 2.5 dp: a faint smudge nobody would call a
 * blur. The reduction factor is therefore set from the screen's density, so the blur is the same size to the eye on
 * every phone. (iOS ignores the factor; its own blur is already in points.)
 */
export const BLUR_DP = 12;
export const blurReductionFor = (pixelRatio: number): number => Math.max(0.25, BLUR_INTENSITY / (BLUR_DP * (Number.isFinite(pixelRatio) && pixelRatio > 0 ? pixelRatio : 2)));

/**
 * The one rule. A real blur needs a target to blur and a platform that can do it: iOS always, Android from 12 (API 31, the
 * RenderEffect that the native blur view is built on; older versions would need the slow software path, which the app does
 * not take). With "reduce transparency" on, or on the web, the screen is dimmed instead, as it is on an older Android.
 */
export function searchBackdropKind({ os, version, hasTarget, reducedTransparency }: {
  os: string; version: string | number; hasTarget: boolean; reducedTransparency: boolean;
}): BackdropKind {
  if (reducedTransparency) return 'dim';
  if (os === 'ios') return 'blur';
  return os === 'android' && Number(version) >= 31 && hasTarget ? 'blur' : 'dim';
}

/** iOS starts opaque-safe until the preference is known; a newer event always wins over an older async query. Android has no such setting. */
export function useReducedTransparency(): boolean {
  const [reduced, setReduced] = useState(Platform.OS === 'ios');
  useEffect(() => {
    if (Platform.OS !== 'ios') return;
    let alive = true, revision = 0;
    const ask = () => {
      const request = ++revision;
      try {
        AccessibilityInfo.isReduceTransparencyEnabled?.()?.then(value => {
          if (alive && revision === request && typeof value === 'boolean') setReduced(value);
        }, () => undefined);
      } catch { /* The safe fallback (a dim) remains when the preference cannot be read. */ }
    };
    let preference: { remove?: () => void } | undefined, foreground: { remove?: () => void } | undefined;
    try { preference = AccessibilityInfo.addEventListener?.('reduceTransparencyChanged', value => {
      if (alive) { revision++; setReduced(!!value); }
    }); } catch { /* Older adapters keep the last known preference. */ }
    try { foreground = AppState.addEventListener?.('change', value => { if (value === 'active') ask(); }); }
    catch { /* No foreground API in this environment. */ }
    ask();
    return () => { alive = false; revision++; preference?.remove?.(); foreground?.remove?.(); };
  }, []);
  return reduced;
}

/**
 * The backdrop and its way out. It is decoration for the eye and invisible to a screen reader, which has the panel's own
 * close button; a tap on it closes the panel like that button does. `fade` runs 0 to 1 on the native driver (it is only an
 * opacity), and the layer asks for off-screen compositing so that the blur fades with it instead of arriving at full strength.
 */
export function SearchBackdrop({ kind, blurTarget, fade, onPress }: {
  kind: BackdropKind; blurTarget?: RefObject<View | null>; fade: SharedValue<number>; onPress: () => void;
}) {
  const motion = useAnimatedStyle(() => ({ opacity: fade.value }));
  return <>
    <Animated.View testID="search-backdrop" pointerEvents="none" accessible={false} importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden needsOffscreenAlphaCompositing style={[StyleSheet.absoluteFill, motion]}>
      {kind === 'blur' ? <BlurView testID="search-blur-backdrop" pointerEvents="none" style={StyleSheet.absoluteFill}
        intensity={BLUR_INTENSITY} tint="light" blurMethod="dimezisBlurViewSdk31Plus" blurReductionFactor={blurReductionFor(PixelRatio.get())}
        blurTarget={blurTarget} /> : null}
      <View testID="search-dim-backdrop" pointerEvents="none" style={[StyleSheet.absoluteFill, kind === 'blur' ? s.softDim : s.dim]} />
    </Animated.View>
    <Pressable testID="search-backdrop-press" accessible={false} importantForAccessibility="no" onPress={onPress} style={StyleSheet.absoluteFill} />
  </>;
}

const s = StyleSheet.create({
  // Over a blur the dim only separates the white panel from the lightened map; alone it is the whole backdrop.
  dim: { backgroundColor: sys.color.dim },
  softDim: { backgroundColor: sys.color.dim, opacity: 0.5 },
});
