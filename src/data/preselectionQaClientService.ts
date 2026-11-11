import type {
  AnswerQuestionReceipt, AskQuestionReceipt, DispositionReceipt, OwnerPreselectionQuestion,
  PreselectionQuestionStatus, PublicPreselectionQa, QuestionDisposition,
} from '../contracts/preselectionQa';
import type { Ishod } from './ports';
import { failure, positiveInteger, readReceipt, record, sameId, timestamp, uuid } from './serverReceipt';

const NOT_READY_COPY = 'Pitanja o zadatku još nisu dostupna.';
const PUBLIC_FLOOR_COPY = 'Pitanja i odgovori su javni: bez telefona, e-pošte, linkova i naloga.';
const STALE_COPY = 'Zadatak je u međuvremenu izmenjen. Osveži prikaz.';
const QA_COPY: Readonly<Record<string, string>> = {
  RU4B_BLOCK_AUTHORITY_NOT_READY: NOT_READY_COPY, RU4B_RATE_POLICY_NOT_READY: NOT_READY_COPY,
  PRESELECTION_QA_POLICY_NOT_READY: NOT_READY_COPY, RU4B_MATERIALITY_NOT_READY: NOT_READY_COPY,
  EMPTY_CONTENT: 'Unesi tekst.', QUESTION_REQUIRED: 'Unesi pitanje.', ANSWER_REQUIRED: 'Unesi odgovor.',
  EMAIL_NOT_PUBLIC: PUBLIC_FLOOR_COPY, PHONE_NOT_PUBLIC: PUBLIC_FLOOR_COPY,
  OFF_PLATFORM_LINK_NOT_PUBLIC: PUBLIC_FLOOR_COPY, SOCIAL_HANDLE_NOT_PUBLIC: PUBLIC_FLOOR_COPY,
  STALE_NEED_REVISION: STALE_COPY, QUESTION_STALE_AFTER_NEED_REVISION: STALE_COPY,
  NEED_NOT_FOUND: 'Zadatak nije pronađen.', NEED_NOT_PUBLIC: 'Zadatak više nije javan.',
  REQUESTER_CANNOT_ASK_OWN_TASK: 'Ne možete postaviti pitanje na sopstveni zadatak.',
  ACTIVE_WORKER_REQUIRED: 'Dopunite profil majstora da postavite pitanje.',
  RU4B_MATERIAL_REQUIRES_RU4_EDIT: 'Ovaj odgovor menja zadatak. Izmenite zadatak umesto odgovora.',
  QUESTION_NOT_FOUND: 'Pitanje nije pronađeno.', QUESTION_NOT_ANSWERABLE: 'Na ovo pitanje više ne može da se odgovori.',
  QUESTION_NOT_PENDING: 'Ovo pitanje je već obrađeno.', NOT_NEED_OWNER: 'Ovo nije Vaš zadatak.',
  RU4B_DISPOSITION_INVALID: 'Radnja nije prepoznata.',
  IDEMPOTENCY_KEY_REUSED: 'Radnja nije mogla da se ponovi sa istim zahtevom. Pokušajte ponovo.',
  REQUEST_ID_REQUIRED: 'Radnja trenutno nije mogla da se zabeleži. Pokušajte ponovo.',
  AUTH_REQUIRED: 'Prijavite se da nastavite.',
};
function invalidRequestId() { return failure('REQUEST_ID_INVALID', QA_COPY.REQUEST_ID_REQUIRED); }
function invalidInput() { return failure('QA_INVALID_INPUT', 'Ponovo otvorite zadatak i pregledajte aktuelne podatke.'); }
function status(value: unknown): value is PreselectionQuestionStatus {
  return value === 'PENDING_ANSWER' || value === 'ANSWERED_PUBLIC' || value === 'IGNORED' || value === 'REPORTED';
}
function ownerQuestion(raw: unknown): OwnerPreselectionQuestion | null {
  const row = record(raw);
  if (!row || !uuid(row.question_id) || !positiveInteger(row.need_revision) || typeof row.question_text !== 'string' ||
    !status(row.status) || !timestamp(row.created_at) || typeof row.edited !== 'boolean') return null;
  const answered = row.status === 'ANSWERED_PUBLIC';
  if (answered ? !positiveInteger(row.answer_version) || typeof row.answer_text !== 'string' || row.edited !== (row.answer_version > 1)
    : row.answer_version !== null || row.answer_text !== null || row.edited !== false) return null;
  // Narrow each nullable field explicitly; no raw fields (including asker id) escape.
  if (row.answer_version !== null && !positiveInteger(row.answer_version)) return null;
  if (row.answer_text !== null && typeof row.answer_text !== 'string') return null;
  return { questionId: row.question_id, needRevision: row.need_revision, questionText: row.question_text,
    status: row.status, createdAt: row.created_at, answerVersion: row.answer_version, answerText: row.answer_text, edited: row.edited };
}
function publicQuestion(raw: unknown): PublicPreselectionQa | null {
  const row = record(raw);
  if (!row || !uuid(row.question_id) || !positiveInteger(row.need_revision) || typeof row.question_text !== 'string' ||
    !positiveInteger(row.answer_version) || typeof row.answer_text !== 'string' || typeof row.edited !== 'boolean' ||
    row.edited !== (row.answer_version > 1) || !timestamp(row.answered_at)) return null;
  return { questionId: row.question_id, needRevision: row.need_revision, questionText: row.question_text,
    answerVersion: row.answer_version, answerText: row.answer_text, edited: row.edited, answeredAt: row.answered_at };
}
function rows<T>(value: unknown, decode: (raw: unknown) => T | null): T[] | null {
  if (!Array.isArray(value)) return null;
  const result: T[] = [];
  for (const raw of value) {
    const item = decode(raw);
    if (item === null) return null;
    result.push(item);
  }
  return result;
}

/** Existing RPCs own permissions and policy. Stable request ids survive manual retries. */
export const preselectionQaClientService = {
  async askQuestion(needId: string, expectedRevision: number, questionText: string, requestId: string): Promise<Ishod<AskQuestionReceipt>> {
    if (!uuid(requestId)) return invalidRequestId();
    if (!uuid(needId) || !positiveInteger(expectedRevision) || typeof questionText !== 'string') return invalidInput();
    return readReceipt({
      rpc: 'rpc_ru4b_ask_preselection_question',
      args: { p_need_id: needId, p_expected_revision: expectedRevision, p_question_text: questionText, p_request_id: requestId },
      errors: QA_COPY, fallback: 'QUESTION_ASK_FAILED', invalid: 'QUESTION_ASK_INVALID_RESPONSE', write: true,
      decode(raw): AskQuestionReceipt | null {
        const data = record(raw);
        if (!data || data.ok !== true || !uuid(data.questionId) || data.status !== 'PENDING_ANSWER' ||
          data.needRevision !== expectedRevision || typeof data.idempotentReplay !== 'boolean') return null;
        return { questionId: data.questionId, status: 'PENDING_ANSWER', needRevision: expectedRevision, idempotentReplay: data.idempotentReplay };
      },
    });
  },
  async answerQuestion(questionId: string, answerText: string, requestId: string): Promise<Ishod<AnswerQuestionReceipt>> {
    if (!uuid(requestId)) return invalidRequestId();
    if (!uuid(questionId) || typeof answerText !== 'string') return invalidInput();
    return readReceipt({
      rpc: 'rpc_ru4b_answer_preselection_question', args: { p_question_id: questionId, p_answer_text: answerText, p_request_id: requestId },
      errors: QA_COPY, fallback: 'QUESTION_ANSWER_FAILED', invalid: 'QUESTION_ANSWER_INVALID_RESPONSE', write: true,
      decode(raw): AnswerQuestionReceipt | null {
        const data = record(raw);
        if (!data || data.ok !== true || !sameId(data.questionId, questionId) || data.status !== 'ANSWERED_PUBLIC' ||
          !positiveInteger(data.answerVersion) || typeof data.edited !== 'boolean' || data.edited !== (data.answerVersion > 1) ||
          typeof data.idempotentReplay !== 'boolean') return null;
        return { questionId: data.questionId, status: 'ANSWERED_PUBLIC', answerVersion: data.answerVersion,
          edited: data.edited, idempotentReplay: data.idempotentReplay };
      },
    });
  },
  async dispositionQuestion(questionId: string, action: QuestionDisposition, requestId: string): Promise<Ishod<DispositionReceipt>> {
    if (!uuid(requestId)) return invalidRequestId();
    if (!uuid(questionId) || (action !== 'IGNORE' && action !== 'REPORT')) return invalidInput();
    return readReceipt({
      rpc: 'rpc_ru4b_disposition_preselection_question', args: { p_question_id: questionId, p_action: action, p_request_id: requestId },
      errors: QA_COPY, fallback: 'QUESTION_DISPOSITION_FAILED', invalid: 'QUESTION_DISPOSITION_INVALID_RESPONSE', write: true,
      decode(raw): DispositionReceipt | null {
        const data = record(raw);
        const expected = action === 'IGNORE' ? 'IGNORED' : 'REPORTED';
        if (!data || data.ok !== true || !sameId(data.questionId, questionId) || data.status !== expected || typeof data.idempotentReplay !== 'boolean') return null;
        return { questionId: data.questionId, status: expected, idempotentReplay: data.idempotentReplay };
      },
    });
  },
  async ownerQuestions(needId: string): Promise<Ishod<OwnerPreselectionQuestion[]>> {
    if (!uuid(needId)) return invalidInput();
    return readReceipt({ rpc: 'rpc_ru4b_owner_preselection_questions', args: { p_need_id: needId },
      errors: QA_COPY, fallback: 'OWNER_QUESTIONS_READ_FAILED', invalid: 'OWNER_QUESTIONS_INVALID_RESPONSE', decode: raw => rows(raw, ownerQuestion) });
  },
  async publicQa(needId: string): Promise<Ishod<PublicPreselectionQa[]>> {
    if (!uuid(needId)) return invalidInput();
    return readReceipt({ rpc: 'rpc_ru4b_public_preselection_qa', args: { p_need_id: needId },
      errors: QA_COPY, fallback: 'PUBLIC_QA_READ_FAILED', invalid: 'PUBLIC_QA_INVALID_RESPONSE', decode: raw => rows(raw, publicQuestion) });
  },
};
