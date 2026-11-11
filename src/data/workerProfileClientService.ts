import { workerCapacityRevision, workerCapacityValue } from '../contracts/workerCapacity';
import { workerCapacityClientService } from './workerCapacityClientService';
import type { AzurirajProfilKomanda, Ishod, Izvor } from './ports';
import { sesijaSada } from '../store/sesija';
import { capabilityTerms } from '../lib/capabilityTerms';
import { failure, readOwnedResult, record, sameId, uuid, type ReceiptAccount, type ReceiptOptions } from './serverReceipt';
import { supabaseKlijent } from './supabaseClient';

export type WorkerSkillAddition = Readonly<ReceiptAccount & { profileId: string; skill: string }>;
type WorkerProfileClientService = Pick<Izvor, 'azurirajRadnikProfil'> & {
  addSkill: (input: WorkerSkillAddition, stillCurrent: () => boolean) => Promise<Ishod<null>>;
};
const inFlight = new Set<string>();
const COPY: Readonly<Record<string, string>> = {
  AUTH_REQUIRED: 'Prijavi se da izmeniš profil.',
  DISPLAY_NAME_REQUIRED: 'Unesi ime pre završetka profila.',
  CITY_REQUIRED: 'Unesi mesto rada pre završetka profila.',
  SKILL_REQUIRED: 'Unesi bar jednu veštinu pre završetka profila.',
  PROFILE_NOT_ACTIVATABLE: 'Profil trenutno ne može da se aktivira.',
  PROFILE_NOT_FOUND: 'Profil nije pronađen. Osveži prikaz.',
  NOT_WORKER_PROFILE_OWNER: 'Nalog je promenjen. Ponovo otvori profil.',
  V2_FACT_TYPE_INVALID: 'Unesi najviše 50 stavki u svaku listu.',
  V2_FACT_ARRAY_ITEM_INVALID: 'Svaka stavka mora imati tekst do 500 znakova.',
  V2_FACT_VALUE_REQUIRED: 'Unesi ispravne podatke profila.',
};
const RESOURCE_FIELDS = { vestine: 'skills', alati: 'tools', vozila: 'vehicles', licence: 'licenses' } as const;
const TEXT_FIELDS = { ime: 'display_name', biografija: 'bio' } as const;

function profileRow(raw: unknown, account: string, expectedId?: string): { id: string } | null {
  const row = record(raw);
  if (!row || !uuid(row.id) || !sameId(row.account_id, account) || row.kind !== 'WORKER' ||
      (expectedId && !sameId(row.id, expectedId))) return null;
  return { id: row.id };
}

function skillRow(raw: unknown, account: string, profileId: string): string[] | null {
  const row = record(raw);
  if (!profileRow(raw, account, profileId) || !capabilityTerms(row?.skills)) return null;
  const skills = row!.skills as string[];
  // The comparison must retain the exact stored array, including spelling,
  // whitespace, order and duplicates. Validation is not a normalization step.
  return skills.some(skill => skill.includes('\0')) ? null : [...skills];
}

function textArrayLiteral(values: string[]): string {
  // PostgREST eq() stringifies its argument: neither a JS array nor JSON is a
  // PostgreSQL text[] literal. Quote each item, escaping only quotes/backslashes.
  return `{${values.map(value => `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`).join(',')}}`;
}

/** Profile capabilities/identity only; location and availability writes are refused.
 * Existing activation RPC and the same owned-result
 * fence as location/calendar/availability. Captured owner filters also protect
 * REST writes if the SDK token changes while the request is being prepared. */
export const workerProfileClientService: WorkerProfileClientService = {
  /** Optional addition after a confirmed application. Never creates/activates a
   * profile or replaces skills from the application's older profile snapshot. */
  async addSkill(input, stillCurrent) {
    const raw = record(input);
    const term = capabilityTerms([raw?.skill]);
    if (!raw || !uuid(raw.accountId) || !uuid(raw.profileId) || !Number.isSafeInteger(raw.accountRevision) ||
        !term || term[0].includes('\0')) return failure('PROFILE_INPUT_INVALID', 'Podaci za dodavanje veštine nisu ispravni.');
    const account: ReceiptAccount = { accountId: raw.accountId, accountRevision: raw.accountRevision as number };
    const profileId = raw.profileId, skill = term[0];
    const stale = () => failure('PROFILE_SKILL_INTENT_EXPIRED', 'Ponovo otvori radni profil da dodaš veštinu.');
    if (!stillCurrent()) return stale();
    const lock = `${account.accountId}:${account.accountRevision}`;
    if (inFlight.has(lock)) return failure('PROFILE_BUSY', 'Prethodno čuvanje profila se još obrađuje.');
    inFlight.add(lock);
    async function run<T>(options: Omit<ReceiptOptions<T>, 'errors'> & { request: () => PromiseLike<unknown> }): Promise<Ishod<T>> {
      if (!stillCurrent()) return stale();
      const result = await readOwnedResult({ ...options, errors: COPY, account });
      return stillCurrent() ? result : stale();
    }
    try {
      const supabase = supabaseKlijent();
      const authenticated = await run({ request: () => supabase.auth.getUser(), fallback: 'AUTH_REQUIRED', invalid: 'AUTH_ACCOUNT_CHANGED',
        decode: response => sameId(record(record(response)?.user)?.id, account.accountId) ? true : null });
      if (!authenticated.ok) return authenticated;
      // Only a confirmed zero-row CAS response permits a fresh read and retry.
      // An error, timeout or malformed receipt is never replayed here.
      for (let attempt = 0; attempt < 2; attempt++) {
        const existing = await run({
          request: () => supabase.from('app_profiles').select('id,account_id,kind,skills')
            .eq('id', profileId).eq('account_id', account.accountId).eq('kind', 'WORKER').maybeSingle(),
          fallback: 'PROFILE_READ_FAILED', invalid: 'PROFILE_INVALID_RESPONSE',
          decode: response => {
            if (response === null) return { skills: null };
            const skills = skillRow(response, account.accountId, profileId);
            return skills ? { skills } : null;
          },
        });
        if (!existing.ok) return existing;
        const skills = existing.podatak.skills;
        if (!skills) return failure('PROFILE_NOT_FOUND', COPY.PROFILE_NOT_FOUND);
        if (skills.some(value => value.trim().toLowerCase() === skill.trim().toLowerCase())) return { ok: true, podatak: null };
        if (skills.length >= 50) return failure('V2_FACT_TYPE_INVALID', COPY.V2_FACT_TYPE_INVALID);
        const merged = [...skills, skill];
        const updated = await run({
          request: () => supabase.from('app_profiles').update({ skills: merged }).eq('id', profileId)
            .eq('account_id', account.accountId).eq('kind', 'WORKER').eq('skills', textArrayLiteral(skills))
            .select('id,account_id,kind,skills'),
          fallback: 'PROFILE_UPDATE_FAILED', invalid: 'PROFILE_INVALID_RESPONSE', write: true,
          decode: response => {
            if (!Array.isArray(response) || response.length > 1) return null;
            if (response.length === 0) return { changed: false };
            const saved = skillRow(response[0], account.accountId, profileId);
            return saved && saved.length === merged.length && saved.every((value, index) => value === merged[index])
              ? { changed: true } : null;
          },
        });
        if (!updated.ok) return updated;
        if (updated.podatak.changed) return { ok: true, podatak: null };
      }
      return failure('PROFILE_SKILLS_CHANGED', 'Veštine su u međuvremenu izmenjene. Proveri ih u radnom profilu.');
    } catch {
      return failure('PROFILE_UPDATE_FAILED', 'Dodavanje veštine nije potvrđeno. Proveri radni profil.');
    } finally { inFlight.delete(lock); }
  },
  async azurirajRadnikProfil(k: AzurirajProfilKomanda): Promise<Ishod<null>> {
    const owner = sesijaSada();
    if (!owner.user) return failure('AUTH_REQUIRED', COPY.AUTH_REQUIRED);
    const account: ReceiptAccount = { accountId: owner.user.id, accountRevision: owner.accountRevision };
    const lock = `${account.accountId}:${account.accountRevision}`;
    if (inFlight.has(lock)) return failure('PROFILE_BUSY', 'Prethodno čuvanje profila se još obrađuje.');
    const input = record(k);
    if (!input || Object.keys(input).some(key => !['ime','grad','biografija','vestine','alati','vozila','licence','dostupanOdmah','radijusKm','kapacitetTima','capacityRevision','zavrsi'].includes(key))) {
      return failure('PROFILE_INPUT_INVALID', 'Podaci profila nisu ispravni.');
    }
    // Geography and availability have their own revision-bound canonical RPCs.
    // Reject old callers explicitly; never silently drop or rewrite their input.
    if (input.alati !== undefined || input.vozila !== undefined) {
      return failure('WORKER_EQUIPMENT_RETIRED', 'Alat i vozila se više ne uređuju u radnom profilu.');
    }
    if (input.grad !== undefined || input.radijusKm !== undefined) {
      return failure('PROFILE_LOCATION_REQUIRES_REVIEW', 'Mesto i radijus menjaju se u podešavanju područja rada.');
    }
    if (input.dostupanOdmah !== undefined) {
      return failure('PROFILE_AVAILABILITY_REQUIRES_REVIEW', 'Dostupnost menjajte kroz podešavanje dostupnosti.');
    }
    const capacityEdit = input.kapacitetTima !== undefined || input.capacityRevision !== undefined;
    if (capacityEdit && (!workerCapacityValue(input.kapacitetTima) || !workerCapacityRevision(input.capacityRevision))) {
      return failure('WORKER_CAPACITY_INPUT_INVALID', 'Unesi ceo broj od 1 do 50 ljudi i učitaj aktuelni profil.');
    }
    const patch: Record<string, unknown> = {};
    for (const [field, column] of Object.entries(TEXT_FIELDS)) {
      if (input[field] === undefined) continue;
      if (typeof input[field] !== 'string') return failure('PROFILE_INPUT_INVALID', 'Podaci profila nisu ispravni.');
      patch[column] = input[field];
    }
    for (const [field, column] of Object.entries(RESOURCE_FIELDS)) {
      if (input[field] === undefined) continue;
      const terms = capabilityTerms(input[field]);
      if (!terms) return failure('PROFILE_CAPABILITY_INPUT_INVALID', 'Unesi do 50 nepraznih stavki, do 500 znakova po stavci.');
      patch[column] = terms;
    }
    if (input.zavrsi !== undefined && typeof input.zavrsi !== 'boolean') return failure('PROFILE_INPUT_INVALID', 'Radnja profila nije ispravna.');
    const activate = input.zavrsi === true;
    inFlight.add(lock);
    async function run<T>(options: Omit<ReceiptOptions<T>, 'errors'> & { request: () => PromiseLike<unknown> }): Promise<Ishod<T>> {
      const result = await readOwnedResult({ ...options, errors: COPY, account });
      if (!result.ok && result.kod === 'AUTH_ACCOUNT_CHANGED') {
        return failure(result.kod, 'Nalog je promenjen. Ponovo otvori profil.');
      }
      return result;
    }
    try {
      const supabase = supabaseKlijent();
      const authenticated = await run({ request: () => supabase.auth.getUser(), fallback: 'AUTH_REQUIRED', invalid: 'AUTH_ACCOUNT_CHANGED',
        decode: raw => sameId(record(record(raw)?.user)?.id, account.accountId) ? true : null });
      if (!authenticated.ok) return authenticated.kod === 'AUTH_REQUIRED' ? failure('AUTH_REQUIRED', COPY.AUTH_REQUIRED) : authenticated;
      const existing = await run({
        request: () => supabase.from('app_profiles').select('id,account_id,kind')
          .eq('account_id', account.accountId).eq('kind', 'WORKER').maybeSingle(),
        fallback: 'PROFILE_READ_FAILED', invalid: 'PROFILE_INVALID_RESPONSE',
        decode: raw => {
          if (raw === null) return { profile: null };
          const profile = profileRow(raw, account.accountId);
          return profile ? { profile } : null;
        },
      });
      if (!existing.ok) return existing;
      let profileId = existing.podatak.profile?.id;
      if (!profileId) {
        const inserted = await run({
          request: () => supabase.from('app_profiles').insert({
            account_id: account.accountId, kind: 'WORKER', display_name: '', bio: '',
            skills: [], tools: [], vehicles: [],
            ...patch, profile_status: 'DRAFT',
          }).select('id,account_id,kind').single(),
          fallback: 'PROFILE_CREATE_FAILED', invalid: 'PROFILE_INVALID_RESPONSE', write: true,
          decode: raw => profileRow(raw, account.accountId),
        });
        if (!inserted.ok) return inserted;
        profileId = inserted.podatak.id;
      } else if (Object.keys(patch).length) {
        const expectedId = profileId;
        const updated = await run({
          request: () => supabase.from('app_profiles').update(patch).eq('id', expectedId)
            .eq('account_id', account.accountId).eq('kind', 'WORKER').select('id,account_id,kind').single(),
          fallback: 'PROFILE_UPDATE_FAILED', invalid: 'PROFILE_INVALID_RESPONSE', write: true,
          decode: raw => profileRow(raw, account.accountId, expectedId),
        });
        if (!updated.ok) return updated;
      }
      if (capacityEdit) {
        const result = await workerCapacityClientService.save({ teamCapacity: input.kapacitetTima as number,
          expectedRevision: input.capacityRevision as string }, account);
        if (!result.ok) return result;
        if (!sameId(result.podatak.capacity.profileId, profileId)) return failure('PROFILE_INVALID_RESPONSE', 'Ponovo učitaj radni profil.');
      }
      if (activate) {
        const result = await run({ request: () => supabase.rpc('rpc_complete_worker_profile', { p_profile_id: profileId }),
          fallback: 'PROFILE_ACTIVATION_FAILED', invalid: 'PROFILE_INVALID_RESPONSE', write: true, decode: raw => raw === null ? true : null });
        if (!result.ok) return result;
      }
      return { ok: true, podatak: null };
    } catch {
      if (sesijaSada().user?.id !== account.accountId || sesijaSada().accountRevision !== account.accountRevision) {
        return failure('AUTH_ACCOUNT_CHANGED', 'Nalog je promenjen. Ponovo otvori profil.');
      }
      return failure('PROFILE_UPDATE_FAILED', 'Ishod čuvanja nije potvrđen. Osveži profil pre ponovnog pokušaja.');
    } finally {
      inFlight.delete(lock);
    }
  },
};
