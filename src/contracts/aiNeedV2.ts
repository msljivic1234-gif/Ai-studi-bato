import type {
  NeedFactPrivacyClass,
  NeedFactV2Key,
  NeedFactValueType,
} from './needFactsV2';

export type AiNeedV2FactStatus = 'NEEDS_CONFIRMATION' | 'INFERRED' | 'CONFIRMED' | 'UNKNOWN';
export type AiNeedV2FactSource = 'EXPLICIT_USER_ANSWER' | 'CONFIRMED_PROFILE' | 'AI_INFERENCE' | 'SYSTEM' | 'SYSTEM_DERIVED';
export type AiNeedSafety = 'ALLOW' | 'CLARIFY' | 'REVIEW' | 'BLOCK';

export type AiNeedConversationOpened = {
  conversationId: string;
  clientRequestId: string;
  authoritative: true;
  idempotentReplay: boolean;
};

export type AiNeedTurnReceipt = {
  userMessageId: string;
  assistantMessageId: string;
  proposedCount: number;
  safety: AiNeedSafety;
  schemaVersion: 'NEED_FACT_V2';
  authoritative: true;
};

export type AiNeedTurnStatus = {
  conversationId: string;
  clientRequestId: string;
} & (
  | { state: 'ABSENT'; turnId: null; retryAllowed: boolean; receipt: null }
  | { state: 'PROCESSING' | 'FAILED'; turnId: string; retryAllowed: boolean; receipt: null }
  | { state: 'SUCCEEDED'; turnId: string; retryAllowed: false; receipt: AiNeedTurnReceipt }
);

export type AiNeedTurnRecovery = {
  accountId: string;
  conversationId: string;
  clientRequestId: string;
  conversationStatus: 'OPEN' | 'COMPLETED' | 'ABANDONED';
  turn: AiNeedTurnStatus;
  providerDispatched: boolean;
  cancelled: boolean;
  canCancel: boolean;
  authoritative: true;
};

export type AiNeedConversationAbandoned = {
  conversationId: string;
  status: 'ABANDONED';
  authoritative: true;
  idempotentReplay: boolean;
};

export type AiNeedDraftSaved = {
  needId: string;
  conversationId: string;
  status: 'DRAFT';
  revision: 1;
  authoritative: true;
};

export type AiNeedV2Fact = {
  id: string;
  key: NeedFactV2Key;
  value: unknown;
  displayValue: string;
  valueType: NeedFactValueType;
  privacyClass: NeedFactPrivacyClass;
  requiredForDraft: boolean;
  status: AiNeedV2FactStatus;
  source: AiNeedV2FactSource;
  evidence: string | null;
};

export type AiNeedMessage = {
  id: string;
  fromAi: boolean;
  body: string;
  safety: AiNeedSafety | null;
  proposedFactIds: string[];
};

export type AiNeedV2Review = {
  conversationId: string;
  schemaVersion: 'NEED_FACT_V2';
  boundNeedId: string | null;
  canSaveDraft: boolean;
  missingRequired: NeedFactV2Key[];
  facts: AiNeedV2Fact[];
};

export type AiNeedV2Conversation = {
  conversationId: string;
  schemaVersion: 'NEED_FACT_V2';
  /** Actual conversation lifecycle; unknown legacy values grant no edit capability. */
  status?: 'OPEN' | 'COMPLETED' | 'ABANDONED';
  messages: AiNeedMessage[];
  facts: AiNeedV2Fact[];
  review: AiNeedV2Review;
  safety: AiNeedSafety;
};

/** RU-4: server opened an edit conversation bound to an owned public Zadatak. */
export type AiNeedEditOpened = {
  conversationId: string;
  needId: string;
  /** Exact revision the owner is editing; confirm must carry it back. */
  revision: number;
  /** Need status returned by open-edit, not the conversation lifecycle. */
  needStatus: 'DRAFT' | 'PUBLISHED' | 'SELECTION';
  authoritative: true;
};

/** RU-4: confirmed material edit — the Zadatak returned to DRAFT and needs re-admission. */
export type AiNeedEditConfirmed = {
  needId: string;
  fromRevision: number;
  revision: number;
  requiresReadmission: boolean;
  idempotentReplay: boolean;
  status: 'DRAFT';
  conversationId: string;
  revisionEventId: string;
  authoritative: true;
};
