import { StyleSheet, View } from 'react-native';
import { T } from '../Text';
import { ruleWidth } from '../system/layout';
import { sys } from '../system/tokens';
import type { DayDots } from './calendarViews';
import { ROLE_TONES } from './roleTone';

/** The circle a day's number stands in: 36 dp, so even a large text size's digits stay inside it. */
export const NUMBER_SIZE = 36;
/** The row a day's dots stand in. It is always there, so a day without dots is as tall as a day with them and nothing moves when one appears. */
export const DOTS_HEIGHT = 16;
const DOT = 6;

/**
 * The number of a day (owner's sketch, 8 Oct 2026): the chosen day is a green disc with a white number, today is ringed in ink, the
 * rest is plain; a day of a neighbouring month, which only fills the first and last week of the grid, is dimmed. The number is a fact
 * that stays as it is: it never animates, and it follows the text size only as far as the circle holds it.
 */
export function DayNumber({ day, selected = false, today = false, dimmed = false }: { day: string; selected?: boolean; today?: boolean; dimmed?: boolean }) {
  const ringed = today && !selected;
  return <View testID={selected ? 'day-selected' : ringed ? 'day-today' : undefined} style={[s.number, selected && s.numberSelected, ringed && s.numberToday]}>
    <T variant="body" maxFontSizeMultiplier={1.3} numberOfLines={1}
      style={[s.digits, selected && s.digitsSelected, ringed && s.digitsToday, dimmed && s.dimmed]}>{Number(day.slice(8, 10))}</T>
  </View>;
}

/**
 * What a day carries under its number: up to two dots in the colour of the side of each Dogovor, and "+N" for the rest. Decoration for a
 * screen reader: the day's own spoken name says everything the dots draw, so they are hidden from it.
 */
export function RoleDots({ dots }: { dots: DayDots | null }) {
  return <View testID="day-dots" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={s.dots}>
    {dots?.roles.map((role, at) => <View key={at} testID="day-dot" style={[s.dot, { backgroundColor: ROLE_TONES[role].front }]} />)}
    {dots && dots.more > 0 ? <T variant="label" tone="muted" maxFontSizeMultiplier={1} style={s.more}>{`+${dots.more}`}</T> : null}
  </View>;
}

/** The soft ground of a day the worker has said they can work: a tint behind the cell, never a line or a word. */
export function DayShade() {
  return <View testID="day-shade" pointerEvents="none" style={s.shade} />;
}

const s = StyleSheet.create({
  number: { width: NUMBER_SIZE, height: NUMBER_SIZE, borderRadius: sys.radius.pill, alignItems: 'center', justifyContent: 'center' },
  numberSelected: { backgroundColor: sys.color.green },
  numberToday: { borderWidth: ruleWidth * 2, borderColor: sys.color.ink },
  digits: { fontVariant: ['tabular-nums'] },
  digitsSelected: { color: sys.color.onDark, fontWeight: '700' },
  digitsToday: { fontWeight: '700' },
  // A neighbour's day is only there to fill the week: quiet, and not a thing to read.
  dimmed: { opacity: 0.55 },
  dots: { height: DOTS_HEIGHT, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: sys.space.xs },
  dot: { width: DOT, height: DOT, borderRadius: sys.radius.pill },
  more: { letterSpacing: 0 },
  shade: { ...StyleSheet.absoluteFill, margin: 2, borderRadius: sys.radius.control, backgroundColor: sys.color.artRole.location.soft },
});
