import type { Izvor } from './ports';
import { failure, readReceipt, uuid } from './serverReceipt';

type ResponseClientService = Pick<Izvor, 'oznaciPrijavuVidjenom'>;
const errors = {
  AUTH_REQUIRED: 'Prijavi se da otvoriš prijavu.',
  NOT_REQUESTER: 'Ova prijava ne pripada tvom zadatku.',
  RESPONSE_NOT_FOUND: 'Prijava više nije dostupna.',
  RESPONSE_NOT_SUBMITTED: 'Ova prijava još nije poslata.',
  ACCOUNT_CLOSURE_RESTRICTED: 'Promene nisu dostupne dok traje zatvaranje naloga.',
};

/** One intentional offer opening. The server owns the first-view timestamp
 * and event deduplication; a transport timeout never causes an automatic replay. */
export const responseClientService: ResponseClientService = {
  async oznaciPrijavuVidjenom(prijavaId) {
    if (!uuid(prijavaId)) return failure('RESPONSE_ID_INVALID', 'Ponovo otvori prijavu iz svog zadatka.');
    const result = await readReceipt({
      rpc: 'rpc_mark_response_viewed', args: { p_response_id: prijavaId },
      errors, fallback: 'RESPONSE_VIEW_UNCONFIRMED', invalid: 'RESPONSE_VIEW_INVALID_RECEIPT', write: true,
      // PostgREST returns JSON null for the canonical void RPC. Map its checked
      // acknowledgement internally; retain the existing public Ishod<null> DTO.
      decode: raw => raw === null ? true : null,
    });
    return result.ok ? { ok: true, podatak: null } : result;
  },
};
