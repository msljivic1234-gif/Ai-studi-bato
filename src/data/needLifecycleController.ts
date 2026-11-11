import type { NeedLifecycleCommand, NeedLifecycleConfirmation } from '../contracts/needLifecycle';
import { knownNeedLifecycleRefusal, needLifecycleClientService } from './needLifecycleClientService';
import { positiveInteger, uuid, type ReceiptAccount } from './serverReceipt';
import { sesijaSada } from '../store/sesija';

export type NeedLifecycleState = Readonly<{
  phase: 'READY' | 'SUBMITTING' | 'RECONCILING' | 'UNKNOWN_OUTCOME' | 'REJECTED' | 'CONFIRMED' | 'ACCOUNT_CHANGED';
  confirmation: NeedLifecycleConfirmation | null;
  error: { kod: string; poruka: string } | null;
  collectionRefreshRequired: boolean;
}>;
const CHANGED: NeedLifecycleState = Object.freeze({ phase: 'ACCOUNT_CHANGED', confirmation: null,
  error: { kod: 'AUTH_ACCOUNT_CHANGED', poruka: 'Prijavljen je drugi nalog. Ponovo otvori zadatak.' }, collectionRefreshRequired: false });
const UNCERTAIN = { kod: 'UNKNOWN_OUTCOME', poruka: 'Ne znamo da li je radnja uspela. Osveži zadatak pre nego što pokušaš ponovo.' };

/** Presentation-independent terminal command owner. No list inference, state-machine
 * guesses, automatic replay or mutable command replacement. V3 supplies the CTA. */
export function createNeedLifecycleController(options: {
  account: ReceiptAccount;
  command: NeedLifecycleCommand;
  refreshOwnedNeeds: (account: ReceiptAccount) => Promise<unknown>;
  service?: typeof needLifecycleClientService;
  currentAccount?: () => ReceiptAccount | null;
  /** Persisted command identity permits a receipt read only; never auto-resubmit. */
  restoreUnknownOutcome?: boolean;
}) {
  const account = Object.freeze({ ...options.account });
  const command = Object.freeze({ ...options.command });
  const service = options.service ?? needLifecycleClientService;
  const getAccount = options.currentAccount ?? (() => {
    const session = sesijaSada();
    return session.user ? { accountId: session.user.id, accountRevision: session.accountRevision } : null;
  });
  let disposed = false, busy = false, readbackObserved = false;
  let inFlight: Promise<void> | null = null;
  let state: NeedLifecycleState = { phase: options.restoreUnknownOutcome ? 'UNKNOWN_OUTCOME' : 'READY',
    confirmation: null, error: options.restoreUnknownOutcome ? UNCERTAIN : null, collectionRefreshRequired: false };
  if (!uuid(command.needId) || !positiveInteger(command.expectedRevision) ||
    !['CANCEL', 'DELETE_DRAFT'].includes(command.action) || typeof command.reason !== 'string' || Array.from(command.reason).length > 500) {
    state = { ...state, phase: 'REJECTED', error: { kod: 'NEED_COMMAND_INVALID_INPUT', poruka: 'Ponovo otvori zadatak da vidiš najnovije podatke.' } };
  }
  const listeners = new Set<() => void>();
  const current = () => {
    const now = getAccount();
    return !disposed && !!now && now.accountId === account.accountId && now.accountRevision === account.accountRevision;
  };
  const snapshot = () => current() ? state : CHANGED;
  const publish = (next: NeedLifecycleState) => {
    if (!current()) return;
    state = next;
    listeners.forEach(listener => { try { listener(); } catch { /* Presentation cannot change an authoritative receipt. */ } });
  };
  async function refreshCollection() {
    if (!current() || state.phase !== 'CONFIRMED') return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      await Promise.race([options.refreshOwnedNeeds(account), new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => reject(new Error('COLLECTION_REFRESH_TIMEOUT')), 15_000);
      })]);
      if (current()) publish({ ...state, collectionRefreshRequired: false });
    } catch {
      // A failed list refresh cannot undo the authoritative terminal receipt.
      if (current()) publish({ ...state, collectionRefreshRequired: true });
    } finally { if (timer !== undefined) clearTimeout(timer); }
  }
  async function confirm(confirmation: NeedLifecycleConfirmation) {
    if (!current()) return;
    publish({ phase: 'CONFIRMED', confirmation, error: null, collectionRefreshRequired: true });
    await refreshCollection();
  }
  function run(work: () => Promise<void>) {
    if (!current()) return Promise.resolve();
    if (busy) return inFlight ?? Promise.resolve();
    busy = true;
    inFlight = Promise.resolve().then(async () => {
      if (!current()) return;
      try { await work(); }
      catch { if (current()) publish({ ...state, phase: 'UNKNOWN_OUTCOME', error: UNCERTAIN }); }
    }).finally(() => { busy = false; inFlight = null; });
    return inFlight;
  }
  async function send() {
    readbackObserved = false;
    publish({ ...state, phase: 'SUBMITTING', error: null });
    const result = command.action === 'CANCEL'
      ? await service.cancelNeed(command.needId, command.expectedRevision, command.reason)
      : await service.deleteDraftNeed(command.needId, command.expectedRevision, command.reason);
    if (!current()) return;
    if (result.ok) {
      // The service validates the matching server receipt; this cast only pairs
      // the already-selected method's return type with the immutable command.
      await confirm({ action: command.action, receipt: result.podatak } as NeedLifecycleConfirmation);
    } else if (result.kod === 'AUTH_ACCOUNT_CHANGED') {
      disposed = true; state = CHANGED; listeners.clear();
    } else {
      publish({ ...state, phase: knownNeedLifecycleRefusal(result.kod) ? 'REJECTED' : 'UNKNOWN_OUTCOME',
        error: { kod: result.kod, poruka: result.poruka } });
    }
  }
  return {
    snapshot,
    canRetrySame: () => current() && state.phase === 'UNKNOWN_OUTCOME' && readbackObserved,
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    submit() { return busy ? inFlight ?? Promise.resolve() : state.phase === 'READY' ? run(send) : Promise.resolve(); },
    reconcile() {
      if (busy || state.phase !== 'UNKNOWN_OUTCOME') return inFlight ?? Promise.resolve();
      return run(async () => {
        publish({ ...state, phase: 'RECONCILING', error: null });
        const result = await service.readCommandReceipt(command);
        if (!current()) return;
        if (result.ok && result.podatak.state === 'CONFIRMED') await confirm(result.podatak.confirmation);
        else {
          readbackObserved = result.ok;
          publish({ ...state, phase: 'UNKNOWN_OUTCOME', error: result.ok ? UNCERTAIN : { kod: result.kod, poruka: result.poruka } });
        }
      });
    },
    retrySame() {
      return !busy && state.phase === 'UNKNOWN_OUTCOME' && readbackObserved ? run(send) : inFlight ?? Promise.resolve();
    },
    refreshCollection() { return state.phase === 'CONFIRMED' && !busy ? run(refreshCollection) : inFlight ?? Promise.resolve(); },
    dispose() { disposed = true; state = CHANGED; listeners.clear(); },
  };
}
