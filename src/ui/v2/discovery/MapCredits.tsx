import { Linking, StyleSheet, View } from 'react-native';
import { Press } from '../../Press';
import { T } from '../../Text';
import { ActionSheet } from '../../system/ActionSheet';
import { Glyph } from '../../system/Glyph';
import { sys } from '../../system/tokens';
import { CONTROL_SIZE, controlsReserve } from './mapClearBand';

/** The sources a map of OpenStreetMap data and OpenMapTiles drawn by OpenFreeMap has to name (their licences ask for it). */
export const CREDITS = [
  { text: '© OpenStreetMap', url: 'https://www.openstreetmap.org/copyright' },
  { text: '© OpenMapTiles', url: 'https://www.openmaptiles.org/' },
  { text: 'OpenFreeMap', url: 'https://openfreemap.org/' },
] as const;

/** The row's inset from the map's left edge, and the air between a word and its (i). */
const INSET = sys.space.base;

/** Small fixed map credits. The raised list and pin card may cover them; they never ride either overlay. */
export function MapCredits({ bottom = 0, covered = false, locate, onPress }: {
  /** Fixed clearance for the lowered list, independent of its current position and any pin card. */ bottom?: number;
  /** An overlaid card/list also removes the covered control from touch and screen-reader navigation. */ covered?: boolean;
  locate: boolean; onPress: () => void;
}) {
  return <View testID="discovery-map-credits-layer" pointerEvents={covered ? 'none' : 'box-none'}
    accessibilityElementsHidden={covered} importantForAccessibility={covered ? 'no-hide-descendants' : 'auto'}
    style={[s.layer, { bottom: Math.max(0, bottom) + sys.space.xs }]}>
    <View testID="discovery-map-credits" pointerEvents="box-none" style={[s.attribution, { right: INSET + controlsReserve(locate) }]}>
      <Press accessibilityRole="button" accessibilityLabel="Izvori mape: © OpenStreetMap, © OpenMapTiles, OpenFreeMap"
        accessibilityHint="Otvara izvore i licence mape." hitSlop={0} style={s.link} onPress={onPress}>
        <T variant="label" style={s.credit} numberOfLines={1}>© OpenStreetMap · © OpenMapTiles</T><Glyph name="info" size={16} tone="muted" />
      </Press>
    </View>
  </View>;
}

/** The sources, as the licences ask them to be reachable: each opens its own page. */
export function MapSources({ reduced, onClose, onOpenUrl }: { reduced: boolean; onClose: () => void; onOpenUrl?: (url: string) => void }) {
  return <ActionSheet title="Izvori mape" reduced={reduced} onClose={onClose} actions={CREDITS.map(credit => ({
    key: credit.url, label: credit.text, icon: 'map' as const, hint: 'Otvara izvor u pregledaču.',
    onPress: () => { if (onOpenUrl) onOpenUrl(credit.url); else void Linking.openURL(credit.url).catch(() => {}); },
  }))} />;
}

const s = StyleSheet.create({
  // Fixed to the map, behind the screen's list/card layers.
  layer: { position: 'absolute', left: 0, right: 0, height: CONTROL_SIZE },
  attribution: { position: 'absolute', left: INSET, top: 0, bottom: 0, alignItems: 'flex-start', justifyContent: 'flex-end' },
  link: { maxWidth: '100%', minHeight: CONTROL_SIZE, flexDirection: 'row', alignItems: 'flex-end', gap: sys.space.xs, paddingBottom: sys.space.xs },
  credit: { fontWeight: '400', letterSpacing: 0, color: sys.color.muted, flexShrink: 1,
    textShadowColor: sys.color.surface, textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 4 },
});
