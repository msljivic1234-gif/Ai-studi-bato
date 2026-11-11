import type { MyWorkStats } from '../../data/workTrustClientService';
import { FigureCell, reliabilityFigure } from './ProfileFigures';
import { RELIABILITY_MEANING } from './workTrustModel';

/** What the reliability figure holds: it is still reading, it could not be read, or it is read (`MyWorkStats` of the server). */
export type ProfileStatsState = { kind: 'loading' } | { kind: 'error'; onRetry: () => void } | { kind: 'ready'; stats: MyWorkStats };

/**
 * "Dolazi kako je dogovoreno" as the profile draws it (8 Oct 2026, "Lice i tri broja"): the third of the three figures, the person's own
 * reliability under the face, "90 %" with its words under it. It replaces the section "Moja statistika" (the funnel of applications sent,
 * agreed and finished, and the sentence under it): the finished count is the second figure now, and what the percentage is made of (or what
 * it waits for) is said to a screen reader as the figure's hint, so the explanation is not lost, only no longer a paragraph.
 *
 * Only for an account that has a work profile: without one there is no work to count and nothing is drawn. The percentage is the server's;
 * nothing is computed or filled in here. A percentage that does not exist yet (too few Dogovori) is NOT drawn at all, not as "Još nema
 * procenta" and not as 0 (owner's phone, 8 Oct 2026, and the rule of what he picks: what is not there is not drawn): the other two figures
 * stand together in the middle of the row. The same goes while it reads and when it could not be read: a figure that has nothing to
 * say takes no room, so the row does not jump when the answer lands (most accounts have no percentage for a long time).
 *
 * Presentation only; `ProfileWorkSummary` shares one private read with the completed count.
 */
export function ReliabilityFigure({ state }: { state: ProfileStatsState }) {
  if (state.kind !== 'ready') return null;
  const { stats } = state;
  if (!stats.hasWorkerProfile || stats.reliabilityState !== 'AVAILABLE' || stats.reliabilityPercent === null) return null;
  // What the percentage is made of stays a hint for a screen reader, so the explanation is not lost, only no longer a paragraph.
  return <FigureCell testID="profile-stats" figure={{ ...reliabilityFigure(stats.reliabilityPercent), hint: RELIABILITY_MEANING }} />;
}
