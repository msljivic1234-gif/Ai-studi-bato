import type { MojaPrijavaProjekcija } from '../contracts/projections';
import { calendarInstant } from '../lib/calendarTime';
import { sesijaSada } from '../store/sesija';
import { failure, positiveInteger, readOwnedResult, record, sameId, timestamp, uuid } from './serverReceipt';
import { supabaseKlijent } from './supabaseClient';

export type ApplicationEditPricing = {
  rezimCene: 'MY_PRICE' | 'OFFERS'; osnovaCene?: 'TOTAL' | 'PER_PERSON' | 'HOURLY';
  ponudjenaCena?: { iznos: number }; pokrivenost: { ukupno: number };
};
export type ExistingApplicationInterval = { start: string | null; end: string | null; pricing: ApplicationEditPricing };
export type ApplicationCommandState = {
  applicationId: string; needId: string; version: number; submittedNeedRevision: number;
  status: string; priceRsd: number; priceBasis?: 'TOTAL' | 'HOURLY'; coveredSlots: number; scopeNote: string;
  proposedStartAt: string | null; proposedEndAt: string | null;
};
const persistedStatuses = new Set(['SUBMITTED', 'DELIVERED', 'VIEWED', 'SHORTLISTED', 'SELECTED',
  'NOT_SELECTED', 'WITHDRAWN', 'EXPIRED', 'STALE', 'STALE_REVIEW_REQUIRED']);

/** Read the named command subject, never infer its outcome from a list/page.
 * These are persisted command facts, NOT a replacement for the server's UI
 * lifecycle projection. No Need join: an own response remains readable even
 * when the task is no longer public. Worker RLS and the restrictive account
 * closure policy still apply; no new RPC, authority, grant or write is added. */
export function readApplicationCommandState(p: Pick<MojaPrijavaProjekcija, 'prijavaId' | 'potrebaId' | 'prijavaVerzija'>) {
  const owner = sesijaSada(), accountId = owner.user?.id;
  if (!accountId || !uuid(p.prijavaId) || !uuid(p.potrebaId) || !positiveInteger(p.prijavaVerzija)) {
    return Promise.resolve(failure('APPLICATION_STATE_UNAVAILABLE', 'Ne možemo da vidimo trenutno stanje prijave. Osveži listu.'));
  }
  return readOwnedResult<ApplicationCommandState>({ account: { accountId, accountRevision: owner.accountRevision },
    errors: {}, fallback: 'APPLICATION_STATE_UNAVAILABLE', invalid: 'APPLICATION_STATE_INVALID',
    request: () => supabaseKlijent().from('marketplace_responses')
      .select('id,need_id,worker_account_id,current_version,submitted_against_need_revision,status,price_rsd,price_basis,covered_slots,scope_note,proposed_start_at,proposed_end_at')
      .eq('id', p.prijavaId).eq('need_id', p.potrebaId).eq('worker_account_id', accountId).maybeSingle(),
    decode(raw) {
      const row = record(raw);
      if (!row || !sameId(row.id, p.prijavaId) || !sameId(row.need_id, p.potrebaId) || row.worker_account_id !== accountId ||
          !positiveInteger(row.current_version) || row.current_version < p.prijavaVerzija ||
          !positiveInteger(row.submitted_against_need_revision) || typeof row.status !== 'string' || !persistedStatuses.has(row.status) ||
          row.price_basis != null && row.price_basis !== 'TOTAL' && row.price_basis !== 'HOURLY' ||
          !positiveInteger(row.price_rsd) || !positiveInteger(row.covered_slots) || row.covered_slots > 50 ||
          row.scope_note !== null && typeof row.scope_note !== 'string') return null;
      const start = row.proposed_start_at, end = row.proposed_end_at;
      if (start !== null || end !== null) {
        const from = calendarInstant(start), to = calendarInstant(end);
        if (typeof start !== 'string' || typeof end !== 'string' || from === null || to === null || from >= to) return null;
      }
      return { applicationId: row.id, needId: row.need_id, version: row.current_version,
        submittedNeedRevision: row.submitted_against_need_revision, status: row.status,
        priceRsd: row.price_rsd, ...(row.price_basis == null ? {} : { priceBasis: row.price_basis }), coveredSlots: row.covered_slots, scopeNote: row.scope_note ?? '',
        proposedStartAt: start as string | null, proposedEndAt: end as string | null };
    },
  });
}

/** UPDATE replaces the whole offer. Read the existing owned, version-bound
 * interval instead of interpreting the list's formatted Need time as an offer.
 * Existing response/Need SELECT policies remain the authority. */
export function readExistingApplicationInterval(p: MojaPrijavaProjekcija) {
  const owner = sesijaSada(), accountId = owner.user?.id;
  if (!accountId || !uuid(p.prijavaId) || !uuid(p.potrebaId) || !positiveInteger(p.prijavaVerzija) ||
      !positiveInteger(p.potrebaRevizija) || !positiveInteger(p.prijavaRevizija)) {
    return Promise.resolve(failure('APPLICATION_INTERVAL_UNAVAILABLE', 'Ponovo otvori trenutnu prijavu.'));
  }
  return readOwnedResult<ExistingApplicationInterval>({ account: { accountId, accountRevision: owner.accountRevision },
    errors: {}, fallback: 'APPLICATION_INTERVAL_UNAVAILABLE', invalid: 'APPLICATION_INTERVAL_CHANGED',
    request: () => supabaseKlijent().from('marketplace_responses')
      .select('id,need_id,worker_account_id,current_version,submitted_against_need_revision,status,price_basis,proposed_start_at,proposed_end_at,needs!inner(id,revision,mode,requester_price_rsd,price_basis,required_slots)')
      .eq('id', p.prijavaId).eq('need_id', p.potrebaId).eq('worker_account_id', accountId)
      .eq('current_version', p.prijavaVerzija).eq('needs.revision', p.potrebaRevizija).maybeSingle(),
    decode(raw) {
      const row = record(raw), need = record(row?.needs);
      if (!row || !need || !sameId(row.id, p.prijavaId) || !sameId(row.need_id, p.potrebaId) ||
          row.worker_account_id !== accountId || row.current_version !== p.prijavaVerzija ||
          row.submitted_against_need_revision !== p.prijavaRevizija ||
          !(row.status === 'STALE_REVIEW_REQUIRED' || p.osnovicaZaProveru === true && row.price_basis === null
            && ['SUBMITTED', 'DELIVERED', 'VIEWED', 'SHORTLISTED', 'STALE'].includes(String(row.status))) ||
          !sameId(need.id, p.potrebaId) || need.revision !== p.potrebaRevizija) return null;
      const start = row.proposed_start_at, end = row.proposed_end_at;
      if ((start === null) !== (end === null) || start !== null && !timestamp(start) || end !== null && !timestamp(end)) return null;
      if (start !== null && end !== null && calendarInstant(start)! >= calendarInstant(end)!) return null;
      // Read the price rule from the SAME current Need revision as the saved interval, never from the old offer.
      if (need.mode !== 'MY_PRICE' && need.mode !== 'OFFERS' || !positiveInteger(need.required_slots) || need.required_slots > 50 ||
          need.price_basis !== null && need.price_basis !== 'TOTAL' && need.price_basis !== 'PER_PERSON' && need.price_basis !== 'HOURLY' ||
          need.mode === 'OFFERS' && need.price_basis !== null || need.mode === 'MY_PRICE' && !positiveInteger(need.requester_price_rsd)) return null;
      const pricing: ApplicationEditPricing = { rezimCene: need.mode, pokrivenost: { ukupno: need.required_slots },
        ...(need.price_basis === null ? {} : { osnovaCene: need.price_basis as 'TOTAL' | 'PER_PERSON' | 'HOURLY' }),
        ...(need.mode === 'MY_PRICE' ? { ponudjenaCena: { iznos: need.requester_price_rsd as number } } : {}) };
      return { start, end, pricing };
    },
  });
}
