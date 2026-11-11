import { useRef, type ReactNode } from 'react';
import { View } from 'react-native';
import Animated, { Easing, FadeInDown } from 'react-native-reanimated';
import { sys } from './tokens';
import { useReducedMotion } from './motion';

/* A row arriving in a list.
 *
 * Content motion explains a transition; optional artwork has its own lifecycle. A card
 * that was already there when the screen opened has nothing to tell you by sliding in, and replaying
 * the whole list on every pull-to-refresh is exactly the churn that rule forbids. So each row
 * animates once, the first time this screen ever sees its id, and never again — a refresh that
 * returns the same rows is silent, and a genuinely new row is the only thing that moves.
 *
 * Two parts: `useAppear()`, the list's memory of what it has shown, and `Appear`, the wrapper of one row.
 */

/**
 * How many rows may arrive together : the stagger stops here, and so does the animated view.
 * Past six rows an entrance is a wait, not a rhythm, and every animated view is one more native view that Reanimated has
 * to keep a tag for (B22).
 */
export const ROWS_THAT_ARRIVE = 6;

export type AppearOptions = {
  /**
   * The list is drawing for the first time after it showed a skeleton, so what it shows is news, not what was already
   * there: its first rows (at most `ROWS_THAT_ARRIVE`) arrive once. Read only when the list settles for the first time.
   * A warm return (cached rows, no skeleton) and a filter or section change leave it off and stay still.
   */
  afterLoading?: boolean;
};

export type AppearList = {
  /** Call once per render pass, before the rows, with the keys the list is about to draw. */
  settle(keys: readonly string[], viewKey?: string, options?: AppearOptions): void;
  /** Whether this row is an arrival. True once per key: it marks the key as seen. */
  isNew(key: string): boolean;
};

/**
 * What a list has already shown. `useAppear()` belongs to the list, not to the row: it holds the ids this list has drawn, so a
 * row is an arrival only the first time its id is seen. `settle` is called once per render pass before the rows are drawn,
 * `isNew` once per row; both are cheap, and the one object lives as long as the list does.
 */
export function useAppear(): AppearList {
  const seen = useRef<Set<string>>(new Set());
  const settled = useRef(false);
  const view = useRef<string | undefined>(undefined);
  // One object for the life of the list, so a memoised renderItem can depend on it directly (2026-09-23).
  const api = useRef<AppearList | null>(null);
  if (!api.current) api.current = {
    settle(keys, viewKey, options) {
      // The first rows after a skeleton are news; until the list has settled once, nothing else may baseline them.
      const arriving = !settled.current && options?.afterLoading === true && keys.length > 0;
      // A different filter/section reveals existing records; it is not an arrival. Keep the
      // list mounted and baseline that view before its cells render. Actual later IDs still enter.
      if (view.current !== viewKey) {
        view.current = viewKey;
        if (!arriving) keys.forEach(key => seen.current.add(key));
      }
      if (settled.current || !keys.length) return;
      settled.current = true;
      if (arriving) {
        // They arrive, but only the first few: the rest of a long first page is simply there.
        keys.slice(ROWS_THAT_ARRIVE).forEach(key => seen.current.add(key));
        return;
      }
      // The first list a screen draws is not an arrival; it is what was already there.
      keys.forEach(key => seen.current.add(key));
    },
    isNew(key) {
      if (seen.current.has(key)) return false;
      seen.current.add(key);
      return true;
    },
  };
  return api.current;
}

/**
 * How far from its place a row starts: 8 dp, the rise of the outcome bar (`Poruka`). Reanimated's own `FadeInDown` starts
 * 25 dp low, a long slide for a whole card to cover in 240 ms, which reads as a shove and not as an arrival.
 */
const ARRIVAL_RISE = sys.space.sm;

/**
 * Where an arriving thing comes from (owner's pick of 2026-10-08, "Ponude preko stola", rule B1): what somebody ELSE brings (an
 * application, a fact the assistant understood) arrives from `above`, 8 dp over its place; what is YOURS (the default) arrives from
 * `below`, 8 dp under it. Only the side changes, never the length, the stagger or the curve.
 */
export type AppearFrom = 'above' | 'below';

/**
 * The one entrance a row can have: it settles from `ARRIVAL_RISE` above or below its place while it fades in, and it decelerates
 * using the shared entrance curve. Without `.easing(...)` Reanimated falls back to ease-in-out on a
 * quadratic, which has covered only 2 % of the way after the first tenth of the time and so starts late.
 *
 * The curve is built when a row arrives, not when this file loads, so a suite that stands in for Reanimated without an
 * `Easing` still loads every screen that draws rows.
 */
const arrival = (index: number, from: AppearFrom = 'below') => FadeInDown.duration(sys.motion.enter)
  .delay(Math.min(index, ROWS_THAT_ARRIVE) * sys.motion.stagger)
  .easing(Easing.bezier(...sys.motion.easeOut))
  .withInitialValues({ translateY: from === 'above' ? -ARRIVAL_RISE : ARRIVAL_RISE });

/**
 * The stagger step (`sys.motion.stagger`) is per row, and stops at `ROWS_THAT_ARRIVE`.
 *
 * Whether the row is drawn on a Reanimated view is decided ONCE, when it mounts : a row that mounted
 * settled is a plain `View` for the rest of its life and a row that mounted arriving keeps its animated view and the
 * entrance it was given. The element type never changes afterwards, so a later `animate` flip can neither remount the card
 * inside (losing its press state and its photo) nor create an animated view that Reanimated would have to track. A list
 * that has settled therefore holds no animated view at all, only the rows that actually arrived.
 */
export function Appear({ index = 0, animate = true, from = 'below', children, style }: {
  index?: number; animate?: boolean;
  /** The side it comes from: `above` for what others bring, `below` (as it always was) for what is yours. Read once, when the row mounts. */
  from?: AppearFrom; children: ReactNode; style?: object;
}) {
  const reduced = useReducedMotion();
  const mode = useRef<{ entering: ReturnType<typeof arrival> | undefined } | null>(null);
  if (!mode.current) mode.current = { entering: reduced || !animate ? undefined : arrival(index, from) };
  const { entering } = mode.current;
  if (!entering) return <View style={style}>{children}</View>;
  return <Animated.View style={style} entering={entering}>{children}</Animated.View>;
}
