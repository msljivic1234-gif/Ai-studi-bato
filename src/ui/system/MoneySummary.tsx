import { StyleSheet, View } from 'react-native';
import { T } from '../Text';
import { FactArt } from './FactArt';
import { Surface } from './Surface';
import { useLayoutClass } from './textScale';
import { sys } from './tokens';

/** A reading surface for an existing amount. The caller must name its meaning:
 * budget, application offer or agreed price. This component never calculates money
 * or implies that payment happened. No fixed height or truncated monetary values. */
export function MoneySummary({ label, amount, basis }: { label: string; amount: string; basis?: string | null }) {
  const { stacked } = useLayoutClass();
  return <Surface kind="panel" variant="tinted" tone="brand" density="comfortable"
    accessibilityLabel={`${label}: ${amount}${basis ? `, ${basis}` : ''}`}>
    <View style={s.row}>
      <View style={s.copy}>
        <View style={s.labelRow}>
          <T variant="note" tone="muted" style={s.label}>{label}</T>
          {stacked ? <FactArt kind="money" size={32} /> : null}
        </View>
        <T variant="priceHero" style={s.amount}>{amount}</T>
        {basis ? <T variant="note" tone="muted">{basis}</T> : null}
      </View>
      {!stacked ? <FactArt kind="money" size={64} /> : null}
    </View>
  </Surface>;
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: sys.space.md },
  copy: { flex: 1, minWidth: 0, gap: sys.space.xs },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: sys.space.sm },
  label: { flex: 1, minWidth: 0 },
  amount: { color: sys.color.green },
});
