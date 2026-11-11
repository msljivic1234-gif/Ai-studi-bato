import { useLocalSearchParams } from 'expo-router';
import { AgreementActionsScreen } from '../../../ui/agreements/AgreementActionsScreen';
import { useSesija } from '../../../store/sesija';

export default function AgreementChangesRoute() {
  const params = useLocalSearchParams<{ id?: string | string[]; start?: string | string[] }>(), session = useSesija();
  const id = typeof params.id === 'string' ? params.id : '';
  // The rows of the Dogovor ("Izmeni uslove", "Otkaži Dogovor") and the conversation's menu open the form they name; without `start` the hub opens (answering or looking at a proposal).
  const start = params.start === 'cancel' ? 'CANCEL' : params.start === 'propose' ? 'PROPOSE' : undefined;
  return <AgreementActionsScreen key={`${session.user?.id ?? ''}:${session.accountRevision}:${id}`} agreementId={id} start={start} />;
}
