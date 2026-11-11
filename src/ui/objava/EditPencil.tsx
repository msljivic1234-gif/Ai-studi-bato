import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { Press } from '../Press';
import { T } from '../Text';
import { Glyph } from '../system/Glyph';
import { layout } from '../system/layout';
import { chrome } from '../system/ScreenChrome';
import { useLayoutClass } from '../system/textScale';
import { sys } from '../system/tokens';

/**
 * A contextual correction, named for screen readers ("Izmeni, Naslov"). The small drawing has a full 48 dp touch area;
 * it never competes with the primary publication action or takes a third of the text's line.
 */
export type PartPencil = { label: string; word?: string; onPress: () => void };

/**
 * Inline corrections use a single familiar pencil, at every font scale. Only the photo overlay needs a surface and a visible word
 * to remain legible over the picture; it falls back to the named icon in narrow/large-text layouts.
 */
export function EditPencil({ pencil, pill = false }: { pencil: PartPencil; pill?: boolean }) {
  const { stacked } = useLayoutClass();
  return <Press accessibilityRole="button" accessibilityLabel={pencil.label} onPress={() => pencil.onPress()} haptic="select"
    scaleTo={sys.motion.scale.button} style={pill ? s.pill : s.pencilBare}>
    <Glyph name="edit" size={20} tone="green" />
    {pill && !stacked ? <T variant="copy" style={s.word}>{pencil.word ?? 'Izmenite'}</T> : null}
  </Press>;
}

/** A photograph with the pencil of its part laid over its top right corner. */
export function PencilOverPhoto({ pencil, children }: { pencil?: PartPencil; children: ReactNode }) {
  return <View>
    {children}
    {pencil ? <View style={s.over} pointerEvents="box-none"><EditPencil pencil={pencil} pill /></View> : null}
  </View>;
}

const s = StyleSheet.create({
  pencilBare: { flexShrink: 0, alignItems: 'center', justifyContent: 'center', minWidth: layout.touch, minHeight: layout.touch },
  word: { fontWeight: '600', color: sys.color.green },
  // The capsule is the chrome's own 44 inside its touch (the press adds the reach to 48 and beyond).
  pill: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: sys.space.xs, minWidth: chrome.circle,
    minHeight: chrome.circle, paddingHorizontal: sys.space.md, borderRadius: sys.radius.pill, backgroundColor: sys.color.surface,
    borderWidth: 1, borderColor: sys.color.line },
  over: { position: 'absolute', top: sys.space.sm, right: sys.space.sm },
});
