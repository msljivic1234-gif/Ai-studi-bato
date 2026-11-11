import { StyleSheet, View } from 'react-native';
import { T } from '../Text';
import { V2Action } from '../v2/V2Action';
import { PermissionRecovery } from '../system/PermissionRecovery';
import type { ConfirmRequest } from '../system/ConfirmSheet';
import { OUTCOME_ACTION } from '../system/outcomeCopy';
import { sys } from '../system/tokens';
import { PhotoAttachStrip, type AttachTile } from './PhotoAttachTiles';
import { PHOTO_LIMIT, PHOTO_SOURCE_WORDS, PHOTO_WORDS, photoCount, removalRequest } from './photoWords';
import type { TaskPhotoItem, TaskPhotosController } from './useTaskPhotoUploads';

/**
 * The task photos' tiles, from the one controller, for the conversation and the photo screen alike. A saved photo is
 * removed after a question; a photo that has not left the phone goes at once (nothing about it was saved); a photo the
 * server could not process is sent again with a tap while its bytes are still in memory. The one unconfirmed send keeps
 * its exits as actions of their own (`TaskPhotoRecovery`), never as a target hidden in a tile.
 */
export function taskPhotoTiles(photos: TaskPhotosController, items: readonly TaskPhotoItem[], ask: (request: ConfirmRequest) => void,
  disabled = false): AttachTile[] {
  const removeBlocked = disabled || photos.busy || photos.unconfirmed || !photos.loaded;
  return items.map(item => {
    const assetId = item.assetId;
    return { key: item.key, state: item.state, preview: item.preview,
      onRemove: item.exit === 'REMOVE' && assetId ? () => ask(removalRequest('TASK', () => photos.remove(assetId)))
        : item.exit === 'DROP' ? () => photos.drop(item.requestId) : undefined,
      removeDisabled: item.exit === 'REMOVE' ? removeBlocked : disabled,
      onRetry: item.retry === 'AGAIN' && assetId ? () => { void photos.again(assetId); } : undefined,
      retryDisabled: disabled || photos.busy || photos.unconfirmed };
  });
}

/**
 * The way out of the one unconfirmed send and the check of a photo still processing: each drawn once. In the conversation they stand on the
 * person's side (`end`); on the photo screen, where everything starts at the edge, they start there too (`start`).
 */
export function TaskPhotoRecovery({ photos, disabled = false, align = 'end' }: { photos: TaskPhotosController; disabled?: boolean; align?: 'start' | 'end' }) {
  const off = disabled || photos.busy;
  if (!photos.unconfirmed && !photos.checkByHand && !photos.readError) return null;
  return <View style={[s.actions, align === 'start' && s.actionsStart]}>
    {photos.unconfirmed && photos.canRetry ? <V2Action tone="neutral" kind="secondary" compact label={PHOTO_WORDS.retry}
      loading={photos.working === 'RETRY'} disabled={off} onPress={() => { void photos.retry(); }} /> : null}
    {photos.unconfirmed ? <V2Action tone="neutral" kind="quiet" compact label={PHOTO_WORDS.cancel}
      loading={photos.working === 'CANCEL'} disabled={off} onPress={() => { void photos.cancel(); }} /> : null}
    {/* The shared vocabulary (`system/outcomeCopy`): what is not known is looked at with ONE word, "Proveri"; a read that did not arrive is
        tried again. The sentence above says what is not known and never the verb of this button; a screen reader still hears what is checked. */}
    <V2Action tone="neutral" kind="quiet" compact label={photos.readError && !photos.unconfirmed && !photos.checkByHand ? OUTCOME_ACTION.retry : OUTCOME_ACTION.check}
      accessibilityLabel={PHOTO_WORDS.check} loading={photos.working === 'REFRESH'} disabled={off} onPress={() => { void photos.refresh(); }} />
  </View>;
}

/** "Dodata fotografija", "Dodate 3 fotografije", "Dodato 5 fotografija": the person's own action, said as done. */
function addedWords(count: number): string {
  const counted = photoCount(count), [, word] = counted.split(' ');
  return count === 1 ? 'Dodata fotografija' : word === 'fotografije' ? `Dodate ${counted}` : `Dodato ${counted}`;
}

/**
 * The photos added at one moment of the task conversation, as one line of its history (owner, 2026-10-07: nothing stays
 * docked at the bottom; the confirmed place set the pattern). The tiles stand on the person's side of the thread, the
 * person's own contribution, with one local caption ("Dodata fotografija (2/6)") that no AI wrote. The line of the newest
 * moment also carries what is happening now: the status sentence, a denied camera's way forward, and the recovery of an
 * unconfirmed send.
 */
export function TaskPhotoLine({ photos, items, total = items.length, latest, ask, disabled = false, onGallery }: {
  photos: TaskPhotosController; items: readonly TaskPhotoItem[];
  /** Every photo the draft holds now, across all its lines (the "(2/6)"). */ total?: number; latest: boolean;
  ask: (request: ConfirmRequest) => void; disabled?: boolean;
  /** The gallery as the way forward after a denied camera. */
  onGallery?: () => void;
}) {
  const saved = items.filter(item => item.state.kind === 'READY').length;
  const used = Math.min(PHOTO_LIMIT, Math.max(PHOTO_LIMIT - photos.remaining, total));
  const caption = saved ? `${addedWords(saved)}${latest ? ` (${used}/${PHOTO_LIMIT})` : ''}` : null;
  // A success needs no sentence of its own in the thread: the caption already says what was added.
  const status = latest && photos.message && !photos.permissionDenied && photos.tone !== 'success' ? photos.message : null;
  if (!items.length && !status && !(latest && photos.permissionDenied && photos.message)) return null;
  return <View testID="task-photo-line" style={s.line}>
    {items.length ? <PhotoAttachStrip testID="task-photo-strip" align="end" tiles={taskPhotoTiles(photos, items, ask, disabled)} viewerTitle="Fotografije zadatka" /> : null}
    {caption ? <T variant="note" tone="muted" style={s.end}>{caption}</T> : null}
    {latest && photos.permissionDenied && photos.message ? <PermissionRecovery compact message={photos.message}
      alternative={PHOTO_SOURCE_WORDS.LIBRARY} onAlternative={onGallery} /> : null}
    {status ? <T variant="note" accessibilityLiveRegion="polite" accessibilityRole={photos.tone === 'error' ? 'alert' : undefined}
      style={[s.end, photos.tone === 'error' ? s.danger : s.muted]}>{status}</T> : null}
    {latest ? <TaskPhotoRecovery photos={photos} disabled={disabled} /> : null}
  </View>;
}

const s = StyleSheet.create({
  // The person's side of the thread: the tiles end at the right edge, as the person's own words do.
  line: { alignSelf: 'stretch', alignItems: 'flex-end', gap: sys.space.xs },
  end: { textAlign: 'right', maxWidth: '90%' },
  muted: { color: sys.color.muted }, danger: { color: sys.color.danger },
  actions: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end', gap: sys.space.sm },
  actionsStart: { justifyContent: 'flex-start' },
});
