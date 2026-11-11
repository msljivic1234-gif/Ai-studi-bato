import { useCallback, useState } from 'react';
import { AppState } from 'react-native';
import { useFocusEffect } from 'expo-router';

/** Presentation guard only. Server receipts remain authoritative, including
 * recovery of commands accepted before the review expired. */
export function reviewExpired(expiresAt: string, now = Date.now()): boolean {
  return !(Date.parse(expiresAt) > now);
}

/** One local wake-up per deadline, not a polling/read/AI loop. A return from
 * background rechecks the clock even when native timers were suspended. Pass
 * null for an accepted/saved command: its recovery must never expire here. */
export function useReviewExpiry(expiresAt: string | null): boolean {
  const [, redraw] = useState(0);
  useFocusEffect(useCallback(() => {
    if (expiresAt === null) return;
    let alive = true;
    let foreground = !AppState.currentState || AppState.currentState === 'active';
    let timer: ReturnType<typeof setTimeout> | undefined;
    const clear = () => { if (timer !== undefined) { clearTimeout(timer); timer = undefined; } };
    const check = () => {
      clear();
      if (!alive || !foreground) return;
      redraw(value => value + 1);
      const remaining = Date.parse(expiresAt) - Date.now();
      // A bounded timer also tolerates an early callback or a clock moved back.
      if (Number.isFinite(remaining) && remaining > 0) {
        timer = setTimeout(check, Math.min(2_147_483_647, Math.max(1, remaining)));
      }
    };
    const subscription = AppState.addEventListener('change', state => {
      const next = state === 'active';
      if (next === foreground) return;
      foreground = next;
      if (foreground) check(); else clear();
    });
    check();
    return () => { alive = false; clear(); subscription.remove(); };
  }, [expiresAt]));
  return expiresAt !== null && reviewExpired(expiresAt);
}
