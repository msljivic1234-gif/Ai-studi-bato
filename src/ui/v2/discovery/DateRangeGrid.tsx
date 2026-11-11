import { useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { CaretLeft, CaretRight } from 'phosphor-react-native';
import { dayHeading, weekdays } from '../../calendar/calendarPresentation';
import { Press } from '../../Press';
import { T } from '../../Text';
import { ChromeIconButton } from '../../system/ScreenChrome';
import { sys } from '../../system/tokens';

const MONTHS = ['Januar', 'Februar', 'Mart', 'April', 'Maj', 'Jun', 'Jul', 'Avgust', 'Septembar', 'Oktobar', 'Novembar', 'Decembar'];
/** How far ahead the grid goes: the current month and the twelve after it. */
export const MONTHS_AHEAD = 12;
/**
 * A day's row height: the whole cell is the touch target. The one exception in the app to a 48 × 48 touch: a cell is 48
 * high but a seventh of the grid wide (about 42 at 320 dp), because seven days must stand side by side in a week; the
 * cells touch, so no tap ever falls between two days.
 */
const CELL = 48;
/** The filled circle of a chosen end, at most this wide and always 2 px narrower than its cell, so it never spills. */
const DOT_MAX = 40;

const pad = (value: number) => String(value).padStart(2, '0');
const monthOf = (day: string) => day.slice(0, 7);
function addMonths(month: string, delta: number): string {
  const index = Number(month.slice(0, 4)) * 12 + Number(month.slice(5, 7)) - 1 + delta;
  return `${Math.floor(index / 12)}-${pad((index % 12) + 1)}`;
}
function monthDays(month: string): string[] {
  const count = new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0)).getUTCDate();
  return Array.from({ length: count }, (_, index) => `${month}-${pad(index + 1)}`);
}
/** "Septembar 2026". */
export const monthTitle = (month: string) => `${MONTHS[Number(month.slice(5, 7)) - 1]} ${month.slice(0, 4)}`;
/** The chosen circle for a cell of this width: never wider than `DOT_MAX`, never wider than the cell less 2 px. */
export const dotSize = (cellWidth: number) => Math.max(0, Math.min(DOT_MAX, Math.floor(cellWidth) - 2));

/**
 * Kada by dates (Discovery V47): one month at a time, Monday first as the Serbian week runs. A day before today (Serbian
 * time) is muted, cannot be chosen and says so. The first tap marks where the range starts, the second where it ends
 * (an earlier day starts it again); the days between are shaded light green and both ends are filled green. The month's
 * name is a polite live region, so a screen reader hears the month change. Nothing here decides a result: the caller
 * owns the range and says how many tasks it leaves.
 */
export function DateRangeGrid({ today, from, to, now, onDay }: {
  /** Today's civil date in Serbian time. */ today: string;
  /** Where the range starts: the pending first tap, or the chosen range's first day. */ from: string | null;
  /** Where it ends; null while only its start is chosen. */ to: string | null;
  /** "Now", for the year rule of the spoken day names. */ now: Date;
  onDay: (day: string) => void;
}) {
  const first = monthOf(today), last = addMonths(first, MONTHS_AHEAD);
  const [month, setMonth] = useState(() => { const start = from ? monthOf(from) : first; return start < first ? first : start > last ? last : start; });
  // Until the grid is laid out, its circles keep the largest size; the first layout says how wide a day really is.
  const [dot, setDot] = useState(DOT_MAX);
  const measure = (event: LayoutChangeEvent) => {
    const width = event.nativeEvent.layout.width;
    if (width > 0) { const next = dotSize(width / 7); setDot(current => current === next ? current : next); }
  };
  const days = monthDays(month);
  // Monday is column 0: getUTCDay counts from Sunday.
  const lead = (new Date(`${days[0]}T12:00:00Z`).getUTCDay() + 6) % 7;
  const cells: (string | null)[] = [...Array.from({ length: lead }, () => null), ...days];
  while (cells.length % 7) cells.push(null);
  const weeks = Array.from({ length: cells.length / 7 }, (_, index) => cells.slice(index * 7, index * 7 + 7));
  return <View testID="search-date-grid" onLayout={measure}>
    <View style={s.head}>
      <ChromeIconButton label="Prethodni mesec" icon={CaretLeft} quiet disabled={month <= first} onPress={() => setMonth(addMonths(month, -1))} />
      <T variant="bodyStrong" accessibilityRole="header" accessibilityLiveRegion="polite" style={s.month}>{monthTitle(month)}</T>
      <ChromeIconButton label="Sledeći mesec" icon={CaretRight} quiet disabled={month >= last} onPress={() => setMonth(addMonths(month, 1))} />
    </View>
    {/* Every day's own label names its weekday, so the column heads are for the eye only. */}
    <View style={s.week} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {weekdays.map(day => <T key={day.short} variant="meta" tone="muted" style={s.weekday}>{day.short}</T>)}
    </View>
    {weeks.map(week => <View key={week.find(Boolean) ?? 'x'} style={s.week}>
      {week.map((day, index) => day === null ? <View key={`blank-${index}`} style={s.cell} />
        : <Day key={day} day={day} today={today} from={from} to={to} now={now} dot={dot} onDay={onDay} />)}
    </View>)}
  </View>;
}

function Day({ day, today, from, to, now, dot, onDay }: {
  day: string; today: string; from: string | null; to: string | null; now: Date; dot: number; onDay: (day: string) => void;
}) {
  const past = day < today;
  const start = day === from, end = !!to && day === to;
  const inside = !!from && !!to && day > from && day < to;
  const chosen = start || end || inside;
  // The band runs under the whole range: from the start's middle to the end's middle.
  const band = inside ? s.bandFull : start && to && to > day ? s.bandRight : end && from && from < day ? s.bandLeft : null;
  // Use the measured radius for this actual circle. Android painted square range ends with the oversized capsule
  // radius; the circle stays inside the same full-height touch cell and the range band still joins at its centre.
  const round = { width: dot, height: dot, borderRadius: dot / 2 };
  return <Press accessibilityRole="button" accessibilityLabel={`${dayHeading(day, now)}${day === today ? ', danas' : ''}${past ? ', prošao dan' : ''}`}
    accessibilityState={{ disabled: past, selected: chosen }} disabled={past} haptic={past ? 'none' : 'select'} scaleTo={1} hitSlop={0}
    onPress={() => onDay(day)} style={s.cell}>
    {band ? <View testID="range-band" style={[s.band, { top: (CELL - dot) / 2, height: dot }, band]} /> : null}
    <View testID={start || end ? 'range-end' : undefined} style={[s.dot, round, (start || end) && s.dotChosen]}>
      <T variant="body" style={[s.number, day === today && s.today, past && s.past, (start || end) && s.onChosen]}>{Number(day.slice(8, 10))}</T>
    </View>
  </Press>;
}

const s = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: sys.space.xs },
  month: { color: sys.color.ink, flex: 1, textAlign: 'center' },
  week: { flexDirection: 'row' },
  weekday: { flex: 1, textAlign: 'center', paddingVertical: sys.space.xs },
  cell: { flex: 1, height: CELL, alignItems: 'center', justifyContent: 'center' },
  band: { position: 'absolute', backgroundColor: sys.color.greenSoft },
  bandFull: { left: 0, right: 0 },
  bandRight: { left: '50%', right: 0 },
  bandLeft: { left: 0, right: '50%' },
  dot: { borderRadius: sys.radius.pill, alignItems: 'center', justifyContent: 'center' },
  dotChosen: { backgroundColor: sys.color.green },
  number: { color: sys.color.ink, fontVariant: ['tabular-nums'] },
  today: { fontWeight: '700' },
  past: { color: sys.color.muted },
  // Words on a filled green that is not the primary action: the system's `onDark` (as the calendar's chosen day).
  onChosen: { color: sys.color.onDark, fontWeight: '700' },
});
