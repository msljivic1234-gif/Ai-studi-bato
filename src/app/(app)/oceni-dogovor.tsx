import { useCallback, type ReactNode } from 'react';
import { useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSesija } from '../../store/sesija';
import { useIzvor } from '../../store/uloga';
import { uuid } from '../../data/serverReceipt';
import { ProfilePhoto } from '../../ui/media/ContextPhotos';
import { AgreementReviewScreen, backFromReview, backFromReviewToAgreement, backFromReviewToHome } from '../../ui/reviews/AgreementReviewScreen';
import { agreementRole } from '../../ui/v2/AgreementPresentation';
import { DetailTopBar } from '../../ui/system/DetailTopBar';
import { StateView } from '../../ui/system/StateView';
import { sys } from '../../ui/system/tokens';

export default function OceniDogovor() {
  const { agreementId, from } = useLocalSearchParams<{ agreementId: string | string[]; from?: string | string[] }>();
  const session = useSesija();
  const izvor = useIzvor();
  // Opened from Početna's rating strip, Back returns to Početna and its button says so; from the Dogovori list's strip it
  // returns to the list and says so (round 4 review rd item 1: it said "Nazad na Dogovor" there); from a Dogovor it says
  // Dogovor.
  const fromHome = from === 'pocetna', fromList = from === 'dogovori';
  // The fallback below names the same way back as the screen does (verify r4c: it always said "Nazad na Dogovore").
  const backLabel = fromHome ? 'Nazad na Početnu' : fromList ? 'Nazad na Dogovore' : 'Nazad na Dogovor';
  const id = typeof agreementId === 'string' ? agreementId : null;
  // "Nazad na Dogovor" lands on that Dogovor even when the rating was opened cold (no history to go back through).
  const fallbackBack = fromHome ? backFromReviewToHome : backFromReview;
  const onBack = fromHome || fromList || !id ? fallbackBack : () => backFromReviewToAgreement(id);
  // The Dogovor is read only to show whom the rating is about; the rating itself reads and writes through its own service.
  const readAgreement = useCallback(() => id ? izvor.dogovor(id) : Promise.resolve(null), [izvor, id]);
  // The rating screen draws the face at its own size (72 since the owner's pick of 8 Oct 2026); 56 stays the fallback for other callers.
  const photo = useCallback((profileId: string, fallback: ReactNode, size = 56) => <ProfilePhoto profileId={profileId} size={size} fallback={fallback} />, []);
  if (!uuid(agreementId) || !session.user) return <SafeAreaView edges={['top', 'bottom']} style={{ flex: 1, backgroundColor: sys.color.ground }}>
    {/* Without a session or a valid id there is no Dogovor to open: back through history, or to the list. */}
    <DetailTopBar title="Ocena saradnje" backLabel={backLabel} onBack={fallbackBack} />
    <View style={{ paddingHorizontal: sys.space.lg }}>
      <StateView kind="error" art="star" title="Ocena nije dostupna" body="Otvori završeni Dogovor iz svog naloga."
        primary={{ label: backLabel, onPress: fallbackBack }} />
    </View>
  </SafeAreaView>;
  return <AgreementReviewScreen key={`${session.user.id}:${session.accountRevision}:${agreementId}`}
    agreementId={agreementId} accountId={session.user.id} accountRevision={session.accountRevision}
    backLabel={backLabel} onBack={onBack} readAgreement={readAgreement} photo={photo} roleOf={agreementRole} />;
}
