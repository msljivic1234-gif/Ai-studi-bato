import type { NeedScheduleProjection, PotrebaProjekcija } from '../contracts/projections';
import { calendarInstant } from '../lib/calendarTime';
import { locationSlots } from '../lib/location';
import { displayDate, zonedParts } from '../ui/calendar/calendarPresentation';
import { novac } from '../lib/novac';

const SCHEDULE: Record<NeedScheduleProjection['kind'], string> = {
  // One word for a flexible time everywhere (the owner's phone, 8 Oct 2026: "Fleksibilan termin", "Fleksibilan raspon" and "Fleksibilno" on one screen).
  FIXED_WINDOW: 'Tačan termin', FLEXIBLE: 'Fleksibilno', REMOTE_ANYTIME: 'Na daljinu, fleksibilno',
  TODAY_FLEXIBLE: 'Danas, fleksibilno', TOMORROW_FLEXIBLE: 'Sutra, fleksibilno', WEEK_FLEXIBLE: 'Ove nedelje, fleksibilno',
};
const GEOGRAPHY = { STATIONARY: 'Na jednom mestu', POINT_TO_POINT: 'Od mesta do mesta', MULTI_STOP: 'Više stanica', AREA_BASED: 'Na području', REMOTE: 'Na daljinu' };
/** The reader's own zone, when the platform will say. */
function deviceZone(): string | null {
  try { return Intl.DateTimeFormat().resolvedOptions().timeZone || null; } catch { return null; }
}

/**
 * Presentation follows the saved task zone. Historical unknown zones are explicitly UTC.
 *
 * One way to write a time everywhere (the forensic UI/UX analysis, 2026-09-23): "24. sep · 12:00–19:00". The year is
 * written only when it is not the current one, seconds never (the stored instant keeps its full precision; a person
 * reads minutes), and the two offsets only when a DST change makes the same civil time happen twice. `now` exists so
 * tests can fix "the current year".
 */
export function needScheduleText(schedule: NeedScheduleProjection, timezone?: string, now: Date = new Date()): string {
  const zone = timezone ?? 'UTC';
  let thisYear = '';
  try { thisYear = zonedParts(now, zone).date.slice(0, 4); } catch { thisYear = ''; }
  // Day-granular reading belongs to a flexible range only. A fixed window keeps every instant it names.
  const flexible = schedule.kind !== 'FIXED_WINDOW';
  const instant = (value: string | null, role: 'start' | 'end') => {
    const parsed = calendarInstant(value);
    if (parsed === null) return null;
    const ms = parsed >= 0n ? parsed / 1000n : (parsed - 999n) / 1000n;
    try {
      const fraction = /\.(\d+)(?:Z|[+-])/.exec(value!)?.[1];
      const whole = !fraction?.replace(/0/g, '');
      let parts = zonedParts(new Date(Number(ms)), zone);
      // A flexible range that ENDS at midnight ends with the day before it; printed as midnight it read one day
      // too long ("– 14. sep" for a range that closes as the 13th ends).
      const endsAtMidnight = flexible && role === 'end' && whole && parts.time === '00:00:00';
      if (endsAtMidnight) parts = zonedParts(new Date(Number(ms - 1n)), zone);
      const time = parts.time.slice(0, 5);
      // The end of a day (23:59:59, however many nines follow) is a date, not a time a person meant, and a
      // flexible range that STARTS at midnight starts with the day.
      const endOfDay = flexible && role === 'end' && (endsAtMidnight || parts.time.startsWith('23:59:59'));
      const dayOnly = endOfDay || (flexible && role === 'start' && whole && parts.time === '00:00:00');
      const year = parts.date.slice(0, 4);
      const dateText = year === thisYear ? displayDate(parts.date) : `${displayDate(parts.date)} ${year}`;
      const wall = calendarInstant(`${parts.date}T${parts.time}Z`)!;
      // The offset is read at the instant the parts were taken from, so a midnight end moved back by 1 ms stays exact.
      const basis = endsAtMidnight ? parsed - 1000n : parsed;
      const second = basis >= 0n ? basis / 1_000_000n : (basis - 999_999n) / 1_000_000n;
      const offsetMinutes = Number((wall - second * 1_000_000n) / 60_000_000n);
      const offset = `UTC${offsetMinutes < 0 ? '−' : '+'}${String(Math.floor(Math.abs(offsetMinutes) / 60)).padStart(2, '0')}:${String(Math.abs(offsetMinutes) % 60).padStart(2, '0')}`;
      return { text: dayOnly ? dateText : `${dateText} · ${time}`, dateText, dayOnly, endOfDay, offset, date: parts.date, time };
    } catch { return null; }
  };
  const start = instant(schedule.startsAt, 'start'), end = instant(schedule.endsAt, 'end');
  // Repeated civil times across a DST change need both offsets to remain exact.
  const shifted = start && end && start.offset !== end.offset;
  // A window that begins and ends on one day names that day once: "20. sep · 06:38–09:38".
  const sameDay = !!start && !!end && start.date === end.date;
  // A whole day is one date; a day that ends at its end says so in words, not in seconds.
  const wholeDay = sameDay && start!.dayOnly && end!.endOfDay;
  // Two times of one day are joined tightly ("12:00–19:00"); anything with a date or a word keeps spaces.
  const tight = sameDay && !start!.dayOnly && !end!.endOfDay && !shifted;
  const endText = end?.endOfDay ? (sameDay ? 'kraj dana' : end.text) : sameDay ? end!.time : end?.text;
  // An end without a start is a completion deadline, not evidence that the
  // requester explicitly chose an unbounded flexible appointment.
  const deadlineOnly = flexible && !start && !!end;
  // Two ends inside one minute are one time: "10:00–10:00" reads as a mistake, not as a window.
  const range = wholeDay ? start!.dateText
    : tight ? (start!.time === end!.time ? start!.text : `${start!.text}–${endText}`)
    : start && end ? `${start.text}${shifted ? ` ${start.offset}` : ''} – ${endText}${shifted ? ` ${end.offset}` : ''}`
    : start ? `${schedule.kind === 'FIXED_WINDOW' ? 'Početak' : 'Od'} ${start.text}` : end ? `${deadlineOnly ? 'Rok do' : 'Do'} ${end.text}` : null;
  const preference = deadlineOnly ? (schedule.kind === 'REMOTE_ANYTIME' ? 'Na daljinu · ' : '')
    : schedule.kind === 'FIXED_WINDOW' ? '' : schedule.kind === 'REMOTE_ANYTIME' ? 'Na daljinu, fleksibilno · ' : 'Fleksibilno · ';
  // A zone the reader is already standing in does not need to be named; a different one does.
  // Naming it was not the problem — printing an instant in UTC and apologising for it was.
  // Serbian time is named the way the owner's rule says it (2026-09-21, deep read 8.27).
  const named = timezone && timezone !== deviceZone()
    ? ` (${timezone === 'Europe/Belgrade' ? 'po vremenu u Srbiji' : timezone})` : timezone ? '' : ' (UTC · zona nije navedena)';
  return range ? `${preference}${range}${named}`
    : schedule.kind === 'FIXED_WINDOW' ? 'Tačan termin nije potpun' : SCHEDULE[schedule.kind];
}
/**
 * A task title as a person should read it.
 *
 * Six of seventeen tasks on canonical DEV are stored with their title inside quotation marks —
 * `"Hitno prenosenje troseda"` — because that is how the interview wrote them. The stored value is
 * the server's and stays exactly as it is: cdl-a03-need-read-equivalence requires the projection to
 * carry it unchanged, and the real repair belongs in the prompt that writes it. This is the same
 * display-only tidy the category already gets, and it removes only a PAIR of wrapping quotes, so a
 * title that genuinely quotes something keeps it.
 */
export function readableTitle(value: string | null | undefined): string {
  if (typeof value !== 'string') return '';
  const text = value.trim().replace(/\s+/g, ' ');
  const pairs: [string, string][] = [['"', '"'], ['„', '“'], ['“', '”'], ["'", "'"]];
  for (const [open, close] of pairs) {
    if (text.length > 1 && text.startsWith(open) && text.endsWith(close)) return text.slice(1, -1).trim();
  }
  return text;
}

export type PriceBasis = "TOTAL" | "PER_PERSON" | "HOURLY" | null | undefined;

/**
 * What a task's price says, in words, once a task can say what its price is FOR (pkg025a-c).
 *
 * A null basis is every task written before 2026-09-20 and every task written since without one:
 * it reads exactly as it always has, because nothing about it has changed. PER_PERSON names the
 * unit, and on a screen with room it also names what the whole task would cost, which is the number
 * the owner said a person actually wants: "3.000 RSD po osobi - 6 osoba - ukupno 18.000 RSD".
 * HOURLY names a rate per person per hour; no duration means no final total.
 */
export function needPriceText(input: {
  rezimCene?: string; ponudjenaCena?: { iznos: number; prikaz: string }; osnovaCene?: PriceBasis;
  pokrivenost?: { ukupno: number };
}, options?: { withTotal?: boolean }): string {
  if (input.rezimCene === 'OFFERS') return 'Tražim ponude';
  if (!input.ponudjenaCena) return 'Cena nije navedena';
  const amount = input.ponudjenaCena.prikaz;
  if (input.osnovaCene === 'HOURLY') return `${amount} po osobi po satu`;
  if (input.osnovaCene === 'PER_PERSON') {
    const people = input.pokrivenost?.ukupno ?? 0;
    if (!options?.withTotal || people < 2 || !Number.isFinite(input.ponudjenaCena.iznos)) return `${amount} po osobi`;
    return `${amount} po osobi · ukupno ${novac(input.ponudjenaCena.iznos * people)}`;
  }
  if (input.osnovaCene === 'TOTAL') return `${amount} ukupno`;
  return amount;
}

/**
 * The qualifier that belongs under a price, when the number by itself would mislead.
 */
export function needPriceBasisNote(input: {
  osnovaCene?: PriceBasis; ponudjenaCena?: { iznos: number }; pokrivenost?: { ukupno: number };
}): string | null {
  if (input.osnovaCene === 'HOURLY') return 'po osobi po satu';
  if (input.osnovaCene === 'TOTAL') return 'ukupno za ceo zadatak';
  if (input.osnovaCene !== 'PER_PERSON') return null;
  const people = input.pokrivenost?.ukupno ?? 0;
  const amount = input.ponudjenaCena?.iznos;
  if (people < 2 || typeof amount !== 'number' || !Number.isFinite(amount)) return 'po osobi';
  return `po osobi · ukupno ${novac(amount * people)}`;
}

/** TOTAL/PER_PERSON applications carry a total; HOURLY carries the unchanged per-person hourly rate. */
export function fixedApplicationPrice(input: {
  rezimCene?: string; ponudjenaCena?: { iznos: number }; osnovaCene?: PriceBasis; pokrivenost?: { ukupno: number };
}, people: number): number | null {
  if (input.rezimCene !== 'MY_PRICE') return null;
  const amount = input.ponudjenaCena?.iznos;
  if (typeof amount !== 'number' || !Number.isSafeInteger(amount) || amount < 1) return null;
  if (input.osnovaCene === 'HOURLY') {
    const required = input.pokrivenost?.ukupno;
    return Number.isSafeInteger(people) && people >= 1 && people <= 50
      && (required === undefined || Number.isSafeInteger(required) && people <= required) ? amount : null;
  }
  if (input.osnovaCene !== 'PER_PERSON' && input.osnovaCene !== 'TOTAL') return amount;
  if (!Number.isSafeInteger(people) || people < 1) return null;
  const required = input.pokrivenost?.ukupno;
  if (input.osnovaCene === 'TOTAL' && (typeof required !== 'number' || !Number.isSafeInteger(required) || required < 1 || people > required)) return null;
  // Round the application's share once, never a rounded per-person unit times the people.
  const total = input.osnovaCene === 'TOTAL' ? Math.round(amount * people / required!) : amount * people;
  return Number.isSafeInteger(total) && total >= 1 ? total : null;
}

export function needGeographyRows(need: Pick<PotrebaProjekcija, 'detalji' | 'podrucjeTekst'>): { label: string; value: string }[] {
  const geo = need.detalji?.geografija;
  if (!geo) return [{ label: 'Približno područje', value: need.podrucjeTekst }];
  if (geo.mode === 'REMOTE') return [{ label: 'Način izvršenja', value: 'Na daljinu' }];
  return [{ label: 'Način izvršenja', value: GEOGRAPHY[geo.mode] }, ...locationSlots(geo).map(slot => {
    const point = slot === 'start' ? geo.start : slot === 'end' ? geo.end : slot === 'serviceArea' ? geo.serviceArea : geo.waypoints?.[Number(slot.split('/')[1])];
    return { label: slot === 'start' ? geo.mode === 'STATIONARY' ? 'Mesto' : 'Polazište' : slot === 'end' ? 'Odredište'
      : slot === 'serviceArea' ? 'Područje' : `Stanica ${Number(slot.split('/')[1]) + 1}`,
      value: [point?.label, point?.city, point?.area].filter(value => value !== undefined).join(' · ') };
  })];
}
export function needRequirementRows(need: Pick<PotrebaProjekcija, 'detalji' | 'uslovi'>): { label: string; value: string }[] {
  const requirements = need.detalji?.zahtevi;
  if (!requirements) return need.uslovi.length ? [{ label: 'Uslovi', value: need.uslovi.map(value => `• ${value}`).join('\n') }] : [];
  const groups: [string, string[] | null][] = [['Veštine', requirements.vestine], ['Alat', requirements.alati], ['Vozilo', requirements.vozila],
    ['Dozvole', requirements.dozvole], ['Bitni uslovi', requirements.bitniUslovi]];
  return [...groups.filter(([, values]) => values?.length).map(([label, values]) => ({ label, value: values!.map(value => `• ${value}`).join('\n') })),
    ...(requirements.iskustvoGodina !== null ? [{ label: 'Najmanje iskustva', value: `${requirements.iskustvoGodina} god.` }] : []),
    ...(requirements.potvrdjenIdentitet ? [{ label: 'Identitet', value: 'Potreban je potvrđen identitet' }] : [])];
}
