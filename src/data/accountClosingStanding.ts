import type { Ishod } from './ports';
import type { ReceiptAccount } from './serverReceipt';
import { accountClosureClientService } from './accountClosureClientService';
import { closureExecutionClientService, type ClosureExecutionState } from './closureExecutionClientService';

/** Whether the signed-in account is in its closing stage, and, when this device started that closing, how far it has got. */
export type AccountClosingStanding =
  | { closing: false }
  | { closing: true; execution: ClosureExecutionState | null };

/**
 * Read-only, through the two existing closure reads and no new server contract.
 *
 * Once an account's closure is READY, EXECUTING, FAILED or CLOSED (private.closure_account_restricted), the Data API's
 * pre-request guard (public.rpc_closure_api_guard) refuses every call of that account with ACCOUNT_CLOSING, except the
 * closure execution read and start and private support. So the restriction is not a field anyone reads; it is the guard's
 * answer:
 *  1. the existing closure status read (rpc_get_account_closure) answers an open account, and is refused with
 *     ACCOUNT_CLOSING for a closing one. Any other failure (offline, a timeout, an unexpected answer) is returned as it is,
 *     and says nothing about closing;
 *  2. for a closing account, the execution read (rpc_read_account_closure_execution, which the guard admits) needs the
 *     start command's own client request id, which only the device that started the closing keeps in its closure journal.
 *     Without it the stage is known and its progress is not, and nothing is guessed.
 */
export async function readAccountClosingStanding(
  owner: ReceiptAccount,
  savedStartRequestId: () => Promise<string | null>,
): Promise<Ishod<AccountClosingStanding>> {
  const status = await accountClosureClientService.read(owner);
  if (status.ok) return { ok: true, podatak: { closing: false } };
  if (status.kod !== 'ACCOUNT_CLOSING') return status;
  let requestId: string | null = null;
  try { requestId = await savedStartRequestId(); } catch { requestId = null; }
  if (!requestId) return { ok: true, podatak: { closing: true, execution: null } };
  const read = await closureExecutionClientService.read(requestId, owner);
  return { ok: true, podatak: { closing: true, execution: read.ok && read.podatak.found ? read.podatak.execution : null } };
}
