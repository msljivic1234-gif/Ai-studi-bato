import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { Press } from '../Press';
import { T } from '../Text';
import { InfoButton } from '../system/InfoButton';
import { layout, ruleWidth } from '../system/layout';
import { ChromeIconButton } from '../system/ScreenChrome';
import { sys } from '../system/tokens';
import { stepLabels, type CalendarView } from './calendarViews';

/**
 * The period a view is of, and the two arrows that step it (owner's sketch, 8 Oct 2026): "Oktobar 2026", "5–11. okt", "Subota, 10. okt"
 * on the left, the arrows at the end of the line (48 dp each, no circle; they are named by the period they step by). The name is a
 * heading and a polite live region, so a screen reader hears the period change; it also carries the one named action that reads the
 * planner again (an action on a ScrollView is never offered by TalkBack or VoiceOver, so the heading carries it). Under a phone that is not
 * in Serbian time it says so in one quiet line. `below` is where "Danas" goes when the bar has no room for it.
 */
export function PeriodHeader({ view, title, zoneNote, below, onPrevious, onNext, onRefresh }: {
  view: CalendarView; title: string; zoneNote: boolean; below?: ReactNode;
  onPrevious: () => void; onNext: () => void; onRefresh: () => void;
}) {
  const labels = stepLabels(view);
  return <View testID="period-header" style={s.header}>
    <View style={s.row}>
      <View style={s.copy}>
        <T variant="heading" accessibilityRole="header" accessibilityLiveRegion="polite" accessibilityActions={[{ name: 'refresh', label: 'Osveži raspored' }]}
          onAccessibilityAction={event => { if (event.nativeEvent.actionName === 'refresh') onRefresh(); }}>{title}</T>
        {zoneNote ? <T variant="note" tone="muted">Po vremenu u Srbiji</T> : null}
      </View>
      <View style={s.arrows}>
        <ChromeIconButton quiet label={labels.previous} glyph="caret-left" haptic="select" onPress={onPrevious} />
        <ChromeIconButton quiet label={labels.next} glyph="caret-right" haptic="select" onPress={onNext} />
      </View>
    </View>
    {below}
  </View>;
}

/**
 * "Danas": back to today, in the bar beside the legend. It is always there (a person looks for it), and it is quiet while the chosen day
 * already is today. A pill 36 dp high inside a 48 dp touch.
 */
export function TodayButton({ here, onPress }: { here: boolean; onPress: () => void }) {
  return <Press accessibilityRole="button" accessibilityLabel="Danas" accessibilityHint="Prelazi na današnji dan" accessibilityState={{ disabled: here }}
    disabled={here} haptic="select" scaleTo={sys.motion.scale.button} hitSlop={0} onPress={onPress} style={s.todayTouch}>
    <View style={s.todayPill}>
      <T variant="tab" style={{ color: here ? sys.color.muted : sys.color.ink }}>Danas</T>
    </View>
  </Press>;
}

/** What the dots and the colours mean, one short line each (the screen itself carries no explanation). The line about the shade is only said when the shade is drawn. */
export function legendLines(shading: boolean): string[] {
  return ['Zelena tačka: Dogovor u kome uskačete.', 'Koralna tačka: Dogovor za Vaš zadatak.',
    ...(shading ? ['Osenčen dan: dan iz Vaše dostupnosti za rad.'] : []), 'Crvena linija u prikazu dana: trenutno vreme.',
    'Narandžasta tačka u prikazu dana: nešto čeka na Vas.'];
}
export function LegendButton({ shading }: { shading: boolean }) {
  // The mark is 20 dp and its touch reaches to 48 round it: the box keeps that touch from lying over "Danas" beside it.
  return <View style={s.legend}><InfoButton title="Šta znače boje" lines={legendLines(shading)} testID="calendar-legend" /></View>;
}

const s = StyleSheet.create({
  header: { gap: sys.space.xs },
  row: { flexDirection: 'row', alignItems: 'center', gap: sys.space.sm },
  copy: { flex: 1, minWidth: 0, gap: sys.space.xs },
  arrows: { flexDirection: 'row' },
  legend: { width: layout.touch, height: layout.touch, alignItems: 'center', justifyContent: 'center' },
  todayTouch: { minHeight: layout.touch, justifyContent: 'center' },
  todayPill: { minHeight: 36, justifyContent: 'center', paddingHorizontal: sys.space.base, borderRadius: sys.radius.pill, borderWidth: ruleWidth,
    borderColor: sys.color.line, backgroundColor: sys.color.surface },
});
