import { StyleSheet, View } from 'react-native';
import { Press } from '../Press';
import { T } from '../Text';
import { FactArt } from '../system/FactArt';
import { layout } from '../system/layout';
import { sys } from '../system/tokens';

/** The two things a person can come to do; the entry's two halves choose one of them. */
export type AuthIntentName = 'REQUESTER' | 'WORKER';

/**
 * The choice made on the entry, kept on the sign-in screen as ONE sentence (design proposal N2, owner 2026-10-07): what the
 * person does, in the app's own words and without grammatical gender. The entry's names ("Objavi zadatak", "Uskoči i zaradi")
 * are the doors; this is what the person is doing once through one.
 */
export const authIntentSentence: Readonly<Record<AuthIntentName, string>> = { REQUESTER: 'Tražite pomoć', WORKER: 'Uskačete' };

export const otherAuthIntent = (intent: AuthIntentName): AuthIntentName => intent === 'REQUESTER' ? 'WORKER' : 'REQUESTER';

/**
 * The sentence and its one command, "Promeni", which switches to the other of the two. One row, one touch target: 48 high, a
 * fact picture at 24 and 12 between it and the words, a quiet well (the system's `inset` corner) and no border.
 */
export function AuthIntentLine({ intent, disabled = false, onChange }: {
  intent: AuthIntentName; disabled?: boolean; onChange: (next: AuthIntentName) => void;
}) {
  const next = otherAuthIntent(intent);
  return <Press testID="auth-intent" accessibilityRole="button" disabled={disabled} haptic="select"
    accessibilityLabel={`${authIntentSentence[intent]}. Promeni`} accessibilityHint={`Prebacuje na „${authIntentSentence[next]}“.`}
    accessibilityState={{ disabled }} onPress={() => onChange(next)} style={s.row}>
    <View accessible={false} importantForAccessibility="no-hide-descendants">
      <FactArt kind={intent === 'REQUESTER' ? 'publish' : 'money'} size={24} cut="art" />
    </View>
    <T variant="bodyStrong" tone={disabled ? 'muted' : 'ink'} style={s.sentence}>{authIntentSentence[intent]}</T>
    {/* The word is the command: green words inside a 48 dp-high area, not a second button drawn beside the sentence. */}
    <T variant="action" tone={disabled ? 'muted' : 'green'} style={s.change}>Promeni</T>
  </Press>;
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: sys.space.md, minHeight: layout.touch, paddingLeft: sys.space.base,
    paddingRight: sys.space.xs, borderRadius: sys.radius.control, backgroundColor: sys.color.wash },
  sentence: { flex: 1, minWidth: 0 },
  change: { minHeight: layout.touch, paddingHorizontal: sys.space.md, textAlignVertical: 'center', lineHeight: layout.touch },
});
