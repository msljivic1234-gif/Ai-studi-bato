import { useCallback, useMemo, useRef } from 'react';
import { qaRecoveryClientService, type QaContext } from '../../data/qaRecoveryClientService';
import { preselectionQaClientService as qa } from '../../data/preselectionQaClientService';
import type { OwnerPreselectionQuestion, PublicPreselectionQa } from '../../contracts/preselectionQa';
import { useFocusedResource } from '../../hooks/useFocusedResource';
import { useSesija } from '../../store/sesija';
import { buildQaInline, type TaskQaInlineState } from './taskQaInlineModel';

/** What one read of a task's questions came to; a read that failed throws, and is never an empty thread. */
type QaRead =
  | { kind: 'NONE' }
  | { kind: 'READ'; needId: string; accountId: string; context: QaContext; rows: (OwnerPreselectionQuestion | PublicPreselectionQa)[] };

const UNAVAILABLE = 'Pitanja trenutno nisu učitana. Proveri vezu i pokušaj ponovo.';
/**
 * The thread is not shown to this account at all (a blocked pair, a task that is not public). The whole thread says it as
 * "Zadatak nije dostupan ovom nalogu", which is true on a screen of its own and false here: the task is on this screen.
 */
const NOT_SHOWN = new Set(['NEED_NOT_FOUND', 'NEED_NOT_PUBLIC', 'INTERACTION_BLOCKED']);
const NOT_SHOWN_COPY = 'Pitanja za ovaj zadatak nisu dostupna.';
const wording = (result: { kod: string; poruka: string }) => NOT_SHOWN.has(result.kod) ? NOT_SHOWN_COPY : result.poruka || UNAVAILABLE;

/**
 * Reads the questions of one task for the screen that shows them inline: the same two reads the whole thread makes, in
 * the same order (the context says which shape this person is owed, then that shape), and nothing else. It sends no
 * question, no answer and no disposition; those stay in the whole thread, with their journal and their recovery.
 *
 * It is a focused resource, like the task read beside it: it reads when the screen is focused, shows what it had at once
 * on a return and replaces it when the new read lands (a return whose read fails keeps what was on screen, as every
 * other screen does; a first read that fails is an error with a way to read again, never an empty thread), forgets when
 * the app leaves the foreground, and a read that finishes after the account, the task or the screen changed is dropped.
 * Call it where the task is read, not where the section is drawn, so that what was read survives the section being
 * hidden while the task reads again.
 *
 * `needId` null reads nothing (a draft has no public questions; a task that is not loaded yet has no id to ask about).
 * `revision` is the version of the task the screen shows, when it knows it: the thread is read again when it changes,
 * because questions about an earlier version no longer describe the task.
 */
export function useTaskQaInline(needId: string | null, revision: number | null = null): { state: TaskQaInlineState; retry: () => void } {
  const { user, accountRevision } = useSesija();
  const accountId = user?.id;
  // The resource knows that a read failed, not why. The words of the failure the section says are kept beside it.
  const failure = useRef(UNAVAILABLE);
  const load = useCallback(async (signal: AbortSignal): Promise<QaRead> => {
    if (!needId || !accountId) return { kind: 'NONE' };
    failure.current = UNAVAILABLE;
    const fail = (result: { kod: string; poruka: string }) => {
      if (!signal.aborted) failure.current = wording(result);
      return new Error('QA_READ_FAILED');
    };
    const account = { accountId, accountRevision };
    const context = await qaRecoveryClientService.context(needId, account);
    // The screen left, or the account, the task or the version changed, while the context was read: the thread is not asked for.
    if (signal.aborted) return { kind: 'NONE' };
    if (!context.ok) throw fail(context);
    const feed = context.podatak.mode === 'OWNER' ? await qa.ownerQuestions(needId) : await qa.publicQa(needId);
    if (!feed.ok) throw fail(feed);
    return { kind: 'READ', needId, accountId, context: context.podatak, rows: feed.podatak };
    // `revision` is not read inside: a new version of the task is a new read, and the resource is rebuilt with the callback.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [needId, revision, accountId, accountRevision]);
  const resource = useFocusedResource(load);
  const { data, loading, error } = resource;
  const state = useMemo<TaskQaInlineState>(() => {
    if (!needId || !accountId) return { phase: 'idle' };
    if (error) return { phase: 'error', message: failure.current };
    if (!data) return { phase: 'loading' };
    // Never another task's or another account's thread, whatever a late read left in the resource.
    if (data.kind !== 'READ' || data.needId !== needId || data.accountId !== accountId) return { phase: loading ? 'loading' : 'idle' };
    return { phase: 'ready', ...buildQaInline(data.context, data.rows) };
  }, [needId, accountId, data, loading, error]);
  const { refresh } = resource;
  const retry = useCallback(() => { void refresh(); }, [refresh]);
  return { state, retry };
}
