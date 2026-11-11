import { memo, useCallback } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { readableTitle } from '../../data/needDetailPresentation';
import type { DogovorProjekcija } from '../../contracts/projections';
import type { NeedSearchState } from '../../contracts/needSearchRecovery';
import { cancellationOf, type AgreementCancellation, type AgreementCancellations } from '../../data/agreementCancellationClientService';
import { applicationPriceBasisText, BEZ_IZNOSA } from '../../lib/novac';
import { Press } from '../Press';
import { T } from '../Text';
import { ProfilePhoto } from '../media/ContextPhotos';
import { Appear } from '../system/Appear';
import { Avatar } from '../system/Avatar';
import { FactArt } from '../system/FactArt';
import { Glyph } from '../system/Glyph';
import { layout, ruleWidth } from '../system/layout';
import { Surface } from '../system/Surface';
import { plural } from '../system/plural';
import { usePressLift } from '../system/usePressLift';
import { sys } from '../system/tokens';
import { agreementPeople, agreementRole, agreementTerm } from '../v2/AgreementPresentation';
import { WaitingDot } from '../v2/TaskFace';
import { agreementAttention, agreementChip, agreementWhen, awaitsMyConfirmation, cancellationDetailsOf, cancellationLine, groupActiveAgreements, isActiveAgreement, type AgreementAttention, type AgreementTaskGroup, type HistoryFilter } from './agreementListModel';
import { ownerTaskCapacity, ownerTaskId, type OwnerTaskCapacityView } from './ownerTaskCapacity';
import { AgreementStatusChip, agreementChipWord } from './AgreementStatusChip';

/** Recognize the person before opening their agreement; photos and fallback share the same footprint. */
export const AVATAR = 40;

/**
 * A real next action follows the accepted facts: an orange dot and a verb distinguish it on the white reading surface, on ONE line
 * (why it waits is the card's spoken hint, and the chip already says the state). The rating remains its own target; the rule above
 * it is the one line a record may draw ("the foot", composition spec B), the border between two touch zones. One type, the `note`
 * (14/500), in the warm ink.
 */
function AttentionFoot({ attention }: { attention: AgreementAttention }) {
  return <>
    <WaitingDot />
    <View style={s.footCopy}>
      <T variant="note" style={s.footTitle}>{attention.title}</T>
    </View>
    <Glyph name="arrow-right" size={20} tone="muted" />
  </>;
}

/** Pending proposals never replace accepted facts. The label also makes an unchanged price explicit. */
function AcceptedAmount({ item }: { item: DogovorProjekcija }) {
  const amount = item.cena.prikaz;
  if (!amount) return <T variant="note" tone="muted">{BEZ_IZNOSA}</T>;
  return <View style={s.amountBlock}>
    <T variant="meta" tone="muted">{item.osnovaCene === 'HOURLY' ? 'Satnica po osobi po satu' : item.osnovaCene === 'TOTAL' ? item.izmenaCeka ? 'Važeći iznos ove saradnje' : 'Cena ove saradnje' : 'Osnovica cene nije potvrđena'}</T>
    <T variant="priceRow" style={s.amount}>{amount}</T>
  </View>;
}

/** The timezone explains the accepted time, so it stays directly beneath it at the secondary text size. */
function AcceptedTime({ when, place, zone }: { when: string; place: string; zone?: string | null }) {
  return <View style={s.whenBlock}>
    <T variant="note" style={s.when}>{`${when} · ${place}`}</T>
    {zone ? <T variant="meta" tone="muted">{zone}</T> : null}
  </View>;
}

/**
 * One Dogovor of the list. Its height follows the accepted facts and the person's text size; the timezone is secondary to the time.
 * A `record`: the whole card is touched, so it has the shadow and nothing inside it is a card.
 *
 * An own-role eyebrow comes before the other person's face and work title; when and where follow in one
 * grey line ("Danas 14:00 · Novi Sad"); the state chip is on the left and the accepted amount for this collaboration on the right; the orange foot appears ONLY
 * when something waits for me. The body is one press that opens the Dogovor, with no caret: the whole row is the target (B16). The
 * rating is a press of its own, beside the body and never inside it, that goes straight to the rating (A2). Nothing is drawn that the
 * list does not carry: no last message, no rating, no date built from the task. A pending proposal labels the amount "Važeći iznos";
 * otherwise its visible label identifies the individual collaboration. A group says how many people it is in the line under the title.
 *
 * A cancelled Dogovor says when, by whom and why, in one grey line, once the server has answered (`cancellation`, CANCEL-INFO); until
 * then, or if it never does, the chip alone says "Otkazan" and nothing is guessed.
 *
 * The frame gives under the finger as one object, as a task card does, and holds still under reduced motion.
 */

function AgreementCard({ item, now, stale = false, cancellation, capacity, onOpen, onRate, onOpenOwnerTask }: {
  item: DogovorProjekcija; now: number; cancellation?: AgreementCancellation | null;
  stale?: boolean; capacity?: OwnerTaskCapacityView | null; onOpen: () => void; onRate?: () => void; onOpenOwnerTask?: () => void;
}) {
  // The card gives under the finger as ONE object, on the `row` rung of the press ladder (M-07: the one lift of every record).
  const { style: lift, give, settle } = usePressLift();

  const other = item.ucesnici.find(person => !person.viSte);
  const ownRole = item.ucesnici.find(person => person.viSte)?.uloga;
  const roleLabel = ownRole === 'narucilac' ? 'Vi objavljujete' : ownRole === 'uskocer' ? 'Vi uskačete' : null;
  // A retained list is a last-known snapshot. Its urgent action needs a fresh read.
  const attention = stale ? null : agreementAttention(item);
  const title = readableTitle(item.naslov);
  const role = agreementRole(other);
  const name = other?.ime?.trim() || 'Druga strana';
  const at = new Date(now);
  const chip = agreementChip(item, at);
  const term = agreementTerm(item), remote = item.rezim === 'DALJINSKI';
  // The accepted instant, in Serbian time, when the terms carry one; otherwise the adapter's own sentence about the term.
  const when = agreementWhen(item, at) ?? term.line;
  const place = remote ? 'Na daljinu' : item.putanjaTekst || 'Mesto nije navedeno';
  const amount = item.cena.prikaz, people = agreementPeople(item);
  const ownProposal = !!item.izmenaCeka?.mojPredlog;
  const changed = item.verzija > 1 ? 'izmenjeni uslovi' : undefined;
  // Who cancelled and why, only when this Dogovor is cancelled and the server said it (never for any other state).
  const cancelled = item.stanje === 'CANCELLED' ? cancellationDetailsOf(cancellation, other?.ime) : null;
  const cancelledLine = cancelled ? cancellationLine(cancelled, at) : null;
  // The rating foot is its own press only when the route hands over where it goes; otherwise it stays inside the body.
  const rateAside = attention?.kind === 'rate' && onRate ? attention : null;
  const footInside = attention && !rateAside ? attention : null;
  const spoken = [name, role, `${agreementChipWord(chip)}${changed ? `, ${changed}` : ''}`, when, term.zone, amount ? `${item.izmenaCeka ? 'Važeći iznos, ' : ''}${amount} ${applicationPriceBasisText(item.osnovaCene)}` : BEZ_IZNOSA, place, people,
    cancelledLine, ownProposal ? 'Vaša izmena čeka odgovor' : null, item.problemOtvoren ? 'Prijavljen je problem' : null]
    .filter((part): part is string => !!part).join(', ');
  // The one Avatar: a missing name (an empty string since 2026-09-24) draws the person, never an empty disc or a dash.
  const initials = <Avatar initials={other?.inicijali} size={AVATAR} />;
  return <Animated.View style={lift}>
    <Surface kind="record">
      <Press accessibilityRole="button" accessibilityLabel={`Otvori Dogovor ${title}`} accessibilityValue={{ text: spoken }}
        accessibilityHint={footInside ? `${footInside.title}. ${footInside.line}` : undefined} onPress={onOpen}
        onPressIn={give} onPressOut={settle} haptic="select" scaleTo={1} style={s.body}>
        <View style={s.main}>
          {roleLabel ? <T variant="meta" style={s.roleLabel}>{roleLabel}</T> : null}
          <View style={s.head}>
            {other?.profilId ? <ProfilePhoto profileId={other.profilId} size={AVATAR} fallback={initials} /> : initials}
            <View style={s.headCopy}>
              <T variant="heading" numberOfLines={2}>{title}</T>
              <T variant="note" tone="muted">{[role ? `${name} · ${role}` : name, people].filter(Boolean).join(' · ')}</T>
            </View>
          </View>
          {capacity?.count ? <T testID="owner-task-capacity" variant="note" style={s.capacity}>{capacity.count}</T> : null}
          {capacity?.next ? <T variant="note" tone="muted">{capacity.next}</T> : null}
          {/* Accepted facts keep the full row width: the time is the adapter's or the accepted instant's, never shortened or parsed from text. */}
          <AcceptedTime when={when} place={place} zone={term.zone} />
          <View style={s.stateRow}>
            <AgreementStatusChip chip={chip} detail={changed} />
            {/* A missing amount is said in words, quiet and never a figure. */}
            <AcceptedAmount item={item} />
          </View>
          {cancelledLine ? <T variant="note" tone="muted">{cancelledLine}</T> : null}
          {/* My own proposal waits for the other side: a quiet line, not a task of mine. */}
          {ownProposal ? <View style={s.note}><FactArt kind="clock" size={16} muted />
            <T variant="note" tone="muted" style={s.noteText}>Vaša izmena čeka odgovor</T></View> : null}
          {item.problemOtvoren ? <T variant="note" tone="danger">Prijavljen je problem</T> : null}
        </View>
        {footInside ? <View style={s.foot}><AttentionFoot attention={footInside} /></View> : null}
      </Press>
      {capacity && onOpenOwnerTask ? <Press accessibilityRole="button"
        accessibilityLabel={capacity.count ? `Otvori zadatak: ${title}` : `Proveri popunjenost zadatka: ${title}`}
        accessibilityHint="Otvara vlasnikov zadatak i proverava trenutno stanje i dozvoljene radnje."
        onPress={onOpenOwnerTask} haptic="select" style={s.taskFoot}>
        <T variant="note" tone="green">{capacity.count ? 'Otvori zadatak' : 'Proveri popunjenost zadatka'}</T>
        <Glyph name="arrow-right" size={20} tone="green" />
      </Press> : null}
      {/* No hit slop: the rule is the border between the two targets, and a touch just above it opens the Dogovor. */}
      {rateAside ? <Press accessibilityRole="button" accessibilityLabel={`${rateAside.title}, ${title}`} accessibilityHint="Otvara ocenu saradnje."
        onPress={onRate} onPressIn={give} onPressOut={settle} haptic="select" scaleTo={1} hitSlop={0} style={s.foot}>
        <AttentionFoot attention={rateAside} />
      </Press> : null}
    </Surface>
  </Animated.View>;
}

/**
 * One row of the list: the arrival animation and the card. Memoised on the row's own object and primitives, so changing the
 * segment or pulling to refresh re-renders the screen and only the rows whose Dogovor actually changed. The closures over `item`
 * are made here, from the list's stable callbacks. `now` is the minute the groups were taken at, as a number, so a parent render
 * inside the same minute does not draw a card again.
 */
export const AgreementRow = memo(function AgreementRow({ item, index, now, animate, stale = false, cancellation, capacity, onOpen, onRate, onOpenOwnerTask }: {
  item: DogovorProjekcija; index: number; now: number; animate: boolean; cancellation?: AgreementCancellation | null;
  stale?: boolean; capacity?: OwnerTaskCapacityView | null; onOpen: (item: DogovorProjekcija) => void;
  onRate?: (item: DogovorProjekcija) => void; onOpenOwnerTask?: (taskId: string, witness: DogovorProjekcija) => void;
}) {
  const open = useCallback(() => onOpen(item), [onOpen, item]);
  const rate = useCallback(() => onRate?.(item), [onRate, item]);
  const openTask = useCallback(() => { if (capacity) onOpenOwnerTask?.(capacity.taskId, item); }, [capacity, onOpenOwnerTask, item]);
  return <Appear index={index} animate={animate}><AgreementCard item={item} now={now} stale={stale} cancellation={cancellation} capacity={capacity}
    onOpen={open} onRate={onRate ? rate : undefined} onOpenOwnerTask={onOpenOwnerTask && capacity ? openTask : undefined} /></Appear>;
});

/** One task record. Each collaboration keeps its own accepted terms and destination; there is no invented group price/status. */
export const AgreementTaskRow = memo(function AgreementTaskRow({ group, index, now, animate, stale = false, expanded, onExpand, cancellations, ownerCapacities, onOpenOwnerTask, onOpen, onRate, prioritize = 'all' }: {
  group: AgreementTaskGroup; index: number; now: number; animate: boolean; expanded: boolean;
  stale?: boolean;
  prioritize?: HistoryFilter | 'confirmation';
  onExpand: (key: string | null, witness: DogovorProjekcija) => void;
  ownerCapacities?: ReadonlyMap<string, NeedSearchState> | null;
  onOpenOwnerTask?: (taskId: string, witness: DogovorProjekcija) => void;
  cancellations?: AgreementCancellations | null; onOpen: (item: DogovorProjekcija) => void; onRate?: (item: DogovorProjekcija) => void;
}) {
  const first = group.items[0];
  const taskId = ownerTaskId(group);
  const capacity = taskId ? ownerTaskCapacity(group, ownerCapacities?.get(taskId)) : null;
  if (group.items.length === 1) return <AgreementRow item={first} index={index} now={now} animate={animate} stale={stale}
    cancellation={cancellationOf(cancellations, first.id)} capacity={capacity}
    onOpenOwnerTask={onOpenOwnerTask} onOpen={onOpen} onRate={onRate} />;
  const at = new Date(now), title = readableTitle(first.naslov);
  const byUrgency = [...groupActiveAgreements(group.items.filter(isActiveAgreement), at).flatMap(section => section.items), ...group.items.filter(item => !isActiveAgreement(item))];
  // The reason this task matched the current filter is visible without expanding it.
  const matches = (item: DogovorProjekcija) => prioritize === 'confirmation' ? awaitsMyConfirmation(item)
    : prioritize === 'completed' ? item.stanje === 'COMPLETED' : prioritize === 'cancelled' ? item.stanje === 'CANCELLED' : true;
  const ordered = prioritize === 'all' ? byUrgency : [...byUrgency.filter(matches), ...byUrgency.filter(item => !matches(item))];
  const shown = expanded ? ordered : ordered.slice(0, 3);
  const waiting = stale ? 0 : group.items.filter(item => agreementAttention(item)).length;
  const role = first.ucesnici.find(person => person.viSte)?.uloga === 'narucilac' ? 'Tražite pomoć' : 'Uskačete';
  return <Appear index={index} animate={animate}><Surface kind="record">
    <View style={s.taskHead}>
      <T variant="heading">{title}</T>
      <T variant="note" tone="muted">{role} · {plural(group.items.length, 'saradnja', 'saradnje', 'saradnji')} ukupno</T>
      {capacity?.count ? <T testID="owner-task-capacity" variant="note" style={s.capacity}>{capacity.count}</T> : null}
      {capacity?.next ? <T variant="note" tone="muted">{capacity.next}</T> : null}
      {waiting ? <T variant="note" style={s.footTitle}>{plural(waiting, 'obaveza čeka', 'obaveze čekaju', 'obaveza čeka')} Vas</T> : null}
      {capacity && onOpenOwnerTask ? <Press accessibilityRole="button"
        accessibilityLabel={capacity.count ? `Otvori zadatak: ${title}` : `Proveri popunjenost zadatka: ${title}`}
        accessibilityHint="Otvara vlasnikov zadatak i proverava trenutno stanje i dozvoljene radnje."
        onPress={() => onOpenOwnerTask(capacity.taskId, first)} haptic="select" style={s.taskLink}>
        <T variant="note" tone="green">{capacity.count ? 'Otvori zadatak' : 'Proveri popunjenost zadatka'}</T>
        <Glyph name="arrow-right" size={20} tone="green" />
      </Press> : null}
    </View>
    {shown.map(item => <AgreementCollaborator key={item.id} item={item} taskTitle={title} now={at} stale={stale}
      cancellation={cancellationOf(cancellations, item.id)} onOpen={onOpen} onRate={onRate} />)}
    {ordered.length > 3 ? <Press accessibilityRole="button" accessibilityLabel={`${expanded ? 'Sažmi' : 'Prikaži sve'} saradnje za ${title}`}
      accessibilityState={{ expanded }} onPress={() => onExpand(expanded ? null : group.key, first)} haptic="select" style={s.more}>
      <T variant="note">{expanded ? 'Prikaži manje' : `Sve saradnje (${ordered.length})`}</T>
      <Glyph name={expanded ? 'caret-up' : 'caret-down'} size={20} tone="muted" />
    </Press> : null}
  </Surface></Appear>;
});

function AgreementCollaborator({ item, taskTitle, now, stale = false, cancellation, onOpen, onRate }: {
  item: DogovorProjekcija; taskTitle: string; now: Date; cancellation?: AgreementCancellation | null;
  stale?: boolean;
  onOpen: (item: DogovorProjekcija) => void; onRate?: (item: DogovorProjekcija) => void;
}) {
  const other = item.ucesnici.find(person => !person.viSte), name = other?.ime?.trim() || 'Druga strana';
  const chip = agreementChip(item, now), attention = stale ? null : agreementAttention(item), term = agreementTerm(item);
  const when = agreementWhen(item, now) ?? term.line;
  const amount = item.cena.prikaz || BEZ_IZNOSA, people = agreementPeople(item);
  const place = item.rezim === 'DALJINSKI' ? 'Na daljinu' : item.putanjaTekst || 'Mesto nije navedeno';
  const cancelled = item.stanje === 'CANCELLED' ? cancellationDetailsOf(cancellation, other?.ime) : null;
  const spoken = [agreementChipWord(chip), item.verzija > 1 ? 'izmenjeni uslovi' : null, when, term.zone,
    item.cena.prikaz ? `${item.izmenaCeka ? 'Važeći iznos, ' : ''}${amount} ${applicationPriceBasisText(item.osnovaCene)}` : amount, place, people, attention?.title,
    cancelled ? cancellationLine(cancelled, now) : null,
    item.izmenaCeka?.mojPredlog ? 'Vaša izmena čeka odgovor' : null, item.problemOtvoren ? 'Prijavljen je problem' : null].filter(Boolean).join(', ');
  const initials = <Avatar initials={other?.inicijali} size={AVATAR} />;
  return <View style={s.collaborator}>
    <Press accessibilityRole="button" accessibilityLabel={`Otvori Dogovor ${taskTitle}, ${name}`}
      accessibilityValue={{ text: spoken }}
      onPress={() => onOpen(item)} haptic="select" style={s.main}>
      <View style={s.head}>
        {other?.profilId ? <ProfilePhoto profileId={other.profilId} size={AVATAR} fallback={initials} /> : initials}
        <View style={s.headCopy}><T variant="bodyStrong">{name}</T>
          {people ? <T variant="note" tone="muted">{people}</T> : null}
        </View>
        <Glyph name="caret-right" size={20} tone="muted" />
      </View>
      {readableTitle(item.naslov) !== taskTitle ? <T variant="note">{readableTitle(item.naslov)}</T> : null}
      <AcceptedTime when={when} place={place} zone={term.zone} />
      <View style={s.stateRow}><AgreementStatusChip chip={chip} detail={item.verzija > 1 ? 'izmenjeni uslovi' : undefined} />
        <AcceptedAmount item={item} />
      </View>
      {cancelled ? <T variant="note" tone="muted">{cancellationLine(cancelled, now)}</T> : null}
      {item.izmenaCeka?.mojPredlog ? <T variant="note" tone="muted">Vaša izmena čeka odgovor</T> : null}
      {item.problemOtvoren ? <T variant="note" tone="danger">Prijavljen je problem</T> : null}
      {attention && !(attention.kind === 'rate' && onRate) ? <T variant="note" style={s.footTitle}>{attention.title}</T> : null}
    </Press>
    {attention?.kind === 'rate' && onRate ? <Press accessibilityRole="button" accessibilityLabel={`${attention.title}, ${taskTitle}, ${name}`}
      onPress={() => onRate(item)} haptic="select" style={s.more}><AttentionFoot attention={attention} /></Press> : null}
  </View>;
}

const s = StyleSheet.create({
  taskHead: { gap: sys.space.xs, paddingBottom: sys.space.md },
  capacity: { color: sys.color.green, fontWeight: '700' },
  taskLink: { minHeight: layout.touch, flexDirection: 'row', alignItems: 'center', gap: sys.space.sm },
  taskFoot: { minHeight: layout.touch, marginTop: sys.space.sm, borderTopWidth: ruleWidth, borderTopColor: sys.color.line,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: sys.space.sm },
  collaborator: { paddingVertical: sys.space.base, gap: sys.space.sm },
  more: { minHeight: layout.touch, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: sys.space.md },
  body: { borderRadius: 0 },
  main: { gap: sys.space.sm },
  roleLabel: { color: sys.color.green, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4 },
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: sys.space.md },
  headCopy: { flex: 1, minWidth: 0, gap: sys.space.xs },
  when: { color: sys.color.muted, fontVariant: ['tabular-nums'] },
  whenBlock: { gap: sys.space.xs },
  stateRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', columnGap: sys.space.md, rowGap: sys.space.sm },
  amount: { color: sys.color.money, flexShrink: 1 },
  amountBlock: { alignItems: 'flex-end', flexShrink: 1, gap: sys.space.xs },
  note: { flexDirection: 'row', alignItems: 'center', gap: sys.space.sm }, noteText: { flexShrink: 1 },
  // The foot: the one line a record draws, between the two touch zones, then the dot, the verb, and the arrow.
  // It runs down to the card's own edge (the card's 16 under it is its touch row's), so the verb stands in the middle of its 48 dp.
  foot: { flexDirection: 'row', alignItems: 'center', gap: sys.space.md, minHeight: layout.touch, marginTop: sys.space.md, marginBottom: -layout.card,
    borderTopWidth: ruleWidth, borderTopColor: sys.color.line, backgroundColor: sys.color.surface },
  footCopy: { flex: 1, minWidth: 0 },
  footTitle: { color: sys.color.warn },
});
