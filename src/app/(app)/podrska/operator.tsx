import { useState } from 'react';
import { useSesija } from '../../../store/sesija';

import { SupportInboxScreen } from '../../../ui/support/SupportInboxScreen';

function OperatorScope() {
  const [mode, setMode] = useState<'OPERATOR' | 'SAFETY'>('OPERATOR');
  return <SupportInboxScreen key={mode} mode={mode} onMode={setMode} />;
}
export default function SupportOperatorRoute() {
  const session = useSesija();
  return <OperatorScope key={`${session.user?.id}:${session.accountRevision}`} />;
}
