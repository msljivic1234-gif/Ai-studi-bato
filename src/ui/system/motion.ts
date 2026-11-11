import { useEffect, useSyncExternalStore } from 'react';
import { AccessibilityInfo, AppState } from 'react-native';

/**
 * The shared live reduced-motion preference. A launch-only answer can miss a
 * setting changed while the app is open, so this store follows the platform:
 *
 * - the root layout seeds it with the value the platform reported at launch (`useReducedMotionRoot`), so the first
 *   frame of the first screen already respects it;
 * - while the root is mounted it follows the platform: the accessibility change event, and a fresh read every time
 *   the app comes back to the foreground (the setting can be changed while the app sits in the background);
 * - every screen and component reads it with `useReducedMotion`, through `useSyncExternalStore`, so one change reaches
 *   all of them in the same render.
 *
 * This preference store is independent of the animation engine chosen by a component. A
 * reader without a mounted root never touches a native API; it reads "not reduced" until a root follows the platform,
 * except a reader that outlives a root, which keeps the last answer that root knew (see `forgetWhenUnused`).
 * Shared motion defaults live in `motionTokens.ts`, exposed through `sys.motion`.
 * Its press/feedback/content/navigation/sheet/assistant categories offer purposeful
 * variants, not one duration for all transitions. Selecting a preset does not
 * subscribe to focus/AppState or start anything: the consumer keeps its lifecycle
 * cancellation, native execution and current reading/draft/refresh state.
 *
 * "Reduced" means the same thing everywhere. Movement is off and a state change is instant: a press does not scale, a row
 * does not arrive, a sheet settles with `{ duration: 0 }`, a loop (skeleton breath, typing dots, glow) does not start,
 * Lottie shows its first frame, and a screen change uses the navigation animation 'none'. A haptic is not movement: it
 * stays, because a person who asked for less motion has not asked for less feedback.
 * A component that moves on its own reads `useReducedMotion` from here, never Reanimated's launch-time value and never
 * `AccessibilityInfo` itself.
 */

type Subscription = { remove?: () => void } | null | undefined | void;

let reduced = false;
/** A live answer (event or query) arrived, so the launch seed must not overwrite it. */
let answered = false;
let seeded = false;
/** Bumped by every event and by stopping, so an older query can never overwrite a newer answer. */
let revision = 0;
let holders = 0;
let stopFollowing: (() => void) | undefined;
const readers = new Set<() => void>();

/** Every change of the value goes through here, so a mounted reader never keeps a value the store no longer holds. */
function set(value: boolean) {
  if (value === reduced) return;
  reduced = value;
  readers.forEach(reader => reader());
}

function publish(value: boolean) {
  answered = true;
  set(value);
}

function ask(isCurrent: () => boolean) {
  const request = ++revision;
  try {
    const answer = AccessibilityInfo?.isReduceMotionEnabled?.();
    answer?.then?.(value => {
      if (isCurrent() && request === revision && typeof value === 'boolean') publish(value);
    }, () => undefined); // A failed read keeps what is known; the next foreground asks again.
  } catch { /* No API on this platform or in this test double: keep what is known. */ }
}

function follow(): () => void {
  let live = true;
  const isCurrent = () => live;
  let preference: Subscription, foreground: Subscription;
  try {
    preference = AccessibilityInfo?.addEventListener?.('reduceMotionChanged', (value: boolean) => {
      if (!live || typeof value !== 'boolean') return;
      revision++;
      publish(value);
    });
  } catch { /* not available here */ }
  try {
    foreground = AppState?.addEventListener?.('change', state => { if (live && state === 'active') ask(isCurrent); });
  } catch { /* not available here */ }
  ask(isCurrent);
  return () => {
    live = false;
    revision++;
    preference?.remove?.();
    foreground?.remove?.();
  };
}

function hold(): () => void {
  holders++;
  if (holders === 1) stopFollowing = follow();
  let released = false;
  return () => {
    if (released) return;
    released = true;
    holders--;
    if (holders > 0) return;
    stopFollowing?.();
    stopFollowing = undefined;
    // Nothing follows the platform any more: the next root starts as a fresh launch and may seed again.
    answered = false; seeded = false;
    forgetWhenUnused();
  };
}

/**
 * A reader can outlive the root (the root error boundary took over; a retried root is about to mount). It keeps the
 * last known answer: dropping it to "not reduced" would start moving things for a person who asked for less motion,
 * and a retried root skips its seed while readers are mounted. Once no root and no reader is left, nothing is known.
 */
function forgetWhenUnused() {
  if (holders === 0 && readers.size === 0) set(false);
}

/**
 * The launch value, taken only before anything reads the store and before a live answer arrived. It never notifies:
 * it runs while the root renders, before any screen has drawn.
 */
export function seedReducedMotion(launch: boolean): void {
  if (seeded || answered || readers.size > 0) return;
  seeded = true;
  reduced = launch;
}

/** For the root layout only: seed with the launch value, then follow the platform for as long as the root lives. */
export function useReducedMotionRoot(launch: boolean): void {
  seedReducedMotion(launch);
  useEffect(hold, []);
}

function subscribe(reader: () => void) {
  readers.add(reader);
  return () => { readers.delete(reader); forgetWhenUnused(); };
}
const snapshot = () => reduced;

/** Whether the person asked the system for less motion. True means: nothing moves; state changes are instant. */
export function useReducedMotion(): boolean {
  return useSyncExternalStore(subscribe, snapshot, snapshot);
}
