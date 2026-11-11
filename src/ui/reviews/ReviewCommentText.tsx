import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Press } from '../Press';
import { T } from '../Text';
import { sys } from '../system/tokens';

/** How many lines a long comment shows before the person opens it. */
export const REVIEW_COMMENT_CLIP_LINES = 5;
/** More characters than this, or this many line breaks, and the text is clipped and offers to be opened. */
const LONG_CHARACTERS = 200;
const LONG_BREAKS = REVIEW_COMMENT_CLIP_LINES;

/**
 * Whether a comment needs the clip and its control. The size of a line is only known after layout, so this is a rule of thumb
 * chosen to be safe both ways: a text at or under it is never clipped (so nothing is ever hidden without a control), and the
 * control it adds for a comment that would have fit in the five lines is harmless (it opens to the same words).
 */
export function isLongComment(text: string): boolean {
  let breaks = 0;
  for (let at = text.indexOf('\n'); at !== -1; at = text.indexOf('\n', at + 1)) breaks += 1;
  return text.length > LONG_CHARACTERS || breaks >= LONG_BREAKS;
}

/**
 * A comment as it is drawn, wherever it is drawn (the receipt of the review and the comments of a profile): PLAIN text. It is
 * never interpreted (no link, no markdown, no data detection, not selectable), exactly the characters the server stored, clipped
 * to a bounded height when long with an honest control that opens and closes it. It is the one place that decides how a comment
 * looks, so a comment cannot become something else on one screen. Nothing here keeps or logs the text.
 */
export function ReviewCommentText({ text }: { text: string }) {
  const long = isLongComment(text);
  const [open, setOpen] = useState(false);
  const label = open ? 'Prikaži manje' : 'Prikaži ceo komentar';
  return <View style={s.wrap}>
    <T variant="body" selectable={false} dataDetectorType="none" numberOfLines={long && !open ? REVIEW_COMMENT_CLIP_LINES : undefined}
      style={s.text}>{text}</T>
    {long ? <Press accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ expanded: open }} haptic="select"
      scaleTo={1} onPress={() => setOpen(value => !value)} style={s.toggle}>
      <T variant="note" style={s.action}>{label}</T>
    </Press> : null}
  </View>;
}

const s = StyleSheet.create({
  wrap: { gap: sys.space.xs },
  text: { color: sys.color.ink },
  // 48 high: the one control of a long comment is touched with a thumb in a scrolling list.
  toggle: { minHeight: 48, justifyContent: 'center', alignSelf: 'flex-start' },
  action: { color: sys.color.green, fontWeight: '600' },
});
