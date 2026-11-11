import { useCallback } from 'react';
import type { StanjeDogovora } from '../../contracts/projections';
import { useFocusedResource } from '../../hooks/useFocusedResource';
import { useIzvor } from '../../store/uloga';

/**
 * R17 (UI/UX pass, 2026-10-08): which of my Dogovori are over, so the list of conversations can tell the active ones from the finished.
 * The reader of the conversations does not carry it (`ConversationInboxRow.closed` is optional, and nothing supplies it); the Dogovori
 * read the app already makes does. A Dogovor is over when it is completed or cancelled; one that is confirmed, or waits for its
 * completion to be confirmed, is not.
 */
export const isClosedAgreement = (stanje: StanjeDogovora): boolean => stanje === 'COMPLETED' || stanje === 'CANCELLED';

/**
 * The ids of my closed Dogovori, or null while that is not known (the first read, or a read that failed). Null is not "none": the list
 * then stays one list, and no conversation is called active or finished on a guess. Read once per focus like every screen's resource,
 * without the per-Dogovor rating reads (a finished Dogovor's rating is not this list's business).
 */
export function useClosedAgreements(): ReadonlySet<string> | null {
  const source = useIzvor();
  const load = useCallback(async () => new Set((await source.mojiDogovori({ includeRatings: false }))
    .filter(row => isClosedAgreement(row.stanje)).map(row => row.id)), [source]);
  return useFocusedResource(load).data ?? null;
}
