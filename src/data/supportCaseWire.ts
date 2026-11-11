import { positiveInteger, record, sameId, uuid } from './serverReceipt';
import type { SupportReference } from './supportCaseTypes';
export const supportKeys = (r: Record<string, unknown>, names: readonly string[]) =>
  Object.keys(r).length === names.length && names.every(k => Object.hasOwn(r, k));
export const supportSequence = (s: unknown, zero = false): s is string => typeof s === 'string'
  && (zero ? /^(0|[1-9][0-9]{0,15})$/ : /^[1-9][0-9]{0,15}$/).test(s) && Number(s) <= Number.MAX_SAFE_INTEGER;
export const supportUuid = (v: unknown): v is string => uuid(v) && v === v.toLowerCase();
export function supportEnvelope(r: Record<string, unknown> | null, accountId: string): r is Record<string, unknown> {
  return !!r && sameId(r.accountId, accountId) && r.authoritative === true;
}
export function decodeSupportReference(raw: unknown): SupportReference | null {
  const r = record(raw);
  if (!r || !supportKeys(r, ['kind', 'id', 'revision']) || !supportUuid(r.id)) return null;
  if (['TASK', 'AGREEMENT', 'AGREEMENT_MESSAGE'].includes(r.kind as string) ? !positiveInteger(r.revision)
    : !['GROUP_MESSAGE', 'TASK_REVIEW', 'SAFETY_REPORT'].includes(r.kind as string) || r.revision !== null) return null;
  return r as SupportReference;
}
