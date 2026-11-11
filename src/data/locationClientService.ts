import type { NeedLocationReceipt, NeedLocationReview, NeedLocationSave, WorkerLocation, WorkerLocationReceipt, WorkerLocationSave } from '../contracts/location';
import { coarsePosition, locationText, locationPrivateText, normalizeResolvedLocation, normalizeTaskGeography, locationRevision, normalizeNeedLocation, normalizeWorkerLocation, sameNeedLocation, sameWorkerLocation } from '../lib/location';
import { countryCode } from '../lib/market';
import { sesijaSada } from '../store/sesija';
import type { Ishod } from './ports';
import { failure, readReceipt, record, sameId, uuid } from './serverReceipt';

const COPY: Readonly<Record<string, string>> = {
  AUTH_REQUIRED: 'Prijavi se da urediš lokaciju.',
  LOCATION_COUNTRY_UNAVAILABLE: 'U ovoj državi priprema lokacije trenutno nije dostupna.',
  LOCATION_COUNTRY_REQUIRED: 'Izaberi državu lokacije pre čuvanja.',
  LOCATION_INPUT_INVALID: 'Proveri javno mesto, privatnu adresu i način rada.',
  LOCATION_CONFIRMATION_REQUIRED: 'Potvrdi lokaciju pre čuvanja.',
  LOCATION_REVIEW_NOT_FOUND: 'Priprema zadatka nije pronađena.',
  LOCATION_REVIEW_NOT_EDITABLE: 'Ova priprema zadatka više ne može da se menja.',
  LOCATION_VERSION_CONFLICT: 'Lokacija je u međuvremenu promenjena. Učitaj novo stanje pre čuvanja.',
  LOCATION_BINDING_CHANGED: 'Mesto je promenjeno. Ponovo označi i potvrdi tačke na mapi.',
  WORKER_PROFILE_REQUIRED: 'Najpre sačuvaj svoj radni profil.',
  WORKER_PROFILE_RESTRICTED: 'Lokacija ovog profila trenutno ne može da se menja.',
  WORKER_AREA_REQUIRES_CONVERSATION: 'Područje rada sada menjaš u razgovoru za radni profil.',
};
const INVALID = 'LOCATION_INVALID_RESPONSE';
function review(raw: unknown, accountId: string | undefined, conversationId: string): NeedLocationReview | null {
  const input = record(raw), val = record(input?.value);
  if (!input || !val || !accountId || !sameId(input.accountId, accountId) || !sameId(input.conversationId, conversationId)
    || !locationRevision(input.revision) || typeof input.editable !== 'boolean' || typeof input.confirmed !== 'boolean') return null;
  const taskCountryCode = val.taskCountryCode == null ? null : countryCode(val.taskCountryCode);
  const geography = val.geography === null ? null : normalizeTaskGeography(val.geography);
  const exactAddress = locationPrivateText(val.exactAddress, 1000);
  const accessNotes = locationPrivateText(val.accessNotes, 2000);
  if ((val.taskCountryCode != null && (!taskCountryCode || val.taskCountryCode !== taskCountryCode)) || (val.geography !== null && !geography) || exactAddress === undefined || accessNotes === undefined
    || (input.confirmed && !geography)) return null;
  const resolvedLocation = val.resolvedLocation == null ? null : taskCountryCode && geography
    ? normalizeResolvedLocation(val.resolvedLocation, { taskCountryCode, geography, exactAddress }) : undefined;
  if (resolvedLocation === undefined) return null;
  return { accountId: input.accountId, conversationId: input.conversationId, revision: input.revision,
    editable: input.editable, confirmed: input.confirmed && taskCountryCode !== null, value: { taskCountryCode, geography, exactAddress, accessNotes, resolvedLocation } };
}
function worker(raw: unknown, accountId: string | undefined): WorkerLocation | null {
  const input = record(raw);
  if (!input || !accountId || !sameId(input.accountId, accountId) || !uuid(input.profileId) || !locationRevision(input.revision)) return null;
  if (input.operatingCountryCode == null) {
    // Decode legacy coordinates without assigning an operating country.
    const partial = record(input);
    const position = partial?.approximatePosition === null ? null : coarsePosition(partial?.approximatePosition);
    const city = partial?.city === '' ? '' : locationText(partial?.city, 160);
    if (!partial || city === null || typeof partial.radiusKm !== 'number' || !Number.isInteger(partial.radiusKm)
      || partial.radiusKm < 1 || partial.radiusKm > 200 || (partial.approximatePosition !== null && !position)) return null;
    return { operatingCountryCode: null, city, radiusKm: partial.radiusKm, approximatePosition: position,
      profileId: input.profileId, accountId: input.accountId, revision: input.revision };
  }
  if (input.operatingCountryCode !== countryCode(input.operatingCountryCode)) return null;
  const value = normalizeWorkerLocation({ operatingCountryCode: input.operatingCountryCode, city: input.city, radiusKm: input.radiusKm, approximatePosition: input.approximatePosition }, true);
  return value ? { ...value, profileId: input.profileId, accountId: input.accountId, revision: input.revision } : null;
}
async function receipt<T>(options: Parameters<typeof readReceipt<T>>[0]): Promise<Ishod<T>> {
  const result = await readReceipt(options);
  if (!result.ok && result.kod === 'AUTH_ACCOUNT_CHANGED') return failure(result.kod, 'Nalog je promenjen. Ponovo otvori lokaciju.');
  if (!result.ok && result.kod === 'AUTH_REQUIRED') return failure(result.kod, COPY.AUTH_REQUIRED);
  return result;
}
const invalidInput = () => Promise.resolve(failure('LOCATION_INPUT_INVALID', COPY.LOCATION_INPUT_INVALID));

/** The location editor confirms existing V2 facts. Only the existing reviewed save creates a draft. */
export const needLocationClientService = {
  read(conversationId: string): Promise<Ishod<NeedLocationReview>> {
    if (!uuid(conversationId)) return invalidInput();
    const account = sesijaSada().user?.id;
    return receipt({ rpc: 'rpc_get_need_location_review', args: { p_conversation_id: conversationId }, errors: COPY,
      fallback: 'NEED_LOCATION_READ_FAILED', invalid: INVALID, decode: raw => review(raw, account, conversationId) });
  },
  save(command: NeedLocationSave): Promise<Ishod<NeedLocationReceipt>> {
    const value = normalizeNeedLocation(command?.value);
    if (!uuid(command?.conversationId) || !locationRevision(command?.expectedRevision) || !value) return invalidInput();
    if (command.confirmed !== true) return Promise.resolve(failure('LOCATION_CONFIRMATION_REQUIRED', COPY.LOCATION_CONFIRMATION_REQUIRED));
    const account = sesijaSada().user?.id;
    const conversationId = command.conversationId;
    return receipt({ rpc: 'rpc_save_need_location_review', args: { p_conversation_id: conversationId,
      p_expected_revision: command.expectedRevision, p_confirmed: true, p_value: value }, errors: COPY,
      fallback: 'NEED_LOCATION_SAVE_UNCONFIRMED', invalid: INVALID, write: true,
      decode(raw): NeedLocationReceipt | null {
        const input = record(raw), result = review(input?.review, account, conversationId);
        if (!input || input.saved !== true || typeof input.idempotentReplay !== 'boolean' || !result
          || !result.confirmed || !result.editable || !sameNeedLocation(value, result.value)) return null;
        return { saved: true, idempotentReplay: input.idempotentReplay, review: result };
      } });
  },
};
export const workerLocationClientService = {
  read(): Promise<Ishod<WorkerLocation>> {
    const account = sesijaSada().user?.id;
    return receipt({ rpc: 'rpc_get_worker_location', args: {}, errors: COPY,
      fallback: 'WORKER_LOCATION_READ_FAILED', invalid: INVALID, decode: raw => worker(raw, account) });
  },
  save(command: WorkerLocationSave): Promise<Ishod<WorkerLocationReceipt>> {
    const value = normalizeWorkerLocation(command?.value);
    if (!value || !locationRevision(command?.expectedRevision)) return invalidInput();
    if (command.confirmed !== true) return Promise.resolve(failure('LOCATION_CONFIRMATION_REQUIRED', COPY.LOCATION_CONFIRMATION_REQUIRED));
    const account = sesijaSada().user?.id;
    return receipt({ rpc: 'rpc_save_worker_location', args: { p_expected_revision: command.expectedRevision, p_confirmed: true, p_value: value },
      errors: COPY, fallback: 'WORKER_LOCATION_SAVE_UNCONFIRMED', invalid: INVALID, write: true,
      decode(raw): WorkerLocationReceipt | null {
        const input = record(raw), location = worker(input?.location, account);
        if (!input || input.saved !== true || typeof input.idempotentReplay !== 'boolean' || !location || !sameWorkerLocation(value, { operatingCountryCode: location.operatingCountryCode, city: location.city, radiusKm: location.radiusKm, approximatePosition: location.approximatePosition })) return null;
        return { saved: true, idempotentReplay: input.idempotentReplay, location };
      } });
  },
};
