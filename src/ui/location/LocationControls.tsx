import { useState, type ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, TextInput, View, type TextInputProps } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { DetailTopBar } from '../system/DetailTopBar';
import { TurningCaret } from '../system/Disclosure';
import { Glyph } from '../system/Glyph';
import { OUTCOME_ACTION } from '../system/outcomeCopy';
import { layout } from '../system/layout';
import { useReducedMotion } from '../system/motion';
import { StateView } from '../system/StateView';
import { QuietReadState } from '../v2/QuietReadState';
import { Surface } from '../system/Surface';
import { sys, field } from '../system/tokens';
import { ProductSheet } from '../product/ProductSheet';
import { V2Action as Button } from '../v2/V2Action';
import { Press } from '../Press';
import { T } from '../Text';
import { FactArt } from '../system/FactArt';

/** Location form geometry on the shared system (the edge, the space between blocks and between a field and its label are the system's). */
export const locationStyles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: sys.color.ground },
  content: { paddingHorizontal: layout.gutter, paddingTop: sys.space.sm, gap: layout.section, paddingBottom: layout.zone },
  section: { gap: layout.group },
  input: { ...field },
  row: { flexDirection: 'row', alignItems: 'center', gap: sys.space.md },
  /** A sentence that has to stand out, as the system's flat note (`Surface kind="note"`), for the places that cannot hold the component. */
  notice: { backgroundColor: sys.color.wash, borderRadius: sys.radius.control, paddingVertical: sys.space.md, paddingHorizontal: sys.space.base,
    gap: sys.space.md },
  failure: { paddingHorizontal: layout.gutter, paddingTop: sys.space.md },
});

/** Keep secondary fields available without competing with the current place or pin. */
export function LocationDetails({ label, shownLabel, summary, children, disabled = false, initiallyOpen = false }: {
  /** The row's full name (a screen reader, a test); `shownLabel` is what is drawn when the block around it already says which place it is. */
  label: string; shownLabel?: string; summary?: string; children: ReactNode; disabled?: boolean;
  /** Open from the start when what it holds still has to be chosen (a country that is not set). */
  initiallyOpen?: boolean;
}) {
  const [open, setOpen] = useState(initiallyOpen);
  return <View style={locationStyles.section}>
    <Press accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ expanded: open, disabled }}
      disabled={disabled} haptic="select" scaleTo={sys.motion.scale.row} onPress={() => { if (!disabled) setOpen(value => !value); }}
      style={[locationStyles.row, { minHeight: layout.rowMinPlain, paddingVertical: sys.space.sm }]}>
      <View style={{ flex: 1, gap: sys.space.xs }}>
        <T variant="bodyStrong" style={{ color: sys.color.ink }}>{shownLabel ?? label}</T>
        {!open && summary ? <T variant="note" tone="muted">{summary}</T> : null}
      </View>
      {/* The app's one caret (Disclosure): down when closed, up when open, still under reduced motion. */}
      <TurningCaret open={open} />
    </Press>
    {open ? children : null}
  </View>;
}

/**
 * A field with its name above it (8 dp) and its hint under it. `label` is the field's full name, for a screen reader and for the test that
 * finds it ("Polazište — grad ili mesto"); `shownLabel` is what is drawn when the block around it already says which place it is.
 */
export function LocationField({ label, shownLabel, hint, ...props }: TextInputProps & { label: string; shownLabel?: string; hint?: string }) {
  return <View style={{ gap: sys.space.sm }}>
    <T variant="meta" tone="muted">{shownLabel ?? label}</T>
    <TextInput accessibilityLabel={label} placeholderTextColor={sys.color.muted} {...props}
      style={[locationStyles.input, props.multiline ? { minHeight: 96, textAlignVertical: 'top' } : null, props.style]} />
    {hint ? <T variant="note" tone="muted">{hint}</T> : null}
  </View>;
}

export function LocationChoice({ label, value, options, disabled, onChange }: {
  label: string; value: string | null; options: readonly { value: string; label: string; disabled?: boolean }[];
  disabled: boolean; onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  // The sheet arriving is the choice opening — feedback, like the calendar's date sheet — and it
  // stands still for a person who asked the system for less motion.
  const reduced = useReducedMotion();
  const selected = options.find(option => option.value === value);
  return <View style={{ gap: sys.space.sm }}>
    <T variant="meta" tone="muted">{label}</T>
    <Press accessibilityRole="button" accessibilityLabel={label} accessibilityValue={{ text: selected?.label ?? 'Nije izabrano' }}
      accessibilityState={{ disabled, expanded: open }} disabled={disabled} haptic="select" scaleTo={sys.motion.scale.row} onPress={() => setOpen(true)}
      style={[locationStyles.input, locationStyles.row, disabled && { backgroundColor: sys.color.wash }]}>
      <T variant="body" style={{ flex: 1, color: selected ? sys.color.ink : sys.color.muted }}>{selected?.label ?? 'Izaberi'}</T>
      <Glyph name="caret-down" tone="muted" />
    </Press>
    {/* The shared sheet (master plan: the hand-made Modals become ProductSheet). A choice that is not available yet
        says so in words, and stays readable instead of fading. */}
    {open ? <ProductSheet title={label} reduced={reduced} onClose={() => setOpen(false)}>{dismiss => <View accessibilityRole="radiogroup" style={{ gap: sys.space.sm }}>
      {options.map(option => <Press key={option.value} accessibilityRole="radio" accessibilityLabel={option.label}
        accessibilityHint={option.disabled ? 'Još nije dostupno.' : undefined}
        accessibilityState={{ selected: option.value === value, disabled: !!option.disabled }} disabled={option.disabled} haptic="select"
        onPress={() => { onChange(option.value); dismiss(); }}
        style={[locationStyles.row, { minHeight: layout.rowMinPlain, paddingHorizontal: sys.space.base, paddingVertical: sys.space.sm, borderRadius: sys.radius.control, borderWidth: 1,
          borderColor: value === option.value ? sys.color.green : sys.color.line, backgroundColor: value === option.value ? sys.color.greenSoft : sys.color.surface }]}>
        <View style={{ flex: 1, gap: sys.space.xs }}>
          <T variant={value === option.value ? 'bodyStrong' : 'body'} style={{ color: option.disabled ? sys.color.muted : sys.color.ink }}>{option.label}</T>
          {option.disabled ? <T variant="note" tone="muted">Još nije dostupno</T> : null}
        </View>
        {value === option.value ? <Glyph name="check" tone="green" /> : null}
      </Press>)}
    </View>}</ProductSheet> : null}
  </View>;
}

export function PrivateLocationNote() {
  return <Surface kind="note" style={locationStyles.row}>
    <FactArt kind="lock" size={24} />
    <T variant="meta" style={{ flex: 1, color: sys.color.ink }}>Tačna adresa i napomene su privatne. Dostupne su učesnicima tek kada Dogovor i dozvola za deljenje to omogućavaju.</T>
  </Surface>;
}

export function LocationScreen({ title, onBack, loading, error, onRetry, uncertain = false, children, scroll = true }: {
  title: string; onBack: () => void; loading: boolean; error?: string | null; onRetry: () => void; children?: ReactNode;
  /** The write that failed has no answer yet: what is not known is checked ("Proveri"), what is known to have failed is tried again. */
  uncertain?: boolean;
  /** False when the child is a whole step that scrolls on its own and keeps its save in a footer (`layout="screen"`). */
  scroll?: boolean;
}) {
  // A failure stays beside the form: under it in a scrolling screen (where the save
  // is), above it in a step that keeps its save in a footer.
  const failure = error ? <Surface kind="note" tone="danger" style={locationStyles.section}>
    <T accessibilityRole="alert" tone="danger">{error}</T>
    <Button label={uncertain ? OUTCOME_ACTION.check : OUTCOME_ACTION.retry} kind="secondary" onPress={onRetry} />
  </Surface> : null;
  return <SafeAreaView style={locationStyles.screen} edges={['top', 'bottom']}>
    <DetailTopBar title={title} onBack={onBack} />
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      {loading ? <ScrollView contentContainerStyle={locationStyles.content}>
        <QuietReadState art="map" title="Učitavamo sačuvanu lokaciju…"
          body="Proveravamo tačke pre nego što prikažemo mapu za potvrdu." />
      </ScrollView> : scroll ? <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={locationStyles.content}>{children}{failure}</ScrollView>
        : <View style={{ flex: 1 }}>{failure ? <View style={locationStyles.failure}>{failure}</View> : null}{children}</View>}
    </KeyboardAvoidingView>
  </SafeAreaView>;
}
