import { Host, TimePickerDialog } from '@expo/ui/jetpack-compose';
import { sys } from '../system/tokens';

type Props = { value: Date; onSelect: (date: Date) => void; onDismiss: () => void };

/** The same native time dialog used by the community wrapper, with paired foreground/background colors. */
export function CivilTimeDialog({ value, onSelect, onDismiss }: Props) {
  return <Host colorScheme="light" seedColor={sys.color.green}>
    <TimePickerDialog initialDate={value.toISOString()} is24Hour color={sys.color.green}
      confirmButtonLabel="Izaberi" dismissButtonLabel="Odustani"
      onDateSelected={onSelect} onDismissRequest={onDismiss}
      elementColors={{
        clockDialColor: sys.color.wash,
        clockDialSelectedContentColor: sys.color.surface,
        clockDialUnselectedContentColor: sys.color.ink,
        selectorColor: sys.color.green,
        timeSelectorSelectedContainerColor: sys.color.green,
        timeSelectorSelectedContentColor: sys.color.surface,
        timeSelectorUnselectedContainerColor: sys.color.surface,
        timeSelectorUnselectedContentColor: sys.color.ink,
      }} />
  </Host>;
}
