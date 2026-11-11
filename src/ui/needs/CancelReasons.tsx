import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Press } from '../Press';
import { T } from '../Text';
import { CHIP_CHOSEN_INSET, chipChosen, sys } from '../system/tokens';

/**
 * The reasons a requester gives for cancelling a task (plan 2.3: reason chips only where the server already takes a reason).
 * `rpc_cancel_need` takes `p_reason` (500 characters at most) and keeps it with the cancellation; nobody else is shown it. So the
 * chips are the owner's own record, in the words a person would say it, and NONE is required: a cancellation with no reason is the
 * same command it always was. No gendered participle: every reason speaks of the term, the task or the need.
 */
export const TASK_CANCEL_REASONS = ['Više mi ne treba', 'Rešeno je drugačije', 'Promenio se termin', 'Drugo'] as const;

/**
 * The chips, under the sentence of the question. They keep their own choice and report it (`''` when none is chosen, so the command's
 * reason stays exactly what it was); a chosen chip is chosen again to take it back. The question that holds them is a bottom sheet
 * (`ConfirmSheet` draws one whenever it carries content), because chips want the room.
 */
export function CancelReasons({ onChange }: { onChange: (reason: string) => void }) {
  const [chosen, setChosen] = useState<string | null>(null);
  const pick = (reason: string) => {
    const next = chosen === reason ? null : reason;
    setChosen(next); onChange(next ?? '');
  };
  return <View style={s.wrap}>
    <T variant="note" tone="muted">Razlog (nije obavezan)</T>
    <View accessibilityRole="radiogroup" style={s.reasons}>
      {TASK_CANCEL_REASONS.map(reason => <Press key={reason} accessibilityRole="radio" accessibilityLabel={reason}
        accessibilityState={{ checked: chosen === reason }} haptic="select" onPress={() => pick(reason)} style={[s.reason, chosen === reason && s.reasonOn]}>
        <T variant="meta" style={[s.reasonText, chosen === reason && s.reasonTextOn]}>{reason}</T>
      </Press>)}
    </View>
  </View>;
}

const s = StyleSheet.create({
  wrap: { gap: sys.space.xs },
  reasons: { flexDirection: 'row', flexWrap: 'wrap', gap: sys.space.sm, paddingVertical: sys.space.xs },
  // A free chip has a 1 px edge; a chosen one has the system's 2 px green edge and takes 1 px off its side padding, so its words stay put.
  reason: { minHeight: sys.touch.min, justifyContent: 'center', paddingHorizontal: 14, borderRadius: sys.radius.pill, borderWidth: 1,
    borderColor: sys.color.lineStrong, backgroundColor: sys.color.surface },
  reasonOn: { ...chipChosen, paddingHorizontal: 14 - CHIP_CHOSEN_INSET },
  reasonText: { color: sys.color.ink, fontWeight: '600' },
  reasonTextOn: { color: sys.color.green },
});
