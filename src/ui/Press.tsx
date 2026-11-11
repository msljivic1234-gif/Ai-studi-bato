import { useRef } from 'react';
import { Pressable, type GestureResponderEvent, type PressableProps, type ViewStyle, type StyleProp } from 'react-native';
import Animated from 'react-native-reanimated';
import { tick as playTick } from './system/haptics';
import { sys } from './system/tokens';
import { usePressLift } from './system/usePressLift';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export type HapticKind = 'none' | 'select' | 'light' | 'medium' | 'success' | 'error';
/** When the haptic fires: `release` (the default) when a tap completes, `in` the instant the finger lands. */
export type HapticMoment = 'in' | 'release';

/**
 * How long a finger must stay down before a ROW or a CARD begins to give, in milliseconds. A card in a list is touched by
 * fingers that mean to scroll as often as by fingers that mean to tap; a scroll takes the gesture within a few tens of
 * milliseconds, and until then nothing has shrunk. A tap that is lifted sooner still shows the give (Pressability delivers
 * the press-in and press-out together on release), and `minPressDuration` keeps it visible. Not applied to a button or a
 * sheet command (see `pressDelayFor`), nor where the tick is the change (`hapticOn="in"`): they answer at once. Kept at 60
 * or less so a quick tap never looks dead. (Still an open item of the wave-1 closure: it belongs in `sys.motion`, and lives
 * here only because it was added with the press rework.)
 */
export const PRESS_DELAY = 60;

/** Halfway between the button rung and the row rung of the press-scale ladder: where a button ends and a row begins. */
const ROW_FROM = (sys.motion.scale.button + sys.motion.scale.row) / 2;

/**
 * The delay a surface gets before it gives, by how far it gives. A surface that scales less than a button (the row rung,
 * and `scaleTo` 1, which is how a card's body is drawn when the card lifts as one object) lives in a scrolling list and
 * waits; a button, a chip, a sheet command, which gives the button rung or more, sits far from any scroll and answers the
 * instant the finger lands, so a deliberate tap never begins to give late.
 */
export function pressDelayFor(scaleTo: number | undefined): number {
  return scaleTo !== undefined && scaleTo >= ROW_FROM ? PRESS_DELAY : 0;
}

/**
 * The kinds of tick a Press asks for are five of the wrapper's: `select`, `light`, `medium`, `success` and `error` keep their
 * names. What each one feels like on each platform, how close two ticks may be, and that a refusal is silence and never a
 * crash or a rejected promise, is `system/haptics`; this file only says when (rule R5).
 */
function fire(kind: HapticKind) {
  if (kind !== 'none') playTick(kind);
}

type Props = Omit<PressableProps, 'style'> & {
  style?: StyleProp<ViewStyle>;
  /**
   * How far the surface gives under the finger: a rung of the press-scale ladder, `sys.motion.scale` (0.97 a button, 0.985
   * a row or a card). 1 draws a plain Pressable with no animated state at all: for a large surface, and for a target inside a
   * card that lifts as one object (`usePressLift`). Decided when the Press mounts and never changed after.
   */
  scaleTo?: number;
  /** The tick: an outcome, not a touch. By default it fires when the tap completes (see `hapticOn`). */
  haptic?: HapticKind;
  /**
   * `release` (default): the tick fires inside `onPress`, so a finger that lands on a card and turns into a scroll ticks
   * nothing, and a surface with no `onPress` ticks nothing. `in`: on touch-down, only for a toggle where the tick IS the
   * change (a segment, a chip, a switch). A long press, which cancels `onPress`, ticks when it happens.
   */
  hapticOn?: HapticMoment;
  children?: React.ReactNode;
};

/**
 * What both kinds of Press share: where the tick goes, the delay (`pressDelayFor`), and the props handed on to the
 * Pressable. The caller's own `onPressIn` and `onPressOut` are returned apart, because each kind wraps them its own way.
 */
function split({ style, scaleTo, haptic = 'none', hapticOn = 'release', onPressIn, onPressOut, onPress, onLongPress,
  unstable_pressDelay, hitSlop, children, ...rest }: Props) {
  const tick = haptic !== 'none' && hapticOn === 'in' ? haptic : null;
  const outcome = haptic !== 'none' && hapticOn === 'release';
  return {
    style, scaleTo, children, tick, onPressIn, onPressOut,
    pressable: {
      ...rest,
      hitSlop: hitSlop ?? sys.touch.gap,
      // The tick belongs to a command that runs: a tap on a surface that has no `onPress` does nothing, so it says nothing.
      onPress: outcome && onPress ? (event: GestureResponderEvent) => { fire(haptic); onPress(event); } : onPress,
      // A long press cancels the tap, so it is the completed gesture and carries the tick instead.
      onLongPress: outcome && onLongPress ? (event: GestureResponderEvent) => { fire(haptic); onLongPress(event); } : onLongPress,
      unstable_pressDelay: unstable_pressDelay ?? (tick ? undefined : pressDelayFor(scaleTo)),
    },
  };
}

/**
 * The basic touch surface.
 *
 * Feedback is feedback, never decoration (rules R5 and R8 of `sys.motion`): the haptic is an outcome and fires when a tap
 * completes, not when a finger lands, so a list that is scrolled starting from a card does not tick and does not flinch;
 * a row or a card begins to give only after `PRESS_DELAY` (a button gives at once), and springs back when the finger leaves,
 * or when the scroll takes the gesture. A toggle whose tick is the change asks for `hapticOn="in"` and answers on touch-down.
 *
 * A surface that gives (`scaleTo` below 1) carries the text and the icon with it, which reads as physical. It runs on
 * the UI thread, so a touch stays smooth while JS is busy; it holds one shared value and one animated style. A surface that
 * does not (`scaleTo={1}`) is a plain Pressable and holds none, so a card in a list that lifts as one object does not
 * also carry a Reanimated view per target (B22).
 *
 * With "reduce motion" on in the system the surface does not scale at all: the haptic and the change of state stay,
 * the movement goes. The setting is read from one source (ui/system/motion), so it holds even if it changes while the
 * app is open.
 */
export function Press(props: Props) {
  // Chosen once: a surface never swaps its element type, which would remount everything inside it.
  const still = useRef(props.scaleTo === 1).current;
  return still ? <StaticPress {...props} /> : <GivingPress {...props} />;
}

/** `scaleTo={1}`: a plain Pressable. No shared value, no animated style, no timing; the caller's handlers still arrive. */
function StaticPress(props: Props) {
  const { style, children, tick, onPressIn, onPressOut, pressable } = split(props);
  return (
    <Pressable
      {...pressable}
      style={style}
      onPressIn={tick ? (event) => { fire(tick); onPressIn?.(event); } : onPressIn}
      onPressOut={onPressOut}
    >
      {children}
    </Pressable>
  );
}

/** A surface that gives: one shared value and one animated style (`usePressLift`), on the UI thread. */
function GivingPress(props: Props) {
  const { style, children, tick, onPressIn, onPressOut, pressable, scaleTo = sys.motion.scale.button } = split(props);
  const lift = usePressLift(scaleTo);
  return (
    <AnimatedPressable
      {...pressable}
      style={[style, lift.style]}
      onPressIn={(event) => {
        lift.give();
        if (tick) fire(tick);
        onPressIn?.(event);
      }}
      onPressOut={(event) => {
        // Under reduced motion the surface is put back at once, even if the setting changed mid-press.
        lift.settle();
        onPressOut?.(event);
      }}
    >
      {children}
    </AnimatedPressable>
  );
}
