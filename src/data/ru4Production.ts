import { legacyRpcFailure } from './legacyRpcFailure';
import type { Ishod } from './ports';
import { failure, positiveInteger, record, sameId } from './serverReceipt';
import { supabaseKlijent } from './supabaseClient';

const supabase = new Proxy({} as ReturnType<typeof supabaseKlijent>, {
  get: (_target, prop) => (supabaseKlijent() as never)[prop],
});

function fail<T>(error: unknown, fallbackCode: string, fallbackMessage: string): Ishod<T> {
  return legacyRpcFailure(error, fallbackCode, fallbackMessage);
}
const isoInstant = (value: unknown): value is string => typeof value === 'string'
  && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value)
  && Number.isFinite(Date.parse(value));

// PKG-036: audited against the live remaining-search writer. Keep the retry-key
// wording local: a close-search command is not an application/offer command.
const remainingSearchErrors: Readonly<Record<string, string>> = {
  AUTH_REQUIRED: 'Prijavi se da nastaviš.',
  ACCOUNT_CLOSING: 'Radnja je zaustavljena zbog postupka zatvaranja naloga. Osveži prikaz.',
  NEED_ID_REVISION_REQUIRED: 'Ponovo otvori zadatak i pregledaj aktuelne podatke.',
  CLIENT_REQUEST_ID_INVALID: 'Zahtev nije spreman. Ponovo otvori zadatak.',
  IDEMPOTENCY_KEY_REUSED: 'Ovaj zahtev već pripada drugoj radnji. Učitaj aktuelno stanje zadatka.',
  NEED_NOT_FOUND: 'Zadatak nije dostupan.',
  NEED_NOT_OWNED: 'Potragu može da zatvori samo osoba koja je objavila zadatak.',
  STALE_REVIEW_REQUIRED: 'Zadatak je izmenjen. Pregledaj važeće uslove.',
  REMAINING_SEARCH_CLOSE_REQUIRES_DOGOVOR: 'Najpre izaberi prijavu i napravi Dogovor. Ako odustaješ od celog zadatka, otkaži zadatak.',
  NEED_REMAINING_SEARCH_NOT_OPEN: 'Ovaj zadatak više nema otvorenu potragu. Učitaj aktuelno stanje.',
  REMAINING_SEARCH_CLOSE_REQUIRES_SELECTED_CAPACITY: 'Trenutno nema izabranih ljudi. Pregledaj Dogovore i prijave pre zatvaranja potrage.',
  NO_REMAINING_SEARCH: 'Sva mesta su već popunjena. Učitaj aktuelno stanje zadatka.',
};
export const knownRemainingSearchRefusal = (kod: string) => Object.prototype.hasOwnProperty.call(remainingSearchErrors, kod);

export type RemainingSearchCloseReceipt = {
  needId: string;
  revision: number;
  requiredSlots: number;
  closedRemainingSlots: number | null;
  remainingSearchClosed: true;
  closedAt: string;
  idempotentReplay: boolean;
  authoritative: true;
};

export type Ru4RazresiPrijavuInput = {
  prijavaId: string;
  ocekivanaVerzija: number;
  ocekivanaPotrebaRevizija: number;
  clientRequestId: string;
  akcija: 'KEEP' | 'UPDATE' | 'WITHDRAW';
  pokrivenaMesta?: number | null;
  cenaRsd?: number | null;
  predlozeniPocetak?: string | null;
  predlozeniKraj?: string | null;
  napomena?: string | null;
};

export const ru4Production = {
  async remainingSearchState(needId: string): Promise<{ closed: boolean; closedAt: string | null }> {
    const { data, error } = await supabase
      .from('needs')
      .select('remaining_search_closed_at')
      .eq('id', needId)
      .maybeSingle();
    if (error || !data || !Object.hasOwn(data, 'remaining_search_closed_at')) throw new Error('REMAINING_SEARCH_STATE_READ_FAILED');
    const raw = data.remaining_search_closed_at;
    if (raw !== null && !isoInstant(raw)) throw new Error('REMAINING_SEARCH_STATE_INVALID');
    return { closed: raw !== null, closedAt: raw };
  },

  async closeRemainingSearch(
    needId: string,
    expectedRevision: number,
    clientRequestId: string,
    reason = '',
  ): Promise<Ishod<RemainingSearchCloseReceipt>> {
    const { data, error } = await supabase.rpc('rpc_close_remaining_search', {
      p_need_id: needId,
      p_expected_revision: expectedRevision,
      p_client_request_id: clientRequestId,
      p_reason: reason,
    });
    if (error) {
      const code = record(error)?.message;
      return typeof code === 'string' && knownRemainingSearchRefusal(code)
        ? failure(code, remainingSearchErrors[code])
        : failure('REMAINING_SEARCH_CLOSE_FAILED', 'Potraga nije potvrđeno zatvorena. Učitaj trenutno stanje.');
    }
    const receipt = record(data);
    if (!receipt || receipt.authoritative !== true || receipt.remainingSearchClosed !== true
      || !sameId(receipt.needId, needId) || !positiveInteger(receipt.revision) || receipt.revision !== expectedRevision
      || !positiveInteger(receipt.requiredSlots) || !isoInstant(receipt.closedAt)
      || typeof receipt.idempotentReplay !== 'boolean') {
      return failure('REMAINING_SEARCH_CLOSE_INVALID_RESPONSE', 'Potvrda zatvaranja preostale potrage nije stigla.');
    }
    const rawClosed = receipt.closedRemainingSlots;
    const closedRemainingSlots = rawClosed === undefined && receipt.idempotentReplay === true ? null
      : typeof rawClosed === 'number' && Number.isSafeInteger(rawClosed) && rawClosed > 0 ? rawClosed : undefined;
    if (closedRemainingSlots === undefined) {
      return failure('REMAINING_SEARCH_CLOSE_INVALID_RESPONSE', 'Potvrda zatvaranja preostale potrage nije stigla.');
    }
    return { ok: true, podatak: {
      needId: receipt.needId,
      revision: receipt.revision,
      requiredSlots: receipt.requiredSlots,
      closedRemainingSlots,
      remainingSearchClosed: true,
      closedAt: receipt.closedAt,
      idempotentReplay: receipt.idempotentReplay,
      authoritative: true,
    } };
  },

  async resolveChangedApplication(input: Ru4RazresiPrijavuInput): Promise<Ishod<{ status: string; version: number; priceBasis?: 'TOTAL' | 'HOURLY' }>> {
    const { data, error } = await supabase.rpc('rpc_resolve_stale_response_after_need_edit', {
      p_response_id: input.prijavaId,
      p_expected_response_version: input.ocekivanaVerzija,
      p_expected_need_revision: input.ocekivanaPotrebaRevizija,
      p_client_request_id: input.clientRequestId,
      p_action: input.akcija,
      p_covered_slots: input.pokrivenaMesta ?? null,
      p_price_rsd: input.cenaRsd ?? null,
      p_proposed_start_at: input.predlozeniPocetak ?? null,
      p_proposed_end_at: input.predlozeniKraj ?? null,
      p_scope_note: input.napomena ?? null,
    });
    if (error) return fail(error, 'STALE_RESPONSE_RESOLUTION_FAILED', 'Prijava nije mogla da se uskladi sa izmenjenim zadatkom.');
    const receipt = record(data);
    const expectedStatus = input.akcija === 'WITHDRAW' ? 'WITHDRAWN' : 'SUBMITTED';
    // A missing version/status is UNKNOWN, never an accepted command. Do not infer the response version from the request.
    if (!receipt || receipt.status !== expectedStatus || !positiveInteger(receipt.version)
      || (receipt.applicationPriceBasis != null && receipt.applicationPriceBasis !== 'TOTAL' && receipt.applicationPriceBasis !== 'HOURLY')) {
      return failure('STALE_RESPONSE_RESOLUTION_UNCONFIRMED', 'Ishod usklađivanja prijave nije potvrđen. Osveži listu.');
    }
    return {
      ok: true,
      podatak: {
        ...(receipt.applicationPriceBasis == null ? {} : { priceBasis: receipt.applicationPriceBasis }),
        status: expectedStatus,
        version: receipt.version,
      },
    };
  },
};
