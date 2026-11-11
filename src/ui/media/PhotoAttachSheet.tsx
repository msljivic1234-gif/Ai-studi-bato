import { useCallback, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import type { PhotoSource } from '../../features/media/nativePhotoPicker';
import { Press } from '../Press';
import { T } from '../Text';
import { ProductSheet } from '../product/ProductSheet';
import { FactArt } from '../system/FactArt';
import { Glyph, type GlyphName } from '../system/Glyph';
import { pictureWell, sys } from '../system/tokens';
import { PHOTO_SOURCE_WORDS, PHOTO_WORDS, librarySubtitle } from './photoWords';

/** A row the caller adds under the two sources (the Dogovor's earlier prepared photos). */
export type PhotoSheetRow = { key: string; label: string; subtitle?: string; glyph?: GlyphName; disabled?: boolean; onPress: () => void };

type Row = { key: string; label: string; subtitle?: string; glyph: GlyphName; disabled: boolean; run: () => void };

/**
 * The one way to add photos, in both chats and on the task's photo screen: a sheet with "Galerija" and "Kamera", the
 * limits sentence and, for a task, the processing notice, which stand before every pick (privacy text). The gallery takes
 * as many as are still free when the caller can send several; the camera takes one. The chosen source runs once the sheet
 * has gone, so the system picker never opens underneath it. Presentation only: the caller picks, sends and recovers.
 */
export function PhotoAttachSheet({ remaining, multiple = true, disabledReason, limits, notice, rows: extra = [], onPick, onClose, reduced }: {
  /** Photos that can still be added; the gallery promises no more than this. */
  remaining: number;
  /** The caller sends several photos from one pick (the task); the Dogovor takes one at a time. */
  multiple?: boolean;
  /** Why neither source can be used now, in the caller's words; said once under them and spoken as their hint. */
  disabledReason?: string | null;
  limits: string; notice?: string;
  rows?: readonly PhotoSheetRow[];
  onPick: (source: PhotoSource) => void;
  onClose: () => void;
  reduced?: boolean;
}) {
  const chosen = useRef<(() => void) | null>(null);
  const closed = useCallback(() => { const run = chosen.current; chosen.current = null; onClose(); run?.(); }, [onClose]);
  const blocked = !!disabledReason || remaining < 1;
  const all: Row[] = [
    { key: 'LIBRARY', label: PHOTO_SOURCE_WORDS.LIBRARY, subtitle: multiple ? librarySubtitle(remaining) : librarySubtitle(1),
      glyph: 'image', disabled: blocked, run: () => onPick('LIBRARY') },
    { key: 'CAMERA', label: PHOTO_SOURCE_WORDS.CAMERA, subtitle: 'Fotografiši sada', glyph: 'camera', disabled: blocked, run: () => onPick('CAMERA') },
    ...extra.map(row => ({ key: row.key, label: row.label, subtitle: row.subtitle, glyph: row.glyph ?? 'image', disabled: !!row.disabled, run: row.onPress })),
  ];
  return <ProductSheet title={PHOTO_WORDS.add} reduced={reduced} onClose={closed} backdropHint="Zatvara bez izbora fotografije.">
    {dismiss => <View style={s.body}>
      <View accessibilityRole="menu" style={s.list}>
        {all.map(row => <Press key={row.key} testID={`photo-source-${row.key}`} accessibilityRole="menuitem" accessibilityLabel={row.label}
          accessibilityHint={(row.disabled && row.key in PHOTO_SOURCE_WORDS ? disabledReason : row.subtitle) ?? undefined}
          accessibilityState={{ disabled: row.disabled }} disabled={row.disabled} haptic={row.disabled ? 'none' : 'select'}
          onPress={() => { if (row.disabled || chosen.current) return; chosen.current = row.run; dismiss(); }} style={s.row}>
          <View style={pictureWell}><Glyph name={row.glyph} size={24} tone={row.disabled ? 'muted' : 'ink'} /></View>
          <View style={s.copy}>
            <T variant="bodyStrong" style={row.disabled ? s.muted : s.ink}>{row.label}</T>
            {row.subtitle ? <T variant="note" tone="muted">{row.subtitle}</T> : null}
          </View>
        </Press>)}
      </View>
      {/* The reason is the sources' spoken hint already; drawn for the eye, it is not read a second time. */}
      {disabledReason ? <T variant="note" style={s.ink} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">{disabledReason}</T> : null}
      <View style={s.note}>
        <FactArt kind="lock" size={20} />
        <View style={s.noteText}>
          <T variant="note" tone="muted">{limits}</T>
          {notice ? <T variant="note" tone="muted">{notice}</T> : null}
        </View>
      </View>
    </View>}
  </ProductSheet>;
}

const s = StyleSheet.create({
  body: { gap: sys.space.md, paddingBottom: sys.space.xs },
  list: { gap: sys.space.xs },
  row: { minHeight: (pictureWell.height as number) + 2 * sys.space.xs, flexDirection: 'row', alignItems: 'center', gap: sys.space.md,
    paddingVertical: sys.space.xs, paddingHorizontal: sys.space.xs, borderRadius: sys.radius.control },
  copy: { flex: 1, minWidth: 0, gap: 2 },
  ink: { color: sys.color.ink }, muted: { color: sys.color.muted },
  note: { flexDirection: 'row', alignItems: 'flex-start', gap: sys.space.md, paddingTop: sys.space.xs },
  noteText: { flex: 1, gap: sys.space.sm },
});
