import { useCallback } from 'react';
import type { KandidatProjekcija } from '../contracts/projections';
import type { CandidatesScope } from '../data/candidatesPage';
import { createCandidatesPager, type CandidatesPageReader } from '../data/candidatesPager';
import { ex04TestCandidatesPageLimit } from '../data/ex04TestPageLimit';
import { usePagedList } from './usePagedList';

/**
 * The applications to one task, paged (EX-04 S4): the lifecycle of the paged candidate list (`usePagedList`). The screen owns its first read (its editor reads the task and the first page
 * together, then reconciles a pending choice), so the pager is only activated at focus; `complete` is the screen asking for the whole set — the order "Najniža cena" and the comparison are
 * only right over every application — and while it is on the rest is read, one page at a time, up to the pager's bound. The reader is bound to one task: another task is another pager.
 */
const SCOPE: CandidatesScope = 'ALL';
export function useCandidatesPager(readPage: CandidatesPageReader, complete: boolean, until?: (items: readonly KandidatProjekcija[]) => boolean) {
  const create = useCallback((isCurrent: () => boolean) => createCandidatesPager({ readPage, isCurrent, limit: ex04TestCandidatesPageLimit() }), [readPage]);
  const { state, pager } = usePagedList(create, SCOPE, complete, 'activate', until);
  return { state, pager };
}
