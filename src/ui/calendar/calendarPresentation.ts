import { calendarInstant } from '../../lib/calendarTime';

const pad = (value: number) => String(value).padStart(2, '0');
export function deviceDate(value: Date): string {
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;
}
export function deviceTime(value: Date): string { return `${pad(value.getHours())}:${pad(value.getMinutes())}`; }
export function shiftDate(value: string, days: number): string {
  const date = new Date(`${value}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}
/**
 * One formatter per zone. A formatter is the expensive part of reading a clock in a zone, and the month view reads a few hundred of them
 * at once (every day of the grid, every rule of the worker's hours, every instant of a Dogovor); a new one per call was slow enough on a
 * phone to be felt (`messages/threadModel.ts` worked round it with a formatter of its own). A zone that does not exist throws, as it did,
 * and is not kept.
 */
const formatters = new Map<string, Intl.DateTimeFormat>();
function formatterOf(timezone: string): Intl.DateTimeFormat {
  const known = formatters.get(timezone);
  if (known) return known;
  const made = new Intl.DateTimeFormat('en-GB', { timeZone: timezone, year: 'numeric', month: '2-digit',
    day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' });
  if (formatters.size >= 16) formatters.clear();
  formatters.set(timezone, made);
  return made;
}
export function zonedParts(value: Date, timezone: string) {
  const parts = formatterOf(timezone).formatToParts(value);
  const get = (type: string) => parts.find(part => part.type === type)?.value ?? '';
  return { date: `${get('year')}-${get('month')}-${get('day')}`, time: `${get('hour')}:${get('minute')}:${get('second')}` };
}
/** Resolve civil input in its saved zone; DST gaps and repeated times require an explicit choice. */
export function civilInstant(date: string, time: string, timezone: string): { value: string | null; error: string | null } {
  const fullTime = /^\d{2}:\d{2}$/.test(time) ? `${time}:00` : time;
  const target = calendarInstant(`${date}T${fullTime}Z`);
  if (target === null) return { value: null, error: 'Izaberi ispravan datum i vreme.' };
  const milliseconds = Number(target / 1000n);
  try {
    // Sample both sides of every possible nearby transition, then round-trip candidates.
    const offsets = new Set<number>();
    for (const hours of [-48, -24, 0, 24, 48]) {
      const probe = new Date(milliseconds + hours * 3_600_000);
      const wall = zonedParts(probe, timezone);
      offsets.add(Date.parse(`${wall.date}T${wall.time}Z`) - probe.getTime());
    }
    const candidates = [...offsets].map(offset => new Date(milliseconds - offset))
      .filter(candidate => {
        const wall = zonedParts(candidate, timezone);
        return wall.date === date && wall.time === fullTime;
      });
    if (candidates.length !== 1) return { value: null, error: candidates.length === 0
      ? 'Ovo vreme ne postoji zbog pomeranja sata. Izaberi drugo vreme.'
      : 'Ovo vreme se ponavlja zbog pomeranja sata. Izaberi nedvosmisleno vreme.' };
    return { value: candidates[0].toISOString(), error: null };
  } catch { return { value: null, error: 'Proveri vremensku zonu.' }; }
}
export function weekDates(selected: string): string[] {
  const day = new Date(`${selected}T12:00:00Z`).getUTCDay();
  const monday = shiftDate(selected, -((day + 6) % 7));
  return Array.from({ length: 7 }, (_, index) => shiftDate(monday, index));
}
export function localDayRange(day: string) {
  // Calendar navigation follows the device zone, including 23/25-hour local days.
  return { from: new Date(`${day}T00:00:00`).toISOString(), to: new Date(`${shiftDate(day, 1)}T00:00:00`).toISOString() };
}
const SHORT_MONTHS = ['jan', 'feb', 'mar', 'apr', 'maj', 'jun', 'jul', 'avg', 'sep', 'okt', 'nov', 'dec'] as const;
/**
 * "9. okt", never "09. okt". The day and the month are spelled here, not by the locale: the date data on the owner's Android phone writes this
 * Serbian pattern with a two-digit day ("Od 09. okt", "Četvrtak, 08. okt", "05. okt" on his screenshots of 8 Oct 2026) while Node writes "9. okt",
 * so the tests never saw it.
 */
export function displayDate(day: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(day);
  const month = match ? SHORT_MONTHS[Number(match[2]) - 1] : undefined;
  if (!match || !month) return new Date(`${day}T12:00:00Z`).toLocaleDateString('sr-Latn-RS', { timeZone: 'UTC', day: 'numeric', month: 'short' });
  return `${Number(match[3])}. ${month}`;
}
export function overlapsInterval(start: string, end: string, from: string, to: string): boolean {
  const starts = calendarInstant(start), ends = calendarInstant(end), rangeStart = calendarInstant(from), rangeEnd = calendarInstant(to);
  return starts !== null && ends !== null && rangeStart !== null && rangeEnd !== null && starts < rangeEnd && ends > rangeStart;
}
/** The clock of an instant on this phone, to the minute (one time format: seconds never). */
export function displayTime(instant: string): string {
  const date = new Date(instant);
  return Number.isNaN(date.getTime()) ? '' : deviceTime(date);
}
/**
 * A stored civil clock as a person reads it: "16:00", never "16:00:00" or "09:00:00.123456" (Dostupnost on the
 * phone, 2026-09-23). Only the display is shortened; the stored value keeps its precision. Anything that is not a
 * clock is returned as it came, so a malformed value is never disguised as a valid one.
 */
export function civilClock(value: string): string {
  return /^\d{2}:\d{2}(?::\d{2}(?:\.\d{1,6})?)?$/.test(value) ? value.slice(0, 5) : value;
}
/**
 * A civil date the way vreme() writes the day of a moment: "23. sep", the year only when it is not the current one
 * ("5. jan 2027"). A value that is not a calendar date is returned as it came.
 */
export function civilDay(value: string, now = new Date()): string {
  const parsed = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T12:00:00Z`) : null;
  if (!parsed || Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) return value;
  const year = value.slice(0, 4);
  return year === deviceDate(now).slice(0, 4) ? displayDate(value) : `${displayDate(value)} ${year}`;
}
/** The zone a schedule is kept in, in words: Serbian time by name, never "Europe/Belgrade". */
export function scheduleZone(timezone: string): string {
  return timezone === 'Europe/Belgrade' ? 'Po vremenu u Srbiji' : `Vremenska zona: ${timezone}`;
}
export const weekdays = [
  { day: 1, short: 'Pon', name: 'Ponedeljak' }, { day: 2, short: 'Uto', name: 'Utorak' },
  { day: 3, short: 'Sre', name: 'Sreda' }, { day: 4, short: 'Čet', name: 'Četvrtak' },
  { day: 5, short: 'Pet', name: 'Petak' }, { day: 6, short: 'Sub', name: 'Subota' },
  { day: 0, short: 'Ned', name: 'Nedelja' },
] as const;

/** The weekday of a civil date, as the week list names it (0 = Sunday, as `weekdays` counts). */
export function weekdayOf(day: string) {
  const index = new Date(`${day}T12:00:00Z`).getUTCDay();
  return weekdays.find(item => item.day === index) ?? weekdays[0];
}
/**
 * The heading of one day of the calendar: "Četvrtak, 24. sep", the year only when it is not the current one
 * ("Utorak, 5. jan 2027"). Round-1 critique A16: "Dogovoreno za 24. sep" did not say which weekday it was.
 */
export function dayHeading(day: string, now = new Date()): string {
  return `${weekdayOf(day).name}, ${civilDay(day, now)}`;
}
/**
 * A week as one short label: "22–28. sep" inside one month, "29. sep – 5. okt" across two, and the year only when it
 * is not the current one ("22–28. sep 2027"); a week across the new year names both years ("28. dec 2026 – 3. jan 2027").
 * The old "21. sep–27. sep" said the month twice and pushed the week's arrows onto a second line at 320 dp.
 */
export function weekLabel(days: readonly string[], now = new Date()): string {
  const first = days[0], last = days[days.length - 1];
  if (!first || !last) return '';
  const current = deviceDate(now).slice(0, 4);
  const [firstYear, lastYear] = [first.slice(0, 4), last.slice(0, 4)];
  if (firstYear !== lastYear) return `${displayDate(first)} ${firstYear} – ${displayDate(last)} ${lastYear}`;
  const year = lastYear === current ? '' : ` ${lastYear}`;
  if (first.slice(0, 7) === last.slice(0, 7)) return `${Number(first.slice(8, 10))}–${displayDate(last)}${year}`;
  return `${displayDate(first)} – ${displayDate(last)}${year}`;
}
/**
 * Whether a schedule's zone needs saying (round-1 critique A19): not on a phone in Serbian time with a schedule kept in
 * Serbian time, where "Po vremenu u Srbiji" said nothing; always when either of them is elsewhere, or the phone does
 * not say. The phone's zone is passed in (lib/vreme's zonaTelefona), since lib/vreme already reads this file.
 */
export function showScheduleZone(timezone: string, phoneZone: string | undefined): boolean {
  return timezone !== 'Europe/Belgrade' || phoneZone !== 'Europe/Belgrade';
}
