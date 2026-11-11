import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type ReactNode, type RefObject } from 'react';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { BackHandler, KeyboardAvoidingView, Linking, Platform, StyleSheet, View, type ScrollView, type TextInput } from 'react-native';
import { StatusBar } from 'expo-status-bar';

import { T } from '../ui/Text';
import { AuthIntro } from '../ui/auth/AuthPresentation';
import { AuthSheet } from '../ui/auth/AuthSheet';
import { AuthFlowFrame } from '../ui/auth/AuthFlowFrame';
import { AuthFormFooter, AuthFormStep, type AuthCheck } from '../ui/auth/AuthFormStep';
import { OtpStep, PhoneStep, PhoneUnavailableStep, RecoverySentStep, RecoveryStep, SignupNextStep } from '../ui/auth/AuthStateSteps';
import { PrimaryButton } from '../ui/auth/AuthControls';
import { RestrictedAccountScreen } from '../ui/auth/RestrictedAccountPanel';
import { authCopy } from '../ui/auth/authCopy';
import { defaultAuthMethods } from '../ui/auth/authMethods';
import {
  authFieldMessages, firstInvalidField, isEmailAddress, validateAuthForm, type AuthFieldErrors, type AuthFieldName,
} from '../ui/auth/authValidation';
import { publicSupportMailto } from '../ui/auth/supportContact';

import { authClientService } from '../data/authClientService';
import { PROVIDER_UNAVAILABLE_COPY, RATE_LIMITED_COPY, isRestrictedAccountFailure } from '../data/authFailureClasses';
import type { AuthAvailability } from '../contracts/authAvailability';
import { useAuthAvailability } from '../hooks/useAuthAvailability';
import { useAuthFormCommand } from '../hooks/useAuthFormCommand';
import { EntryWelcome, type EntryIntentSelection } from '../ui/entry/EntryWelcome';
import { entryIntentClientService } from '../data/entryIntentClientService';
import { potvrdiRazlogOdjave, sesijaSada, useSesija } from '../store/sesija';
import { useEntrySplashReady } from '../hooks/useEntrySplashReady';
import { signupConfirmationIntent } from '../store/signupConfirmationIntent';
import type { SignupReturnKind } from '../data/signupConfirmationReturn';

type Rezim = 'LOGIN' | 'SIGNUP';
type Faza = 'EMAIL' | 'PHONE' | 'OTP' | 'RECOVERY' | 'SIGNUP_NEXT_STEP' | 'RECOVERY_SENT' | 'RESTRICTED';
/** Said above the grey command when the server has email sign-in switched off. */
const EMAIL_OFF = 'Prijava emailom trenutno nije dostupna.';
/** What a failure offers as its next step: to sign in (an account may exist already) or to send the confirmation again. */
type FailureNext = 'HAVE_ACCOUNT' | 'RESEND' | null;

export default function AuthScreen() {
  const params = useLocalSearchParams<{ form?: string }>();
  const [entryFocusRevision, refreshEntryFocus] = useState(0);
  const entryScope = useRef({ focused: true, revision: 0, form: params.form });
  if (entryScope.current.form !== params.form) {
    entryScope.current.form = params.form;
    entryScope.current.revision++;
  }
  const entryRevision = entryScope.current.revision;
  useFocusEffect(useCallback(() => {
    entryScope.current.focused = true;
    refreshEntryFocus(value => value + 1);
    return () => { entryScope.current.focused = false; entryScope.current.revision++; };
  }, []));
  const [otvoren, setOtvoren] = useState(params.form === 'login' || params.form === 'recovery');
  const [entrySeen, setEntrySeen] = useState(!otvoren);
  useEffect(() => { if (!otvoren) setEntrySeen(true); }, [otvoren]);
  const { onLayout: onFormLayout } = useEntrySplashReady({ enabled: otvoren });
  const [rezim, setRezim] = useState<Rezim>('LOGIN');
  const [faza, setFaza] = useState<Faza>(params.form === 'recovery' ? 'RECOVERY' : 'EMAIL');
  // Presentation only: a choice becomes visible after its owned prepare succeeds.
  const [preparedIntent, setPreparedIntent] = useState<{ intent: 'REQUESTER' | 'WORKER'; accountRevision: number } | null>(null);
  const session = sesijaSada();
  const selectedIntent = !session.user && preparedIntent?.accountRevision === session.accountRevision ? preparedIntent.intent : null;

  const [ime, setIme] = useState('');
  const [prezime, setPrezime] = useState('');
  const [email, setEmail] = useState('');
  // Signing up asks for the password once (design proposal N2): the eye on the field shows it, so a typo can be seen and
  // fixed there, and a second field that had to match the first is gone.
  const [lozinka, setLozinka] = useState('');
  const [telefon, setTelefon] = useState('');
  const [otp, setOtp] = useState('');
  const [confirmationRequired, setConfirmationRequired] = useState(true);

  const commands = useAuthFormCommand();
  const radi = commands.busy;
  // Gated on `otvoren` alone, this 10-second read only started once the sheet had finished opening,
  // after the 760ms doorway and after up to 5s of writing the chosen intent — so the worst case
  // between the tap and a field you could type in was about sixteen seconds of spinner. It now
  // starts the moment an intent is chosen, so it overlaps the doorway and the write instead of
  // queueing behind them. Someone who never touches the entry still causes no read.
  const availability = useAuthAvailability(otvoren || !!preparedIntent);
  // THE FORM NEVER WAITS FOR THIS READ. Email and password is the way in; what the read finds only refines it (the phone, a
  // closed sign-up). A read that is slow or fails leaves the form fully usable and says so quietly, under the form, with a way to
  // try again (owner, on the phone and on the emulator, 2026-10-07: "Ne možemo da proverimo dostupne načine prijave" locked it).
  // While the read is made again (the app came back to the front) the last answer stands, so nothing flickers.
  const lastRead = useRef<AuthAvailability | null>(null);
  if (availability.status === 'ready') lastRead.current = availability.data;
  const methods: AuthAvailability = availability.status === 'ready' ? availability.data : lastRead.current ?? defaultAuthMethods();
  const check: AuthCheck = availability.status === 'error' ? 'failed' : availability.status === 'ready' || lastRead.current ? 'done' : 'loading';
  /** What the commands may rely on: a fresh answer if there is one, otherwise what the form offers by default. */
  const offered = () => availability.current() ?? defaultAuthMethods();

  const [greska, setGreska] = useState<string | null>(null);
  const [poruka, setPoruka] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<AuthFieldErrors>({});
  const [failureNext, setFailureNext] = useState<FailureNext>(null);
  const returnedSignup = useSyncExternalStore(signupConfirmationIntent.subscribe, signupConfirmationIntent.snapshot, signupConfirmationIntent.serverSnapshot);
  const [signupReturn, setSignupReturn] = useState<{ kind: SignupReturnKind; accountRevision: number } | null>(null);
  const clearFeedback = () => { setGreska(null); setPoruka(null); setFieldErrors({}); setFailureNext(null); };
  const signOutReason = useSesija().signOutReason;
  // Owner decision 2026-10-07: a restricted account is its own screen, not a line of red text under the form. Nobody is signed
  // in then, so there is no private support to open; "Obrati se podršci" is drawn only when the owner has given a public address.
  const supportUrl = publicSupportMailto();
  const inputRefs: Record<AuthFieldName, RefObject<TextInput | null>> = {
    ime: useRef<TextInput>(null), prezime: useRef<TextInput>(null),
    email: useRef<TextInput>(null), lozinka: useRef<TextInput>(null),
  };

  // Every callback is an event, including a second link to the same form. It never starts an Auth command.
  useEffect(() => {
    if (!returnedSignup) return;
    const owner = sesijaSada();
    // Native intent publishes before Router brings a covered Auth screen back into focus.
    if (!owner.user && !entryScope.current.focused) return;
    if (!owner.user && entryScope.current.focused) {
      const applied = commands.changeForm(() => {
        setRezim('LOGIN'); setFaza('EMAIL'); setLozinka(''); clearFeedback(); setOtvoren(true);
        setConfirmationRequired(true);
        setSignupReturn({ kind: returnedSignup.kind, accountRevision: owner.accountRevision });
        scroller.current?.scrollTo?.({ y: 0, animated: false });
      });
      // An existing sign-in/signup/resend owns its result. Do not queue a later form reset over it.
      if (!applied) setSignupReturn(null);
    }
    signupConfirmationIntent.clear(returnedSignup.id);
    // Focus may arrive after the callback. Keystrokes and command completion must not replay it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [returnedSignup?.id, entryFocusRevision]);

  // A session the provider ended because the account is restricted shows that screen, once.
  useEffect(() => {
    if (signOutReason?.kind !== 'RESTRICTED_ACCOUNT') return;
    const shown = commands.changeForm(() => {
      setPreparedIntent(null); setRezim('LOGIN'); setFaza('RESTRICTED');
      setLozinka(''); setOtp(''); clearFeedback();
      setOtvoren(true);
    });
    // While an Auth command runs the form cannot change; `radi` re-runs this once it has settled.
    if (shown) potvrdiRazlogOdjave(signOutReason.revision);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signOutReason?.kind, signOutReason?.revision, commands.changeForm, radi]);

  const handledRouteForm = useRef(params.form);
  useEffect(() => {
    if (handledRouteForm.current === params.form) return;
    handledRouteForm.current = params.form;
    if (params.form !== 'login' && params.form !== 'recovery') return;
    // Native query parameters may arrive after mount; warm links also reuse
    // this screen. Consume each change once, without interrupting an Auth write
    // or replaying the parameter over a form the person selected themselves.
    commands.changeForm(() => {
      setPreparedIntent(null);
      setRezim('LOGIN');
      setFaza(params.form === 'recovery' ? 'RECOVERY' : 'EMAIL');
      setLozinka(''); clearFeedback();
      setOtvoren(true);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.form, commands.changeForm]);

  // One step back, for the arrow and for the phone's Back: any step after the form returns to the sign-in form, and the form
  // itself, in either mode (they are two sides of one screen), closes the sheet and shows the entry again.
  const retreat = () => commands.changeForm(() => {
    setSignupReturn(null);
    if (faza !== 'EMAIL') { setFaza('EMAIL'); setRezim('LOGIN'); }
    else setOtvoren(false);
    clearFeedback();
  });
  useEffect(() => {
    if (!otvoren) return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      retreat();
      return true;
    });
    return () => subscription.remove();
    // `retreat` closes over exactly the values listed; the subscription is renewed whenever one of them changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [commands.changeForm, otvoren, faza]);

  function otvori(mode: Rezim = 'LOGIN') {
    commands.changeForm(() => {
      setSignupReturn(null);
      setPreparedIntent(null);
      setRezim(mode);
      setFaza('EMAIL');
      clearFeedback();
      setOtvoren(true);
    });
  }

  function nazadNaEmail() {
    commands.changeForm(() => {
      setRezim('LOGIN');
      setFaza('EMAIL');
      clearFeedback();
    });
  }

  function prijaviGresku(error: unknown, where: 'signup' | 'signin' | 'other' = 'other') {
    if (isRestrictedAccountFailure(error)) {
      // Nothing typed was wrong, and typing it again changes nothing: the secrets are cleared, the email stays.
      setLozinka(''); setOtp(''); clearFeedback();
      setFaza('RESTRICTED');
      return;
    }
    const message = error instanceof Error ? error.message : authCopy.failed;
    setGreska(message);
    // The one next step a failure can offer: an email that is not confirmed yet can be sent again; a sign-up that did not go
    // through may be an account that is already there (owner research R21), unless the provider was only too busy or away.
    setFailureNext(where === 'signin' && (error as { failureClass?: unknown } | null)?.failureClass === 'EMAIL_NOT_CONFIRMED' ? 'RESEND'
      : where === 'signup' && message !== RATE_LIMITED_COPY && message !== PROVIDER_UNAVAILABLE_COPY ? 'HAVE_ACCOUNT' : null);
  }

  /**
   * The entry's two halves choose what the person has come to do. A person who has chosen is a person who has no account yet
   * more often than not, so the form opens on creating one (design proposal N2) with the choice kept as one sentence; the
   * switch on the form is one touch away from signing in. `changing` is that sentence's own "Promeni": the same write of the
   * same choice, but it must not move the form, clear what was typed or close anything.
   */
  async function izaberiNameru(intent: 'REQUESTER' | 'WORKER', selection?: EntryIntentSelection, changing = false) {
    const current = () => entryScope.current.focused && entryScope.current.revision === entryRevision &&
      (selection?.isCurrent() ?? true);
    if (!current()) return;
    await commands.run(() => entryIntentClientService.prepare(intent, current), () => {
      if (!current()) return;
      setPreparedIntent({ intent, accountRevision: sesijaSada().accountRevision });
      if (changing) return;
      setRezim('SIGNUP'); setFaza('EMAIL'); clearFeedback(); setOtvoren(true);
    }, () => { if (current()) setGreska('Izbor nije sačuvan. Pokušajte ponovo.'); });
  }

  async function emailAkcija() {
    const ready = offered();
    if (!(rezim === 'SIGNUP' ? ready.emailSignup : ready.emailPassword)) return;
    // What is missing or wrong is said under the field it is about, before anything is sent; the first such field takes the focus.
    const problems = validateAuthForm(rezim, { ime, prezime, email, lozinka });
    const first = firstInvalidField(problems);
    if (first) {
      clearFeedback();
      setFieldErrors(problems);
      inputRefs[first].current?.focus();
      return;
    }
    setFieldErrors({});
    await commands.run(async () => {
      setSignupReturn(null);
      setGreska(null);
      setPoruka(null);
      setFailureNext(null);
      if (rezim === 'LOGIN') {
        await authClientService.signInWithPassword({ email: email.trim(), password: lozinka });
        return true;
      }
      const result = await authClientService.signUp({
        email: email.trim(), password: lozinka,
        firstName: ime.trim(), lastName: prezime.trim(),
      });
      return result.hasSession;
    }, hasSession => {
      if (!hasSession) {
        setLozinka('');
        setConfirmationRequired(ready.emailConfirmationRequired);
        setFaza('SIGNUP_NEXT_STEP');
      }
    }, error => prijaviGresku(error, rezim === 'SIGNUP' ? 'signup' : 'signin'));
  }

  async function ponoviPotvrduEmaila() {
    if (!confirmationRequired) return;
    if (!isEmailAddress(email.trim())) {
      setFieldErrors(current => ({ ...current, email: email.trim() ? authFieldMessages.emailInvalid : authFieldMessages.emailMissing }));
      inputRefs.email.current?.focus();
      return;
    }
    await commands.run(async () => {
      clearFeedback();
      await authClientService.resendSignupConfirmation(email.trim());
    }, () => {
      setSignupReturn(null);
      setPoruka('Ako email čeka potvrdu, stići će nova poruka. Proveri i neželjenu poštu.');
    }, error => prijaviGresku(error));
  }

  async function posaljiTelefon() {
    if (!availability.current()?.phoneOtp) return;
    await commands.run(async () => {
      clearFeedback();
      await authClientService.sendPhoneOtp({ phone: telefon.trim() });
    }, () => {
      setFaza('OTP');
      setPoruka('Poslali smo ti kod.');
    }, error => prijaviGresku(error));
  }

  async function potvrdiOtp() {
    if (!availability.current()?.phoneOtp) return;
    await commands.run(async () => {
      setGreska(null);
      await authClientService.verifyPhoneOtp({ phone: telefon.trim(), token: otp.trim() });
    }, () => {}, error => prijaviGresku(error));
  }

  async function zatraziOporavak() {
    if (!offered().passwordRecovery) return;
    // The address is checked here, under its field; the service checks it again before it sends anything.
    if (!email.trim() || !isEmailAddress(email)) {
      clearFeedback();
      setFieldErrors({ email: email.trim() ? authFieldMessages.emailInvalid : authFieldMessages.emailMissing });
      inputRefs.email.current?.focus();
      return;
    }
    setFieldErrors({});
    await commands.run(async () => {
      setGreska(null); setPoruka(null);
      await authClientService.requestPasswordRecovery(email);
    }, () => {
      setLozinka(''); setFaza('RECOVERY_SENT');
    }, error => prijaviGresku(error));
  }

  // Each way in starts at its own top: the switch scrolls the form back up, so the fields of the longer one are never hidden
  // above where the shorter one had been scrolled to (the form is one surface, so it is the same ScrollView that rewinds).
  const scroller = useRef<ScrollView>(null);
  const switchWay = (next: Rezim) => commands.changeForm(() => {
    setRezim(next); clearFeedback(); setSignupReturn(null);
    scroller.current?.scrollTo?.({ y: 0, animated: false });
  });
  const onValue = (name: AuthFieldName, value: string) => commands.changeForm(() => {
    ({ ime: setIme, prezime: setPrezime, email: setEmail, lozinka: setLozinka })[name](value);
    // What was said about a field is not true any more once it is edited; neither is the answer to the last command.
    setFieldErrors(current => {
      if (current[name] === undefined) return current;
      const { [name]: _gone, ...rest } = current;
      return rest;
    });
    if (name === 'email' || name === 'lozinka') { setGreska(null); setFailureNext(null); }
  });

  const failureAction = failureNext === 'HAVE_ACCOUNT' ? { note: 'Možda već imate nalog.', label: authCopy.signIn, onPress: () => { switchWay('LOGIN'); } }
    : failureNext === 'RESEND' ? { label: 'Pošaljite ponovo potvrdu', onPress: () => { void ponoviPotvrduEmaila(); } } : null;
  const signupClosed = rezim === 'SIGNUP' && !methods.emailSignup;
  const emailAvailable = rezim === 'SIGNUP' ? methods.emailSignup : methods.emailPassword;
  const toSignIn = <PrimaryButton title={authCopy.backToSignIn} onPress={nazadNaEmail} busy={radi} />;

  // What the step shows and the one green command that stands in the foot of the sheet. Every step has exactly one.
  let content: ReactNode = null;
  let footer: ReactNode = null;
  let footerReason: string | undefined;
  if (faza === 'EMAIL') {
    if (signupClosed) {
      content = <>
        <AuthIntro title={authCopy.signUp} />
        <T variant="copy" tone="muted">Otvaranje novih naloga trenutno nije dostupno.</T>
      </>;
      footer = toSignIn;
    } else {
      content = <AuthFormStep way={rezim} onWay={switchWay} emailOpen={emailAvailable} signUpOpen={methods.emailSignup}
        phoneOpen={methods.phoneOtp} intent={selectedIntent} onIntentChange={next => { void izaberiNameru(next, undefined, true); }}
        values={{ ime, prezime, email, lozinka }} onValue={onValue}
        errors={fieldErrors} failure={greska} failureAction={failureAction} notice={poruka} confirmEmail={methods.emailConfirmationRequired}
        signupReturn={signupReturn?.accountRevision === session.accountRevision && rezim === 'LOGIN' ? signupReturn.kind : null}
        onResendConfirmation={() => void ponoviPotvrduEmaila()}
        busy={radi} check={check} onRetryCheck={() => void availability.retry()}
        onForgot={() => commands.changeForm(() => { setSignupReturn(null); setFaza('RECOVERY'); setLozinka(''); clearFeedback(); })}
        onPhone={() => commands.changeForm(() => { setSignupReturn(null); setFaza('PHONE'); clearFeedback(); })}
        onSubmit={() => void emailAkcija()} inputRefs={inputRefs} />;
      // Each mode follows its own availability flag: sign-up stays usable even if password sign-in is closed.
      // An unavailable sign-in command remains visible with a reason above it.
      footer = emailAvailable ? <AuthFormFooter way={rezim} busy={radi} onSubmit={() => void emailAkcija()} />
        : <PrimaryButton title={authCopy.signIn} onPress={() => undefined} disabled />;
      footerReason = emailAvailable ? undefined : EMAIL_OFF;
    }
  } else if (faza === 'PHONE' || faza === 'OTP') {
    if (!methods.phoneOtp) {
      content = <PhoneUnavailableStep />;
      footer = toSignIn;
    } else if (faza === 'PHONE') {
      content = <PhoneStep signUp={rezim === 'SIGNUP'} phone={telefon} onChange={value => commands.changeForm(() => setTelefon(value))}
        editable={!radi} error={null} failure={greska} onSubmit={() => void posaljiTelefon()} />;
      footer = <PrimaryButton title="Pošaljite kod" onPress={() => void posaljiTelefon()} busy={radi} />;
    } else {
      content = <OtpStep code={otp} onChange={value => commands.changeForm(() => setOtp(value))} editable={!radi} error={null}
        notice={poruka} failure={greska} busy={radi} onSubmit={() => void potvrdiOtp()} onResend={() => void posaljiTelefon()}
        onChangePhone={() => commands.changeForm(() => setFaza('PHONE'))} />;
      footer = <PrimaryButton title="Potvrdite kod" onPress={() => void potvrdiOtp()} busy={radi} />;
    }
  } else if (faza === 'RECOVERY') {
    content = <RecoveryStep available={methods.passwordRecovery} email={email} onChange={value => onValue('email', value)} editable={!radi}
      error={fieldErrors.email ?? null} inputRef={inputRefs.email} failure={greska} onSubmit={() => void zatraziOporavak()} />;
    footer = methods.passwordRecovery ? <PrimaryButton title="Pošaljite link" busy={radi} onPress={() => void zatraziOporavak()} /> : toSignIn;
  } else if (faza === 'RECOVERY_SENT') {
    content = <RecoverySentStep email={email} onChangeEmail={() => commands.changeForm(() => { setFaza('RECOVERY'); clearFeedback(); })} />;
    footer = <PrimaryButton title={authCopy.backToSignIn} onPress={nazadNaEmail} />;
  } else if (faza === 'SIGNUP_NEXT_STEP') {
    content = <SignupNextStep confirmationRequired={confirmationRequired} email={email} notice={poruka} failure={greska} busy={radi}
      onResend={() => void ponoviPotvrduEmaila()} onChangeEmail={() => commands.changeForm(() => { setRezim('SIGNUP'); setFaza('EMAIL'); clearFeedback(); })} />;
    footer = toSignIn;
  }

  return (
    <><KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.fill}>
    {/* While the restricted-account screen stands over it, what lies beneath is neither read aloud nor reachable. */}
    <View style={styles.fill} importantForAccessibility={faza === 'RESTRICTED' ? 'no-hide-descendants' : 'auto'}
      accessibilityElementsHidden={faza === 'RESTRICTED'}>
    {/* The sheet keeps one height while both ways are (or are about to be) offered, so switching between them never moves its edge. */}
    <AuthSheet visible={otvoren} expanded={faza === 'EMAIL' && !signupClosed}
      backdrop={entrySeen ? <EntryWelcome
      onRequester={selection => izaberiNameru('REQUESTER', selection)} onWorker={selection => izaberiNameru('WORKER', selection)}
      onSignIn={() => otvori('LOGIN')} onSignUp={() => otvori('SIGNUP')} busy={radi || otvoren} error={otvoren ? null : greska} /> : null}>
    <View onLayout={onFormLayout} style={styles.fill}>
      <StatusBar style="dark" />
      <AuthFlowFrame onBack={() => { retreat(); }} backDisabled={radi} scrollRef={scroller} scrollKey={faza} footer={footer} footerReason={footerReason}>
        {content}
      </AuthFlowFrame>
    </View>
    </AuthSheet>
    </View>
    {/* N3: a restricted account has a screen of its own, not a window over the entry. There is no bottom bar on /auth, and the
        one way out goes back to the sign-in form (nobody is signed in, so there is nothing to sign out of). */}
    {faza === 'RESTRICTED' ? <RestrictedAccountScreen exitLabel={authCopy.backToSignIn} onExit={nazadNaEmail} busy={radi}
      onSupport={supportUrl ? () => Linking.openURL(supportUrl) : undefined} /> : null}
    </KeyboardAvoidingView></>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
});
