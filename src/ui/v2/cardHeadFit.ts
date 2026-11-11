/** Advance widths of Inter Bold, in thousandths of an em (`hmtx` through `cmap`), for the glyphs a Serbian title or price uses. */
export const INTER_BOLD_ADVANCE: Readonly<Record<string, number>> = {
  a: 581, b: 630, c: 588, d: 630, e: 596, f: 398, g: 632, h: 623, i: 271, j: 271, k: 580, l: 271, m: 913, n: 623, o: 613, p: 630,
  q: 630, r: 407, s: 560, t: 366, u: 623, v: 600, w: 850, x: 580, y: 602, z: 573, č: 588, ć: 588, š: 560, đ: 630, ž: 573,
  A: 747, B: 662, C: 740, D: 722, E: 607, F: 587, G: 750, H: 747, I: 281, J: 584, K: 719, L: 565, M: 932, N: 762, O: 771, P: 648,
  Q: 777, R: 657, S: 655, T: 667, U: 732, V: 747, W: 1038, X: 738, Y: 731, Z: 664, Č: 740, Ć: 740, Š: 655, Đ: 760, Ž: 664,
  '0': 674, '1': 431, '2': 630, '3': 646, '4': 676, '5': 622, '6': 649, '7': 582, '8': 651, '9': 649,
  ' ': 237, '.': 334, ',': 334, '-': 468, '–': 500, '/': 388, '(': 377, ')': 377, ':': 334, ';': 343, '!': 338, '?': 560, "'": 339,
  '"': 552, '+': 679, '&': 672, '%': 1016, '²': 460, '³': 472, '·': 334, '→': 954,
};
/** The widest glyph of the table (W): what a character that is not in it is taken to be. */
const WIDEST = Math.max(...Object.values(INTER_BOLD_ADVANCE));
/** The widest digit (4): every digit of a price, which is set in tabular figures. */
const WIDEST_DIGIT = Math.max(...'0123456789'.split('').map(digit => INTER_BOLD_ADVANCE[digit]));

/** Shared title size; current cards and calendar steps retain the bundled-font measurement below. */
export const TITLE_SIZE = 20;

/** The width of `text` in dp at `size` dp (already multiplied by the text scale). */
export function textWidth(text: string, size: number, tabular = false): number {
  let units = 0;
  for (const character of text) {
    units += tabular && character >= '0' && character <= '9' ? WIDEST_DIGIT : INTER_BOLD_ADVANCE[character] ?? WIDEST;
  }
  return (units / 1000) * size;
}
