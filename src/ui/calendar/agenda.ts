import type { DogovorProjekcija } from '../../contracts/projections';
import type { WorkerCalendarEvent } from '../../contracts/workerCalendar';
import { calendarInstant } from '../../lib/calendarTime';
import { DOGOVORENA_ZONA } from '../../lib/dogovorenoVreme';
import { applicationPriceBasisText } from '../../lib/novac';
import { inicijali } from '../../lib/inicijali';
import { raspon, vreme } from '../../lib/vreme';
import { overlapsInterval } from './calendarPresentation';
import { serbianClock, serbianDayOf, serbianDayRange } from './serbianDays';

/**
 * The Dogovori of the planner ("Raspored"), built from two reads (round-1 critique A15): the worker schedule, which is the
 * one authority for the work I confirmed, and my Dogovori, which add my own tasks and every finished or waiting Dogovor that
 * has an exact accepted window. A day is a day of Serbian time (owner, 2026-10-07), the same as the clocks written on it.
 * Pure and dependency-free on purpose: the calendar screen must not reach the Dogovor presentation, whose photos pull the
 * media service and the Supabase client into the screen's suites. `planner.ts` puts my tasks and applications beside them.
 */

/**
 * A Dogovor as the calendar reads it. `tacanTermin` is the accepted exact window: an object when there is one, `null`
 * when the Dogovor has none, and absent when the list did not say (then the calendar cannot place the Dogovor and says
 * that it shows only the work I do, instead of calling the day empty). The Dogovori list carries it since the review of
 * owner step 10 (agreementClientService maps it from the accepted terms through lib/tacanTermin).
 */
export type AgendaAgreement = DogovorProjekcija;
export type AgendaState = 'CONFIRMED' | 'AWAITING_REQUESTER' | 'COMPLETED';

export const ROLE_WORKER = 'Uskačete';
export const ROLE_REQUESTER = 'Vaš zadatak';
/** A schedule row whose Dogovor the list did not confirm at the same version is still a confirmed term, never a guess. */
export const SCHEDULE_FALLBACK_TITLE = 'Potvrđen Dogovor';
export const LIST_FALLBACK_TITLE = 'Dogovor';

export type AgendaItem = Readonly<{
  key: string;
  agreementId: string;
  startsAt: string;
  endsAt: string;
  state: AgendaState;
  /** 'Uskačeš' or 'Tvoj zadatak'; null when the Dogovor does not say which side I am on. */
  role: string | null;
  /** The Dogovor's own title; null when it is unknown or empty (the row then shows `fallbackTitle`). */
  title: string | null;
  fallbackTitle: string;
  /** The agreed amount as written; '' when the Dogovor has none saved; null when it is not known here. */
  amount: string | null;
  /** The other person's name, when known. */
  person: string | null;
  /** The other person's public profile id (the one a photo is read by) and the letters that stand in for the photo; null when not said. */
  personProfileId: string | null;
  personInitials: string | null;
  /** Where, or '' when the Dogovor does not say. */
  place: string;
  /** A finished Dogovor that waits for my rating (the server's own flag, as the Dogovori list reads it). */
  ratingDue: boolean;
  /** A problem is open on an active Dogovor. */
  problem: boolean;
}>;

const PLACED: readonly AgendaState[] = ['CONFIRMED', 'AWAITING_REQUESTER', 'COMPLETED'];
const ACTIVE: readonly AgendaState[] = ['CONFIRMED', 'AWAITING_REQUESTER'];
const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();
const placed = (state: DogovorProjekcija['stanje']): state is AgendaState => (PLACED as readonly string[]).includes(state);

function mySide(agreement: AgendaAgreement): 'narucilac' | 'uskocer' | null {
  const me = agreement.ucesnici?.find(person => person.viSte);
  return me?.uloga === 'narucilac' || me?.uloga === 'uskocer' ? me.uloga : null;
}
/** Which side I am on, in the words the rows use ("Tvoj zadatak", "Uskačeš"); null when the Dogovor does not say. */
export function agendaRole(agreement: AgendaAgreement): string | null {
  const side = mySide(agreement);
  return side === 'narucilac' ? ROLE_REQUESTER : side === 'uskocer' ? ROLE_WORKER : null;
}
/** What the planner says about a Dogovor, the same wherever it draws one (the day, the loose list and the archive). */
export function agendaFacts(agreement: AgendaAgreement) {
  const other = agreement.ucesnici?.find(person => !person.viSte);
  const title = typeof agreement.naslov === 'string' ? agreement.naslov.trim().replace(/\s+/g, ' ') : '';
  const place = agreement.rezim === 'DALJINSKI' ? 'Na daljinu' : agreement.putanjaTekst ?? '';
  const person = other?.ime?.trim() || null;
  return { title: title || null, amount: agreement.cena?.prikaz ? `${agreement.cena.prikaz} ${applicationPriceBasisText(agreement.osnovaCene)}` : '', person, place,
    // The face is the other person's, read by their PUBLIC profile id (never the account id); the letters are the read's own, or the name's.
    personProfileId: other?.profilId ?? null, personInitials: other?.inicijali?.trim() || inicijali(person) };
}
/**
 * The Dogovori the list may add: placed states, never cancelled, and never my own confirmed work, which only the
 * schedule places (it is the authority, and the two reads may disagree for a moment).
 */
function candidate(agreement: AgendaAgreement, schedule: ReadonlySet<string>): boolean {
  return placed(agreement.stanje) && !schedule.has(agreement.id.toLowerCase())
    && !(mySide(agreement) === 'uskocer' && agreement.stanje === 'CONFIRMED');
}

/**
 * Every item of one week, in start order. (a) Every schedule event is an item of mine ('Uskačeš'); it takes its title,
 * amount, person, place and state only from the Dogovor with the same id and the same version that is still active
 * (agreed, or waiting for the completion to be confirmed), and otherwise stays a confirmed term without a title or an
 * amount. Marking the work done changes the Dogovor's execution state, not its version, and the schedule keeps the
 * event while the Dogovor is agreed (rpc_mark_work_done, 20260908120000; the calendar authority, 20260909110000), so my
 * own waiting Dogovor is the same version and says it waits, as the requester's side does. (b) When the list is loaded,
 * it adds each other Dogovor with an exact accepted window that overlaps the week.
 */
export function agendaItems({ events, agreements, from, to }: {
  events: readonly WorkerCalendarEvent[]; agreements: readonly AgendaAgreement[] | null; from: string; to: string;
}): AgendaItem[] {
  const items: AgendaItem[] = events.map(event => {
    const match = agreements?.find(item => same(item.id, event.agreementId) && item.verzija === event.agreementVersion
      && (ACTIVE as readonly string[]).includes(item.stanje));
    const known = match ? agendaFacts(match) : null;
    return { key: `event:${event.eventId}`, agreementId: event.agreementId, startsAt: event.startsAt, endsAt: event.endsAt,
      state: match ? match.stanje as AgendaState : 'CONFIRMED', role: ROLE_WORKER, title: known?.title ?? null,
      // A waiting row without a title is not called confirmed (round-5c): only a confirmed term takes that name.
      fallbackTitle: match && match.stanje !== 'CONFIRMED' ? LIST_FALLBACK_TITLE : SCHEDULE_FALLBACK_TITLE, amount: known ? known.amount : null, person: known?.person ?? null,
      personProfileId: known?.personProfileId ?? null, personInitials: known?.personInitials ?? null, place: known?.place ?? '',
      ratingDue: false, problem: match?.problemOtvoren === true };
  });
  if (agreements) {
    const schedule = new Set(events.map(event => event.agreementId.toLowerCase()));
    for (const agreement of agreements) {
      const window = agreement.tacanTermin;
      if (!window || !candidate(agreement, schedule) || !overlapsInterval(window.pocetak, window.kraj, from, to)) continue;
      const known = agendaFacts(agreement);
      items.push({ key: `agreement:${agreement.id}`, agreementId: agreement.id, startsAt: window.pocetak, endsAt: window.kraj,
        state: agreement.stanje as AgendaState, role: agendaRole(agreement),
        title: known.title, fallbackTitle: LIST_FALLBACK_TITLE, amount: known.amount, person: known.person,
        personProfileId: known.personProfileId, personInitials: known.personInitials, place: known.place,
        ratingDue: agreement.stanje === 'COMPLETED' && agreement.ocenaMoguca === true,
        problem: (ACTIVE as readonly string[]).includes(agreement.stanje) && agreement.problemOtvoren === true });
    }
  }
  return items.sort((a, b) => {
    const start = (calendarInstant(a.startsAt) ?? 0n) - (calendarInstant(b.startsAt) ?? 0n);
    return start < 0n ? -1 : start > 0n ? 1 : (a.title ?? a.fallbackTitle).localeCompare(b.title ?? b.fallbackTitle, 'sr');
  });
}

/**
 * Whether the list says enough to place every Dogovor the calendar should show. 'unknown' when one of them came without
 * saying whether it has an exact window: then the calendar shows only the work I do, and says so.
 */
export function agendaCoverage(agreements: readonly AgendaAgreement[], events: readonly WorkerCalendarEvent[]): 'full' | 'unknown' {
  const schedule = new Set(events.map(event => event.agreementId.toLowerCase()));
  return agreements.some(item => candidate(item, schedule) && item.tacanTermin === undefined) ? 'unknown' : 'full';
}

/**
 * Active Dogovori (agreed, or waiting for the completion to be confirmed) that have no exact accepted window, and so no
 * place on any day, in the order the list gave them. Those the list does not say about are left out: nothing is listed
 * that is not known.
 */
export function agreementsWithoutExactTerm(agreements: readonly AgendaAgreement[], events: readonly WorkerCalendarEvent[]): AgendaAgreement[] {
  const schedule = new Set(events.map(event => event.agreementId.toLowerCase()));
  return agreements.filter(item => (ACTIVE as readonly string[]).includes(item.stanje) && item.tacanTermin === null
    && !schedule.has(item.id.toLowerCase()));
}
/** How many there are: the number behind Početna's "bez tačnog termina" and behind the planner's own section. */
export function withoutExactTerm(agreements: readonly AgendaAgreement[], events: readonly WorkerCalendarEvent[]): number {
  return agreementsWithoutExactTerm(agreements, events).length;
}

/** The items of one day of Serbian time (23, 24 or 25 hours long, as the calendar says); the phone's own zone has no say. */
export function itemsOnDay(items: readonly AgendaItem[], day: string): AgendaItem[] {
  const range = serbianDayRange(day);
  return items.filter(item => overlapsInterval(item.startsAt, item.endsAt, range.from, range.to));
}

/** A clock of an agreed term, in Serbian time (owner rule 8.27): "09:15". */
export const agendaClock = serbianClock;
/** Whether the whole window lies on the day being read, in Serbian time (the rail's clocks then say everything). */
export function withinDay(item: Pick<AgendaItem, 'startsAt' | 'endsAt'>, day: string): boolean {
  return serbianDayOf(item.startsAt) === day && serbianDayOf(item.endsAt) === day;
}
/**
 * An item's window in Serbian time: its clocks alone ("09:15–10:45") when the whole window lies on the day being read,
 * the full window with its days otherwise ("23. sep · 22:00 – 24. sep · 06:00"). A clock change inside the window keeps
 * both offsets, as the app writes it everywhere.
 */
export function agendaWindow(item: Pick<AgendaItem, 'startsAt' | 'endsAt'>, day: string): string {
  const full = raspon(item.startsAt, item.endsAt, { zona: DOGOVORENA_ZONA });
  if (!withinDay(item, day)) return full;
  const prefix = `${vreme(item.startsAt, { zona: DOGOVORENA_ZONA }).split(' · ')[0]} · `;
  return full.startsWith(prefix) ? full.slice(prefix.length) : full;
}
