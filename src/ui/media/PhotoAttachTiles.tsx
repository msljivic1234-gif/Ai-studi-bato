import { useMemo, useState, type ReactNode } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { Press } from '../Press';
import { T } from '../Text';
import { FactArt, type FactArtKind } from '../system/FactArt';
import { Glyph } from '../system/Glyph';
import { sys } from '../system/tokens';
import { useTextScale } from '../system/textScale';
import { AuthorizedPhoto } from './AuthorizedPhoto';
import { PhotoViewer, type PhotoReadContext } from './PhotoViewer';
import { jpegDataUri } from './jpegDataUri';
import { PHOTO_WORDS } from './photoWords';

/**
 * The photo tiles both chats and the task's photo screen draw (owner, 2026-10-07). One tile says one thing: a saved photo
 * (tap: full screen; X: take it out, after a question the caller asks), a photo waiting its turn, being sent, being
 * processed, not confirmed, or not processed. A photo picked in this visit shows its own picture while it waits and goes,
 * from the prepared bytes in memory, so a row of grey squares never stands for photos the person can see in their head.
 * Presentation only: every callback is the caller's own command.
 */

export type AttachTileState =
  | { kind: 'READY'; assetId: string }
  | { kind: 'QUEUED' | 'SENDING' | 'PROCESSING' | 'UNCONFIRMED' | 'FAILED' | 'RESERVED' };
export type AttachTileKind = AttachTileState['kind'];

export type AttachTile = {
  key: string;
  state: AttachTileState;
  /** The prepared JPEG of a photo picked in this visit; never a file path or a stored copy. */
  preview?: ArrayBuffer;
  /** The X in the corner. The caller asks before a saved photo goes. */
  onRemove?: () => void; removeLabel?: string; removeDisabled?: boolean;
  /** A tap on a tile that can be sent again (same request) or resent. */
  onRetry?: () => void; retryDisabled?: boolean;
};

/** One word or two for each state, said on the tile and to a screen reader. */
export const TILE_WORDS: Readonly<Record<Exclude<AttachTileKind, 'READY'>, string>> = {
  QUEUED: 'Čeka', SENDING: 'Šalje se…', PROCESSING: 'Obrađuje se…', UNCONFIRMED: 'Ne znamo da li je poslato',
  FAILED: 'Nije obrađena', RESERVED: 'Uz poslatu poruku',
};
const ART: Readonly<Record<Exclude<AttachTileKind, 'READY'>, FactArtKind>> = {
  QUEUED: 'clock', SENDING: 'photo', PROCESSING: 'photo', UNCONFIRMED: 'info', FAILED: 'photo', RESERVED: 'chat',
};

/** A prepared photo drawn from memory: no cache, no file. */
export function LocalPhoto({ bytes }: { bytes: ArrayBuffer }) {
  const uri = useMemo(() => jpegDataUri(bytes), [bytes]);
  return <Image source={{ uri }} accessible={false} contentFit="cover" cachePolicy="none" transition={0} style={StyleSheet.absoluteFill} />;
}

export function PhotoAttachTile({ tile, index, size, context = {}, onOpen, picture }: {
  tile: AttachTile; index: number; size: number; context?: PhotoReadContext;
  /** A saved photo opens the shared full-screen viewer. */
  onOpen?: () => void;
  /** The design gallery's stand-in for the photo, so it reads nothing. */
  picture?: ReactNode;
}) {
  const n = index + 1, frame = { width: size, height: size };
  // The corner control: a 48 px target around a 32 px white circle; a greyed one stays readable, never faded.
  const remove = tile.onRemove ? <Press accessibilityRole="button" accessibilityLabel={tile.removeLabel ?? `Ukloni fotografiju ${n}`}
    accessibilityState={{ disabled: !!tile.removeDisabled }} disabled={tile.removeDisabled} haptic={tile.removeDisabled ? 'none' : 'select'}
    onPress={tile.onRemove} hitSlop={0} style={s.removeTarget}>
    <View style={s.removeCircle}><Glyph name="close" size={16} tone={tile.removeDisabled ? 'muted' : 'ink'} /></View>
  </Press> : null;
  if (tile.state.kind === 'READY') return <View testID={`photo-tile-${n}`} style={[frame, s.frame]}>
    {picture ?? <AuthorizedPhoto assetId={tile.state.assetId} {...context} label={`Fotografija ${n}`} contentFit="cover" style={s.fill}
      pending={tile.preview ? <LocalPhoto bytes={tile.preview} /> : undefined}
      open={onOpen ? { label: `Otvori fotografiju ${n}`, hint: 'Otvara fotografiju preko celog ekrana.', onPress: onOpen } : undefined} />}
    {remove}
  </View>;
  const kind = tile.state.kind, words = TILE_WORDS[kind];
  const working = kind === 'SENDING' || kind === 'PROCESSING';
  const unsaved = kind === 'QUEUED' || kind === 'SENDING' || kind === 'UNCONFIRMED';
  const retry = tile.onRetry ? PHOTO_WORDS.retry : null;
  // Over the photo's own picture the state is a white chip at the bottom; without one, it stands in the middle of the well.
  const state = tile.preview ? <View style={s.chipArea} pointerEvents="none">
    {working ? <View style={s.spinner}><ActivityIndicator size="small" color={sys.color.ink} /></View> : null}
    <View style={s.chip}><T variant="meta" numberOfLines={3} style={s.chipText}>{retry ?? words}</T></View>
  </View> : <View style={[s.state, tile.onRemove && s.stateBelowRemove]} pointerEvents="none">
    {working ? <ActivityIndicator size="small" color={sys.color.ink} /> : retry || tile.onRemove ? null : <FactArt kind={ART[kind]} size={24} muted />}
    <T variant="meta" tone="muted" numberOfLines={3} style={s.center}>{words}</T>
    {retry ? <T variant="meta" numberOfLines={2} style={[s.center, s.retry]}>{retry}</T> : null}
  </View>;
  const body = <>{tile.preview ? <LocalPhoto bytes={tile.preview} /> : null}{state}</>;
  return <View testID={`photo-tile-${n}`} style={[frame, s.frame, s.well, unsaved && s.unsaved]}>
    {tile.onRetry ? <Press accessibilityRole="button" accessibilityLabel={`${PHOTO_WORDS.retry} · fotografija ${n}`} accessibilityHint={words}
      accessibilityState={{ disabled: !!tile.retryDisabled }} disabled={tile.retryDisabled} haptic={tile.retryDisabled ? 'none' : 'select'}
      onPress={tile.onRetry} scaleTo={1} style={s.fill}>{body}</Press>
      : <View accessible accessibilityLabel={`Fotografija ${n}: ${words}`} style={s.fill}>{body}</View>}
    {remove}
  </View>;
}

/**
 * The shared full-screen viewer for the saved photos among `tiles`. Mounted while open; `openFor(tile)` is the tap of a
 * saved tile and nothing for any other.
 */
export function usePhotoViewer(tiles: readonly AttachTile[], context: PhotoReadContext, title: string) {
  const [open, setOpen] = useState<number | null>(null);
  const ready = tiles.flatMap(tile => tile.state.kind === 'READY' ? [{ assetId: tile.state.assetId }] : []);
  const openFor = (tile: AttachTile) => {
    const state = tile.state;
    if (state.kind !== 'READY') return undefined;
    return () => { const at = ready.findIndex(photo => photo.assetId === state.assetId); if (at >= 0) setOpen(at); };
  };
  const viewer = open !== null && ready.length ? <PhotoViewer title={title} context={context} photos={ready} index={open}
    onIndex={setOpen} onClose={() => setOpen(null)} /> : null;
  return { openFor, viewer };
}

/** The tile size in a chat row: one ordinary size, larger with large text so a state's two words still fit. */
export function usePhotoTileSize(): number {
  return useTextScale() >= 1.3 ? 136 : 104;
}

/** A row of tiles that scrolls sideways, as both chats draw the photos of one moment. `end` keeps a short row on the right. */
export function PhotoAttachStrip({ tiles, context = {}, viewerTitle, testID, align = 'start' }: {
  tiles: readonly AttachTile[]; context?: PhotoReadContext; viewerTitle: string; testID?: string; align?: 'start' | 'end';
}) {
  const size = usePhotoTileSize();
  const { openFor, viewer } = usePhotoViewer(tiles, context, viewerTitle);
  return <>
    <ScrollView testID={testID} horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" style={s.strip}
      contentContainerStyle={[s.row, align === 'end' && s.rowEnd]}>
      {tiles.map((tile, index) => <PhotoAttachTile key={tile.key} tile={tile} index={index} size={size} context={context} onOpen={openFor(tile)} />)}
    </ScrollView>
    {viewer}
  </>;
}

const s = StyleSheet.create({
  strip: { alignSelf: 'stretch', flexGrow: 0 },
  row: { gap: sys.space.sm, paddingVertical: 2 },
  rowEnd: { flexGrow: 1, justifyContent: 'flex-end' },
  frame: { borderRadius: sys.radius.control, overflow: 'hidden' },
  fill: { width: '100%', height: '100%', aspectRatio: undefined, borderRadius: 0 },
  well: { backgroundColor: sys.color.wash },
  // A photo not yet saved has a dashed edge, so it never reads as one the draft or the message already holds.
  unsaved: { borderWidth: 1.5, borderStyle: 'dashed', borderColor: sys.color.lineStrong },
  state: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: sys.space.xs, padding: sys.space.sm },
  // The corner X is a 48 dp target around a 32 dp circle (8 dp in): a tile that has one starts its words below the circle.
  stateBelowRemove: { paddingTop: sys.space.xxl + sys.space.sm },
  center: { textAlign: 'center' },
  retry: { color: sys.color.ink, fontWeight: '600' },
  chipArea: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'flex-end', padding: sys.space.xs, gap: sys.space.xs },
  spinner: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  chip: { maxWidth: '100%', paddingHorizontal: sys.space.sm, paddingVertical: 2, borderRadius: sys.radius.chip, backgroundColor: sys.color.veil },
  chipText: { color: sys.color.ink, textAlign: 'center' },
  removeTarget: { position: 'absolute', top: 0, right: 0, width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  removeCircle: { width: 32, height: 32, borderRadius: sys.radius.pill, backgroundColor: sys.color.surface, borderWidth: 1,
    borderColor: sys.color.line, alignItems: 'center', justifyContent: 'center' },
});
