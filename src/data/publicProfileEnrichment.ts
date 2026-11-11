import type { JavniProfilProjekcija } from '../contracts/projections';

export const PUBLIC_PROFILE_CONCURRENCY = 4;
export const PUBLIC_PROFILE_BUDGET_MS = 4000;

/** Optional, validated public metadata; unavailable authors never remove public tasks. */
export async function enrichPublicProfiles(
  profileIds: readonly (string | null | undefined)[],
  read: (id: string, signal: AbortSignal) => Promise<JavniProfilProjekcija | null>,
  isCurrent: () => boolean,
  signal?: AbortSignal,
): Promise<Map<string, JavniProfilProjekcija | null>> {
  const ids = [...new Set(profileIds.filter((id): id is string => typeof id === 'string' && id.length > 0))];
  const profiles = new Map<string, JavniProfilProjekcija | null>();
  if (!ids.length || !isCurrent() || signal?.aborted) return profiles;

  const abort = new AbortController();
  const deadline = Date.now() + PUBLIC_PROFILE_BUDGET_MS;
  let next = 0;
  let stopped = false;
  let retire!: () => void;
  const boundary = new Promise<void>(resolve => { retire = resolve; });
  const stop = () => {
    if (stopped) return;
    stopped = true;
    abort.abort();
    retire();
  };
  const active = () => {
    if (signal?.aborted || !isCurrent() || Date.now() >= deadline) stop();
    return !stopped;
  };
  const timeout = setTimeout(stop, PUBLIC_PROFILE_BUDGET_MS);
  // A stalled transport must also retire after an A -> B -> A account change.
  const accountWatch = setInterval(() => { if (!isCurrent()) stop(); }, 100);
  signal?.addEventListener('abort', stop, { once: true });
  const worker = async () => {
    while (active() && next < ids.length) {
      const id = ids[next++];
      let profile: JavniProfilProjekcija | null = null;
      try { profile = await read(id, abort.signal); }
      catch { /* The explicit public-profile screen still reports its read failure. */ }
      if (!active()) return;
      profiles.set(id, profile);
    }
  };

  try {
    await Promise.race([
      Promise.all(Array.from({ length: Math.min(PUBLIC_PROFILE_CONCURRENCY, ids.length) }, worker)),
      boundary,
    ]);
    // Return a snapshot: even a transport that ignores abort cannot mutate the result later.
    return !signal?.aborted && isCurrent() ? new Map(profiles) : new Map();
  } finally {
    stop();
    clearTimeout(timeout);
    clearInterval(accountWatch);
    signal?.removeEventListener('abort', stop);
  }
}
