import { useEffect, useRef, useState, type ReactNode, type Ref } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import { Press } from '../Press';
import { T } from '../Text';
import { Glyph } from '../system/Glyph';
import { layout } from '../system/layout';
import { brandAction, field, fieldBox, inset, sys } from '../system/tokens';
import { V2Action } from '../v2/V2Action';
import { useFocusRevealContext } from './keyboardReveal';

/**
 * The controls of the sign-in screens, drawn from the system's own parts so that nothing on them is a second version of
 * something the rest of the app already has (round of 2026-10-08, F7): the field is the system `field` (52 high, the control
 * corner, the strong hairline, Inter); the green command is `V2Action` in `brandAction`; a quiet command is green or grey
 * words. The sign-in sheet used to draw each of them itself, in the phone's own typeface instead of Inter, with a 66 dp field
 * whose label stood inside it, a 54 dp button that went pale (transparent) when it could not be pressed, and corners and
 * paddings of 9, 14, 15, 17 and 22.
 */

type AuthFieldProps = {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  /** Only where the SHAPE of the answer helps (an email, a number); a placeholder that repeats the label is clutter. */
  placeholder?: string;
  secure?: boolean;
  keyboardType?: 'default' | 'email-address' | 'phone-pad' | 'number-pad';
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  editable?: boolean;
  newPassword?: boolean;
  /** What the browser or phone may fill in for this field (`name-given`, `name-family`, ...). Derived for email and password. */
  autoComplete?: 'name-given' | 'name-family' | 'postal-address-locality' | 'tel' | 'one-time-code' | 'off';
  /** What is wrong with it, said under the field and read out when it appears; the field's edge turns the danger colour. */
  error?: string | null;
  /** A quiet line under the field while nothing is wrong with it. */
  hint?: string;
  inputRef?: Ref<TextInput>;
  /** The key at the bottom right of the keyboard: `next` goes to the next field and keeps the keyboard, `go` sends the form. */
  returnKeyType?: 'next' | 'go' | 'done';
  onSubmitEditing?: () => void;
  onBlur?: () => void;
  testID?: string;
};

/**
 * One field of a form: its label above it (outside the box, 4 dp over it, so a long label has room and the box is the system
 * field), the box, and under it the one sentence that is wrong or the one quiet line that helps. The whole field is what is kept
 * in view when it takes focus and the keyboard comes up; the input has priority if the whole field cannot fit (`keyboardReveal`).
 */
export function AuthField({
  label, value, onChangeText, placeholder, secure, keyboardType, autoCapitalize = 'none', editable = true, newPassword = false,
  autoComplete, error, hint, inputRef, returnKeyType, onSubmitEditing, onBlur, testID,
}: AuthFieldProps) {
  const [shown, setShown] = useState(false);
  const [focused, setFocused] = useState(false);
  const box = useRef<View>(null);
  const control = useRef<View>(null);
  const reveal = useFocusRevealContext();
  const complete = autoComplete ?? (keyboardType === 'email-address' ? 'email' : secure ? (newPassword ? 'new-password' : 'current-password') : 'off');
  return <View ref={box} testID={`auth-field:${label}`} collapsable={false} style={s.field}>
    {/* The input carries the label for assistive technology; saying it twice would read it twice. */}
    <T variant="meta" tone={focused ? 'ink' : 'muted'} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">{label}</T>
    <View ref={control} testID={`auth-input:${label}`} collapsable={false} style={s.boxFrame}>
      <TextInput testID={testID} ref={inputRef} accessibilityLabel={label} value={value} onChangeText={onChangeText}
        editable={editable} autoCapitalize={autoCapitalize} autoCorrect={false} keyboardType={keyboardType} placeholder={placeholder}
        placeholderTextColor={sys.color.muted} secureTextEntry={secure && !shown} selectionColor={sys.color.green}
        autoComplete={complete} returnKeyType={returnKeyType} onSubmitEditing={onSubmitEditing}
        submitBehavior={returnKeyType === 'next' ? 'submit' : 'blurAndSubmit'}
        onFocus={() => { setFocused(true); reveal.focus(box, control); }}
        onBlur={() => { setFocused(false); reveal.blur(box); onBlur?.(); }}
        style={[field, secure && s.withEye, focused && s.focused, !!error && s.invalid, !editable && s.disabled]} />
      {secure ? <Press accessibilityRole="button" disabled={!editable} accessibilityState={{ disabled: !editable }}
        accessibilityLabel={shown ? 'Sakrij lozinku' : 'Prikaži lozinku'} haptic="select" hitSlop={0}
        onPress={() => setShown(value => !value)} style={s.eye}>
        <Glyph name={shown ? 'eye-off' : 'eye'} size={20} tone="muted" />
      </Press> : null}
    </View>
    {error ? <T variant="note" tone="danger" accessibilityRole="alert" accessibilityLiveRegion="polite">{error}</T>
      : hint ? <T variant="note" tone="muted">{hint}</T> : null}
  </View>;
}

/** The one green command of a step. Pale (transparent) is gone: it is the system's own, a grey well with grey words, while it cannot be pressed. */
export function PrimaryButton({ title, onPress, busy, disabled, testID }: {
  title: string; onPress: () => void; busy?: boolean; disabled?: boolean; testID?: string;
}) {
  return <View testID={testID}>
    <V2Action kind="primary" label={title} onPress={onPress} loading={busy} disabled={disabled} style={brandAction} />
  </View>;
}

/** The quiet way out beside the one green action: a label in the muted ink, never a second filled button. */
export function QuietButton({ title, onPress, disabled }: { title: string; onPress: () => void; disabled?: boolean }) {
  return <Press accessibilityRole="button" accessibilityLabel={title} accessibilityState={{ disabled: !!disabled }} disabled={disabled}
    onPress={onPress} style={s.quiet}>
    <T variant="action" tone="muted" style={s.centred}>{title}</T>
  </Press>;
}

/**
 * A command that is only words: green, 48 dp high, standing at the start of its line (or its end, for "Zaboravljena lozinka?"). It
 * is what a step offers besides its one green command: send it again, change the address, try again.
 */
export function LinkAction({ title, onPress, disabled, align = 'start', testID }: {
  title: string; onPress: () => void; disabled?: boolean; align?: 'start' | 'end'; testID?: string;
}) {
  return <Press testID={testID} accessibilityRole="button" accessibilityLabel={title} accessibilityState={{ disabled: !!disabled }}
    disabled={disabled} onPress={onPress} style={[s.link, align === 'end' && s.linkEnd]}>
    <T variant="action" tone={disabled ? 'muted' : 'green'}>{title}</T>
  </Press>;
}

/**
 * Keeps what it holds on the screen when it appears: the answer to a command (a refused sign-up, a confirmation that was sent
 * again) is a thing the person asked for and must see, and it may stand below the part of the form that is scrolled into view, or
 * above it. It uses the same measuring and scrolling as a field that takes focus (`keyboardReveal`); a new answer (a new `key`)
 * is revealed again. Outside a sheet that keeps things in view it is only a view.
 */
export function RevealWhenShown({ children, testID }: { children: ReactNode; testID?: string }) {
  const box = useRef<View>(null);
  const reveal = useFocusRevealContext();
  useEffect(() => { reveal.focus(box); return () => reveal.blur(box); }, [reveal]);
  return <View ref={box} testID={testID} collapsable={false}>{children}</View>;
}

/** A sentence that is not a field's own: a flat tint, no border, no shadow (the system's `inset`). `ok` is a confirmation. */
export function AuthNote({ children, tone = 'wash' }: { children: ReactNode; tone?: 'wash' | 'ok' }) {
  return <View accessibilityLiveRegion="polite" style={[inset, { backgroundColor: sys.color.wash }]}>
    <T variant="note" tone={tone === 'ok' ? 'ink' : 'muted'}>{children}</T>
  </View>;
}

const s = StyleSheet.create({
  // The label stands 4 dp over its box, and what is said under it 4 dp below: one rhythm for every field of every form.
  field: { gap: sys.space.xs },
  boxFrame: { position: 'relative' },
  // A focused or wrong field has a 2 dp edge instead of 1; its side padding gives that dp back, so the words do not move.
  focused: { borderColor: sys.color.ink, borderWidth: 2, paddingHorizontal: fieldBox.paddingHorizontal - 1 },
  invalid: { borderColor: sys.color.danger, borderWidth: 2, paddingHorizontal: fieldBox.paddingHorizontal - 1 },
  // Not faded: a faded field reads as broken. It is a well, like a button that cannot be pressed.
  disabled: { backgroundColor: sys.color.wash, color: sys.color.muted },
  withEye: { paddingRight: layout.touch },
  // The eye is the whole right end of the box, 48 wide and as high as the box, so it is a full touch target inside the edge.
  eye: { position: 'absolute', top: 0, right: 0, width: layout.touch, height: fieldBox.minHeight, alignItems: 'center', justifyContent: 'center' },
  quiet: { minHeight: layout.touch, borderRadius: sys.radius.control, alignItems: 'center', justifyContent: 'center', paddingHorizontal: sys.space.base },
  centred: { textAlign: 'center' },
  link: { minHeight: layout.touch, alignSelf: 'flex-start', justifyContent: 'center' },
  linkEnd: { alignSelf: 'flex-end' },
});
