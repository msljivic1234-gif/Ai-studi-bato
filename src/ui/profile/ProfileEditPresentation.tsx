import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { Press } from '../Press';
import { InlineNote } from '../privacy/InlineNote';
import { SettingsAction, SettingsGroup, SettingsRow, SettingsText as T } from '../settings/SettingsPresentation';
import { FactArt } from '../system/FactArt';
import { Glyph } from '../system/Glyph';
import { InfoButton } from '../system/InfoButton';
import { ChromeIconButton } from '../system/ScreenChrome';
import { sys } from '../system/tokens';
import type { NameSaveControl } from './DisplayNameForm';

/** The photo at the size of the profile's own portrait (the hub draws the same 96). */
export const EDIT_PHOTO = 96;

/**
 * The parts of "Lični podaci" that sit around the name (T4a, 2026-10-07; owner's phone, 8 Oct 2026: "natrpano"; the screen was "Izmeni profil" until the
 * product draft the owner approved the same day, P2). The pencil on the profile opens a screen that says what the person is made of: the photo, the
 * name, "O meni" and the city. Each part is only what the app already
 * holds and can already save, and nothing on the screen explains itself:
 * - the photo opens the photo screen that already exists (nothing of it is rebuilt here);
 * - the name is the one field, and its one green "Sačuvaj ime" is drawn only once the name has been changed (`DisplayNameForm`);
 * - "O meni" is the text of the work profile (the only profile whose save carries a description); it is shown as written, never made up, and it
 *   opens the work profile, where it is written;
 * - the city is the work area's, said as its answer at the end of its row; the row opens the work area, where the city is changed, so the
 *   sentence that used to say so is gone (a row with an arrow goes where the thing is changed, and says nothing more);
 * - who sees what is ONE sentence, with its picture, and the other half (what they do not see) behind its "ⓘ". The row "Privatnost i podaci" is
 *   not here any more: the profile has it.
 * Presentation only: the route reads, navigates and owns every guard.
 *
 * ONE NAME (owner, 8 Oct 2026): the name saved here is the name of the account AND of the work profile, if the account has one. When the second
 * write did not take, `WorkNameNotice` says so, with its one way to try that write again; it is never left silent.
 */

/** The longest stretch of "O meni" shown in a row; the whole text is on the work profile it opens. */
export const ABOUT_CLIP = 140;
export const clipText = (text: string, max = ABOUT_CLIP): string => {
  const flat = text.replace(/\s+/g, ' ').trim();
  const letters = Array.from(flat);
  return letters.length <= max ? flat : `${letters.slice(0, max).join('').trimEnd()}…`;
};

export type AboutView = { kind: 'loading' } | { kind: 'error' } | { kind: 'none' } | { kind: 'empty' } | { kind: 'text'; text: string };
export type CityView = { kind: 'loading' } | { kind: 'error' } | { kind: 'none' } | { kind: 'city'; city: string };

/** What the "O meni" row says under its name: the text as written, or the one word that invites the person to write it. */
export function aboutDetail(view: AboutView): string {
  switch (view.kind) {
    case 'loading': return 'Učitavamo…';
    case 'error': return 'Opis trenutno nije dostupan';
    case 'none': case 'empty': return 'Dodaj opis';
    case 'text': return clipText(view.text);
  }
}
/** What the "Grad" row answers: the city of the work area, or why there is none. */
export function cityDetail(view: CityView): string {
  switch (view.kind) {
    case 'loading': return 'Učitavamo…';
    case 'error': return 'Trenutno nedostupno';
    case 'none': return 'Još nije podešeno';
    case 'city': return view.city;
  }
}

/** Who sees what, in ONE sentence: what the profile shows is public, and the profile says nothing more about it. */
export const VISIBLE_TO_OTHERS = 'Ime, fotografija, grad, „O meni“ i ocene vide drugi.';
/** The other half, behind the "ⓘ" of that sentence: what other people do not see unless the rules of the cooperation give them access. */
export const SHARED_ONLY_BY_RULES = 'Tačna privatna lokacija i kontakt dele se samo kada pravila saradnje daju pristup.';
/** The second write did not take: the name is on the account, and the work profile still carries what it had. */
export const WORK_NAME_NOT_WRITTEN = 'Ime je sačuvano na nalogu, ali nije upisano u radni profil.';

/** The photo, one control: the picture the way others see it, the camera mark on its edge, and under it what pressing does. */
export function ProfilePhotoBlock({ photo, ready, onOpen }: { photo: ReactNode; ready: boolean; onOpen: () => void }) {
  return <View style={s.photoBlock}>
    <Press accessibilityRole="button" accessibilityLabel="Promeni fotografiju" accessibilityHint="Otvara izbor fotografije profila."
      accessibilityState={{ disabled: !ready }} disabled={!ready} haptic="select" scaleTo={sys.motion.scale.button} onPress={onOpen} style={s.photoPress}>
      <View style={s.photoFrame}>
        {photo}
        {ready ? <View style={s.camera} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden><Glyph name="camera" size={16} /></View> : null}
      </View>
      <T variant="bodyStrong" style={[s.photoWord, !ready && s.photoWordOff]}>Promeni fotografiju</T>
    </Press>
  </View>;
}

/** About and work area: the city is the existing work-profile area, not a separate home address. */
export function ProfileFactRows({ about, city, onAbout, onCity, disabled=false }: { about: AboutView; city: CityView; onAbout: () => void; onCity: () => void; disabled?:boolean }) {
  return <SettingsGroup>
    <SettingsRow label="O meni" detail={aboutDetail(about)} onPress={onAbout} disabled={disabled} />
    <SettingsRow label="Područje rada" value={cityDetail(city)} valuePlacement="below" onPress={onCity} disabled={disabled} last />
  </SettingsGroup>;
}

/**
 * The bar's "Sačuvaj" (approved draft, P2: "Sačuvaj u zaglavlju tek kad se nešto promeni"): a green pill with the check and the word, drawn only while the name
 * differs from the saved one (the form reports it, `NameSaveControl`). It is grey while the save cannot be pressed and says "Čuvamo…" while it runs.
 */
export function NameSaveButton({ control }: { control: NameSaveControl }) {
  return <ChromeIconButton glyph="check" caption={control.loading ? 'Čuvamo…' : 'Sačuvaj'} label="Sačuvaj ime" tone="green"
    disabled={control.disabled || control.loading} onPress={control.press} />;
}

/** What other people see, as one quiet line with its picture; the "ⓘ" at its end says the other half (what they do not see). Nothing else to press. */
export function VisibilityNote() {
  return <View testID="profile-visibility" style={s.visibility}>
    <FactArt kind="eye" size={24} />
    <T variant="note" tone="muted" style={s.visibilityCopy}>{VISIBLE_TO_OTHERS}</T>
    <InfoButton testID="profile-visibility-info" title="Javno i privatno" lines={[VISIBLE_TO_OTHERS, SHARED_ONLY_BY_RULES]} />
  </View>;
}

/**
 * The name is saved on the account and the work profile did not take it. Said where the name is, with the one thing that can be done: write the
 * name into the work profile again (the account's own save is done and is not repeated).
 */
export function WorkNameNotice({ retrying, onRetry }: { retrying: boolean; onRetry: () => void }) {
  return <View testID="work-name-notice" style={s.workName}>
    <InlineNote tone="warn" art="info" alert>{WORK_NAME_NOT_WRITTEN}</InlineNote>
    <SettingsAction label="Pokušaj ponovo" loading={retrying} disabled={retrying} onPress={onRetry} />
  </View>;
}

const s = StyleSheet.create({
  visibility: { flexDirection: 'row', alignItems: 'flex-start', gap: sys.space.md },
  visibilityCopy: { flex: 1, minWidth: 0 },
  workName: { gap: sys.space.md },
  photoBlock: { alignItems: 'center' },
  photoPress: { alignItems: 'center', gap: sys.space.md, minHeight: sys.touch.min },
  photoFrame: { width: EDIT_PHOTO, height: EDIT_PHOTO },
  // The camera mark sits on the edge of the photo and leaves the face visible; it says "this changes the photo" without a second control.
  camera: { position: 'absolute', right: -2, bottom: -2, width: 32, height: 32, borderRadius: sys.radius.pill, backgroundColor: sys.color.surface,
    borderWidth: 1, borderColor: sys.color.cardLine, alignItems: 'center', justifyContent: 'center' },
  photoWord: { color: sys.color.green },
  photoWordOff: { color: sys.color.muted },
});
