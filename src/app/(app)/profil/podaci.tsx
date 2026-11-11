import { useCallback, useRef, useState } from 'react';
import { router, useFocusEffect } from 'expo-router';
import { requesterProfileClientService } from '../../../data/requesterProfileClientService';
import { useFocusedResource } from '../../../hooks/useFocusedResource';
import { useOwnedEditor } from '../../../hooks/useOwnedEditor';
import { useUnsavedProfileBack } from '../../../hooks/useUnsavedProfileBack';
import { inicijali } from '../../../lib/inicijali';
import { sesijaSada, useSesija } from '../../../store/sesija';
import { useIzvor } from '../../../store/uloga';
import { cityLabel } from '../../../ui/profile/cityLabel';
import { ProfilePhoto } from '../../../ui/media/ContextPhotos';
import { SettingsScreen } from '../../../ui/settings/SettingsPresentation';
import { Avatar } from '../../../ui/system/Avatar';
import { StateView } from '../../../ui/system/StateView';
import { QuietReadState } from '../../../ui/v2/QuietReadState';
import { DisplayNameForm, type NameSaveControl } from '../../../ui/profile/DisplayNameForm';
import { EDIT_PHOTO, NameSaveButton, ProfileFactRows, ProfilePhotoBlock, VisibilityNote, WorkNameNotice, type AboutView, type CityView } from '../../../ui/profile/ProfileEditPresentation';
import { writeWorkName } from '../../../ui/profile/writeWorkName';
import { rememberAiCorrection } from '../../../data/aiCorrectionIntent';
import { T } from '../../../ui/Text';

/**
 * Lični podaci (T4a, 2026-10-07; "Izmeni profil" until the product draft the owner approved on 8 Oct 2026, P2). The pencil on the profile opens this, and it
 * is more than the name: the photo (the screen that already exists), the name (one field; its "Sačuvaj" stands in the bar and only once the name has changed),
 * "O meni" and the city (the work profile's, shown as written and opened where they are changed) and, in one sentence, what other people can see. The name is
 * the only thing saved HERE, by the same revision-bound save as before; nothing else is written from this screen, and no text is made up for a part that is
 * empty.
 *
 * ONE NAME (owner, 8 Oct 2026, "Može, dobro vam jedno ime za sve."): this is the one place the person's name is changed, and a save writes it twice,
 * in this order: the account's name (`rpc_save_requester_profile`, revision-bound, as before) and, only if that is confirmed and the account has a work
 * profile, the same name into the work profile through its existing writer, read back (`writeWorkName`). If the second write does not take, the screen
 * says so ("Ime je sačuvano na nalogu, ali nije upisano u radni profil.") with "Pokušaj ponovo", which repeats ONLY the second write.
 */
export default function PersonalProfile() {
  const { user, accountRevision } = useSesija();
  return <OwnedPersonalProfile key={`${user?.id}:${accountRevision}`} />;
}
function OwnedPersonalProfile() {
  const { user, accountRevision } = useSesija();
  const read = useCallback(() => requesterProfileClientService.read(), []);
  const editor = useOwnedEditor(read);
  const [dirty, setDirty] = useState(false);
  const leave = useUnsavedProfileBack({ dirty: !!editor.data && dirty, busy: editor.busy, uncertain: editor.uncertain,
    revision: editor.data?.revision ?? null, onBack: () => router.canGoBack() ? router.back() : router.replace('/profil') });
  const check = () => { void editor.refresh(); };
  const [workNameFailed, setWorkNameFailed] = useState(false), [retrying, setRetrying] = useState(false), retryingRef = useRef(false);
  // The bar's "Sačuvaj": reported by the name form, drawn here, there only while the name differs from the saved one.
  const [nameSave, setNameSave] = useState<NameSaveControl | null>(null);
  // "O meni" and the work area's city belong to the work profile, so they are read the way the work profile screen reads it.
  const izvor = useIzvor();
  const work = useFocusedResource(useCallback(() => izvor.mojRadnikProfil(), [izvor]));
  const about: AboutView = work.loading ? { kind: 'loading' } : work.error ? { kind: 'error' } : !work.data ? { kind: 'none' }
    : work.data.biografija.trim() ? { kind: 'text', text: work.data.biografija } : { kind: 'empty' };
  const city: CityView = work.loading ? { kind: 'loading' } : work.error ? { kind: 'error' }
    : work.data?.grad.trim() ? { kind: 'city', city: cityLabel(work.data.grad) } : { kind: 'none' };
  // One way onward at a time, and a fresh one on every visit.
  const going = useRef(false);
  useFocusEffect(useCallback(() => { going.current = false; }, []));
  const go = (action: () => void) => { if (going.current) return; going.current = true; action(); };
  const editWithAi = (part: 'identity' | 'area') => {
    if(!user?.id || dirty || editor.busy || editor.uncertain || retryingRef.current) return;
    const correction=rememberAiCorrection({accountId:user.id,accountRevision},`worker.${part}`);
    if(correction)go(()=>router.navigate({pathname:'/profil/razgovor',params:{aiCorrection:correction.token}}));
  };
  const profile = editor.data;
  const sameAccount = () => !!user?.id && sesijaSada().user?.id === user.id && sesijaSada().accountRevision === accountRevision;
  // A previous session may have saved the account name but lost the work-name acknowledgement.
  // Detect a real readback mismatch; never auto-write or infer that an unavailable work read is a mismatch.
  const workNameMismatch = !!profile && !!work.data && !work.loading && !work.error
    && profile.displayName.trim() !== work.data.ime.trim();
  const showWorkNameRepair = !!profile && !dirty && !editor.uncertain && (workNameFailed || workNameMismatch);
  // The account's name is saved; only the work profile's is written again (never the account's, which would need a new revision and request).
  const retryWorkName = async () => {
    if (!profile || retryingRef.current || editor.busy || editor.uncertain || dirty || !sameAccount()) return;
    // A missing/stale work read is not permission to overwrite an unknown profile name.
    if (!work.data || work.loading || work.error) { void work.refresh(); return; }
    retryingRef.current = true; setRetrying(true);
    try {
      const outcome = await writeWorkName(izvor, profile.displayName, sameAccount, work.data?.ime);
      if (sameAccount()) { setWorkNameFailed(outcome === 'failed'); void work.refresh(); }
    } finally { retryingRef.current = false; if (sameAccount()) setRetrying(false); }
  };
  return <SettingsScreen title="Lični podaci" onBack={leave.back} right={profile && nameSave ? <NameSaveButton control={nameSave} /> : undefined}>
    {profile ? <>
      <ProfilePhotoBlock ready={!editor.busy}
        photo={<ProfilePhoto profileId={profile.profileId} size={EDIT_PHOTO} fallback={<Avatar initials={inicijali(profile.displayName)} size={EDIT_PHOTO} />} own />}
        onOpen={() => go(() => router.push({ pathname: '/profil/fotografija', params: { profileId: profile.profileId } }))} />
      <DisplayNameForm key={profile.revision} savedName={profile.displayName} busy={editor.busy} uncertain={editor.uncertain}
        onDirtyChange={setDirty} onSaveControl={setNameSave} saved={editor.saved} error={editor.error} checking={editor.busy || editor.loading} check={check}
        save={(name, requestId) => editor.save(async () => {
          setWorkNameFailed(false);
          const result = await requesterProfileClientService.save({ displayName: name, clientRequestId: requestId, expectedRevision: profile.revision });
          if (!result.ok) return result;
          // The second write, after the first is confirmed: the same name into the work profile, if the account has one.
          const outcome = await writeWorkName(izvor, result.podatak.identity.displayName, sameAccount);
          if (sameAccount()) { setWorkNameFailed(outcome === 'failed'); void work.refresh(); }
          return { ok: true, podatak: result.podatak.identity };
        })} />
      {showWorkNameRepair ? <WorkNameNotice retrying={retrying} onRetry={() => { void retryWorkName(); }} /> : null}
      {/* "O meni" is the work profile's text, written where the work profile is: its editor opens on that part. */}
      {dirty?<T variant="note" tone="muted">Sačuvajte ime pre izmene profila majstora.</T>:null}
      <ProfileFactRows about={about} city={city} onAbout={() => editWithAi('identity')} onCity={() => editWithAi('area')}
        disabled={dirty||editor.busy||editor.uncertain||retrying} />
      <VisibilityNote />
    </>
      : editor.error && !editor.loading ? <StateView kind="error" title="Profil nije učitan" body={editor.error}
        primary={{ label: 'Proverite sačuvane podatke', onPress: check, disabled: editor.busy || editor.loading }} />
        : <QuietReadState art="person" title="Učitavamo lične podatke…"
          body="Proveravamo sačuvano ime pre nego što omogućite izmene." />}
    {leave.sheet}
  </SettingsScreen>;
}
