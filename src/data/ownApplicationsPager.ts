import type { MojaPrijavaProjekcija } from '../contracts/projections';
import type { ApplicationCounts } from './myApplicationsView';
import { createPagedListPager, type PagedListOptions, type PagedListState } from './pagedListPager';
import { OWN_APPLICATIONS_PAGE_LIMIT, type OwnApplicationsCursor, type OwnApplicationsPage, type OwnApplicationsPageRequest, type OwnApplicationsScope } from './ownApplicationsPage';

/**
 * EX-04 S2 (B10 Moje prijave): the one owner of the paged read of my own applications, one set per tab (Sve, Čeka te, Aktivne, Završene). Every rule lives in
 * `pagedListPager`; an application is known by its `prijavaId`, and one that moved to another section between two pages is shown where the walk first met it.
 */
export type OwnApplicationsPageReader = (request: OwnApplicationsPageRequest) => Promise<OwnApplicationsPage>;
export type OwnApplicationsPagerState = PagedListState<MojaPrijavaProjekcija, OwnApplicationsScope, ApplicationCounts>;
type Options = Omit<PagedListOptions<MojaPrijavaProjekcija, OwnApplicationsScope, OwnApplicationsCursor, ApplicationCounts>, 'keyOf' | 'limit'> & { limit?: number };

export function createOwnApplicationsPager(options: Options) {
  return createPagedListPager<MojaPrijavaProjekcija, OwnApplicationsScope, OwnApplicationsCursor, ApplicationCounts>({
    ...options, keyOf: item => item.prijavaId, limit: options.limit ?? OWN_APPLICATIONS_PAGE_LIMIT });
}
export type OwnApplicationsPager = ReturnType<typeof createOwnApplicationsPager>;
