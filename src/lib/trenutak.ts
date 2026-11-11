import { displayDate, shiftDate, zonedParts } from '../ui/calendar/calendarPresentation';
import { zonaTelefona } from './vreme';

/**
 * A moment split into the day it belongs to and its clock, for a list that groups by day (the inbox, 2026-09-24):
 * "Danas" / "Juče" / "22. sep" (the year only when it is not the current one, "5. jan 2025") over rows that carry
 * "14:05". It is `vreme()`'s one time format taken apart, with the same zone rule (the phone's own, UTC without one),
 * so a row never spells a moment a second way: `vreme()` writes "22. sep · 14:05", this writes the same two halves.
 *
 * `kljuc` is the civil day in that zone ("2026-09-22"), the key a list groups on. Nothing is recomputed per row outside
 * this helper. An invalid value gives null, never a made-up day.
 *
 * Kept beside `vreme.ts` rather than inside it because that file belongs to another step of the design plan; it can be
 * folded into `vreme.ts` unchanged.
 */
export type Trenutak = { kljuc: string; dan: string; sat: string };

export function trenutak(value: string | number | Date | null | undefined, { zona, sada }: { zona?: string; sada?: Date } = {}): Trenutak | null {
  const instant = value instanceof Date ? value : typeof value === 'number' || (typeof value === 'string' && value) ? new Date(value) : null;
  if (!instant || Number.isNaN(instant.getTime())) return null;
  try {
    const zone = zona ?? zonaTelefona() ?? 'UTC';
    const parts = zonedParts(instant, zone), today = zonedParts(sada ?? new Date(), zone).date;
    const kljuc = parts.date, sat = parts.time.slice(0, 5);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(kljuc) || !/^\d{2}:\d{2}$/.test(sat)) return null;
    const year = kljuc.slice(0, 4);
    const dan = kljuc === today ? 'Danas' : kljuc === shiftDate(today, -1) ? 'Juče'
      : year === today.slice(0, 4) ? displayDate(kljuc) : `${displayDate(kljuc)} ${year}`;
    return { kljuc, dan, sat };
  } catch { return null; }
}
