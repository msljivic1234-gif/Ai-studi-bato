import { createContext, useCallback, useContext, useEffect, useRef, useState, type Context, type ReactNode, type RefObject } from 'react';
import { Keyboard, KeyboardAvoidingView, Modal, Platform, StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, { cancelAnimation, Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import * as SafeArea from 'react-native-safe-area-context';
import { T } from '../../Text';
import { ChromeIconButton } from '../../system/ScreenChrome';
import { sheetLift, sys } from '../../system/tokens';
import { SearchBackdrop, type BackdropKind } from './SearchBackdrop';

export const SHEET_RATIO = 0.85;
type Insets = { top: number; bottom: number };
const InsetsContext = (SafeArea as { SafeAreaInsetsContext?: Context<Insets | null> }).SafeAreaInsetsContext;
const fallbackInsets = createContext<Insets | null>(null);
const easeOut = Easing.bezier(...sys.motion.easeOut);

/** Search remains a full screen. Filters are centred in the usable window.
 * The owner controls the draft, commit and dismissal; this frame only owns presentation.
 * Acknowledging close is single-shot and cannot depend on a successful animation callback.
 */
export function SearchSheet({ reduced, backdrop, blurTarget, closing, title, closeLabel, closeHint, footer, ratio = SHEET_RATIO, screen = false, header,
  onCloseButton, onRequestClose, onClosed, onShown, children }: {
  reduced: boolean; backdrop: BackdropKind; blurTarget?: RefObject<View | null>; closing: boolean;
  title: string; closeLabel: string; closeHint: string; footer: ReactNode; ratio?: number; screen?: boolean; header?: ReactNode;
  onCloseButton: () => void; onRequestClose: () => void; onClosed: () => void; onShown?: () => void; children: ReactNode;
}) {
  const { height: windowHeight } = useWindowDimensions();
  const { top, bottom } = useContext(InsetsContext ?? fallbackInsets) ?? { top: 0, bottom: 0 };
  const [measured, setMeasured] = useState(0);
  const [keyboard, setKeyboard] = useState(false);
  const room = measured > 0 ? measured : windowHeight;
  const height = screen ? room : Math.max(0, Math.min(Math.round(room * ratio), room - top - bottom - 2 * sys.space.base));
  const fade = useSharedValue(reduced ? 1 : 0);
  const scale = useSharedValue(reduced || screen ? 1 : sys.motion.dialog.from);
  const motion = useAnimatedStyle(() => ({ opacity: fade.value, transform: [{ scale: scale.value }] }));
  const latest = useRef(onClosed); latest.current = onClosed;
  const closed = useRef(false);
  const finish = useCallback(() => { if (!closed.current) { closed.current = true; latest.current(); } }, []);
  useEffect(() => {
    const show = Keyboard.addListener?.(Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', () => setKeyboard(true));
    const hide = Keyboard.addListener?.(Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide', () => setKeyboard(false));
    return () => { show?.remove(); hide?.remove(); };
  }, []);
  useEffect(() => {
    if (closing) return;
    if (reduced) { scale.value = 1; fade.value = 1; return; }
    scale.value = withTiming(1, { duration: sys.motion.dialog.enter, easing: easeOut });
    fade.value = withTiming(1, { duration: sys.motion.dialog.enter, easing: easeOut });
    return () => { cancelAnimation(scale); cancelAnimation(fade); };
  }, [closing, reduced, scale, fade]);
  useEffect(() => {
    if (!closing) return;
    if (reduced) { finish(); return; }
    scale.value = withTiming(screen ? 1 : sys.motion.dialog.from, { duration: sys.motion.dialog.exit, easing: easeOut });
    fade.value = withTiming(0, { duration: sys.motion.dialog.exit, easing: easeOut }, completed => {
      if (completed) scheduleOnRN(finish);
    });
    const guard = setTimeout(finish, sys.motion.dialog.exit + 250);
    return () => { cancelAnimation(scale); cancelAnimation(fade); clearTimeout(guard); };
  }, [closing, reduced, screen, scale, fade, finish]);

  return <Modal visible transparent hardwareAccelerated animationType="none" statusBarTranslucent onShow={onShown} onRequestClose={onRequestClose}>
    <View testID="search-root" style={s.root} onLayout={event => {
      const next = Math.round(event.nativeEvent.layout.height); if (next > 0) setMeasured(next);
    }}>
      {screen ? null : <SearchBackdrop kind={backdrop} blurTarget={blurTarget} fade={fade} onPress={onCloseButton} />}
      <KeyboardAvoidingView testID="search-dialog-viewport" behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={[s.avoider, !screen && { paddingTop: top + sys.space.base, paddingBottom: bottom + sys.space.base, paddingHorizontal: sys.space.base }]}
        pointerEvents={closing ? 'none' : 'box-none'}>
        <Animated.View testID="search-sheet-motion" style={[s.motion, screen && s.full, motion]}>
          <View testID="search-sheet" accessibilityViewIsModal accessibilityLabel={title}
            style={[s.sheet, { height, borderRadius: screen ? 0 : sys.radius.sheet }]}>
            {header ? <View testID="search-header" style={{ paddingTop: screen ? top : 0 }}>{header}</View> : <View style={[s.top, screen && { paddingTop: top + sys.space.sm }]}>
              <T variant="heading" accessibilityRole="header" style={s.title}>{title}</T>
              <ChromeIconButton glyph="close" label={closeLabel} hint={closeHint} quiet onPress={onCloseButton} />
            </View>}
            {children}
            <View testID="search-footer-slot" style={[s.footer, { paddingBottom: screen && !keyboard ? bottom : 0 }]}>{footer}</View>
          </View>
        </Animated.View>
      </KeyboardAvoidingView>
    </View>
  </Modal>;
}
const s = StyleSheet.create({
  root: { flex: 1 },
  avoider: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  motion: { width: '100%', maxWidth: 520, flexShrink: 1, maxHeight: '100%' },
  full: { maxWidth: '100%' },
  sheet: { flexShrink: 1, maxHeight: '100%', overflow: 'hidden', backgroundColor: sys.color.surface, ...sheetLift.docked },
  footer: { flexShrink: 0, backgroundColor: sys.color.surface },
  top: { flexDirection: 'row', alignItems: 'center', gap: sys.space.md, paddingLeft: sys.space.lg, paddingRight: sys.space.base,
    paddingTop: sys.space.sm, paddingBottom: sys.space.xs },
  title: { flex: 1, minWidth: 0, color: sys.color.ink },
});
