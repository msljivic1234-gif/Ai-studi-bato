import { useEffect, useRef, useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import { Press } from '../Press';
import { T } from '../Text';
import { plural } from '../system/plural';
import { field, sys } from '../system/tokens';

/**
 * From here the field says how much room is left. Below it the counter would be noise: most comments are a sentence or two.
 * The limit itself is the server's (500 code points, `commentPolicy.maxLength`).
 */
export const REVIEW_COMMENT_COUNTER_FROM = 400;
/**
 * Said ONCE, before the comment is sent, and only where a comment can be written (never as an eyebrow, never twice): who sees it,
 * with what, and that it is final. Plain product wording, not legal copy. The comment is shown with the reviewer's rating, name
 * and photo: the star-only reviews of other people are not part of this sentence and no sentence about them is promised anywhere.
 */
export const REVIEW_COMMENT_NOTICE = 'Komentar vide svi na profilu osobe koju ocenjujete, uz Vašu ocenu, ime i fotografiju. Posle slanja se ne menja.';
/** The native field takes twice the limit in UTF-16 units (every code point is at most two), so a paste is never cut silently: the counter says how much to shorten. */
const NATIVE_LIMIT_FACTOR = 2;

/** The room left, or how much to shorten, once the text is near the limit; `null` while it is not worth saying. */
export function commentCounter(count: number, max: number): string | null {
  if (count < REVIEW_COMMENT_COUNTER_FROM) return null;
  return count <= max ? `Još ${plural(max - count, 'znak', 'znaka', 'znakova')}` : `Skrati za ${plural(count - max, 'znak', 'znaka', 'znakova')}`;
}

/** What the rating screen holds for the comment; the screen owns every value and every guard, this component only draws them. */
export type ReviewCommentFieldView = {
  /** The text as typed (memory only: the screen keeps it in its own state and nowhere else). */
  value: string;
  /** The field is drawn; otherwise one quiet row offers it. */
  open: boolean;
  /** False while the review is being sent or its outcome is being checked. */
  editable: boolean;
  /** The server's limit in code points. */
  maxLength: number;
  /** The code points the text will have once it is sent (trimmed, composed). */
  count: number;
  /** The text cannot be sent as it is (too long, a character the server refuses, or the server just refused it). */
  invalid: boolean;
  onOpen: () => void;
  onChange: (value: string) => void;
};

/**
 * The optional comment of the rating screen (D12): ONE quiet row while it is closed, so the stars-only rating is as short as it
 * ever was, and a multi-line field with its notice and its counter once the person opens it. Not preselected, not required, and
 * not a second action: the screen's one green save stays the only command. The field never writes below 12 px.
 */
export function ReviewCommentField({ field: view }: { field: ReviewCommentFieldView }) {
  const input = useRef<TextInput>(null);
  const wasOpen = useRef(view.open);
  const [focused, setFocused] = useState(false);
  // The keyboard rises when the person opens the field, not when the screen comes back with text already in it.
  useEffect(() => {
    if (view.open && !wasOpen.current) input.current?.focus();
    wasOpen.current = view.open;
  }, [view.open]);
  const counter = commentCounter(view.count, view.maxLength);
  if (!view.open) {
    return <View style={s.section}>
      <Press accessibilityRole="button" accessibilityLabel="Dodaj komentar" accessibilityHint="Nije obavezno. Otvara polje za komentar."
        accessibilityState={{ disabled: !view.editable }} disabled={!view.editable} haptic="select" scaleTo={sys.motion.scale.row} hitSlop={0}
        onPress={view.onOpen} style={s.row}>
        <T variant="bodyStrong" style={s.add}>Dodaj komentar</T>
        <T variant="note" tone="muted">Nije obavezno</T>
      </Press>
    </View>;
  }
  return <View style={s.section}>
    <T accessibilityRole="header" variant="heading" style={s.ink}>Komentar</T>
    <T variant="meta" tone="muted">Nije obavezno</T>
    <TextInput ref={input} accessibilityLabel="Komentar o saradnji" multiline value={view.value} editable={view.editable}
      maxLength={view.maxLength * NATIVE_LIMIT_FACTOR} textAlignVertical="top" autoComplete="off" importantForAutofill="no"
      style={[s.input, focused && s.focused, view.invalid && s.invalid]} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
      onChangeText={view.onChange} />
    <T variant="note" tone="muted">{REVIEW_COMMENT_NOTICE}</T>
    {counter ? <T accessibilityLiveRegion="polite" variant="meta" tone={view.count > view.maxLength ? 'danger' : 'muted'}>{counter}</T> : null}
  </View>;
}

const s = StyleSheet.create({
  ink: { color: sys.color.ink },
  // An open section, parted from the one above it by the screen's gap and not by a line (composition spec 2026-10-07, B).
  section: { gap: sys.space.sm, paddingTop: sys.space.sm },
  row: { minHeight: 48, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', columnGap: sys.space.md },
  add: { color: sys.color.green },
  // 120 high at least and 240 at most: it grows with the text, then scrolls inside itself, so the screen's own save never leaves.
  input: { ...field, minHeight: 120, maxHeight: 240 },
  focused: { borderColor: sys.color.green },
  invalid: { borderColor: sys.color.danger },
});
