import { StyleSheet, View } from 'react-native';
import { T } from '../Text';
import { V2Action } from '../v2/V2Action';
import { sys } from './tokens';
import { SystemSettingsAction } from './SystemSettingsAction';

/**
 * Recovery after a denied device permission (owner decision 4, 2026-09-16):
 * permissions are asked in context, and a denial always leaves the user a way
 * forward — the phone settings, plus the alternative the caller names
 * (type instead of speak, pick from the gallery, continue without a location).
 * Nothing here re-requests the permission or claims it was granted.
 */
export function PermissionRecovery({ message, alternative, onAlternative, compact = false }: {
  /** What was denied and what still works, in the user's words. */
  message: string;
  /** Optional alternative action label (e.g. "Izaberi iz galerije"). */
  alternative?: string; onAlternative?: () => void; compact?: boolean;
}) {
  return <View style={[s.box, compact && s.compact]} accessibilityLiveRegion="polite">
    <T variant="meta" style={s.copy}>{message}</T>
    <View style={s.actions}>
      <SystemSettingsAction />
      {alternative && onAlternative ? <V2Action label={alternative} kind="quiet" onPress={onAlternative} /> : null}
    </View>
  </View>;
}
const s = StyleSheet.create({
  box: { gap: 8, padding: 14, borderRadius: sys.radius.control, backgroundColor: sys.color.warnSoft },
  compact: { padding: 10 },
  copy: { color: sys.color.ink },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' },
});
