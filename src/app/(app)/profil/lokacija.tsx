import { useCallback, useEffect, useRef, useState, type ReactElement, type ReactNode } from 'react';
import { AppState, StyleSheet, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import type { CoarsePosition, WorkerLocation, WorkerLocationInput } from '../../../contracts/location';
import { workerLocationClientService } from '../../../data/locationClientService';
import { normalizeWorkerLocation } from '../../../lib/location';
import { useOwnedEditor } from '../../../hooks/useOwnedEditor';
import { useWorkerExecutionModes } from '../../../hooks/useWorkerExecutionModes';
import { useUnsavedProfileBack } from '../../../hooks/useUnsavedProfileBack';
import { LocationField, locationStyles } from '../../../ui/location/LocationControls';
import { layout } from '../../../ui/system/layout';
import { brandAction, sys } from '../../../ui/system/tokens';
import { V2Action } from '../../../ui/v2/V2Action';
import { T } from '../../../ui/Text';
import { Press } from '../../../ui/Press';
import { FactArt } from '../../../ui/system/FactArt';
import { StateView } from '../../../ui/system/StateView';
import { QuietReadState } from '../../../ui/v2/QuietReadState';
import { CountryField, selectableCountry, useCountryOptions } from '../../../ui/location/CountryField';
import { ResolvedPinMap } from '../../../ui/location/ResolvedPinMap';
import { displayedPinPosition } from '../../../ui/location/ResolvedPinMap.types';
import { WorkerAreaSearch } from '../../../ui/location/WorkerAreaSearch';
import { InfoTitle } from '../../../ui/settings/InfoTitle';
import { WorkerProfileFrame } from '../../../ui/workerProfile/WorkerProfilePresentation';
import { WorkerAiTopicEntry } from '../../../ui/workerProfile/WorkerAiTopicEntry';
import type { createConfiguredLocationResolver } from '../../../data/configuredLocationResolver';

/** The form's two parts: fields and the save action that stays above the keyboard. */
export type WorkerLocationParts = { body: ReactNode; footer: ReactNode };
type WorkerLocationFormProps = { location: WorkerLocation; busy: boolean; uncertain: boolean;
  /** Confirm only the saved area's coarse center; the AI-owned city and radius are facts here. */ pointOnly?: boolean;
  onDirtyChange?: (dirty: boolean) => void;
  resolver?: Pick<ReturnType<typeof createConfiguredLocationResolver>, 'search' | 'cancel'>; onSave: (value: WorkerLocationInput) => void;
  /** Where the route places the parts (the screen's sticky footer); by default they are drawn one under the other. */
  children?: (parts: WorkerLocationParts) => ReactElement;
  /** Why the last save did not go through, drawn under the save. */ error?: string | null;
  /** Reads the saved state again; after an unknown outcome or a failed read it replaces the save. */ onRetry?: () => void;
  /** The saved state is being read again (the form stays on screen): the save waits and says why, without a spinner. */
  reading?: boolean;
  /** The last save was confirmed: while nothing has changed since, the footer says so instead of asking for a confirmation. */
  saved?: boolean;
  /** Countries handed in (the design gallery, which reads nothing); otherwise the market list is read here. */
  countryOptions?: CountryOptions };
type CountryOptions = ReturnType<typeof useCountryOptions>;
export function WorkerLocationForm(props: WorkerLocationFormProps) {
  const key = `${props.location.accountId}:${props.location.profileId}:${props.location.revision}`;
  return props.countryOptions ? <ScopedWorkerLocationForm key={key} {...props} countryOptions={props.countryOptions} />
    : <LiveWorkerLocationForm key={key} {...props} />;
}
function LiveWorkerLocationForm(props: WorkerLocationFormProps) {
  const countryOptions = useCountryOptions();
  return <ScopedWorkerLocationForm {...props} countryOptions={countryOptions} />;
}
/**
 * The distances, one tap each: the ONE control of the radius (owner's phone, 8 Oct 2026: the same radius stood twice, as a field with "100" and as chips).
 * They span the whole range the server accepts (1 to 200 km). A radius saved earlier that is not among them (say 30) gets its own chip, selected, so
 * nothing that was saved is lost or hidden; nothing stores them as a vocabulary.
 */
const RADII = [5, 10, 20, 50, 100, 200] as const;
export function radiusChoices(radius: string): number[] {
  const saved = /^\d{1,3}$/.test(radius) ? Number(radius) : NaN;
  const own = Number.isInteger(saved) && saved >= 1 && saved <= 200 && !(RADII as readonly number[]).includes(saved) ? [saved] : [];
  return [...RADII, ...own].sort((a, b) => a - b);
}
const stacked = ({ body, footer }: WorkerLocationParts) => <View style={{ gap: 24 }}>{body}{footer}</View>;
const samePosition = (a: CoarsePosition | null, b: CoarsePosition | null) =>
  a === b || (!!a && !!b && a.latitude === b.latitude && a.longitude === b.longitude);
function ScopedWorkerLocationForm({ location, busy, uncertain, onSave, resolver, children = stacked, error: refusal, onRetry, countryOptions,
  reading = false, saved = false, onDirtyChange, pointOnly = false }: WorkerLocationFormProps & { countryOptions: CountryOptions }) {
  const [city, setCity] = useState(location.city);
  const [country, setCountry] = useState<string | null>(location.operatingCountryCode);
  const [radius, setRadius] = useState(String(location.radiusKm));
  const [error, setError] = useState(false);
  const [position, setPosition] = useState(location.approximatePosition);
  const [mapEpoch, setMapEpoch] = useState(0);
  const [searchEpoch, setSearchEpoch] = useState(0);
  const disabled = busy || uncertain || reading;
  const changePlace = (change: () => void) => {
    if (disabled) return;
    change(); setPosition(null); setMapEpoch(value => value + 1); setError(false);
  };
  // Choosing a distance prepares it; pressing save confirms the whole area.
  const changeRadius = (text: string) => { setRadius(text); setError(false); };
  // Right after a confirmed save the form is what was saved; until something changes the footer says so, instead of an
  // empty confirmation and a grey save that read as "confirm it again" (review of step 9, 2026-09-24).
  const dirty = city !== location.city || country !== location.operatingCountryCode || radius !== String(location.radiusKm)
    || !samePosition(position, location.approximatePosition);
  useEffect(() => { onDirtyChange?.(dirty); }, [dirty, onDirtyChange]);
  const settled = saved && !dirty;
  const submit = () => {
    if (disabled || reading || settled || (pointOnly && !position) || !selectableCountry(countryOptions.countries, country)) return;
    const value = normalizeWorkerLocation({ operatingCountryCode: country, city: city.trim(), radiusKm: /^\d+$/.test(radius) ? Number(radius) : NaN,
      approximatePosition: position });
    if (!value) { setError(true); return; }
    onSave(value);
  };
  const selectable = selectableCountry(countryOptions.countries, country);
  // A grey save says why (owner rule, 2026-09-23): a country that cannot be chosen, then a
  // read of the saved area that is still running (a save during it would be refused without a word). Once saved, the
  // line above the button already says why.
  const reason = settled ? null : !selectable ? 'Izaberi dostupnu državu.'
    : reading ? 'Učitavamo sačuvano područje…' : pointOnly && !position ? 'Označi približnu tačku na mapi.' : null;
  const body = <View style={{ gap: 24 }}>
    {/* Privacy wording, word for word. "Izaberi područje u kom radiš." and a second title under the bar are gone. */}
    <View style={s.note}><FactArt kind="lock" size={20} />
      <T variant="copy" tone="muted" style={s.grow}>Kućna adresa i GPS dozvola nisu potrebni.</T></View>
    {pointOnly ? <View style={s.radius}>
      <T variant="bodyStrong">{`${city} · ${radius} km`}</T>
      <T variant="note" tone="muted">{country} · Područje iz sačuvanog profila</T>
    </View> : <>
    <CountryField label="Država rada" value={country} disabled={disabled} options={countryOptions}
      onChange={code => changePlace(() => setCountry(code))} />
    <LocationField label="Grad ili mesto rada" value={city} maxLength={160} editable={!disabled}
      onChangeText={text => changePlace(() => setCity(text))} />
    <View style={s.radius}>
      <T variant="meta" tone="muted">Radijus rada</T>
      <View accessibilityRole="radiogroup" accessibilityLabel="Radijus rada" style={s.pills}>
        {radiusChoices(String(location.radiusKm)).map(km => { const checked = Number(radius) === km;
          return <Press key={km} accessibilityRole="radio" accessibilityLabel={`${km} km`} accessibilityState={{ checked, disabled }}
            disabled={disabled} haptic={disabled ? 'none' : 'select'} scaleTo={0.97} onPress={() => { if (!disabled) changeRadius(String(km)); }}
            style={[s.pill, checked && s.pillOn]}>
            <T variant="note" style={checked ? s.pillTextOn : s.pillText}>{`${km} km`}</T>
          </Press>; })}
      </View>
    </View>
    </>}
    {country && city.trim() ? <View style={locationStyles.section}>
      {/* The instruction stays; how precisely the point is kept is behind the "ⓘ" at the title (owner's phone, 8 Oct 2026: too much explaining text). */}
      <InfoTitle title="Približno područje na mapi" testID="area-map-info" info={['Čuva se približna tačka, zaokružena na oko kilometar.']} />
      <T variant="note" tone="muted">Označi centar područja.</T>
      <WorkerAreaSearch city={city} countryCode={country} disabled={disabled} resolver={resolver}
        scopeKey={`${location.accountId}:${location.profileId}:${location.revision}:${mapEpoch}:${searchEpoch}`}
        onChoose={next => { if (!disabled) { setPosition(next); setError(false); } }} />
      <ResolvedPinMap key={mapEpoch} coarse position={position} disabled={disabled}
        scopeKey={`${location.accountId}:${location.profileId}:${location.revision}:${mapEpoch}`}
        onChoose={next => { if (!disabled) {
          const coarse = displayedPinPosition(next, true);
          if (!coarse) return;
          setPosition(coarse); setError(false); setSearchEpoch(value => value + 1);
        } }} />
      {position && !pointOnly ? <V2Action label="Ukloni približnu tačku" kind="quiet" disabled={disabled} style={quietStart}
        onPress={() => { if (!disabled) { setPosition(null); setMapEpoch(value => value + 1); } }} /> : null}
    </View> : null}
    {error ? <T accessibilityRole="alert" tone="danger">Unesi mesto rada.</T> : null}
  </View>;
  // After an unknown outcome, or a read that failed while the form stayed, the read replaces the save: the editor refuses
  // any save until the saved state is read again.
  const retry = (uncertain || !!refusal) && onRetry;
  const footer = <>
    {settled && !retry ? <View style={s.saved}><FactArt kind="check" size={20} />
      <T accessibilityRole="alert" tone="success" style={s.grow}>{pointOnly ? 'Približna tačka je sačuvana.' : 'Područje rada je sačuvano.'}</T></View>
      : null}
    {retry ? <V2Action label="Pokušaj ponovo" onPress={retry} disabled={busy || reading} loading={reading} style={brandAction}
      error={refusal ?? undefined} />
      : <V2Action label={pointOnly ? 'Potvrdi tačku' : 'Sačuvaj područje rada'} onPress={submit} loading={busy} style={brandAction}
        disabled={disabled || reading || settled || !selectable || (pointOnly && !position)} reason={busy ? null : reason} error={refusal ?? undefined} />}
  </>;
  return children({ body, footer });
}

/** A quiet action beside content keeps to its own width, as the location screens have always drawn it. */
const quietStart = { alignSelf: 'flex-start' } as const;

export default function PodrucjeRada() {
  const params = useLocalSearchParams<{ mode?: string; profileId?: string }>();
  return params.mode === 'point' ? <WorkerPointConfirmation expectedProfileId={typeof params.profileId === 'string' ? params.profileId : null} />
    : <WorkerAiTopicEntry part="area" />;
}

/** The existing owned location writer is independent from the signed AI review. A point change invalidates an older
 * conversation's source hash; neither this screen nor its save may rebase or mutate a frozen AI proposal. */
function WorkerPointConfirmation({ expectedProfileId }: { expectedProfileId: string | null }) {
  const read = useCallback(() => workerLocationClientService.read(), []);
  const editor = useOwnedEditor(read);
  const location = editor.data;
  const modes = useWorkerExecutionModes(location?.profileId ?? null);
  const [dirty, setDirty] = useState(false);
  const leave = useUnsavedProfileBack({ dirty: !!location && dirty, busy: editor.busy, uncertain: editor.uncertain,
    revision: location?.revision ?? null, onBack: () => router.canGoBack() ? router.back() : router.replace('/profil/radnik') });
  const eligible = !!location && !!expectedProfileId && location.profileId === expectedProfileId
    && modes.view.kind === 'confirmed' && modes.view.modes.includes('ON_SITE');
  const mapScope = location ? `${location.accountId}:${location.profileId}:${location.revision}` : null;
  const admittedScope = useRef<string | null>(null);
  if (eligible) admittedScope.current = mapScope;
  else if (modes.view.kind === 'confirmed' || modes.view.kind === 'unconfirmed') admittedScope.current = null;
  // A retained native callback must not revive a map after a mode/account/profile refresh.
  const current = useRef({ eligible, revision: location?.revision });
  current.current = { eligible, revision: location?.revision };
  useEffect(() => () => { current.current.eligible = false; }, []);
  const refresh = () => { void editor.refresh(); modes.refresh(); };
  const frame = (body: ReactNode) => <WorkerProfileFrame title="Tačka na mapi" backLabel="Nazad" back={leave.back}>{body}{leave.sheet}</WorkerProfileFrame>;
  if (!location) return frame(editor.error && !editor.loading
    ? <StateView kind="error" title="Područje rada nije učitano" body={editor.error} primary={{ label: 'Pokušaj ponovo', onPress: refresh }} />
    : <QuietReadState art="map" title="Učitavamo područje rada…"
      body="Proveravamo sačuvani grad i približnu tačku pre potvrde na mapi." />);
  if (!expectedProfileId || location.profileId !== expectedProfileId) return frame(<StateView kind="error" title="Otvorite mapu iz svog profila"
    primary={{ label: 'Nazad na profil', onPress: leave.back }} />);
  const modeNotice = modes.view.kind === 'loading'
    ? admittedScope.current === mapScope
      ? <View accessibilityLiveRegion="polite"><T variant="note" tone="muted">Proveravamo način rada…</T></View>
      : <QuietReadState art="map" title="Proveravamo način rada…"
        body="Mapa će biti dostupna kada potvrdite rad na lokaciji u svom profilu." />
    : modes.view.kind === 'unavailable' ? <StateView kind="error" title="Način rada nije učitan" primary={{ label: 'Pokušajte ponovo', onPress: refresh }} />
      : !eligible ? <StateView kind="empty" title={modes.view.kind === 'confirmed' ? 'Za rad na daljinu mapa nije potrebna' : 'Prvo potvrdite način rada u razgovoru'}
        primary={{ label: 'Nazad na profil', onPress: leave.back }} /> : null;
  if (modeNotice && admittedScope.current !== mapScope) return frame(modeNotice);
  if (!location.city.trim() || !location.operatingCountryCode) return frame(<StateView kind="empty" title="Dopunite područje kroz razgovor"
    body="Na profilu izaberite „Gde“ i navedite grad u kom radite. Zatim potvrdite njegov približan centar."
    primary={{ label: 'Nazad na profil', onPress: leave.back }} />);
  return <WorkerLocationForm pointOnly location={location} busy={editor.busy || !eligible} uncertain={editor.uncertain}
    onDirtyChange={setDirty} reading={editor.loading} saved={editor.saved} error={editor.error} onRetry={refresh}
    onSave={value => {
      if (!current.current.eligible || current.current.revision !== location.revision || !value.approximatePosition
        || AppState.currentState === 'background' || AppState.currentState === 'inactive') return;
      // Only the displayed coarse point can change. City/country/radius always come from this owned read.
      void editor.save(async () => {
        const result = await workerLocationClientService.save({ expectedRevision: location.revision, confirmed: true,
          value: { operatingCountryCode: location.operatingCountryCode!, city: location.city, radiusKm: location.radiusKm,
            approximatePosition: value.approximatePosition } });
        return result.ok ? { ok: true, podatak: result.podatak.location } : result;
      });
    }}>
    {({ body, footer }) => <WorkerProfileFrame title="Tačka na mapi" backLabel="Nazad" back={leave.back} footer={eligible ? footer : undefined}>
      {modeNotice}
      {/* Keep an unsaved point through a temporary mode refresh, with every map action disabled and hidden. */}
      <View style={!eligible ? { display: 'none' } : undefined} accessibilityElementsHidden={!eligible}
        importantForAccessibility={eligible ? 'auto' : 'no-hide-descendants'}>{body}</View>{leave.sheet}
    </WorkerProfileFrame>}
  </WorkerLocationForm>;
}

const s = StyleSheet.create({
  grow: { flex: 1, minWidth: 0 },
  note: { flexDirection: 'row', alignItems: 'center', gap: sys.space.sm },
  saved: { flexDirection: 'row', alignItems: 'center', gap: sys.space.sm },
  radius: { gap: sys.space.md },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: sys.space.sm },
  pill: { minHeight: layout.touch, paddingHorizontal: sys.space.base, borderRadius: sys.radius.pill, borderWidth: 1, borderColor: sys.color.lineStrong,
    backgroundColor: sys.color.surface, alignItems: 'center', justifyContent: 'center' },
  // The chosen distance is the green selection: the same edge in green on the soft green, so choosing never moves the row.
  pillOn: { backgroundColor: sys.color.greenSoft, borderColor: sys.color.green },
  pillText: { color: sys.color.ink, fontWeight: '600' },
  pillTextOn: { color: sys.color.green, fontWeight: '700' },
});
