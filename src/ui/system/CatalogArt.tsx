import { Image, StyleSheet, View } from 'react-native';
import { sys } from './tokens';

/** A deliberately small Catalog27 mapping for deep help/privacy/legal surfaces. */
export type CatalogArtKind = 'lock' | 'support' | 'document' | 'shield';
const stills = {
  lock: require('../../../assets/catalog27/lock.png'),
  support: require('../../../assets/catalog27/support.png'),
  document: require('../../../assets/catalog27/document.png'),
  shield: require('../../../assets/catalog27/shield.png'),
} as const;

/** Decorative only: the adjacent native text names the purpose and current state. */
export function CatalogArt({ kind, muted = false }: { kind: CatalogArtKind; muted?: boolean }) {
  return <View accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants"
    pointerEvents="none" style={s.frame}>
    <Image source={stills[kind]} accessible={false} resizeMode="contain" fadeDuration={0}
      style={[s.frame, muted && s.muted]} />
  </View>;
}

const s = StyleSheet.create({
  frame: { width: 32, height: 32, flexShrink: 0 },
  muted: { tintColor: sys.color.muted, opacity: 0.65 },
});
