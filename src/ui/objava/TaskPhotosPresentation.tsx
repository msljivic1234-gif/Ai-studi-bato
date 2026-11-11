import { useState, type ReactNode } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { T } from '../Text';
import { FactArt } from '../system/FactArt';
import { Surface } from '../system/Surface';
import { sys } from '../system/tokens';
import { useLayoutClass } from '../system/textScale';
import { PhotoAttachTile, type AttachTile, type AttachTileState } from '../media/PhotoAttachTiles';
import type { PhotoReadContext } from '../media/PhotoViewer';
import { TASK_PHOTO_NOTICE } from '../media/photoWords';

/**
 * The parts of the task photo screen (/fotografije-zadatka), drawings only: the route's controller owns the journal, the
 * upload identity, the retry, the cancel and the removal; the design gallery (/dizajn-objava) draws the same parts from
 * fixtures. Since 2026-10-07 a tile is the shared photo tile both chats draw (`ui/media/PhotoAttachTiles`), so the screen
 * and the conversations show one photo one way.
 */

export type PhotoTone = 'progress' | 'success' | 'error' | 'info';

/** The side of a tile that stands alone in its row (large text). */
const STACKED_TILE = 240;

/** What just happened, in one line whose look says what kind of news it is. Announced politely; an error as an alert. */
export function PhotoStatus({ text, tone }: { text: string; tone: PhotoTone }) {
  return <View style={s.status} accessibilityLiveRegion="polite">
    {tone === 'progress' ? <ActivityIndicator size="small" color={sys.color.green} />
      : tone === 'success' ? <FactArt kind="check" size={18} /> : null}
    <T variant="body" accessibilityRole={tone === 'error' ? 'alert' : undefined} style={[s.grow, { color: tone === 'success'
      ? sys.color.green : tone === 'error' ? sys.color.danger : sys.color.ink }]}>{text}</T>
  </View>;
}

/** Two square tiles to a row, filling the width exactly (a percentage width wrapped at 320 dp). */
export function PhotoGrid({ children }: { children: (tile: number) => ReactNode }) {
  const [width, setWidth] = useState(0);
  // At large text (or on a very narrow screen) a tile's words need more than half the width: one tile to a row, and no taller than a
  // thumbnail can usefully be (a square as wide as a phone is a whole screen for one photo). The layout class is the one rule for that, so a
  // gallery can show it too.
  const { stacked } = useLayoutClass();
  const tile = !width ? 0 : stacked ? Math.min(width, STACKED_TILE) : Math.floor((width - sys.space.sm) / 2);
  return <View style={s.grid} onLayout={event => setWidth(event.nativeEvent.layout.width)}>{tile ? children(tile) : null}</View>;
}

export type PhotoTileState =
  | { kind: 'READY'; assetId: string }
  | { kind: 'PROCESSING' | 'FAILED'; assetId: string }
  | { kind: 'SENDING' | 'UNCONFIRMED' | 'QUEUED' };

/**
 * One tile of the grid: the shared photo tile at the grid's size. A photo in the draft carries its own small remove control
 * in the corner, never a full-width button under it; a greyed control stays readable, never faded. A photo being sent or
 * not yet confirmed is drawn with a dashed edge.
 */
export function PhotoTile({ state, index, size, removeDisabled, onRemove, onOpen, onRetry, preview, picture, context }: {
  state: PhotoTileState; index: number; size: number; removeDisabled: boolean; onRemove?: () => void;
  /** A saved photo opens the shared full-screen viewer. */ onOpen?: () => void;
  /** A photo that can be sent again from its bytes. */ onRetry?: () => void;
  /** The prepared bytes of a photo picked in this visit. */ preview?: ArrayBuffer;
  /** The design gallery's stand-in for the photo, so it reads nothing. */ picture?: ReactNode;
  context?: PhotoReadContext }) {
  const shared: AttachTileState = state.kind === 'READY' ? { kind: 'READY', assetId: state.assetId } : { kind: state.kind };
  const tile: AttachTile = { key: String(index), state: shared, preview, onRemove, removeDisabled, onRetry, retryDisabled: removeDisabled };
  return <PhotoAttachTile tile={tile} index={index} size={size} context={context} onOpen={onOpen} picture={picture} />;
}

/** While the first read runs: two quiet squares where the photos will stand, and one sentence. */
export function PhotosLoading() {
  return <View style={s.loading} accessibilityLiveRegion="polite">
    <PhotoGrid>{tile => <>
      <View style={[{ width: tile, height: tile }, s.placeholder]} />
      <View style={[{ width: tile, height: tile }, s.placeholder]} />
    </>}</PhotoGrid>
    <T variant="meta" tone="muted">Učitavamo fotografije…</T>
  </View>;
}

/** The limits and the processing notice, word for word (privacy text), with the lock. Always on screen before a pick. */
export function PhotosPrivacyNote({ limits }: { limits: string }) {
  return <Surface kind="note" style={s.privacy}>
    <FactArt kind="lock" size={20} />
    <View style={s.privacyText}>
      <T variant="note" tone="muted">{limits}</T>
      <T variant="note" tone="muted">{TASK_PHOTO_NOTICE}</T>
    </View>
  </Surface>;
}

const s = StyleSheet.create({
  grow: { flex: 1 },
  status: { flexDirection: 'row', alignItems: 'center', gap: sys.space.sm, minHeight: 24 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: sys.space.sm },
  placeholder: { backgroundColor: sys.color.wash, borderRadius: sys.radius.control },
  loading: { gap: sys.space.md },
  privacy: { flexDirection: 'row', alignItems: 'flex-start', gap: sys.space.md },
  privacyText: { flex: 1, gap: sys.space.sm },
});
