import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { Press } from '../Press';
import { T } from '../Text';
import { layout } from './layout';
import { useLayoutClass } from './textScale';
import { sys } from './tokens';

/** The one command a section's title carries: a word at the end of its line ("Ceo raspored", "Uredi mesto"). */
export type SectionAction = { label: string; onPress: () => void; accessibilityLabel?: string; testID?: string };

export type SectionProps = {
  /** The section's name, in the `heading` type, in ink, spoken as a heading. */
  title?: string;
  /** At the end of the title's line, in green: 15/600, and a 48 dp touch. */
  action?: SectionAction;
  children: ReactNode;
  testID?: string;
};

/**
 * A part of a screen with a name (composition spec 2026-10-07, N2). Eight screens drew their own section title (`copy` 600,
 * `meta` 700, `heading`, `bodyStrong`) and their own gap under it; this is the one. The title is the `heading` type in ink,
 * 12 dp above what the section holds (`layout.group`), and that is all: no line, no box and no margin of its own. The space
 * between one section and the next (24) is the screen's, so a section can stand in any `Screen` without being told where it is.
 *
 * The action sits at the end of the title's line, and the line is then a 48 dp touch, not 24: the title stays where it
 * would have been without an action (the section pulls up 12 into the screen's 24 dp gap, which holds the first half of the
 * touch), so a screen with a "Ceo raspored" beside one title and none beside the next keeps one rhythm. At a large text
 * size (`useLayoutClass().stacked`) the action goes under the title instead of crushing it, and nothing is pulled up.
 *
 * Wrap two or more cards in a `View` with `gap: layout.group`; rows (`ListRow`, `KeyValueRow`) draw their own dividers and
 * stand one on the other.
 */
export function Section({ title, action, children, testID }: SectionProps) {
  const { stacked } = useLayoutClass();
  const touch = action !== undefined;
  const head = title || touch ? <View style={[s.head, stacked && s.headStacked, touch ? s.headTouch : s.headPlain, !title && s.headBare]}>
    {title ? <T variant="heading" accessibilityRole="header" style={s.title}>{title}</T> : null}
    {action ? <Press testID={action.testID} accessibilityRole="button" accessibilityLabel={action.accessibilityLabel ?? action.label}
      onPress={action.onPress} haptic="select" scaleTo={sys.motion.scale.button} style={[s.action, stacked && s.actionStacked]}>
      <T variant="copy" tone="green" style={s.actionText}>{action.label}</T>
    </Press> : null}
  </View> : null;
  return <View testID={testID} style={touch && !stacked ? s.pulled : undefined}>
    {head}
    {children}
  </View>;
}

const s = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: layout.group },
  headStacked: { flexDirection: 'column', alignItems: 'flex-start', justifyContent: 'flex-start', gap: 0 },
  // Without an action the title is 24 high and 12 from what it holds. With one the line is the 48 dp touch, and the title,
  // centred in it, already has its 12 below.
  headPlain: { marginBottom: layout.group },
  headTouch: { minHeight: layout.touch },
  headBare: { justifyContent: 'flex-end' },
  // The first 12 dp of the touch lie in the screen's gap above the section, so the title keeps its place.
  pulled: { marginTop: -sys.space.md },
  title: { flexShrink: 1, color: sys.color.ink },
  action: { minWidth: layout.touch, minHeight: layout.touch, justifyContent: 'center', alignItems: 'flex-end', paddingLeft: sys.space.md },
  actionStacked: { alignItems: 'flex-start', paddingLeft: 0 },
  actionText: { fontWeight: '600' },
});
