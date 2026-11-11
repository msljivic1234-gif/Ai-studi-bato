import { useCallback, useRef, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Swipeable from 'react-native-gesture-handler/Swipeable';
import { Press } from '../Press';
import { T } from '../Text';
import { Glyph } from '../system/Glyph';
import { useReducedMotion } from '../system/motion';
import { sys } from '../system/tokens';

/**
 * A row that a finger can pull to the left to show one command under it: "Pročitano" (T4a, 2026-10-07).
 *
 * The row stays what it is: its own press still opens what it is about, and the command is a second, quieter way to settle
 * the notification without opening it. Swiping is never the only way: the row also offers the same command to a screen
 * reader as a custom action (see `InboxPresentation`), and "Označi sve kao pročitano" stays above the list.
 *
 * Motion follows the system: the row follows the finger and lands on the one critically damped spring every carried
 * surface uses (`sys.motion.sheetSpring`, which never overshoots a row of text); with "reduce motion" it lands where it is going
 * at once. React Native's own `Animated` on the native driver, never Reanimated (rule R4): the library's class component
 * is built on it. A row that cannot be marked (it is already read) is the same component without the command, so the row
 * does not change its element type when it becomes read and slides back instead of being rebuilt.
 */

/** What the list needs to close a row that was left open when another one opens. */
export type SwipeableRowHandle = { close: () => void };

/** The library merges its default `bounciness` into the spring, and React Native refuses a spring that names both ways to describe it. */
const SETTLE = { ...sys.motion.sheetSpring, bounciness: undefined };
/** Reduce motion: the same spring, stiff enough to have arrived before it can be seen. */
const INSTANT = { ...SETTLE, stiffness: sys.motion.sheetSpring.stiffness * 40, damping: sys.motion.sheetSpring.damping * 7 };
/** A mostly vertical drag belongs to the list, not to the row. */
const SCROLL_FIRST: [number, number] = [-16, 16];

export function SwipeToRead({ enabled, label, hint, busy, onRead, onOpen, children }: {
  /** The row can be marked read (unread, and the screen offers the command). */ enabled: boolean;
  /** The command's own word. */ label: string;
  /** What the command does, for a screen reader. */ hint: string;
  /** Another command is running: the revealed button waits. */ busy: boolean;
  onRead: () => void;
  /** This row opened, so the list can close the one that was open before. */ onOpen?: (row: SwipeableRowHandle) => void;
  children: ReactNode;
}) {
  const swipeable = useRef<Swipeable>(null);
  const reduced = useReducedMotion();
  const handle = useRef<SwipeableRowHandle>({ close: () => swipeable.current?.close() });
  const run = useCallback(() => { onRead(); swipeable.current?.close(); }, [onRead]);
  // The row follows the finger one to one (the library's default friction): the command is a short pull, not a tug of war.
  return <Swipeable ref={swipeable} overshootRight={false} failOffsetY={SCROLL_FIRST}
    childrenContainerStyle={s.surface} animationOptions={reduced ? INSTANT : SETTLE}
    onSwipeableWillOpen={() => onOpen?.(handle.current)}
    renderRightActions={enabled ? () => (
      // Hidden from a screen reader: it is reached by the row's own custom action, and a button parked off screen is noise.
      <View testID="swipe-read-panel" style={s.panel} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <Press accessibilityRole="button" accessibilityLabel={label} accessibilityHint={hint} accessibilityState={{ disabled: busy }}
          disabled={busy} haptic="none" scaleTo={1} hitSlop={0} onPress={run} style={s.action}>
          <Glyph name="check" size={20} tone="green" />
          <T variant="action" numberOfLines={1} style={s.label}>{label}</T>
        </Press>
      </View>) : undefined}>
    {children}
  </Swipeable>;
}

const s = StyleSheet.create({
  // The row slides over the command, so it needs its own white; the screen is white and the row is drawn without a ground.
  surface: { backgroundColor: sys.color.surface },
  panel: { backgroundColor: sys.color.control },
  action: { flex: 1, minWidth: 104, paddingHorizontal: sys.space.base, alignItems: 'center', justifyContent: 'center', gap: sys.space.xs },
  label: { color: sys.color.green },
});
