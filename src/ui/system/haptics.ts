import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';
import { sys } from './tokens';

/**
 * The one place a haptic tick is made (UI/UX pass, motion item M-03; `MOTION_I_POLISH_SPEC_20261007.md` A6).
 *
 * WHEN a tick happens is the caller's: meaningful feedback follows the command or confirmed outcome, so a control ticks
 * when its tap completes (`Press`), a result ticks when the server confirmed it, and navigation ticks nothing. HOW it feels
 * is this file's, and it differs by platform:
 *
 * - iOS plays the system generators: `selectionAsync`, `impactAsync` and `notificationAsync` are the Taptic Engine's own.
 * - Android plays the system's own haptic constants through `performAndroidHapticsAsync` (`View.performHapticFeedback`),
 *   which is what the platform recommends and which, called without flags as `expo-haptics` does, follows the person's
 *   "touch feedback" setting (a phone with it off is silent, which is right). The three calls above are plain vibrator
 *   waveforms there (the module's own timings and amplitudes, whatever that setting says), and that is how the app used to
 *   make every tick. Those waveforms stay as the fallback.
 *
 * On Android a constant the system does not have is not silent: the module rejects (`HapticsNotSupportedException`).
 * `Confirm`, `Reject` and the gesture pair arrived with Android 11 (API 30), `Segment_Tick`, `Toggle_On` and `Toggle_Off` with
 * Android 14 (API 34; the Android SDK's `api-versions.xml`), and only `Clock_Tick`, `Context_Click`, `Keyboard_Tap`,
 * `Long_Press` and `Virtual_Key` exist everywhere (`expo-haptics` `HapticsRecord.kt` refuses the rest on an older system). A
 * phone on Android 12 or 13 therefore has no `Segment_Tick`. Each kind lists the constants it would like, in order, then the
 * vibrator form, then nothing.
 *
 * A tick is never worth a crash or a lost tap: nothing here throws or rejects. No haptics engine, a native module that is
 * missing, a build whose JS is newer than its native half, a test double: all of it is silence.
 *
 * A tick is not movement, so it does NOT follow "reduce motion" : a person who asked for less
 * motion has not asked for less feedback. This file therefore never reads the reduced-motion store.
 *
 * "Less is more": two ticks closer than `sys.motion.tickGap` feel like one buzz. Of two ticks inside the gap the heavier one
 * plays and a lighter or equal one is dropped, so an outcome (a sent message confirmed) is never held back by the touch
 * that caused it. Weights follow the spec's levels: choice (1) < action and gesture (2) < destructive confirm (3) < outcome (4).
 *
 * The mapping to Android constants is the spec's table, SOURCE only until it has been felt on the HONOR (spec A6: a
 * hypothesis for that probe); the table below is the one place to change it.
 */
export type Tick =
  /** A choice changed: a chip, a segment, a checkbox, a star, a sheet landing on a stop. */
  | 'select'
  /** A switch went on or off. */
  | 'toggleOn' | 'toggleOff'
  /** The main action, on release (Send, Publish, Confirm, Save). */
  | 'light'
  /** A destructive confirmation (Delete, Cancel, Discard changes). */
  | 'medium'
  /** An outcome the server confirmed (a sent message, "Objavljeno", "Dogovoreno!"). */
  | 'success'
  /** A command failed (a send, a recording, a publication, an offline block). */
  | 'error'
  /** Hold to talk: recording really began / the finger was released to send. */
  | 'gestureStart' | 'gestureEnd'
  /** A gesture was called off (the recording was dragged away). */
  | 'cancel';

type AndroidName = keyof typeof Haptics.AndroidHaptics;

type Plan = {
  /** Which of two ticks inside `sys.motion.tickGap` wins: the heavier. */
  weight: 1 | 2 | 3 | 4;
  /** The system's own constants, in order of preference; the first one the phone has plays. */
  android: readonly AndroidName[];
  /** The same sensation in the form iOS plays natively and Android plays as a vibrator waveform: the fallback. */
  play: () => Promise<void>;
};

const PLAN: Record<Tick, Plan> = {
  select: { weight: 1, android: ['Segment_Tick', 'Context_Click'], play: () => Haptics.selectionAsync() },
  toggleOn: { weight: 1, android: ['Toggle_On', 'Segment_Tick', 'Context_Click'], play: () => Haptics.selectionAsync() },
  toggleOff: { weight: 1, android: ['Toggle_Off', 'Segment_Tick', 'Context_Click'], play: () => Haptics.selectionAsync() },
  light: { weight: 2, android: ['Virtual_Key'], play: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light) },
  medium: { weight: 3, android: ['Long_Press'], play: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium) },
  success: { weight: 4, android: ['Confirm', 'Virtual_Key'], play: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success) },
  error: { weight: 4, android: ['Reject'], play: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error) },
  gestureStart: { weight: 2, android: ['Gesture_Start', 'Context_Click'], play: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light) },
  gestureEnd: { weight: 2, android: ['Gesture_End', 'Context_Click'], play: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light) },
  cancel: { weight: 3, android: ['Reject'], play: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning) },
};

/** Runs one haptic request and says whether it was accepted. A call that throws, or a promise that rejects, is "no". */
async function attempt(call: () => unknown): Promise<boolean> {
  try { await call(); return true; } catch { return false; }
}

async function play(plan: Plan): Promise<void> {
  if (Platform.OS === 'android' && typeof Haptics.performAndroidHapticsAsync === 'function') {
    for (const name of plan.android) {
      const constant = Haptics.AndroidHaptics?.[name];
      // The first request leaves in the same turn as the tick, so the tick keeps pace with the picture; only a refusal waits.
      if (constant !== undefined && await attempt(() => Haptics.performAndroidHapticsAsync(constant))) return;
    }
  }
  await attempt(plan.play);
}

let lastAt = Number.NEGATIVE_INFINITY;
let lastWeight = 0;

/**
 * Makes one tick. Fire and forget: it returns at once, never throws and never leaves a rejected promise behind.
 */
export function tick(kind: Tick): void {
  try {
    const plan = PLAN[kind];
    if (!plan) return;
    const now = Date.now();
    const sinceLast = now - lastAt;
    // A clock that went backwards (the device's time was changed) is not "just now".
    if (sinceLast >= 0 && sinceLast < sys.motion.tickGap && plan.weight <= lastWeight) return;
    lastAt = now;
    lastWeight = plan.weight;
    void play(plan).catch(() => undefined);
  } catch { /* A tick is never worth a crash. */ }
}

/** Forgets the last tick, so the next one is not held back by it. For tests, whose clocks and cases do not share a past. */
export function forgetTicks(): void {
  lastAt = Number.NEGATIVE_INFINITY;
  lastWeight = 0;
}
