import { StyleSheet, View } from 'react-native';
import type { PotrebaProjekcija } from '../../../contracts/projections';
import { T } from '../../Text';
import { Glyph } from '../../system/Glyph';
import { sys } from '../../system/tokens';

/** Chosen people, not applications. Capacity alone says nothing about whether
 * a closed task may accept applications again; that decision stays with its route. */
export function TaskCapacity({ capacity, note }: {
  capacity: PotrebaProjekcija['pokrivenost']; note?: string;
}) {
  const { popunjeno, ukupno } = capacity;
  const known = Number.isSafeInteger(popunjeno) && Number.isSafeInteger(ukupno)
    && ukupno > 0 && popunjeno >= 0 && popunjeno <= ukupno;
  return <View accessible accessibilityRole="text" style={s.row}
    accessibilityLabel={known ? `Izabrani izvršioci: ${popunjeno} od ${ukupno}${note ? `. ${note}` : ''}` : 'Popunjenost nije dostupna'}>
    <Glyph name="people" size={20} tone="green" />
    <View style={s.copy}>
      <T variant="bodyStrong" style={s.value}>{known ? `${popunjeno}/${ukupno} izabrano` : 'Popunjenost nije dostupna'}</T>
      {known && note ? <T variant="note" tone="muted">{note}</T> : null}
    </View>
  </View>;
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: sys.space.sm },
  copy: { flex: 1, minWidth: 0, gap: sys.space.xs },
  value: { color: sys.color.green },
});
