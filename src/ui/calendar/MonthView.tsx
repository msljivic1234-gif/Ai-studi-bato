import { StyleSheet, View } from 'react-native';
import { Press } from '../Press';
import { T } from '../Text';
import { sys } from '../system/tokens';
import { weekdays } from './calendarPresentation';
import { dayDots, daySpoken } from './calendarViews';
import { DayNumber, DayShade, RoleDots } from './DayCell';
import { monthGrid } from './months';
import type { PlannerEntry } from './planner';

/** The height of a day: 36 for its number, 16 for its dots and a little air, so a day is a touch in height as well as in width (a seventh of 361 dp is 46). */
export const CELL_HEIGHT = 56;

/**
 * The month (owner's sketch and words, 8 Oct 2026: "ceo mesec na prvi pogled"): seven columns, Monday first, five weeks or six. Under each
 * day's number go up to two dots in the colour of the side of its Dogovori ("+1" for the rest); today is ringed, the chosen day is a green
 * disc, and the days the worker has said they can work lie on a soft tint. A day of a neighbouring month only fills the week: dimmed,
 * not touched, with nothing under it. Pressing a day chooses it (the list of its Dogovori stands under the grid).
 *
 * `byDay` holds the Dogovori of every day the planner has read, and nothing for a day it has not: such a day is drawn as a plain number,
 * never as an empty one, and a month whose schedule is still being read has no dots at all (`byDay` null).
 */
export function MonthView({ month, selected, today, now, byDay, shaded, onSelect }: {
  month: string; selected: string; today: string; now?: Date;
  byDay: Readonly<Record<string, readonly PlannerEntry[]>> | null;
  shaded: (day: string) => boolean;
  onSelect: (day: string) => void;
}) {
  return <View testID="month-grid">
    {/* Every day's own spoken name says its weekday, so the column heads are for the eye only. */}
    <View style={s.week} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {weekdays.map(weekday => <T key={weekday.short} variant="meta" tone="muted" numberOfLines={1} style={s.weekday}>{weekday.short}</T>)}
    </View>
    {monthGrid(month).map((week, row) => <View key={`week-${row}`} style={s.week}>
      {week.map(({ day, inMonth }) => {
        if (!inMonth) return <View key={day} testID="day-outside" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={s.cell}>
          <DayNumber day={day} dimmed />
          <RoleDots dots={null} />
        </View>;
        const entries = byDay?.[day];
        const dots = entries ? dayDots(entries) : null;
        const chosen = day === selected;
        return <Press key={day} accessibilityRole="button" accessibilityLabel={daySpoken(day, entries ?? [], { today, now })}
          accessibilityState={{ selected: chosen }} haptic="select" scaleTo={1} hitSlop={0} onPress={() => onSelect(day)} style={s.cell}>
          {shaded(day) ? <DayShade /> : null}
          <DayNumber day={day} selected={chosen} today={day === today} />
          <RoleDots dots={dots} />
        </Press>;
      })}
    </View>)}
  </View>;
}

const s = StyleSheet.create({
  week: { flexDirection: 'row' },
  weekday: { flex: 1, minWidth: 0, textAlign: 'center', paddingBottom: sys.space.sm },
  cell: { flex: 1, minWidth: 0, minHeight: CELL_HEIGHT, alignItems: 'center', justifyContent: 'center' },
});
