import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Press } from '../Press';
import { T } from '../Text';
import { ProductSheet } from '../product/ProductSheet';
import { Glyph } from './Glyph';
import { layout } from './layout';
import { sys } from './tokens';

/** How far the 20 dp mark reaches on each side, so the touch is the 48 dp a control needs. */
const REACH = (layout.touch - 20) / 2;

/**
 * "ⓘ": the explanation one tap away instead of on the screen. The owner, after the phone build of 8 Oct 2026: too much text,
 * screens that explain themselves; the analysis rule J5 keeps at most one sentence on a screen. The screen keeps the fact
 * ("Tačna adresa: samo u Dogovoru"); why it is so, who sees what, what a word means, open here in a sheet: a title and a
 * few short lines, nothing to decide. A sheet that asks for a choice is a `ConfirmSheet`, a list of commands an `ActionSheet`.
 */
export function InfoButton({ title, lines, label, testID }: {
  /** The question the sheet answers, as its heading: "Ko vidi adresu", "Šta znači „Mogu odmah“". */
  title: string;
  /** The answer, one short sentence per line; three or four at most. */
  lines: readonly string[];
  /** What a screen reader calls the button when "Objašnjenje: <title>" would not say it. */
  label?: string;
  testID?: string;
}) {
  const [open, setOpen] = useState(false);
  return <>
    <Press testID={testID} accessibilityRole="button" accessibilityLabel={label ?? `Objašnjenje: ${title}`} haptic="select"
      hitSlop={REACH} onPress={() => setOpen(true)} style={s.button}>
      <Glyph name="info" size={20} tone="muted" />
    </Press>
    {open ? <ProductSheet title={title} onClose={() => setOpen(false)}>
      {() => <View style={s.body}>{lines.map((line, at) => <T key={at} variant="body">{line}</T>)}</View>}
    </ProductSheet> : null}
  </>;
}

const s = StyleSheet.create({
  button: { alignItems: 'center', justifyContent: 'center' },
  body: { gap: sys.space.md, paddingBottom: sys.space.base },
});
