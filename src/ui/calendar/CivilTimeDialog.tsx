import { DateTimePicker } from '@expo/ui/community/datetime-picker';
import { sys } from '../system/tokens';

type Props = { value: Date; onSelect: (date: Date) => void; onDismiss: () => void };

/** Platform-safe fallback. CivilField mounts this seam only on Android; Metro selects the .android implementation. */
export function CivilTimeDialog({ value, onSelect, onDismiss }: Props) {
  return <DateTimePicker mode="time" value={value} is24Hour onDismiss={onDismiss}
    onValueChange={(_, date) => onSelect(date)} positiveButton={{ label: 'Izaberi' }}
    negativeButton={{ label: 'Odustani' }} accentColor={sys.color.green} />;
}
