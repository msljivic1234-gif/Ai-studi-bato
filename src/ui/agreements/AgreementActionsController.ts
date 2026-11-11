import type { ReceiptAccount } from '../../data/serverReceipt';
import { agreementChangeService, knownAgreementChangeRefusal, type AgreementChangeSnapshot } from '../../data/agreementClientService';
import { journalFor, normalizeAgreementCommand, parseJournal, permits, type AgreementActionCommand, type AgreementActionJournal } from './agreementActionsModel';

export type AgreementActionsState = { phase: 'LOADING' | 'READY' | 'SENDING' | 'UNKNOWN' | 'CONFIRMED' | 'REJECTED' | 'ERROR';
  snapshot: AgreementChangeSnapshot | null; journal: AgreementActionJournal | null; error: string | null;
  message: string | null; canRetry: boolean; needsReentry: boolean };
const unknown = 'Ne znamo da li je radnja uspela. Osvežite Dogovor pre nego što pokušate ponovo.';
export class AgreementActionsController {
  private state: AgreementActionsState = { phase: 'LOADING', snapshot: null, journal: null, error: null, message: null, canRetry: false, needsReentry: false };
  private listeners = new Set<() => void>(); private disposed = false; private busy = false;
  private command: AgreementActionCommand | null = null;
  readonly key: string;
  constructor(private deps: { agreementId: string; account: ReceiptAccount; current: () => boolean;
    storage: { getItem(key: string): Promise<string | null>; setItem(key: string, value: string): Promise<unknown>; removeItem(key: string): Promise<unknown> };
    service?: typeof agreementChangeService }) { this.key = `uskoci:agreement-action:v5:${deps.account.accountId}:${deps.agreementId}`; }
  private get service() { return this.deps.service ?? agreementChangeService; }
  private current = () => !this.disposed && this.deps.current();
  snapshot = () => this.state;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  dispose = () => { this.disposed = true; this.command = null; this.listeners.clear(); };
  private update(next: Partial<AgreementActionsState>) { if (!this.current()) return; this.state = { ...this.state, ...next }; this.listeners.forEach(fn => fn()); }
  private async run(work: () => Promise<void>) {
    if (this.busy || !this.current()) return;
    this.busy = true;
    try { await work(); }
    catch { this.update({ phase: this.state.journal ? 'UNKNOWN' : 'ERROR', error: unknown, canRetry: false }); }
    finally { this.busy = false; }
  }
  load = () => this.run(async () => {
    this.update({ phase: 'LOADING', error: null });
    const raw = await this.deps.storage.getItem(this.key); if (!this.current()) return;
    const journal = raw === null ? null : parseJournal(raw, this.deps.agreementId);
    this.update({ journal });
    if (journal) { await this.readOutcome(); return; }
    const result = await this.service.read(this.deps.agreementId, this.deps.account); if (!this.current()) return;
    if (!result.ok) { this.update({ phase: 'ERROR', error: result.poruka }); return; }
    this.update({ phase: 'READY', snapshot: result.podatak, message: null, error: null });
  });
  refresh = () => this.state.journal ? this.run(() => this.readOutcome()) : this.load();
  private async readOutcome() {
    const journal = this.state.journal; if (!journal || !this.current()) return;
    this.update({ phase: 'LOADING', canRetry: false, error: null });
    const fresh = await this.service.read(this.deps.agreementId, this.deps.account); if (!this.current()) return;
    if (!fresh.ok) { this.update({ phase: 'UNKNOWN', error: fresh.poruka }); return; }
    this.update({ snapshot: fresh.podatak });
    let resolved: 'CONFIRMED' | 'REJECTED' | null = null;
    if (journal.kind === 'CANCEL') resolved = fresh.podatak.agreementStatus === 'CANCELLED' ? 'CONFIRMED'
      : fresh.podatak.agreementStatus === 'COMPLETED' ? 'REJECTED' : null;
    else {
      const found = await this.service.readCommand(this.deps.agreementId, journal.kind === 'PROPOSE'
        ? { clientRequestId: journal.clientRequestId! } : { proposalId: journal.proposalId! }, this.deps.account);
      if (!this.current()) return;
      if (!found.ok) { this.update({ phase: 'UNKNOWN', error: found.poruka }); return; }
      if (found.podatak.found) {
        const receipt = found.podatak;
        if (receipt.baseVersion !== journal.agreementVersion || receipt.agreementId !== journal.agreementId
          || (journal.kind === 'PROPOSE' && receipt.proposedBy !== this.deps.account.accountId)) {
          this.update({ phase: 'UNKNOWN', error: 'Potvrda ne odgovara prvobitnoj radnji.' }); return;
        }
        if (journal.kind === 'PROPOSE') resolved = 'CONFIRMED';
        else if (receipt.status === (journal.kind === 'WITHDRAW' ? 'WITHDRAWN' : journal.accept ? 'ACCEPTED' : 'REJECTED')) resolved = 'CONFIRMED';
        else if (receipt.status !== 'PENDING') resolved = 'REJECTED';
      }
      if (!this.command && (journal.kind === 'RESPOND' || journal.kind === 'WITHDRAW')) {
        const proposal = fresh.podatak.proposals.find(item => item.proposalId === journal.proposalId);
        if (proposal) {
          const restored: AgreementActionCommand = journal.kind === 'WITHDRAW' ? { kind: 'WITHDRAW', proposal }
            : { kind: 'RESPOND', proposal, accept: journal.accept! };
          if (journalFor(restored).payloadHash === journal.payloadHash) this.command = restored;
        }
      }
    }
    if (resolved) this.update({ phase: resolved, error: null, canRetry: false, needsReentry: false,
      message: resolved === 'REJECTED' ? 'Dogovor ili predlog je u međuvremenu drugačije završen. Pregledaj sačuvano stanje.'
        : journal.kind === 'CANCEL' ? 'Dogovor je otkazan.' : journal.kind === 'PROPOSE' ? 'Predlog izmene je sačuvan.'
          : journal.kind === 'WITHDRAW' ? 'Predlog izmene je povučen.' : journal.accept ? 'Izmena je prihvaćena. Prikazani su važeći uslovi.' : 'Predlog izmene je odbijen.' });
    else this.update({ phase: 'UNKNOWN', error: unknown, canRetry: true, needsReentry: this.command === null });
  }
  /** First review or an explicit same-command retry only. Restoring a journal
   * permits reads; the user's re-entered body must match its normalized hash. */
  submit = (input: AgreementActionCommand) => this.run(async () => {
    const command = JSON.parse(JSON.stringify(normalizeAgreementCommand(input))) as AgreementActionCommand;
    const journal = journalFor(command), previous = this.state.journal;
    if (!this.state.snapshot) return;
    if (previous) {
      if (this.state.phase !== 'UNKNOWN' || !this.state.canRetry) return;
      if (JSON.stringify(previous) !== JSON.stringify(journal)) {
        this.update({ error: 'Ovo se razlikuje od onoga što je ranije poslato. Unesite iste uslove i isti razlog.' }); return;
      }
    } else if (this.state.phase !== 'READY' || !permits(this.state.snapshot, command, this.deps.account.accountId)) return;
    this.command = command;
    this.update({ phase: 'SENDING', error: null, message: null, canRetry: false });
    await this.deps.storage.setItem(this.key, JSON.stringify(journal)); if (!this.current()) return;
    this.update({ journal });
    const result = command.kind === 'PROPOSE' ? await this.service.propose(command.value, this.deps.account)
      : command.kind === 'RESPOND' ? await this.service.respond(command.proposal, command.accept, this.deps.account)
        : command.kind === 'WITHDRAW' ? await this.service.withdraw(command.proposal.proposalId, this.deps.account)
          : await this.service.cancel(command.agreementId, command.reason, this.deps.account);
    if (!this.current()) return;
    if (!result.ok && knownAgreementChangeRefusal(result.kod)) { this.update({ phase: 'REJECTED', error: result.poruka, canRetry: false }); return; }
    await this.readOutcome();
  });
  retry = () => this.command ? this.submit(this.command) : Promise.resolve();
  acknowledge = () => this.run(async () => {
    if (!['CONFIRMED','REJECTED'].includes(this.state.phase)) return;
    await this.deps.storage.removeItem(this.key); if (!this.current()) return;
    this.command = null;
    const fresh = await this.service.read(this.deps.agreementId, this.deps.account); if (!this.current()) return;
    this.update({ phase: fresh.ok ? 'READY' : 'ERROR', snapshot: fresh.ok ? fresh.podatak : null,
      journal: null, error: fresh.ok ? null : fresh.poruka, message: null, canRetry: false, needsReentry: false });
  });
}
