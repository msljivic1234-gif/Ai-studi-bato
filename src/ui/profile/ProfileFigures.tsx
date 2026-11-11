import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { Press } from '../Press';
import { T } from '../Text';
import { FactArt } from '../system/FactArt';
import { Glyph } from '../system/Glyph';
import { plural } from '../system/plural';
import { sys } from '../system/tokens';

/**
 * The three figures of a profile (owner's pick of 8 Oct 2026, "Lice i tri broja"): rating, finished and how reliably the person comes
 * as agreed, in ONE row under the face, with no line and no box (the only "table" a profile has). They are the same on the person's own
 * profile and on the public one.
 *
 * Every figure is the server's or it is not drawn: a figure the server did not return (a reliability the viewer may not read, a rating
 * that is not available) leaves its place to the other two, and a rating that does not exist YET says so in words ("Još nema ocena") instead of
 * a zero nobody counted. The person's own profile does not draw a reliability that does not exist yet either (owner's phone, 8 Oct 2026: what is
 * not there is not drawn); `reliabilityFigure(null)` is only what a visitor's sheet still says for a person with too few Dogovori. Nothing here
 * computes a figure; it only writes down what came back.
 */
export type Figure = {
  /** The figure as the server gave it ("4,8", "9", "90 %"); null when there is none, and `word` says so. */
  value: string | null;
  /** The words that stand where a figure does not exist yet. */
  word?: string;
  /** What the figure is, under it, in the smallest type (12). */
  label: string;
  /** The rating carries the flat star beside its figure. */
  star?: boolean;
  /** How a screen reader says it, when "the figure and its label" is not enough ("Ocena 4,8, 12 ocena"). */
  spoken?: string;
  /** What a screen reader adds after it (where it goes, or what it is made of). */
  hint?: string;
};

/** A rating the Serbian way: "4,8", "5,0", and two decimals only when the average really has two. */
export const ratingText = (value: number) => value.toLocaleString('sr-Latn-RS', { minimumFractionDigits: 1, maximumFractionDigits: 2 });
/** The words of the reliability figure everywhere it is said (the sentence under the figure). */
export const RELIABILITY_UNDER = 'dolazi kako je dogovoreno';

/** The rating of someone who has ratings: the star, the average and the count it stands on. */
export function ratingFigure(average: number, count: number | null): Figure {
  const label = count !== null && count > 0 ? plural(count, 'ocena', 'ocene', 'ocena') : 'ocena';
  return { value: ratingText(average), label, star: true, spoken: `Ocena ${ratingText(average)}, ${label}` };
}
/** A person without a rating yet: the words, never a star and never a zero average. */
export const NEW_RATING: Figure = { value: null, word: 'Još nema', label: 'ocena' };
/** How many Dogovori the person finished: "9 završenih", "1 završen". Zero is said as zero: the server counted it. */
export function finishedFigure(count: number): Figure {
  return { value: count.toLocaleString('sr-Latn-RS'), label: plural(count, 'završen', 'završena', 'završenih').replace(/^\S+\s/, '') };
}
/** How reliably the person comes as agreed: a percentage, or the words while there are too few Dogovori for one. */
export function reliabilityFigure(percent: number | null): Figure {
  return percent === null ? { value: null, word: 'Još nema procenta', label: RELIABILITY_UNDER } : { value: `${percent} %`, label: RELIABILITY_UNDER };
}

/** The row the three figures stand in; a cell that is not drawn leaves its share to the others. */
export function FigureRow({ children, testID }: { children: ReactNode; testID?: string }) {
  return <View testID={testID} style={s.row}>{children}</View>;
}

/**
 * One figure: the figure at 24/700 (or its words at 16/600), and what it is under it. With `onPress` it is a way in (the rating opens
 * "Ocene", the finished count opens the finished Dogovori) and says so with the quiet arrow every way onward ends in, and with its hint.
 */
export function FigureCell({ figure, onPress, testID }: { figure: Figure; onPress?: () => void; testID?: string }) {
  const spoken = figure.spoken ?? `${figure.value ?? figure.word ?? ''} ${figure.label}`.trim();
  const body = <>
    {figure.value ? <View style={s.valueRow}>
      {figure.star ? <FactArt kind="star" size={16} /> : null}
      <T variant="priceLarge" style={s.ink}>{figure.value}</T>
    </View> : <T variant="bodyStrong" style={s.word}>{figure.word}</T>}
    <View style={s.labelRow}>
      <T variant="label" tone="muted" style={s.label}>{figure.label}</T>
      {onPress ? <Glyph name="caret-right" size={16} tone="muted" /> : null}
    </View>
  </>;
  if (!onPress) return <View testID={testID} accessible accessibilityRole="text" accessibilityLabel={spoken} accessibilityHint={figure.hint} style={s.cell}>{body}</View>;
  return <Press testID={testID} accessibilityRole="button" accessibilityLabel={spoken} accessibilityHint={figure.hint} haptic="select"
    scaleTo={sys.motion.scale.row} onPress={onPress} style={s.cell}>{body}</Press>;
}

/** An independently read figure says what is happening without drawing a false number. */
export function FigureCellPlaceholder({ label }: { label: string }) {
  return <View accessible accessibilityRole="text" accessibilityLabel={label} accessibilityState={{ busy: true }}
    accessibilityLiveRegion="polite" style={s.cell}>
    <T variant="note" tone="muted" style={s.center}>{label}</T>
  </View>;
}

/** A figure that could not be read: one short line and the one way to read it again, in the same place. */
export function FigureCellError({ message, retryLabel, onRetry }: { message: string; /** What a screen reader says for the retry ("Osveži ocene"). */ retryLabel: string; onRetry: () => void }) {
  return <Press accessibilityRole="button" accessibilityLabel={retryLabel} accessibilityHint={message} haptic="select"
    scaleTo={sys.motion.scale.row} onPress={onRetry} style={s.cell}>
    <T variant="note" tone="muted" style={s.center}>{message}</T>
    <T variant="note" style={s.action}>Osveži</T>
  </Press>;
}

const s = StyleSheet.create({
  // Two facts use the card's width instead of leaving a large empty centre; a third shares the same row.
  row: { flexDirection: 'row', alignItems: 'stretch', justifyContent: 'center', gap: sys.space.sm },
  cell: { flexGrow: 1, flexShrink: 1, flexBasis: 0, minWidth: 0, maxWidth: '48%', minHeight: 76,
    alignItems: 'center', justifyContent: 'center', gap: sys.space.xs, paddingVertical: sys.space.sm,
    paddingHorizontal: sys.space.xs, borderRadius: sys.radius.control, backgroundColor: sys.color.wash },
  valueRow: { flexDirection: 'row', alignItems: 'center', gap: sys.space.xs },
  labelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: sys.space.xs, maxWidth: '100%' },
  ink: { color: sys.color.ink },
  word: { color: sys.color.ink, textAlign: 'center' },
  // `label` tracks wide for capitals; these are words, so the tracking is taken back.
  label: { letterSpacing: 0, textAlign: 'center', flexShrink: 1 },
  center: { textAlign: 'center' },
  action: { color: sys.color.green, fontWeight: '600' },
});
