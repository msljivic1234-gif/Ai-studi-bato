import { useCallback, useState, type ReactNode } from 'react';
import { StyleSheet, View, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import { ruleWidth } from '../system/layout';
import { sys } from '../system/tokens';

/**
 * Whether the content has moved under the bar (owner's phone, 8 Oct 2026, Podrška and Novi zahtev: a row was cut off by the bar with nothing
 * to say why). It changes only when the content crosses its first dp, so a scroll does not draw the screen again on every frame.
 */
export function useScrolledUnderBar(): { scrolled: boolean; onScroll: (event: NativeSyntheticEvent<NativeScrollEvent>) => void } {
  const [scrolled, setScrolled] = useState(false);
  const onScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const under = event.nativeEvent.contentOffset.y > 0;
    setScrolled(current => current === under ? current : under);
  }, []);
  return { scrolled, onScroll };
}

/**
 * The bar of a screen whose content scrolls: it stands on its own ground (opaque, so nothing shows through it) and, once the content has moved
 * under it, on its line, so a row that the bar cuts reads as cut by the bar. The line is the system's one divider, a drawn view of `ruleWidth`
 * (1 dp, as a row's), not an edge border (`rule-width-ratchet`): at rest it is the ground's own colour and takes the same 1 dp, laid over the
 * bar's last dp, so the bar does not change height when the line appears.
 */
export function ScrolledBar({ scrolled, children }: { scrolled: boolean; children: ReactNode }) {
  return <View testID="settings-bar" style={styles.bar}>
    {children}
    <View testID="settings-bar-line" pointerEvents="none" style={[styles.line, scrolled && styles.lineOn]} />
  </View>;
}

const styles = StyleSheet.create({
  bar: { backgroundColor: sys.color.ground },
  line: { position: 'absolute', left: 0, right: 0, bottom: 0, height: ruleWidth, backgroundColor: sys.color.ground },
  lineOn: { backgroundColor: sys.color.line },
});
