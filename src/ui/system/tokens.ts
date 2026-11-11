import { colorTokens } from '../../theme/colorTokens';
import { Platform, type TextStyle, type ViewStyle } from 'react-native';
import { elevation, radius, space, touch, type } from '../../theme/tokens';
import { withInter } from '../interFont';
import { layout, ruleWidth } from './layout';
import { motionTokens } from './motionTokens';

/**
 * `sys` is the one surface screens and components read for colour, type, space, corners, touch and motion (2026-09-24:
 * the `v2` token file with its second motion scale is deleted, and the screens moved that day no longer read
 * `theme/tokens` or `aiFirst`; the sign-in screens and the AI conversation still do, as views of the same values). It
 * may build on the theme scale here, inside the system. A nested corner is geometry, not a value, so it is exported
 * beside `sys`.
 */
export { nested } from '../../theme/tokens';

/**
 * USKOČI Premium White foundation, 2026-10-18. White reading canvas;
 * ink for content and money, green for the primary action/confirmed success,
 * warm orange for attention. Emerald location (owner, 8 Oct 2026), blue for the AI, coral people and gold
 * time belong to selective artwork, not invented status. Small orange labels use
 * the contrast-safe orangeInk; orange surfaces use dark labels. Neutral wells are
 * controls, not a requirement to wrap every fact in another card. Entry artwork's
 * own palette remains scoped. Active authority: docs/implementation/design-system/PREMIUM_WHITE_CANON.md; historical compositions are evidence only.
 */
export const sys = {
  color: colorTokens.color,
  /** Semantic pairs are content roles, not inferred business status. Always show a label or icon too. */
  status: colorTokens.status,
  navigation: colorTokens.navigation,
  /** Optical defaults for controls. Other positive sizes may serve a verified composition. */
  icon: { size: { inline: 16, row: 20, chrome: 24, emphasis: 32, navigation: 24 } },
  /** Surface density depends on content and role; a task preview is not a form or a chat message. */
  surface: {
    padding: { compact: space.md, comfortable: space.base, spacious: space.xl },
    mediaAspectRatio: 1.6,
  },
  /** White conversations; speaker alignment, a quiet edge and the solid own-message fill establish hierarchy. */
  conversation: colorTokens.conversation,
  /**
   * Public map geography: colors only, independent from the interactive brand markers and their states.
   * Owner 2026-10-07 ("obojenije, da se vide lepo ulice"): a warm light ground so white streets read against it, firmer
   * street edges, light-yellow main streets, greener parks and bluer water. Supersedes the near-white palette (U07 default).
   */
  map: colorTokens.map,
  /**
   * Illustration-only tones, distinct from the semantic fact-picture palette in
   * `sys.color.art`. Retained as a shared palette role, never for text or controls.
   */
  art: colorTokens.illustration.home,
  /** Picker illustration shades share the pure color owner; never use them for control text. */
  pictogram: colorTokens.illustration.pictogram,
  /** Named corner roles evolve with the canon. Small marks, controls, comparison cards and heroes
   * need different proportions. A capsule is geometric; nested corners follow their parent. */
  radius: { ...radius, check: 6 },
  space,
  type: {
    ...type,
    /** Money and counts use tabular figures so columns and cards line up. */
    price: { fontSize: 23, lineHeight: 28, fontWeight: '700', letterSpacing: -0.7, fontVariant: ['tabular-nums'] } as TextStyle,
    cardTitle: { fontSize: 20, lineHeight: 25, fontWeight: '600', letterSpacing: -0.6 } as TextStyle,
    /** The title of a card that is showing itself small, inside a list of other cards. */
    cardTitleCompact: { fontSize: 16, lineHeight: 21, fontWeight: '600', letterSpacing: -0.3 } as TextStyle,
    /** Prominent budget/offer, with enough leading for enlarged system text. */
    priceHero: { fontSize: 32, lineHeight: 38, fontWeight: '700', letterSpacing: -0.7, fontVariant: ['tabular-nums'] } as TextStyle,
    /** An amount in a detail section or receipt. */
    priceLarge: { fontSize: 24, lineHeight: 30, fontWeight: '700', letterSpacing: -0.7, fontVariant: ['tabular-nums'] } as TextStyle,
    /** Money inside a row that is compared with other rows. */
    priceSmall: { fontSize: 20, lineHeight: 26, fontWeight: '700', letterSpacing: -0.5, fontVariant: ['tabular-nums'] } as TextStyle,
    /** Money on one line with a compact title (`cardTitleCompact`), as in a place's rows on the map: the same size. */
    priceRow: { fontSize: 16, lineHeight: 21, fontWeight: '700', fontVariant: ['tabular-nums'] } as TextStyle,
    /** The letter standing in for a photo, on a 96px avatar. */
    monogram: { fontSize: 30, lineHeight: 36, fontWeight: '700' } as TextStyle,
    /**
     * The answer in voice mode, read at a glance from arm's length while the thread's own `speech` (16/26) is read up
     * close: the same voice, a step larger.
     */
    speechLarge: { fontSize: 20, lineHeight: 30, fontWeight: '500' } as TextStyle,
  },
  /**
   * Shared motion defaults, in milliseconds. The current design direction allows
   * purposeful motion that explains an interaction, keeps reading comfortable and
   * responds promptly. These values are a starting point, not a frozen composition.
   *
   * Preserve real data throughout a transition: delivery status, player progress,
   * money and counts must still describe the authoritative state. Animation is not
   * evidence that an operation succeeded, and must not delay an available action.
   *
   * Prefer native-driven transforms and opacity where they fit. Choose another
   * supported technique when the interaction needs it, and verify its native
   * lifecycle and list performance; retain message drafts and reading positions.
   * Avoid replaying entrances on ordinary refreshes. Pause decorative loops when
   * their screen is unfocused, the app is backgrounded or reduced motion is on.
   *
   * Read the live preference from `ui/system/motion`: under reduced motion settle
   * immediately, stop loops and keep state changes readable. Haptics remain separate
   * and use `ui/system/haptics` for consistent feedback and rate limiting.
   */
  motion: motionTokens,
  touch,
  elevation,
  /**
   * Shared spacing and reading-width defaults. Extend named roles when a card family needs a different composition;
   * preserve touch targets, large-text reflow and safe areas rather than an immutable spacing list.
   */
  layout,
  /** Default divider width. Components may use a named optical variant when contrast and density justify it. */
  rule: { width: ruleWidth, color: colorTokens.color.line },
} as const;

/** Flat reading panels retain their original edge/padding. Navigable marketplace items explicitly opt into raisedItem. */
export const card: ViewStyle = { backgroundColor: sys.color.surface, borderRadius: sys.radius.card, borderWidth: 1,
  borderColor: sys.color.cardLine, padding: 20 };
export const cardCompact: ViewStyle = { ...card, borderRadius: sys.radius.cardCompact, padding: 16 };
/** boxShadow needs Android 9+; minSdk is 24, so the phones before it get an elevation instead. */
const NO_BOX_SHADOW = Platform?.OS === 'android' && typeof Platform?.Version === 'number' && Platform.Version < 28;
/** Targeted lift for navigable marketplace items (owner material direction). No geometry or animation is imposed. */
export const raisedItem: ViewStyle = {
  backgroundColor: sys.color.surface, borderWidth: 1, borderColor: sys.color.line,
  ...(NO_BOX_SHADOW ? { elevation: 3 }
    : { boxShadow: '0px 2px 4px rgba(18, 38, 28, 0.04), 0px 8px 24px rgba(18, 38, 28, 0.07)' }),
};
/** Soft white cards on the recessed profile canvas, Figma 2:126. */
export const profileLift: ViewStyle = NO_BOX_SHADOW ? { elevation: 2 }
  : { boxShadow: '0px 6px 22px rgba(10, 31, 20, 0.09)' };
/** Neutral lift for floating layers; marketplace rows opt into the separate raisedItem material. */
export const floating: ViewStyle = NO_BOX_SHADOW ? { elevation: 1 }
  : { boxShadow: '0px 5px 18px rgba(0, 0, 0, 0.063), 0px 1px 2px rgba(0, 0, 0, 0.027)' };
/** Tactile map controls. Figma MaterialFilterChip 93:18; inset shadows require Android 10+. */
export const materialControl = {
  raised: (NO_BOX_SHADOW ? { elevation: 2 }
    : { boxShadow: '0px 2px 3px rgba(0, 0, 0, 0.14), 0px 5px 12px rgba(0, 0, 0, 0.04)' }) as ViewStyle,
  inset: (Platform?.OS === 'android' && Number(Platform.Version) < 29 ? { elevation: 0, boxShadow: [] }
    : { boxShadow: 'inset 0px 2px 3px rgba(0, 0, 0, 0.17), inset 0px -1px 1px rgba(255, 255, 255, 0.9)' }) as ViewStyle,
} as const;
/**
 * The lift of a sheet over the map, in the system's shadow ink (review r3b: it was spelled in each sheet). A `docked`
 * sheet rises from the bottom edge (the Zadaci list), so its shadow falls upwards; a `detached` one floats free above
 * it (the PeekSheet with a pin's card), so its shadow falls below, deeper than `floating` because it covers more.
 */
export const sheetLift = {
  docked: (NO_BOX_SHADOW ? { elevation: 6 } : { boxShadow: '0px -2px 12px rgba(0, 0, 0, 0.08)' }) as ViewStyle,
  detached: (NO_BOX_SHADOW ? { elevation: 6 }
    : { boxShadow: '0px 10px 28px rgba(0, 0, 0, 0.14), 0px 2px 6px rgba(0, 0, 0, 0.06)' }) as ViewStyle,
} as const;
/** The one text field: 52px high, control corners, the strong hairline, body text. A multiline field adds its height. */
export const fieldBox = { minHeight: 52, borderWidth: 1, borderColor: sys.color.lineStrong, borderRadius: sys.radius.control,
  paddingHorizontal: 14, paddingVertical: 12, backgroundColor: sys.color.surface } satisfies ViewStyle;
/** Without `cursor`: expo's react-native-web typings widen TextStyle.cursor to `string`, which a Press (a ViewStyle) refuses; no field sets a cursor. */
export const field: Omit<TextStyle, 'cursor'> = { ...fieldBox, ...withInter(sys.type.body), color: sys.color.ink };
/** A note inside a screen or a card: a flat tint, no border, no shadow. */
export const inset: ViewStyle = { borderRadius: sys.radius.control, padding: 14 };
/**
 * A chosen pill chip (one look over the map and in the search panel): a neutral well with a 2 px
 * green edge, and the caller writes its label in green beside a green tick. This is a compatible default,
 * not the only permitted selection material. A free chip has a 1 px edge, so a chosen one takes 1 px off its side padding
 * (`CHIP_CHOSEN_INSET`) and its words do not move.
 */
export const chipChosen: ViewStyle = { backgroundColor: sys.color.greenSoft, borderWidth: 2, borderColor: sys.color.green };
export const CHIP_CHOSEN_INSET = 1;

/**
 * Deep-green command material retained for existing callers. It is one supported action treatment;
 * V2Action also offers an accent primary with readable dark ink for publication or an important next step.
 * Pass as `style` to a V2Action; its label follows this material using `onGreen`.
 */
export const brandAction: ViewStyle = {
  backgroundColor: sys.color.green,
  borderWidth: 1,
  borderColor: sys.color.greenEdge,
  minHeight: 54,
  borderRadius: sys.radius.primary,
  shadowColor: sys.color.ink,
  shadowOffset: { width: 0, height: 3 },
  shadowOpacity: 0.16,
  shadowRadius: 5,
  elevation: 4,
};

/**
 * 48px icon control in a quiet well (V5 head icon button). The screen chrome no longer draws it: its arrow, X, profile,
 * bell and "···" are `ChromeIconButton` (ui/system/ScreenChrome, 2026-09-24). The AI conversation's options button is
 * the one place left that still uses this token, until that bar moves onto the chrome.
 */
export const iconButton: ViewStyle = { width: 48, height: 48, borderRadius: sys.radius.chip, backgroundColor: sys.color.iconWell, alignItems: 'center', justifyContent: 'center' };
/**
 * The 48px well a menu row's picture sits in (the "···" sheet). It is a picture box, not a button, and has its own token
 * so that redrawing the icon button never changes the menu.
 */
export const pictureWell: ViewStyle = { width: 48, height: 48, borderRadius: sys.radius.chip, backgroundColor: sys.color.iconWell, alignItems: 'center', justifyContent: 'center' };
