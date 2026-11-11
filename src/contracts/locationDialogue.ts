import type { AiNeedTurnStatus } from './aiNeedV2';
import type { LocationSlot } from './needFactsV2';

/** Only the visible question and place labels go to the model. Coordinates stay in the native editor. */
export type LocationDialogueContext = {
  version: 1;
  promptToken: string;
  reviewRevision: string;
  slot: LocationSlot;
  phase: 'PROPOSAL' | 'AMBIGUOUS' | 'UNRESOLVED';
  question: string;
  query: string;
  proposal: { id: string; label: string } | null;
  alternatives: readonly { id: string; label: string }[];
};
export type LocationDialogueRequest = {
  mode: 'locationReply';
  conversationId: string;
  clientRequestId: string;
  text: string;
  locationContext: LocationDialogueContext;
};
export type LocationDialogueReceipt = {
  version: 1;
  promptToken: string;
  reviewRevision: string;
  slot: LocationSlot;
  proposalId: string | null;
  action: 'CONFIRM_DISPLAYED' | 'CORRECT' | 'CLARIFY' | 'CONTINUE';
};
export type LocationDialogueResult = { turn: AiNeedTurnStatus; location: LocationDialogueReceipt | null };

const object = (raw: unknown): Record<string, unknown> | null => raw !== null && typeof raw === 'object' && !Array.isArray(raw)
  ? raw as Record<string, unknown> : null;
const exact = (raw: unknown, keys: readonly string[]): Record<string, unknown> | null => {
  const value = object(raw);
  return value && Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key)) ? value : null;
};
const uuid = (raw: unknown): raw is string => typeof raw === 'string'
  && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(raw);
const revision = (raw: unknown): raw is string => typeof raw === 'string' && /^[0-9a-f]{64}$/.test(raw);
const text = (raw: unknown, limit: number, empty = false): raw is string => typeof raw === 'string'
  && (empty || !!raw.trim()) && raw.length <= limit && !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(raw);
const slot = (raw: unknown): raw is LocationSlot => raw === 'start' || raw === 'end' || raw === 'serviceArea'
  || (typeof raw === 'string' && /^waypoints\/(?:[0-9]|1[0-9])$/.test(raw));

/** Shared closed shape: a malformed/ambiguous prompt never becomes a confirmation capability. */
export function parseLocationDialogueContext(raw: unknown): LocationDialogueContext | null {
  const value = exact(raw, ['version', 'promptToken', 'reviewRevision', 'slot', 'phase', 'question', 'query', 'proposal', 'alternatives']);
  if (!value || value.version !== 1 || !uuid(value.promptToken) || !revision(value.reviewRevision) || !slot(value.slot)
    || !['PROPOSAL', 'AMBIGUOUS', 'UNRESOLVED'].includes(String(value.phase)) || !text(value.question, 300)
    || !text(value.query, 1000, true) || !Array.isArray(value.alternatives) || value.alternatives.length > 20) return null;
  const proposal = value.proposal === null ? null : exact(value.proposal, ['id', 'label']);
  if (value.proposal !== null && (!proposal || !uuid(proposal.id) || !text(proposal.label, 1000))) return null;
  if ((value.phase === 'PROPOSAL') !== (proposal !== null) || (value.phase === 'AMBIGUOUS' && value.alternatives.length < 2)
    || (value.phase === 'UNRESOLVED' && value.alternatives.length !== 0)) return null;
  const ids = new Set<string>();
  const alternatives: { id: string; label: string }[] = [];
  for (const rawItem of value.alternatives) {
    const item = exact(rawItem, ['id', 'label']);
    if (!item || !text(item.id, 160) || !text(item.label, 1000) || ids.has(item.id)) return null;
    ids.add(item.id); alternatives.push({ id: item.id, label: item.label });
  }
  return { version: 1, promptToken: value.promptToken, reviewRevision: value.reviewRevision, slot: value.slot,
    phase: value.phase as LocationDialogueContext['phase'], question: value.question, query: value.query,
    proposal: proposal ? { id: proposal.id as string, label: proposal.label as string } : null, alternatives };
}

export function parseLocationDialogueReceipt(raw: unknown, context: LocationDialogueContext): LocationDialogueReceipt | null {
  const value = exact(raw, ['version', 'promptToken', 'reviewRevision', 'slot', 'proposalId', 'action']);
  if (!value || value.version !== 1 || value.promptToken !== context.promptToken || value.reviewRevision !== context.reviewRevision
    || value.slot !== context.slot || value.proposalId !== (context.proposal?.id ?? null)
    || !['CONFIRM_DISPLAYED', 'CORRECT', 'CLARIFY', 'CONTINUE'].includes(String(value.action))
    || (value.action === 'CONFIRM_DISPLAYED' && (context.phase !== 'PROPOSAL' || !context.proposal))) return null;
  return { version: 1, promptToken: context.promptToken, reviewRevision: context.reviewRevision, slot: context.slot,
    proposalId: context.proposal?.id ?? null, action: value.action as LocationDialogueReceipt['action'] };
}
