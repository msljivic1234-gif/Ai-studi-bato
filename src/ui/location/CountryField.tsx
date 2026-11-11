import { useCallback } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { marketClientService } from '../../data/marketClientService';
import type { MarketConfig } from '../../contracts/market';
import { useFocusedResource } from '../../hooks/useFocusedResource';
import { V2Action as Button } from '../v2/V2Action';
import { sys } from '../system/tokens';
import { T } from '../Text';
import { LocationChoice, locationStyles as s } from './LocationControls';

const NAMES: Readonly<Record<string, string>> = {
  RS: 'Srbija', BA: 'Bosna i Hercegovina', HR: 'Hrvatska', ME: 'Crna Gora',
  MK: 'Severna Makedonija', SI: 'Slovenija', AL: 'Albanija', BG: 'Bugarska', RO: 'Rumunija', GR: 'Grčka',
};
export function useCountryOptions() {
  const load = useCallback(() => marketClientService.list(), []);
  const state = useFocusedResource(load);
  const countries = state.data?.ok ? state.data.podatak : [];
  return { countries, loading: state.loading,
    error: state.error ? 'Države trenutno nisu učitane.' : state.data && !state.data.ok ? state.data.poruka : null,
    refresh: state.refresh };
}
/** The countries a place form chooses from, as `useCountryOptions` reads them (or a caller that already holds them). */
export type CountryOptions = { countries: readonly MarketConfig[]; loading: boolean; error: string | null; refresh: () => unknown };
/** The name a person reads; the code stays the server's. */
export const countryName = (code: string | null) => code ? NAMES[code] ?? code : null;
export const selectableCountry = (countries: readonly MarketConfig[], code: string | null) =>
  countries.some(country => country.countryCode === code && ['BUILDING', 'LIVE'].includes(country.productStatus));

export function CountryField({ label, value, disabled, onChange, options }: {
  label: string; value: string | null; disabled: boolean; onChange: (code: string) => void;
  options: CountryOptions;
}) {
  return <View style={s.section}>
    <LocationChoice label={label} value={value} disabled={disabled || options.loading || !options.countries.length}
      onChange={onChange} options={options.countries.map(country => ({ value: country.countryCode,
        label: NAMES[country.countryCode] ?? country.countryCode, disabled: !selectableCountry(options.countries, country.countryCode) }))} />
    {options.loading ? <View style={[s.row, { minHeight: 24 }]} accessibilityLiveRegion="polite">
      <ActivityIndicator size="small" color={sys.color.green} /><T variant="meta" tone="muted">Učitavamo države…</T>
    </View> : null}
    {value && !options.countries.some(country => country.countryCode === value) ? <T variant="note" style={{ color: sys.color.warn }}>Sačuvana država: {NAMES[value] ?? value}. Izaberi dostupnu državu pre čuvanja.</T> : null}
    {/* A failed read is a failure, not a green notice. */}
    {options.error || (!options.loading && !options.countries.length) ? <View style={[s.notice, { backgroundColor: sys.color.dangerSoft }]}>
      <T accessibilityRole="alert" tone="danger">{options.error ?? 'Izbor država trenutno nije dostupan.'}</T>
      <Button kind="secondary" label="Ponovo učitaj države" onPress={() => { void options.refresh(); }} />
    </View> : null}
  </View>;
}
