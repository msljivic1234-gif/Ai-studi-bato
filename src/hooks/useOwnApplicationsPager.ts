import { useCallback } from 'react';
import type { MojaPrijavaProjekcija } from '../contracts/projections';
import type { OwnApplicationsScope } from '../data/ownApplicationsPage';
import { ex04TestPageLimit } from '../data/ex04TestPageLimit';
import { createOwnApplicationsPager, type OwnApplicationsPageReader } from '../data/ownApplicationsPager';
import { usePagedList } from './usePagedList';

/**
 * Moje prijave, paged (EX-04 S2): the lifecycle of the paged own-application list (`usePagedList`). The screen owns its first read (its editor reads, reconciles a pending
 * command, then asks `pager.reload`), so the pager is only activated at focus; a tab change is a scope change and reads that set (a set already held is shown at once and read
 * again quietly). `destination` is the application a notification named: while it has not been met the rest of the shown set is read, one page at a time, and not one page
 * more once it is on screen.
 */
export function useOwnApplicationsPager(readPage: OwnApplicationsPageReader, scope: OwnApplicationsScope | null, destination: string | null) {
  const create = useCallback((isCurrent: () => boolean) => createOwnApplicationsPager({ readPage, isCurrent, limit: ex04TestPageLimit() }), [readPage]);
  const until = useCallback((items: readonly MojaPrijavaProjekcija[]) => items.some(item => item.prijavaId === destination), [destination]);
  const { state, pager } = usePagedList(create, scope, destination !== null, 'activate', until);
  return { state, pager };
}
