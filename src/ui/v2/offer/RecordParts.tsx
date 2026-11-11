import type { ReactNode } from 'react';
import { StyleSheet, View, type GestureResponderEvent } from 'react-native';
import { Press } from '../../Press';
import { T } from '../../Text';
import { Glyph } from '../../system/Glyph';
import { layout, ruleWidth } from '../../system/layout';
import { sys } from '../../system/tokens';

/**
 * The two parts that every record of this family shares (UI/UX pass 2026-10-08, composition spec 4.5 and 4.7): one of my own tasks in
 * Moji zadaci, one of my applications in Moje prijave and one candidate among the applications to a task are the same kind of
 * thing, a `Surface record`: a state, what it is, what it is worth, a fact or two, and at most ONE thing to do next. They each drew
 * their own money line (an amount of 17, 20 or 24, with a picture of money beside it, and the people on a row of their own) and their
 * own foot (a hairline, a 10 and a 16 of padding, a wash). This file is the one of each.
 */

/**
 * What a record is worth, on ONE line: the amount is money (ink, bold, tabular), what it buys is a quiet word beside it, and what
 * belongs with it (the people, the places filled) follows after a dot: "2.000 RSD po osobi · 0/2 popunjeno", "4.500 RSD ukupno · 2 osobe".
 * A value that is not an amount, because nobody named a price ("Tražim ponude", "Cena nije navedena"), is words and never wears money's
 * weight, so a missing price never looks like an amount: "Tražim ponude · 0/1 popunjeno". Each word is a text of its own (a screen
 * reader and a test can find "ukupno" apart from the amount).
 *
 * It wraps when the room is short, by whole parts, and a dot always stays at the END of the part it follows ("125.000 RSD po osobi ·" over
 * "3/12 popunjeno"): a dot that begins a wrapped line is a dot with nothing before it. At a large text size (`stacked`) the parts stand one
 * under the other, each from the left edge, and no dot is drawn at all.
 */
export function MoneyLine({ amount, word, basis, notes = [], stacked = false, testID }: {
  /** The amount as it is written. Absent when the value is words. */
  amount?: string | null;
  /** The words of a value that is not an amount. Ignored beside an amount. */
  word?: string | null;
  /** What the amount buys ("ukupno", "po osobi"): a quiet word right after it, with no dot. */
  basis?: string | null;
  /** What belongs beside it, each after a dot ("2 osobe", "0/2 popunjeno"). */
  notes?: readonly (string | null | undefined)[];
  stacked?: boolean;
  testID?: string;
}) {
  const tail = notes.filter((note): note is string => !!note);
  const value = <>
    {amount ? <T variant="priceRow" style={s.amount}>{amount}</T> : word ? <T variant="note" tone="muted" style={s.note}>{word}</T> : null}
    {amount && basis ? <T variant="note" tone="muted" style={s.note}>{basis}</T> : null}
  </>;
  const spoken = (note: string) => <T key={note} variant="note" tone="muted" style={s.note}>{note}</T>;
  if (stacked) return <View testID={testID} style={s.moneyStacked}>{value}{tail.map(spoken)}</View>;
  // The parts of the line, each one wrapping as a whole; the dot belongs to the part before it and goes with it.
  const parts: ReactNode[] = [...(amount || word ? [<View key="value" style={s.value}>{value}</View>] : []), ...tail.map(spoken)];
  return <View testID={testID} style={s.money}>
    {parts.map((part, at) => <View key={at} style={s.part}>
      {part}
      {at < parts.length - 1 ? <T variant="note" tone="muted" accessible={false} importantForAccessibility="no" accessibilityElementsHidden>·</T> : null}
    </View>)}
  </View>;
}

/** How the words of a foot are drawn. `muted` is a sentence of fact that happens to lead somewhere; the others are commands. */
export type RecordFootTone = 'muted' | 'green' | 'ink' | 'waiting';
const WORDS: Record<Exclude<RecordFootTone, 'muted'>, string> = { green: sys.color.green, ink: sys.color.ink, waiting: sys.color.warn };

/**
 * The foot of a record, the "noga": the one thing to do next, in a target of its own under a 1 dp line, never a button inside the
 * body. A touch above the line opens the record and a touch below it does the one thing, so the line is the border between the two
 * (no hit slop). It belongs inside the record's `Surface` (which has no padding then) as a sibling of the body.
 *
 * `green` goes somewhere (a caret to the right); `ink` is a rare step that asks before it ends something (no caret: it opens a
 * question, not a screen); `waiting` is what waits for me (an orange dot and the words in the `warn` ink, a caret down for what opens
 * under the card); `muted` is a sentence of fact in grey words with a caret to the right. Disabled draws the words muted, never faded.
 */
export function RecordFoot({ label, tone, caret = tone === 'ink' ? 'none' : 'right', disabled = false, accessibilityLabel, accessibilityHint,
  onPress, onPressIn, onPressOut, testID }: {
  label: string; tone: RecordFootTone; caret?: 'right' | 'down' | 'none'; disabled?: boolean;
  accessibilityLabel: string; accessibilityHint?: string;
  onPress: () => void; onPressIn?: (event: GestureResponderEvent) => void; onPressOut?: (event: GestureResponderEvent) => void;
  testID?: string;
}) {
  const color = disabled ? sys.color.muted : tone === 'muted' ? undefined : WORDS[tone];
  return <>
    <View pointerEvents="none" style={s.rule} />
    <Press testID={testID} accessibilityRole="button" accessibilityLabel={accessibilityLabel} accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled }} disabled={disabled} onPress={onPress} onPressIn={onPressIn} onPressOut={onPressOut}
      haptic="select" scaleTo={1} hitSlop={0} style={s.foot}>
      {tone === 'waiting' ? <View style={[s.dot, disabled && s.dotQuiet]} /> : null}
      <T variant={tone === 'muted' ? 'note' : 'bodyStrong'} tone={tone === 'muted' || disabled ? 'muted' : undefined} style={[s.footWords, color ? { color } : null]}>{label}</T>
      {caret === 'none' ? null : <Glyph name={caret === 'down' ? 'caret-down' : 'caret-right'} size={20} tone={color === WORDS.green ? 'green' : 'muted'} />}
    </Press>
  </>;
}

/** What a record's body is made of: 16 inside, 12 between the parts (the spec's "razmak u kartici 12"). A record with a foot takes no padding of its own. */
export const recordBody = { padding: layout.card, gap: sys.space.md } as const;
/** The `Surface record` of a card that has a body and a foot as two targets: the body and the foot pad themselves. */
export const recordFlush = { padding: 0 } as const;

const s = StyleSheet.create({
  // The parts wrap as wholes, 4 apart (a dot and its part read as one phrase), and 4 under each other when the line breaks.
  money: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', columnGap: sys.space.xs, rowGap: sys.space.xs },
  // (a column wraps too, as it always did: a part that is longer than the room breaks inside itself and never runs out of the card)
  moneyStacked: { flexDirection: 'column', flexWrap: 'wrap', alignItems: 'flex-start', rowGap: sys.space.xs },
  part: { flexDirection: 'row', alignItems: 'baseline', columnGap: sys.space.xs, flexShrink: 1, maxWidth: '100%' },
  // The amount and what it buys: 8 apart, as they always were.
  value: { flexDirection: 'row', alignItems: 'baseline', columnGap: sys.space.sm, flexShrink: 1, minWidth: 0 },
  amount: { color: sys.color.money, flexShrink: 1, maxWidth: '100%', textAlign: 'left' },
  note: { flexShrink: 1 },
  rule: { height: ruleWidth, backgroundColor: sys.color.line },
  foot: { flexDirection: 'row', alignItems: 'center', gap: sys.space.md, minHeight: layout.touch, paddingHorizontal: layout.card, paddingVertical: sys.space.md },
  footWords: { flex: 1, minWidth: 0 },
  dot: { width: sys.space.sm, height: sys.space.sm, borderRadius: sys.radius.pill, backgroundColor: sys.color.orange },
  dotQuiet: { backgroundColor: sys.color.muted },
});
