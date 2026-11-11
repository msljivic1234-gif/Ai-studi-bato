import { useEffect, useState } from 'react';
import { workTrustClientService, type PublicWorkTrust } from '../../data/workTrustClientService';
import { useSesija } from '../../store/sesija';

/**
 * The trust block of one worker profile for `PublicProfileSheet` (`trust`), read when the sheet has a profile to show (PROFILE-TRUST,
 * R30). It answers `null` while it reads, when it failed, and when the server says there is nothing here: the facts of the trust block are
 * optional, so none of those is a state a screen draws or reports, and the public profile never waits for them. What was read for another
 * account or another profile is never returned. Pass `null` (no profile, or a profile that is not a worker's) to read nothing.
 */
export function usePublicWorkTrust(profileId: string | null | undefined): PublicWorkTrust | null {
  const { user, accountRevision } = useSesija();
  const accountId = user?.id ?? null;
  const key = accountId && profileId ? `${accountId}:${accountRevision}:${profileId}` : null;
  const [held, setHeld] = useState<{ key: string; trust: PublicWorkTrust | null } | null>(null);
  useEffect(() => {
    if (!key || !accountId || !profileId) return undefined;
    let live = true;
    void (async () => {
      const result = await workTrustClientService.publicTrust(profileId, { accountId, accountRevision }).catch(() => null);
      if (live) setHeld({ key, trust: result && result.ok ? result.podatak.trust : null });
    })();
    return () => { live = false; };
  }, [key, accountId, accountRevision, profileId]);
  return key && held?.key === key ? held.trust : null;
}
