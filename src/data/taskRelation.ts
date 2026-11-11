/**
 * What this account is to one task (owner decision 1, 2026-09-19).
 *
 * The app used to answer this with the mode it was in: in the requester mode every task was one to
 * look at, in the worker mode every task was one to apply to, and a person had to switch the whole
 * app to do the other. Then it answered from data the account already read - my tasks and my
 * applications, both whole lists, for one label on one card.
 *
 * Since PKG-023b the server answers it directly, for the tasks on screen and no others:
 * `public.rpc_get_my_task_relations(uuid[])`, at most 100 ids in one call. It is an OVERLAY. It is
 * never part of a public task result: the marketplace returns the same rows to every viewer, and
 * this says, separately and only to the caller, which of those rows are the caller's own. It is not
 * an oracle either: a task that is not mine and one that does not exist are both simply absent, and
 * the two cases are indistinguishable.
 *
 * `UNKNOWN` is what a task gets when the read failed, or when it was never asked about. It is never
 * shown as `NONE`: not knowing whether I have applied is not a licence to offer applying. The
 * server still refuses an application to my own task and a duplicate, whatever this says.
 */
export type TaskRelation = { kind: 'OWNER' } | { kind: 'APPLIED'; applicationId: string; agreementId: string | null }
  | { kind: 'NONE' } | { kind: 'UNKNOWN' };

/** What one task's answer looks like for a whole page of them. */
export type TaskRelationIndex = {
  owned: ReadonlySet<string>;
  applied: ReadonlySet<string>;
  /** UNKNOWN for a task this index was not asked about; never a guess. */
  relation: (needId: string) => TaskRelation;
};

/**
 * The application states `private.my_application_state` can return. A state outside this list is a
 * projection this client does not understand, and an unreadable answer is never a label.
 */
const STATES = new Set(['SUBMITTED', 'VIEWED', 'SHORTLISTED', 'STALE_REVIEW_REQUIRED', 'SELECTED', 'WITHDRAWN', 'CLOSED']);
/** A withdrawn or closed application is not a standing one: that task is open to apply to again. */
const STANDING = new Set(['SUBMITTED', 'VIEWED', 'SHORTLISTED', 'STALE_REVIEW_REQUIRED', 'SELECTED']);

const text = (value: unknown): value is string => typeof value === 'string' && value.length > 0;

/** The empty answer, for a screen with nothing on it. Asking the server for no ids is not a read. */
export const noTaskRelations: TaskRelationIndex = {
  owned: new Set(), applied: new Set(), relation: () => ({ kind: 'UNKNOWN' }),
};

/**
 * The server's items for the ids that were asked. Anything malformed throws, so that the caller
 * shows no labels at all rather than a label it cannot stand behind.
 */
export function taskRelationIndex(items: readonly unknown[], asked: readonly string[]): TaskRelationIndex {
  const questions = new Set(asked);
  const owned = new Set<string>(), applied = new Set<string>();
  const answers = new Map<string, TaskRelation>();
  for (const item of items) {
    const row = item as Record<string, unknown> | null;
    const needId = row?.needId;
    if (!text(needId) || !questions.has(needId) || answers.has(needId)) throw new Error('TASK_RELATIONS_INVALID_PROJECTION');
    if (row?.relation === 'OWNER') {
      owned.add(needId);
      answers.set(needId, { kind: 'OWNER' });
      continue;
    }
    if (row?.relation !== 'APPLIED') throw new Error('TASK_RELATIONS_INVALID_PROJECTION');
    const applicationId = row?.applicationId, state = row?.applicationState, agreementId = row?.agreementId ?? null;
    if (!text(applicationId) || !text(state) || !STATES.has(state)
      || (agreementId !== null && !text(agreementId))) throw new Error('TASK_RELATIONS_INVALID_PROJECTION');
    if (!STANDING.has(state)) {
      answers.set(needId, { kind: 'NONE' });
      continue;
    }
    applied.add(needId);
    answers.set(needId, { kind: 'APPLIED', applicationId, agreementId });
  }
  return { owned, applied, relation: needId => answers.get(needId) ?? (questions.has(needId) ? { kind: 'NONE' } : { kind: 'UNKNOWN' }) };
}
