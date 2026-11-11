import type { RefObject } from 'react';
import { StyleSheet, View, type TextInput } from 'react-native';
import { Press } from '../Press';
import { T } from '../Text';
import { FactArt } from '../system/FactArt';
import { layout } from '../system/layout';
import { Segmented, type SegmentedOption } from '../system/Segmented';
import { sys } from '../system/tokens';
import { AuthField, AuthNote, LinkAction, PrimaryButton, RevealWhenShown } from './AuthControls';
import { AuthIntentLine, type AuthIntentName } from './AuthIntentLine';
import { AuthIntro } from './AuthPresentation';
import { authCopy } from './authCopy';
import { authFieldMessages, type AuthFieldErrors, type AuthFieldName, type AuthFormValues } from './authValidation';
import type { SignupReturnKind } from '../../data/signupConfirmationReturn';

export type AuthWay = 'LOGIN' | 'SIGNUP';

/** The two ways in on one screen, in the order of the design proposal (N2): creating an account leads, because the entry's choice opens it. */
const WAYS: readonly SegmentedOption<AuthWay>[] = [{ key: 'SIGNUP', label: authCopy.signUp }, { key: 'LOGIN', label: authCopy.signInWay }];

/** What the check of the other ways in has found so far. `failed` is a quiet note, never a closed form. */
export type AuthCheck = 'loading' | 'failed' | 'done';

export type AuthFormStepProps = {
  way: AuthWay;
  /** Switching between the two ways; drawn only when signing up is offered, because with one way there is nothing to switch. */
  onWay: (way: AuthWay) => void;
  /** Which of the ways in are open: email and password, making an account, the phone. A closed one is not drawn. */
  emailOpen: boolean;
  signUpOpen: boolean;
  phoneOpen: boolean;
  /** What the person came to do (from the entry), as one sentence with its "Promeni"; null when nothing was chosen. */
  intent: AuthIntentName | null;
  onIntentChange: (next: AuthIntentName) => void;
  values: AuthFormValues;
  onValue: (name: AuthFieldName, value: string) => void;
  /** What is wrong with a field, said under it. */
  errors: AuthFieldErrors;
  /** What the server or the connection answered to the command, and the one thing to do about it when there is one. */
  failure: string | null;
  failureAction: { label: string; onPress: () => void; note?: string } | null;
  /** The green confirmation ("we sent it again"). */
  notice: string | null;
  signupReturn?: SignupReturnKind | null;
  onResendConfirmation?: () => void;
  /** The server wants the email confirmed before the first sign-in; said under the form that makes an account. */
  confirmEmail: boolean;
  busy: boolean;
  check: AuthCheck;
  onRetryCheck: () => void;
  onForgot: () => void;
  onPhone: () => void;
  /** The keyboard's "go" on the last field sends the form. */
  onSubmit: () => void;
  inputRefs?: Partial<Record<AuthFieldName, RefObject<TextInput | null>>>;
};

/**
 * The first step of the sign-in sheet: both ways in on one screen (N2). The selected way names the title, with one short
 * explanation below it; the switch, fields with labels and inline errors, and the available other ways follow. The one green
 * command ("Prijavi se" or "Napravi nalog") is NOT here: it stands in the foot of the sheet, which is where the keyboard
 * leaves it in reach.
 *
 * The form works whatever the check of the available ways in has found: with `check === 'failed'` it only says so, quietly,
 * under the form, with a way to try again; it never stands in front of the fields. Everything is a block of the sheet's column
 * (24 apart); the fields are 16 apart; a label is 4 over its box.
 */
export function AuthFormStep(p: AuthFormStepProps) {
  const signingUp = p.way === 'SIGNUP' && p.signUpOpen;
  const ref = (name: AuthFieldName) => p.inputRefs?.[name];
  const next = (name: AuthFieldName) => () => ref(name)?.current?.focus();
  const text = (name: AuthFieldName, editable = !p.busy) => ({
    value: p.values[name], onChangeText: (value: string) => p.onValue(name, value), editable, error: p.errors[name] ?? null, inputRef: ref(name),
  });
  return <>
    <AuthIntro title={signingUp ? authCopy.signUp : authCopy.signIn}
      copy={signingUp ? authCopy.oneAccount : authCopy.resume} />
    {p.signUpOpen || p.intent ? <View style={s.group}>
      {p.signUpOpen ? <Segmented options={WAYS} value={p.way} onChange={p.onWay} /> : null}
      {p.intent ? <AuthIntentLine intent={p.intent} disabled={p.busy} onChange={p.onIntentChange} /> : null}
    </View> : null}
    {p.notice ? <RevealWhenShown key={p.notice} testID="auth-notice"><AuthNote tone="ok">{p.notice}</AuthNote></RevealWhenShown> : null}
    {p.signupReturn ? <View style={s.group} accessibilityLiveRegion="polite" testID="signup-return">
      <AuthNote>{p.signupReturn === 'RETURNED' ? 'Nastavite prijavu svojom email adresom i lozinkom.'
        : p.signupReturn === 'LINK_UNAVAILABLE'
          ? 'Ovaj link više nije važeći. Ako je email već potvrđen, prijavite se. U suprotnom zatražite novu potvrdu.'
          : 'Ovaj link ne možemo da upotrebimo. Prijavite se ili zatražite novu potvrdu emaila.'}</AuthNote>
      {p.signupReturn !== 'RETURNED' && p.onResendConfirmation ? <LinkAction title="Pošaljite novu potvrdu" disabled={p.busy} onPress={p.onResendConfirmation} /> : null}
    </View> : null}

    {p.emailOpen ? <View style={s.fields}>
      {signingUp ? <>
        <AuthField label="Ime" autoCapitalize="words" autoComplete="name-given" returnKeyType="next" onSubmitEditing={next('prezime')} {...text('ime')} />
        <AuthField label="Prezime" autoCapitalize="words" autoComplete="name-family" returnKeyType="next" onSubmitEditing={next('email')} {...text('prezime')} />
      </> : null}
      <AuthField label="Email" keyboardType="email-address" placeholder="ime@primer.rs" returnKeyType="next" onSubmitEditing={next('lozinka')} {...text('email')} />
      {/* A new password field per way: what was shown with the eye is hidden again when the way changes. */}
      <AuthField key={`password:${p.way}`} label="Lozinka" secure newPassword={signingUp} returnKeyType="go" onSubmitEditing={p.onSubmit}
        hint={signingUp ? authFieldMessages.lozinkaHint : undefined} {...text('lozinka')} />
      {p.failure ? <RevealWhenShown key={p.failure} testID="auth-failure"><View style={s.failure} accessibilityLiveRegion="polite">
        <T variant="note" tone="danger" accessibilityRole="alert">{p.failure}</T>
        {p.failureAction ? <View>
          {p.failureAction.note ? <T variant="note" tone="muted">{p.failureAction.note}</T> : null}
          <LinkAction title={p.failureAction.label} onPress={p.failureAction.onPress} disabled={p.busy} />
        </View> : null}
      </View></RevealWhenShown> : null}
      {p.way === 'LOGIN' ? <LinkAction title={authCopy.forgot} align="end" disabled={p.busy} onPress={p.onForgot} /> : null}
    </View> : null}

    {p.emailOpen && !p.signUpOpen ? <T variant="note" tone="muted">Otvaranje novih naloga trenutno nije dostupno.</T> : null}
    {signingUp && p.emailOpen && p.confirmEmail ? <T variant="note" tone="muted">Pre prve prijave potrebno je da potvrdite email.</T> : null}

    {p.check === 'failed' ? <View>
      <T variant="note" tone="muted">Dodatne načine prijave nismo uspeli da proverimo.</T>
      <LinkAction title={authCopy.retry} onPress={p.onRetryCheck} />
    </View> : p.phoneOpen ? <View style={s.methods}>
      <T variant="meta" tone="muted" style={s.methodsTitle}>Drugi načini prijave</T>
      <Press accessibilityRole="button" accessibilityLabel="Telefon" accessibilityState={{ disabled: p.busy }} disabled={p.busy}
        haptic="select" onPress={p.onPhone} style={s.method}>
        <View accessible={false} importantForAccessibility="no-hide-descendants"><FactArt kind="phone" size={24} /></View>
        <T variant="bodyStrong">Telefon</T>
      </Press>
    </View> : !p.emailOpen && p.way === 'LOGIN' && p.signUpOpen ? <T variant="note" tone="muted">Možete da napravite nalog.</T>
      // No way in is open: the foot says why the command is grey, and here is what to do about it.
      : !p.emailOpen ? <T variant="note" tone="muted">Pokušajte ponovo malo kasnije.</T> : null}
  </>;
}

const s = StyleSheet.create({
  // The switch, the choice made on the entry and the one sentence about the account: one group, 12 apart.
  group: { gap: sys.space.md },
  // Field to field: 16. A label stands 4 over its box and an error 4 under it, inside the field itself.
  fields: { gap: sys.space.base },
  failure: { gap: sys.space.xs },
  centred: { textAlign: 'center' },
  methods: { gap: sys.space.sm },
  methodsTitle: { fontWeight: '600' },
  method: { flexDirection: 'row', alignItems: 'center', gap: sys.space.md, minHeight: layout.rowMinPlain, paddingHorizontal: sys.space.base,
    borderRadius: sys.radius.control, borderWidth: 1, borderColor: sys.color.cardLine, backgroundColor: sys.color.surface },
});

/**
 * The foot of the first step: the ONE green command, named for the way the person is on, and under it, while an account is being
 * made, the one honest sentence about the legal documents (deep read 8.2, owner decision 2026-09-21, PKG-031: the tick asked to
 * accept two documents that are not published yet and recorded nothing; the screen says so instead, once, under the command that
 * creates the account; the recorded acceptance (profil/pravna) takes over once they are published).
 */
export function AuthFormFooter({ way, busy, onSubmit }: { way: AuthWay; busy: boolean; onSubmit: () => void }) {
  return <>
    <PrimaryButton title={way === 'SIGNUP' ? authCopy.signUp : authCopy.signIn} onPress={onSubmit} busy={busy} />
    {way === 'SIGNUP' ? <T variant="note" tone="muted" style={s.centred}>{authCopy.legal}</T> : null}
  </>;
}
