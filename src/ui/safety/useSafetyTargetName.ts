import { useEffect, useState } from 'react';
import { safetyClientService } from '../../data/safetyClientService';
import { sameId } from '../../data/serverReceipt';
import { useSesija } from '../../store/sesija';

/**
 * EX-07 S06. The displayed name of the person a safety screen is about, read from the SERVER result of rpc_read_safety_target for the PROFILE the person came from
 * (the face the caller was looking at, never another face of the same person), and bound to the target account the route names: a result whose target is another
 * account than the one on screen gives no name. It is never taken from a route, never logged, never stored and never a condition of a safety action: a name that is
 * missing, blank, refused or late is simply `null`, and the screen keeps its generic copy. A result that lands after the account, the profile or the target changed,
 * or after the screen is gone, is dropped.
 */
export function useSafetyTargetName(profileId: string | null, targetAccountId: string): string | null {
  const { user, accountRevision } = useSesija();
  const accountId = user?.id;
  const [name, setName] = useState<string | null>(null);
  useEffect(() => {
    let current = true;
    setName(null);
    // No profile to ask about (a screen reached from a Dogovor, from the blocked list, or built without the flag): nothing is read.
    if (accountId && profileId) {
      void safetyClientService.readTarget(profileId).then(result => {
        if (!current || !result.ok) return;
        const state = result.podatak;
        if (state.available && state.target && sameId(state.target.targetAccountId, targetAccountId)) setName(state.displayName ?? null);
      }, () => {});
    }
    return () => { current = false; };
  }, [profileId, targetAccountId, accountId, accountRevision]);
  return name;
}
