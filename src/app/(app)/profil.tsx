import { useCallback, useEffect, useRef, useState } from 'react';
import { router, useFocusEffect } from 'expo-router';
import type { JavniProfilProjekcija } from '../../contracts/projections';
import { sesijaSada, useSesija } from '../../store/sesija';
import { useIzvor } from '../../store/uloga';
import { ownProfileClientService, type OwnProfileIdentity } from '../../data/ownProfileClientService';
import { publicProfileClientService } from '../../data/publicProfileClientService';
import { useFocusedResource } from '../../hooks/useFocusedResource';
import { useWorkerExecutionModes } from '../../hooks/useWorkerExecutionModes';
import { AccountReputation } from '../../ui/reviews/AccountReputation';
import { ProfilePhoto } from '../../ui/media/ContextPhotos';
import { ProfileWorkSummary } from '../../ui/profile/ProfileWorkSummary';
import { workerAreasLabel, type WorkerArea } from '../../contracts/workerAreas';
import { cityLabel } from '../../ui/profile/cityLabel';
import { hubWords } from '../../ui/profile/hubStates';
import { useHubStates, type HubStateKey } from '../../ui/profile/useHubStates';
import { workProfileSummary } from '../../ui/profile/workProfileSummary';
import { Avatar } from '../../ui/system/Avatar';
import { PublicProfileSheet, type PublicProfileState } from '../../ui/system/PublicProfileSheet';
import { inicijali } from '../../lib/inicijali';
import { PROFILE_AVATAR, ProfileHub, type ProfileHubIdentity, type ProfileHubPath } from '../../ui/profile/ProfileHubPresentation';

type ActionScope = { accountId: string; accountRevision: number; busy: boolean };
/** The rows that say their own state (open requests, blocked people, the export, the legal documents); read apart from the profile, so none of them can hold it up. */
const STATE_ROWS: readonly HubStateKey[] = ['support'];
/** The work profile as the hub reads it: the account's own row, with the facts its one line needs (skills, workAreas and radius). */
type WorkCapability = OwnProfileIdentity & { vestine?: string[]; radijusKm?: number; workAreas?: WorkerArea[] };

export default function Profil() {
  const { user, accountRevision } = useSesija();
  const accountId = user?.id;
  const izvor = useIzvor();
  // One account has one identity and, beside it, how it can help (owner decision 1, 2026-09-19).
  // The hub used to be two hubs chosen by a global mode, with a switch between them. It now reads
  // both of the account's own profile rows: the one tasks are published under carries the name and
  // the photo, the other says whether tasks can be offered to this person at all. The work profile is
  // read by its own projection (the one the work profile screen reads), because its one line on the hub
  // names its skills and area as well as its state (owner's phone, 8 Oct 2026).
  const loadIdentity = useCallback(() => ownProfileClientService.read(accountId ?? '', 'narucilac'), [accountId]);
  const loadCapability = useCallback(async (): Promise<WorkCapability | null> => {
    const worker = await izvor.mojRadnikProfil();
    const capability: WorkCapability | null = worker ? { accountId: accountId ?? '', profileId: worker.id, kind: 'WORKER', ime: worker.ime.trim() || null,
      grad: worker.grad.trim() || null, stanje: worker.stanje, vestine: worker.vestine, radijusKm: worker.radijusKm,
      ...(worker.workAreas?.length ? { workAreas: worker.workAreas } : {}) } : null;
    return capability;
  }, [accountId, izvor]);
  const requesterRead = useFocusedResource(loadIdentity);
  const capabilityRead = useFocusedResource(loadCapability);
  const executionModes = useWorkerExecutionModes(capabilityRead.data?.profileId ?? null);
  const words = hubWords(useHubStates(STATE_ROWS));
  const actionScope = useRef<ActionScope | null>(null);
  const [renderedScope, setRenderedScope] = useState<ActionScope | null>(null);
  const [busy, setBusy] = useState(false);
  // "Kako te drugi vide" (Airbnb's standard): the person's own public profile, as a sheet over this screen. Opened only by an explicit
  // press and retired with the focus and the account, like every sheet of a read that can arrive late.
  const [publicView, setPublicView] = useState<PublicProfileState>(null);
  const publicRequest = useRef(0);
  useEffect(() => { publicRequest.current++; setPublicView(null); }, [accountId, accountRevision]);

  useFocusEffect(useCallback(() => {
    const scope: ActionScope | null = accountId ? { accountId, accountRevision, busy: false } : null;
    actionScope.current = scope;
    setRenderedScope(scope);
    setBusy(false);
    return () => { if (actionScope.current === scope) actionScope.current = null; publicRequest.current++; setPublicView(null); };
  }, [accountId, accountRevision]));

  function isCurrent(scope: ActionScope) {
    return actionScope.current === scope && sesijaSada().user?.id === scope.accountId &&
      sesijaSada().accountRevision === scope.accountRevision;
  }

  function beginAction() {
    // A retained callback belongs to the visit that rendered it, never a later account or focus.
    const scope = renderedScope;
    if (!scope || scope.busy || !isCurrent(scope)) return null;
    scope.busy = true;
    setBusy(true);
    return scope;
  }

  function navigate(action: () => void) {
    if (!beginAction()) return;
    action();
  }

  function retryRead(refresh: () => Promise<void>) {
    const scope = renderedScope;
    if (!scope || scope.busy || !isCurrent(scope)) return;
    void refresh();
  }

  const requesterMissing = !requesterRead.loading && !requesterRead.error && requesterRead.data === null;
  const identity: OwnProfileIdentity | null = requesterRead.data ??
    (requesterMissing && !capabilityRead.loading && !capabilityRead.error ? capabilityRead.data : null);
  const capability = capabilityRead.loading || capabilityRead.error ? null : capabilityRead.data;
  // Most accounts have a requester row. If that row is genuinely absent, wait for the work row
  // before deciding whether a fallback identity exists. A failed optional work read is never "no profile".
  const identityLoading = requesterRead.loading || (requesterMissing && capabilityRead.loading);
  const identityError = requesterRead.error || (requesterMissing && capabilityRead.error);
  const retryIdentity = requesterRead.error ? requesterRead.refresh : capabilityRead.refresh;
  const capabilityDetail = capabilityRead.loading ? 'Učitavamo radni profil…'
    : capabilityRead.error ? 'Radni profil trenutno nije dostupan.'
      : workProfileSummary(capability, executionModes.view);
  const photoReady = !!identity?.profileId && !identityLoading && !identityError;
  const openPhoto = () => { const id = identity?.profileId; if (!id || identityLoading || identityError) return;
    navigate(() => router.push({ pathname: '/profil/fotografija', params: { profileId: id } })); };
  // Sentences that mean something lead to the place (T4a, 2026-10-07): the rating line to "Ocene", "Završeni Dogovori" to the
  // Dogovori, on the section that holds the finished ones ("istorija"; the Dogovori screen takes it as `odeljak`).
  const openRatings = () => navigate(() => router.navigate('/profil/ocene'));
  const openFinished = () => navigate(() => router.navigate({ pathname: '/dogovori', params: { odeljak: 'istorija' } }));
  // The one Avatar at its header size, with the one way to take letters from a name; no name draws a person.
  const avatar = <Avatar initials={inicijali(identity?.ime)} size={PROFILE_AVATAR} />;
  // A city is shown as a city is written: typed as "NovI SAD" or "Novi sad" it reads "Novi Sad" here. Display only; the profile keeps what was typed.
  const city = identity?.grad?.trim() || capability?.grad?.trim();
  const placeText = capability?.workAreas?.length ? workerAreasLabel(capability.workAreas) : (city ? cityLabel(city) : null);
  // Others read the person as the one who helps (the work profile) once it is active, and as the one who asks otherwise.
  const publicProfileId = (capability?.stanje === 'ACTIVE' ? capability.profileId : null) ?? identity?.profileId ?? null;
  function openPublicProfile() {
    const scope = renderedScope, profileId = publicProfileId;
    if (!scope || scope.busy || !isCurrent(scope) || !profileId || publicView?.loading) return;
    const request = ++publicRequest.current;
    setPublicView({ loading: true, data: null });
    const settle = (data: JavniProfilProjekcija | null, notFound = false) => {
      if (request === publicRequest.current && isCurrent(scope)) setPublicView({ loading: false, data, ...(notFound ? { notFound: true } : {}) });
    };
    void publicProfileClientService.javniProfil(profileId)
      .then(value => settle(value?.profilId === profileId ? value : null, value === null)).catch(() => settle(null));
  }
  const closePublicProfile = () => { publicRequest.current++; setPublicView(null); };
  const hubIdentity: ProfileHubIdentity = identityLoading ? { state: 'loading' }
    : identityError ? { state: 'error', retry: () => retryRead(retryIdentity) }
      : { state: 'ready', name: identity?.ime || null,
        // The place under the name is the one the account really has: work areas when configured, or else the city.
        // Nothing in the app sets the requester's city, so "Grad još nije unet" invited an action that did not exist.
        place: placeText,
        photo: identity?.profileId ? <ProfilePhoto profileId={identity.profileId} size={PROFILE_AVATAR} fallback={avatar} own /> : avatar,
        // The rating line is a way in: it opens "Ocene" (what the person received and gave, and with D12 the comments about them).
        photoReady, openPhoto, reputation: accountId
          ? <AccountReputation accountId={accountId} onOpen={openRatings} /> : null };

  // Something waits for the person when the work profile is not set up or is still a draft: the row says so with its dot (and says nothing while it reads).
  const capabilityNeedsAttention = !capabilityRead.loading && !capabilityRead.error && (!capability || capability.stanje === 'DRAFT');
  return <ProfileHub identity={hubIdentity} capabilityDetail={capabilityDetail} capabilityNeedsAttention={capabilityNeedsAttention}
    capabilityError={capabilityRead.error} onRetryCapability={() => retryRead(capabilityRead.refresh)}
    busy={busy} words={words}
    workSummary={hubIdentity.state === 'ready' ? <ProfileWorkSummary
      requesterProfileId={identity?.kind === 'REQUESTER' ? identity.profileId : null}
      workerProfileId={capability?.profileId ?? null} onOpen={openFinished} /> : undefined}
    onViewPublic={hubIdentity.state === 'ready' && publicProfileId ? openPublicProfile : undefined}
    sheet={publicView ? <PublicProfileSheet state={publicView} onClose={closePublicProfile} onRetry={openPublicProfile}
      photo={(profileId, size) => <ProfilePhoto profileId={profileId} size={size} initial={identity?.ime} own />} /> : undefined}
    open={(path: ProfileHubPath) => navigate(() => router.navigate(path))}
    onBack={() => navigate(() => router.canGoBack() ? router.back() : router.replace('/'))} />;
}
