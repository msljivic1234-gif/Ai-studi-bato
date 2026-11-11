/**
 * RU-4B — pre-Dogovor clarification questions as the server projects them.
 * The asker is anonymous in every public and Requester projection; the
 * server never returns an asker identity and the client never invents one.
 */

export type PreselectionQuestionStatus = 'PENDING_ANSWER' | 'ANSWERED_PUBLIC' | 'IGNORED' | 'REPORTED';

/** Requester (owner) view of one question on their Zadatak. */
export type OwnerPreselectionQuestion = {
  questionId: string;
  needRevision: number;
  questionText: string;
  status: PreselectionQuestionStatus;
  createdAt: string;
  answerVersion: number | null;
  answerText: string | null;
  edited: boolean;
};

/** Public view: only answered questions of the current public revision. */
export type PublicPreselectionQa = {
  questionId: string;
  needRevision: number;
  questionText: string;
  answerVersion: number;
  answerText: string;
  edited: boolean;
  answeredAt: string;
};

export type AskQuestionReceipt = {
  questionId: string;
  status: 'PENDING_ANSWER';
  needRevision: number;
  idempotentReplay: boolean;
};

export type AnswerQuestionReceipt = {
  questionId: string;
  status: 'ANSWERED_PUBLIC';
  answerVersion: number;
  edited: boolean;
  idempotentReplay: boolean;
};

export type QuestionDisposition = 'IGNORE' | 'REPORT';

export type DispositionReceipt = {
  questionId: string;
  status: 'IGNORED' | 'REPORTED';
  idempotentReplay: boolean;
};
