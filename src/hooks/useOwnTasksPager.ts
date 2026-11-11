import { useCallback } from 'react';
import type { OwnTasksScope } from '../data/ownTasksPage';
import { ex04TestPageLimit } from '../data/ex04TestPageLimit';
import { createOwnTasksPager, type OwnTasksPageReader } from '../data/ownTasksPager';
import { usePagedList } from './usePagedList';

/**
 * Moji zadaci, paged (EX-04 S1): the lifecycle of `useFocusedResource` for a set that is read a page at a time (`usePagedList`, the pager reads for the screen at focus). The scope
 * and the "read the whole set" flag are inputs; everything a page may or may not do is `createOwnTasksPager`'s.
 */
export function useOwnTasksPager(readPage: OwnTasksPageReader, scope: OwnTasksScope | null, complete: boolean) {
  const create = useCallback((isCurrent: () => boolean) => createOwnTasksPager({ readPage, isCurrent, limit: ex04TestPageLimit() }), [readPage]);
  const { state, pager } = usePagedList(create, scope, complete, 'start');
  return { ...state, loadMore: pager.loadMore, refresh: pager.refresh };
}
