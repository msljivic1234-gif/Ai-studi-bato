import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Lightning } from 'phosphor-react-native';
import type { NeedUrgencyProjection } from '../../contracts/projections';
import { displaysUrgent } from '../../lib/needUrgency';
import { sys } from '../system/tokens';
import { T } from '../Text';

export function useUrgencyClock(values: readonly (NeedUrgencyProjection | undefined)[]): number {
  const [now, setNow] = useState(Date.now);
  const deadlines = values.flatMap(value => value?.level === 'HITNO' ? [Date.parse(value.expiresAt)] : []);
  const next = Math.min(...deadlines.filter(time => time > now));
  useEffect(() => {
    if (!Number.isFinite(next)) return;
    const timer = setTimeout(() => setNow(Date.now()), Math.min(2_147_483_647, Math.max(1, next - Date.now() + 1)));
    return () => clearTimeout(timer);
  }, [next, now]);
  return Math.max(now, Date.now());
}

/**
 * HITNO is a word with a symbol, never a colour alone. A parent that already decides on HITNO (TaskCard) passes its
 * own `now`, so both read one clock: two timers could leave one frame where the card kept the row the badge had left.
 * Without `now` the badge keeps its own clock.
 */
export function NeedUrgencyBadge({ urgency, now }: { urgency?: NeedUrgencyProjection; now?: number }) {
  const own = useUrgencyClock(now === undefined ? [urgency] : []);
  if (!displaysUrgent(urgency, now ?? own)) return null;
  return <View accessible accessibilityLabel="HITNO" style={{ flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 4,
    borderRadius: sys.radius.badge, paddingHorizontal: 8, paddingVertical: 4, backgroundColor: sys.color.orangeSoft }}>
    <Lightning size={13} weight="fill" color={sys.color.danger} />
    <T variant="label" style={{ color: sys.color.danger, letterSpacing: 0.4 }}>HITNO</T>
  </View>;
}
