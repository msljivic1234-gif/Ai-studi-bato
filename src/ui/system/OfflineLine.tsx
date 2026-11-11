import { StyleSheet, View } from 'react-native';
import { Press } from '../Press';
import { T } from '../Text';
import { BALANCED_LINES, balancedStyle } from './balanced';
import { layout } from './layout';
import { OFFLINE_LINE } from './outcomeCopy';
import { Surface } from './Surface';
import { useLayoutClass } from './textScale';
import { sys } from './tokens';

/** Connection warning while previously loaded content stays usable. The warning
 * identifies stale data and offers refresh when available. Layout and material may
 * evolve; keep the live announcement, readable large text and duplicate-request
 * protection. Service errors and unknown writes have separate recovery states. */
export function OfflineLine({ onRefresh, hasLast = true, refreshing = false, testID }: {
  /** Reads again. Without it the line only tells. */
  onRefresh?: () => void;
  /** The screen has what it loaded before, and shows it (the default). False: there is nothing yet, and the line says only "Nema veze.". */
  hasLast?: boolean;
  /** A read is on its way: the word greys out and cannot be pressed twice. */
  refreshing?: boolean;
  testID?: string;
}) {
  const { stacked } = useLayoutClass();
  const word = OFFLINE_LINE.action;
  return <Surface kind="note" testID={testID} style={s.strip}>
    <View accessibilityLiveRegion="polite" style={[s.row, stacked && s.stacked]}>
      <T variant="note" accessibilityRole="alert" {...BALANCED_LINES} style={[s.sentence, stacked && s.sentenceStacked, balancedStyle]}>{hasLast ? OFFLINE_LINE.withLast : OFFLINE_LINE.bare}</T>
      {onRefresh ? <Press accessibilityRole="button" accessibilityLabel={word} accessibilityState={{ disabled: refreshing }} disabled={refreshing}
        onPress={onRefresh} haptic={refreshing ? 'none' : 'select'} scaleTo={sys.motion.scale.button} style={[s.action, stacked && s.actionStacked]}>
        <T variant="copy" tone={refreshing ? 'muted' : 'green'} style={s.word}>{word}</T>
      </Press> : null}
    </View>
  </Surface>;
}

const s = StyleSheet.create({
  // The note pads 12 over and under; the line is the touch (48) and the sentence centres in it, so the padding goes and the line is 48.
  strip: { paddingVertical: 0, paddingRight: 0 },
  row: { flexDirection: 'row', alignItems: 'center', minHeight: layout.touch, gap: sys.space.sm },
  stacked: { flexDirection: 'column', alignItems: 'flex-start', gap: 0, paddingVertical: sys.space.md },
  sentence: { flex: 1, minWidth: 0, paddingVertical: sys.space.sm },
  // Stacked, the row already pads 12 over and under, and the word is its own 48: the sentence needs no air of its own.
  sentenceStacked: { flex: 0, paddingVertical: 0 },
  action: { minWidth: layout.touch, minHeight: layout.touch, paddingHorizontal: sys.space.base, justifyContent: 'center', alignItems: 'center' },
  actionStacked: { paddingHorizontal: 0, alignItems: 'flex-start' },
  word: { fontWeight: '600' },
});
