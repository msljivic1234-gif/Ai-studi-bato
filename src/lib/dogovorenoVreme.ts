/**
 * A time that two people agreed on, written so both of them read the same thing.
 *
 * The distinction this file exists to hold: a moment in the reader's own life — when a notification
 * arrived, when a receipt was written, when an export expires — belongs in the reader's timezone,
 * and `toLocaleString` with no zone is right for it. A time that is a TERM, proposed by one person
 * and accepted by another, does not. It must read the same on both phones.
 *
 * It was not reading the same. The requester saw a worker's proposed start through
 * `candidateClientService`, which pins Europe/Belgrade. The worker saw their own proposal through
 * `applicationClientService`, which called `toLocaleString` with no zone at all. Same instant, two
 * screens, and on a phone set to another zone, two different times for the thing being agreed.
 *
 * The owner's rule (2026-09-21, deep read 8.27): every agreed time is shown in Serbian time, the
 * same on both phones, and a phone set to another zone is told so with "po vremenu u Srbiji". The
 * accepted Agreement window and the change form read this constant too, so there is one answer.
 */
import { vreme, zonaTelefona } from './vreme';

export const DOGOVORENA_ZONA = 'Europe/Belgrade';

/** " (po vremenu u Srbiji)" on a phone set to another zone; nothing on a phone already in Serbian time. */
export function napomenaZone(): string {
  return zonaTelefona() === DOGOVORENA_ZONA ? '' : ' (po vremenu u Srbiji)';
}

export function dogovorenoVreme(value: unknown, fallback = 'Po dogovoru'): string {
  if (typeof value !== 'string' || !value) return fallback;
  // One time format (src/lib/vreme.ts): "24. sep · 12:00", read in Serbian time.
  const text = vreme(value, { zona: DOGOVORENA_ZONA });
  return text ? text + napomenaZone() : fallback;
}
