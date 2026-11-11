import { useCallback, useEffect, useRef, useState } from 'react';
import type { PasswordRecoverySession, RecoveryIdentity } from '../contracts/passwordRecovery';
import { PasswordRecoveryError } from '../contracts/passwordRecovery';
import { passwordRecoveryClientService } from '../data/passwordRecoveryClientService';
import { recoveryError } from '../data/passwordRecoveryErrors';
import { sesijaSada, useSesija } from '../store/sesija';

type State =
  | { status: 'verifying' }
  | { status: 'ready' | 'saving'; identity: RecoveryIdentity; error?: PasswordRecoveryError }
  | { status: 'success' }
  | { status: 'error'; error: PasswordRecoveryError };

export function usePasswordRecovery(link: string | null, intentId: number | null) {
  const account = useSesija();
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<State>({ status: 'verifying' });
  const active = useRef<{ service: PasswordRecoverySession; revision: number } | null>(null);
  const saving = useRef(false);
  const interruptedWrite = useRef(false);

  useEffect(() => {
    if (account.user) {
      setState({ status: 'error', error: new PasswordRecoveryError('SIGNED_IN') });
      return;
    }
    if (interruptedWrite.current) {
      saving.current = false;
      setState({ status: 'error', error: new PasswordRecoveryError('UPDATE_UNKNOWN') });
      return;
    }
    if (!link) {
      setState({ status: 'error', error: new PasswordRecoveryError('INVALID_LINK') });
      return;
    }
    const lease = { service: passwordRecoveryClientService.createSession(), revision: account.accountRevision };
    active.current = lease;
    saving.current = false;
    setState({ status: 'verifying' });
    const current = () => active.current === lease && !sesijaSada().user && sesijaSada().accountRevision === lease.revision;
    void lease.service.verify(link).then(identity => {
      if (current()) setState({ status: 'ready', identity });
    }, error => {
      if (current()) setState({ status: 'error', error: recoveryError(error, 'verify') });
    });
    return () => {
      if (saving.current) interruptedWrite.current = true;
      if (active.current === lease) active.current = null;
      lease.service.dispose();
    };
  // A new OS event is a new attempt even when it carries the same link.
  // Never reuse a prior success as the result of a newly opened callback.
  }, [link, intentId, attempt, account.accountRevision, account.user?.id]);

  const save = useCallback(async (password: string) => {
    const lease = active.current;
    if (saving.current || state.status !== 'ready' || !lease) return;
    const current = () => active.current === lease && !sesijaSada().user && sesijaSada().accountRevision === lease.revision;
    if (!current()) return;
    saving.current = true;
    const identity = state.identity;
    setState({ status: 'saving', identity });
    try {
      await lease.service.updatePassword(password);
      if (current()) setState({ status: 'success' });
    } catch (error) {
      if (!current()) return;
      const failure = recoveryError(error, 'update');
      if (['WEAK_PASSWORD', 'SAME_PASSWORD', 'RATE_LIMITED'].includes(failure.code)) {
        setState({ status: 'ready', identity, error: failure });
      } else setState({ status: 'error', error: failure });
    } finally {
      if (active.current === lease) saving.current = false;
    }
  }, [state]);

  const retry = useCallback(() => {
    if (state.status === 'error' && state.error.code === 'VERIFY_UNAVAILABLE' && !saving.current) setAttempt(value => value + 1);
  }, [state]);

  return { state, save, retry };
}
