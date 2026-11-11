import { decodeServiceHandoff, type ServiceHandoff } from '../contracts/serviceHandoff';
import { sesijaSada } from '../store/sesija';
import { decodeWorkerAiReview, workerAiClientService, type WorkerAiReview } from './workerAiClientService';
import { failure, readOwnedResult, record, sameId, uuid, type ReceiptAccount } from './serverReceipt';
import { supabaseKlijent } from './supabaseClient';

export type ApplicationServiceIntent = Readonly<ReceiptAccount & {
  applicationId: string; needId: string; profileId: string;
}>;
export type ApplicationServiceReview = Readonly<{
  state: 'READY' | 'EXPIRED' | 'SAVED' | 'CONFIRMED' | 'CHANGED';
  service: string; mode: 'REMOTE' | 'ON_SITE'; categoryId: string;
  handoff: ServiceHandoff | null; review: WorkerAiReview;
}>;
export type ApplicationServiceResult = { state: 'NONE' } | ApplicationServiceReview;

const errors: Readonly<Record<string, string>> = {
  AUTH_ACCOUNT_CHANGED: 'Nalog je promenjen. Ponovo otvorite prijavu.',
  APPLICATION_SERVICE_DENIED: 'Dopuna profila nije dostupna za ovu prijavu.',
  APPLICATION_SERVICE_INPUT_INVALID: 'Ponovo otvorite poslatu prijavu.',
  APPLICATION_SERVICE_PROFILE_DRAFT_OPEN: 'Najpre dovršite započetu izmenu radnog profila.',
  APPLICATION_SERVICE_DRAFT_CHANGED: 'Radni profil je u međuvremenu izmenjen. Nastavite u radnom profilu.',
  APPLICATION_SERVICE_PROFILE_REVIEW_REQUIRED: 'Najpre dopunite postojeće usluge u radnom profilu.',
  APPLICATION_SERVICE_AREA_REQUIRED: 'Za rad na lokaciji najpre navedite područje rada u profilu.',
  APPLICATION_SERVICE_TASK_CHANGED: 'Podaci zadatka su promenjeni. Uslugu možete dodati kroz radni profil.',
  APPLICATION_SERVICE_ALREADY_PRESENT: 'Ova usluga i način rada već su u Vašem profilu.',
  APPLICATION_SERVICE_LIMIT: 'Dostignut je broj usluga u profilu. Pregledajte postojeće usluge.',
  WORKER_PROFILE_RESTRICTED: 'Dopuna trenutno nije dostupna. Proverite radni profil.',
};

function valid(input: ApplicationServiceIntent): boolean {
  return uuid(input.accountId) && Number.isSafeInteger(input.accountRevision)
    && uuid(input.applicationId) && uuid(input.needId) && uuid(input.profileId);
}
export function applicationServiceAccountCurrent(input: ApplicationServiceIntent): boolean {
  const owner = sesijaSada();
  return owner.user?.id === input.accountId && owner.accountRevision === input.accountRevision;
}
export function decodeApplicationServiceResult(raw: unknown, input: ApplicationServiceIntent): ApplicationServiceResult | null {
  const row = record(raw);
  if (!row || !sameId(row.accountId, input.accountId) || !sameId(row.applicationId, input.applicationId)
    || !sameId(row.needId, input.needId) || !sameId(row.profileId, input.profileId)) return null;
  const common = ['accountId', 'applicationId', 'needId', 'profileId', 'state'];
  if (row.state === 'NONE') return Object.keys(row).length === common.length ? { state: 'NONE' } : null;
  if (!['READY', 'EXPIRED', 'SAVED', 'CONFIRMED', 'CHANGED'].includes(row.state as string)
    || Object.keys(row).length !== common.length + 5
    || !['service', 'mode', 'categoryId', 'handoff', 'review'].every(key => Object.hasOwn(row, key))
    || typeof row.service !== 'string' || !row.service.trim() || row.service.length > 500
    || /[\u0000-\u001f\u007f]/.test(row.service) || !uuid(row.categoryId)
    || (row.mode !== 'REMOTE' && row.mode !== 'ON_SITE')) return null;
  const nested = record(row.review);
  if (!nested || !uuid(nested.conversationId)) return null;
  const review = decodeWorkerAiReview(row.review, input.accountId, nested.conversationId);
  const handoff = row.handoff === null ? null : decodeServiceHandoff(row.handoff);
  if (!review || !sameId(review.profileId, input.profileId) || review.activate || !review.canAccept
    || review.classificationState !== 'READY' || (row.handoff !== null && (!handoff || row.mode !== 'REMOTE'))) return null;
  const plans = review.classificationCandidates?.filter(plan => plan.reason === `APPLICATION_SERVICE:${input.applicationId.toLowerCase()}`);
  const target = plans?.length === 1 ? plans[0] : null;
  if (!target || target.action !== 'REUSE_EXISTING' || !sameId(target.categoryId, row.categoryId)
    || target.service !== row.service || target.mode !== row.mode
    || JSON.stringify(target.handoff ?? null) !== JSON.stringify(handoff)) return null;
  return { state: row.state as ApplicationServiceReview['state'], service: row.service, mode: row.mode,
    categoryId: row.categoryId, handoff, review };
}

export const applicationServiceClientService = {
  /** prepare=false is strictly read-only, including after an uncertain Save. */
  async read(input: ApplicationServiceIntent, prepare = false) {
    if (!valid(input)) return failure('APPLICATION_SERVICE_INPUT_INVALID', errors.APPLICATION_SERVICE_INPUT_INVALID);
    return readOwnedResult<ApplicationServiceResult>({ account: input, errors, write: prepare,
      fallback: 'APPLICATION_SERVICE_UNCONFIRMED', invalid: 'APPLICATION_SERVICE_INVALID_RECEIPT',
      request: signal => supabaseKlijent().rpc('rpc_worker_service_from_application', {
        p_expected_user_id: input.accountId, p_application_id: input.applicationId,
        p_worker_profile_id: input.profileId, p_prepare: prepare,
      }).abortSignal(signal),
      decode: raw => decodeApplicationServiceResult(raw, input),
    });
  },
  async save(input: ApplicationServiceIntent, value: ApplicationServiceReview) {
    if (!valid(input) || !applicationServiceAccountCurrent(input)) return failure('AUTH_ACCOUNT_CHANGED', errors.AUTH_ACCOUNT_CHANGED);
    if (value.state !== 'READY' || Date.parse(value.review.expiresAt) <= Date.now()) {
      return failure('APPLICATION_SERVICE_EXPIRED', 'Usluga nije dodata. Pokušajte ponovo.');
    }
    // Existing signed Save/outbox/binder, with one stable key after an app restart.
    // No client category write, model call, activation or automatic retry.
    return workerAiClientService.save(value.review, input.applicationId);
  },
};
