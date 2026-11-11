import type { NeedUrgencyProjection } from '../contracts/projections';

/**
 * Owner 2026-10-07: no separate HITNO in the first release — a task needed "odmah" is an ordinary task with that time
 * and reaches workers with "Dostupan sam" first. The HITNO code stays for a later release behind ONE compile-time
 * flag: a build shows HITNO (badge, pin, activation entry, quiet-hours exception) only with EXPO_PUBLIC_URGENT=1, and
 * no build profile sets it. Jest runs the actual V1 default without the flag;
 * future-HITNO contract tests opt into it only within their own isolated suite.
 */
export function urgentBuilt(flag: unknown = process.env.EXPO_PUBLIC_URGENT): boolean {
  return flag === '1';
}

/** Display expiry only; no transport, invented duration or activation authority. */
export function displaysUrgent(urgency: NeedUrgencyProjection | undefined, now = Date.now()): boolean {
  return urgentBuilt() && urgency?.level === 'HITNO' && Date.parse(urgency.expiresAt) > now;
}
