import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSesija } from '../../store/sesija';
import { uuid } from '../../data/serverReceipt';
import { DetailTopBar } from '../../ui/system/DetailTopBar';
import { FlowFooter } from '../../ui/system/FlowFooter';
import { layout } from '../../ui/system/layout';
import { OUTCOME_ACTION, cannotLoad } from '../../ui/system/outcomeCopy';
import { PermissionRecovery } from '../../ui/system/PermissionRecovery';
import { Screen } from '../../ui/system/Screen';
import { Section } from '../../ui/system/Section';
import { StateView } from '../../ui/system/StateView';
import { useConfirmSheet } from '../../ui/system/ConfirmSheet';
import { useReducedMotion } from '../../ui/system/motion';
import { brandAction } from '../../ui/system/tokens';
import { V2Action } from '../../ui/v2/V2Action';
import { PhotoGrid, PhotoStatus, PhotosLoading, PhotosPrivacyNote } from '../../ui/objava/TaskPhotosPresentation';
import { PhotoAttachTile, usePhotoViewer } from '../../ui/media/PhotoAttachTiles';
import { PhotoAttachSheet } from '../../ui/media/PhotoAttachSheet';
import { TaskPhotoRecovery, taskPhotoTiles } from '../../ui/media/TaskPhotoLine';
import { useTaskPhotoUploads } from '../../ui/media/useTaskPhotoUploads';
import { PHOTO_LIMIT, PHOTO_SOURCE_WORDS, PHOTO_WORDS, TASK_PHOTO_NOTICE, photoCount, photoLimits } from '../../ui/media/photoWords';

/**
 * The task draft's photos, all of them in one place: the screen the review links to ("manage photos"). Since 2026-10-07 it
 * draws the same tiles and says the same words as the conversation's "+" (Galerija, Kamera, the corner X, the full-screen
 * viewer), from the same controller (`useTaskPhotoUploads`), so a photo added in one is the same photo in the other.
 *
 * One screen of the system: the arrow and the name above, the photos as one section, the privacy note at the end, and the one
 * green action in the foot, with the reason ABOVE it while it is grey (UI/UX pass 2026-10-08).
 */
export default function TaskPhotosRoute() {
  const params = useLocalSearchParams<{ conversationId?: string }>(), { user, accountRevision } = useSesija();
  const id = typeof params.conversationId === 'string' && uuid(params.conversationId) ? params.conversationId : null;
  return <TaskPhotosEditor key={`${user?.id}:${accountRevision}:${id}`} conversationId={id} />;
}
function TaskPhotosEditor({ conversationId }: { conversationId: string | null }) {
  const photos = useTaskPhotoUploads(conversationId);
  const reduced = useReducedMotion();
  const confirm = useConfirmSheet({ reduced });
  const [choosing, setChoosing] = useState(false);
  // With no screen behind it (a cold start from a link), the arrow returns to the conversation these
  // photos belong to, not to a blank new one.
  const back = () => { if (!photos.leave()) return;
    if (router.canGoBack()) router.back();
    else router.replace(conversationId ? { pathname: '/nova', params: { conversationId } } : '/nova'); };
  const tiles = taskPhotoTiles(photos, photos.items, confirm.ask);
  const { openFor, viewer } = usePhotoViewer(tiles, {}, 'Fotografije zadatka');
  const addDisabled = !conversationId || !photos.canAdd;
  // Nothing can be added to a draft that cannot be read, and there is no draft to add to without a conversation.
  const footer = !conversationId || photos.readError ? null : <FlowFooter reason={photos.continueReason ?? photos.addReason ?? undefined}>
    <V2Action label={PHOTO_WORDS.add} kind="secondary" tone="neutral" loading={photos.working === 'PICK'} disabled={addDisabled}
      onPress={() => { if (!addDisabled) setChoosing(true); }} />
    <V2Action label="Gotovo" style={brandAction} disabled={!!photos.continueReason}
      onPress={() => { if (photos.canContinue()) back(); }} />
  </FlowFooter>;
  return <Screen kind="detail" header={<DetailTopBar title="Fotografije zadatka" onBack={back} />} footer={footer}>
    {!conversationId ? <StateView kind="error" art="photo" title="Fotografije nisu dostupne" body="Otvori fotografije iz razgovora o zadatku." />
      : photos.readError ? <StateView kind="error" art="photo" title={cannotLoad('fotografije').title} body={photos.message ?? cannotLoad('fotografije').copy}
        primary={{ label: OUTCOME_ACTION.retry, onPress: () => { void photos.refresh(); } }} />
      : <>
        {photos.message && photos.permissionDenied ? <PermissionRecovery message={photos.message} alternative={PHOTO_SOURCE_WORDS.LIBRARY}
          onAlternative={() => { void photos.pick('LIBRARY'); }} />
          : photos.message ? <PhotoStatus text={photos.message} tone={photos.tone} /> : null}
        {/* The photos are one section, named by how many there are of how many may be. The ways out of an unconfirmed send, and the
            check of a photo still processing after its own checks, stand right under them: each once. */}
        {tiles.length ? <Section title={`${photoCount(photos.count)} od ${PHOTO_LIMIT}`}>
          <View style={s.block}>
            <PhotoGrid>{size => tiles.map((tile, index) => <PhotoAttachTile key={tile.key} tile={tile} index={index} size={size}
              onOpen={openFor(tile)} />)}</PhotoGrid>
            <TaskPhotoRecovery photos={photos} align="start" />
          </View>
        </Section> : <TaskPhotoRecovery photos={photos} align="start" />}
        {photos.loaded && !tiles.length ? <StateView kind="empty" art="photo" title="Još nema fotografija" body="Dodaj ih dugmetom ispod." /> : null}
        {photos.busy && !photos.loaded && !photos.message ? <PhotosLoading /> : null}
      </>}
    <PhotosPrivacyNote limits={photoLimits('TASK')} />
    {choosing ? <PhotoAttachSheet remaining={photos.remaining} disabledReason={photos.addReason} limits={photoLimits('TASK')}
      notice={TASK_PHOTO_NOTICE} reduced={reduced} onPick={source => { void photos.pick(source); }} onClose={() => setChoosing(false)} /> : null}
    {viewer}
    {confirm.sheet}
  </Screen>;
}

const s = StyleSheet.create({
  block: { gap: layout.group },
});
