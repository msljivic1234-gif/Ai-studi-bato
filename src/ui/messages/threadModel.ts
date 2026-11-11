import type { PorukaProjekcija } from '../../contracts/projections';
import type { OutboxEntry } from '../../data/agreementOutbox';
import { voiceClock } from '../../features/voiceMessages/voiceCopy';
import { DOGOVORENA_ZONA } from '../../lib/dogovorenoVreme';
import { displayDate, shiftDate, weekdayOf } from '../calendar/calendarPresentation';
import { instantMs, serbianToday } from '../calendar/serbianDays';
import { plural } from '../system/plural';

/**
 * The thread of a Dogovor as a pure function of its messages (team T3c, 2026-10-07): which bubble shares a run with which,
 * what the line above a message says, and which small mark stands by one of MY messages. No React, no native module, no
 * clock but the one passed in, so the whole of it is tested without a screen.
 *
 * ONE ZONE (owner, 2026-10-07, "po vremenu u Srbiji"): when the read carries the server's own instant (`createdAt`), the day
 * a message belongs to and the clock beside it are Serbian time, whatever zone the phone is set to. A message that carries
 * only the words the read wrote (`vremeTekst`, "24. sep · 14:05" or a bare "14:05") keeps those words and opens a day only
 * when they name one, so a separator never says something the read did not.
 */

/** A message as the thread draws it: the projection, plus the server's instant when the read carries it. */
export type ThreadMessage = PorukaProjekcija & { createdAt?: string };

const CLOCK = /^\d{1,2}:\d{2}$/;
/**
 * The day a message belongs to and its clock, from the words the message read already wrote (`vreme`, "24. sep · 14:05",
 * and a bare "14:05" for a message of today). Nothing is recomputed from a device clock: a text in any other shape keeps
 * its words as the time and opens no day of its own, so a day separator never says something the read did not.
 */
export function messageMoment(text: string): { day: string | null; clock: string } {
  const at = text.lastIndexOf(' · ');
  if (at > 0) return { day: text.slice(0, at), clock: text.slice(at + 3) };
  return CLOCK.test(text.trim()) ? { day: 'Danas', clock: text.trim() } : { day: null, clock: text };
}

/**
 * The name of a civil day (Serbian time) as a conversation says it: "Danas", "Juče", then the weekday for the days before
 * yesterday up to six days back ("Utorak"), then the date ("1. okt"), with the year only when it is not the current one.
 * A week back would repeat today's weekday, so the date takes over there.
 */
export function dayLabel(day: string, today: string): string {
  if (day === today) return 'Danas';
  if (day === shiftDate(today, -1)) return 'Juče';
  for (let back = 2; back <= 6; back++) if (day === shiftDate(today, -back)) return weekdayOf(day).name;
  const year = day.slice(0, 4);
  return year === today.slice(0, 4) ? displayDate(day) : `${displayDate(day)} ${year}`;
}

export type ThreadMoment = Readonly<{
  /** What the separator calls the day; null when the message names no day (an unreadable stand-in such as "sada"). */
  day: string | null;
  /** Comparable identity of the day: the Serbian civil day, or the words of a message that has no instant. */
  dayKey: string | null;
  clock: string;
  /** Epoch milliseconds, only when the read carried a real instant. */
  ms: number | null;
}>;

let belgrade: Intl.DateTimeFormat | null = null;
/**
 * The civil day ("2026-10-07") and the clock ("14:05") of an instant in SERBIAN time: the same answer as `serbianDayOf` and
 * `serbianClock`, from ONE cached formatter. A thread asks for a hundred of these at once, every time a message arrives, and
 * `zonedParts` builds a new `Intl.DateTimeFormat` per call, which is slow enough on a phone to be felt.
 */
export function serbianParts(ms: number): { day: string; clock: string } | null {
  try {
    if (!belgrade) belgrade = new Intl.DateTimeFormat('en-GB', { timeZone: DOGOVORENA_ZONA, year: 'numeric', month: '2-digit',
      day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
    const parts = belgrade.formatToParts(new Date(ms));
    const get = (type: string) => parts.find(part => part.type === type)?.value ?? '';
    const day = `${get('year')}-${get('month')}-${get('day')}`, clock = `${get('hour')}:${get('minute')}`;
    return /^\d{4}-\d{2}-\d{2}$/.test(day) && /^\d{2}:\d{2}$/.test(clock) ? { day, clock } : null;
  } catch { return null; }
}

export function threadMoment(message: Pick<ThreadMessage, 'createdAt' | 'vremeTekst'>, today: string,
  label: (day: string) => string = day => dayLabel(day, today)): ThreadMoment {
  const ms = message.createdAt ? instantMs(message.createdAt) : null;
  const parts = ms !== null && Number.isFinite(ms) ? serbianParts(ms) : null;
  if (ms !== null && parts) return { day: label(parts.day), dayKey: parts.day, clock: parts.clock, ms };
  const words = messageMoment(message.vremeTekst);
  return { day: words.day, dayKey: words.day, clock: words.clock, ms: null };
}

/** Messages of one person this close in time share one run: one tail, tight spacing. */
export const GROUP_GAP_MS = 5 * 60_000;
/** A pause this long inside one day opens a line of its own with the clock ("Danas · 14:12"). */
export const PAUSE_MS = 60 * 60_000;

export type ThreadEntry = Readonly<{
  message: ThreadMessage;
  moment: ThreadMoment;
  /** The line above this message: a day, or a day and clock after a long pause. Null when none. */
  separator: string | null;
  /** First and last bubble of a run of one sender; a lone bubble is both. */
  first: boolean;
  last: boolean;
}>;

/** Whose message it is, for deciding whether two neighbours form one run. */
const senderOf = (message: ThreadMessage): string => message.moja ? '\u0000me' : message.posiljalacAccountId ?? message.posiljalacIme;

/**
 * Runs and separators of a transcript, in the order it was read.
 *
 * - A separator opens before the first message, whenever the Serbian day changes, and after a pause of an hour or more inside
 *   a day. A day separator carries only the day, except today's, which also says when the first message came ("Danas · 14:12");
 *   a pause separator always carries the clock.
 * - A run is consecutive messages of one sender, with no separator between them, at most five minutes apart. The last bubble of
 *   a run carries the tail; the first leaves air above it.
 * - Without an instant (the words of `vremeTekst` only) two neighbours of one sender on one day stay in one run, and no pause is
 *   ever invented.
 */
export function buildThread(messages: readonly ThreadMessage[], now: Date = new Date()): ThreadEntry[] {
  const today = serbianToday(now);
  const names = new Map<string, string>();
  const label = (day: string) => { let name = names.get(day); if (name === undefined) { name = dayLabel(day, today); names.set(day, name); } return name; };
  const moments = messages.map(message => threadMoment(message, today, label));
  let lastDay: string | null = null;
  const separators: (string | null)[] = [];
  const starts: boolean[] = [];
  messages.forEach((message, index) => {
    const moment = moments[index], before = index > 0 ? messages[index - 1] : null, beforeMoment = index > 0 ? moments[index - 1] : null;
    const newDay = moment.dayKey !== null && moment.dayKey !== lastDay;
    if (moment.dayKey !== null) lastDay = moment.dayKey;
    const gap = moment.ms !== null && beforeMoment?.ms != null ? moment.ms - beforeMoment.ms : null;
    let separator: string | null = null;
    if (newDay && moment.day !== null) separator = moment.day === 'Danas' && moment.clock ? `Danas · ${moment.clock}` : moment.day;
    else if (gap !== null && gap >= PAUSE_MS && moment.day !== null && moment.clock) separator = `${moment.day} · ${moment.clock}`;
    separators.push(separator);
    starts.push(index === 0 || separator !== null || !before || senderOf(before) !== senderOf(message) || (gap !== null && gap > GROUP_GAP_MS));
  });
  return messages.map((message, index) => ({ message, moment: moments[index], separator: separators[index],
    first: starts[index], last: index === messages.length - 1 || starts[index + 1] }));
}

/**
 * A message as a screen reader hears it, in one stop: who ("Ti" for mine), what (the text, then how many photos it
 * carries), when (the day the read named, then the clock) and, for my message, its state in one word ("poslato",
 * "viđeno"). The bubble's press hides its children, so a photo the label does not name is never heard (verify r4b rd item 2),
 * and the small mark inside it is heard here, not on its own.
 */
export function messageSpoken(message: Pick<PorukaProjekcija, 'moja' | 'posiljalacIme' | 'telo' | 'fotografije' | 'glas'>,
  moment: { day: string | null; clock: string }, state?: string): string {
  const who = message.moja ? 'Vi' : message.posiljalacIme;
  const photoCount = message.fotografije?.length ?? 0;
  const what = [message.telo, message.glas ? `glasovna poruka ${voiceClock(message.glas.trajanjeMs)}` : '', photoCount ? plural(photoCount, 'fotografija', 'fotografije', 'fotografija') : '']
    .filter(Boolean).join(', ') || 'poruka bez teksta';
  return `${who}: ${what}, ${moment.day ? `${moment.day}, ` : ''}${moment.clock}${state ? `, ${state}` : ''}`;
}

/** What stands by one of my messages. Seen is drawn only when the read says so; a pending or unconfirmed send is never "sent". */
export type MarkKind = 'sent' | 'seen' | 'pending' | 'unconfirmed' | 'failed';
export const MARK_WORDS: Readonly<Record<MarkKind, string>> = {
  sent: 'Poslato', seen: 'Viđeno', pending: 'Šalje se', unconfirmed: 'Ne znamo da li je stigla', failed: 'Nije poslato',
};

/**
 * My message as the server holds it. It is sent because it exists in the read; it is seen ONLY when the projection says
 * `procitano === true`. `null` means no authoritative read receipt exists, and `false` means it was read as not seen: neither
 * is ever drawn as seen, and nothing else (a push, a reply, the other person being online) is read as proof.
 */
export function readMark(message: Pick<ThreadMessage, 'moja' | 'procitano'>): 'sent' | 'seen' | null {
  if (!message.moja) return null;
  return message.procitano === true ? 'seen' : 'sent';
}

/** My message as the outbox holds it, before the read has returned it. */
export function entryMark(entry: Pick<OutboxEntry, 'state'>): MarkKind {
  return entry.state === 'confirmed' ? 'sent' : entry.state === 'sending' ? 'pending' : entry.state === 'unknown' ? 'unconfirmed' : 'failed';
}

/**
 * AUTO-RESEND. A send whose outcome is unknown because of the network is tried once more by itself, and only once per
 * message, when the person comes back to the conversation, the app returns to the foreground or a read works again. It goes only
 * through the outbox's own `retry(clientMessageId)`: the same retained command with the same client message id, which the
 * server stores once per (sender, client message id) and answers with the first message's id on every replay
 * (`rpc_send_agreement_message_v2` and the voice sender: a unique index plus an advisory lock). A new id is never made here.
 */
const AUTO_RESEND_MEMORY = 200;
const tried = new Set<string>();
export const autoResendKey = (entry: Pick<OutboxEntry, 'command'>): string =>
  `${entry.command.accountId}:${entry.command.agreementId}:${entry.command.clientMessageId}`;

/** Unknown outcome, from the network (or interrupted before an answer), kept on disk. A refusal, a storage fault or a confirmed message never. */
export function qualifiesForAutoResend(entry: Pick<OutboxEntry, 'state' | 'error' | 'persisted'>): boolean {
  return entry.state === 'unknown' && entry.persisted && (entry.error === undefined || entry.error === 'UNAVAILABLE');
}

/** The entries that may be tried now. Each is remembered BEFORE it is returned, so no second event can ever take it again. */
export function takeAutoResend(entries: readonly OutboxEntry[]): OutboxEntry[] {
  const taken: OutboxEntry[] = [];
  for (const entry of entries) {
    if (!qualifiesForAutoResend(entry)) continue;
    const key = autoResendKey(entry);
    if (tried.has(key)) continue;
    tried.add(key);
    taken.push(entry);
  }
  while (tried.size > AUTO_RESEND_MEMORY) tried.delete(tried.values().next().value as string);
  return taken;
}

/** Test seam only: the memory lives for the app session. */
export function forgetAutoResendForTests(): void { tried.clear(); }
