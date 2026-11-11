import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import BottomSheet, { type BottomSheetBackgroundProps } from '@gorhom/bottom-sheet';
import Animated, { useAnimatedStyle, type SharedValue } from 'react-native-reanimated';
import { chromeJoin } from './discoveryChrome';
import { SHEET_SPRING } from '../../product/ProductSheet';
import { sheetLift, sys } from '../../system/tokens';

/** Its top line, half the map, then the whole list under the search pill. Capsules scroll away at FULL. */
export const SNAP = { peek: 0, half: 1, full: 2 } as const;

/**
 * The floating surface joins the white search header at FULL. Crossfade the two native surfaces so both Android
 * elevation and boxShadow disappear, without animating platform-specific shadow or layout properties.
 */
const ChromeJoinContext = createContext({ compactTop: 0, capsuleSpace: 0 });
const ListBackground = ({ style, animatedPosition }: BottomSheetBackgroundProps) => {
  const { compactTop, capsuleSpace } = useContext(ChromeJoinContext);
  const floating = useAnimatedStyle(() => ({ opacity: 1 - chromeJoin(animatedPosition.value, compactTop, capsuleSpace) }),
    [animatedPosition, compactTop, capsuleSpace]);
  const joined = useAnimatedStyle(() => ({ opacity: chromeJoin(animatedPosition.value, compactTop, capsuleSpace) }),
    [animatedPosition, compactTop, capsuleSpace]);
  return <View testID="discovery-sheet-background" pointerEvents="none" accessible={false} importantForAccessibility="no" style={style}>
    <Animated.View testID="discovery-sheet-floating" style={[StyleSheet.absoluteFill, s.background, floating]} />
    <Animated.View testID="discovery-sheet-joined" style={[StyleSheet.absoluteFill, s.flat, joined]} />
  </View>;
};
/** The sunk sheet draws nothing: its edge and upward shadow would show as a sliver under the pin card. */
const SunkBackground = ({ style }: BottomSheetBackgroundProps) => <View pointerEvents="none" accessible={false}
  importantForAccessibility="no" style={[style, s.background, s.sunk]} />;

/**
 * The list of Zadaci as a sheet over the map (owner step 4, 2026-09-24): the sheet IS the list, so there is no Lista/Mapa
 * switch. It never closes; it rests at one of three heights ("mapa je glavna", half, "lista je glavna") and its top line (the
 * count, which is also the handle: a tap goes to the next height, a drag moves it) is there to take hold of, except while a
 * pin's card covers it: then the screen lowers the lowest height to a sliver behind the card and the sheet is `sunk`: its
 * background is not drawn (no hairline, no shadow peeking out under the card) and nothing in it reaches a screen reader. It reaches
 * the bottom of the screen at every height; the bottom navigation remains available over map and list, while a selected
 * pin's preview takes the bottom edge and temporarily hides it. The screen pads the end of the list for its measured height.
 *
 * Below the top line stands the list: the filters are not here, they are the capsules over the map. It moves on ONE critically damped
 * spring that cannot overshoot (`SHEET_SPRING`: clamped), and a drag past its first or last stop does not stretch it
 * (`enableOverDrag` is off): the sheet stops where its stops are and never bounces or shakes. There is no dimming of the map behind
 * it: the map's furniture stands directly above the sheet and moves with it, and a veil over the map would grey it while it rises.
 * Under reduced motion it changes height at once.
 */
export function DiscoveryListSheet({ index, snapPoints, position, animatedIndex, reduced, animateOnMount = false, onIndex, onAnimate, header, sunk = false, compactTop = 0, capsuleSpace = 0,
  children }: {
  index: number; snapPoints: readonly (number | string)[];
  compactTop?: number; capsuleSpace?: number;
  /** Where the sheet's top edge is, for the map's furniture that rides on it. */ position?: SharedValue<number>;
  /** Gorhom's continuous normalized stop index (0: peek, 1: half, 2: full). */ animatedIndex?: SharedValue<number>;
  reduced: boolean; animateOnMount?: boolean; onIndex: (index: number) => void;
  /** The sheet starts to move to another stop (a drag let go of, a tap, a command): the stop it goes to. */
  onAnimate?: (fromIndex: number, toIndex: number) => void;
  /** The top line: always visible, never scrolled away. */ header: ReactNode;
  /** A pin's card lies over the sheet's top line: the sheet steps out of sight and out of reach behind it. */ sunk?: boolean;
  /** The list itself (a `BottomSheetFlatList`). */ children: ReactNode;
}) {
  const join = useMemo(() => ({ compactTop, capsuleSpace }), [compactTop, capsuleSpace]);
  return <ChromeJoinContext.Provider value={join}><BottomSheet index={index} snapPoints={snapPoints as (number | string)[]} enableDynamicSizing={false} enablePanDownToClose={false}
    enableOverDrag={false} topInset={0}
    animateOnMount={animateOnMount} animatedPosition={position} animatedIndex={animatedIndex} onAnimate={onAnimate} onChange={next => { if (next >= 0) onIndex(next); }}
    animationConfigs={reduced ? { duration: 0 } : SHEET_SPRING} handleComponent={null} backgroundComponent={sunk ? SunkBackground : ListBackground}
    accessible={false} accessibilityRole="none" accessibilityLabel={sunk ? null : 'Lista zadataka'}
    keyboardBehavior="extend" keyboardBlurBehavior="restore">
    <View testID="list-sheet-content" style={s.content} accessibilityElementsHidden={sunk}
      importantForAccessibility={sunk ? 'no-hide-descendants' : 'auto'}>{header}{children}</View>
  </BottomSheet></ChromeJoinContext.Provider>;
}

const s = StyleSheet.create({
  // It floats over the map: the sheet corner, the hairline along its top, a soft lift cast upwards because the sheet
  // rises from the bottom (the system's docked sheet lift, review r3 item 5 and r3b).
  background: { backgroundColor: sys.color.surface, borderTopLeftRadius: sys.radius.sheet, borderTopRightRadius: sys.radius.sheet,
    borderWidth: 1, borderBottomWidth: 0, borderColor: sys.color.line, ...sheetLift.docked },
  sunk: { opacity: 0 },
  flat: { backgroundColor: sys.color.surface },
  content: { flex: 1 },
});
