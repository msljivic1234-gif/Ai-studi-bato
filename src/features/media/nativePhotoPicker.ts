import * as ImagePicker from 'expo-image-picker';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { File, Paths } from 'expo-file-system';
import { askInContext, type PermissionNeed } from '../../ui/permissions/permissionAsk';

export type PreparedPhoto = { bytes: ArrayBuffer; contentType: 'image/jpeg'; width: number; height: number };
export type PhotoSource = 'LIBRARY' | 'CAMERA';
const INPUT_LIMIT = 10 * 1024 * 1024;
const OUTPUT_LIMIT = 5 * 1024 * 1024;
export class PhotoSelectionError extends Error {
  constructor(readonly code: 'PERMISSION' | 'SIZE' | 'PROCESSING') { super(code); }
}

/** Only the selected picker cache copy and our generated output are disposable.
 * Never delete a photo-library original, content URI, or another app document. */
function removeCacheCopy(uri: string | undefined) {
  if (!uri || !uri.startsWith(Paths.cache.uri + (Paths.cache.uri.endsWith('/') ? '' : '/'))) return;
  if (uri.includes('/../') || uri.includes('/./') || /%2e|%2f|%5c/i.test(uri)) return;
  try { const file = new File(uri); if (file.exists) file.delete(); } catch { /* OS owns cache eviction if unavailable. */ }
}

type PickedAsset = ImagePicker.ImagePickerAsset;

/** What the system would do if the camera were asked for now. Reading it asks for nothing. */
async function cameraNeed(): Promise<PermissionNeed> {
  const permission = await ImagePicker.getCameraPermissionsAsync();
  return permission.granted ? 'granted' : permission.canAskAgain ? 'ask' : 'blocked';
}

/**
 * Opens the gallery or the camera; null when the person cancels or the caller is no longer current. The gallery is the
 * system's own picker and asks for no permission; the camera does, and when the system is about to ask the person is first told
 * why (design proposal N). "Ne sada" is the person closing the picker: nothing is added, nothing is said, and the screen is as it was.
 */
async function launch(source: PhotoSource, current: () => boolean, limit: number): Promise<PickedAsset[] | null> {
  if (!current()) return null;
  if (source === 'CAMERA') {
    let need: PermissionNeed = 'unknown';
    try { need = await cameraNeed(); } catch { /* An unreadable state still uses the system's own permission check. */ }
    if (!current()) return null;
    if (need === 'blocked') throw new PhotoSelectionError('PERMISSION');
    if (need !== 'granted') {
      if (await askInContext('photos', async () => need) === 'later') return null;
      if (!current()) return null;
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!current()) return null;
      if (!permission.granted) throw new PhotoSelectionError('PERMISSION');
    }
  }
  // Several photos only from the gallery and only up to the slots still free; the camera always takes one.
  const multiple = source === 'LIBRARY' && limit > 1;
  const options: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 1,
    allowsEditing: false, allowsMultipleSelection: multiple, exif: false, base64: false,
    ...(multiple ? { selectionLimit: limit, orderedSelection: true } : {}) };
  const picked = source === 'CAMERA' ? await ImagePicker.launchCameraAsync(options)
    : await ImagePicker.launchImageLibraryAsync(options);
  if (picked.canceled) return null;
  return picked.assets ?? [];
}

/** Local preparation is a transport optimization. The server independently
 * decodes, orients, strips metadata and validates the immutable upload. */
async function prepare(asset: PickedAsset | undefined, current: () => boolean, onProcessing: () => void): Promise<PreparedPhoto | null> {
  const selected = asset?.uri;
  let output: string | undefined;
  let context: ReturnType<typeof ImageManipulator.manipulate> | undefined;
  let rendered: Awaited<ReturnType<NonNullable<typeof context>['renderAsync']>> | undefined;
  try {
    if (!current()) return null;
    if (!asset || !selected || !Number.isFinite(asset.width) || !Number.isFinite(asset.height)
      || asset.width < 1 || asset.height < 1) throw new PhotoSelectionError('PROCESSING');
    const input = new File(selected);
    if (!input.exists || input.size <= 0) throw new PhotoSelectionError('PROCESSING');
    if (input.size > INPUT_LIMIT || (asset.fileSize ?? 0) > INPUT_LIMIT) throw new PhotoSelectionError('SIZE');
    onProcessing();
    context = ImageManipulator.manipulate(selected);
    if (asset.width > 1600 || asset.height > 1600) {
      context.resize(asset.width >= asset.height ? { width: 1600 } : { height: 1600 });
    }
    rendered = await context.renderAsync();
    if (!current()) return null;
    const saved = await rendered.saveAsync({ format: SaveFormat.JPEG, compress: 0.85 });
    output = saved.uri;
    if (!current()) return null;
    const file = new File(output);
    if (file.size <= 0 || file.size > OUTPUT_LIMIT || saved.width > 1600 || saved.height > 1600)
      throw new PhotoSelectionError('PROCESSING');
    const bytes = await file.arrayBuffer();
    if (!current()) return null;
    if (bytes.byteLength !== file.size) throw new PhotoSelectionError('PROCESSING');
    return { bytes, contentType: 'image/jpeg', width: saved.width, height: saved.height };
  } catch (error) {
    if (!current()) return null;
    throw error instanceof PhotoSelectionError ? error : new PhotoSelectionError('PROCESSING');
  } finally {
    try { rendered?.release(); } catch { /* The native reference may already be released. */ }
    try { context?.release(); } catch { /* Cache cleanup still runs. */ }
    removeCacheCopy(output); removeCacheCopy(selected);
  }
}

/** One photo from the gallery or the camera, prepared in memory (the avatar and the Dogovor take one at a time). */
export async function pickPreparedPhoto(source: PhotoSource, current: () => boolean,
  onProcessing: () => void = () => {}): Promise<PreparedPhoto | null> {
  let assets: PickedAsset[] | null = null;
  try {
    assets = await launch(source, current, 1);
    if (!assets) return null;
    const [first, ...extra] = assets;
    for (const asset of extra) removeCacheCopy(asset?.uri);
    return await prepare(first, current, onProcessing);
  } catch (error) {
    if (!current()) return null;
    throw error instanceof PhotoSelectionError ? error : new PhotoSelectionError('PROCESSING');
  }
}

/** What a multi-photo pick returned: the photos ready to send, in the order chosen, and the first reason one was left out. */
export type PreparedSelection = { photos: PreparedPhoto[]; rejected: number; firstError: PhotoSelectionError | null };

/**
 * Several photos from the gallery (up to `limit`, the slots still free), or one from the camera. Each is prepared in
 * turn, so only one decoded picture is held by the native side at a time; a photo that cannot be prepared (too large,
 * unreadable) is left out and counted, and the others still go. Null when nothing was chosen or the caller left.
 */
export async function pickPreparedPhotos(source: PhotoSource, current: () => boolean,
  { limit, onProcessing = () => {} }: { limit: number; onProcessing?: (index: number, total: number) => void }): Promise<PreparedSelection | null> {
  if (!Number.isInteger(limit) || limit < 1) return null;
  let assets: PickedAsset[] | null;
  try { assets = await launch(source, current, limit); } catch (error) {
    if (!current()) return null;
    throw error instanceof PhotoSelectionError ? error : new PhotoSelectionError('PROCESSING');
  }
  if (!assets) return null;
  // A picker that ignores the limit never takes more than the free slots; the extra cache copies are cleaned up.
  const chosen = assets.slice(0, limit);
  for (const asset of assets.slice(limit)) removeCacheCopy(asset?.uri);
  const selection: PreparedSelection = { photos: [], rejected: 0, firstError: null };
  for (let index = 0; index < chosen.length; index++) {
    if (!current()) { for (const rest of chosen.slice(index)) removeCacheCopy(rest?.uri); return null; }
    try {
      const photo = await prepare(chosen[index], current, () => onProcessing(index + 1, chosen.length));
      if (!photo) { for (const rest of chosen.slice(index + 1)) removeCacheCopy(rest?.uri); return null; }
      selection.photos.push(photo);
    } catch (error) {
      selection.rejected += 1;
      selection.firstError ??= error instanceof PhotoSelectionError ? error : new PhotoSelectionError('PROCESSING');
    }
  }
  if (!selection.photos.length && selection.firstError) throw selection.firstError;
  return selection.photos.length ? selection : null;
}

/** Exact copy shown when the camera permission is denied; presentation matches it to offer settings recovery. */
export const PHOTO_PERMISSION_MESSAGE = 'Dozvoli pristup kameri u podešavanjima ili izaberi fotografiju iz galerije.';
const isPhotoPermissionDenied = (error: unknown): boolean => error instanceof PhotoSelectionError && error.code === 'PERMISSION';
export function photoSelectionMessage(error: unknown): string {
  return isPhotoPermissionDenied(error)
    ? PHOTO_PERMISSION_MESSAGE
    : error instanceof PhotoSelectionError && error.code === 'SIZE' ? 'Izaberi fotografiju do 10 MB.'
      : 'Fotografija nije pripremljena. Pokušaj ponovo ili izaberi drugu.';
}
/** Said after a multi-photo pick when some were left out and the rest went on. */
export function photoSelectionSkipped(rejected: number, firstError: PhotoSelectionError | null): string {
  const what = rejected === 1 ? 'Jedna fotografija nije dodata' : rejected < 5 ? `${rejected} fotografije nisu dodate` : `${rejected} fotografija nije dodato`;
  return firstError?.code === 'SIZE' ? `${what}. Dozvoljeno je do 10 MB po slici.` : `${what}. Pokušaj ponovo ili izaberi drugu.`;
}
