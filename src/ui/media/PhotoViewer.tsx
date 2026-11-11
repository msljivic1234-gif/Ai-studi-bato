import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Modal, ScrollView, StyleSheet, View, type LayoutChangeEvent, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AuthorizedPhoto } from './AuthorizedPhoto';
import { sys } from '../system/tokens';
import { T } from '../Text';
import { ChromeIconButton } from '../system/ScreenChrome';
import { useReducedMotion } from '../system/motion';

/**
 * The photo pages and the one full-screen viewer, moved out of ContextPhotos (2026-10-07) so the task detail's gallery and
 * both chats' photo tiles open the same thing. This file reads no service itself: every picture goes through
 * AuthorizedPhoto in the caller's context, so a screen that mocks the reader loads nothing else.
 */

/**
 * Where a photo is read from: a published task (`needId`), a Dogovor (`agreementId`, with `messageId` for a sent message),
 * or nothing for the owner's own draft. Each key reaches the existing contextual reader exactly as given.
 */
export type PhotoReadContext = Readonly<{ needId?: string; agreementId?: string; messageId?: string }>;
/** A page needs only the photo's identity; the reader authorizes it in its context. */
export type PagePhoto = Readonly<{ assetId: string }>;

/** The actual viewport owns a page's width, including narrow layouts and split-screen resizing.
 * Every image stays on the existing contextual reader: no URL, file copy, or persistent cache. */
export function PhotoPages({ context, photos, index, onIndex, onOpen, full = false, pending, unavailable }: {
  context: PhotoReadContext; photos: readonly PagePhoto[]; index: number; onIndex: (value: number) => void;
  onOpen?: (value: number) => void; full?: boolean;
  /** What stands in a page while its photo is read: a picture of a place for it (never a spinner, never a bare grey plate). Inline pages only. */
  pending?: ReactNode;
  /** What stands in a page whose photo cannot be read; the gallery that draws pages for a task uses it to leave that page out (nothing grey, nothing broken). */
  unavailable?: (assetId: string) => ReactNode;
}) {
  const [size, setSize] = useState({ width: 0, height: 0 });
  const scroll = useRef<ScrollView>(null);
  const measure = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    if (!Number.isFinite(width) || width <= 0 || !Number.isFinite(height) || height <= 0) return;
    setSize(previous => previous.width === width && previous.height === height ? previous : { width, height });
  };
  // Reframing on rotation, or coming back from the viewer, preserves the chosen photo without a slide across unrelated pages.
  useEffect(() => { if (size.width > 0) scroll.current?.scrollTo({ x: index * size.width, animated: false }); }, [index, size.width]);
  const settled = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (size.width <= 0 || !Number.isFinite(event.nativeEvent.contentOffset.x)) return;
    onIndex(Math.max(0, Math.min(photos.length - 1, Math.round(event.nativeEvent.contentOffset.x / size.width))));
  };
  return <View testID={full ? 'task-photo-viewer-viewport' : 'task-photo-viewport'} onLayout={measure}
    style={full ? s.viewerViewport : s.viewport}>
    {size.width > 0 ? <ScrollView ref={scroll} horizontal pagingEnabled directionalLockEnabled bounces={false}
      testID={full ? 'task-photo-viewer-pages' : 'task-photo-pages'} showsHorizontalScrollIndicator={false}
      onMomentumScrollEnd={settled} contentOffset={{ x: index * size.width, y: 0 }} style={s.pager}>
      {photos.map((photo, i) => {
        const picture = <AuthorizedPhoto assetId={photo.assetId} {...context} label={`Fotografija ${i + 1} od ${photos.length}`}
          contentFit={full ? 'contain' : 'cover'} style={{ width: size.width, height: size.height, aspectRatio: undefined, borderRadius: 0 }}
          pending={full ? undefined : pending} unavailable={full ? undefined : unavailable?.(photo.assetId)}
          open={full ? undefined : { label: `Otvori fotografiju ${i + 1} od ${photos.length}`,
            hint: 'Otvara fotografiju preko celog ekrana.', onPress: () => onOpen?.(i) }} />;
        return <View key={photo.assetId} accessibilityElementsHidden={i !== index} importantForAccessibility={i === index ? 'auto' : 'no-hide-descendants'}
          style={{ width: size.width, height: size.height }}>{picture}</View>;
      })}
    </ScrollView> : null}
  </View>;
}

/**
 * The one full-screen photo viewer: the task detail's gallery and both chats' photo tiles open it. Mounted means open; the
 * caller owns which photo is shown (`index`) and closes it on Back, the close button, or when it leaves the screen.
 */
export function PhotoViewer({ title = 'Fotografije zadatka', context, photos, index, onIndex, onClose }: {
  title?: string; context: PhotoReadContext; photos: readonly PagePhoto[]; index: number;
  onIndex: (value: number) => void; onClose: () => void;
}) {
  const reduced = useReducedMotion();
  const last = Math.max(0, photos.length - 1), shown = Math.max(0, Math.min(last, index));
  const counter = `${shown + 1} / ${photos.length}`;
  return <Modal visible presentationStyle="fullScreen" animationType={reduced ? 'none' : 'fade'} onRequestClose={onClose}>
    <SafeAreaView edges={['top', 'bottom']} accessibilityViewIsModal accessibilityLabel={title} style={s.viewer}>
      <View style={s.viewerHeader}><T accessibilityRole="header" variant="bodyStrong" style={s.grow}>{title}</T>
        <ChromeIconButton label="Zatvori fotografije" glyph="close" onPress={onClose} /></View>
      <PhotoPages context={context} photos={photos} index={shown} onIndex={onIndex} full />
      <View style={s.viewerFooter}>
        <ChromeIconButton label="Prethodna fotografija" glyph="caret-left" disabled={shown === 0} onPress={() => onIndex(Math.max(0, shown - 1))} />
        <T variant="bodyStrong" accessibilityLiveRegion="polite" accessibilityLabel={`Fotografija ${shown + 1} od ${photos.length}`}>{counter}</T>
        <ChromeIconButton label="Sledeća fotografija" glyph="caret-right" disabled={shown === last}
          onPress={() => onIndex(Math.min(last, shown + 1))} />
      </View>
    </SafeAreaView>
  </Modal>;
}

const s = StyleSheet.create({
  viewport: { width: '100%', aspectRatio: 4 / 3, backgroundColor: sys.color.wash },
  pager: { flex: 1 },
  viewer: { flex: 1, backgroundColor: sys.color.surface },
  viewerHeader: { flexDirection: 'row', alignItems: 'center', paddingLeft: 20, paddingRight: 12, gap: 12, paddingVertical: 8 },
  grow: { flex: 1, minWidth: 0 },
  viewerViewport: { flex: 1, width: '100%', backgroundColor: sys.color.wash },
  viewerFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 8 },
});
