/** P3 — trusted retention schedule as the server projects it. */

export type RetentionRule = {
  dataClass: string;
  purpose: string;
  retentionPeriod: string;
  deletionTrigger: string;
  exceptionRule: string;
  legalBasis: string;
};

export type RetentionPolicyNotReadyReason =
  | 'RETENTION_POLICY_NOT_PUBLISHED'
  | 'RETENTION_POLICY_AMBIGUOUS'
  | 'RETENTION_POLICY_INCOMPLETE';

/**
 * Fail-closed by design: `ready` is false until authorized operations publish
 * one policy that covers every active required data class. Execution (purge)
 * is never admitted by this projection.
 */
export type RetentionPolicyStatus =
  | { ready: false; reason: RetentionPolicyNotReadyReason; missingDataClasses: string[] }
  | { ready: true; policyVersion: string; effectiveAt: string; rules: RetentionRule[] };

/** Capability of this one adapter. It does not admit account closure, media
 * cleanup, other AI records, or execution for the full retention schedule. */
export type RetentionExecutionStatus = {
  engineVersion: 'P3_AI_ABANDONED_UNBOUND_V1';
  executionAdmitted: boolean;
  policyVersion: string | null;
  datasets: [{
    dataset: 'AI_ABANDONED_UNBOUND';
    dataClass: 'AI_VOLATILE';
    action: 'DELETE';
    ready: boolean;
    reason: null | 'POLICY_NOT_READY' | 'SOURCE_NOT_READY';
  }];
  unsupportedDataClasses: string[];
  storageCleanup: 'NOT_APPLICABLE';
};
