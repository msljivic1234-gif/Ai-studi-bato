import { sesijaSada } from '../store/sesija';
import { uuid, type ReceiptAccount } from './serverReceipt';

type IntakeParams = Readonly<{ conversationId?: string; entryKey?: string }>;
/** Only route identity is retained. The draft and reading position stay in their mounted intake. */
export type IntakeReviewReturn = Readonly<ReceiptAccount & {
  token: string; conversationId: string; params: IntakeParams;
}>;
let sequence = 0;
let latest: IntakeReviewReturn | null = null;

/** A URL alone cannot claim a retained intake. Its current mounted owner creates this on Review. */
export function rememberIntakeReviewReturn(owner: ReceiptAccount, conversationId: string,
  params: IntakeParams): IntakeReviewReturn | null {
  const session = sesijaSada();
  if (session.user?.id !== owner.accountId || session.accountRevision !== owner.accountRevision
    || !uuid(conversationId) || (params.conversationId !== undefined && params.conversationId !== conversationId)
    || (params.entryKey !== undefined && !uuid(params.entryKey))) return null;
  latest = Object.freeze({ ...owner, conversationId, token: `intake-review-${++sequence}`,
    params: Object.freeze({ ...params }) });
  return latest;
}

/** Account revision rejects A→B→A; a new review visit or intake unmount retires the old token. */
export function readIntakeReviewReturn(token: unknown, conversationId: string): IntakeReviewReturn | null {
  const session = sesijaSada();
  return latest && token === latest.token && conversationId === latest.conversationId
    && session.user?.id === latest.accountId && session.accountRevision === latest.accountRevision ? latest : null;
}

export function retireIntakeReviewReturn(handoff: IntakeReviewReturn | null): void {
  if (latest === handoff) latest = null;
}
