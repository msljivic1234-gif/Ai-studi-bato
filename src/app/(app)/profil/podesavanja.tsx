import { useCallback, useRef, useState } from 'react';
import { router, useFocusEffect } from 'expo-router';
import { sesijaSada, useSesija } from '../../../store/sesija';
import { authClientService } from '../../../data/authClientService';
import { readBuildIdentity } from '../../../data/buildIdentity';
import { hubWords, versionWord } from '../../../ui/profile/hubStates';
import { useHubStates, type HubStateKey } from '../../../ui/profile/useHubStates';
import type { ProfileHubPath } from '../../../ui/profile/ProfileHubPresentation';
import { AccountSettings } from '../../../ui/settings/AccountSettingsPresentation';
import { useConfirmSheet } from '../../../ui/system/ConfirmSheet';

const STATE_ROWS: readonly HubStateKey[] = ['support', 'legal'];
type Visit = { accountId: string; revision: number; busy: boolean };

/** Separate settings destination, with the same account/focus/single-flight protection as the profile. */
export default function Podesavanja() {
  const { user, accountRevision } = useSesija();
  const accountId = user?.id;
  const current = useRef<Visit | null>(null);
  const logoutQuestion = useRef<Visit | null>(null);
  const [visit, setVisit] = useState<Visit | null>(null);
  const [busy, setBusy] = useState(false), [logoutError, setLogoutError] = useState(false);
  const confirmation = useConfirmSheet(), retireConfirmation = confirmation.close;
  const words = hubWords(useHubStates(STATE_ROWS));
  useFocusEffect(useCallback(() => {
    const scope = accountId ? { accountId, revision: accountRevision, busy: false } : null;
    current.current = scope; setVisit(scope); setBusy(false); setLogoutError(false);
    return () => { if (current.current === scope) current.current = null;
      if (logoutQuestion.current === scope) logoutQuestion.current = null; retireConfirmation(); };
  }, [accountId, accountRevision, retireConfirmation]));
  const owns = (scope: Visit) => current.current === scope && sesijaSada().user?.id === scope.accountId
    && sesijaSada().accountRevision === scope.revision;
  const begin = () => {
    if (!visit || visit.busy || logoutQuestion.current || !owns(visit)) return null;
    visit.busy = true; setBusy(true); return visit;
  };
  const navigate = (action: () => void) => { if (begin()) action(); };
  const logout = async () => {
    const scope = begin(); if (!scope) return;
    setLogoutError(false);
    try { await authClientService.signOutLocal({ accountId: scope.accountId, accountRevision: scope.revision }); }
    catch { if (owns(scope)) setLogoutError(true); }
    finally { if (owns(scope)) { scope.busy = false; setBusy(false); } }
  };
  const askLogout = () => {
    if (!visit || visit.busy || logoutQuestion.current || !owns(visit)) return;
    const scope = visit; logoutQuestion.current = scope;
    confirmation.ask({ title: 'Odjaviti se?',
      message: 'Ako se odjavite, neposlate poruke u Dogovorima i lokalni glasovni snimci možda više neće biti dostupni na ovom uređaju.',
      confirmLabel: 'Odjavi se', cancelLabel: 'Ostani prijavljen', tone: 'danger',
      onCancel: () => { if (logoutQuestion.current === scope) logoutQuestion.current = null; },
      onConfirm: () => { if (logoutQuestion.current !== scope || !owns(scope)) return;
        logoutQuestion.current = null; return logout(); },
    });
  };
  return <><AccountSettings email={user?.email} busy={busy} logoutError={logoutError} words={words}
    version={versionWord(readBuildIdentity().version)}
    open={(path: ProfileHubPath) => navigate(() => router.navigate(path))}
    onBack={() => navigate(() => router.canGoBack() ? router.back() : router.replace('/profil'))}
    onLogout={askLogout} />{confirmation.sheet}</>;
}
