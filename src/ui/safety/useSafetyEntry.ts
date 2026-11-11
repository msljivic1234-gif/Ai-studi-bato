import { useCallback, useRef, useState } from 'react';
import { router, useFocusEffect } from 'expo-router';
import { safetyClientService } from '../../data/safetyClientService';
import { safetyTargetNameBuilt } from '../../data/safetyTargetNameGate';
import type { SafetyEntry } from '../system/PublicProfileSheet';

/**
 * PKG-047 (F05). A profile is one of the faces a person can show; report and block follow the person.
 * A screen that knows only a profile therefore asks the server for the safety target first, and says
 * plainly when there is none instead of opening a screen that cannot act. The context it carries is the
 * Zadatak or Dogovor the two people actually met in, which the report itself validates again.
 */
export function useSafetyEntry(profileId: string | null | undefined,
  context?: { needId?: string | null; agreementId?: string | null }): SafetyEntry | undefined {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const needId = context?.needId ?? null, agreementId = context?.agreementId ?? null;
  const scope = useRef<{ profileId: typeof profileId; needId: string | null; agreementId: string | null; pending: boolean } | null>(null);
  const rendered = useRef({ profileId, needId, agreementId });
  rendered.current = { profileId, needId, agreementId };
  useFocusEffect(useCallback(() => {
    const next = { profileId, needId, agreementId, pending: false };
    scope.current = next; setBusy(false); setError(null);
    return () => { if (scope.current === next) scope.current = null; };
  }, [profileId, needId, agreementId]));
  const onPress = useCallback(() => {
    const owner = scope.current;
    if (!profileId || !owner || owner.pending || owner.profileId !== profileId
      || owner.needId !== needId || owner.agreementId !== agreementId) return;
    // The service owns account/target authority; this scope owns only the screen's
    // intent. Returning to the same screen cannot revive a lookup from before blur.
    const current = () => scope.current === owner && rendered.current.profileId === profileId
      && rendered.current.needId === needId && rendered.current.agreementId === agreementId;
    owner.pending = true; setBusy(true); setError(null);
    const settle = () => { owner.pending = false; setBusy(false); };
    void safetyClientService.readTarget(profileId).then(result => {
      if (!current()) return;
      settle();
      if (!result.ok) { setError(result.poruka); return; }
      const target = result.podatak.available ? result.podatak.target : null;
      if (!target) { setError('Osoba trenutno nije dostupna.'); return; }
      // EX-07 S06: a build compiled with the safety-target-name flag hands on the PROFILE this was opened from (an identifier), so the safety screen can ask the server for
      // the name of that very profile. The name itself never travels in a route.
      router.navigate({ pathname: '/bezbednost', params: { targetAccountId: target.targetAccountId,
        ...(safetyTargetNameBuilt() ? { profileId } : {}),
        ...(needId ? { needId } : {}), ...(agreementId ? { agreementId } : {}) } });
    }, () => { if (!current()) return; settle(); setError('Ne možemo da otvorimo Bezbednost. Pokušaj ponovo.'); });
  }, [profileId, needId, agreementId]);
  return profileId ? { onPress, busy, error } : undefined;
}
