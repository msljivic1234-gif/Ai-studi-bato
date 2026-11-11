import { StyleSheet, View } from 'react-native';
import { Press } from '../Press';
import { T } from '../Text';
import { sys } from '../system/tokens';
import { HOUR_HEIGHT, roleKind, topOf, type DayBlock, type TimelineRange } from './calendarViews';
import { entryFace, type EntryFace } from './AgendaRow';
import { entryOpens, entrySpoken, entryTime } from './entryText';
import { entryTitle, type PlannerEntry } from './planner';
import { ROLE_TONES } from './roleTone';

/** A block that is this tall or more has room for a second line (the other person and the time); one that is this tall also has room for a face. */
const SECOND_LINE_FROM = 60;
const FACE_FROM = 112;

/**
 * One Dogovor on the hours (owner's sketch, 8 Oct 2026): a block from its start to its end, tinted and edged in the colour of my side of
 * it, with its title, and, when it is tall enough, the other person and the time, and below that their face. It is where the time says it
 * is: the hour rail beside it is what reads the hours, so a short block carries only its title and the full sentence is its spoken name.
 * Pressing it opens the Dogovor. Blocks that overlap stand side by side (`block.column` of `block.columns`). A Dogovor that waits for the
 * person (a completion to confirm, a rating, an open problem) wears the orange dot of what is theirs to do, at the end of its first line; what
 * it waits for is in its spoken name, and in the card the month and the week draw for it.
 */
export function DayBlockCard({ block, day, range, zoneNote, overlap, photo, onOpen }: {
  block: DayBlock; day: string; range: TimelineRange; zoneNote: boolean; overlap: string | null; photo?: EntryFace;
  onOpen: (entry: PlannerEntry) => void;
}) {
  const { entry } = block;
  const tone = ROLE_TONES[roleKind(entry)];
  const top = topOf(block.from, range);
  const height = ((block.drawnTo - block.from) / 60) * HOUR_HEIGHT;
  const done = entry.done;
  const time = entryTime(entry, day);
  const face = height >= FACE_FROM ? entryFace(entry, photo) : null;
  const second = height >= SECOND_LINE_FROM ? [height >= FACE_FROM ? null : entry.person, time].filter(Boolean).join(' · ') : null;
  return <Press accessibilityRole="button" accessibilityLabel={entryOpens(entry)} accessibilityValue={{ text: entrySpoken(entry, { day, zoneNote, overlap }) }}
    haptic="select" scaleTo={sys.motion.scale.row} onPress={() => onOpen(entry)}
    style={[s.slot, { top, height, left: `${(block.column / block.columns) * 100}%`, width: `${100 / block.columns}%` }]}>
    <View testID="day-block" style={[s.card, { backgroundColor: tone.soft }]}>
      <View testID="role-edge" style={[s.edge, { backgroundColor: tone.front }]} />
      {entry.waits ? <View testID="block-waits" style={s.waits} /> : null}
      <T variant="cardTitleCompact" numberOfLines={height >= FACE_FROM ? 3 : height >= SECOND_LINE_FROM ? 2 : 1}
        style={[{ color: done ? sys.color.muted : sys.color.ink }, entry.waits && s.beforeDot]}>{entryTitle(entry)}</T>
      {second ? <T variant="note" numberOfLines={1} style={{ color: done ? sys.color.muted : sys.color.fact }}>{second}</T> : null}
      {face && entry.person ? <View style={s.who}>
        <View style={s.face}>{face}</View>
        <T variant="note" numberOfLines={1} style={[s.whoText, { color: done ? sys.color.muted : sys.color.fact }]}>{entry.person}</T>
      </View> : null}
    </View>
  </Press>;
}

const s = StyleSheet.create({
  // The slot is the touch; the 2 dp round it are the air between neighbours, in a column and above and below.
  slot: { position: 'absolute', padding: 2 },
  card: { flex: 1, overflow: 'hidden', borderRadius: sys.radius.control, paddingVertical: sys.space.sm, paddingLeft: sys.space.md + sys.space.xs,
    paddingRight: sys.space.sm, gap: sys.space.xs },
  edge: { position: 'absolute', left: 0, top: 0, bottom: 0, width: sys.space.xs },
  waits: { position: 'absolute', top: sys.space.sm, right: sys.space.sm, width: 8, height: 8, borderRadius: sys.radius.pill, backgroundColor: sys.color.orange },
  beforeDot: { marginRight: sys.space.base },
  who: { flexDirection: 'row', alignItems: 'center', gap: sys.space.sm },
  face: { width: 32, height: 32, borderRadius: sys.radius.pill, overflow: 'hidden' },
  whoText: { flex: 1, minWidth: 0 },
});
