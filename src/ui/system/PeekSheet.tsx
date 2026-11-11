import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, type ReactNode } from 'react';
import { BackHandler, StyleSheet, View, useWindowDimensions } from 'react-native';
import BottomSheet, { BottomSheetScrollView, BottomSheetView, type BottomSheetBackgroundProps } from '@gorhom/bottom-sheet';
import { SHEET_SPRING, sheetCloseConfig } from '../product/ProductSheet';
import { useSystemReducedMotion } from '../../hooks/useSystemReducedMotion';
import { sheetLift, sys } from './tokens';

const PeekBackground = ({ style }: BottomSheetBackgroundProps) => <View pointerEvents="none" accessible={false}
  importantForAccessibility="no" style={[style, s.background]} />;
const PeekHandle = () => <View accessible={false} importantForAccessibility="no" style={s.handleArea}><View style={s.handle} /></View>;
/** The card is as tall as what it says, up to this share of the window; scrollable content stays within that cap. */
export const PEEK_MAX_SHARE = 0.5;

/**
 * A card that peeks up over a screen without taking it over: no backdrop, no dimming, no modal focus trap, detached
 * above the caller's bottom inset, 16 dp in from both edges. Made for the pin card on the map, where the map must stay live around it.
 * A drag down or Android Back closes it (Back closes the card before it leaves the screen); the screen underneath keeps
 * its own touches. Render it as the last child of a full-screen container. `handle={false}` leaves the grab bar out
 * for a card that carries its own close button (Discovery V47); a drag down still closes it.
 */
export function PeekSheet({ label, active, onClose, children, bottomInset = sys.space.md, reduced: callerReduced, handle = true,
  maxShare = PEEK_MAX_SHARE, scrollable = false, overlay, contentKey }: {
  /** Replaces the content of an open card without mounting/animating a second sheet. */
  contentKey?: string;
  /** What assistive technology calls the card. */
  label: string;
  /** True while the screen that hosts the card is the one in front (the map passes `useIsFocused()`). Only then does
   *  Android Back belong to the card: with a task detail pushed over the map, Back goes to the detail, not the card. */
  active: boolean;
  /** Called once the card is gone, whatever closed it. */
  onClose: () => void;
  children: (dismiss: () => void) => ReactNode;
  /** Long content uses gorhom's registered scroll view, so overflow remains reachable inside the bounded card. */
  scrollable?: boolean;
  /** Fixed controls above scrolling content. Only the controls take touches; the rest of the card stays interactive. */
  overlay?: (dismiss: () => void) => ReactNode;
  /** The gap to the bottom of the screen it floats over; the caller must clear its safe area or visible controls. */
  bottomInset?: number;
  reduced?: boolean;
  /** The grab bar above the content; a card with its own × leaves it out. */
  handle?: boolean;
  /**
   * How much of the window the card may take. A card whose words grow with the person's text size (the pin card at large
   * text) raises it for itself rather than be cut off; every other card keeps `PEEK_MAX_SHARE`.
   */
  maxShare?: number;
}) {
  const systemReduced = useSystemReducedMotion();
  const reduced = callerReduced ?? systemReduced;
  const sheet = useRef<BottomSheet>(null), closing = useRef(false);
  const identity = useMemo(() => ({}), [contentKey]);
  const current = useRef(identity); current.current = identity;
  const closeOwner = useRef<object | null>(null), recovering = useRef(false), previous = useRef(identity);
  useLayoutEffect(() => {
    if (previous.current === identity) return;
    previous.current = identity;
    const interrupted = closing.current || closeOwner.current !== null;
    closing.current = false; closeOwner.current = null;
    if (interrupted) { recovering.current = true; sheet.current?.snapToIndex(0, { duration: 0 }); }
  }, [identity]);
  const completeClose = useCallback(() => {
    if (current.current !== identity || !active) return;
    if (contentKey !== undefined && (recovering.current || closeOwner.current !== identity)) {
      sheet.current?.snapToIndex(0, { duration: 0 }); return;
    }
    onClose();
  }, [identity, contentKey, active, onClose]);
  const { height } = useWindowDimensions();
  const dismiss = useCallback(() => {
    if (current.current !== identity || !active || closing.current) return;
    closing.current = true;
    closeOwner.current = identity; recovering.current = false;
    // Closed by a command (the card's own ×, Android Back): the same short timing as every sheet, or at once when motion is off.
    if (sheet.current) sheet.current.close(sheetCloseConfig(reduced)); else completeClose();
  }, [identity, active, completeClose, reduced]);
  useEffect(() => {
    if (!active) return;
    // Once the card is on its way out, Back is the screen's again: it never swallows a second press.
    const back = BackHandler.addEventListener('hardwareBackPress', () => { if (closing.current) return false; dismiss(); return true; });
    return () => back.remove();
  }, [active, dismiss]);
  return <BottomSheet ref={sheet} index={0} enableDynamicSizing enablePanDownToClose detached bottomInset={bottomInset}
    style={s.sheet} accessible={false} accessibilityRole="none" accessibilityLabel={label}
    maxDynamicContentSize={height * maxShare} animateOnMount={!reduced} onClose={completeClose}
    onAnimate={(_from, to) => { if (to === -1 && current.current === identity && !recovering.current) { closing.current = true; closeOwner.current = identity; } }}
    onChange={index => { if (index >= 0 && current.current === identity) recovering.current = false; }}
    animationConfigs={reduced ? { duration: 0 } : SHEET_SPRING}
    backgroundComponent={PeekBackground} handleComponent={handle ? PeekHandle : null}>
    {scrollable ? <BottomSheetScrollView key={contentKey} contentContainerStyle={[s.content, !handle && s.unhandled]}
      keyboardShouldPersistTaps="handled" bounces={false} showsVerticalScrollIndicator>
      {children(dismiss)}
    </BottomSheetScrollView> : <BottomSheetView style={[s.content, !handle && s.unhandled]}>{children(dismiss)}</BottomSheetView>}
    {overlay ? <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>{overlay(dismiss)}</View> : null}
  </BottomSheet>;
}

const s = StyleSheet.create({
  sheet: { marginHorizontal: sys.space.base },
  background: { backgroundColor: sys.color.surface, borderRadius: sys.radius.card, borderWidth: 1, borderColor: sys.color.cardLine, ...sheetLift.detached },
  handleArea: { height: 20, alignItems: 'center', justifyContent: 'center' },
  handle: { width: 36, height: 4, borderRadius: 2, backgroundColor: sys.color.lineStrong },
  content: { paddingHorizontal: sys.space.base, paddingBottom: sys.space.base },
  // Without the handle's 20 px above it, the content keeps the card's own padding at the top too.
  unhandled: { paddingTop: sys.space.base },
});
