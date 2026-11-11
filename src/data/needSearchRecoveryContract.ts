import { calendarInstant } from '../lib/calendarTime';
import { SEARCH_NEED_STATUSES, SEARCH_NEXT_ACTIONS, SEARCH_REASONS, type NeedSearchState, type ReopenSearchCommand,
  type ReopenSearchReceipt, type ReopenSearchReadback } from '../contracts/needSearchRecovery';

const object = (value: unknown): Record<string, unknown> | null =>
  value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
const id = (value: unknown): value is string => typeof value === 'string' && /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(value);
const count = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 && value <= 2_147_483_647;
const positive = (value: unknown): value is number => count(value) && value > 0;
const instant = (value: unknown): value is string => typeof value === 'string' && calendarInstant(value) !== null;
const sameId = (value: unknown, expected: string): value is string => id(value) && value.toLowerCase() === expected.toLowerCase();
const includes = (items: readonly string[], value: unknown): value is string => typeof value === 'string' && items.includes(value);

/** Same instant, without rounding the exact server closure witness kept in the command. */
export const sameClosure = (a: string | null, b: string | null) =>
  a !== null && b !== null && instant(a) && instant(b) && calendarInstant(a) === calendarInstant(b);

export function decodeNeedSearchState(raw: unknown, needId: string): NeedSearchState | null {
  const value = object(raw);
  if (!value || !id(needId) || value.schemaVersion !== 1 || value.authoritative !== true || !sameId(value.needId, needId)
    || !positive(value.revision) || !instant(value.serverAsOf) || !includes(SEARCH_NEED_STATUSES, value.status)
    || !positive(value.requiredSlots) || !count(value.coveredSlots) || !count(value.missingSlots)
    || value.coveredSlots > value.requiredSlots || value.missingSlots !== value.requiredSlots - value.coveredSlots
    || !includes(['OPEN', 'CLOSED'], value.searchAuthority)
    || (value.searchAuthority === 'OPEN' ? value.closedAt !== null : !instant(value.closedAt))
    || typeof value.searchTimeAdmitted !== 'boolean' || typeof value.canReopen !== 'boolean'
    || !includes(SEARCH_REASONS, value.reason) || !includes(SEARCH_NEXT_ACTIONS, value.nextAction)
    || !count(value.agreementCount) || !count(value.activeAgreementCount) || !count(value.awaitingConfirmationCount)
    || !count(value.openProblemCount) || value.activeAgreementCount > value.agreementCount
    || value.awaitingConfirmationCount > value.activeAgreementCount || value.openProblemCount > value.activeAgreementCount) return null;

  if (value.canReopen !== (value.reason === 'CAN_REOPEN')) return null;
  if (value.canReopen && (value.searchAuthority !== 'CLOSED' || !value.searchTimeAdmitted || value.missingSlots < 1
    || !['PUBLISHED', 'SELECTION'].includes(value.status))) return null;
  if (value.nextAction === 'REOPEN_SEARCH' && !value.canReopen) return null;
  return value as NeedSearchState;
}

export function validReopenSearchCommand(raw: unknown, needId?: string): raw is ReopenSearchCommand {
  const value = object(raw);
  return !!value && Object.keys(value).every(key => ['needId', 'revision', 'closedAt', 'clientRequestId', 'reason'].includes(key))
    && id(value.needId) && (needId === undefined || sameId(value.needId, needId)) && positive(value.revision) && instant(value.closedAt)
    && typeof value.clientRequestId === 'string' && /^[A-Za-z0-9][A-Za-z0-9_.:-]{7,192}$/.test(value.clientRequestId)
    && typeof value.reason === 'string' && value.reason === value.reason.trim() && Array.from(value.reason).length <= 500;
}

export function reopenSearchArgs(command: ReopenSearchCommand): Record<string, unknown> {
  return {
    p_need_id: command.needId,
    p_expected_revision: command.revision,
    p_expected_closed_at: command.closedAt,
    p_client_request_id: command.clientRequestId,
    p_reason: command.reason,
  };
}

export function decodeReopenSearchReceipt(raw: unknown, command: ReopenSearchCommand): ReopenSearchReceipt | null {
  const value = object(raw);
  if (!validReopenSearchCommand(command) || !value || value.command !== 'REOPEN_REMAINING_SEARCH_V1' || value.authoritative !== true
    || !sameId(value.needId, command.needId) || value.revision !== command.revision || !instant(value.observedClosedAt)
    || !sameClosure(value.observedClosedAt, command.closedAt) || value.remainingSearchClosed !== false || !instant(value.reopenedAt)
    || !positive(value.requiredSlots) || !count(value.selectedSlots) || !positive(value.reopenedRemainingSlots)
    || value.selectedSlots + value.reopenedRemainingSlots !== value.requiredSlots || typeof value.idempotentReplay !== 'boolean') return null;
  return value as ReopenSearchReceipt;
}

export function decodeReopenSearchReadback(raw: unknown, command: ReopenSearchCommand): ReopenSearchReadback | null {
  const value = object(raw);
  if (!validReopenSearchCommand(command) || !value || value.command !== 'REOPEN_REMAINING_SEARCH_V1'
    || value.authoritative !== true || !sameId(value.needId, command.needId)) return null;
  if (value.state === 'NOT_CONFIRMED') return value.receipt === null ? { state: 'NOT_CONFIRMED' } : null;
  if (value.state !== 'CONFIRMED') return null;
  const receipt = decodeReopenSearchReceipt(value.receipt, command);
  return receipt?.idempotentReplay === true ? { state: 'CONFIRMED', receipt } : null;
}
