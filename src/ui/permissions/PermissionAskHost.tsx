import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Animated, Easing, Modal, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { Press } from '../Press';
import { T } from '../Text';
import { DIALOG_MAX_WIDTH } from '../system/ConfirmSheet';
import { FactArt } from '../system/FactArt';
import { useReducedMotion } from '../system/motion';
import { brandAction, sheetLift, sys } from '../system/tokens';
import { PERMISSION_ASK_COPY, permissionAsk, type PermissionAskAnswer, type PermissionAskOpen } from './permissionAsk';

const EASE_OUT = Easing.bezier(...sys.motion.easeOut);

/**
 * The question before the system's window (design proposal N): a white card in the middle of the screen over a dimmed one,
 * with the kind's picture, ONE question, one sentence, a green "Nastavi" and a quiet "Ne sada". It is the centred dialog of the
 * app's own confirmations (ui/system/ConfirmSheet: same width, corner, shadow, opening scale and Modal), with the one thing that
 * dialog has no place for: the picture. Back, a tap outside and "Ne sada" are the same answer, "later".
 *
 * Reduced motion: no scale and no fade, it is there and then it is gone (the Modal's own fade follows the system as well).
 */
export function PermissionAskDialog({ open, onAnswer }: { open: PermissionAskOpen; onAnswer: (answer: PermissionAskAnswer) => void }) {
  const copy = PERMISSION_ASK_COPY[open.kind];
  const reduced = useReducedMotion();
  const { height } = useWindowDimensions();
  const [scale] = useState(() => new Animated.Value(reduced ? 1 : sys.motion.dialog.from));
  const answered = useRef(false);
  useEffect(() => {
    if (reduced) { scale.setValue(1); return; }
    const run = Animated.timing(scale, { toValue: 1, duration: sys.motion.dialog.enter, easing: EASE_OUT, useNativeDriver: true });
    run.start();
    return () => run.stop();
  }, [reduced, scale]);
  // One answer, once: a second tap, or Back after "Nastavi", must not answer the next question in the queue.
  const answer = (value: PermissionAskAnswer) => { if (answered.current) return; answered.current = true; onAnswer(value); };
  return <Modal visible transparent animationType={reduced ? 'none' : 'fade'} statusBarTranslucent onRequestClose={() => answer('later')}>
    <View testID="permission-ask" style={s.layer}>
      <Pressable testID="permission-ask-scrim" style={[StyleSheet.absoluteFill, s.dim]} onPress={() => answer('later')}
        accessibilityRole="button" accessibilityLabel="Zatvori" accessibilityHint="Zatvara pitanje bez dozvole." />
      <Animated.View accessibilityViewIsModal
        style={[s.card, { maxHeight: height - 2 * sys.space.xl }, reduced ? null : { transform: [{ scale }] }]}>
        {/* The picture is a fact picture, not a control: the question beside it carries the meaning. */}
        <View accessible={false} importantForAccessibility="no-hide-descendants" style={s.art}>
          <FactArt kind={copy.art} size={64} />
        </View>
        <T accessibilityRole="header" variant="heading" style={s.centred}>{copy.title}</T>
        <T variant="copy" tone="muted" style={s.centred}>{copy.message}</T>
        <View style={s.actions}>
          <Press testID="permission-ask-allow" accessibilityRole="button" accessibilityLabel={copy.allow} haptic="light"
            onPress={() => answer('allow')} style={s.allow}>
            <T variant="action" style={s.onFilled}>{copy.allow}</T>
          </Press>
          <Press testID="permission-ask-later" accessibilityRole="button" accessibilityLabel={copy.later} haptic="select"
            onPress={() => answer('later')} style={s.later}>
            <T variant="action" style={s.quiet}>{copy.later}</T>
          </Press>
        </View>
      </Animated.View>
    </View>
  </Modal>;
}

/**
 * Draws the open question, if any. Mount it ONCE, at the root, beside the navigator: a native Modal lies over every screen
 * whichever one it is mounted under. While it is mounted the features' questions are drawn; when it is gone, questions that
 * were waiting are answered "later" and new ones are answered "allow" at once (see `permissionAsk`).
 */
export function PermissionAskHost() {
  const [host] = useState(() => ({}));
  useEffect(() => permissionAsk.mountHost(host), [host]);
  const open = useSyncExternalStore(permissionAsk.subscribe, () => permissionAsk.current(host), () => null);
  if (!open) return null;
  return <PermissionAskDialog key={open.id} open={open} onAnswer={value => permissionAsk.answer(open.id, value)} />;
}

const s = StyleSheet.create({
  layer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: sys.space.xl },
  dim: { backgroundColor: sys.color.dim },
  card: { width: '100%', maxWidth: DIALOG_MAX_WIDTH, backgroundColor: sys.color.surface, borderRadius: sys.radius.card,
    paddingHorizontal: sys.space.xl, paddingTop: sys.space.xl, paddingBottom: sys.space.base, gap: sys.space.sm, ...sheetLift.detached },
  art: { alignItems: 'center', marginBottom: sys.space.xs },
  centred: { textAlign: 'center', color: sys.color.ink },
  // Stacked, the green one over the quiet one, 8 apart (dialog template T6); 16 between the words and the answers.
  actions: { gap: sys.space.sm, marginTop: sys.space.base },
  allow: { ...brandAction, paddingHorizontal: sys.space.base, paddingVertical: sys.space.sm, alignItems: 'center', justifyContent: 'center' },
  onFilled: { color: sys.color.onGreen, textAlign: 'center' },
  later: { minHeight: 48, borderRadius: sys.radius.primary, paddingHorizontal: sys.space.base, alignItems: 'center', justifyContent: 'center' },
  quiet: { color: sys.color.muted, textAlign: 'center' },
});
