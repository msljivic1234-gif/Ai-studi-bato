import { zonedParts } from '../ui/calendar/calendarPresentation';
import { plural } from '../ui/system/plural';

/**
 * How long ago a moment was, as one short Serbian phrase (UX plan 2.14: "pre 2 dana" beside what a person reads).
 *
 * The first user is the answer of a task's owner to a question (`TaskQaInline`); the list cards and the task detail
 * name the age of a task the same way, so the words live here once:
 *
 *   under 5 minutes   "Upravo"            a day earlier than today   "juče"
 *   under an hour     "pre 25 min"        2 to 13 days               "pre 2 dana", "pre 13 dana"
 *   earlier today     "pre 3 sata"        2 to 4 weeks               "pre 2 nedelje", "pre 4 nedelje"
 *   a month or more   "pre mesec dana", "pre 2 meseca", "pre 5 meseci"
 *   a year or more    "pre godinu dana", "pre 2 godine", "pre 5 godina"
 *
 * Days are CALENDAR days in Serbian time, not stretches of 24 hours: a question answered at 23:30 reads "juče" at
 * 00:30, and the 25-hour day of a clock change is still one day. The count word follows the number through the
 * app's one Serbian plural helper. The weeks begin at 14 days (the plan's example list names both "pre 21 dan" and
 * "pre 3 nedelje" for the same age; the one cut is `WEEKS_FROM` below, changed here and nowhere else).
 *
 * A missing or unreadable moment, an unknown zone and a moment far in the future give null: no age is invented. A
 * moment a few minutes ahead of this phone is the phone's clock running behind the server's, and reads "Upravo".
 */
export type StarostOpcije = {
  /** "Now"; fixed only by tests. */
  sada?: Date;
  /** The zone whose calendar counts the days; Serbian time by default, as the agreed terms are read. */
  zona?: string;
};

const MINUTE = 60_000, HOUR = 3_600_000, DAY = 86_400_000;
/** A server moment this far ahead of the phone's clock is still "just now": phones run behind. */
const FUTURE_TOLERANCE = 10 * MINUTE;
/** From this many days the age is said in weeks, from 30 in months, from 365 in years. */
const WEEKS_FROM = 14, MONTHS_FROM = 30, YEARS_FROM = 365;

const sat = (count: number) => plural(count, 'sat', 'sata', 'sati');
const dan = (count: number) => plural(count, 'dan', 'dana', 'dana');
const nedelja = (count: number) => plural(count, 'nedelja', 'nedelje', 'nedelja');
const mesec = (count: number) => plural(count, 'mesec', 'meseca', 'meseci');
const godina = (count: number) => plural(count, 'godina', 'godine', 'godina');

/** Whole civil days from the day of `from` to the day of `to`, both read in `zona`. */
function civilDays(from: Date, to: Date, zona: string): number {
  const utc = (day: string) => Date.UTC(Number(day.slice(0, 4)), Number(day.slice(5, 7)) - 1, Number(day.slice(8, 10)));
  return Math.round((utc(zonedParts(to, zona).date) - utc(zonedParts(from, zona).date)) / DAY);
}

export function starost(value: string | number | Date | null | undefined, { sada = new Date(), zona = 'Europe/Belgrade' }: StarostOpcije = {}): string | null {
  const instant = value instanceof Date ? value : typeof value === 'number' || (typeof value === 'string' && value) ? new Date(value) : null;
  if (!instant || Number.isNaN(instant.getTime()) || Number.isNaN(sada.getTime())) return null;
  const elapsed = sada.getTime() - instant.getTime();
  if (elapsed < -FUTURE_TOLERANCE) return null;
  if (elapsed < 5 * MINUTE) return 'Upravo';
  if (elapsed < HOUR) return `pre ${Math.floor(elapsed / MINUTE)} min`;
  let days: number;
  try { days = civilDays(instant, sada, zona); } catch { return null; }
  if (days <= 0) return `pre ${sat(Math.floor(elapsed / HOUR))}`;
  if (days === 1) return 'juče';
  if (days < WEEKS_FROM) return `pre ${dan(days)}`;
  if (days < MONTHS_FROM) return `pre ${nedelja(Math.floor(days / 7))}`;
  if (days < YEARS_FROM) {
    const months = Math.floor(days / MONTHS_FROM);
    return months === 1 ? 'pre mesec dana' : `pre ${mesec(months)}`;
  }
  const years = Math.floor(days / YEARS_FROM);
  return years === 1 ? 'pre godinu dana' : `pre ${godina(years)}`;
}
