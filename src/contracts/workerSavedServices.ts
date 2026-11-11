import { decodeServiceHandoff, type ServiceHandoff } from './serviceHandoff';

/** Owned saved display facts only. They do not grant matching/activation rights. */
export type WorkerSavedServiceStatus = 'CONFIRMED' | 'PENDING' | 'UNCONFIRMED';
export type WorkerSavedServiceMode = Readonly<{
  mode: 'ON_SITE' | 'REMOTE'; status: WorkerSavedServiceStatus; handoff: ServiceHandoff | null;
}>;
export type WorkerSavedService = Readonly<{
  service: string; status: WorkerSavedServiceStatus; modes: readonly WorkerSavedServiceMode[];
}>;
const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const status = (value: unknown): value is WorkerSavedServiceStatus => ['CONFIRMED', 'PENDING', 'UNCONFIRMED'].includes(value as string);

/** No string/global-mode inference. An absent old-server extension is handled by
 * the receipt decoder; a present malformed extension must never become consent. */
export function decodeWorkerSavedServices(value: unknown): WorkerSavedService[] | null {
  if (!Array.isArray(value) || value.length > 50) return null;
  const services: WorkerSavedService[] = [], seen = new Set<string>();
  for (const row of value) {
    if (!record(row) || Object.keys(row).some(key => !['service', 'status', 'modes'].includes(key))
      || typeof row.service !== 'string' || !row.service.trim() || row.service.length > 500 || /[\u0000-\u001f\u007f]/.test(row.service)
      || seen.has(row.service) || !status(row.status) || !Array.isArray(row.modes) || row.modes.length > 4) return null;
    seen.add(row.service);
    const modes: WorkerSavedServiceMode[] = [], modeSeen = new Set<string>();
    for (const item of row.modes) {
      if (!record(item) || Object.keys(item).some(key => !['mode', 'status', 'handoff'].includes(key))
        || (item.mode !== 'REMOTE' && item.mode !== 'ON_SITE') || !status(item.status)) return null;
      const key = `${item.mode}:${item.status}`;
      if (modeSeen.has(key)) return null;
      modeSeen.add(key);
      const handoff = item.handoff === null ? null : decodeServiceHandoff(item.handoff);
      if (item.handoff !== null && (!handoff || item.mode !== 'REMOTE')) return null;
      modes.push({ mode: item.mode, status: item.status, handoff });
    }
    const hasPending = modes.some(mode => mode.status === 'PENDING');
    const hasUnconfirmed = modes.some(mode => mode.status === 'UNCONFIRMED');
    const hasConfirmed = modes.some(mode => mode.status === 'CONFIRMED');
    if ((hasPending && row.status !== 'PENDING')
      || (row.status === 'CONFIRMED' && (!hasConfirmed || hasUnconfirmed))
      || (row.status === 'UNCONFIRMED' && hasConfirmed && !hasUnconfirmed)) return null;
    services.push({ service: row.service, status: row.status, modes });
  }
  return services;
}
