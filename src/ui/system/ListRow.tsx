import { cloneElement, isValidElement, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { Press } from '../Press';
import { T } from '../Text';
import { FactArt } from './FactArt';
import { Glyph, type GlyphTone } from './Glyph';
import { layout, ruleWidth } from './layout';
import { useLayoutClass } from './textScale';
import { sys } from './tokens';

export type ListRowTone = 'default' | 'quiet' | 'danger';

export type ListRowProps = {
  /** A `FactArt` at 32 (slot 40), or a person's face (`faceSlot`, slot 56). One kind of slot on a screen. */
  leading?: ReactNode;
  /** 16/24; 600 when the row is touched, 400 when it only tells. A long one wraps. */
  title: string;
  /** The `note` line (14/20, grey). */
  subtitle?: string;
  /** The `meta` line (13/18, grey), under the subtitle: "18:19 · Otvara…". */
  meta?: string;
  /** A node at the end: a chip, a dot. The arrow is not this; the row draws it itself when it is touched. */
  trailing?: ReactNode;
  /** With it the row is a button: an arrow at the end, a press that gives, a touch of at least 48 dp. Without it the row only tells. */
  onPress?: () => void;
  /** `quiet`: the picture goes quiet (a row needed once in a long while). `danger`: the words are red ("Odjavi se"). */
  tone?: ListRowTone;
  /** The last row of a group: no divider under it. */
  last?: boolean;
  /** The slot is 56 wide, for a person's face. One indent per screen: a screen with pictures in its rows has them in all of them. */
  faceSlot?: boolean;
  /** Not now (the screen is working): the words and the picture go grey, nothing can be pressed. Added to the contract; optional. */
  disabled?: boolean;
  /**
   * The arrow at the end. A touched row has it, except a `danger` row: red words are a COMMAND ("Odjavi se"), not a way onward, and an
   * arrow would say it opens a screen. Say it either way when the default is wrong (a red row that does open a flow keeps its arrow
   * with `arrow`). Added to the contract; optional.
   */
  arrow?: boolean;
  /**
   * What is chosen or set, in grey at the end of the line before the caret ("Novi Sad", "Sve vrste"): a settings row says its answer
   * in its own line. It wraps and is never cut, and at a large text size it goes under the title instead of crushing it. A screen
   * reader hears it after the title. Added to the contract (F8b, at F2's request); optional.
   */
  value?: string;
  /** Status sentences belong below the title; short selected values can remain at the end. */
  valuePlacement?: 'end' | 'below';
  /**
   * The row opens something IN PLACE, under itself: `false` draws the caret down (closed), `true` draws it up (open), and the row tells a
   * screen reader which it is. Only a touched row can be expanded (it needs `onPress`; on a row that only tells it is ignored). `arrow={false}`
   * still takes the caret away. Added to the contract (F8b, at F2's request); optional, and a row without it is exactly the row it was.
   */
  expanded?: boolean;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  testID?: string;
};

/**
 * The one row of a list (composition spec 2026-10-07, N3). Ten rows of Profile, Settings, Home, Inbox and the Dogovor actions
 * were each drawn their own way, so the text began 0, 44, 46, 48, 52, 56 or 68 dp from the edge and a divider ran to a different
 * place on every screen. Here the text starts at one place (`layout.slot` + 12 = 52 with a picture, 68 with a face, 0 without),
 * and the divider under the row runs from there to the right edge: 1 dp, `line`, "inset".
 *
 * The row is 64 dp high with a second line or a picture and 56 without, 12 dp of padding above and below, 12 dp between its
 * parts. A row that is touched has the arrow; a row that only tells has neither the arrow nor a press (so nothing that looks like
 * a link goes nowhere), and neither does a red row, which is a command and not a way onward. At a large text size the node at the end goes under the words instead of crushing them. Nothing is cut
 * with an ellipsis, and the press gives on the `row` rung of the press ladder (0.985; the spec said 0.99, and
 * `one-token-source` allows no literal).
 *
 * A row that SETS something says its answer at its end (`value`: "Novi Sad", in grey, before the caret), and a row that opens something in
 * place says whether it is open (`expanded`: the caret down when closed, up when open, and the state spoken); a settings row that opens
 * its choices under itself is both ("Gde", "Novi Sad", caret down). Neither changes a row that does not say it.
 */
export function ListRow({ leading, title, subtitle, meta, trailing, onPress, tone = 'default', last = false, faceSlot = false, disabled = false, arrow,
  value, valuePlacement = 'end', expanded, accessibilityLabel, accessibilityHint, testID }: ListRowProps) {
  const { stacked } = useLayoutClass();
  const valueBelow = stacked || valuePlacement === 'below';
  const tap = onPress !== undefined;
  const slot = leading ? (faceSlot ? layout.slotFace : layout.slot) : 0;
  const start = slot ? slot + sys.space.md : 0;
  const minHeight = leading || subtitle || meta ? layout.rowMin : layout.rowMinPlain;
  const ink = disabled ? 'muted' : tone === 'danger' ? 'danger' : 'ink';
  const drawsArrow = tap && (arrow ?? tone !== 'danger');
  // Only a row that is touched can open something; the caret says which way it goes next.
  const expandable = tap && expanded !== undefined;
  const caret = expandable ? (expanded ? 'caret-up' : 'caret-down') : 'caret-right';

  const row = <>
    {slot ? <View style={[s.slot, { width: slot }]}>{dressed(leading, tone, disabled)}</View> : null}
    <View style={s.copy}>
      <T variant={tap ? 'bodyStrong' : 'body'} tone={ink}>{title}</T>
      {subtitle ? <T variant="note" tone="muted">{subtitle}</T> : null}
      {meta ? <T variant="meta" tone="muted">{meta}</T> : null}
      {valueBelow && value ? <T variant="note" tone="muted">{value}</T> : null}
      {stacked && trailing ? <View style={s.trailingStacked}>{trailing}</View> : null}
    </View>
    {!valueBelow && value ? <T variant="note" tone="muted" style={s.value}>{value}</T> : null}
    {!stacked && trailing ? <View style={s.trailing}>{trailing}</View> : null}
    {drawsArrow ? <Glyph name={caret} size={20} tone="muted" /> : null}
    {last ? null : <View pointerEvents="none" style={[s.rule, { left: start }]} />}
  </>;

  if (tap) return <Press testID={testID} accessibilityRole="button" accessibilityLabel={accessibilityLabel} accessibilityHint={accessibilityHint}
    accessibilityState={expandable ? { disabled, expanded } : { disabled }} disabled={disabled} onPress={onPress} haptic={disabled ? 'none' : 'select'}
    scaleTo={sys.motion.scale.row} style={[s.row, { minHeight }]}>{row}</Press>;
  // A row that only tells is one stop for a screen reader, unless it holds a node of its own that has to be reached.
  const grouped = !trailing;
  return <View testID={testID} accessible={grouped ? true : undefined}
    accessibilityLabel={accessibilityLabel ?? (grouped ? [title, value, subtitle, meta].filter(Boolean).join(', ') : undefined)}
    accessibilityHint={accessibilityHint} style={[s.row, { minHeight }]}>{row}</View>;
}

/** Control drawings and fact pictures follow the row's state; personal images are left untouched. */
function dressed(leading: ReactNode, tone: ListRowTone, disabled: boolean): ReactNode {
  if (!isValidElement<{ muted?: boolean; tone?: GlyphTone }>(leading)) return leading;
  if (leading.type === Glyph) {
    if (disabled || tone === 'quiet') return cloneElement(leading, { tone: 'muted' });
    return tone === 'danger' ? cloneElement(leading, { tone: 'danger' }) : leading;
  }
  if (leading.type !== FactArt) return leading;
  if (disabled || tone === 'quiet') return cloneElement(leading, { muted: true });
  if (tone === 'danger') return cloneElement(leading, { tone: 'danger' });
  return leading;
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: sys.space.md, paddingVertical: sys.space.md },
  slot: { alignItems: 'center', justifyContent: 'center' },
  copy: { flex: 1, minWidth: 0 },
  trailing: { flexShrink: 0 },
  // The answer of a row that sets something: at the end of the line, grey, wrapping inside the half of the row it may take, never cut.
  value: { flexShrink: 1, maxWidth: '50%', textAlign: 'right' },
  trailingStacked: { alignItems: 'flex-start', marginTop: sys.space.xs },
  // The divider is not a border: it begins where the words begin, and the last row of a group draws none.
  rule: { position: 'absolute', right: 0, bottom: 0, height: ruleWidth, backgroundColor: sys.color.line },
});
