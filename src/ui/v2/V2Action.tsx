import { cloneElement, isValidElement, useEffect, useRef, useState, type ReactNode } from 'react';
import { AccessibilityInfo, ActivityIndicator, Animated, Easing, StyleSheet, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import { Check } from 'phosphor-react-native';
import { Press } from '../Press';
import { T } from '../Text';
import { useReducedMotion } from '../system/motion';
import { brandAction, sys } from '../system/tokens';

/** How long the confirmed check stays before the button says its label alone again. */
export const ACTION_SUCCESS_MS = 1200;
/** Every action's touch target: an important command is never under 48 px. */
export const ACTION_MIN_HEIGHT = 48;

/**
 * The one action of the app (master design plan, 2026-09-24: `V2Action` keeps its name, the old `Button` is gone).
 * Reuses existing UI-thread press feedback, system reduced motion and haptics.
 *
 * Brand commands use deep green; `tone="accent"` supports publication and important next actions in orange.
 * The label follows the actual material: white on green, dark ink on orange. Neutral secondary controls use body ink.
 * Secondary is white with a line; quiet is a link; destructive uses danger ink. Legacy `brandAction` remains compatible.
 *
 * States, each said to the eye and to a screen reader:
 * - disabled: a quiet wash with the label AND its icon in muted ink, readable (5.0:1), never a faded ghost of the live
 *   button (a white icon on the wash would vanish);
 * - disabled with a reason: the same, with the caller's reason as a muted line under the button and as the button's
 *   spoken hint (the owner's rule: a grey button always says why);
 * - loading: the button keeps its colour and its words, a spinner stands before them, it cannot be pressed twice and
 *   is spoken as busy;
 * - success: a check before the label for 1.2 s, only when the caller says the write is CONFIRMED (never on press);
 * - error: a danger outline and the caller's message right under the button, announced as an alert.
 * A line under the button is drawn inside one column with it, so a row of buttons keeps its columns; the caller's
 * place in its row (flex, width, margins) moves onto that column. A caller that passes `reason` or `error` at all (even
 * null) gets the column from the start, so the button is never rebuilt when a line appears. A reason that appears or
 * changes later is announced.
 * Every action is at least 48 px high; the primary 54, as `brandAction`.
 */
export function V2Action({ label, accessibilityLabel, onPress, disabled = false, kind = 'secondary', tone = 'brand', icon, style, labelStyle, compact = false,
  loading = false, success = false, error, reason }: {
  label: string; onPress: () => void; disabled?: boolean;
  /** Row context for assistive technology without repeating the task title on the visible action. */
  accessibilityLabel?: string;
  kind?: 'primary' | 'secondary' | 'quiet' | 'destructive'; icon?: ReactNode; style?: StyleProp<ViewStyle>;
  /** Reviewed typography for a specific composition; the action still scales with system text. */
  labelStyle?: StyleProp<TextStyle>;
  /** Purpose of the command; accent primaries use dark ink on orange, accent links use readable orange ink. */
  tone?: 'brand' | 'neutral' | 'accent';
  /** Smaller type for a secondary control that must not compete with the content. The
   *  touch target keeps its full minimum height, so it is no harder to hit. */
  compact?: boolean;
  /** The write this action started is in flight. */ loading?: boolean;
  /** The caller has the server's confirmation of the write; the check shows once, for 1.2 s. */ success?: boolean;
  /** Why the last attempt did not go through, in the caller's words; drawn under the button. */ error?: string | null;
  /** Why a disabled action cannot be pressed now, in the caller's words; drawn under it and spoken as its hint. */
  reason?: string | null;
}) {
  const flat = StyleSheet.flatten(style) ?? {};
  const onBrand = flat.backgroundColor === brandAction.backgroundColor;
  const onAccent = flat.backgroundColor === sys.color.orange || (!flat.backgroundColor && kind === 'primary' && tone === 'accent');
  const confirmed = useConfirmed(success && !loading);
  const inactive = disabled || loading;
  // Loading is the button at work, not a button that cannot be used: it keeps its own colour.
  const resting = disabled && !loading;
  const filled = onBrand || onAccent || kind === 'primary' || kind === 'secondary';
  const color = resting ? sys.color.muted : onBrand ? sys.color.onGreen : onAccent ? sys.color.onOrange : kind === 'primary' ? sys.color.onGreen
    : kind === 'destructive' ? sys.color.danger : tone === 'neutral' ? sys.color.ink : tone === 'accent' ? sys.color.orangeInk : sys.color.green;
  // A disabled button draws its icon in the label's muted ink: the caller's icon was coloured for the live surface.
  const lead = loading ? <ActivityIndicator size="small" color={color} /> : confirmed ? <ConfirmedCheck color={color} />
    : (resting || onAccent) && isValidElement<{ color?: string }>(icon) ? cloneElement(icon, { color }) : icon;
  const why = resting && !error && reason ? reason : null;
  // The column is decided by whether the caller passes a line at all, not by whether one shows now: switching between
  // the bare button and the column rebuilt the button, and TalkBack lost its place on it just as its error appeared.
  const wrapped = error !== undefined || reason !== undefined;
  const [outer, inner] = wrapped ? splitPlacement(flat) : [null, style];
  useAnnouncedReason(why, loading);
  const button = <Press accessibilityRole="button" accessibilityLabel={accessibilityLabel ?? label} accessibilityHint={why ?? undefined}
    accessibilityState={{ disabled: inactive, busy: loading }}
    onPress={onPress} disabled={inactive} haptic={inactive ? 'none' : kind === 'primary' ? 'light' : 'select'}
    style={[{ minHeight: kind === 'primary' ? 54 : ACTION_MIN_HEIGHT, borderRadius: sys.radius.control,
      paddingHorizontal: sys.space.base, paddingVertical: sys.space.sm, gap: sys.space.sm,
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
      backgroundColor: kind === 'primary' ? (tone === 'accent' ? sys.color.orange : sys.color.green) : kind === 'secondary' ? sys.color.surface : 'transparent',
      borderWidth: kind === 'secondary' ? 1 : 0, borderColor: sys.color.lineStrong }, inner,
      resting && filled ? s.restingFilled : null, error ? s.errorEdge : null]}>
    {lead}<T variant={compact ? 'meta' : 'action'} style={[labelStyle, { flexShrink: 1, textAlign: 'center', color }]}>{label}</T>
  </Press>;
  if (!wrapped) return button;
  return <View testID="action-column" style={[s.column, outer]}>
    {button}
    {/* The reason is the button's spoken hint already; drawn for the eye, it is not read a second time. */}
    {why ? <T variant="note" tone="muted" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">{why}</T> : null}
    {error ? <T variant="note" tone="danger" accessibilityRole="alert" accessibilityLiveRegion="polite">{error}</T> : null}
  </View>;
}

/** The style keys that place a button in its row, which belong to the column once a line is drawn under it. */
const PLACEMENT = ['flex', 'flexGrow', 'flexShrink', 'flexBasis', 'alignSelf', 'width', 'minWidth', 'maxWidth', 'margin',
  'marginTop', 'marginBottom', 'marginLeft', 'marginRight', 'marginHorizontal', 'marginVertical', 'marginStart', 'marginEnd'] as const;
function splitPlacement(flat: ViewStyle): [ViewStyle, ViewStyle] {
  const outer: ViewStyle = {}, inner: ViewStyle = { ...flat };
  for (const key of PLACEMENT) {
    if (flat[key] === undefined) continue;
    (outer as Record<string, unknown>)[key] = flat[key];
    delete (inner as Record<string, unknown>)[key];
  }
  // A button that sized itself to its label keeps that size inside the column.
  if (flat.alignSelf !== undefined) inner.alignSelf = flat.alignSelf;
  return [outer, inner];
}

/**
 * A reason that appears or changes while the button is on screen is announced once ("Zadatak više ne prima prijave."
 * after a refresh): it is otherwise only the button's hint, heard when focus lands there. The reason the button was drawn
 * with is not announced, and a button at work keeps the reason it had, so the same words are not said again after it.
 */
function useAnnouncedReason(why: string | null, loading: boolean) {
  const spoken = useRef(why);
  useEffect(() => {
    if (loading) return;
    if (why && why !== spoken.current) AccessibilityInfo.announceForAccessibility(why);
    spoken.current = why;
  }, [why, loading]);
}

/** True for `ACTION_SUCCESS_MS` after `success` turns on; a caller that keeps it on does not keep the check. */
function useConfirmed(success: boolean): boolean {
  const [shown, setShown] = useState(success);
  useEffect(() => {
    if (!success) { setShown(false); return; }
    setShown(true);
    const timer = setTimeout(() => setShown(false), ACTION_SUCCESS_MS);
    return () => clearTimeout(timer);
  }, [success]);
  return shown;
}

/** The check settles in with a short scale on a real confirmation; under reduced motion it is simply there. */
function ConfirmedCheck({ color }: { color: string }) {
  const reduced = useReducedMotion();
  const scale = useRef(new Animated.Value(reduced ? 1 : 0.6)).current;
  useEffect(() => {
    if (reduced) { scale.setValue(1); return; }
    const run = Animated.timing(scale, { toValue: 1, duration: sys.motion.toggle, easing: Easing.bezier(...sys.motion.easeOut), useNativeDriver: true });
    run.start();
    return () => run.stop();
  }, [reduced, scale]);
  return <Animated.View testID="action-confirmed" style={{ transform: [{ scale }] }}><Check size={20} weight="bold" color={color} /></Animated.View>;
}

const s = StyleSheet.create({
  column: { gap: sys.space.xs },
  restingFilled: { backgroundColor: sys.color.wash, borderWidth: 1, borderColor: sys.color.line },
  errorEdge: { borderWidth: 2, borderColor: sys.color.danger },
});
