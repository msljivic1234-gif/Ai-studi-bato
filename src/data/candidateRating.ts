/** Shared, React-free candidate rating validator.
 * Only 1–5 may become a rating. A missing/invalid numeric value cannot
 * receive a star or win a "Najbolja ocena" comparison.
 */
export function candidateRatingValue(raw: unknown): number | null {
  if (typeof raw !== 'string' || !/^\s*[1-5](?:[.,]\d{1,3})?\s*$/.test(raw)) return null;
  const value = Number(raw.trim().replace(',', '.'));
  return Number.isFinite(value) && value >= 1 && value <= 5 ? value : null;
}
