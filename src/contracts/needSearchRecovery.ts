/** EX-06E R3 wire contract. Server facts only; never a second task state machine. */
export const SEARCH_REASONS = ['ACCOUNT_CLOSING', 'TASK_NOT_OPEN', 'NO_MISSING_CAPACITY', 'SEARCH_WINDOW_CLOSED',
  'SEARCH_ALREADY_OPEN', 'TASK_NOT_REOPENABLE', 'CAN_REOPEN'] as const;
export const SEARCH_NEXT_ACTIONS = ['REVIEW_ACCOUNT', 'VIEW_TASK_HISTORY', 'OPEN_AGREEMENTS', 'REOPEN_SEARCH',
  'REVIEW_TASK_TIME', 'REVIEW_TASK', 'SEARCH_IN_PROGRESS', 'VIEW_TASK'] as const;
export const SEARCH_NEED_STATUSES = ['DRAFT', 'PUBLISHED', 'SELECTION', 'ACTIVE', 'COMPLETED', 'CANCELLED', 'EXPIRED'] as const;

export type NeedSearchState = {
  schemaVersion: 1;
  authoritative: true;
  serverAsOf: string;
  needId: string;
  revision: number;
  status: typeof SEARCH_NEED_STATUSES[number];
  requiredSlots: number;
  coveredSlots: number;
  missingSlots: number;
  searchAuthority: 'OPEN' | 'CLOSED';
  closedAt: string | null;
  searchTimeAdmitted: boolean;
  canReopen: boolean;
  reason: typeof SEARCH_REASONS[number];
  nextAction: typeof SEARCH_NEXT_ACTIONS[number];
  agreementCount: number;
  activeAgreementCount: number;
  awaitingConfirmationCount: number;
  openProblemCount: number;
};

export type ReopenSearchCommand = Readonly<{
  needId: string;
  revision: number;
  closedAt: string;
  clientRequestId: string;
  reason: string;
}>;

export type ReopenSearchReceipt = {
  command: 'REOPEN_REMAINING_SEARCH_V1';
  authoritative: true;
  needId: string;
  revision: number;
  observedClosedAt: string;
  remainingSearchClosed: false;
  reopenedAt: string;
  requiredSlots: number;
  selectedSlots: number;
  reopenedRemainingSlots: number;
  idempotentReplay: boolean;
};

export type ReopenSearchReadback =
  | { state: 'NOT_CONFIRMED' }
  | { state: 'CONFIRMED'; receipt: ReopenSearchReceipt };
