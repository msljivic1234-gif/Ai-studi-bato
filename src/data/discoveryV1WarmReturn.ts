import type { MarketplaceView } from './marketplaceView';

/**
 * EX-03 warm return (owner approval 2026-09-30). The P6 route unmounts its screen on every blur and rebuilds it on focus; until now each rebuild read PAGE and MAP again before it could
 * show anything. The route now keeps the coordinator of the screen that left, for the next screen of the same account, and that screen shows its picture at once. The window is short
 * and well inside the server anchor's 30 minutes: after it the return reads like a first visit. Nothing here knows about Discovery: it parks anything that can detach, says whether
 * the picture is still warm for a view and retires what it does not keep. It belongs to the route, so it goes with the route (sign-out, account change).
 */
export const DISCOVERY_V1_WARM_RETURN_MS = 5 * 60_000;

export type DiscoveryV1Keepable = {
  /** The screen is leaving: fence everything in flight, keep the picture. False when the picture is not worth keeping. */
  detach(): boolean;
  /** Whether the picture can be shown again for this view without a read. */
  warm(view: MarketplaceView): boolean;
  retire(): void;
};

export function createDiscoveryV1WarmReturn<C extends DiscoveryV1Keepable>(now: () => number = () => Date.now()) {
  let parked: { key: string; source: object; coordinator: C; at: number } | null = null, disposed = false;
  const drop = () => { const held = parked; parked = null; held?.coordinator.retire(); };
  return {
    /** The screen that drove `coordinator` has left. It is kept when it can be, retired when it cannot (or when the route itself is gone). */
    park(key: string, source: object, coordinator: C) {
      if (parked?.coordinator === coordinator) { parked.at = now(); return; }
      if (parked) drop();
      if (disposed || !coordinator.detach()) { coordinator.retire(); return; }
      parked = { key, source, coordinator, at: now() };
    },
    /** What a screen that is mounting may show at once: the parked coordinator of the same account key and source, inside the window, whose picture is still warm for `view`. A pure read. */
    candidate(key: string, source: object, view: MarketplaceView): { coordinator: C; ageMs: number } | null {
      if (!parked || parked.key !== key || parked.source !== source) return null;
      const ageMs = now() - parked.at;
      if (ageMs < 0 || ageMs > DISCOVERY_V1_WARM_RETURN_MS || !parked.coordinator.warm(view)) return null;
      return { coordinator: parked.coordinator, ageMs };
    },
    /** The mounting screen has taken the coordinator over: it is no longer the holder's. */
    claim(coordinator: C) { if (parked?.coordinator === coordinator) parked = null; },
    /** A mounting screen that does not reuse the parked coordinator: retire it (unless it is the one about to be taken). */
    discard(keep: C | null = null) { if (parked && parked.coordinator !== keep) drop(); },
    /** The route is going away: nothing is kept, now or later. */
    dispose() { disposed = true; drop(); },
    /** A route that is mounted again (development double-mount) can keep once more. */
    reopen() { disposed = false; },
  };
}

export type DiscoveryV1WarmReturn<C extends DiscoveryV1Keepable = DiscoveryV1Keepable> = ReturnType<typeof createDiscoveryV1WarmReturn<C>>;
