import { useCallback, useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, ActivityIndicator, AppState, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import type { AuthAccountScope } from '../../contracts/auth';
import type { NotificationPreferences, NotificationRole, NotificationSettings } from '../../contracts/notificationPreferences';
import { notificationPreferencesClientService } from '../../data/notificationPreferencesClientService';
import { nativePushDevice, type NativePushState, type PushPermissionWait } from '../../data/nativePushDevice';
import { pushDeviceClientService, type PushDevice } from '../../data/pushDeviceClientService';
import { pushReadinessClientService, type PushReadiness } from '../../data/pushReadinessClientService';
import { sesijaSada, useSesija } from '../../store/sesija';
import { T } from '../Text';
import { V2Action } from '../v2/V2Action';
import { CivilField } from '../calendar/CalendarControls';
import { SettingsFooter, SettingsGroup, SettingsInfo } from '../settings/SettingsPresentation';
import { NotificationLoading } from './NotificationLoading';
import { NoticeSwitchRow } from './NoticeSwitchRow';
import { Disclosure } from '../system/Disclosure';
import { FactArt } from '../system/FactArt';
import { InfoButton } from '../system/InfoButton';
import { Section } from '../system/Section';
import { StateView } from '../system/StateView';
import { SystemSettingsAction } from '../system/SystemSettingsAction';
import { layout, ruleWidth } from '../system/layout';
import { useLayoutClass } from '../system/textScale';
import { brandAction, sys } from '../system/tokens';
import { vreme } from '../../lib/vreme';
import { urgentBuilt } from '../../lib/needUrgency';

/**
 * The notification settings, ONE screen (the owner's phone of 8 Oct 2026: two tabs, "Moji zadaci" and "Moje prijave", repeated the same
 * phone, in-app and quiet-hours blocks, and the approved blueprint, P4, makes it one). The server keeps two sets of settings for one
 * account, one for the tasks it publishes (REQUESTER) and one for the work it applies to (WORKER); this screen reads both, draws what is
 * the account's once ("Ovaj telefon", "Tihi sati", "Obaveštenja u aplikaciji") and what is a set's under its own heading ("Kad
 * objavljuješ", "Kad uskačeš"), and writes each set it changed, one after the other, with its own revision. An edit of what is shared
 * is made in both drafts, so the two sets agree from the first save on; a screen that finds them apart (they were once kept apart, one
 * per tab) shows them as they are and changes nothing the person did not touch.
 */
export type Roles<V> = Record<NotificationRole, V>;
const ROLES: readonly NotificationRole[] = ['REQUESTER', 'WORKER'];
type Snapshot = { preferences: Roles<NotificationPreferences>; native: NativePushState; device: PushDevice | null; readiness: PushReadiness | null };
type Scope = AuthAccountScope & { alive: boolean; busy: boolean; generation: number; foreground: boolean;
 permissionPending?: boolean; resumePermission?: () => void; cancelPending?: () => void };
type Draft = { owner: Scope; settings: Roles<NotificationSettings> };
type PendingWrite = { owner: Scope; original: Roles<NotificationPreferences>; wanted: Roles<NotificationSettings>; roles: readonly NotificationRole[] };
const SETTING_KEYS: (keyof NotificationSettings)[] = [
 'in_app_enabled', 'push_enabled', 'opportunities_enabled', 'responses_enabled', 'dogovor_enabled', 'execution_enabled',
 'recovery_enabled', 'account_enabled', 'quiet_hours_enabled', 'quiet_start', 'quiet_end', 'quiet_timezone', 'urgent_overrides_quiet_hours',
];
const QUIET_KEYS = ['quiet_hours_enabled', 'quiet_start', 'quiet_end', 'quiet_timezone', 'urgent_overrides_quiet_hours'] as const;
type QuietKey = typeof QUIET_KEYS[number];
const TIME = /^(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d(?:\.\d{1,6})?)?$/;
function sameSettings(a: NotificationSettings, b: NotificationSettings) { return SETTING_KEYS.every(key => a[key] === b[key]); }
function cloneSettings(value: NotificationSettings): NotificationSettings { return { ...value }; }
/** Re-read before any retry: only unchanged rows can retain an unfinished explicit choice. */
function reconcilePendingWrite(pending: PendingWrite, snapshot: Snapshot) {
 const settings: Roles<NotificationSettings> = {
  REQUESTER: cloneSettings(snapshot.preferences.REQUESTER.settings),
  WORKER: cloneSettings(snapshot.preferences.WORKER.settings),
 };
 const incomplete = pending.roles.filter(role => !sameSettings(snapshot.preferences[role].settings, pending.wanted[role]));
 const conflict = incomplete.some(role => snapshot.preferences[role].revision !== pending.original[role].revision
  || !sameSettings(snapshot.preferences[role].settings, pending.original[role].settings));
 // An external change to either role invalidates the proposed shared edit as a whole.
 if (!conflict) for (const role of incomplete) settings[role] = cloneSettings(pending.wanted[role]);
 return { settings, conflict, confirmed: incomplete.length === 0 };
}
function validateDraft(value: NotificationSettings): string | null {
 if (!value.quiet_timezone.trim()) return 'Izaberite vremensku zonu za tihe sate.';
 if (!value.quiet_hours_enabled) return null;
 if (!value.quiet_start || !value.quiet_end) return 'Za tihe sate izaberite početak i kraj.';
 if (!TIME.test(value.quiet_start) || !TIME.test(value.quiet_end)) return 'Vreme tihih sati nije ispravno. Izaberite ga ponovo.';
 return null;
}

/** The quiet hours of the account as ONE value: the set that has them on speaks for both, otherwise the first set does. */
export function sharedQuiet(sets: Roles<NotificationSettings>): Pick<NotificationSettings, QuietKey> {
 const source = !sets.REQUESTER.quiet_hours_enabled && sets.WORKER.quiet_hours_enabled ? sets.WORKER : sets.REQUESTER;
 return { quiet_hours_enabled: source.quiet_hours_enabled, quiet_start: source.quiet_start, quiet_end: source.quiet_end,
  quiet_timezone: source.quiet_timezone, urgent_overrides_quiet_hours: source.urgent_overrides_quiet_hours };
}
/** `on` when both sets have the flag on, `off` when neither has, `mixed` when they differ (it reads as off and says so). */
export function sharedFlag(sets: Roles<NotificationSettings>, key: 'in_app_enabled' | 'push_enabled'): 'on' | 'off' | 'mixed' {
 const values = ROLES.map(role => sets[role][key] === true);
 return values.every(Boolean) ? 'on' : values.some(Boolean) ? 'mixed' : 'off';
}
/**
 * One edit applied to the drafts of both sets. An edit of a set changes that set; an edit of what is the account's ('ALL') changes both. The
 * quiet hours are one value: an edit of any part of them makes ALL of it the same in both sets, so the two never keep different ends under
 * the one start the person sees. Pure, so the container and the gallery make the very same change.
 */
export function editSettings<K extends keyof NotificationSettings>(held: Roles<NotificationSettings>, role: NotificationRole | 'ALL', key: K,
 value: NotificationSettings[K]): Roles<NotificationSettings> {
 const next: Roles<NotificationSettings> = { REQUESTER: { ...held.REQUESTER }, WORKER: { ...held.WORKER } };
 if (role !== 'ALL') next[role][key] = value;
 else if ((QUIET_KEYS as readonly string[]).includes(key)) {
  const shown = { ...sharedQuiet(held), [key]: value };
  for (const each of ROLES) Object.assign(next[each], shown);
 } else for (const each of ROLES) next[each][key] = value;
 return next;
}
/** Whether this phone is sent notifications for both sets, for one of them, or for none. */
export type PushScope = { state: 'all' } | { state: 'none' } | { state: 'some'; on: NotificationRole };
export function pushScope(sets: Roles<NotificationSettings>): PushScope {
 const state = sharedFlag(sets, 'push_enabled');
 return state === 'on' ? { state: 'all' } : state === 'off' ? { state: 'none' } : { state: 'some', on: sets.REQUESTER.push_enabled ? 'REQUESTER' : 'WORKER' };
}

/** Which of this screen's own commands is at work, so only its button shows the spinner. Presentation only. */
type Working = 'save' | 'enable' | 'disable' | 'read' | null;
type Edit = <K extends keyof NotificationSettings>(role: NotificationRole | 'ALL', key: K, value: NotificationSettings[K]) => void;

export function PushPreferences({ onDirtyChange, onWritingChange }: {
 /** Told whenever there are unsaved changes, so the route can ask before Back throws them away. A change that is being saved is not
  *  reported: its request is already on its way and lands whether the person stays or not. */
 onDirtyChange?: (dirty: boolean) => void;
 /** Told while one of this screen's writes (save, enable, disable) runs, so the route keeps the screen where it is. */
 onWritingChange?: (writing: boolean) => void }) {
 const { user, accountRevision } = useSesija(); const accountId = user?.id ?? '';
 const renderedOwner = useRef({ accountId, accountRevision }); renderedOwner.current = { accountId, accountRevision };
 const scopeRef = useRef<Scope | null>(null);
 const [view, setView] = useState<{ owner: Scope; snapshot: Snapshot } | null>(null);
 const [draft, setDraft] = useState<Draft | null>(null);
 const [busy, setBusy] = useState(false); const [error, setError] = useState(false); const [validation, setValidation] = useState<string | null>(null);
 const [working, setWorking] = useState<Working>(null);
 /** The snapshot a save's own re-read returned; the check shows only once that very read-back is on screen. */
 const savedSnapshot = useRef<Snapshot | null>(null);
 const pendingWrite = useRef<PendingWrite | null>(null);
 const current = (scope: Scope, generation: number) => scopeRef.current === scope && scope.alive && scope.generation === generation
  && sesijaSada().user?.id === scope.accountId && sesijaSada().accountRevision === scope.accountRevision
  && renderedOwner.current.accountId === scope.accountId && renderedOwner.current.accountRevision === scope.accountRevision;
 async function bounded<T>(work: (permissionWait: PushPermissionWait) => Promise<T>, scope: Scope): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let remaining = 15000, startedAt = Date.now(), waiting = false, settled = false, retired = false;
  let rejectPending!: (error: Error) => void;
  const cancelled = new Promise<never>((_, reject) => { rejectPending = reject; });
  const stop = (code: string) => {
   if (settled || retired) return;
   retired = true; if (timer !== undefined) clearTimeout(timer);
   scope.generation++; scope.resumePermission?.(); rejectPending(Error(code));
  };
  const cancel = () => stop('STALE');
  const arm = () => { startedAt = Date.now(); timer = setTimeout(() => stop('TIMEOUT'), remaining); };
  const permissionWait: PushPermissionWait = next => {
   if (settled || retired || waiting === next) return;
   if (next) {
    waiting = true; scope.permissionPending = true;
    if (timer !== undefined) clearTimeout(timer);
    timer = undefined; remaining = Math.max(0, remaining - (Date.now() - startedAt));
   } else {
    const resume = () => { waiting = false; scope.permissionPending = false;
     scope.resumePermission = undefined; if (!settled && !retired) arm(); };
    // Android may report a temporary system Activity as background. The OS
    // result can arrive before the foreground event: never register from there.
    if (!scope.foreground) return new Promise<void>(resolve => {
     scope.resumePermission = () => { resume(); resolve(); };
    });
    resume();
   }
  };
  scope.cancelPending = cancel; arm();
  try { return await Promise.race([work(permissionWait), cancelled]); }
  finally {
   settled = true; if (timer !== undefined) clearTimeout(timer);
   scope.resumePermission?.(); scope.permissionPending = false;
   if (scope.cancelPending === cancel) scope.cancelPending = undefined;
  }
 }
 async function read(scope: Scope, generation: number, ask: boolean, permissionWait?: PushPermissionWait): Promise<Snapshot> {
  const transport = readTransport();
  const [requester, worker] = await Promise.all(ROLES.map(role => notificationPreferencesClientService.read(scope.accountId, role)));
  if (!current(scope, generation)) throw Error('STALE');
  const native = ask ? await nativePushDevice(true, () => current(scope, generation), permissionWait)
   : await nativePushDevice(false, () => current(scope, generation));
  if (!current(scope, generation)) throw Error('STALE');
  const result = native.kind === 'READY' ? await pushDeviceClientService.read(scope, native.token) : null;
  if (!current(scope, generation) || result && !result.ok) throw Error('READ_UNAVAILABLE');
  const readiness = await transport;
  if (!current(scope, generation)) throw Error('STALE');
  return { preferences: { REQUESTER: requester, WORKER: worker }, native, device: result?.ok ? result.podatak : null, readiness };
 }
 async function run(scope: Scope, work: (generation: number, permissionWait: PushPermissionWait) => Promise<Snapshot>, kind: Working = null) {
  if (scope.busy || !current(scope, scope.generation)) return;
  // setView(null) here meant that pressing "Sačuvaj podešavanja" made nine switches, three fields
  // and five buttons vanish behind a spinner, and on any failure the wipe was permanent: the error
  // panel replaced the settings instead of standing beside them. The last good state stays mounted
  // and waits (every control is locked) while the work runs; only a first read has nothing to show.
  // The spinner goes to the command that really starts, after the busy check: a press or a foreground re-read that is
  // refused here must not move it onto its own button while another command runs.
  scope.busy = true; const generation = ++scope.generation; setBusy(true); setError(false); setValidation(null); setWorking(kind);
  try {
   // Keep the same command lock and remaining network deadline while allowing
   // an unhurried answer to the OS dialog. No token/RPC work is unbounded.
   const snapshot = await bounded(permissionWait => work(generation, permissionWait), scope);
   if (current(scope, generation)) {
    const pending = pendingWrite.current?.owner === scope ? pendingWrite.current : null;
    const recovered = pending ? reconcilePendingWrite(pending, snapshot) : null;
    setView({ owner: scope, snapshot });
    setDraft({ owner: scope, settings: recovered?.settings ?? {
     REQUESTER: cloneSettings(snapshot.preferences.REQUESTER.settings),
     WORKER: cloneSettings(snapshot.preferences.WORKER.settings),
    } });
    if (pending) {
     pendingWrite.current = null;
     savedSnapshot.current = kind === 'save' && recovered?.confirmed ? snapshot : null;
     if (recovered?.conflict) setValidation('Podešavanja su promenjena na drugom mestu. Proveri obe uloge pre novog čuvanja.');
    } else if (kind === 'save') savedSnapshot.current = null;
   }
  }
  catch { if (scopeRef.current === scope && scope.alive) setError(true); }
  finally { if (scopeRef.current === scope && scope.alive) { scope.busy = false; setBusy(false); setWorking(null); } }
 }
 // What the foreground re-read below reads at the moment the app comes back; never a value captured at focus.
 const latest = useRef({ snapshot: null as Snapshot | null, busy: false, dirty: false });
 useFocusEffect(useCallback(() => {
  const scope: Scope = { accountId, accountRevision, alive: true, busy: false, generation: 0,
   foreground: AppState.currentState !== 'background' && AppState.currentState !== 'inactive' };
  scopeRef.current = scope; pendingWrite.current = null; savedSnapshot.current = null;
  setView(null); setDraft(null); setError(false); setValidation(null); setBusy(false); setWorking(null);
  if (accountId) void run(scope, generation => read(scope, generation, false));
  // Back from the phone's own settings, where the person may just have allowed notifications: read the state again, but
  // only when that read can change something shown (a denial or a missing permission) and never over unsaved changes,
  // because a read replaces the draft with what the server holds.
  const foreground = AppState.addEventListener('change', next => {
   scope.foreground = next === 'active';
   // A consent dialog can temporarily take foreground on either OS. Its result
   // waits for active again; ordinary background network work is retired.
   if (next === 'background' && !scope.permissionPending) { scope.cancelPending?.(); return; }
   if (next === 'active') scope.resumePermission?.();
   const now = latest.current;
   // `scope.busy` as well as the rendered value: a command that started after the last render is already at work.
   if (next !== 'active' || scopeRef.current !== scope || scope.busy || !now.snapshot || now.busy || now.dirty
    || (now.snapshot.native.kind !== 'DENIED' && now.snapshot.native.kind !== 'PERMISSION_REQUIRED')) return;
   void run(scope, generation => read(scope, generation, false), 'read');
  });
  return () => { foreground?.remove(); scope.alive = false; scope.generation++; scope.cancelPending?.(); if (scopeRef.current === scope) scopeRef.current = null; };
 // eslint-disable-next-line react-hooks/exhaustive-deps
 }, [accountId, accountRevision]));
 const owner = scopeRef.current;
 const renderedGeneration = owner?.generation;
 const snapshot = owner && owner.accountId === accountId && owner.accountRevision === accountRevision && view?.owner === owner ? view.snapshot : null;
 const settings = owner && draft?.owner === owner ? draft.settings : null;
 function refresh() { const scope = scopeRef.current; if (scope) void run(scope, generation => read(scope, generation, false), 'read'); }
 function enable() {
  const scope = scopeRef.current; if (!scope || !snapshot || view?.owner !== scope || scope.busy || scope.generation !== renderedGeneration) return;
  void run(scope, async (generation, permissionWait) => {
   const fresh = await read(scope, generation, true, permissionWait);
   if (fresh.native.kind !== 'READY' || !fresh.device) return fresh;
   const registered = await pushDeviceClientService.set(scope, fresh.native.token, fresh.native.platform, true, fresh.device.revision);
   if (!current(scope, generation) || !registered.ok) throw Error('REGISTRATION_UNCONFIRMED');
   // A partially acknowledged two-role switch is resumed only after readback, never by registering again.
   pendingWrite.current = { owner: scope, original: fresh.preferences,
    roles: ROLES.filter(role => !fresh.preferences[role].settings.push_enabled),
    wanted: {
     REQUESTER: { ...fresh.preferences.REQUESTER.settings, push_enabled: true },
     WORKER: { ...fresh.preferences.WORKER.settings, push_enabled: true },
    } };
   // Switching on is the one consent of the account: both sets send to the phone, each written with its own revision.
   for (const role of ROLES) {
    const held = fresh.preferences[role];
    if (held.settings.push_enabled) continue;
    if (!current(scope, generation)) throw Error('STALE');
    await notificationPreferencesClientService.save(scope.accountId, role, { ...held.settings, push_enabled: true }, held.revision);
   }
   if (!current(scope, generation)) throw Error('STALE');
   return read(scope, generation, false);
  }, 'enable');
 }
 function disable() {
  const scope = scopeRef.current; if (!scope || !snapshot || view?.owner !== scope || scope.busy || scope.generation !== renderedGeneration) return;
  const original = snapshot.preferences;
  void run(scope, async generation => {
   pendingWrite.current = { owner: scope, original,
    roles: ROLES.filter(role => original[role].settings.push_enabled),
    wanted: {
     REQUESTER: { ...original.REQUESTER.settings, push_enabled: false },
     WORKER: { ...original.WORKER.settings, push_enabled: false },
    } };
   for (const role of ROLES) {
    if (!original[role].settings.push_enabled) continue;
    await notificationPreferencesClientService.save(scope.accountId, role, { ...original[role].settings, push_enabled: false }, original[role].revision);
    if (!current(scope, generation)) throw Error('STALE');
   }
   return read(scope, generation, false);
  }, 'disable');
 }
 const edit: Edit = (role, key, value) => {
  const scope = scopeRef.current;
  if (!scope || !settings || draft?.owner !== scope || scope.busy || scope.generation !== renderedGeneration || !snapshot || view?.owner !== scope) return;
  // On what the draft holds NOW, not on the render this call came from: a choice that stands for several categories changes them one
  // after the other, and each change must keep the ones before it.
  setValidation(null);
  setDraft(held => held && held.owner === scope ? { owner: scope, settings: editSettings(held.settings, role, key, value) } : held);
 };
 function saveSettings() {
  const scope = scopeRef.current;
  if (!scope || !snapshot || view?.owner !== scope || !settings || draft?.owner !== scope || scope.busy || scope.generation !== renderedGeneration) return;
  const changed = ROLES.filter(role => !sameSettings(snapshot.preferences[role].settings, settings[role]));
  for (const role of changed) { const problem = validateDraft(settings[role]); if (problem) { setValidation(problem); return; } }
  const original = snapshot.preferences; const payload: Roles<NotificationSettings> = { REQUESTER: cloneSettings(settings.REQUESTER), WORKER: cloneSettings(settings.WORKER) };
  void run(scope, async generation => {
   // Retain only this account/revision's explicit intention; never replay it on an unknown result.
   pendingWrite.current = { owner: scope, original, wanted: payload, roles: changed };
   // Only the set that changed is written, each against the revision it was read at; the first that fails leaves the others as they were,
   // and the read-back (the "Pokušaj ponovo" of an unconfirmed outcome) shows which of them the server holds.
   for (const role of changed) {
    await notificationPreferencesClientService.save(scope.accountId, role, payload[role], original[role].revision);
    if (!current(scope, generation)) throw Error('STALE');
   }
   return read(scope, generation, false);
  }, 'save');
 }
 const push = snapshot ? pushScope({ REQUESTER: snapshot.preferences.REQUESTER.settings, WORKER: snapshot.preferences.WORKER.settings }) : null;
 const registered = snapshot?.native.kind === 'READY' && snapshot.device?.active && snapshot.device.sessionBound;
 const dirty = !!snapshot && !!settings && ROLES.some(role => !sameSettings(snapshot.preferences[role].settings, settings[role]));
 latest.current = { snapshot, busy, dirty };
 // While "Sačuvaj podešavanja" runs the changes are on their way, so Back must not offer to throw them away. After an
 // unconfirmed outcome it is not known whether they were saved, so Back must not say they were not: until "Pokušaj
 // ponovo" reads the state again, every control is locked and nothing on screen is a draft worth keeping.
 const unsaved = dirty && !busy && !error;
 useEffect(() => { onDirtyChange?.(unsaved); }, [unsaved, onDirtyChange]);
 const writing = busy && (working === 'save' || working === 'enable' || working === 'disable');
 useEffect(() => { onWritingChange?.(writing); }, [writing, onWritingChange]);
 // An unconfirmed outcome used to remove the controls by wiping the whole body. Keeping them on
 // screen must not make them usable: until the state is read back, everything here is locked.
 const locked = busy || error;
 const change: Edit = (role, key, value) => { savedSnapshot.current = null; edit(role, key, value); };
 return <PushPreferencesView signedIn={!!accountId}
  data={snapshot && settings && push ? { settings, native: snapshot.native.kind, push, registered: !!registered, readiness: snapshot.readiness } : null}
  busy={busy} error={error} locked={locked} dirty={dirty} validation={validation} working={busy ? working : null}
  justSaved={!!snapshot && snapshot === savedSnapshot.current && !dirty && !busy}
  onEdit={change} onSave={saveSettings} onEnable={enable} onDisable={disable} onRefresh={refresh} />;
}

/**
 * R33 (UI/UX pass, 2026-10-08): six categories were named for the engine ("Izvršenje i završetak", "Oporavak"). A person chooses among
 * THREE things, and the categories stay under "Napredno" for the one who wants each of them. The server already keeps the categories; a
 * choice is a view over them. It is ON when every category it stands for is on, OFF when none is, and "mixed" when they differ (it
 * then reads as off and says that the details are under "Napredno"); a touch sets all of its categories to the same value.
 * - "Novi zadaci": a task that may suit you (only the set that receives them: the REQUESTER set has no such choice, that event is
 *   sent to WORKER only).
 * - "Prijave i poruke": applications and answers, the Dogovor and its messages, and the completion of a task (what goes on in your work).
 * - "Ostalo": unfinished actions to check, and the account and its safety.
 */
export type NotificationChoice = 'tasks' | 'talk' | 'other';
export const CHOICE_CATEGORIES: Record<NotificationChoice, readonly (keyof NotificationSettings)[]> = {
 tasks: ['opportunities_enabled'],
 talk: ['responses_enabled', 'dogovor_enabled', 'execution_enabled'],
 other: ['recovery_enabled', 'account_enabled'],
};
/** `on` when every category of the choice is on, `off` when none is, `mixed` when they differ. */
export function choiceState(settings: NotificationSettings, choice: NotificationChoice): 'on' | 'off' | 'mixed' {
 const values = CHOICE_CATEGORIES[choice].map(key => settings[key] === true);
 return values.every(Boolean) ? 'on' : values.some(Boolean) ? 'mixed' : 'off';
}
const CHOICES: readonly NotificationChoice[] = ['tasks', 'talk', 'other'];
const CHOICE_LABEL: Record<NotificationChoice, string> = { tasks: 'Novi zadaci', talk: 'Prijave i poruke', other: 'Ostalo' };
/** The two sets by what the person is doing in them, as the approved blueprint names them (P4), and as a screen reader hears them after a label. */
const SECTION: Record<NotificationRole, string> = { REQUESTER: 'Kad objavljuješ', WORKER: 'Kad uskačeš' };
const SPOKEN: Record<NotificationRole, string> = { REQUESTER: 'kad objavljuješ', WORKER: 'kad uskačeš' };
/** The categories one by one, under "Napredno", for each set. "Novi zadaci" is the one category of its choice and is not drawn twice. */
const CATEGORIES: readonly { key: keyof NotificationSettings; label: string }[] = [
 { key: 'responses_enabled', label: 'Prijave i odgovori' }, { key: 'dogovor_enabled', label: 'Dogovor i poruke' },
 { key: 'execution_enabled', label: 'Završetak zadatka' }, { key: 'recovery_enabled', label: 'Nedovršeno' }, { key: 'account_enabled', label: 'Nalog i ostalo' },
];
/** The one sentence of the screen: what a switch off means for the whole of it. It stands at the bottom, after everything it is about. */
export const SWITCHED_OFF = 'Ono što isključiš ne stiže ni u aplikaciju ni na telefon.';
const PRIVACY = 'Na zaključanom ekranu prikazujemo samo da imaš novo obaveštenje. Poruke i privatne lokacije ostaju u aplikaciji.';
const SAVE_FIRST = 'Prvo sačuvaj izmene.';
const CHECK_FIRST = 'Prvo pokušaj ponovo.';
/** Said once a save has been read back, in place of the reason the grey button otherwise gives. */
const SAVED = 'Podešavanja su sačuvana.';

export type PushPreferencesViewProps = {
 signedIn: boolean;
 /** What was read back, with the draft in place of the saved settings (both sets); null before the first read has landed. */
 data: { settings: Roles<NotificationSettings>; native: NativePushState['kind']; push: PushScope; registered: boolean; readiness: PushReadiness | null } | null;
 busy: boolean; error: boolean; locked: boolean; dirty: boolean; validation: string | null; working: Working; justSaved: boolean;
 /** One setting of one set, or of both ('ALL', for what is the account's: the app's own list, the quiet hours). */
 onEdit: Edit;
 onSave: () => void; onEnable: () => void; onDisable: () => void; onRefresh: () => void;
 /** The phone's own settings; the route passes nothing and the system page opens. */ onOpenSystemSettings?: () => void | Promise<void>;
 /** The phone's zone; read from the device when left out (fixed by the gallery). */ deviceZone?: string | null;
};

/**
 * The notification settings, drawn from what the container read. In the order the approved blueprint gives (P4): "Ovaj telefon" (its
 * state in one row and the one step that connects it), "Kad objavljuješ" and "Kad uskačeš" (each set's three choices), "Tihi sati"
 * (the account's, with the explanation one tap away), "Napredno" (the app's own list, every category one by one, and the facts of the
 * phone and of the last sending check), and the one sentence under it all. "Sačuvaj podešavanja" sits in the footer, so a change at the
 * top does not need a scroll to be saved; the phone's own actions are white and never compete with it.
 */
export function PushPreferencesView({ signedIn, data, busy, error, locked, dirty, validation, working, justSaved,
 onEdit, onSave, onEnable, onDisable, onRefresh, onOpenSystemSettings, deviceZone: fixedZone }: PushPreferencesViewProps) {
 const { stacked } = useLayoutClass();
 if (!signedIn) return <View style={styles.fill}><ScrollView contentContainerStyle={styles.content}>
  <StateView kind="error" title="Prijavi se da urediš obaveštenja." />
 </ScrollView></View>;
 if (!data) return <View style={styles.fill}><ScrollView contentContainerStyle={styles.content}>
  {error ? <StateView kind="error" title="Podešavanja nisu učitana" body="Ne možemo da učitamo podešavanja. Pokušaj ponovo."
   primary={{ label: 'Pokušaj ponovo', onPress: onRefresh, disabled: busy }} />
   : <NotificationLoading label="Učitavamo podešavanja obaveštenja…" />}
 </ScrollView></View>;
 const { settings, native, push, registered, readiness } = data;
 const quiet = sharedQuiet(settings);
 const inApp = sharedFlag(settings, 'in_app_enabled');
 const zone = fixedZone === undefined ? deviceZone() : fixedZone;
 const phone = phoneStatus(native, push, registered);
 const enabled = push.state !== 'none';
 // Keep the same capability-scoped commands; presentation below gives the next step priority.
 const phoneActions: { label: string; kind: 'secondary' | 'quiet'; onPress: () => void; working?: Working; guarded: boolean }[] = [];
 // A device that cannot receive notifications at all (the emulator) or a build without them has no phone action: next to
 // "Nije dostupno na ovom uređaju" a switch-off button contradicted the headline.
 const deviceKnowsPush = native !== 'UNSUPPORTED' && native !== 'UNCONFIGURED';
 const deviceCanAsk = deviceKnowsPush && native !== 'DENIED';
 // A saved ON preference or a connected phone is not proof that delivery is operational.
 // Keep an adverse/unknown sending state visible where it affects an enabled phone; the full last-check receipt stays below.
 const deliveryNotice = enabled && deviceKnowsPush
  ? readiness?.state === 'NOT_READY' ? 'Slanje na telefon trenutno nije uključeno.'
   : readiness?.state === 'DEGRADED' ? 'Pri poslednjoj proveri slanja zabeležene su poteškoće.'
    : readiness?.state === 'OPERATIONAL' ? null : 'Stanje slanja na telefon još nije potvrđeno.'
  : null;
 // Sending is already on for both sets and only this phone is missing: the step is to connect it, not to switch on.
 if (deviceCanAsk && (!registered || push.state !== 'all')) phoneActions.push({ label: push.state === 'all' ? 'Poveži ovaj telefon' : 'Uključi obaveštenja na telefonu',
  kind: 'secondary', onPress: onEnable, working: 'enable', guarded: true });
 if (enabled && deviceKnowsPush) phoneActions.push({ label: 'Isključi obaveštenja na telefonu', kind: 'quiet', onPress: onDisable, working: 'disable', guarded: true });
 // Reading again is offered only where it can change something, and not beside "Pokušaj ponovo", which already does it.
 if (deviceKnowsPush && !error) phoneActions.push({ label: 'Osveži', kind: 'quiet', onPress: onRefresh, working: 'read', guarded: true });
 // A denied permission already has its immediate SystemSettingsAction. Otherwise connect/enable leads,
 // or the connected phone can be switched off directly. Refresh and the remaining command stay nearby.
 const primaryPhoneAction = native === 'DENIED' ? null : phoneActions.find(action => action.working !== 'read') ?? null;
 const secondaryPhoneActions = phoneActions.filter(action => action !== primaryPhoneAction);
 // While the state is unconfirmed the alert and "Pokušaj ponovo" stand directly above the phone buttons, and Save says
 // "Prvo pokušaj ponovo." already; a second copy here was spoken twice in a row.
 const waitReason = dirty && !error ? SAVE_FIRST : null;
 const showZone = quiet.quiet_timezone !== zone && (quiet.quiet_hours_enabled || !quiet.quiet_timezone.trim());
 // Reading clean settings needs no disabled action blocking the choices. Preserve the footer throughout a save,
 // uncertain readback and validation; a phone-only refresh never announces an irrelevant Save state.
 const showSave = dirty || working === 'save' || !!validation || error || justSaved;
 const saveReason = error ? CHECK_FIRST : null;
 const urgent = urgentBuilt();
 const quietLines = ['Bez obaveštenja na telefon u ovom periodu. Period može da prelazi preko ponoći.',
  ...(urgent ? ['Hitni događaji mogu da prođu i tada, ali samo kada je to posebno uključeno.'] : [])];
 return <View style={styles.fill}>
  <SavedAnnouncement justSaved={justSaved} />
  <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={[styles.content, showSave && styles.contentAboveFoot]}>
   {busy && working !== 'save' ? <View style={styles.checking}>
    <ActivityIndicator size="small" accessibilityLabel="Provera obaveštenja na telefonu" color={sys.color.green} />
    <T variant="note" tone="muted">Proveravamo stanje…</T>
   </View> : null}
   {error ? <View style={styles.block} accessibilityLiveRegion="polite">
    <T tone="danger" accessibilityRole="alert">Ne možemo da učitamo podešavanja. Pokušaj ponovo.</T>
    <V2Action label="Pokušaj ponovo" kind="secondary" onPress={onRefresh} disabled={busy} />
   </View> : null}

   <Section title="Ovaj telefon">
    <View style={styles.block}>
     {error ? <T variant="meta" tone="muted">Poslednje potvrđeno stanje</T> : null}
     <View style={styles.phoneStatus}>
      <FactArt kind="phone" size={24} cut="art" tone="quiet" />
      <View style={styles.phoneCopy}>
       <T accessibilityRole="header" style={styles.phoneTitle}>{phone.title}</T>
       {deliveryNotice ? <T variant="copy" tone="muted">{deliveryNotice}</T> : null}
      </View>
     </View>
     {native === 'DENIED' ? <SystemSettingsAction open={onOpenSystemSettings} /> : null}
     {primaryPhoneAction ? <V2Action label={primaryPhoneAction.label} kind={primaryPhoneAction.kind} onPress={primaryPhoneAction.onPress}
      compact={primaryPhoneAction.kind === 'quiet'} tone="neutral" style={primaryPhoneAction.kind === 'quiet' ? styles.phoneQuiet : styles.phoneConnect}
      loading={!!primaryPhoneAction.working && working === primaryPhoneAction.working}
      disabled={primaryPhoneAction.guarded ? locked || dirty : false} reason={waitReason} /> : null}
     {/* A closed disclosure must never hide why its commands are waiting. The error recovery above is always visible. */}
     {!primaryPhoneAction && secondaryPhoneActions.length > 0 && waitReason ? <T variant="note" tone="muted">{waitReason}</T> : null}
     {secondaryPhoneActions.length > 0 ? <Disclosure label="Upravljanje telefonom">
      <View style={styles.phoneActions}>
       {secondaryPhoneActions.map(action => <V2Action key={action.label} label={action.label} kind={action.kind} onPress={action.onPress}
        compact tone="neutral" style={styles.phoneQuiet}
        loading={!!action.working && working === action.working} disabled={action.guarded ? locked || dirty : false}
        reason={action.guarded ? null : undefined} />)}
      </View>
     </Disclosure> : null}
    </View>
   </Section>

   {/* While a command runs the choices stay readable and visibly wait: every locked row draws its words in muted ink, so
       the block is not faded a second time on top of that. The phone's state and the footer are not touched. Each set has the choices
       it can have: the one who publishes is never told of new tasks (that event is sent to the set that applies only). */}
   {ROLES.map(role => <SettingsGroup key={role} title={SECTION[role]}>
    {CHOICES.filter(choice => choice !== 'tasks' || role === 'WORKER').map((choice, index, shown) => {
     const state = choiceState(settings[role], choice);
     return <NoticeSwitchRow key={choice} label={CHOICE_LABEL[choice]} spoken={`${CHOICE_LABEL[choice]}, ${SPOKEN[role]}`} value={state === 'on'}
      mixed={state === 'mixed'} disabled={locked} last={index === shown.length - 1}
      onChange={value => CHOICE_CATEGORIES[choice].forEach(key => onEdit(role, key, value))} />;
    })}
   </SettingsGroup>)}

   {/* The quiet hours are the account's, not a set's. The title carries the one explanation, one tap away (ⓘ). */}
   <View>
    <View style={styles.titleLine}>
     <T variant="heading" accessibilityRole="header" style={styles.titleText}>Tihi sati</T>
     <InfoButton title="Tihi sati" lines={quietLines} />
    </View>
    <NoticeSwitchRow label="Uključi tihe sate" value={quiet.quiet_hours_enabled} disabled={locked}
     onChange={value => onEdit('ALL', 'quiet_hours_enabled', value)} last={!quiet.quiet_hours_enabled && !showZone} />
    {quiet.quiet_hours_enabled ? <View style={[styles.times, stacked && styles.timesStacked]}>
     <View style={styles.time}><CivilField label="Početak tihih sati" mode="time" value={quiet.quiet_start ?? ''} disabled={locked}
      onChange={value => onEdit('ALL', 'quiet_start', value || null)} /></View>
     <View style={styles.time}><CivilField label="Kraj tihih sati" mode="time" value={quiet.quiet_end ?? ''} disabled={locked}
      onChange={value => onEdit('ALL', 'quiet_end', value || null)} /></View>
    </View> : null}
    {/* A text box asking a person to type an IANA identifier by hand, where one typo silently moves their quiet hours,
        is gone. The device knows its zone; the stored value is shown only when it is not the phone's own. */}
    {showZone ? <View style={quiet.quiet_hours_enabled ? styles.zone : undefined}>
     <SettingsInfo title="Vremenska zona tihih sati" last>{quiet.quiet_timezone.trim() ? zoneLabel(quiet.quiet_timezone) : 'Nije izabrana.'}</SettingsInfo>
     {zone ? <V2Action label={`Koristi zonu telefona (${zoneLabel(zone)})`} kind="quiet" compact disabled={locked}
      onPress={() => onEdit('ALL', 'quiet_timezone', zone)} style={styles.inline} /> : null}
    </View> : null}
    {quiet.quiet_hours_enabled && urgent ? <NoticeSwitchRow label="Hitno može i tokom tihih sati" value={quiet.urgent_overrides_quiet_hours} disabled={locked}
     onChange={value => onEdit('ALL', 'urgent_overrides_quiet_hours', value)} last /> : null}
   </View>

   {/* "Napredno" holds what a person who wants every detail reaches for: the app's own list, each category of each set one by one (a
       choice above is a view over these, so they change together), and the facts of the phone and of the last sending check. */}
   <Disclosure label="Napredno">
    <View style={styles.advanced}>
     <NoticeSwitchRow label="Obaveštenja u aplikaciji" value={inApp === 'on'} mixed={inApp === 'mixed'} disabled={locked}
      onChange={value => onEdit('ALL', 'in_app_enabled', value)} last />
     {ROLES.map(role => <SettingsGroup key={role} title={`${SECTION[role]} · pojedinačno`}>
      {CATEGORIES.map(({ key, label }, index) => <NoticeSwitchRow key={key} label={label} spoken={`${label}, ${SPOKEN[role]}`} value={settings[role][key] === true}
       disabled={locked} last={index === CATEGORIES.length - 1} onChange={value => onEdit(role, key, value)} />)}
     </SettingsGroup>)}
     <SettingsGroup title="Telefon i slanje">
      <T variant="note" tone="muted">{phone.body}</T>
      <View style={styles.block}>
       <T variant="bodyStrong" style={styles.ink} accessibilityRole="header">Privatnost</T>
       <T variant="note" tone="muted">{PRIVACY}</T>
      </View>
      <View style={styles.readiness}>
       <T variant="bodyStrong" style={styles.ink} accessibilityRole="header">Poslednja provera slanja</T>
       <T variant="note" tone="muted">{readiness?.state === 'OPERATIONAL' ? 'Slanje obaveštenja je radilo pri poslednjoj proveri.'
        : readiness?.state === 'DEGRADED' ? 'Zabeležene su poteškoće ili kašnjenje u slanju.'
         : readiness?.state === 'NOT_READY' ? 'Slanje iz aplikacije trenutno nije uključeno, čak i ako je telefon povezan.'
          : 'Ne znamo da li slanje obaveštenja radi.'}</T>
       {readiness ? <T variant="meta" tone="muted">Provereno: {vreme(readiness.checkedAt)}</T> : null}
       <T variant="meta" tone="muted">Ova provera ne potvrđuje da je obaveštenje stiglo na Vaš telefon.</T>
      </View>
     </SettingsGroup>
    </View>
   </Disclosure>

   <T variant="note" tone="muted">{SWITCHED_OFF}</T>
  </ScrollView>
  {showSave ? <SettingsFooter>
   {validation ? <T variant="note" tone="danger" accessibilityRole="alert">{validation}</T> : null}
   {/* The confirmed save is said in words (in the success colour, once to a screen reader), not only by a check that
       leaves after a moment on a button that turns grey again. */}
   {justSaved ? <T variant="note" tone="success" accessibilityLiveRegion="polite">{SAVED}</T> : null}
   <V2Action label="Sačuvaj podešavanja" onPress={onSave} disabled={locked || !dirty} loading={working === 'save'}
    success={justSaved} reason={saveReason} style={brandAction} />
  </SettingsFooter> : null}
 </View>;
}

/**
 * What the phone can do, in one headline and one sentence: the device first, then the account's choice. The headline never claims
 * what this phone does not do: a phone that is not connected says so first, and the choice follows. A phone that is sent the
 * notifications of one set only says which.
 */
function phoneStatus(native: NativePushState['kind'], push: PushScope, registered: boolean): { title: string; body: string } {
 // The account's choice is said with the buttons' own noun ("obaveštenja na telefon"). "Slanje" belongs to the send check
 // below the phone state, which can say sending is not on while the choice is.
 const choice = push.state === 'all' ? 'Obaveštenja na telefon su uključena.' : push.state === 'none' ? 'Obaveštenja na telefon su isključena.'
  : `Obaveštenja na telefon su uključena samo za „${SECTION[push.on]}“.`;
 // A saved preference is not evidence that another phone received a notification.
 const onElsewhere = push.state !== 'none' ? ` ${choice}` : '';
 if (native === 'UNSUPPORTED') return { title: 'Nije dostupno na ovom uređaju', body: `Ovde ne možete da uključite obaveštenja na telefonu. Podešavanja u aplikaciji i dalje možete da uređujete.${onElsewhere}` };
 if (native === 'UNCONFIGURED') return { title: 'Povezivanje trenutno nije dostupno', body: `Ova verzija aplikacije trenutno ne može da poveže telefon za obaveštenja.${onElsewhere}` };
 if (native === 'DENIED') return { title: 'Telefon ne dozvoljava obaveštenja', body: `Dozvolite obaveštenja u podešavanjima telefona.${onElsewhere}` };
 if (native === 'PERMISSION_REQUIRED') return { title: 'Potrebna je dozvola telefona',
  body: `Dugme ispod traži dozvolu za obaveštenja i povezuje ovaj telefon. ${choice}` };
 if (!registered) return { title: 'Ovaj telefon još nije povezan', body: `Dozvola telefona je data. ${choice}` };
 const only = push.state === 'some' ? ` Obaveštenja stižu samo za „${SECTION[push.on]}“.` : '';
 return { title: push.state === 'all' ? 'Obaveštenja su uključena' : push.state === 'none' ? 'Obaveštenja su isključena' : 'Obaveštenja su delimično uključena',
  body: `Ovaj telefon je povezan sa Vašim nalogom.${only} Stanje slanja je prikazano ispod.` };
}

/** iOS ignores `accessibilityLiveRegion`, so there the saved line is also said once, when it appears. */
function SavedAnnouncement({ justSaved }: { justSaved: boolean }) {
 useEffect(() => { if (justSaved && Platform.OS === 'ios') AccessibilityInfo.announceForAccessibility(SAVED); }, [justSaved]);
 return null;
}

const deviceZone = (): string | null => {
 try { return Intl.DateTimeFormat().resolvedOptions().timeZone || null; } catch { return null; }
};
/** The city, not the database identifier. */
// Serbian time is named the way the rest of the app names it; any other zone keeps its city.
const zoneLabel = (zone: string): string => zone === 'Europe/Belgrade' ? 'Vreme u Srbiji' : zone.split('/').pop()?.replace(/_/g, ' ') ?? zone;

const styles = StyleSheet.create({
 fill: { flex: 1, backgroundColor: sys.color.surface },
 // The edge of every screen, the first block 8 under the bar, 24 between blocks, 32 under the last (24 above the foot).
 content: { paddingHorizontal: layout.gutter, paddingTop: sys.space.sm, paddingBottom: layout.zone, gap: layout.section, flexGrow: 1 },
 contentAboveFoot: { paddingBottom: layout.section },
 block: { gap: sys.space.sm },
 // What "Napredno" holds stands in parts 24 apart, like the parts of the screen: the app's own list, each set's categories, the facts.
 advanced: { gap: layout.section },
 ink: { color: sys.color.ink },
 phoneStatus: { flexDirection: 'row', alignItems: 'flex-start', gap: sys.space.md, paddingVertical: sys.space.xs },
 phoneCopy: { flex: 1, minWidth: 0, gap: sys.space.xs },
 phoneActions: { gap: sys.space.xs },
 phoneQuiet: { alignSelf: 'flex-start', maxWidth: '100%', paddingHorizontal: 0 },
 phoneConnect: { width: '100%' },
 phoneTitle: { ...sys.type.bodyStrong, fontWeight: '500', color: sys.color.ink },
 checking: { flexDirection: 'row', alignItems: 'center', gap: sys.space.sm },
 // The title of "Tihi sati" is a section title (24 high, 12 above what it holds) with the explanation's mark at the end of its line.
 titleLine: { flexDirection: 'row', alignItems: 'center', gap: sys.space.sm, marginBottom: layout.group },
 titleText: { flexShrink: 1, color: sys.color.ink },
 times: { flexDirection: 'row', gap: sys.space.md, paddingVertical: sys.space.md, borderBottomWidth: ruleWidth, borderBottomColor: sys.color.line },
 timesStacked: { flexDirection: 'column' },
 time: { flex: 1, minWidth: 0 },
 // The zone sits between the times and the last switch, so it keeps the rows' hairline under it.
 zone: { borderBottomWidth: ruleWidth, borderBottomColor: sys.color.line, paddingBottom: sys.space.xs },
 inline: { paddingHorizontal: 0, alignSelf: 'flex-start' },
 readiness: { gap: sys.space.xs, paddingTop: sys.space.md },
});

async function readTransport(): Promise<PushReadiness | null> {
 let timer: ReturnType<typeof setTimeout> | undefined;
 try {
  return await Promise.race([
   pushReadinessClientService.read().then(result => result.ok ? result.podatak : null).catch(() => null),
   new Promise<null>(resolve => { timer = setTimeout(() => resolve(null), 5000); }),
  ]);
 } catch { return null; }
 finally { if (timer !== undefined) clearTimeout(timer); }
}
