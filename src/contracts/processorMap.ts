/** P4 — trusted processor/subprocessor map as the server projects it. */

export type ProcessorLegalRole = 'PROCESSOR' | 'SUBPROCESSOR' | 'INDEPENDENT_CONTROLLER';

export type ProcessorMapProvider = {
  providerCode: string;
  providerDisplayName: string;
  legalEntityName: string;
  legalRole: ProcessorLegalRole;
  purpose: string;
  dataCategories: string[];
  processingRegions: string;
  crossBorderTransfer: boolean;
  transferMechanism: string;
  dpaReference: string;
  privacyNoticeUrl: string;
  retentionDeletionTerms: string;
  subprocessorTerms: string;
  legalBasisReference: string;
};

export type ProcessorMapNotReadyReason =
  | 'PROCESSOR_MAP_NOT_PUBLISHED'
  | 'PROCESSOR_MAP_AMBIGUOUS'
  | 'PROCESSOR_MAP_INCOMPLETE';

/**
 * Fail-closed by design: `ready` is false until authorized operations publish
 * one map that covers every active required provider. The runtime provider
 * gate is never admitted by this projection.
 */
export type ProcessorMapStatus =
  | { ready: false; reason: ProcessorMapNotReadyReason; missingProviders: string[] }
  | { ready: true; mapVersion: string; effectiveAt: string; providers: ProcessorMapProvider[] };
