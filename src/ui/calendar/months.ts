import { shiftDate, weekDates } from './calendarPresentation';

/**
 * The month of the planner's grid, as plain civil dates ("2026-10", "2026-10-07"): no React, no zone, no native module. Monday first,
 * as the Serbian week runs.
 */

const MONTHS = ['Januar', 'Februar', 'Mart', 'April', 'Maj', 'Jun', 'Jul', 'Avgust', 'Septembar', 'Oktobar', 'Novembar', 'Decembar'];
/** "Oktobar 2026". */
export const monthName = (month: string): string => `${MONTHS[Number(month.slice(5, 7)) - 1]} ${month.slice(0, 4)}`;

const pad = (value: number) => String(value).padStart(2, '0');
/** The month `delta` months from `month` ("2026-12" + 1 = "2027-01"). */
export function addMonths(month: string, delta: number): string {
  const index = Number(month.slice(0, 4)) * 12 + Number(month.slice(5, 7)) - 1 + delta;
  return `${Math.floor(index / 12)}-${pad((index % 12) + 1)}`;
}

/** How many months apart two months are, whichever comes first ("2026-12" and "2027-02" are 2). */
export const monthDistance = (a: string, b: string): number =>
  Math.abs((Number(a.slice(0, 4)) * 12 + Number(a.slice(5, 7))) - (Number(b.slice(0, 4)) * 12 + Number(b.slice(5, 7))));

/** How many days a month has ("2026-02" is 28, "2028-02" is 29). */
export const daysInMonth = (month: string): number => new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0)).getUTCDate();

/**
 * The same day of the month, `delta` months away, and the last day of that month when it has no such day ("2026-01-31" + 1 month is
 * "2026-02-28"): the step the month view takes, so the day under the grid always belongs to a day the grid shows.
 */
export function addMonthsToDay(day: string, delta: number): string {
  const month = addMonths(day.slice(0, 7), delta);
  return `${month}-${pad(Math.min(Number(day.slice(8, 10)), daysInMonth(month)))}`;
}

/** The fewest weeks a month's grid draws: a month that fits in four (a February that starts on Monday) borrows a week of the next one. */
const FEWEST_WEEKS = 5;

/** One cell of the grid: a civil day, and whether it belongs to the month the grid is of (the rest are the neighbours' days that fill the first and last week). */
export type GridDay = Readonly<{ day: string; inMonth: boolean }>;

/**
 * The month as the weeks it is drawn in: Monday first, every cell a real civil date (the days before the first and after the last
 * belong to the months beside it and are marked so), five weeks or six, as many as the month needs. Never a blank cell: a blank has no
 * name for a screen reader and no date to be taken for.
 */
export function monthGrid(month: string): GridDay[][] {
  const first = `${month}-01`;
  const last = `${month}-${pad(daysInMonth(month))}`;
  const start = weekDates(first)[0];
  const lead = (new Date(`${first}T12:00:00Z`).getUTCDay() + 6) % 7;
  const weeks = Math.max(FEWEST_WEEKS, Math.ceil((lead + daysInMonth(month)) / 7));
  return Array.from({ length: weeks }, (_, row) => Array.from({ length: 7 }, (_, column) => {
    const day = shiftDate(start, row * 7 + column);
    return { day, inMonth: day >= first && day <= last };
  }));
}
