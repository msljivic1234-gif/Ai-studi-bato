import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Animated, Easing, StyleSheet, View, type TextProps, type ViewStyle } from 'react-native';
import { Press } from '../Press';
import { T } from '../Text';
import { Glyph, type GlyphName } from './Glyph';
import { useReducedMotion } from './motion';
import { useTextScale } from './textScale';
import { sys } from './tokens';

/**
 * Navigation chrome with a consistent icon meaning across selected and unselected variants.
 * Marker, label and accessibility state establish the current location.
 * Existing native-driver selection transitions, measured labels and accessibility semantics remain.
 */
export const TAB_ICON = sys.icon.size.navigation;
export const TAB_LABEL_GAP = 3;
export const TAB_ITEM_PADDING = 3;
export const TAB_ITEM_TOP = 7;
export const TAB_ITEM_BOTTOM = 5;
export const TAB_POP = 1.04;
export const TAB_BAR_PADDING = 4;
export const TAB_CAPSULE = sys.radius.hero - TAB_BAR_PADDING;
type TabKind = 'home' | 'map' | 'agreements' | 'chat';
const TAB_SYMBOL: Record<TabKind, GlyphName> = {
  home: 'home', map: 'map', agreements: 'agreements', chat: 'messages',
};

/** A quiet white bar; the navigator owns its external margin and safe-area clearance. */
export const tabBarSurface = {
  backgroundColor: sys.navigation.background,
  borderColor: sys.navigation.line, borderWidth: 1, borderTopWidth: 1,
  borderRadius: sys.radius.hero, padding: TAB_BAR_PADDING,
  elevation: 0, shadowOpacity: 0,
} satisfies ViewStyle;

/**
 * The button owns one symbol, its label and padding. Include both surface edges
 * and measured text, rather than relying on the navigator's duplicate icon hosts.
 * Labels remain scalable/untruncated, and their actual second line grows the bar.
 */
export function tabBarHeight(labelHeight: number, barPadding: number): number {
  return Math.max(56, Math.ceil(TAB_ICON + TAB_LABEL_GAP + TAB_ITEM_TOP + TAB_ITEM_BOTTOM + barPadding * 2 + labelHeight + 2));
}

const EASE_OUT = Easing.bezier(...sys.motion.easeOut);

/**
 * 1 while `selected` and 0 while not, and the value follows a change over the toggle token on the native driver. Nothing is
 * started when the component first mounts (the value is already right), and under reduced motion a change is set at once.
 */
function useSelection(selected: boolean): Animated.Value {
  const reduced = useReducedMotion();
  const [value] = useState(() => new Animated.Value(selected ? 1 : 0));
  const mounted = useRef(false);
  useEffect(() => {
    const target = selected ? 1 : 0;
    if (reduced) { value.setValue(target); return; }
    if (!mounted.current) { mounted.current = true; return; }
    const run = Animated.timing(value, { toValue: target, duration: sys.motion.toggle, easing: EASE_OUT, useNativeDriver: true });
    run.start();
    return () => run.stop();
  }, [selected, reduced, value]);
  return value;
}

/**
 * The chosen tab's capsule: always mounted, an absolute fill of the button that never takes a touch, fading with the selection.
 * `radius` is the capsule corner (`TAB_CAPSULE`), passed in so the bar and its corner agree in one place.
 */
export function TabCapsule({ selected, radius }: { selected: boolean; radius: number }) {
  const shown = useSelection(selected);
  return <Animated.View testID="tab-capsule" pointerEvents="none" style={[s.capsule, { borderRadius: radius, opacity: shown }]} />;
}

/**
 * Familiar control symbols stay readable in both states. Fill, well, label and accessible state identify selection.
 * A small selection response runs only on a rising selection, never on initial display or deselection.
 */
export function TabGlyph({ kind, selected }: { kind: TabKind; selected: boolean }) {
  const reduced = useReducedMotion();
  const [pop] = useState(() => new Animated.Value(1));
  const was = useRef(selected);
  useEffect(() => {
    const rose = selected && !was.current;
    was.current = selected;
    // Anything that is not a rise puts the scale back at rest (and stops a pop that a quick second tap interrupted).
    if (!rose || reduced) { pop.setValue(1); return; }
    const run = Animated.sequence([
      Animated.timing(pop, { toValue: TAB_POP, duration: sys.motion.press, easing: EASE_OUT, useNativeDriver: true }),
      Animated.timing(pop, { toValue: 1, duration: sys.motion.toggle, easing: EASE_OUT, useNativeDriver: true }),
    ]);
    run.start();
    return () => run.stop();
  }, [selected, reduced, pop]);
  return <Animated.View testID="tab-glyph" accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants"
    style={[s.glyph, { transform: [{ scale: pop }] }]}>
    <Glyph name={TAB_SYMBOL[kind]} size={TAB_ICON} tone={selected ? 'green' : 'muted'} strong={selected} />
  </Animated.View>;
}

/**
 * The name under the symbol uses a contrast-safe navigation pair. Never shrunk and never cut; the person's
 * text size decides, and `onTextLayout` hands the measured lines on so the bar's height can follow.
 */
export function TabLabel({ children, selected, onTextLayout }: { children: ReactNode; selected: boolean; onTextLayout?: TextProps['onTextLayout'] }) {
  return <T variant="navLabel" onTextLayout={onTextLayout}
    style={[s.label, { color: selected ? sys.navigation.foreground : sys.navigation.muted }]}>{children}</T>;
}

const PREVIEW: readonly { kind: TabKind; title: string }[] = [
  { kind: 'home', title: 'Početna' }, { kind: 'map', title: 'Zadaci' }, { kind: 'agreements', title: 'Dogovori' },
  { kind: 'chat', title: 'Poruke' },
];

/**
 * The bar drawn by hand from the same parts, for the design board on the phone (`uskociapp://dizajn-tabla`, internal build): four
 * tabs that can be tapped, so the owner can feel the capsule, the pill and the pop and compare them with the
 * build already on his phone. It holds no navigation and no data. The real bar's layout is the navigator's; this one mirrors it
 * (the control glyphs, tab padding and corner), and the height is the same `tabBarHeight`.
 */
export function TabBarPreview() {
  const [chosen, setChosen] = useState(0);
  const labelHeight = sys.type.navLabel.lineHeight * useTextScale();
  return <View style={[tabBarSurface, s.preview, { height: tabBarHeight(labelHeight, TAB_BAR_PADDING) }]}>
    {PREVIEW.map((tab, index) => <Press key={tab.kind} accessibilityRole="tab" accessibilityLabel={tab.title}
      accessibilityState={{ selected: chosen === index }} onPress={() => setChosen(index)} haptic="none" scaleTo={1}
      hitSlop={0} style={s.previewTab}>
      <TabCapsule selected={chosen === index} radius={TAB_CAPSULE} />
      <View style={s.previewIcon}><TabGlyph kind={tab.kind} selected={chosen === index} /></View>
      <TabLabel selected={chosen === index}>{tab.title}</TabLabel>
    </Press>)}
  </View>;
}

const s = StyleSheet.create({
  capsule: { ...StyleSheet.absoluteFill, backgroundColor: sys.navigation.selected },
  glyph: { width: TAB_ICON, height: TAB_ICON },
  label: { textAlign: 'center', marginTop: TAB_LABEL_GAP },
  preview: { flexDirection: 'row' },
  previewTab: { flex: 1, alignItems: 'center', paddingHorizontal: TAB_ITEM_PADDING, paddingTop: TAB_ITEM_TOP, paddingBottom: TAB_ITEM_BOTTOM,
    borderRadius: TAB_CAPSULE, overflow: 'hidden' },
  previewIcon: { width: TAB_ICON, height: TAB_ICON, alignItems: 'center', justifyContent: 'center' },
});
