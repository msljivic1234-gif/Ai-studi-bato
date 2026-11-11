import { useLayoutEffect, useRef, useState } from 'react';
import { Animated, Easing, ScrollView, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { PRESS_DELAY, Press } from '../Press';
import { T } from '../Text';
import { layout, ruleWidth } from './layout';
import { useReducedMotion } from './motion';
import { nested, sys } from './tokens';

export type SegmentedOption<K extends string> = { key: K; label: string;
  disabled?: boolean;
  /**
   * A count beside the label. It is DRAWN only with `badgeTone="attention"`: a number belongs to what waits for the person ("Čeka
   * te", "Aktivni 3"), and every other count is noise on a control that has to stay readable (UI/UX pass 2026-10-08). A count
   * that is not drawn is still spoken, through `badgeLabel`.
   */
  badge?: number | string;
  /** The caller owns what is counted (all records or only those waiting for a choice). */ badgeLabel?: string;
  /** A set that needs the person ("Čeka te") is the only one that keeps its count, in the orange of what waits. */ badgeTone?: 'attention' };

const EASE_OUT = Easing.bezier(...sys.motion.easeOut);

/**
 * From this many options a set is a row of chips that scrolls sideways; fewer than this share the width equally. Three fit a
 * 361 dp phone at any text size with their words on two lines; four do not, and a set of four is a different kind of control
 * (a filter, a list of kinds), which a person scrolls the way they scroll a row of categories.
 */
export const SEGMENTED_CHIPS_FROM = 4;

/**
 * A set of choices: it answers which set is shown, never which filter is on (V4.9 segment). One control per screen.
 *
 * THE TWO SHAPES (composition spec 2026-10-07, U7 and section 3: the old control scrolled sideways from two options on, and at the
 * owner's text size it cut "Istorija 7" and "Moje pr…", so a person could not tell what was there):
 *
 * - UP TO THREE OPTIONS share the width EQUALLY, in a quiet track that never scrolls and never cuts a word: the track is 56 dp
 *   (a 48 dp tab and 4 around it), the chosen tab is a white pill with heavier type, so shape and weight carry the state, never
 *   colour alone; at a large text size the words go to a second line instead.
 * - FOUR OR MORE are `chips`: 48 dp chips in a row that scrolls sideways, the one place in the app that does, and that runs to the
 *   edges of the screen (`bleed`) so a chip goes under the edge and not under a strip of white. The chosen chip is a quiet well with
 *   an ink edge. Nothing about it is cut, because it scrolls instead.
 *
 * `contentSized` and `scroll` stay accepted so that no call breaks, and the layout ignores them: a set of up to three is equal and
 * still, a set of four or more is chips. (`scroll` still keeps the tab's give waiting for the press delay, as a row in a scrolling
 * list does, because a finger that lands there may be the start of a scroll.) `appearance="underline"` is the older tab strip and
 * is not changed.
 *
 * SHARING A ROW (F8b, at F2's request). A track fills the width it is given, as every control of a screen does, so a set that stands in a
 * row beside another control (an icon button, a pill) has two ways to say how wide it is. Either it is wrapped in a `View` with `flex: 1`,
 * and the track takes what the other control leaves (the Dogovori bar: tabs, then the Raspored button), or it is `inline`: the track is as
 * wide as its words need and no wider, so it can sit beside the other control with no number of dp of its own. An `inline` set is not
 * of equal shares (each tab is its own word and 16 on each side) and it shrinks, its words going to a second line, before it pushes the
 * other control out of the row. In a column it is the width of its words at the left; give it `style={{ alignSelf: 'flex-start' }}`
 * there. Four or more options are chips, which already are the width of their words, so `inline` changes nothing for them.
 *
 * Each segment is a tab for screen readers. A count is drawn only for what waits for the person (`badgeTone="attention"`).
 *
 * The fixed pill and underline use measured native transforms. Selection semantics change immediately;
 * the indicator follows over the toggle duration, or settles immediately under reduced motion. Until
 * the selected segment is measured it paints its own selection, so the first frame is never empty.
 */
export function Segmented<K extends string>({ options, value, onChange, scroll = false, style, appearance = 'pill', bleed = true, inline = false, equal = false }: {
  options: readonly SegmentedOption<K>[]; value: K; onChange: (key: K) => void;
  /** Accepted and ignored by the layout (see above); it only keeps the give of a tab waiting out the press delay. */ scroll?: boolean;
  style?: object;
  appearance?: 'pill' | 'underline';
  /** A bounded underline set shares its width and wraps labels, instead of overflowing at large text sizes. */
  equal?: boolean;
  /** Accepted and ignored: a set of up to three is always equal, and a set of four or more is always chips (see above). */
  contentSized?: boolean;
  /** Chips only: run the row out to the edges of the screen by the width of its gutter (`layout.gutter`), which is where a `Screen` puts it. False inside something narrower. */
  bleed?: boolean;
  /**
   * Up to three options, in a row beside another control: the track is as wide as its words need and no wider, instead of the width it is
   * given (see "sharing a row" above). Added to the contract; optional, and a set without it is exactly the set it was.
   */
  inline?: boolean;
}) {
  const underline = appearance === 'underline';
  const equalUnderline = underline && equal && !scroll;
  const chips = !underline && options.length >= SEGMENTED_CHIPS_FROM;
  const hugging = inline && !chips && !underline;
  const sliding = !chips;
  // Something in a scroller: a finger on a segment may be the start of a scroll, so its give waits out the press delay.
  const inRail = scroll || chips;
  const reduced = useReducedMotion();
  const [layouts, setLayouts] = useState<Partial<Record<K, { x: number; width: number }>>>({});
  const target = sliding ? layouts[value] : undefined;
  const translateX = useRef(new Animated.Value(0)).current;
  const lineWidth = useRef(new Animated.Value(1)).current;
  const placed = useRef(false);
  useLayoutEffect(() => {
    if (!target) return;
    // A one-dp line scales around its centre. Moving that centre keeps both edges aligned to the
    // measured tab, including after a count or larger text changes its width. Both run natively.
    const x = underline ? target.x + (target.width - 1) / 2 : target.x;
    if (!placed.current || reduced) {
      translateX.setValue(x); lineWidth.setValue(target.width); placed.current = true; return;
    }
    const config = { duration: sys.motion.toggle, easing: EASE_OUT, useNativeDriver: true };
    const slide = Animated.parallel([
      Animated.timing(translateX, { ...config, toValue: x }),
      ...(underline ? [Animated.timing(lineWidth, { ...config, toValue: target.width })] : []),
    ]);
    slide.start();
    return () => slide.stop();
  }, [target?.x, target?.width, underline, reduced, translateX, lineWidth]); // eslint-disable-line react-hooks/exhaustive-deps
  const measure = (key: K) => (event: LayoutChangeEvent) => {
    if (!sliding) return;
    const { x, width } = event.nativeEvent.layout;
    if (width <= 0) return;
    setLayouts(current => current[key]?.x === x && current[key]?.width === width ? current : { ...current, [key]: { x, width } });
  };
  const items = options.map(option => {
    const selected = option.key === value;
    // Only what waits for the person is counted on the control; a count with no tone is spoken (below) and not drawn.
    const count = option.badgeTone === 'attention' && option.badge !== undefined && option.badge !== null ? String(option.badge) : null;
    return <Press key={option.key} accessibilityRole="tab" accessibilityLabel={option.label}
      disabled={option.disabled} accessibilityState={{ selected, ...(option.disabled !== undefined ? { disabled: option.disabled } : {}) }}
      // Android must receive an explicit empty text to retire a previously spoken count.
      accessibilityValue={{ text: option.badge != null && option.badgeLabel ? option.badgeLabel : '' }}
      // The tick follows the change, so it comes on release with it, in a fixed control and in a rail alike: a finger that lands
      // on a segment and turns into a page scroll commits nothing and so ticks nothing. The chosen segment changes nothing and
      // says nothing. In a rail that scrolls the segment also waits out the press delay before it gives, as a row does.
      haptic={selected || option.disabled ? 'none' : 'select'} scaleTo={sys.motion.scale.button} unstable_pressDelay={inRail ? PRESS_DELAY : undefined}
      // The chips are 8 apart: each keeps to its own 48, with no reach into the next.
      hitSlop={chips ? 0 : undefined}
      onPress={() => { if (!selected && !option.disabled) onChange(option.key); }} onLayout={measure(option.key)}
      style={chips ? [s.chip, selected && s.chipSelected]
        : [s.segment, hugging && s.segmentInline, underline ? s.underlineSegment : selected && !target && s.selected,
          equalUnderline && s.underlineEqualSegment, underline && selected && !target && s.underlineSelected]}>
      <T variant="meta" style={[s.text, selected && s.selectedText]}>{option.label}</T>
      {count !== null ? <View style={s.badge}><T variant="label" style={s.badgeText}>{count}</T></View> : null}
    </Press>;
  });
  const indicator = target ? <Animated.View pointerEvents="none" importantForAccessibility="no-hide-descendants"
    style={underline ? [s.underlineIndicator, { transform: [{ translateX }, { scaleX: lineWidth }] }]
      : [s.indicator, { width: target.width, transform: [{ translateX }] }]} /> : null;
  if (chips) return <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" accessibilityRole="tablist"
    style={[s.chipsScroll, bleed && s.bleed, style]} contentContainerStyle={[s.chipsRow, bleed && s.chipsRowBleed]}>{items}</ScrollView>;
  // The track is the grey band, and when the segments scroll it has to be the part that stays put.
  // Putting it on the scrolling content made the band end wherever the last visible segment did,
  // mid-word, so a control that scrolls looked like a control that was cut off. Only the underline strip scrolls now.
  if (underline && scroll) return <ScrollView horizontal showsHorizontalScrollIndicator={false} accessibilityRole="tablist"
    style={[s.track, s.underlineTrack, style]} contentContainerStyle={s.scrollRow}>
    <View style={s.underlineScrollRow}>{indicator}{items}</View>
  </ScrollView>;
  return <View accessibilityRole="tablist" style={[s.track, hugging && s.trackInline, underline && s.underlineTrack, equalUnderline && s.underlineEqualTrack, style]}>
    {indicator}
    {items}
  </View>;
}

const s = StyleSheet.create({
  track: { flexDirection: 'row', gap: sys.space.xs, padding: sys.space.xs, borderRadius: sys.radius.control, backgroundColor: sys.color.control },
  // `inline`: the track is the width of its words and gives way before it pushes its neighbour out of the row; each tab is its own word and 16 each side.
  trackInline: { flexShrink: 1, maxWidth: '100%' },
  segmentInline: { flexGrow: 0, flexShrink: 1, flexBasis: 'auto', paddingHorizontal: sys.space.base },
  scrollRow: { flexDirection: 'row', gap: sys.space.xs, alignItems: 'center' },
  // Equal shares of the track (`flexBasis: 0`), 48 dp high, and a word that does not fit goes to a second line instead of being cut.
  // `alignContent` centres the line of words in the 48 dp when the tab wraps (a wrapping row lays its lines at the top otherwise).
  segment: { flexGrow: 1, flexBasis: 0, minHeight: layout.touch, paddingHorizontal: sys.space.sm, paddingVertical: sys.space.sm,
    borderRadius: nested(sys.radius.control, sys.space.xs), flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', alignContent: 'center',
    justifyContent: 'center', columnGap: sys.space.sm },
  selected: { backgroundColor: sys.color.surface, shadowColor: sys.color.ink, shadowOpacity: 0.06, shadowRadius: 7, shadowOffset: { width: 0, height: 2 }, elevation: 1 },
  // Measured x is inside the track's padding box, so the pill starts at the track's left edge. No elevation: on
  // Android an elevated view is drawn above its non-elevated siblings, so the pill would cover the chosen label.
  // The 1 dp line gives it the edge the shadow gives it on iOS.
  indicator: { position: 'absolute', top: sys.space.xs, bottom: sys.space.xs, left: 0, borderRadius: nested(sys.radius.control, sys.space.xs),
    backgroundColor: sys.color.surface, borderWidth: ruleWidth, borderColor: sys.color.line,
    shadowColor: sys.color.ink, shadowOpacity: 0.06, shadowRadius: 7, shadowOffset: { width: 0, height: 2 } },
  underlineTrack: { padding: 0, gap: 20, borderRadius: 0, backgroundColor: sys.color.surface, borderBottomWidth: ruleWidth, borderBottomColor: sys.color.line },
  underlineScrollRow: { flexDirection: 'row', alignItems: 'stretch', gap: 20 },
  underlineIndicator: { position: 'absolute', left: 0, bottom: 0, width: 1, height: 3, backgroundColor: sys.color.green },
  underlineSegment: { flexGrow: 0, flexBasis: 'auto', minHeight: layout.touch, paddingHorizontal: sys.space.xs, borderRadius: 0, borderBottomWidth: 3, borderBottomColor: 'transparent' },
  underlineSelected: { borderBottomColor: sys.color.green },
  underlineEqualTrack: { gap: sys.space.sm },
  underlineEqualSegment: { flexGrow: 1, flexBasis: 0, minWidth: 0, flexShrink: 1 },
  // The chips: a row that scrolls sideways, and that runs to the edges of a screen with a gutter. A chip is 48 dp, the pill corner,
  // a 1 dp edge, a white ground; the chosen one is a quiet well with an ink edge (the chips over the map draw the same).
  chipsScroll: { flexGrow: 0 },
  bleed: { marginHorizontal: -layout.gutter },
  chipsRow: { flexDirection: 'row', alignItems: 'center', gap: sys.space.sm },
  chipsRowBleed: { paddingHorizontal: layout.gutter },
  chip: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', columnGap: sys.space.sm, minHeight: layout.touch, paddingHorizontal: sys.space.base,
    borderRadius: sys.radius.pill, borderWidth: ruleWidth, borderColor: sys.color.lineStrong, backgroundColor: sys.color.surface },
  chipSelected: { backgroundColor: sys.color.greenSoft, borderColor: sys.color.ink },
  text: { ...sys.type.tab, color: sys.color.muted, textAlign: 'center', flexShrink: 1 },
  selectedText: { color: sys.color.ink, fontWeight: '700' },
  // The count of what waits for the person: orange, the one colour a control has for "this is yours to do".
  badge: { minWidth: 24, height: 24, paddingHorizontal: sys.space.sm, borderRadius: sys.radius.badge, backgroundColor: sys.color.orange, alignItems: 'center', justifyContent: 'center' },
  badgeText: { color: sys.color.onOrange, lineHeight: 14, letterSpacing: 0 },
});
