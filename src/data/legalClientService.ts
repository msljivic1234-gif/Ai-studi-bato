import type { LegalAcceptanceReceipt, LegalBundleStatus, LegalDocument } from '../contracts/legal';
import type { Ishod } from './ports';
import { supabaseKlijent } from './supabaseClient';
import { readOwnedResult, record, sameId, timestamp, uuid } from './serverReceipt';
import { sesijaSada } from '../store/sesija';

const supabase = new Proxy({} as ReturnType<typeof supabaseKlijent>, {
  get: (_target, prop) => (supabaseKlijent() as never)[prop],
});

/** Only the account-fenced RPC response can retire a superseded reviewed intent.
 * Local coordinate validation deliberately retains the same public error code. */
export type LegalAcceptanceResult = Ishod<LegalAcceptanceReceipt> & { authoritativeReviewChanged?: true };

function fail(kod: string, poruka: string): Ishod<never> {
  return { ok: false, kod, poruka };
}

// Server exception names → product language. The user never sees a code.
const LEGAL_COPY: Record<string, string> = {
  LEGAL_DOCUMENTS_NOT_PUBLISHED: 'Uslovi korišćenja i Politika privatnosti još nisu objavljeni.',
  LEGAL_ACCEPTANCE_REQUEST_REUSED_FOR_DIFFERENT_BUNDLE:
    'Uslovi su u međuvremenu ažurirani. Pročitaj ih ponovo pre prihvatanja.',
  INVALID_CLIENT_REQUEST_ID: 'Prihvatanje trenutno nije moglo da se zabeleži. Pokušaj ponovo.',
  AUTH_REQUIRED: 'Prijavi se da prihvatiš uslove.',
  LEGAL_REVIEW_CHANGED: 'Dokumenti su ažurirani. Pročitaj aktuelnu verziju pre prihvatanja.',
};

function acceptance(raw: unknown): LegalAcceptanceReceipt | null {
  const r = record(raw);
  if (!r || r.accepted !== true || typeof r.idempotentReplay !== 'boolean' || !timestamp(r.acceptedAt) ||
      typeof r.termsVersion !== 'string' || !r.termsVersion || typeof r.privacyVersion !== 'string' || !r.privacyVersion ||
      typeof r.termsSha256 !== 'string' || !/^[0-9a-f]{64}$/.test(r.termsSha256) ||
      typeof r.privacySha256 !== 'string' || !/^[0-9a-f]{64}$/.test(r.privacySha256)) return null;
  return { accepted: true, idempotentReplay: r.idempotentReplay, acceptedAt: r.acceptedAt,
    termsVersion: r.termsVersion, privacyVersion: r.privacyVersion, termsSha256: r.termsSha256, privacySha256: r.privacySha256 };
}

function legalFailure(error: any, fallback: string): Ishod<never> {
  const name = typeof error?.message === 'string' ? error.message : '';
  return fail(name || error?.code || fallback, LEGAL_COPY[name] ?? 'Radnja trenutno nije mogla da se završi. Pokušaj ponovo.');
}

function mapDocument(raw: any): LegalDocument | null {
  const kind = raw?.kind === 'TERMS' || raw?.kind === 'PRIVACY' ? raw.kind : null;
  const version = typeof raw?.version === 'string' ? raw.version : '';
  const sha256 = typeof raw?.sha256 === 'string' && /^[0-9a-f]{64}$/.test(raw.sha256) ? raw.sha256 : '';
  const url = typeof raw?.url === 'string' && raw.url.startsWith('https://') ? raw.url : '';
  if (!kind || !version || !sha256 || !url) return null;
  return {
    kind,
    version,
    sha256,
    url,
    publishedAt: String(raw?.publishedAt ?? ''),
    effectiveAt: String(raw?.effectiveAt ?? ''),
  };
}

/**
 * P1 — the only client owner of legal bundle reads and acceptance.
 * Readiness is server truth: an unpublished bundle is `ready:false`, never a
 * client-side default. Acceptance carries one stable request id per intent so
 * a retry replays the original receipt instead of recording twice.
 */
export const legalClientService = {
  acceptReviewedBundle(clientRequestId: string, termsSha256: string, privacySha256: string): Promise<LegalAcceptanceResult> {
    const owner = sesijaSada(), accountId = owner.user?.id;
    if (!accountId) return Promise.resolve(fail('AUTH_REQUIRED', LEGAL_COPY.AUTH_REQUIRED));
    if (!uuid(clientRequestId) || !/^[0-9a-f]{64}$/.test(termsSha256) || !/^[0-9a-f]{64}$/.test(privacySha256))
      return Promise.resolve(fail('LEGAL_REVIEW_CHANGED', LEGAL_COPY.LEGAL_REVIEW_CHANGED));
    return readOwnedResult({ account: { accountId, accountRevision: owner.accountRevision }, write: true,
      request: () => supabase.rpc('rpc_accept_reviewed_legal_bundle', { p_client_request_id: clientRequestId, p_terms_sha256: termsSha256, p_privacy_sha256: privacySha256 }),
      errors: LEGAL_COPY, fallback: 'LEGAL_ACCEPT_OUTCOME_UNKNOWN', invalid: 'LEGAL_ACCEPT_INVALID_RESPONSE', decode: raw => {
        const r = record(raw), receipt = acceptance(raw);
        return r && sameId(r.accountId, accountId) && sameId(r.clientRequestId, clientRequestId) && r.authoritative === true &&
          receipt?.termsSha256 === termsSha256 && receipt.privacySha256 === privacySha256 ? receipt : null;
      } }).then(result => !result.ok && result.kod === 'LEGAL_REVIEW_CHANGED'
        ? { ...result, authoritativeReviewChanged: true as const } : result);
  },
  readAcceptance(clientRequestId: string): Promise<Ishod<{ found: boolean; receipt: LegalAcceptanceReceipt | null }>> {
    const owner = sesijaSada(), accountId = owner.user?.id;
    if (!accountId) return Promise.resolve(fail('AUTH_REQUIRED', LEGAL_COPY.AUTH_REQUIRED));
    if (!uuid(clientRequestId)) return Promise.resolve(fail('INVALID_CLIENT_REQUEST_ID', LEGAL_COPY.INVALID_CLIENT_REQUEST_ID));
    return readOwnedResult({ account: { accountId, accountRevision: owner.accountRevision },
      request: () => supabase.rpc('rpc_read_my_legal_acceptance', { p_client_request_id: clientRequestId }),
      errors: LEGAL_COPY, fallback: 'LEGAL_ACCEPT_READ_UNAVAILABLE', invalid: 'LEGAL_ACCEPT_INVALID_RESPONSE', decode: raw => {
        const r = record(raw);
        if (!r || !sameId(r.accountId, accountId) || !sameId(r.clientRequestId, clientRequestId) || r.authoritative !== true || typeof r.found !== 'boolean') return null;
        const receipt = r.found ? acceptance(r.receipt) : null;
        return r.found ? receipt ? { found: true, receipt } : null : r.receipt === null ? { found: false, receipt: null } : null;
      } });
  },
  async readBundle(): Promise<Ishod<LegalBundleStatus>> {
    const { data, error } = await supabase.rpc('rpc_get_legal_bundle');
    if (error) return legalFailure(error, 'LEGAL_BUNDLE_READ_FAILED');
    if (!data || typeof data.ready !== 'boolean') return fail('LEGAL_BUNDLE_INVALID_RESPONSE', 'Stanje uslova nije učitano.');
    if (data.ready !== true) {
      return {
        ok: true,
        podatak: { ready: false, acceptedCurrentBundle: false, reason: 'LEGAL_DOCUMENTS_NOT_PUBLISHED', documents: [] },
      };
    }
    const documents = (Array.isArray(data.documents) ? data.documents : []).map(mapDocument).filter(Boolean) as LegalDocument[];
    const kinds = documents.map((d) => d.kind);
    if (!kinds.includes('TERMS') || !kinds.includes('PRIVACY')) {
      return fail('LEGAL_BUNDLE_INVALID_RESPONSE', 'Nisu učitana oba pravna dokumenta.');
    }
    return {
      ok: true,
      podatak: { ready: true, acceptedCurrentBundle: data.acceptedCurrentBundle === true, reason: null, documents },
    };
  },

  async acceptBundle(clientRequestId: string): Promise<Ishod<LegalAcceptanceReceipt>> {
    const { data, error } = await supabase.rpc('rpc_accept_legal_bundle', { p_client_request_id: clientRequestId });
    if (error) return legalFailure(error, 'LEGAL_ACCEPT_FAILED');
    if (data?.accepted !== true || typeof data?.termsSha256 !== 'string' || typeof data?.privacySha256 !== 'string') {
      return fail('LEGAL_ACCEPT_INVALID_RESPONSE', 'Prihvatanje uslova nije potvrđeno.');
    }
    return {
      ok: true,
      podatak: {
        accepted: true,
        idempotentReplay: data.idempotentReplay === true,
        acceptedAt: String(data.acceptedAt ?? ''),
        termsVersion: String(data.termsVersion ?? ''),
        termsSha256: data.termsSha256,
        privacyVersion: String(data.privacyVersion ?? ''),
        privacySha256: data.privacySha256,
      },
    };
  },
};
