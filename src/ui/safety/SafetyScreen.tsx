import { useCallback, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, TextInput, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router, useFocusEffect } from 'expo-router';
import { safetyClientService, SAFETY_CATEGORIES, type AccountBlockReceipt, type SafetyCategory, type SafetyReportCommand, type SafetyReportReceipt } from '../../data/safetyClientService';
import { safetyTargetNameBuilt } from '../../data/safetyTargetNameGate';
import { uuid } from '../../data/serverReceipt';
import { useOwnedEditor } from '../../hooks/useOwnedEditor';
import { noviUuidZahtevId } from '../../lib/idempotencija';
import { sesijaSada, useSesija } from '../../store/sesija';

import { SettingsText as T, SettingsScreen, SettingsAction, SettingsGroup } from '../settings/SettingsPresentation';
import { Press } from '../Press';
import { withInter } from '../interFont';
import { layout, ruleWidth } from '../system/layout';
import { sys } from '../system/tokens';
import { useConfirmSheet } from '../system/ConfirmSheet';
import { SuccessMark } from '../system/SuccessMark';
import { vreme } from '../../lib/vreme';
import { announceBlockChange } from './blockOutcome';
import { useSafetyTargetName } from './useSafetyTargetName';

const safetyCategoryCopy: Record<SafetyCategory, string> = {
  HARASSMENT: 'Uznemiravanje', FRAUD: 'Prevara', UNSAFE_WORK: 'Nebezbedan rad', DISCRIMINATION: 'Diskriminacija', OTHER: 'Drugo',
};
type Context = { targetAccountId: string; needId: string | null; agreementId: string | null };
const back = () => router.canGoBack() ? router.back() : router.replace('/profil');
const blockConsequence = 'Blokiranje zaustavlja običan kontakt i nova povezivanja. Završetak, otkazivanje i prijava problema u postojećem Dogovoru ostaju dostupni.';
const unblockConsequence = 'Odblokiranje ne vraća ranije dozvole za deljenje kontakta ili tačne lokacije.';

/**
 * `profileId` (EX-07 S06) is the profile the person came from, handed on by the route only in a build compiled with the safety-target-name flag. It is an identifier,
 * never a name: the screen asks the server for the name of that profile (see useSafetyTargetName) and keeps its generic copy when there is none.
 */
export function SafetyScreen({ profileId, ...p }: Context & { profileId?: string }) {
  const { user, accountRevision } = useSesija(), accountId = user?.id;
  const confirmation = useConfirmSheet(), closeConfirmation = confirmation.close;
  const questionGeneration = useRef(0);
  const focusLifetime = useRef({ epoch: 0, active: false });
  const [, redrawQuestion] = useState(0);
  const retireConfirmation = useCallback(() => {
    questionGeneration.current++; closeConfirmation(); redrawQuestion(value => value + 1);
  }, [closeConfirmation]);
  const read = useCallback(() => { retireConfirmation(); return safetyClientService.readBlock(p.targetAccountId); }, [p.targetAccountId, retireConfirmation]);
  const editor = useOwnedEditor(read), blockCommand = useRef<{
    accountId: string; accountRevision: number; targetAccountId: string; revision: number; blocked: boolean; id: string;
  } | null>(null);
  // A question belongs to the account, context and read that displayed it, including when the screen is retained on blur.
  useFocusEffect(useCallback(() => {
    const epoch = ++focusLifetime.current.epoch;
    focusLifetime.current.active = true;
    return () => {
      if (focusLifetime.current.epoch === epoch) {
        focusLifetime.current.active = false;
        focusLifetime.current.epoch++;
      }
      retireConfirmation();
    };
  }, [accountId, accountRevision, p.targetAccountId, p.needId, p.agreementId, retireConfirmation]));
  const renderedGeneration = questionGeneration.current;
  const currentChoice = () => questionGeneration.current === renderedGeneration && !!accountId &&
    sesijaSada().user?.id === accountId && sesijaSada().accountRevision === accountRevision &&
    !!editor.data && editor.data.accountId === accountId && editor.data.targetAccountId === p.targetAccountId &&
    !editor.loading && !editor.busy && !editor.uncertain;
  const retainedCommand = () => {
    const command = blockCommand.current;
    return command && command.accountId === accountId && command.accountRevision === accountRevision &&
      command.targetAccountId === p.targetAccountId && command.revision === editor.data?.revision ? command : null;
  };
  // The displayed name of the person, only for a build that carries the flag and only for the profile the person came from; it
  // names the question ("Blokirati {ime}?") and heads the screen. With no name everything keeps its generic words.
  const name = useSafetyTargetName(profileId && safetyTargetNameBuilt() ? profileId : null, p.targetAccountId);
  const changeBlock = async () => {
    if (!currentChoice() || !focusLifetime.current.active) return;
    const lifetime = focusLifetime.current.epoch;
    const originCurrent = () => focusLifetime.current.active && focusLifetime.current.epoch === lifetime
      && !!accountId && sesijaSada().user?.id === accountId && sesijaSada().accountRevision === accountRevision;
    const value = editor.data!;
    let confirmed: AccountBlockReceipt | null = null;
    await editor.save(async () => {
      const c = retainedCommand() ?? { accountId: accountId!, accountRevision, targetAccountId: p.targetAccountId,
        revision: value.revision, blocked: !value.blocked, id: noviUuidZahtevId() };
      blockCommand.current = c;
      const result = await safetyClientService.setBlock({ targetAccountId: p.targetAccountId, blocked: c.blocked,
        expectedRevision: c.revision, clientRequestId: c.id });
      if (result.ok) confirmed = result.podatak;
      return result;
    });
    // Said only once the server has confirmed it, in the one outcome bar, with the way to put it back.
    const receipt = confirmed as AccountBlockReceipt | null;
    if (receipt && accountId && receipt.targetAccountId === p.targetAccountId)
      announceBlockChange(receipt, { accountId, accountRevision }, {
        stillCurrent: originCurrent,
        onSettled: () => { if (originCurrent()) void editor.refresh(); },
      });
  };
  const askBlock = () => {
    if (!currentChoice()) return;
    // A reconciled retry keeps the already confirmed exact command; it is not a new block choice.
    if (retainedCommand()) { void changeBlock(); return; }
    // Both directions ask once, in the centred dialog, with what follows in one sentence and the person's name when it is known.
    if (editor.data!.blocked) confirmation.ask({ title: name ? `Odblokirati ${name}?` : 'Odblokirati osobu?', message: unblockConsequence,
      confirmLabel: 'Odblokiraj', onConfirm: changeBlock });
    else confirmation.ask({ title: name ? `Blokirati ${name}?` : 'Blokirati osobu?', message: blockConsequence, confirmLabel: 'Blokiraj osobu',
      tone: 'danger', onConfirm: changeBlock });
  };
  // Match SupportFrame: resize the existing settings scroll surface above the keyboard without rebuilding the form.
  return <KeyboardAvoidingView style={s.screen} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
    <SettingsScreen title="Bezbednost" onBack={back}>
    {name ? <T variant="heading" accessibilityRole="header" numberOfLines={2} testID="safety-target-name">{name}</T> : null}
    <SettingsGroup title="Kontakt sa osobom"><View style={s.section}>
      <T variant="copy">{blockConsequence}</T>
      <T variant="note" tone="muted">{unblockConsequence}</T>
      {/* The first read names only the pending check; a re-read keeps the confirmed state and action on screen. */}
      {editor.loading && !editor.data ? <T variant="note" tone="muted" accessibilityLiveRegion="polite">Proveravamo blokiranje…</T> : null}
      {editor.error ? <T tone="danger" accessibilityRole="alert">{editor.error}</T> : null}
      {editor.data ? <>
        <T accessibilityLiveRegion="polite">{editor.data.blocked ? 'Osoba je blokirana.' : 'Osoba nije blokirana.'}</T>
        {/* Keeps its words while the choice is saved, with a spinner: the same button, never a different one. */}
        <SettingsAction label={editor.data.blocked ? 'Odblokiraj osobu' : 'Blokiraj osobu'} loading={editor.busy}
          kind={editor.data.blocked ? 'secondary' : 'destructive'} disabled={editor.loading || editor.busy || editor.uncertain}
          reason={editor.loading ? 'Proveravamo blokiranje…' : editor.uncertain ? 'Najpre proveri blokiranje.' : null} onPress={askBlock} />
      </> : null}
      {editor.error ? <SettingsAction label="Proveri blokiranje" kind="quiet" disabled={editor.busy || editor.loading} onPress={() => { void editor.refresh(); }} /> : null}
    </View></SettingsGroup>
    <PrivateReport {...p} />
    {/* This screen is where a person arrives when something has gone wrong with another person, and
        it had no way through to support at all — the only paths in were the profile row and a
        publication review. */}
    <SettingsGroup title="Imate drugo pitanje?"><View style={s.section}>
      <T variant="note" tone="muted">Podrška prima Vašu prijavu. Poseban zahtev otvorite samo ako imate drugo pitanje.</T>
      <SettingsAction label="Otvorite zahtev podršci" kind="quiet"
        onPress={() => router.push('/podrska/novi')} />
    </View></SettingsGroup>
    {confirmation.sheet}
    </SettingsScreen>
  </KeyboardAvoidingView>;
}

function PrivateReport(context: Context) {
  const { user, accountRevision } = useSesija(), accountId = user?.id ?? '';
  const confirmation = useConfirmSheet();
  const closeConfirmation = confirmation.close;
  // Only the opaque command ID is persisted. Report content never goes to local
  // storage, public projection, push, bilateral chat, analytics or console.
  const storageKey = `uskoci:safety-command:v1:${accountId}:${context.targetAccountId}:${context.needId ?? ''}:${context.agreementId ?? ''}`;
  const scope = useRef<{ busy: boolean; current: () => boolean } | null>(null);
  const key = useRef<string | null>(null), frozen = useRef<SafetyReportCommand | null>(null);
  const [category, setCategory] = useState<SafetyCategory | null>(null), [reason, setReason] = useState(''), [narrative, setNarrative] = useState('');
  const [busy, setBusy] = useState(true), [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [pending, setPending] = useState(false), [receipt, setReceipt] = useState<SafetyReportReceipt | null>(null);
  // Which command of this form is running, so only its own button shows the spinner; and whether the receipt on screen is
  // news (this visit's send, or a check the person asked for) or only restored from an earlier visit.
  const [working, setWorking] = useState<'send' | 'replay' | 'check' | 'new' | null>(null), [fresh, setFresh] = useState(false);
  const readReceipt = useCallback(async (current: () => boolean, requestId: string, news = false) => {
    const result = await safetyClientService.readReportCommand(requestId);
    if (!current()) return;
    if (result.ok && result.podatak.receipt) { setReceipt(result.podatak.receipt); setFresh(news); setPending(false); setError(null); setReason(''); setNarrative(''); frozen.current = null; }
    else { setPending(true); setError(result.ok ? 'Ne znamo da li je prijava stigla. Proveri ili pošalji ponovo.' : result.poruka); }
  }, []);
  useFocusEffect(useCallback(() => {
    const s = { busy: true, current: () => scope.current === s && !!accountId && sesijaSada().user?.id === accountId &&
      sesijaSada().accountRevision === accountRevision };
    scope.current = s; setBusy(true); setLoaded(false); setError(null); setReceipt(null); setFresh(false); setWorking(null); setPending(false); key.current = null; frozen.current = null;
    setCategory(null); setReason(''); setNarrative('');
    void (async () => {
      try { const stored = await AsyncStorage.getItem(storageKey); if (!s.current()) return;
        if (stored !== null && !uuid(stored)) { setError('Potvrda prethodne prijave nije čitljiva. Ponovo otvori ovaj ekran.'); return; }
        key.current = stored; if (stored) await readReceipt(s.current, stored); if (s.current()) setLoaded(true);
      } catch { if (s.current()) setError('Prethodna prijava nije proverena. Ponovo otvori ekran.'); }
      finally { if (s.current()) { s.busy = false; setBusy(false); } }
    })();
    return () => { closeConfirmation(); if (scope.current === s) scope.current = null; frozen.current = null; setReason(''); setNarrative(''); setReceipt(null); };
  }, [accountId, accountRevision, storageKey, readReceipt, closeConfirmation]));
  const rendered = scope.current;
  const begin = (kind: 'send' | 'replay' | 'check' | 'new') => { const s = scope.current; if (!s || s !== rendered || !s.current() || s.busy) return null;
    s.busy = true; setBusy(true); setWorking(kind); setError(null); return s; };
  const finish = (s: NonNullable<typeof rendered>) => { if (s.current()) { s.busy = false; setBusy(false); setWorking(null); } };
  async function send() {
    // On a later visit only the request ID survives. Reusing it with newly written words would not be a replay
    // of the original report, so the person must check that ID or explicitly begin a fresh report.
    if (!loaded || receipt || (pending && !frozen.current) || (!frozen.current && (!category || !reason.trim()))) return;
    // A send that repeats the frozen command is a replay: its button says so; the first send keeps the words it was pressed with.
    const s = begin(frozen.current ? 'replay' : 'send'); if (!s) return;
    try {
      const id = key.current ?? noviUuidZahtevId();
      await AsyncStorage.setItem(storageKey, id); if (!s.current()) return;
      key.current = id;
      const command = frozen.current ?? { ...context, category: category!, reason: reason.trim(), narrative: narrative.trim(), clientRequestId: id };
      frozen.current = command; setPending(true);
      const result = await safetyClientService.report(command); if (!s.current()) return;
      if (result.ok) { setReceipt(result.podatak); setFresh(true); setPending(false); setReason(''); setNarrative(''); frozen.current = null; }
      else setError(result.poruka);
    } catch { if (s.current()) setError('Ne znamo da li je prijava stigla. Proveri to pre novog pokušaja.'); }
    finally { finish(s); }
  }
  async function check() { const s = begin('check'); if (!s) return;
    try { if (key.current) await readReceipt(s.current, key.current, true); }
    finally { finish(s); }
  }
  async function newReport() { if (!receipt) return; const s = begin('new'); if (!s) return;
    try { await AsyncStorage.removeItem(storageKey); if (!s.current()) return;
      key.current = null; frozen.current = null; setCategory(null); setReason(''); setNarrative(''); setReceipt(null); setFresh(false); setPending(false);
    } catch { if (s.current()) setError('Novi obrazac trenutno nije dostupan. Pokušaj ponovo.'); }
    finally { finish(s); }
  }
  async function startFreshAfterUnknown(requestId: string) {
    if (!loaded || !pending || frozen.current || key.current !== requestId) return;
    const s = begin('new'); if (!s) return;
    try {
      // A receipt may have appeared since the question opened. Do one last read before retiring its ID.
      const result = await safetyClientService.readReportCommand(requestId); if (!s.current() || key.current !== requestId) return;
      if (!result.ok) { setError(result.poruka); return; }
      if (result.podatak.receipt) {
        setReceipt(result.podatak.receipt); setFresh(false); setPending(false); setError(null); return;
      }
      await AsyncStorage.removeItem(storageKey); if (!s.current() || key.current !== requestId) return;
      key.current = null; setPending(false); setError(null); setCategory(null); setReason(''); setNarrative('');
    } catch { if (s.current()) setError('Nova prijava trenutno nije dostupna. Proveri prethodnu potvrdu i pokušaj ponovo.'); }
    finally { finish(s); }
  }
  const unknownWithoutDraft = loaded && pending && !frozen.current && !!key.current && !receipt;
  const askFreshAfterUnknown = () => {
    if (!unknownWithoutDraft || busy || !key.current) return;
    const requestId = key.current;
    confirmation.ask({ title: 'Započeti novu prijavu?',
      message: 'Prethodna prijava nije potvrđena. Ako naknadno stigne, nova prijava može biti duplikat.',
      confirmLabel: 'Započni novu prijavu', onConfirm: () => startFreshAfterUnknown(requestId) });
  };
  const editable = loaded && !busy && !frozen.current && !receipt && !unknownWithoutDraft;
  // A grey send carries its reason beside it (owner's rule): what the form still lacks, or that the earlier report is being checked.
  const lacking = !category && !reason.trim() ? 'Izaberi vrstu prijave i upiši kratak razlog.'
    : !category ? 'Izaberi vrstu prijave.' : !reason.trim() ? 'Upiši kratak razlog.' : null;
  const sendWhy = !loaded ? busy ? 'Proveravamo prijavu…' : null : !busy && !frozen.current ? lacking : null;
  return <SettingsGroup title="Bezbednosna prijava podršci"><View style={s.section}>
    <T variant="note" tone="muted">Prijavu prima podrška. Druga osoba ne vidi kategoriju, razlog ni opis. Ovo je odvojeno od problema u Dogovoru.</T>
    {/* The final state is a state of its own, not a line under the form: the form is gone, the receipt says what happened and when. */}
    {receipt ? <View style={s.done}>
      <SuccessMark fresh={fresh} size={56} />
      <T variant="heading" accessibilityRole="header" accessibilityLiveRegion="polite">Prijava je primljena.</T>
      <T variant="note" tone="muted">{`Primljeno: ${vreme(receipt.createdAt)}`}</T>
      <SettingsAction label="Nova privatna prijava" kind="quiet" disabled={busy} loading={working === 'new'} onPress={() => { void newReport(); }} /></View>
      : unknownWithoutDraft ? <View style={s.done}>
        <T variant="heading" accessibilityRole="header">Prethodna prijava nije potvrđena</T>
        <T variant="note" tone="muted">Sačuvan je samo njen ID, ne i tekst. Možeš ponovo da proveriš potvrdu ili svesno započneš novu prijavu.</T>
        <SettingsAction label="Proveri potvrdu prijave" kind="secondary" disabled={busy} loading={working === 'check'} onPress={() => { void check(); }} />
        <SettingsAction label="Započni novu prijavu" kind="quiet" disabled={busy} loading={working === 'new'} onPress={askFreshAfterUnknown} />
      </View> : <>
      <View accessibilityRole="radiogroup">{SAFETY_CATEGORIES.map((value, index) => <Press key={value} accessibilityRole="radio"
        accessibilityLabel={safetyCategoryCopy[value]} accessibilityState={{ selected: category === value, checked: category === value, disabled: !editable }}
        disabled={!editable} onPress={() => { if (scope.current === rendered && rendered?.current()) setCategory(value); }}
        style={radioStyles.row}>
        <View accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants"
          style={[radioStyles.marker, { borderColor: category === value ? sys.color.green : sys.color.lineStrong }]}>
          {category === value ? <View testID="safety-category-selected" style={radioStyles.dot} /> : null}
        </View>
        <T style={radioStyles.label}>{safetyCategoryCopy[value]}</T>
        {index === SAFETY_CATEGORIES.length - 1 ? null : <View pointerEvents="none" style={radioStyles.rule} />}
      </Press>)}</View>
      <View style={s.field}>
        <T variant="note" tone="muted">Kratak razlog</T><TextInput accessibilityLabel="Kratak razlog privatne prijave" value={reason} maxLength={200}
          onChangeText={value => { if (editable && scope.current === rendered && rendered?.current()) setReason(value); }} editable={editable} style={input} />
      </View>
      <View style={s.field}>
        <T variant="note" tone="muted">Dodatni opis, ako želiš</T><TextInput accessibilityLabel="Dodatni privatni opis" value={narrative} maxLength={2000}
          onChangeText={value => { if (editable && scope.current === rendered && rendered?.current()) setNarrative(value); }} editable={editable} multiline textAlignVertical="top" style={[input, { minHeight: 120 }]} />
      </View>
      {/* The button keeps its words while it works, with a spinner; a failed restore speaks through `error` below. */}
      <SettingsAction label={pending && working !== 'send' ? 'Pošalji ponovo' : 'Pošalji privatnu prijavu'} loading={working === 'send' || working === 'replay'} reason={sendWhy}
        disabled={!loaded || busy || (!frozen.current && (!category || !reason.trim()))} onPress={() => { void send(); }} />
    </>}
    {error ? <T tone="danger" accessibilityRole="alert">{error}</T> : null}
    {pending && !unknownWithoutDraft ? <SettingsAction label="Proveri potvrdu prijave" kind="secondary" disabled={busy} loading={working === 'check'} onPress={() => { void check(); }} /> : null}
    {confirmation.sheet}
  </View></SettingsGroup>;
}
const input = withInter({ borderWidth: ruleWidth, borderColor: sys.color.line, borderRadius: sys.radius.control, paddingVertical: sys.space.md, paddingHorizontal: sys.space.base,
  minHeight: 52, color: sys.color.ink, fontSize: sys.type.body.fontSize });

const s = StyleSheet.create({
  screen: { flex: 1 },
  section: { gap: sys.space.md },
  field: { gap: sys.space.sm },
  done: { gap: sys.space.md, alignItems: 'flex-start', paddingVertical: sys.space.sm },
});
const radioStyles = StyleSheet.create({
  row: { minHeight: layout.touch, paddingVertical: sys.space.md, flexDirection: 'row', alignItems: 'center', gap: sys.space.md },
  rule: { position: 'absolute', left: 0, right: 0, bottom: 0, height: ruleWidth, backgroundColor: sys.color.line },
  marker: { width: 22, height: 22, flexShrink: 0, borderWidth: 2, borderRadius: sys.radius.pill, alignItems: 'center', justifyContent: 'center' },
  dot: { width: 10, height: 10, borderRadius: sys.radius.pill, backgroundColor: sys.color.green },
  label: { flex: 1, minWidth: 0 },
});
