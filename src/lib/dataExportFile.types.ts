import type { DataExportFile } from '../contracts/dataExport';
import { DATA_EXPORT_MAX_BYTES } from '../contracts/dataExport';

export type SaveDataExportFileOptions = { artifact: DataExportFile; isCurrent: () => boolean; signal: AbortSignal };
export type SaveDataExportFileResult =
  | { status: 'SAVED'; fileName: string }
  | { status: 'DOWNLOAD_STARTED'; fileName: string }
  | { status: 'CANCELLED' | 'STALE' | 'UNSUPPORTED' | 'BUSY' | 'FAILED'; code?: 'EXISTS' | 'INVALID' | 'WRITE_FAILED' | 'CLEANUP_FAILED' };

export function dataExportFileName(artifact: DataExportFile): string | null {
  const uuid = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i;
  if (!uuid.test(artifact?.receiptId) || !uuid.test(artifact?.artifactGeneration)
    || !(artifact.bytes instanceof Uint8Array) || !Number.isSafeInteger(artifact.byteLength) || artifact.byteLength <= 0 || artifact.byteLength > DATA_EXPORT_MAX_BYTES
    || artifact.bytes.byteLength !== artifact.byteLength || !/^[a-f0-9]{64}$/.test(artifact.sha256)
    || !/^[a-f0-9]{32}$/.test(artifact.md5)) return null;
  return `uskoci-izvoz-${artifact.receiptId.toLowerCase()}-${artifact.artifactGeneration.toLowerCase()}.json`;
}
