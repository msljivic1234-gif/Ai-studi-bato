import type { RefObject } from 'react';
import { StyleSheet, View, type TextInput } from 'react-native';
import { T } from '../Text';
import { sys } from '../system/tokens';
import { AuthField, AuthNote, LinkAction } from './AuthControls';
import { AuthIntro } from './AuthPresentation';
import { authCopy } from './authCopy';

/**
 * The steps of the sign-in sheet after the first one: asking for the password to be recovered, saying the mail was sent,
 * asking for the phone number and the code. Each is ONE title (in the one style), at most ONE sentence under it, one picture
 * when the step is a state, the field(s), and what the person may do besides the step's own green command; the green command
 * stands in the foot of the sheet (`AuthFlowFrame`), and the way back is the arrow in the bar, so none of these draws a
 * second "Nazad" of its own. A step that has nothing to do except go back says so with that one green command.
 */

/** What every step with a field takes besides its value: what a keystroke does, whether it may be typed in, what is wrong, and the input itself. */
type FieldProps = { onChange: (value: string) => void; editable: boolean; error?: string | null; inputRef?: RefObject<TextInput | null> };

/** Recovering the password: the email, and what will happen. When this build cannot do it, one sentence says so. */
export function RecoveryStep({ available, email, failure, onSubmit, ...field }: FieldProps & {
  available: boolean; email: string; failure: string | null; onSubmit: () => void;
}) {
  return <>
    <AuthIntro title={authCopy.recoveryName} art="lock"
      copy={available ? 'Unesite email koji koristite za USKOČI.' : 'Oporavak lozinke još nije dostupan u aplikaciji.'} />
    {available ? <View style={s.fields}>
      <AuthField label="Email" keyboardType="email-address" placeholder="ime@primer.rs" returnKeyType="go" onSubmitEditing={onSubmit}
        value={email} onChangeText={field.onChange} editable={field.editable} error={field.error ?? null} inputRef={field.inputRef} />
      <T variant="note" tone="muted">Otvorićete link iz emaila i izabrati novu lozinku. Vaši zadaci i Dogovori ostaju na istom nalogu.</T>
      {failure ? <T variant="note" tone="danger" accessibilityRole="alert" accessibilityLiveRegion="polite">{failure}</T> : null}
    </View> : null}
  </>;
}

/** The link was asked for. Only what is known is said: IF the account exists, the mail comes (it is not promised for an email nobody has). */
export function RecoverySentStep({ email, onChangeEmail }: { email: string; onChangeEmail: () => void }) {
  return <>
    <AuthIntro title="Proverite email" art="send" copy="Ako nalog sa ovim emailom postoji, dobićete link za novu lozinku. Proverite i neželjenu poštu." />
    <View>
      <T variant="note" tone="muted">{email.trim()}</T>
      <LinkAction title="Promenite email ili pošaljite ponovo" onPress={onChangeEmail} />
    </View>
  </>;
}

/**
 * The account was asked for and there is no session yet. With a confirmation to make, the step says what will come and where it
 * leads back to; without one, it says that nobody is signed in yet and what to do about it. Sending the confirmation again and
 * changing the address are the two things to do besides going back to sign in.
 */
export function SignupNextStep({ confirmationRequired, email, notice, failure, busy, onResend, onChangeEmail }: {
  confirmationRequired: boolean; email: string; notice: string | null; failure: string | null; busy: boolean;
  onResend: () => void; onChangeEmail: () => void;
}) {
  return <>
    <AuthIntro title={confirmationRequired ? 'Proverite email' : 'Nastavite prijavu'} art="send"
      copy={confirmationRequired
        ? 'Poslaćemo Vam poruku za potvrdu emaila. Kada je otvorite, vratićete se u aplikaciju.'
        : 'Prijava još nije gotova. Ako Vam je stigla poruka za potvrdu emaila, prvo je otvorite. Zatim se vratite na prijavu.'} />
    {email.trim() ? <T variant="note" tone="muted">{email.trim()}</T> : null}
    {notice ? <AuthNote tone="ok">{notice}</AuthNote> : null}
    {failure ? <T variant="note" tone="danger" accessibilityRole="alert" accessibilityLiveRegion="polite">{failure}</T> : null}
    <View>
      {confirmationRequired ? <LinkAction title="Pošaljite ponovo potvrdu" disabled={busy} onPress={onResend} /> : null}
      <LinkAction title="Promenite email" disabled={busy} onPress={onChangeEmail} />
    </View>
  </>;
}

/** The phone way in: only ever reached when the server says it is on. */
export function PhoneStep({ signUp, phone, failure, onSubmit, ...field }: FieldProps & {
  signUp: boolean; phone: string; failure: string | null; onSubmit: () => void;
}) {
  return <>
    <AuthIntro title={signUp ? 'Napravite nalog telefonom' : 'Prijavite se telefonom'} copy="Unesite broj telefona." />
    <View style={s.fields}>
      <AuthField label="Broj telefona" keyboardType="phone-pad" placeholder="+381 6x xxx xxxx" returnKeyType="go" onSubmitEditing={onSubmit}
        value={phone} onChangeText={field.onChange} editable={field.editable} error={field.error ?? null} inputRef={field.inputRef} />
      <T variant="note" tone="muted">Poslaćemo Vam jednokratni kod.</T>
      {failure ? <T variant="note" tone="danger" accessibilityRole="alert" accessibilityLiveRegion="polite">{failure}</T> : null}
    </View>
  </>;
}

export function OtpStep({ code, notice, failure, busy, onSubmit, onResend, onChangePhone, ...field }: FieldProps & {
  code: string; notice: string | null; failure: string | null; busy: boolean;
  onSubmit: () => void; onResend: () => void; onChangePhone: () => void;
}) {
  return <>
    <AuthIntro title="Unesite kod" art="phone" copy="Unesite kod kada stigne na Vaš broj. Ako ne stigne, zatražite novi." />
    {notice ? <AuthNote tone="ok">{notice}</AuthNote> : null}
    <View style={s.fields}>
      <AuthField label="Kod" keyboardType="number-pad" placeholder="123456" autoComplete="one-time-code" returnKeyType="go" onSubmitEditing={onSubmit}
        value={code} onChangeText={field.onChange} editable={field.editable} error={field.error ?? null} inputRef={field.inputRef} />
      {failure ? <T variant="note" tone="danger" accessibilityRole="alert" accessibilityLiveRegion="polite">{failure}</T> : null}
    </View>
    <View>
      <LinkAction title="Pošaljite novi kod" disabled={busy} onPress={onResend} />
      <LinkAction title="Promenite broj" disabled={busy} onPress={onChangePhone} />
    </View>
  </>;
}

/** The server has the phone way switched off (it was on when the person chose it): one sentence, and the green way back. */
export function PhoneUnavailableStep() {
  return <AuthIntro title="Prijava telefonom" art="phone" copy="Prijava telefonom trenutno nije dostupna." />;
}

const s = StyleSheet.create({
  fields: { gap: sys.space.base },
});
