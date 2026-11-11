import type { AvailabilityRule } from '../../contracts/workerAvailability';
import { shiftDate } from './calendarPresentation';

/**
 * Copy one day of the regular week onto other days (round-1 critique A18: a Monday-to-Friday week took five complete
 * flows). The target days end up with the slots the source day shows, and nothing else of their own:
 *
 * - every rule loses the target days (a slot that was the target's own is gone from it);
 * - every rule that holds the source day gains the target days (the same slot, shared, not a copy);
 * - a rule left with no day at all is removed.
 *
 * A slot over midnight is one slot kept as two rules: the night ("22:00–24:00" on its day) and its continuation
 * ("00:00–06:00" on the next day, dated one day later, with the same name and pause), which is how the Termin sheet saves
 * it. The part after midnight belongs to the night, not to the day it falls on:
 *
 * - a night copied onto a target continues on the day after that target, and the source's own continuation stays on
 *   the day after the source, even when that day is a target (review of owner step 10: "Isto za sve radne dane" from a
 *   Monday 22:00–06:00 used to leave five nights ending at midnight);
 * - a continuation stays on its day while its night stays, so replacing a day never cuts the night before it;
 * - a target's own night that is replaced takes its continuation with it.
 *
 * A 00:00 slot that is not the continuation of a night is an ordinary slot of its day and is copied like any other.
 * Ids, dates, labels and the active flag are kept, so no rule is invented and the number of rules never grows. The
 * source day itself is never a target. Applying the same copy twice gives the same week.
 */
export function copyDay(rules: readonly AvailabilityRule[], source: number, targets: readonly number[]): AvailabilityRule[] {
  const into = [...new Set(targets)].filter(day => day !== source);
  if (!into.length) return [...rules];
  // A rule's days under the plain rule, before the nights are joined up again.
  const plain = (rule: AvailabilityRule) => {
    const kept = rule.weekdays.filter(day => !into.includes(day));
    return rule.weekdays.includes(source) ? [...kept, ...into] : kept;
  };
  const nights = nightsOf(rules);
  return rules.flatMap(rule => {
    const own = nights.get(rule.id);
    let days: number[];
    if (!own) days = plain(rule);
    else {
      const owned = new Set(own.flatMap(night => night.weekdays.map(next)).filter(day => rule.weekdays.includes(day)));
      days = [
        // Its own days, which a target loses, and what the source shows at 00:00, which the targets gain. The source
        // keeps its 00:00 slot even when that slot ends a target's night (round-5c: copying Tuesday onto Monday used to
        // take Tuesday's own 00:00–06:00 away with Monday's replaced night).
        ...rule.weekdays.filter(day => !owned.has(day) && !into.includes(day)),
        ...(rule.weekdays.includes(source) ? [source, ...into] : []),
        // The part after midnight stays wherever its night stays.
        ...own.flatMap(night => plain(night).map(next).filter(day => owned.has(day))),
        // A night copied from the source continues on the day after each target.
        ...own.flatMap(night => night.weekdays.includes(source) && rule.weekdays.includes(next(source)) ? into.map(next) : []),
      ];
    }
    if (!days.length) return [];
    const sorted = [...new Set(days)].sort((a, b) => a - b);
    return [sorted.length === rule.weekdays.length && sorted.every((day, index) => day === rule.weekdays[index])
      ? rule : { ...rule, weekdays: sorted }];
  });
}

/**
 * Whether copying the source day onto the targets takes away a slot a target has of its own, which is when the screen
 * asks first. It is read from the copy itself, so the question and the result cannot disagree: the continuation of the
 * source's own night on the next day, or of a night that stays, is not the target's own slot.
 */
export function copyTakesAway(rules: readonly AvailabilityRule[], source: number, targets: readonly number[]): boolean {
  const into = [...new Set(targets)].filter(day => day !== source);
  if (!into.length) return false;
  const after = new Map(copyDay(rules, source, into).map(rule => [rule.id, rule]));
  return into.some(day => rules.some(rule => rule.weekdays.includes(day) && !after.get(rule.id)?.weekdays.includes(day)));
}

/**
 * The part after midnight of the day's own night, when the day has one: a copy carries it onto the day after each target,
 * which the day's own summary ("22:00–24:00") does not show, so the copy sheet and its question say it (round-5c).
 */
export function nightContinuation(rules: readonly AvailabilityRule[], day: number): AvailabilityRule | undefined {
  for (const [id, nights] of nightsOf(rules)) {
    if (nights.some(night => night.weekdays.includes(day))) return rules.find(rule => rule.id === id);
  }
  return undefined;
}

const next = (day: number) => (day + 1) % 7;
const MIDNIGHT = /^00:00(?::00(?:\.0{1,6})?)?$/;
const DAY_END = /^24:00(?::00(?:\.0{1,6})?)?$/;
function nextDate(value: string | null): string | null | undefined {
  if (value === null) return null;
  try { return shiftDate(value, 1); } catch { return undefined; }
}
/** Whether `after` is the part after midnight of the night `night`, as the Termin sheet saves a slot over midnight. */
function continues(night: AvailabilityRule, after: AvailabilityRule): boolean {
  if (after.id === night.id || !MIDNIGHT.test(after.startTime) || DAY_END.test(after.endTime)) return false;
  if (after.label !== night.label || after.active !== night.active) return false;
  const startsOn = nextDate(night.startsOn), endsOn = nextDate(night.endsOn);
  return startsOn !== undefined && endsOn !== undefined && after.startsOn === startsOn && after.endsOn === endsOn
    && night.weekdays.some(day => after.weekdays.includes(next(day)));
}
/**
 * Each continuation's nights, by the continuation's id. A night is a rule that ends at 24:00 and does not start at
 * 00:00 (a whole day is not a night); it pairs with the first rule, in the order given, that continues it.
 */
function nightsOf(rules: readonly AvailabilityRule[]): Map<string, AvailabilityRule[]> {
  const found = new Map<string, AvailabilityRule[]>();
  for (const night of rules) {
    if (!DAY_END.test(night.endTime) || MIDNIGHT.test(night.startTime)) continue;
    const after = rules.find(rule => continues(night, rule));
    if (after) found.set(after.id, [...(found.get(after.id) ?? []), night]);
  }
  return found;
}
