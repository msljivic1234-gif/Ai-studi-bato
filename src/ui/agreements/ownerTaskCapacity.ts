import type { NeedSearchState } from '../../contracts/needSearchRecovery';
import type { DogovorProjekcija } from '../../contracts/projections';
import { decodeNeedSearchState } from '../../data/needSearchRecoveryContract';
import { groupAgreementTasks, isActiveAgreementTask, type AgreementTaskGroup } from './agreementListModel';

const uuid = (value: unknown): value is string => typeof value === 'string'
  && /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(value);
export const sameOwnerTaskId = (value: unknown, expected: string): value is string =>
  uuid(value) && value.toLowerCase() === expected.toLowerCase();

/** The server owns task coverage. An Agreement's bilateral seats and the count of
 * historical collaborations cannot say how many people are currently selected. */
export function ownerTaskId(group: AgreementTaskGroup): string | null {
  const first = group.items[0];
  const taskId = first?.izvor?.zadatakId;
  if (!uuid(taskId) || !group.items.every(item => sameOwnerTaskId(item.izvor?.zadatakId, taskId)
    && item.ucesnici?.some(person => person.viSte && person.uloga === 'narucilac'))) return null;
  return taskId.toLowerCase();
}

/** Limit optional reads independently of the base Dogovori page. Older groups
 * still have a safe link to their owned task, where the same server read runs. */
export function ownerCapacityNeedIds(items: readonly DogovorProjekcija[], limit = 12): string[] {
  const groups = groupAgreementTasks(items);
  const prioritized = [...groups.filter(isActiveAgreementTask), ...groups.filter(group => !isActiveAgreementTask(group))];
  return [...new Set(prioritized.map(ownerTaskId).filter((id): id is string => !!id))].slice(0, limit);
}

export type OwnerTaskCapacityView = { taskId: string; count: string | null; next: string | null };
export function ownerTaskCapacity(group: AgreementTaskGroup, state?: NeedSearchState | null): OwnerTaskCapacityView | null {
  const taskId = ownerTaskId(group);
  if (!taskId) return null;
  const current = state ? decodeNeedSearchState(state, taskId) : null;
  if (!current) return { taskId, count: null, next: null };
  const next = current.nextAction === 'REOPEN_SEARCH' && current.canReopen
    ? 'Možete ponovo da tražite ljude u zadatku.'
    : current.nextAction === 'SEARCH_IN_PROGRESS' ? 'Potraga je otvorena. Proverite prijave na zadatku.'
      : current.nextAction === 'REVIEW_TASK_TIME' ? 'Vreme za potragu je prošlo. Proverite zadatak.'
        : current.nextAction === 'OPEN_AGREEMENTS' ? 'Proverite saradnje koje čekaju Vašu radnju.'
          : current.missingSlots > 0 ? 'Proverite sledeći korak na zadatku.' : null;
  return { taskId, count: `Potvrđeno ${current.coveredSlots}/${current.requiredSlots}`, next };
}
