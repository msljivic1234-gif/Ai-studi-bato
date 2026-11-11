import type { AvailabilityReceipt, AvailabilitySave, WorkerAvailability } from '../contracts/workerAvailability';
import { availabilityRevision, normalizeWorkerAvailability, sameWorkerAvailability } from '../lib/workerAvailability';
import { sesijaSada } from '../store/sesija';
import type { Ishod } from './ports';
import { failure, readReceipt, record, sameId, uuid } from './serverReceipt';

const COPY: Readonly<Record<string, string>> = {
  AUTH_REQUIRED: 'Prijavite se da uredite dostupnost.',
  WORKER_PROFILE_REQUIRED: 'Najpre sačuvajte svoj radni profil.',
  WORKER_PROFILE_RESTRICTED: 'Dostupnost ovog profila trenutno ne može da se menja.',
  AVAILABILITY_INPUT_INVALID: 'Proverite unete podatke dostupnosti.',
  AVAILABILITY_ITEM_INVALID: 'Proverite dane, datume i vremenske intervale.',
  AVAILABILITY_TIMEZONE_INVALID: 'Izaberite ispravnu vremensku zonu.',
  AVAILABILITY_INPUT_TOO_LARGE: 'Uneti raspored je prevelik. Sačuvajte manji broj pravila i izuzetaka.',
  AVAILABILITY_VERSION_CONFLICT: 'Dostupnost je u međuvremenu promenjena. Učitajte novo stanje pre čuvanja.',
};
const INVALID = 'WORKER_AVAILABILITY_INVALID_RESPONSE';
function decode(raw: unknown, accountId: string | undefined): WorkerAvailability | null {
  const value = record(raw);
  if (!value || !accountId || !sameId(value.accountId, accountId) || !uuid(value.profileId) || !availabilityRevision(value.revision)) return null;
  const input = normalizeWorkerAvailability({ timezone: value.timezone, availableNow: value.availableNow, rules: value.rules, windows: value.windows });
  if (!input) return null;
  return { ...input, accountId: value.accountId, profileId: value.profileId, revision: value.revision };
}
async function receipt<T>(options: Parameters<typeof readReceipt<T>>[0]): Promise<Ishod<T>> {
  const result = await readReceipt(options);
  if (!result.ok && result.kod === 'AUTH_ACCOUNT_CHANGED') return failure(result.kod, 'Nalog je promenjen. Ponovo otvorite dostupnost.');
  if (!result.ok && result.kod === 'AUTH_REQUIRED') return failure(result.kod, COPY.AUTH_REQUIRED);
  return result;
}
/** One existing account-owned transport. Never retries writes or infers push readiness. */
export const workerAvailabilityClientService = {
  read(): Promise<Ishod<WorkerAvailability>> {
    const accountId = sesijaSada().user?.id;
    return receipt({ rpc: 'rpc_get_worker_availability', args: {}, errors: COPY,
      fallback: 'WORKER_AVAILABILITY_READ_FAILED', invalid: INVALID,
      decode: raw => decode(raw, accountId) });
  },
  save(command: AvailabilitySave): Promise<Ishod<AvailabilityReceipt>> {
    const value = normalizeWorkerAvailability(command?.value);
    if (!value || !availabilityRevision(command?.expectedRevision)) {
      return Promise.resolve(failure('AVAILABILITY_INPUT_INVALID', COPY.AVAILABILITY_INPUT_INVALID));
    }
    const accountId = sesijaSada().user?.id;
    return receipt({ rpc: 'rpc_save_worker_availability',
      args: { p_expected_revision: command.expectedRevision, p_value: value }, errors: COPY,
      fallback: 'WORKER_AVAILABILITY_SAVE_UNCONFIRMED', invalid: INVALID, write: true,
      decode(raw): AvailabilityReceipt | null {
        const result = record(raw);
        if (!result || result.saved !== true || typeof result.idempotentReplay !== 'boolean') return null;
        const availability = decode(result.availability, accountId);
        if (!availability || !sameWorkerAvailability(value, availability)) return null;
        return { saved: true, idempotentReplay: result.idempotentReplay, availability };
      },
    });
  },
};
