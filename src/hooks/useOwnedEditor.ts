import { useCallback, useMemo, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import type { Ishod } from '../data/ports';
import { sesijaSada, useSesija } from '../store/sesija';


/** A focused editor owns its read, draft and command outcome across account changes. */
export function useOwnedEditor<T>(read: () => Promise<Ishod<T>>) {
  const { user, accountRevision } = useSesija();
  const accountId = user?.id;
  const identity = useMemo(() => ({}), [read, accountId, accountRevision]);
  const owner = useRef<{ identity: object; current: () => boolean; generation: number;
    writing: boolean; reading: boolean; loaded: boolean; reconcileRequired: boolean } | null>(null);
  const seenIdentity = useRef<object | null>(null);
  // Losing focus has to reach the render, and it used to reach it only as a side effect of emptying
  // the data. Nothing is emptied now, so the blur says so itself.
  const [, redraw] = useState(0);
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uncertain, setUncertain] = useState(false);
  const [saved, setSaved] = useState(false);
  const renderedScope = owner.current;
  const renderedGeneration = renderedScope?.generation;

  const refresh = useCallback(async () => {
    const scope = owner.current;
    if (!scope?.current() || scope.identity !== identity || scope.writing) return;
    const generation = ++scope.generation;
    scope.reading = true;
    scope.loaded = false;
    setLoading(true);
    setError(null);
    // Not `setData(null)` here. Pressing "Osveži" or "Proveri stanje" used to empty the screen and
    // then draw it again, which on a phone reads as having deleted the thing you were looking at.
    // A change of account or intent is what makes a previous read worthless, and that is the identity
    // guard above and the reset in the identity effect — both still clear everything. Whether this
    // read keeps the old values is decided below, by what comes back.
    setSaved(false);
    try {
      const result = await read();
      if (!scope.current() || generation !== scope.generation) return;
      if (result.ok) { scope.loaded = true; scope.reconcileRequired = false; setData(result.podatak); setUncertain(false); }
      // The server answered and refused: it is saying our view is not the current one, so there is
      // nothing left on screen worth believing.
      else { setData(null); setError(result.poruka); }
    } catch {
      // The call never got an answer. Nothing has said the values are wrong — only that we could not
      // check them — so they stay, under the error.
      if (scope.current() && generation === scope.generation) setError('Podaci nisu učitani. Proveri vezu i pokušaj ponovo.');
    } finally {
      if (scope.current() && generation === scope.generation) { scope.reading = false; setLoading(false); }
    }
  }, [read, identity]);

  useFocusEffect(useCallback(() => {
    // This effect runs both when the screen is focused again and when the account or intent has
    // changed under it. Only the second is a reason to forget: coming back to a screen you left a
    // moment ago used to empty it and read it from the server again, so every step in and out of a
    // sub-screen cost a round trip and a skeleton. The unknown outcome of a save survives too,
    // because leaving the screen does not settle it.
    const changed = seenIdentity.current !== identity;
    seenIdentity.current = identity;
    const scope = { identity, generation: 0, writing: false, reading: false, loaded: false, reconcileRequired: false,
      current: () => owner.current === scope &&
      !!accountId && sesijaSada().user?.id === accountId &&
      sesijaSada().accountRevision === accountRevision };
    owner.current = scope;
    setBusy(false); setSaved(false);
    if (changed) { setUncertain(false); setData(null); }
    if (accountId) void refresh();
    else { setLoading(false); setError('Prijavi se da urediš podatke.'); }
    return () => {
      if (owner.current !== scope) return;
      owner.current = null;
      // Nothing is shown while blurred either way: `visible` below is false without an owner, so a
      // native modal above a retained tab still sees no editor body. What is kept is only kept for
      // the moment the screen comes back.
      setBusy(false); setSaved(false); setError(null); redraw(value => value + 1);
    };
  }, [accountId, accountRevision, refresh, identity]));

  async function save(command: () => Promise<Ishod<T>>, options?: { settledFailure?: (result: Ishod<unknown>) => boolean }) {
    const scope = owner.current;
    if (!scope?.current() || scope !== renderedScope || scope.generation !== renderedGeneration ||
      scope.identity !== identity || scope.writing || scope.reading ||
      !scope.loaded || scope.reconcileRequired || loading || uncertain || !data) return;
    scope.writing = true;
    setBusy(true); setError(null); setSaved(false);
    try {
      const result = await command();
      if (!scope.current()) return;
      if (result.ok) { scope.generation++; setData(result.podatak); setSaved(true); }
      else if (options?.settledFailure?.(result)) {
        // A narrowly proven command-owned refusal is terminal for this write.
        scope.generation++;
        scope.reconcileRequired = false;
        setError(result.poruka);
        setUncertain(false);
      } else {
        scope.reconcileRequired = true;
        setError(result.poruka);
        // Unknown, malformed and non-proven write failures still require reconciliation.
        // Keep the draft visible until the user explicitly reads server state.
        setUncertain(true);
      }
    } catch {
      if (scope.current()) { scope.reconcileRequired = true;
        setError('Čuvanje nije potvrđeno. Proveri sačuvano stanje pre novog pokušaja.'); setUncertain(true); }
    } finally {
      if (scope.current()) { scope.writing = false; setBusy(false); }
    }
  }
  const visible = owner.current?.identity === identity && owner.current.current();
  return { data: visible ? data : null, loaded: !!visible && !!owner.current?.loaded,
    loading: accountId ? !visible || loading : false,
    busy: visible && busy, error: visible || !accountId ? error : null,
    uncertain: visible && uncertain, saved: visible && saved, refresh, save };
}
