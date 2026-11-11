import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { SettingsText as T, SettingsScreen, SettingsAction } from '../settings/SettingsPresentation';
import { HeaderInfo } from '../settings/InfoTitle';
import { AuthorizedPhoto } from '../media/AuthorizedPhoto';
import { FactArt } from '../system/FactArt';
import { PermissionRecovery } from '../system/PermissionRecovery';
import { sys } from '../system/tokens';

/** Which command runs, only so its own button shows that it runs. */
export type ProfilePhotoRunning = 'LIBRARY' | 'CAMERA' | 'APPLY' | 'DISCARD' | 'CLEAR' | 'RETRY' | null;
/** What the circle shows. */
export type ProfilePhotoStage = { kind: 'loading' } | { kind: 'unavailable' } | { kind: 'none' }
  | { kind: 'photo'; assetId: string; staged: boolean };
/**
 * One set of actions at a time, the ones that can work now: `pick` (gallery, camera, remove; a refusal on the phone, such
 * as a denied camera, stays here with its message above the choices), `staged` (keep or let go of a chosen picture),
 * `unresolved` (a change whose outcome is unknown: read it, then retry), `reconcile` (after a refusal of a command the
 * saved state is read before a new choice; the editor requires that read, so the pickers would only be grey), or none.
 */
export type ProfilePhotoMode = 'pick' | 'staged' | 'unresolved' | 'reconcile' | 'none';

/** The circle the photo is shown in: 160 wide and 160 high, always (J13: a face is a circle, whatever it is made of). */
export const PREVIEW = 160;

/**
 * The style every picture in the circle takes. The frame `AuthorizedPhoto` draws has an aspect ratio of 4:3 of its own, and where a
 * width and a height are both given the phone's layout lets that ratio win over the width: the owner's phone drew this circle as an OVAL
 * 213 dp wide and 160 high (8 Oct 2026). The ratio is therefore said again here as 1, as the face of the profile and its header have always done.
 */
export const PHOTO_CIRCLE = { width: PREVIEW, height: PREVIEW, aspectRatio: 1, borderRadius: sys.radius.pill } as const;

/**
 * The photo of one profile (2026-09-24): shown the way others see it, a round crop, 160 px; under it what the circle
 * holds and the last notice; then only the actions that can work now, all the same width. What is done to the picture before it
 * leaves the phone, its size and when others see it are behind the "ⓘ" in the bar (owner's phone, 8 Oct 2026: a lock and a note
 * under the buttons explained what nobody had asked). While the
 * picture is on its way the circle holds the person's initials (the same letters the face has everywhere else), never a grey
 * slab with a spinner; a person without initials or a profile without a photograph is drawn as a person. Removing the
 * public photo asks first (the route renders the sheet). Presentation only: every command and guard is the route's.
 */
export function ProfilePhotoEditor({ onBack, stage, notice, error, permissionDenied, mode, retryable, discardable = false, running, sending = false, canAct, waiting,
  hasPhoto, onLibrary, onCamera, onRemove, onApply, onDiscard, onRetry, onCheck, photo, sheet, initials = null }: {
  onBack: () => void; stage: ProfilePhotoStage | null; notice: string | null; error: string | null;
  /** The error is the camera permission refusal: the phone settings are offered. */ permissionDenied: boolean;
  mode: ProfilePhotoMode; retryable: boolean; running: ProfilePhotoRunning;
  /** An exact avatar read admitted this still-processing asset; its own discard writer can retire it. */ discardable?: boolean;
  /** A chosen picture is on its way (journaled, the upload runs). */ sending?: boolean;
  /** A new command can start now. */ canAct: boolean; /** A read or a command is in flight. */ waiting: boolean;
  /** The profile has a saved photo that can be removed. */ hasPhoto: boolean;
  onLibrary: () => void; onCamera: () => void; onRemove: () => void; onApply: () => void; onDiscard: () => void;
  onRetry: () => void; onCheck: () => void;
  /** How a stored picture is drawn; the authorized reader by default. */
  photo?: (assetId: string, label: string, unavailable: ReactNode) => ReactNode;
  sheet?: ReactNode;
  /** The letters of the person's name (`inicijali`), when the route knows them: they stand in the circle while the picture is on its way. */
  initials?: string | null;
}) {
  // Its own element for a screen reader: iOS focuses a view only when it is `accessible`.
  const unavailable = <View accessible accessibilityRole="image" accessibilityLabel="Fotografija trenutno nije dostupna." style={[s.circle, s.wash]}>
    <FactArt kind="photo" size={48} muted /></View>;
  // The person's letters in the circle, or the drawn person when there are none: the stand-in of a picture that is on its way or not there.
  const standIn = <View style={[s.circle, s.soft]}>
    {initials ? <T variant="pageTitle" maxFontSizeMultiplier={1} accessible={false} style={s.letters}>{initials}</T> : <FactArt kind="person" size={72} />}
  </View>;
  // The saved photograph is the person's own and is remembered for the next visit (no stand-in while it is read again); a chosen picture that is not saved yet is not, because it may be let go of.
  const saved = stage?.kind === 'photo' && !stage.staged;
  const draw = photo ?? ((assetId: string, label: string, fallback: ReactNode) =>
    <AuthorizedPhoto assetId={assetId} label={label} contentFit="cover" style={PHOTO_CIRCLE} pending={standIn} unavailable={fallback} own={saved} />);
  const preview = !stage ? null : stage.kind === 'loading' ? standIn
    : stage.kind === 'unavailable' ? unavailable
      : stage.kind === 'none' ? standIn
        : draw(stage.assetId, stage.staged ? 'Izabrana fotografija profila' : 'Sadašnja fotografija profila', unavailable);
  // While a chosen picture travels the circle still shows what is saved; the caption says the new one is on its way.
  const caption = !stage ? null : sending ? 'Šaljemo fotografiju…' : stage.kind === 'loading' ? 'Učitavamo fotografiju…'
    : stage.kind === 'none' ? 'Profil još nema fotografiju.' : stage.kind === 'photo' && stage.staged ? 'Još nije sačuvana' : null;
  return <SettingsScreen title="Fotografija profila" onBack={onBack}
    right={<HeaderInfo testID="photo-info" title="Fotografija profila" info={photoInfoLines(mode === 'staged')} />}>
    {stage ? <View style={s.stage}>
      {preview}
      {caption ? <T variant="note" tone="muted" style={s.centered}>{caption}</T> : null}
      {notice ? <T accessibilityLiveRegion="polite" style={s.centered}>{notice}</T> : null}
    </View> : null}
    {error && permissionDenied ? <PermissionRecovery message={error} />
      : error ? <T accessibilityRole="alert" tone="danger">{error}</T> : null}
    {mode === 'unresolved' ? <View style={s.actions}>
      {/* After the read a retry is offered, so the line no longer asks for a check first; before it, the check is the one action. */}
      {retryable ? <>
        <T>{discardable ? 'Fotografija se još obrađuje. Možeš proveriti ishod ili odustati od nje.' : 'Ne znamo da li je promena sačuvana.'}</T>
        <SettingsAction label="Pošalji promenu ponovo" loading={running === 'RETRY'} disabled={waiting} onPress={onRetry} />
        <SettingsAction label="Proveri sačuvanu fotografiju" kind="quiet" disabled={waiting} onPress={onCheck} />
      </> : <>
        <T>{discardable ? 'Fotografija se još obrađuje. Možeš proveriti ishod ili odustati od nje.' : 'Ne znamo da li je fotografija poslata. Proveri to pre novog izbora.'}</T>
        <SettingsAction label="Proveri sačuvanu fotografiju" disabled={waiting} onPress={onCheck} />
      </>}
      {discardable ? <SettingsAction label="Odustani od izabrane fotografije" kind="quiet" loading={running === 'DISCARD'}
        disabled={!canAct || waiting} onPress={onDiscard} /> : null}
    </View> : mode === 'reconcile' ? <View style={s.actions}>
      {/* Every refusal on the phone stays in `pick`, so this is reached only when a read really is needed (a write that
          was not confirmed, a failed read, a conflict): the button says the check its error asks for (review 5b). */}
      <SettingsAction label="Proveri sačuvanu fotografiju" disabled={waiting} onPress={onCheck} />
    </View> : mode === 'staged' ? <View style={s.actions}>
      <SettingsAction label="Sačuvaj fotografiju" loading={running === 'APPLY'} disabled={!canAct} onPress={onApply} />
      <SettingsAction label="Odustani od izabrane fotografije" kind="quiet" loading={running === 'DISCARD'} disabled={!canAct} onPress={onDiscard} />
    </View> : mode === 'pick' && stage && stage.kind !== 'loading' ? <View style={s.actions}>
      <SettingsAction label="Izaberi iz galerije" loading={running === 'LIBRARY'} disabled={!canAct} onPress={onLibrary} />
      <SettingsAction label="Fotografiši" kind="secondary" loading={running === 'CAMERA'} disabled={!canAct} onPress={onCamera} />
      {/* The same width and the same centre as the two above: it stood indented at the start, as if it were part of the note. */}
      {hasPhoto ? <SettingsAction label="Ukloni fotografiju profila" kind="destructive" loading={running === 'CLEAR'}
        disabled={!canAct} onPress={onRemove} /> : null}
    </View> : null}
    {sheet}
  </SettingsScreen>;
}

/** The size, and what is done to the picture before it leaves the phone: behind the "ⓘ" in every state of the screen. */
export const PHOTO_LIMIT = 'Najviše 10 MB.';
export const PHOTO_STRIPPED = 'Pre slanja uklanjamo podatke o mestu i vremenu snimanja.';
/** Only once a new picture has been chosen, when the button that saves it exists: when others see it. */
export const PHOTO_SEEN_AFTER_SAVE = 'Drugi je vide tek kad izabereš „Sačuvaj fotografiju“.';
/** What the "ⓘ" says: the size and the stripping always, and once a picture is chosen, when it becomes visible to others (the old note named a button the screen did not have yet). */
export const photoInfoLines = (staged: boolean): string[] => staged ? [PHOTO_STRIPPED, PHOTO_SEEN_AFTER_SAVE] : [PHOTO_LIMIT, PHOTO_STRIPPED];

const s = StyleSheet.create({
  stage: { alignItems: 'center', gap: sys.space.md, marginTop: sys.space.sm },
  circle: { width: PREVIEW, height: PREVIEW, aspectRatio: 1, borderRadius: sys.radius.pill, alignItems: 'center', justifyContent: 'center' },
  soft: { backgroundColor: sys.color.greenSoft },
  wash: { backgroundColor: sys.color.wash },
  letters: { color: sys.color.green, fontWeight: '700', textAlign: 'center' },
  centered: { textAlign: 'center' },
  actions: { gap: sys.space.sm },
});
