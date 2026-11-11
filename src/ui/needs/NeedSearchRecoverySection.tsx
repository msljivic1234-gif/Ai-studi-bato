import { StyleSheet, View } from 'react-native';
import { T } from '../Text';
import { FactArt } from '../system/FactArt';
import { sys } from '../system/tokens';
import { V2Action } from '../v2/V2Action';
import type { SearchRecoveryAction, SearchRecoveryCopy } from './needSearchRecoveryCopy';

/** Open white reading section, not a status dashboard. The one primary action stays in the existing detail footer. */
export function NeedSearchRecoverySection({ copy, disabled, onAction }: {
  copy: SearchRecoveryCopy;
  disabled: boolean;
  onAction: (action: SearchRecoveryAction) => void;
}) {
  return <View style={styles.section} testID="need-search-recovery" accessibilityLiveRegion="polite">
    <View style={styles.heading}>
      <View style={styles.art} accessible={false} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
        <FactArt kind={copy.art} size={32} cut="art"
          role={copy.art === 'clock' ? 'time' : copy.art === 'check' ? 'confirmed' : 'people'} tone={copy.quiet ? 'quiet' : undefined} />
      </View>
      <View style={styles.words}>
        <T variant="bodyStrong" accessibilityRole="header" style={styles.title}>{copy.title}</T>
        <T variant="copy" tone="muted" style={styles.detail}>{copy.detail}</T>
      </View>
    </View>
    {copy.secondary ? <V2Action label={copy.secondary.label} kind="quiet" disabled={disabled}
      onPress={() => { if (!disabled && copy.secondary) onAction(copy.secondary.action); }} style={styles.secondary} /> : null}
  </View>;
}

const styles = StyleSheet.create({
  section: {
    paddingVertical: sys.space.base,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: sys.color.line,
    backgroundColor: sys.color.surface,
    gap: sys.space.sm,
  },
  heading: { flexDirection: 'row', alignItems: 'flex-start', gap: sys.space.md },
  art: { width: 36, minHeight: 36, flexShrink: 0, alignItems: 'center', justifyContent: 'center' },
  words: { flex: 1, minWidth: 0, gap: sys.space.xs },
  title: { color: sys.color.ink },
  detail: { flexShrink: 1 },
  secondary: { alignSelf: 'flex-start' },
});
