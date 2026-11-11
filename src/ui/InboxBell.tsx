import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { Glyph } from './system/Glyph';
import { useInbox } from '../hooks/useInbox';
import { useReducedMotion } from './system/motion';
import { Press } from './Press';
import { sys } from './system/tokens';
import { T } from './Text';
import { neprocitanih } from './system/plural';

const s = StyleSheet.create({
  control: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center', borderRadius: sys.radius.pill, backgroundColor: sys.color.iconWell },
  // The existing badge stays over the upper right edge of the same 48 px touch area.
  badge: { position: 'absolute', top: -1, right: -1, minWidth: 20, height: 20, paddingHorizontal: 5, borderRadius: sys.radius.pill,
    backgroundColor: sys.color.orange, borderWidth: 2, borderColor: sys.color.surface, alignItems: 'center', justifyContent: 'center' },
  // The spoken label carries the number, so the digits keep their size inside the 20 px capsule at any text setting.
  badgeText: { color: sys.color.onOrange, lineHeight: 14, letterSpacing: 0, fontVariant: ['tabular-nums'] },
});

/**
 * The bell's one swing when the unread count grows (V41's approved notice). It is longer than `sys.motion.enter`
 * because it is a damped swing of four beats, not one move; it is named here so it is not a stray number.
 */
export const BELL_SWING_MS = 620;

export function InboxBell() {
  const { state, model } = useInbox(null);
  // The count is held until a new one arrives (T4a, 2026-10-07). The inbox model forgets its page every time the screen loses
  // focus, so the number vanished at each return until the next read finished. The bell answers from the last count it was
  // given by THIS model (one account, one set) while that read is on its way. A read that failed is not a count, and another
  // account starts with nothing: the held number belongs to the model it came from.
  const held = useRef<{ model: unknown; count: number } | null>(null);
  const live = state.error ? null : state.page?.unreadCount;
  if (live != null) held.current = { model, count: live };
  const count = live ?? (!state.error && held.current !== null && held.current.model === model ? held.current.count : null);
  const spoken = count == null ? 'Obaveštenja, broj nepročitanih nije dostupan' : `Obaveštenja, ${neprocitanih(count)}`;
  // V41's bell notice: when the unread count grows while the screen is open, the bell swings once. The first count
  // the screen reads is not news, and reduced motion keeps it still.
  const reduced = useReducedMotion();
  const swing = useRef(new Animated.Value(0)).current;
  const seen = useRef<number | null | undefined>(undefined);
  useEffect(() => {
    const before = seen.current; seen.current = count;
    // An interrupted swing must never leave a tilted bell behind when no new swing is due.
    swing.setValue(0);
    if (reduced || before === undefined || before == null || count == null || count <= before) return;
    const run = Animated.timing(swing, { toValue: 1, duration: BELL_SWING_MS, easing: Easing.out(Easing.quad), useNativeDriver: true });
    run.start();
    return () => { run.stop(); swing.setValue(0); };
  }, [count, reduced, swing]);
  const rotate = swing.interpolate({ inputRange: [0, 0.22, 0.48, 0.72, 1], outputRange: ['0deg', '-12deg', '9deg', '-5deg', '0deg'] });
  // The same quiet control family as navigation; only the real unread count controls badge and swing.
  return <Press accessibilityRole="button" accessibilityLabel={spoken} accessibilityState={{ disabled: false }} disabled={false}
    onPress={() => router.push('/obavestenja')} haptic="select" hitSlop={0} style={s.control}>
    <Animated.View testID="inbox-bell-drawing" accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants"
      style={{ transform: [{ rotate }] }}>
      <Glyph name="notifications" size={sys.icon.size.navigation} />
    </Animated.View>
    {count != null && count > 0 && <View style={s.badge}>
      <T variant="label" maxFontSizeMultiplier={1} style={s.badgeText}>{count > 99 ? '99+' : count}</T>
    </View>}
  </Press>;
}
