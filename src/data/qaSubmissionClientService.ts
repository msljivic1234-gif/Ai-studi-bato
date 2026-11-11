import { decodeQaSubmissionStatus, type QaSubmissionIdentity, type QaSubmissionInput, type QaSubmissionStatus } from '../contracts/qaSubmission';
import { qaTextHash } from '../lib/qaTextHash';
import type { Ishod } from './ports';
import { readOwnedResult, failure, positiveInteger, uuid, type ReceiptAccount } from './serverReceipt';
import { sesijaSada } from '../store/sesija';
import { supabaseKlijent } from './supabaseClient';
export type { QaSubmissionIdentity, QaSubmissionInput, QaSubmissionStatus } from '../contracts/qaSubmission';
const errors = { AUTH_CONTEXT_CHANGED: 'Nalog je promenjen. Ponovo otvori pitanja.',
  IDEMPOTENCY_KEY_REUSED: 'Ovaj zahtev pripada drugom tekstu. Proveri prethodni ishod.',
  ACCOUNT_CLOSING: 'Nalog je u postupku zatvaranja.', QA_INPUT_INVALID: 'Proveri tekst i ponovo otvori zadatak.' };
const owner = (explicit?: ReceiptAccount): ReceiptAccount | undefined => {
  const s = sesijaSada(); return explicit ?? (s.user ? { accountId: s.user.id, accountRevision: s.accountRevision } : undefined);
};
const identity = (i: Omit<QaSubmissionIdentity, 'textSha256'>) => uuid(i.needId) && uuid(i.clientRequestId) && positiveInteger(i.needRevision)
  && (i.type === 'ASK' ? i.questionId === undefined : i.type === 'ANSWER' && uuid(i.questionId));
const invalid = (): Promise<Ishod<QaSubmissionStatus>> => Promise.resolve(failure('QA_INPUT_INVALID', errors.QA_INPUT_INVALID));
function matches(status: QaSubmissionStatus | null, input: QaSubmissionIdentity): QaSubmissionStatus | null {
  return status && status.type === input.type && status.needRevision === input.needRevision
    && status.questionId === (input.questionId ?? null) && status.textSha256 === input.textSha256 ? status : null;
}
/** One explicit submit may classify then use the canonical RU4B writer. Reads
 * never invoke a provider; repeated submit carries the identical server command. */
export const qaSubmissionClientService = {
  submit(input: QaSubmissionInput, explicit?: ReceiptAccount): Promise<Ishod<QaSubmissionStatus>> {
    const account = owner(explicit);
    if (!account || !identity(input) || typeof input.text !== 'string') return invalid();
    const text = input.text.trim();
    if (!text || Array.from(text).length > (input.type === 'ASK' ? 500 : 1000)) return invalid();
    const expected = { ...input, textSha256: qaTextHash(text) };
    return readOwnedResult({ account, write: true, timeoutMs: 55_000, errors, fallback: 'QA_CLASSIFICATION_UNCONFIRMED', invalid: 'QA_CLASSIFICATION_INVALID',
      request: () => supabaseKlijent().functions.invoke('uskoci-qa-classify', { body: { type: input.type, needId: input.needId,
        needRevision: input.needRevision, questionId: input.questionId ?? null, text, clientRequestId: input.clientRequestId } }),
      decode: raw => matches(decodeQaSubmissionStatus(raw, account.accountId, input.needId, input.clientRequestId), expected) });
  },
  recover(needId: string, clientRequestId: string, explicit?: ReceiptAccount): Promise<Ishod<QaSubmissionStatus>> {
    const account = owner(explicit); if (!account || !uuid(needId) || !uuid(clientRequestId)) return invalid();
    return readOwnedResult({ account, errors, fallback: 'QA_CLASSIFICATION_READ_UNAVAILABLE', invalid: 'QA_CLASSIFICATION_INVALID',
      request: () => supabaseKlijent().rpc('rpc_read_qa_classification', { p_expected_user_id: account.accountId, p_need_id: needId, p_client_request_id: clientRequestId }),
      decode: raw => decodeQaSubmissionStatus(raw, account.accountId, needId, clientRequestId) });
  },
  cancel(input: QaSubmissionIdentity, explicit?: ReceiptAccount): Promise<Ishod<QaSubmissionStatus>> {
    const account = owner(explicit);
    if (!account || !identity(input) || !/^[a-f0-9]{64}$/.test(input.textSha256)) return invalid();
    return readOwnedResult({ account, write: true, errors, fallback: 'QA_CLASSIFICATION_CANCEL_UNCONFIRMED', invalid: 'QA_CLASSIFICATION_INVALID',
      request: () => supabaseKlijent().rpc('rpc_cancel_qa_classification', { p_expected_user_id: account.accountId, p_type: input.type,
        p_need_id: input.needId, p_need_revision: input.needRevision, p_question_id: input.questionId ?? null,
        p_text_sha256: input.textSha256, p_client_request_id: input.clientRequestId }),
      decode: raw => matches(decodeQaSubmissionStatus(raw, account.accountId, input.needId, input.clientRequestId), input) });
  },
};
