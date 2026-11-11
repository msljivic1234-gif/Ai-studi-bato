/** Advisory result of the existing interview turn. It never grants a write or navigation. */
export const AI_CONVERSATION_INTENT_HEADER = 'x-uskoci-interview-intent';
export const AI_CONVERSATION_INTENT_CAPABILITY = 'v1';
export const AI_CONVERSATION_INTENT_SCHEMA = 'AI_CONVERSATION_INTENT_V1';
export const AI_CONVERSATION_INTENT_KINDS = [
  'NEED_REQUEST', 'NEED_EDIT', 'WORKER_OFFER', 'WORKER_ADD_SERVICE',
  'WORKER_REMOVE_SERVICE', 'WORKER_EDIT_SERVICE', 'WORKER_AVAILABILITY', 'WORKER_AREA',
  'CORRECTION', 'CONTINUE', 'QUESTION', 'MIXED', 'UNCLEAR',
] as const;
export type AiConversationIntentKind = typeof AI_CONVERSATION_INTENT_KINDS[number];
export type AiInterviewDomain = 'NEED' | 'WORKER';
export type AiConversationIntent = Readonly<{
  schemaVersion: typeof AI_CONVERSATION_INTENT_SCHEMA;
  kind: AiConversationIntentKind;
  evidence: string;
}>;

/** A quote must belong to this exact user turn, never to earlier conversation prose. */
export function decodeAiConversationIntent(raw: unknown, userText: string): AiConversationIntent | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw) || typeof userText !== 'string') return null;
  const value = raw as Record<string, unknown>;
  if (Object.keys(value).length !== 3 || !['schemaVersion', 'kind', 'evidence'].every(key => Object.hasOwn(value, key))
    || value.schemaVersion !== AI_CONVERSATION_INTENT_SCHEMA
    || !AI_CONVERSATION_INTENT_KINDS.includes(value.kind as AiConversationIntentKind)
    || typeof value.evidence !== 'string' || value.evidence.length > 500
    || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value.evidence)) return null;
  const quote = value.evidence.normalize('NFKC').replace(/\s+/gu, ' ').trim();
  if (!quote && (value.evidence !== '' || value.kind !== 'CONTINUE' && value.kind !== 'UNCLEAR')) return null;
  if (quote && !userText.normalize('NFKC').replace(/\s+/gu, ' ').trim().includes(quote)) return null;
  return { schemaVersion: AI_CONVERSATION_INTENT_SCHEMA, kind: value.kind as AiConversationIntentKind, evidence: value.evidence };
}

/** Ambiguity, a question or a correction alone never chooses another interview. */
export function oppositeInterviewDomain(intent: AiConversationIntent, current: AiInterviewDomain): AiInterviewDomain | null {
  if (current === 'NEED' && intent.kind.startsWith('WORKER_')) return 'WORKER';
  if (current === 'WORKER' && (intent.kind === 'NEED_REQUEST' || intent.kind === 'NEED_EDIT')) return 'NEED';
  return null;
}

export type AiRoleSuggestion = Readonly<{
  text: string; conversationId: string; clientRequestId: string; turnId: string; assistantMessageId: string;
}>;
