import { type WorkerCapacity, type WorkerCapacityReceipt, type WorkerCapacitySave, workerCapacityRevision, workerCapacityValue } from '../contracts/workerCapacity';
import { sesijaSada } from '../store/sesija';
import { failure, readOwnedResult, record, sameId, uuid, type ReceiptAccount } from './serverReceipt';
import { supabaseKlijent } from './supabaseClient';
import type { Ishod } from './ports';
const WORKER_CAPACITY_COPY: Readonly<Record<string,string>> = {
  AUTH_REQUIRED: 'Prijavi se da urediš kapacitet tima.',
  WORKER_PROFILE_REQUIRED: 'Najpre sačuvaj radni profil.',
  WORKER_PROFILE_RESTRICTED: 'Kapacitet ovog profila trenutno ne može da se menja.',
  WORKER_CAPACITY_INPUT_INVALID: 'Unesi ceo broj od 1 do 50 ljudi i učitaj aktuelni profil.',
  WORKER_CAPACITY_VERSION_CONFLICT: 'Kapacitet je promenjen na drugom mestu. Učitaj aktuelni profil.',
};
function decodeWorkerCapacity(raw: unknown, accountId: string): WorkerCapacity | null {
  const row=record(raw);
  return row && sameId(row.accountId,accountId) && uuid(row.profileId) && workerCapacityValue(row.teamCapacity) && workerCapacityRevision(row.revision)
    ? { accountId: row.accountId, profileId: row.profileId, teamCapacity: row.teamCapacity, revision: row.revision } : null;
}
function captured(): ReceiptAccount | undefined {
  const s=sesijaSada(); return s.user ? {accountId:s.user.id,accountRevision:s.accountRevision} : undefined;
}
export const workerCapacityClientService = {
  read(account=captured()): Promise<Ishod<WorkerCapacity>> {
    if(!account)return Promise.resolve(failure('AUTH_REQUIRED',WORKER_CAPACITY_COPY.AUTH_REQUIRED));
    return readOwnedResult({account,request:()=>supabaseKlijent().rpc('rpc_get_worker_capacity',{}),errors:WORKER_CAPACITY_COPY,
      fallback:'WORKER_CAPACITY_READ_FAILED',invalid:'WORKER_CAPACITY_INVALID_RESPONSE',decode:raw=>decodeWorkerCapacity(raw,account.accountId)});
  },
  save(command: WorkerCapacitySave,account=captured()): Promise<Ishod<WorkerCapacityReceipt>> {
    if(!account)return Promise.resolve(failure('AUTH_REQUIRED',WORKER_CAPACITY_COPY.AUTH_REQUIRED));
    if(!command || !workerCapacityRevision(command.expectedRevision) || !workerCapacityValue(command.teamCapacity) ||
        Object.keys(command).some(k=>!['expectedRevision','teamCapacity'].includes(k)))
      return Promise.resolve(failure('WORKER_CAPACITY_INPUT_INVALID',WORKER_CAPACITY_COPY.WORKER_CAPACITY_INPUT_INVALID));
    const wanted=command.teamCapacity;
    return readOwnedResult({account,request:()=>supabaseKlijent().rpc('rpc_save_worker_capacity',{
      p_expected_revision:command.expectedRevision,p_team_capacity:wanted}),errors:WORKER_CAPACITY_COPY,
      fallback:'WORKER_CAPACITY_SAVE_UNCONFIRMED',invalid:'WORKER_CAPACITY_INVALID_RESPONSE',write:true,
      decode(raw): WorkerCapacityReceipt|null {
        const result=record(raw),capacity=decodeWorkerCapacity(result?.capacity,account.accountId);
        return result?.saved===true && typeof result.idempotentReplay==='boolean' && capacity?.teamCapacity===wanted
          ? {saved:true,idempotentReplay:result.idempotentReplay,capacity} : null;
      }});
  },
};
