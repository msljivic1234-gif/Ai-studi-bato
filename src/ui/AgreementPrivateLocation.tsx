import { useCallback, useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from 'expo-router';
import { AppState, StyleSheet, View } from 'react-native';
import type { DogovorProjekcija } from '../contracts/projections';
import type { ExactLocationReveal, LocationGrant, LocationGrantState } from '../contracts/contact';
import type { Ishod } from '../data/ports';
import { useOwnedEditor } from '../hooks/useOwnedEditor';
import { sesijaSada, useSesija } from '../store/sesija';
import { useIzvor } from '../store/uloga';
import { sys } from './system/tokens';
import { FactArt } from './system/FactArt';
import { ListRow } from './system/ListRow';
import { addressWords } from './agreements/agreementContactModel';
import { vreme } from '../lib/vreme';
import { V2Action } from './v2/V2Action';
import { T } from './Text';
import { LocationMapPreview } from './location/LocationMapPreview';
import { locationSlots } from '../lib/location';

type Props = { agreement: DogovorProjekcija; enabled: boolean;
  /** "Zatraži adresu" for the side that does not own it: the route writes the question into the conversation and takes the person there. */
  onRequestAddress?: () => void };
type Snapshot = { state: LocationGrantState; revealed: ExactLocationReveal | null };
const activeGrant = (grant: LocationGrant | undefined) => !!grant && grant.status === 'GRANTED'
  && (grant.expiresAt === null || Date.parse(grant.expiresAt) > Date.now());
const invalid = (): Ishod<never> => ({ ok: false, kod: 'LOCATION_SCOPE_CHANGED', poruka: 'Dozvola za lokaciju je promenjena. Osvežite prikaz.' });
const locationCacheKey = (accountId: string, agreementId: string) => `uskoci:agreement-location:v1:${accountId}:${agreementId}`;

async function readCachedLocation(accountId: string, agreementId: string, requesterId: string, workerId: string): Promise<Snapshot | null> {
  try {
    const raw = await AsyncStorage.getItem(locationCacheKey(accountId, agreementId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Snapshot;
    const grant = parsed?.state?.grants?.[0];
    const revealed = parsed?.revealed;
    if (!parsed?.state || parsed.state.agreementId !== agreementId || parsed.state.accountId !== accountId
      || !grant || !activeGrant(grant) || grant.ownerAccountId !== requesterId || grant.recipientAccountId !== workerId
      || !revealed || revealed.agreementId !== agreementId || revealed.grantId !== grant.id
      || (revealed.expiresAt !== null && Date.parse(revealed.expiresAt) <= Date.now())) {
      await AsyncStorage.removeItem(locationCacheKey(accountId, agreementId)).catch(() => undefined);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

async function writeCachedLocation(accountId: string, agreementId: string, snapshot: Snapshot): Promise<void> {
  try {
    await AsyncStorage.setItem(locationCacheKey(accountId, agreementId), JSON.stringify(snapshot));
  } catch {
    // Ignore storage quota errors; live view still works.
  }
}

export async function clearCachedAgreementLocation(accountId: string | undefined, agreementId: string): Promise<void> {
  if (!accountId) return;
  try {
    await AsyncStorage.removeItem(locationCacheKey(accountId, agreementId));
  } catch {
    // Ignore storage removal errors.
  }
}

/** Unmount the private session on background, account, revision, participant or terminal state changes. */
export function AgreementPrivateLocation({ agreement, enabled, onRequestAddress }: Props) {
  const session = useSesija();
  const [foreground, setForeground] = useState(AppState.currentState !== 'background' && AppState.currentState !== 'inactive');
  const foregroundNow = useRef(foreground);
  const appActive = useCallback(() => foregroundNow.current, []);
  useEffect(() => {
    const subscription = AppState.addEventListener('change', state => {
      foregroundNow.current = state === 'active'; setForeground(foregroundNow.current);
    });
    return () => subscription.remove();
  }, []);
  const me = agreement.ucesnici.find(party => party.viSte && party.id === session.user?.id);
  const requester = agreement.ucesnici.find(party => party.uloga === 'narucilac');
  const worker = agreement.ucesnici.find(party => party.uloga === 'uskocer');
  const activeState = agreement.stanje === 'CONFIRMED' || agreement.stanje === 'AWAITING_REQUESTER';
  useEffect(() => {
    if (!activeState && session.user?.id) {
      void clearCachedAgreementLocation(session.user.id, agreement.id);
    }
  }, [activeState, session.user?.id, agreement.id]);
  const visible = foreground && me && requester && worker && requester.id !== worker.id
    && agreement.rezim !== 'DALJINSKI' && agreement.kontakt.lokacijaPostoji
    && activeState;
  if (!visible) return null;
  return <LocationSession key={`${session.user!.id}:${session.accountRevision}:${agreement.id}:${agreement.verzija}:${agreement.stanje}:${requester.id}:${worker.id}`}
    agreementId={agreement.id} accountId={session.user!.id} accountRevision={session.accountRevision}
    requesterId={requester.id} workerId={worker.id} enabled={enabled} appActive={appActive} onRequestAddress={onRequestAddress} />;
}

function LocationSession({ agreementId, accountId, accountRevision, requesterId, workerId, enabled, appActive, onRequestAddress }: {
  agreementId: string; accountId: string; accountRevision: number; requesterId: string; workerId: string; enabled: boolean; appActive: () => boolean;
  onRequestAddress?: () => void;
}) {
  const source = useIzvor();
  const mounted = useRef(true);
  const focus = useRef<object | null>(null), intent = useRef<object>({});
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useFocusEffect(useCallback(() => {
    focus.current = {}; intent.current = {};
    return () => { focus.current = null; intent.current = {}; };
  }, []));
  const read = useCallback(async (): Promise<Ishod<Snapshot>> => {
    // Retire map actions as soon as a refresh/readback starts, before its loading render.
    intent.current = {};
    if (!appActive()) return invalid();
    // A cached EXACT address is never authority. Read the CURRENT signed grant
    // first; failed/denied reads cannot be converted to success by local storage.
    const result = await source.lokacijskaDozvola(agreementId);
    if (!result.ok) {
      await clearCachedAgreementLocation(accountId, agreementId);
      return result;
    }
    const state = result.podatak;
    if (!appActive() || state.agreementId !== agreementId || state.accountId !== accountId || state.grants.length > 1
      || state.grants.some(grant => grant.ownerAccountId !== requesterId || grant.recipientAccountId !== workerId)) {
      await clearCachedAgreementLocation(accountId, agreementId);
      return invalid();
    }
    const latestGrant = state.grants[0];
    if (!activeGrant(latestGrant)) {
      await clearCachedAgreementLocation(accountId, agreementId);
      return { ok: true, podatak: { state, revealed: null } };
    }
    const cached = await readCachedLocation(accountId, agreementId, requesterId, workerId);
    if (!appActive()) return invalid();
    const retainedReveal = cached?.revealed && cached.revealed.grantId === latestGrant.id
      && Date.parse(cached.revealed.grantedAt) === Date.parse(latestGrant.grantedAt)
      ? cached.revealed
      : null;
    return { ok: true, podatak: { state, revealed: retainedReveal } };
  }, [source, agreementId, accountId, requesterId, workerId, appActive]);
  const editor = useOwnedEditor(read);
  const grant = editor.data?.state.grants[0];
  const granted = activeGrant(grant);
  const privateData = !editor.loading && !editor.busy && !editor.uncertain && !editor.error && granted ? editor.data?.revealed : null;
  const latestPrivate = useRef({ grant, privateData }); latestPrivate.current = { grant, privateData };
  const renderedFocus = focus.current, renderedIntent = intent.current;
  // Timers remove the visible data, but a queued tap must check the lease clock itself.
  // The exact reveal and read intent also prevent an old callback reviving after regrant.
  const canUsePrivateMap = () => mounted.current && appActive() && renderedFocus !== null && focus.current === renderedFocus
    && intent.current === renderedIntent && sesijaSada().user?.id === accountId && sesijaSada().accountRevision === accountRevision
    && !!privateData && latestPrivate.current.privateData === privateData && latestPrivate.current.grant === grant
    && !!grant && activeGrant(grant) && grant.recipientAccountId === accountId && grant.ownerAccountId === requesterId
    && privateData.grantId === grant.id && Date.parse(privateData.grantedAt) === Date.parse(grant.grantedAt);
  const expiry = grant?.expiresAt;
  useEffect(() => {
    if (!expiry || !granted) return;
    const expire = () => { if (Date.parse(expiry) <= Date.now()) void editor.refresh(); };
    // Long leases are rechecked at the largest safe native timer interval.
    const timer = setTimeout(() => { expire(); if (Date.parse(expiry) > Date.now()) void editor.refresh(); },
      Math.min(2_147_483_647, Math.max(0, Date.parse(expiry) - Date.now())));
    return () => clearTimeout(timer);
  }, [expiry, granted, editor.refresh]);

  const setGrant = (allow: boolean) => editor.save(async () => {
    intent.current = {};
    if (!appActive()) return invalid();
    if (!allow) await clearCachedAgreementLocation(accountId, agreementId);
    const result = await (allow ? source.podeliTacnuLokaciju(agreementId) : source.opoziviTacnuLokaciju(agreementId));
    if (!result.ok) return result;
    if (!mounted.current || !appActive()) return invalid();
    // A write receipt is followed by existing server state before another write is enabled.
    return read();
  });
  const show = () => editor.save(async () => {
    intent.current = {};
    if (!appActive()) return invalid();
    const result = await source.otkrijTacnuLokaciju(agreementId);
    if (!result.ok) return result;
    if (!mounted.current || !appActive()) return invalid();
    const current = await read();
    if (!current.ok) return current;
    const value = result.podatak, latest = current.podatak.state.grants[0];
    if (!activeGrant(latest) || !latest || value.authoritative !== true || value.agreementId !== agreementId
      || value.ownerAccountId !== requesterId || latest.recipientAccountId !== accountId
      || value.grantId !== latest.id || Date.parse(value.grantedAt) !== Date.parse(latest.grantedAt)
      || (value.expiresAt === null ? latest.expiresAt !== null
        : latest.expiresAt === null || Date.parse(value.expiresAt) !== Date.parse(latest.expiresAt))) return invalid();
    const nextSnapshot: Snapshot = { ...current.podatak, revealed: value };
    await writeCachedLocation(accountId, agreementId, nextSnapshot);
    return { ok: true, podatak: nextSnapshot };
  });
  const locked = !enabled || editor.loading || editor.busy || editor.uncertain || !editor.data;
  // How long the access lasts, when the read says so: a grant with an end names it; one without lasts until it is
  // revoked or the Dogovor ends (this section closes then).
  const requester = accountId === requesterId;
  const lasts = !granted ? null : grant?.expiresAt ? `Važi do ${vreme(grant.expiresAt)}.`
    // Only the requester can revoke, so each side is told who can end it.
    : requester ? 'Važi dok je ne opozovete ili dok se Dogovor ne završi.' : 'Važi dok je druga strana ne opozove ili dok se Dogovor ne završi.';
  // The section above carries the title ("Kontakt i mesto"); this part starts with the state of the access, in the words of the one list
  // (idea R03): the side that owns the address is told to share it when they are ready, the side that does not is told it is not shared
  // and given the one way to ask for it. The grant, its lease and its readback below are exactly what they were.
  const words = addressWords({ requester, granted });
  const accessWords = !requester && granted ? 'Prikaz lokacije je dozvoljen u ovom Dogovoru.' : words.title;
  return <View style={s.stack}>
    <View>
      <ListRow leading={<FactArt kind={granted ? 'eye' : 'lock'} size={32} muted={!granted} />} title={accessWords} subtitle={lasts ?? undefined} last />
    </View>
    {editor.loading ? <T variant="meta" tone="muted">Proveravamo dozvolu…</T> : null}
    {editor.error ? <T variant="meta" tone="danger" accessibilityRole="alert">{editor.error}</T> : null}
    {requester ? <V2Action label={granted ? 'Opozovi deljenje lokacije' : 'Podeli lokaciju'}
      kind={granted ? 'destructive' : 'secondary'} disabled={locked} loading={editor.busy} onPress={() => { void setGrant(!granted); }} />
      : granted && !privateData ? <V2Action label="Prikaži privatnu lokaciju" kind="secondary" disabled={locked} loading={editor.busy} onPress={() => { void show(); }} />
        : !granted && words.ask && onRequestAddress ? <V2Action label="Zatražite adresu" kind="secondary" disabled={locked} onPress={onRequestAddress} /> : null}
    {privateData ? <PrivatePoints key={`${privateData.grantId}:${privateData.grantedAt}:${privateData.needRevision}`} value={privateData}
      scope={`${accountId}:${agreementId}:${privateData.grantId}:${privateData.grantedAt}:${privateData.needRevision}`} canUse={canUsePrivateMap} /> : null}
    {/* The permission is read when the section opens and when this is pressed: the button says it, so no sentence does (J3). */}
    <V2Action label="Osvežite dozvolu za lokaciju" kind="quiet" disabled={editor.busy} style={quietStart} onPress={() => { void editor.refresh(); }} />
  </View>;
}

/** A quiet action keeps to its own width beside the private details, as it always has. */
const quietStart = { alignSelf: 'flex-start', marginLeft: -sys.space.base } as const;
const slotLabel = (slot: string) => slot === 'start' ? 'Početno mesto' : slot === 'end' ? 'Završno mesto'
  : slot === 'serviceArea' ? 'Područje rada' : `Usputno mesto ${Number(slot.split('/')[1]) + 1}`;
function PrivatePoints({ value, scope, canUse }: { value: ExactLocationReveal; scope: string; canUse: () => boolean }) {
  const resolved = value.resolvedLocation?.value;
  const slots = resolved ? locationSlots(resolved.binding.geography) : [];
  const points = slots.flatMap(slot => resolved?.points.find(point => point.slot === slot) ?? []);
  const mapPoints = points.map(point => ({ id: point.slot, label: slotLabel(point.slot),
    latitude: point.latitudeE6 / 1e6, longitude: point.longitudeE6 / 1e6 }));
  if (!mapPoints.length && value.exactPosition) mapPoints.push({ id: 'start', label: 'Mesto zadatka', ...value.exactPosition });
  const route = !!resolved && ['POINT_TO_POINT', 'MULTI_STOP'].includes(resolved.binding.geography.mode) && points.length === slots.length;
  return <View style={s.stack}>
    {mapPoints.length ? <LocationMapPreview points={mapPoints} scopeKey={scope} route={route} height={220} canUse={canUse} /> : null}
    {value.adresa ? <T>{value.adresa}</T> : null}
    {value.accessNotes ? <T variant="meta">{value.accessNotes}</T> : null}
    {/* Each point is a bare row parted by space; the section around it is the only box, and nothing here draws a line. */}
    {points.map(item => <View key={item.slot} style={s.point}>
      <T variant="bodyStrong">{slotLabel(item.slot)}</T>
      {item.address ? <T>{item.address}</T> : null}
      {item.accessNotes ? <T variant="meta">{item.accessNotes}</T> : null}
    </View>)}
    {points.length < slots.length ? <T variant="meta" tone="muted">Nisu potvrđene sve tačke putanje.</T> : null}
  </View>;
}

const s = StyleSheet.create({
  stack: { paddingTop: sys.space.sm, gap: sys.space.md },
  point: { gap: sys.space.xs, paddingTop: sys.space.md },
});
