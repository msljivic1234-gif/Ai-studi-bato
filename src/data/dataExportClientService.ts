import type { DataExportArtifact, DataExportCancellation, DataExportReceipt, DataExportRequest, DataExportRequestStatus, DataExportRevocation, DataExportStatus } from '../contracts/dataExport';
import type { Ishod } from './ports';
import { DATA_EXPORT_MAX_BYTES } from '../contracts/dataExport';
import { downloadExport, prepareExport } from './dataExportDeliveryService';
import { failure, readReceipt, record, sameId, timestamp, uuid } from './serverReceipt';

const STATUSES: ReadonlySet<string> = new Set(['REQUESTED', 'PROCESSING', 'READY', 'FAILED', 'CANCELLED', 'EXPIRED']);
const TERMINAL: ReadonlySet<string> = new Set(['READY', 'FAILED', 'EXPIRED']);
const INVALID = 'DATA_EXPORT_INVALID_RESPONSE';
const EXPORT_COPY: Readonly<Record<string, string>> = {
  DATA_EXPORT_REQUEST_ALREADY_OPEN: 'Zahtev za izvoz Vaših podataka je već u toku.',
  // PKG-029d (deep read 6.2): without a published retention policy no export can be delivered, and the
  // server now says so instead of accepting a request nothing would fulfil.
  DATA_EXPORT_POLICY_NOT_READY: 'Izvoz podataka još nije dostupan: pravila čuvanja podataka još nisu objavljena.',
  DATA_EXPORT_REQUEST_NOT_CANCELLABLE: 'Ovaj zahtev više ne može da se otkaže.',
  DATA_EXPORT_REQUEST_NOT_FOUND: 'Zahtev nije pronađen.',
  INVALID_CLIENT_REQUEST_ID: 'Zahtev trenutno nije mogao da se zabeleži. Pokušajte ponovo.',
  INVALID_RECEIPT_ID: 'Zahtev nije pronađen.',
  AUTH_REQUIRED: 'Prijavite se da zatražite izvoz podataka.',
  DATA_EXPORT_NOT_AVAILABLE: 'Izvoz trenutno nije dostupan. Učitajte trenutno stanje.',
  DATA_EXPORT_ARTIFACT_STALE: 'Izvoz je promenjen. Učitajte trenutno stanje.',
};

export { DATA_EXPORT_MAX_BYTES } from '../contracts/dataExport';
function decodeDataExportArtifact(raw: unknown): DataExportArtifact | null {
  const value = record(raw);
  if (!value || Object.keys(value).some(key => !['artifactAvailable', 'artifactGeneration', 'artifactExpiresAt', 'byteLength', 'sha256', 'md5'].includes(key))
    || value.artifactAvailable !== true || !uuid(value.artifactGeneration) || !timestamp(value.artifactExpiresAt)
    || typeof value.byteLength !== 'number' || !Number.isSafeInteger(value.byteLength) || value.byteLength < 1 || value.byteLength > DATA_EXPORT_MAX_BYTES
    || typeof value.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(value.sha256)
    || typeof value.md5 !== 'string' || !/^[a-f0-9]{32}$/.test(value.md5)) return null;
  return value as unknown as DataExportArtifact;
}

function statusValue(value: unknown): value is DataExportRequestStatus {
  return typeof value === 'string' && STATUSES.has(value);
}
function requestKey(value: unknown): value is string {
  return typeof value === 'string' && value.length >= 16 && value.length <= 96 && /^[A-Za-z0-9_-]+$/.test(value);
}
function nullableTimestamp(value: unknown): value is string | null { return value === null || timestamp(value); }
function failureCode(value: unknown): value is string | null {
  return value === null || (typeof value === 'string' && Array.from(value).length >= 3 && Array.from(value).length <= 64);
}
function mapRequest(raw: unknown): DataExportRequest | null {
  const value = record(raw);
  if (!value || !uuid(value.receiptId) || !requestKey(value.clientRequestId) || !statusValue(value.status) ||
      value.kind !== 'ACCESS_EXPORT' || value.source !== 'IN_APP_AUTHENTICATED' ||
      !timestamp(value.requestedAt) || !timestamp(value.updatedAt) ||
      !nullableTimestamp(value.cancelledAt) || !nullableTimestamp(value.completedAt) || !failureCode(value.failureCode)) return null;
  // Mirror the admitted SQL constraints; do not infer missing lifecycle dates.
  if ((value.status === 'CANCELLED') !== (value.cancelledAt !== null) ||
      TERMINAL.has(value.status) !== (value.completedAt !== null)) return null;
  return {
    receiptId: value.receiptId, clientRequestId: value.clientRequestId, status: value.status,
    requestedAt: value.requestedAt, updatedAt: value.updatedAt,
    cancelledAt: value.cancelledAt, completedAt: value.completedAt, failureCode: value.failureCode,
  };
}
function intakeOnly(value: Record<string, unknown>): boolean {
  // A future server download flag cannot activate an unimplemented delivery client.
  return typeof value.downloadAvailable === 'boolean' && value.serverFulfillmentRequired === true;
}

async function exportReceipt<T>(options: Parameters<typeof readReceipt<T>>[0]): Promise<Ishod<T>> {
  const result = await readReceipt(options);
  if (!result.ok && result.kod === 'AUTH_ACCOUNT_CHANGED') {
    return failure(result.kod, 'Nalog je promenjen. Ponovo otvori stanje izvoza podataka.');
  }
  if (!result.ok && result.kod === 'AUTH_REQUIRED') return failure(result.kod, EXPORT_COPY.AUTH_REQUIRED);
  return result;
}

/**
 * The existing account-owned receipt boundary bounds network waits and discards
 * stale responses, including A→B→A. No automatic write retry or synthetic receipt.
 * Delivery requires a validated artifact descriptor; intake alone cannot enable it.
 */
export const dataExportClientService = {
  prepareExport,
  downloadExport,
  readStatus(): Promise<Ishod<DataExportStatus>> {
    return exportReceipt({
      rpc: 'rpc_get_data_export_status', args: {}, errors: EXPORT_COPY,
      fallback: 'DATA_EXPORT_STATUS_FAILED', invalid: INVALID,
      decode(raw): DataExportStatus | null {
        const value = record(raw);
        if (!value || typeof value.hasRequest !== 'boolean' || !intakeOnly(value) ||
            typeof value.externalDsrChannelReady !== 'boolean') return null;
        const request = value.hasRequest ? mapRequest(value.request) : null;
        if ((value.hasRequest && !request) || (!value.hasRequest && value.request !== null)) return null;
        const hasFulfillment = Object.prototype.hasOwnProperty.call(value, 'fulfillment');
        const artifact = value.fulfillment === null || !hasFulfillment ? null : decodeDataExportArtifact(value.fulfillment);
        if (hasFulfillment && ((value.fulfillment !== null && !artifact)
          || value.downloadAvailable !== (artifact !== null) || (artifact && request?.status !== 'READY'))) return null;
        return { hasRequest: value.hasRequest, request, downloadAvailable: artifact !== null,
          ...(hasFulfillment ? { fulfillment: artifact } : {}),
          serverFulfillmentRequired: true, externalDsrChannelReady: value.externalDsrChannelReady };
      },
    });
  },

  requestExport(clientRequestId: string): Promise<Ishod<DataExportReceipt>> {
    // Match SQL btrim(text)'s space normalization, not a freshly generated retry key.
    const key = typeof clientRequestId === 'string' ? clientRequestId.replace(/^ +| +$/g, '') : '';
    if (!requestKey(key)) return Promise.resolve(failure('INVALID_CLIENT_REQUEST_ID', EXPORT_COPY.INVALID_CLIENT_REQUEST_ID));
    return exportReceipt({
      rpc: 'rpc_request_data_export', args: { p_client_request_id: key }, errors: EXPORT_COPY,
      fallback: 'DATA_EXPORT_REQUEST_FAILED', invalid: INVALID, write: true,
      decode(raw): DataExportReceipt | null {
        const value = record(raw);
        if (!value || !uuid(value.receiptId) || value.clientRequestId !== key || !statusValue(value.status) ||
            !timestamp(value.requestedAt) || typeof value.idempotentReplay !== 'boolean' || !intakeOnly(value)) return null;
        if (!value.idempotentReplay && value.status !== 'REQUESTED') return null;
        return { receiptId: value.receiptId, clientRequestId: key, status: value.status,
          requestedAt: value.requestedAt, idempotentReplay: value.idempotentReplay };
      },
    });
  },

  cancelExport(receiptId: string): Promise<Ishod<DataExportCancellation>> {
    if (!uuid(receiptId)) return Promise.resolve(failure('INVALID_RECEIPT_ID', EXPORT_COPY.INVALID_RECEIPT_ID));
    return exportReceipt({
      rpc: 'rpc_cancel_data_export', args: { p_receipt_id: receiptId }, errors: EXPORT_COPY,
      fallback: 'DATA_EXPORT_CANCEL_FAILED', invalid: INVALID, write: true,
      decode(raw): DataExportCancellation | null {
        const value = record(raw);
        if (!value || !sameId(value.receiptId, receiptId) || value.status !== 'CANCELLED' ||
            !timestamp(value.cancelledAt) || typeof value.idempotentReplay !== 'boolean') return null;
        return { receiptId: value.receiptId, status: 'CANCELLED', cancelledAt: value.cancelledAt,
          idempotentReplay: value.idempotentReplay };
      },
    });
  },

  revokeExport(receiptId: string): Promise<Ishod<DataExportRevocation>> {
    if (!uuid(receiptId)) return Promise.resolve(failure('INVALID_RECEIPT_ID', EXPORT_COPY.INVALID_RECEIPT_ID));
    return exportReceipt({
      rpc: 'rpc_revoke_data_export_download', args: { p_receipt_id: receiptId }, errors: EXPORT_COPY,
      fallback: 'DATA_EXPORT_REVOKE_UNCONFIRMED', invalid: INVALID, write: true,
      decode(raw): DataExportRevocation | null {
        const value = record(raw);
        return value && Object.keys(value).every(key => ['receiptId', 'status', 'revoked', 'idempotentReplay'].includes(key))
          && (value.status === 'EXPIRED' || value.status === 'CANCELLED')
          && sameId(value.receiptId, receiptId) && value.revoked === true && typeof value.idempotentReplay === 'boolean'
          ? value as unknown as DataExportRevocation : null;
      },
    });
  },
};
