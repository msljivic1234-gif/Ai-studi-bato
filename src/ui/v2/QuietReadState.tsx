import { StyleSheet, View } from 'react-native';
import { FactArt, type FactArtKind } from '../system/FactArt';
import { Surface } from '../system/Surface';
import { sys } from '../system/tokens';
import { T } from '../Text';

/** A read has no result yet. Keep its place calm and useful without drawing fake rows or progress. */
export function QuietReadState({ title, body, art }: { title: string; body: string; art: FactArtKind }) {
  return <View testID="quiet-read-state" accessibilityLiveRegion="polite" style={s.frame}>
    <Surface kind="panel" variant="outlined" style={s.panel}>
      <FactArt kind={art} size={64} />
      <T variant="heading" style={s.title}>{title}</T>
      <T variant="note" tone="muted" style={s.body}>{body}</T>
    </Surface>
  </View>;
}

const s = StyleSheet.create({
  frame: { flexGrow: 1, width: '100%' },
  panel: { minHeight: 216, alignItems: 'center', justifyContent: 'center', gap: sys.space.sm,
    paddingHorizontal: sys.space.xl, paddingVertical: sys.space.xl },
  title: { textAlign: 'center' },
  body: { textAlign: 'center', maxWidth: 280 },
});
