import type { WorkerCalendarEvent } from '../../contracts/workerCalendar';
import { calendarInstant } from '../../lib/calendarTime';
import type { StatusKey, StatusShape, StatusTone } from '../system/StatusChip';
import { LIST_FALLBACK_TITLE, ROLE_REQUESTER, ROLE_WORKER, agendaCoverage, agendaFacts, agendaItems, agendaRole, agreementsWithoutExactTerm,
  type AgendaAgreement, type AgendaItem, type AgendaState } from './agenda';
import { overlapsInterval } from './calendarPresentation';
import { instantMs, serbianDayRange } from './serbianDays';

/**
 * "Raspored" (owner, 2026-10-07; narrowed 2026-10-08): the DOGOVORI of both sides, and nothing else. The owner's phone showed a schedule
 * that mixed three things ("1 Dogovor · 6 zadataka": my published tasks, my applications and my Dogovori, under four chips and three
 * words for "flexible"), and the decision was that a schedule is where a person looks to see WHEN something is agreed: Raspored is the
 * Dogovori, my own tasks stay in "Moji zadaci" and my applications in "Moje prijave". A Dogovor with an accepted time stands on its day (a
 * whole window, or its accepted start alone: "od 14:00", the way Početna writes it); one with none is counted in the bar "N Dogovora bez
 * termina" and asks for a term. Both are brought to one shape here, `PlannerEntry`, so the month, the week, the day on its hours and the
 * overlap line all read one list. The bar's name is true of everything it counts: a Dogovor that has a start is never one of them (the
 * owner's phone, 8 Oct 2026: "Od 9. okt · 17:00" under "Bez tačnog termina" was a date inside a heading that denied it).
 *
 * Nothing is invented. An entry is placed on a day only by exact instants the read gave (a Dogovor's accepted window, or its accepted
 * start); a Dogovor without them is listed under its OWN words for its time (only a stored end, "Do 9. okt · 17:00 · početak nije potvrđen"),
 * never parsed from a sentence and never put on a day. Every day is a day of Serbian time (`serbianDays.ts`).
 *
 * Pure and dependency-light on purpose: no React and no native module, so the screens' pure helpers load in every suite.
 */

/**
 * Where a thing stands, said by the shared chip (`ui/system/StatusChip`). A state the chip's table has a word for is its key; the
 * few that it has not ("Čeka potvrdu", and the words of the Arhiva: "Zatvoren", "Zatvorena") carry their own word with the shape and
 * the tone the chip would give them, and are drawn by the same marks.
 */
export type PlannerStatus =
  | Readonly<{ key: StatusKey; detail?: string }>
  | Readonly<{ word: string; shape: StatusShape; tone: StatusTone; detail?: string }>;

export const PROBLEM_NOTE = 'Prijavljen je problem u Dogovoru';

/** One Dogovor of mine, placed on a day by its exact window or listed for lack of one. */
export type PlannerEntry = Readonly<{
  key: string;
  /** What the row opens: the Dogovor's id. */
  id: string;
  title: string | null;
  fallbackTitle: string;
  /** The accepted window, whole or with one bound as stored; null for a Dogovor that has none. */
  startsAt: string | null;
  endsAt: string | null;
  /** The Dogovor has an exact term, so it stands on a day. */
  exact: boolean;
  /** Its own words for its time, when it has no exact term to draw; null when they would only say what the section says. */
  timeWord: string | null;
  status: PlannerStatus;
  /** Something waits for me here: the orange mark in the week. */
  waits: boolean;
  /** Over: drawn quiet, and a grey mark in the week. */
  done: boolean;
  /** A term of mine that can collide with another one: an active Dogovor. */
  term: boolean;
  /** The term is work I do (a Dogovor where I "Uskačeš"): the one kind that cannot be in two places. */
  commitsMe: boolean;
  /** An orange line about it other than the overlap ("Prijavljen je problem u Dogovoru"). */
  note: string | null;
  role: string | null;
  person: string | null;
  /** The other person's public profile id (a photo is read by it) and the letters that stand in for the photo; null when the read did not say. */
  personProfileId: string | null;
  personInitials: string | null;
  amount: string | null;
  place: string;
  /** Nobody has proposed a term yet and none waits: the row offers "Predloži termin" (the same rule Početna asks it by). */
  proposesTerm: boolean;
}>;

const tidy = (value: unknown): string | null => typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') || null : null;
/** The name a row goes by. */
export const entryTitle = (entry: Pick<PlannerEntry, 'title' | 'fallbackTitle'>): string => entry.title ?? entry.fallbackTitle;

/**
 * A Dogovor's own words for its time, said once and in one voice. Under "Termin još nije dogovoren" the words "Termin nije dogovoren" /
 * "Termin nije potvrđen" say what the heading says, so they are not drawn (null); the three ways the app used to say "flexible"
 * ("Fleksibilan termin", "Fleksibilan raspon", "Fleksibilno") are the one word "Fleksibilno"; and the zero of a day that a phone's own
 * date pattern writes ("Od 09. okt") is not written ("Od 9. okt"), the way `displayDate` writes it everywhere else.
 */
export function termWord(text: unknown): string | null {
  const said = tidy(text);
  if (!said || /^termin nije (dogovoren|potvrđen)\.?$/i.test(said)) return null;
  return said.replace(/^fleksibilan (termin|raspon)/i, 'Fleksibilno').replace(/^fleksibilno/i, 'Fleksibilno')
    .replace(/(^|[\s·])0(\d)\. (?=\p{L}{3})/gu, '$1$2. ');
}

/* ------------------------------------------------------------------------------------------------------------------ */
/* One entry from each kind of Dogovor                                                                                  */
/* ------------------------------------------------------------------------------------------------------------------ */

/**
 * Where a Dogovor stands. "U toku" is the agreed time having arrived (owner decision d01): an agreed Dogovor whose window holds
 * `now`. A Dogovor waiting for the completion to be confirmed is "Čeka potvrdu", orange for the person who has to confirm it.
 */
function dogovorStatus(state: AgendaState, role: string | null, ratingDue: boolean, startsAt: string | null, endsAt: string | null, now: Date):
  { status: PlannerStatus; waits: boolean } {
  if (state === 'COMPLETED') return { status: ratingDue ? { key: 'task.completed', detail: 'oceni' } : { key: 'task.completed' }, waits: ratingDue };
  if (state === 'AWAITING_REQUESTER') {
    const mine = role === ROLE_REQUESTER;
    return { status: { word: 'Čeka potvrdu', shape: mine ? 'dot' : 'ring', tone: mine ? 'attention' : 'neutral' }, waits: mine };
  }
  const [from, to, at] = [instantMs(startsAt), instantMs(endsAt), now.getTime()];
  return { status: { key: from !== null && to !== null && from <= at && at < to ? 'task.now' : 'task.agreed' }, waits: false };
}

/** A Dogovor with an exact window, from the planner's Dogovor item. */
export function dogovorEntry(item: AgendaItem, now: Date = new Date()): PlannerEntry {
  const { status, waits } = dogovorStatus(item.state, item.role, item.ratingDue, item.startsAt, item.endsAt, now);
  const done = item.state === 'COMPLETED';
  return { key: item.key, id: item.agreementId, title: item.title, fallbackTitle: item.fallbackTitle,
    startsAt: item.startsAt, endsAt: item.endsAt, exact: true, timeWord: null, status, waits: waits || item.problem, done, term: !done,
    commitsMe: item.role === ROLE_WORKER, note: item.problem ? PROBLEM_NOTE : null,
    role: item.role, person: item.person, personProfileId: item.personProfileId, personInitials: item.personInitials,
    amount: item.amount, place: item.place, proposesTerm: false };
}

/**
 * Whether the row may ask for a term: a confirmed Dogovor that has neither a window nor even an accepted start, with no change waiting
 * to give it one. Both fields have to be there and be empty: a list that did not read the terms leaves them out, and that is not "no term".
 * (The rule Početna asks "Predloži termin" by, written here so the planner stays free of the data layer.)
 */
const canProposeTerm = (agreement: AgendaAgreement): boolean => agreement.stanje === 'CONFIRMED' && agreement.tacanTermin === null
  && agreement.prihvacenPocetak === null && !agreement.izmenaCeka;

/**
 * An active Dogovor that has an accepted START and no accepted end ("Od 14:00 · kraj nije potvrđen"): it has a day and an hour to say, so
 * it stands on that day with the one bound it has ("od 14:00"), exactly as Početna writes the next appointment ("Sutra · od 10:00"). The
 * end is never invented, and a lone start has no length, so it never collides with another term. Null when the Dogovor has a whole
 * window (the schedule's way), no start, or the read did not say (`prihvacenPocetak` absent): nothing is placed that is not known.
 */
export function startOnlyDogovorEntry(agreement: AgendaAgreement, now: Date = new Date()): PlannerEntry | null {
  const start = agreement.prihvacenPocetak;
  if (agreement.tacanTermin !== null || typeof start !== 'string' || calendarInstant(start) === null) return null;
  const facts = agendaFacts(agreement), role = agendaRole(agreement);
  const { status, waits } = dogovorStatus(agreement.stanje as AgendaState, role, false, start, null, now);
  const problem = agreement.problemOtvoren === true;
  return { key: `agreement:${agreement.id}`, id: agreement.id, title: facts.title, fallbackTitle: LIST_FALLBACK_TITLE,
    startsAt: start, endsAt: null, exact: true, timeWord: null, status, waits: waits || problem,
    done: false, term: true, commitsMe: role === ROLE_WORKER, note: problem ? PROBLEM_NOTE : null,
    role, person: facts.person, personProfileId: facts.personProfileId, personInitials: facts.personInitials,
    amount: facts.amount, place: facts.place, proposesTerm: false };
}

/** An active Dogovor that has no accepted start and no exact window: it stands in a section under its own words for the term, and asks for one when it may. */
export function looseDogovorEntry(agreement: AgendaAgreement, now: Date = new Date()): PlannerEntry {
  const facts = agendaFacts(agreement), role = agendaRole(agreement);
  const { status, waits } = dogovorStatus(agreement.stanje as AgendaState, role, false, null, null, now);
  const problem = agreement.problemOtvoren === true;
  return { key: `loose:${agreement.id}`, id: agreement.id, title: facts.title, fallbackTitle: LIST_FALLBACK_TITLE,
    startsAt: null, endsAt: null, exact: false, timeWord: termWord(agreement.vremeTekst), status, waits: waits || problem,
    done: false, term: true, commitsMe: role === ROLE_WORKER, note: problem ? PROBLEM_NOTE : null,
    role, person: facts.person, personProfileId: facts.personProfileId, personInitials: facts.personInitials,
    amount: facts.amount, place: facts.place, proposesTerm: canProposeTerm(agreement) };
}

/* ------------------------------------------------------------------------------------------------------------------ */
/* The planner: everything, placed or listed                                                                           */
/* ------------------------------------------------------------------------------------------------------------------ */

export type Planner = Readonly<{
  /** Dogovori with an accepted time (a whole window, or a start alone) that touches the window, in start order. They stand on days. */
  placed: readonly PlannerEntry[];
  /** Active Dogovori with no accepted start and no exact window: "Termin još nije dogovoren". */
  loose: readonly PlannerEntry[];
}>;

/** The instant an entry is ordered by: its start, or its end when only that is stored. */
const startOf = (entry: PlannerEntry): bigint => calendarInstant(entry.startsAt ?? entry.endsAt) ?? 0n;

/** Whether an exact term touches the span [from, to). A lone start is a moment, a lone end is the moment the thing is over by. */
function touches(entry: Pick<PlannerEntry, 'startsAt' | 'endsAt'>, from: string, to: string): boolean {
  if (entry.startsAt !== null && entry.endsAt !== null) return overlapsInterval(entry.startsAt, entry.endsAt, from, to);
  const [moment, begin, end] = [calendarInstant(entry.startsAt ?? entry.endsAt), calendarInstant(from), calendarInstant(to)];
  if (moment === null || begin === null || end === null) return false;
  return entry.startsAt !== null ? moment >= begin && moment < end : moment > begin && moment <= end;
}

/**
 * My Dogovori, as the window sees them. `from` and `to` are the instants of the window the schedule was read for. The Dogovori are the
 * planner's own (`agendaItems`: the worker schedule is the authority for the work I do); the ones without a whole window are known only
 * when the list says enough to know which they are (`agendaCoverage`): nothing is listed that is not known. Of those, the ones with an
 * accepted start stand on its day (when it falls in the window; a start outside it is for another week's read), the others are listed.
 */
export function buildPlanner({ events, agreements, from, to, now = new Date() }: {
  events: readonly WorkerCalendarEvent[]; agreements: readonly AgendaAgreement[] | null; from: string; to: string; now?: Date;
}): Planner {
  const placed: PlannerEntry[] = agendaItems({ events, agreements, from, to }).map(item => dogovorEntry(item, now));
  const loose: PlannerEntry[] = [];
  if (agreements && agendaCoverage(agreements, events) === 'full') {
    for (const agreement of agreementsWithoutExactTerm(agreements, events)) {
      const started = startOnlyDogovorEntry(agreement, now);
      if (!started) loose.push(looseDogovorEntry(agreement, now));
      else if (touches(started, from, to)) placed.push(started);
    }
  }
  // Stable: the Dogovori came in start order and title order, and what shares a start keeps the order it was given.
  placed.sort((a, b) => startOf(a) < startOf(b) ? -1 : startOf(a) > startOf(b) ? 1 : 0);
  return { placed, loose };
}

/** Every entry that stands on a day of Serbian time, in start order. */
export function entriesOnDay(placed: readonly PlannerEntry[], day: string): PlannerEntry[] {
  const { from, to } = serbianDayRange(day);
  return placed.filter(entry => entry.exact && touches(entry, from, to));
}

/**
 * The Dogovori that stand on each of the given days, in one pass over the days (the month grid asks for forty-odd of them at once):
 * what a day's dots, its spoken name and its list all read. A day the planner did not read is the caller's to leave out.
 */
export function entriesByDay(placed: readonly PlannerEntry[], days: readonly string[]): Record<string, PlannerEntry[]> {
  return Object.fromEntries(days.map(day => [day, entriesOnDay(placed, day)]));
}

/* ------------------------------------------------------------------------------------------------------------------ */
/* The day                                                                                                              */
/* ------------------------------------------------------------------------------------------------------------------ */

/**
 * "Preklapa se sa {naslov}": for each entry of the day whose exact window overlaps another's, the line to draw under it. Two
 * terms collide only when one of them is work I do (a worker cannot be in two places; a person with two helpers coming at once
 * is not double-booked), neither is finished, and both have a whole window (a lone bound has no length to overlap with). With
 * several, the first is named and the rest counted: "Preklapa se sa A i još 2".
 */
export function overlapNotes(entriesOfDay: readonly PlannerEntry[]): ReadonlyMap<string, string> {
  const terms = entriesOfDay.filter(entry => entry.term && entry.startsAt !== null && entry.endsAt !== null);
  const notes = new Map<string, string>();
  for (const entry of terms) {
    const others = terms.filter(other => other !== entry && (entry.commitsMe || other.commitsMe)
      && overlapsInterval(entry.startsAt!, entry.endsAt!, other.startsAt!, other.endsAt!));
    if (others.length) notes.set(entry.key, `Preklapa se sa ${entryTitle(others[0])}${others.length > 1 ? ` i još ${others.length - 1}` : ''}`);
  }
  return notes;
}

/** What an empty day says. */
export const EMPTY_DAY = 'Ništa nije zakazano za ovaj dan.';
