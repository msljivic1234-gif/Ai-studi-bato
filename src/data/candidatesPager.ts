import type { KandidatProjekcija } from '../contracts/projections';
import { CANDIDATES_PAGE_LIMIT, type CandidatesCounts, type CandidatesCursor, type CandidatesPage, type CandidatesPageRequest, type CandidatesScope } from './candidatesPage';
import { createPagedListPager, type PagedListOptions, type PagedListState } from './pagedListPager';

/**
 * EX-04 S4 (A11 Kandidati i poređenje): the one owner of the paged read of the applications to ONE task. There is a single set (`ALL`; the screen has no tabs), so every rule — the epoch and
 * version fences, the dedupe by key, the depth a return re-reads, the bounded read of the rest — lives in `pagedListPager` and is proved there. An application is known by its `prijavaId`; the
 * reader is bound to the task by the screen, so a pager never outlives the task it was made for.
 */
export type CandidatesPageReader = (request: CandidatesPageRequest) => Promise<CandidatesPage>;
export type CandidatesPagerState = PagedListState<KandidatProjekcija, CandidatesScope, CandidatesCounts>;
type Options = Omit<PagedListOptions<KandidatProjekcija, CandidatesScope, CandidatesCursor, CandidatesCounts>, 'keyOf' | 'limit' | 'readPage'> & { readPage: CandidatesPageReader; limit?: number };

export function createCandidatesPager(options: Options) {
  return createPagedListPager<KandidatProjekcija, CandidatesScope, CandidatesCursor, CandidatesCounts>({
    ...options, keyOf: item => item.prijavaId, limit: options.limit ?? CANDIDATES_PAGE_LIMIT });
}
export type CandidatesPager = ReturnType<typeof createCandidatesPager>;
