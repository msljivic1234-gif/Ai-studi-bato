import { StyleSheet, View } from 'react-native';
import { Glyph } from '../system/Glyph';
import { Press } from '../Press';
import { T } from '../Text';
import { sys } from '../system/tokens';

/**
 * One fact chosen from its exact allowed values (the publish review's price mode, price basis and kind of time): pill
 * chips, one of which is chosen, a radio group to a screen reader. It replaces a text box where the person had to type a
 * word the parser knew ("Moja cena"). The chosen chip is a quiet neutral well with an ink edge, an ink tick and heavier
 * words, so shape and weight carry the state, never colour alone; green stays with the save action under it. A value
 * that is not among the options (a retired one) leaves every chip free until one is chosen.
 */
export function FactChoiceEditor({ label, options, value, disabled, onChange }: {
  label: string; options: readonly { value: string; label: string }[]; value: string | null; disabled: boolean;
  onChange: (value: string) => void;
}) {
  return <View accessibilityRole="radiogroup" accessibilityLabel={label} style={s.chips}>
    {options.map(option => {
      const checked = option.value === value;
      return <Press key={option.value} accessibilityRole="radio" accessibilityLabel={option.label}
        accessibilityState={{ checked, disabled }} aria-checked={checked} disabled={disabled}
        // The tick is the change, so a chip already chosen says nothing.
        haptic={checked ? 'none' : 'select'} scaleTo={sys.motion.scale.button}
        onPress={() => { if (!disabled && !checked) onChange(option.value); }}
        style={[s.chip, checked && s.chipOn, disabled && !checked && s.chipResting]}>
        {checked ? <Glyph name="check" size={16} /> : null}
        <T variant="copy" style={[s.chipText, checked && s.chipTextOn, disabled && !checked && s.chipTextResting]}>{option.label}</T>
      </Press>;
    })}
  </View>;
}

const s = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: sys.space.sm },
  // 48 dp high at any text size; long words wrap inside the capsule rather than run out of it.
  chip: { flexDirection: 'row', alignItems: 'center', gap: sys.space.xs, minHeight: 48, maxWidth: '100%',
    paddingHorizontal: sys.space.base, paddingVertical: sys.space.sm, borderRadius: sys.radius.pill,
    borderWidth: 1, borderColor: sys.color.lineStrong, backgroundColor: sys.color.surface },
  chipOn: { backgroundColor: sys.color.wash, borderColor: sys.color.ink },
  // Unavailable is the quiet wash with muted words, never a faded ghost of the live chip.
  chipResting: { backgroundColor: sys.color.wash, borderColor: sys.color.line },
  chipText: { fontWeight: '500', color: sys.color.ink, flexShrink: 1 },
  chipTextOn: { fontWeight: '600' },
  chipTextResting: { color: sys.color.muted },
});
