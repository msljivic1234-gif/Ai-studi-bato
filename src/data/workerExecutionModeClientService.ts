import { sesijaSada } from '../store/sesija';
import { ownProfileClientService } from './ownProfileClientService';
import { supabaseKlijent } from './supabaseClient';
import { decodeWorkerSavedServices, type WorkerSavedService } from '../contracts/workerSavedServices';

export type WorkerExecutionMode = 'ON_SITE' | 'REMOTE';
export type WorkerExecutionModeReceipt = {
  workerProfileId: string;
  confirmed: boolean;
  modes: WorkerExecutionMode[];
  confirmedAt: string | null;
  /** Undefined on the legacy reader; never fill from an AI conversation draft. */
  services?: readonly WorkerSavedService[];
};

export function canonicalWorkerExecutionModes(modes: readonly WorkerExecutionMode[]): WorkerExecutionMode[] {
  const result: WorkerExecutionMode[] = [];
  if (modes.includes('ON_SITE')) result.push('ON_SITE');
  if (modes.includes('REMOTE')) result.push('REMOTE');
  return result;
}

const REMOTE_KEYWORDS = [
  'digital', 'dizajn', 'logo', 'sajt', 'programir', 'tekst', 'prevod', 'lektur',
  'transkripcij', 'časov', 'casov', 'online', 'matematik', 'englesk', 'tabel', 'excel',
  'web', 'video', 'foto', '3d', 'grafi', 'pisanje', 'podučavanje', 'poducavanje',
];

export function inferWorkerExecutionModes(
  skills: readonly string[],
  location?: { city?: string; radiusKm?: number }
): WorkerExecutionMode[] {
  const normalized = skills.map(s => s.toLowerCase());
  const hasRemote = normalized.some(s => REMOTE_KEYWORDS.some(k => s.includes(k)));
  const hasOnSite = Boolean(location?.city?.trim()) || normalized.some(s => !REMOTE_KEYWORDS.some(k => s.includes(k))) || !hasRemote;

  const modes: WorkerExecutionMode[] = [];
  if (hasOnSite) modes.push('ON_SITE');
  if (hasRemote) modes.push('REMOTE');
  return canonicalWorkerExecutionModes(modes);
}

function scoped(accountId: string, accountRevision: number) {
  const current = sesijaSada();
  if (!accountId || current.user?.id !== accountId || current.accountRevision !== accountRevision) {
    throw new Error('WORKER_MODE_ACCOUNT_CHANGED');
  }
}

/** A confirmed choice must carry its actual zoned PostgreSQL timestamp; never
 * interpret a missing, local-time or malformed value as confirmed consent. */
function confirmedInstant(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{1,6})?(?:Z|[+-](?:0\d|1[0-4]):[0-5]\d)$/.test(value)
    || !Number.isFinite(Date.parse(value))) return false;
  const year = Number(value.slice(0, 4)), month = Number(value.slice(5, 7)), day = Number(value.slice(8, 10));
  return month >= 1 && month <= 12 && day >= 1 && day <= new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function decodeWorkerExecutionModeReceipt(value: unknown, profileId: string): WorkerExecutionModeReceipt {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('WORKER_MODE_INVALID_RECEIPT');
  const row = value as Record<string, unknown>;
  if (row.workerProfileId !== profileId || typeof row.confirmed !== 'boolean' || !Array.isArray(row.modes)
    || row.modes.some(mode => mode !== 'ON_SITE' && mode !== 'REMOTE')
    || row.modes.length > 2 || new Set(row.modes).size !== row.modes.length
    || (row.confirmed ? row.modes.length < 1 : row.modes.length !== 0)
    || (row.confirmed ? !confirmedInstant(row.confirmedAt) : row.confirmedAt !== null)) throw new Error('WORKER_MODE_INVALID_RECEIPT');
  const hasServices = 'servicesVersion' in row || 'services' in row;
  const services = hasServices ? decodeWorkerSavedServices(row.services) : undefined;
  if (hasServices && (row.servicesVersion !== 'WORKER_SAVED_SERVICES_V1' || !services)) throw new Error('WORKER_MODE_INVALID_RECEIPT');
  return { workerProfileId: profileId, confirmed: row.confirmed,
    modes: canonicalWorkerExecutionModes(row.modes as WorkerExecutionMode[]),
    confirmedAt: row.confirmed ? row.confirmedAt as string : null,
    ...(services ? { services } : {}) };
}

async function ownedWorkerId(accountId: string, accountRevision: number): Promise<string> {
  scoped(accountId, accountRevision);
  const profile = await ownProfileClientService.read(accountId, 'uskocer');
  scoped(accountId, accountRevision);
  if (!profile || profile.kind !== 'WORKER') throw new Error('WORKER_PROFILE_REQUIRED');
  return profile.profileId;
}

export const workerExecutionModeClientService = {
  async read(accountId: string, accountRevision: number): Promise<WorkerExecutionModeReceipt> {
    const profileId = await ownedWorkerId(accountId, accountRevision);
    const { data, error } = await supabaseKlijent().rpc('rpc_get_worker_execution_modes', {
      p_worker_profile_id: profileId,
    });
    scoped(accountId, accountRevision);
    if (error) throw new Error('WORKER_MODE_READ_FAILED');
    return decodeWorkerExecutionModeReceipt(data, profileId);
  },

  async save(accountId: string, accountRevision: number, modes: WorkerExecutionMode[]): Promise<WorkerExecutionModeReceipt> {
    const desired = canonicalWorkerExecutionModes(modes);
    if (!desired.length || desired.length !== modes.length || new Set(modes).size !== modes.length)
      throw new Error('WORKER_MODE_SELECTION_REQUIRED');
    const profileId = await ownedWorkerId(accountId, accountRevision);
    try {
      await supabaseKlijent().rpc('rpc_set_worker_execution_modes', {
        p_worker_profile_id: profileId, p_modes: desired,
      });
    } catch { /* A disconnected write may still have committed; read server truth. */ }
    scoped(accountId, accountRevision);
    // Only server readback is a success receipt; RPC errors or lost ACKs
    // must not cause a second blind write for the same user.
    const readback = await this.read(accountId, accountRevision);
    scoped(accountId, accountRevision);
    if (readback.workerProfileId !== profileId || !readback.confirmed
      || readback.modes.join(',') !== desired.join(',')) throw new Error('WORKER_MODE_SAVE_NOT_CONFIRMED');
    return readback;
  },
};
