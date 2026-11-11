import { StyleSheet, View } from 'react-native';
import { Press } from '../Press';
import { T } from '../Text';
import { FactArt } from '../system/FactArt';
import { sys } from '../system/tokens';
import type { ConfirmedPlaceEntry } from './placeText';

/**
 * A confirmed place as ONE line of the conversation (owner, phone test 2026-10-07: "To ostane u četu i ide gore sa drugim
 * porukama"). It replaces the block that stayed docked above the composer ("Mesto je potvrđeno", the provider's whole label,
 * "Mapa", "Izmeni"): street and number in bold, then the place, and one tap reopens the map. The whole label stays in the
 * spoken name. Nothing here saves or moves a point, and nothing animates.
 */
export function ConfirmedPlaceLine({ entries, onEdit, announce = false, testID = 'confirmed-place-line' }: {
  entries: readonly ConfirmedPlaceEntry[];
  /** Left out while the place cannot be changed now (a send in flight, a saved conversation, the map already open). */
  onEdit?: () => void;
  /** Say it once to a screen reader: the point was saved just now. */
  announce?: boolean;
  testID?: string;
}) {
  if (!entries.length) return null;
  const spoken = entries.map(entry => entry.spoken).join('. ');
  const body = <>
    <View accessible={false} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden style={s.art}>
      <FactArt kind="pin" size={20} cut="art" role="location" />
    </View>
    <View style={s.copy}>
      {entries.map(entry => <T key={entry.slot} variant="note" tone="muted">
        {entry.ack ? `U redu, ${entry.noun} je sada: ` : `${entry.lead}: `}
        <T variant="note" tone={entry.exact ? 'ink' : 'muted'} style={entry.exact ? s.main : undefined}>{entry.main}</T>
        {entry.locality ? `, ${entry.locality}` : ''}{entry.ack ? '.' : ''}
      </T>)}
    </View>
    {onEdit ? <T variant="note" style={s.edit}>Izmeni</T> : null}
  </>;
  return onEdit
    ? <Press testID={testID} accessibilityRole="button" accessibilityLabel={spoken} accessibilityHint="Otvara mapu da promeniš mesto."
      accessibilityLiveRegion={announce ? 'polite' : undefined} haptic="select" onPress={onEdit} style={s.line}>{body}</Press>
    : <View testID={testID} accessible accessibilityLabel={spoken} accessibilityLiveRegion={announce ? 'polite' : undefined}
      style={s.line}>{body}</View>;
}

const s = StyleSheet.create({
  // A line of the thread, aligned with the assistant's words; the whole line is the 44 dp target.
  line: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 4, paddingHorizontal: 2 },
  art: { width: 24, height: 24, alignItems: 'center', justifyContent: 'center' },
  copy: { flex: 1, minWidth: 0, gap: 2 },
  main: { fontWeight: '700' },
  edit: { fontWeight: '600', color: sys.color.ink },
});
