import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { T } from '../Text';
import { layout, ruleWidth } from '../system/layout';
import { sys } from '../system/tokens';
import type { EntryFace } from './AgendaRow';
import type { MinuteSpan } from './availabilityShade';
import { HOUR_HEIGHT, layoutDay, minutesClock, nowMinute, timelineRange, topOf, type TimelineRange } from './calendarViews';
import { DayBlockCard } from './DayBlock';
import type { PlannerEntry } from './planner';

/** The column the hours are written in, and the band of the worker's own hours beside it. */
const LABEL_WIDTH = 44;
const BAND_WIDTH = 20;
/** The air above the first hour and below the last, so the first label (centred on its line) is not cut and the last block has a floor. */
const PAD = sys.space.md;
/** Half the line height of an hour's label: where the label's top stands from its line, so the line runs through the middle of the words. */
const LABEL_RISE = 9;
/** A band shorter than this has no room for its words (they run along it, 13 dp of type), and carries none. */
const BAND_WORDS_FROM = 80;

/** "07:00", "24:00": an hour as the app writes a clock. */
const hourWord = (hour: number): string => `${String(hour).padStart(2, '0')}:00`;

/** The part of a span of the worker's hours that falls between the first and last hour drawn, in minutes; null when none of it does. */
function clipped(span: MinuteSpan, range: TimelineRange): MinuteSpan | null {
  const from = Math.max(span.from, range.from * 60), to = Math.min(span.to, range.to * 60);
  return to > from ? { from, to } : null;
}

/**
 * One day on its hours (owner's sketch and words, 8 Oct 2026): a rail of hours, 07:00 to 22:00 unless a Dogovor stands outside them (then
 * the edge moves to it, as far as 24 hours), each Dogovor a block from its start to its end, the worker's own hours as a soft band beside
 * the rail ("Mogu da radim"), and, only on today, a red line where "sada" is. Blocks that overlap stand side by side; one that needs a
 * fourth column is listed under the hours as a card instead of drawn too narrow to read. The line, like everything that states a
 * time, is not animated: it stands where the minute says, and the screen asks again each minute while this day is today.
 *
 * `onFocus` is told how far down the page the first thing worth seeing stands (the hour that is now, or the first Dogovor, an hour
 * above it), so the screen can begin there instead of at seven in the morning.
 */
export function DayView({ day, entries, spans, now, zoneNote, overlaps, photo, onOpen, row, onFocus }: {
  day: string; entries: readonly PlannerEntry[];
  /** The worker's hours on this day, in minutes of its clock; empty when none are drawn (no work profile, or the day is not one they gave). */
  spans: readonly MinuteSpan[];
  now?: Date; zoneNote: boolean;
  overlaps: ReadonlyMap<string, string>;
  photo?: EntryFace;
  onOpen: (entry: PlannerEntry) => void;
  /** A card for a Dogovor that did not fit among the blocks. */
  row: (entry: PlannerEntry, day: string, overlap: string | null) => ReactNode;
  onFocus?: (y: number) => void;
}) {
  const { blocks, overflow } = useMemo(() => layoutDay(entries, day), [entries, day]);
  const range = useMemo(() => timelineRange(blocks), [blocks]);
  const hours = Array.from({ length: range.to - range.from + 1 }, (_, at) => range.from + at);
  const height = (range.to - range.from) * HOUR_HEIGHT;
  const at = now ? nowMinute(now, day) : null;
  const nowShown = at !== null && at >= range.from * 60 && at <= range.to * 60;
  const bands = useMemo(() => spans.map(span => clipped(span, range)).filter((span): span is MinuteSpan => span !== null), [spans, range]);
  const left = LABEL_WIDTH + sys.space.sm + (bands.length ? BAND_WIDTH + sys.space.sm : 0);

  // The page begins at the hour that matters: where "sada" is, or an hour above the first Dogovor. Once for a day, when the hours have a place on the page.
  const [top, setTop] = useState<number | null>(null);
  const focused = useRef<string | null>(null);
  const onlyRows = blocks.length === 0 && overflow.length > 0;
  const focusMinute = at ?? (blocks.length ? blocks[0].from : null);
  useEffect(() => {
    // A day with nothing on it and not today has nothing to begin at: the page stays where the view began.
    if (!onFocus || top === null || (!onlyRows && focusMinute === null) || focused.current === day) return;
    focused.current = day;
    // In the normal composition the hours are first, at y=0. The last measured
    // top can still belong to a previous late-only day with rows above the rail.
    onFocus(onlyRows ? 0 : Math.max(0, PAD + topOf(focusMinute!, range) - HOUR_HEIGHT));
  }, [onFocus, top, day, focusMinute, range, onlyRows]);

  const extra = overflow.length ? <View testID="day-overflow" style={s.overflow}>
    <T variant="bodyStrong" accessibilityRole="header">Još termina</T>
    <View style={s.overflowList}>{overflow.map(entry => row(entry, day, overlaps.get(entry.key) ?? null))}</View>
  </View> : null;

  return <View>
    {onlyRows ? extra : null}
    <View testID="day-hours" onLayout={event => setTop(event.nativeEvent.layout.y)} style={[s.hours, { height: height + PAD * 2 }]}>
      {hours.map(hour => {
        const y = PAD + (hour - range.from) * HOUR_HEIGHT;
        return <View key={hour} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={StyleSheet.absoluteFill}>
          <T variant="meta" tone="muted" maxFontSizeMultiplier={1.15} numberOfLines={1} style={[s.label, { top: y - LABEL_RISE }]}>{hourWord(hour)}</T>
          <View style={[s.line, { top: y }]} />
        </View>;
      })}
      {bands.map(band => {
        const bandHeight = ((band.to - band.from) / 60) * HOUR_HEIGHT;
        return <View key={band.from} testID="day-band" accessible accessibilityLabel={`Mogu da radim, ${minutesClock(band.from)}–${minutesClock(band.to)}`}
          style={[s.band, { top: PAD + topOf(band.from, range), height: bandHeight }]}>
          {bandHeight >= BAND_WORDS_FROM
            ? <T variant="meta" numberOfLines={1} maxFontSizeMultiplier={1.15} style={[s.bandWords, { width: bandHeight - sys.space.base }]}>Mogu da radim</T> : null}
        </View>;
      })}
      <View testID="day-blocks" style={[s.blocks, { top: PAD, left, height }]}>
        {blocks.map(block => <DayBlockCard key={block.entry.key} block={block} day={day} range={range} zoneNote={zoneNote}
          overlap={overlaps.get(block.entry.key) ?? null} photo={photo} onOpen={onOpen} />)}
        {nowShown ? <View testID="now-line" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" pointerEvents="none"
          style={[s.now, { top: topOf(at, range) }]}><View style={s.nowDot} /></View> : null}
      </View>
    </View>
    {!onlyRows ? extra : null}
  </View>;
}

const s = StyleSheet.create({
  hours: { position: 'relative' },
  label: { position: 'absolute', left: 0, width: LABEL_WIDTH, textAlign: 'right', fontVariant: ['tabular-nums'] },
  line: { position: 'absolute', left: LABEL_WIDTH + sys.space.sm, right: 0, height: ruleWidth, backgroundColor: sys.color.line },
  band: { position: 'absolute', left: LABEL_WIDTH + sys.space.sm, width: BAND_WIDTH, borderRadius: sys.radius.pill, overflow: 'hidden',
    alignItems: 'center', justifyContent: 'center', backgroundColor: sys.color.artRole.location.soft },
  // The words run up the band: a box as long as the band, turned a quarter, so it stands inside the band's width.
  bandWords: { textAlign: 'center', color: sys.color.artRole.location.edge, transform: [{ rotate: '-90deg' }] },
  blocks: { position: 'absolute', right: 0 },
  // The line is 2 dp across the blocks, with a dot on its end at the rail.
  now: { position: 'absolute', left: 0, right: 0, height: ruleWidth * 2, backgroundColor: sys.color.danger },
  nowDot: { position: 'absolute', left: -sys.space.xs, top: -sys.space.xs + 1, width: sys.space.sm, height: sys.space.sm, borderRadius: sys.radius.pill,
    backgroundColor: sys.color.danger },
  overflow: { marginTop: layout.section, gap: layout.group },
  overflowList: { gap: layout.group },
});
