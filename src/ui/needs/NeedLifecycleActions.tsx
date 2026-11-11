import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, StyleSheet, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router, useFocusEffect } from 'expo-router';
import type { PotrebaProjekcija } from '../../contracts/projections';
import type { NeedLifecycleCommand } from '../../contracts/needLifecycle';
import { createNeedLifecycleController, type NeedLifecycleState } from '../../data/needLifecycleController';
import { positiveInteger, uuid } from '../../data/serverReceipt';
import { sesijaSada, useSesija } from '../../store/sesija';
import { useIzvor } from '../../store/uloga';
import { T } from '../Text';
import { V2Action } from '../v2/V2Action';
import { useConfirmSheet } from '../system/ConfirmSheet';
import { inset, sys } from '../system/tokens';
import { CancelReasons, TASK_CANCEL_REASONS } from './CancelReasons';

type Action = NeedLifecycleCommand['action'];
type Controller = ReturnType<typeof createNeedLifecycleController>;
type ViewState = { loading: boolean; review: Action | null; command: NeedLifecycleCommand | null;
  state: NeedLifecycleState | null; error: string | null };
const initial: ViewState = { loading: true, review: null, command: null, state: null, error: null };
const label = (action: Action) => action === 'DELETE_DRAFT' ? 'Obriši nacrt' : 'Otkaži zadatak';
// One sentence of consequence (plan 2.3): what happens, and where the person finds it afterwards. A cancellation can only be asked for a
// task with no agreed place (`eligible`), so the sentence about an existing Dogovor is not needed here: those go through the Dogovor.
const consequence = (action: Action) => action === 'DELETE_DRAFT'
  ? 'Nacrt se briše zauvek i ne može da se vrati. Ako ima fotografije, prvo ih ukloni iz nacrta.'
  : 'Zadatak više ne prima prijave, a poslate prijave se zatvaraju. Ostaje u istoriji.';
/** How long the check of a retained command may run before the screen says so; it usually ends within a frame. */
export const LIFECYCLE_CHECK_NOTICE_MS = 400;

/**
 * Which ways into the lifecycle a Need offers right now: the rule for the screen's "···". `request` does not call it;
 * it checks the same conditions in its own `eligible` (nothing agreed yet, not closed, and a draft for "Obriši nacrt").
 * Places already agreed are cancelled through their Dogovori; a closed task offers nothing. A draft offers ONLY "Obriši nacrt":
 * it was never published, so there is nobody to cancel it for, and the two entries side by side asked a person to choose between
 * a deletion and a cancellation of the same unpublished thing (plan 2.3).
 */
export function needLifecycleEntries(need: PotrebaProjekcija | null): { deleteDraft: boolean; cancel: boolean; agreements: boolean } {
  if (!need) return { deleteDraft: false, cancel: false, agreements: false };
  if (need.pokrivenost.popunjeno > 0) return { deleteDraft: false, cancel: false, agreements: true };
  if (need.stanje === 'ZATVORENA') return { deleteDraft: false, cancel: false, agreements: false };
  return { deleteDraft: need.stanje === 'NACRT', cancel: need.stanje !== 'NACRT', agreements: false };
}

/** What a screen's "···" calls. Each call passes every guard of the lifecycle before anything is asked or sent. */
export type NeedLifecycleMenu = {
  /** Opens the review of `action` as a confirmation sheet; nothing is sent before its confirm. */ request: (action: Action) => void;
  openAgreements: () => void;
};

/** Existing revision-bound terminal authority. Persist only opaque command identity;
 * restoration reads the private receipt and never infers deletion from a list.
 * Recovery is deliberately mountable without the Need row: a successful delete
 * may make that row disappear before the client receives its terminal reply.
 *
 * The entries live in the screen's "···" (owner step 5b, 2026-09-24): the handle is written into `menu`, the review is
 * asked in a ConfirmSheet, and only what the person must see — the check of a retained command, the command running, its
 * uncertain, confirmed or refused outcome, an error — is drawn on the screen, never hidden in a sheet. The inline
 * placement that drew its own entries and asked on the screen was retired after the review of step 5b: no screen used it
 * any more, and its guards (persist before sending, one command, the revision fence, restore and reconcile) are the same
 * ones `request` passes, now proved through this placement (v5-need-lifecycle-screen, need-lifecycle-menu). */
export function NeedLifecycleActions(p: { need: PotrebaProjekcija | null; needId?: string; disabled: boolean;
  onActiveChange: (active: boolean) => void; onRefresh: () => void; menu: { current: NeedLifecycleMenu | null } }) {
  const { user, accountRevision } = useSesija(), source = useIzvor();
  const accountId = user?.id ?? '', needId = p.need?.id ?? p.needId ?? '';
  const storageKey = `uskoci:need-lifecycle:v5:${accountId}:${needId}`;
  const [view, setView] = useState<ViewState>(initial), [reload, setReload] = useState(0);
  const latestView = useRef(view); latestView.current = view;
  const scope = useRef<object | null>(null), controller = useRef<Controller | null>(null);
  const latch = useRef(false), latest = useRef(p); latest.current = p;
  // The chip the person chose in the cancellation question ('' = none): it is read once, when the command is built.
  const reasonChosen = useRef('');
  // The confirmation of the "···" way in. The screen retires it wherever it retires the review itself.
  const confirmation = useConfirmSheet(), closeConfirmation = confirmation.close;
  const foreground = () => !['background', 'inactive'].includes(AppState.currentState);
  // Whose Task this is was settled before this mounted: the Need comes from the owner-only read, a
  // restored command is stored under this account, and the server checks ownership on every
  // command. The mode the app is in was a fourth condition here and answered a different question
  // (owner decision 1, 2026-09-19). It stays in the guard only as the staleness identity it shares
  // with every other screen.
  const current = (owner: object | null) => owner !== null && scope.current === owner && foreground()
    && sesijaSada().user?.id === accountId && sesijaSada().accountRevision === accountRevision;
  const install = (owner: object, command: NeedLifecycleCommand, restoring: boolean) => {
    const engine = createNeedLifecycleController({ account: { accountId, accountRevision }, command,
      restoreUnknownOutcome: restoring,
      currentAccount: () => current(owner) ? { accountId, accountRevision } : null,
      refreshOwnedNeeds: async () => { if (!current(owner)) throw new Error('ACCOUNT_CHANGED'); await source.mojePotrebe(); },
    });
    controller.current = engine;
    const render = () => { if (current(owner)) setView({ loading: false, review: null, command, state: engine.snapshot(), error: null }); };
    engine.subscribe(render); render(); return engine;
  };
  useFocusEffect(useCallback(() => {
    const owner = {}; scope.current = owner; latch.current = false; setView(initial);
    let retired = false;
    const restore = async () => {
      try {
        const raw = await AsyncStorage.getItem(storageKey);
        if (retired || !current(owner)) return;
        if (raw === null) { setView({ ...initial, loading: false }); return; }
        const command: NeedLifecycleCommand = JSON.parse(raw);
        // A command this app stored carries no reason, or (for a cancellation only) one of the chips it offered; nothing else is restored.
        if (!command || !uuid(command.needId) || command.needId !== needId || !positiveInteger(command.expectedRevision)
          || !['CANCEL', 'DELETE_DRAFT'].includes(command.action)
          || (command.reason !== '' && !(command.action === 'CANCEL' && (TASK_CANCEL_REASONS as readonly string[]).includes(command.reason)))) throw new Error('INVALID_RESTORE');
        const engine = install(owner, Object.freeze(command), true);
        await engine.reconcile();
      } catch { if (!retired && current(owner)) setView({ ...initial, loading: false,
        error: 'Prethodni zahtev nije moguće proveriti. Pokušaj ponovo pre nove radnje.' }); }
    };
    void restore();
    const app = AppState.addEventListener('change', state => {
      if (state !== 'active') { controller.current?.dispose(); controller.current = null; scope.current = null; closeConfirmation(); }
      else if (!retired) setReload(value => value + 1);
    });
    return () => { retired = true; app.remove(); controller.current?.dispose(); controller.current = null;
      if (scope.current === owner) scope.current = null; latch.current = false; closeConfirmation(); };
  // The scope owns every async continuation; render-time callbacks are intentionally
  // not dependencies that could retire a command on its own state update.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accountId, accountRevision, needId, source, storageKey, reload]));
  const active = view.loading || view.review !== null || view.command !== null || view.error !== null;
  useEffect(() => { p.onActiveChange(active); return () => p.onActiveChange(false); }, [active, p.onActiveChange]);
  const owner = scope.current;
  const eligible = (action: Action) => {
    const need = latest.current.need;
    return current(owner) && !!need && need.id === needId && !latest.current.disabled && !latch.current
      && need.pokrivenost.popunjeno === 0 && need.stanje !== 'ZATVORENA'
      // A draft is deleted, never cancelled (see `needLifecycleEntries`); a published task is cancelled, never "deleted".
      && (action === 'DELETE_DRAFT' ? need.stanje === 'NACRT' : need.stanje !== 'NACRT');
  };
  const submit = async () => {
    const action = view.review, need = p.need, currentNeed = latest.current.need;
    if (latestView.current !== view || !action || view.command || !need || !currentNeed || !eligible(action)
      || currentNeed.revizija !== need.revizija || !owner) return;
    latch.current = true;
    // The reason is the chip the person chose in the question, for a cancellation only; none is required.
    const command = Object.freeze({ action, needId, expectedRevision: need.revizija, reason: action === 'CANCEL' ? reasonChosen.current : '' });
    try {
      // Persist before sending. A storage failure never licenses an untracked write.
      await AsyncStorage.setItem(storageKey, JSON.stringify(command));
      if (!current(owner)) return;
      const engine = install(owner, command, false); await engine.submit();
    } catch { if (current(owner)) setView({ ...view, error: 'Zahtev nije poslat jer nije sačuvana njegova potvrda. Pokušaj ponovo.' }); }
    finally { if (current(owner)) latch.current = false; }
  };
  // The sheet's way out, and the end of a confirm that installed no command: the review goes, an error it left stays.
  // Once a command exists it owns the screen, and nothing here can discard it.
  const dismissReview = () => {
    if (!current(owner) || latch.current || controller.current) return;
    setView(value => value.review !== null && value.command === null ? { ...value, review: null } : value);
  };
  // The sheet always calls the newest of these: the confirm must be the submit of the render that holds the review.
  const commands = useRef({ submit, dismissReview }); commands.current = { submit, dismissReview };
  const request = (action: Action) => {
    if (latestView.current !== view || active || !eligible(action)) return;
    // The answer belongs to the version of the task the person was asked about. A newer one that arrived under the open
    // question is not what they confirmed, so that confirm sends nothing; `submit` checks the same fence once more.
    const seen = latest.current.need?.revizija;
    setView({ ...view, review: action, error: null });
    reasonChosen.current = '';
    // The server keeps the reason of a cancellation, so only that question offers one (and it is a sheet, because chips want room).
    confirmation.ask({ title: `${label(action)}?`, message: consequence(action), confirmLabel: label(action), tone: 'danger',
      extra: action === 'CANCEL' ? <CancelReasons onChange={reason => { reasonChosen.current = reason; }} /> : undefined,
      onConfirm: () => {
        if (latest.current.need?.revizija !== seen) { commands.current.dismissReview(); return; }
        return commands.current.submit().finally(() => commands.current.dismissReview());
      },
      onCancel: () => commands.current.dismissReview() });
  };
  const openAgreements = () => { if (current(owner) && !p.disabled) router.push('/dogovori'); };
  // The screen's "···" reaches the newest guards through this handle, and loses it with this component.
  useEffect(() => { p.menu.current = { request, openAgreements }; });
  useEffect(() => { const handle = p.menu; return () => { handle.current = null; }; }, [p.menu]);
  // The check of a retained command is said only when it takes long enough to be seen: a line that came and went on
  // every open would move the whole task under it.
  const [slowCheck, setSlowCheck] = useState(false);
  useEffect(() => {
    if (!view.loading) { setSlowCheck(false); return; }
    const timer = setTimeout(() => setSlowCheck(true), LIFECYCLE_CHECK_NOTICE_MS);
    return () => clearTimeout(timer);
  }, [view.loading]);
  const run = (operation: 'reconcile' | 'retrySame' | 'refreshCollection') => {
    if (current(owner) && !latch.current) void controller.current?.[operation]();
  };
  const finish = async (navigate: boolean) => {
    if (!current(owner) || latch.current || !['CONFIRMED', 'REJECTED'].includes(view.state?.phase ?? '')) return;
    latch.current = true;
    try {
      await AsyncStorage.removeItem(storageKey); if (!current(owner)) return;
      controller.current?.dispose(); controller.current = null;
      if (navigate) router.replace('/potrebe'); else { setReload(value => value + 1); p.onRefresh(); }
    } catch { if (current(owner)) setView({ ...view, error: 'Potvrda je sačuvana. Pokušaj ponovo da nastaviš.' }); }
    finally { if (current(owner)) latch.current = false; }
  };
  const phase = view.state?.phase;
  // The initial loading pass runs with or without the Need row, so a retained command can be recovered; with nothing to
  // say, nothing is drawn and the screen keeps its rhythm.
  const body = view.loading ? (slowCheck ? <T accessibilityLiveRegion="polite" style={s.copy}>Proveravamo prethodni zahtev…</T> : null)
    : view.state ? <>
      {/* The outcome in plain words, first under the task's name: what happened, not which system said so. */}
      <T accessibilityLiveRegion="polite" style={s.copy}>{phase === 'CONFIRMED'
        ? view.command?.action === 'DELETE_DRAFT' ? 'Nacrt je obrisan.' : 'Zadatak je otkazan.'
        : phase === 'SUBMITTING' ? 'Šaljemo pregledani zahtev…' : phase === 'RECONCILING' ? 'Proveravamo potvrdu…'
          : view.state.error?.poruka ?? 'Ponovo otvori zadatak.'}</T>
      {phase === 'UNKNOWN_OUTCOME' ? <>
        <V2Action label="Proveri da li je uspelo" kind="quiet" style={s.quiet} onPress={() => run('reconcile')} />
        <V2Action label="Pošalji ponovo" kind="quiet" style={s.quiet} disabled={!controller.current?.canRetrySame()} onPress={() => run('retrySame')} />
        <T style={s.copy}>Ponovno slanje je dostupno tek posle uspešne provere.</T>
      </> : phase === 'CONFIRMED' ? <>
        {view.state.collectionRefreshRequired ? <V2Action label="Osveži moje zadatke" kind="quiet" style={s.quiet} onPress={() => run('refreshCollection')} /> : null}
        <V2Action label="Moji zadaci" onPress={() => { void finish(true); }} />
      </> : phase === 'REJECTED' ? <V2Action label="Učitaj aktuelni zadatak" kind="quiet" style={s.quiet} onPress={() => { void finish(false); }} /> : null}
    </> : view.error ? <V2Action label="Ponovo proveri prethodni zahtev" kind="quiet" style={s.quiet} onPress={() => { if (current(owner)) setReload(value => value + 1); }} />
      : null;
  if (!view.error && body === null) return confirmation.sheet;
  return <>
    <View style={s.notice}>
      {view.error ? <T accessibilityLiveRegion="polite" style={s.error}>{view.error}</T> : null}
      {body}
    </View>
    {confirmation.sheet}
  </>;
}
/** Same controller and copies; flat, in the task's own reading order (2026-09-23), not a card of its own. */
const s = StyleSheet.create({
  // A flat tint, not a card: what happened to a command the person sent, where they read first.
  notice: { ...inset, gap: 12, alignItems: 'flex-start', alignSelf: 'stretch', backgroundColor: sys.color.wash },
  // Text actions start where the text of the screen starts, as the other ways to change the task do.
  quiet: { paddingHorizontal: 0 },
  copy: { ...sys.type.note, color: sys.color.muted }, error: { ...sys.type.note, color: sys.color.danger } });
