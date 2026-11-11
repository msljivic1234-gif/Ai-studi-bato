import type { ReactNode } from 'react';
import { StyleSheet, View, type AccessibilityActionEvent, type AccessibilityActionInfo } from 'react-native';
import { Press } from '../Press';
import { T } from '../Text';
import { layout, ruleWidth } from '../system/layout';
import { raisedItem, sys } from '../system/tokens';

/**
 * The row of a list of things that HAPPENED (UI/UX pass, 2026-10-08, the owner's phone: Obaveštenja and Poruke): a picture or a face in
 * its slot, the thing's name with the time at the end of the same line, and the lines under it. The system's `ListRow` has no place for
 * a time and never cuts a line, which is right for a settings list and wrong for a list of events, where the time is what a person scans
 * for and a long preview must not make the row three times as tall as the one above it. When the system's row learns a time and the number
 * of lines it may take, this file goes and the two lists take that one (the same arrangement as `ListSkeleton`).
 *
 * 64 dp high at the least, 12 above and below, the slot and the words 12 apart. A plain row keeps the system's inset 1 dp divider;
 * notification cards opt into a raised white material and omit that divider. The name takes the room the time leaves; the time never wraps
 * and never gives way. The whole row is the one press, and a row that cannot be pressed now goes grey. It draws no arrow: the time is
 * what stands at its end, and every row of these two lists is opened by a touch anyway.
 *
 * `time` is the word at the end of the name's line ("18:42", "Juče"); a caller that has no room for it at a large text size leaves it out
 * and says it in a line of its own. What a screen reader hears is the caller's `accessibilityLabel`, always the whole of the row.
 */
export function TimedRow({ leading, slot, title, titleLines = 1, strong = true, time, last = false, card = false, disabled = false, interactionDisabled = false, onPress,
  accessibilityLabel, accessibilityHint, accessibilityActions, onAccessibilityAction, testID, children }: {
  /** Whatever stands in the slot (a picture, a face): the row gives it `slot` wide and as high as the words. */
  leading: ReactNode;
  /** The width of the slot, and with it where the words begin. */
  slot: number;
  title: string;
  /** How many lines the name may take: one for a person, two where a title is a sentence. */
  titleLines?: number;
  /** The weight of the name: a thing that waits for you is strong, one you have seen is not. */
  strong?: boolean;
  time?: string | null;
  last?: boolean;
  /** Raised notification card. Other consumers keep their compact list-row presentation. */
  card?: boolean;
  disabled?: boolean;
  /** A temporary navigation/read gate blocks interaction without fading authoritative content. */
  interactionDisabled?: boolean;
  onPress: () => void;
  accessibilityLabel: string;
  accessibilityHint?: string;
  /** The commands a screen reader is offered in the row's menu (the swipe is never the only way). */
  accessibilityActions?: readonly AccessibilityActionInfo[];
  onAccessibilityAction?: (event: AccessibilityActionEvent) => void;
  testID?: string;
  /** The lines under the name. */
  children?: ReactNode;
}) {
  const blocked = disabled || interactionDisabled;
  return <Press testID={testID} accessibilityRole="button" accessibilityLabel={accessibilityLabel} accessibilityHint={accessibilityHint}
    accessibilityState={{ disabled: blocked }} accessibilityActions={accessibilityActions} onAccessibilityAction={onAccessibilityAction}
    disabled={blocked} haptic={blocked ? 'none' : 'select'} scaleTo={sys.motion.scale.row} onPress={onPress} style={[s.row, card && s.card]}>
    <View style={[s.slot, { width: slot }]}>{leading}</View>
    <View style={s.copy}>
      <View style={s.line}>
        <T variant={strong ? 'bodyStrong' : 'body'} tone={disabled ? 'muted' : 'ink'} numberOfLines={titleLines} style={[s.grow, card && s.cardTitle]}>{title}</T>
        {time ? <T variant="meta" tone="muted" style={s.time}>{time}</T> : null}
      </View>
      {children}
    </View>
    {last || card ? null : <View pointerEvents="none" style={[s.rule, { left: slot + sys.space.md }]} />}
  </Press>;
}

const s = StyleSheet.create({
  row: { minHeight: layout.rowMin, flexDirection: 'row', alignItems: 'center', gap: sys.space.md, paddingVertical: sys.space.md },
  card: { ...raisedItem, borderRadius: sys.radius.card, paddingHorizontal: sys.space.base, paddingVertical: sys.space.base, marginBottom: sys.space.lg },
  cardTitle: { fontSize: sys.type.heading.fontSize, lineHeight: sys.type.heading.lineHeight },
  slot: { alignItems: 'center', justifyContent: 'center' },
  copy: { flex: 1, minWidth: 0 },
  // The time stands on the baseline of the first line of the name, even when the name takes two.
  line: { flexDirection: 'row', alignItems: 'baseline', gap: sys.space.sm },
  grow: { flex: 1, minWidth: 0 },
  time: { flexShrink: 0, fontVariant: ['tabular-nums'] },
  rule: { position: 'absolute', right: 0, bottom: 0, height: ruleWidth, backgroundColor: sys.color.line },
});
