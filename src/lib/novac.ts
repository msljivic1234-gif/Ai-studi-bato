/**
 * An amount of money, written the one way this app writes it.
 *
 * Ten places built this string by hand — `${n.toLocaleString('sr-Latn-RS')} RSD` — across the
 * client services, both fake sources, the task presentation and the intake card. Nine agreed. The
 * tenth, in the fake source's candidate list, was `${k.cenaRsd} RSD`: no separator at all, so one
 * screen said "18000 RSD" while every other said "18.000 RSD".
 *
 * That is the same shape of defect the Serbian plural had, for the same reason: a rule everybody
 * knows is a rule everybody rewrites, and the copy that drifts is the one nobody is looking at.
 *
 * `sr-Latn-RS` groups with a full stop, which is what Serbian expects: 18.000, not 18,000.
 */
const LOCALE = 'sr-Latn-RS';

/** The grouped number alone, for a place that already says the currency some other way. */
export function iznos(value: number): string {
  return Number.isFinite(value) ? value.toLocaleString(LOCALE) : '';
}

/**
 * The amount as a person reads it: "18.000 RSD".
 *
 * A currency other than dinars is passed explicitly, because the Agreement projection carries one
 * and this must not quietly relabel it.
 */
export function novac(value: number, valuta = 'RSD'): string {
  const grouped = iznos(value);
  if (!grouped) return '';
  if (valuta === 'EUR' || valuta === '€') return `${grouped} €`;
  return `${grouped} ${valuta}`;
}

/** An agreed amount that was never saved, said in words wherever an amount would stand; never "0 RSD". */
export const BEZ_IZNOSA = 'Iznos nije sačuvan';

/** An application or accepted agreement keeps its own unit. Missing legacy
 * metadata cannot be reconstructed from today's task or silently mean TOTAL. */
export function applicationPriceBasisText(basis: 'TOTAL' | 'HOURLY' | null | undefined): string {
  return basis === 'HOURLY' ? 'po osobi po satu'
    : basis === 'TOTAL' ? 'ukupno' : 'osnovica cene nije potvrđena';
}
