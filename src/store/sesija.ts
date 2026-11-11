
import { useSyncExternalStore } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabaseKlijent } from '../data/supabaseClient';
import { isRestrictedAccountSignal, restrictedRefreshRefusal } from '../data/authFailureClasses';
import { povratniCilj } from './povratniCilj';

/**
 * Why this device is signed out, when the provider said so (owner decision 2026-10-07). Only a restricted account is told
 * apart; every other sign-out stays silent. `revision` lets the sign-in screen show one reason exactly once.
 */
export type SignOutReason = { kind: 'RESTRICTED_ACCOUNT'; revision: number };

type SesijaStanje = {
  isLoaded: boolean;
  session: Session | null;
  user: User | null;
  sessionEpoch: number;
  accountRevision: number;
  returnTargetRevision: number;
  signOutReason: SignOutReason | null;
};

let trenutna: SesijaStanje = {
  isLoaded: false,
  session: null,
  user: null,
  sessionEpoch: 0,
  accountRevision: 0,
  returnTargetRevision: 0,
  signOutReason: null,
};

const pretplatnici = new Set<() => void>();

function obavesti() {
  pretplatnici.forEach((f) => f());
}

let initialized = false;
let pendingTargetCleanup: (() => Promise<void>) | null = null;

export function inicijalizujSesiju() {
  if (initialized) return;
  initialized = true;

  const supabase = supabaseKlijent();
  const restoreEpoch = trenutna.sessionEpoch;

  // Auth events take precedence over the startup read. Keep the callback
  // synchronous; storage work must not hold up Supabase's event dispatch.
  supabase.auth.onAuthStateChange((event, session) => {
    acceptSession(session, event === 'SIGNED_OUT');
    if (event === 'SIGNED_OUT') explainSignOut(supabase.auth);
  });

  const finishRestore = (session: Session | null) => {
    if (trenutna.sessionEpoch === restoreEpoch) acceptSession(session);
  };
  // Nothing bounded this read, and the native splash gives up after four seconds, so a stalled
  // restore handed the person a white field with a spinner and no words, no retry and no way out,
  // for as long as it hung. Every other read in the app has a bound: 10s for auth availability,
  // 15s for recovery, 5s for the intent write. A restore that does not answer means "signed out",
  // which lands on the entry rather than on nothing; a late real session still arrives through
  // onAuthStateChange, which is registered above and takes precedence.
  const bound = setTimeout(() => finishRestore(null), 8000);
  const settle = (session: Session | null) => { clearTimeout(bound); finishRestore(session); };
  try {
    void supabase.auth.getSession().then(
      ({ data, error }) => {
        settle(error ? null : data.session);
        // A restore whose own refresh the provider refused as restricted says so here, with no SIGNED_OUT of its own.
        if (error && isRestrictedAccountSignal(error)) noteRestrictedSignOut(error);
      },
      () => settle(null),
    );
  } catch {
    settle(null);
  }
}

/** The one refusal already shown, so a repeated SIGNED_OUT for the same refusal does not show it again. */
let explainedRefusal: unknown = null;
let reasonRevision = 0;

function noteRestrictedSignOut(source: unknown, accountRevision = trenutna.accountRevision) {
  // Only while still signed out and no other account has come and gone in between.
  if (trenutna.user || trenutna.accountRevision !== accountRevision || source === explainedRefusal) return;
  explainedRefusal = source;
  trenutna = { ...trenutna, signOutReason: { kind: 'RESTRICTED_ACCOUNT', revision: ++reasonRevision } };
  obavesti();
}

/**
 * auth-js reports a refused refresh as a bare SIGNED_OUT and records the refusal only after the event has been dispatched
 * (authFailureClasses.restrictedRefreshRefusal). Asking for the session again queues behind the client's own lock when the
 * refresh holds it, so it resolves once that refresh has finished; it reads storage only and sends nothing. The read itself
 * then waits one more task, because the record is written in the microtasks that follow the event. A sign-out this app
 * asked for clears the record first, so it never reads as restricted.
 */
function explainSignOut(auth: unknown) {
  const accountRevision = trenutna.accountRevision;
  const read = () => {
    const refusal = restrictedRefreshRefusal(auth);
    if (refusal) noteRestrictedSignOut(refusal, accountRevision);
  };
  const later = () => { setTimeout(read, 0); };
  try {
    const pending = (auth as { getSession?: () => unknown }).getSession?.();
    void Promise.resolve(pending).then(later, later);
  } catch {
    later();
  }
}

/** The sign-in screen has shown this reason; it is not shown again. */
export function potvrdiRazlogOdjave(revision: number) {
  if (trenutna.signOutReason?.revision !== revision) return;
  trenutna = { ...trenutna, signOutReason: null };
  obavesti();
}

function acceptSession(session: Session | null, signedOut = false) {
  const previousUserId = trenutna.user?.id;
  const identityChanged = previousUserId !== session?.user.id;
  const changedAccount = !!previousUserId && previousUserId !== session?.user.id;
  trenutna = {
    ...trenutna,
    isLoaded: true,
    session,
    user: session?.user ?? null,
    sessionEpoch: trenutna.sessionEpoch + 1,
    // Unlike an Auth-event epoch, identity ownership survives token refresh.
    // Every A→B→A transition remains visible even when React batches renders.
    accountRevision: trenutna.accountRevision + (identityChanged ? 1 : 0),
    // A session that arrives ends whatever the last sign-out said.
    signOutReason: session?.user ? null : trenutna.signOutReason,
  };
  const epoch = trenutna.sessionEpoch;
  // A session used to wait here, for up to 1.5 s, until a per-account UI mode had been restored from
  // storage, and the whole app stayed on the splash until it had. There is no such mode any more
  // (owner decision 1, 2026-09-19); the account and session fencing above is unchanged.
  if (signedOut || changedAccount) {
    pendingTargetCleanup = povratniCilj.captureSessionCleanup();
  }
  // Enqueue cleanup before a new account can prepare its own target. Retain
  // its boundary on failure so a later Auth confirmation can safely retry.
  const reset = pendingTargetCleanup;
  const cleanup = reset ? reset() : Promise.resolve();
  if (reset) void cleanup.then(() => {
    if (pendingTargetCleanup === reset) pendingTargetCleanup = null;
  }, () => {});
  obavesti();

  if (session?.user) {
    setTimeout(() => {
      // A storage failure leaves Auth usable and the pending target retryable
      // on the next session confirmation, without claiming intent completion.
      // If previous-account cleanup failed, do not adopt its pending target.
      void cleanup.then(() => resolveReturnTarget(session.user.id, epoch)).catch(() => {});
    }, 0);
  }
}

async function resolveReturnTarget(userId: string, epoch: number) {
  const isCurrent = () => trenutna.sessionEpoch === epoch && trenutna.user?.id === userId;
  if (!isCurrent()) return;
  const pending = await povratniCilj.snapshot();
  if (!isCurrent() || !pending || pending.status !== 'PENDING') return;
  const completed = await povratniCilj.markCompleted(userId, pending.intent, {
    isCurrent,
    pendingRevision: pending.recordRevision,
  });
  if (!isCurrent() || !completed) return;
  // RootLayout may have checked before the asynchronous target was completed.
  trenutna = { ...trenutna, returnTargetRevision: trenutna.returnTargetRevision + 1 };
  obavesti();
}

export function sesijaSada(): SesijaStanje {
  return trenutna;
}

export function useSesija(): SesijaStanje {
  return useSyncExternalStore(
    (f) => {
      pretplatnici.add(f);
      if (!initialized) inicijalizujSesiju();
      return () => pretplatnici.delete(f);
    },
    sesijaSada,
    sesijaSada,
  );
}

