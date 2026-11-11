import type { RetentionExecutionStatus, RetentionPolicyStatus, RetentionRule } from '../contracts/retentionPolicy';
import type { Ishod } from './ports';
import { readReceipt, record, timestamp } from './serverReceipt';

const errors = { AUTH_REQUIRED: 'Prijavi se da vidiš rokove čuvanja podataka.' };
const classCode = (value: unknown): value is string => typeof value === 'string' && /^[A-Z][A-Z0-9_]{2,79}$/.test(value);
const count = (value: unknown): value is number => typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 2_147_483_647;
function text(value: unknown, min: number, max: number): value is string {
  if (typeof value !== 'string') return false;
  const length = [...value.trim()].length;
  return length >= min && length <= max;
}
function classes(value: unknown): string[] | null {
  if (!Array.isArray(value) || !value.every(classCode) || new Set(value).size !== value.length) return null;
  return [...value];
}
function rule(value: unknown): RetentionRule | null {
  const row = record(value);
  if (!row || !classCode(row.dataClass) || !text(row.purpose, 10, 1000) || !text(row.retentionPeriod, 2, 500)
    || !text(row.deletionTrigger, 5, 1000) || !text(row.exceptionRule, 3, 2000) || !text(row.legalBasis, 5, 1000)) return null;
  return { dataClass: row.dataClass, purpose: row.purpose, retentionPeriod: row.retentionPeriod,
    deletionTrigger: row.deletionTrigger, exceptionRule: row.exceptionRule, legalBasis: row.legalBasis };
}

function policyStatus(value: unknown): RetentionPolicyStatus | null {
  const row = record(value);
  if (!row || row.executionAdmitted !== false || !count(row.requiredDataClasses)) return null;
  if (row.ready === false) {
    if (row.reason === 'RETENTION_POLICY_NOT_PUBLISHED' || row.reason === 'RETENTION_POLICY_AMBIGUOUS') {
      if (row.missingDataClasses !== undefined || row.rules !== undefined) return null;
      return { ready: false, reason: row.reason, missingDataClasses: [] };
    }
    if (row.reason !== 'RETENTION_POLICY_INCOMPLETE' || !text(row.policyVersion, 1, 80)
      || !count(row.coveredDataClasses) || row.coveredDataClasses >= row.requiredDataClasses) return null;
    const missing = classes(row.missingDataClasses);
    if (!missing || missing.length !== row.requiredDataClasses - row.coveredDataClasses) return null;
    return { ready: false, reason: row.reason, missingDataClasses: missing };
  }
  if (row.ready !== true || row.reason !== null || !text(row.policyVersion, 1, 80) || !timestamp(row.effectiveAt)
    || !text(row.counselReference, 3, 500) || row.coveredDataClasses !== row.requiredDataClasses
    || !Array.isArray(row.rules) || row.rules.length === 0 || row.rules.length < row.requiredDataClasses) return null;
  const rules: RetentionRule[] = [];
  const seen = new Set<string>();
  for (const raw of row.rules) {
    const parsed = rule(raw);
    // A single invalid/duplicate row invalidates the whole receipt; never filter
    // malformed rules into an apparently complete published schedule.
    if (!parsed || seen.has(parsed.dataClass)) return null;
    rules.push(parsed);
    seen.add(parsed.dataClass);
  }
  return { ready: true, policyVersion: row.policyVersion, effectiveAt: row.effectiveAt, rules };
}

function executionStatus(value: unknown): RetentionExecutionStatus | null {
  const row = record(value);
  if (!row || row.engineVersion !== 'P3_AI_ABANDONED_UNBOUND_V1' || typeof row.executionAdmitted !== 'boolean'
    || row.storageCleanup !== 'NOT_APPLICABLE' || !Array.isArray(row.datasets) || row.datasets.length !== 1
    || !(row.policyVersion === null || text(row.policyVersion, 1, 80))) return null;
  const dataset = record(row.datasets[0]);
  const unsupported = classes(row.unsupportedDataClasses);
  if (!dataset || !unsupported || unsupported.includes('AI_VOLATILE') || dataset.dataset !== 'AI_ABANDONED_UNBOUND' || dataset.dataClass !== 'AI_VOLATILE'
    || dataset.action !== 'DELETE' || dataset.ready !== row.executionAdmitted) return null;
  if (row.executionAdmitted) {
    if (dataset.reason !== null || row.policyVersion === null) return null;
  } else if (dataset.reason !== 'POLICY_NOT_READY' && dataset.reason !== 'SOURCE_NOT_READY') return null;
  return { engineVersion: row.engineVersion, executionAdmitted: row.executionAdmitted, policyVersion: row.policyVersion,
    datasets: [{ dataset: dataset.dataset, dataClass: dataset.dataClass, action: dataset.action,
      ready: row.executionAdmitted, reason: dataset.reason as null | 'POLICY_NOT_READY' | 'SOURCE_NOT_READY' }],
    unsupportedDataClasses: unsupported, storageCleanup: row.storageCleanup };
}

/** Read-only server receipts, fenced to the current account incarnation. A
 * published schedule and a particular executable adapter are separate facts. */
export const retentionPolicyClientService = {
  readStatus(): Promise<Ishod<RetentionPolicyStatus>> {
    return readReceipt({ rpc: 'rpc_get_retention_policy_status', args: {}, decode: policyStatus, errors,
      fallback: 'RETENTION_POLICY_READ_FAILED', invalid: 'RETENTION_POLICY_INVALID_RESPONSE' });
  },
  readExecutionStatus(): Promise<Ishod<RetentionExecutionStatus>> {
    return readReceipt({ rpc: 'rpc_get_retention_execution_status', args: {}, decode: executionStatus, errors,
      fallback: 'RETENTION_EXECUTION_READ_FAILED', invalid: 'RETENTION_EXECUTION_INVALID_RESPONSE' });
  },
};
