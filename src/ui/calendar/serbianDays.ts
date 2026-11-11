import { calendarInstant } from '../../lib/calendarTime';
import { DOGOVORENA_ZONA } from '../../lib/dogovorenoVreme';
import { civilInstant, deviceDate, shiftDate, weekDates, zonedParts } from './calendarPresentation';
import { addMonths } from './months';

/**
 * ONE ZONE for the planner (owner, 2026-10-07): a day is a day of Serbian time, and so is every clock written on it.
 *
 * Until then the days were cut at the phone's midnight (`localDayRange`, the phone's own zone) while the clocks were written in
 * Serbian time (`agendaClock`), so on a phone set to another zone a Dogovor could stand on one day and say the clock of
 * another. Everything the planner needs about a day now comes from here: the day an instant belongs to, the exact instants a
 * day starts and ends at (a day is 23 hours long when the clocks go forward and 25 when they go back, so it is never
 * "24 hours"), and the window of weeks the planner reads at once. Nothing here reads the phone's zone.
 *
 * Pure and dependency-light on purpose: no React and no native module, so the screen's pure helpers load wherever a suite does.
 */

export type DayRange = Readonly<{ from: string; to: string }>;

/** An instant as epoch milliseconds, read the way the app reads every instant (exact, microsecond text); null when it is not one. */
export function instantMs(value: unknown): number | null {
  const at = calendarInstant(value);
  return at === null ? null : Number(at >= 0n ? at / 1000n : (at - 999n) / 1000n);
}

/** The civil day ("2026-10-25") an instant belongs to in Serbian time; null when the instant cannot be read. */
export function serbianDayOf(value: string | Date): string | null {
  const ms = value instanceof Date ? value.getTime() : instantMs(value);
  if (ms === null || !Number.isFinite(ms)) return null;
  return zonedParts(new Date(ms), DOGOVORENA_ZONA).date;
}

/** Today in Serbian time. An unreadable clock falls back to the phone's own day rather than to no day at all. */
export function serbianToday(now: Date = new Date()): string {
  return serbianDayOf(now) ?? deviceDate(new Date());
}

const ranges = new Map<string, DayRange>();
/**
 * The exact instants a Serbian day starts and ends at: from its midnight up to, and not including, the next one. Midnight
 * never falls inside a clock change in Serbia (they happen at 02:00 and 03:00), so it always names exactly one instant, and
 * the span between two midnights is 23, 24 or 25 hours as the calendar says.
 */
export function serbianDayRange(day: string): DayRange {
  const known = ranges.get(day);
  if (known) return known;
  const from = civilInstant(day, '00:00', DOGOVORENA_ZONA).value, to = civilInstant(shiftDate(day, 1), '00:00', DOGOVORENA_ZONA).value;
  if (from === null || to === null) throw new Error('SERBIAN_DAY_UNREADABLE');
  if (ranges.size > 512) ranges.clear();
  const range: DayRange = Object.freeze({ from, to });
  ranges.set(day, range);
  return range;
}

/** The first midnight of the first day up to the last midnight of the last day of a list of consecutive days. */
export function serbianSpan(first: string, last: string): DayRange {
  return { from: serbianDayRange(first).from, to: serbianDayRange(last).to };
}

/** The window of weeks the planner reads at once. */
export type PlannerWindow = Readonly<{
  /** The Monday the window starts on, and the Sunday it ends on. */
  first: string; last: string;
  /** Exact instants: the Serbian midnight that opens `first` and the one that closes `last`. */
  from: string; to: string;
}>;

/**
 * The whole weeks that cover the month of a day, the way a month grid is drawn (Monday first, up to six weeks), and `around`
 * months more on each side of it. The planner reads its schedule for a window rather than for one week, so a swipe from week to
 * week inside it needs no new read and the week strip never loses its marks while a read runs.
 */
export function plannerWindow(selected: string, around = 0): PlannerWindow {
  const month = selected.slice(0, 7), lastMonth = addMonths(month, around);
  const length = new Date(Date.UTC(Number(lastMonth.slice(0, 4)), Number(lastMonth.slice(5, 7)), 0)).getUTCDate();
  const first = weekDates(`${addMonths(month, -around)}-01`)[0], last = weekDates(`${lastMonth}-${String(length).padStart(2, '0')}`)[6];
  return { first, last, ...serbianSpan(first, last) };
}

/** Whether a civil day lies inside the window. */
export const inWindow = (day: string, window: Pick<PlannerWindow, 'first' | 'last'>): boolean => day >= window.first && day <= window.last;

/** The clock of an instant to the minute, in Serbian time ("09:15"); '' when it cannot be read. */
export function serbianClock(value: string): string {
  const ms = instantMs(value);
  return ms === null ? '' : zonedParts(new Date(ms), DOGOVORENA_ZONA).time.slice(0, 5);
}
