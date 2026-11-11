import { StyleSheet, View } from 'react-native';
import { T } from '../Text';
import { FactArt, type FactArtKind } from './FactArt';
import { sys } from './tokens';

export type FactRowProps = {
  /** The picture of the fact (where, when, how many, how much): a `FactArt` kind. */
  art: FactArtKind;
  /** Optional reading label; the value remains the strongest line on a detail screen. */
  label?: string;
  /** The fact itself. It wraps, and is never cut with an ellipsis. */
  value: string;
  /** Something that belongs beside it, in a quieter line under it ("0 / 2 popunjeno"). */
  note?: string;
  /** `card`: in a record, the `note` type in the `fact` colour. `detail`: on a detail screen, the `body` type in ink. `card` when left out. */
  size?: 'card' | 'detail';
  testID?: string;
};

/** Shared current artwork slot. Card/detail variants and their placeholders
 * consume this owner; the optical size may evolve with the artwork family. */
const ART = 28;
/** The same number for the placeholders that stand in for a fact (`Skeleton`, F8b): a picture that changes size changes them with it. */
export const FACT_ROW_ART = ART;

/**
 * Shared fact row and its accessible value. `CardFact`,
 * `OwnTaskFact`, `AgreementFact`, `TaskDecisionLogistics` and `ProductFact` each drew this with their own size and gap.
 *
 * The fact is the line, so it wraps at any text size and the picture stays on its FIRST line (a fact of three lines does not
 * centre its picture on the middle one). A screen reader hears it as one sentence: the fact, then the note.
 */
export function FactRow({ art, label, value, note, size = 'card', testID }: FactRowProps) {
  const detail = size === 'detail';
  const line = (detail ? sys.type.body : sys.type.note).lineHeight;
  const spoken = `${label ? `${label}: ` : ''}${value}${note ? `, ${note}` : ''}`;
  return <View testID={testID} accessible accessibilityRole="text" accessibilityLabel={spoken} style={s.row}>
    <View style={s.art}><FactArt kind={art} size={ART} /></View>
    {/* The first line is centred on the picture: the leading is a few dp shorter than the 28 of the picture. */}
    <View style={[s.copy, label ? s.labeled : { paddingTop: Math.max(0, (ART - line) / 2) }]}>
      {label ? <T variant="note" tone="muted">{label}</T> : null}
      <T variant={detail ? label ? 'bodyStrong' : 'body' : 'note'} style={detail ? undefined : s.card}>{value}</T>
      {note ? <T variant={detail ? 'note' : 'meta'} tone="muted">{note}</T> : null}
    </View>
  </View>;
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: sys.space.md, minHeight: ART },
  art: { width: ART, height: ART },
  copy: { flex: 1, minWidth: 0 },
  labeled: { gap: sys.space.xs },
  card: { color: sys.color.fact },
});
