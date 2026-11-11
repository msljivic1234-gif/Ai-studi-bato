import { BEZ_IZNOSA } from '../../lib/novac';
import { SCHEDULE_FALLBACK_TITLE, agendaClock, agendaWindow } from './agenda';
import { statusSpoken } from './PlannerChip';
import type { PlannerEntry } from './planner';

/**
 * What a Dogovor of the planner says about itself, in words, whichever way it is drawn (a card in a list, a block on the hours, a row in
 * the sheet of the ones without a term): its time, the name of what pressing it opens, and the sentence a screen reader hears. One place,
 * so a card and a block can never say two things.
 */

/** The time an entry writes for itself: its window ("09:00–11:00"), its one stored bound ("od 14:00"), or its own words when it has no exact term. */
export function entryTime(entry: PlannerEntry, day: string): string | null {
  if (!entry.exact) return entry.timeWord;
  if (entry.startsAt !== null && entry.endsAt !== null) return agendaWindow({ startsAt: entry.startsAt, endsAt: entry.endsAt }, day);
  return entry.startsAt !== null ? `od ${agendaClock(entry.startsAt)}` : `do ${agendaClock(entry.endsAt ?? '')}`;
}

/**
 * What pressing it opens. An untitled Dogovor names what it is: a term from the schedule is a confirmed one; a Dogovor from the list may
 * be finished or waiting, so it is not called confirmed (review of owner step 10).
 */
export function entryOpens(entry: PlannerEntry): string {
  return entry.title ? `Otvori Dogovor ${entry.title}`
    : entry.fallbackTitle === SCHEDULE_FALLBACK_TITLE ? 'Otvori Dogovor sa potvrđenim terminom' : 'Otvori Dogovor';
}

/**
 * Whether the state is a word worth drawing. "Dogovoren" says what everything on a schedule already is, so it is not a chip here; "U toku",
 * "Čeka potvrdu" and "Završen" tell the person something the card does not.
 */
export const saysSomething = (entry: PlannerEntry): boolean => !('key' in entry.status && entry.status.key === 'task.agreed');

/** The orange lines of an entry: what waits for the person, and a collision. */
export const entryNotes = (entry: PlannerEntry, overlap: string | null): string[] => [entry.note, overlap].filter((line): line is string => !!line);

/** The whole of it for a screen reader: where it stands, whose side, when, with whom, the amount, where, and the orange lines. */
export function entrySpoken(entry: PlannerEntry, { day, zoneNote, overlap }: { day: string; zoneNote: boolean; overlap: string | null }): string {
  const time = entryTime(entry, day);
  return [saysSomething(entry) ? statusSpoken(entry.status) : null, entry.role, time && zoneNote ? `${time}, po vremenu u Srbiji` : time, entry.person,
    entry.amount === null ? null : entry.amount || BEZ_IZNOSA, entry.place || null, ...entryNotes(entry, overlap)]
    .filter((part): part is string => !!part).join(', ');
}
