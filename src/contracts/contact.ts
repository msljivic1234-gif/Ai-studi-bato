import type { ResolvedLocationValue } from './location';

/** Private, ephemeral receipt. Never part of a public card or Agreement list. */
export type ExactLocationReveal = Readonly<{
  authoritative: true;
  agreementId: string; needId: string; needRevision: number; grantId: string; ownerAccountId: string;
  grantedAt: string; expiresAt: string | null;
  adresa: string | null; accessNotes: string | null;
  exactPosition: Readonly<{ latitude: number; longitude: number }> | null;
  resolvedLocation: Readonly<{ value: ResolvedLocationValue; confirmedByAccountId: string; confirmedAt: string }> | null;
}>;

/** Existing access_grants RLS projection contains no private location payload. */
export type LocationGrant = Readonly<{
  id: string; ownerAccountId: string; recipientAccountId: string;
  status: 'GRANTED' | 'REVOKED'; grantedAt: string; expiresAt: string | null;
}>;
export type LocationGrantState = Readonly<{ agreementId: string; accountId: string; grants: readonly LocationGrant[] }>;
