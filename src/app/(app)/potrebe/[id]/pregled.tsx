import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, Share } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { STANJA_POTREBE, type PotrebaProjekcija } from '../../../../contracts/projections';
import type { Ishod } from '../../../../data/ports';
import { aiNeedV2Izvor } from '../../../../data';
import { ownProfileClientService, type OwnProfileIdentity } from '../../../../data/ownProfileClientService';
import { reviewsClientService, type AccountReputation } from '../../../../data/reviewsClientService';
import { failure, positiveInteger, sameId, uuid } from '../../../../data/serverReceipt';
import { knownRemainingSearchRefusal, ru4Production } from '../../../../data/ru4Production';
import { knownSearchRecoveryRefusal, needSearchRecoveryClientService } from '../../../../data/needSearchRecoveryClientService';
import { retainRemainingSearchCloseAttempt, type RemainingSearchCloseAttempt } from '../../../../data/remainingSearchCloseAttempt';
import { needPublicationReadiness, type NeedPublicationReadiness } from '../../../../data/needPublicationReadiness';
import { useOwnedEditor } from '../../../../hooks/useOwnedEditor';
import { NeedPresentation } from '../../../../ui/v2/NeedPresentation';
import { TaskDecisionPublisher } from '../../../../ui/v2/detail/TaskDecision';
import { taskShareMessage } from '../../../../ui/v2/detail/taskShare';
import { missingPeople, noApplicationsHelp } from '../../../../ui/v2/ownTaskOverview';
import { UrgentActivationActions, useUrgentActivationActions } from '../../../../ui/v2/UrgentActivationActions';
import { LocationMapPreview } from '../../../../ui/location/LocationMapPreview';
import { NeedPhotos, ProfilePhoto } from '../../../../ui/media/ContextPhotos';
import { NeedLifecycleActions, needLifecycleEntries, type NeedLifecycleMenu } from '../../../../ui/needs/NeedLifecycleActions';
import { NeedSearchRecoveryController, initialSearchRecoveryView } from '../../../../ui/needs/NeedSearchRecoveryController';
import { NeedSearchRecoverySection } from '../../../../ui/needs/NeedSearchRecoverySection';
import { needSearchRecoveryCopy, type SearchRecoveryAction } from '../../../../ui/needs/needSearchRecoveryCopy';
import { ratingText } from '../../../../ui/profile/ProfileFigures';
import { usePublicWorkTrust } from '../../../../ui/profile/usePublicWorkTrust';
import { publicTrustFacts } from '../../../../ui/profile/workTrustModel';
import type { SheetAction } from '../../../../ui/system/ActionSheet';
import { Avatar } from '../../../../ui/system/Avatar';
import { TaskQaInline } from '../../../../ui/qa/TaskQaInline';
import { useTaskQaInline } from '../../../../ui/qa/useTaskQaInline';
import { inicijali } from '../../../../lib/inicijali';
import { noviZahtevId } from '../../../../lib/idempotencija';
import { plural } from '../../../../ui/system/plural';
import { useConfirmSheet } from '../../../../ui/system/ConfirmSheet';
import { sesijaSada, useSesija } from '../../../../store/sesija';
import { useIzvor } from '../../../../store/uloga';

type Snapshot = { need: PotrebaProjekcija; remainingClosed: boolean };
const changed = () => failure('REVIEW_CHANGED', 'Ponovo otvori zadatak i pregledaj trenutno stanje.');

export default function PregledPotrebe() {
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const id = typeof params.id === 'string' ? params.id : '';
  const { user, accountRevision } = useSesija();
  return <OwnedNeed key={`${id}:${user?.id ?? ''}:${accountRevision}`} id={id} />;
}
function OwnedNeed({ id }: { id: string }) {
  const izvor = useIzvor();
  const { user, accountRevision } = useSesija();
  const accountId = user?.id;
  const identity = useMemo(() => ({}), [id, izvor, accountId, accountRevision]);
  const latestIdentity = useRef(identity); latestIdentity.current = identity;
  const focus = useRef<object | null>(null), life = useRef(0), navigating = useRef(false), dialog = useRef<object | null>(null);
  const foreground = useRef(AppState.currentState !== 'background' && AppState.currentState !== 'inactive');
  const [lifecycle, setLifecycle] = useState(0);
  const reading = useRef<object | null>(null);
  // An unconfirmed close keeps its command identity for the explicit retry; the
  // owner remounts on id/account, so the attempt never outlives them.
  const closeAttempt = useRef<RemainingSearchCloseAttempt | null>(null);
  const recoveryController = useRef<NeedSearchRecoveryController | null>(null);
  const [recoveryView, setRecoveryView] = useState(initialSearchRecoveryView);
  const lifecycleMenu = useRef<NeedLifecycleMenu | null>(null);
  const [terminalActive, setTerminalActive] = useState(false);
  const terminalActiveRef = useRef(false);
  const [urgentActive, setUrgentActive] = useState(false);
  const urgentActiveRef = useRef(false);
  const setUrgent = useCallback((active: boolean) => { urgentActiveRef.current = active; setUrgentActive(active); }, []);
  const setTerminal = useCallback((active: boolean) => { terminalActiveRef.current = active; setTerminalActive(active); }, []);
  // Wherever the screen retires `dialog.current`, the open question it belonged to leaves the screen too.
  const confirmSheet = useConfirmSheet(), retireConfirmation = confirmSheet.close;
  useFocusEffect(useCallback(() => {
    const scope = {}; focus.current = scope; life.current++; navigating.current = false;
    foreground.current = AppState.currentState !== 'background' && AppState.currentState !== 'inactive';
    void recoveryController.current?.check();
    const subscription = AppState.addEventListener('change', state => {
      const active = state === 'active';
      if (active === foreground.current) return;
      foreground.current = active; life.current++; dialog.current = null; retireConfirmation();
      setLifecycle(value => value + 1);
    });
    return () => { subscription.remove(); if (focus.current === scope) focus.current = null;
      life.current++; dialog.current = null; retireConfirmation(); };
  }, [identity, retireConfirmation]));
  const read = useCallback(async (): Promise<Ishod<Snapshot>> => {
    const owner = focus.current, generation = life.current, invocation = {};
    reading.current = invocation;
    const current = () => owner !== null && focus.current === owner && foreground.current && life.current === generation
      && reading.current === invocation
      && latestIdentity.current === identity && sesijaSada().user?.id === accountId
      && sesijaSada().accountRevision === accountRevision;
    const load = async (): Promise<Ishod<Snapshot>> => {
      if (!current()) return changed();
      if (!uuid(id)) return failure('NEED_REQUIRED', 'Zadatak nije izabran.');
      const need = await izvor.potreba(id);
      if (!current()) return changed();
      if (!need || !sameId(need.id, id) || !positiveInteger(need.revizija) || !STANJA_POTREBE.includes(need.stanje)) {
        return failure('NEED_UNAVAILABLE', 'Zadatak nije pronađen ili više nije dostupan.');
      }
      const search = await ru4Production.remainingSearchState(id);
      if (!current()) return changed();
      if (!search || typeof search.closed !== 'boolean') return failure('NEED_INVALID_RESPONSE', 'Pregled zadatka nije potvrđen.');
      return { ok: true, podatak: { need, remainingClosed: search.closed } };
    };
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([load(), new Promise<Ishod<Snapshot>>(resolve => {
        timer = setTimeout(() => resolve(failure('NEED_READ_TIMEOUT', 'Učitavanje traje predugo. Proveri vezu i pokušaj ponovo.')), 15_000);
      })]);
    } catch { return failure('NEED_READ_FAILED', 'Zadatak trenutno nije moguće učitati. Proveri vezu i pokušaj ponovo.'); }
    finally {
      if (timer !== undefined) clearTimeout(timer);
      // SDK reads may finish after the timeout. Retire their side-effect authority.
      if (reading.current === invocation) reading.current = null;
    }
  }, [id, identity, izvor, accountId, accountRevision, lifecycle]);
  const editor = useOwnedEditor(read);
  const potreba = editor.data?.need ?? null;
  // What people asked about this task and what the owner answered is read here and drawn in the overview. It is read where
  // the task is read, so that it survives the task reading again; a failed read stays on its own section. A draft is
  // private and nobody can have asked about it, so it reads nothing.
  const publicNeedId = potreba && potreba.stanje !== 'NACRT' ? potreba.id : null;
  const questions = useTaskQaInline(publicNeedId, potreba?.revizija ?? null);
  const [ownerIdentity, setOwnerIdentity] = useState<OwnProfileIdentity | null>(null);
  const [ownerReputation, setOwnerReputation] = useState<AccountReputation | null>(null);
  useEffect(() => {
    if (!accountId) {
      setOwnerIdentity(null);
      setOwnerReputation(null);
      return;
    }
    let alive = true;
    void ownProfileClientService.read(accountId, 'narucilac').then(res => {
      if (alive) setOwnerIdentity(res);
    }, () => {});
    void reviewsClientService.reputation(accountId).then(res => {
      if (alive && res.ok) setOwnerReputation(res.podatak);
    }, () => {});
    return () => { alive = false; };
  }, [accountId, accountRevision, lifecycle]);
  const ownerTrust = usePublicWorkTrust(ownerIdentity?.profileId ?? null);
  const ownerReliability = publicTrustFacts(ownerTrust)?.reliability;
  const ownerReliabilityPercent = ownerReliability?.kind === 'percent' ? ownerReliability.percent : null;
  // A draft is told why it cannot be published, by the gate that decides it rather than by a
  // guess. Read-only: it reports, and the server decides again when publishing is attempted.
  const [readiness, setReadiness] = useState<NeedPublicationReadiness | null>(null);
  // "Osveži zadatak" asks the gate again: a draft held back for something that only waits (photos still being processed) is
  // told to read again, and the same revision of the same task would otherwise never ask a second time.
  const [readinessRun, setReadinessRun] = useState(0);
  const preostalaPotragaZatvorena = editor.data?.remainingClosed ?? false;
  const recoveryBusy = recoveryView.phase === 'SENDING' || (recoveryView.phase === 'LOADING' && !!recoveryView.command);
  const ucitava = editor.loading, greska = editor.error, akcijaUToku = editor.busy || editor.uncertain || recoveryBusy;
  const renderedFocus = focus.current, renderedLife = life.current;
  const latestData = useRef(editor.data); latestData.current = editor.data;
  const current = () => focus.current !== null && focus.current === renderedFocus && foreground.current
    && life.current === renderedLife && latestIdentity.current === identity && latestData.current === editor.data
    && !!accountId && sesijaSada().user?.id === accountId && sesijaSada().accountRevision === accountRevision;

  useEffect(() => {
    recoveryController.current?.dispose();
    recoveryController.current = null;
    setRecoveryView(initialSearchRecoveryView());
    if (!accountId || !uuid(id)) return;
    const account = { accountId, accountRevision };
    const controller = new NeedSearchRecoveryController({
      needId: id,
      accountId,
      storage: AsyncStorage,
      newKey: () => noviZahtevId('ponovo-trazi-ljude'),
      current: () => focus.current !== null && foreground.current && latestIdentity.current === identity
        && sesijaSada().user?.id === accountId && sesijaSada().accountRevision === accountRevision,
      services: {
        read: () => needSearchRecoveryClientService.read(id, account),
        readReceipt: command => needSearchRecoveryClientService.readReceipt(command, account),
        reopen: command => needSearchRecoveryClientService.reopen(command, account),
        knownRefusal: knownSearchRecoveryRefusal,
      },
    });
    recoveryController.current = controller;
    const sync = () => setRecoveryView(controller.snapshot());
    const unsubscribe = controller.subscribe(sync);
    sync();
    void controller.load();
    return () => {
      unsubscribe();
      controller.dispose();
      if (recoveryController.current === controller) recoveryController.current = null;
    };
  }, [id, identity, accountId, accountRevision]);

  // What the gate said belongs to one revision of one task: another one forgets it. A plain read again (below) keeps it until the
  // new answer comes, so the page never shows the green review action for a moment in the middle of a wait.
  useEffect(() => { setReadiness(null); }, [potreba?.id, potreba?.revizija, potreba?.stanje, identity]);
  useEffect(() => {
    // Gated on the app's mode, this once never ran for an owner standing in the other mode, so his own draft answered
    // with the old promise "Sledeće: pregled i objava jednim korakom" - for a draft the publish gate
    // would have refused. Ownership is the server's business and it checks it.
    const draft = potreba && potreba.stanje === 'NACRT';
    if (!draft || !potreba) return;
    const scope = focus.current, lifeAt = life.current, ownedBy = latestIdentity.current;
    let alive = true;
    void needPublicationReadiness.read(potreba.id, potreba.revizija).then(result => {
      // A late answer must not land on another account, another task or another focus.
      if (!alive || focus.current !== scope || life.current !== lifeAt || latestIdentity.current !== ownedBy) return;
      setReadiness(result.ok ? result.podatak : { kind: 'UNKNOWN' });
    }, () => {});
    return () => { alive = false; };
  }, [potreba?.id, potreba?.revizija, potreba?.stanje, identity, lifecycle, readinessRun]);
  // This screen shows a Zadatak returned by the owner-only read, so whoever sees it owns it; the
  // server checks that again on every command. No app-wide mode stands in for that any more.
  const canAct = () => current() && !terminalActiveRef.current && !urgentActiveRef.current && !navigating.current
    && !editor.loading && !editor.busy && !editor.uncertain && !recoveryBusy && !!editor.data;
  const navigate = (action: () => void) => { if (!current() || navigating.current) return;
    dialog.current = null; retireConfirmation(); navigating.current = true; action(); };
  const refresh = () => { if (!current() || editor.busy) return; dialog.current = null; retireConfirmation();
    setReadinessRun(value => value + 1); void editor.refresh(); void recoveryController.current?.check(); };
  const urgent = useUrgentActivationActions({
    needId: id, need: potreba, disabled: akcijaUToku || ucitava || !!greska || terminalActive,
    onActiveChange: setUrgent, onRefresh: refresh,
  });
  // `danger` for a question whose confirm cannot be undone (closing the search), drawn like izvoz's withdrawals.
  const ask = (title: string, description: string, label: string, tone: 'default' | 'danger', command: () => Promise<void>,
    onCancel?: () => void) => {
    if (!canAct() || dialog.current) return;
    const confirmation = {}; dialog.current = confirmation;
    const cancel = () => { if (dialog.current === confirmation) dialog.current = null; onCancel?.(); };
    // The sheet waits on the command it started (a busy confirm; Back returns after a few seconds without cancelling it)
    // and shows no outcome of its own.
    confirmSheet.ask({ title, message: description, cancelLabel: 'Odustani', onCancel: cancel, confirmLabel: label, tone,
      onConfirm: () => { if (dialog.current !== confirmation || !canAct()) return;
        dialog.current = null; return command(); } });
  };
  const zatvoriPreostaluPotragu = () => {
    if (!canAct() || !potreba || preostalaPotragaZatvorena || potreba.pokrivenost.popunjeno <= 0 || potreba.pokrivenost.preostalo <= 0) return;
    // "za preostalih 1 mesta" counted the English way; the case follows the number.
    ask('Ne traži više nikoga?', `Zatvorićemo potragu za ${plural(potreba.pokrivenost.preostalo, 'preostalo mesto', 'preostala mesta', 'preostalih mesta')}. Postojeći Dogovori i prvobitni uslovi zadatka ostaju nepromenjeni.`,
      'Zatvori potragu', 'danger', async () => { await editor.save(async () => {
        const attempt = retainRemainingSearchCloseAttempt(closeAttempt.current, potreba.id, potreba.revizija, () => noviZahtevId('zatvori-preostalu-potragu'));
        closeAttempt.current = attempt;
        const result = await ru4Production.closeRemainingSearch(attempt.needId, attempt.revision, attempt.clientRequestId);
        if (!current()) return changed();
        if (!result.ok) return knownRemainingSearchRefusal(result.kod) ? result
          : failure('REMAINING_SEARCH_CLOSE_FAILED', 'Ne znamo da li je potraga zatvorena.');
        const after = await read();
        if (!current()) return changed();
        if (!after.ok) return after;
        if (after.podatak.remainingClosed) closeAttempt.current = null;
        return after.podatak.remainingClosed ? after
          : failure('REMAINING_SEARCH_CLOSE_NOT_CONFIRMED', 'Ne znamo da li je potraga zatvorena.');
      });
        if (current()) await recoveryController.current?.check();
      });
  };
  const openOwnedReview = async (destination: '/nova' | '/pregled-zadatka') => {
    if (!canAct() || !potreba || potreba.pokrivenost.popunjeno !== 0 || preostalaPotragaZatvorena || potreba.stanje === 'ZATVORENA') return;
    await editor.save(async () => {
      const result = await aiNeedV2Izvor.openEditConversation(potreba.id);
      if (!current()) return changed();
      if (!result.ok) return result;
      if (!sameId(result.podatak.needId, potreba.id) || !uuid(result.podatak.conversationId) || !positiveInteger(result.podatak.revision)
        || result.podatak.authoritative !== true || !['DRAFT', 'PUBLISHED', 'SELECTION'].includes(result.podatak.needStatus)) {
        return failure('NEED_EDIT_INVALID_RESPONSE', 'Ne znamo da li se izmena otvorila.');
      }
      if (result.podatak.revision !== potreba.revizija || (potreba.stanje === 'NACRT' && result.podatak.needStatus !== 'DRAFT')) {
        return failure('STALE_REVIEW_REQUIRED', 'Zadatak se promenio.');
      }
      navigate(() => router.push({ pathname: destination, params: { conversationId: result.podatak.conversationId } }));
      return { ok: true, podatak: editor.data! };
    });
  };
  const otvoriIzmenu = () => {
    if (!canAct() || !potreba) return;
    if (potreba.stanje === 'NACRT') { void openOwnedReview('/nova'); return; }
    ask('Izmena zadatka', 'Najpre pripremite izmene u razgovoru. Zadatak ostaje objavljen dok ih ne potvrdite u završnom pregledu.',
      'Izmeni zadatak', 'default', async () => openOwnedReview('/nova'));
  };
  const effectiveRecoveryView = recoveryView;
  // R3 recovery is additive authority: a temporary read failure must never make the whole owned task unreadable.
  // Until the owner-only R3 state is confirmed (or an immutable command journal exists), the legacy task surface remains unchanged.
  const recoveryCopy = recoveryView.snapshot || recoveryView.command ? needSearchRecoveryCopy(effectiveRecoveryView) : null;
  const routineClosed = effectiveRecoveryView.phase === 'READY' && effectiveRecoveryView.snapshot?.canReopen
    && recoveryCopy?.primary?.action === 'REOPEN';
  const recoveryPrimaryReady = !!recoveryView.snapshot || !!recoveryView.command;

  const handleRecoveryAction = (action: SearchRecoveryAction) => {
    const controller = recoveryController.current;
    if (!controller) return;
    if (action === 'AGREEMENTS') {
      if (canAct()) lifecycleMenu.current?.openAgreements();
      return;
    }
    if (action === 'CHECK') {
      void controller.check().then(() => { if (current()) void editor.refresh(); });
      return;
    }
    if (action === 'RETRY') {
      void controller.retry().then(() => { if (current()) void editor.refresh(); });
      return;
    }
    if (action === 'ACK') {
      void controller.acknowledge().then(() => { if (current()) void editor.refresh(); });
      return;
    }
    if (!canAct()) return;
    const command = controller.prepare();
    if (!command) return;
    const missing = controller.snapshot().snapshot?.missingSlots ?? potreba?.pokrivenost.preostalo ?? 0;
    ask('Ponovo traži ljude?', missing === 1
      ? `${missingPeople(missing)} Ponovo ćemo otvoriti potragu za tim mestom; postojeći Dogovori ostaju nepromenjeni.`
      : `${missingPeople(missing)} Ponovo ćemo otvoriti potragu samo za tim mestima; postojeći Dogovori ostaju nepromenjeni.`,
      'Nastavi potragu', 'default', async () => {
        await controller.submit(command);
        if (current()) await editor.refresh();
      }, () => controller.cancelReview());
  };

  // Cancelling and deleting sit behind the screen's "···" (owner step 5b, 2026-09-24). The menu only knocks: each press
  // passes this screen's fence and then the lifecycle's own guards, and the lifecycle asks, sends, persists and recovers
  // exactly as it did inline.
  const entries = needLifecycleEntries(potreba);
  // One way into deleting a draft, shared by the "···" row and the visible row of the draft's own screen (owner, 2026-10-07).
  const deleteDraft = entries.deleteDraft ? () => { if (canAct()) lifecycleMenu.current?.request('DELETE_DRAFT'); } : undefined;
  const lifecycleMenuActions: SheetAction[] = [
    ...(urgent.entry ? [urgent.entry] : []),
    // A task with agreed places cannot be cancelled as a whole, and the menu says why where it is seen, not only to a
    // screen reader: the line under the row replaces the inline sentence the lifecycle used to draw.
    ...(entries.agreements ? [{ key: 'agreements', label: 'Otvori moje Dogovore', icon: 'agreements' as const, subtitle: 'Postojeći Dogovori se otkazuju zasebno.',
      onPress: () => { if (canAct()) lifecycleMenu.current?.openAgreements(); } }] : []),
    ...(deleteDraft ? [{ key: 'delete-draft', label: 'Obriši nacrt', icon: 'document' as const, destructive: true, onPress: deleteDraft }] : []),
    ...(entries.cancel ? [{ key: 'cancel', label: 'Otkaži zadatak', icon: 'tasks' as const, destructive: true,
      onPress: () => { if (canAct()) lifecycleMenu.current?.request('CANCEL'); } }] : []),
  ];

  // Answering and the whole thread of questions are one screen with its own journal and recovery; the section opens it by the
  // same route the link it replaced used, through this screen's own fence like every other way out of it. `own` says whose
  // task this is, so that the arrow with nothing behind it comes back here.
  const openQuestions = (questionId?: string) => {
    if (potreba && canAct()) navigate(() => router.push({ pathname: '/pitanja-zadatka', params: { needId: potreba.id, own: '1', ...(questionId ? { questionId } : {}) } }));
  };

  const ownerDisplayName = ownerIdentity?.ime?.trim() ? `${ownerIdentity.ime.trim()} (Vi)` : 'Vi (Domaćin zadatka)';
  const ownerRating = ownerReputation && typeof ownerReputation.averageRating === 'number' && Number.isFinite(ownerReputation.averageRating)
    ? ratingText(ownerReputation.averageRating)
    : null;
  const ownerReviewCount = ownerReputation && typeof ownerReputation.reviewCount === 'number'
    ? ownerReputation.reviewCount
    : null;
  const ownerAvatar = <Avatar initials={inicijali(ownerIdentity?.ime)} size={56} />;

  return <><NeedPresentation key={`${potreba?.id ?? id}:${potreba?.revizija ?? ''}`} need={potreba} loading={ucitava}
    photos={potreba ? <NeedPhotos needId={potreba.id} owned /> : undefined}
    map={potreba?.priblizno && !ucitava && !greska
      ? <LocationMapPreview points={[{ id: 'area', label: 'Približno mesto', latitude: potreba.priblizno.lat, longitude: potreba.priblizno.lng }]} coarse height={184}
        scopeKey={`potreba:${potreba.id}:${potreba.revizija}:${potreba.priblizno.lat}:${potreba.priblizno.lng}`} />
      : undefined}
    publisher={potreba && !ucitava && !greska ? <TaskDecisionPublisher
      name={ownerDisplayName}
      rating={ownerRating}
      count={ownerReviewCount}
      reliabilityPercent={ownerReliabilityPercent}
      initials={inicijali(ownerIdentity?.ime)}
      photo={ownerIdentity?.profileId ? <ProfilePhoto profileId={ownerIdentity.profileId} size={56} fallback={ownerAvatar} own /> : ownerAvatar}
      onPress={() => { if (canAct()) navigate(() => router.navigate('/profil')); }}
      disabled={!canAct()}
    /> : undefined}
    qaAction={potreba && publicNeedId && questions.state.phase !== 'idle'
      ? <TaskQaInline key={`${accountId}:${accountRevision}:${potreba.id}`} state={questions.state}
        disabled={!canAct()} onRetry={questions.retry} onAsk={() => openQuestions()} onAnswer={openQuestions} onOpenAll={() => openQuestions()} /> : undefined}
    onShare={potreba && potreba.stanje !== 'NACRT' ? () => { void Share.share({ message: taskShareMessage(potreba) }, { dialogTitle: 'Podeli zadatak' }).catch(() => {}); } : undefined}
    lifecycleActions={uuid(id) ? <>
      <UrgentActivationActions control={urgent} />
      <NeedLifecycleActions need={potreba} needId={id} menu={lifecycleMenu}
        disabled={akcijaUToku || ucitava || !!greska || urgentActive} onActiveChange={setTerminal} onRefresh={refresh} />
      {recoveryCopy && !routineClosed ? <NeedSearchRecoverySection copy={recoveryCopy}
        disabled={akcijaUToku || terminalActive || urgentActive} onAction={handleRecoveryAction} /> : null}
    </> : undefined}
    lifecycleMenu={lifecycleMenuActions} onDeleteDraft={deleteDraft}
    primaryOverride={recoveryCopy?.primary ? {
      label: recoveryCopy.primary.label,
      disabled: !!recoveryCopy.primary.disabled || !recoveryPrimaryReady || recoveryBusy,
      arrow: recoveryCopy.primary.action === 'REOPEN' || recoveryCopy.primary.action === 'AGREEMENTS',
      onPress: () => handleRecoveryAction(recoveryCopy.primary!.action),
    } : undefined}
    error={greska} busy={akcijaUToku || terminalActive || urgentActive} remainingClosed={preostalaPotragaZatvorena}
    readiness={readiness}
    // R16 (F3's `noApplicationsHelp`): the page says "Nema prijava već 24 sata" only when the read can tell the truth. Today the owner's read of a
    // task carries neither `publishedAt` nor the photo count, so the answer is null; the day the server gives them (and the switch is on), the
    // rows appear. Every one of the ways is a change of the task, which the edit asks about before it opens.
    waitingHelp={potreba ? noApplicationsHelp({
      need: potreba,
      publishedAt: potreba.objavljeno ?? null,
      photoCount: potreba.brojFotografija ?? 0,
      canEdit: potreba.pokrivenost.popunjeno === 0 && !preostalaPotragaZatvorena && potreba.stanje !== 'ZATVORENA',
    }) : null}
    onWaitingHelp={otvoriIzmenu}
    // What the page may say about the search for the missing places comes only from what this screen already read (the R3 state):
    // "Dogovor je otkazan" and "Tvoj zadatak opet prima prijave" never from a guess. `speaks` is true while the recovery section is
    // drawn, and then the section says the search itself.
    search={{ state: recoveryView.snapshot, speaks: !!recoveryCopy && !routineClosed }}
    onAgreements={entries.agreements ? () => { if (canAct()) lifecycleMenu.current?.openAgreements(); } : undefined}
    // Opened from a notification on a cold start there is nothing behind this screen; the arrow then
    // lands on the person's own tasks instead of doing nothing.
    onBack={() => navigate(() => router.canGoBack() ? router.back() : router.replace('/potrebe'))} onRefresh={refresh} onReview={() => { void openOwnedReview('/pregled-zadatka'); }} onEdit={otvoriIzmenu} onCloseRemaining={zatvoriPreostaluPotragu}
    onCandidates={() => navigate(() => router.push({ pathname: '/potrebe/[id]/kandidati', params: { id } }))} />{confirmSheet.sheet}{urgent.sheet}</>;
}
