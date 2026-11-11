import type { ViewStyle } from 'react-native';
import { sys } from '../system/tokens';

/**
 * ONE bubble shape for text, photo and voice (proposal R, 2026-10-07). The big corner is the card corner; the corner of the
 * sender's side that joins a neighbour, and the tail at the bottom of a run, are the 8 step, so a run of messages of one person
 * reads as one stack with a single tail. Mine are charcoal on the right with a white word; theirs white with the card edge on the
 * left. A failed send of mine goes to the danger wash with ink words, as before.
 *
 *   lone bubble     tail corner only
 *   first of a run  all big
 *   middle          joint above, big below
 *   last of a run   joint above, tail below
 */
export const BUBBLE_JOINT = sys.space.sm;

export function bubbleShape({ mine, first, last, failed = false }: { mine: boolean; first: boolean; last: boolean; failed?: boolean }): ViewStyle {
  const big = sys.radius.card;
  const top = first ? big : BUBBLE_JOINT, bottom = last ? BUBBLE_JOINT : big;
  return {
    alignSelf: mine ? 'flex-end' : 'flex-start',
    ...(mine
      ? { borderTopLeftRadius: big, borderBottomLeftRadius: big, borderTopRightRadius: top, borderBottomRightRadius: bottom,
        backgroundColor: failed ? sys.color.dangerSoft : sys.conversation.user }
      : { borderTopRightRadius: big, borderBottomRightRadius: big, borderTopLeftRadius: top, borderBottomLeftRadius: bottom,
        backgroundColor: sys.conversation.surface, borderWidth: 1, borderColor: sys.conversation.edge }),
  };
}

/** Air above a bubble: a new run leaves room, a bubble of the same run sits close, and the one right under a separator needs little. */
export function bubbleGap(first: boolean, afterSeparator: boolean): number {
  return first ? (afterSeparator ? sys.space.xs : sys.space.md) : 3;
}
