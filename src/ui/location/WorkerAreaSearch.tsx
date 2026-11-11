import { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { Linking, View } from 'react-native';
import type { CoarsePosition } from '../../contracts/location';
import type { createConfiguredLocationResolver } from '../../data/configuredLocationResolver';
import { createProductionLocationResolver } from '../../data/productionLocationResolver';
import { V2Action } from '../v2/V2Action';
import { T } from '../Text';
import { displayedPinPosition } from './ResolvedPinMap.types';
import { locationStyles as s } from './LocationControls';

type CoarseCandidate = Readonly<{ label: string; position: CoarsePosition }>;
/** A quiet action keeps to its own width under the search, as the location screens have always drawn it. */
const quietStart = { alignSelf: 'flex-start' } as const;
type Lookup = { status: 'IDLE' | 'LOADING' | 'PROVIDER_ACTIVATION_BLOCKED' | 'INVALID_QUERY' | 'UNAVAILABLE' | 'RATE_LIMITED' }
  | { status: 'PROPOSALS'; candidates: readonly CoarseCandidate[] };
type Props = { city: string; countryCode: string; scopeKey: string; disabled: boolean;
  resolver?: Pick<ReturnType<typeof createConfiguredLocationResolver>, 'search' | 'cancel'>; onChoose: (position: CoarsePosition) => void };

/** Public city lookup only. Precise candidate coordinates never enter Worker state. */
export function WorkerAreaSearch(props: Props) {
  return <ScopedAreaSearch key={JSON.stringify([props.scopeKey, props.countryCode, props.city])} {...props} />;
}
function ScopedAreaSearch({ city, countryCode, scopeKey, disabled, resolver: injectedResolver, onChoose }: Props) {
  const [productionResolver] = useState(() => createProductionLocationResolver());
  const resolver = injectedResolver ?? productionResolver;
  const [lookup, setLookup] = useState<Lookup>({ status: 'IDLE' });
  const [focused, setFocused] = useState(false);
  const alive = useRef(true), focus = useRef(false), requestEpoch = useRef(0), renderEpoch = useRef(0);
  const currentDisabled = useRef(disabled); currentDisabled.current = disabled;
  const rendered = ++renderEpoch.current;
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  useFocusEffect(useCallback(() => {
    focus.current = true; setFocused(true);
    return () => {
      focus.current = false; requestEpoch.current++; renderEpoch.current++; resolver.cancel();
      setFocused(false); setLookup({ status: 'IDLE' });
    };
  }, [resolver]));
  useEffect(() => {
    if (disabled) { requestEpoch.current++; resolver.cancel(); setLookup({ status: 'IDLE' }); }
  }, [disabled, resolver]);
  const owns = () => alive.current && focus.current && !currentDisabled.current && rendered === renderEpoch.current;
  const retire = () => { requestEpoch.current++; renderEpoch.current++; resolver.cancel(); setLookup({ status: 'IDLE' }); };
  const search = async () => {
    if (!owns() || lookup.status === 'LOADING') return;
    retire(); setLookup({ status: 'LOADING' });
    const epoch = requestEpoch.current;
    const ownsRequest = () => alive.current && focus.current && !currentDisabled.current && epoch === requestEpoch.current;
    try {
      // No private address input, point metadata or radius is sent to the proxy.
      const result = await resolver.search({ text: city, countryCode, scopeKey });
      if (!ownsRequest()) return;
      if (result.status !== 'PROPOSALS') { setLookup({ status: result.status === 'CANCELLED' ? 'IDLE' : result.status }); return; }
      const coarse: CoarseCandidate[] = [];
      for (const candidate of result.candidates) {
        const position = displayedPinPosition(candidate.position, true);
        if (candidate.countryCode !== countryCode || !position) { setLookup({ status: 'UNAVAILABLE' }); return; }
        coarse.push({ label: candidate.label, position });
      }
      // Drop all precise coordinates and provider metadata before any state/UI update.
      setLookup({ status: 'PROPOSALS', candidates: coarse });
    } catch { if (ownsRequest()) setLookup({ status: 'UNAVAILABLE' }); }
  };
  const select = (candidate: CoarseCandidate) => {
    if (!owns()) return;
    retire(); onChoose(candidate.position);
  };
  return <View style={s.section}>
    <V2Action label={lookup.status === 'LOADING' ? 'Tražimo područje…' : lookup.status === 'UNAVAILABLE' ? 'Ponovi pretragu područja' : 'Pronađi područje za uneti grad'}
      kind="secondary" loading={lookup.status === 'LOADING'} disabled={disabled || !focused || !city.trim() || !countryCode || lookup.status === 'LOADING'} onPress={search} />
    {lookup.status === 'LOADING' ? <T variant="meta" accessibilityLiveRegion="polite">Tražimo predloge za grad ili mesto rada…</T> : null}
    {lookup.status === 'PROVIDER_ACTIVATION_BLOCKED' ? <T variant="meta" accessibilityLiveRegion="polite">Pretraga područja još nije aktivirana. Približnu tačku možeš izabrati na mapi.</T> : null}
    {lookup.status === 'UNAVAILABLE' ? <T variant="meta" accessibilityRole="alert">Predlozi područja trenutno nisu dostupni. Pokušaj ponovo ili označi područje na mapi.</T> : null}
    {lookup.status === 'RATE_LIMITED' ? <T variant="meta" accessibilityRole="alert">Previše pretraga za kratko vreme. Sačekaj pa pokušaj ponovo ili označi područje na mapi.</T> : null}
    {lookup.status === 'INVALID_QUERY' ? <T variant="meta" accessibilityRole="alert">Unesi grad ili mesto rada i proveri državu.</T> : null}
    {lookup.status === 'PROPOSALS' && lookup.candidates.length === 0 ? <T variant="meta" accessibilityLiveRegion="polite">Nema predloga za uneti grad. Proveri naziv ili označi područje na mapi.</T> : null}
    {lookup.status === 'PROPOSALS' ? <T variant="meta" accessibilityRole="link"
      onPress={() => { void Linking.openURL('https://locationiq.com/attribution').catch(() => {}); }}>Pretraga: LocationIQ · izvori podataka</T> : null}
    {lookup.status === 'PROPOSALS' ? lookup.candidates.map((candidate, index) => <V2Action key={index}
      label={`Izaberi područje: ${candidate.label}`} kind="quiet" style={quietStart} disabled={disabled || !focused} onPress={() => select(candidate)} />) : null}
    {lookup.status !== 'IDLE' ? <V2Action label="Otkaži pretragu područja" kind="quiet" style={quietStart} disabled={disabled || !focused}
      onPress={() => { if (owns()) retire(); }} /> : null}
  </View>;
}
