import type { OwnerPreselectionQuestion, PublicPreselectionQa } from '../../contracts/preselectionQa';
import type { QaContext } from '../../data/qaRecoveryClientService';
import { plural } from '../system/plural';

/**
 * What the task's own screens say about its questions (the owner, 2026-10-07: "u pregledu zadatka treba da se vidi pitanja
 * koja je neko postavio, a na koja je odgovorio vlasnik zadatka"). This file is the pure half: the server's two shapes
 * of the same thread, put in the order a person reads them in, with the counts the section speaks. It reads nothing and
 * imports no client, so the presentation and its tests never pull a transport in; `useTaskQaInline` is the reader.
 *
 * Questions are anonymous on purpose: neither shape carries who asked, and nothing here invents it.
 */
type Row = OwnerPreselectionQuestion | PublicPreselectionQa;
type QaContextFacts = Pick<QaContext, 'mode' | 'needRevision' | 'canAsk' | 'canComposeAnswer'>;

/** How many questions the section shows before it sends the person to the whole thread. */
export const INLINE_LIMIT = 3;

export type QaInlineItem = {
  questionId: string;
  question: string;
  /** The owner's answer, or null while the question waits for it. */
  answer: string | null;
  /** The answer was changed after it was first given. */
  edited: boolean;
  /** When the answer was given: only the public read says it. The owner's read does not, and no moment is made up. */
  answeredAt: string | null;
  /** When the question was asked: only the owner's read says it. */
  askedAt: string | null;
};

export type QaInlineReady = {
  /** Which of the server's two shapes this is. The server decides it from the account, never the app. */
  viewer: 'OWNER' | 'PUBLIC';
  /** At most `INLINE_LIMIT`, in reading order. */
  shown: QaInlineItem[];
  /** The questions of the version of the task on screen: waiting and answered. */
  listed: number;
  /** Waiting for the owner's answer (the owner's read only). */
  waiting: number;
  answered: number;
  /** Everything the whole thread lists for this person: the number "Prikaži sva pitanja (N)" speaks. */
  all: number;
  /** Questions that belong to an earlier version of the task are kept out of the list, and this says so. */
  olderVersion: boolean;
  canAsk: boolean;
  canAnswer: boolean;
};

/** What the reader hands the section: nothing to read yet, reading, failed (never "no questions"), or the thread. */
export type TaskQaInlineState =
  | { phase: 'idle' }
  | { phase: 'loading' }
  | { phase: 'error'; message: string }
  | ({ phase: 'ready' } & QaInlineReady);

const isOwnerRow = (row: Row): row is OwnerPreselectionQuestion => 'status' in row;
const time = (value: string) => { const at = Date.parse(value); return Number.isFinite(at) ? at : 0; };
const compareId = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
/** Oldest first when `direction` is 1, newest first when it is -1; the id breaks a tie so the order never flickers. */
const byTime = <T extends { questionId: string }>(moment: (row: T) => string, direction: 1 | -1) => (a: T, b: T) =>
  direction * (time(moment(a)) - time(moment(b))) || compareId(a.questionId, b.questionId);

const waitingItem = (row: OwnerPreselectionQuestion): QaInlineItem => ({
  questionId: row.questionId, question: row.questionText, answer: null, edited: false, answeredAt: null, askedAt: row.createdAt });
const answeredOwnerItem = (row: OwnerPreselectionQuestion): QaInlineItem => ({
  questionId: row.questionId, question: row.questionText, answer: row.answerText, edited: row.edited, answeredAt: null, askedAt: row.createdAt });
const publicItem = (row: PublicPreselectionQa): QaInlineItem => ({
  questionId: row.questionId, question: row.questionText, answer: row.answerText, edited: row.edited, answeredAt: row.answeredAt, askedAt: null });

/**
 * The thread as the section shows it: the questions of the version of the task that is on screen only. A question about
 * an older version describes conditions that no longer hold (the whole thread says the same), and the section says that
 * some are kept out. For the owner the ones waiting come first, the oldest first because it has waited longest, then the
 * answered, the newest first; skipped and reported ones are not part of the list. For a stranger every question is
 * answered (the server publishes nothing else), the newest answer first.
 */
export function buildQaInline(context: QaContextFacts, rows: readonly Row[]): QaInlineReady {
  if (context.mode === 'OWNER') {
    const open = rows.filter(isOwnerRow).filter(row => row.status === 'PENDING_ANSWER' || row.status === 'ANSWERED_PUBLIC');
    const current = open.filter(row => row.needRevision === context.needRevision);
    const waiting = current.filter(row => row.status === 'PENDING_ANSWER').sort(byTime(row => row.createdAt, 1));
    const answered = current.filter(row => row.status === 'ANSWERED_PUBLIC').sort(byTime(row => row.createdAt, -1));
    const items = [...waiting.map(waitingItem), ...answered.map(answeredOwnerItem)];
    return { viewer: 'OWNER', shown: items.slice(0, INLINE_LIMIT), listed: items.length, waiting: waiting.length, answered: answered.length,
      all: open.length, olderVersion: open.length > current.length, canAsk: false, canAnswer: context.canComposeAnswer };
  }
  const current = rows.filter((row): row is PublicPreselectionQa => !isOwnerRow(row) && row.needRevision === context.needRevision)
    .sort(byTime(row => row.answeredAt, -1));
  return { viewer: 'PUBLIC', shown: current.slice(0, INLINE_LIMIT).map(publicItem), listed: current.length, waiting: 0, answered: current.length,
    all: current.length, olderVersion: rows.some(row => !isOwnerRow(row) && row.needRevision !== context.needRevision),
    canAsk: context.canAsk, canAnswer: false };
}

/** "1 pitanje", "2 pitanja", "5 pitanja". */
export const pitanja = (count: number) => plural(count, 'pitanje', 'pitanja', 'pitanja');
const odgovoreno = (count: number) => plural(count, 'odgovoreno', 'odgovorena', 'odgovorenih');

/** "3 pitanja · 2 odgovorena"; when every one is answered, which is all a stranger ever sees, "2 pitanja · sva odgovorena". */
export function qaCountLine(listed: number, answered: number): string | null {
  if (listed <= 0) return null;
  if (answered >= listed) return listed === 1 ? `${pitanja(1)} · odgovoreno` : `${pitanja(listed)} · sva odgovorena`;
  return answered > 0 ? `${pitanja(listed)} · ${odgovoreno(answered)}` : pitanja(listed);
}

/** The waiting count as the section header says it: "1 čeka odgovor", "2 čekaju odgovor", "5 čeka odgovor". The verb takes the shape of the number. */
export const waitingWords = (count: number) => `${plural(count, 'čeka', 'čekaju', 'čeka')} odgovor`;
