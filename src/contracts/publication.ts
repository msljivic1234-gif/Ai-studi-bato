import type { LocationSlot } from './location';

export type PublicationOutcome = 'ALLOW' | 'CLARIFY' | 'REVIEW' | 'BLOCK';
export type PublicationRequest = Readonly<{ needId: string; expectedRevision: number }>;
export type PublicationNotReadyCode =
  | 'POLICY_NOT_READY' | 'POLICY_CONTENT_NOT_READY' | 'LOCATION_INCOMPLETE'
  | 'COUNTRY_NOT_READY' | 'PUBLIC_MEDIA_NOT_READY' | 'EVALUATOR_UNAVAILABLE'
  | 'EVALUATOR_INVALID_RESPONSE' | 'RATE_LIMITED' | 'NEED_CHANGED';
export type PublicationNotReady = Readonly<{
  kind: 'NOT_READY'; needId: string; needRevision: number;
  authoritativeDecision: false; code: PublicationNotReadyCode;
  missingSlots?: readonly LocationSlot[];
}>;
/** Only the stored B06 decision receipt can authorize the explicit publish action. */
export type PublicationDecision = Readonly<{
  decisionId: string; decisionSequence: number; needId: string; needRevision: number;
  canonicalFingerprint: string; policyBundleId: string; policyVersion: number;
  jurisdiction: string; outcome: PublicationOutcome; decisionAt: string;
  ruleIds: readonly string[]; safeReasonCodes: readonly string[];
  publishable: boolean; authoritative: true;
}>;
export type PublicationEvaluation = PublicationNotReady | Readonly<{ kind: 'DECISION'; decision: PublicationDecision }>;
export type PublishNeedCommand = PublicationRequest & Readonly<{
  decisionSequence: number; responseDeadline: string | null; clientRequestId: string; confirmed: true;
}>;
/** Existing B07 receipt; revision and decision are bound by the submitted command. */
export type PublishNeedReceipt = Readonly<{
  needId: string; status: 'PUBLISHED'; publishedAt: string; responseDeadline: string | null; idempotentReplay: boolean;
}>;
