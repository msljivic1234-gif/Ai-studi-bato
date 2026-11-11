/**
 * The one way the app turns a person's name into the letters that stand in for their photo (2026-09-24). Until today it
 * did so four ways, so the same person read "MI" on one screen, "M" on the next and "MS" on a third, and a missing name
 * invented letters ("TI", "DS", "JA", "?") that belong to nobody.
 *
 * The rule: the first grapheme of each of the first two words, in capitals as Serbian writes them. A word that holds no
 * letter or digit (a dash, a bracket, an emoji on its own) is not a word of the name. No name gives `null`, never a
 * placeholder: the Avatar then draws a person, and nothing claims letters that were never there.
 *
 * "Miloš Šljivić" → "MŠ", "msljivic031" → "M", "  " → null.
 */
export function inicijali(ime: string | null | undefined): string | null {
  if (typeof ime !== 'string') return null;
  const letters = ime.trim().split(/\s+/)
    .map(firstGrapheme)
    .filter((grapheme): grapheme is string => grapheme !== null)
    .slice(0, 2);
  return letters.length ? letters.join('').toLocaleUpperCase('sr-Latn-RS') : null;
}

/** The first grapheme of a word that starts at its first letter or digit, or null when the word has neither. */
function firstGrapheme(word: string): string | null {
  const graphemes = split(word);
  const start = graphemes.findIndex(isLetterOrDigit);
  return start < 0 ? null : graphemes[start];
}

/**
 * Hermes may lack `Intl.Segmenter`; without it a grapheme is one code point with the marks that ride on it (a combining
 * accent, a variation selector, a skin tone, a joiner and what it joins), which covers every name the app shows.
 */
function split(word: string): string[] {
  const Segmenter = (Intl as { Segmenter?: new (locale: string, options: { granularity: 'grapheme' }) => {
    segment: (input: string) => Iterable<{ segment: string }> } }).Segmenter;
  if (typeof Segmenter === 'function') {
    try { return Array.from(new Segmenter('sr-Latn-RS', { granularity: 'grapheme' }).segment(word), part => part.segment); }
    catch { /* fall through to code points */ }
  }
  const graphemes: string[] = [];
  let joining = false;
  for (const point of Array.from(word)) {
    if (graphemes.length && (joining || isMark(point))) graphemes[graphemes.length - 1] += point;
    else graphemes.push(point);
    joining = point === '‍';
  }
  return graphemes;
}

const LETTER_OR_DIGIT = pattern('^[\\p{L}\\p{N}]', 'u');
const MARK = pattern('^[\\p{M}\\u200D\\uFE0E\\uFE0F]', 'u');

function isLetterOrDigit(grapheme: string): boolean {
  if (LETTER_OR_DIGIT) return LETTER_OR_DIGIT.test(grapheme);
  // Without Unicode classes: a letter is anything with two cases, or a digit.
  const first = Array.from(grapheme)[0] ?? '';
  return /[0-9]/.test(first) || first.toLocaleLowerCase() !== first.toLocaleUpperCase();
}

function isMark(point: string): boolean {
  if (MARK) return MARK.test(point);
  const code = point.codePointAt(0) ?? 0;
  return (code >= 0x0300 && code <= 0x036F) || code === 0x200D || code === 0xFE0E || code === 0xFE0F;
}

/** Built at run time, so an engine without Unicode property classes falls back instead of failing to load the file. */
function pattern(source: string, flags: string): RegExp | null {
  try { return new RegExp(source, flags); } catch { return null; }
}
