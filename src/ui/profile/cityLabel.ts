import { tidyPlaceLabel } from '../location/placeText';

const LOCALE = 'sr-Latn-RS';
/** The small words of a name that stay small after its first word ("Beograd na vodi", "Kovilj kod Novog Sada"): the same list as `tidyPlaceLabel`. */
const SMALL_WORDS: ReadonlySet<string> = new Set(['na', 'kod', 'pod', 'od', 'uz', 'pri', 'iza', 'ispod', 'iznad', 'pored', 'do', 'za', 'sa', 'iz']);

/**
 * A CITY as the profile screens SHOW it (owner's phone, 8 Oct 2026: the header said "Novi Sad" and the rows under it "Novi sad", because the
 * work area's city was typed with a small "s"). `tidyPlaceLabel` is for any place and keeps "Stari grad" or "Žitni trg" as typed, since only
 * the person knows a small word there is the name's own; a CITY field names a settlement, whose every word takes a capital ("Novi Sad",
 * "Sremska Mitrovica", "Bela Crkva"). So after the careless-case tidy of `tidyPlaceLabel` a word that still starts in lower case gets its
 * capital, except the small words after the first ("Beograd na vodi"); the rest of the word, the separators and abbreviations stay as typed.
 *
 * DISPLAY ONLY: what the profile stores, sends or searches is never passed through here. An empty label stays empty.
 */
export function cityLabel(label: string): string {
  const tidy = tidyPlaceLabel(label.trim());
  const parts = tidy.split(/([\s\-‐–—\/,.;:()]+)/);        // words at the even places, separators (kept as typed) at the odd ones
  let named = false;
  return parts.map((part, index) => {
    if (index % 2 === 1 || !part) return part;
    const first = !named; named = true;
    if (!first && SMALL_WORDS.has(part.toLocaleLowerCase(LOCALE))) return part.toLocaleLowerCase(LOCALE);
    const [head] = part;
    // A lower-case letter is one that changes when it is raised (Serbian Latin and Cyrillic alike); a digit or a capital is left alone.
    const raised = head ? head.toLocaleUpperCase(LOCALE) : head;
    return head && raised !== head ? raised + part.slice(head.length) : part;
  }).join('');
}
