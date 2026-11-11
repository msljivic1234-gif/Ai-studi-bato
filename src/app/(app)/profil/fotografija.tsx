import { useCallback, useRef, useState } from 'react';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { mediaClientService, type MediaAsset, type ProfileAvatar } from '../../../data/mediaClientService';
import { replaceAvatarIntent } from '../../../data/avatarIntentJournal';
import { PHOTO_PERMISSION_MESSAGE, pickPreparedPhoto, photoSelectionMessage, type PreparedPhoto, type PhotoSource } from '../../../features/media/nativePhotoPicker';
import { ownProfileClientService } from '../../../data/ownProfileClientService';
import { useFocusedResource } from '../../../hooks/useFocusedResource';
import { useOwnedEditor } from '../../../hooks/useOwnedEditor';
import { inicijali } from '../../../lib/inicijali';
import { sesijaSada, useSesija } from '../../../store/sesija';
import { noviUuidZahtevId } from '../../../lib/idempotencija';
import { failure, record, sameId, uuid } from '../../../data/serverReceipt';
import type { Ishod } from '../../../data/ports';
import { mediaAssetId } from '../../../ui/media/AuthorizedPhoto';
import { ownPhotoCache } from '../../../ui/media/ownPhotoCache';
import { useConfirmSheet } from '../../../ui/system/ConfirmSheet';
import { ProfilePhotoEditor, type ProfilePhotoMode, type ProfilePhotoRunning, type ProfilePhotoStage } from '../../../ui/profile/ProfilePhotoPresentation';

/** Which command this screen started, only so its own button can show that it runs. No guard ever reads it. */
type Running = ProfilePhotoRunning;

type Intent = { phase: 'UPLOAD' | 'APPLY' | 'CLEAR' | 'DISCARD'; requestId: string | null; assetId: string | null; expectedPath: string | null };
type Snapshot = { profile: ProfileAvatar; asset: MediaAsset | null; intent: Intent | null };
const changed = () => failure('MEDIA_SCOPE_CHANGED', 'Ponovo otvori fotografiju za trenutni profil.');
/** A saved change of the photograph makes what the app remembers of the old one (`ownPhotoCache`) of no use, whether or not this screen is still in front when the answer comes. */
const saved = <T extends Ishod<unknown>>(result: T): T => { if (result.ok) ownPhotoCache.forget(); return result; };
function decodeIntent(value: string | null): Intent | null {
  if (value === null) return null;
  const v = record(JSON.parse(value));
  if (!v || Object.keys(v).length !== 4 || !['UPLOAD', 'APPLY', 'CLEAR', 'DISCARD'].includes(String(v.phase))
    || (v.phase === 'CLEAR' ? v.requestId !== null || v.assetId !== null : !uuid(v.requestId))
    || ((v.phase === 'APPLY' || v.phase === 'DISCARD') && !uuid(v.assetId)) || (v.phase === 'UPLOAD' && v.assetId !== null)
    || (v.expectedPath !== null && (typeof v.expectedPath !== 'string' || v.expectedPath.length > 2000))) throw new Error('invalid intent');
  return v as Intent;
}
export default function AvatarRoute() {
  const params = useLocalSearchParams<{ profileId?: string }>(), { user, accountRevision } = useSesija();
  const id = typeof params.profileId === 'string' && uuid(params.profileId) ? params.profileId : null;
  return <AvatarEditor key={`${user?.id}:${accountRevision}:${id}`} profileId={id} />;
}
function AvatarEditor({ profileId }: { profileId: string | null }) {
  const { user, accountRevision } = useSesija(), accountId = user?.id;
  const key = accountId && profileId ? `uskoci:media-upload:${accountId}:AVATAR:${profileId}` : null;
  const focus = useRef<object | null>(null), bytes = useRef<PreparedPhoto | null>(null), abort = useRef<AbortController | null>(null);
  const intent = useRef<Intent | null>(null), readAttempted = useRef(false), navigating = useRef(false);
  const storedIntent = useRef<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  // A refusal on the phone itself, before anything is journaled or sent (camera permission, a file over 10 MB, a picture
  // that could not be prepared): there is nothing to reconcile, so the choice stays open under the message, which names
  // what still works (review of step 9, 2026-09-24). The next command or a read clears it.
  const [pickError, setPickError] = useState<string | null>(null);
  // Presentation only: which button shows its spinner. A newer command owns it, so an older one finishing late cannot clear it.
  const [running, setRunning] = useState<Running>(null), runSeq = useRef(0);
  // Presentation only: the chosen picture is journaled and on its way, so the circle can say so while the spinner runs.
  const [sending, setSending] = useState(false);
  const confirm = useConfirmSheet();
  // The letters that stand in the circle while the picture is on its way (J13): the name of the profile this screen is about. A read that
  // fails, or a name that belongs to another profile, says nothing, and the circle draws a person.
  const who = useFocusedResource(useCallback(() => ownProfileClientService.read(accountId ?? '', 'narucilac'), [accountId]));
  const initials = who.data && who.data.profileId === profileId ? inicijali(who.data.ime) : null;
  const owns = useCallback(() => !!accountId && sesijaSada().user?.id === accountId && sesijaSada().accountRevision === accountRevision,
    [accountId, accountRevision]);
  useFocusEffect(useCallback(() => { const token = {}; focus.current = token; navigating.current = false; setPickError(null);
    return () => { if (focus.current === token) focus.current = null; bytes.current = null; abort.current?.abort(); };
  }, [owns, profileId]));
  const read = useCallback(async (): Promise<Ishod<Snapshot>> => {
    const token = focus.current, current = () => !!token && focus.current === token && owns();
    if (!accountId || !profileId || !key || !current()) return changed();
    try {
      const profile = await mediaClientService.readProfileAvatar(profileId);
      if (!current()) return changed(); if (!profile.ok) return profile;
      if (!sameId(profile.podatak.accountId, accountId) || !sameId(profile.podatak.profileId, profileId)
        || profile.podatak.authoritative !== true) return changed();
      const stored = await AsyncStorage.getItem(key);
      if (!current()) return changed(); intent.current = decodeIntent(stored); storedIntent.current = stored; readAttempted.current = !!intent.current;
      let asset: MediaAsset | null = null;
      if (intent.current?.requestId) {
        readAttempted.current = true;
        const uploaded = await mediaClientService.readUploadCommand(intent.current.requestId);
        if (!current()) return changed();
        if (!uploaded.ok) {
          setNotice(uploaded.poruka);
          return { ok: true, podatak: { profile: profile.podatak, asset: null, intent: intent.current } };
        }
        if (uploaded.podatak.authoritative !== true || uploaded.podatak.scope !== 'AVATAR' || !sameId(uploaded.podatak.profileId, profileId)
          || !sameId(uploaded.podatak.accountId, accountId) || !sameId(uploaded.podatak.clientRequestId, intent.current.requestId)
          || (intent.current.assetId && !sameId(uploaded.podatak.assetId, intent.current.assetId))) return changed();
        asset = uploaded.podatak;
      }
      const appliedToProfile = asset?.state === 'READY' && asset.ref !== null && profile.podatak.avatarPath === asset.ref;
      // Another session may apply this exact asset before our discard. The
      // discard writer then refuses; its read does not expose the old apply
      // receipt. Only this owned profile's exact current path proves it saved.
      const alreadyApplied = intent.current?.phase === 'DISCARD' && appliedToProfile;
      const discarded = !alreadyApplied && intent.current?.phase === 'DISCARD' && asset?.selected === false;
      const resolved = intent.current?.phase === 'CLEAR' ? profile.podatak.avatarPath === null
        : alreadyApplied || discarded || intent.current?.phase === 'APPLY' && appliedToProfile;
      if (resolved || (intent.current?.phase === 'UPLOAD' && asset && (!asset.selected || asset.state === 'FAILED'))) {
        // A change whose outcome was not known has now been confirmed: the old photograph is no longer the one to remember.
        if (resolved && !discarded) ownPhotoCache.forget();
        if (!(await replaceAvatarIntent(key, stored, null, current)) || !current()) return changed();
        intent.current = null; storedIntent.current = null; bytes.current = null; asset = null;
        setNotice(alreadyApplied ? 'Fotografija je već sačuvana na profilu. Ako želite da je uklonite, izaberite „Ukloni fotografiju profila“.'
          : discarded ? 'Izabrana fotografija je odbačena.' : resolved ? 'Fotografija profila je sačuvana.' : 'Fotografija nije dodata. Možete izabrati drugu.');
      }
      return { ok: true, podatak: { profile: profile.podatak, asset, intent: intent.current } };
    } catch { return failure('MEDIA_READ_UNCONFIRMED', 'Ne znamo da li je fotografija sačuvana. Proveri to.'); }
  }, [profileId, key, owns, accountId]);
  const editor = useOwnedEditor(read), snapshot = editor.data, candidate = snapshot?.asset;
  const token = focus.current, view = useRef(snapshot); view.current = snapshot;
  const current = () => !!token && focus.current === token && owns() && !navigating.current;
  const canAct = () => current() && !editor.loading && !editor.busy && !editor.uncertain && !editor.error && view.current === snapshot;
  const persist = async (next: Intent) => {
    if (!key || !current()) return false;
    const encoded = JSON.stringify(next);
    if (!(await replaceAvatarIntent(key, storedIntent.current, encoded, current)) || !current()) return false;
    intent.current = next; storedIntent.current = encoded; readAttempted.current = false; return true;
  };
  const track = async (kind: Exclude<Running, null>, command: () => Promise<void>) => {
    const run = ++runSeq.current; setRunning(kind); setPickError(null);
    try { await command(); } finally { if (runSeq.current === run) { setRunning(null); setSending(false); } }
  };
  const finishCommand = async (): Promise<Ishod<Snapshot>> => {
    if (!key || !current()) return changed();
    if (!(await replaceAvatarIntent(key, storedIntent.current, null, current)) || !current()) return changed();
    intent.current = null; storedIntent.current = null; bytes.current = null;
    setNotice('Promena je zabeležena. Prikazujemo trenutnu fotografiju.'); return read();
  };
  const upload = async (command: Intent, photo: PreparedPhoto): Promise<Ishod<Snapshot>> => {
    if (!profileId || !command.requestId || !(await persist(command))) return changed();
    setSending(true);
    const controller = new AbortController(); abort.current = controller;
    const result = await mediaClientService.uploadAvatar({ profileId, clientRequestId: command.requestId,
      bytes: photo.bytes, contentType: photo.contentType }, { signal: controller.signal });
    if (!current()) return changed();
    const checked = await read(); // Unknown writes always read before any explicit retry.
    return checked.ok ? checked : result.ok ? checked : result;
  };
  const pick = async (source: PhotoSource) => {
    if (!canAct() || !snapshot || intent.current) return;
    await track(source, () => editor.save(async () => {
      try {
        setNotice(null); const photo = await pickPreparedPhoto(source, current);
        if (!current()) return changed(); if (!photo) return { ok: true, podatak: snapshot };
        bytes.current = photo; readAttempted.current = false;
        // Not awaited here: a failed upload rejects into the editor's own catch, never into the picker's below.
        return upload({ phase: 'UPLOAD', requestId: noviUuidZahtevId(), assetId: null, expectedPath: null }, photo);
      } catch (error) {
        // The picker refused on the phone (every error it throws is a PhotoSelectionError, raised before persist() and
        // before any request): nothing was written, so this settles like a cancelled pick and the choice stays open. It
        // used to settle as a failed command, which demanded a read and hid the gallery the message pointed to.
        if (!current()) return changed();
        setPickError(photoSelectionMessage(error)); return { ok: true, podatak: snapshot };
      }
    }));
  };
  const apply = async () => {
    if (!canAct() || !profileId || candidate?.state !== 'READY' || snapshot?.intent?.phase !== 'UPLOAD'
      || intent.current?.phase !== 'UPLOAD' || intent.current.requestId !== candidate.clientRequestId) return;
    const next: Intent = { phase: 'APPLY', requestId: candidate.clientRequestId, assetId: candidate.assetId, expectedPath: snapshot.profile.avatarPath };
    await track('APPLY', () => editor.save(async () => {
      if (!(await persist(next))) return changed();
      const result = saved(await mediaClientService.applyAvatar({ profileId, assetId: candidate.assetId, expectedAvatarPath: next.expectedPath }));
      if (!current()) return changed(); return result.ok ? finishCommand() : result;
    }));
  };
  const clear = async () => {
    if (!canAct() || !profileId || !snapshot?.profile.avatarPath || intent.current) return;
    const next: Intent = { phase: 'CLEAR', requestId: null, assetId: null, expectedPath: snapshot.profile.avatarPath };
    await track('CLEAR', () => editor.save(async () => {
      if (!(await persist(next))) return changed();
      const result = saved(await mediaClientService.clearAvatar({ profileId, expectedAvatarPath: next.expectedPath }));
      if (!current()) return changed(); return result.ok ? finishCommand() : result;
    }));
  };
  const discard = async () => {
    if (!canAct() || !profileId || !candidate || !candidate.selected || candidate.state === 'FAILED'
      || intent.current?.phase !== 'UPLOAD' || !sameId(intent.current.requestId, candidate.clientRequestId)) return;
    const next: Intent = { phase: 'DISCARD', requestId: candidate.clientRequestId, assetId: candidate.assetId, expectedPath: null };
    await track('DISCARD', () => editor.save(async () => {
      if (!(await persist(next))) return changed();
      const result = await mediaClientService.discardAvatar({ assetId: candidate.assetId, profileId });
      // The avatar writer can deselect PROCESSING/STAGED as well as READY. A
      // late upload may finish, but cannot apply a deselected avatar. Confirm
      // the same asset's deselection before releasing the persisted identity.
      if (!current()) return changed(); return result.ok ? read() : result;
    }));
  };
  const retry = async () => {
    if (!current() || !profileId || editor.loading || editor.busy || !intent.current || !readAttempted.current) return;
    const command = intent.current;
    await track('RETRY', () => editor.save(async () => {
      if (command.phase === 'UPLOAD') return bytes.current && readAttempted.current ? upload(command, bytes.current) : read();
      // Another mounted editor may have advanced the same profile's journal
      // since our last read. Replaying an old command must not steal that slot.
      if (!(await persist(command))) return changed();
      const result = command.phase === 'APPLY' && command.assetId
        ? saved(await mediaClientService.applyAvatar({ profileId, assetId: command.assetId, expectedAvatarPath: command.expectedPath }))
        : command.phase === 'DISCARD' && command.assetId ? await mediaClientService.discardAvatar({ assetId: command.assetId, profileId })
        : saved(await mediaClientService.clearAvatar({ profileId, expectedAvatarPath: command.expectedPath }));
      if (!current()) return changed();
      if (!result.ok && result.kod === 'MEDIA_VERSION_CONFLICT' && key) {
        // The profile was changed from somewhere else: what is remembered of its photograph cannot be believed either.
        ownPhotoCache.forget();
        if (!(await replaceAvatarIntent(key, storedIntent.current, null, current)) || !current()) return changed();
        intent.current = null; storedIntent.current = null; bytes.current = null;
        setNotice('Profil je promenjen. Pregledaj sadašnju fotografiju pre novog izbora.'); return read();
      }
      return result.ok ? command.phase === 'DISCARD' ? read() : finishCommand() : result;
    }));
  };
  const existing = snapshot?.profile.avatarPath ? mediaAssetId(snapshot.profile.avatarPath) : null;
  const staged = candidate?.state === 'READY' && snapshot?.intent?.phase === 'UPLOAD' ? candidate : null;
  const waiting = editor.busy || editor.loading, trouble = !!editor.error || editor.uncertain;
  const discardable = !trouble && snapshot?.intent?.phase === 'UPLOAD' && candidate?.selected === true
    && (candidate.state === 'PROCESSING' || candidate.state === 'STAGED');
  // One set of actions at a time, the ones that can work now (2026-09-24). An unconfirmed change is read first; after a
  // refusal the editor requires a read before any new command, so the read is the one action then. A pick in flight
  // journals its intent before the upload settles; while its own spinner runs, that is sending, not an unknown outcome.
  const picking = (running === 'LIBRARY' || running === 'CAMERA') && !trouble;
  const mode: ProfilePhotoMode = !profileId ? 'none' : intent.current && !picking && (trouble || !staged) ? 'unresolved'
    : trouble ? 'reconcile' : staged ? 'staged' : 'pick';
  const stage: ProfilePhotoStage | null = !profileId ? null : !snapshot ? { kind: editor.loading ? 'loading' : 'unavailable' }
    : staged ? { kind: 'photo', assetId: staged.assetId, staged: true }
      : existing ? { kind: 'photo', assetId: existing, staged: false } : { kind: 'none' };
  const error = editor.error ?? pickError;
  return <ProfilePhotoEditor stage={stage} notice={notice} error={error} permissionDenied={error === PHOTO_PERMISSION_MESSAGE} initials={initials}
    // A retry in flight keeps its own pressed button and spinner (review 5b): the upload it sends resets `readAttempted`,
    // which would otherwise swap it for a grey check with no reason. Display only; retry() and the editor keep every guard.
    mode={mode} retryable={running === 'RETRY'
      || (!trouble && !!intent.current && readAttempted.current && (intent.current.phase !== 'UPLOAD' || !!bytes.current))}
    discardable={discardable} running={running} sending={sending && waiting} canAct={canAct()} waiting={waiting} hasPhoto={!!snapshot?.profile.avatarPath}
    onBack={() => { if (!current()) return; navigating.current = true;
      if (router.canGoBack()) router.back(); else router.replace('/profil'); }}
    onLibrary={() => { void pick('LIBRARY'); }} onCamera={() => { void pick('CAMERA'); }}
    // Removing the public photo asks first; clear() keeps all its guards, which run when the answer is given.
    onRemove={() => confirm.ask({ title: 'Ukloniti fotografiju profila?', message: 'Profil ostaje bez fotografije dok ne izaberete novu.',
      confirmLabel: 'Ukloni fotografiju', tone: 'danger', onConfirm: () => { void clear(); } })}
    onApply={() => { void apply(); }} onDiscard={() => { void discard(); }} onRetry={() => { void retry(); }}
    onCheck={() => { if (current()) { setPickError(null); void editor.refresh(); } }} sheet={confirm.sheet} />;
}
