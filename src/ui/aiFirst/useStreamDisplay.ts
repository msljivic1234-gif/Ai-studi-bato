import { useLayoutEffect, useRef } from 'react';

type Input = {
  conversationKey?: string;
  streamingText?: string;
  sentMessage?: string | null;
  pending: boolean;
  /** Only the authoritative, completed conversation rows belong here. */
  messages: readonly { id: string; fromAi: boolean }[];
};
type Memory = {
  key: string | undefined; sent: string | null; pending: boolean;
  assistantId: string | undefined; received: string; shown: string; completed: boolean;
};
type GraphemeSegmenter = { segment(text: string): Iterable<{ index: number }> };

// Hermes versions without Segmenter use the conservative word boundary below.
// No polyfill, provider call or per-character animation is needed for a preview.
let segmenter: GraphemeSegmenter | null = null;
try {
  const Constructor = (Intl as unknown as { Segmenter?: new (locale: string, options: { granularity: 'grapheme' }) => GraphemeSegmenter }).Segmenter;
  if (Constructor) segmenter = new Constructor('sr', { granularity: 'grapheme' });
} catch { /* Word boundaries remain available when Intl/Segmenter is absent. */ }

/**
 * The final grapheme may still receive a combining mark, skin tone or ZWJ
 * continuation in the next delta. Keep it pending until another grapheme
 * arrives. The canonical message, never a timer, exposes the final tail.
 */
export function stableStreamPrefix(raw: string): string {
  // Transport chunks may end between UTF-16 surrogates. Do not expose a lone
  // surrogate, even when a platform segmenter would accept it as a character.
  let validEnd = 0;
  while (validEnd < raw.length) {
    const unit = raw.charCodeAt(validEnd);
    if (unit >= 0xd800 && unit <= 0xdbff) {
      const low = raw.charCodeAt(validEnd + 1);
      if (!(low >= 0xdc00 && low <= 0xdfff)) break;
      validEnd += 2;
    } else {
      if (unit >= 0xdc00 && unit <= 0xdfff) break;
      validEnd++;
    }
  }
  const valid = raw.slice(0, validEnd);
  if (segmenter) {
    try {
      let end = 0;
      for (const part of segmenter.segment(valid)) end = part.index;
      return valid.slice(0, end);
    } catch { /* Keep the same safe fallback if this runtime cannot segment. */ }
  }
  // A boundary after ASCII whitespace and before an ordinary Serbian/ASCII
  // character cannot split a grapheme. Hold the unfinished word rather than
  // approximate the Unicode algorithm. Emoji-only/other-script tails wait for
  // a safe next word or the complete canonical message; CRLF stays intact.
  const boundaries = /[ \t\r\n]+(?=[!-~ČĆŠĐŽčćšđžА-Яа-яЂЈЉЊЋЏђјљњћџ])/g;
  let end = 0, match: RegExpExecArray | null;
  while ((match = boundaries.exec(valid))) end = match.index + match[0].length;
  return valid.slice(0, end);
}

/** Presentation only: append real deltas; a readback row always wins. */
export function useStreamDisplay(input: Input): string {
  const memory = useRef<Memory | null>(null);
  const raw = input.streamingText ?? '';
  const sent = input.sentMessage?.trim() || null;
  const assistantId = input.messages.findLast(message => message.fromAi)?.id;
  const previous = memory.current;
  // Callers already clear their stream on abort, retry and account teardown.
  // A new sent draft or a fresh pending turn also separates back-to-back turns.
  const replace = !previous || previous.key !== input.conversationKey || !previous.received
    || (sent !== null && sent !== previous.sent) || (input.pending && !previous.pending);
  const base: Memory = replace
    ? { key: input.conversationKey, sent, pending: input.pending, assistantId, received: '', shown: '', completed: false }
    : { ...previous, pending: input.pending };
  let next = base;
  if (!raw) next = { ...base, received: '', shown: '', completed: false, assistantId };
  else if (base.completed || assistantId !== base.assistantId) next = { ...base, completed: true, shown: '' };
  else if (raw !== base.received && raw.startsWith(base.received)) {
    const shown = stableStreamPrefix(raw);
    // A truncated/replaced provider snapshot cannot erase already visible
    // words. It stays a preview until its canonical readback or explicit clear.
    if (shown.startsWith(base.shown)) next = { ...base, received: raw, shown };
  }
  // Commit bookkeeping only after React commits this render. StrictMode or an
  // abandoned render cannot consume the next turn or overwrite visible text.
  useLayoutEffect(() => { memory.current = next; });
  return next.shown;
}
