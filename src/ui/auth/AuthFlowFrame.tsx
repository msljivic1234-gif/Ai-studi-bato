import type { ReactNode, RefObject } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FlowFooter } from '../system/FlowFooter';
import { layout } from '../system/layout';
import { ScreenChrome } from '../system/ScreenChrome';
import { sys } from '../system/tokens';
import { AUTH_SHEET_MAX_WIDTH } from './AuthSheet';
import { FocusRevealContext, useFocusReveal, type RevealScroll } from './keyboardReveal';
import { useKeyboardOpen } from './useKeyboardOpen';

/** The column the form stands in on a wide window: the sheet's width less its two edges. */
const COLUMN_MAX_WIDTH = AUTH_SHEET_MAX_WIDTH - 2 * layout.gutter;

/**
 * The frame of every step of the sign-in sheet and of the password-recovery screen (flow template T4, composition spec
 * 2026-10-07): the system's own top bar with the ONE arrow back, a scroll area that holds the step, and under it the system's
 * `FlowFooter` with the step's ONE green command. The foot is OUTSIDE the scroll area, so it never scrolls away, and it is
 * inside the column that the keyboard shrinks, so it rises with the keyboard; what the keyboard would otherwise hide,
 * `useFocusReveal` scrolls into view.
 *
 * The edge is `layout.gutter` (20; it was 22), the first thing is `sys.space.sm` under the bar, the blocks of a step stand
 * `layout.section` (24) apart, the end of the scroll is `layout.zone` (32) under the last thing, and the foot keeps clear of
 * the system's bottom unless the keyboard is covering it. `title` names the flow in the bar when the screen is a screen of its
 * own (the recovery link's); the sheet's steps carry their title in the content and leave the bar to the arrow.
 */
export function AuthFlowFrame({ onBack, backDisabled = false, title, scrollRef, scrollKey, footer, footerReason, children }: {
  onBack: () => void; backDisabled?: boolean;
  title?: string;
  /** The caller may wind the scroll back to its top when it changes what the step shows. */
  scrollRef: RefObject<ScrollView | null>;
  /** A step that changes it gets a fresh scroll position. */
  scrollKey: string;
  /** The step's one green command (and what stands with it); no foot when there is nothing to do. */
  footer?: ReactNode;
  /** Why the foot's green command cannot be pressed, in a quiet line ABOVE it (the system foot's own `reason`). Leave it out when nothing is missing. */
  footerReason?: string;
  children: ReactNode;
}) {
  const reveal = useFocusReveal(scrollRef as unknown as RefObject<RevealScroll | null>);
  return <View style={s.frame}>
    <ScreenChrome variant="detail" title={title} onBack={onBack} disabled={backDisabled} />
    <View style={s.body}>
      <FocusRevealContext.Provider value={reveal.api}>
        <ScrollView ref={scrollRef} key={scrollKey} keyboardShouldPersistTaps="handled" onScroll={reveal.onScroll} onLayout={reveal.onLayout}
          scrollEventThrottle={16} contentContainerStyle={s.scroll}>
          <View style={s.column}>{children}</View>
        </ScrollView>
      </FocusRevealContext.Provider>
      {footer ? <AuthFooter reason={footerReason}>{footer}</AuthFooter> : null}
    </View>
  </View>;
}

/**
 * The system `FlowFooter` (the one foot of every flow: a hairline above it, the gutter across, `md` over and under, `sm`
 * between two lines) in the width of the form's column, with the system's bottom edge under it while no keyboard covers that
 * edge. Its one green command is the first thing in it; a quiet line (the legal sentence) stands under it.
 */
function AuthFooter({ children, reason }: { children: ReactNode; reason?: string }) {
  const insets = useSafeAreaInsets();
  const keyboard = useKeyboardOpen();
  return <View style={[s.footerFrame, { paddingBottom: keyboard ? 0 : insets.bottom }]}>
    <FlowFooter testID="auth-footer" reason={reason}><View style={s.footerColumn}>{children}</View></FlowFooter>
  </View>;
}

const s = StyleSheet.create({
  frame: { flex: 1 },
  body: { flex: 1, minHeight: 0 },
  scroll: { flexGrow: 1, alignItems: 'center', paddingHorizontal: layout.gutter, paddingTop: sys.space.sm, paddingBottom: layout.zone },
  column: { width: '100%', maxWidth: COLUMN_MAX_WIDTH, gap: layout.section },
  footerFrame: { backgroundColor: sys.color.surface },
  footerColumn: { width: '100%', maxWidth: COLUMN_MAX_WIDTH, alignSelf: 'center', gap: sys.space.sm },
});
