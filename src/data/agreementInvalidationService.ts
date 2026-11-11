import { AppState } from 'react-native';
import { sesijaSada } from '../store/sesija';
import { createAgreementIncomingRefresh } from './agreementIncomingRefresh';
import { record, sameId, timestamp, uuid } from './serverReceipt';
import { supabaseKlijent } from './supabaseClient';

export type AgreementInvalidationScope = {
  accountId: string; accountRevision: number; sessionEpoch: number; agreementId: string;
  /** Caller owns focus, source, loaded participant and current chat/closure admission. */
  isCurrent: () => boolean;
  /** Re-read the existing bounded B3 history; never merge a wire row or send an ACK. */
  refresh: () => Promise<void>;
  /** A native owner may share one coalescer with its push fallback. */
  onHint?: () => void;
};
export type InboxAgreementInvalidationScope = Omit<AgreementInvalidationScope, 'agreementId'>;
type Owner = { accountId: string | null; accountRevision: number; sessionEpoch: number };
export type AgreementInvalidationTransport = {
  change: (event: 'INSERT' | 'UPDATE', agreementId: string | null, callback: (value: unknown) => void) => void;
  system: (callback: (value: unknown) => void) => void;
  subscribe: (callback: (status: string) => void) => void;
  remove: () => unknown;
};
type Dependencies = {
  open: (topic: string) => AgreementInvalidationTransport;
  owner: () => Owner;
  activity: () => string | null;
  onActivity: (callback: (state: string) => void) => { remove: () => void };
};
const positive = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
const revision = (value: number) => Number.isSafeInteger(value) && value >= 0;
let nextSubscription = 0;

/** Deliberately returns no row: even a validated revision is only a reread hint. */
export function isAgreementInvalidation(value: unknown, agreementId: string): boolean {
  const payload = record(value), row = record(payload?.new), old = record(payload?.old);
  if (!uuid(agreementId) || !payload || !row || !old
    || Object.keys(payload).some(key => !['schema', 'table', 'eventType', 'commit_timestamp', 'new', 'old', 'errors'].includes(key))
    || payload.schema !== 'public' || payload.table !== 'agreement_invalidations_v1'
    || (payload.eventType !== 'INSERT' && payload.eventType !== 'UPDATE') || !timestamp(payload.commit_timestamp)
    || (payload.errors != null && (!Array.isArray(payload.errors) || payload.errors.length !== 0))
    || Object.keys(row).length !== 2 || !Object.prototype.hasOwnProperty.call(row, 'agreement_id')
    || !Object.prototype.hasOwnProperty.call(row, 'revision') || !sameId(row.agreement_id, agreementId) || !positive(row.revision)
    || Object.keys(old).some(key => key !== 'agreement_id' && key !== 'revision')
    || ('agreement_id' in old && !sameId(old.agreement_id, agreementId))
    || ('revision' in old && !positive(old.revision))) return false;
  return true;
}

/** RLS chooses the authorized private conversations, including those not loaded
 * in the inbox yet. The wire still carries no message, sender or unread count. */
export function isInboxAgreementInvalidation(value: unknown): boolean {
  const id = record(record(value)?.new)?.agreement_id;
  return typeof id === 'string' && isAgreementInvalidation(value, id);
}

/** One foreground owner creates one SDK channel. SDK reconnects that
 * channel; this service never starts another channel, polls, or resumes itself.
 */
export function createAgreementInvalidationService(dependencies: Dependencies) {
  const subscribe = createInvalidationService(dependencies, false);
  return (input: AgreementInvalidationScope) => subscribe(input);
}

/** One RLS-filtered channel for private inbox arrivals, never one channel per row.
 * Group arrivals and lifecycle changes are not covered by this server projection. */
export function createInboxAgreementInvalidationService(dependencies: Dependencies) {
  const subscribe = createInvalidationService(dependencies, true);
  return (input: InboxAgreementInvalidationScope) => subscribe(input);
}

function createInvalidationService(dependencies: Dependencies, inbox: boolean) {
  return (input: InboxAgreementInvalidationScope & { agreementId?: string }): (() => void) => {
    const scope = { ...input };
    let alive = true, queued = false;
    let channel: AgreementInvalidationTransport | undefined;
    let activity: { remove: () => void } | undefined;
    let coordinator: ReturnType<typeof createAgreementIncomingRefresh> | undefined;
    const stop = () => {
      alive = false; queued = false; coordinator?.stop();
      const oldActivity = activity, oldChannel = channel;
      activity = undefined; channel = undefined;
      try { oldActivity?.remove(); } catch { /* Ownership is already retired. */ }
      try { void Promise.resolve(oldChannel?.remove()).catch(() => undefined); } catch { /* No retained callback can act. */ }
    };
    const current = () => {
      if (!alive) return false;
      try {
        const owner = dependencies.owner();
        if (dependencies.activity() === 'active' && scope.isCurrent()
          && owner.accountId === scope.accountId && owner.accountRevision === scope.accountRevision
          && owner.sessionEpoch === scope.sessionEpoch) return true;
      } catch { /* An unavailable owner cannot authorize a hint. */ }
      stop(); return false;
    };
    // Join, Postgres-ready and arrival callbacks can share the same JS turn.
    // Batch that turn; a hint arriving during a read still earns a trailing read.
    const hint = () => {
      if (!current() || queued) return;
      if (scope.onHint) { scope.onHint(); return; }
      queued = true;
      void Promise.resolve().then(() => {
        queued = false;
        if (current()) coordinator?.hint();
      });
    };
    if (!uuid(scope.accountId) || (!inbox && !uuid(scope.agreementId)) || !revision(scope.accountRevision)
      || !revision(scope.sessionEpoch) || !current()) { stop(); return stop; }
    if (!scope.onHint) coordinator = createAgreementIncomingRefresh({ refresh: scope.refresh, isCurrent: current });
    try {
      activity = dependencies.onActivity(state => { if (state !== 'active') stop(); });
      if (!current()) { stop(); return stop; }
      channel = dependencies.open((inbox ? 'inbox-agreement-invalidation-' : 'agreement-invalidation-') + ++nextSubscription);
      if (!current()) { stop(); return stop; }
      const agreementId = inbox ? null : scope.agreementId!;
      const change = (value: unknown) => {
        if (current() && (inbox ? isInboxAgreementInvalidation(value) : isAgreementInvalidation(value, agreementId!))) hint();
      };
      channel.change('INSERT', agreementId, change);
      if (!current()) { stop(); return stop; }
      channel.change('UPDATE', agreementId, change);
      if (!current()) { stop(); return stop; }
      channel.system(value => {
        if (!current()) return;
        const event = record(value);
        if (event?.extension === 'postgres_changes' && event.status === 'ok') hint();
      });
      if (!current()) { stop(); return stop; }
      channel.subscribe(status => { if (current() && status === 'SUBSCRIBED') hint(); });
      if (!current()) stop();
    } catch { stop(); }
    return stop;
  };
}

/** The existing authenticated singleton already forwards Auth token changes to
 * Realtime. Do not freeze a JWT or change its shared auth/accessToken settings.
 * Native owner calls stop on blur/source/session/terminal changes.
 */
const nativeDependencies: Dependencies = {
  owner: () => {
    const session = sesijaSada();
    return { accountId: session.session?.user.id ?? null,
      accountRevision: session.accountRevision, sessionEpoch: session.sessionEpoch };
  },
  activity: () => AppState.currentState,
  onActivity: callback => AppState.addEventListener('change', callback),
  open: topic => {
    const client = supabaseKlijent(), channel = client.channel(topic);
    return {
      change: (event, agreementId, callback) => {
        const selection = { schema: 'public', table: 'agreement_invalidations_v1',
          ...(agreementId === null ? {} : { filter: 'agreement_id=eq.' + agreementId }) };
        if (event === 'INSERT') channel.on('postgres_changes', { event, ...selection }, callback);
        else channel.on('postgres_changes', { event, ...selection }, callback);
      },
      system: callback => { channel.on('system', {}, callback); },
      subscribe: callback => { channel.subscribe(callback, 15_000); },
      remove: () => client.removeChannel(channel),
    };
  },
};
export const subscribeAgreementInvalidations = createAgreementInvalidationService(nativeDependencies);
export const subscribeInboxAgreementInvalidations = createInboxAgreementInvalidationService(nativeDependencies);
