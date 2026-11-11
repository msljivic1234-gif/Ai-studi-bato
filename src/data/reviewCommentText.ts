/**
 * The client half of the D12 text rules (supabase/proofs/d12/README_D12_CANDIDATE.md, "Text rules"; the server function is
 * `private.review_comment_input_v1`). It exists for FAST FEEDBACK only: the server is the authority, it REJECTS and never
 * normalises, and the screen compares the text the server echoes with the text this module prepared. So this module does what
 * the server asks of a client and nothing more: it composes the text to NFC, writes a line break as LF, trims both ends, says
 * "no comment" for a text that is nothing, and refuses what the server would refuse (too long, a character the server forbids,
 * a NUL or a lone surrogate that PostgreSQL would answer with an error before the function even runs).
 *
 * It deliberately does NOT mirror the contact-detail floor (`ru4b_public_floor_reason`): that rule lives in the database, may
 * change there, and its exact shape is never revealed to a person. A comment that holds a contact detail is refused by the
 * server and the person is told only that contact details are not shown publicly.
 *
 * PRIVACY (AGENTS 3.4): a comment is free text. Nothing in this file keeps, logs or sends it anywhere; the functions are pure.
 * The two range tables below are the server's closed classes, written as numbers (never as characters): a source file that
 * holds an invisible character, or the text of an escape, can be changed by a tool on its way to disk. `review-comment-text.test.ts`
 * compares them with the generator of the server candidate, so a drift in either place is a red test.
 */
export const REVIEW_COMMENT_MAX_CODE_POINTS = 500;
/** The reader of a profile's comments (`rpc_list_review_comments_v1`) pages 20 at a time by default and 50 at most. */
export const REVIEW_COMMENT_PAGE_SIZE = 20;
export const REVIEW_COMMENT_PAGE_MAX = 50;

type Range = readonly [number, number];

/**
 * "No comment": a text made ONLY of these means nothing is stored and nothing is an error. The ASCII white space, U+0085, the
 * Unicode separators, and the characters that render as nothing but are tolerated inside a sentence (soft hyphen, combining
 * grapheme joiner, braille blank, the two joiners and all sixteen variation selectors). Equal to BLANK_RANGES of build_d12.py.
 */
export const REVIEW_COMMENT_BLANK_RANGES: readonly Range[] = [
  [0x0009, 0x000D], [0x0020, 0x0020], [0x0085, 0x0085], [0x00A0, 0x00A0], [0x00AD, 0x00AD], [0x034F, 0x034F], [0x1680, 0x1680],
  [0x2000, 0x200A], [0x200C, 0x200D], [0x2028, 0x2029], [0x202F, 0x202F], [0x205F, 0x205F], [0x2800, 0x2800], [0x3000, 0x3000],
  [0xFE00, 0xFE0F],
];

/**
 * Refused anywhere in a comment: the controls (except the line feed), the line and paragraph separators, and every default-ignorable
 * code point of Unicode 17.0 except the groups tolerated inside a sentence. Equal to FORBIDDEN_RANGES of build_d12.py plus U+0000,
 * which cannot be stored in a PostgreSQL text and which the transport refuses (22P05) before the function runs.
 */
export const REVIEW_COMMENT_FORBIDDEN_RANGES: readonly Range[] = [
  [0x0000, 0x0009], [0x000B, 0x001F], [0x007F, 0x009F], [0x061C, 0x061C], [0x115F, 0x1160], [0x17B4, 0x17B5], [0x180B, 0x180F],
  [0x200B, 0x200B], [0x200E, 0x200F], [0x2028, 0x202E], [0x2060, 0x206F], [0x3164, 0x3164], [0xFEFF, 0xFEFF], [0xFFA0, 0xFFA0],
  [0xFFF0, 0xFFFB], [0x13430, 0x1343F], [0x1BCA0, 0x1BCA3], [0x1D173, 0x1D17A], [0xE0000, 0xE0FFF],
];

const within = (code: number, ranges: readonly Range[]) => ranges.some(([from, to]) => code >= from && code <= to);
const isSurrogate = (code: number) => code >= 0xD800 && code <= 0xDFFF;

/** A line break written the way the server allows it (LF), composed to NFC, trimmed: the text as it will be sent. */
function canonical(value: string): string {
  return value.replace(/\r\n?/g, '\n').normalize('NFC').trim();
}

/** The number of code points the server counts (`char_length`) in the text as it will be sent; an emoji is one. */
export function reviewCommentLength(value: string): number {
  return Array.from(canonical(value)).length;
}

export type ReviewCommentRefusal = 'REVIEW_COMMENT_INVALID' | 'REVIEW_COMMENT_TOO_LONG';
/** What a typed comment becomes: nothing to send, the exact text to send, or the reason it cannot be sent. */
export type PreparedReviewComment =
  | { kind: 'none' }
  | { kind: 'text'; text: string }
  | { kind: 'invalid'; code: ReviewCommentRefusal };

/**
 * The order is the server's: absent or blank first, then the length, then the characters. A value that is not text is refused;
 * `null` and `undefined` are "no comment".
 */
export function prepareReviewComment(value: unknown): PreparedReviewComment {
  if (value === undefined || value === null) return { kind: 'none' };
  if (typeof value !== 'string') return { kind: 'invalid', code: 'REVIEW_COMMENT_INVALID' };
  const text = canonical(value);
  let count = 0, blank = true, forbidden = false;
  // By code point: a lone surrogate comes out of the iterator as itself, and a pair as one point above U+FFFF.
  for (const point of text) {
    const code = point.codePointAt(0) as number;
    count += 1;
    if (blank && !within(code, REVIEW_COMMENT_BLANK_RANGES)) blank = false;
    if (!forbidden && (isSurrogate(code) || within(code, REVIEW_COMMENT_FORBIDDEN_RANGES))) forbidden = true;
  }
  if (blank) return { kind: 'none' };
  if (count > REVIEW_COMMENT_MAX_CODE_POINTS) return { kind: 'invalid', code: 'REVIEW_COMMENT_TOO_LONG' };
  if (forbidden) return { kind: 'invalid', code: 'REVIEW_COMMENT_INVALID' };
  return { kind: 'text', text };
}

/**
 * What a person reads for every outcome of a comment, in the "ti" voice without grammatical gender: what happened, and what to
 * do. No technical code is ever shown, no word "server", and the contact-detail refusal says only that contact details are not
 * shown publicly (never which rule caught the text).
 */
export const REVIEW_COMMENT_MESSAGES = {
  REVIEW_COMMENT_INVALID: 'Komentar sadrži znak koji ne može da se sačuva. Ukloni neobične znakove ili upiši komentar ponovo.',
  REVIEW_COMMENT_TOO_LONG: `Komentar može imati najviše ${REVIEW_COMMENT_MAX_CODE_POINTS} znakova. Skrati ga pa pošalji ponovo.`,
  REVIEW_COMMENT_CONTACT_NOT_PUBLIC: 'Kontakt podaci se ne prikazuju javno. Ukloni ih iz komentara pa pošalji ponovo.',
  REVIEW_COMMENT_MISMATCH: 'Komentar nije sačuvan onako kako je napisan. Proveri sačuvanu ocenu.',
  REVIEW_COMMENT_UNAVAILABLE: 'Komentari još nisu dostupni. Pošalji ocenu bez komentara.',
  REQUEST_ID_REUSED: 'Ovaj zahtev je već iskorišćen za drugu ocenu ili komentar. Proveri sačuvanu ocenu.',
  REVIEW_ALREADY_SUBMITTED: 'Ovaj Dogovor je već ocenjen, a ocena se ne menja. Proveri sačuvanu ocenu.',
  REVIEW_NOT_COMPLETED: 'Ocena je dostupna tek kad se Dogovor završi. Vrati se kasnije.',
  REVIEW_NOT_ALLOWED: 'Možeš oceniti samo drugu stranu svog Dogovora. Vrati se na Dogovor.',
  AUTH_REQUIRED: 'Prijavi se da nastaviš.',
} as const;
export type ReviewCommentMessageCode = keyof typeof REVIEW_COMMENT_MESSAGES;
