import type { DogovorProjekcija, NeedScheduleProjection } from '../../../contracts/projections';
import { calendarInstant } from '../../../lib/calendarTime';

/**
 * What the worker's own plans and work area say about a task, before an application is written (UX plan R25), as two facts the detail may draw in quiet rows:
 * an agreement of theirs that the task would overlap, and how far the task is from the area they work in. Both come from reads the app already makes
 * (the Dogovori and the saved work area); the page invents neither, and a fact that cannot be known is left out, never guessed.
 */
export type TaskFitContext = { overlapTitle?: string | null; distanceKm?: number | null };

const EARTH_KM = 6371.0088;
const RAD = Math.PI / 180;

/** The distance between two coarse public points, in kilometres (haversine). Both points are rounded to about a kilometre, so the answer is "about". */
export function distanceBetweenKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number | null {
  const values = [a.lat, a.lng, b.lat, b.lng];
  if (!values.every(Number.isFinite) || Math.abs(a.lat) > 90 || Math.abs(b.lat) > 90 || Math.abs(a.lng) > 180 || Math.abs(b.lng) > 180) return null;
  const dLat = (b.lat - a.lat) * RAD, dLng = (b.lng - a.lng) * RAD;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * RAD) * Math.cos(b.lat * RAD) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** The exact window of a task that names one (a fixed window with both ends exact, the start before the end); anything flexible has no window to overlap. */
const taskWindow = (schedule: NeedScheduleProjection | undefined): readonly [bigint, bigint] | null => {
  if (!schedule || schedule.kind !== 'FIXED_WINDOW') return null;
  const start = calendarInstant(schedule.startsAt), end = calendarInstant(schedule.endsAt);
  return start !== null && end !== null && start < end ? [start, end] : null;
};

/**
 * The title of the first agreement of mine (confirmed or waiting for the other side, with an exact accepted term) whose term overlaps the task's window, or null.
 * A finished or cancelled agreement does not hold anyone's day, an agreement without an exact term says nothing about the day, and two windows that only touch
 * (one ends when the other begins) do not overlap.
 */
export function overlappingAgreementTitle(schedule: NeedScheduleProjection | undefined,
  agreements: readonly Pick<DogovorProjekcija, 'naslov' | 'stanje' | 'tacanTermin'>[]): string | null {
  const window = taskWindow(schedule);
  if (!window) return null;
  const held = agreements.flatMap(agreement => {
    if (agreement.stanje !== 'CONFIRMED' && agreement.stanje !== 'AWAITING_REQUESTER') return [];
    const term = agreement.tacanTermin;
    if (!term) return [];
    const start = calendarInstant(term.pocetak), end = calendarInstant(term.kraj);
    return start !== null && end !== null && start < end && start < window[1] && window[0] < end && agreement.naslov.trim() ? [{ start, title: agreement.naslov.trim() }] : [];
  });
  held.sort((a, b) => (a.start < b.start ? -1 : a.start > b.start ? 1 : 0));
  return held[0]?.title ?? null;
}

/** What is known, from what was read: the overlap and the distance, each only when it can be said. */
export function taskFit({ schedule, pin, remote, agreements, workArea }: {
  schedule: NeedScheduleProjection | undefined; pin: { lat: number; lng: number } | null; remote: boolean;
  agreements: readonly Pick<DogovorProjekcija, 'naslov' | 'stanje' | 'tacanTermin'>[] | null;
  /** The saved work area's coarse point; null when none is saved or it could not be read. */
  workArea: { lat: number; lng: number } | null;
}): TaskFitContext {
  const overlapTitle = agreements ? overlappingAgreementTitle(schedule, agreements) : null;
  // A remote task has no place to be far from, and a task without a public point has no distance.
  const distanceKm = !remote && pin && workArea ? distanceBetweenKm(workArea, pin) : null;
  return { overlapTitle, distanceKm };
}
