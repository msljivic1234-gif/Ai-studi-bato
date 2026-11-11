import type { NeedUrgencyProjection } from '../contracts/projections';
import { sesijaSada } from '../store/sesija';
import { readOwnedResult, record, sameId, timestamp, uuid } from './serverReceipt';
import { supabaseKlijent } from './supabaseClient';

export const NEED_URGENCY_BUDGET_MS = 4000;
const NEED_URGENCY_CONCURRENCY = 4;

/** The raw flag only selects candidates for the existing server-owned read.
 * It never creates a badge or activates urgency. Optional badges share one time
 * budget, so slow metadata cannot consume the parent collection's read deadline. */
export async function readNeedUrgencies(rows: readonly { id: unknown; urgent?: unknown }[], signal?: AbortSignal): Promise<Map<string, NeedUrgencyProjection>> {
  const owner = sesijaSada(), result = new Map<string, NeedUrgencyProjection>();
  if (!owner.user || signal?.aborted) return result;
  const account = { accountId: owner.user.id, accountRevision: owner.accountRevision };
  const ids = [...new Set(rows.filter(row => row.urgent === true && uuid(row.id)).map(row => row.id as string))];
  if (!ids.length) return result;

  const current = () => sesijaSada().user?.id === account.accountId && sesijaSada().accountRevision === account.accountRevision;
  const abort = new AbortController(), deadline = Date.now() + NEED_URGENCY_BUDGET_MS;
  let stopped = false;
  let retire!: () => void;
  const boundary = new Promise<void>(resolve => { retire = resolve; });
  const stop = () => {
    if (stopped) return;
    stopped = true;
    abort.abort();
    retire();
  };
  const active = () => {
    if (signal?.aborted || !current() || Date.now() >= deadline) stop();
    return !stopped;
  };
  const timeout = setTimeout(stop, NEED_URGENCY_BUDGET_MS);
  const accountWatch = setInterval(() => { if (!current()) stop(); }, 100);
  signal?.addEventListener('abort', stop, { once: true });
  let cursor = 0, available = true;
  const worker = async () => {
    while (available && active() && cursor < ids.length) {
      const id = ids[cursor++];
      const read = await readOwnedResult({ account, errors: {}, fallback: 'URGENCY_UNAVAILABLE', invalid: 'URGENCY_INVALID',
        request: () => {
          if (!active()) throw new Error('URGENCY_READ_ABORTED');
          const request = supabaseKlijent().rpc('fn_need_urgency', { p_need_id: id });
          const transport = typeof request.abortSignal === 'function' ? request.abortSignal(abort.signal) : request;
          // A transport may ignore abort. Settle the receipt too, so its own
          // timeout clears and no abandoned worker can accept a late badge.
          return Promise.race([Promise.resolve(transport), boundary]);
        }, decode: raw => decodeNeedUrgency(raw, id) });
      if (!active()) return;
      if (read.ok) result.set(id, read.podatak);
      else available = false; // Do not serially delay the whole list during an outage.
    }
  };
  try {
    await Promise.race([
      Promise.all(Array.from({ length: Math.min(NEED_URGENCY_CONCURRENCY, ids.length) }, worker)),
      boundary,
    ]);
    // Aborted/account-retired work discloses nothing. At the optional deadline,
    // retain only already validated receipts; every unanswered flag stays unknown.
    return !signal?.aborted && current() ? new Map(result) : new Map();
  } finally {
    stop();
    clearTimeout(timeout);
    clearInterval(accountWatch);
    signal?.removeEventListener('abort', stop);
  }
}

export function decodeNeedUrgency(raw: unknown, id: string): NeedUrgencyProjection | null {
  const r = record(raw);
  if (!r || !sameId(r.needId, id) || r.authoritative !== true) return null;
  if (r.level === 'NORMAL' && r.activatedAt === null && r.expiresAt === null) return { level: 'NORMAL', expiresAt: null };
  if (r.level !== 'HITNO' || !timestamp(r.activatedAt) || !timestamp(r.expiresAt)
    || Date.parse(r.activatedAt) >= Date.parse(r.expiresAt)) return null;
  return { level: 'HITNO', expiresAt: r.expiresAt };
}
