import { supportCaseClientService } from '../../data/supportCaseClientService';
import type { PreparedSupportCommand, SupportCapabilities, SupportCommand, SupportDetail, SupportInbox,
  SupportIntent, SupportKind, SupportMode, SupportPayloads, SupportReceipt, SupportScope } from '../../data/supportCaseTypes';
import { supportCopy } from './supportCopy';

export type SupportTarget = { type: 'NEW' } | { type: 'INBOX'; mode: SupportMode } | { type: 'DETAIL'; caseId: string };
/**
 * Which command runs now, or ran last (its words are the `message`): READ a full load with its check of an unconfirmed
 * send, SEND a first send, REPLAY the same send again, CANCEL a stop of the unconfirmed send, MARK events marked as read.
 * Presentation only: it lets each button show its own spinner and each message its own look (round 5c review).
 */
export type SupportCommandKind = 'READ' | 'SEND' | 'REPLAY' | 'CANCEL' | 'MARK';
export type SupportState = {
  phase: 'LOADING' | 'READY' | 'SENDING' | 'ERROR'; capabilities: SupportCapabilities | null;
  inbox: SupportInbox | null; detail: SupportDetail | null; pending: SupportIntent | null;
  absent: boolean; canReplay: boolean; message: string | null; receipt: SupportReceipt | null;
  command: SupportCommandKind | null;
};
export const initialSupportState: SupportState = { phase: 'LOADING', capabilities: null, inbox: null, detail: null,
  pending: null, absent: false, canReplay: false, message: null, receipt: null, command: null };
const operatorActions = new Set<SupportKind>(['CLAIM', 'CLOSE', 'OPERATOR_REPLY', 'REQUEST_INFO', 'DECIDE', 'CLAIM_APPEAL', 'DECIDE_APPEAL']);
export function supportActionAllowed(detail: SupportDetail, kind: SupportKind): boolean {
  if (kind === 'CREATE') return false;
  return detail.allowedActions.includes(kind) && (detail.viewerRole === 'OPERATOR'
    ? operatorActions.has(kind) : kind === 'AUTHOR_REPLY' || kind === 'APPEAL');
}

/** This controller holds narrative only in RAM. The service owns persistence,
 * exact command decoding and terminal readback; a transport ACK never retires it. */
export class SupportController {
  private state: SupportState = { ...initialSupportState };
  private busy = false; private disposed = false;
  private prepared: PreparedSupportCommand | null = null;
  private cursor: string | null = null;
  private listeners = new Set<() => void>();
  constructor(private deps: { target: SupportTarget; scope: SupportScope & { isCurrent: () => boolean }; service?: typeof supportCaseClientService }) {}
  private get service() { return this.deps.service ?? supportCaseClientService; }
  private current = () => !this.disposed && this.deps.scope.isCurrent();
  snapshot = () => this.state;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  dispose = () => { this.disposed = true; this.prepared = null; this.state = { ...initialSupportState }; this.listeners.clear(); };
  private update(patch: Partial<SupportState>) {
    if (!this.current()) return;
    this.state = { ...this.state, ...patch }; this.listeners.forEach(listener => listener());
  }
  private async run(work: () => Promise<void>) {
    if (!this.current() || this.busy) return;
    this.busy = true;
    try { await work(); }
    catch { this.update({ phase: 'ERROR', message: 'Ne možemo da učitamo stanje zahteva. Pokušaj ponovo pre slanja.' }); }
    finally { this.busy = false; }
  }
  private consume(command: SupportCommand) {
    if (command.state === 'ABSENT') {
      this.update({ absent: true, canReplay: !!this.prepared, message: supportCopy.absent });
      return;
    }
    this.prepared = null;
    this.update({ pending: null, absent: false, canReplay: false,
      receipt: command.state === 'COMMITTED' ? command.receipt : null,
      message: command.state === 'COMMITTED' ? supportCopy.committed : supportCopy.cancelled });
  }
  private async recoverPending() {
    const intent = this.state.pending; if (!intent) return;
    const result = await this.service.recover(intent, this.deps.scope);
    if (!this.current()) return;
    if (result.ok) this.consume(result.podatak);
    else this.update({ absent: false, canReplay: false, message: result.poruka });
  }
  private async readData() {
    const target = this.deps.target;
    if (!this.current()) return;
    if (target.type === 'DETAIL') {
      const result = await this.service.detail(target.caseId, this.cursor ?? '0', this.deps.scope);
      if (!this.current()) return;
      this.update({ phase: result.ok ? 'READY' : 'ERROR', detail: result.ok ? result.podatak : null,
        ...(result.ok ? {} : { message: result.poruka }) });
    } else if (target.type === 'INBOX') {
      const result = await this.service.inbox(target.mode, this.cursor, this.deps.scope);
      if (!this.current()) return;
      this.update({ phase: result.ok ? 'READY' : 'ERROR', inbox: result.ok ? result.podatak : null,
        ...(result.ok ? {} : { message: result.poruka }) });
    } else this.update({ phase: 'READY' });
  }
  load = () => this.run(async () => {
    this.update({ phase: 'LOADING', capabilities: null, inbox: null, detail: null, message: null, command: 'READ' });
    const saved = await this.service.loadPending(this.deps.scope);
    if (!this.current()) return;
    this.update({ pending: saved ?? this.state.pending, absent: false, canReplay: false });
    await this.recoverPending(); if (!this.current()) return;
    const capabilities = await this.service.capabilities(this.deps.scope);
    if (!this.current()) return;
    if (!capabilities.ok) { this.update({ phase: 'ERROR', message: capabilities.poruka }); return; }
    this.update({ capabilities: capabilities.podatak });
    await this.readData();
  });
  page = (cursor: string | null, rendered: SupportState) => this.run(async () => {
    if (this.state !== rendered || this.state.phase !== 'READY') return;
    this.cursor = cursor; this.update({ phase: 'LOADING', detail: null, inbox: null, command: null }); await this.readData();
  });
  submit = <K extends SupportKind>(kind: K, payload: SupportPayloads[K], rendered: SupportState) => this.run(async () => {
    if (this.state !== rendered || this.state.phase !== 'READY' || this.state.pending) return;
    const target = this.deps.target, detail = this.state.detail;
    if (kind === 'CREATE' ? target.type !== 'NEW' || !this.state.capabilities?.canCreate
      : target.type !== 'DETAIL' || !detail || !supportActionAllowed(detail, kind)) return;
    const prepared = this.service.prepare(kind, kind === 'CREATE' ? null : detail!.case.id,
      kind === 'CREATE' ? null : detail!.case.revision, payload, this.deps.scope);
    if (!this.current()) return;
    this.prepared = prepared;
    this.update({ phase: 'SENDING', pending: prepared.intent, absent: false, canReplay: false, receipt: null, message: null, command: 'SEND' });
    const result = await this.service.submit(prepared, this.deps.scope);
    if (!this.current()) return;
    if (result.ok) this.consume(result.podatak);
    else this.update({ message: result.poruka });
    await this.readData();
  });
  replay = (rendered: SupportState) => this.run(async () => {
    if (this.state !== rendered || this.state.phase !== 'READY' || !this.state.absent || !this.prepared
      || this.state.pending?.clientRequestId !== this.prepared.intent.clientRequestId) return;
    this.update({ phase: 'SENDING', absent: false, canReplay: false, message: null, command: 'REPLAY' });
    const result = await this.service.submit(this.prepared, this.deps.scope);
    if (!this.current()) return;
    if (result.ok) this.consume(result.podatak); else this.update({ message: result.poruka });
    await this.readData();
  });
  cancel = (rendered: SupportState) => this.run(async () => {
    if (this.state !== rendered || !this.state.pending) return;
    const intent = this.state.pending;
    this.update({ phase: 'SENDING', absent: false, canReplay: false, message: null, command: 'CANCEL' });
    const result = await this.service.cancel(intent, this.deps.scope);
    if (!this.current()) return;
    if (result.ok) this.consume(result.podatak); else this.update({ message: result.poruka });
    await this.readData();
  });
  markRead = (rendered: SupportState) => this.run(async () => {
    const detail = this.state.detail;
    if (this.state !== rendered || this.state.phase !== 'READY' || !detail || !detail.events.length) return;
    const sequence = detail.events[detail.events.length - 1].sequence;
    this.update({ phase: 'SENDING', message: null, command: 'MARK' });
    const result = await this.service.markRead(detail.case.id, sequence, this.deps.scope);
    if (!this.current()) return;
    this.update({ phase: 'READY', message: result.ok ? supportCopy.markedRead : result.poruka });
  });
}
