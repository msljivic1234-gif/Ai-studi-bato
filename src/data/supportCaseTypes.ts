import type { ReceiptAccount } from './serverReceipt';

export const supportKinds = ['CREATE', 'AUTHOR_REPLY', 'CLAIM', 'CLOSE', 'OPERATOR_REPLY', 'REQUEST_INFO',
  'DECIDE', 'APPEAL', 'CLAIM_APPEAL', 'DECIDE_APPEAL'] as const;
export type SupportKind = typeof supportKinds[number];
export type SupportAction = Exclude<SupportKind, 'CREATE'>;
export type SupportMode = 'OWN' | 'OPERATOR' | 'SAFETY';
export type SupportChannel = 'SERVICE' | 'TASK' | 'LEGAL_PRIVACY' | 'SAFETY';
export type SupportTopic = 'TECHNICAL' | 'SERVICE_COMPLAINT' | 'OTHER' | 'COLLABORATION' | 'NO_SHOW'
  | 'PUBLICATION_REVIEW' | 'CONTENT_NOTICE' | 'PRIVACY_RIGHTS' | 'SAFETY_REPORT';
export type SupportStatus = 'RECEIVED' | 'IN_REVIEW' | 'WAITING_FOR_AUTHOR' | 'DECIDED' | 'CLOSED';
export type SupportReference = { kind: 'TASK' | 'AGREEMENT' | 'AGREEMENT_MESSAGE' | 'GROUP_MESSAGE' | 'TASK_REVIEW' | 'SAFETY_REPORT';
  id: string; revision: number | null };
export type SupportSnapshot = SupportReference & { content: Record<string, unknown> };
export type SupportPayloads = {
  CREATE: { channel: Exclude<SupportChannel, 'SAFETY'>; topic: Exclude<SupportTopic, 'SAFETY_REPORT'>;
    title: string; body: string; desiredOutcome: string | null; context: SupportReference | null; evidence: SupportReference[] };
  AUTHOR_REPLY: { body: string; evidence: SupportReference[] };
  CLAIM: Record<string, never>; CLOSE: Record<string, never>;
  OPERATOR_REPLY: { body: string }; REQUEST_INFO: { body: string };
  DECIDE: { outcome: 'ACCEPTED' | 'REJECTED'; reasonCode: string; body: string; evidenceIds: string[]; appealId: null };
  APPEAL: { decisionId: string; body: string };
  CLAIM_APPEAL: { appealId: string };
  DECIDE_APPEAL: { outcome: 'ACCEPTED' | 'REJECTED'; reasonCode: string; body: string; evidenceIds: string[]; appealId: string };
};
export type SupportIntent = { version: 1; accountId: string; clientRequestId: string; kind: SupportKind;
  caseId: string | null; expectedRevision: number | null; inputSha256: string };
export type SupportScope = ReceiptAccount & { isCurrent?: () => boolean };
/** Narrative is held only for the currently requested submission, never in the journal. */
export type PreparedSupportCommand = { intent: SupportIntent; payloadText: string };
export type SupportReceipt = { accountId: string; clientRequestId: string; kind: SupportKind; caseId: string;
  caseNumber: string; expectedRevision: number | null; inputSha256: string; eventId: string; sequence: string;
  caseRevision: number; createdAt: string; authoritative: true };
export type SupportCommand = { accountId: string; clientRequestId: string; authoritative: true } & (
  { state: 'ABSENT' | 'CANCELLED'; kind: null; caseId: null; expectedRevision: null; inputSha256: null; receipt: null }
  | { state: 'COMMITTED'; kind: SupportKind; caseId: string; expectedRevision: number | null; inputSha256: string; receipt: SupportReceipt });
export type SupportCapabilities = { accountId: string; operatorAvailable: boolean; canCreate: boolean; authoritative: true };
export type SupportInboxRow = { id: string; caseNumber: string; channel: SupportChannel; topic: SupportTopic;
  status: SupportStatus; revision: number; lastSequence: string; createdAt: string; updatedAt: string;
  context: SupportReference | null; unread: boolean };
export type SupportInbox = { accountId: string; mode: SupportMode; operatorAvailable: boolean; cases: SupportInboxRow[];
  nextBeforeCaseNumber: string | null; authoritative: true };
export type SupportCase = Omit<SupportInboxRow, 'unread' | 'context'> & {
  authorAccountId: string; title: string; desiredOutcome: string | null; context: SupportSnapshot | Record<string, never> };
export type SupportEvent = { id: string; caseId: string; sequence: string; kind: string; authorRole: string;
  body: string | null; createdAt: string; decisionId: string | null; appealId: string | null };
export type SupportDecision = { id: string; caseId: string; caseRevision: number; outcome: 'ACCEPTED' | 'REJECTED';
  reasonCode: string; explanation: string; effect: 'NONE'; evidenceIds: string[]; priorDecisionId: string | null;
  createdAt: string; reviewType: 'INITIAL' | 'RECONSIDERATION' };
export type SupportAppeal = { id: string; caseId: string; decisionId: string; status: 'RECEIVED' | 'IN_REVIEW' | 'DECIDED';
  decisionResultId: string | null; createdAt: string };
export type SupportEvidence = { id: string; eventId: string; reference: SupportSnapshot; createdAt: string };
export type SupportDetail = { accountId: string; case: SupportCase; viewerRole: 'AUTHOR' | 'OPERATOR';
  operatorAvailable: boolean; allowedActions: SupportAction[]; events: SupportEvent[]; decisions: SupportDecision[];
  appeals: SupportAppeal[]; evidence: SupportEvidence[]; nextAfterSequence: string | null; authoritative: true };
