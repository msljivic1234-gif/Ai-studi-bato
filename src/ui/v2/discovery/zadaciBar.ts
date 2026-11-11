import { createContext, useCallback, useContext, useLayoutEffect, useRef } from 'react';
import { Animated, Easing, Platform, type ViewStyle } from 'react-native';
import { sys } from '../../system/tokens';

/**
 * The navigator owns one bar and its measured height. Discovery shows it at HALF/FULL,
 * hides it at the lowered map PEEK stop and during a selected-pin preview.
 *
 * The layout (`app/(app)/_layout`) owns the bar, so it owns the one value that moves it (`hidden`: 0 the bar is on show, 1 it is away) and
 * says how tall it is (`height`, its own height and the margin under it, which is the system inset or 12). It hands both to the screen
 * through this context. ZadaciNavigationBar moves a separate host; zadaciBarStyle keeps the inner geometry static. The screen
 * drives its visibility from the list stop and selected-pin preview (`useZadaciBarMotion`). Without a layout (a gallery, a test) there is no context, and the screen draws and does as it did
 * without a bar: nothing is reserved and nothing moves.
 */
export type ZadaciBar = { hidden: Animated.Value; height: number;
  /** React owns the settled native visibility as well as the animated translation. */ setVisible?: (visible: boolean) => void };
export const ZadaciBarContext = createContext<ZadaciBar | null>(null);
export const useZadaciBar = () => useContext(ZadaciBarContext);

/** What the navigator's own style for a tab is (the layout builds it for every tab; this is the one the Zadaci tab changes). */
export type TabBarBase = ViewStyle & { height: number; marginBottom: number };

/**
 * The inner bar's static style while Zadaci is on show. Its outer host owns the discovery translation. Its margin under it
 * (the system inset or 12) becomes white padding inside it, so the bar still reaches the bottom of the screen and nothing of the map or the
 * list shows through under it; the touch part of the bar keeps its height and its place above that padding.
 */
export function zadaciBarStyle(base: TabBarBase, bar: ZadaciBar): Animated.WithAnimatedValue<ViewStyle> {
  const margin = base.marginBottom;
  return { ...base, position: 'absolute', left: 0, right: 0, bottom: 0, marginBottom: 0, height: bar.height, paddingBottom: margin };
}

/** The bar's slide: entering is longer than leaving and decelerates (rule R2), on the native driver (only a translation moves). */
function slide(hidden: Animated.Value, shown: boolean): Animated.CompositeAnimation {
  return Animated.timing(hidden, { toValue: shown ? 0 : 1, duration: shown ? sys.motion.enter : sys.motion.exit,
    easing: Easing.bezier(...sys.motion.easeOut), useNativeDriver: Platform.OS !== 'web' });
}

/**
 * `shown` is whether the bar belongs on screen; `active` whether this screen is in front.
 * The first answer of a visit puts it in place at once; later answers slide it, or put it in place at once
 * under reduced motion. The navigator also receives settled visibility, so a native animated-props reattachment cannot leave an
 * invisible-state bar intercepting touches over the sheet. Interrupted animations cannot publish an obsolete completion.
 */
export function useZadaciBarMotion({ bar, shown, active, reduced }: { bar: ZadaciBar | null; shown: boolean; active: boolean; reduced: boolean }) {
  const placed = useRef(false), wanted = useRef<boolean | null>(null), running = useRef<Animated.CompositeAnimation | null>(null), generation = useRef(0);
  const drive = useCallback((next: boolean, now: boolean) => {
    if (!bar) return;
    const command = ++generation.current;
    running.current?.stop(); running.current = null;
    wanted.current = next;
    if (now || reduced) { bar.hidden.setValue(next ? 0 : 1); bar.setVisible?.(next); return; }
    if (next) bar.setVisible?.(true);
    running.current = slide(bar.hidden, next);
    running.current.start(({ finished }) => {
      if (finished && generation.current === command) bar.setVisible?.(next);
    });
  }, [bar, reduced]);
  useLayoutEffect(() => {
    if (!bar || !active) { generation.current++; running.current?.stop(); running.current = null; placed.current = false; return; }
    if (placed.current && wanted.current === shown) return;
    drive(shown, !placed.current);
    placed.current = true;
  }, [bar, active, shown, drive]);
  useLayoutEffect(() => () => { generation.current++; running.current?.stop(); running.current = null; }, []);
  /** The sheet starts to move to a stop: the bar follows at once (never before the first answer, and never for a screen that is not in front). */
  const announce = useCallback((next: boolean) => {
    if (!bar || !active || !placed.current || wanted.current === next) return;
    drive(next, false);
  }, [bar, active, drive]);
  return { announce };
}
