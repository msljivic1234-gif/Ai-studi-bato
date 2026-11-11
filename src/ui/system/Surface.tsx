import { createContext, useContext, useEffect, useMemo, type ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { Press } from '../Press';
import { layout, ruleWidth } from './layout';
import { cardCompact, floating, inset, raisedItem, sys } from './tokens';

/** Material primitives, not content templates. A discovery card, my task and an agreement
 * share tokens but choose their own hierarchy, actions, imagery and density in their family.
 * Legacy kinds retain sensible defaults; variants allow intentional evolution without forks.
 * A shadow is elevation, not evidence of interactivity or a successful business operation. */
export type SurfaceKind = 'record' | 'panel' | 'float' | 'note' | 'hero' | 'media' | 'inset';
export type SurfaceTone = 'neutral' | 'wash' | 'brand' | 'accent' | 'success' | 'info' | 'warn' | 'danger' | 'violet';
export type SurfaceVariant = 'flat' | 'outlined' | 'elevated' | 'tinted';
export type SurfaceDensity = keyof typeof sys.surface.padding;
export type SurfaceProps = {
  kind: SurfaceKind;
  tone?: SurfaceTone;
  variant?: SurfaceVariant;
  density?: SurfaceDensity;
  onPress?: () => void;
  disabled?: boolean;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  testID?: string;
  accessibilityLabel?: string;
  accessibilityHint?: string;
};

type EnclosingSurface = { kind: SurfaceKind; interactive: boolean };
const Enclosing = createContext<EnclosingSurface | null>(null);

/** Nesting a passive status or media section is legitimate. Nested whole-card buttons
 * compete for a single gesture and accessibility focus: use sibling actions instead. */
export function surfaceWarnings({ kind, enclosing, pressed, enclosingPressed = false }: {
  kind: SurfaceKind; enclosing: SurfaceKind | null; pressed: boolean; enclosingPressed?: boolean;
}): string[] {
  return enclosing && pressed && enclosingPressed
    ? [`Surface: interactive ${kind} is inside interactive ${enclosing}. Use sibling actions so one gesture has one owner.`] : [];
}
export const speaks = (env: { dev: boolean; test: boolean }): boolean => env.dev && !env.test;
const underTest = () => process.env.NODE_ENV === 'test' || process.env.JEST_WORKER_ID !== undefined;

export function Surface({ kind, tone, variant, density, onPress, disabled = false, children, style, testID,
  accessibilityLabel, accessibilityHint }: SurfaceProps) {
  const enclosing = useContext(Enclosing);
  const pressed = onPress !== undefined;
  const context = useMemo(() => ({ kind, interactive: pressed }), [kind, pressed]);
  useEffect(() => {
    if (!speaks({ dev: __DEV__, test: underTest() })) return;
    for (const message of surfaceWarnings({ kind, enclosing: enclosing?.kind ?? null, pressed, enclosingPressed: enclosing?.interactive })) console.warn(message);
  }, [kind, enclosing?.kind, enclosing?.interactive, pressed]);

  const effectiveTone = tone ?? (kind === 'hero' ? 'brand' : kind === 'note' || kind === 'inset' ? 'wash' : 'neutral');
  const look = [s[kind], variant ? materials[variant] : null,
    effectiveTone !== 'neutral' ? tones[effectiveTone] : null,
    density ? { padding: sys.surface.padding[density], paddingHorizontal: sys.surface.padding[density], paddingVertical: sys.surface.padding[density] } : null,
    pressed ? s.touch : null, style];
  const body = onPress
    ? <Press testID={testID} accessibilityRole="button" accessibilityLabel={accessibilityLabel} accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled }} disabled={disabled} onPress={() => { if (!disabled) onPress(); }}
      haptic={disabled ? 'none' : 'select'} scaleTo={sys.motion.scale.row} style={look}>{children}</Press>
    : <View testID={testID} accessible={accessibilityLabel ? true : undefined} accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint} style={look}>{children}</View>;
  return <Enclosing.Provider value={context}>{body}</Enclosing.Provider>;
}

// Clear previous material elevation when the caller deliberately chooses flat/outlined.
const noLift: ViewStyle = { boxShadow: [], elevation: 0, shadowOpacity: 0 };
const materials = StyleSheet.create({
  flat: { ...noLift, borderWidth: 0 },
  outlined: { ...noLift, borderWidth: ruleWidth, borderColor: sys.color.cardLine },
  elevated: { ...raisedItem },
  tinted: { ...noLift, borderWidth: 0 },
});
const tones = StyleSheet.create({
  wash: { backgroundColor: sys.color.wash },
  brand: { backgroundColor: sys.status.brand.background },
  accent: { backgroundColor: sys.status.accent.background },
  success: { backgroundColor: sys.status.success.background },
  info: { backgroundColor: sys.status.info.background },
  warn: { backgroundColor: sys.status.warning.background },
  danger: { backgroundColor: sys.status.danger.background },
  violet: { backgroundColor: sys.status.violet.background },
});
const s = StyleSheet.create({
  record: { ...raisedItem, borderRadius: sys.radius.card, padding: layout.card },
  panel: { ...cardCompact },
  float: { ...floating, backgroundColor: sys.color.surface, borderWidth: ruleWidth, borderColor: sys.color.line, borderRadius: sys.radius.card },
  note: { ...inset, paddingVertical: sys.space.md, paddingHorizontal: sys.space.base },
  hero: { backgroundColor: sys.color.surface, borderRadius: sys.radius.hero, padding: sys.surface.padding.spacious },
  media: { backgroundColor: sys.color.surface, borderRadius: sys.radius.media, borderWidth: ruleWidth, borderColor: sys.color.cardLine },
  inset: { backgroundColor: sys.color.wash, borderRadius: sys.radius.control, padding: sys.surface.padding.compact },
  touch: { minHeight: layout.touch, minWidth: layout.touch },
});
