import { StyleSheet, Switch, View } from 'react-native';
import { Press } from '../Press';
import { T } from '../Text';
import { layout, ruleWidth } from '../system/layout';
import { sys } from '../system/tokens';

/** Said under a choice whose categories differ (the details are in "Napredno"); a state, not an explanation. */
export const MIXED_WORDS = 'Delimično uključeno. Pojedinosti su u Naprednom.';

/**
 * One switch of the notification settings: the same row as `SettingsSwitchRow` (the whole row is the switch, one focus stop, a green track
 * and a white thumb, the hairline under it), with the one thing that row cannot do: speak a name other than the one it draws. The settings
 * hold the same words twice, "Prijave i poruke" under "Kad objavljuješ" and under "Kad uskačeš" (one screen for both sets, the approved
 * blueprint of 8 Oct 2026, P4), and a screen reader that hears "Prijave i poruke" twice cannot tell which is which.
 *
 * It goes away when `SettingsSwitchRow` takes a spoken name of its own (the proposal is in the round's report: `src/ui/settings` is not
 * this screen's to change). `mixed` is the state of a choice whose categories differ: it reads as off and says why in words.
 */
export function NoticeSwitchRow({ label, spoken, value, mixed = false, disabled = false, onChange, last = false }: {
  label: string; spoken?: string; value: boolean; mixed?: boolean; disabled?: boolean; onChange: (value: boolean) => void; last?: boolean;
}) {
  return <Press accessibilityRole="switch" accessibilityLabel={spoken ?? label} accessibilityHint={mixed ? MIXED_WORDS : undefined}
    accessibilityState={{ checked: value, disabled }} disabled={disabled} haptic={disabled ? 'none' : 'select'} scaleTo={sys.motion.scale.none}
    onPress={() => onChange(!value)} style={s.row}>
    <View style={s.heading}>
      <T variant="bodyStrong" tone={disabled ? 'muted' : 'ink'} style={s.label}>{label}</T>
      <View style={s.control} pointerEvents="none" importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
        <Switch value={value} disabled={disabled}
          trackColor={{ false: sys.color.lineStrong, true: sys.color.green }} thumbColor={sys.color.surface}
          ios_backgroundColor={sys.color.lineStrong} />
      </View>
    </View>
    {mixed ? <T variant="note" tone="muted">{MIXED_WORDS}</T> : null}
    {last ? null : <View pointerEvents="none" style={s.rule} />}
  </Press>;
}

const s = StyleSheet.create({
  row: { minHeight: layout.rowMinPlain, paddingVertical: sys.space.md, flexDirection: 'column', alignItems: 'stretch', gap: sys.space.xs },
  heading: { flexDirection: 'row', alignItems: 'center', gap: sys.space.md },
  label: { flex: 1, minWidth: 0 },
  control: { flexShrink: 0 },
  rule: { position: 'absolute', left: 0, right: 0, bottom: 0, height: ruleWidth, backgroundColor: sys.color.line },
});
