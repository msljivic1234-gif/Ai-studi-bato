import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Animated, Easing, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { CaretDown } from 'phosphor-react-native';
import { Press } from '../Press';
import { T } from '../Text';
import { FactArt, type FactArtKind } from './FactArt';
import { useReducedMotion } from './motion';
import { sys } from './tokens';

/**
 * The art column of a row with art: the art's width and the air after it, so the opened part lines up under the label.
 * Spacing is on the sys.space scale; the inset is a card's own padding, so a row's text lines up with the cards around it.
 */
const ART_WIDTH = 32, ART_GAP = sys.space.md, INSET = sys.space.lg;

/**
 * The one "open in place" row (master design plan, 2026-09-24: sixteen hand-made open/close blocks had sixteen carets
 * and spacings). A label, an optional quiet hint under it, the caret that turns over when the row opens, and the part
 * it opens under it. The caret turns in 180 ms on a real change and at once under reduced motion; the state is spoken
 * as `expanded`. At least 56 px high.
 *
 * Controlled when `expanded` is passed (the caller owns the state and hears `onToggle`); otherwise it keeps its own.
 * `divider` draws the hairline above the row; `inset` pads the row for a list drawn inside a card.
 */
export function Disclosure({ label, hint, art, expanded, defaultExpanded = false, onToggle, divider = false, inset = false, style, children }: {
  label: string; hint?: string; art?: FactArtKind;
  expanded?: boolean; defaultExpanded?: boolean; onToggle?: (next: boolean) => void;
  divider?: boolean; inset?: boolean; style?: StyleProp<ViewStyle>; children?: ReactNode;
}) {
  const [own, setOwn] = useState(defaultExpanded);
  const open = expanded ?? own;
  const toggle = () => { if (expanded === undefined) setOwn(!open); onToggle?.(!open); };
  return <View style={[divider && s.divider, style]}>
    {/* The hint is a fact about what the row holds ("Tvoj broj je podeljen"), so a screen reader hears it too. */}
    <Press accessibilityRole="button" accessibilityLabel={label} accessibilityHint={hint} accessibilityState={{ expanded: open }} onPress={toggle}
      haptic="select" scaleTo={0.99} style={[s.row, inset && s.inset]}>
      {art ? <View style={s.art}><FactArt kind={art} size={26} /></View> : null}
      <View style={s.copy}>
        <T variant="bodyStrong" style={s.label}>{label}</T>
        {hint ? <T variant="note" tone="muted">{hint}</T> : null}
      </View>
      <TurningCaret open={open} />
    </Press>
    {open ? <View style={[s.body, inset && s.inset, art ? { paddingLeft: (inset ? INSET : 0) + ART_WIDTH + ART_GAP } : null]}>{children}</View> : null}
  </View>;
}

/**
 * Down when closed, up when open; it turns in 180 ms on a real change and at once under reduced motion. Exported for a
 * row that opens in place but is not a Disclosure (the day rows of Dostupnost), so there is one caret.
 */
export function TurningCaret({ open }: { open: boolean }) {
  const reduced = useReducedMotion();
  const turn = useRef(new Animated.Value(open ? 1 : 0)).current;
  useEffect(() => {
    if (reduced) { turn.setValue(open ? 1 : 0); return; }
    const run = Animated.timing(turn, { toValue: open ? 1 : 0, duration: sys.motion.toggle,
      easing: Easing.bezier(...sys.motion.easeOut), useNativeDriver: true });
    run.start();
    return () => run.stop();
  }, [open, reduced, turn]);
  const rotate = turn.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '180deg'] });
  return <Animated.View testID="disclosure-caret" style={{ transform: [{ rotate }] }}>
    <CaretDown size={20} color={sys.color.muted} />
  </Animated.View>;
}

const s = StyleSheet.create({
  divider: { borderTopWidth: 1, borderTopColor: sys.color.line },
  row: { minHeight: 56, paddingVertical: sys.space.md, flexDirection: 'row', alignItems: 'center', gap: ART_GAP },
  inset: { paddingHorizontal: INSET },
  art: { width: ART_WIDTH, alignItems: 'center' },
  // Two lines of one row (label and hint) sit on their own leading, not on the layout scale.
  copy: { flex: 1, minWidth: 0, gap: 2 },
  label: { color: sys.color.ink },
  body: { paddingBottom: sys.space.base, gap: sys.space.md },
});
