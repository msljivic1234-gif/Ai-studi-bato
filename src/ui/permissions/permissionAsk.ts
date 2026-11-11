import type { FactArtKind } from '../system/FactArt';

/**
 * Permissions are asked in context (owner decisions 2026-09-16 and 2026-10-07, design proposal N): never at entry, and never
 * as a bare system window. Right before the system asks, a small dialog says in one question why, with a picture, a green
 * "Nastavi" and a quiet "Ne sada". The system window follows only on "Nastavi"; "Ne sada" leaves the app usable and says
 * nothing more.
 *
 * The green word is "Nastavi", not "Dozvoli" (F7, 2026-10-08): this dialog grants nothing, it only explains and goes on to the
 * system's own question, and a person who taps "Dozvoli" believes the permission is given and is then asked again. The same rule
 * as the platforms' own guidance for a question that comes before the system's (the word is Continue, never Allow).
 *
 * This module is the store the features talk to, in the same shape as `poruka` (ui/system/Poruka): a feature asks and awaits,
 * and the host (`PermissionAskHost`, mounted once at the root) draws the dialog. It holds no React and no native module, so the
 * voice, media and location code can use it without pulling a screen in. WHAT is requested from the system stays where it was;
 * this only decides whether the person is told why first.
 */
export type PermissionKind = 'microphone' | 'photos' | 'location' | 'notifications';

/** `allow`: go on to the system's own window. `later`: do not ask now; the feature stays calm and does nothing. */
export type PermissionAskAnswer = 'allow' | 'later';

export type PermissionAskCopy = Readonly<{ art: FactArtKind; title: string; message: string; allow: string; later: string }>;

const ALLOW = 'Nastavi';
const LATER = 'Ne sada';

/**
 * The words are the design proposal's own (N): one question in the "ti" voice, one sentence that says what the permission is NOT
 * (always listening, every photo, always on). The picture is a fact picture of the app; there is no microphone picture yet,
 * so the voice message is drawn as the message it is.
 */
export const PERMISSION_ASK_COPY: Readonly<Record<PermissionKind, PermissionAskCopy>> = {
  microphone: { art: 'chat', title: 'Da snimite glasovnu poruku?', message: 'Snima se samo dok držite dugme.', allow: ALLOW, later: LATER },
  photos: { art: 'photo', title: 'Da dodate fotografiju?', message: 'Dodaju se samo slike koje izaberete.', allow: ALLOW, later: LATER },
  location: { art: 'pin', title: 'Da nađemo zadatke u blizini?', message: 'Samo dok je aplikacija otvorena.', allow: ALLOW, later: LATER },
  notifications: { art: 'bell', title: 'Da Vam javimo kad stigne odgovor?', message: 'Samo o Vašim zadacima i Dogovorima.', allow: ALLOW, later: LATER },
};

/** A question that is open: what is asked, and the id its answer must carry. */
export type PermissionAskOpen = Readonly<{ id: number; kind: PermissionKind }>;
type Pending = { open: PermissionAskOpen; settle: (answer: PermissionAskAnswer) => void };

let issued = 0;
const queue: Pending[] = [];
const hosts: object[] = [];
const listeners = new Set<() => void>();
const notify = () => listeners.forEach(listener => listener());

/** Every question that is waiting is answered "later": nobody is there to draw it, and a flow must never wait on nothing. */
function releaseAll() {
  for (const pending of queue.splice(0)) pending.settle('later');
}

export const permissionAsk = {
  /**
   * Asks before the system does. Questions come one at a time, in the order they were asked. With no host mounted the answer is
   * `allow` at once: nothing could draw the question, and the feature then behaves exactly as it did before this existed.
   */
  ask(kind: PermissionKind): Promise<PermissionAskAnswer> {
    if (hosts.length === 0) return Promise.resolve('allow');
    return new Promise<PermissionAskAnswer>(resolve => {
      let done = false;
      const pending: Pending = { open: Object.freeze({ id: ++issued, kind }), settle: answer => { if (!done) { done = true; resolve(answer); } } };
      queue.push(pending);
      notify();
    });
  },
  /** The host reports the person's answer to the question with this id. An answer to an older question is ignored. */
  answer(id: number, answer: PermissionAskAnswer) {
    const index = queue.findIndex(pending => pending.open.id === id);
    if (index < 0) return;
    const [pending] = queue.splice(index, 1);
    pending.settle(answer);
    notify();
  },
  /** The question on show for this host: only the first host that was mounted draws, so two hosts never stack two dialogs. */
  current(host: object): PermissionAskOpen | null {
    return hosts[0] === host ? queue[0]?.open ?? null : null;
  },
  /** A host is mounted for as long as the returned function has not been called. When the last one goes, open questions are "later". */
  mountHost(host: object): () => void {
    hosts.push(host);
    notify();
    return () => {
      const index = hosts.indexOf(host);
      if (index >= 0) hosts.splice(index, 1);
      if (hosts.length === 0) releaseAll();
      notify();
    };
  },
  subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
  /** Whether a host is there to draw (used by tests and by features that want to know whether a dialog can appear). */
  hasHost: () => hosts.length > 0,
};

/** What the system would do if asked now: grant at once, show its window, or refuse without a window. */
export type PermissionNeed = 'granted' | 'ask' | 'blocked' | 'unknown';

/**
 * The one rule every site follows: the dialog comes only when the system is about to ask. A permission that is already granted
 * is not explained again; one the system will no longer ask about (blocked) has no window to prepare, and the feature's own
 * recovery (the phone settings) says what is left; one that cannot be read is not guessed at. All three go straight on.
 */
export async function askInContext(kind: PermissionKind, need: () => Promise<PermissionNeed>): Promise<PermissionAskAnswer> {
  // With nothing to draw the question the state is not even read: the feature behaves exactly as it did before.
  if (!permissionAsk.hasHost()) return 'allow';
  let now: PermissionNeed = 'unknown';
  try { now = await need(); } catch { now = 'unknown'; }
  return now === 'ask' ? permissionAsk.ask(kind) : 'allow';
}
