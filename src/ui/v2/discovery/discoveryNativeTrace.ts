import { useCallback, useRef } from 'react';
import Constants from 'expo-constants';
import type { DiscoveryTrace } from '../DiscoveryPresentation';

/** The presentation's own trace points; anything else is dropped. */
export const NATIVE_TRACE_EVENTS = new Set<Parameters<DiscoveryTrace>[0]>(['route-trace', 'route-focus', 'route-blur', 'route-open', 'route-view',
  'focus', 'blur', 'preopen', 'write-offset', 'seed', 'ready', 'geometry', 'index', 'content', 'layout',
  'restore-check', 'clamp0', 'request', 'ack', 'scroll0', 'scroll', 'scroll-reject', 'search-change', 'drag', 'refresh', 'kick', 'stall', 'want', 'fit', 'bar', 'bar-value']);
/** High-rate events: a few samples each (each name has its own, per visit), so that a swipe cannot use the allowance reserved for the sheet's own moves. */
export const NATIVE_TRACE_SAMPLES = new Set<Parameters<DiscoveryTrace>[0]>(['scroll', 'scroll0', 'scroll-reject', 'restore-check', 'content', 'layout', 'geometry', 'route-view', 'bar-value']);
/** The allowance of ONE visit: every `route-focus` starts a visit, so that a return is diagnosed like the first visit (the first version spent it all on scrolling). */
export const NATIVE_TRACE_LIMIT = 600;
export const NATIVE_TRACE_SAMPLE_LIMIT = 60;

/**
 * Bounded native diagnosis of the Zadaci sheet and list for DEV, or an explicitly enabled preview build (the same events the legacy route traces behind
 * its `discoveryTrace` parameter): fixed event names and finite numbers, no task, person, request or free text. The P6 route rebuilds its
 * screen on every return, so a native sheet that does not follow its requested detent has to be seen event by event, not guessed.
 */
export function useDiscoveryNativeTrace(): DiscoveryTrace | undefined {
  const packageName = Constants.expoConfig?.android?.package;
  const enabled = packageName === 'rs.uskoci.dev'
    || (packageName === 'rs.uskoci.preview' && process.env.EXPO_PUBLIC_DISCOVERY_TRACE === '1');
  const count = useRef(0), samples = useRef(new Map<string, number>());
  const trace = useCallback<DiscoveryTrace>((event, ...values) => {
    if (event === 'route-focus') { count.current = 0; samples.current.clear(); }
    if (count.current >= NATIVE_TRACE_LIMIT || !NATIVE_TRACE_EVENTS.has(event) || values.length > 20
      || values.some(value => typeof value !== 'boolean' && (typeof value !== 'number' || !Number.isFinite(value)))) return;
    if (NATIVE_TRACE_SAMPLES.has(event)) { const used = samples.current.get(event) ?? 0; if (used >= NATIVE_TRACE_SAMPLE_LIMIT) return; samples.current.set(event, used + 1); }
    const safe = values.map(value => typeof value === 'boolean' ? value : Math.round(Math.max(-10_000_000, Math.min(10_000_000, value)) * 10) / 10);
    console.info(`[USKOCI_DISCOVERY_TRACE] ${JSON.stringify([++count.current, event, ...safe])}`);
  }, []);
  return enabled ? trace : undefined;
}
