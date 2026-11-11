import { memo, useEffect, useRef, type ReactNode } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import Svg, { Ellipse, Path } from 'react-native-svg';
import { layout } from '../system/layout';
import { useReducedMotion } from '../system/motion';
import { sys } from '../system/tokens';

/**
 * The rating stars as stickers (owner's pick of 8 Oct 2026, "Zvezde kao nalepnice"). A star is the 48 dp that a control needs, so five of
 * them and four gaps are the row both the rating and the saved rating draw: 272 dp, which fits a 320 dp window with its edges.
 */
export const STAR_SLOT = layout.touch;
export const STARS_COUNT = 5;
export const STARS_WIDTH = STARS_COUNT * STAR_SLOT + (STARS_COUNT - 1) * sys.space.sm;

/** The star of the sticker, drawn once so a full and an empty star share one geometry (until the owner's own drawing of it arrives). */
const STAR = 'M16 2.9 19.06 11.29 27.98 11.61 20.95 17.11 23.41 25.69 16 20.7 8.59 25.69 11.05 17.11 4.02 11.61 12.94 11.29Z';
/** How far the darker edge lies under the face, in the canvas units of the 32 box: the thickness of the enamel. */
const EDGE_DEPTH = 1.5;

/**
 * A rating star as a sticker: the full one in the orange enamel (an orange face, a darker edge under it, one shine), the empty one in cream
 * enamel (the orange's soft tint with its halo as the edge), the same shape, a soft shadow on the ground under both. Vector until the
 * owner's PNG of it replaces it. Decoration: the word beside the stars says the rating.
 */
export const RatingStar = memo(function RatingStar({ size = STAR_SLOT, full }: { size?: number; full: boolean }) {
  const face = full ? sys.color.art.accent.front : sys.color.orangeSoft;
  const edge = full ? sys.color.art.accent.edge : sys.color.orangeHalo;
  const shine = full ? sys.color.art.accent.light : sys.color.surface;
  return <View aria-hidden accessible={false} style={{ width: size, height: size }}>
    <Svg width={size} height={size} viewBox="0 0 32 32">
      <Ellipse cx={16} cy={29.4} rx={10.2} ry={1.6} fill={sys.color.ink} opacity={0.07} />
      <Path d={STAR} fill={edge} stroke={edge} strokeWidth={2.2} strokeLinejoin="round" transform={`translate(0 ${EDGE_DEPTH})`} />
      <Path d={STAR} fill={face} stroke={face} strokeWidth={2.2} strokeLinejoin="round" />
      <Path d="M13.8 11.1l1.5-4.2" fill="none" stroke={shine} strokeWidth={1.8} strokeLinecap="round" />
    </Svg>
  </View>;
});

/**
 * The one glow in the app: a white band crosses the stars once, in 420 ms, when a rating has JUST been saved. It is longer than an entrance
 * (`enter`, 240) and shorter than an arrival (`arrive`, 800), and no token names it yet. Only `transform` and `opacity` move, on the native
 * driver, on `easeOut`; the stars under it are the fact and never move. Under reduced motion, and for a rating that was saved earlier,
 * there is no glow at all: the stars are simply there.
 */
export const GLOW_MS = 420;
/** The band is about a third of the row, and leans like light on enamel. */
const GLOW_SHARE = 0.35;
const GLOW_LEAN = '-16deg';
/** How bright the band is at its middle. */
const GLOW_PEAK = 0.8;

export function StarGlow({ width, play, delay = 0, children }: { width: number; play: boolean; delay?: number; children: ReactNode }) {
  const reduced = useReducedMotion();
  const sweeps = play && !reduced;
  const progress = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!sweeps) return;
    progress.setValue(0);
    const sweep = Animated.timing(progress, { toValue: 1, duration: GLOW_MS, delay, easing: Easing.bezier(...sys.motion.easeOut), useNativeDriver: true });
    sweep.start();
    return () => sweep.stop();
  }, [sweeps, delay, progress]);
  const band = Math.round(width * GLOW_SHARE);
  const translateX = progress.interpolate({ inputRange: [0, 1], outputRange: [-band, width] });
  const opacity = progress.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, GLOW_PEAK, 0] });
  return <View style={[s.glow, { width }]}>
    {children}
    {sweeps ? <Animated.View pointerEvents="none" style={[s.band, { width: band, opacity, transform: [{ translateX }, { skewX: GLOW_LEAN }] }]} /> : null}
  </View>;
}

const s = StyleSheet.create({
  glow: { overflow: 'hidden', borderRadius: sys.radius.control, alignSelf: 'center' },
  band: { position: 'absolute', top: 0, bottom: 0, left: 0, backgroundColor: sys.color.surface },
});
