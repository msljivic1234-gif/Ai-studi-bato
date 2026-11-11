import { StyleSheet, View } from 'react-native';
import { Press } from '../Press';
import { T } from '../Text';
import { useTextScale } from '../system/textScale';
import { sys } from '../system/tokens';
import { weekdayOf } from './calendarPresentation';
import type { DayDots } from './calendarViews';
import { DayNumber, RoleDots } from './DayCell';

/** One day of the strip: the day, the dots it carries (null while the schedule is not read: no day is marked then, and none is called free), and its spoken name. */
export type StripDay = Readonly<{ day: string; dots: DayDots | null; spoken: string }>;

/**
 * The seven days of the week in one row (owner's sketch, 8 Oct 2026): the weekday, its number and its dots, the way the month draws a
 * day. Seven equal columns that always fit, each at least 44 dp across on the owner's phone (361 dp) with no hit slop reaching into its
 * neighbour; at a very large text size the weekday shrinks to its letter. The chosen day is a green disc, today is ringed. The dots keep
 * their row whether there are any or not, so choosing another day moves nothing. Every day's spoken name carries what its dots only draw.
 */
export function WeekStrip({ days, selected, today, onSelect }: {
  days: readonly StripDay[]; selected: string; today: string; onSelect: (day: string) => void;
}) {
  const scale = useTextScale();
  return <View style={s.strip}>{days.map(({ day, dots, spoken }) => {
    const weekday = weekdayOf(day), chosen = day === selected;
    return <Press key={day} accessibilityRole="button" accessibilityLabel={spoken} accessibilityState={{ selected: chosen }}
      haptic="select" scaleTo={1} hitSlop={0} onPress={() => onSelect(day)} style={s.cell}>
      <T variant="meta" tone="muted" numberOfLines={1}>{scale >= 1.5 ? weekday.short.charAt(0) : weekday.short}</T>
      <DayNumber day={day} selected={chosen} today={day === today} />
      <RoleDots dots={dots} />
    </Press>;
  })}</View>;
}

const s = StyleSheet.create({
  strip: { flexDirection: 'row' },
  cell: { flex: 1, minWidth: 0, minHeight: 80, alignItems: 'center', justifyContent: 'center', gap: sys.space.xs },
});
