import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { Press } from '../Press';
import { T } from '../Text';
import { layout, ruleWidth } from './layout';
import { useLayoutClass } from './textScale';
import { sys } from './tokens';

export type KeyValueRowProps = {
  /** What the value is: the `meta` type, grey, at the start of the line. */
  label: string;
  /** The value: the `body` type at the end of the line. A node (a chip) is drawn as given. */
  value: string | ReactNode;
  /** `price`: the value is the one amount a screen is built around, in the `priceLarge` type. */
  emphasis?: 'price';
  /** "Izmeni": a word at the end of the row, 15/600 in green, a 48 dp touch. */
  action?: { label: string; onPress: () => void };
  /** The last row of a group: no divider under it. */
  last?: boolean;
  testID?: string;
};

/**
 * A label and its value, as a row (composition spec 2026-10-07, N5): the terms of a Dogovor, a line of the review, a figure of
 * the profile. The label is small and grey at the start, the value is the body type at the end; 12 dp above and below, and the
 * divider under it is 1 dp from the left edge (the label starts there) to the right, except under the last row of a group.
 *
 * At a large text size (`useLayoutClass().stacked`) the value goes UNDER the label and starts at the same edge, and the action
 * under the value, so nothing crushes anything and nothing is cut. So does a LONG value (a string of more than `LONG_VALUE`
 * characters: the scope of a task, a note about the access): a paragraph set against the right edge is ragged on the wrong side and
 * leaves the label a sliver of the width, so it reads under its label, from the left, like any text. A value that is a string is
 * read together with its label as one sentence; a node is left to be read as it is. The action is its own stop for a screen reader
 * and is named with the label it belongs to ("Izmeni, Termin"): a bare "Izmeni" would not say what is edited.
 */
/** A value of more than this many characters is a paragraph, not a figure: it reads under its label. */
export const LONG_VALUE = 40;

export function KeyValueRow({ label, value, emphasis, action, last = false, testID }: KeyValueRowProps) {
  const large = useLayoutClass().stacked;
  const text = typeof value === 'string';
  const stacked = large || (typeof value === 'string' && value.length > LONG_VALUE);
  const price = emphasis === 'price';
  return <View testID={testID} style={[s.row, stacked && s.rowStacked]}>
    <View accessible={text ? true : undefined} accessibilityRole={text ? 'text' : undefined} accessibilityLabel={text ? `${label}: ${value}` : undefined}
      style={stacked ? s.pairStacked : s.pair}>
      <T variant="meta" tone="muted" style={stacked ? undefined : s.label}>{label}</T>
      {text ? <T variant={price ? 'priceLarge' : 'body'} style={stacked ? undefined : s.value}>{value}</T>
        : <View style={stacked ? undefined : s.node}>{value}</View>}
    </View>
    {action ? <Press accessibilityRole="button" accessibilityLabel={`${action.label}, ${label}`} onPress={action.onPress} haptic="select"
      scaleTo={sys.motion.scale.button} style={stacked ? s.actionStacked : s.action}>
      <T variant="copy" tone="green" style={s.actionText}>{action.label}</T>
    </Press> : null}
    {last ? null : <View pointerEvents="none" style={s.rule} />}
  </View>;
}

const s = StyleSheet.create({
  // The row has no padding of its own: the pair carries the 12 above and below, so a 48 dp action fits the row exactly.
  row: { flexDirection: 'row', alignItems: 'center', gap: sys.space.md, minHeight: layout.touch },
  rowStacked: { flexDirection: 'column', alignItems: 'stretch', gap: 0 },
  pair: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: sys.space.md,
    paddingVertical: sys.space.md },
  pairStacked: { flexDirection: 'column', alignItems: 'flex-start', paddingVertical: sys.space.md },
  // The label's first line stands on the value's: 13/18 against 16/24 puts its baseline 4 dp higher without this.
  label: { flexShrink: 1, maxWidth: '45%', paddingTop: sys.space.xs },
  value: { flex: 1, minWidth: 0, textAlign: 'right' },
  // A row, so that a node that places itself (a chip is `alignSelf: 'flex-start'`) still ends at the right edge.
  node: { flex: 1, minWidth: 0, flexDirection: 'row', justifyContent: 'flex-end' },
  action: { minWidth: layout.touch, minHeight: layout.touch, justifyContent: 'center', alignItems: 'flex-end' },
  actionStacked: { minHeight: layout.touch, alignSelf: 'flex-start', justifyContent: 'center' },
  actionText: { fontWeight: '600' },
  rule: { position: 'absolute', left: 0, right: 0, bottom: 0, height: ruleWidth, backgroundColor: sys.color.line },
});
