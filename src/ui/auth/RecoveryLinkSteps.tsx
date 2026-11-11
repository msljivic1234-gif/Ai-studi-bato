import { StyleSheet, View } from 'react-native';
import { T } from '../Text';
import { sys } from '../system/tokens';
import type { RecoveryErrorCode } from '../../contracts/passwordRecovery';
import { AuthField, LinkAction, PrimaryButton } from './AuthControls';
import { AuthIntro } from './AuthPresentation';
import { authCopy } from './authCopy';
import { authFieldMessages } from './authValidation';

/**
 * What the screen of the password-recovery LINK shows in each of its states (the request for the link is a step of the sign-in
 * sheet). Presentation only: the route owns the link, the session and the write. The same pieces draw the screen and its gallery.
 *
 * The title says what to do or what happened, never a code. In an error, the contract's own sentence ("what happened, and what to
 * do") is the content, and the foot holds the ONE green command that is the likeliest next step; the other way, when there is one,
 * is said in words in the content.
 */
export type RecoveryLinkPhase =
  | { kind: 'verifying' }
  | { kind: 'form'; email: string; serverError: string | null }
  | { kind: 'success' }
  | { kind: 'error'; code: RecoveryErrorCode; message: string };

/** What is wrong with what was typed, before anything is sent: said under the field it is about. */
export type RecoveryLinkValidation = { field: 'password' | 'confirmation'; message: string } | null;

export const MISMATCH = 'Lozinke se ne poklapaju.';

/** The title of a link that did not work, or a write that may not have happened: what happened, in a few words. */
const ERROR_TITLE: Partial<Record<RecoveryErrorCode, string>> = {
  INVALID_LINK: 'Link ne važi',
  VERIFY_UNAVAILABLE: 'Link nije proveren',
  UPDATE_UNKNOWN: 'Lozinka nije potvrđena',
  SIGNED_IN: 'Prvo se odjavi',
};

type ContentProps = {
  phase: RecoveryLinkPhase; signedIn: boolean; busy: boolean;
  password: string; confirmation: string; validation: RecoveryLinkValidation;
  onPassword: (value: string) => void; onConfirmation: (value: string) => void;
  onSave: () => void; onNewLink: () => void;
};

export function RecoveryLinkContent({ phase, signedIn, busy, password, confirmation, validation, onPassword, onConfirmation, onSave, onNewLink }: ContentProps) {
  if (phase.kind === 'verifying') return <AuthIntro title="Postavi novu lozinku." art="lock" copy="Proveravamo link za oporavak…" />;
  if (phase.kind === 'success') {
    return <AuthIntro title="Lozinka je promenjena." art="check" copy="Tvoji zadaci i Dogovori ostaju na istom nalogu. Prijavi se novom lozinkom." />;
  }
  if (phase.kind === 'error') {
    // A link that could not be checked, or a write that may or may not have happened, leaves a second way: a new link.
    const alsoNewLink = !signedIn && (phase.code === 'VERIFY_UNAVAILABLE' || phase.code === 'UPDATE_UNKNOWN');
    return <>
      <AuthIntro title={ERROR_TITLE[phase.code] ?? 'Oporavak nije uspeo'} art="info" muted alert copy={phase.message} />
      {alsoNewLink ? <View><LinkAction title="Zatraži novi link" onPress={onNewLink} /></View> : null}
    </>;
  }
  return <>
    <AuthIntro title="Postavi novu lozinku." />
    <View style={s.fields}>
      <View accessibilityLiveRegion="polite">
        <T variant="copy" tone="muted">Postavi novu lozinku za nalog:</T>
        <T selectable variant="bodyStrong">{phase.email}</T>
      </View>
      <AuthField label="Nova lozinka" value={password} secure newPassword editable={!busy} hint={authFieldMessages.lozinkaHint}
        error={validation?.field === 'password' ? validation.message : null} onChangeText={onPassword} />
      <AuthField label="Potvrdi novu lozinku" value={confirmation} secure newPassword editable={!busy} returnKeyType="go" onSubmitEditing={onSave}
        error={validation?.field === 'confirmation' ? validation.message : null} onChangeText={onConfirmation} />
      <T variant="note" tone="muted">Tvoji zadaci, prijave i Dogovori ostaju na istom nalogu. Posle promene prijavi se novom lozinkom.</T>
      {phase.serverError ? <T accessibilityRole="alert" variant="note" tone="danger">{phase.serverError}</T> : null}
    </View>
  </>;
}

/** The ONE green command of the state. While the link is being checked there is none: the caller draws no foot at all for that phase. */
export function RecoveryLinkFooter({ phase, signedIn, busy, onSave, onBack, onNewLink, onRetry }: {
  phase: RecoveryLinkPhase; signedIn: boolean; busy: boolean;
  onSave: () => void; onBack: () => void; onNewLink: () => void; onRetry: () => void;
}) {
  if (phase.kind === 'verifying') return null;
  if (phase.kind === 'form') return <PrimaryButton title="Sačuvaj novu lozinku" onPress={onSave} busy={busy} />;
  if (phase.kind === 'success') return <PrimaryButton title={authCopy.signIn} onPress={onBack} />;
  if (signedIn) return <PrimaryButton title="Nazad u aplikaciju" onPress={onBack} />;
  if (phase.code === 'VERIFY_UNAVAILABLE') return <PrimaryButton title={authCopy.retry} onPress={onRetry} />;
  if (phase.code === 'UPDATE_UNKNOWN') return <PrimaryButton title={authCopy.signIn} onPress={onBack} />;
  return <PrimaryButton title="Zatraži novi link" onPress={onNewLink} />;
}

const s = StyleSheet.create({
  fields: { gap: sys.space.base },
});
