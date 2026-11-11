import type { ReactNode } from 'react';
import { ActivityIndicator, StyleSheet, TextInput, View } from 'react-native';
import { PaperPlaneTilt } from 'phosphor-react-native';
import { Press } from '../Press';
import { T } from '../Text';
import { withInter } from '../interFont';
import { sys } from './tokens';

/** Every command in the pill is a 48 px target. */
const COMMAND = 48;

/**
 * The floating pill to write in (the look of Poruke and the AI conversation, round 6): one soft capsule on white with the
 * text field and a round send, and an optional tool before the text (Poruke's "+"). Above it, only when there is one, a
 * line that belongs to the pill: what the text answers, or why it cannot go. The capsule keeps the area's 12 px inset; a
 * `PillNote` steps 8 px further in so it lands on the page's 20 px gutter (r6 emulator critique, "Odgovor na" 8 dp off).
 * A caller's own line in `above` takes that step itself.
 *
 * The send is a 48 px target around a 40 px circle: green with a white glyph when the text can go, a grey well with a
 * muted glyph when it cannot (never faded), a spinner while the screen is sending. A grey send says why to a screen
 * reader through its hint (`reason`); the field's own emptiness needs no visible line, the grey circle is the sign every
 * messenger uses. A reason that is not the empty field is drawn by the caller above the pill.
 *
 * Presentation only: the screen owns the text, the guards and the command.
 */
export function PillComposer({ value, onChange, label, placeholder, sendLabel, canSend, busy = false, editable = true, reason,
  onSend, lead, above, maxLength }: {
  value: string; onChange: (text: string) => void;
  /** The field's spoken name. */ label: string; placeholder: string;
  /** The send's spoken name ("Pošalji pitanje"). */ sendLabel: string;
  canSend: boolean;
  /** The screen's command is in flight: the send spins and cannot be pressed twice. */ busy?: boolean;
  editable?: boolean;
  /** Why the send is grey, spoken as its hint. */ reason?: string | null;
  onSend: () => void;
  /** One tool before the text, a 48 px target of the caller's own. */ lead?: ReactNode;
  /** Lines that belong to the pill, drawn right above it. */ above?: ReactNode;
  maxLength?: number;
}) {
  const ready = canSend && !busy;
  return <View style={s.area}>
    {above}
    <View style={s.pill}>
      {lead}
      <TextInput value={value} onChangeText={onChange} multiline editable={editable && !busy} maxLength={maxLength}
        accessibilityLabel={label} placeholder={placeholder} placeholderTextColor={sys.color.muted}
        style={[s.input, !lead && s.inputAlone]} />
      <Press accessibilityRole="button" accessibilityLabel={sendLabel} accessibilityHint={!ready && !busy ? reason ?? undefined : undefined}
        accessibilityState={busy ? { disabled: true, busy: true } : { disabled: !ready }} disabled={!ready}
        onPress={onSend} haptic={ready ? 'light' : 'none'} style={s.sendArea}>
        <View style={[s.send, ready && s.sendReady]}>
          {busy ? <ActivityIndicator color={sys.color.muted} />
            : <PaperPlaneTilt size={20} color={ready ? sys.color.onGreen : sys.color.muted} weight="fill" />}
        </View>
      </Press>
    </View>
  </View>;
}

/** A line above the pill, on the page gutter: muted by default, danger for a reason that stops the send. */
export function PillNote({ children, tone = 'muted', alert = false }: { children: ReactNode; tone?: 'muted' | 'danger'; alert?: boolean }) {
  return <T variant="meta" tone={tone} accessibilityRole={alert ? 'alert' : undefined} accessibilityLiveRegion="polite" style={s.note}>{children}</T>;
}

export const pillCommand = COMMAND;

const s = StyleSheet.create({
  // The pill floats: no rule above it, only air around one soft capsule.
  area: { paddingHorizontal: sys.space.md, paddingTop: sys.space.xs, paddingBottom: sys.space.sm, gap: sys.space.sm,
    backgroundColor: sys.color.surface },
  // 12 (the area) + 8 = the page's 20 px gutter. On the line, not on a wrapper around `above`: an empty fragment in a
  // wrapper would still take the area's gap and push every caller's capsule 8 px down when there is no line.
  note: { paddingHorizontal: sys.space.sm },
  pill: { flexDirection: 'row', alignItems: 'flex-end', gap: 2, padding: sys.space.xs, borderRadius: sys.radius.sheet,
    backgroundColor: sys.color.wash },
  input: withInter({ flex: 1, minHeight: COMMAND, maxHeight: 140, ...sys.type.body, lineHeight: 22, color: sys.color.ink,
    paddingHorizontal: sys.space.xs, paddingTop: 13, paddingBottom: 13, textAlignVertical: 'top' }),
  inputAlone: { paddingHorizontal: 14 },
  sendArea: { width: COMMAND, height: COMMAND, alignItems: 'center', justifyContent: 'center' },
  send: { width: 40, height: 40, borderRadius: sys.radius.pill, alignItems: 'center', justifyContent: 'center', backgroundColor: sys.color.control },
  sendReady: { backgroundColor: sys.color.green },
});
