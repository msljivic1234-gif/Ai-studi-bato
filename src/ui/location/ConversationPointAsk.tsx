import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { BackHandler, View } from 'react-native';
import type { ConfirmedLocationPoint, LocationSlot, NeedLocationReview } from '../../contracts/location';
import { needLocationClientService } from '../../data/locationClientService';
import { createProductionLocationResolver } from '../../data/productionLocationResolver';
import { locationSlots, normalizeNeedLocation } from '../../lib/location';
import { sesijaSada, useSesija } from '../../store/sesija';
import { T } from '../Text';
import { Press } from '../Press';
import { V2Action as Button } from '../v2/V2Action';
import { LocationPointEditor, type PointPrompt } from './LocationPointEditor';
import type { LocationDialogueRequest, LocationDialogueResult } from '../../contracts/locationDialogue';
import { useConfirmSheet } from '../system/ConfirmSheet';
import { sys } from '../system/tokens';
import { ConfirmedPlaceLine } from './ConfirmedPlaceLine';
import { confirmedPlaceEntries, slotNeedsCloserPlace, slotSeed as seed, slotTitle as title } from './placeText';

/**
 * The conversation asks for the map point instead of waiting for the person to discover a form.
 *
 * `need.resolved_location` is `manualOnly`, so only a person may create it and the AI may not
 * even propose it. Publishing, meanwhile, refuses without it. Before this existed the only bridge
 * was a long form reached through the review card, and across three real drafts it was never once
 * completed. Nothing about who may confirm a point changes here: every point is still confirmed by
 * hand. Only the route changes, from a buried form to one step where the answer already is.
 *
 * What the conversation already knows seeds the search, so the pin arrives standing on the address
 * the person said out loud rather than on an empty map.
 */

// The slot names, the search seed and the confirmed-place words live in `placeText` (map-free), shared with the
// conversation's own confirmed-place line.

type State =
  | { kind: 'LOADING' }
  | { kind: 'FAILED'; message: string; review?: NeedLocationReview }
  | { kind: 'READY'; review: NeedLocationReview }
  | { kind: 'SAVING'; review: NeedLocationReview }
  | { kind: 'SAVED'; review: NeedLocationReview };

export type LocationReplyLease = {
  context: LocationDialogueRequest['locationContext'];
  isCurrent: () => boolean;
  apply: (decision: NonNullable<LocationDialogueResult['location']>) => Promise<boolean>;
  cancel: () => void;
};
export type LocationReplyPrompt = { context: LocationDialogueRequest['locationContext']; acquire: () => LocationReplyLease | null };

type Props = { conversationId: string; onSaved: () => void; onClose: () => void;
  /** Opened from the conversation's confirmed-place line: a saved place opens straight in its editor. */
  startEditing?: boolean;
  disabled?: boolean; onEditingChange?: (editing: boolean) => void;
  onPromptReady?: (prompt: LocationReplyPrompt | null) => void;
  onCloseRequestReady?: (handler: (() => void) | null) => void };

const savedPoints = (value: NeedLocationReview['value']) => normalizeNeedLocation(value)?.resolvedLocation?.points ?? [];
const pointKey = (point: ConfirmedLocationPoint) => JSON.stringify([point.latitudeE6, point.longitudeE6,
  point.address ?? null, point.accessNotes ?? null, point.origin.kind,
  point.origin.kind === 'PROVIDER_CANDIDATE' ? [point.origin.providerHint, point.origin.candidateHint] : null]);

export function ConversationPointAsk(props: Props) {
  const { user, accountRevision } = useSesija();
  return <OwnedPointAsk key={`${user?.id}:${accountRevision}:${props.conversationId}`} {...props}
    accountId={user?.id} accountRevision={accountRevision} />;
}

function OwnedPointAsk(props: Props & { accountId: string | undefined; accountRevision: number }) {
  // Without this the point editor falls back to an unconfigured resolver, which answers
  // PROVIDER_ACTIVATION_BLOCKED without making a request at all: the search never leaves the
  // device, no candidate arrives, no pin is placed, and the map sits at [0,0] zoom 1 showing
  // half the world. The long form has always passed this; the conversation must too.
  const resolver = useMemo(() => createProductionLocationResolver(), [props.conversationId]);
  useEffect(() => () => resolver.cancel(), [resolver]);
  const [state, setState] = useState<State>({ kind: 'LOADING' });
  const [points, setPoints] = useState<readonly ConfirmedLocationPoint[]>([]);
  const baseline = useRef<readonly ConfirmedLocationPoint[]>([]);
  const [editing, setEditing] = useState(false);
  // The points this visit's last save changed: a pin the person placed by hand there is acknowledged as the new place.
  const [changedSlots, setChangedSlots] = useState<ReadonlySet<LocationSlot>>(new Set());
  const startEditing = useRef(props.startEditing); startEditing.current = props.startEditing;
  const [selected, setSelected] = useState<LocationSlot | null>(null);
  const [pendingSlot, setPendingSlot] = useState<LocationSlot | null>(null);
  const [editorEpoch, setEditorEpoch] = useState(0);
  const [focusVisit, setFocusVisit] = useState<object | null>(null);
  const focused = focusVisit !== null;
  const focus = useRef(false), focusEpoch = useRef(0), saving = useRef(false), loadEpoch = useRef(0);
  const disabled = useRef(props.disabled); disabled.current = props.disabled;
  const latestState = useRef(state); latestState.current = state;
  const editingChanged = useRef(props.onEditingChange); editingChanged.current = props.onEditingChange;
  const reportedEditing = useRef<boolean | null>(null);
  const reportEditing = useCallback((value: boolean) => {
    if (reportedEditing.current === value) return;
    reportedEditing.current = value; editingChanged.current?.(value);
  }, []);
  const closeRequestChanged = useRef(props.onCloseRequestReady); closeRequestChanged.current = props.onCloseRequestReady;
  const editorPrompt = useRef<PointPrompt | null>(null);
  const [promptToken, setPromptToken] = useState<string | null>(null);
  const registerEditorPrompt = useCallback((prompt: PointPrompt | null) => {
    editorPrompt.current = prompt;
    setPromptToken(previous => previous === (prompt?.context.promptToken ?? null) ? previous : prompt?.context.promptToken ?? null);
  }, []);
  const promptChanged = useRef(props.onPromptReady); promptChanged.current = props.onPromptReady;
  const activeReply = useRef<LocationReplyLease | null>(null);
  const committedPoint = useRef<Promise<boolean> | null>(null);
  const view = useRef<object | null>(null);
  const renderedView = useMemo(() => ({}), [state, points, selected, pendingSlot, editorEpoch, focusVisit, editing, props.disabled]); view.current = renderedView;
  const renderedFocus = focusEpoch.current;
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const confirmation = useConfirmSheet(), closeConfirmation = confirmation.close;
  const ownsAccount = useCallback(() => alive.current && !!props.accountId
    && sesijaSada().user?.id === props.accountId && sesijaSada().accountRevision === props.accountRevision,
  [props.accountId, props.accountRevision]);
  useFocusEffect(useCallback(() => {
    focus.current = true; focusEpoch.current++; setFocusVisit({});
    return () => { focus.current = false; activeReply.current?.cancel(); activeReply.current = null; focusEpoch.current++; view.current = null; setFocusVisit(null); resolver.cancel(); closeConfirmation(); };
  }, [resolver, closeConfirmation]));
  const canAct = () => ownsAccount() && focus.current && renderedFocus === focusEpoch.current
    && view.current === renderedView && !saving.current && !disabled.current && !props.disabled;

  const load = useCallback(async () => {
    if (!ownsAccount() || saving.current || disabled.current) return;
    const epoch = ++loadEpoch.current;
    view.current = null;
    setState({ kind: 'LOADING' });
    const result = await needLocationClientService.read(props.conversationId).catch(() => ({ ok: false as const,
      kod: 'NEED_LOCATION_READ_FAILED', poruka: 'Mesto nije učitano. Pokušaj ponovo.' }));
    if (!ownsAccount() || disabled.current || epoch !== loadEpoch.current) return;
    if (!result.ok) { setState({ kind: 'FAILED', message: result.poruka }); return; }
    const loaded = savedPoints(result.podatak.value);
    baseline.current = loaded; setPoints(loaded);
    const required = result.podatak.value.geography ? locationSlots(result.podatak.value.geography) : [];
    const incomplete = required.some(slot => !loaded.some(point => point.slot === slot));
    // Opened from the confirmed-place line: the saved place goes straight to its editor (the old summary's "Izmeni").
    const reopen = !!startEditing.current && required.length > 0 && result.podatak.editable;
    // The parent's send/review callbacks must stop immediately, before passive effects run.
    if ((incomplete || reopen) && result.podatak.editable && result.podatak.value.taskCountryCode && focus.current) reportEditing(true);
    setEditing(incomplete || reopen);
    setSelected(null); setPendingSlot(null); setEditorEpoch(value => value + 1);
    setState({ kind: 'READY', review: result.podatak });
  }, [props.conversationId, ownsAccount, reportEditing]);
  useEffect(() => {
    if (props.disabled) { activeReply.current?.cancel(); activeReply.current = null; loadEpoch.current++; resolver.cancel(); closeConfirmation(); }
    else if (latestState.current.kind === 'LOADING') void load();
  }, [load, props.disabled, resolver, closeConfirmation]);

  const review = state.kind === 'READY' || state.kind === 'SAVING' || state.kind === 'SAVED'
    ? state.review : state.kind === 'FAILED' ? state.review ?? null : null;
  const country = review?.value.taskCountryCode ?? null;
  const geography = review?.value.geography ?? null;
  const slots = geography ? locationSlots(geography) : [];
  const placed = new Set(points.map(point => point.slot));
  const next = slots.find(slot => !placed.has(slot));
  const activeSlot = selected && slots.includes(selected) ? selected : next ?? slots[0];
  const dirtyPoints = points.filter(point => {
    const previous = baseline.current.find(saved => saved.slot === point.slot);
    return !previous || pointKey(previous) !== pointKey(point);
  });
  const editingDecision = focused && !props.disabled && ((state.kind === 'READY' && editing && !!review?.editable && !!country && !!slots.length)
    || state.kind === 'SAVING' || (state.kind === 'FAILED' && !!review && points.length > 0));
  useEffect(() => { reportEditing(editingDecision); }, [editingDecision, reportEditing]);
  useEffect(() => () => { reportedEditing.current = false; editingChanged.current?.(false); }, []);

  const commit = useCallback(async (all: readonly ConfirmedLocationPoint[], current: NeedLocationReview) => {
    if (!ownsAccount() || !focus.current || saving.current || disabled.current || !current.editable
      || current.accountId !== props.accountId || current.conversationId !== props.conversationId) return false;
    if (!current.value.taskCountryCode || !current.value.geography) {
      setState({ kind: 'FAILED', message: 'Zadatku još fali država ili mesto. Dopuni ih u razgovoru pa se vrati.' });
      return false;
    }
    saving.current = true;
    const visit = focusEpoch.current;
    // A stationary task has one private address. Keep it aligned with the exact
    // point the person just confirmed, including an explicitly unresolved address.
    // Route/area-wide private text is not replaced by one of its component points.
    const start = all.find(point => point.slot === 'start');
    const savedStart = baseline.current.find(point => point.slot === 'start');
    const changedStart = start && (!savedStart || pointKey(start) !== pointKey(savedStart));
    const exactAddress = current.value.geography.mode === 'STATIONARY' && changedStart
      ? start.address?.trim() || null : current.value.exactAddress;
    setState({ kind: 'SAVING', review: current });
    const result = await needLocationClientService.save({
      conversationId: props.conversationId, expectedRevision: current.revision, confirmed: true,
      value: {
        taskCountryCode: current.value.taskCountryCode,
        geography: current.value.geography,
        exactAddress,
        accessNotes: current.value.accessNotes,
        resolvedLocation: { version: 1, points: all,
          binding: { taskCountryCode: current.value.taskCountryCode, geography: current.value.geography,
            exactAddress } },
      },
    }).catch(() => ({ ok: false as const, kod: 'NEED_LOCATION_SAVE_UNCONFIRMED',
      poruka: 'Ne znamo da li je mesto sačuvano. Potvrđene tačke su ostale za ponovni pokušaj.' }));
    saving.current = false;
    if (!ownsAccount()) return false;
    if (!result.ok) { setState({ kind: 'FAILED', message: result.poruka, review: current }); return false; }
    const saved = result.podatak.review, confirmed = savedPoints(saved.value);
    const savedSlots = saved.value.geography ? locationSlots(saved.value.geography) : [];
    const complete = savedSlots.length > 0 && savedSlots.every(slot => confirmed.some(point => point.slot === slot));
    setChangedSlots(new Set(confirmed.filter(point => {
      const before = baseline.current.find(prior => prior.slot === point.slot);
      return !before || pointKey(before) !== pointKey(point);
    }).map(point => point.slot)));
    baseline.current = confirmed; setPoints(confirmed); setPendingSlot(null); setSelected(null);
    setEditing(!complete); setEditorEpoch(value => value + 1);
    setState(complete ? { kind: 'SAVED', review: saved } : { kind: 'READY', review: saved });
    // Every explicit point confirmation is durable immediately. Parent readback receives the new
    // revision even for a partial route, while publication readiness still requires every slot.
    if (focus.current && focusEpoch.current === visit) props.onSaved();
    return true;
  }, [props, ownsAccount]);

  // Each point is confirmed by hand and persisted immediately. A route may remain incomplete,
  // but a confirmed START must survive leaving the screen while END is collected later.
  const confirm = (point: ConfirmedLocationPoint) => {
    if (!canAct() || !editing || state.kind !== 'READY' || !review?.editable || point.slot !== activeSlot || !slots.includes(point.slot)) return;
    view.current = null;
    const all = [...points.filter(existing => existing.slot !== point.slot), point];
    const complete = slots.every(slot => all.some(existing => existing.slot === slot));
    setPoints(all); setPendingSlot(null); setSelected(complete ? point.slot : null);
    committedPoint.current = commit(all, review);
  };

  const select = (slot: LocationSlot) => {
    if (!canAct() || state.kind !== 'READY' || !review?.editable || !slots.includes(slot) || slot === activeSlot) return;
    const open = () => {
      if (!canAct()) return;
      view.current = null; resolver.cancel();
      setSelected(slot); setPendingSlot(null); setEditorEpoch(value => value + 1);
    };
    if (pendingSlot) confirmation.ask({ title: 'Izmena tačke nije potvrđena',
      message: 'Ako pređeš na drugu tačku, ova izmena se odbacuje. Prethodno potvrđene tačke ostaju.',
      cancelLabel: 'Nastavi uređivanje', confirmLabel: 'Pređi na drugu tačku', onConfirm: open });
    else open();
  };

  // A loaded point is already on the server. Warn only about work performed during this visit,
  // including a draft that the point editor has not handed back as a confirmation yet.
  const leave = () => {
    if (!canAct()) return;
    activeReply.current?.cancel(); activeReply.current = null;
    const close = () => { if (canAct()) { view.current = null; reportEditing(false); props.onClose(); } };
    if ((!dirtyPoints.length && !pendingSlot) || state.kind === 'SAVED') { close(); return; }
    if (pendingSlot || baseline.current.length) {
      confirmation.ask({ title: dirtyPoints.length ? 'Izmene mesta nisu sačuvane' : 'Izmena tačke nije potvrđena',
        message: `${dirtyPoints.length
          ? 'Ako sad izađeš, izmene koje još nisu sačuvane se odbacuju.'
          : 'Ako sad izađeš, nepotvrđena izmena se odbacuje.'}${baseline.current.length ? ' Sačuvane tačke ostaju.' : ''}`,
        cancelLabel: 'Nastavi uređivanje', confirmLabel: 'Izađi ipak', tone: 'danger', onConfirm: close });
      return;
    }
    const one = dirtyPoints.length === 1;
    confirmation.ask({ title: one ? 'Potvrđena tačka nije sačuvana' : 'Potvrđene tačke nisu sačuvane',
      // This path now exists only for an unsaved in-memory edit/failure. Successful point confirmations
      // are persisted immediately, even while the rest of a route is still missing.
      message: one
        ? 'Ova potvrđena izmena još nije sačuvana. Ako sad izađeš, odbaciće se.'
        : 'Ove potvrđene izmene još nisu sačuvane. Ako sad izađeš, odbaciće se.',
      cancelLabel: 'Nastavi potvrđivanje', confirmLabel: 'Izađi ipak', tone: 'danger', onConfirm: close });
  };

  const inactive = !!props.disabled || !focused;
  const requestClose = useRef(leave); requestClose.current = leave;
  useEffect(() => {
    if (!editingDecision || inactive) { closeRequestChanged.current?.(null); return; }
    let active = true;
    const close = () => { if (active) requestClose.current(); };
    closeRequestChanged.current?.(close);
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (!active || disabled.current || !focus.current || !ownsAccount()) return false;
      close(); return true;
    });
    return () => { active = false; subscription.remove(); closeRequestChanged.current?.(null); };
  }, [editingDecision, inactive, ownsAccount]);
  const summaryPoints = review ? savedPoints(review.value) : [];
  const completeSummary = slots.length > 0 && slots.every(slot => summaryPoints.some(point => point.slot === slot));
  const editSaved = () => {
    if (!canAct() || !review?.editable || editing || !completeSummary) return false;
    view.current = null; reportEditing(true); setEditing(true); setState({ kind: 'READY', review });
    return true;
  };
  const replyScope = slots.length > 0 && !!country && !!review?.editable && !inactive && editing && state.kind === 'READY';
  const acquireReply = (): LocationReplyLease | null => {
    const prompt = editorPrompt.current;
    if (!replyScope || !canAct() || !review || !activeSlot || !prompt || prompt.context.promptToken !== promptToken || activeReply.current) return null;
    const pointLease = prompt.acquire();
    if (!pointLease) return null;
    const context = { ...prompt.context, reviewRevision: review.revision, slot: activeSlot };
    const cancel = () => { pointLease.cancel(); if (activeReply.current === lease) activeReply.current = null; };
    const lease: LocationReplyLease = {
      context,
      isCurrent: () => activeReply.current === lease && canAct() && pointLease.isCurrent(),
      cancel,
      apply: async decision => {
        if (!lease.isCurrent() || decision.promptToken !== context.promptToken || decision.reviewRevision !== context.reviewRevision
          || decision.slot !== context.slot) return false;
        if (decision.action === 'CONFIRM_DISPLAYED') {
          if (context.phase !== 'PROPOSAL' || !context.proposal || decision.proposalId !== context.proposal.id) return false;
          committedPoint.current = null;
          const accepted = pointLease.confirm();
          if (activeReply.current === lease) activeReply.current = null;
          const completion = committedPoint.current as Promise<boolean> | null;
          return !accepted ? false : completion !== null ? await completion : true;
        }
        if (decision.action === 'CORRECT') {
          return pointLease.correct();
        }
        return true; // Keep the proposal locked until the route finishes canonical readback.
      },
    };
    activeReply.current = lease; return lease;
  };
  useEffect(() => {
    const prompt = editorPrompt.current;
    promptChanged.current?.(replyScope && prompt && review && activeSlot && prompt.context.promptToken === promptToken
      ? { context: { ...prompt.context, reviewRevision: review.revision, slot: activeSlot }, acquire: acquireReply } : null);
  });
  useEffect(() => () => { activeReply.current?.cancel(); activeReply.current = null; promptChanged.current?.(null); }, []);

  if (state.kind === 'LOADING') return <T accessibilityLiveRegion="polite" tone="muted">Otvaramo mesto zadatka…</T>;
  // A failed save used to offer a reload, which re-read the server over the pins the person had
  // just placed by hand: the work that is hardest to get was the work least protected. The points
  // stay in state, and the retry sends the same ones again.
  if (state.kind === 'FAILED') return <View style={{ gap: 12 }}>
    <T accessibilityRole="alert" tone="danger">{state.message}</T>
    {points.length ? <T variant="meta" tone="muted">Tvoje potvrđene tačke nisu izgubljene.</T> : null}
    {points.length && review ? <Button label="Sačuvaj ponovo" disabled={inactive} onPress={() => { if (canAct()) void commit(points, review); }} /> : null}
    {points.length
      // `load()` puts the saved place back over the points on screen, so the saved place is what replaces.
      ? <Button kind="quiet" label="Učitaj sačuvano mesto" disabled={inactive} onPress={() => { if (canAct()) confirmation.ask({ title: 'Učitaj sačuvano mesto?',
        message: 'Poslednje sačuvano mesto zameniće potvrđene tačke koje još nisu sačuvane.',
        cancelLabel: 'Odustani', confirmLabel: 'Učitaj', tone: 'danger', onConfirm: () => { if (canAct()) void load(); } }); }} />
      : <Button kind="quiet" label="Pokušaj ponovo" disabled={inactive} onPress={() => { if (canAct()) void load(); }} />}
    <Button kind="quiet" label="Zatvori" disabled={inactive} onPress={leave} />
    {confirmation.sheet}
  </View>;

  // The thread asks for the point from the geography alone, which never looks at the country, so a
  // draft with no country yet met "Fali još mesto na mapi" and, two lines below, "nije potrebno".
  // A missing country is a question for the conversation, not a statement about the task.
  if (review && geography && slots.length && !country) return <View style={{ gap: 12 }}>
    <T accessibilityRole="alert" tone="muted">Prvo reci u kojoj je državi zadatak — bez toga mapa ne zna gde da traži.</T>
    <Button kind="primary" label="Reci u razgovoru" disabled={inactive} onPress={leave} />
  </View>;
  if (!review || !country || !geography || !slots.length) return <View style={{ gap: 12 }}>
    <T accessibilityRole="alert" tone="muted">Za ovaj zadatak mesto na mapi nije potrebno.</T>
    <Button kind="quiet" label="Zatvori" disabled={inactive} onPress={leave} />
  </View>;

  // A saved place is one compact line (owner, phone test 2026-10-07): the docked block with the provider's whole label,
  // "Mapa" and "Izmeni" got in the way of the conversation. The line itself is the edit entry; its map is the editor's.
  // Opened from the conversation's own line for a place that can no longer change, the read-only answer below says why.
  if (!editing && completeSummary && !(props.startEditing && !review.editable)) {
    const saved = state.kind === 'SAVED';
    const acknowledged = new Set(saved ? summaryPoints.filter(point => point.origin.kind === 'MANUAL_PIN' && changedSlots.has(point.slot))
      .map(point => point.slot) : []);
    return <ConfirmedPlaceLine entries={confirmedPlaceEntries(summaryPoints, review.value, acknowledged)} announce={saved}
      onEdit={review.editable && !inactive ? () => { editSaved(); } : undefined} />;
  }

  if (!review.editable) return <View style={{ gap: 12 }}>
    <T accessibilityRole="alert" tone="muted">Ovaj razgovor je već sačuvan. Otvori njegov zadatak da izmeniš mesto.</T>
    <Button kind="quiet" label="Zatvori" disabled={inactive} onPress={leave} />
  </View>;

  const editingSavedRoute = slots.length > 1 && baseline.current.length === slots.length;

  return <View style={{ gap: 14 }}>
    {editingSavedRoute ? <View accessibilityRole="radiogroup" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
      {slots.map(slot => {
        const pending = pendingSlot === slot;
        const status = pending ? 'Čeka potvrdu' : placed.has(slot) ? 'Potvrđeno' : 'Nije potvrđeno';
        const label = title(slot, geography), place = points.find(point => point.slot === slot)?.address || seed(slot, review.value);
        return <Press key={slot} accessibilityRole="radio" accessibilityLabel={`${label}${place ? `, ${place}` : ''}, ${status}`}
          accessibilityState={{ selected: slot === activeSlot, disabled: state.kind === 'SAVING' || inactive }}
          disabled={state.kind === 'SAVING' || inactive} onPress={() => select(slot)} haptic="select"
          style={{ minHeight: 44, paddingHorizontal: 12, paddingVertical: 8, borderRadius: sys.radius.pill, borderWidth: 1,
            borderColor: slot === activeSlot ? sys.color.green : sys.color.line, backgroundColor: sys.color.surface,
            flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <T variant="note" style={{ color: slot === activeSlot ? sys.color.ink : sys.color.muted, fontWeight: '600' }}>
            {placed.has(slot) && !pending ? '✓ ' : ''}{label}
          </T>
        </Press>;
      })}
    </View> : null}
    {state.kind === 'SAVING' ? <T accessibilityLiveRegion="polite" tone="muted">Čuvamo mesto…</T> : null}
    {activeSlot ? <LocationPointEditor key={`${editorEpoch}:${activeSlot}`} slot={activeSlot} title={title(activeSlot, geography)}
      point={points.find(point => point.slot === activeSlot)} scopeKey={`${props.accountId}:${props.accountRevision}:${review.conversationId}:${review.revision}:${editorEpoch}`}
      countryCode={country} initialQuery={seed(activeSlot, review.value)} autoLocate={!inactive} resolver={resolver}
      initialQuestion={!points.some(point => point.slot === activeSlot) && slotNeedsCloserPlace(activeSlot, review.value)
        ? `${title(activeSlot, geography)} — koja ulica, objekat ili bliže mesto?` : undefined}
      presentation="conversation" onCorrectInConversation={leave}
      conversationSummary={slots.length > 1 ? { title: title(activeSlot, geography),
        description: points.find(point => point.slot === activeSlot)?.address || seed(activeSlot, review.value) } : undefined}
      onPromptReady={registerEditorPrompt}
      disabled={state.kind === 'SAVING' || inactive} onInvalidate={() => {
        if (canAct() && state.kind === 'READY') setPendingSlot(activeSlot);
      }} onConfirm={confirm} /> : null}
    <Button kind="quiet" label={completeSummary ? 'Zatvori' : 'Kasnije'} disabled={state.kind === 'SAVING' || inactive} onPress={leave} />
    {confirmation.sheet}
  </View>;
}

// A default export so the conversation can load this lazily and keep the native map,
// which this module reaches through LocationPointEditor, out of its own module graph.
export default ConversationPointAsk;
