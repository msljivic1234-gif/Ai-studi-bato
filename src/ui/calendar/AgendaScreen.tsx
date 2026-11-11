import { useCallback, useEffect, useMemo, useReducer, useRef, useState, type ReactNode } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View, useWindowDimensions, type LayoutChangeEvent } from 'react-native';
import type { WorkerAvailability } from '../../contracts/workerAvailability';
import type { WorkerCalendarEvent } from '../../contracts/workerCalendar';
import { DOGOVORENA_ZONA } from '../../lib/dogovorenoVreme';
import { zonaTelefona } from '../../lib/vreme';
import { T } from '../Text';
import { ClockArt } from '../system/ClockArt';
import { DetailTopBar } from '../system/DetailTopBar';
import { FactArt } from '../system/FactArt';
import { layout } from '../system/layout';
import { ListRow } from '../system/ListRow';
import { useReducedMotion } from '../system/motion';
import { Screen } from '../system/Screen';
import { Segmented } from '../system/Segmented';
import { StateView } from '../system/StateView';
import { useLayoutClass } from '../system/textScale';
import { sys } from '../system/tokens';
import { usePullRefresh } from '../system/usePullRefresh';
import { V2Action } from '../v2/V2Action';
import { QuietReadState } from '../v2/QuietReadState';
import { AgendaRow, type EntryFace } from './AgendaRow';
import { agendaCoverage, type AgendaAgreement } from './agenda';
import { availabilitySpans, dayAvailability } from './availabilityShade';
import { CALENDAR_VIEWS, dayLabel, daySpoken, dayDots, periodTitle, stepDay, type CalendarView } from './calendarViews';
import { DayView } from './DayView';
import { LooseBar, LooseSheet } from './LooseTerms';
import { MonthView } from './MonthView';
import { monthGrid } from './months';
import { LegendButton, PeriodHeader, TodayButton } from './PeriodControls';
import { EMPTY_DAY, buildPlanner, entriesByDay, overlapNotes, type PlannerEntry } from './planner';
import { inWindow, plannerWindow, type PlannerWindow } from './serbianDays';
import { WeekDays } from './WeekDays';
import { WeekStrip, type StripDay } from './WeekStrip';
import { useWeekSwipe } from './weekSwipe';
import { weekDates } from './calendarPresentation';

export type AgendaSchedule = { state: 'loading' } | { state: 'error'; message: string | null }
  | { state: 'ready'; events: readonly WorkerCalendarEvent[] };
export type AgendaList = { state: 'loading' } | { state: 'error' } | { state: 'ready'; agreements: readonly AgendaAgreement[] };
/**
 * What the worker has said about when they can work, with whether their work profile is active. Null for a person who has no work profile
 * (or whose availability is not known): nothing is shaded and there is no "Moja dostupnost". The shade and the band of hours are only for an
 * ACTIVE profile (a draft profile offers nobody anything, so its days are not "days I can work").
 */
export type AgendaAvailability = Readonly<{ value: Pick<WorkerAvailability, 'timezone' | 'rules' | 'windows'>; active: boolean }>;

const NO_EVENTS: readonly WorkerCalendarEvent[] = [];
const VIEW_OPTIONS = CALENDAR_VIEWS.map(({ key, label }) => ({ key, label }));
const LOADING = <QuietReadState art="calendar" title="Učitavamo raspored…" body="Proveravamo dogovorene termine za izabrani period." />;

/**
 * Raspored as a calendar (owner, 8 Oct 2026: "prikaz kalendara ... da ima pregled celog meseca, nedelje, dana"): the DOGOVORI of both
 * sides in three views, and nothing else (my tasks are in "Moji zadaci", my applications in "Moje prijave"; a schedule says WHEN something is
 * agreed). The switch "Mesec · Nedelja · Dan" is the first thing under the bar (the month is where it opens), then, when there are any, the
 * bar "N Dogovora bez termina" (the Dogovori that are agreed but stand on no day; it opens the way to "Predloži termin"), then the period
 * with its two arrows, and under it the view:
 *
 *  - MESEC: the grid of the month with up to two dots a day in the colour of the side of each Dogovor, today ringed, the chosen day a green
 *    disc, the days the worker can work on a soft tint, and under it the list of the chosen day. A swipe changes the month.
 *  - NEDELJA: the strip of seven days with their dots, and the seven days one under another, each with its Dogovori or "Slobodno". A swipe
 *    changes the week.
 *  - DAN: the day on its hours, 07:00 to 22:00 (moving outwards to a Dogovor that stands outside them), each Dogovor a block from its
 *    start to its end, the worker's hours as a band, and on today the red line where "sada" is. A swipe changes the day.
 *
 * Under every view: "Moja dostupnost" (only for someone who has a work profile) and "Arhiva". A view: it has no primary command.
 *
 * Everything is Serbian time (`planner.ts`, `serbianDays.ts`). A read that failed is said, never drawn as an empty day, and a day the
 * schedule was not read for is a plain number, never an empty one. The frame is the system's `Screen`; the switch, the bar and the period
 * stand still while the view under them scrolls. Presentation only: the route owns the reads and every command.
 */
export function AgendaScreen({ selected, today, schedule, list, availability = null, readWindow, refreshing, retrying = false, initialView = 'month',
  onSelect, onBack, onRefresh, onRetry, onRetryList, onOpen, onProposeTerm, onAvailability, onArchive, photo, phoneZone = zonaTelefona(), now }: {
  selected: string; today: string; schedule: AgendaSchedule; list: AgendaList;
  availability?: AgendaAvailability | null;
  /** The window of weeks the schedule was read for (`plannerWindow`); the month of the chosen day when left out. Everything outside it is unknown, not empty. */
  readWindow?: PlannerWindow;
  /** A pull re-reads every source while what is on screen stays. */ refreshing: boolean;
  /** The schedule is being read again after an error. */ retrying?: boolean;
  /** The view the screen opens on (the month, unless a gallery asks for another). */ initialView?: CalendarView;
  onSelect: (day: string) => void; onBack: () => void; onRefresh: () => void;
  /** Read everything again after the schedule failed. */ onRetry: () => void;
  /** Read the Dogovori again after they failed (the schedule did not). */ onRetryList: () => void;
  onOpen: (agreementId: string) => void;
  /** "Predloži termin" for a Dogovor that has none: the form of Izmene Dogovora that proposes one. Without it nothing offers the command. */
  onProposeTerm?: (agreementId: string) => void;
  onAvailability: () => void;
  /** The way into the Arhiva; the row is not drawn without it (the design gallery has no archive). */
  onArchive?: () => void;
  /** The face of the other person in a Dogovor, read by the route (a data client); the letters of their name stand in without it. */
  photo?: EntryFace;
  phoneZone?: string; now?: Date;
}) {
  const { width } = useWindowDimensions();
  const { stacked } = useLayoutClass();
  // At 320 dp or a large text size (the layout class says it, and a gallery can ask for it) the bar has no room for "Danas" beside the legend:
  // it stands under the period instead.
  const narrow = width < 360 || stacked;
  const reduced = useReducedMotion();
  const [view, setView] = useState<CalendarView>(initialView);
  const [loosePanel, setLoosePanel] = useState(false);

  // On the day view of today the screen asks the clock again every minute, so the line of "sada" is where the minute says.
  const live = now === undefined && view === 'day' && selected === today;
  const [, tick] = useReducer((count: number) => count + 1, 0);
  useEffect(() => {
    if (!live) return;
    const timer = setInterval(tick, 60_000);
    return () => clearInterval(timer);
  }, [live]);
  // "U toku" is judged at the minute, so the planner is not rebuilt on every render.
  const minute = Math.floor((now ?? new Date()).getTime() / 60_000);
  const clock = useMemo(() => now ?? new Date(minute * 60_000), [now, minute]);

  // The planner draws what the schedule was read for: by default the month the chosen day is in, as whole weeks.
  const month = selected.slice(0, 7);
  const reach = useMemo(() => readWindow ?? plannerWindow(`${month}-01`), [readWindow, month]);
  const events = schedule.state === 'ready' ? schedule.events : NO_EVENTS;
  const agreements = list.state === 'ready' ? list.agreements : null;
  const planner = useMemo(() => buildPlanner({ events, agreements, from: reach.from, to: reach.to, now: clock }),
    [events, agreements, reach.from, reach.to, clock]);
  const ready = schedule.state === 'ready';
  const coverage = agreements ? agendaCoverage(agreements, events) : 'full';
  const zoneNote = phoneZone !== DOGOVORENA_ZONA;
  // What failed. A source that failed is said, and a day it could have filled is never called empty.
  const dogovoriFailed = list.state === 'error', dogovoriSilent = !!agreements && coverage === 'unknown';
  const dogovoriPending = ready && list.state === 'loading';
  const partial = ready && (dogovoriFailed || dogovoriSilent);

  // The Dogovori of each day the view shows and the planner has read.
  const days = useMemo(() => weekDates(selected), [selected]);
  const shown = useMemo(() => view === 'month' ? monthGrid(month).flat().filter(cell => cell.inMonth).map(cell => cell.day) : view === 'week' ? days : [selected],
    [view, month, days, selected]);
  const byDay = useMemo(() => ready ? entriesByDay(planner.placed, shown.filter(day => inWindow(day, reach))) : null, [ready, planner, shown, reach]);
  const chosenKnown = !!byDay && inWindow(selected, reach);
  const dayEntries = useMemo<readonly PlannerEntry[]>(() => byDay?.[selected] ?? [], [byDay, selected]);
  const weekEntries = view === 'week' && byDay ? days.reduce((count, day) => count + (byDay[day]?.length ?? 0), 0) : 0;
  // What the view's own entries are, to say "empty" only when every read it depends on has settled.
  const nothing = view === 'week' ? weekEntries === 0 : dayEntries.length === 0;
  const loose = ready ? planner.loose : [];
  // The worker's own hours, for an ACTIVE profile only: the days of the month that carry the tint (worked out once per month, not on every render:
  // each day is a walk through the rules), and the stretches of the chosen day for the band beside its hours.
  const shading = !!availability?.active;
  const tinted = useMemo(() => view === 'month' && shading && availability ? new Set(shown.filter(day => dayAvailability(availability.value, day) !== null)) : null,
    [view, shading, availability, shown]);
  const shaded = useCallback((day: string) => !!tinted?.has(day), [tinted]);
  const spans = useMemo(() => view === 'day' && shading && availability ? availabilitySpans(availability.value, selected) : [], [view, shading, availability, selected]);

  // Pressing the bar of the Dogovori without a term: the form that proposes one when there is just that one and it may ask; the list otherwise.
  const soleProposal = loose.length === 1 && loose[0].proposesTerm && onProposeTerm ? loose[0] : null;
  const openLoose = () => { if (soleProposal && onProposeTerm) onProposeTerm(soleProposal.id); else setLoosePanel(true); };

  const swipe = useWeekSwipe(step => onSelect(stepDay(view, selected, step)));
  const pull = usePullRefresh(onRefresh, refreshing);
  const step = (direction: -1 | 1) => onSelect(stepDay(view, selected, direction));

  // The page: one scroll under the controls. A view begins at its top, except the day, which begins at the hour that matters.
  const scroller = useRef<ScrollView>(null);
  // Where each part of the view begins within the page, as the system laid it out: read when it is needed (a press, the hour the day begins at),
  // never drawn, so they are held and not state.
  const bodyTop = useRef(0), weekTop = useRef(0);
  const dayTops = useRef<Record<string, number>>({});
  const scrollTo = (y: number, animated = false) => scroller.current?.scrollTo({ y: Math.max(0, y), animated });
  useEffect(() => { scroller.current?.scrollTo({ y: 0, animated: false }); }, [view]);
  const place = (top: { current: number }) => (event: LayoutChangeEvent) => { top.current = event.nativeEvent.layout.y; };
  const chooseInWeek = (day: string) => {
    onSelect(day);
    const y = dayTops.current[day];
    if (y !== undefined) scrollTo(bodyTop.current + weekTop.current + y - sys.space.sm, !reduced);
  };

  const row = (entry: PlannerEntry, day: string, overlap: string | null): ReactNode =>
    <AgendaRow key={entry.key} entry={entry} day={day} onOpen={item => onOpen(item.id)} overlap={overlap} zoneNote={zoneNote} photo={photo} />;

  // The words under the controls when only what the schedule says is shown: the Dogovori did not load (it can be tried again) or came
  // without saying whether they have an exact term (trying again would not change that).
  const notice = partial ? <View style={s.partial}>
    <View style={s.partialLines}><T variant="note" tone="muted">{nothing ? 'Nema termina u kojima uskačete.' : 'Učitani su samo termini u kojima uskačete.'}</T></View>
    {dogovoriFailed ? <V2Action label="Pokušajte ponovo" kind="quiet" compact onPress={onRetryList} /> : null}
  </View> : dogovoriPending && !nothing ? <View accessibilityLiveRegion="polite" style={s.partial}>
    <T variant="note" tone="muted">Još učitavamo Vaše Dogovore. Za sada se vide termini u kojima uskačete.</T>
  </View> : null;
  // Never say a view is empty before every read it depends on has settled.
  const waiting = schedule.state === 'loading' || (ready && (!chosenKnown || (nothing && list.state === 'loading')));
  const failed = schedule.state === 'error' ? <StateView kind="error" art="calendar" title="Raspored nije učitan."
    body={schedule.message ?? 'Proverite vezu pa pokušajte ponovo.'} primary={{ label: 'Pokušajte ponovo', onPress: onRetry, disabled: retrying }} /> : null;
  const stateOf = failed ?? (waiting ? LOADING : null);

  const stripDays = useMemo<StripDay[]>(() => days.map(day => {
    const entries = byDay?.[day];
    return { day, dots: entries ? dayDots(entries) : null, spoken: daySpoken(day, entries ?? [], { today, now: clock }) };
  }), [days, byDay, today, clock]);

  let body: ReactNode;
  if (view === 'month') {
    const entries = chosenKnown ? dayEntries : [];
    const overlaps = overlapNotes(entries);
    body = <View {...swipe}>
      <MonthView month={month} selected={selected} today={today} now={clock} byDay={byDay} shaded={shaded} onSelect={onSelect} />
      <View style={s.dayList}>
        <T variant="heading" accessibilityRole="header">{dayLabel(selected, today, clock)}</T>
        {stateOf ?? (entries.length ? <View style={s.cards}>{notice}{entries.map(entry => row(entry, selected, overlaps.get(entry.key) ?? null))}</View>
          : notice ?? <T variant="note" tone="muted">{EMPTY_DAY}</T>)}
      </View>
    </View>;
  } else if (view === 'week') {
    body = <View {...swipe} onLayout={place(bodyTop)} style={s.stack}>
      <WeekStrip days={stripDays} selected={selected} today={today} onSelect={chooseInWeek} />
      {stateOf ?? <View onLayout={place(weekTop)} style={s.stack}>
        {notice}
        <WeekDays days={days} today={today} now={clock} byDay={byDay ?? {}} partial={partial} row={row} onDayLayout={(day, y) => { dayTops.current[day] = y; }} />
      </View>}
    </View>;
  } else {
    body = <View style={s.stack}>
      {stateOf ?? notice}
      {stateOf ? null : <View {...swipe} onLayout={place(bodyTop)}>
        {dayEntries.length === 0 && !partial ? <T variant="note" tone="muted" style={s.emptyDay}>{EMPTY_DAY}</T> : null}
        <DayView day={selected} entries={dayEntries} spans={spans} now={clock} zoneNote={zoneNote} overlaps={overlapNotes(dayEntries)} photo={photo}
          onOpen={entry => onOpen(entry.id)} row={row} onFocus={y => scrollTo(bodyTop.current + y)} />
      </View>}
    </View>;
  }

  const here = selected === today;
  const goToday = <TodayButton here={here} onPress={() => onSelect(today)} />;
  return <>
    <Screen kind="detail" scroll={false} contentStyle={s.screenBody}
      header={<DetailTopBar title="Raspored" onBack={onBack} right={<View style={s.controls}>{narrow ? null : goToday}<LegendButton shading={shading} /></View>} />}>
      <View style={s.page}>
        <View style={s.fixed}>
          <Segmented appearance="underline" equal options={VIEW_OPTIONS} value={view} onChange={setView} />
          {loose.length ? <LooseBar count={loose.length} hint={soleProposal ? 'Otvara predlog termina' : 'Otvara spisak'} onPress={openLoose} /> : null}
          <PeriodHeader view={view} title={periodTitle(view, selected, today, clock)} zoneNote={zoneNote} below={narrow ? <View style={s.todayLine}>{goToday}</View> : undefined}
            onPrevious={() => step(-1)} onNext={() => step(1)} onRefresh={onRefresh} />
        </View>
        <ScrollView ref={scroller} style={s.fill} contentContainerStyle={s.content} keyboardShouldPersistTaps="handled"
          refreshControl={<RefreshControl refreshing={pull.refreshing} onRefresh={pull.onRefresh} tintColor={sys.color.green} colors={[sys.color.green]} />}>
          {body}
          {/* Set once in a while, read every time: the quiet rows stand under the view, not before it. Two rows of the one list. */}
          {availability || onArchive ? <View style={s.foot}>
            {availability ? <ListRow leading={<ClockArt size={32} />} title="Moja dostupnost" accessibilityLabel="Moja dostupnost" last={!onArchive} onPress={onAvailability} /> : null}
            {onArchive ? <ListRow leading={<FactArt kind="document" size={32} />} title="Arhiva" accessibilityLabel="Arhiva" last onPress={onArchive} /> : null}
          </View> : null}
        </ScrollView>
      </View>
    </Screen>
    {loosePanel ? <LooseSheet entries={loose} onOpen={onOpen} onProposeTerm={onProposeTerm} onClose={() => setLoosePanel(false)} /> : null}
  </>;
}

const s = StyleSheet.create({
  // The screen's own bottom padding goes into the scroll, so the list reaches the bottom edge before it is cut.
  screenBody: { paddingBottom: 0 },
  page: { flex: 1, gap: layout.group },
  fixed: { gap: layout.group },
  fill: { flex: 1 },
  content: { gap: layout.section, paddingBottom: layout.zone },
  controls: { flexDirection: 'row', alignItems: 'center', gap: sys.space.xs },
  // "Danas" under the period at a large text size: its own line, as wide as its word.
  todayLine: { flexDirection: 'row' },
  stack: { gap: layout.group },
  dayList: { gap: layout.group, marginTop: layout.section },
  cards: { gap: layout.group },
  emptyDay: { marginBottom: layout.group },
  partial: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: sys.space.sm },
  partialLines: { flexShrink: 1, gap: sys.space.xs },
  foot: { marginTop: sys.space.sm },
});
