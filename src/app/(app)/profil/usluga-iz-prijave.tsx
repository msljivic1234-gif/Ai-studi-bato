import { useCallback } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import type { RadnikProfilProjekcija } from '../../../contracts/projections';
import type { Ishod } from '../../../data/ports';
import { failure, uuid } from '../../../data/serverReceipt';
import { useOwnedEditor } from '../../../hooks/useOwnedEditor';
import { useSesija } from '../../../store/sesija';
import { useIzvor } from '../../../store/uloga';
import { ProductHeader } from '../../../ui/product/ProductDetails';
import { Screen } from '../../../ui/system/Screen';
import { StateView } from '../../../ui/system/StateView';
import { QuietReadState } from '../../../ui/v2/QuietReadState';
import { ApplicationServiceOffer } from '../../../ui/workerProfile/ApplicationServiceOffer';

/** Re-entry from an owned application. Opening this page never saves a profile. */
export default function UslugaIzPrijave() {
  const params = useLocalSearchParams<{ applicationId?: string; needId?: string }>();
  const applicationId = typeof params.applicationId === 'string' ? params.applicationId : '';
  const needId = typeof params.needId === 'string' ? params.needId : '';
  const source = useIzvor(), router = useRouter();
  const { user, accountRevision } = useSesija();
  const read = useCallback(async (): Promise<Ishod<RadnikProfilProjekcija>> => {
    if (!uuid(applicationId) || !uuid(needId)) return failure('APPLICATION_SERVICE_INPUT_INVALID', 'Ponovo otvorite svoju prijavu.');
    const profile = await source.mojRadnikProfil();
    return profile ? { ok: true, podatak: profile } : failure('WORKER_PROFILE_REQUIRED', 'Radni profil nije dostupan.');
  }, [source, applicationId, needId]);
  const editor = useOwnedEditor(read);
  const back = () => { if (router.canGoBack()) router.back(); else router.replace('/moje-prijave'); };
  return <Screen kind="flow" header={<ProductHeader title="Usluga u profilu" backLabel="Nazad na prijave" back={back} />}>
    {editor.loading ? <QuietReadState art="applications" title="Učitavamo radni profil…" body="Pripremamo dopunu na osnovu Vaše prijave." />
      : editor.data && user?.id ? <ApplicationServiceOffer key={`${user.id}:${accountRevision}:${applicationId}`}
        input={{ accountId: user.id, accountRevision, applicationId, needId, profileId: editor.data.id }}
        openProfile={() => router.push('/profil/radnik')} />
      : <StateView kind="error" title={editor.error ?? 'Podaci nisu dostupni.'}
        primary={{ label: 'Pokušajte ponovo', onPress: () => void editor.refresh() }} />}
  </Screen>;
}
