import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { T } from '../Text';
import { layout } from '../system/layout';
import { sys } from '../system/tokens';
import { dayLabel } from './calendarViews';
import { overlapNotes, type PlannerEntry } from './planner';

/** The word a day with nothing on it says. It is the word of a day the schedule was read for, never of one that was not or whose list failed. */
export const FREE_DAY = 'Slobodno';

/**
 * The seven days of the week one under another (owner's sketch, 8 Oct 2026; the way a "Schedule" view lists days): a day with Dogovori is
 * its heading and its cards; a day with none is one quiet band, "Slobodno" at its end. "Slobodno" is said only when the day is KNOWN to be
 * free: while a read has not settled or the list of Dogovori failed (`partial`), the band carries the day's name alone, because a day that
 * could have something on it is not a free one.
 */
export function WeekDays({ days, today, now, byDay, partial, row, onDayLayout }: {
  days: readonly string[]; today: string; now?: Date;
  byDay: Readonly<Record<string, readonly PlannerEntry[]>>;
  /** Only what the schedule says is shown: no day is called free. */
  partial: boolean;
  /** One Dogovor of a day, drawn by the screen (a card), with the line of its overlap. */
  row: (entry: PlannerEntry, day: string, overlap: string | null) => ReactNode;
  /** Where each day begins within this list, for a press on the day in the strip. */
  onDayLayout?: (day: string, y: number) => void;
}) {
  return <View testID="week-days" style={s.days}>
    {days.map(day => {
      const entries = byDay[day] ?? [];
      const heading = dayLabel(day, today, now);
      const place = onDayLayout ? { onLayout: (event: { nativeEvent: { layout: { y: number } } }) => onDayLayout(day, event.nativeEvent.layout.y) } : null;
      if (!entries.length) return <View key={day} testID="free-day" accessible accessibilityRole="header"
        accessibilityLabel={partial ? heading : `${heading}, ${FREE_DAY.toLowerCase()}`} style={s.free} {...place}>
        <T variant="body" tone="muted" style={s.freeDay}>{heading}</T>
        {partial ? null : <T variant="note" tone="muted">{FREE_DAY}</T>}
      </View>;
      const overlaps = overlapNotes(entries);
      return <View key={day} testID="busy-day" style={s.day} {...place}>
        <T variant="bodyStrong" accessibilityRole="header">{heading}</T>
        <View style={s.list}>{entries.map(entry => row(entry, day, overlaps.get(entry.key) ?? null))}</View>
      </View>;
    })}
  </View>;
}

const s = StyleSheet.create({
  days: { gap: layout.group },
  day: { gap: layout.group },
  list: { gap: layout.group },
  free: { minHeight: layout.touch, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', columnGap: layout.group,
    paddingVertical: sys.space.sm, paddingHorizontal: sys.space.base, borderRadius: sys.radius.control, backgroundColor: sys.color.wash },
  freeDay: { flexShrink: 1 },
});
