import type { PotrebaProjekcija } from '../contracts/projections';
import type { OwnedTaskCounts } from './marketplaceView';
import { PAGED_LIST_STALE_MS, createPagedListPager, type PagedListOptions, type PagedListState } from './pagedListPager';
import { OWN_TASKS_PAGE_LIMIT, type OwnTasksCursor, type OwnTasksPage, type OwnTasksPageRequest, type OwnTasksScope } from './ownTasksPage';

/**
 * EX-04 S1 (A09 Moji zadaci): the one owner of the paged read of my own tasks, for the five sets of the screen (Aktivni, Nacrti, Istorija, Svi, Treba moja radnja).
 * Every rule (fencing by account, focus, scope and epoch; no duplicate; counts from the first page; depth kept on return; the rest of a refined set read to its end;
 * a failed later page keeps the list) lives in `pagedListPager`; this file only says which list it is.
 */
export type OwnTasksPageReader = (request: OwnTasksPageRequest) => Promise<OwnTasksPage>;
export type OwnTasksPagerState = PagedListState<PotrebaProjekcija, OwnTasksScope, OwnedTaskCounts>;
type Options = Omit<PagedListOptions<PotrebaProjekcija, OwnTasksScope, OwnTasksCursor, OwnedTaskCounts>, 'keyOf' | 'limit'> & { limit?: number };

/** Coming back to a tab after this long loads it as if for the first time (the same bound as every focused list). */
export const OWN_TASKS_STALE_MS = PAGED_LIST_STALE_MS;

export function createOwnTasksPager(options: Options) {
  return createPagedListPager<PotrebaProjekcija, OwnTasksScope, OwnTasksCursor, OwnedTaskCounts>({
    ...options, keyOf: item => item.id, limit: options.limit ?? OWN_TASKS_PAGE_LIMIT });
}
export type OwnTasksPager = ReturnType<typeof createOwnTasksPager>;
