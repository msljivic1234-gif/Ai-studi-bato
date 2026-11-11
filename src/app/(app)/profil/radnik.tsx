import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, BackHandler, ScrollView, View, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import type { RadnikProfilProjekcija } from '../../../contracts/projections';
import type { AzurirajProfilKomanda, Ishod } from '../../../data/ports';
import { useOwnedEditor } from '../../../hooks/useOwnedEditor';
import { useWorkerExecutionModes } from '../../../hooks/useWorkerExecutionModes';
import { useUnsavedProfileBack } from '../../../hooks/useUnsavedProfileBack';
import { sesijaSada, useSesija } from '../../../store/sesija';
import { useIzvor } from '../../../store/uloga';
import { inicijali } from '../../../lib/inicijali';
import { noviUuidZahtevId } from '../../../lib/idempotencija';
import { ProfilePhoto } from '../../../ui/media/ContextPhotos';
import { RatingLine } from '../../../ui/profile/RatingLine';
import { useAccountName } from '../../../ui/profile/useAccountName';
import { HeaderInfo } from '../../../ui/settings/InfoTitle';
import { Avatar } from '../../../ui/system/Avatar';
import { brandAction } from '../../../ui/system/tokens';
import { V2Action } from '../../../ui/v2/V2Action';
import { WorkerProfileFooter, WorkerProfileForm, WorkerProfileFrame, WorkerProfileStatus, type WorkerNavigation, type WorkerProfileFocusRequest } from '../../../ui/workerProfile/WorkerProfilePresentation';
import { workerCommand, workerDraft, workerReadbackMatches, type WorkerDraft } from '../../../ui/workerProfile/workerProfileDraft';
import { workerProfileInfoLines } from '../../../ui/workerProfile/workerProfileFacts';
import { rememberAiCorrection } from '../../../data/aiCorrectionIntent';
import type { WorkerAiPart } from '../../../ui/workerProfile/workerProfileFacts';
import type { AvailableNowControl, SavedProfilePart } from '../../../ui/workerProfile/WorkerProfileSaved';

type Snapshot = { profile: RadnikProfilProjekcija | null; read: number };
type Draft = { value: WorkerDraft; initial: WorkerDraft; profileId: string | null };
type Attempt = { command: AzurirajProfilKomanda; expected: AzurirajProfilKomanda; profileId: string | null; afterRead: number };
/** The one write that changes only the name ("Koristi „<ime naloga>“"): nothing else is sent, so nothing else can be read back differently. */
const isNameOnly = (command: AzurirajProfilKomanda) => command.zavrsi !== true && command.ime !== undefined
  && Object.keys(command).every(key => key === 'zavrsi' || key === 'ime');
const failed = (): Ishod<Snapshot> => ({ ok: false, kod: 'PROFILE_UNCONFIRMED',
  poruka: 'Čuvanje nije potvrđeno. Pogledajte sačuvani profil pre nego što pokušate ponovo.' });
async function bounded<T>(request: () => Promise<T>, milliseconds: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try { return await Promise.race([request(), new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error('PROFILE_TIMEOUT')), milliseconds); })]); }
  finally { if (timer !== undefined) clearTimeout(timer); }
}
export default function ProfilRadnikEkran() {
  const session = useSesija();
  return <OwnedWorkerProfile key={`${session.user?.id}:${session.accountRevision}`}
    accountId={session.user?.id} accountRevision={session.accountRevision} />;
}
function OwnedWorkerProfile({ accountId, accountRevision }: { accountId?: string; accountRevision: number }) {
  const izvor = useIzvor();
  // ONE NAME (owner, 8 Oct 2026): the work profile has no field for it. It takes the ACCOUNT's name, changed only in "Lični podaci".
  const account = useAccountName();
  const accountName = account.state === 'ready' ? account.name : null;
  const owns = useCallback(() => !!accountId && sesijaSada().user?.id === accountId &&
    sesijaSada().accountRevision === accountRevision, [accountId, accountRevision]);
  const lifecycle = useRef({ focus: null as object | null, active: !AppState.currentState || AppState.currentState === 'active', generation: 0 });
  const [foreground, setForeground] = useState(lifecycle.current.active), [resumeRequired, setResumeRequired] = useState(false);
  const [focusEpoch, setFocusEpoch] = useState(0);
  const scroll = useRef<ScrollView>(null), readingOffset = useRef(0);
  const returningTo = useRef<{ y: number; fromFocus: object | null } | null>(null);
  useFocusEffect(useCallback(() => {
    const token = {}; lifecycle.current.focus = token; setFocusEpoch(value => value + 1);
    return () => { if (lifecycle.current.focus === token) { lifecycle.current.focus = null; lifecycle.current.generation++; } };
  }, []));
  useEffect(() => { const subscription = AppState.addEventListener('change', state => {
    lifecycle.current.active = state === 'active'; lifecycle.current.generation++;
    setForeground(lifecycle.current.active); setResumeRequired(true);
  }); return () => { subscription.remove(); lifecycle.current.active = false; }; }, []);
  const readSequence = useRef(0);
  const read = useCallback(async (): Promise<Ishod<Snapshot>> => {
    if (!owns()) return failed();
    const sequence = ++readSequence.current;
    try {
      const profile = await bounded(() => izvor.mojRadnikProfil(), 15_000);
      if (!owns()) return failed();
      return { ok: true, podatak: { profile, read: sequence } };
    } catch { return { ok: false, kod: 'PROFILE_READ_FAILED', poruka: 'Profil nije učitan. Proverite vezu pa pokušajte ponovo.' }; }
  }, [izvor, owns]);
  const editor = useOwnedEditor(read);
  const executionModes = useWorkerExecutionModes(editor.data?.profile?.id ?? null, editor.data?.read ?? 0);
  const latestModes = useRef(executionModes.view);
  latestModes.current = executionModes.view;
  const latestStatus = useRef(editor.data?.profile?.stanje);
  latestStatus.current = editor.data?.profile?.stanje;
  const [draft, setDraft] = useState<Draft | null>(null), draftRef = useRef<Draft | null>(null), draftGeneration = useRef(0);
  const [pending, setPending] = useState<Attempt | null>(null), pendingRef = useRef<Attempt | null>(null);
  const [transportBusy, setTransportBusy] = useState(false), transportRef = useRef(false);
  const [message, setMessage] = useState<string | null>(null), [validation, setValidation] = useState<string | null>(null);
  const [focusRequest, setFocusRequest] = useState<WorkerProfileFocusRequest | null>(null), focusRequestSequence = useRef(0);
  // Legacy identity links continue the same AI conversation.
  const params = useLocalSearchParams<{ uredi?: string; n?: string }>(), openedFor = useRef<string | null>(null);
  const setLocal = (next: Draft) => { draftGeneration.current++; draftRef.current = next; setDraft(next); };
  useEffect(() => {
    if (!editor.data || transportBusy) return;
    const { profile, read: sequence } = editor.data, attempt = pendingRef.current;
    const confirmed = attempt && sequence > attempt.afterRead && workerReadbackMatches(profile, attempt.expected, attempt.profileId);
    const pristine = draftRef.current && JSON.stringify(draftRef.current.value) === JSON.stringify(draftRef.current.initial);
    if (!draftRef.current || confirmed || (!attempt && pristine)) {
      const value = workerDraft(profile); setLocal({ value, initial: value, profileId: profile?.id ?? null });
    }
    if (confirmed) {
      pendingRef.current = null; setPending(null); setValidation(null);
      setMessage(attempt.command.zavrsi ? 'Profil je aktivan i sačuvan.'
        : isNameOnly(attempt.command) ? 'Ime radnog profila je promenjeno.'
          : attempt.profileId === null ? 'Profil je sačuvan. Nastavite sa podešavanjem.'
            : 'Izmene profila su sačuvane.');
    }
  }, [editor.data, transportBusy]);
  useEffect(() => {
    if (!foreground || !resumeRequired || transportBusy || !lifecycle.current.focus) return;
    let current = true;
    const generation = lifecycle.current.generation;
    void editor.refresh().then(() => {
      if (current && owns() && lifecycle.current.active && generation === lifecycle.current.generation) setResumeRequired(false);
    });
    return () => { current = false; };
  }, [foreground, resumeRequired, transportBusy, editor.refresh, focusEpoch, owns]);
  const focus = lifecycle.current.focus, generation = lifecycle.current.generation, renderedDraft = draftGeneration.current;
  const current = () => owns() && !!focus && lifecycle.current.focus === focus && lifecycle.current.active && lifecycle.current.generation === generation;
  const enabled = current() && !resumeRequired && !transportBusy && !editor.busy && !editor.loading && !editor.error && !editor.uncertain;
  const goBack = () => {
    if (!current() || transportRef.current || pendingRef.current) return;
    returningTo.current = null;
    // Navigation may retain this route. An explicitly discarded draft must not
    // return on the next visit, or stay reachable through a retained callback.
    const local = draftRef.current;
    if (local && JSON.stringify(local.value) !== JSON.stringify(local.initial)) {
      setLocal({ ...local, value: local.initial });
      setMessage(null); setValidation(null); setFocusRequest(null);
    }
    if (router.canGoBack()) router.back(); else router.replace('/profil');
  };
  const change = (value: WorkerDraft) => {
    if (!enabled || latestStatus.current === 'SUSPENDED' || transportRef.current || pendingRef.current || renderedDraft !== draftGeneration.current || !draftRef.current || !current()) return;
    setLocal({ ...draftRef.current, value }); setMessage(null); setValidation(null); setFocusRequest(null);
  };
  // One attempt at a time: a command is sent once, its whole pipeline stays owned until it settles, and the profile is read back before it is called saved.
  const commit = async (attempt: Attempt) => {
    await editor.save(async () => {
      transportRef.current = true; setTransportBusy(true); pendingRef.current = attempt; setPending(attempt); setMessage(null); setValidation(null);
      try {
        // The existing writer bounds each of its four authenticated operations
        // to 15s. Keep its whole pipeline owned until it settles; never replay it.
        const result = await bounded(() => izvor.azurirajRadnikProfil(attempt.command), 65_000);
        if (!current()) return failed();
        if (!result.ok) return failed();
        const refreshed = await read();
        if (!current() || !refreshed.ok || !workerReadbackMatches(refreshed.podatak.profile, attempt.expected, attempt.profileId)) return failed();
        return refreshed;
      } catch { return failed(); }
      finally {
        transportRef.current = false;
        if (owns()) { setTransportBusy(false); if (!current()) setResumeRequired(true); }
      }
    });
  };
  const save = async (activate: boolean) => {
    if (!enabled || !current() || latestStatus.current === 'SUSPENDED' || transportRef.current || !draftRef.current || renderedDraft !== draftGeneration.current) return;
    const built = pendingRef.current ? { command: pendingRef.current.command, expected: pendingRef.current.expected } : workerCommand(draftRef.current.value, draftRef.current.initial, activate, accountName);
    if (!built.command) {
      setValidation(built.error ?? 'Proverite popunjena polja.');
      const value = draftRef.current.value;
      const target = value.newSkill.trim() ? 'skill' : value.newTool.trim() ? 'tool' : value.newVehicle.trim() ? 'vehicle' : null;
      if (target) setFocusRequest({ target, token: ++focusRequestSequence.current });
      return;
    }
    await commit(pendingRef.current ?? { command: built.command, expected: built.expected!, profileId: draftRef.current.profileId, afterRead: readSequence.current });
  };
  // "Koristi „<ime naloga>“" (the person's own action, never automatic): writes the account's name into the work profile through the same owned
  // writer and the same readback as every other save. Unsaved edits are not thrown away by it: they have to be saved first.
  const adoptAccountName = async () => {
    if (!enabled || !current() || latestStatus.current === 'SUSPENDED' || transportRef.current || pendingRef.current || !draftRef.current || renderedDraft !== draftGeneration.current) return;
    const name = accountName?.trim();
    if (!name || draftRef.current.profileId === null) return;
    if (JSON.stringify(draftRef.current.value) !== JSON.stringify(draftRef.current.initial)) { setValidation('Sačuvajte unos pre promene imena.'); return; }
    const command: AzurirajProfilKomanda = { zavrsi: false, ime: name };
    await commit({ command, expected: command, profileId: draftRef.current.profileId, afterRead: readSequence.current });
  };
  const refresh = () => { if (current() && !transportRef.current) { setMessage(null); void editor.refresh(); } };
  const editAfterRead = () => {
    if (!enabled || !current() || transportRef.current || !editor.data || !pendingRef.current || editor.data.read <= pendingRef.current.afterRead) return;
    pendingRef.current = null; setPending(null); setMessage(null); setValidation(null); draftGeneration.current++;
  };
  const navigate = (path: WorkerNavigation, pointOnly = false) => {
    if (!enabled || !current() || transportRef.current || pendingRef.current) return;
    if (latestStatus.current === 'SUSPENDED' && (path === '/profil/lokacija' || path === '/profil/dostupnost')) return;
    if (pointOnly && (latestModes.current.kind !== 'confirmed'
      || !latestModes.current.modes.includes('ON_SITE') || !editor.data?.profile)) return;
    if (draftRef.current && JSON.stringify(draftRef.current.value) !== JSON.stringify(draftRef.current.initial)
      && !(path === '/podrska' && latestStatus.current === 'SUSPENDED')) {
      // Support is not a setting, so it has its own sentence (review of step 9, 2026-09-24).
      setValidation(path === '/podrska' ? 'Sačuvajte unos pre nego što pišete podršci.' : 'Sačuvajte unos pre otvaranja drugog podešavanja.'); return;
    }
    // Capture before blur replaces the private form with a short status. Its
    // native scroll clamp must not overwrite where this owner was reading.
    returningTo.current = { y: readingOffset.current, fromFocus: focus };
    if (path === '/profil/obavestenja') router.navigate({ pathname: path, params: { skup: 'WORKER' } });
    else if (path === '/profil/lokacija' && pointOnly) router.navigate({ pathname: path, params: { mode: 'point', profileId: editor.data!.profile!.id } });
    else router.navigate(path);
  };
  // Every ordinary section edit is a local AI topic.
  const editPart = (part: SavedProfilePart) => openConversation(part === 'vehicles' ? 'tools' : part);
  const guide = (target: WorkerProfileFocusRequest['target'], copy: string) => {
    if (!enabled || !current() || pendingRef.current || transportRef.current) return;
    setValidation(copy); setMessage(null);
    setFocusRequest({ target, token: ++focusRequestSequence.current });
  };
  const visible = foreground && !resumeRequired && !!editor.data && !!draft && !!focus;
  const rememberReading = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (visible && current() && !returningTo.current) readingOffset.current = Math.max(0, event.nativeEvent.contentOffset.y);
  };
  const resumeReading = () => {
    const target = returningTo.current;
    if (!visible || !current() || !target || target.fromFocus === focus || !scroll.current) return;
    returningTo.current = null;
    // The form has laid out again; native scrollTo clamps if the updated
    // content is shorter. No timer can move the next route or another owner.
    scroll.current.scrollTo({ y: target.y, animated: false });
  };
  const beginReading = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (!visible || !current()) return;
    returningTo.current = null;
    rememberReading(event);
  };
  const profile = editor.data?.profile ?? null;
  const status = profile?.stanje ?? null;
  const firstSave = profile === null;
  const localDirty = !!draft && JSON.stringify(draft.value) !== JSON.stringify(draft.initial);
  // Read, not edited: a finished profile with nothing unsaved or in flight. Any edit in progress means the editor is already open. A write of ONLY the name
  // ("Koristi „<ime naloga>“") leaves the profile read: its button spins in place, and the screen does not turn into the editor for the length of one write.
  const nameOnly = !!pending && isNameOnly(pending.command);
  const reading = profile !== null && (status === 'SUSPENDED' || (status === 'ACTIVE' || status === 'DRAFT') && !localDirty && (!pending || nameOnly) && (!transportBusy || nameOnly));
  const introOnly = firstSave && !localDirty && !pending && !transportBusy && !editor.uncertain;
  // Legacy personal-data links open the biography topic once per tap.
  useEffect(() => {
    const token = params.uredi === 'o-meni' && params.n ? params.n : null;
    if (!token || openedFor.current === token || profile === null || profile.stanje === 'SUSPENDED' || !enabled || !current()) return;
    openedFor.current = token;
    openConversation('identity');
  }, [params.uredi, params.n, profile, enabled]);
  const leave = useUnsavedProfileBack({ dirty: localDirty, busy: transportBusy || editor.busy, uncertain: !!pending || editor.uncertain,
    revision: draftGeneration.current, onBack: goBack });
  const pendingBack = () => {
    if (!transportRef.current && !pendingRef.current) return false;
    setValidation('Prvo proverite ishod čuvanja. Vaš unos je zadržan.'); return true;
  };
  const back = () => { if (current() && !pendingBack()) leave.back(); };
  // A local unconfirmed command must stay owned until readback. Hardware Back follows the same boundary.
  useFocusEffect(useCallback(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (!transportRef.current && !pendingRef.current) return false;
      setValidation('Prvo proverite ishod čuvanja. Vaš unos je zadržan.'); return true;
    });
    return () => subscription.remove();
  }, []));
  const showFooter = (status !== 'ACTIVE' && status !== 'SUSPENDED') || localDirty || !!pending || transportBusy
    || editor.busy || editor.loading || editor.uncertain || !!editor.error || !!validation || !!message;
  const value = draft?.value;
  // The name this profile is activated under is the account's (`nameForSave`); its own only while the account's cannot be read.
  const profileName = accountName?.trim() || value?.ime.trim() || '';
  const basicsReady = !!value && profileName.length >= 2 && value.vestine.length > 0;
  const locationReady = !!value && value.grad.trim().length >= 2 && /^\d{1,3}$/.test(value.radius)
    && Number(value.radius) >= 1 && Number(value.radius) <= 200;
  // `activates` marks the one branch that really offers activation; the status note says "ready" only then, never while
  // the primary still has to save a change first.
  const primary: { label: string; run: () => void; activates?: boolean } = (() => {
    if (status === 'SUSPENDED') return { label: 'Proverite profil', run: refresh };
    if (status === 'ACTIVE') return localDirty
      ? { label: 'Sačuvajte izmene', run: () => { void save(false); } }
      : { label: 'Uredite kroz razgovor', run: () => openConversation() };
    if (firstSave) return localDirty
      ? { label: 'Sačuvajte profil', run: () => { void save(false); } }
      : { label: 'Uredite kroz razgovor', run: () => openConversation() };
    if (status !== 'DRAFT') return { label: 'Osvežite radni profil', run: refresh };
    if (reading) return basicsReady && !!value && value.grad.trim().length >= 2
      ? { label: 'Pregled za aktivaciju', run: () => openConversation(undefined, true) }
      : { label: 'Nastavite kroz razgovor', run: () => openConversation() };
    if (localDirty) return { label: 'Sačuvajte izmene', run: () => { void save(false); } };
    if (!locationReady) return { label: 'Podesite područje rada', run: () => navigate('/profil/lokacija') };
    // The name is not typed here: when it is missing, the primary leads to the one place it is written.
    if (!basicsReady) return profileName.length < 2
      ? { label: 'Dodajte ime', run: () => navigate('/profil/podaci') }
      : { label: 'Dopunite osnovne podatke', run: () => guide('skill', 'Pre aktivacije dodajte bar jednu veštinu.') };
    return { label: 'Proverite i aktivirajte profil', run: () => { if (account.state !== 'loading') void save(true); }, activates: true };
  })();
  // The AI entry preserves ownership and any unresolved legacy save.
  const openConversation = (part?: WorkerAiPart, activation = false) => {
    if (!enabled || !current() || transportRef.current || pendingRef.current || latestStatus.current === 'SUSPENDED') return;
    if (draftRef.current && JSON.stringify(draftRef.current.value) !== JSON.stringify(draftRef.current.initial)) {
      setValidation('Sačuvajte unos pre otvaranja razgovora.'); return;
    }
    if(activation){
      router.navigate({pathname:'/profil/razgovor',params:{activationRequest:noviUuidZahtevId()}});
    }else if(part && accountId){
      const correction = rememberAiCorrection({accountId,accountRevision},`worker.${part}`);
      if(correction)router.navigate({pathname:'/profil/razgovor',params:{aiCorrection:correction.token}});
    }else router.navigate('/profil/razgovor');
  };
  // The answer to a save stands in the footer, above the button that was pressed (it used to sit at the top of the scroll).
  // What the profile does with its data is behind the "ⓘ" in the bar, not a block of sentences on the screen (owner's phone, 8 Oct 2026).
  const nameWorking = transportBusy && nameOnly;
  // The card "Kako te vide kad uskačeš": the face (the account's own photo, or its letters), and the rating when there is one.
  const accountProfileId = account.state === 'ready' ? account.profileId ?? null : null;
  const stand = <Avatar initials={inicijali(accountName ?? value?.ime ?? null)} size={56} />;
  const face = accountProfileId ? <ProfilePhoto profileId={accountProfileId} size={56} fallback={stand} own /> : stand;
  const availableNowControl: AvailableNowControl | undefined = status === 'ACTIVE' && value
    ? { value: value.dostupanOdmah, onEdit: () => openConversation('time') } : undefined;
  return <WorkerProfileFrame back={back} scrollRef={scroll} onScroll={rememberReading} onScrollBeginDrag={beginReading}
    right={visible ? <HeaderInfo title="Na šta utiče radni profil" testID="worker-profile-info" info={workerProfileInfoLines(false)} /> : undefined}
    footer={visible && showFooter ? <WorkerProfileFooter message={message ?? (status === 'SUSPENDED' && localDirty ? 'Nesačuvani unos je zadržan. Izmene nisu dostupne dok traje suspenzija.' : null)} error={validation ?? editor.error}
    held={!!pending && !transportBusy}>
    {pending && (editor.uncertain || editor.error || status === 'SUSPENDED') ? <V2Action label="Pogledajte sačuvani profil" disabled={transportBusy} onPress={refresh} style={brandAction} />
      : <V2Action label={transportBusy ? 'Čuvamo profil…' : pending ? 'Sačuvajte ponovo' : primary.label}
        disabled={!enabled || (!!primary.activates && !pending && account.state === 'loading')} loading={transportBusy} success={!!message}
        onPress={() => { if (pending) void save(false); else primary.run(); }}
        style={brandAction} />}
    {!reading && !pending && status === 'DRAFT' && primary.label !== 'Sačuvajte izmene' ? <V2Action tone="neutral" label="Sačuvajte kao nacrt" kind="quiet" disabled={!enabled} onPress={() => { void save(false); }} /> : null}
    {pending && enabled ? <V2Action tone="neutral" label="Izmenite podatke" kind="quiet" onPress={editAfterRead} /> : null}
  </WorkerProfileFooter> : undefined}>
    {!visible ? <WorkerProfileStatus loading={!foreground || resumeRequired || editor.loading || transportBusy} error={editor.error} retry={refresh} />
      : <View testID="worker-profile-reading" onLayout={resumeReading}><WorkerProfileForm draft={reading ? workerDraft(profile) : draft!.value} change={change} disabled={!enabled || !!pending} status={status} navigate={navigate} focusRequest={focusRequest}
        checks={{ basics: basicsReady, area: locationReady }} readyToActivate={!!primary.activates && !pending}
        openConversation={openConversation} showConversationAction={!(reading && status === 'DRAFT')} profileExists={profile !== null} introOnly={introOnly}
        reading={reading} aiOnly onEditPart={editPart} face={face} rating={accountId ? <RatingLine accountId={accountId} /> : undefined}
        availableNow={availableNowControl}
        executionModes={executionModes.view} refreshModes={executionModes.refresh} confirmMap={() => navigate('/profil/lokacija', true)}
        accountName={accountName} onUseAccountName={() => { void adoptAccountName(); }} nameWorking={nameWorking} /></View>}
    {leave.sheet}
  </WorkerProfileFrame>;
}
