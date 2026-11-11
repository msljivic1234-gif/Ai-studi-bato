import { router, useLocalSearchParams } from 'expo-router';
import { uuid } from '../../../data/serverReceipt';
import { useSesija } from '../../../store/sesija';

import { SupportDetailScreen } from '../../../ui/support/SupportDetailScreen';
import { StateView } from '../../../ui/system/StateView';
import { SupportFrame } from '../../../ui/support/SupportPresentation';

export default function SupportDetailRoute() {
  const { id } = useLocalSearchParams<{ id?: string | string[] }>(), session = useSesija();
  if (!uuid(id) || id !== id.toLowerCase()) return <SupportFrame title="Podrška" onBack={() => router.canGoBack() ? router.back() : router.replace('/podrska')}>
    <StateView kind="error" art="chat" title="Zahtev nije prepoznat." body="Otvori ga iz svoje liste podrške."
      primary={{ label: 'Otvori podršku', onPress: () => router.replace('/podrska') }} />
  </SupportFrame>;
  return <SupportDetailScreen key={`${session.user?.id}:${session.accountRevision}:${id}`} caseId={id} />;
}
