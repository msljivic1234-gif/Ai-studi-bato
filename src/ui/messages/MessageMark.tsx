import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { sys } from '../system/tokens';
import { MARK_WORDS, type MarkKind } from './threadModel';

/**
 * The ONE small mark by a message I sent (proposal R1, 2026-10-07): "jedan znak uz svaku tvoju poruku, bez sata i bez teksta".
 * It is a status mark (where a thing STANDS), drawn on the charcoal bubble of my own message:
 *
 *   sent      one check          the server holds the message
 *   seen      two checks, mint   drawn ONLY when the read says `procitano === true` (today the server returns null, so this state
 *                                is built and tested but dormant)
 *   pending   a quiet dot        the send is on its way
 *   unconfirmed  the same dot    the outcome is not known; the bubble's own line below says so and offers "Proveri"
 *
 * The shape, not the colour, tells sent from seen (two checks against one). It carries no clock and no text; its spoken name is
 * the state, as one word (`MARK_WORDS`). A mark that can still change (the send of this phone: pending to sent) is `live`, so
 * the change is announced politely; the marks of a whole history are not, or opening a thread would read them all out. A failed
 * send draws no mark: the bubble itself goes red and says so.
 */
export const MARK_WIDTH = 18;
export const MARK_HEIGHT = 12;
/** Seen is mint on the charcoal bubble (proposal R1). No token carries it yet; it is the only colour spelled here. */
export const MARK_SEEN_ON_DARK = '#8FE3C0';
const QUIET_OPACITY = 0.65;

/** A check, `dx` to the right: the paths of one and of two checks are the same stroke, the second 5.4 further on. */
const at = (value: number) => Number(value.toFixed(1));
const check = (dx: number) => `M${at(1.4 + dx)} 6.4 L${at(4.6 + dx)} 9.6 L${at(10.6 + dx)} 2.4`;
export const MARK_PATHS = { first: check(0), second: check(5.4) } as const;

export function MessageMark({ kind, live = false, style, testID = 'message-mark' }: { kind: MarkKind; live?: boolean; style?: StyleProp<ViewStyle>; testID?: string }) {
  if (kind === 'failed') return null;
  const seen = kind === 'seen';
  const color = seen ? MARK_SEEN_ON_DARK : sys.conversation.onUser;
  const opacity = seen ? 1 : QUIET_OPACITY;
  return <View testID={testID} accessible accessibilityRole="image" accessibilityLabel={MARK_WORDS[kind]} accessibilityLiveRegion={live ? 'polite' : 'none'}
    style={[s.mark, style]}>
    <Svg width={MARK_WIDTH} height={MARK_HEIGHT} viewBox={`0 0 ${MARK_WIDTH} ${MARK_HEIGHT}`}
      accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {kind === 'pending' || kind === 'unconfirmed'
        ? <Circle cx={13} cy={6} r={2} fill={color} fillOpacity={opacity} />
        : <>
          {seen ? <Path d={MARK_PATHS.first} fill="none" stroke={color} strokeOpacity={opacity} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" /> : null}
          <Path d={MARK_PATHS.second} fill="none" stroke={color} strokeOpacity={opacity} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
        </>}
    </Svg>
  </View>;
}

const s = StyleSheet.create({
  mark: { width: MARK_WIDTH, height: MARK_HEIGHT, alignSelf: 'flex-end', justifyContent: 'center' },
});
