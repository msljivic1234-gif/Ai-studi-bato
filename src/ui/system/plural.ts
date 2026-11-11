/**
 * Serbian counts in three shapes, not one.
 *
 * "1 zadataka" was on the map legend, because the app was counting the way English does. The shape
 * is chosen by the last two digits: 11–14 always take the third form, otherwise a final 1 takes the
 * first and a final 2, 3 or 4 the second.
 *
 * The caller passes the three words because only the caller knows them: `plural(n, 'zadatak',
 * 'zadatka', 'zadataka')`, `plural(n, 'Dogovor', 'Dogovora', 'Dogovora')`.
 */
export function plural(count: number, one: string, few: string, many: string): string {
  const hundred = Math.abs(count) % 100, ten = Math.abs(count) % 10;
  if (hundred >= 11 && hundred <= 14) return `${count} ${many}`;
  if (ten === 1) return `${count} ${one}`;
  if (ten >= 2 && ten <= 4) return `${count} ${few}`;
  return `${count} ${many}`;
}

export const zadataka = (count: number) => plural(count, 'zadatak', 'zadatka', 'zadataka');
export const dogovora = (count: number) => plural(count, 'Dogovor', 'Dogovora', 'Dogovora');
// Lower case: this one is used inside a sentence ("3 prijave za pregled"), while a Zadatak and a
// Dogovor are named as such wherever they are counted.
export const prijava = (count: number) => plural(count, 'prijava', 'prijave', 'prijava');
/** Unread notifications or messages: "1 nepročitano", "3 nepročitana", "5 nepročitanih" (seen wrong on the phone 2026-09-23). */
export const neprocitanih = (count: number) => plural(count, 'nepročitano', 'nepročitana', 'nepročitanih');

/**
 * A price is read together with the people it is for (owner decision 2, 2026-09-19): "5.500 RSD
 * ukupno · dolaze 2 osobe". The verb follows the count the way the noun does, so "dolazi 1 osoba",
 * "dolaze 2 osobe", "dolazi 5 osoba". This replaced "Za 1 ljudi".
 */
export const osoba = (count: number) => plural(count, 'osoba', 'osobe', 'osoba');
/**
 * The same people after a preposition that takes the accusative: "Ukupno za 1 osobu", "za 2 osobe", "za 5 osoba".
 * The offer screen read "Ukupno za dolazi 1 osoba" (seen on the phone, 2026-09-23): a sentence glued to a sentence.
 */
export const osobuAkuz = (count: number) => plural(count, 'osobu', 'osobe', 'osoba');
export function dolaziOsoba(count: number): string {
  const hundred = Math.abs(count) % 100, ten = Math.abs(count) % 10;
  const few = !(hundred >= 11 && hundred <= 14) && ten >= 2 && ten <= 4;
  return `${few ? 'dolaze' : 'dolazi'} ${osoba(count)}`;
}
/**
 * What a task still needs, as a sentence the verb agrees with: "Nedostaje još jedna osoba.", "Nedostaju još 2 osobe.",
 * "Nedostaje još 5 osoba.", "Nedostaje još 21 osoba." (plural verb for 2 to 4 and 22 to 24, never 12 to 14). It was "Nedostaje još 2 ljudi".
 */
export function nedostajeOsoba(count: number): string {
  if (count === 1) return 'Nedostaje još jedna osoba.';
  const hundred = Math.abs(count) % 100, ten = Math.abs(count) % 10;
  const few = !(hundred >= 11 && hundred <= 14) && ten >= 2 && ten <= 4;
  return `${few ? 'Nedostaju' : 'Nedostaje'} još ${osoba(count)}.`;
}
