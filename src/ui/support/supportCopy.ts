import type { SupportState } from './SupportController';

/**
 * The controller's own words about the last command, in one place, so a screen can draw each in the look that fits it
 * (round 5 review: a refused send was drawn as plain information). The words are unchanged; only their source moved.
 */
export const supportCopy = {
  committed: 'Radnja je potvrđena.',
  absent: 'Potvrda prethodne radnje još nije pronađena.',
  cancelled: 'Prvobitno slanje je zaustavljeno. Ranije primljen predmet ostaje sačuvan.',
  markedRead: 'Prikazani događaji su označeni kao pročitani.',
} as const;

/**
 * How a message of the support controller reads: `success` a confirmed command, `info` a plain fact the person chose
 * (a stopped send, events marked as read), `warn` something that waits for the person (a confirmation not found yet,
 * or a word about the send, its replay, its stop or its check while that send is still unconfirmed), `danger`
 * everything else: a failed read, a failed "mark as read", or a refused command without a send left to check.
 *
 * In practice a failed send, replay, stop or check keeps its send unconfirmed (`pending` stays set), so those are drawn
 * as waiting: the send may already have reached support, and the warn panel above asks the person to check it. Danger is
 * then the `ERROR` state and a failed "mark as read", which says nothing about the send even while one waits (round 5c
 * review: it was drawn as waiting while a reply was unconfirmed).
 */
export type SupportMessageTone = 'success' | 'info' | 'warn' | 'danger';
export function supportMessageTone(state: Pick<SupportState, 'phase' | 'message' | 'pending' | 'command'>): SupportMessageTone {
  if (state.phase === 'ERROR') return 'danger';
  if (state.message === supportCopy.committed) return 'success';
  if (state.message === supportCopy.cancelled || state.message === supportCopy.markedRead) return 'info';
  if (state.message === supportCopy.absent || (state.pending && state.command !== 'MARK')) return 'warn';
  return 'danger';
}

/**
 * The absent-confirmation words are already said by the recovery panel ("Potvrda još nije pronađena…") whenever a send
 * waits, so a screen does not repeat them as a second warning, seen and spoken twice (round 5c review).
 */
export const supportMessageShown = (state: Pick<SupportState, 'message' | 'pending'>) =>
  !!state.message && !(state.pending && state.message === supportCopy.absent);
