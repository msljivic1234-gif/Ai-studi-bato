import { Fragment, useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import type { DogovorProjekcija } from '../../contracts/projections';
import { T } from '../Text';
import { Glyph } from '../system/Glyph';
import { useReducedMotion } from '../system/motion';
import { useWindowRoom, type WindowRoom } from '../system/textScale';
import { sys } from '../system/tokens';
import { cancellationLine } from './agreementListModel';
import { agreementStepModel, STEP_MARK, stepsFitInRow, stepsSummary, type OwnRating, type StepStatus } from './agreementStepsModel';

/** The drawn mark is 24 dp: a check, a dot or an outline. The connector between two marks is a 2 dp line. */
const MARK = STEP_MARK;
/** The line that joins two marks, 2 dp, and where it stands against a mark's centre. */
const LINE = 2;
/** Where the dot of a step that has just become the current one starts, and settles from (M-09): a fraction of its size. */
const DOT_FROM = 0.6;

/**
 * The dot of the current step. It settles from `DOT_FROM` to its size once, over `enter` on `easeOut`, transform only and on the native
 * driver, but ONLY when the step changed while the person was looking (`pop`): the first drawing, a return to the screen and reduced
 * motion show it still. The mark is a state, never a number or a word, so it is the one thing here allowed to move.
 */
function CurrentDot({ pop }: { pop: boolean }) {
  const reduced = useReducedMotion();
  const scale = useRef(new Animated.Value(pop && !reduced ? DOT_FROM : 1)).current;
  useEffect(() => {
    if (!pop || reduced) return;
    const run = Animated.timing(scale, { toValue: 1, duration: sys.motion.enter, easing: Easing.bezier(...sys.motion.easeOut), useNativeDriver: true });
    run.start();
    return () => run.stop();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps -- once, at the moment this dot comes to be the current step's
  return <Animated.View testID="agreement-step-dot" style={[s.dot, { transform: [{ scale }] }]} />;
}

/**
 * One step's mark. Shape and colour together: a green check behind us, a filled green dot where we are, a grey outline ahead and
 * the same grey outline all along for a cancelled Dogovor.
 */
function Mark({ status, pop }: { status: StepStatus; pop: boolean }) {
  if (status === 'done') return <View style={[s.mark, s.markDone]}><Glyph name="check" size={16} tone="onGreen" /></View>;
  if (status === 'current') return <View style={[s.mark, s.markCurrent]}><CurrentDot pop={pop} /></View>;
  return <View style={[s.mark, s.markAhead]} />;
}

/**
 * The step bar of a Dogovor, right under its head (plan 2.6): Dogovoreno, Gotovo, Potvrđeno, Ocena. It is computed from the Dogovor's STATE
 * (`agreementStepModel`), so it says where the Dogovor stands whatever its history holds. One summary for a screen reader ("Gotovo: trenutni
 * korak…"); the marks are drawing only.
 *
 * Each label is one short word on one line and is never broken. In a row, every step is as wide as its own word, and what is left of the
 * row is shared by the lines that join them; when the four words do not fit the row (a larger text size, a narrower window:
 * `stepsFitInRow`) the bar is a column instead, a mark and its word on each line, joined from above. The time the other side has to
 * confirm and a stopped completion are said by the head of the Dogovor, once; the bar adds no second line for them.
 *
 * A cancelled Dogovor is grey as a whole and says so in one line: "Otkazano", and when the reader gives them, when, by whom and why -
 * never a reason that the data does not hold.
 */
export function AgreementSteps({ state, ownRating, cancellation, now, room }: {
  state: DogovorProjekcija['stanje'];
  ownRating?: OwnRating;
  /** What the Dogovor carries about its cancellation; the projection holds none of it today, so this is usually left out. */
  cancellation?: { at?: string | null; by?: string | null; reason?: string | null } | null;
  /** Fixed by tests. */
  now?: Date;
  /** The room the bar is drawn in. The screen leaves it out (the window decides); the galleries and the tests hand in the room they stand for. */
  room?: WindowRoom;
}) {
  const steps = agreementStepModel(state, ownRating);
  const windowRoom = useWindowRoom();
  const row = stepsFitInRow(steps.map(step => step.label), room ?? windowRoom);
  // A dot that comes to be the current one AFTER the first drawing is news (the Dogovor moved on while it was open); the first drawing is not.
  const drawn = useRef(false);
  const pop = drawn.current;
  useEffect(() => { drawn.current = true; }, []);
  const cancelled = state === 'CANCELLED';
  const position = steps.findIndex(step => step.status === 'current');
  const wordStyle = (status: StepStatus, beside = false) => [s.label, beside && s.labelBeside, status === 'current' && s.labelCurrent, (status === 'upcoming' || cancelled) && s.labelAhead];
  return <View testID="agreement-steps" style={s.wrap}>
    {/* Named "Koraci Dogovora", not "Tok Dogovora": that is the history row below, and two controls must not share a name. */}
    <View accessible accessibilityRole="progressbar" accessibilityLabel="Koraci Dogovora"
      accessibilityValue={position >= 0 ? { min: 1, max: steps.length, now: position + 1, text: stepsSummary(steps) } : { text: stepsSummary(steps) }}
      style={row ? s.row : s.column}>
      {steps.map((step, index) => row
        ? <Fragment key={step.key}>
          {index > 0 ? <View testID={`agreement-join-${step.key}`} style={[s.join, steps[index - 1].status === 'done' && s.lineOn]} /> : null}
          <View testID={`agreement-step-${step.key}`} style={s.step} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            <View style={s.markRow}>
              <View style={[s.line, index === 0 && s.lineNone, index > 0 && steps[index - 1].status === 'done' && s.lineOn]} />
              <Mark status={step.status} pop={pop} />
              <View style={[s.line, index === steps.length - 1 && s.lineNone, step.status === 'done' && s.lineOn]} />
            </View>
            <T variant="meta" numberOfLines={1} style={wordStyle(step.status)}>{step.label}</T>
          </View>
        </Fragment>
        : <View key={step.key} testID={`agreement-step-${step.key}`} style={s.stackStep} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <View style={s.stackMark}>
            <Mark status={step.status} pop={pop} />
            {index < steps.length - 1 ? <View style={[s.stackLine, step.status === 'done' && s.lineOn]} /> : null}
          </View>
          <View style={s.stackWord}><T variant="meta" style={wordStyle(step.status, true)}>{step.label}</T></View>
        </View>)}
    </View>
    {cancelled ? <T testID="agreement-steps-cancelled" variant="note" tone="muted" style={s.cancelled}>{cancellationLine(cancellation, now)}</T> : null}
  </View>;
}

const s = StyleSheet.create({
  // No padding of its own: the space around it is the screen's (the head of the Dogovor puts it 12 under what it belongs to).
  wrap: { gap: sys.space.sm },
  // In a row every step is as wide as its word (a step never shrinks, so a word is never broken) and the joins share what is left.
  row: { flexDirection: 'row', alignItems: 'flex-start' },
  step: { flexShrink: 0, alignItems: 'center', gap: sys.space.xs },
  markRow: { alignSelf: 'stretch', flexDirection: 'row', alignItems: 'center' },
  line: { flex: 1, height: LINE, borderRadius: LINE / 2, backgroundColor: sys.color.line },
  join: { flex: 1, minWidth: sys.space.md, height: LINE, marginTop: (MARK - LINE) / 2, borderRadius: LINE / 2, backgroundColor: sys.color.line },
  lineOn: { backgroundColor: sys.color.green },
  lineNone: { backgroundColor: 'transparent' },
  // As a column: the mark, the line down to the next one, and the word beside the mark, centred on it.
  column: { alignItems: 'stretch' },
  stackStep: { flexDirection: 'row', alignItems: 'stretch', gap: sys.space.md },
  stackMark: { width: MARK, alignItems: 'center' },
  stackLine: { flex: 1, width: LINE, minHeight: sys.space.base, borderRadius: LINE / 2, backgroundColor: sys.color.line },
  stackWord: { flex: 1, minWidth: 0, minHeight: MARK, alignSelf: 'flex-start', justifyContent: 'center' },
  mark: { width: MARK, height: MARK, borderRadius: sys.radius.pill, alignItems: 'center', justifyContent: 'center' },
  markDone: { backgroundColor: sys.color.green },
  markCurrent: { backgroundColor: sys.color.surface, borderWidth: 2, borderColor: sys.color.green },
  markAhead: { backgroundColor: sys.color.surface, borderWidth: 1.5, borderColor: sys.color.lineStrong },
  dot: { width: 10, height: 10, borderRadius: sys.radius.pill, backgroundColor: sys.color.green },
  label: { color: sys.color.ink, textAlign: 'center' },
  // As a column the word stands beside its mark, from the same edge, not centred in the width that is left.
  labelBeside: { textAlign: 'left' },
  labelCurrent: { fontWeight: '600' },
  labelAhead: { color: sys.color.muted },
  cancelled: { textAlign: 'left' },
});
