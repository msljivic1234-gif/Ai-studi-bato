/**
 * Motion by purpose. A preset is a design choice, never a command to animate:
 * use it only when it explains an interaction or a real state change.
 *
 * This module is pure data. Consumers keep the live reduced-motion preference,
 * focus/AppState cancellation and native/Reanimated execution they already own.
 * A refresh must not replay an entrance or reset reading/scroll/draft state.
 */
const PRESS_SCALE = { button: 0.97, row: 0.985, none: 1 } as const;
const EASE_OUT = [0.23, 1, 0.32, 1] as const;
const EASE_IN_OUT = [0.77, 0, 0.175, 1] as const;
const PRESS_SPRING = { duration: 400, dampingRatio: 0.85 } as const;
const SHEET_SPRING = { stiffness: 300, damping: 30, mass: 1, overshootClamping: true } as const;
const DIALOG = { enter: 200, exit: 160, from: 0.96 } as const;
const LOOP = { breath: 700, typing: 520, glow: 1600 } as const;
const ASSISTANT = { floatHalf: 2400, winkClose: 120, winkOpen: 140, blinkClose: 95, blinkOpen: 110,
  nextBlinkMin: 3500, nextBlinkJitter: 2800 } as const;

const categories = {
  /** Frequent touch feedback: no layout work and no wait before the action. */
  press: {
    button: { kind: 'timing', duration: 120, scale: PRESS_SCALE.button, easing: EASE_OUT, release: PRESS_SPRING },
    row: { kind: 'timing', duration: 100, scale: PRESS_SCALE.row, easing: EASE_OUT, release: PRESS_SPRING },
    quiet: { kind: 'static', duration: 0, scale: PRESS_SCALE.none },
  },
  /** The visible result stays meaningful without animation or haptics. */
  feedback: {
    selection: { kind: 'timing', duration: 180, easing: EASE_OUT },
    success: { kind: 'timing', duration: 220, easing: EASE_OUT },
    error: { kind: 'timing', duration: 180, easing: EASE_OUT },
  },
  /** Animate a new content boundary once; ordinary refresh keeps its identity. */
  content: {
    reveal: { kind: 'timing', duration: 240, easing: EASE_OUT, translateY: 8 },
    replace: { kind: 'timing', duration: 180, easing: EASE_IN_OUT, translateY: 0 },
    exit: { kind: 'timing', duration: 160, easing: EASE_OUT, translateY: 0 },
  },
  /** New navigation uses native transitions; peer tabs do not slide. */
  navigation: {
    stack: { kind: 'native', animation: 'default' },
    tab: { kind: 'native', animation: 'none' },
  },
  sheet: {
    open: { kind: 'spring', config: SHEET_SPRING },
    close: { kind: 'timing', duration: 170, easing: EASE_OUT },
    dialog: { kind: 'timing', duration: DIALOG.enter, easing: EASE_OUT, fromScale: DIALOG.from },
  },
  /** Loops run only while focused, foregrounded and not under reduced motion. */
  assistant: {
    thinking: { kind: 'loop', halfCycle: LOOP.typing, requiresActiveScreen: true },
    listening: { kind: 'loop', halfCycle: LOOP.glow, requiresActiveScreen: true },
    illustration: { kind: 'loop', halfCycle: ASSISTANT.floatHalf, requiresActiveScreen: true },
  },
} as const;

/**
 * Existing flat fields remain compatible aliases. Screens can adopt a purpose
 * and variant deliberately; extracting this source does not retime their UI.
 */
export const motionTokens = {
  categories,
  press: categories.press.button.duration,
  toggle: categories.feedback.selection.duration,
  enter: categories.content.reveal.duration,
  exit: categories.content.exit.duration,
  /** Compatibility for the existing stack adapter; new stacks use native defaults. */
  push: categories.content.reveal.duration,
  camera: 360,
  stagger: 40,
  easeOut: EASE_OUT,
  /** Haptic rate limit, independent of animation duration and reduced motion. */
  tickGap: 120,
  pressScale: PRESS_SCALE.button,
  scale: PRESS_SCALE,
  spring: PRESS_SPRING,
  sheetSpring: SHEET_SPRING,
  sheetClose: categories.sheet.close.duration,
  dialog: DIALOG,
  loop: LOOP,
  assistant: ASSISTANT,
  radarSweep: 2600,
  /** Welcome artwork; these timings do not hold back intent selection. */
  welcome: { entrance: 450, choicePulseHalf: 2000 },
  /** Rare decorative arrival; never delays a control or completion state. */
  arrive: { duration: 800, easing: [0.22, 0.8, 0.25, 1] as const },
} as const;

export type MotionCategory = keyof typeof categories;
export type MotionVariant<Category extends MotionCategory> = keyof typeof categories[Category];

/** Typed lookup; preference/lifecycle handling remains with the active consumer. */
export function getMotionPreset<Category extends MotionCategory, Variant extends MotionVariant<Category>>(
  category: Category, variant: Variant,
): typeof categories[Category][Variant] {
  return categories[category][variant];
}
