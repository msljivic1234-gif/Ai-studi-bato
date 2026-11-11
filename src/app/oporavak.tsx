import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { BackHandler, KeyboardAvoidingView, Platform, StyleSheet, View, type ScrollView } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { passwordRecoveryIntent } from '../store/passwordRecoveryIntent';
import { usePasswordRecovery } from '../hooks/usePasswordRecovery';
import { useSesija } from '../store/sesija';
import { sys } from '../ui/system/tokens';
import { AuthFlowFrame } from '../ui/auth/AuthFlowFrame';
import { RecoveryLinkContent, RecoveryLinkFooter, MISMATCH, type RecoveryLinkPhase, type RecoveryLinkValidation } from '../ui/auth/RecoveryLinkSteps';
import { RestrictedAccountScreen } from '../ui/auth/RestrictedAccountPanel';
import { authCopy } from '../ui/auth/authCopy';
import { MIN_PASSWORD_LENGTH, authFieldMessages } from '../ui/auth/authValidation';

type RecoveryState = ReturnType<typeof usePasswordRecovery>['state'];
/** What the hook knows, as the screen's own states (`ready` and `saving` are one: the fields, with the write in flight or not). */
function phaseOf(state: RecoveryState): RecoveryLinkPhase {
  switch (state.status) {
    case 'verifying': return { kind: 'verifying' };
    case 'ready': case 'saving': return { kind: 'form', email: state.identity.email, serverError: state.error?.message ?? null };
    case 'success': return { kind: 'success' };
    case 'error': return { kind: 'error', code: state.error.code, message: state.error.message };
  }
}

/**
 * The screen the password-recovery LINK opens (the request for the link is a step of the sign-in sheet, "Oporavak lozinke").
 * It is the same frame as every step of that sheet: the system's top bar with the one arrow back and the flow's name, ONE title
 * in the content, the fields, and in the foot the ONE green command; the second green button it had in an error, the second
 * "Nazad" and the line with the build's version are gone. It never explains where you are: the title says what to do.
 */
export default function PasswordRecoveryScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useSesija();
  const intent = useSyncExternalStore(passwordRecoveryIntent.subscribe, passwordRecoveryIntent.snapshot, passwordRecoveryIntent.serverSnapshot);
  const link = intent?.link ?? null;
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [validation, setValidation] = useState<RecoveryLinkValidation>(null);
  const recovery = usePasswordRecovery(link, intent?.id ?? null);
  const busy = recovery.state.status === 'saving';
  const scroller = useRef<ScrollView>(null);
  const back = () => {
    if (intent) passwordRecoveryIntent.clear(intent.id);
    router.replace(user ? '/' : { pathname: '/auth', params: { form: 'login' } });
  };
  const newLink = () => router.replace({ pathname: '/auth', params: { form: 'recovery' } });

  useEffect(() => {
    setPassword(''); setConfirmation(''); setValidation(null);
  }, [intent?.id]);

  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (!busy) back();
      return true;
    });
    return () => subscription.remove();
    // `back` closes over exactly the values listed (the link that is open included: Back clears THAT one, also after a second link arrived).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busy, router, user?.id, intent?.id]);

  useEffect(() => {
    if (recovery.state.status === 'success' || recovery.state.status === 'error') {
      setPassword(''); setConfirmation('');
    }
  }, [recovery.state.status]);

  async function save() {
    if (busy) return;
    if (password.length < MIN_PASSWORD_LENGTH) { setValidation({ field: 'password', message: authFieldMessages.lozinkaShort }); return; }
    if (password !== confirmation) { setValidation({ field: 'confirmation', message: MISMATCH }); return; }
    setValidation(null);
    await recovery.save(password);
  }

  const state = recovery.state;
  // Owner decision 2026-10-07, design proposal N3: the link of a restricted account is not "expired", and a new link would
  // change nothing, so none is offered. The screen is the restricted-account screen with its one way back, not a state under
  // the greeting of a form that can no longer be used.
  if (state.status === 'error' && state.error.code === 'RESTRICTED_ACCOUNT') {
    return <RestrictedAccountScreen exitLabel={user ? 'Nazad u aplikaciju' : authCopy.backToSignIn} onExit={back} />;
  }

  const phase = phaseOf(state);

  return <View style={[s.screen, { paddingTop: insets.top }]}>
    <StatusBar style="dark" />
    <KeyboardAvoidingView style={s.fill} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <AuthFlowFrame title={authCopy.recoveryName} onBack={back} backDisabled={busy} scrollRef={scroller} scrollKey={phase.kind}
        footer={phase.kind === 'verifying' ? null
          : <RecoveryLinkFooter phase={phase} signedIn={!!user} busy={busy} onSave={() => void save()} onBack={back} onNewLink={newLink} onRetry={recovery.retry} />}>
        <RecoveryLinkContent phase={phase} signedIn={!!user} busy={busy} password={password} confirmation={confirmation} validation={validation}
          onPassword={value => { setPassword(value); setValidation(null); }} onConfirmation={value => { setConfirmation(value); setValidation(null); }}
          onSave={() => void save()} onNewLink={newLink} />
      </AuthFlowFrame>
    </KeyboardAvoidingView>
  </View>;
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: sys.color.surface },
  fill: { flex: 1 },
});
