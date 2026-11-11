import { ScrollView, StyleSheet, View } from 'react-native';
import type { AgreementPhotosController } from '../../hooks/useAgreementPhotos';
import { PHOTO_PERMISSION_MESSAGE } from '../../features/media/nativePhotoPicker';
import { PermissionRecovery } from '../system/PermissionRecovery';
import { useConfirmSheet } from '../system/ConfirmSheet';
import { useReducedMotion } from '../system/motion';
import { Press } from '../Press';
import { T } from '../Text';
import { sys } from '../system/tokens';
import { PhotoAttachSheet } from './PhotoAttachSheet';
import { PhotoAttachStrip, type AttachTile, type AttachTileState } from './PhotoAttachTiles';
import { PHOTO_LIMIT, PHOTO_SOURCE_WORDS, PHOTO_WORDS, photoCount, photoLimits, removalRequest } from './photoWords';

/** Every command in the tray is a 48 px target. */
const COMMAND = 48;
/** The one reason a saved photo cannot come back and the tools cannot take another: the row is full. */
const SIX = `Već je izabrano ${photoCount(PHOTO_LIMIT)}.`;
type Item = AgreementPhotosController['items'][number];

/**
 * Why the Dogovor's photo sources are grey when the tray itself is not busy, in the order the controller withholds them: a
 * photo still on its way, a full row, or a Dogovor that no longer takes a photo. A read that failed explains itself in its
 * own message, so it gets no second line (review r6).
 */
export function agreementPhotoReason(photos: AgreementPhotosController, capturing: boolean): string | null {
  if (photos.available || photos.busy || capturing) return null;
  const pending = photos.items.some(item => !item.receipt || !['READY', 'CANCELLED', 'FAILED'].includes(item.receipt.state));
  return pending ? 'Sačekaj da se fotografija pošalje.' : photos.items.length >= PHOTO_LIMIT ? SIX
    : photos.loaded ? 'Osveži uslove Dogovora pre nove fotografije.' : null;
}

/**
 * The Dogovor's "+": the shared photo sheet (Galerija, Kamera, the one limits sentence), and, when earlier prepared photos
 * exist, the way back to them. The Dogovor takes one photo per pick: its photo controller sends one at a time.
 */
export function AgreementPhotoSheet({ photos, capturing, onClose, onShowSaved }: {
  photos: AgreementPhotosController; capturing: boolean; onClose: () => void; onShowSaved: () => void;
}) {
  const reduced = useReducedMotion();
  const reason = photos.available && !photos.busy && !capturing ? null
    : photos.busy || capturing ? 'Sačekaj da se završi prethodna radnja sa fotografijom.'
      : agreementPhotoReason(photos, capturing) ?? 'Fotografije još nisu učitane.';
  return <PhotoAttachSheet multiple={false} remaining={Math.max(0, PHOTO_LIMIT - photos.items.length)} disabledReason={reason}
    limits={photoLimits('AGREEMENT')} reduced={reduced} onPick={source => { void photos.pick(source); }} onClose={onClose}
    rows={photos.saved.length ? [{ key: 'saved', label: `Ranije pripremljene fotografije (${photos.saved.length})`,
      subtitle: 'Vrati jednu u poruku.', onPress: onShowSaved }] : []} />;
}

/** One prepared photo as the shared tile says it. A photo tied to a message already sent shows its picture, with no X. */
function tileOf(photos: AgreementPhotosController, item: Item, index: number, disabled: boolean,
  ask: ReturnType<typeof useConfirmSheet>['ask']): AttachTile {
  const reserved = photos.reserved(item), receipt = item.receipt;
  const state: AttachTileState = receipt?.state === 'READY' && receipt.photo ? { kind: 'READY', assetId: receipt.photo.assetId }
    : reserved ? { kind: 'RESERVED' } : receipt?.state === 'PROCESSING' || receipt?.state === 'STAGED' ? { kind: 'PROCESSING' }
      : receipt?.state === 'FAILED' ? { kind: 'FAILED' } : photos.sending === item.ref.clientRequestId ? { kind: 'SENDING' } : { kind: 'UNCONFIRMED' };
  const retry = !reserved && !photos.busy && photos.canRetry(item.ref.clientRequestId) && (!receipt || receipt.state === 'ABSENT');
  return { key: item.ref.clientRequestId, state, preview: photos.preview(item.ref.clientRequestId),
    onRemove: reserved ? undefined : () => ask(removalRequest('AGREEMENT', () => photos.remove(item.ref))),
    removeLabel: `Uklonite pripremljenu fotografiju ${index + 1}`, removeDisabled: disabled,
    onRetry: retry ? () => { void photos.retry(item.ref); } : undefined, retryDisabled: disabled };
}

/**
 * The photos prepared for the next message of Poruke, drawn with the shared tiles above writing: tap a photo to see it
 * whole, its X to take it out (after a question), tap a photo whose outcome is not confirmed to send it again. What the
 * tiles cannot say in two words is said once under them. Every call is the photos controller's own; nothing here picks,
 * sends or deletes by itself.
 */
export function AgreementPhotoComposer({ photos, capturing, showSaved = false, onHideSaved }: {
  photos: AgreementPhotosController; capturing: boolean;
  /** The earlier prepared photos, asked for from the sheet. */
  showSaved?: boolean; onHideSaved?: () => void;
}) {
  const reduced = useReducedMotion();
  const confirm = useConfirmSheet({ reduced });
  const disabled = photos.busy || capturing;
  const tiles = photos.items.map((item, index) => tileOf(photos, item, index, disabled, confirm.ask));
  const why = agreementPhotoReason(photos, capturing);
  const reserved = photos.items.some(item => photos.reserved(item));
  const absent = photos.items.some(item => !photos.reserved(item) && item.receipt?.state === 'ABSENT');
  const unknown = photos.items.some(item => !photos.reserved(item) && !item.receipt && photos.sending !== item.ref.clientRequestId);
  const uncertain = absent || unknown || !photos.loaded;
  return <View style={s.tray}>
    {tiles.length ? <PhotoAttachStrip testID="agreement-photo-strip" tiles={tiles} context={{ agreementId: photos.agreementId }}
      viewerTitle="Fotografije uz poruku" /> : null}
    {reserved ? <T variant="meta" tone="muted">Fotografija je uz poruku. Prvo proverite da li je poslata.</T> : null}
    {absent ? <T variant="meta" tone="muted">Slanje fotografije nije započeto. Dodirni je da je pošalješ ponovo ili je ukloni.</T> : null}
    {unknown ? <T variant="meta" tone="muted">Ne znamo da li je fotografija poslata.</T> : null}
    {why && tiles.length ? <T variant="meta" tone="muted">{why}</T> : null}
    {photos.message === PHOTO_PERMISSION_MESSAGE ? <PermissionRecovery compact message={photos.message} alternative={PHOTO_SOURCE_WORDS.LIBRARY}
      onAlternative={() => { void photos.pick('LIBRARY'); }} />
      : photos.message ? <T variant="meta" accessibilityLiveRegion="polite">{photos.message}</T> : null}
    {photos.versionConflict ? <T variant="meta" accessibilityLiveRegion="polite">Uslovi Dogovora su se promenili. Ukloni pripremljene fotografije i izaberi ih ponovo.</T> : null}
    {uncertain ? <Press accessibilityRole="button" accessibilityLabel="Proveri fotografije poruke" accessibilityState={{ disabled }} disabled={disabled}
      onPress={() => { void photos.refresh(); }} style={s.text}>
      <T variant="meta" style={disabled ? s.off : s.on}>{PHOTO_WORDS.check}</T>
    </Press> : null}
    {showSaved && photos.saved.length ? <View style={s.saved}>
      <View style={s.savedHead}>
        <T variant="meta" tone="muted" style={s.flex}>Ranije pripremljene fotografije ({photos.saved.length})</T>
        {onHideSaved ? <Press accessibilityRole="button" accessibilityLabel="Sakrij ranije pripremljene fotografije" onPress={onHideSaved} style={s.text}>
          <T variant="meta" style={s.on}>Sakrij</T></Press> : null}
      </View>
      {/* Said once: when the line under the tiles already says the row is full, the saved list does not repeat it. */}
      {photos.items.length >= PHOTO_LIMIT && why !== SIX ? <T variant="meta" tone="muted">{SIX}</T> : null}
      <ScrollView keyboardShouldPersistTaps="handled" style={s.savedList}>
        {photos.saved.map((item, index) => <Press key={item.clientRequestId} accessibilityRole="button"
          accessibilityLabel={`Vrati sačuvanu fotografiju ${index + 1}`} disabled={disabled || photos.items.length >= PHOTO_LIMIT}
          accessibilityHint={photos.items.length >= PHOTO_LIMIT ? SIX : undefined}
          accessibilityState={{ disabled: disabled || photos.items.length >= PHOTO_LIMIT }}
          onPress={() => { void photos.restore(item.clientRequestId); }} style={s.text}>
          <T variant="meta">Fotografija {index + 1} · {item.photo ? `${item.photo.width} × ${item.photo.height}` : 'ne znamo da li je obrađena'} · Vrati u izbor</T>
        </Press>)}
      </ScrollView>
    </View> : null}
    {confirm.sheet}
  </View>;
}

const s = StyleSheet.create({
  tray: { gap: sys.space.sm },
  text: { minHeight: COMMAND, justifyContent: 'center', paddingHorizontal: sys.space.xs, alignSelf: 'flex-start' },
  on: { color: sys.color.ink, fontWeight: '600' }, off: { color: sys.color.muted },
  saved: { gap: sys.space.xs, paddingTop: sys.space.xs, borderTopWidth: 1, borderColor: sys.color.line },
  savedHead: { flexDirection: 'row', alignItems: 'center', gap: sys.space.sm },
  savedList: { maxHeight: 160 },
  flex: { flex: 1 },
});
