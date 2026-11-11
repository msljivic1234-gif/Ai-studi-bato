import { useMemo } from 'react';
import { useSesija } from '../../../store/sesija';
import { bugReportPreset } from '../../../ui/support/bugReportPreset';
import { SupportNewScreen } from '../../../ui/support/SupportNewScreen';

/**
 * Prijavi grešku u aplikaciji (R23): the new-request screen of support, opened as a request for technical help that already names the
 * version of the app. It is the same screen, the same private request and the same send; only its first words are written for the person.
 */
export default function PrijavaGreske() {
  const session = useSesija();
  const preset = useMemo(() => bugReportPreset(), []);
  return <SupportNewScreen key={`${session.user?.id}:${session.accountRevision}:BUG`} reference={null} preset={preset} />;
}
