import { useState, type ComponentProps, type ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { DateTimePicker } from '@expo/ui/community/datetime-picker';
import { CivilTimeDialog } from './CivilTimeDialog';
import { useReducedMotion } from '../system/motion';
import { DetailTopBar } from '../system/DetailTopBar';
import { QuietReadState } from '../v2/QuietReadState';
import { brandAction, sys, card, cardCompact, field } from '../system/tokens';
import { ProductSheet } from '../product/ProductSheet';
import { V2Action } from '../v2/V2Action';
import { Press } from '../Press';
import { T as BaseText } from '../Text';
import { civilClock, civilDay, deviceDate, deviceTime } from './calendarPresentation';
import { FactArt } from '../system/FactArt';

/**
 * Calendar surfaces on the shared system: a white ground, white cards drawn by their edge, green as orientation and as
 * the one brand action. No tinted note boxes (critique B18): a note is a line of quiet text.
 */
export const calendarStyles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: sys.color.ground },
  // Insets and gaps are steps of sys.space (review of owner step 10: 14 and 28 were off the 4/8 rhythm); the 48 and 52
  // below are touch heights. Two exceptions stay as they are, since other screens draw them: the option keeps the price
  // filter's own 14/10 inset (MarketplacePresentation), and the field labels' 6 is CivilField's and CalendarField's.
  content: { paddingHorizontal: sys.space.lg, paddingTop: sys.space.xs, paddingBottom: sys.space.xxl, gap: sys.space.md },
  /** A 48 px icon command: every command is at least 48 (the old 44 was under it). */
  icon: { minWidth: 48, minHeight: 48, alignItems: 'center', justifyContent: 'center', borderRadius: sys.radius.pill },
  card: { ...card, gap: sys.space.md }, item: { ...cardCompact, gap: sys.space.sm },
  // A choice is an option row, not a card: the same control the price filter uses.
  option: { minHeight: 52, justifyContent: 'center', paddingHorizontal: 14, paddingVertical: 10, borderRadius: sys.radius.control, borderWidth: 1, borderColor: sys.color.line, backgroundColor: sys.color.surface },
  row: { flexDirection: 'row', alignItems: 'center', gap: sys.space.sm, flexWrap: 'wrap' },
  input: { ...field },
  footer: { paddingHorizontal: sys.space.lg, paddingTop: sys.space.md, paddingBottom: sys.space.md, gap: sys.space.sm, backgroundColor: sys.color.surface, borderTopWidth: 1, borderColor: sys.color.line },
  divider: { height: 1, backgroundColor: sys.color.line },
});

/** Scoped to the calendar surfaces; maps its variants onto the shared type scale. */
export function CalendarText({ variant = 'body', tone = 'ink', style, ...props }: ComponentProps<typeof BaseText>) {
  const typography = variant === 'title' ? sys.type.title : variant === 'heading' ? sys.type.heading
    : variant === 'meta' || variant === 'label' ? sys.type.meta
      : variant === 'bodyStrong' || variant === 'action' ? sys.type.bodyStrong : sys.type.body;
  const color = tone === 'muted' ? sys.color.muted : tone === 'onDark' ? sys.color.surface
    : tone === 'danger' ? sys.color.danger : tone === 'success' ? sys.color.green : sys.color.ink;
  return <BaseText {...props} style={[typography, { color }, style]} />;
}
const T = CalendarText;
/** `primary` is the one brand action (green surface, white label); the rest map onto V2Action kinds. */
export function CalendarAction({ kind = 'primary', full: _full, style, ...props }: ComponentProps<typeof V2Action> & { full?: boolean }) {
  return <V2Action {...props} kind={kind === 'primary' ? 'secondary' : kind}
    style={[kind === 'primary' && brandAction, style]} />;
}

/**
 * The frame of the availability screen: the top bar, the keyboard, and either the content or, on the first read with
 * nothing yet to show, a calm first-read state.
 */
export function CalendarScreen({ title, back, children, loading = false, scroll = true, footer }: {
  title: string; back: () => void; children: ReactNode; loading?: boolean; scroll?: boolean; footer?: ReactNode;
}) {
  const body = loading ? <QuietReadState art="calendar" title="Učitavamo sačuvanu dostupnost…"
    body="Proveravamo dane i termine koje si sačuvao." /> : children;
  return <SafeAreaView edges={['top', 'bottom']} style={calendarStyles.screen}>
    <DetailTopBar title={title} onBack={back} />
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      {scroll || loading ? <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={calendarStyles.content}>{body}</ScrollView> : <View style={{ flex: 1 }}>{body}</View>}
      {!loading && footer ? <View style={calendarStyles.footer}>{footer}</View> : null}
    </KeyboardAvoidingView>
  </SafeAreaView>;
}

export function CalendarField({ label, value, onChange, disabled, placeholder, maxLength = 256 }: {
  label: string; value: string; onChange: (value: string) => void; disabled?: boolean; placeholder?: string; maxLength?: number;
}) {
  return <View style={{ gap: 6 }}><T variant="meta" tone="muted">{label}</T>
    <TextInput accessibilityLabel={label} value={value} onChangeText={onChange} editable={!disabled}
      autoCapitalize="none" autoCorrect={false} placeholder={placeholder} placeholderTextColor={sys.color.muted}
      style={calendarStyles.input} maxLength={maxLength} />
  </View>;
}

/** Picker edits civil fields, deliberately separate from the account's named timezone. */
export function CivilField({ label, mode, value, onChange, disabled }: {
  label: string; mode: 'date' | 'time'; value: string; onChange: (value: string) => void; disabled?: boolean;
}) {
  const reduced = useReducedMotion();
  const [open, setOpen] = useState(false);
  const [selection, setSelection] = useState(new Date());
  const openPicker = () => {
    if (disabled) return;
    const seed = mode === 'date' ? new Date(`${/^\d{4}-\d{2}-\d{2}$/.test(value) ? value : deviceDate(new Date())}T12:00:00${Platform.OS === 'android' ? 'Z' : ''}`)
      : mode === 'time' && /^\d{2}:\d{2}/.test(value) && !value.startsWith('24:')
        ? new Date(`${deviceDate(new Date())}T${value.slice(0, 5)}:00`) : new Date();
    setSelection(seed); setOpen(true);
  };
  // SDK57 Material date picker returns the selected civil date at UTC midnight.
  // Its time picker returns local Calendar time; the two must not share extraction.
  const civil = (date: Date) => mode === 'date'
    ? Platform.OS === 'android' ? date.toISOString().slice(0, 10) : deviceDate(date)
    : deviceTime(date);
  const accept = (date: Date) => { onChange(civil(date)); setOpen(false); };
  if (Platform.OS === 'web') return <CalendarField label={label} value={value} onChange={onChange}
    disabled={disabled} placeholder={mode === 'date' ? 'GGGG-MM-DD' : 'HH:MM'} maxLength={mode === 'date' ? 10 : 15} />;
  // The stored civil value stays exact; a person reads "23. sep" and "16:00" (one time format, 2026-09-23), and the
  // button's label no longer hides it from a screen reader.
  const shown = value ? mode === 'date' ? civilDay(value) : civilClock(value) : '';
  return <View style={{ gap: 6 }}><T variant="meta" tone="muted">{label}</T>
    <Press accessibilityRole="button" accessibilityLabel={label} accessibilityValue={shown ? { text: shown } : undefined}
      accessibilityHint={!shown && mode === 'time' ? 'Izaberi vreme' : undefined} accessibilityState={{ disabled: !!disabled }}
      disabled={disabled} haptic="select" scaleTo={0.99} onPress={openPicker} style={[calendarStyles.input, calendarStyles.row, disabled && { backgroundColor: sys.color.ground }]}>
      <T style={{ flex: 1, color: value ? sys.color.ink : sys.color.muted }}>{shown || (mode === 'date' ? 'Izaberi datum' : 'Izaberi')}</T>
      {/* Each fact its own picture (r6, "Tačan termin" and Izmene): a time field wears the clock, a date field the calendar. */}
      <FactArt kind={mode === 'time' ? 'clock' : 'calendar'} size={22} />
    </Press>
    {open && Platform.OS === 'android' ? mode === 'time'
      ? <CivilTimeDialog value={selection} onSelect={accept} onDismiss={() => setOpen(false)} />
      : <DateTimePicker mode={mode} value={selection} is24Hour
        onDismiss={() => setOpen(false)} onValueChange={(_, date) => accept(date)}
        positiveButton={{ label: 'Izaberi' }} negativeButton={{ label: 'Odustani' }} accentColor={sys.color.green} /> : null}
    {/* iOS: the spinner in the one sheet engine (the hand-made slide Modal was one of the nine Modals of the master
        plan). Turning the wheel only moves the selection; "Izaberi" accepts it, anything else leaves the value as it was.
        Release gate (review of owner step 10): no suite runs this branch on iOS, and the field is also used inside other
        sheets (AgreementActionsScreen, ApplicationSelectionPresentation). It needs an iOS device pass
        before an iOS release; Android does not use it. */}
    {open && Platform.OS === 'ios' ? <ProductSheet title={label} closeButton={false} reduced={reduced} onClose={() => setOpen(false)}
      footer={dismiss => <>
        <V2Action label="Izaberi" style={brandAction} onPress={() => { onChange(civil(selection)); dismiss(); }} />
        <V2Action label="Odustani" kind="quiet" onPress={dismiss} />
      </>}>
      {() => <DateTimePicker mode={mode} display="spinner" value={selection} locale="sr_Latn_RS"
        onValueChange={(_, date) => setSelection(date)} accentColor={sys.color.green} />}
    </ProductSheet> : null}
  </View>;
}
