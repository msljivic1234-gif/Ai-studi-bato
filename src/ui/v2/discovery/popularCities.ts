import { normalizedPlaceText } from '../../location/placeText';

/**
 * The biggest cities of Serbia, shown in "Gde" under the places that have tasks (owner, 2026-10-07: "da se vide više
 * gradova, ne samo lepa animacija"). It is a static list of NAMES only: no coordinates, no counts and nothing the server
 * has to know. A city is chosen with the one filter the server already has (`place`, the exact public place text), so
 * `cityStanding` says, for each name, whether that filter can express it.
 */
export const POPULAR_CITIES: readonly string[] = ['Beograd', 'Novi Sad', 'Niš', 'Kragujevac', 'Subotica', 'Pančevo', 'Čačak', 'Kraljevo',
  'Smederevo', 'Šabac', 'Valjevo', 'Zrenjanin', 'Leskovac', 'Kruševac', 'Sombor', 'Požarevac'];

/** A place the tasks name, and how many tasks there are; `null` while the list is not known (never "0"). */
export type PlaceRow = { text: string; count: number | null };

/** "Niš", "Nis" and "NIŠ" are one place to a person looking for it. Only for finding: the filter keeps the text as written. */
export const foldPlace = (text: string): string => normalizedPlaceText(text);

/** The parts of a place's text between commas, each folded: "Vračar, Beograd" is "vracar" and "beograd". */
export const placeParts = (text: string): string[] => text.split(',').map(foldPlace).filter(part => part !== '');

/** Whether the letters typed occur in the place's text; nothing typed matches every place. */
export function placeMatches(text: string, typed: string): boolean {
  const needle = foldPlace(typed);
  return needle === '' || foldPlace(text).includes(needle);
}

/**
 * How the tasks stand towards one city name, in terms of what the existing filter can say:
 *
 * - `place`: some tasks name exactly this city, so choosing it is the ordinary place filter (the row shown is that place).
 * - `parts`: tasks are under parts of the city ("Vračar, Beograd"), none under the city alone. The place filter matches the
 *   WHOLE public text, so it cannot say "all of Beograd"; the person is taken to the parts instead, never to an empty list.
 * - `none`: the whole list of places is known and no task names this city. Choosing it is still a legal place filter, and
 *   its honest answer is "no tasks yet".
 * - `unknown`: more places exist than were read, so a city that is not among them might still have tasks. Nothing is
 *   claimed; the person is taken to the places that contain the name, which the server answers exactly.
 *
 * `complete` is true only when every place with tasks has been read.
 */
export type CityStanding =
  | { kind: 'place'; text: string; count: number | null }
  | { kind: 'parts'; places: number; count: number | null }
  | { kind: 'none' }
  | { kind: 'unknown' };

export function cityStanding(city: string, rows: readonly PlaceRow[], complete: boolean): CityStanding {
  const key = foldPlace(city);
  const exact = rows.find(row => foldPlace(row.text) === key);
  if (exact) return { kind: 'place', text: exact.text, count: exact.count };
  const inside = rows.filter(row => placeParts(row.text).includes(key));
  if (inside.length) {
    const counted = inside.every(row => row.count !== null);
    return { kind: 'parts', places: inside.length, count: complete && counted ? inside.reduce((sum, row) => sum + (row.count ?? 0), 0) : null };
  }
  return complete ? { kind: 'none' } : { kind: 'unknown' };
}
