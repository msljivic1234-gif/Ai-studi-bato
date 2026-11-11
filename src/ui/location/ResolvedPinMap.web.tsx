import { View } from 'react-native';
import { T } from '../Text';
import { locationStyles } from './LocationControls';
import type { ResolvedPinMapProps } from './ResolvedPinMap.types';
export type { ResolvedPinMapProps, ResolvedPinPosition } from './ResolvedPinMap.types';

/** The approved native renderer has no equivalent web editor in this bounded unit. */
export function ResolvedPinMap(_props: ResolvedPinMapProps) {
  return <View style={locationStyles.notice} accessibilityLabel="Mapa zahteva mobilnu aplikaciju">
    <T variant="bodyStrong">Otvori mobilnu aplikaciju za izbor na mapi.</T>
    <T variant="meta" tone="muted">U ovom pregledu možeš nastaviti unos lokacije. Mapa i potvrda tačke dostupne su u mobilnoj aplikaciji.</T>
  </View>;
}
