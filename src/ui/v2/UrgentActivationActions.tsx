import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, StyleSheet, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from 'expo-router';
import type { PotrebaProjekcija } from '../../contracts/projections';
import { urgentActivationClientService as api, urgentActivationRefused, urgentReasonText, sameUrgentTerms } from '../../data/urgentActivationClientService';
import type { UrgentPreview } from '../../data/urgentActivationPreviewClientService';
import { positiveInteger, record, timestamp, uuid } from '../../data/serverReceipt';
import { dogovorenoVreme } from '../../lib/dogovorenoVreme';
import { urgentBuilt } from '../../lib/needUrgency';
import { noviZahtevId } from '../../lib/idempotencija';
import { sesijaSada, useSesija } from '../../store/sesija';
import { useConfirmSheet } from '../system/ConfirmSheet';
import type { SheetAction } from '../system/ActionSheet';
import { sys } from '../system/tokens';
import { T } from '../Text';
import { V2Action } from './V2Action';

type Phase = 'idle' | 'loading' | 'review' | 'sending' | 'unknown' | 'confirmed' | 'refused' | 'error';
type ViewState = { phase: Phase; message: string; journal: boolean };
type Journal = { v: 1; needId: string; revision: number; commandId?: string; phase: 'pending' | 'confirmed' | 'refused'; expiresAt?: string };
// Serialize storage across retired/current hook instances. A late receipt may only
// update its own command; it must never replace or delete a newer journal.
const storageQueues = new Map<string, Promise<void>>();
function serialized<T>(key: string, work: () => Promise<T>): Promise<T> {
  const next = (storageQueues.get(key) ?? Promise.resolve()).then(work);
  const tail = next.then(() => undefined, () => undefined);
  storageQueues.set(key, tail);
  void tail.then(() => { if (storageQueues.get(key) === tail) storageQueues.delete(key); });
  return next;
}
const sameCommand = (a: Journal, b: Journal) => a.needId === b.needId && a.revision === b.revision
  && a.commandId === b.commandId;
function replaceJournal(key: string, expected: Journal, next: Journal | null): Promise<boolean> {
  return serialized(key, async () => {
    const raw = await AsyncStorage.getItem(key);
    const saved = raw === null ? null : parseJournal(raw, expected.needId);
    if (!saved || !sameCommand(saved, expected) || saved.phase !== expected.phase) return false;
    if (next) await AsyncStorage.setItem(key, JSON.stringify(next));
    else await AsyncStorage.removeItem(key);
    return true;
  });
}
const EMPTY: ViewState = { phase: 'idle', message: '', journal: false };
const UNKNOWN = 'Ishod uključivanja nije potvrđen. Proveri trenutno stanje pre nove radnje.';
const activeNow = (value: { level: string; expiresAt: string | null }) =>
  value.level === 'HITNO' && value.expiresAt !== null && Date.parse(value.expiresAt) > Date.now();
function parseJournal(raw: string, needId: string): Journal | null {
  const value = record(JSON.parse(raw));
  if (!value || value.v !== 1 || value.needId !== needId || !positiveInteger(value.revision)
      || (value.commandId !== undefined && (typeof value.commandId !== 'string' || value.commandId.length < 8))
      || !['pending', 'confirmed', 'refused'].includes(String(value.phase))
      || (value.phase === 'confirmed' && !timestamp(value.expiresAt))) return null;
  return value as Journal;
}
const expiryText = (value: string) => dogovorenoVreme(value, 'Rok trenutno nije dostupan');
type Props = {
  needId: string; need: PotrebaProjekcija | null; disabled: boolean;
  onActiveChange: (active: boolean) => void; onRefresh: () => void;
};

/**
 * Mount this hook in OwnedNeed, outside NeedPresentation's revision key.
 * The UI may remount; the scope and persistent uncertainty must survive it.
 * No client-side enable flag: the server preview owns the policy-off refusal.
 * No automatic activation/retry. fn_need_urgency proves present state only.
 */
export function useUrgentActivationActions(props: Props) {
  const { user, accountRevision } = useSesija();
  const accountId = user?.id ?? '', needId = props.needId;
  const account = { accountId, accountRevision };
  const storageKey = `uskoci:urgent-activation:v1:${accountId}:${needId}`;
  const [view, setView] = useState<ViewState>(EMPTY), [reload, setReload] = useState(0);
  const currentView = useRef(view); currentView.current = view;
  const latest = useRef(props); latest.current = props;
  const scope = useRef<object | null>(null), running = useRef(false);
  const journal = useRef<Journal | null>(null);
  const { ask, close, sheet } = useConfirmSheet();
  const current = (owner: object | null) => owner !== null && scope.current === owner
    && !['background', 'inactive'].includes(AppState.currentState)
    && sesijaSada().user?.id === accountId && sesijaSada().accountRevision === accountRevision;
  const show = (owner: object, next: ViewState) => {
    if (current(owner)) { currentView.current = next; setView(next); }
  };
  const reconcile = async (owner: object) => {
    const raw = await serialized(storageKey, () => AsyncStorage.getItem(storageKey));
    const command = raw === null ? null : parseJournal(raw, needId);
    if (raw !== null && !command) throw new Error('URGENT_JOURNAL_INVALID');
    if (current(owner)) journal.current = command;
    if (!current(owner) || !command) return;
    if (command.phase === 'refused') {
      show(owner, { phase: 'refused', message: 'Prethodno uključivanje je odbijeno. Osveži zadatak i pregledaj uslove.', journal: true }); return;
    }
    if (command.phase === 'confirmed') {
      show(owner, { phase: 'confirmed', message: Date.parse(command.expiresAt!) > Date.now()
        ? `HITNO je uključen do ${expiryText(command.expiresAt!)}.`
        : 'Prethodno uključivanje HITNO je potvrđeno; njegov rok je istekao.', journal: true }); return;
    }
    show(owner, { phase: 'loading', message: 'Proveravamo prethodno uključivanje…', journal: true });
    const result = await api.read(needId, account);
    if (!current(owner)) return;
    // A write may have returned a real receipt while this projection was loading.
    const latestRaw = await serialized(storageKey, () => AsyncStorage.getItem(storageKey));
    const latestCommand = latestRaw === null ? null : parseJournal(latestRaw, needId);
    if (!current(owner)) return;
    if (!latestCommand || !sameCommand(command, latestCommand) || latestCommand.phase !== 'pending') {
      await reconcile(owner); return;
    }
    if (result.ok && activeNow(result.podatak)) {
      // Present activity does not prove this attempt finished. Keep the journal
      // pending even when active, so neither acknowledgment nor expiry permits replay.
      show(owner, { phase: 'unknown', message: `HITNO je sada uključen do ${expiryText(result.podatak.expiresAt!)}. Ishod prethodnog zahteva nije potvrđen; nećemo ga ponovo slati.`, journal: true });
      latest.current.onRefresh();
    } else {
      // NORMAL never proves an earlier timed-out activation did not commit and expire.
      show(owner, { phase: 'unknown', message: result.ok
        ? 'HITNO sada nije aktivan, ali prethodni zahtev nema potvrđen ishod. Nećemo ga ponovo slati.'
        : UNKNOWN, journal: true });
    }
  };
  useFocusEffect(useCallback(() => {
    const owner = {}; scope.current = owner; running.current = true; journal.current = null;
    let retired = false;
    show(owner, { phase: 'loading', message: '', journal: false });
    void (async () => {
      try {
        if (!accountId || !uuid(needId)) { show(owner, EMPTY); return; }
        const raw = await serialized(storageKey, () => AsyncStorage.getItem(storageKey));
        if (!current(owner)) return;
        if (raw === null) { show(owner, EMPTY); return; }
        const saved = parseJournal(raw, needId);
        if (!saved) throw new Error('URGENT_JOURNAL_INVALID');
        journal.current = saved;
        await reconcile(owner);
      } catch {
        show(owner, { phase: 'error', message: 'Prethodni zahtev nije moguće proveriti. Pokušaj ponovo pre nove radnje.', journal: true });
      } finally { if (current(owner)) running.current = false; }
    })();
    const listener = AppState.addEventListener('change', state => {
      if (state !== 'active') { scope.current = null; close(); }
      else if (!retired) setReload(value => value + 1);
    });
    return () => { retired = true; listener.remove(); if (scope.current === owner) scope.current = null; close(); };
    // Async continuations are owned by this focus, never by render-time callbacks.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accountId, accountRevision, needId, storageKey, reload, close]));

  // Only an open confirmation or write occupies the route's command slot.
  // A retained unknown HITNO attempt blocks another HITNO through journal.current,
  // but must not disable unrelated task navigation, reads or later work forever.
  const active = view.phase === 'review' || view.phase === 'sending';
  useEffect(() => { props.onActiveChange(active); return () => props.onActiveChange(false); }, [active, props.onActiveChange]);

  const eligible = () => {
    const need = latest.current.need;
    return !!need && need.id === needId && positiveInteger(need.revizija) && !latest.current.disabled
      && !['NACRT', 'ZATVORENA', 'POPUNJENA'].includes(need.stanje) && need.pokrivenost.preostalo > 0;
  };
  const submit = async (owner: object, revision: number, reviewed: UrgentPreview) => {
    if (!current(owner) || running.current || journal.current || currentView.current.phase !== 'review'
        || !eligible() || latest.current.need?.revizija !== revision) {
      if (current(owner)) show(owner, { phase: 'refused', message: 'Zadatak je promenjen. Ponovo pregledaj uslove za HITNO.', journal: false });
      return;
    }
    running.current = true;
    show(owner, { phase: 'sending', message: 'Proveravamo uslove i uključujemo HITNO…', journal: false });
    let persisted = false;
    try {
      // Recheck after the human confirms. A changed policy needs another review.
      const checked = await api.preview(needId, account);
      if (!current(owner)) return;
      if (!checked.ok) { show(owner, { phase: 'error', message: checked.poruka, journal: false }); return; }
      if (!checked.podatak.allowed) { show(owner, { phase: 'refused', message: urgentReasonText(checked.podatak.reasonCodes), journal: false }); return; }
      if (checked.podatak.chargesFee || !sameUrgentTerms(reviewed, checked.podatak)) {
        show(owner, { phase: 'refused', message: 'Uslovi su promenjeni. Ponovo otvori pregled za HITNO.', journal: false }); return;
      }
      if (!eligible() || latest.current.need?.revizija !== revision) {
        show(owner, { phase: 'refused', message: 'Zadatak je promenjen. Osveži ga pre uključivanja HITNO.', journal: false }); return;
      }
      const command: Journal = { v: 1, needId, revision, commandId: noviZahtevId('hitno'), phase: 'pending' };
      // Persist BEFORE the first write. No journal = no activation.
      // A rejected storage write may still have persisted; require a reload/read.
      persisted = true;
      await serialized(storageKey, async () => {
        if (await AsyncStorage.getItem(storageKey) !== null) throw new Error('URGENT_JOURNAL_EXISTS');
        await AsyncStorage.setItem(storageKey, JSON.stringify(command));
      });
      if (!current(owner)) {
        // This continuation never sent the RPC; its own reservation can end safely.
        await replaceJournal(storageKey, command, { ...command, phase: 'refused' });
        return;
      }
      journal.current = command;
      show(owner, { phase: 'sending', message: 'Uključujemo HITNO…', journal: true });
      const result = await api.activate(needId, revision, account);
      // Persist an authoritative result even after blur/background. Focus gates
      // rendering only; the original command owns its durable receipt.
      if (result.ok) {
        const done: Journal = { ...command, phase: 'confirmed', expiresAt: result.podatak.expiresAt };
        const saved = await replaceJournal(storageKey, command, done);
        if (!saved || !current(owner)) return;
        journal.current = done;
        show(owner, { phase: 'confirmed', message: `HITNO je uključen do ${expiryText(done.expiresAt!)}.`, journal: true });
        latest.current.onRefresh();
      } else if (urgentActivationRefused(result.kod)) {
        const refused: Journal = { ...command, phase: 'refused' };
        const saved = await replaceJournal(storageKey, command, refused);
        if (!saved || !current(owner)) return;
        journal.current = refused;
        show(owner, { phase: 'refused', message: result.poruka, journal: true });
      } else if (current(owner)) await reconcile(owner);
    } catch {
      show(owner, { phase: persisted ? 'unknown' : 'error', message: persisted ? UNKNOWN
        : 'Zahtev nije poslat. Čuvanje prethodne radnje trenutno nije dostupno.', journal: persisted });
    } finally { if (current(owner)) running.current = false; }
  };
  const open = async () => {
    const owner = scope.current, revision = latest.current.need?.revizija;
    if (!current(owner) || !owner || running.current || journal.current || currentView.current.journal || !eligible() || !revision) return;
    running.current = true;
    show(owner, { phase: 'loading', message: 'Proveravamo dostupnost HITNO…', journal: false });
    try {
      const state = await api.read(needId, account);
      if (!current(owner)) return;
      if (!state.ok) { show(owner, { phase: 'error', message: state.poruka, journal: false }); return; }
      if (activeNow(state.podatak)) {
        show(owner, { phase: 'refused', message: `HITNO je već uključen do ${expiryText(state.podatak.expiresAt!)}.`, journal: false }); return;
      }
      const result = await api.preview(needId, account);
      if (!current(owner)) return;
      if (!result.ok) { show(owner, { phase: 'error', message: result.poruka, journal: false }); return; }
      if (!result.podatak.allowed) {
        show(owner, { phase: 'refused', message: urgentReasonText(result.podatak.reasonCodes), journal: false }); return;
      }
      const preview = result.podatak;
      if (preview.chargesFee) {
        show(owner, { phase: 'refused', message: 'Uključivanje HITNO uz naplatu još nije dostupno u aplikaciji.', journal: false }); return;
      }
      if (!eligible() || latest.current.need?.revizija !== revision || Date.parse(preview.candidateExpiresAt) <= Date.now()) {
        show(owner, { phase: 'refused', message: 'Podaci su promenjeni. Ponovo pregledajte uslove za HITNO.', journal: false }); return;
      }
      show(owner, { phase: 'review', message: '', journal: false });
      ask({ title: 'Uključi HITNO?', confirmLabel: 'Uključi HITNO', cancelLabel: 'Odustani',
        message: `Zadatak dobija oznaku HITNO i potraga se odmah pokreće prema dostupnim majstorima i pomagačima. Oznaka traje najviše ${preview.maxLifetimeMinutes} minuta; trenutna procena isteka je ${expiryText(preview.candidateExpiresAt)}. Rok može biti kraći zbog termina ili roka za prijave. To ne garantuje dolazak izvršioca.`,
        onCancel: () => { if (current(owner) && currentView.current.phase === 'review') show(owner, EMPTY); },
        onConfirm: () => submit(owner, revision, preview),
      });
    } catch { show(owner, { phase: 'error', message: 'Pregled HITNO trenutno nije dostupan. Pokušajte ponovo.', journal: false }); }
    finally { if (current(owner)) running.current = false; }
  };
  const check = async () => {
    const owner = scope.current;
    if (!owner || !current(owner) || running.current) return;
    if (!journal.current) { setReload(value => value + 1); return; }
    running.current = true;
    try { await reconcile(owner); }
    catch { show(owner, { phase: 'unknown', message: UNKNOWN, journal: true }); }
    finally { if (current(owner)) running.current = false; }
  };
  const finish = async () => {
    const owner = scope.current, saved = journal.current;
    if (!owner || !current(owner) || running.current || (saved && saved.phase === 'pending')) return;
    if (currentView.current.journal && !saved) return; // unreadable journal stays fail-closed
    running.current = true;
    try {
      if (saved && !await replaceJournal(storageKey, saved, null)) { setReload(value => value + 1); return; }
      if (!current(owner)) return;
      journal.current = null; show(owner, EMPTY); latest.current.onRefresh();
    } catch { show(owner, { ...currentView.current, message: 'Potvrda je sačuvana. Pokušaj ponovo da nastaviš.' }); }
    finally { if (current(owner)) running.current = false; }
  };
  const entry: SheetAction | null = urgentBuilt() && eligible() ? { key: 'urgent', label: 'HITNO', icon: 'tasks',
    subtitle: 'Pregledaj dostupnost i trajanje.', onPress: () => { void open(); } } : null;
  return { entry, sheet, view, check: () => { void check(); }, finish: () => { void finish(); } };
}

export function UrgentActivationActions({ control }: { control: ReturnType<typeof useUrgentActivationActions> }) {
  const { view } = control;
  if (!view.message) return null;
  const busy = view.phase === 'loading' || view.phase === 'sending';
  const recovery = view.phase === 'unknown' || (view.phase === 'error' && view.journal);
  return <View style={s.feedback}>
    <T variant="note" tone="muted" accessibilityLiveRegion="polite">{view.message}</T>
    {recovery ? <V2Action label="Proveri stanje" compact loading={busy} onPress={control.check} /> : null}
    {!busy && !recovery && view.phase !== 'review'
      ? <V2Action label="U redu" compact onPress={control.finish} /> : null}
  </View>;
}
const s = StyleSheet.create({ feedback: { gap: sys.space.sm, paddingVertical: sys.space.sm } });
