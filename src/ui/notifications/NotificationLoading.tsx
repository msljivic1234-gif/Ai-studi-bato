import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { T } from '../Text';
import { sys } from '../system/tokens';

/** A truthful first-read state on the white notification canvas, without simulated rows or shimmer. */
export function NotificationLoading({ label }: { label: string }) {
  return <View testID="notification-loading" accessibilityLiveRegion="polite" style={s.frame}>
    <ActivityIndicator size="small" color={sys.color.green} />
    <T variant="note" tone="muted" style={s.label}>{label}</T>
  </View>;
}

const s = StyleSheet.create({
  frame: { minHeight: 180, paddingTop: sys.space.xl, paddingBottom: sys.space.xl, alignItems: 'center', justifyContent: 'center', gap: sys.space.base,
    backgroundColor: sys.color.surface },
  label: { textAlign: 'center' },
});
