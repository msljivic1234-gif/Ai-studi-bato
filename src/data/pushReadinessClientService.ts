import type { Ishod } from './ports';
import { readReceipt, record, timestamp } from './serverReceipt';
export type PushReadinessState = 'OPERATIONAL' | 'DEGRADED' | 'NOT_READY' | 'UNKNOWN';
export type PushReadiness = {
  state: PushReadinessState; reason: string; checkedAt: string; observedAt: string | null; lastSuccessAt: string | null;
  freshnessSeconds: 300; overdueWindowSeconds: 900; fresh: boolean; senderVersion: 'PRE_V3_PUSH_READINESS_V1' | null;
  senderDeployment: 'RUNTIME_OBSERVED' | 'UNKNOWN'; senderConfiguration: 'ENABLED' | 'DISABLED' | 'UNKNOWN';
  expiredLease: boolean; overdueBacklog: boolean; evidenceScope: 'TRANSPORT_ONLY'; authoritative: true;
};
function decode(raw: unknown): PushReadiness | null {
  const r = record(raw);
  if (!r || !timestamp(r.checkedAt) || !(r.observedAt === null || timestamp(r.observedAt)) ||
    !(r.lastSuccessAt === null || timestamp(r.lastSuccessAt)) || r.freshnessSeconds !== 300 || r.overdueWindowSeconds !== 900 ||
    typeof r.fresh !== 'boolean' || typeof r.expiredLease !== 'boolean' || typeof r.overdueBacklog !== 'boolean' ||
    r.authoritative !== true || r.evidenceScope !== 'TRANSPORT_ONLY' ||
    (r.observedAt === null ? r.senderVersion !== null || r.lastSuccessAt !== null : r.senderVersion !== 'PRE_V3_PUSH_READINESS_V1') ||
    (r.lastSuccessAt !== null && (r.observedAt === null || Date.parse(r.lastSuccessAt) > Date.parse(r.observedAt)))) return null;
  const age = r.observedAt === null ? null : Date.parse(r.checkedAt) - Date.parse(r.observedAt);
  const fresh = age !== null && age >= 0 && age < 300_000;
  if (r.fresh !== fresh || r.senderDeployment !== (fresh ? 'RUNTIME_OBSERVED' : 'UNKNOWN')) return null;
  if (!fresh) {
    if (r.state !== 'UNKNOWN' || r.senderConfiguration !== 'UNKNOWN' ||
      r.reason !== (r.observedAt === null ? 'NO_RUNTIME_OBSERVATION' : 'STALE_RUNTIME_OBSERVATION')) return null;
  } else if (r.senderConfiguration === 'DISABLED') {
    if (r.state !== 'NOT_READY' || r.reason !== 'DEPLOYMENT_DISABLED') return null;
  } else if (r.senderConfiguration !== 'ENABLED') return null;
  else if (r.expiredLease || r.overdueBacklog) {
    if (r.state !== 'DEGRADED' || r.reason !== (r.expiredLease ? 'EXPIRED_LEASE' : 'OVERDUE_BACKLOG')) return null;
  } else if (r.state === 'OPERATIONAL') {
    if (r.reason !== 'HEALTHY_TRANSPORT_TICK' || r.lastSuccessAt !== r.observedAt) return null;
  } else if (r.state === 'DEGRADED') {
    if (r.reason !== 'LAST_TICK_UNHEALTHY') return null;
  } else if (r.state !== 'UNKNOWN' || r.reason !== 'SUCCESSFUL_TICK_NOT_OBSERVED') return null;
  return { state: r.state as PushReadinessState, reason: r.reason as string, checkedAt: r.checkedAt,
    observedAt: r.observedAt, lastSuccessAt: r.lastSuccessAt, freshnessSeconds: 300, overdueWindowSeconds: 900, fresh,
    senderVersion: r.senderVersion as PushReadiness['senderVersion'], senderDeployment: r.senderDeployment as PushReadiness['senderDeployment'],
    senderConfiguration: r.senderConfiguration as PushReadiness['senderConfiguration'], expiredLease: r.expiredLease,
    overdueBacklog: r.overdueBacklog, evidenceScope: 'TRANSPORT_ONLY', authoritative: true };
}
/** Account-fenced global read model. Transport health is not provider/device
 * delivery. Neither local source existence nor a registered token implies ready. */
export const pushReadinessClientService = {
  read(): Promise<Ishod<PushReadiness>> {
    return readReceipt({ rpc: 'rpc_get_push_readiness', args: {}, decode,
      errors: { AUTH_REQUIRED: 'Prijavi se da proveriš obaveštenja.' },
      fallback: 'PUSH_READINESS_UNAVAILABLE', invalid: 'PUSH_READINESS_INVALID_RESPONSE' });
  },
};
