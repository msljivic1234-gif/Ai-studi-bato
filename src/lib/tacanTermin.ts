import { calendarInstant } from './calendarTime';

/**
 * The exact window a Dogovor's accepted terms name: both ends exact instants, the start before the end. It is what the
 * calendar places a Dogovor by (round-1 critique A15: the requester's side and finished work were missing because the
 * list carried only the words of the term, never its instants).
 */
export type TacanTermin = Readonly<{ pocetak: string; kraj: string }>;

/**
 * The accepted window from the terms already read (`proposed_start_at` / `proposed_end_at` of the accepted version), or
 * `null` when either end is missing, unreadable or not after the other. The stored text is kept as it came: nothing is
 * rounded or re-zoned here, so a microsecond boundary still compares exactly.
 */
export function tacanTermin(pocetak: unknown, kraj: unknown): TacanTermin | null {
  if (typeof pocetak !== 'string' || typeof kraj !== 'string') return null;
  const start = calendarInstant(pocetak), end = calendarInstant(kraj);
  return start !== null && end !== null && start < end ? { pocetak, kraj } : null;
}
