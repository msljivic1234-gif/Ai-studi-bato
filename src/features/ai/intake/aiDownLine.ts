import { AI_CREDITS_UNAVAILABLE_COPY } from '../../../contracts/aiAvailability';

/**
 * What the conversation says when the AI itself is not there (UX needs R19, until the owner decides on a fallback form): the
 * assistant is down, and what the person already has is safe. The sentence is the owner-safe half of R19 and nothing more - no
 * second way to post a task, no promise of a notice when the AI returns.
 *
 * It is said only when there IS a draft to keep: a conversation with no fact in it yet has nothing saved, and "Nacrt je sačuvan." would
 * be an invented comfort. Without a draft the service's own words stay as they were.
 */
export const AI_DOWN_WITH_DRAFT = 'AI je privremeno nedostupan. Nacrt je sačuvan.';

/** The two sentences the data layer gives for an assistant that is down (`aiNeedV2Production`), the second with the service's own diagnostic. */
const AI_DOWN_COPIES: readonly string[] = [AI_CREDITS_UNAVAILABLE_COPY, 'AI trenutno nije dostupan.'];

export function aiDownLine(error: string | null, hasDraft: boolean): string | null {
  return error !== null && hasDraft && AI_DOWN_COPIES.includes(error) ? AI_DOWN_WITH_DRAFT : error;
}

/** The code the data layer gives a send whose delivery it cannot prove (`aiNeedV2Production`, `aiNeedTurnStream`, the location dialogue). */
export const SEND_UNCONFIRMED_CODE = 'AI_TURN_SEND_UNCONFIRMED';

/**
 * The line in red above the status of the conversation. A send that may not have arrived is said ONCE, by the status line under the thread
 * ("Ne znamo da li je poruka poslata.") and the one button beside it ("Proveri"); the data layer's own sentence for the same fact is a second
 * sentence for one thing, in other words and with another button's verb ("Osveži prikaz"), so it is not drawn above them. `unconfirmedSend` is
 * that sentence, remembered when the send ended unproven; every other failure keeps its own line.
 */
export function conversationErrorLine(error: string | null,
  options: { hasDraft: boolean; unconfirmedSend: string | null; statusCopy: string | null }): string | null {
  if (error !== null && options.statusCopy !== null && error === options.unconfirmedSend) return null;
  return aiDownLine(error, options.hasDraft);
}
