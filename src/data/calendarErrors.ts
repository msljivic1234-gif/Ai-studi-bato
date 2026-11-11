import type { Ishod } from './ports';
import { record } from './serverReceipt';

/** Only recognized calendar failures become actionable UI copy; never echo private details. */
export function calendarFailure(error: unknown): Ishod<never> | null {
  const value = record(error);
  if (!value) return null;
  let calendarConflict = value.message === 'WORKER_CALENDAR_CONFLICT';
  if ((value.message === 'WORKER_NOT_ELIGIBLE' || value.message === 'WORKER_NO_LONGER_ELIGIBLE')
      && typeof value.details === 'string') {
    try {
      const blockers: unknown = JSON.parse(value.details);
      calendarConflict = Array.isArray(blockers) && blockers.includes('CALENDAR_CONFLICT');
    } catch { /* Malformed details cannot manufacture a calendar diagnosis. */ }
  }
  if (calendarConflict) return { ok: false, kod: 'WORKER_CALENDAR_CONFLICT',
    poruka: 'Termin se preklapa sa drugim Dogovorom. Proveri Raspored i izaberi drugi termin.' };
  if (value.message === 'AGREEMENT_CALENDAR_INTERVAL_INVALID' || value.message === 'NEED_FIXED_INTERVAL_INVALID') {
    return { ok: false, kod: 'AGREEMENT_CALENDAR_INTERVAL_INVALID',
      poruka: 'Proveri uneti početak i kraj. Ako tačan termin još nije dogovoren, ostavi ga fleksibilnim.' };
  }
  if (value.code === '40001' || value.code === '40P01') return { ok: false, kod: 'CALENDAR_RECHECK_REQUIRED',
    poruka: 'Raspored se upravo promenio. Osveži podatke pre ponovnog pokušaja.' };
  return null;
}
