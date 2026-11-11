/** Existing NEED_FACT_V2 TEXT_ARRAY contract (50 items / 500 Unicode characters).
 * Display spelling, case, order and duplicates are preserved; matching alone
 * uses the existing private.lower_arr. No vocabulary or licence is inferred. */
export function capabilityTerms(raw: unknown): string[] | null {
  if (!Array.isArray(raw) || raw.length > 50) return null;
  const terms: string[] = [];
  for (const item of raw) {
    if (typeof item !== 'string' || Array.from(item).length > 500) return null;
    // PostgreSQL btrim(text) removes ASCII spaces, not arbitrary Unicode.
    const term = item.replace(/^ +| +$/g, '');
    if (!term) return null;
    terms.push(term);
  }
  return terms;
}
