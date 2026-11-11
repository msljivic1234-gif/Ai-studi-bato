import type { NeedSearchState } from '../../contracts/needSearchRecovery';
import type { PotrebaProjekcija } from '../../contracts/projections';
import { calendarInstant } from '../../lib/calendarTime';
import { readinessCopy, type NeedPublicationReadiness } from '../../data/needPublicationReadiness';
import { NO_APPLICATIONS, NOTHING_TO_CHOOSE, ownTaskStanding, type TaskChip } from '../../data/ownTaskStanding';
import { nedostajeOsoba, prijava as prijave } from '../system/plural';

/**
 * How many people a task still needs, as a sentence the verb agrees with (plan 3.5): "Nedostaje još jedna osoba.", "Nedostaju još 2
 * osobe.", "Nedostaje još 5 osoba.", "Nedostaje još 21 osoba.". The verb follows the number the way the noun does: plural for 2 to 4
 * (and 22 to 24, never 12 to 14), singular for the rest. It was "Nedostaje još 2 ljudi".
 */
export const missingPeople = nedostajeOsoba;

/**
 * What the owner's OWN task page says about itself (plan 2.2, 2.10.5 and 3.5; owner, 2026-10-07: "vidno i lako razumljivo"; owner, 8 Oct
 * 2026: one block of state on top, no sentence that explains): ONE state (the chip), ONE line of data (what the task has now: "Još nema
 * prijava", "3 prijave"), at most ONE green action, and the quiet ways in that the green one does not already offer. Pure: it reads the
 * task the screen already has (and, when the screen has read it, the search state for the missing places) and nothing else, so the
 * page, its tests and the list of "Moji zadaci" (`data/ownTaskStanding`, whose chip this borrows) agree on what a task is called.
 * Nothing here asks the server anything.
 *
 * Nothing is invented. A word the read cannot support is not drawn:
 * - "Bira se · N" and "Pogledaj prijave" need the server's own count of applications to choose among; an unknown count says
 *   "Pogledaj prijave" over the total the read has and never a number it does not;
 * - "Dogovor je otkazan" is said ONLY when it is certain. The search state counts every Dogovor and the places the live ones cover;
 *   a completed Dogovor covers places and a cancelled one does not, so a task that has Dogovori and covers NO place has only
 *   cancelled ones. With a place covered the same two counts cannot tell a cancelled Dogovor from a completed one, and the page
 *   then says what the task is doing now and nothing about the past;
 * - the green action is the owner's move. When there is nothing for the owner to do ("Još nema prijava"), there is no green action;
 * - a line that the chip already says is not drawn: "Dogovoren" has no line "Sva mesta su dogovorena".
 */

/** What the page needs of the search state (`rpc_get_need_search_state`, read by the screen's recovery controller). */
export type OverviewSearch = Pick<NeedSearchState,
  'status' | 'coveredSlots' | 'searchAuthority' | 'searchTimeAdmitted' | 'agreementCount' | 'activeAgreementCount'>;

/** Which callback the green action calls; the page maps it, this file never holds a handler. */
export type OverviewPrimaryKind = 'REVIEW' | 'EDIT' | 'CANDIDATES' | 'AGREEMENTS';
export type OverviewPrimary = {
  kind: OverviewPrimaryKind;
  label: string;
  /** What a screen reader hears when the words alone do not say what the number beside them means. */
  spoken?: string;
};

export type Overview = {
  /** The one chip at the top; null when no honest word exists (an archived task, a closed one whose ending was not carried). */
  chip: TaskChip | null;
  /** What cannot wait and the chip does not say, before the line ("Dogovor je otkazan"). */
  notice: string | null;
  /** The one line of data, what the task has now ("Još nema prijava", "3 prijave"); null when the chip says all there is to say. */
  line: string | null;
  /** How many applications `line` counts: the block draws that many faces (at most three). 0 when the line counts none. */
  applicants: number;
  /** The closed search, said once and word for word as it always was ("1 od 2 dogovoreno · preostala potraga je zatvorena"). */
  note: string | null;
  /** The one green action. Null when there is nothing for the owner to do, or when the screen's own recovery action replaces it. */
  primary: OverviewPrimary | null;
  /**
   * A draft the gate holds back for a reason that is not the owner's to fix (photos still being processed, the rules or the
   * check not ready): no green action, and the page offers to read again instead.
   */
  waits: boolean;
  /** Quiet rows that lead where the green action does not: the applications, the Dogovori. */
  rows: { applications: boolean; agreements: boolean };
};

/** The gate's answers that wait, or are not the owner's doing; the owner can only read again. */
const WAIT_CODES: ReadonlySet<string> = new Set(['PUBLIC_MEDIA_NOT_READY', 'POLICY_NOT_READY', 'POLICY_CONTENT_NOT_READY', 'EVALUATOR_UNAVAILABLE']);
/** The gate's answers the owner fixes in the conversation (the place, the country). */
const FIX_CODES: ReadonlySet<string> = new Set(['LOCATION_INCOMPLETE', 'COUNTRY_NOT_READY']);

const OPEN = new Set(['OBJAVLJENA', 'CEKA_PRIJAVE', 'DELIMICNO_POPUNJENA']);
const NOTE_STATES = new Set(['OBJAVLJENA', 'CEKA_PRIJAVE', 'DELIMICNO_POPUNJENA', 'POPUNJENA']);

export function ownTaskOverview(input: {
  need: PotrebaProjekcija;
  /** The remaining search was closed by the owner (`ru4Production.remainingSearchState`). */
  remainingClosed: boolean;
  /** What the publication gate said about a draft; absent means not asked. */
  readiness?: NeedPublicationReadiness | null;
  /** What the screen read about the search, and whether its own section about the search is on the screen (then it speaks for the search). */
  search?: { state: OverviewSearch | null; speaks: boolean } | null;
  /** The footer's action is replaced by the search recovery's own; whatever this page would have offered there becomes a quiet row. */
  overridden?: boolean;
  /** The screen can open the Dogovori. */
  canOpenAgreements?: boolean;
  now?: Date;
}): Overview {
  const { need, remainingClosed } = input;
  const standing = ownTaskStanding(need, input.now ?? new Date());
  const { popunjeno, ukupno } = need.pokrivenost;
  const total = need.brojPrijava;
  const raw = need.brojPrijavaZaIzbor;
  const waiting = typeof raw === 'number' && Number.isSafeInteger(raw) && raw >= 0 ? raw : null;
  const state = input.search?.state ?? null;
  const speaks = input.search?.speaks === true;

  if (need.stanje === 'NACRT') {
    const gate = input.readiness ?? { kind: 'UNKNOWN' as const };
    const held = readinessCopy(gate) !== null;
    const code = gate.kind === 'NOT_READY' ? gate.code : null;
    const waits = !!code && WAIT_CODES.has(code);
    const primary: OverviewPrimary | null = !held ? { kind: 'REVIEW', label: 'Pregledaj za objavu' }
      : waits ? null
        // The place and the country are fixed where they are asked, in the conversation. The copy of every other answer sends the
        // owner to the review ("Otvori pregled da vidiš šta nedostaje"), which lists what is missing.
        : code && FIX_CODES.has(code) ? { kind: 'EDIT', label: 'Otvori razgovor i dopuni' }
          : { kind: 'REVIEW', label: 'Pregledaj za objavu' };
    // The chip says "Nacrt" and the one action says what to do with it: a sentence about the draft would say the same a third time.
    return { chip: standing.chip, notice: null, line: null, applicants: 0, note: null, primary, waits,
      rows: { applications: false, agreements: false } };
  }

  const open = OPEN.has(need.stanje);
  const closed = remainingClosed || state?.searchAuthority === 'CLOSED';
  // The search no longer takes applications for the missing places: the owner closed it, or its time is over. Then "Još nema prijava"
  // would promise what is not so, and what the search is doing is said by its own section (or by the closed-search line) and not by this page.
  const quiet = closed || speaks || (!!state && !state.searchTimeAdmitted);
  const cancelled = open && !!state && (state.status === 'PUBLISHED' || state.status === 'SELECTION')
    && state.coveredSlots === 0 && state.agreementCount > 0;
  const canChoose = open && !closed && (waiting ?? 0) > 0;
  const canLook = open && !closed && waiting === null && total > 0;

  // The chip is the list's own word. A search the owner closed cannot take a choice, so it is not "Bira se".
  let chip = standing.chip;
  if (closed && (need.stanje === 'OBJAVLJENA' || need.stanje === 'CEKA_PRIJAVE')) chip = { status: 'task.published' };
  else if (closed && need.stanje === 'DELIMICNO_POPUNJENA') chip = { status: 'task.agreed', detail: `${popunjeno} od ${ukupno}` };
  else if (need.stanje === 'OBJAVLJENA' && canChoose) chip = { status: 'task.choosing', detail: String(waiting) };
  else if (need.stanje === 'POPUNJENA' && popunjeno < ukupno && chip && !chip.detail) chip = { ...chip, detail: `${popunjeno} od ${ukupno}` };

  // Places are not Dogovori: one Dogovor can cover both places. Several Dogovori are said only when the search state counted them.
  const live = state ? state.activeAgreementCount : 0;
  let primary: OverviewPrimary | null = null;
  if (canChoose) {
    const label = cancelled ? 'Izaberite drugu prijavu' : waiting === 1 ? 'Pogledajte prijavu' : 'Pogledajte prijave';
    primary = { kind: 'CANDIDATES', label, spoken: `${label}, ${prijave(waiting!)} za izbor` };
  } else if (canLook) {
    primary = { kind: 'CANDIDATES', label: 'Pogledajte prijave', spoken: `Pogledajte prijave, ukupno ${prijave(total)}` };
  } else if (need.stanje !== 'ZATVORENA' && popunjeno > 0 && input.canOpenAgreements) {
    primary = { kind: 'AGREEMENTS', label: live > 1 ? 'Otvori Dogovore' : 'Otvori Dogovor' };
  }
  if (input.overridden) primary = null;

  /**
   * What the task has now, as ONE line and how many applications it counts. The search section, when it is on the screen, and the
   * closed-search note speak for themselves; and what the chip already says ("Dogovoren", "Završen", "Otkazan") is not said again.
   */
  const present = (): { line: string | null; applicants: number } => {
    const nothing = { line: null, applicants: 0 };
    switch (need.stanje) {
      case 'OBJAVLJENA':
      case 'CEKA_PRIJAVE':
        if (quiet) return nothing;
        if (canChoose) return { line: prijave(waiting!), applicants: waiting! };
        // The server did not say how many can be chosen: the applications the read has are the ones that can be looked at.
        if (total > 0 && waiting === null) return { line: prijave(total), applicants: total };
        if (total > 0 && waiting === 0) return { line: NOTHING_TO_CHOOSE, applicants: 0 };
        return total === 0 ? { line: NO_APPLICATIONS, applicants: 0 } : nothing;
      case 'DELIMICNO_POPUNJENA':
        // Part of the places are agreed and the chip says how many ("Dogovoren · 1 od 2"): the line is only what is still to be chosen.
        return !quiet && canChoose ? { line: prijave(waiting!), applicants: waiting! } : nothing;
      case 'ZATVORENA':
        return { line: standing.next, applicants: 0 };
      default:
        // POPUNJENA: the chip says "Dogovoren" or "U toku", and the note says what a closed search left open.
        return nothing;
    }
  };
  const { line, applicants } = present();

  return {
    chip, notice: cancelled ? 'Dogovor je otkazan' : null, line, applicants,
    note: remainingClosed && popunjeno < ukupno && NOTE_STATES.has(need.stanje)
      ? `${popunjeno} od ${ukupno} dogovoreno · preostala potraga je zatvorena` : null,
    primary, waits: false,
    rows: {
      applications: total > 0 && primary?.kind !== 'CANDIDATES',
      agreements: popunjeno > 0 && !!input.canOpenAgreements && primary?.kind !== 'AGREEMENTS',
    },
  };
}

/* --------------------------------------------------------------------------------------------------------------- R16 */

/**
 * R16 (POTREBE, 2026-10-07; "Moj zadatak" after a day of silence): a published task that nobody applied to for 24 hours does not stay silent
 * any more. The page may say so, with the ways the owner really has to change it, each one a real button and each one offered only when the
 * state of THIS task makes it a real thing to do. Nothing is counted or invented: the sentence is the idea's own ("Nema prijava već 24 sata.").
 *
 * BUILT BEHIND A SWITCH, OFF: the owner's own read of a task carries neither the time it was published nor how many photos it has, so today
 * the card cannot be told the truth. TRAŽI SERVER: `publishedAt` (the instant of `published_at`, which `rpc_publish_need` already returns once,
 * `publication.ts: publishedAt`) and the count of the task's photos in the owner's task read; the page then passes them in (`publishedAt`,
 * `photoCount`), turns `NO_APPLICATIONS_HELP_ON` on and passes `waitingHelp` to `NeedPresentation`. With the switch off, or
 * with a time that is missing or is not a time, the answer is null: never a guess.
 */
export const NO_APPLICATIONS_HELP_ON = false;
/** A day, in hours: from this long without an application the card appears. */
export const NO_APPLICATIONS_AFTER_HOURS = 24;
/** A fixed term this short, in hours, or shorter, is "narrow": few people can come at exactly that time, and the card offers to widen it. */
export const NARROW_TERM_HOURS = 2;
export type NoApplicationsHelpAction = 'PHOTO' | 'WIDEN_TERM' | 'SHARE' | 'EDIT';
export type NoApplicationsHelp = { sentence: string; actions: readonly NoApplicationsHelpAction[] };
/** The words of each button. */
export const NO_APPLICATIONS_HELP_LABEL: Readonly<Record<NoApplicationsHelpAction, string>> = {
  PHOTO: 'Dodaj fotografiju', WIDEN_TERM: 'Proširi termin', SHARE: 'Podeli zadatak', EDIT: 'Izmeni zadatak',
};
const HOUR_MICROS = 3_600_000_000n;

export function noApplicationsHelp(input: {
  need: PotrebaProjekcija;
  /** When the task was published, as the server wrote it. Absent: nothing is said. */
  publishedAt?: string | null;
  /** How many photos the task has; null or absent is unknown, never zero. */
  photoCount?: number | null;
  /** The page can share the task / edit it. A button the page cannot honour is not offered. */
  canShare?: boolean; canEdit?: boolean;
  now?: Date;
  /** The switch; `NO_APPLICATIONS_HELP_ON` when left out. */
  on?: boolean;
}): NoApplicationsHelp | null {
  if (!(input.on ?? NO_APPLICATIONS_HELP_ON)) return null;
  const { need } = input;
  // Only a published task that nobody applied to, and that is not waiting on anything of the owner's.
  if (need.stanje !== 'OBJAVLJENA' || need.brojPrijava !== 0) return null;
  const published = calendarInstant(input.publishedAt);
  if (published === null) return null;
  const now = BigInt((input.now ?? new Date()).getTime()) * 1000n;
  if (now - published < BigInt(NO_APPLICATIONS_AFTER_HOURS) * HOUR_MICROS) return null;
  const schedule = need.schedule;
  const from = schedule?.kind === 'FIXED_WINDOW' ? calendarInstant(schedule.startsAt) : null, to = schedule?.kind === 'FIXED_WINDOW' ? calendarInstant(schedule.endsAt) : null;
  const narrow = from !== null && to !== null && to > from && to - from <= BigInt(NARROW_TERM_HOURS) * HOUR_MICROS;
  const actions: NoApplicationsHelpAction[] = [];
  if (input.photoCount === 0) actions.push('PHOTO');
  if (narrow && input.canEdit) actions.push('WIDEN_TERM');
  if (input.canShare) actions.push('SHARE');
  if (input.canEdit) actions.push('EDIT');
  // A card with nothing to press is a card that complains: no real way, no card.
  return actions.length ? { sentence: 'Nema prijava već 24 sata.', actions } : null;
}
