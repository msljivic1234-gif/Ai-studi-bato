import { useCallback, useEffect, useRef, useState } from 'react';
import { sesijaSada } from '../store/sesija';

/** One Auth mutation at a time; Auth events retain ownership of session changes. */
export function useAuthFormCommand() {
  const [busy, setBusy] = useState(false);
  const mounted = useRef(true);
  const inFlight = useRef(false);
  const formRevision = useRef(0);
  const [renderedRevision, setRenderedRevision] = useState(0);
  const lifetime = useRef(0);
  const accountAtRender = sesijaSada().accountRevision;
  const signedOutAtRender = !sesijaSada().user;
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; lifetime.current++; };
  }, []);

  const changeForm = useCallback((change: () => void) => {
    if (!mounted.current || inFlight.current || !signedOutAtRender || sesijaSada().user ||
      sesijaSada().accountRevision !== accountAtRender) return false;
    formRevision.current++;
    setRenderedRevision(formRevision.current);
    change();
    return true;
  }, [accountAtRender, signedOutAtRender]);

  const run = useCallback(async <T,>(
    command: () => Promise<T>,
    success: (value: T) => void,
    failure: (error: unknown) => void,
  ) => {
    if (!mounted.current || inFlight.current || formRevision.current !== renderedRevision) return;
    const owner = sesijaSada();
    if (!signedOutAtRender || owner.user || owner.accountRevision !== accountAtRender) return;
    const revision = formRevision.current;
    const ownLifetime = lifetime.current;
    const accountRevision = owner.accountRevision;
    inFlight.current = true;
    setBusy(true);
    const current = () => mounted.current && lifetime.current === ownLifetime && formRevision.current === revision &&
      !sesijaSada().user && sesijaSada().accountRevision === accountRevision;
    try {
      const value = await command();
      if (current()) success(value);
    } catch (error) {
      if (current()) failure(error);
    } finally {
      inFlight.current = false;
      if (current()) setBusy(false);
    }
  }, [renderedRevision, accountAtRender, signedOutAtRender]);
  return { busy, changeForm, run };
}
