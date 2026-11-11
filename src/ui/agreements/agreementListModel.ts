import type { DogovorProjekcija } from '../../contracts/projections';
import type { AgreementCancellation } from '../../data/agreementCancellationClientService';
import { calendarInstant } from '../../lib/calendarTime';
import { DOGOVORENA_ZONA } from '../../lib/dogovorenoVreme';
import { raspon, vreme } from '../../lib/vreme';
import { shiftDate, zonedParts } from '../calendar/calendarPresentation';
import type { StatusKey } from '../system/StatusChip';

/**
 * What the Dogovori list decides, without drawing anything (plan 2.6): which Dogovor is active, what it waits for from ME,
 * which group of the Aktivni list it stands in, how its time reads on a card, and which state chip it wears. Pure on purpose:
 * the list presentation draws it, and the tests pin it with a fixed `now` and no screen.
 *
 * Every day here is the day in SERBIAN time (`DOGOVORENA_ZONA`), taken from the accepted instant (`prihvacenPocetak`), never from
 * display text and never from the phone's own zone: two people who agreed on "danas u 14:00" must read the same group.
 */

// ---------------------------------------------------------------------------------------------------------------------
// Active, and what waits for me
// ---------------------------------------------------------------------------------------------------------------------

/** A finished Dogovor that still waits for my rating is not history yet (owner, 2026-09-23); it stays among the active ones until it is rated. */
export const awaitsMyRating = (item: DogovorProjekcija) => item.stanje === 'COMPLETED' && item.stanjeProvereOcene !== 'UNAVAILABLE' && item.ocenaMoguca;
export const ratingUnknown = (item: DogovorProjekcija) => item.stanje === 'COMPLETED' && item.stanjeProvereOcene === 'UNAVAILABLE';
/** An unread rating cannot move finished work out of reach as if its next action were settled. */
export const isActiveAgreement = (item: DogovorProjekcija) =>
  item.stanje === 'CONFIRMED' || item.stanje === 'AWAITING_REQUESTER' || awaitsMyRating(item) || ratingUnknown(item);
/** The finished work of the requester's own side waits for THEIR confirmation (the filter "Čeka tvoju potvrdu"). */
export const awaitsMyConfirmation = (item: DogovorProjekcija) => item.stanje === 'AWAITING_REQUESTER'
  && item.ucesnici.some(person => person.viSte && person.uloga === 'narucilac');

export type AgreementRoleFilter = 'all' | 'narucilac' | 'uskocer';
export const AGREEMENT_ROLE_FILTERS = [
  { key: 'all', label: 'Sve uloge', spoken: 'Sve uloge' },
  { key: 'narucilac', label: 'Tražim pomoć', spoken: 'Tražim pomoć' },
  { key: 'uskocer', label: 'Uskačem', spoken: 'Uskačem' },
] as const;
/** A person's role belongs to this Agreement, never to a global account mode. */
export function filterAgreementRole(items: readonly DogovorProjekcija[], role: AgreementRoleFilter): readonly DogovorProjekcija[] {
  return role === 'all' ? items : items.filter(item => item.ucesnici?.find(person => person.viSte)?.uloga === role);
}

/** One task in my own role; the underlying bilateral agreements remain authoritative and individually actionable. */
export type AgreementTaskGroup = { key: string; items: readonly DogovorProjekcija[] };
export function agreementTaskKey(item: DogovorProjekcija): string {
  const task = item.izvor?.zadatakId, mine = item.ucesnici?.find(person => person.viSte);
  // Unknown linkage or ownership must never merge unrelated private records, even if their titles match.
  return task && mine ? JSON.stringify(['task', task, mine.uloga]) : JSON.stringify(['agreement', item.id]);
}
export function groupAgreementTasks(items: readonly DogovorProjekcija[]): AgreementTaskGroup[] {
  const groups = new Map<string, DogovorProjekcija[]>();
  for (const item of items) {
    const key = agreementTaskKey(item), group = groups.get(key);
    if (group) group.push(item); else groups.set(key, [item]);
  }
  return [...groups].map(([key, members]) => ({ key, items: members }));
}
export const isActiveAgreementTask = (group: AgreementTaskGroup) => group.items.some(isActiveAgreement);

/** Assign a whole task to its most urgent active collaboration, retaining completed/cancelled siblings in that record. */
export function groupActiveAgreementTasks(groups: readonly AgreementTaskGroup[], now: Date): { key: AgreementGroupKey; title: string; items: AgreementTaskGroup[] }[] {
  const byKey = new Map(groups.map(group => [group.key, group])), seen = new Set<string>();
  return groupActiveAgreements(groups.flatMap(group => group.items.filter(isActiveAgreement)), now).flatMap(section => {
    const items: AgreementTaskGroup[] = [];
    for (const item of section.items) {
      const key = agreementTaskKey(item);
      if (!seen.has(key)) { seen.add(key); items.push(byKey.get(key)!); }
    }
    return items.length ? [{ ...section, items }] : [];
  });
}

export type AgreementAttention = { kind: 'change' | 'confirm' | 'rate' | 'check-rating'; title: string; line: string };
/**
 * What this Dogovor is waiting for from ME, if anything, in the order the Dogovor itself leads with: a change the other side
 * proposed blocks both completions, so answering it comes first. A change I proposed, or a completion the other side has to
 * confirm, waits for someone else and is not drawn as my task. A Dogovor with an attention is the orange foot of its card,
 * and stands under "Čeka tebe".
 */
export function agreementAttention(item: DogovorProjekcija): AgreementAttention | null {
  if (item.izmenaCeka && !item.izmenaCeka.mojPredlog) return { kind: 'change', title: 'Odgovorite na predlog izmene', line: 'Prihvaćeni uslovi važe dok ne odgovorite.' };
  if (!item.izmenaCeka && awaitsMyConfirmation(item)) return { kind: 'confirm', title: 'Potvrdite završetak', line: 'Druga strana je označila da je zadatak završen.' };
  // The only route to rating a finished collaboration was: open the agreement, find the action. The card that is already in
  // front of the person says it, and with `onRate` goes there in one tap.
  if (awaitsMyRating(item)) return { kind: 'rate', title: 'Ocenite saradnju', line: 'Čeka Vašu ocenu' };
  if (ratingUnknown(item)) return { kind: 'check-rating', title: 'Proverite ocenu', line: 'Podatak o Vašoj oceni nije učitan. Otvorite Dogovor.' };
  return null;
}

// ---------------------------------------------------------------------------------------------------------------------
// The accepted time, in Serbian time
// ---------------------------------------------------------------------------------------------------------------------

/** The accepted start in milliseconds, or null when the accepted terms carry none (or an unreadable one). */
function startMillis(item: Pick<DogovorProjekcija, 'prihvacenPocetak'>): number | null {
  const micro = calendarInstant(item.prihvacenPocetak ?? null);
  return micro === null ? null : Number(micro / 1000n);
}
/** The accepted end in milliseconds, only when the Dogovor has an exact window (both ends); a start alone has no end to claim. */
function endMillis(item: Pick<DogovorProjekcija, 'tacanTermin'>): number | null {
  const micro = calendarInstant(item.tacanTermin?.kraj ?? null);
  return micro === null ? null : Number(micro / 1000n);
}
/** The civil day of an instant in Serbian time, "2026-10-07". */
const serbianDay = (ms: number | Date) => zonedParts(ms instanceof Date ? ms : new Date(ms), DOGOVORENA_ZONA).date;
const serbianClock = (ms: number) => zonedParts(new Date(ms), DOGOVORENA_ZONA).time.slice(0, 5);

/** The Sunday that ends the week (Monday to Sunday) a civil day is in. */
function weekEnd(day: string): string {
  const weekday = new Date(`${day}T12:00:00Z`).getUTCDay(); // 0 = Sunday
  return shiftDate(day, (7 - weekday) % 7);
}

/** Whether the agreed time is under way right now: both ends are known, and now lies between them. */
export function agreementInProgress(item: DogovorProjekcija, now: Date): boolean {
  const start = startMillis(item), end = endMillis(item), at = now.getTime();
  return start !== null && end !== null && start <= at && at < end;
}

// ---------------------------------------------------------------------------------------------------------------------
// Groups of the Aktivni list
// ---------------------------------------------------------------------------------------------------------------------

/**
 * "Čeka tebe" is everything with an orange foot and is always first. The rest are day groups taken from the accepted start in
 * Serbian time. `past` is the one group the plan did not name: an active Dogovor whose day is already behind us (the work was
 * done and the other side has not confirmed it, or nobody closed it yet). It is not "Danas", and it is not hidden.
 */
export type AgreementGroupKey = 'waiting' | 'past' | 'today' | 'tomorrow' | 'week' | 'later' | 'undated';
export const AGREEMENT_GROUP_ORDER: readonly AgreementGroupKey[] = ['waiting', 'past', 'today', 'tomorrow', 'week', 'later', 'undated'];
export const AGREEMENT_GROUP_TITLES: Readonly<Record<AgreementGroupKey, string>> = {
  // The same words as the note of a Dogovor with no term ("Termin još nije dogovoren") and the card's own line: one name for one state (J2).
  waiting: 'Čeka Vas', past: 'Ranije', today: 'Danas', tomorrow: 'Sutra', week: 'Ove nedelje', later: 'Kasnije', undated: 'Termin još nije dogovoren',
};
export type AgreementGroup = { key: AgreementGroupKey; title: string; items: DogovorProjekcija[] };

/** The group one active Dogovor stands in, at `now`. */
export function agreementGroupOf(item: DogovorProjekcija, now: Date): AgreementGroupKey {
  if (agreementAttention(item)) return 'waiting';
  const start = startMillis(item);
  if (start === null) return 'undated';
  // Under way now, though it began on an earlier day: it is today's.
  if (agreementInProgress(item, now)) return 'today';
  const today = serbianDay(now), day = serbianDay(start);
  if (day < today) return 'past';
  if (day === today) return 'today';
  if (day === shiftDate(today, 1)) return 'tomorrow';
  return day <= weekEnd(today) ? 'week' : 'later';
}

/**
 * The active Dogovori in their groups, empty groups left out. What is next comes first inside a group; one with no term goes
 * after the ones that have one, in the order the server gave. "Proveri ocenu" (the rating could not be read) is kept after
 * the Dogovori that really wait, so an old appointment cannot outrank accepted work.
 */
export function groupActiveAgreements(items: readonly DogovorProjekcija[], now: Date): AgreementGroup[] {
  const buckets = new Map<AgreementGroupKey, { item: DogovorProjekcija; index: number; start: bigint | null }[]>();
  items.forEach((item, index) => {
    const key = agreementGroupOf(item, now);
    const list = buckets.get(key) ?? [];
    list.push({ item, index, start: calendarInstant(item.prihvacenPocetak ?? null) });
    buckets.set(key, list);
  });
  return AGREEMENT_GROUP_ORDER.flatMap(key => {
    const rows = buckets.get(key);
    if (!rows?.length) return [];
    rows.sort((a, b) => {
      if (key === 'waiting' && ratingUnknown(a.item) !== ratingUnknown(b.item)) return ratingUnknown(a.item) ? 1 : -1;
      // The accepted instant owns this order, including offset and microsecond precision.
      // The source task's `pocinje` can diverge after an accepted change.
      if (a.start !== null && b.start !== null && a.start !== b.start) return a.start < b.start ? -1 : 1;
      if (a.start !== null && b.start === null) return -1;
      if (a.start === null && b.start !== null) return 1;
      return a.index - b.index;
    });
    return [{ key, title: AGREEMENT_GROUP_TITLES[key], items: rows.map(row => row.item) }];
  });
}

/** Istorija: "Sve", "Završeni" or "Otkazani". The server's newest-first order is kept. */
export type HistoryFilter = 'all' | 'completed' | 'cancelled';
export const HISTORY_FILTERS: readonly { key: HistoryFilter; label: string }[] = [
  { key: 'all', label: 'Sve' }, { key: 'completed', label: 'Završeni' }, { key: 'cancelled', label: 'Otkazani' },
];
export const filterHistory = (items: readonly DogovorProjekcija[], filter: HistoryFilter): DogovorProjekcija[] =>
  filter === 'all' ? [...items] : items.filter(item => item.stanje === (filter === 'completed' ? 'COMPLETED' : 'CANCELLED'));

// ---------------------------------------------------------------------------------------------------------------------
// The words on a card
// ---------------------------------------------------------------------------------------------------------------------

/**
 * The agreed time as one short grey line, from the accepted instants: "Danas 14:00–15:30", "Sutra 09:00", "24. sep · 14:00" (the
 * app's one time format, the year only when it is not the current one). A window that crosses midnight is written whole, with
 * both days. Null when the accepted terms carry no start: the card then says the adapter's own sentence ("Termin nije potvrđen"),
 * never a time built from the task.
 */
export function agreementWhen(item: DogovorProjekcija, now: Date): string | null {
  const start = startMillis(item);
  if (start === null) return null;
  const end = endMillis(item), today = serbianDay(now), day = serbianDay(start);
  const oneDay = end === null || serbianDay(end) === day;
  const relative = day === today ? 'Danas' : day === shiftDate(today, 1) ? 'Sutra' : null;
  if (relative && oneDay) return `${relative} ${serbianClock(start)}${end !== null && serbianClock(end) !== serbianClock(start) ? `–${serbianClock(end)}` : ''}`;
  const options = { zona: DOGOVORENA_ZONA, sada: now };
  return end !== null ? raspon(new Date(start), new Date(end), options) : vreme(new Date(start), options);
}

/** A chip the state table of `StatusChip` has a key for, or "Čeka potvrdu", which it has not (the Dogovor's own state). */
export type AgreementChip = { kind: 'status'; key: StatusKey } | { kind: 'awaiting'; mine: boolean };
/**
 * The state a card wears (plan 2.2): "Dogovoren" until the agreed time arrives, "U toku" while it is under way, "Čeka potvrdu"
 * once the work is marked done (orange when the confirmation is mine, quiet when it is the other side's), then "Završen" or
 * "Otkazan". The orange follows the card's orange foot: the chip is orange exactly when the foot asks for the confirmation.
 */
export function agreementChip(item: DogovorProjekcija, now: Date): AgreementChip {
  if (item.stanje === 'CANCELLED') return { kind: 'status', key: 'task.cancelled' };
  if (item.stanje === 'COMPLETED') return { kind: 'status', key: 'task.completed' };
  if (item.stanje === 'AWAITING_REQUESTER') return { kind: 'awaiting', mine: agreementAttention(item)?.kind === 'confirm' };
  return { kind: 'status', key: agreementInProgress(item, now) ? 'task.now' : 'task.agreed' };
}

/**
 * Who cancelled, when and why, as one line - only from what the Dogovor carries. The projection holds none of the three, so
 * the line is "Otkazano" and nothing is invented; when `rpc_agreement_cancellation_v1` answers (CANCEL-INFO, applied 2026-10-07,
 * read by `agreementCancellationService`, turned into these words by `cancellationDetailsOf`), a time, a person and a reason join
 * the line in this order and none is guessed. `by` is already a name ("Ti", "Marko"); `at` is an instant.
 */
export function cancellationLine(details: { at?: string | null; by?: string | null; reason?: string | null } | null | undefined, now: Date = new Date()): string {
  const when = details?.at ? vreme(details.at, { zona: DOGOVORENA_ZONA, sada: now }) : '';
  const by = details?.by?.trim() ?? '', reason = details?.reason?.trim() ?? '';
  return ['Otkazano' + (when ? ` ${when}` : ''), by, reason].filter(part => part.length > 0).join(' · ');
}

/** What the line says of a reason that is not there: the pair was blocked or an account was closing at that moment (it never existed), or its text was erased when an account closed. */
export const REASON_NEVER_SAVED = 'Razlog nije sačuvan';
export const REASON_ERASED = 'Razlog je uklonjen';

/**
 * What the server said about one cancelled Dogovor, as the three parts of the line "Otkazano {datum} · {ko} · {razlog}".
 *
 * - {ko}: "Ti" when I cancelled; the other person's name when they did (their name stands as the subject of its own part, so it needs
 *   no case ending; the app's stand-in for a missing name is "Druga strana"); nothing when the server no longer has the side. It is
 *   never guessed, and never said in a form with a gender.
 * - {razlog}: the canceller's own words when they were kept; otherwise one short sentence that says WHY there is none.
 *
 * Null when the server said nothing about this Dogovor: the screen then says only what it always said, "Otkazan".
 */
export function cancellationDetailsOf(cancellation: AgreementCancellation | null | undefined, otherName?: string | null):
  { at: string; by: string; reason: string } | null {
  if (!cancellation) return null;
  const named = otherName?.trim();
  const other = named && named !== 'Druga strana' ? named : 'Druga strana';
  const by = cancellation.byMe === true ? 'Vi' : cancellation.byMe === false ? other : '';
  const reason = cancellation.reasonState === 'KEPT' ? cancellation.reason ?? '' : cancellation.reasonState === 'REMOVED' ? REASON_ERASED : REASON_NEVER_SAVED;
  return { at: cancellation.cancelledAt, by, reason };
}
