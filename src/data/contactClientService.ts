import type { Ishod, Izvor } from './ports';
import { supabaseKlijent } from './supabaseClient';
import type { ExactLocationReveal, LocationGrant, LocationGrantState } from '../contracts/contact';
import { locationPrivateText, normalizeNeedLocation } from '../lib/location';
import { sesijaSada } from '../store/sesija';
import { failure, positiveInteger, readOwnedResult, readReceipt, record, sameId, timestamp, uuid } from './serverReceipt';

type ContactClientService = Pick<Izvor, 'podeliTelefon' | 'opoziviTelefon' | 'otkrijTacnuLokaciju'
  | 'lokacijskaDozvola' | 'podeliTacnuLokaciju' | 'opoziviTacnuLokaciju'>;

const locationErrors = {
  AUTH_REQUIRED: 'Prijavi se da nastaviš.',
  NOT_PARTY: 'Lokacija je dostupna samo učesnicima Dogovora.',
  AGREEMENT_NOT_FOUND: 'Dogovor nije dostupan.',
  AGREEMENT_NOT_ACTIVE: 'Privatna lokacija je dostupna samo dok je Dogovor aktivan.',
  NO_ACTIVE_GRANT: 'Dozvola za prikaz lokacije nije aktivna. Osveži prikaz.',
  LOCATION_NOT_SET: 'Privatna lokacija još nije postavljena.',
  LOCATION_BINDING_CHANGED: 'Lokacija je promenjena. Osveži Dogovor.',
  GRANT_NOT_FROM_DATA_OWNER: 'Lokaciju može da podeli njen vlasnik.',
  GRANT_NOT_OWNABLE: 'Lokaciju može da podeli njen vlasnik.',
  GRANT_NOT_TO_COUNTERPARTY: 'Dozvola ne pripada ovom učesniku Dogovora.',
  NO_PHYSICAL_LOCATION: 'Ovaj Dogovor nema fizičku lokaciju.',
};
const validExpiry = (value: unknown): value is string | null => value === null || (timestamp(value) && Date.parse(value) > Date.now());

function reveal(raw: unknown, agreementId: string, accountId: string): ExactLocationReveal | null {
  const data = record(raw);
  if (!data || data.authoritative !== true || data.channel !== 'EXACT_LOCATION' || !sameId(data.agreementId, agreementId)
    || !uuid(data.needId) || !positiveInteger(data.needRevision) || !uuid(data.grantId) || !uuid(data.ownerAccountId)
    || sameId(data.ownerAccountId, accountId) || !timestamp(data.grantedAt) || !validExpiry(data.expiresAt)) return null;
  // Canonical legacy scalar storage uses '' for an absent global address.
  const privateText = (value: unknown, max: number) => typeof value === 'string' && !value.replace(/^ +| +$/g, '')
    ? null : locationPrivateText(value, max);
  const adresa = privateText(data.exactAddress, 1000), accessNotes = privateText(data.accessNotes, 2000);
  if (adresa === undefined || accessNotes === undefined) return null;
  let resolvedLocation: ExactLocationReveal['resolvedLocation'] = null;
  if (data.resolvedLocation !== null) {
    const envelope = record(data.resolvedLocation), value = record(envelope?.value), binding = record(value?.binding);
    if (!envelope || !binding || !sameId(envelope.confirmedByAccountId, data.ownerAccountId) || !timestamp(envelope.confirmedAt)) return null;
    const normalized = normalizeNeedLocation({ ...binding, accessNotes, resolvedLocation: value });
    if (!normalized?.resolvedLocation || normalized.exactAddress !== adresa) return null;
    resolvedLocation = { value: normalized.resolvedLocation, confirmedByAccountId: envelope.confirmedByAccountId, confirmedAt: envelope.confirmedAt };
  }
  const lat = data.exactLat, lng = data.exactLng;
  const exactPosition = lat === null && lng === null ? null
    : typeof lat === 'number' && typeof lng === 'number' && Number.isFinite(lat) && Number.isFinite(lng)
      && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 ? { latitude: lat, longitude: lng } : undefined;
  if (exactPosition === undefined || (!adresa && !resolvedLocation)) return null;
  if (resolvedLocation) {
    const start = resolvedLocation.value.points.find(point => point.slot === 'start');
    if (start ? exactPosition?.latitude !== start.latitudeE6 / 1e6 || exactPosition?.longitude !== start.longitudeE6 / 1e6 : exactPosition !== null) return null;
  }
  return { authoritative: true, agreementId, needId: data.needId, needRevision: data.needRevision, grantId: data.grantId,
    ownerAccountId: data.ownerAccountId, grantedAt: data.grantedAt, expiresAt: data.expiresAt, adresa, accessNotes, exactPosition, resolvedLocation };
}

async function setLocationGrant(agreementId: string, granted: boolean): Promise<Ishod<null>> {
  if (!uuid(agreementId)) return failure('AGREEMENT_NOT_FOUND', 'Dogovor nije dostupan.');
  const accountId = sesijaSada().user?.id;
  const result = await readReceipt({ rpc: 'rpc_set_contact_grant',
    args: { p_agreement_id: agreementId, p_channel: 'EXACT_LOCATION', p_granted: granted }, write: true,
    errors: locationErrors, fallback: 'LOCATION_GRANT_UNCONFIRMED', invalid: 'LOCATION_GRANT_INVALID',
    decode: raw => {
      const data = record(raw);
      return data?.authoritative === true && data.channel === 'EXACT_LOCATION' && sameId(data.agreementId, agreementId)
        && !!accountId && sameId(data.grantedByAccountId, accountId) && uuid(data.grantedToAccountId)
        && !sameId(data.grantedToAccountId, accountId) && data.granted === granted
        && (uuid(data.grantId) || (!granted && data.grantId === null)) ? { accepted: true } : null;
    } });
  return result.ok ? { ok: true, podatak: null } : result;
}

/**
 * Canonical production boundary for contact/privacy operations migrated so far.
 * Backend authority remains in canonical grant/reveal RPCs; this service preserves
 * the already-active request/error contract without adding client-side authority.
 */
export const contactClientService: ContactClientService = {
  async podeliTelefon(_dogovorId) {
    // Messages-only policy: never send a legacy PHONE-grant RPC, even while
    // an older server deployment still accepts it. Revocation remains below.
    return failure('PHONE_SHARING_DISABLED', 'Brojevi telefona se ne dele. Koristite poruke u aplikaciji.');
  },

  async opoziviTelefon(dogovorId) {
    // Historical PHONE revocation remains available. A void ACK or lost write
    // must not be called successful; only the owned server receipt confirms it.
    if (!uuid(dogovorId)) return failure('AGREEMENT_NOT_FOUND', 'Dogovor nije dostupan.');
    const accountId = sesijaSada().user?.id;
    const result = await readReceipt({
      rpc: 'rpc_set_contact_grant',
      args: { p_agreement_id: dogovorId, p_channel: 'PHONE', p_granted: false },
      write: true,
      errors: { AUTH_REQUIRED: 'Prijavite se da nastavite.', NOT_PARTY: 'Niste učesnik ovog Dogovora.',
        AGREEMENT_NOT_FOUND: 'Dogovor nije dostupan.' },
      fallback: 'PHONE_REVOKE_UNCONFIRMED', invalid: 'PHONE_REVOKE_INVALID',
      decode: raw => {
        const data = record(raw);
        return data?.authoritative === true && data.channel === 'PHONE'
          && sameId(data.agreementId, dogovorId) && !!accountId
          && sameId(data.grantedByAccountId, accountId)
          && uuid(data.grantedToAccountId) && !sameId(data.grantedToAccountId, accountId)
          && data.granted === false
          && (uuid(data.grantId) || data.grantId === null) ? { accepted: true } : null;
      },
    });
    return result.ok ? { ok: true, podatak: null } : result;
  },

  async lokacijskaDozvola(dogovorId) {
    if (!uuid(dogovorId)) return failure('AGREEMENT_NOT_FOUND', 'Dogovor nije dostupan.');
    const accountId = sesijaSada().user?.id;
    return readOwnedResult<LocationGrantState>({
      request: () => supabaseKlijent().from('access_grants')
        .select('id,agreement_id,channel,granted_by_account_id,granted_to_account_id,status,granted_at,expires_at')
        .eq('agreement_id', dogovorId).eq('channel', 'EXACT_LOCATION').limit(2),
      errors: locationErrors, fallback: 'LOCATION_GRANT_READ_FAILED', invalid: 'LOCATION_GRANT_READ_INVALID',
      decode: raw => {
        if (!accountId || !Array.isArray(raw) || raw.length > 1) return null;
        const grants: LocationGrant[] = [];
        for (const value of raw) {
          const row = record(value);
          if (!row || !uuid(row.id) || !sameId(row.agreement_id, dogovorId) || row.channel !== 'EXACT_LOCATION'
            || !uuid(row.granted_by_account_id) || !uuid(row.granted_to_account_id)
            || sameId(row.granted_by_account_id, row.granted_to_account_id)
            || (!sameId(row.granted_by_account_id, accountId) && !sameId(row.granted_to_account_id, accountId))
            || !['GRANTED', 'REVOKED'].includes(String(row.status)) || !timestamp(row.granted_at)
            || (row.expires_at !== null && !timestamp(row.expires_at))) return null;
          grants.push({ id: row.id, ownerAccountId: row.granted_by_account_id, recipientAccountId: row.granted_to_account_id,
            status: row.status as LocationGrant['status'], grantedAt: row.granted_at, expiresAt: row.expires_at as string | null });
        }
        return { agreementId: dogovorId, accountId, grants };
      },
    });
  },
  async podeliTacnuLokaciju(dogovorId) { return setLocationGrant(dogovorId, true); },
  async opoziviTacnuLokaciju(dogovorId) { return setLocationGrant(dogovorId, false); },
  async otkrijTacnuLokaciju(dogovorId) {
    if (!uuid(dogovorId)) return failure('AGREEMENT_NOT_FOUND', 'Dogovor nije dostupan.');
    const accountId = sesijaSada().user?.id;
    return readReceipt({ rpc: 'rpc_reveal_contact', args: { p_agreement_id: dogovorId, p_channel: 'EXACT_LOCATION' },
      errors: locationErrors, fallback: 'LOCATION_REVEAL_FAILED', invalid: 'LOCATION_REVEAL_INVALID',
      decode: raw => accountId ? reveal(raw, dogovorId, accountId) : null });
  },
};
