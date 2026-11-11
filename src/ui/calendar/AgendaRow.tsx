import type { ReactNode } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated from 'react-native-reanimated';
import { BEZ_IZNOSA } from '../../lib/novac';
import { Press } from '../Press';
import { T } from '../Text';
import { Avatar } from '../system/Avatar';
import { layout, ruleWidth } from '../system/layout';
import { Surface } from '../system/Surface';
import { useLayoutClass } from '../system/textScale';
import { sys } from '../system/tokens';
import { usePressLift } from '../system/usePressLift';
import { roleKind } from './calendarViews';
import { entryNotes, entryOpens, entrySpoken, entryTime, saysSomething } from './entryText';
import { PlannerChip } from './PlannerChip';
import { entryTitle, type PlannerEntry } from './planner';
import { ROLE_TONES } from './roleTone';

/** What a Dogovor's face is drawn as: the photo when the screen can read it, the letters of the name otherwise (`photo` is handed in by the route). */
export type EntryFace = (profileId: string, standIn: ReactNode) => ReactNode;
export const FACE = 32;

/** The face of the other person in a Dogovor, or null when the read does not name one. */
export function entryFace(entry: PlannerEntry, photo?: EntryFace): ReactNode {
  if (!entry.person) return null;
  const standIn = <Avatar initials={entry.personInitials} size={FACE} />;
  return entry.personProfileId && photo ? photo(entry.personProfileId, standIn) : standIn;
}

/** The side of a Dogovor in words, with its colour: a dot and "Uskačeš" or "Tvoj zadatak". Never colour alone. */
export function RoleLabel({ entry, muted = false }: { entry: PlannerEntry; muted?: boolean }) {
  if (!entry.role) return null;
  const tone = ROLE_TONES[roleKind(entry)];
  return <View testID="role-label" style={s.role}>
    <View style={[s.roleDot, { backgroundColor: tone.front }]} />
    <T variant="meta" style={[s.roleWord, { color: muted ? sys.color.muted : tone.edge }]}>{entry.role}</T>
  </View>;
}

/**
 * One Dogovor of mine in the planner (owner's sketch of 8 Oct 2026; composition spec 4.10). A `record` - it is touched, so it is a card
 * with the shadow and nothing inside it is a card - that gives under the finger as one object, with an edge in the colour of my side
 * of it. The first line is the time in Serbian time ("09:00–11:00", or "od 14:00" when only one bound is stored) and, at the end of
 * it, whose side it is in words and colour ("Uskačeš", "Tvoj zadatak"); then the title with the agreed amount beside it (or under it
 * on a narrow screen); then the other person's face and name with the place. A state is drawn only when it says something ("U toku",
 * "Čeka potvrdu", "Završen"): "Dogovoren" is what everything on a schedule is. The orange lines are what waits for you and "Preklapa se
 * sa …". A missing amount is a word, never "0 RSD"; an amount that is not known here is not drawn at all. A finished thing is quiet.
 */
export function AgendaRow({ entry, day, onOpen, overlap = null, zoneNote = false, photo }: {
  entry: PlannerEntry; day: string; onOpen: (entry: PlannerEntry) => void;
  /** "Preklapa se sa …", when another term of the day overlaps this one. */
  overlap?: string | null;
  /** The phone is not in Serbian time: the spoken time says whose clock it is, as the heading does for the eye. */
  zoneNote?: boolean;
  photo?: EntryFace;
}) {
  const large = useLayoutClass().cls === 'large';
  const { width } = useWindowDimensions();
  const { style: lift, give, settle } = usePressLift();
  // The screen's gutters and the card's padding and edge reduce the space for title + amount. Keep the original 360 dp two-column
  // allowance inside the card, not across the whole phone.
  const contentWidth = width - layout.gutter * 2 - (layout.card + ruleWidth) * 2 - sys.space.sm;
  const beside = contentWidth >= 360 && !large;
  const done = entry.done;
  const tone = ROLE_TONES[roleKind(entry)];
  const time = entryTime(entry, day);
  const notes = entryNotes(entry, overlap);
  const face = entryFace(entry, photo);
  const where = [entry.person, entry.place].filter((part): part is string => !!part).join(' · ');
  const value = entry.amount === null ? null : entry.amount
    ? <T variant="priceRow" style={{ color: done ? sys.color.muted : sys.color.money, maxWidth: '100%', flexShrink: 1 }}>{entry.amount}</T>
    : <T variant="note" tone="muted">{BEZ_IZNOSA}</T>;
  return <Animated.View style={lift}>
    <Surface kind="record" style={s.card}>
      {/* The edge of the card is a bar in the colour of my side of it, inside the card's own padding. */}
      <View testID="role-edge" pointerEvents="none" style={[s.edge, { backgroundColor: tone.front }]} />
      <Press testID="agenda-card" accessibilityRole="button" accessibilityLabel={entryOpens(entry)} accessibilityValue={{ text: entrySpoken(entry, { day, zoneNote, overlap }) }}
        haptic="select" scaleTo={1} onPressIn={give} onPressOut={settle} onPress={() => onOpen(entry)} style={s.body}>
        <View style={s.head}>
          {time ? <T variant="note" style={[s.time, { color: done ? sys.color.muted : sys.color.ink }]}>{time}</T> : null}
          <RoleLabel entry={entry} muted={done} />
        </View>
        <View style={beside ? s.titleRow : s.titleColumn}>
          <T variant="cardTitleCompact" numberOfLines={large ? 3 : 2}
            style={[{ color: done ? sys.color.muted : sys.color.ink }, beside && s.title]}>{entryTitle(entry)}</T>
          {value}
        </View>
        {where ? <View style={s.who}>
          {face ? <View style={s.face}>{face}</View> : null}
          <T variant="note" style={[s.whoText, { color: done ? sys.color.muted : sys.color.fact }]}>{where}</T>
        </View> : null}
        {saysSomething(entry) ? <PlannerChip status={entry.status} /> : null}
        {notes.map(line => <View key={line} style={s.note}>
          <View style={s.noteDot} />
          <T variant="note" style={s.noteText}>{line}</T>
        </View>)}
      </Press>
    </Surface>
  </Animated.View>;
}

const s = StyleSheet.create({
  // The bar stands 8 from the card's edge and the words begin 12 after it; nothing is clipped, so the card keeps its shadow whole.
  card: { paddingLeft: layout.card + sys.space.sm },
  edge: { position: 'absolute', left: sys.space.sm, top: layout.card, bottom: layout.card, width: sys.space.xs, borderRadius: sys.radius.pill },
  body: { gap: sys.space.xs },
  head: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', columnGap: sys.space.md, rowGap: sys.space.xs },
  time: { fontVariant: ['tabular-nums'] },
  role: { flexDirection: 'row', alignItems: 'center', gap: sys.space.sm },
  roleDot: { width: 8, height: 8, borderRadius: sys.radius.pill },
  roleWord: { fontWeight: '600' },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: sys.space.md },
  titleColumn: { gap: sys.space.xs },
  title: { flex: 1, minWidth: 0 },
  who: { flexDirection: 'row', alignItems: 'center', gap: sys.space.sm, marginTop: sys.space.xs },
  face: { width: FACE, height: FACE, borderRadius: sys.radius.pill, overflow: 'hidden' },
  whoText: { flex: 1, minWidth: 0 },
  // What waits for you, and a collision: an orange mark and the words in the ink made for orange on white.
  note: { flexDirection: 'row', alignItems: 'center', gap: sys.space.sm },
  noteDot: { width: 6, height: 6, borderRadius: sys.radius.pill, backgroundColor: sys.color.orange },
  noteText: { flexShrink: 1, color: sys.color.attentionInk },
});
