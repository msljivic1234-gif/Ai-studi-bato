import { Directory, File } from 'expo-file-system';
import { dataExportFileName, type SaveDataExportFileOptions, type SaveDataExportFileResult } from './dataExportFile.types';

let pickerActive = false;

/** Explicit directory selection; no sharing, persistent URI or background write. */
export async function saveDataExportFile({ artifact, isCurrent, signal }: SaveDataExportFileOptions): Promise<SaveDataExportFileResult> {
  const current = () => !signal.aborted && isCurrent();
  if (!current()) return { status: 'STALE' };
  const fileName = dataExportFileName(artifact);
  if (!fileName) return { status: 'FAILED', code: 'INVALID' };
  if (pickerActive) return { status: 'BUSY' };
  pickerActive = true;
  let ownedFile: File | null = null;
  const cleanup = () => {
    if (!ownedFile) return true;
    try { ownedFile.delete(); ownedFile = null; return true; } catch { return false; }
  };
  try {
    const directory = await Directory.pickDirectoryAsync();
    // Native pickers can remain open after account or route changes.
    if (!current()) return { status: 'STALE' };
    const previous = directory.list();
    if (previous.some(item => item.name === fileName)) return { status: 'FAILED', code: 'EXISTS' };
    if (!current()) return { status: 'STALE' };
    let file: File;
    if (directory.uri.startsWith('file://')) {
      // File.create fails exclusively for an existing file. Android's local
      // Directory.createFile does not check createNewFile's return value.
      file = new File(directory, fileName);
      file.create({ overwrite: false, intermediates: false });
      ownedFile = file;
    } else if (directory.uri.startsWith('content://')) {
      // SAF requires Directory.createFile; File.create rejects content URIs.
      file = directory.createFile(fileName, 'application/json');
      const returned = new URL(file.uri), selected = new URL(directory.uri);
      if (returned.protocol !== 'content:' || returned.host !== selected.host || file.uri === directory.uri
        || previous.some(item => item.uri === file.uri) || !file.exists || file.size !== 0) {
        return { status: 'FAILED', code: 'EXISTS' };
      }
      ownedFile = file;
    } else return { status: 'UNSUPPORTED' };
    if (!current()) return cleanup() ? { status: 'STALE' } : { status: 'FAILED', code: 'CLEANUP_FAILED' };
    file.write(artifact.bytes);
    if (!current()) return cleanup() ? { status: 'STALE' } : { status: 'FAILED', code: 'CLEANUP_FAILED' };
    if (!file.exists || file.size !== artifact.byteLength || file.md5?.toLowerCase() !== artifact.md5) {
      return { status: 'FAILED', code: cleanup() ? 'WRITE_FAILED' : 'CLEANUP_FAILED' };
    }
    if (!current()) return cleanup() ? { status: 'STALE' } : { status: 'FAILED', code: 'CLEANUP_FAILED' };
    ownedFile = null;
    return { status: 'SAVED', fileName };
  } catch (error) {
    if (!cleanup()) return { status: 'FAILED', code: 'CLEANUP_FAILED' };
    if (!current()) return { status: 'STALE' };
    const code = error && typeof error === 'object' && 'code' in error ? error.code : null;
    return code === 'ERR_PICKER_CANCELLED' || code === 'ERR_FILE_PICKING_CANCELLED'
      ? { status: 'CANCELLED' } : { status: 'FAILED', code: 'WRITE_FAILED' };
  } finally { pickerActive = false; }
}
