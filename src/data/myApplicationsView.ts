import type { MojaPrijavaProjekcija } from '../contracts/projections';

/**
 * Which set of "Moje prijave" an application belongs to. One rule, used by the list's tabs and by Početna's
 * "Moje prijave" row, so the row never counts what the screen it opens shows differently (owner's information
 * architecture, 2026-09-23). The server's own attention flag wins; otherwise a still-open application is active and
 * everything else — selected, withdrawn, closed — is finished.
 */
export type ApplicationSection = 'attention' | 'active' | 'finished';
export function applicationSection(p: Pick<MojaPrijavaProjekcija, 'traziPaznju' | 'stanje'>): ApplicationSection {
  if (p.traziPaznju) return 'attention';
  return ['SUBMITTED', 'VIEWED', 'SHORTLISTED'].includes(p.stanje) ? 'active' : 'finished';
}

export type ApplicationCounts = { total: number } & Record<ApplicationSection, number>;
export function applicationCounts(rows: readonly MojaPrijavaProjekcija[]): ApplicationCounts {
  const counts: ApplicationCounts = { total: rows.length, attention: 0, active: 0, finished: 0 };
  for (const row of rows) counts[applicationSection(row)]++;
  return counts;
}
