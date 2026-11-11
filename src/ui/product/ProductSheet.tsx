import { createContext, useCallback, useContext, useEffect, useRef, useState, type Context, type ReactNode } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import * as SafeArea from 'react-native-safe-area-context';
import Animated, { cancelAnimation, Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { Press } from '../Press';
import { T } from '../Text';
import { Glyph } from '../system/Glyph';
import { brandAction, sheetLift, sys } from '../system/tokens';
import { useSystemReducedMotion } from '../../hooks/useSystemReducedMotion';

export const SHEET_TOUCH = Math.max(48, sys.touch.min);
// Compatibility exports for the map's independent, gesture-driven panels. Their motion is unchanged.
export const SHEET_SPRING = sys.motion.sheetSpring;
export function sheetCloseConfig(reduced: boolean) {
  return reduced ? { duration: 0 } : { duration: sys.motion.sheetClose, easing: Easing?.bezier?.(...sys.motion.easeOut) };
}
export const SHEET_BACKDROP_HINT = 'Zatvara pregled bez primene izbora.';
export const SHEET_BACKDROP_DIRTY_HINT = 'Pita pre nego što odbaci izmene.';
export const FOOTER_ESTIMATE = (brandAction.minHeight as number) + sys.space.xs + SHEET_TOUCH + 2 * sys.space.md;

const InsetsContext = (SafeArea as { SafeAreaInsetsContext?: Context<{ top: number; bottom: number; left: number; right: number } | null> }).SafeAreaInsetsContext;
const fallbackInsets = createContext<{ top: number; bottom: number; left: number; right: number } | null>(null);

export type ProductSheetProps = {
  title?: string;
  label?: string;
  closeLabel?: string;
  backdropHint?: string | null;
  reduced?: boolean;
  /** Called once. The owner remains responsible for the command's result. */
  onClose: () => void;
  children: (dismiss: () => void) => ReactNode;
  /** Commands stay outside the content scroll. */
  footer?: (dismiss: () => void) => ReactNode;
  /** User dismissal asks before discarding; explicit commit may dismiss directly. */
  dirty?: boolean;
  dismissible?: boolean;
  closeButton?: boolean;
};

/** Centred application dialog. The API name remains compatible with existing callers.
 * Native Modal owns focus and Back; the map retains its separate Gorhom panels.
 * Header/footer participate in layout, so no estimated overlay can cover the content.
 * Keyboard avoidance bounds the whole surface; long content and unusually large actions can scroll independently.
 */
export function ProductSheet({ title, label, closeLabel = 'Zatvori', backdropHint = SHEET_BACKDROP_HINT, reduced: callerReduced,
  onClose, children, footer, dirty = false, dismissible = true, closeButton = true }: ProductSheetProps) {
  const systemReduced = useSystemReducedMotion();
  const reduced = callerReduced ?? systemReduced;
  const insets = useContext(InsetsContext ?? fallbackInsets) ?? { top: 0, bottom: 0, left: 0, right: 0 };
  const closing = useRef(false);
  const [asking, setAsking] = useState(false);
  const state = useRef({ dirty, dismissible, asking, onClose });
  state.current = { dirty, dismissible, asking, onClose };
  const scale = useSharedValue(reduced ? 1 : sys.motion.dialog.from);
  const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  useEffect(() => {
    scale.value = reduced ? 1 : withTiming(1, { duration: sys.motion.dialog.enter, easing: Easing.bezier(...sys.motion.easeOut) });
    return () => cancelAnimation(scale);
  }, [reduced, scale]);
  useEffect(() => { if (!dirty) setAsking(false); }, [dirty]);
  const dismiss = useCallback(() => {
    if (closing.current) return;
    closing.current = true;
    state.current.onClose();
  }, []);
  const requestClose = useCallback(() => {
    const now = state.current;
    if (!now.dismissible || closing.current) return;
    if (now.asking) { setAsking(false); return; }
    if (now.dirty) { setAsking(true); return; }
    dismiss();
  }, [dismiss]);
  const backdropSays = !dismissible ? null : asking ? 'Nastavlja uređivanje.' : dirty ? SHEET_BACKDROP_DIRTY_HINT : backdropHint;
  const pinned = asking ? <View style={s.discard} accessibilityLiveRegion="polite">
    <T accessibilityRole="alert" variant="heading">Odbaciti izmene?</T>
    <T variant="copy" tone="muted">Unete izmene neće biti sačuvane.</T>
    <Press accessibilityRole="button" accessibilityLabel="Odbaci izmene" testID="product-sheet-discard" haptic="medium"
      disabled={!dismissible} onPress={() => { if (state.current.dismissible) dismiss(); }} style={[s.command, s.danger]}>
      <T variant="action" style={s.onFilled}>Odbaci izmene</T></Press>
    <Press accessibilityRole="button" accessibilityLabel="Nastavi uređivanje" testID="product-sheet-keep" haptic="select"
      onPress={() => setAsking(false)} style={s.command}>
      <T variant="action" style={s.quiet}>Nastavi uređivanje</T></Press>
  </View> : footer ? footer(dismiss) : null;
  return <Modal visible transparent animationType={reduced ? 'none' : 'fade'} statusBarTranslucent onRequestClose={requestClose}>
    <GestureHandlerRootView style={s.root}>
      <Pressable testID="product-sheet-backdrop" style={[StyleSheet.absoluteFill, s.dim]} onPress={requestClose}
        accessible={backdropSays !== null} accessibilityRole="button" accessibilityLabel={closeLabel}
        accessibilityHint={backdropSays ?? closeLabel} disabled={!dismissible} />
      <KeyboardAvoidingView testID="product-modal-viewport" pointerEvents="box-none" behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={[s.viewport, { paddingTop: insets.top + sys.space.base, paddingBottom: insets.bottom + sys.space.base,
          paddingLeft: insets.left + sys.space.base, paddingRight: insets.right + sys.space.base }]}>
        <Animated.View testID="product-modal-card" accessibilityViewIsModal accessibilityLabel={title ?? label}
          style={[s.card, animated]}>
          {title || closeButton ? <View testID="product-sheet-heading" style={s.heading}>
            {title ? <T accessibilityRole="header" variant="title" style={s.title}>{title}</T>
              : <View style={s.closeSpacer} />}
            {closeButton ? <Press testID="product-sheet-close" accessibilityRole="button" accessibilityLabel={closeLabel}
              accessibilityState={{ disabled: !dismissible }} disabled={!dismissible} onPress={requestClose} haptic="none" style={s.close}>
              <Glyph name="close" size={24} /></Press> : null}
          </View> : null}
          <ScrollView testID="product-sheet-content" style={s.body} contentContainerStyle={s.content}
            keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" persistentScrollbar>
            <View style={s.stack} accessibilityElementsHidden={asking} importantForAccessibility={asking ? 'no-hide-descendants' : 'auto'}
              pointerEvents={asking ? 'none' : 'auto'}>{children(dismiss)}</View>
          </ScrollView>
          {pinned ? <ScrollView testID="product-sheet-actions-scroll" style={s.actionsScroll} keyboardShouldPersistTaps="handled"
            contentContainerStyle={s.footer} bounces={false}>
            <View testID="product-sheet-footer" style={s.stack}>{pinned}</View>
          </ScrollView> : null}
        </Animated.View>
      </KeyboardAvoidingView>
    </GestureHandlerRootView>
  </Modal>;
}
const s = StyleSheet.create({
  root: { flex: 1 },
  dim: { backgroundColor: sys.color.dim },
  viewport: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  card: { width: '100%', maxWidth: 520, maxHeight: '100%', flexShrink: 1, borderRadius: sys.radius.sheet,
    backgroundColor: sys.color.surface, overflow: 'hidden', ...sheetLift.detached },
  heading: { flexDirection: 'row', alignItems: 'center', gap: sys.space.md, padding: sys.space.base, paddingBottom: sys.space.sm },
  title: { flex: 1, minWidth: 0, color: sys.color.ink },
  closeSpacer: { flex: 1 },
  close: { width: SHEET_TOUCH, height: SHEET_TOUCH, alignItems: 'center', justifyContent: 'center', borderRadius: sys.radius.pill, backgroundColor: sys.color.wash },
  body: { flexGrow: 0, flexShrink: 1 },
  content: { padding: sys.space.base, paddingTop: sys.space.md },
  stack: { gap: sys.space.md },
  actionsScroll: { flexGrow: 0, flexShrink: 0, maxHeight: '48%', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: sys.color.lineStrong },
  footer: { padding: sys.space.base },
  discard: { gap: sys.space.sm },
  command: { minHeight: SHEET_TOUCH, borderRadius: sys.radius.primary, paddingHorizontal: sys.space.base, paddingVertical: sys.space.sm,
    flexDirection: 'row', gap: sys.space.sm, alignItems: 'center', justifyContent: 'center' },
  danger: { ...brandAction, backgroundColor: sys.color.danger },
  onFilled: { color: sys.color.onGreen, textAlign: 'center' }, quiet: { color: sys.color.green, textAlign: 'center' },
});
