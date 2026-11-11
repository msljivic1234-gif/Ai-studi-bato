import { router, useLocalSearchParams } from 'expo-router';
import { safetyTargetNameBuilt } from '../../data/safetyTargetNameGate';
import { uuid } from '../../data/serverReceipt';
import { useSesija } from '../../store/sesija';

import { SafetyScreen } from '../../ui/safety/SafetyScreen';
import { SettingsScreen } from '../../ui/settings/SettingsPresentation';
import { StateView } from '../../ui/system/StateView';

export default function SafetyRoute() {
  const p = useLocalSearchParams<{ targetAccountId?: string; needId?: string; agreementId?: string; profileId?: string }>();
  const { user, accountRevision } = useSesija();
  // Your own account is a person, just not one this screen acts on: "Nije izabrana osoba" was not what happened there.
  const own = !!user?.id && p.targetAccountId === user.id;
  if (!uuid(p.targetAccountId) || own || (p.needId !== undefined && !uuid(p.needId)) ||
      (p.agreementId !== undefined && !uuid(p.agreementId))) return <SettingsScreen title="Bezbednost"
        onBack={() => router.canGoBack() ? router.back() : router.replace('/profil')}>
        {/* Reached with no usable target (a stale link, a hand-typed route, your own account): say what opens it and
            where, and offer the one place on this side of the app where the people you block are. */}
        <StateView kind="empty" art="shield" title={own ? 'Ovo je Vaš nalog' : 'Nije izabrana osoba'}
          body={own ? 'Prijavu i blokiranje pokrećete sa profila druge osobe, iz zadatka ili iz Dogovora.'
            : 'Prijavu ili blokiranje pokrećete sa profila osobe, iz zadatka ili iz Dogovora.'}
          quiet={{ label: 'Blokirane osobe', onPress: () => router.replace('/profil/blokirani') }} />
      </SettingsScreen>;
  // EX-07 S06: a build compiled with the safety-target-name flag hands the screen the PROFILE the person came from, when it is an identifier, so that the screen can ask the server for
  // the name of that profile. It is an identifier and never a name; one that is not an identifier is ignored and never stops the screen from opening.
  const profileId = safetyTargetNameBuilt() && uuid(p.profileId) ? p.profileId : undefined;
  return <SafetyScreen key={`${user?.id}:${accountRevision}:${p.targetAccountId}:${p.needId ?? ''}:${p.agreementId ?? ''}`}
    targetAccountId={p.targetAccountId} needId={p.needId ?? null} agreementId={p.agreementId ?? null} {...(profileId ? { profileId } : {})} />;
}
