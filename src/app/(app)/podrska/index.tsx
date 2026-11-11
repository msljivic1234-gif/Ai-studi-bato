import { useSesija } from '../../../store/sesija';

import { SupportInboxScreen } from '../../../ui/support/SupportInboxScreen';

export default function SupportRoute() {
  const session = useSesija();
  return <SupportInboxScreen key={`${session.user?.id}:${session.accountRevision}`} />;
}
