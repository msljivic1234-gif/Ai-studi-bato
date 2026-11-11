import { dataExportFileName, type SaveDataExportFileOptions, type SaveDataExportFileResult } from './dataExportFile.types';

/** Browser download initiation cannot certify that the user saved the file. */
export async function saveDataExportFile({ artifact, isCurrent, signal }: SaveDataExportFileOptions): Promise<SaveDataExportFileResult> {
  const current = () => !signal.aborted && isCurrent();
  if (!current()) return { status: 'STALE' };
  const fileName = dataExportFileName(artifact);
  if (!fileName) return { status: 'FAILED', code: 'INVALID' };
  if (typeof document === 'undefined' || !document.body || typeof URL.createObjectURL !== 'function'
    || typeof URL.revokeObjectURL !== 'function' || typeof crypto === 'undefined' || !crypto.subtle) return { status: 'UNSUPPORTED' };
  let url: string | null = null, link: HTMLAnchorElement | null = null, bytes: Uint8Array<ArrayBuffer> | null = null;
  const revoke = () => { if (url) { URL.revokeObjectURL(url); url = null; } signal.removeEventListener('abort', revoke); };
  try {
    bytes = new Uint8Array(artifact.bytes);
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    if (!current()) return { status: 'STALE' };
    const actual = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
    if (actual !== artifact.sha256) return { status: 'FAILED', code: 'INVALID' };
    url = URL.createObjectURL(new Blob([bytes], { type: 'application/json' }));
    signal.addEventListener('abort', revoke, { once: true });
    link = document.createElement('a'); link.href = url; link.download = fileName; link.rel = 'noopener';
    link.style.display = 'none'; document.body.appendChild(link);
    if (!current()) { revoke(); return { status: 'STALE' }; }
    link.click();
    // Let the browser consume the Blob; abort revokes it immediately.
    setTimeout(revoke, 1000);
    return { status: 'DOWNLOAD_STARTED', fileName };
  } catch { revoke(); return current() ? { status: 'FAILED', code: 'WRITE_FAILED' } : { status: 'STALE' }; }
  finally { bytes?.fill(0); link?.remove(); }
}
