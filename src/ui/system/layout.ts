import { touch } from '../../theme/tokens';

/** Shared layout defaults for the Premium White canon.
 * Keep related alignment on this scale; introduce a named responsive/content role rather
 * than enforcing one historical composition across cards, chat, sheets and map controls.
 * Touch sizes, readable large text, safe areas and bounded tablet width are behavioral safeguards.
 * The pure base touch scale keeps this module cycle-free. */
export const layout = {
  /** Default page gutter; chat and floating map controls have their own named roles. */
  gutter: 20,
  /** What floats over the map keeps 16 from the edge of the screen, so the map shows around it. */
  mapInset: 16,
  /** The conversation is the one screen with its own edges: a list of messages 16 from the edge, the composer 12. */
  chatList: 16,
  chatComposer: 12,
  /** Between one section and the next (a `Section` has no margin of its own: the screen spaces them). */
  section: 24,
  /** From a section's title to what it holds, and from one card to the next. */
  group: 12,
  /** Inside a record: the padding of a card that is touched. */
  card: 16,
  /** Between one zone of a screen and the next, and under the last thing in a scroll. */
  zone: 32,
  /** The least a control may be to touch: 48 dp. */
  touch: touch.min,
  /** The height of a row with a second line or a picture, and of one with neither. */
  rowMin: 64,
  rowMinPlain: 56,
  /** The width of the picture slot at the start of a row, and of a slot that holds a person's face. */
  slot: 40,
  slotFace: 56,
  /** A screen on a tablet is a column this wide, centred. */
  maxWidth: 640,
} as const;

/**
 * Default divider width. Components may use a native hairline or a stronger semantic edge
 * when their contrast and purpose support it; this is a shared default, not a visual freeze.
 */
export const ruleWidth = 1;
