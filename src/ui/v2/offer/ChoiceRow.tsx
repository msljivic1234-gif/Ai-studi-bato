import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { Press } from '../../Press';
import { T } from '../../Text';
import { Glyph } from '../../system/Glyph';
import { layout } from '../../system/layout';
import { sys } from '../../system/tokens';

/**
 * One choice in a sheet, as a row you touch (UI/UX pass 2026-10-08): a circle for one of several (`radio`) or a square for yes or no
 * (`checkbox`), and the words. A choice that is not made is a plain row, and the one that is made is drawn as a field (a quiet well and
 * a green edge), so a group of three stands as three lines and one field, not as three boxes. The circle and the square are different
 * shapes on purpose: the row corner on a 22 dp box drew a circle, which reads as a radio, so the square has its own corner
 * (`sys.radius.check`).
 *
 * It is one stop for a screen reader, with its role and whether it is chosen. `hint` is the quiet line under the words (what the
 * choice means), and is part of what is heard.
 */
export function ChoiceRow({ kind, label, hint, checked, onPress, testID, children }: {
  kind: 'radio' | 'checkbox';
  label: string;
  /** A quiet line under the words, for what the choice means. */
  hint?: string;
  checked: boolean;
  onPress: () => void;
  testID?: string;
  /** Anything that belongs at the end of the row. */
  children?: ReactNode;
}) {
  const radio = kind === 'radio';
  return <Press testID={testID} accessibilityRole={radio ? 'radio' : 'checkbox'} accessibilityLabel={label} accessibilityHint={hint}
    accessibilityState={{ checked }} aria-checked={checked} haptic="select" onPress={onPress} style={[s.row, checked && s.rowChosen]}>
    <View style={[radio ? s.radio : s.check, checked && (radio ? s.radioChecked : s.checked)]}>
      {checked ? radio ? <View style={s.radioDot} /> : <Glyph name="check" size={16} tone="onGreen" /> : null}
    </View>
    <View style={s.copy}>
      <T variant={checked || hint ? 'bodyStrong' : 'body'}>{label}</T>
      {hint ? <T variant="note" tone="muted">{hint}</T> : null}
    </View>
    {children}
  </Press>;
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: sys.space.md, minHeight: layout.touch, paddingHorizontal: sys.space.base, paddingVertical: sys.space.sm,
    borderRadius: sys.radius.control, borderWidth: 1, borderColor: 'transparent', backgroundColor: sys.color.surface },
  rowChosen: { borderColor: sys.color.green, backgroundColor: sys.color.greenSoft },
  copy: { flex: 1, minWidth: 0 },
  radio: { width: 22, height: 22, borderRadius: sys.radius.pill, borderWidth: 1.5, borderColor: sys.color.lineStrong, alignItems: 'center', justifyContent: 'center', backgroundColor: sys.color.surface },
  radioChecked: { borderColor: sys.color.green }, radioDot: { width: 11, height: 11, borderRadius: sys.radius.pill, backgroundColor: sys.color.green },
  check: { width: 22, height: 22, borderRadius: sys.radius.check, borderWidth: 1.5, borderColor: sys.color.green, alignItems: 'center', justifyContent: 'center', backgroundColor: sys.color.surface },
  checked: { backgroundColor: sys.color.green },
});
