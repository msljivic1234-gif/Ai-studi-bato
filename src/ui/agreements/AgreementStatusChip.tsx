import { StyleSheet, View } from 'react-native';
import { T } from '../Text';
import { STATUS_CHIPS, STATUS_TONES, StatusChip, StatusMark } from '../system/StatusChip';
import { sys } from '../system/tokens';
import type { AgreementChip } from './agreementListModel';

/** The word a Dogovor's state wears, said once for the eye and for the card's spoken value. */
export const AWAITING_WORD = 'Čeka potvrdu';
export const agreementChipWord = (chip: AgreementChip): string => chip.kind === 'status' ? STATUS_CHIPS[chip.key].word : AWAITING_WORD;

/**
 * The one state chip, for a Dogovor (plan 2.2). "Dogovoren", "U toku", "Završen" and "Otkazan" are `StatusChip`'s own states;
 * "Čeka potvrdu" is the Dogovor's alone, and the table has no key for it yet, so it is drawn here from the same mark and the same
 * tones, in the same chip: a dot in orange when the confirmation is MINE (it waits for me), a quiet ring when the other side has
 * to give it. Shape and word together, never a colour alone.
 */
export function AgreementStatusChip({ chip, detail }: { chip: AgreementChip; detail?: string }) {
  if (chip.kind === 'status') return <StatusChip status={chip.key} detail={detail} />;
  const tone = chip.mine ? 'attention' : 'neutral';
  const palette = STATUS_TONES[tone];
  return <View testID="status-chip" accessible accessibilityRole="text" accessibilityLabel={detail ? `${AWAITING_WORD}, ${detail}` : AWAITING_WORD}
    style={[s.chip, { backgroundColor: palette.ground }]}>
    <StatusMark shape={chip.mine ? 'dot' : 'ring'} tone={tone} />
    <T variant="label" style={[s.word, { color: palette.word }]}>{detail ? `${AWAITING_WORD} · ${detail}` : AWAITING_WORD}</T>
  </View>;
}

const s = StyleSheet.create({
  // The chip of `StatusChip`, measure for measure, so the two never sit side by side with different heights.
  chip: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: sys.space.xs, paddingVertical: sys.space.xs,
    paddingLeft: sys.space.sm, paddingRight: sys.space.md, borderRadius: sys.radius.pill },
  word: { letterSpacing: 0 },
});
