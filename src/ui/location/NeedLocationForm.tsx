import { useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import type { NeedTaskGeographyPoint } from '../../contracts/needFactsV2';
import type { ConfirmedLocationPoint, LocationSlot, NeedLocationInput, NeedLocationReview } from '../../contracts/location';
import { locationSlots, normalizeNeedLocation } from '../../lib/location';
import { V2Action as Button } from '../v2/V2Action';
import { brandAction, sys } from '../system/tokens';
import { FlowFooter } from '../system/FlowFooter';
import { layout as grid } from '../system/layout';
import { T } from '../Text';
import { LocationChoice, LocationDetails } from './LocationControls';
import { countryName, selectableCountry, useCountryOptions, type CountryOptions } from './CountryField';
import { LocationPointEditor } from './LocationPointEditor';
import { normalizedPlaceText } from './placeText';
import type { createConfiguredLocationResolver } from '../../data/configuredLocationResolver';

type FormProps = {
  review: NeedLocationReview; busy: boolean; uncertain: boolean; onSave: (value: NeedLocationInput) => void;
  resolver?: ReturnType<typeof createConfiguredLocationResolver>;
  onEditInConversation?: () => void;
  /** Prepares only the points for the same final review; does not publish the task. */
  reviewOnly?: boolean;
  layout?: 'inline' | 'screen';
  /** Availability supplied by an existing read or the inert design gallery. Never an editable country list. */
  countries?: CountryOptions;
};

/** Search text only: keep the precise address first and append genuinely new place context. */
function searchSeed(parts: readonly (string | null | undefined)[]): string {
  const result: string[] = [];
  for (const part of parts) {
    for (const piece of (part ?? '').split(',').map(value => value.trim()).filter(Boolean)) {
      const normalized = normalizedPlaceText(piece);
      // Compare whole, consecutive words across Serbian scripts/diacritics. A street
      // substring or the same words in another order are not the same place context.
      if (normalized && result.some(existing => ` ${normalizedPlaceText(existing)} `.includes(` ${normalized} `))) continue;
      result.push(piece);
    }
  }
  return result.join(', ');
}

/** Every visit/revision owns its local points. Returning A→B→A cannot revive callbacks from the first A. */
export function NeedLocationForm(props: FormProps) {
  const identity = JSON.stringify([props.review.accountId, props.review.conversationId, props.review.revision, props.review.value]);
  const owner = useRef({ identity, token: {} });
  if (owner.current.identity !== identity) owner.current = { identity, token: {} };
  const token = owner.current.token;
  const live = useRef(props); live.current = props;
  const owns = () => owner.current.token === token && !live.current.busy && !live.current.uncertain && live.current.review.editable;
  return props.countries
    ? <PointConfirmation key={identity} {...props} options={props.countries} ownsReview={owns} />
    : <WithCountries key={identity} {...props} ownsReview={owns} />;
}
function WithCountries(props: FormProps & { ownsReview: () => boolean }) {
  // Review contains only a country code, not its current availability. Retain the server catalogue check.
  const options = useCountryOptions();
  return <PointConfirmation {...props} options={options} />;
}

function PointConfirmation({ review, busy, uncertain, onSave, resolver, onEditInConversation, reviewOnly = false,
  layout = 'inline', options, ownsReview }: FormProps & { options: CountryOptions; ownsReview: () => boolean }) {
  const country = review.value.taskCountryCode;
  const base = normalizeNeedLocation({ ...review.value, resolvedLocation: null });
  const restored = normalizeNeedLocation(review.value)?.resolvedLocation;
  const [state, setState] = useState(() => ({ points: restored?.points ?? [] as readonly ConfirmedLocationPoint[],
    activeSlot: null as LocationSlot | null, pendingPoint: false, pinEpoch: 0 }));
  const live = useRef(state); live.current = state;
  const alive = useRef(true), epoch = useRef(0);
  const rendered = ++epoch.current;
  useEffect(() => { alive.current = true; return () => { alive.current = false; epoch.current++; }; }, []);
  const countryAvailable = !!country && country === base?.taskCountryCode && !options.loading && !options.error
    && selectableCountry(options.countries, country);
  const available = useRef(countryAvailable); available.current = countryAvailable;
  const owns = () => alive.current && ownsReview() && rendered === epoch.current;
  const change = (next: typeof state) => {
    if (!owns()) return;
    epoch.current++; live.current = next; setState(next);
  };
  const remote = review.value.geography?.mode === 'REMOTE';
  const slots = base && !remote ? locationSlots(base.geography) : [];
  const selected = state.activeSlot && slots.includes(state.activeSlot) ? state.activeSlot : slots[0];
  const titleFor = (slot: LocationSlot) => slot === 'start' ? (base?.geography.mode === 'STATIONARY' ? 'Mesto rada' : 'Polazište')
    : slot === 'end' ? 'Odredište' : slot === 'serviceArea' ? 'Područje rada' : `Stanica ${Number(slot.split('/')[1]) + 1}`;
  const descriptionFor = (slot: LocationSlot): NeedTaskGeographyPoint | undefined => slot === 'start' ? base?.geography.start
    : slot === 'end' ? base?.geography.end : slot === 'serviceArea' ? base?.geography.serviceArea
      : base?.geography.waypoints?.[Number(slot.split('/')[1])];
  const placeText = (point: NeedTaskGeographyPoint | undefined) => [point?.label, point?.area, point?.city].filter(Boolean).join(', ');
  const confirmed = state.points.filter(point => !state.pendingPoint || point.slot !== selected);
  const complete = slots.length > 0 && slots.every(slot => confirmed.some(point => point.slot === slot));
  const disabled = busy || uncertain || !review.editable;
  const reason = saveBlockReason({ busy, uncertain, editable: review.editable, pendingPoint: state.pendingPoint,
    countryChosen: !!country, countrySelectable: countryAvailable, countryLoading: options.loading,
    geographyReady: !!base && !remote, allPointsConfirmed: complete });
  const editInConversation = () => { if (owns()) onEditInConversation?.(); };
  const submit = () => {
    if (!owns() || !available.current || !base || remote || live.current.pendingPoint || !slots.length
      || slots.some(slot => !live.current.points.some(point => point.slot === slot))) return;
    const checked = normalizeNeedLocation({ ...review.value, resolvedLocation: { version: 1,
      binding: { taskCountryCode: country, geography: review.value.geography, exactAddress: review.value.exactAddress }, points: live.current.points } });
    if (!checked?.resolvedLocation) return;
    // Only confirmed points change. Semantic facts and their binding remain exactly the reviewed values.
    onSave({ ...review.value, taskCountryCode: base.taskCountryCode, geography: review.value.geography!, resolvedLocation: checked.resolvedLocation });
  };
  const selectedPlace = selected ? descriptionFor(selected) : undefined;
  const seed = searchSeed([base?.geography.mode === 'STATIONARY' ? base.exactAddress : null,
    selectedPlace?.label, selectedPlace?.area, selectedPlace?.city]);
  const cityOnly = !!selected && !base?.exactAddress && !descriptionFor(selected)?.area && !descriptionFor(selected)?.label;
  const body = <>
    <T variant="heading" accessibilityRole="header">Proveri mesto iz razgovora</T>
    <T variant="note" tone="muted">Ovde potvrđuješ tačke na mapi. Opis mesta i rutu menjaš kroz razgovor.</T>
    {country ? <T variant="meta" tone="muted">{countryName(country)}</T> : null}
    {slots.map(slot => <View key={slot} style={f.place}>
      <T variant="bodyStrong">{titleFor(slot)}</T><T>{placeText(descriptionFor(slot))}</T>
    </View>)}
    {remote ? <T>Za rad bez dolaska na lokaciju zadatka nije potrebna potvrda tačke na mapi.</T>
      : !base ? <T>Mesto još nije dovoljno razjašnjeno. Dopuni ga u istom razgovoru, pa se vrati na potvrdu.</T> : null}
    {!remote && (review.value.exactAddress || review.value.accessNotes) ? <LocationDetails label="Privatni detalji iz razgovora"
      summary="Pregled adrese i napomena" disabled={disabled}>
      {review.value.exactAddress ? <View style={f.place}><T variant="meta" tone="muted">Tačna adresa</T><T>{review.value.exactAddress}</T></View> : null}
      {review.value.accessNotes ? <View style={f.place}><T variant="meta" tone="muted">Napomene za pristup</T><T>{review.value.accessNotes}</T></View> : null}
      <T variant="note" tone="muted">Ovi podaci nisu deo javnog prikaza zadatka.</T>
    </LocationDetails> : null}
    {!remote && base && countryAvailable && slots.length ? <>
      <T variant="body" accessibilityLiveRegion="polite">Potvrđeno tačaka: {confirmed.length} od {slots.length}</T>
      {slots.length > 1 ? <LocationChoice label="Tačka koju potvrđuješ" value={selected}
        options={slots.map(slot => ({ value: slot, label: `${titleFor(slot)}${state.pendingPoint && slot === selected ? ' · čeka potvrdu'
          : confirmed.some(point => point.slot === slot) ? ' · potvrđeno' : ''}` }))}
        disabled={disabled || state.pendingPoint} onChange={slot => {
          if (owns() && !live.current.pendingPoint && slots.includes(slot as LocationSlot)) change({ ...live.current, activeSlot: slot as LocationSlot });
        }} /> : null}
      {selected ? <LocationPointEditor key={`${state.pinEpoch}:${selected}`} slot={selected} title={titleFor(selected)}
        countryCode={base.taskCountryCode} initialQuery={seed} resolver={resolver} confirmAsPrimary={false}
        presentation="conversation" allowManualDetails={false} autoLocate allowCityContextLookup
        initialQuestion={cityOnly ? 'Proveri tačno mesto unutar navedenog područja.' : undefined}
        onCorrectInConversation={onEditInConversation ? editInConversation : undefined}
        point={state.points.find(point => point.slot === selected)} disabled={disabled}
        scopeKey={`${review.accountId}:${review.conversationId}:${review.revision}:${state.pinEpoch}:${selected}`}
        onInvalidate={() => change({ ...live.current, pendingPoint: true })}
        onConfirm={point => {
          if (!owns() || point.slot !== selected) return;
          const next = normalizeNeedLocation({ ...base, resolvedLocation: { version: 1,
            binding: { taskCountryCode: base.taskCountryCode, geography: base.geography, exactAddress: base.exactAddress },
            points: [...live.current.points.filter(item => item.slot !== selected), point] } });
          if (next?.resolvedLocation) change({ ...live.current, points: next.resolvedLocation.points, pendingPoint: false });
        }} /> : null}
    </> : null}
    {!remote && (options.error || (!options.loading && !options.countries.length)) ? <View style={f.place}>
      <T accessibilityRole="alert" tone="danger">Dostupnost države trenutno nije proverena.</T>
      <Button kind="quiet" label="Ponovo proveri dostupnost" disabled={disabled}
        onPress={() => { if (owns()) void options.refresh(); }} />
    </View> : null}
    {onEditInConversation ? <Button kind="quiet" label="Izmeni kroz razgovor" disabled={disabled} onPress={editInConversation} /> : null}
  </>;
  const actions = <>
    {base && !remote ? <Button style={brandAction} label={reviewOnly ? 'Primeni potvrđene tačke' : 'Sačuvaj mesto'} loading={busy}
      disabled={disabled || !countryAvailable || state.pendingPoint || !complete} onPress={submit} /> : null}
    {state.pendingPoint ? <Button label="Odbaci nepotvrđenu tačku" kind="quiet" disabled={disabled}
      onPress={() => change({ ...live.current, pendingPoint: false, pinEpoch: live.current.pinEpoch + 1 })} /> : null}
  </>;
  const shownReason = remote && !disabled ? null : reason;
  const consequence = !shownReason && !busy && !remote ? <T variant="note" tone="muted">Potvrđene tačke ostaju u istom pregledu. Zadatak još nije objavljen.</T> : null;
  if (layout === 'screen') return <View style={f.screen}>
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={f.scroll}>{body}{consequence}</ScrollView>
    <FlowFooter reason={shownReason ?? undefined}>{actions}</FlowFooter>
  </View>;
  return <View style={f.inline}>{body}{shownReason ? <T variant="note" tone="muted" accessibilityLiveRegion="polite">{shownReason}</T> : consequence}{actions}</View>;
}

export function saveBlockReason(state: { busy: boolean; uncertain: boolean; editable: boolean; pendingPoint: boolean;
  countryChosen: boolean; countrySelectable: boolean; countryLoading?: boolean; geographyReady?: boolean; allPointsConfirmed?: boolean }): string | null {
  if (state.busy) return null;
  if (!state.editable) return 'Ovaj pregled više nije dostupan za izmene.';
  if (state.uncertain) return 'Ne znamo da li je prethodna radnja uspela.';
  if (!state.countryChosen) return 'Dopuni državu kroz razgovor pre potvrde mesta.';
  if (state.countryLoading) return 'Proveravamo dostupnost države…';
  if (!state.countrySelectable) return 'Potvrda mesta za ovu državu trenutno nije dostupna.';
  if (state.geographyReady === false) return 'Dopuni mesto kroz razgovor pre potvrde tačaka.';
  if (state.pendingPoint) return 'Potvrdi tačku na mapi ili odbaci nepotvrđenu izmenu.';
  if (state.allPointsConfirmed === false) return 'Potvrdi sve potrebne tačke na mapi.';
  return null;
}

const f = StyleSheet.create({
  inline: { gap: grid.section }, screen: { flex: 1 }, place: { gap: sys.space.xs },
  scroll: { paddingHorizontal: grid.gutter, paddingTop: sys.space.sm, gap: grid.section, paddingBottom: grid.section },
});
