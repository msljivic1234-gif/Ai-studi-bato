/** P1 — versioned Terms/Privacy bundle as the server projects it. */

export type LegalDocumentKind = 'TERMS' | 'PRIVACY';

export type LegalDocument = {
  kind: LegalDocumentKind;
  version: string;
  sha256: string;
  url: string;
  publishedAt: string;
  effectiveAt: string;
};

/**
 * Fail-closed by design: `ready` is false until both documents are published
 * by authorized operations. `acceptedCurrentBundle` is only meaningful for a
 * signed-in account and only for the exact active versions.
 */
export type LegalBundleStatus = {
  ready: boolean;
  acceptedCurrentBundle: boolean;
  reason: 'LEGAL_DOCUMENTS_NOT_PUBLISHED' | null;
  documents: LegalDocument[];
};

export type LegalAcceptanceReceipt = {
  accepted: true;
  idempotentReplay: boolean;
  acceptedAt: string;
  termsVersion: string;
  termsSha256: string;
  privacyVersion: string;
  privacySha256: string;
};
