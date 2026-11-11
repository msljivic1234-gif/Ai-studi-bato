/** Requester-side terminal commands on a Zadatak, as the server receipts them. */

export type NeedCancellationReceipt = {
  needId: string;
  status: 'CANCELLED';
  revision: number;
  /** Prijave the server expired as a consequence; 0 on replay. */
  affectedResponses: number;
  idempotentReplay: boolean;
};

export type DraftDeletionReceipt = {
  needId: string;
  revision: number;
  deleted: true;
  idempotentReplay: boolean;
};

/** One immutable terminal command. Retrying must retain all original arguments. */
export type NeedLifecycleCommand = Readonly<{
  action: 'CANCEL' | 'DELETE_DRAFT';
  needId: string;
  expectedRevision: number;
  reason: string;
}>;
export type NeedLifecycleConfirmation =
  | { action: 'CANCEL'; receipt: NeedCancellationReceipt }
  | { action: 'DELETE_DRAFT'; receipt: DraftDeletionReceipt };
export type NeedLifecycleReadback =
  | { state: 'CONFIRMED'; confirmation: NeedLifecycleConfirmation }
  | { state: 'NOT_CONFIRMED' };
