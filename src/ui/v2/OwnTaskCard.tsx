import { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';
import type { PotrebaProjekcija } from '../../contracts/projections';
import { needScheduleText, readableTitle } from '../../data/needDetailPresentation';
import { ownTaskStanding } from '../../data/ownTaskStanding';
import { displaysUrgent } from '../../lib/needUrgency';
import { FactRow } from '../system/FactRow';
import { osoba } from '../system/plural';
import { STATUS_CHIPS, StatusChip } from '../system/StatusChip';
import { Surface } from '../system/Surface';
import { sys } from '../system/tokens';
import { usePressLift } from '../system/usePressLift';
import { Press } from '../Press';
import { T } from '../Text';
import { NeedUrgencyBadge, useUrgencyClock } from './NeedUrgencyBadge';
import { TaskDecisionValue } from './detail/TaskDecision';
import { RecordFoot, recordBody, recordFlush } from './offer/RecordParts';
import { taskPlace, taskSpoken, taskValue } from './TaskFace';

/**
 * One of MY tasks in the "Moji zadaci" list (plan 2.2 and 3.5, owner 2026-10-07; composition spec 4.5, 2026-10-08). It is a
 * `Surface record` of about 200 dp where it used to be 304, because it says the same things in one rhythm (16 inside, 12 between
 * the parts), and since the owner's phone of 8 Oct 2026 in the SAME words as the card of the Zadaci family (one card look):
 *
 *   1. the state, as the app's one `StatusChip` in the owner's eight words (Nacrt, Objavljen, Bira se · N, Dogovoren, U toku, Završen,
 *      Otkazan, Istekao); every row that has an honest word wears one (`ownTaskStanding` says which, and says nothing it cannot
 *      support). HITNO keeps its badge beside the chip (a word with a symbol, never a colour alone); it counts only until the
 *      server's expiry, on one clock;
 *   2. the title (18/24, two lines at most; the whole of it is what a screen reader hears);
 *   3. the facts as rows of one kind, each with its picture: what it pays (the sum with what it buys, or the price tag and "Tražim ponude"; a
 *      word is never drawn as an amount), where, when and chosen/required people. Drafts show the requirement when more than one person is needed;
 *   4. the ONE line of data ("Još nema prijava", "3 prijave"). When it is the way to the applications waiting for my choice it is the card's
 *      foot ("noga"), its own target under a line and never inside the body: one touch to the applications instead of two. Only a task that
 *      waits for my decision has a foot; any other line is a quiet line of the body, and a draft has none.
 *
 * "Čeka prijave" is not a word of this row: it said "has applications" and read as "has none". The body opens the task, as it always
 * did. The frame gives under the finger as ONE object (`usePressLift`, the row rung, 0.985), and nothing moves under reduced motion.
 * The requirement of the task (a vehicle, a tool) is not drawn here: I wrote it, and the task shows it.
 */
function OwnTaskCardBase({ item, onOpen, onApplications, disabled = false, sectionSays = false }: {
  item: PotrebaProjekcija; onOpen: () => void;
  /** Opens the applications that wait for my choice. Without it the next step is still said, as a plain sentence. */
  onApplications?: () => void;
  disabled?: boolean;
  /**
   * The list's own group already says what state the task is in ("Čeka tvoj izbor", "Objavljeno", "Dogovoreno", or the list of drafts), so
   * the card does not wear the state chip a second time (a division said twice, "Papir na stolu", the owner's pick of 2026-10-08). HITNO
   * keeps its badge, and the card is still heard with its state, so it stands alone for a screen reader that lands on it.
   */
  sectionSays?: boolean;
}) {
  const title = readableTitle(item.naslov);
  const standing = ownTaskStanding(item);
  const chip = standing.chip;
  // What is drawn: the chip, unless the group the card stands in says it already.
  const drawnChip = sectionSays ? null : chip;
  const urgencyNow = useUrgencyClock([item.urgency]);
  const urgent = displaysUrgent(item.urgency, urgencyNow);
  const value = taskValue(item);
  const place = taskPlace(item);
  const schedule = item.schedule ? needScheduleText(place.remote && item.schedule.kind === 'REMOTE_ANYTIME'
    ? { ...item.schedule, kind: 'FLEXIBLE' } : item.schedule, item.taskTimezone) : item.vremeTekst;
  const foot = standing.toApplications && onApplications ? standing.next : null;
  const sentence = foot ? null : standing.next;
  const chipWords = chip ? `${STATUS_CHIPS[chip.status].word}${chip.detail ? `, ${chip.detail}` : ''}` : null;
  // Capacity is independent from applications: eight applications can still mean 0/2 chosen.
  // Drafts show only their requirement. Unknown capacity must not become a made-up zero.
  const { ukupno, popunjeno } = item.pokrivenost;
  const knownCapacity = Number.isSafeInteger(ukupno) && ukupno > 0 && Number.isSafeInteger(popunjeno) && popunjeno >= 0 && popunjeno <= ukupno;
  const people = item.stanje === 'NACRT'
    ? ukupno > 1 ? `Treba ${osoba(ukupno)}` : null
    : knownCapacity ? `${popunjeno}/${ukupno} izabrano` : 'Popunjenost nije dostupna';
  const spokenPeople = item.stanje === 'NACRT' ? people
    : knownCapacity ? `Izabrani izvršioci: ${popunjeno} od ${ukupno}` : people;
  const spoken = taskSpoken({ status: chipWords, urgent, value, budget: true, place: place.text, schedule, requirement: null,
    places: spokenPeople, next: sentence });
  const lift = usePressLift();

  return <Animated.View style={lift.style}>
    <Surface kind="record" style={recordFlush}>
      <Press accessibilityRole="button" accessibilityLabel={`Otvori zadatak ${title}`} accessibilityValue={{ text: spoken }}
        accessibilityState={{ disabled }} disabled={disabled} onPress={onOpen} onPressIn={lift.give} onPressOut={lift.settle} haptic="select" scaleTo={1}
        style={recordBody}>
        <View pointerEvents="none">
          {drawnChip || urgent ? <View style={s.top}>
            {/* The card is heard once, as one sentence (`taskSpoken`); its chip and badge are not stops of their own. */}
            {drawnChip ? <View importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
              <StatusChip status={drawnChip.status} detail={drawnChip.detail} /></View> : <View style={s.grow} />}
            <View importantForAccessibility="no-hide-descendants" accessibilityElementsHidden><NeedUrgencyBadge urgency={item.urgency} now={urgencyNow} /></View>
          </View> : null}
          <T variant="heading" numberOfLines={2}>{title}</T>
          <View style={s.facts}>
            <TaskDecisionValue need={item} size="card" />
            <FactRow art={place.remote ? 'remote' : 'pin'} value={place.text} />
            <FactRow art="calendar" value={schedule} />
            {people ? <FactRow art="users" value={people} /> : null}
          </View>
          {sentence ? <T variant="note" tone="muted">{sentence}</T> : null}
        </View>
      </Press>
      {foot ? <RecordFoot label={foot} tone="muted" accessibilityLabel={`Pogledajte prijave, ${foot}. Zadatak: ${title}`} accessibilityHint="Otvara prijave za izbor."
        disabled={disabled} onPress={onApplications!} onPressIn={lift.give} onPressOut={lift.settle} /> : null}
    </Surface>
  </Animated.View>;
}
export const OwnTaskCard = memo(OwnTaskCardBase);

const s = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: sys.space.sm },
  grow: { flex: 1 },
  // The facts stand 4 apart, as in the card of the Zadaci family: the rows are one group.
  facts: { gap: sys.space.xs },
});
