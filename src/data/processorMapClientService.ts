import type { ProcessorMapProvider, ProcessorMapStatus } from '../contracts/processorMap';
import type { Ishod } from './ports';
import { supabaseKlijent } from './supabaseClient';

const supabase = new Proxy({} as ReturnType<typeof supabaseKlijent>, {
  get: (_target, prop) => (supabaseKlijent() as never)[prop],
});

function fail(kod: string, poruka: string): Ishod<never> {
  return { ok: false, kod, poruka };
}

const NOT_READY = new Set(['PROCESSOR_MAP_NOT_PUBLISHED', 'PROCESSOR_MAP_AMBIGUOUS', 'PROCESSOR_MAP_INCOMPLETE']);
const ROLES = new Set(['PROCESSOR', 'SUBPROCESSOR', 'INDEPENDENT_CONTROLLER']);
const PROVIDER_FIELDS = [
  'providerCode', 'providerDisplayName', 'legalEntityName', 'legalRole', 'purpose', 'dataCategories',
  'processingRegions', 'crossBorderTransfer', 'transferMechanism', 'dpaReference', 'privacyNoticeUrl',
  'retentionDeletionTerms', 'subprocessorTerms', 'legalBasisReference',
] as const;

function object(raw: unknown): Record<string, unknown> | null {
  return raw !== null && typeof raw === 'object' && !Array.isArray(raw) ? raw as Record<string, unknown> : null;
}
function exact(raw: Record<string, unknown>, fields: readonly string[]): boolean {
  return Object.keys(raw).length === fields.length && fields.every(field => Object.hasOwn(raw, field));
}
function nonEmptyText(raw: unknown): raw is string {
  return typeof raw === 'string' && raw.trim().length > 0;
}
function nonNegativeInteger(raw: unknown): raw is number {
  return typeof raw === 'number' && Number.isSafeInteger(raw) && raw >= 0;
}

function mapProvider(raw: unknown): ProcessorMapProvider | null {
  const value = object(raw);
  if (!value || !exact(value, PROVIDER_FIELDS)) return null;
  if (!nonEmptyText(value.providerCode) || !nonEmptyText(value.providerDisplayName) || !nonEmptyText(value.legalEntityName)
    || typeof value.legalRole !== 'string' || !ROLES.has(value.legalRole)
    || !nonEmptyText(value.purpose) || !Array.isArray(value.dataCategories)
    || value.dataCategories.length === 0 || value.dataCategories.some(category => !nonEmptyText(category))
    || !nonEmptyText(value.processingRegions) || typeof value.crossBorderTransfer !== 'boolean'
    || !nonEmptyText(value.transferMechanism) || !nonEmptyText(value.dpaReference)
    || !nonEmptyText(value.privacyNoticeUrl) || !value.privacyNoticeUrl.startsWith('https://')
    || !nonEmptyText(value.retentionDeletionTerms) || !nonEmptyText(value.subprocessorTerms)
    || !nonEmptyText(value.legalBasisReference)) return null;
  return {
    providerCode: value.providerCode,
    providerDisplayName: value.providerDisplayName,
    legalEntityName: value.legalEntityName,
    legalRole: value.legalRole as ProcessorMapProvider['legalRole'],
    purpose: value.purpose,
    dataCategories: [...value.dataCategories] as string[],
    processingRegions: value.processingRegions,
    crossBorderTransfer: value.crossBorderTransfer,
    transferMechanism: value.transferMechanism,
    dpaReference: value.dpaReference,
    privacyNoticeUrl: value.privacyNoticeUrl,
    retentionDeletionTerms: value.retentionDeletionTerms,
    subprocessorTerms: value.subprocessorTerms,
    legalBasisReference: value.legalBasisReference,
  };
}

/**
 * P4 — the only client reader of the trusted processor map. Readiness is
 * server truth; the client never lists a provider the server did not publish
 * and never treats a partial or malformed map as ready.
 */
export const processorMapClientService = {
  async readStatus(): Promise<Ishod<ProcessorMapStatus>> {
    const { data, error } = await supabase.rpc('rpc_get_processor_map_status');
    if (error) {
      const name = typeof error.message === 'string' ? error.message : '';
      return fail(name || error.code || 'PROCESSOR_MAP_READ_FAILED', name === 'AUTH_REQUIRED'
        ? 'Prijavi se da vidiš obrađivače podataka.'
        : 'Podaci o obrađivačima trenutno nisu dostupni. Pokušaj ponovo.');
    }
    if (!data || typeof data.ready !== 'boolean') return fail('PROCESSOR_MAP_INVALID_RESPONSE', 'Stanje mape obrađivača nije učitano.');
    if (data.ready !== true) {
      const reason = NOT_READY.has(data.reason) ? data.reason : 'PROCESSOR_MAP_NOT_PUBLISHED';
      const missing = Array.isArray(data.missingProviders) ? data.missingProviders.filter((m: unknown) => typeof m === 'string') : [];
      return { ok: true, podatak: { ready: false, reason, missingProviders: missing } };
    }

    const rawProviders: unknown[] | null = Array.isArray(data.providers) ? data.providers : null;
    const technicalCount = data.technicalProviderCount;
    const requiredCount = data.requiredCurrentProviders;
    const coveredCount = data.coveredCurrentProviders;
    if (data.reason !== null || !nonEmptyText(data.mapVersion) || !nonEmptyText(data.effectiveAt)
      || !nonEmptyText(data.counselReference) || data.runtimeProviderGateAdmitted !== false
      || !nonNegativeInteger(technicalCount) || !nonNegativeInteger(requiredCount) || !nonNegativeInteger(coveredCount)
      || coveredCount !== requiredCount || coveredCount > technicalCount || !rawProviders || rawProviders.length < coveredCount
      || rawProviders.length > technicalCount) {
      return fail('PROCESSOR_MAP_INVALID_RESPONSE', 'Stanje mape obrađivača nije usklađeno.');
    }

    const providers = rawProviders.map(mapProvider);
    if (providers.some(provider => provider === null)) {
      return fail('PROCESSOR_MAP_INVALID_RESPONSE', 'Zapis mape obrađivača nije ispravan.');
    }
    const strictProviders = providers as ProcessorMapProvider[];
    const providerCodes = strictProviders.map(provider => provider.providerCode.toUpperCase());
    if (new Set(providerCodes).size !== providerCodes.length) {
      return fail('PROCESSOR_MAP_INVALID_RESPONSE', 'Zapis mape obrađivača je dupliran.');
    }

    return { ok: true, podatak: { ready: true, mapVersion: data.mapVersion, effectiveAt: data.effectiveAt, providers: strictProviders } };
  },
};
