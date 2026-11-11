import type { PotrebaProjekcija } from '../contracts/projections';
import { calendarInstant } from '../lib/calendarTime';
import { prijava as prijave } from '../ui/system/plural';
import type { StatusKey } from '../ui/system/StatusChip';
import { endingOf } from './needEnding';

/**
 * Where one of MY tasks stands, in the owner's eight words (decision 2026-10-07): Nacrt, Objavljen, Bira se, Dogovoren, U toku,
 * Završen, Otkazan, Istekao; and, only where it carries a fact the word does not, ONE line of data under them (plan 2.2, 3.5; the
 * rule of 8 Oct 2026: no sentence that explains, "Čekaš prijave. Vidiš ih ovde i u zvoncu." is gone for good). Pure: it reads the
 * task the screen already has and nothing else, so the list, the tests and a later Arhiva all agree on what a task is called.
 *
 * Nothing here is invented. A word the read cannot support is not drawn:
 * - "Bira se · N" needs the server's own count of applications to choose among (`brojPrijavaZaIzbor`); an unknown count says nothing, never zero;
 * - "Završen", "Otkazan" and "Istekao" need the raw ending the server sent (`kraj`, see `needEnding.ts`); a closed task whose ending was not
 *   carried, and an ARCHIVED one (the table has no word for it and nothing in the app sets it), get no chip and a plain sentence;
 * - "U toku" is the task's OWN fixed window reaching today's time while the task is going. A Dogovor may carry a changed time that this
 *   list does not read, so a flexible term ("Sutra, fleksibilno") is never "U toku": it stays "Dogovoren";
 * - a word that the chip already says is not said again: "Dogovoren" has no line that says "Sva mesta su dogovorena".
 */
export type TaskChip = { status: StatusKey; /** What the word alone cannot say, after a dot ("Bira se · 3"). */ detail?: string };
export type OwnTaskStanding = {
  /** The one chip the row wears; null when no honest word exists. */
  chip: TaskChip | null;
  /** The one line of data under it ("Još nema prijava", "3 prijave"); null when the chip says all there is to say. */
  next: string | null;
  /** True when `next` is the way to the applications waiting for my choice: the row's foot opens them. */
  toApplications: boolean;
};

/** The two lines of an open task that has nothing to choose among: no application came yet, or none of them can be chosen now. */
export const NO_APPLICATIONS = 'Još nema prijava';
export const NOTHING_TO_CHOOSE = 'Nema prijava za izbor';
/** The line of an open task whose count of applications to choose among is `waiting` (a known number) and whose total is `total`. */
export const noApplicationsLine = (waiting: number | null, total: number): string | null => waiting === 0 ? total > 0 ? NOTHING_TO_CHOOSE : NO_APPLICATIONS : null;

/** The agreed places of a task whose every place is agreed, and whose own fixed window has begun and not yet ended. */
function agreedTimeHasCome(item: PotrebaProjekcija, now: Date): boolean {
  const schedule = item.schedule;
  if (!schedule || schedule.kind !== 'FIXED_WINDOW') return false;
  const from = calendarInstant(schedule.startsAt);
  if (from === null) return false;
  const to = calendarInstant(schedule.endsAt);
  const at = BigInt(now.getTime()) * 1000n;
  return at >= from && (to === null || at < to);
}

export function ownTaskStanding(item: PotrebaProjekcija, now: Date = new Date()): OwnTaskStanding {
  const count = item.brojPrijavaZaIzbor;
  const waiting = typeof count === 'number' && Number.isSafeInteger(count) && count >= 0 ? count : null;
  const { popunjeno, ukupno } = item.pokrivenost;
  const none = (chip: TaskChip | null, next: string | null): OwnTaskStanding => ({ chip, next, toApplications: false });
  switch (item.stanje) {
    case 'NACRT':
      // The list says "Nacrti" and the page says "Nacrt": a line under it would only say the same again.
      return none({ status: 'task.draft' }, null);
    case 'OBJAVLJENA':
      // Not yet read as "no applications": an unknown count says nothing.
      return none({ status: 'task.published' }, noApplicationsLine(waiting, item.brojPrijava));
    case 'CEKA_PRIJAVE':
      return waiting !== null && waiting > 0
        ? { chip: { status: 'task.choosing', detail: String(waiting) }, next: prijave(waiting), toApplications: true }
        : none({ status: 'task.choosing' }, null);
    case 'DELIMICNO_POPUNJENA': {
      // How many places are agreed is the chip's own detail ("Dogovoren · 1 od 2"); the line says only what is to be chosen.
      if (waiting !== null && waiting > 0) return { chip: { status: 'task.choosing', detail: String(waiting) }, next: prijave(waiting), toApplications: true };
      return none({ status: 'task.agreed', detail: `${popunjeno} od ${ukupno}` }, null);
    }
    case 'POPUNJENA': {
      // The read folds the server's ACTIVE into POPUNJENA whatever the coverage is, and a search that was closed with places still open
      // (the owner stopped looking for the rest) is ACTIVE with fewer places agreed than needed. The chip then carries how many are
      // agreed, and the one thing it cannot say is that the search is closed. Every place agreed says nothing more than the chip.
      const everyPlace = popunjeno >= ukupno;
      const detail = everyPlace ? {} : { detail: `${popunjeno} od ${ukupno}` };
      const closed = everyPlace ? null : 'Potraga je zatvorena';
      return agreedTimeHasCome(item, now) ? none({ status: 'task.now', ...detail }, closed) : none({ status: 'task.agreed', ...detail }, closed);
    }
    case 'ZATVORENA':
      switch (endingOf(item)) {
        case 'COMPLETED': return none({ status: 'task.completed' }, null);
        case 'CANCELLED': return none({ status: 'task.cancelled' }, null);
        case 'EXPIRED': return none({ status: 'task.expired' }, null);
        case 'ARCHIVED': return none(null, 'Zadatak je u arhivi.');
        default: return none(null, 'Zadatak je zatvoren.');
      }
  }
}
