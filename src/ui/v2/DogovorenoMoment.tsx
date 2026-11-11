import { useEffect, useRef, type ReactNode } from 'react';
import { Animated, Easing, Modal, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { FACE_EDGE, FaceEdge } from '../system/Avatar';
import { FactRow } from '../system/FactRow';
import { tick } from '../system/haptics';
import { layout } from '../system/layout';
import { useReducedMotion } from '../system/motion';
import { Screen } from '../system/Screen';
import { sys } from '../system/tokens';
import { T } from '../Text';

/**
 * "Dogovoreno!" (owner's pick of 2026-10-08, "Susret dva lica", C): the moment right after the person with the task chose an application.
 * It is a whole white screen, not a line in the sheet: TWO FACES, yours and the chosen person's, come toward each other 20 dp each and stop
 * overlapped by 12 (240 ms, decelerating, no bounce); the tick of an outcome plays at the instant they touch; under the faces the TASK'S
 * TITLE (the owner's own addition: "ispod avatara neka bude i naslov zadatka"), then the word, then three rows (the two of you, the term,
 * the amount) and the one green way on. No mark and no tick-shaped icon: two people meeting IS the confirmation.
 *
 * Motion is feedback and nothing else (rules of `sys.motion`): only `transform` and `opacity`, on the native driver, one short
 * `easeOut` run per part, no spring and no overshoot. The words, the term and the amount arrive in their final form; only the container
 * that carries each moves. When the Dogovor was NOT made while this screen was open (the outcome was already standing, e.g. back from
 * the profile's safety screen) it is the last frame at once and nothing ticks; reduced motion shows the last frame at once as well, and
 * keeps the tick, because a tick is an outcome and not movement (R5, R7).
 *
 * Presentation only. The one green action is the sheet's own `Otvori Dogovor` with every guard it had (the route's `openAgreement`); this
 * file only places it. It is a native Modal, as the offer sheet is, so the list under it stays exactly where the person left it, and Android
 * Back is the screen's Back (`onBack`).
 */

/** A face is 72 dp inside the sticker edge of the system (`FaceEdge`: a white edge and one soft shadow); two faces overlap by 12. */
const FACE = 72;
const OVERLAP = sys.space.md;
/** How far each face travels: 20 dp (there is no distance token, and it is not a space). */
const APPROACH = sys.space.base + sys.space.xs;
/** Where each face rests, measured from the middle of the pair. */
const REST = (FACE + 2 * FACE_EDGE - OVERLAP) / 2;

/** The moment, in ms from the start: the faces meet, the words arrive, the rows one by one, the action last. */
const MEET = sys.motion.enter;
const WORDS_AT = MEET + sys.motion.press;
const ROWS_AT = WORDS_AT + sys.motion.enter / 2;
const ACTION_AT = ROWS_AT + 3 * sys.motion.stagger + sys.motion.enter / 2;

/**
 * One part of a moment: a value that runs 0 → 1 once, after `delay`, over `length`, on the one entrance curve and on the native driver.
 * `still` (nothing just happened, or less motion was asked for) puts it at 1 from the first frame. Exported for the other moments of the
 * app that are built the same way (the sent application), so there is one way to run a part.
 */
export function useMomentPart(still: boolean, delay: number, length: number = sys.motion.enter): Animated.Value {
  const value = useRef(new Animated.Value(still ? 1 : 0)).current;
  useEffect(() => {
    if (still) { value.setValue(1); return; }
    value.setValue(0);
    const run = Animated.timing(value, { toValue: 1, duration: length, delay, easing: Easing.bezier(...sys.motion.easeOut),
      useNativeDriver: true, isInteraction: false });
    run.start();
    return () => run.stop();
  }, [value, still, delay, length]);
  return value;
}

/** A container that rises into its place while it fades in: 8 dp from below (yours) or from above (somebody else's). */
export function MomentRise({ still, delay, from = 'below', children, style }: {
  still: boolean; delay: number; from?: 'above' | 'below'; children: ReactNode; style?: StyleProp<ViewStyle>;
}) {
  const part = useMomentPart(still, delay);
  const translateY = part.interpolate({ inputRange: [0, 1], outputRange: [from === 'above' ? -sys.space.sm : sys.space.sm, 0] });
  return <Animated.View style={[style, { opacity: part, transform: [{ translateY }] }]}>{children}</Animated.View>;
}

/** The two faces, each in the system's sticker edge (the only two shadows on the screen), coming to rest overlapped. */
function Meeting({ still, label, you, them }: { still: boolean; label: string; you: ReactNode; them: ReactNode }) {
  const part = useMomentPart(still, 0, MEET);
  const side = (direction: -1 | 1) => ({ transform: [{ translateX: part.interpolate({ inputRange: [0, 1],
    outputRange: [direction * (REST + APPROACH), direction * REST] }) }] });
  return <View accessible accessibilityLabel={label} style={s.pair}>
    <Animated.View importantForAccessibility="no-hide-descendants" accessibilityElementsHidden style={[s.face, side(-1)]}><FaceEdge>{you}</FaceEdge></Animated.View>
    <Animated.View importantForAccessibility="no-hide-descendants" accessibilityElementsHidden style={[s.face, side(1)]}><FaceEdge>{them}</FaceEdge></Animated.View>
  </View>;
}

export function DogovorenoMoment({ youFace, themFace, people, taskTitle, term, amount, action, secondaryAction, fresh, onBack }: {
  /** Your face and the chosen person's, 72 each: a photo, or the Avatar with their letters (a drawn person when there is neither). */
  youFace: ReactNode; themFace: ReactNode;
  /** "Ti i Milan Petrović": the first row, and what a screen reader calls the pair. */
  people: string;
  /** The task's own title, under the faces. */
  taskTitle: string;
  /** The term and the amount the Dogovor stands on, written the one way the app writes them ("Cena nije navedena" when there was no amount). */
  term: string; amount: string;
  /** The one green way on: the sheet's `Otvori Dogovor`, with its guards. */
  action: ReactNode;
  /** Secondary action for multi-worker tasks to select remaining helpers. */
  secondaryAction?: ReactNode;
  /** The Dogovor was made while this screen was open: the faces meet and the tick plays. Otherwise the last frame, still. */
  fresh: boolean;
  /** Android Back. */
  onBack: () => void;
}) {
  const reduced = useReducedMotion();
  const still = !fresh || reduced;
  useEffect(() => {
    if (!fresh) return;
    const timer = setTimeout(() => tick('success'), reduced ? 0 : MEET);
    return () => clearTimeout(timer);
  }, [fresh, reduced]);
  return <Modal visible animationType="none" statusBarTranslucent onRequestClose={onBack}>
    <Screen kind="detail" testID="agreement-moment" contentStyle={s.stage}>
      <Meeting still={still} label={people} you={youFace} them={themFace} />
      <MomentRise still={still} delay={WORDS_AT} style={s.words}>
        <T variant="copy" tone="muted" numberOfLines={3} style={s.centred}>{taskTitle}</T>
        <T accessibilityRole={fresh ? 'alert' : 'header'} accessibilityLiveRegion="polite" variant="display" style={s.centred}>Dogovoreno!</T>
      </MomentRise>
      <View style={s.rows}>
        {([['users', people], ['calendar', term], ['money', amount]] as const).map(([art, value], index) =>
          <MomentRise key={art} still={still} delay={ROWS_AT + index * sys.motion.stagger}>
            <FactRow art={art} value={value} size="detail" />
          </MomentRise>)}
      </View>
      <MomentRise still={still} delay={ACTION_AT} style={s.action}>
        {action}
        {secondaryAction ? <View style={s.secondaryAction}>{secondaryAction}</View> : null}
      </MomentRise>
    </Screen>
  </Modal>;
}

const s = StyleSheet.create({
  // Everything stands in the middle of the screen, in a column one more edge (20) in from the screen's own, as the owner's picture has it;
  // a long title or a large text size makes the column scroll instead of cutting anything.
  stage: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 2 * layout.gutter },
  pair: { height: FACE + 2 * FACE_EDGE, alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center' },
  face: { position: 'absolute' },
  words: { alignItems: 'center', gap: sys.space.sm, maxWidth: 320 },
  centred: { textAlign: 'center' },
  rows: { alignSelf: 'stretch', gap: sys.space.md, maxWidth: 320, width: '100%' },
  action: { alignSelf: 'center', maxWidth: 320, width: '100%' },
  secondaryAction: { marginTop: sys.space.sm, width: '100%' },
});
