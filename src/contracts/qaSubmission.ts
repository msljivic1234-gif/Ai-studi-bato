import type { AnswerQuestionReceipt, AskQuestionReceipt } from './preselectionQa.ts';

export type QaSubmissionIdentity = { type: 'ASK' | 'ANSWER'; needId: string; needRevision: number;
  questionId?: string; clientRequestId: string; textSha256: string };
export type QaSubmissionInput = Omit<QaSubmissionIdentity, 'textSha256'> & { text: string };
export type QaSubmissionStatus = {
  accountId: string; needId: string; clientRequestId: string; classificationId: string | null;
  type: 'ASK' | 'ANSWER' | null; needRevision: number | null; questionId: string | null; textSha256: string | null;
  state: 'ABSENT' | 'PROCESSING' | 'READY' | 'REJECTED' | 'STALE' | 'COMMITTED' | 'CANCELLED';
  outcome: 'ALLOW' | 'CLARIFY' | 'REVIEW' | 'BLOCK' | null; materiality: 'NON_MATERIAL' | 'MATERIAL' | null;
  safeReasonCodes: string[]; canCancel: boolean; receipt: AskQuestionReceipt | AnswerQuestionReceipt | null; authoritative: true;
};
const obj = (v: unknown): Record<string, unknown> | null => v !== null && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, unknown> : null;
const uuid = (v: unknown): v is string => typeof v === 'string' && /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(v);
const positive = (v: unknown): v is number => Number.isInteger(v) && Number(v) > 0 && Number(v) <= 2147483647;
export function decodeQaSubmissionStatus(raw: unknown, accountId: string, needId: string, key: string): QaSubmissionStatus | null {
  const r = obj(raw);
  if (!r || Object.keys(r).length !== 15 || r.accountId !== accountId || r.needId !== needId || r.clientRequestId !== key
    || !uuid(r.accountId) || !uuid(r.needId) || !uuid(r.clientRequestId) || r.authoritative !== true
    || typeof r.canCancel !== 'boolean' || !Array.isArray(r.safeReasonCodes) || r.safeReasonCodes.length > 64
    || r.safeReasonCodes.some(c => typeof c !== 'string' || !/^[A-Z][A-Z0-9_-]{0,63}$/.test(c))
    || new Set(r.safeReasonCodes).size !== r.safeReasonCodes.length
    || !['ABSENT', 'PROCESSING', 'READY', 'REJECTED', 'STALE', 'COMMITTED', 'CANCELLED'].includes(String(r.state))
    || (r.outcome !== null && !['ALLOW', 'CLARIFY', 'REVIEW', 'BLOCK'].includes(String(r.outcome)))
    || (r.materiality !== null && !['NON_MATERIAL', 'MATERIAL'].includes(String(r.materiality)))) return null;
  if (r.state === 'ABSENT') {
    if ([r.classificationId, r.type, r.needRevision, r.questionId, r.textSha256, r.outcome, r.materiality, r.receipt].some(x => x !== null)
      || !r.canCancel || r.safeReasonCodes.length) return null;
  } else if (!uuid(r.classificationId) || !['ASK', 'ANSWER'].includes(String(r.type)) || !positive(r.needRevision)
    || typeof r.textSha256 !== 'string' || !/^[a-f0-9]{64}$/.test(r.textSha256)
    || (r.type === 'ASK' ? r.questionId !== null || r.materiality !== null : !uuid(r.questionId))) return null;
  if (r.state !== 'ABSENT' && r.canCancel !== ['PROCESSING', 'READY'].includes(String(r.state))) return null;
  if (r.state === 'READY' && (r.outcome !== 'ALLOW' || (r.type === 'ANSWER' && r.materiality !== 'NON_MATERIAL'))) return null;
  if (r.state === 'PROCESSING' && (r.outcome !== null || r.materiality !== null)) return null;
  let receipt: QaSubmissionStatus['receipt'] = null;
  if (r.state === 'COMMITTED') {
    const p = obj(r.receipt);
    if (!p || !uuid(p.questionId) || typeof p.idempotentReplay !== 'boolean'
      || Object.keys(p).some(k => !['ok', 'questionId', 'status', 'needRevision', 'answerVersion', 'edited', 'idempotentReplay'].includes(k))
      || (p.ok !== undefined && p.ok !== true)) return null;
    if (r.type === 'ASK' && p.status === 'PENDING_ANSWER' && p.needRevision === r.needRevision)
      receipt = { questionId: p.questionId, status: 'PENDING_ANSWER', needRevision: p.needRevision as number, idempotentReplay: p.idempotentReplay };
    else if (r.type === 'ANSWER' && p.status === 'ANSWERED_PUBLIC' && p.questionId === r.questionId
      && positive(p.answerVersion) && p.edited === (p.answerVersion > 1))
      receipt = { questionId: p.questionId, status: 'ANSWERED_PUBLIC', answerVersion: p.answerVersion, edited: p.edited as boolean, idempotentReplay: p.idempotentReplay };
    else return null;
  } else if (r.receipt !== null) return null;
  return { accountId, needId, clientRequestId: key, classificationId: r.classificationId as string | null,
    type: r.type as QaSubmissionStatus['type'], needRevision: r.needRevision as number | null,
    questionId: r.questionId as string | null, textSha256: r.textSha256 as string | null,
    state: r.state as QaSubmissionStatus['state'], outcome: r.outcome as QaSubmissionStatus['outcome'],
    materiality: r.materiality as QaSubmissionStatus['materiality'], safeReasonCodes: [...r.safeReasonCodes] as string[],
    canCancel: r.canCancel, receipt, authoritative: true };
}
