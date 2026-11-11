import { useCallback, useEffect, useRef, useState } from 'react';
import { router, useFocusEffect } from 'expo-router';
import { NEW_PASSWORD_MIN, passwordChangeClientService, passwordChangeMessages } from '../../../data/passwordChangeClientService';
import { sesijaSada, useSesija } from '../../../store/sesija';
import { ChangePasswordView, type ChangePasswordField, type ChangePasswordPhase } from '../../../ui/settings/ChangePasswordPresentation';

const EMPTY = { current: '', next: '', repeat: '' } as const;

/** What the foot says while the green action cannot be pressed: the first thing that is missing, in the words of the sign-up. */
export function passwordChangeReason(values: Readonly<Record<ChangePasswordField, string>>): string | null {
  if (!values.current) return 'Upiši trenutnu lozinku.';
  if (values.next.length < NEW_PASSWORD_MIN) return `Nova lozinka mora imati najmanje ${NEW_PASSWORD_MIN} znakova.`;
  if (values.next === values.current) return 'Nova lozinka mora da bude drugačija od trenutne.';
  if (values.next !== values.repeat) return 'Nove lozinke se ne poklapaju.';
  return null;
}

/**
 * Promeni lozinku (R22): for the person who is signed in. The words typed live only here, in memory, and go when the screen does (a new
 * account, a blur and an unmount all clear them). The write is sent once and answered with a sentence of ours; what the service could not
 * confirm is said as "we do not know". The route owns the account fence and the way back; what is drawn is `ChangePasswordView`.
 */
export default function PromeniLozinku() {
  const { user, accountRevision } = useSesija();
  return <OwnedPasswordChange key={`${user?.id ?? ''}:${accountRevision}`} email={user?.email ?? null} />;
}

function OwnedPasswordChange({ email }: { email: string | null }) {
  const [values, setValues] = useState<Record<ChangePasswordField, string>>({ ...EMPTY });
  const [phase, setPhase] = useState<ChangePasswordPhase>('form');
  const [error, setError] = useState<string | null>(null);
  const owner = useRef(sesijaSada()), alive = useRef(true), focused = useRef(false), leaving = useRef(false);
  // A second press in the same moment must not send a second change (the state that says "saving" is only read at the next render).
  const sending = useRef(false);
  // Leaving the screen forgets what was typed; coming back starts empty.
  useFocusEffect(useCallback(() => {
    focused.current = true; leaving.current = false;
    return () => { focused.current = false; setValues({ ...EMPTY }); setError(null); setPhase('form'); };
  }, []));
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const current = () => alive.current && focused.current && sesijaSada().user?.id === owner.current.user?.id && sesijaSada().accountRevision === owner.current.accountRevision;
  const back = () => { if (leaving.current) return; leaving.current = true; if (router.canGoBack()) router.back(); else router.replace('/profil'); };
  const reason = passwordChangeReason(values);
  const submit = async () => {
    if (!current() || sending.current || phase !== 'form' || reason !== null) return;
    sending.current = true;
    setPhase('saving'); setError(null);
    try {
      const result = await passwordChangeClientService.change(values.current, values.next);
      if (!current()) return;
      if (result.ok) { setValues({ ...EMPTY }); setPhase('done'); return; }
      setError(passwordChangeMessages[result.code]);
      // A refusal that is about the typed words keeps the form for another try; a lost answer too, with its sentence above.
      setPhase('form');
    } catch {
      // The service normally returns a classified result. If an unexpected client error escapes it, the write's outcome is unknown.
      if (current()) { setError(passwordChangeMessages.UNKNOWN_OUTCOME); setPhase('form'); }
    } finally { sending.current = false; }
  };
  return <ChangePasswordView email={email} values={values} phase={phase} error={error} reason={reason}
    onChange={(field, value) => { if (current() && phase === 'form') { setValues(previous => ({ ...previous, [field]: value })); setError(null); } }}
    onSubmit={() => { void submit(); }} onBack={back} />;
}
