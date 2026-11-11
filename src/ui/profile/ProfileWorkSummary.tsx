import { useCallback } from 'react';
import { publicProfileClientService } from '../../data/publicProfileClientService';
import { workTrustClientService, type MyWorkStats } from '../../data/workTrustClientService';
import { useFocusedResource } from '../../hooks/useFocusedResource';
import { FigureCell, FigureCellError, FigureCellPlaceholder, finishedFigure } from './ProfileFigures';
import { ReliabilityFigure, type ProfileStatsState } from './ProfileStats';

type Role = 'narucilac' | 'uskocer';
/** How many Dogovori the person finished in one role, or null when that count could not be read (never a made-up zero). */
export type FinishedFact = { role: Role; count: number | null };
export type FinishedView = { kind: 'loading' } | { kind: 'ready'; facts: readonly FinishedFact[] };

/**
 * "Završeno" as the profile draws it (8 Oct 2026, "Lice i tri broja"): the second of the three figures, the number of Dogovori the person
 * finished in every role they have, written under the face as "9 završenih". It replaces the section "Završeni Dogovori" with its two
 * rows and its word "Pogledaj": with `onOpen` the figure itself is the way to the Dogovori that were finished (the Dogovori screen takes
 * `odeljak: 'istorija'`). Presentation only: the container below reads the counts. A count that could not be read is never added up as
 * if it were zero: the cell says so and offers "Osveži" in the same place.
 */
export function FinishedAgreements({ view, onOpen, onRefresh }: {
  view: FinishedView;
  /** Opens the finished Dogovori. Absent: the figure is only a figure. */ onOpen?: () => void;
  onRefresh: () => void;
}) {
  if (view.kind === 'loading') return <FigureCellPlaceholder label="Proveravamo završene Dogovore…" />;
  if (view.facts.length === 0) return null;
  if (view.facts.some(fact => fact.count === null)) {
    return <FigureCellError message="Broj završenih trenutno nije dostupan." retryLabel="Osveži pregled završenih Dogovora" onRetry={onRefresh} />;
  }
  const total = view.facts.reduce((sum, fact) => sum + (fact.count ?? 0), 0);
  const figure = finishedFigure(total);
  return <FigureCell testID="profile-work-summary" figure={onOpen ? { ...figure, hint: 'Otvara završene Dogovore.' } : figure} onPress={onOpen} />;
}

/**
 * Own worker statistics include drafts and paused profiles; the public projection intentionally does not.
 * One private read supplies both the completed count and reliability. Requester counts stay independent,
 * so a slow requester read cannot hide an available reliability figure. Both reads are account/focus fenced.
 */
export function ProfileWorkSummary({ requesterProfileId, workerProfileId, onOpen }: {
  requesterProfileId: string | null; workerProfileId: string | null;
  /** Opens the finished Dogovori. Absent: the summary is only a summary. */ onOpen?: () => void;
}) {
  const requesterId = requesterProfileId !== workerProfileId ? requesterProfileId : null;
  const loadWorker = useCallback(async (): Promise<MyWorkStats | null> => {
    if (!workerProfileId) return null;
    const result = await workTrustClientService.myStats();
    if (!result.ok) throw new Error(result.kod);
    if (!result.podatak.hasWorkerProfile || result.podatak.profileId !== workerProfileId) throw new Error('WORK_STATS_PROFILE_MISMATCH');
    return result.podatak;
  }, [workerProfileId]);
  const loadRequester = useCallback(async (signal: AbortSignal): Promise<number | null> => {
    if (!requesterId) return null;
    const profile = await publicProfileClientService.javniProfil(requesterId, signal);
    const count = profile?.poverenje?.zavrseniBroj;
    if (profile?.profilId !== requesterId || profile.uloga !== 'narucilac' ||
      typeof count !== 'number' || !Number.isSafeInteger(count) || count < 0) throw new Error('REQUESTER_COUNT_UNAVAILABLE');
    return count;
  }, [requesterId]);
  const worker = useFocusedResource(loadWorker);
  const requester = useFocusedResource(loadRequester);
  if (!requesterProfileId && !workerProfileId) return null;
  const refresh = () => { if (workerProfileId) void worker.refresh(); if (requesterId) void requester.refresh(); };
  const view: FinishedView = (workerProfileId && worker.loading) || (requesterId && requester.loading)
    ? { kind: 'loading' } : { kind: 'ready', facts: [
      ...(workerProfileId ? [{ role: 'uskocer' as const, count: worker.error ? null : worker.data?.agreementsCompleted ?? null }] : []),
      ...(requesterId ? [{ role: 'narucilac' as const, count: requester.error ? null : requester.data }] : []),
    ] };
  const stats: ProfileStatsState = worker.loading ? { kind: 'loading' }
    : worker.error || !worker.data ? { kind: 'error', onRetry: refresh } : { kind: 'ready', stats: worker.data };
  return <><FinishedAgreements view={view} onOpen={onOpen} onRefresh={refresh} />
    {workerProfileId ? <ReliabilityFigure state={stats} /> : null}</>;
}
