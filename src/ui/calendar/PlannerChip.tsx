import { StyleSheet, View } from 'react-native';
import { T } from '../Text';
import { STATUS_CHIPS, STATUS_TONES, StatusChip, StatusMark } from '../system/StatusChip';
import { sys } from '../system/tokens';
import type { PlannerStatus } from './planner';

/** The word of a status, as the chip writes it. */
export const statusWord = (status: PlannerStatus): string => 'key' in status ? STATUS_CHIPS[status.key].word : status.word;
/** The status as a screen reader says it: the word, then what it adds ("Bira se, 3"). */
export const statusSpoken = (status: PlannerStatus): string => status.detail ? `${statusWord(status)}, ${status.detail}` : statusWord(status);

/**
 * The shared chip for a planner row. A state the chip's table has a word for is drawn by the chip itself, so "Dogovoren", "U toku",
 * "Bira se · 3", "Poslata" are the same here as on every other screen. The few states the table has no word for ("Čeka potvrdu",
 * "U užem izboru", "Zadatak je izmenjen", "Zatvoren", "Zatvorena") are drawn by the chip's own marks and tones with their own word, in
 * the same pill, so the row does not tell them apart by anything but the word. When the table gains those words, a status asks for
 * the key and this file stops drawing the pill.
 */
export function PlannerChip({ status }: { status: PlannerStatus }) {
  if ('key' in status) return <StatusChip status={status.key} detail={status.detail} />;
  const palette = STATUS_TONES[status.tone];
  return <View testID="status-chip" accessible accessibilityRole="text" accessibilityLabel={statusSpoken(status)}
    style={[s.chip, { backgroundColor: palette.ground }]}>
    <StatusMark shape={status.shape} tone={status.tone} />
    <T variant="label" style={[s.word, { color: palette.word }]}>{status.detail ? `${status.word} · ${status.detail}` : status.word}</T>
  </View>;
}

const s = StyleSheet.create({
  // The pill of `StatusChip`, spelled the same: a chip that sits in a row of facts and is never a tap target.
  chip: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: sys.space.xs, paddingVertical: sys.space.xs,
    paddingLeft: sys.space.sm, paddingRight: sys.space.md, borderRadius: sys.radius.pill },
  word: { letterSpacing: 0 },
});
