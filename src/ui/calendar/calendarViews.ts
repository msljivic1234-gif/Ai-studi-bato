import { dogovora } from '../system/plural';
import { ROLE_REQUESTER, ROLE_WORKER } from './agenda';
import { civilDay, dayHeading, shiftDate, weekdayOf, weekDates, weekLabel } from './calendarPresentation';
import { addMonthsToDay, monthName } from './months';
import type { PlannerEntry } from './planner';
import { serbianClock, serbianDayOf } from './serbianDays';

/**
 * What the three views of Raspored (Mesec, Nedelja, Dan) decide, as plain functions (owner, 8 Oct 2026: "prikaz kalendara ... da ima
 * pregled celog meseca, nedelje, dana"): which day a step lands on, what the period is called, which dots a day carries, how a day is
 * said to a screen reader, and where the Dogovori of one day stand on its hours. No React and no native module, so everything the
 * screen decides can be read and tested without drawing it.
 *
 * A day is a day of Serbian time, and so is every clock on it (`serbianDays.ts`). Nothing here is invented: a Dogovor stands on the
 * hours only by the exact instants the read gave it, and a Dogovor with one bound is drawn with the one bound it has.
 */

export type CalendarView = 'month' | 'week' | 'day';
/** The switch, in the order it is drawn; the month is the first and the one the screen opens on. */
export const CALENDAR_VIEWS: readonly { key: CalendarView; label: string }[] = [
  { key: 'month', label: 'Mesec' }, { key: 'week', label: 'Nedelja' }, { key: 'day', label: 'Dan' },
];

/* ------------------------------------------------------------------------------------------------------------------ */
/* Stepping and naming a period                                                                                         */
/* ------------------------------------------------------------------------------------------------------------------ */

/** The day a swipe or an arrow lands on: the same day of the next month (the last one when it has none), seven days, or one day. */
export function stepDay(view: CalendarView, selected: string, step: -1 | 1): string {
  return view === 'month' ? addMonthsToDay(selected, step) : shiftDate(selected, view === 'week' ? 7 * step : step);
}

/** What the two arrows are called, for a screen reader (and the tests): they name the period they step by. */
export function stepLabels(view: CalendarView): { previous: string; next: string } {
  if (view === 'month') return { previous: 'Prethodni mesec', next: 'Sledeći mesec' };
  if (view === 'week') return { previous: 'Prethodna nedelja', next: 'Sledeća nedelja' };
  return { previous: 'Prethodni dan', next: 'Sledeći dan' };
}

/** The heading of a day in a list: "Subota, 10. okt"; today is "Danas, četvrtak 8. okt". */
export function dayLabel(day: string, today: string, now?: Date): string {
  return day === today ? `Danas, ${weekdayOf(day).name.toLowerCase()} ${civilDay(day, now)}` : dayHeading(day, now);
}

/** What the period is called over the grid: "Oktobar 2026", "5–11. okt", "Subota, 10. okt". */
export function periodTitle(view: CalendarView, selected: string, today: string, now?: Date): string {
  if (view === 'month') return monthName(selected.slice(0, 7));
  if (view === 'week') return weekLabel(weekDates(selected), now);
  return dayLabel(selected, today, now);
}

/** The words of the bar over the grid: "2 Dogovora bez termina". */
export const looseBarLabel = (count: number): string => `${dogovora(count)} bez termina`;

/* ------------------------------------------------------------------------------------------------------------------ */
/* The dots of a day                                                                                                    */
/* ------------------------------------------------------------------------------------------------------------------ */

/**
 * Whose side a Dogovor is on, which is what a dot's colour says (the owner's sketch: green where I "Uskačeš", coral where it is "Tvoj
 * zadatak"). A Dogovor that does not say which side I am on has a quiet dot of its own, never a colour borrowed from one side.
 */
export type RoleKind = 'worker' | 'requester' | 'unknown';
export const roleKind = (entry: Pick<PlannerEntry, 'role'>): RoleKind =>
  entry.role === ROLE_WORKER ? 'worker' : entry.role === ROLE_REQUESTER ? 'requester' : 'unknown';

/** A day shows at most this many dots; the rest are counted ("+1"). */
export const MAX_DOTS = 2;
export type DayDots = Readonly<{ roles: readonly RoleKind[]; more: number }>;

/**
 * The dots of a day: one for the first Dogovor, and a second that says the other side when the day has both (so "uskačem" and "moj
 * zadatak" on one day never hide behind two dots of one colour); with more than two Dogovori the rest are a number, never more dots.
 */
export function dayDots(entries: readonly PlannerEntry[]): DayDots {
  if (!entries.length) return { roles: [], more: 0 };
  const kinds = entries.map(roleKind);
  const other = kinds.findIndex(kind => kind !== kinds[0]);
  const roles = kinds.length === 1 ? [kinds[0]] : [kinds[0], other > 0 ? kinds[other] : kinds[1]];
  return { roles, more: kinds.length - roles.length };
}

/**
 * A day as a screen reader hears it, which is also everything its dots say: "Subota, 10. okt, danas, 2 Dogovora, Uskačeš i Tvoj
 * zadatak, nešto čeka tebe". A dot is never the only way a day says it has something on it.
 */
export function daySpoken(day: string, entries: readonly PlannerEntry[], { today, now }: { today: string; now?: Date }): string {
  const parts = [dayHeading(day, now)];
  if (day === today) parts.push('danas');
  if (entries.length) {
    parts.push(dogovora(entries.length));
    const roles = [...new Set(entries.map(entry => entry.role).filter((role): role is string => !!role))];
    if (roles.length) parts.push(roles.join(' i '));
    if (entries.some(entry => entry.waits)) parts.push('nešto čeka tebe');
  }
  return parts.join(', ');
}

/* ------------------------------------------------------------------------------------------------------------------ */
/* One day on its hours                                                                                                 */
/* ------------------------------------------------------------------------------------------------------------------ */

/** The hours a day shows unless something stands outside them; a Dogovor before the first or after the last moves the edge to it. */
export const DAY_START_HOUR = 7;
export const DAY_END_HOUR = 22;
/** How tall an hour is drawn, in dp: enough for a block of one hour to hold a title and a line under it. */
export const HOUR_HEIGHT = 64;
/** The shortest a block is drawn, in minutes (45 is 48 dp: a block is a touch, never thinner than that), and the length a lone start is drawn with. */
export const MIN_BLOCK_MINUTES = 45;
/** Side by side at most this many; a Dogovor that would need another column is listed under the hours instead of drawn narrower than it can be read. */
export const MAX_COLUMNS = 3;

/** The minutes of a Serbian clock an instant stands at on `day`: 0 for an instant before the day began, 1440 for one after it ended. */
export function minutesOn(day: string, instant: string): number {
  const at = serbianDayOf(instant);
  if (at === null || at < day) return 0;
  if (at > day) return 1440;
  const clock = serbianClock(instant);
  return Number(clock.slice(0, 2)) * 60 + Number(clock.slice(3, 5));
}

/** A minute of the clock as the app writes it: 540 is "09:00", and the end of the day is "24:00". */
export const minutesClock = (minutes: number): string => `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;

/** Where the "sada" line stands on `day`, in minutes of its clock; null when `now` is not on that day. */
export function nowMinute(now: Date, day: string): number | null {
  return serbianDayOf(now) === day ? minutesOn(day, now.toISOString()) : null;
}

export type DayBlock = Readonly<{
  entry: PlannerEntry;
  /** The part of the Dogovor that lies on this day, in minutes of the clock; the end is the day's end for one that goes on past midnight. */
  from: number;
  to: number;
  /** How far down it is DRAWN: no shorter than `MIN_BLOCK_MINUTES`, so a short Dogovor is still a touch and its neighbours never lie under it. */
  drawnTo: number;
  column: number;
  /** How many columns the group of overlapping blocks it stands in is drawn in. */
  columns: number;
}>;

type Draft = { entry: PlannerEntry; from: number; to: number; drawnTo: number; column: number; columns: number };

/**
 * The Dogovori of one day as blocks on its hours. A Dogovor with a start and an end is a block from one to the other; one with only a
 * start ("od 14:00") has no length, so it is drawn a nominal one and says only the start. Blocks that overlap stand side by side, in as
 * many columns as the overlap needs, up to `MAX_COLUMNS`; one that would need another is returned in `overflow` to be listed.
 */
export function layoutDay(entries: readonly PlannerEntry[], day: string): { blocks: DayBlock[]; overflow: PlannerEntry[] } {
  const spans = entries.map(entry => {
    const from = entry.startsAt !== null ? minutesOn(day, entry.startsAt) : Math.max(0, (entry.endsAt !== null ? minutesOn(day, entry.endsAt) : 0) - MIN_BLOCK_MINUTES);
    const to = entry.endsAt !== null ? minutesOn(day, entry.endsAt) : Math.min(1440, from + MIN_BLOCK_MINUTES);
    return { entry, from, to, drawnTo: Math.min(1440, Math.max(to, from + MIN_BLOCK_MINUTES)) };
  }).sort((a, b) => a.from - b.from || b.drawnTo - a.drawnTo);
  const blocks: Draft[] = [], overflow: PlannerEntry[] = [];
  let group: Draft[] = [], columnEnds: number[] = [], groupEnd = -1;
  const settle = () => {
    for (const draft of group) draft.columns = columnEnds.length;
    blocks.push(...group);
    group = []; columnEnds = []; groupEnd = -1;
  };
  for (const span of spans) {
    // The day clips at midnight. Late starts belong in readable rows, not
    // a ten-pixel target; their actual timestamps stay unchanged.
    if (span.drawnTo - span.from < MIN_BLOCK_MINUTES) { overflow.push(span.entry); continue; }
    if (group.length && span.from >= groupEnd) settle();
    let column = columnEnds.findIndex(end => end <= span.from);
    if (column < 0) column = columnEnds.length;
    if (column >= MAX_COLUMNS) { overflow.push(span.entry); continue; }
    columnEnds[column] = span.drawnTo;
    group.push({ ...span, column, columns: 1 });
    groupEnd = Math.max(groupEnd, span.drawnTo);
  }
  settle();
  return { blocks, overflow };
}

/** The whole hours the day is drawn between: the usual ones, moved outwards to take in a block that stands outside them. */
export type TimelineRange = Readonly<{ from: number; to: number }>;
export function timelineRange(blocks: readonly Pick<DayBlock, 'from' | 'drawnTo'>[]): TimelineRange {
  let from = DAY_START_HOUR, to = DAY_END_HOUR;
  for (const block of blocks) {
    from = Math.min(from, Math.floor(block.from / 60));
    to = Math.max(to, Math.ceil(block.drawnTo / 60));
  }
  return { from, to };
}

/** How far from the top of the hours a minute of the clock stands, in dp. */
export const topOf = (minute: number, range: TimelineRange): number => ((minute - range.from * 60) / 60) * HOUR_HEIGHT;
