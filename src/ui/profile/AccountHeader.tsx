import { StyleSheet, View } from 'react-native';
import { Press } from '../Press';
import { T } from '../Text';
import { Glyph } from '../system/Glyph';
import { sys } from '../system/tokens';

/** Shared Figma account chrome (2:126 and 2:144), with a full 48 dp Back target. */
export function AccountHeader({ title, onBack, disabled = false }: {
  title: string; onBack: () => void; disabled?: boolean;
}) {
  return <View style={s.header}>
    <Press accessibilityRole="button" accessibilityLabel="Nazad" accessibilityState={{ disabled }}
      disabled={disabled} onPress={onBack} haptic="none" style={s.back}>
      <Glyph name="back" size={24} tone={disabled ? 'muted' : 'ink'} />
    </Press>
    <T variant="title" accessibilityRole="header" style={s.title}>{title}</T>
  </View>;
}

const s = StyleSheet.create({
  header: { width: '100%', maxWidth: sys.layout.maxWidth, alignSelf: 'center', paddingHorizontal: 20,
    paddingVertical: 16, flexDirection: 'row', alignItems: 'center', gap: 12 },
  back: { width: 48, height: 48, borderRadius: sys.radius.pill, backgroundColor: sys.color.surface, alignItems: 'center', justifyContent: 'center' },
  title: { flex: 1, lineHeight: 27 },
});
