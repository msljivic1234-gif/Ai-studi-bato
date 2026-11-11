import { record, timestamp } from './serverReceipt';

export type UrgentPreview =
  | { allowed: false; reasonCodes: string[] }
  | { allowed: true; policyVersion: string; candidateExpiresAt: string; chargesFee: boolean;
      alreadyUrgent: boolean; maxMinutesToStart: number; maxLifetimeMinutes: number; minChoice: number };

// Decoder for the existing server-owned preview; it neither changes policy nor activates HITNO.
// Use the existing fn_need_urgency projection to decide whether HITNO is currently
// active: preview.alreadyUrgent is the stored bit and may already have expired.
export function decodeUrgentPreview(raw: unknown): UrgentPreview | null {
  const value = record(raw);
  if (!value || typeof value.allowed !== 'boolean' || !Array.isArray(value.reasonCodes)
      || !value.reasonCodes.every(code => typeof code === 'string' && /^[A-Z][A-Z0-9_]{1,80}$/.test(code))) return null;
  const reasonCodes = value.reasonCodes as string[];
  // The existing RPC's early NOT_FOUND/FORBIDDEN replies omit authoritative.
  // Refusals cannot enable any command; never expose arbitrary server text.
  if (!value.allowed) return reasonCodes.length ? { allowed: false, reasonCodes } : null;
  if (value.authoritative !== true || reasonCodes.length !== 0
      || typeof value.policyVersion !== 'string' || !value.policyVersion.trim()
      || !timestamp(value.candidateExpiresAt) || typeof value.chargesFee !== 'boolean'
      || typeof value.alreadyUrgent !== 'boolean'
      || typeof value.maxMinutesToStart !== 'number' || !Number.isInteger(value.maxMinutesToStart) || value.maxMinutesToStart < 15 || value.maxMinutesToStart > 1440
      || typeof value.maxLifetimeMinutes !== 'number' || !Number.isInteger(value.maxLifetimeMinutes) || value.maxLifetimeMinutes < 5 || value.maxLifetimeMinutes > 240
      || typeof value.minChoice !== 'number' || !Number.isInteger(value.minChoice) || value.minChoice < 2 || value.minChoice > 10) return null;
  return { allowed: true, policyVersion: value.policyVersion, candidateExpiresAt: value.candidateExpiresAt,
    chargesFee: value.chargesFee, alreadyUrgent: value.alreadyUrgent,
    maxMinutesToStart: value.maxMinutesToStart as number, maxLifetimeMinutes: value.maxLifetimeMinutes as number,
    minChoice: value.minChoice as number };
}
