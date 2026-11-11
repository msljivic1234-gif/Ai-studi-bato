import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Glyph } from '../system/Glyph';
import { mediaClientService, type MediaPreview, type ProfilePhoto as ProfilePhotoRead } from '../../data/mediaClientService';
import type { Ishod } from '../../data/ports';
import { useOwnedEditor } from '../../hooks/useOwnedEditor';
import { useSesija } from '../../store/sesija';
import { AuthorizedPhoto } from './AuthorizedPhoto';
import { ownPhotoCache, type OwnPhotoScope } from './ownPhotoCache';
import { sys } from '../system/tokens';
import { T } from '../Text';
import { FactArt } from '../system/FactArt';
import { inicijali } from '../../lib/inicijali';
import { PhotoPages, PhotoViewer } from './PhotoViewer';

/** The viewer is shared (both chats' photo tiles open it); it lives in its own file and is re-exported here. */
export { PhotoViewer, type PhotoReadContext } from './PhotoViewer';

/**
 * Only actual photos lead the detail, and only photos that can be seen (the owner's phone, 8 Oct 2026: a big grey plate with a dot and "1 / 1" stood
 * where a photo that would not load should have been). While a photo is read its page holds a picture of a photo; one that cannot be read is left
 * out, and a task whose photos can none of them be read draws no gallery at all. An authoritative empty list stays absent for either side; a failed
 * read of the LIST draws nothing either (the screen is read again on every visit), so no sentence says something is missing. `owned` is retained
 * for caller compatibility.
 */
export function NeedPhotos({ needId }: { needId: string; owned?: boolean }) {
  const { user, accountRevision } = useSesija();
  const read = useCallback(() => mediaClientService.readNeedPhotos(needId), [needId]);
  const editor = useOwnedEditor(read);
  // The photos that could not be read in this visit. Every visit tries them again, so a photo that failed once is not lost for good.
  const [lost, setLost] = useState<ReadonlySet<string>>(() => new Set());
  useFocusEffect(useCallback(() => { setLost(previous => previous.size ? new Set() : previous); }, []));
  const lose = useCallback((assetId: string) => setLost(previous => previous.has(assetId) ? previous : new Set(previous).add(assetId)), []);
  const all = editor.data?.photos ?? [], photos = all.filter(photo => !lost.has(photo.assetId));
  if (!photos.length) return null;
  // The key is what the task has, not what could be read: a page that is left out does not make the others read their photos again.
  return <NeedPhotoGallery key={`${user?.id}:${accountRevision}:${needId}:${all.map(photo => photo.assetId).join(':')}`}
    needId={needId} photos={photos} onLost={lose} />;
}

/** A page whose photo cannot be read says so to the gallery once, and draws nothing. */
function Lost({ onLost }: { onLost: () => void }) {
  useEffect(() => { onLost(); }, [onLost]);
  return null;
}

function NeedPhotoGallery({ needId, photos, onLost }: { needId: string; photos: readonly MediaPreview[]; onLost: (assetId: string) => void }) {
  const [chosen, setIndex] = useState(0), [open, setOpen] = useState(false);
  // A page that was left out may have been the one the person stood on.
  const index = Math.min(chosen, photos.length - 1);
  useFocusEffect(useCallback(() => () => setOpen(false), []));
  const close = () => setOpen(false);
  const counter = `${index + 1} / ${photos.length}`;
  const context = { needId };
  return <>
    <View style={galleryStyles.inline} accessibilityElementsHidden={open} importantForAccessibility={open ? 'no-hide-descendants' : 'auto'}>
      <PhotoPages context={context} photos={photos} index={index} onIndex={setIndex} onOpen={page => { setIndex(page); setOpen(true); }}
        pending={<FactArt kind="photo" size={48} />} unavailable={assetId => <Lost onLost={() => onLost(assetId)} />} />
      {/* The count of the pages is a fact about more than one photo; one photo is "1 / 1" and says nothing. */}
      {photos.length > 1 ? <View pointerEvents="none" style={galleryStyles.overlay}>
        <View style={galleryStyles.counter}><Glyph name="expand" size={16} />
          <T variant="meta" accessibilityLabel={`Fotografija ${index + 1} od ${photos.length}`}>{counter}</T></View>
      </View> : null}
    </View>
    {open ? <PhotoViewer context={context} photos={photos} index={index} onIndex={setIndex} onClose={close} /> : null}
  </>;
}

const galleryStyles = StyleSheet.create({
  inline: { borderRadius: sys.radius.cardCompact, overflow: 'hidden' },
  overlay: { position: 'absolute', bottom: 12, right: 12 },
  counter: { minHeight: 32, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: sys.radius.pill, backgroundColor: sys.color.surface },
});

/**
 * The first step of reading the signed-in person's own face: which picture the profile has. A description that is recent enough is the answer and nothing is
 * asked; otherwise the profile is asked and the answer is remembered (an answer that says there is no photograph makes the cache forget what it kept of the profile).
 */
async function readOwnProfilePhoto(scope: OwnPhotoScope, profileId: string): Promise<Ishod<ProfilePhotoRead>> {
  const remembered = ownPhotoCache.description(scope, profileId);
  if (remembered?.fresh) return { ok: true, podatak: { profileId, photo: remembered.photo, authoritative: true } };
  const mark = ownPhotoCache.mark();
  const result = await mediaClientService.readProfilePhoto(profileId);
  if (result.ok) ownPhotoCache.rememberDescription(scope, profileId, result.podatak.photo, mark);
  return result;
}

/**
 * A person's face, or something standing in for it.
 *
 * Two call sites passed `fallback={null}` and the sheet above them tried to catch that with `??`,
 * which never fired because this component always returned an element. Anyone without a photo got
 * an empty green disc, and a photo that failed to load looked exactly like a person who had none.
 * The decision belongs here: a caller may pass its own fallback, but it cannot ask for nothing.
 *
 * `own` is for the signed-in person's own face only (owner's phone, 8 Oct 2026: it showed the photograph one moment and only the letter the next, because
 * every visit read it again and drew the letter meanwhile). Such a face is remembered in memory (`ownPhotoCache`): the description is not asked for again while
 * it is recent, and what is remembered is drawn at once, so there is no stand-in in between. Anyone else's face is read every time, as before.
 */
export function ProfilePhoto({ profileId, fallback, size, initial, own = false }: { profileId: string; fallback?: ReactNode; size?: number; initial?: string | null;
  own?: boolean }) {
  const { user, accountRevision } = useSesija();
  const scope = useMemo(() => own && user?.id ? { accountId: user.id, accountRevision } : null, [own, user?.id, accountRevision]);
  const read = useCallback(() => scope ? readOwnProfilePhoto(scope, profileId) : mediaClientService.readProfilePhoto(profileId), [scope, profileId]);
  const editor = useOwnedEditor(read);
  // The remembered description is the one thing a screen may keep drawing while the profile is asked again. What an earlier read left in the editor is not
  // that: it may have been forgotten since (the photograph was changed or removed), so it counts only once the read that is under way has finished.
  const remembered = scope ? ownPhotoCache.description(scope, profileId) : undefined;
  const photo = scope ? remembered?.photo ?? (editor.loading ? null : editor.data?.photo ?? null) : editor.data?.photo;
  const box = size ? { width: size, height: size, borderRadius: size / 2, aspectRatio: 1 }
    : { width: 112, height: 132, borderRadius: sys.radius.card, aspectRatio: 112 / 132 };
  // The one way to take letters from a name (lib/inicijali, critique A4): no name, no letters, and the person is drawn.
  const letter = inicijali(initial);
  // What stands for the person when there is no photograph, or when it cannot be read right now.
  const standIn = fallback ? <>{fallback}</> : <View accessibilityLabel={letter ? `Bez fotografije: ${letter}` : 'Bez fotografije'}
    style={[box, { backgroundColor: sys.color.greenSoft, alignItems: 'center', justifyContent: 'center' }]}>
    {letter ? <T accessible={false} variant="title" style={{ color: sys.color.green }}>{letter}</T>
      : <FactArt kind="person" size={size ? Math.round(size / 2.2) : 40} />}
  </View>;
  if (photo) return <AuthorizedPhoto assetId={photo.assetId} profileId={profileId} label="Profilna fotografija" own={own}
    contentFit={size ? 'cover' : 'contain'} style={box} pending={standIn} unavailable={size ? standIn : undefined} />;
  if (editor.loading) return <View accessible accessibilityLabel="Učitavanje fotografije" accessibilityState={{ busy: true }}
    style={[box, { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }]}>
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">{standIn}</View>
  </View>;
  return standIn;
}
