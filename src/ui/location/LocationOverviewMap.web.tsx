import { StyleSheet, View } from 'react-native';
import { T } from '../Text';
import { sys } from '../system/tokens';
import type { LocationOverviewMapProps } from './LocationOverviewMap.types';
export type { LocationOverviewMapProps, LocationOverviewPoint } from './LocationOverviewMap.types';

/**
 * No native SDK, precise coordinates, provider request or fabricated web map. It keeps the height the map would have, with its words at
 * the foot, so that what lies over a map (the "Otvori mapu" control in its corner) lies over an empty canvas and not over the words.
 */
export function LocationOverviewMap(props: LocationOverviewMapProps) {
  return <View testID={props.testID} style={[s.notice, typeof props.height === 'number' && { minHeight: props.height }]}>
    <T variant="bodyStrong">Mapa je dostupna u mobilnoj aplikaciji.</T>
    <T variant="meta" tone="muted">Potvrđena mesta ostaju navedena u ovom pregledu.</T>
  </View>;
}
const s = StyleSheet.create({ notice: { padding: sys.space.md, gap: sys.space.xs, justifyContent: 'flex-end', backgroundColor: sys.color.wash, borderRadius: sys.radius.card } });
