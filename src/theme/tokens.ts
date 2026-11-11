import { colorTokens } from './colorTokens';

/**
 * USKOČI — base scales and compatibility color names.
 * Screens consume ui/system/tokens. Premium White canon, 2026-10-18: a white canvas, semantic tints and content-specific materials.
 * Legacy illustration colors below are not a separate screen design authority.
 * Text/background pairs must pass WCAG AA (4.5:1); current measurements belong to the R12 report.
 */

/** Compatibility names only. No independent screen palette; illustration shades remain named separately. */
export const palette = {
  ...colorTokens.illustration.legacy,
  ground: colorTokens.color.ground, surface: colorTokens.color.surface, raised: colorTokens.color.surface,
  orange: colorTokens.color.orange, orangeInk: colorTokens.color.orangeInk, orangeSoft: colorTokens.color.orangeSoft, onOrange: colorTokens.color.onOrange,
  ink: colorTokens.color.ink, inkMuted: colorTokens.color.muted, onDark: colorTokens.color.onDark,
  success: colorTokens.color.success, successBg: colorTokens.color.successSoft,
  danger: colorTokens.color.danger, dangerBg: colorTokens.color.dangerSoft,
  warn: colorTokens.color.warn, warnBg: colorTokens.color.warnSoft,
  info: colorTokens.color.info, infoBg: colorTokens.color.infoSoft,
} as const;

/** Shared 4/8 rhythm. Add named optical/content variants here when a verified composition needs them. */
export const space = {
  xs: 4,
  sm: 8,
  md: 12,
  base: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
  huge: 48,
} as const;

/** Named corner roles. Values are current defaults, not immutable screenshots.
 * Compact comparison items, controls and media may differ; keep changes centralized.
 * Circles/capsules use pill and inset geometry uses nested(). */
export const radius = {
  /** Sitna oznaka: tačka, brojač, mali badž. */
  badge: 12,
  /** Čip, ikona u ležištu 36–44px, mali kontrol. */
  chip: 12,
  /** Polje, red liste, tiha napomena, dugme koje nije glavno. */
  control: 12,
  /** Glavna akcija na ekranu: isti ćošak kao polje i dugme pored nje. */
  primary: 12,
  /** Zbijena kartica za poređenje u listi. */
  cardCompact: 20,
  /** Standardna kartica sadržaja. */
  card: 24,
  /** Plahta odozdo i velika površina: jedan korak iznad kartice. */
  sheet: 28,
  /** An image frame and a larger brand/intent composition. */
  media: 20,
  hero: 28,
  /** Sve što je krug ili kapsula. */
  pill: 999,
} as const;

/** Ugnežden ćošak: unutrašnji je spoljašnji minus razmak, inače se linije ne prate. */
export const nested = (outer: number, pad: number) => Math.max(0, outer - pad);

/**
 * Tipografija. Minimum 12px za sve što nosi značenje —
 * referenca je imala tekst od 7px, uključujući labelu na dugmetu.
 */
export const type = {
  /** AI intro and other one-line statements that carry a whole screen. */
  display: { fontSize: 32, lineHeight: 37, fontWeight: '600' as const, letterSpacing: -1.15 },
  /** The real title of a detail screen (Task, Dogovor, profile name). */
  hero: { fontSize: 30, lineHeight: 35, fontWeight: '600' as const, letterSpacing: -1 },
  /** Screen title in the top bar. */
  title: { fontSize: 21, lineHeight: 26, fontWeight: '600' as const, letterSpacing: -0.55 },
  /** Section title inside a screen. */
  heading: { fontSize: 18, lineHeight: 24, fontWeight: '600' as const, letterSpacing: -0.3 },
  // Regular reading text; semibold actions/headings and tabular amounts carry hierarchy (owner takeover, 2026-10-02).
  body: { fontSize: 16, lineHeight: 24, fontWeight: '400' as const },
  bodyStrong: { fontSize: 16, lineHeight: 24, fontWeight: '600' as const },
  /** A sentence of quiet copy under a title. */
  copy: { fontSize: 15, lineHeight: 22, fontWeight: '400' as const },
  /** Facts inside cards and rows: where, when, a hint. Never below this for a sentence. */
  note: { fontSize: 14, lineHeight: 20, fontWeight: '500' as const },
  /** One- or two-word labels only. */
  meta: { fontSize: 13, lineHeight: 18, fontWeight: '500' as const },
  label: { fontSize: 12, lineHeight: 16, fontWeight: '600' as const, letterSpacing: 0.6 },
  action: { fontSize: 16, lineHeight: 22, fontWeight: '600' as const, letterSpacing: -0.1 },
  /** The name of what a screen is about: a person, an agreement, a profile. */
  pageTitle: { fontSize: 28, lineHeight: 33, fontWeight: '600' as const, letterSpacing: -0.8 },
  /** A sentence said in the conversation. Same size as body, looser leading, because it is read as speech. */
  speech: { fontSize: 16, lineHeight: 26, fontWeight: '400' as const },
  /** A tab or segment label. */
  tab: { fontSize: 14, lineHeight: 20, fontWeight: '600' as const },
  /** Persistent navigation labels stay quieter than the content and still follow the system text size. */
  navLabel: { fontSize: 12, lineHeight: 17, fontWeight: '500' as const },
} as const;

/**
 * Pokret više nije ovde: jedina lestvica pokreta je `sys.motion` (src/ui/system/tokens.ts, 2026-09-24), sa kategorijama za različite interakcije.
 * Stvarne činjenice ostaju tačne tokom prelaza; živi Reduce Motion izvor je src/ui/system/motion.ts.
 */

/** Minimalna dodirna meta. Ako je vizuelno manje, širi se hitSlop-om. */
export const touch = {
  min: 48,
  gap: 8,
} as const;

export const elevation = {
  /** A card resting on a white screen: definition without a grey smear (V4.9 card shadow). */
  soft: {
    shadowColor: colorTokens.shadow,
    shadowOpacity: 0.04,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 6 },
    elevation: 1,
  },
  card: {
    shadowColor: colorTokens.shadow,
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  raised: {
    shadowColor: colorTokens.shadow,
    shadowOpacity: 0.12,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
} as const;

export type Palette = typeof palette;
