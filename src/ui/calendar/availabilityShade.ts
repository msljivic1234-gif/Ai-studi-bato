import type { AvailabilityRule, WorkerAvailability } from '../../contracts/workerAvailability';
import { civilInstant, shiftDate, weekdayOf, zonedParts } from './calendarPresentation';
import { instantMs, serbianClock, serbianDayRange } from './serbianDays';

/**
 * The soft shade behind a day of the month, and the band beside the hours of a day (owner, 2026-10-07 and 8 Oct 2026, "Raspored kao
 * kalendar"): "on this day I have said I can work". It is read from the availability the worker already keeps
 * (`workerAvailabilityClientService.read`): the weekly rules and the dated exceptions of Dostupnost. It says nothing about being booked
 * (a Dogovor on the day is a Dogovor, drawn as one) and nothing about "Mogu odmah" (that switch is about now, not about a day).
 *
 * The availability is kept in its own named zone and the planner's days are Serbian days, so every rule is turned into exact
 * instants first and only then cut by the Serbian day. A person who keeps Dostupnost in another zone sees the shade where the
 * hours really fall in Serbian time.
 *
 * Pure: no React, no native module, no read of the phone's zone.
 */

/** A half-open span of epoch milliseconds. */
type Span = readonly [number, number];

/** Spans merged into the fewest that cover the same time, earliest first. */
function merge(spans: readonly Span[]): Span[] {
  const sorted = [...spans].filter(([from, to]) => to > from).sort((a, b) => a[0] - b[0]);
  const merged: [number, number][] = [];
  for (const [from, to] of sorted) {
    const last = merged[merged.length - 1];
    if (last && from <= last[1]) last[1] = Math.max(last[1], to);
    else merged.push([from, to]);
  }
  return merged;
}
/** What is left of `spans` once `cuts` are taken out of them. */
function without(spans: readonly Span[], cuts: readonly Span[]): Span[] {
  let left: Span[] = merge(spans);
  for (const [cutFrom, cutTo] of merge(cuts)) {
    left = left.flatMap(([from, to]): Span[] => {
      if (cutTo <= from || cutFrom >= to) return [[from, to]];
      return [...(cutFrom > from ? [[from, cutFrom] as Span] : []), ...(cutTo < to ? [[cutTo, to] as Span] : [])];
    });
  }
  return left;
}
const within = (spans: readonly Span[], from: number, to: number): Span[] =>
  spans.map(([a, b]): Span => [Math.max(a, from), Math.min(b, to)]).filter(([a, b]) => b > a);

/** Minutes since midnight of a stored civil clock ("09:00:00.123456", "24:00:00"); null when it is not one. */
function minutesOf(clock: string): number | null {
  const match = /^(\d{2}):(\d{2})/.exec(clock);
  if (!match) return null;
  const minutes = Number(match[1]) * 60 + Number(match[2]);
  return minutes <= 1440 && Number(match[2]) < 60 ? minutes : null;
}
/** The instant of a civil clock on a civil date of the availability's zone; null in a clock change's gap or repeat. */
function at(date: string, minutes: number, zone: string): number | null {
  if (minutes >= 1440) return at(shiftDate(date, 1), minutes - 1440, zone);
  const clock = `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes - Math.floor(minutes / 60) * 60).padStart(2, '0')}`;
  return instantMs(civilInstant(date, clock, zone).value);
}
/** What one weekly rule makes available on one civil date of the availability's zone. */
function ruleSpans(rule: AvailabilityRule, date: string, zone: string): Span[] {
  if (!rule.active || !rule.weekdays.includes(weekdayOf(date).day) || rule.startsOn > date || (rule.endsOn !== null && rule.endsOn < date)) return [];
  const [start, end] = [minutesOf(rule.startTime), minutesOf(rule.endTime)];
  if (start === null || end === null || end <= start) return [];
  const [from, to] = [at(date, start, zone), at(date, end, zone)];
  return from !== null && to !== null && to > from ? [[from, to]] : [];
}

/**
 * The time a worker has said they can work on one Serbian day, as exact spans. The weekly rules give the time; a dated exception
 * marked "Dostupan" adds to it and one marked "Nedostupan" takes from it. Anything that cannot be read is left out, never guessed.
 */
function availableSpans(availability: Pick<WorkerAvailability, 'timezone' | 'rules' | 'windows'>, day: string): Span[] {
  const range = serbianDayRange(day);
  const [from, to] = [instantMs(range.from), instantMs(range.to)];
  if (from === null || to === null) return [];
  try {
    const zone = availability.timezone;
    const first = zonedParts(new Date(from), zone).date, last = zonedParts(new Date(to - 1), zone).date;
    const given: Span[] = [];
    for (let date = first; date <= last; date = shiftDate(date, 1)) {
      for (const rule of availability.rules) given.push(...ruleSpans(rule, date, zone));
    }
    const windows = (state: 'AVAILABLE' | 'UNAVAILABLE') => availability.windows.filter(window => window.state === state)
      .flatMap((window): Span[] => { const [a, b] = [instantMs(window.startsAt), instantMs(window.endsAt)]; return a !== null && b !== null ? [[a, b]] : []; });
    return within(without([...given, ...windows('AVAILABLE')], windows('UNAVAILABLE')), from, to);
  } catch { return []; }
}

export type DayAvailability = Readonly<{
  /** How long, in minutes of real time (a day with a clock change is 23 or 25 hours long). */
  minutes: number;
  /** In words, in Serbian time: "09:00–12:00, 13:00–17:00". */
  spoken: string;
}>;

const spanClock = (ms: number, dayEnd: number) => ms === dayEnd ? '24:00' : serbianClock(new Date(ms).toISOString());
const SPOKEN_SPANS = 3;

/** A stretch of a Serbian day in minutes of its clock ("09:00" is 540; the end of the day is 1440). */
export type MinuteSpan = Readonly<{ from: number; to: number }>;

/** The minutes of a Serbian clock an instant of the day stands at; the end of the day is 1440, not a "00:00" of the next one. */
function clockMinutes(ms: number, dayEnd: number): number {
  if (ms >= dayEnd) return 1440;
  const clock = serbianClock(new Date(ms).toISOString());
  return Number(clock.slice(0, 2)) * 60 + Number(clock.slice(3, 5));
}

/**
 * The stretches of one Serbian day a worker has said they can work, as minutes of its clock, earliest first and never overlapping: what
 * the day view draws as the band beside its hours. The same spans `dayAvailability` counts, so the shade of a day in the month and the band
 * in its hours can never disagree about whether the day is one the worker has given.
 */
export function availabilitySpans(availability: Pick<WorkerAvailability, 'timezone' | 'rules' | 'windows'>, day: string): MinuteSpan[] {
  const dayEnd = instantMs(serbianDayRange(day).to) ?? 0;
  return availableSpans(availability, day).map(([from, to]): MinuteSpan => ({ from: clockMinutes(from, dayEnd), to: clockMinutes(to, dayEnd) }))
    .filter(span => span.to > span.from);
}

/** What a worker has said they can work on one Serbian day; null when nothing, so no shade is drawn. */
export function dayAvailability(availability: Pick<WorkerAvailability, 'timezone' | 'rules' | 'windows'>, day: string): DayAvailability | null {
  const spans = availableSpans(availability, day);
  if (!spans.length) return null;
  const dayEnd = instantMs(serbianDayRange(day).to) ?? 0;
  const words = spans.slice(0, SPOKEN_SPANS).map(([from, to]) => `${spanClock(from, dayEnd)}–${spanClock(to, dayEnd)}`);
  const more = spans.length - SPOKEN_SPANS;
  return { minutes: Math.round(spans.reduce((sum, [from, to]) => sum + (to - from), 0) / 60_000),
    spoken: `${words.join(', ')}${more > 0 ? ` i još ${more}` : ''}` };
}
