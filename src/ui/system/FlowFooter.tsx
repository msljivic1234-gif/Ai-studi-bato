import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { T } from '../Text';
import { layout, ruleWidth } from './layout';
import { sys } from './tokens';

/**
 * The pinned foot of a flow step (round 6, Izmene scenes 11 and 12: step 1's only action was below the fold of a long
 * form and step 2's sat at the top of an empty screen). It holds the step's one action on the surface under a line,
 * and belongs BELOW the ScrollView and INSIDE the KeyboardAvoidingView, so the action stays on screen however long the
 * form is and rises with the keyboard. Its measure is the one every foot has now (UI/UX pass 2026-10-08; six screens drew their
 * own, 12/8, 12/14, 12/12, 20/20 over the sides 24): the screen's edge across (`layout.gutter`, 20), 12 over and 12 under, 8
 * between two lines, and the system's bottom edge under that; the line above it is the one full line a screen draws.
 *
 * ONE green action and at most one quiet one: they are the `children`, one under the other. When the green action cannot be
 * pressed yet, the foot says why in a line ABOVE it (`reason`, the `note` type in grey): a grey button always says why, and a
 * line under the button was the old way, where it read as the next thing and not as the cause. The line is announced politely when
 * it appears or changes, so a person using a screen reader hears that the step became possible or what is still missing.
 *
 * Safe area: a screen whose SafeAreaView already covers the bottom edge (every flow screen, edges top and bottom; and `Screen`)
 * leaves `edge` out and the foot draws nothing extra. A screen whose frame stops short of the bottom passes
 * `edge="bottom"`, and the foot keeps clear of the home indicator itself, its surface reaching the edge of the screen.
 */
export function FlowFooter({ children, edge, reason, testID = 'flow-footer' }: {
  children: ReactNode; edge?: 'bottom';
  /** Why the green action cannot be pressed yet, in the caller's words, in a quiet line above the actions. Leave it out when nothing is missing. */
  reason?: string;
  testID?: string;
}) {
  const content = <>
    {reason ? <T variant="note" tone="muted" testID={`${testID}-reason`} accessibilityLiveRegion="polite">{reason}</T> : null}
    {children}
  </>;
  if (edge === 'bottom') return <SafeAreaView edges={['bottom']} testID={testID} style={s.footer}>{content}</SafeAreaView>;
  return <View testID={testID} style={s.footer}>{content}</View>;
}

const s = StyleSheet.create({
  footer: { paddingHorizontal: layout.gutter, paddingTop: sys.space.md, paddingBottom: sys.space.md, gap: sys.space.sm,
    backgroundColor: sys.color.surface, borderTopWidth: ruleWidth, borderTopColor: sys.color.line },
});
