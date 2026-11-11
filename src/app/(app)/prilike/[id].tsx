import { Share } from 'react-native';
import { PublicNeedPresentation } from '../../../ui/v2/PublicNeedPresentation';
import { taskShareMessage } from '../../../ui/v2/detail/taskShare';
import { useTaskFit } from '../../../ui/v2/detail/useTaskFit';
import { usePublicWorkTrust } from '../../../ui/profile/usePublicWorkTrust';
import { publicTrustFacts } from '../../../ui/profile/workTrustModel';
import { NeedPhotos, ProfilePhoto } from '../../../ui/media/ContextPhotos';
import { LocationMapPreview } from '../../../ui/location/LocationMapPreview';
import { TaskQaInline } from '../../../ui/qa/TaskQaInline';
import { useTaskQaInline } from '../../../ui/qa/useTaskQaInline';
import type { PublicProfileState } from '../../../ui/system/PublicProfileSheet';
import { Avatar } from '../../../ui/system/Avatar';
import { useSafetyEntry } from '../../../ui/safety/useSafetyEntry';
import { inicijali } from '../../../lib/inicijali';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useIzvor } from '../../../store/uloga';
import type { TaskRelation } from '../../../data/taskRelation';
import { useSesija, sesijaSada } from '../../../store/sesija';
import { useFocusedResource } from '../../../hooks/useFocusedResource';
import type { PrilikaProjekcija } from '../../../contracts/projections';

type ActionScope = { id: string | null; accountId: string | undefined; accountRevision: number; busy: boolean; refreshing: boolean };

export default function PrilikaDetaljiEkran() {
  const params = useLocalSearchParams<{ id: string | string[] }>();
  const id = typeof params.id === 'string' && params.id.trim() ? params.id : null;
  const router = useRouter();
  const izvor = useIzvor();
  const { user, accountRevision } = useSesija();
  const accountId = user?.id;
  const readRequest = useRef(0);
  const readCancellations = useRef(new Set<() => void>());
  const load = useCallback(async () => {
    const request = ++readRequest.current;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let cancel: (() => void) | undefined;
    let prilika: PrilikaProjekcija | null;
    // What I am to this task is read beside the task, and since PKG-023b for this task alone.
    // It can fail on its own without taking the task with it; it then reads as UNKNOWN, never NONE.
    const relationRead: Promise<TaskRelation> | null = id
      ? izvor.odnosiPremaZadacima([id]).then(index => index.relation(id), () => ({ kind: 'UNKNOWN' }))
      : null;
    try {
      prilika = id ? await Promise.race([izvor.prilika(id), new Promise<never>((_, reject) => {
        cancel = () => reject(new Error('TASK_READ_RETIRED'));
        readCancellations.current.add(cancel);
        timer = setTimeout(() => reject(new Error('TASK_READ_TIMEOUT')), 15_000);
      })]) : null;
    } finally { if (timer !== undefined) clearTimeout(timer); if (cancel) readCancellations.current.delete(cancel); }
    if (sesijaSada().accountRevision !== accountRevision || sesijaSada().user?.id !== accountId) throw new Error('STALE_TASK_READ');
    const relation: TaskRelation = relationRead ? await relationRead : { kind: 'UNKNOWN' };
    if (sesijaSada().accountRevision !== accountRevision || sesijaSada().user?.id !== accountId) throw new Error('STALE_TASK_READ');
    return { prilika, request, relation };
  }, [id, izvor, accountId, accountRevision]);
  useEffect(() => () => { readCancellations.current.forEach(cancel => cancel()); readCancellations.current.clear(); }, [load]);
  const resource = useFocusedResource(load);
  // The cache is display-only and cannot survive a task/source or account-incarnation change.
  // Same-account token refresh does not change who may see this task or remount its presentation.
  const cache = useMemo(() => ({ data: null as PrilikaProjekcija | null }), [load]);
  const fresh = resource.data?.prilika?.id === id ? resource.data.prilika : null;
  const deadlineAt = fresh?.rokZaPrijaveIso === null ? null
    : typeof fresh?.rokZaPrijaveIso === 'string' ? Date.parse(fresh.rokZaPrijaveIso) : undefined;
  const [deadlineTick, setDeadlineTick] = useState(0);
  const deadlineOpen = () => deadlineAt === null || (typeof deadlineAt === 'number' && deadlineAt > Date.now());
  // Only a real, passed server deadline is named as the reason; an unknown or unreadable one is not a deadline.
  const deadlinePassed = typeof deadlineAt === 'number' && Number.isFinite(deadlineAt) && deadlineAt <= Date.now();
  useFocusEffect(useCallback(() => {
    if (typeof deadlineAt !== 'number' || !Number.isFinite(deadlineAt)) return;
    const remaining = deadlineAt - Date.now();
    if (remaining <= 0) return;
    // Long deadlines are rechecked before scheduling another bounded timer.
    const timer = setTimeout(() => setDeadlineTick(tick => tick + 1), Math.min(remaining, 2_147_483_647));
    return () => clearTimeout(timer);
  }, [deadlineAt, deadlineTick]));
  useEffect(() => {
    if (!resource.loading && !resource.error) cache.data = fresh;
  }, [cache, fresh, resource.loading, resource.error]);
  const prilika = fresh ?? ((resource.loading || resource.error) ? cache.data : null);
  const relation: TaskRelation = fresh && resource.data ? resource.data.relation : { kind: 'UNKNOWN' };
  // What people asked about this task and what its owner answered is read here, beside the task, and not where it is drawn:
  // the section is hidden while the task reads again, and what was read must survive that. It reads once there is a task
  // to ask about, and a failed read stays on the section; it never takes the task with it.
  const questions = useTaskQaInline(prilika ? prilika.id : null);
  // R25: what my own Dogovori and my work area say about this task, read beside it for a task I have not applied to; the page is whole without it.
  const fit = useTaskFit({ prilika: fresh && !resource.loading && !resource.error ? fresh : null, relation, izvor, accountId, accountRevision });
  // "Dolazi kako je dogovoreno": how reliably the person who posted this task comes as agreed, as the server says it (the public work-trust read), beside the task and
  // never in front of it. Only a percentage is passed on: a person with too few Dogovori, a hidden figure (the default today) and a read that failed or answered nothing are
  // all nothing here, and no number is made up.
  const trust = usePublicWorkTrust(fresh && !resource.loading && !resource.error ? fresh.narucilacProfilId : null);
  const reliability = publicTrustFacts(trust)?.reliability;
  const reliabilityPercent = reliability?.kind === 'percent' ? reliability.percent : null;
  const scopeRef = useRef<ActionScope | null>(null);
  const [busy, setBusy] = useState(false);

  useFocusEffect(useCallback(() => {
    const scope: ActionScope = { id, accountId, accountRevision, busy: false, refreshing: false };
    scopeRef.current = scope;
    setBusy(false);
    return () => { if (scopeRef.current === scope) scopeRef.current = null; };
  }, [id, accountId, accountRevision]));

  function currentScope() {
    const scope = scopeRef.current;
    const session = sesijaSada();
    if (!scope || scope.id !== id || scope.accountId !== accountId || scope.accountRevision !== accountRevision
      || !accountId || session.user?.id !== accountId || session.accountRevision !== accountRevision) return null;
    return scope;
  }

  function navigate(action: () => void) {
    const scope = currentScope();
    if (!scope || scope.busy) return;
    scope.busy = true;
    setBusy(true);
    action();
  }

  function retry() {
    const scope = currentScope();
    if (!scope || scope.busy || scope.refreshing) return;
    scope.refreshing = true;
    void resource.refresh().finally(() => { if (scopeRef.current === scope) scope.refreshing = false; });
  }

  function compose() {
    // A saved press from before refresh/blur/id/account change cannot navigate.
    if (!fresh || resource.loading || resource.error || resource.data?.request !== readRequest.current
      || fresh.primaNovePrijave !== true || !deadlineOpen() || relation.kind !== 'NONE') return;
    navigate(() => router.navigate({ pathname: '/prilike/[id]/prijava', params: { id: fresh.id } }));
  }

  // Asking, answering and the whole thread are one screen with its own journal and recovery. The section opens it by the
  // same route the link it replaced used, once, and never from a press kept from before this screen read its task again.
  // Whose task it is comes with the link: the server's own answer (the owner's thread or the public one), never a mode.
  function openQuestions(questionId?: string) {
    if (!fresh || resource.data?.request !== readRequest.current || !currentScope()) return;
    const own = questions.state.phase === 'ready' && questions.state.viewer === 'OWNER' ? '1' : '0';
    navigate(() => router.navigate({ pathname: '/pitanja-zadatka', params: { needId: fresh.id, own, ...(questionId ? { questionId } : {}) } }));
  }

  // Owner decision 3 (2026-09-16): the requester's public profile is a sheet over the
  // existing `javniProfil` read; opened only by an explicit press, retired with the scope.
  const [requesterProfile, setRequesterProfile] = useState<PublicProfileState>(null);
  const profileRequest = useRef(0);
  useEffect(() => { profileRequest.current++; setRequesterProfile(null); }, [id, accountId, accountRevision]);
  useEffect(() => () => { profileRequest.current++; }, []);
  function openRequesterProfile() {
    const scope = currentScope();
    if (!scope || !fresh || resource.data?.request !== readRequest.current || requesterProfile?.loading) return;
    const request = ++profileRequest.current, profileId = fresh.narucilacProfilId;
    // An error from the "···" attempt belongs to the task: the profile opens without it, before anything is pressed there.
    setSafetyError(null);
    setRequesterProfile({ loading: true, data: null });
    void izvor.javniProfil(profileId)
      .then(value => { if (request === profileRequest.current && currentScope()) setRequesterProfile({ loading: false, data: value?.profilId === profileId ? value : null }); })
      .catch(() => { if (request === profileRequest.current && currentScope()) setRequesterProfile({ loading: false, data: null }); });
  }
  // F05: the poster is a person, not a profile; the server resolves the target before bezbednost opens.
  const safetyEntry = useSafetyEntry(fresh?.narucilacProfilId, { needId: fresh?.id ?? null });
  // The entry keeps its last error until the next press. The screen takes it only when an attempt finishes (busy goes from
  // true to false; the hook sets both in one callback, so they arrive in one render) and lets it go when the person moves
  // on: when the profile opens or closes (the sheet says its own) and when the screen comes back into focus. An entry that
  // comes back with its old error after the task was read again from empty is not an attempt, so it says nothing (review
  // r3b). A new attempt that fails the same way is said again.
  const [safetyError, setSafetyError] = useState<string | null>(null);
  const safetyWasBusy = useRef(false);
  useEffect(() => {
    const busyNow = !!safetyEntry?.busy;
    if (safetyWasBusy.current && !busyNow) setSafetyError(safetyEntry?.error ?? null);
    safetyWasBusy.current = busyNow;
  }, [safetyEntry?.busy, safetyEntry?.error]);
  useFocusEffect(useCallback(() => { setSafetyError(null); }, []));
  const safety = safetyEntry ? { ...safetyEntry, error: safetyError } : undefined;
  function closeRequesterProfile() { profileRequest.current++; setRequesterProfile(null); setSafetyError(null); }

  return <PublicNeedPresentation key={`${accountId}:${accountRevision}:${id}`}
    qa={fresh && !resource.loading && !resource.error && questions.state.phase !== 'idle' ? <TaskQaInline key={`${accountId}:${accountRevision}:${fresh.id}`} state={questions.state}
      disabled={busy} onRetry={questions.retry} onAsk={() => openQuestions()} onAnswer={openQuestions} onOpenAll={() => openQuestions()} /> : undefined}
    photos={fresh && !resource.loading && !resource.error ? <NeedPhotos needId={fresh.id} /> : undefined}
    map={fresh && fresh.priblizno && !resource.loading && !resource.error
      ? <LocationMapPreview points={[{ id: 'area', label: 'Približno mesto', latitude: fresh.priblizno.lat, longitude: fresh.priblizno.lng }]} coarse height={184}
        scopeKey={`${accountId}:${accountRevision}:${fresh.id}:${fresh.priblizno.lat}:${fresh.priblizno.lng}`} />
      : undefined}
    need={prilika} fit={fit} reliabilityPercent={reliabilityPercent} loading={!!id && resource.loading} error={!!resource.error} missing={!fresh}
    stale={!!prilika && (resource.loading || !!resource.error)} busy={busy} canRetry={!!id}
    canApply={!!fresh && fresh.primaNovePrijave === true && deadlineOpen() && relation.kind === 'NONE'}
    deadlinePassed={deadlinePassed}
    // When applying is not possible the screen says why and leads back to the other tasks, never to a dead end.
    onOtherTasks={() => navigate(() => router.navigate('/zadaci'))}
    relation={fresh ? relation : { kind: 'UNKNOWN' }}
    onOwnTask={() => { if (fresh && relation.kind === 'OWNER') navigate(() => router.navigate({ pathname: '/potrebe/[id]/pregled', params: { id: fresh.id } })); }}
    onOwnApplication={() => { if (relation.kind !== 'APPLIED') return;
      const { agreementId, applicationId } = relation;
      navigate(() => agreementId ? router.navigate({ pathname: '/dogovor/[id]', params: { id: agreementId } })
        : router.navigate({ pathname: '/moje-prijave', params: { prijavaId: applicationId } })); }}
    back={() => navigate(() => router.canGoBack() ? router.back() : router.replace('/zadaci'))}
    retry={retry} apply={compose}
    // The system's share sheet, with the task's name and its public area only; a dismissed sheet is not an error, so nothing is said about it.
    onShare={fresh ? () => { void Share.share({ message: taskShareMessage(fresh) }, { dialogTitle: 'Podeli zadatak' }).catch(() => {}); } : undefined}
    onRequesterProfile={fresh ? openRequesterProfile : undefined} requesterProfile={requesterProfile} onCloseRequesterProfile={closeRequesterProfile}
    safety={safety}
    // The poster row asks for 56 px, the profile sheet for its large portrait. Without a photo, or while it cannot be
    // read, the row shows the one Avatar with the poster's letters (a drawn person when there is no name), as every
    // other person row does; ProfilePhoto's own stand-in drew a 15 px glyph there. The letters come from the copy on
    // screen, so the last loaded copy shown during a reload or after a failed read keeps them beside the name (review r3b).
    publicPhoto={(profileId, size) => <ProfilePhoto profileId={profileId} size={size ?? 96} initial={null}
      fallback={size === 32 || size === 56 ? <Avatar size={size}
        initials={prilika && profileId === prilika.narucilacProfilId ? inicijali(prilika.narucilacIme) : null} /> : undefined} />} />;
}
