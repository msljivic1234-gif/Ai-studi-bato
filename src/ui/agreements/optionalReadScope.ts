import type { DogovorProjekcija } from '../../contracts/projections';
import {
  awaitsMyConfirmation, filterAgreementRole, filterHistory, groupAgreementTasks, isActiveAgreementTask,
  type AgreementRoleFilter, type AgreementTaskGroup, type HistoryFilter,
} from './agreementListModel';

/**
 * Which whole task groups Dogovori can render for the current tab and chips.
 * Keep sibling collaborations together: an active task can contain a CANCELLED
 * agreement and that sibling still belongs to the same visible card.
 *
 * This mirrors AgreementCollectionPresentation's role, section, confirmation
 * and history-group filters; do not narrow by individual collaboration here.
 */
export type AgreementOptionalReadView = {
  section: 'active' | 'history';
  roleFilter: AgreementRoleFilter;
  confirmationOnly: boolean;
  historyFilter: HistoryFilter;
};

export function visibleAgreementTaskGroups(
  items: readonly DogovorProjekcija[], view: AgreementOptionalReadView,
): AgreementTaskGroup[] {
  const groups = groupAgreementTasks(filterAgreementRole(items, view.roleFilter));
  if (view.section === 'history') {
    return groups.filter(group => !isActiveAgreementTask(group)
      && filterHistory(group.items, view.historyFilter).length > 0);
  }
  return groups.filter(group => isActiveAgreementTask(group)
    && (!view.confirmationOnly || group.items.some(awaitsMyConfirmation)));
}

/** Only cancellation details that can be reached in the currently rendered list.
 * A completed-only history row cannot show a cancelled sibling. */
export function cancelledIdsForVisibleAgreementGroups(
  groups: readonly AgreementTaskGroup[], section: 'active' | 'history', historyFilter: HistoryFilter,
): string[] {
  if (section === 'history' && historyFilter === 'completed') return [];
  return groups.flatMap(group => group.items.filter(item => item.stanje === 'CANCELLED').map(item => item.id));
}
