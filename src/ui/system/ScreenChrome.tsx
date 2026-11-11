import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Animated, Easing, StyleSheet, View, type NativeScrollEvent, type NativeSyntheticEvent, type StyleProp, type ViewStyle } from 'react-native';
import { BrandLockup } from '../entry/BrandAssets';
import { Press, type HapticKind } from '../Press';
import { T } from '../Text';
import { GLYPH_COLOUR, Glyph, type GlyphIcon, type GlyphName } from './Glyph';
import { layout } from './layout';
import { useReducedMotion } from './motion';
import { materialControl, sys } from './tokens';

/** Shared navigation chrome for root, detail and flow screens. Wrappers preserve
 * destination, back/close semantics, readable titles and injected identity.
 * Composition, supporting copy, materials and optical dimensions may evolve
 * by role; interaction targets and large-text behavior remain protected. */
export const chrome = {
  /** 48 px controls (an important command is never under 48) with 8 px above and below. */
  minHeight: 64,
  /** The edge of the screen: the one every screen has (`layout.gutter`, 20), so the arrow and the first line of content stand on one line. */
  paddingHorizontal: layout.gutter,
  paddingVertical: sys.space.sm,
  gap: sys.space.md,
  /** The touch area of every chrome control. */
  control: sys.touch.min,
  /** The circle drawn inside that area. */
  circle: 44,
  /** The glyph in a bare circle: the chrome size of the Glyph registry. */
  icon: sys.icon.size.chrome,
  /** The glyph beside a word, in a captioned pill: the row size of the Glyph registry. */
  captionIcon: sys.icon.size.row,
} as const;

/**
 * What a chrome control draws: a name from the Glyph registry (`glyph`, the way forward) or a Phosphor component (`icon`, which
 * stays accepted so no existing screen had to change). Exactly one of the two.
 */
type ChromeArt = { icon: GlyphIcon; glyph?: never } | { glyph: GlyphName; icon?: never };

/**
 * Leaving a screen is not a result, so the arrow back and the close X make no sound unless
 * a caller asks for one. The rule is read from the NAME in the Glyph registry, so a screen that draws `glyph="back"` itself is silent
 * without knowing it. A Phosphor component handed in as `icon` is a component, not a name: nothing is guessed from which one it is
 * (a week arrow is an ArrowLeft too, and it is a change of state), so it keeps the tick it had.
 */
const SILENT_GLYPHS: ReadonlySet<GlyphName> = new Set<GlyphName>(['back', 'close']);

type ChromeIconButtonProps = ChromeArt & {
  label: string; hint?: string;
  /** Set for a toggle (search, filters): shown by weight and colour together, and spoken as selected. */ active?: boolean;
  disabled?: boolean; onPress: () => void;
  /** A deliberate raised command, such as editing the profile; ordinary navigation remains quiet. */
  raised?: boolean;
  /** Ink for navigation, green for a meaningful state, danger for an explicit destructive entry. */ tone?: 'ink' | 'green' | 'danger';
  /** No circle: the glyph alone in the same 48 px touch area. */ quiet?: boolean;
  /**
   * A word beside the glyph, for a command nobody can guess from a drawing (Filteri, Raspored). It is the NAME OF THE CONTROL, never a line
   * that says where you are. The pill is 44 px high inside the same 48 px touch height and grows with its word; the glyph is 20 and
   * the word is the `meta` variant on one line, capped at the chrome title's large-text step so a large font cannot crush the row
   * beside it. The spoken label is still `label`: the caption is not a second name, and `label` should contain it (WCAG 2.5.3, label
   * in name: "Filteri zadataka" for the caption "Filteri").
   */
  caption?: string;
  /**
   * The tick. `select` by default; the glyph names `back` and `close` are silent by default (`none`, see `SILENT_GLYPHS`). A caller can
   * ask for either. A disabled control ticks nothing whatever this says.
   */
  haptic?: HapticKind;
  /** A moving style for the glyph alone (the bell's swing). */ glyphStyle?: Animated.WithAnimatedValue<StyleProp<ViewStyle>>;
  /** Drawn over the circle, as the bell's count. */ children?: ReactNode;
};

/**
 * The one icon button of the chrome (round-1 critique B2: five icon-button shapes became one). A 44 px white circle with
 * the hairline inside a 48 px touch area, and a 24 px regular glyph in ink. Short marks keep the registry
 * weight for legibility. The arrow back, the X, "···", the profile, the bell, search, filters, the Dogovori calendar
 * and the week arrows all draw it.
 * - `active` (a toggle: search, filters) is weight and colour together, a neutral well and the filled green glyph,
 *   and is spoken as selected.
 * - `disabled` draws the glyph muted. The control is never faded: a faded ghost reads as broken, not as "not now".
 * - `tone="green"` is reserved for a meaningful action; root profile and bell remain neutral, with the actual
 *   unread count alone taking the attention accent.
 * - `quiet` drops the circle for a control that ends a row of its own content (the calendar at the end of a tab row).
 * - `caption` turns the circle into a pill with a word beside the glyph (see the prop).
 */
export function ChromeIconButton(props: ChromeIconButtonProps) {
  const { label, hint, active, disabled = false, onPress, tone = 'ink', quiet = false, caption, glyphStyle, children } = props;
  const haptic = props.haptic ?? (props.glyph !== undefined && SILENT_GLYPHS.has(props.glyph) ? 'none' : 'select');
  const glyphTone = disabled ? 'muted' : active ? 'green' : tone;
  const size = caption ? chrome.captionIcon : chrome.icon;
  const drawing = props.glyph !== undefined
    ? <Glyph name={props.glyph} size={size} tone={glyphTone} on={active} />
    : <props.icon size={size} color={GLYPH_COLOUR[glyphTone]} weight={active ? 'fill' : 'regular'} />;
  // The Press is the 48 px touch area itself, so the hit is exactly that; neighbours 8 px apart do not overlap.
  return <Press accessibilityRole="button" accessibilityLabel={label} accessibilityHint={hint}
    // A toggle speaks whether it is on; a plain control speaks only whether it can be pressed.
    accessibilityState={active === undefined ? { disabled } : disabled ? { selected: active, disabled } : { selected: active }} disabled={disabled}
    onPress={onPress} haptic={disabled ? 'none' : haptic} hitSlop={0} style={caption ? s.controlWide : s.control}>
    <View testID="chrome-circle" style={[caption ? s.pill : s.circle, props.raised && !quiet && materialControl.raised, quiet && s.quiet, active && s.active]}>
      <Animated.View style={glyphStyle}>{drawing}</Animated.View>
      {caption ? <T variant="meta" tone={glyphTone} numberOfLines={1} maxFontSizeMultiplier={SCROLL_TITLE_MAX_SCALE}>{caption}</T> : null}
    </View>
    {children}
  </Press>;
}

type RootChrome = {
  variant: 'root';
  /** The section's name, said to a screen reader with the mark; never drawn. */ title: string;
  onProfile: () => void;
  /** ScreenHeader injects the account-scoped avatar; isolated galleries retain the profile glyph. */ profileEntry?: ReactNode;
  /** At most one screen control, drawn before the bell and profile. */ right?: ReactNode;
  /**
   * The inbox bell. It is handed in by `ScreenHeader` rather than imported here: the detail and flow bars are used by
   * screens whose suites isolate the data layer, and the bell reads the inbox.
   */
  bell: ReactNode;
};
type DetailChrome = {
  variant: 'detail';
  /** AI conversations keep one continuous tinted canvas; all other chrome keeps the established surface. */
  tone?: 'conversation';
  onBack: () => void;
  /** The content's name. Omit it when the content carries its own large title (a task, a person). */ title?: string;
  /** A quiet line under the title: a state, a count. */ subtitle?: string;
  /**
   * Set to show the title only once the content's own title has scrolled away (`useChromeTitleOnScroll`); it fades in
   * over 180 ms, at once under reduced motion. Leave it out and the title is always there.
   */
  titleVisible?: boolean;
  /** Something that stands before the title and belongs to it, as a person's face before their name. */ lead?: ReactNode;
  backLabel?: string; disabled?: boolean;
  /** At most one control, usually "···" for rare actions. */ right?: ReactNode;
};
type FlowChrome = {
  variant: 'flow';
  onClose: () => void;
  title?: string;
  /** Where you are in the flow, "Korak 2 od 4". */ step?: string;
  closeLabel?: string; disabled?: boolean; right?: ReactNode;
};
export type ScreenChromeProps = RootChrome | DetailChrome | FlowChrome;

export function ScreenChrome(props: ScreenChromeProps) {
  if (props.variant === 'root') return <View style={[s.bar, s.rootBar]}>
    {/* In flow: a wider existing caption can wrap the actions below instead of covering the original mark. */}
    <View pointerEvents="none" style={s.brand}>
      <View accessible accessibilityRole="header" accessibilityLabel={`USKOČI, ${props.title}`}><BrandLockup width={112} /></View>
    </View>
    <View style={s.side}>
      {props.right}
      {props.bell}
      {props.profileEntry ?? <ChromeIconButton label="Moj profil" glyph="profile" onPress={props.onProfile} />}
    </View>
  </View>;

  if (props.variant === 'flow') return <View style={s.bar}>
    <ChromeIconButton label={props.closeLabel ?? 'Zatvori'} glyph="close" disabled={props.disabled} onPress={props.onClose} />
    <View style={s.copy}>
      {props.title ? <T accessibilityRole="header" variant="title" numberOfLines={2} style={s.title}>{props.title}</T> : null}
    </View>
    {props.step ? <T variant="meta" tone="muted" style={s.step}>{props.step}</T> : null}
    {props.right}
  </View>;

  const { title, subtitle, titleVisible } = props;
  const scrolled = titleVisible !== undefined;
  const isConversation = props.tone === 'conversation';
  return <View style={[s.bar, isConversation && s.conversationBar]}>
    <ChromeIconButton label={props.backLabel ?? 'Nazad'} glyph="back" quiet={isConversation} disabled={props.disabled} onPress={props.onBack} />
    {props.lead}
    <View style={[s.copy, scrolled && s.scrolledCopy]}>
      {title && !scrolled ? <ChromeTitle title={title} subtitle={subtitle} conversation={isConversation} />
        : title ? <FadingTitle visible={titleVisible!}><ChromeTitle title={title} subtitle={subtitle} scrolled conversation={isConversation} /></FadingTitle>
          : subtitle ? <T variant="meta" tone="muted" numberOfLines={1}>{subtitle}</T> : null}
    </View>
    {props.right}
  </View>;
}

/**
 * The largest text scale the scrolled-in title follows. One line of the title at this scale (26 × 1.3 ≈ 34 px) still sits
 * inside the 48 px of the bar's controls, so the bar never grows when the person has chosen a large font.
 */
export const SCROLL_TITLE_MAX_SCALE = 1.3;

/**
 * A title that is always there may take two lines. The scrolled-in one is a reminder of a name the screen already showed
 * large, so it is one line with an ellipsis and follows the text scale only up to `SCROLL_TITLE_MAX_SCALE`.
 */
function ChromeTitle({ title, subtitle, scrolled = false, conversation = false }: { title: string; subtitle?: string; scrolled?: boolean; conversation?: boolean }) {
  const cap = scrolled ? SCROLL_TITLE_MAX_SCALE : undefined;
  return <>
    <T accessibilityRole="header" variant={conversation ? 'heading' : 'title'} numberOfLines={scrolled || conversation ? 1 : 2} maxFontSizeMultiplier={cap} style={[s.title, conversation && s.conversationTitle]}>{title}</T>
    {subtitle ? <T variant="meta" tone="muted" numberOfLines={1} maxFontSizeMultiplier={cap}>{subtitle}</T> : null}
  </>;
}

/**
 * The scrolled-in title: a short fade and a 4 px rise on a real change only; hidden from a screen reader while unseen.
 *
 * It is laid over the copy area (absolute, centred on the bar's controls) instead of standing in it, so it takes no height
 * whether it is shown or not (review of step 5b, 2026-09-24). In the flow, a faded two-line name held the bar at 68 px at
 * normal text and about 84 px at the owner's large font, with an empty band above the large title before any scroll.
 */
function FadingTitle({ visible, children }: { visible: boolean; children: ReactNode }) {
  const reduced = useReducedMotion();
  const shown = useRef(new Animated.Value(visible ? 1 : 0)).current;
  useEffect(() => {
    if (reduced) { shown.setValue(visible ? 1 : 0); return; }
    const run = Animated.timing(shown, { toValue: visible ? 1 : 0, duration: sys.motion.toggle,
      easing: Easing.bezier(...sys.motion.easeOut), useNativeDriver: true });
    run.start();
    return () => run.stop();
  }, [visible, reduced, shown]);
  const translateY = shown.interpolate({ inputRange: [0, 1], outputRange: [4, 0] });
  return <Animated.View testID="chrome-title" accessibilityElementsHidden={!visible} importantForAccessibility={visible ? 'auto' : 'no-hide-descendants'}
    style={[s.overlay, { opacity: shown, transform: [{ translateY }] }]}>{children}</Animated.View>;
}

/**
 * The detail chrome's title appears once the content's own title has scrolled past `threshold` (its height, roughly).
 * Pass `onScroll` to the screen's ScrollView with `scrollEventThrottle={16}`; state changes only when the line is crossed.
 */
export function useChromeTitleOnScroll(threshold = 72): { titleVisible: boolean; onScroll: (event: NativeSyntheticEvent<NativeScrollEvent>) => void } {
  const [titleVisible, setTitleVisible] = useState(false);
  const onScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const past = event.nativeEvent.contentOffset.y > threshold;
    setTitleVisible(current => current === past ? current : past);
  }, [threshold]);
  return { titleVisible, onScroll };
}

const s = StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: chrome.gap, minHeight: chrome.minHeight,
    paddingHorizontal: chrome.paddingHorizontal, paddingVertical: chrome.paddingVertical },
  conversationBar: { minHeight: 52, paddingVertical: sys.space.xs, paddingHorizontal: layout.gutter, backgroundColor: sys.conversation.ground, borderBottomWidth: 0 },
  conversationTitle: { ...sys.type.bodyStrong, fontSize: 17, fontWeight: '600', color: sys.color.ink },
  copy: { flex: 1, minWidth: 0 },
  // The scrolled-in title's area spans the bar's content height (its 48 px controls), and the title lies over it.
  scrolledCopy: { alignSelf: 'stretch' },
  overlay: { ...StyleSheet.absoluteFill, justifyContent: 'center' },
  title: { color: sys.color.ink },
  step: { fontVariant: ['tabular-nums'] },
  rootBar: { flexWrap: 'wrap', rowGap: sys.space.sm },
  brand: { flexBasis: 112, flexGrow: 1, flexShrink: 0, alignItems: 'flex-start', justifyContent: 'center' },
  side: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'flex-end', gap: sys.space.sm,
    maxWidth: '100%', marginLeft: 'auto' },
  control: { width: chrome.control, height: chrome.control, alignItems: 'center', justifyContent: 'center' },
  // A captioned control keeps the touch HEIGHT and grows in width with its word.
  controlWide: { minWidth: chrome.control, height: chrome.control, alignItems: 'center', justifyContent: 'center' },
  circle: { width: chrome.circle, height: chrome.circle, borderRadius: sys.radius.pill, backgroundColor: sys.color.surface,
    borderWidth: 1, borderColor: sys.color.line, alignItems: 'center', justifyContent: 'center' },
  pill: { height: chrome.circle, minWidth: chrome.circle, borderRadius: sys.radius.pill, backgroundColor: sys.color.surface,
    borderWidth: 1, borderColor: sys.color.line, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: sys.space.sm, paddingHorizontal: sys.space.md },
  quiet: { backgroundColor: 'transparent', borderColor: 'transparent' },
  active: { backgroundColor: sys.color.greenSoft },
});
