import { StyleSheet, View } from 'react-native';
import { T } from '../Text';
import { InfoButton } from '../system/InfoButton';
import { layout } from '../system/layout';
import { sys } from '../system/tokens';

/**
 * The title of a part of a screen with its explanation one tap away: the name in the `heading` type (as a `Section` draws it) and, right after
 * it, the small "ⓘ" that opens what the part means in a sheet (owner, 8 Oct 2026: too much text; the analysis rule J5). The screen keeps what is
 * so; WHY, who sees it and what a word means is behind the mark. It adds no margin of its own: the caller spaces it from what it names.
 */
export function InfoTitle({ title, infoTitle, info, testID }: { title: string; infoTitle?: string; info: readonly string[]; testID?: string }) {
  return <View style={s.row}>
    <T variant="heading" accessibilityRole="header" style={s.title}>{title}</T>
    <InfoButton testID={testID} title={infoTitle ?? title} lines={info} />
  </View>;
}

/**
 * The explanation of a whole screen, in the bar's right place: the mark centred in the 48 dp column every control of the bar stands in, so it
 * lines up with the arrow and the other bars' controls (`ScreenChrome` takes at most one control on the right).
 */
export function HeaderInfo({ title, info, testID }: { title: string; info: readonly string[]; testID?: string }) {
  return <View style={s.slot}><InfoButton testID={testID} title={title} lines={info} /></View>;
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: sys.space.sm },
  title: { flexShrink: 1, color: sys.color.ink },
  slot: { width: layout.touch, height: layout.touch, alignItems: 'center', justifyContent: 'center' },
});
