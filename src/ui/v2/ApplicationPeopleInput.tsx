import { useState } from 'react';
import { AccessibilityInfo, StyleSheet, TextInput, View } from 'react-native';
import { T } from '../Text';
import { withInter } from '../interFont';
import { dolaziOsoba } from '../system/plural';
import { ChromeIconButton } from '../system/ScreenChrome';
import { useTextScale } from '../system/textScale';
import { sys } from '../system/tokens';

export function applicationPeopleCount(value: string): number | null {
  if (!/^[0-9]+$/.test(value)) return null;
  const count = Number(value);
  return Number.isSafeInteger(count) && count >= 1 ? count : null;
}

/** The same editable count in a new application and a changed one. Never clamp a typed draft silently. */
export function ApplicationPeopleInput({ value, maximum, disabled, onChange, label = 'Koliko ljudi dolazi', help }: {
  value: string; maximum: number; disabled: boolean; onChange: (value: string) => void; label?: string; help: string;
}) {
  const [focused, setFocused] = useState(false);
  const large = useTextScale() >= 1.3;
  const count = applicationPeopleCount(value);
  const error = maximum < 1 ? 'Sva mesta su popunjena. Osvežite zadatak.'
    : count === null ? `Unesite ceo broj od 1 do ${maximum}.`
    : count > maximum ? `Možete da prijavite najviše ${maximum}.` : null;
  const step = (next: number) => {
    onChange(String(next));
    AccessibilityInfo.announceForAccessibility(dolaziOsoba(next));
  };
  return <View style={s.group}>
    <View style={s.row}>
      <ChromeIconButton label="Jedna osoba manje" glyph="minus" disabled={disabled || count === null || count <= 1}
        onPress={() => { if (!disabled && count !== null && count > 1) step(count - 1); }} />
      <TextInput accessibilityLabel={label} accessibilityHint={error ?? 'Broj možete i direktno da upišete.'}
        keyboardType="number-pad" selectTextOnFocus maxLength={4} value={value} editable={!disabled}
        style={[s.input, large && s.large, focused && s.focused, !!error && s.invalid]}
        onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
        onChangeText={next => { if (!disabled) onChange(next); }} />
      <ChromeIconButton label="Jedna osoba više" glyph="plus" disabled={disabled || (count !== null ? count >= maximum : maximum < 1)}
        onPress={() => { const next = count === null ? 1 : count + 1; if (!disabled && next <= maximum) step(next); }} />
    </View>
    <T variant="note" tone={error ? 'danger' : 'muted'} accessibilityLiveRegion="polite">{error ?? help}</T>
  </View>;
}

const s = StyleSheet.create({
  group: { gap: sys.space.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: sys.space.xs, alignSelf: 'flex-start' },
  input: withInter({ ...sys.type.price, width: 80, minHeight: 56, textAlign: 'center', color: sys.color.ink,
    paddingHorizontal: sys.space.xs, borderWidth: 1, borderColor: sys.color.lineStrong, borderRadius: sys.radius.pill }),
  large: { width: 88 },
  focused: { borderColor: sys.color.green },
  invalid: { borderColor: sys.color.danger },
});
