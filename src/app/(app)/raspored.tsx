import { useCallback, useMemo, useState } from 'react';
import { router } from 'expo-router';
import { agreementClientService } from '../../data/agreementClientService';
import { workerAvailabilityClientService } from '../../data/workerAvailabilityClientService';
import { workerCalendarClientService } from '../../data/workerCalendarClientService';
import { useFocusedResource } from '../../hooks/useFocusedResource';
import { useIzvor } from '../../store/uloga';
import { ProfilePhoto } from '../../ui/media/ContextPhotos';
import { AgendaScreen, type AgendaAvailability, type AgendaList, type AgendaSchedule } from '../../ui/calendar/AgendaScreen';
import { monthDistance } from '../../ui/calendar/months';
import { plannerWindow, serbianToday } from '../../ui/calendar/serbianDays';

/**
 * How many months on each side of the middle one the schedule is read for. Five months at a time, so a swipe from month to month reads
 * nothing for two steps either way, and the screen shows its grid with the dots on it at once.
 */
const MONTHS_AROUND = 2;

/**
 * Raspored. The Dogovori of mine, both sides, with their time, as a calendar of three views (Mesec, Nedelja, Dan): the worker schedule (the
 * one authority for the work I confirmed, read once for five months at a time, so a swipe from month to month or week to week reads
 * nothing) and my Dogovori (with their exact window, the same read Dogovori makes). Two reads for the calendar itself, and two more that
 * only a worker's own screen draws from: the hours kept in Dostupnost (the soft shade of the days I can work and the band beside the
 * hours of a day) and the work profile, which says whether that shade is for someone whose profile is active. A person without a work
 * profile has neither: no shade and no "Moja dostupnost". My tasks and my applications are not read here: they are in "Moji zadaci" and
 * "Moje prijave". The screen draws it all together; nothing here decides what anything is. A day is a day of Serbian time, the same as the
 * hours written on it.
 */
export default function Raspored() {
  const [selected, setSelected] = useState(() => serbianToday());
  const month = selected.slice(0, 7);
  // The schedule is read for the month in the middle and two on each side of it, and read again only when the chosen day goes beyond
  // them: weeks and months within them change with no wait.
  const [middle, setMiddle] = useState(month);
  if (monthDistance(month, middle) > MONTHS_AROUND) setMiddle(month);
  const read = useMemo(() => plannerWindow(`${middle}-01`, MONTHS_AROUND), [middle]);
  const { from, to } = read;
  const calendar = useFocusedResource(useCallback(() => workerCalendarClientService.readRange(from, to), [from, to]));
  const agreements = useFocusedResource(useCallback(() => agreementClientService.mojiDogovori({ includeRatings: false }), []));
  const kept = useFocusedResource(useCallback(() => workerAvailabilityClientService.read(), []));
  const izvor = useIzvor();
  const profile = useFocusedResource(useCallback(() => izvor.mojRadnikProfil(), [izvor]));
  const schedule: AgendaSchedule = calendar.error ? { state: 'error', message: null }
    : calendar.data ? calendar.data.ok ? { state: 'ready', events: calendar.data.podatak.events } : { state: 'error', message: calendar.data.poruka }
      : { state: 'loading' };
  const list: AgendaList = agreements.error ? { state: 'error' } : agreements.data ? { state: 'ready', agreements: agreements.data }
    : { state: 'loading' };
  // The hours are shown only for someone whose availability was read (so they have a work profile); the shade is for an ACTIVE profile.
  // A read that failed, or one that has not settled, says nothing: no shade and no row, never a guess.
  const availability: AgendaAvailability | null = kept.data?.ok ? { value: kept.data.podatak, active: profile.data?.stanje === 'ACTIVE' } : null;
  // The calendar's own reads are the page's; the hours and the profile are refreshed with them but never block the calendar.
  const everything = [calendar, agreements, kept, profile];
  // A pull keeps what is on screen under the spinner; a retry after an error reads the schedule from the start.
  const refresh = () => { for (const resource of everything) void resource.refresh('keep'); };
  const retry = () => { void calendar.refresh(); void agreements.refresh('keep'); };
  const retryRest = () => { if (agreements.error) void agreements.refresh('keep'); };
  return <AgendaScreen selected={selected} today={serbianToday()} schedule={schedule} list={list} availability={availability}
    readWindow={read} refreshing={[calendar, agreements].some(resource => !!resource.refreshing)} retrying={calendar.loading}
    onSelect={setSelected} onRefresh={refresh} onRetry={retry} onRetryList={retryRest}
    onBack={() => router.canGoBack() ? router.back() : router.replace('/dogovori')}
    onOpen={id => router.navigate({ pathname: '/dogovor/[id]', params: { id } })}
    // "Predloži termin": the form of Izmene Dogovora that proposes a term, the same one Početna's "Čeka te" and the Dogovor's own menu open.
    onProposeTerm={id => router.navigate({ pathname: '/dogovor/[id]/izmene', params: { id, start: 'propose' } })}
    // The other person's face in a card: their photo, read here (a data client), or the letters of their name while it is read or when they have none.
    photo={(profileId, standIn) => <ProfilePhoto profileId={profileId} size={32} fallback={standIn} />}
    onAvailability={() => router.navigate('/profil/dostupnost')} onArchive={() => router.navigate('/arhiva')} />;
}
