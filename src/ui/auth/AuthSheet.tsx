import type { ReactNode } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LARGE_TEXT_SCALE, roundTextScale } from '../system/textScale';
import { sys } from '../system/tokens';
import { useKeyboardOpen } from './useKeyboardOpen';

/** Auth keeps a readable column on a wide display. */
export const AUTH_SHEET_MAX_WIDTH = 520;

/**
 * Forms use a full screen; shorter steps sit in the centre, matching other
 * non-map dialogs. Keyboard, large text and a short window use the full height.
 * AuthScreen owns keyboard avoidance, commands, recovery and Back; AuthFooter
 * owns the bottom safe area. Changing presentation never resets the form.
 */
export function AuthSheet({ visible, expanded, backdrop, children }: {
  visible: boolean; expanded: boolean; backdrop: ReactNode; children: ReactNode;
}) {
  const { height, fontScale } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const keyboard = useKeyboardOpen();
  const tall = keyboard || expanded || roundTextScale(fontScale) >= LARGE_TEXT_SCALE || height < 700;
  return <View style={s.root}>
    <View style={StyleSheet.absoluteFill} pointerEvents={visible ? 'none' : 'auto'}
      accessibilityElementsHidden={visible} importantForAccessibility={visible ? 'no-hide-descendants' : 'auto'}>
      {backdrop}
    </View>
    {visible ? <View testID="auth-dialog-viewport" style={[s.overlay, {
      paddingTop: (insets.top ?? 0) + (tall ? 0 : sys.space.base),
      paddingLeft: (insets.left ?? 0) + (tall ? 0 : sys.space.base),
      paddingRight: (insets.right ?? 0) + (tall ? 0 : sys.space.base),
      paddingBottom: tall ? 0 : sys.space.base,
    }, tall && s.fullscreen]} accessibilityViewIsModal>
      <View testID="auth-reference-sheet" style={[s.sheet, { maxHeight: tall ? '100%' : '76%' }, tall && s.fullscreenCard]}>
        {children}
      </View>
    </View> : null}
  </View>;
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: sys.color.surface },
  overlay: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: sys.color.scrim, justifyContent: 'center' },
  fullscreen: { backgroundColor: sys.color.surface },
  sheet: { flex: 1, width: '100%', maxWidth: AUTH_SHEET_MAX_WIDTH, alignSelf: 'center', overflow: 'hidden',
    borderRadius: sys.radius.sheet, borderWidth: 1,
    borderColor: sys.color.lineStrong, backgroundColor: sys.color.surface },
  fullscreenCard: { borderRadius: 0, borderWidth: 0 },
});
