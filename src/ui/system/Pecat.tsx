import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { T } from '../Text';
import { tick, type Tick } from './haptics';
import { useReducedMotion } from './motion';
import { STATUS_TONES, StatusMark, type StatusShape } from './StatusChip';
import { sys } from './tokens';

/**
 * The stamp (owner's pick of 8 Oct 2026, "Pilula pada"; creative direction B3): the state pill of something the person laid on the table
 * ("Ocenjeno", "Objavljen") that lands on it, tilted a little like a stamp on a receipt.
 *
 * It looks like the chip of the one state system (`StatusChip`: the same ground, mark and word per tone), tilted -4 degrees. With
 * `play` it falls once: from 1.25 times its size and from nothing to whole in 140 ms, decelerating (`easeOut`), with no bounce, and a
 * light tick as it lands. Only `transform` and `opacity` move, on the native driver; the word is already final while the pill falls
 * (a state word is a fact, and the container moves, never the text). Under reduced motion the pill is simply there and the tick stays
 * (a tick is not movement). Without `play` (the screen opened again later, nothing new happened) it is still.
 *
 * The 140 ms is shorter than `sys.motion.toggle` (180) on purpose: a stamp is quicker than a switch. No token names it yet; if the owner
 * keeps the stamp, the proposal is `sys.motion.stamp`.
 */
export const PECAT_FALL_MS = 140;
/** The size the stamp falls from, and how it is tilted on its receipt. */
const FALL_FROM = 1.25;
const TILT = '-4deg';

export type PecatProps = {
  /** The state word, final from the first frame; a screen reader hears it as one text. */
  label: string;
  /** `green`: it goes, it is settled (the chip's green ground). `neutral`: waits for someone else. */
  tone?: 'neutral' | 'green';
  /** Falls once, on mount (or when it turns true): only for what has JUST happened. Left out, the stamp is already there and still. */
  play?: boolean;
  /** Milliseconds after `play` before it starts to fall, so a stamp can follow the thing that arrives first. */
  delay?: number;
  /** The chip's mark. Left out: a dot for `green` (it goes), a ring for `neutral` (it waits), as the state table draws them. */
  shape?: StatusShape;
  /** The tick as it lands: `light` (the main action, the contract's default) or `success` where the stamp IS the outcome the server confirmed (a saved rating). */
  tickKind?: Tick;
  /** Where the stamp sits (a corner of something, a row); the pill itself is centred on its own cross axis. */
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

export function Pecat({ label, tone = 'neutral', play = false, delay = 0, shape, tickKind = 'light', style, testID = 'pecat' }: PecatProps) {
  const reduced = useReducedMotion();
  // The first frame is already the right one: a pill that is going to fall starts invisible, one that is not starts whole.
  const progress = useRef(new Animated.Value(play && !reduced ? 0 : 1)).current;
  useEffect(() => {
    if (!play) { progress.setValue(1); return; }
    if (reduced) { progress.setValue(1); tick(tickKind); return; }
    progress.setValue(0);
    const fall = Animated.timing(progress, { toValue: 1, duration: PECAT_FALL_MS, delay, easing: Easing.bezier(...sys.motion.easeOut), useNativeDriver: true });
    fall.start(({ finished }) => { if (finished) tick(tickKind); });
    return () => fall.stop();
  }, [play, reduced, delay, tickKind, progress]);
  const scale = progress.interpolate({ inputRange: [0, 1], outputRange: [FALL_FROM, 1] });
  const palette = STATUS_TONES[tone];
  return <Animated.View testID={testID} accessible accessibilityRole="text" accessibilityLabel={label}
    style={[s.pill, { backgroundColor: palette.ground, opacity: progress, transform: [{ scale }, { rotate: TILT }] }, style]}>
    <StatusMark shape={shape ?? (tone === 'green' ? 'dot' : 'ring')} tone={tone} />
    <T accessible={false} variant="label" style={[s.word, { color: palette.word }]}>{label}</T>
  </Animated.View>;
}

const s = StyleSheet.create({
  // The measure of the chip (`StatusChip`), so a stamp and a chip of the same state are the same pill.
  pill: { alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: sys.space.xs, paddingVertical: sys.space.xs,
    paddingLeft: sys.space.sm, paddingRight: sys.space.md, borderRadius: sys.radius.pill },
  // `label` tracks wide for capitals; the word of a state is not in capitals.
  word: { letterSpacing: 0 },
});
