/** P2 — data-export request ledger as the server projects it. */
export const DATA_EXPORT_MAX_BYTES = 8 * 1024 * 1024;

export type DataExportRequestStatus = 'REQUESTED' | 'PROCESSING' | 'READY' | 'FAILED' | 'CANCELLED' | 'EXPIRED';

export type DataExportRequest = {
  receiptId: string;
  clientRequestId: string;
  status: DataExportRequestStatus;
  requestedAt: string;
  updatedAt: string;
  cancelledAt: string | null;
  completedAt: string | null;
  failureCode: string | null;
};

/** A verified private artifact of this receipt. No object path or bearer URL. */
export type DataExportArtifact = {
  artifactAvailable: true;
  artifactGeneration: string;
  artifactExpiresAt: string;
  byteLength: number;
  sha256: string;
  md5: string;
};

/** Historical READY receipts without a verified artifact remain unavailable. */
export type DataExportStatus = {
  hasRequest: boolean;
  request: DataExportRequest | null;
  downloadAvailable: boolean;
  fulfillment?: DataExportArtifact | null;
  serverFulfillmentRequired: true;
  externalDsrChannelReady: boolean;
};

export type DataExportReceipt = {
  receiptId: string;
  clientRequestId: string;
  status: DataExportRequestStatus;
  requestedAt: string;
  idempotentReplay: boolean;
};

export type DataExportCancellation = {
  receiptId: string;
  status: 'CANCELLED';
  cancelledAt: string;
  idempotentReplay: boolean;
};

export type DataExportDownloadRequest = { receiptId: string; artifactGeneration: string };
export type DataExportFile = DataExportDownloadRequest & {
  bytes: Uint8Array;
  byteLength: number;
  sha256: string;
  md5: string;
};
export type DataExportPreparation = {
  receiptId: string;
  kind: 'READY' | 'PROCESSING' | 'NOT_READY';
  code?: 'POLICY_NOT_READY' | 'BUSY' | 'RETRY_REQUIRED' | 'NOT_AVAILABLE';
};
export type DataExportRevocation = { receiptId: string; status: 'EXPIRED' | 'CANCELLED'; revoked: true; idempotentReplay: boolean };
