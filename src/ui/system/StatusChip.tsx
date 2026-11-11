import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { T } from '../Text';
import { sys } from './tokens';

/**
 * ONE chip for where a thing STANDS (plan 2.2, "jedan sistem stanja"). Today the same state has several names and several
 * looks (a task is "Čeka prijave", "Objavljen" and "Popunjen" on three screens; an application is drawn by a coloured dot on
 * one card and a coloured word on another). This is the one drawing, with the one vocabulary beside it.
 *
 * A state is carried by TWO things at once, never by colour alone: a SHAPE and a WORD. The shape says the phase, the tone
 * says whose move it is:
 *
 *   shape  dot    something is going on           ring  not live yet, or sent and waiting for someone else
 *          check  settled: agreed, chosen, done   dash  ended without a result
 *   tone   green  it goes (nothing for you to do)    attention  it waits for YOU (orange)
 *          neutral  it waits for someone else        grey       over, closed
 *
 * The word is always drawn (12 px `label` type) and is the accessible name; the mark is decoration for a screen reader.
 * Everything is built from `sys` tokens only; the pairs read at least 4.5:1 as words and 3:1 as marks (the test measures them).
 *
 * This unit is the component and its table. Screens adopt it wave by wave (the plan's list: Moji zadaci, Moje prijave, the
 * candidates, the Dogovori list); none was rewired here.
 */

export type StatusShape = 'dot' | 'ring' | 'check' | 'dash';
export type StatusTone = 'neutral' | 'green' | 'attention' | 'grey';

/** Every state the chip can say. A dotted name, so a task's "cancelled" and a Dogovor's are never the same key. */
export type StatusKey =
  | 'task.draft' | 'task.published' | 'task.choosing' | 'task.agreed' | 'task.now' | 'task.completed' | 'task.cancelled' | 'task.expired'
  | 'application.sent' | 'application.seen' | 'application.selected' | 'application.notSelected' | 'application.withdrawn' | 'application.closed';

export type StatusSpec = { word: string; shape: StatusShape; tone: StatusTone };

/**
 * The one table: the word, the shape and the tone of each state (plan 2.2). "Bira se" is the one that waits for the person
 * (the requester has applications to choose from); a state that waits for someone else is neutral; a finished one is grey.
 */
export const STATUS_CHIPS: Readonly<Record<StatusKey, StatusSpec>> = {
  'task.draft': { word: 'Nacrt', shape: 'ring', tone: 'neutral' },
  'task.published': { word: 'Objavljen', shape: 'dot', tone: 'green' },
  'task.choosing': { word: 'Bira se', shape: 'dot', tone: 'attention' },
  'task.agreed': { word: 'Dogovoren', shape: 'check', tone: 'green' },
  // The agreed time has arrived. The word is the owner's (decision d01, 2026-10-07): "U toku", not "Termin je sada".
  'task.now': { word: 'U toku', shape: 'dot', tone: 'green' },
  'task.completed': { word: 'Završen', shape: 'check', tone: 'grey' },
  'task.cancelled': { word: 'Otkazan', shape: 'dash', tone: 'grey' },
  'task.expired': { word: 'Istekao', shape: 'dash', tone: 'grey' },
  'application.sent': { word: 'Poslata', shape: 'ring', tone: 'neutral' },
  'application.seen': { word: 'Viđena', shape: 'dot', tone: 'neutral' },
  'application.selected': { word: 'Izabrana', shape: 'check', tone: 'green' },
  'application.notSelected': { word: 'Nije izabrana', shape: 'dash', tone: 'grey' },
  'application.closed': { word: 'Zatvorena', shape: 'dash', tone: 'grey' },
  'application.withdrawn': { word: 'Povučena', shape: 'dash', tone: 'grey' },
};

export const STATUS_KEYS = Object.keys(STATUS_CHIPS) as StatusKey[];

/** What each tone is drawn in: the chip's ground, its mark and its word. Tokens only; the contrast of each pair is measured by the test. */
export const STATUS_TONES: Readonly<Record<StatusTone, { ground: string; mark: string; word: string }>> = {
  neutral: { ground: sys.color.wash, mark: sys.color.muted, word: sys.color.ink },
  green: { ground: sys.color.greenSoft, mark: sys.color.green, word: sys.color.ink },
  // The orange of the action fails as a word and as a thin mark on its own soft ground, so the chip uses the two inks that
  // were made for it: `orangeInk` for the mark, `waitingInk` for the words on `orangeSoft`.
  attention: { ground: sys.color.orangeSoft, mark: sys.color.orangeInk, word: sys.color.waitingInk },
  grey: { ground: sys.color.wash, mark: sys.color.muted, word: sys.color.muted },
};

/** The side of the square the mark is drawn in, in dp. */
export const STATUS_MARK = 12;

/** The shape, alone: a filled dot (6 dp), a ring, a check or a dash, in the tone's mark colour. Decoration: it is not read aloud. */
export function StatusMark({ shape, tone }: { shape: StatusShape; tone: StatusTone }) {
  const color = STATUS_TONES[tone].mark;
  return <Svg testID="status-mark" width={STATUS_MARK} height={STATUS_MARK} viewBox="0 0 12 12"
    accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
    {shape === 'dot' ? <Circle cx={6} cy={6} r={3} fill={color} /> : null}
    {shape === 'ring' ? <Circle cx={6} cy={6} r={2.6} fill="none" stroke={color} strokeWidth={1.6} /> : null}
    {shape === 'check' ? <Path d="M2.4 6.4 L5 9 L9.6 3.4" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" /> : null}
    {shape === 'dash' ? <Path d="M3 6 L9 6" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" /> : null}
  </Svg>;
}

/**
 * The chip: the mark, then the word, on the tone's soft ground. `detail` adds what the word alone cannot say, after a dot
 * ("Bira se · 3"); a screen reader hears the word and then the detail. It never changes the word, the shape or the tone.
 */
export function StatusChip({ status, detail, style, testID = 'status-chip' }: {
  status: StatusKey; detail?: string; style?: StyleProp<ViewStyle>; testID?: string;
}) {
  const { word, shape, tone } = STATUS_CHIPS[status];
  const palette = STATUS_TONES[tone];
  const said = detail ? `${word}, ${detail}` : word;
  return <View testID={testID} accessible accessibilityRole="text" accessibilityLabel={said} style={[s.chip, { backgroundColor: palette.ground }, style]}>
    <StatusMark shape={shape} tone={tone} />
    <T variant="label" style={[s.word, { color: palette.word }]}>{detail ? `${word} · ${detail}` : word}</T>
  </View>;
}

const s = StyleSheet.create({
  // Wide enough to be a chip, no taller than its 16 px line plus a hair: it sits in a row of facts and never a tap target.
  chip: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: sys.space.xs, paddingVertical: sys.space.xs,
    paddingLeft: sys.space.sm, paddingRight: sys.space.md, borderRadius: sys.radius.pill },
  // `label` tracks wide for capitals; these words are not capitals, so the chip takes the tracking back to none.
  word: { letterSpacing: 0 },
});
