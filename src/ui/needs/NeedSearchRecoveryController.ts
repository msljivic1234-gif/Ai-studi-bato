import type { NeedSearchState, ReopenSearchCommand, ReopenSearchReadback, ReopenSearchReceipt } from '../../contracts/needSearchRecovery';
import type { Ishod } from '../../data/ports';
import { sameClosure, validReopenSearchCommand } from '../../data/needSearchRecoveryContract';

export type SearchRecoveryPhase = 'LOADING' | 'READY' | 'REVIEW' | 'SENDING' | 'UNKNOWN' | 'RESOLVED' | 'ERROR';
export type SearchRecoveryView = {
  phase: SearchRecoveryPhase;
  snapshot: NeedSearchState | null;
  command: ReopenSearchCommand | null;
  result: 'CONFIRMED' | 'REFUSED' | null;
  error: string | null;
  retryAllowed: boolean;
};
export const initialSearchRecoveryView = (): SearchRecoveryView => ({
  phase: 'LOADING', snapshot: null, command: null, result: null, error: null, retryAllowed: false,
});

export type SearchRecoveryServices = {
  read: () => Promise<Ishod<NeedSearchState>>;
  readReceipt: (command: ReopenSearchCommand) => Promise<Ishod<ReopenSearchReadback>>;
  reopen: (command: ReopenSearchCommand) => Promise<Ishod<ReopenSearchReceipt>>;
  knownRefusal: (code: string) => boolean;
};

type Storage = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<unknown>;
  removeItem(key: string): Promise<unknown>;
};
const uncertain = 'Ishod još nije potvrđen. Provera neće ponovo pokrenuti potragu.';

/** UI request lifecycle only. Business authority, coverage and time stay on the R3 server. */
export class NeedSearchRecoveryController {
  private view = initialSearchRecoveryView();
  private busy = false;
  private retired = false;
  private persisted = false;
  private journalLoaded = false;
  private listeners = new Set<() => void>();
  readonly key: string;

  constructor(private readonly deps: {
    needId: string;
    accountId: string;
    current: () => boolean;
    services: SearchRecoveryServices;
    storage: Storage;
    newKey: () => string;
  }) {
    this.key = 'uskoci:search-reopen:v1:' + deps.accountId + ':' + deps.needId;
  }

  snapshot = () => this.view;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  };
  dispose = () => { this.retired = true; this.listeners.clear(); };

  private current = () => !this.retired && this.deps.current();
  private set(next: Partial<SearchRecoveryView>) {
    if (!this.current()) return;
    this.view = { ...this.view, ...next };
    this.listeners.forEach(listener => { try { listener(); } catch { /* Presentation cannot change command authority. */ } });
  }
  private async run(work: () => Promise<void>) {
    if (this.busy || !this.current()) return;
    this.busy = true;
    try { await work(); }
    catch {
      this.set({
        phase: this.persisted ? 'UNKNOWN' : 'ERROR',
        error: 'Podaci trenutno nisu dostupni. Pokušaj ponovo.',
        retryAllowed: false,
      });
    } finally { this.busy = false; }
  }

  load = () => this.run(async () => {
    this.set({ phase: 'LOADING', error: null, retryAllowed: false });
    const text = await this.deps.storage.getItem(this.key);
    if (!this.current()) return;
    if (text !== null) {
      if (text.length > 5_000) throw new Error('SEARCH_REOPEN_JOURNAL_TOO_LARGE');
      const value: unknown = JSON.parse(text);
      const row = value as { version?: unknown; accountId?: unknown; command?: unknown } | null;
      if (!row || row.version !== 1 || row.accountId !== this.deps.accountId
        || !validReopenSearchCommand(row.command, this.deps.needId)) throw new Error('SEARCH_REOPEN_JOURNAL_INVALID');
      this.persisted = true;
      this.set({ command: Object.freeze({ ...row.command }) });
    }
    this.journalLoaded = true;
    await this.reconcile();
  });

  /** Restore, refresh and foreground are read-only. Never call reopen to learn what happened. */
  check = () => !this.journalLoaded ? this.load() : this.run(async () => {
    this.set({ phase: 'LOADING', error: null, retryAllowed: false });
    await this.reconcile();
  });

  private async reconcile() {
    const command = this.view.command;
    const receipt = command && this.persisted ? await this.deps.services.readReceipt(command) : null;
    if (!this.current()) return;
    const result = await this.deps.services.read();
    if (!this.current()) return;
    if (!result.ok) {
      this.set({ phase: this.persisted ? 'UNKNOWN' : 'ERROR', error: result.poruka, retryAllowed: false });
      return;
    }
    const snapshot = result.podatak;
    if (snapshot.needId.toLowerCase() !== this.deps.needId.toLowerCase()) throw new Error('FOREIGN_SEARCH_STATE');
    this.set({ snapshot });
    if (!command || !this.persisted) {
      this.set({ phase: 'READY', error: null, result: null, retryAllowed: false });
      return;
    }
    if (!receipt?.ok) {
      this.set({ phase: 'UNKNOWN', error: receipt && !receipt.ok ? receipt.poruka : uncertain, retryAllowed: false });
      return;
    }
    if (receipt.podatak.state === 'CONFIRMED') {
      this.set({ phase: 'RESOLVED', result: 'CONFIRMED', error: null, retryAllowed: false });
      return;
    }
    // NOT_CONFIRMED is observation, not proof that a delayed writer cannot still commit.
    this.set({
      phase: 'UNKNOWN',
      error: uncertain,
      retryAllowed: snapshot.canReopen && snapshot.revision === command.revision && sameClosure(snapshot.closedAt, command.closedAt),
    });
  }

  prepare = (): ReopenSearchCommand | null => {
    const snapshot = this.view.snapshot;
    if (!this.current() || this.busy || this.persisted || this.view.phase !== 'READY' || !snapshot?.canReopen
      || snapshot.nextAction !== 'REOPEN_SEARCH' || !snapshot.closedAt) return null;
    const command: ReopenSearchCommand = Object.freeze({
      needId: snapshot.needId,
      revision: snapshot.revision,
      closedAt: snapshot.closedAt,
      clientRequestId: this.deps.newKey(),
      reason: '',
    });
    if (!validReopenSearchCommand(command, this.deps.needId)) return null;
    this.set({ phase: 'REVIEW', command, error: null });
    return command;
  };

  cancelReview = () => {
    if (!this.current() || this.busy || this.persisted || this.view.phase !== 'REVIEW') return;
    this.set({ phase: 'READY', command: null, error: null });
  };

  submit = (reviewed: ReopenSearchCommand) => this.run(async () => {
    if (this.view.phase !== 'REVIEW' || this.view.command !== reviewed || this.persisted) return;
    await this.send(reviewed);
  });

  /** Explicit retry retains the original intent and first rechecks receipt/current state. */
  retry = () => this.run(async () => {
    if (!this.persisted || this.view.phase !== 'UNKNOWN' || !this.view.retryAllowed || !this.view.command) return;
    await this.reconcile();
    if (!this.current() || this.view.phase !== 'UNKNOWN' || !this.view.retryAllowed || !this.view.command) return;
    await this.send(this.view.command);
  });

  private async send(command: ReopenSearchCommand) {
    this.set({ phase: 'SENDING', error: null, retryAllowed: false });
    if (!this.persisted) {
      await this.deps.storage.setItem(this.key, JSON.stringify({ version: 1, accountId: this.deps.accountId, command }));
      this.persisted = true;
      // A screen leaving during persistence may leave a journal, but it never starts its writer afterwards.
      if (!this.current()) return;
    }
    const result = await this.deps.services.reopen(command);
    if (!this.current()) return;
    if (!result.ok && this.deps.services.knownRefusal(result.kod)) {
      const fresh = await this.deps.services.read();
      if (!this.current()) return;
      this.set({
        phase: 'RESOLVED',
        result: 'REFUSED',
        error: result.poruka,
        snapshot: fresh.ok ? fresh.podatak : null,
        retryAllowed: false,
      });
      return;
    }
    // Even a valid command receipt is history; current state is read independently.
    await this.reconcile();
  }

  acknowledge = () => this.run(async () => {
    if (this.view.phase !== 'RESOLVED') return;
    await this.deps.storage.removeItem(this.key);
    if (!this.current()) return;
    this.persisted = false;
    this.set({ command: null, result: null, phase: 'LOADING', error: null, retryAllowed: false });
    await this.reconcile();
  });
}
