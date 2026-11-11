import type { DogovorProjekcija } from '../../contracts/projections';
import { calendarInstant } from '../../lib/calendarTime';
import { DOGOVORENA_ZONA } from '../../lib/dogovorenoVreme';
import { withoutExactTerm } from '../calendar/agenda';
import { civilInstant, displayDate, scheduleZone, shiftDate, showScheduleZone, weekDates, weekdayOf, zonedParts } from '../calendar/calendarPresentation';
import { dogovora, plural } from '../system/plural';

/**
 * "Raspored" on Početna (owner, 2026-10-07: the planner is called Raspored): the next accepted appointment, day first and in
 * Serbian time ("Danas · 14:00–16:00"), and one quiet line about the rest. Pure and dependency-light on purpose: the screen
 * suites load it through `homeSnapshot`, and nothing here reads the phone's own zone.
 *
 * Every word of time is computed from the accepted instants of the Dogovor (`tacanTermin`, `prihvacenPocetak`), never
 * parsed from a display sentence, and always read in `DOGOVORENA_ZONA`: a phone set to another zone says the same day.
 * A term with one stored bound keeps one bound ("Danas · od 14:00"); the other end is never invented.
 */

/** The accepted appointment of a Dogovor as exact instants (microseconds). An end exists only when the terms name both ends. */
export type AcceptedTerm = Readonly<{ start: string; end: string | null; startAt: bigint; endAt: bigint | null }>;

/**
 * The exact window when the Dogovor has one (`tacanTermin`: both ends exact, the start before the end), else the accepted
 * start alone, else null: a Dogovor with no accepted instant has no day and no clock to say.
 */
export function acceptedTerm(row: Pick<DogovorProjekcija, 'prihvacenPocetak' | 'tacanTermin'>): AcceptedTerm | null {
  const window = row.tacanTermin;
  if (window) {
    const startAt = calendarInstant(window.pocetak), endAt = calendarInstant(window.kraj);
    if (startAt !== null && endAt !== null && startAt < endAt) return { start: window.pocetak, end: window.kraj, startAt, endAt };
  }
  const startAt = calendarInstant(row.prihvacenPocetak);
  return startAt === null ? null : { start: row.prihvacenPocetak as string, end: null, startAt, endAt: null };
}

/** Not over yet: an exact window is over when it ends, a lone start when it has passed. A window under way is still ahead of you. */
export function notOver(term: AcceptedTerm, nowAt: bigint): boolean {
  return term.endAt !== null ? term.endAt > nowAt : term.startAt >= nowAt;
}

const DAY_MS = 86_400_000;
const daysBetween = (from: string, to: string) => Math.round((Date.parse(`${to}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`)) / DAY_MS);

/**
 * A civil day in words as seen from `today` (both "YYYY-MM-DD" in Serbian time): "Danas", "Sutra", "Juče", the weekday for
 * the five days after tomorrow ("Petak"), and beyond that the weekday with its date ("Četvrtak, 15. okt"; the year only
 * when it is not the current one), because a bare weekday a week away would name two days.
 */
export function dayWord(day: string, today: string): string {
  const ahead = daysBetween(today, day);
  if (ahead === 0) return 'Danas';
  if (ahead === 1) return 'Sutra';
  if (ahead === -1) return 'Juče';
  const weekday = weekdayOf(day).name;
  if (ahead >= 2 && ahead <= 6) return weekday;
  const year = day.slice(0, 4);
  return `${weekday}, ${displayDate(day)}${year === today.slice(0, 4) ? '' : ` ${year}`}`;
}

/** The first line of the block, as written and as spoken (a screen reader says "od 14:00 do 16:00", not a dash). */
export type RasporedWhen = Readonly<{ text: string; spoken: string }>;

const instantMs = (at: bigint) => Number(at / 1000n);
const instantParts = (at: bigint) => zonedParts(new Date(instantMs(at)), DOGOVORENA_ZONA);

/** The zone's offset at an instant, "UTC+02:00": named only when a clock change falls inside a window, as the app writes it everywhere. */
function offsetAt(at: bigint): string {
  const ms = instantMs(at), wall = instantParts(at);
  const minutes = Math.round((Date.parse(`${wall.date}T${wall.time}Z`) - Math.floor(ms / 1000) * 1000) / 60_000);
  const abs = Math.abs(minutes), pad = (value: number) => String(value).padStart(2, '0');
  return `UTC${minutes < 0 ? '−' : '+'}${pad(Math.floor(abs / 60))}:${pad(abs - Math.floor(abs / 60) * 60)}`;
}

/**
 * "Danas · 14:00–16:00", "Sutra · od 10:00" (one stored bound), "Petak · 22:00 – subota 06:00" (across midnight), "Danas ·
 * 14:00" (both ends in the same minute). `now` fixes what "today" is, in Serbian time. A clock change inside the window
 * names both offsets, so two equal wall clocks never pass for a window of no length. Null when the instants cannot be read.
 */
export function rasporedWhen(term: AcceptedTerm, now: Date): RasporedWhen | null {
  try {
    if (Number.isNaN(now.getTime())) return null;
    const start = instantParts(term.startAt), today = zonedParts(now, DOGOVORENA_ZONA).date;
    const day = dayWord(start.date, today), from = start.time.slice(0, 5);
    if (term.endAt === null) return { text: `${day} · od ${from}`, spoken: `${day}, od ${from}` };
    const end = instantParts(term.endAt), clockEnd = end.time.slice(0, 5);
    const [offStart, offEnd] = [offsetAt(term.startAt), offsetAt(term.endAt)];
    const shifted = offStart !== offEnd;
    const a = shifted ? `${from} (${offStart})` : from, b = shifted ? `${clockEnd} (${offEnd})` : clockEnd;
    if (end.date === start.date) {
      return !shifted && from === clockEnd ? { text: `${day} · ${from}`, spoken: `${day}, ${from}` }
        : { text: `${day} · ${a}–${b}`, spoken: `${day}, od ${a} do ${b}` };
    }
    const endDay = dayWord(end.date, today).toLowerCase();
    return { text: `${day} · ${a} – ${endDay} ${b}`, spoken: `${day}, od ${a} do ${endDay} ${b}` };
  } catch { return null; }
}

/** The calendar week (Monday to Sunday) that today belongs to in Serbian time, as exact instants: from the first midnight to the next. */
export function serbianWeek(now: Date): { from: bigint; to: bigint } | null {
  try {
    if (Number.isNaN(now.getTime())) return null;
    const days = weekDates(zonedParts(now, DOGOVORENA_ZONA).date);
    const from = calendarInstant(civilInstant(days[0], '00:00', DOGOVORENA_ZONA).value);
    const to = calendarInstant(civilInstant(shiftDate(days[6], 1), '00:00', DOGOVORENA_ZONA).value);
    return from !== null && to !== null ? { from, to } : null;
  } catch { return null; }
}

/** Whether any part of the appointment falls in the week; a lone start counts when it is inside. */
export function inWeek(term: AcceptedTerm, week: { from: bigint; to: bigint }): boolean {
  return term.startAt < week.to && (term.endAt ?? term.startAt + 1n) > week.from;
}

/** The verb agrees with the count the way `plural` chooses the noun (one rule, not a second one): "1 Dogovor čeka", "2 Dogovora čekaju", "5 Dogovora čeka". */
const cekaju = (count: number) => plural(count, 'čeka', 'čekaju', 'čeka').replace(/^\d+ /, '');

/**
 * The one grey line of the block, in Dogovori throughout: what is counted is agreements, never "zadatak". Each part is left
 * out when it is zero, and the whole line when all are:
 * "Ove nedelje još 2 Dogovora · 1 Dogovor bez tačnog termina · 1 Dogovor čeka završetak". Only the first part is about a
 * week; a Dogovor with no exact term has no day, and one whose term has passed has no day left.
 */
export function moreLine(thisWeek: number, withoutTerm: number, awaitingFinish = 0): string | null {
  const parts = [thisWeek > 0 ? `Ove nedelje još ${dogovora(thisWeek)}` : null,
    withoutTerm > 0 ? `${dogovora(withoutTerm)} bez tačnog termina` : null,
    awaitingFinish > 0 ? `${dogovora(awaitingFinish)} ${cekaju(awaitingFinish)} završetak` : null]
    .filter((part): part is string => part !== null);
  return parts.length ? parts.join(' · ') : null;
}

/**
 * The active Dogovori that have no day in the schedule ahead: those with no exact term, and those that were confirmed, whose
 * exact term has already passed and that nobody has marked done ("čeka završetak").
 */
export type LooseCounts = Readonly<{ withoutTerm: number; awaitingFinish: number }>;

/**
 * What the Raspored block says: the first line (written and spoken), the quiet line under the person, and the zone in words
 * ("Po vremenu u Srbiji") when the phone is not in Serbian time or does not say; each of the last two is null when there is nothing to say.
 */
export type HomeRaspored = Readonly<{ when: string; spoken: string; more: string | null; zone: string | null }>;

/**
 * The block for the featured appointment. `others` are the other appointments that are not over yet; only those with an
 * exact window are counted as "this week" (a lone start is not counted here: it has no length to say). The card's one grey line says
 * that and nothing else: the Dogovori the schedule ahead has no day for (`loose`, see `LooseCounts`) were counted in it as well, and the
 * owner's phone (8 Oct 2026: "natrpano, previše teksta") showed them as a long line of counts under the person. They are asked for
 * under "Čeka te" and listed in Raspored, under "Termin još nije dogovoren"; `loose` stays in the signature for the snapshot that
 * counts them. The agreed time is always read in Serbian time; `phoneZone` only decides whether that is said in words, by the planner's own rule.
 */
export function rasporedOf(featured: AcceptedTerm, others: readonly AcceptedTerm[], loose: LooseCounts, now: Date,
  phoneZone: string | undefined): HomeRaspored | null {
  const when = rasporedWhen(featured, now);
  if (!when) return null;
  const week = serbianWeek(now);
  const thisWeek = week ? others.filter(term => term.endAt !== null && inWeek(term, week)).length : 0;
  return { when: when.text, spoken: when.spoken, more: moreLine(thisWeek, 0, 0),
    zone: showScheduleZone(DOGOVORENA_ZONA, phoneZone) ? scheduleZone(DOGOVORENA_ZONA) : null };
}

/**
 * The active Dogovori that have no whole exact window, except the featured one (none is left out when `featuredId` is null): the
 * rule of `withoutExactTerm`. Since 8 Oct 2026 Početna draws no count of them (the quiet line was a weak row), and Raspored lists
 * under "Termin još nije dogovoren" only those with no accepted start either, so this number is the snapshot's own, not a number
 * any screen shows. Nothing is counted that is not known.
 */
export function withoutTermCount(agreements: readonly DogovorProjekcija[], featuredId: string | null = null): number {
  return withoutExactTerm(featuredId === null ? agreements : agreements.filter(row => row.id !== featuredId), []);
}

/**
 * The CONFIRMED Dogovori whose exact term has already passed (its window ended at or before `nowAt`) and that are not marked
 * done: the work was due and nobody has said it is finished. Only an exact window can tell: a lone accepted start has no
 * end to have passed (it is counted as having no exact term), a term the list did not say is unknown, and a Dogovor already
 * marked done, completed or cancelled is not waiting for anyone to finish it. Without a clock (`nowAt` null) nothing is counted.
 */
export function awaitingFinishCount(agreements: readonly DogovorProjekcija[], nowAt: bigint | null): number {
  if (nowAt === null) return 0;
  return agreements.filter(row => {
    if (row.stanje !== 'CONFIRMED') return false;
    const term = acceptedTerm(row);
    return term !== null && term.endAt !== null && term.endAt <= nowAt;
  }).length;
}

/**
 * The block without a card (coordinator, 2026-10-07: an active Dogovor whose term is not confirmed, or whose term has passed
 * unfinished, must not vanish from Početna). When no accepted appointment lies ahead, those Dogovori are still counted in one
 * quiet line, "1 Dogovor bez tačnog termina" / "2 Dogovora čekaju završetak"; null when there are none.
 */
export function looseLine(loose: LooseCounts): string | null {
  return moreLine(0, loose.withoutTerm, loose.awaitingFinish);
}
