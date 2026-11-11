import { useEffect, useRef } from 'react';
import { AccessibilityInfo } from 'react-native';

type Message = { id: string; fromAi: boolean; body: string };
export type ConversationArrivalInput = {
  messages: readonly Message[];
  streamingText?: string;
  sentMessage?: string | null;
  busy?: boolean;
  /** Account/conversation incarnation. A replacement is history, even if its message IDs happen to match. */
  conversationKey?: string;
};
type Memory = {
  key: string | undefined; committed: boolean; baselined: boolean;
  seen: Set<string>; announced: Set<string>;
  lastSent: string | null; preview: string | null;
  streamPending: boolean; streamConsumed: boolean; streamVisible: boolean;
};
const empty = (key: string | undefined): Memory => ({ key, committed: false, baselined: false,
  seen: new Set(), announced: new Set(), lastSent: null, preview: null,
  streamPending: false, streamConsumed: false, streamVisible: false });

/**
 * Presentation bookkeeping for ONE owned conversation. `messages` are canonical completed rows; fragments belong
 * only in `streamingText`. Busy/retry state is not evidence that a history row is new, or that a fragment is complete.
 * Call shouldEnter for each rendered message and combine with the shell's existing reduced-motion preference.
 * Only committed new assistant rows are announced, once by ID. Stream fragments never trigger speech.
 */
export function useConversationArrival(input: ConversationArrivalInput) {
  const memory = useRef<Memory | null>(null);
  if (!memory.current) memory.current = empty(input.conversationKey);
  const prior = memory.current.key === input.conversationKey ? memory.current : empty(input.conversationKey);
  // Render is a pure preview of the next commit: repeated reads/StrictMode renders cannot consume an entrance.
  // Stream fragments and composer keystrokes do not add canonical IDs. Share
  // the committed ledgers until a real arrival requires a copy; never mutate
  // a prior render's ledger while computing the next render.
  const next: Memory = { ...prior };
  const sent = input.sentMessage?.trim() || null, stream = !!input.streamingText?.trim();
  if (sent && sent !== prior.lastSent) {
    next.preview = sent;
    next.streamPending = false; next.streamConsumed = false;
  }
  next.lastSent = sent;
  if (!stream && prior.streamVisible) next.streamConsumed = false;
  if (stream && !next.streamConsumed) next.streamPending = true;
  next.streamVisible = stream;

  // Initial history can arrive asynchronously after an empty render. Only an actually visible local preview/stream
  // establishes a live first turn; an initially busy restored intent with no text must remain a silent history read.
  let firstArrival = input.messages.length;
  if (prior.committed && input.messages.length) {
    if (!prior.baselined) {
      if (next.preview) {
        const index = input.messages.findLastIndex(message => !message.fromAi && message.body.trim() === next.preview);
        if (index >= 0) firstArrival = index;
      }
      if (firstArrival === input.messages.length && next.streamPending) {
        const index = input.messages.findLastIndex(message => message.fromAi);
        if (index >= 0) firstArrival = index;
      }
    } else {
      const lastKnown = input.messages.findLastIndex(message => prior.seen.has(message.id));
      // Prepended history is not an arrival. An unanchored wholesale replacement is history unless a live turn was seen.
      if (lastKnown >= 0) firstArrival = lastKnown + 1;
      else if (next.preview || next.streamPending) firstArrival = 0;
    }
  }
  const entering = new Set<string>(), announcements: Message[] = [];
  input.messages.forEach((message, index) => {
    if (next.seen.has(message.id)) return;
    if (next.seen === prior.seen) next.seen = new Set(prior.seen);
    next.seen.add(message.id);
    if (index < firstArrival) return;
    if (message.fromAi) {
      if (!next.streamPending && message.body.trim()) entering.add(message.id);
      if (next.streamPending) { next.streamPending = false; next.streamConsumed = stream; }
      if (message.body.trim()) announcements.push(message);
    } else if (next.preview && message.body.trim() === next.preview) {
      next.preview = null; // This user row already appeared as sentMessage; the replacement stays still.
    } else entering.add(message.id);
  });
  next.committed = true;
  next.baselined = prior.baselined || input.messages.length > 0;

  if (announcements.length) next.announced = new Set(prior.announced);

  useEffect(() => {
    // The effect may be replayed in StrictMode. Mutating this committed ledger before announcing makes that replay silent.
    memory.current = next;
    for (const message of announcements) {
      if (next.announced.has(message.id)) continue;
      next.announced.add(message.id);
      AccessibilityInfo?.announceForAccessibility?.(`USKOČI: ${message.body}`);
    }
  });
  return { shouldEnter: (id: string) => entering.has(id) };
}
