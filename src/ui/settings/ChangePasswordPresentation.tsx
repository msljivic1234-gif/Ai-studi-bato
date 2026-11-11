import { StyleSheet, TextInput, View } from 'react-native';
import { InlineNote } from '../privacy/InlineNote';
import { T } from '../Text';
import { KeyValueRow } from '../system/KeyValueRow';
import { SuccessMark } from '../system/SuccessMark';
import { field, sys } from '../system/tokens';
import { SettingsAction, SettingsGroup, SettingsScreen } from './SettingsPresentation';

export type ChangePasswordField = 'current' | 'next' | 'repeat';
export type ChangePasswordPhase = 'form' | 'saving' | 'done';

/**
 * "Promeni lozinku" (R22; UI/UX pass 2026-10-08, F6): the account's email, said and not editable, and the three words a change needs - the
 * current password, the new one and the new one again - with the one green action in the foot. When it cannot be pressed yet the foot
 * says why in the line above it (`reason`). A refusal is one sentence under the fields (`error`), never the provider's own text. Done is
 * its own state: the sentence and the one way out. Presentation only: the route owns the service, the account fence and the navigation.
 * Nothing typed here is kept anywhere but in the route's memory, and it is gone when the screen is.
 */
export function ChangePasswordView({ email, values, onChange, phase, error, reason, onSubmit, onBack }: {
  email: string | null; values: Readonly<Record<ChangePasswordField, string>>; onChange: (field: ChangePasswordField, value: string) => void;
  phase: ChangePasswordPhase; error: string | null; reason: string | null; onSubmit: () => void; onBack: () => void;
}) {
  if (phase === 'done') return <SettingsScreen title="Promeni lozinku" onBack={onBack} footer={<SettingsAction label="Gotovo" onPress={onBack} />}>
    <View style={s.done}>
      <SuccessMark fresh size={64} />
      <T variant="title" accessibilityRole="header" accessibilityLiveRegion="polite">Lozinka je promenjena.</T>
      <T variant="copy" tone="muted">Sledeći put se prijavljuješ novom lozinkom.</T>
    </View>
  </SettingsScreen>;
  const saving = phase === 'saving';
  return <SettingsScreen title="Promeni lozinku" onBack={onBack} disabled={saving} footerReason={saving ? null : reason}
    footer={<SettingsAction label="Sačuvaj novu lozinku" loading={saving} disabled={saving || reason !== null} onPress={onSubmit} />}>
    {email ? <SettingsGroup title="Nalog"><KeyValueRow label="Email" value={email} last /></SettingsGroup> : null}
    <SettingsGroup title="Lozinka">
      <View style={s.form}>
        <Password label="Trenutna lozinka" value={values.current} disabled={saving} complete="current-password" onChange={value => onChange('current', value)} />
        <Password label="Nova lozinka" value={values.next} disabled={saving} complete="new-password" onChange={value => onChange('next', value)} />
        <Password label="Ponovi novu lozinku" value={values.repeat} disabled={saving} complete="new-password" onChange={value => onChange('repeat', value)} />
        {error ? <InlineNote tone="danger" art={null}>{error}</InlineNote> : null}
      </View>
    </SettingsGroup>
  </SettingsScreen>;
}

function Password({ label, value, onChange, disabled, complete }: { label: string; value: string; onChange: (value: string) => void; disabled: boolean;
  complete: 'current-password' | 'new-password' }) {
  return <View style={s.field}>
    <T variant="bodyStrong">{label}</T>
    <TextInput accessibilityLabel={label} value={value} onChangeText={onChange} editable={!disabled} secureTextEntry autoCapitalize="none" autoCorrect={false}
      autoComplete={complete} textContentType={complete === 'current-password' ? 'password' : 'newPassword'} maxLength={72}
      placeholderTextColor={sys.color.muted} style={[s.input, disabled && s.locked]} />
  </View>;
}

const s = StyleSheet.create({
  form: { gap: sys.space.base },
  field: { gap: sys.space.sm },
  input: { ...field },
  locked: { backgroundColor: sys.color.wash },
  done: { alignItems: 'flex-start', gap: sys.space.md, paddingTop: sys.space.xl },
});
