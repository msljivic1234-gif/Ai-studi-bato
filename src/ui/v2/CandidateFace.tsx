import { candidateRatingValue } from '../../data/candidateRating';
import { memo, type ReactNode } from 'react';
import { applicationPriceBasisText } from '../../lib/novac';
import { StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';
import type { KandidatProjekcija } from '../../contracts/projections';
import { needScheduleText } from '../../data/needDetailPresentation';
import { calendarInstant } from '../../lib/calendarTime';
import { DOGOVORENA_ZONA } from '../../lib/dogovorenoVreme';
import { Avatar, type AvatarSize } from '../system/Avatar';
import { FactArt } from '../system/FactArt';
import { FactRow } from '../system/FactRow';
import { Glyph } from '../system/Glyph';
import { layout } from '../system/layout';
import { osoba } from '../system/plural';
import { Surface } from '../system/Surface';
import { useTextScale } from '../system/textScale';
import { sys } from '../system/tokens';
import { usePressLift } from '../system/usePressLift';
import { Press } from '../Press';
import { T } from '../Text';
import { RecordFoot, recordBody, recordFlush } from './offer/RecordParts';
import { PRICE_NOT_STORED, PrijavaPriceText, PrijavaState, prijavaStatusWord, type PrijavaPrice, type PrijavaStatus } from './PrijavaCard';

/**
 * The requester's side of an application (owner's step 7, 2026-09-24; one `Surface record` since 2026-10-08, composition spec 4.7; "Ponude
 * preko stola" since the owner's pick of 2026-10-08). An application is chosen as a PERSON first, and an offer is the person and the
 * price together, so the card is ONE shape for every offer in the list, five rows a person can compare at a glance:
 *
 *   1. the person and the offer: the face (56), the name and the rating with the count it stands on, and the TOTAL on the right in
 *      the same row ("4.500" large, "RSD ukupno" under it): the owner's note is that the price belongs beside the person it is the
 *      price of. An amount nobody stored is words, never a figure ("Cena nije navedena");
 *   2. the term, always: the exact time the person can ("Može: …") or else the task's own, which then applies;
 *   3. how many people they bring, and what they have (a vehicle, a tool: "Ima: Kombi · Trake");
 *   4. one MARK, a dot and a few words, for what can be told from the fields and from nothing else: why the application cannot be
 *      chosen now (the server's own reasons), or, when the list is whole, that it is the lowest price or the best rating among the
 *      applications that can still be chosen. No mark when nothing is true: never a "best", never a guess;
 *   5. their message in quotes, two lines of it;
 *   6. the foot, "Izaberi", for an application that can be chosen now: the one thing to do, a target of its own under a line (the approved
 *      draft R4). It opens the application, where the choice is asked once more and made; the body opens it too.
 *
 * The state chip (Poslata, Viđena, Izabrana, Nije izabrana, Povučena) is only drawn when it says something: every application of the
 * list was sent, so "Poslata" is not repeated on each card, but "Viđena" (the server confirmed that this phone opened it), a chosen
 * one and one that is over are always said. The card is ONE press that opens the application and is heard once, as the person
 * and everything the card shows.
 *
 * Nothing here invents a rating, a count, a time or a state: a missing rating says it is missing, a count is the server's own
 * words, and "Viđena" is said only for an application the server confirmed as seen on this phone (the candidate read merges SUBMITTED,
 * VIEWED and SHORTLISTED into one SELECTABLE and carries no viewed flag; until it does, an application opened earlier reads as
 * a plain one again after a restart, which is still true).
 *
 * Pure helpers first (tested on their own), then the parts the list, the comparison and the offer are built from.
 */

/* ------------------------------------------------------------------------------------------------ what it says */

/** What the service writes when the read carried no rating (`candidateClientService`). */
const NO_RATING = '—';



export { candidateRatingValue } from '../../data/candidateRating';
export type CandidateTrust = { text: string; star: boolean; spoken: string };
/**
 * The rating with the count it stands on, as the read gave them. A star only beside a real figure; a missing rating is
 * said to be missing, never left blank and never replaced by a number. The count is the server's own words (ratings, or
 * finished tasks when the read has no count of ratings) and is shown only when the read had it.
 */
export function candidateTrust(k: Pick<KandidatProjekcija, 'ocenaTekst' | 'recenzijeTekst'>): CandidateTrust {
  const rating = (k.ocenaTekst ?? '').trim(), count = (k.recenzijeTekst ?? '').trim();
  const rated = candidateRatingValue(rating) !== null && count !== '0 ocena';
  if (rated) return { star: true, text: count ? `${rating} · ${count}` : rating, spoken: count ? `ocena ${rating}, ${count}` : `ocena ${rating}` };
  // The read counted the ratings and there are none: that is news the person can read, not a rating that is "unavailable".
  if (count === '0 ocena') return { star: false, text: 'Još nema ocena', spoken: 'još nema ocena' };
  return { star: false, text: count ? `Ocena nije dostupna · ${count}` : 'Ocena nije dostupna',
    spoken: count ? `ocena nije dostupna, ${count}` : 'ocena nije dostupna' };
}

/** What stands in the price row: the total, or the quiet words for a price that was not stored. The people have a place of their own. */
export type CandidateValue = PrijavaPrice;
export const UNPRICED = PRICE_NOT_STORED;
export function candidateValue(k: Pick<KandidatProjekcija, 'cena' | 'pokrivaMesta' | 'osnovaCene'>): CandidateValue {
  const shown = (k.cena?.prikaz ?? '').trim();
  if (!shown || !/\d/.test(shown) || !Number.isSafeInteger(k.cena.iznos) || k.cena.iznos <= 0) return { kind: 'unpriced' };
  // An amount never loses its currency: a figure written without one gets the offer's own.
  const amount = /[A-Za-z€]/.test(shown) ? shown : `${shown} ${k.cena.valuta || 'RSD'}`;
  return { kind: 'amount', amount, basis: applicationPriceBasisText(k.osnovaCene) };
}

/** An amount as it is written, in its figure and its currency ("4.500 RSD" → "4.500", "RSD"): the figure carries the card's right side, the currency is a quiet word. */
export function splitAmount(amount: string): [string, string] {
  const at = amount.lastIndexOf(' ');
  return at > 0 ? [amount.slice(0, at), amount.slice(at + 1)] : [amount, ''];
}

/**
 * What the person says they have: the vehicle and the tools they declared, and nothing else (owner, 2026-10-07: the person with the
 * task sees the vehicles and the tools; the skills stay hidden until the owner confirms them). A task never REQUIRES them, so this is
 * information beside the offer, never a condition. Null when the read carried none (a legacy application declares nothing).
 */
export function candidateHas(k: Pick<KandidatProjekcija, 'dokazPrijave'>): { art: 'vehicle' | 'tool'; text: string } | null {
  const clean = (values: readonly string[] | null | undefined) => (values ?? []).map(value => value.trim()).filter(Boolean);
  const vehicles = clean(k.dokazPrijave?.vozila), tools = clean(k.dokazPrijave?.alati);
  const all = [...vehicles, ...tools];
  return all.length ? { art: vehicles.length ? 'vehicle' : 'tool', text: `Ima: ${all.join(' · ')}` } : null;
}

/**
 * The exact interval the person proposed, in the task's zone (Serbian time when the task has none: an agreed term reads
 * the same on both phones). The zone is named only on a phone that stands in another one. Null when nothing was proposed.
 */
export function candidateTime(k: Pick<KandidatProjekcija, 'predlozeniPocetak' | 'predlozeniKraj'>, timezone?: string | null): string | null {
  const from = calendarInstant(k.predlozeniPocetak), to = calendarInstant(k.predlozeniKraj);
  if (from === null || to === null || from >= to) return null;
  return needScheduleText({ kind: 'FIXED_WINDOW', startsAt: k.predlozeniPocetak ?? null, endsAt: k.predlozeniKraj ?? null }, timezone || DOGOVORENA_ZONA);
}

/**
 * The state of an application as the chip says it (the owner's five words, 2026-10-07). The candidate read merges SUBMITTED, VIEWED
 * and SHORTLISTED into one SELECTABLE and carries no viewed flag, so "Viđena" is only said when the screen knows the server confirmed
 * the view (`viewed`). CLOSED may follow an actual selection and cancellation, so it says "Zatvorena".
 */
export function candidateChip(k: Pick<KandidatProjekcija, 'stanje'>, viewed = false): PrijavaStatus {
  switch (k.stanje) {
    case 'SELECTED': return 'application.selected';
    case 'WITHDRAWN': return 'application.withdrawn';
    case 'CLOSED': return 'application.closed';
    case 'FULL': return 'application.notSelected';
    // Open, whether it can be chosen right now (SELECTABLE) or waits on something (STALE, OVERFILL): it was sent, and perhaps seen.
    default: return viewed ? 'application.seen' : 'application.sent';
  }
}

/** Why an application that the chip alone does not explain is not simply open. The chip is the state; this is only the reason. */
export const CANDIDATE_REASON: Partial<Record<KandidatProjekcija['stanje'], string>> = {
  // The server also maps calendar and readiness failures to STALE. It does not
  // expose which cause won, so the card cannot claim the task was edited.
  STALE: 'Prijava trenutno nije dostupna za izbor.', OVERFILL: 'Više ljudi nego što je preostalo',
  // CLOSED also covers a cancelled agreement whose task may be open for a
  // replacement. The projection does not carry a cause to justify a claim
  // that the whole task has closed.
  CLOSED: 'Prijava više nije u izboru.', FULL: 'Sva mesta su popunjena',
};
export type CandidateTone = 'warn' | 'muted';
/** The reason line, only when it says something: an application that can simply be chosen, and one that was chosen or withdrawn, need none. */
export function candidateStatus(k: Pick<KandidatProjekcija, 'stanje' | 'terminZauzet' | 'osnovaCene'>): { text: string; tone: CandidateTone } | null {
  if (k.terminZauzet && (k.stanje === 'STALE' || k.stanje === 'SELECTABLE')) return {
    text: 'Termin zauzet · preklapa se sa drugim Dogovorom.', tone: 'warn',
  };
  if ((k.stanje === 'SELECTABLE' || k.stanje === 'STALE') && k.osnovaCene !== 'TOTAL' && k.osnovaCene !== 'HOURLY') return {
    text: 'Osnovica cene nije potvrđena. Podnosilac treba da pregleda i potvrdi prijavu.', tone: 'warn',
  };
  const text = CANDIDATE_REASON[k.stanje];
  return text ? { text, tone: k.stanje === 'STALE' || k.stanje === 'OVERFILL' ? 'warn' : 'muted' } : null;
}

/**
 * The term row: the exact time the person can, in the draft's words ("Može: sub 10–14"), or else the task's own term (which then applies, and is
 * what every card of the list says; the proposals are the cards that differ).
 */
export function candidateTerm(k: Pick<KandidatProjekcija, 'predlozeniPocetak' | 'predlozeniKraj'>, timezone: string | null | undefined, taskTerm: string): string {
  const proposed = candidateTime(k, timezone);
  return proposed ? `Može: ${proposed}` : taskTerm;
}

/** The message's first 180 characters, for what is heard before the application is opened. */
export function messagePreview(message: string): { text: string; cut: boolean } {
  const text = Array.from(message).slice(0, 180).join('');
  return { text, cut: text.length < message.length };
}

/**
 * Everything the card shows, as one sentence a screen reader hears after its name: the state, the rating, the term, the price, the
 * people, what the person has, a bounded preview of the message and, for an application that cannot be chosen, why. `measure` is the
 * list's one comparative mark ("Najniža cena"), said last, as the card draws it.
 */
export function candidateSpoken(k: KandidatProjekcija, taskTerm: string, timezone?: string | null, viewed = false, measure?: string | null): string {
  const trust = candidateTrust(k), reason = candidateStatus(k), has = candidateHas(k);
  const message = k.napomena?.trim() ?? '';
  const preview = messagePreview(message);
  const price = candidateValue(k), proposed = candidateTime(k, timezone);
  return [prijavaStatusWord(candidateChip(k, viewed)), `${trust.spoken.charAt(0).toLocaleUpperCase('sr-Latn-RS')}${trust.spoken.slice(1)}`,
    proposed ? `Može: ${proposed}` : `Termin: ${taskTerm}`, price.kind === 'amount' ? `Ponuda: ${price.amount} ${price.basis}` : UNPRICED, osoba(k.pokrivaMesta),
    has?.text ?? null,
    message ? `Poruka: „${preview.text}${preview.cut ? '…' : ''}“. Otvori prijavu za celu poruku` : null, reason?.text.replace(/\.$/, '') ?? measure ?? null]
    .filter((part): part is string => typeof part === 'string' && part.trim().length > 0).join('. ').concat('.');
}

/* ------------------------------------------------------------------------------------------------ the parts */

/** The person's picture: the photo the screen hands in, or the one Avatar with their letters (a drawn person without a name). */
export function CandidateAvatar({ candidate, size, photo }: { candidate: Pick<KandidatProjekcija, 'inicijali'>; size: AvatarSize; photo?: ReactNode }) {
  return <View style={{ width: size, height: size }}>{photo ?? <Avatar initials={candidate.inicijali || null} size={size} />}</View>;
}

/**
 * The rating line: a star only beside a figure. When it wraps, it breaks after the dot and keeps the count whole ("Ocena nije
 * dostupna ·" over "3 završena posla"), never inside the count ("· 3" over "završena posla").
 */
export function CandidateTrustLine({ candidate, lines = 2 }: { candidate: Pick<KandidatProjekcija, 'ocenaTekst' | 'recenzijeTekst'>; lines?: number }) {
  const trust = candidateTrust(candidate);
  const [lead, count] = trust.text.split(' · ');
  const shown = count ? `${lead}${NBSP}· ${count.replace(/ /g, NBSP)}` : trust.text;
  return <View style={s.trust}>
    {trust.star ? <FactArt kind="star" size={16} /> : null}
    <T variant="note" tone="muted" style={s.trustText} numberOfLines={lines}>{shown}</T>
  </View>;
}
const NBSP = ' ';

/** The total of the offer, on the card's right: the figure large and the currency with what it buys under it, or the quiet words of an amount nobody stored. */
function OfferedTotal({ value, stacked }: { value: CandidateValue; stacked: boolean }) {
  if (value.kind !== 'amount') return <T variant="note" tone="muted" style={stacked ? undefined : s.unpriced}>{UNPRICED}</T>;
  const [figure, currency] = splitAmount(value.amount);
  return <View style={stacked ? s.totalStacked : s.total}>
    <T variant="priceSmall" style={s.figure}>{figure}</T>
    <T variant="meta" tone="muted" style={stacked ? undefined : s.currency}>{`${currency} ${value.basis}`.trim()}</T>
  </View>;
}

/** The one mark of a card: a dot and a few words, green for a measured advantage, grey for a plain fact and warm for what blocks a choice. */
export type CandidateMarkTone = 'green' | 'muted' | 'warn';
function CandidateMark({ text, tone }: { text: string; tone: CandidateMarkTone }) {
  return <View style={s.mark}>
    <View style={[s.dot, tone === 'green' ? s.dotGreen : tone === 'warn' ? s.dotWarn : s.dotMuted]} />
    <T variant="note" style={[s.markWords, tone === 'warn' && s.markWarn]}>{text}</T>
  </View>;
}

/**
 * An application in the requester's list: ONE press that opens it, heard as the person and everything the card shows ("Ponude preko
 * stola": see the head of this file for the five rows). The frame is the one `Surface record`; an application that was chosen keeps
 * its semantic green edge, and the frame gives under the finger as ONE object (`usePressLift`, the row rung). `measure` is the
 * list's comparative mark for this application ("Najniža cena"), given only when the list is whole; a reason the server gives for
 * an application that cannot be chosen takes its place. Large text and a narrow window stack the total under the person.
 */
export const CandidateCard = memo(function CandidateCard({ candidate: k, timezone, fallbackTime, viewed = false, onOpen, photo, large, narrow = false, measure = null, disabled = false }: {
  disabled?: boolean;
  candidate: KandidatProjekcija; timezone?: string | null;
  /** The task's own term: what applies when the person proposed none. */ fallbackTime: string;
  /** The server confirmed that this application was seen (see `candidateChip`). */ viewed?: boolean;
  onOpen: () => void; photo?: ReactNode;
  /** The owner's large text: the total stands under the person. */ large: boolean;
  /** A narrow phone uses the same stacked terms. */ narrow?: boolean;
  /** "Najniža cena" or "Najviša ocena": what the whole list says about this application, or nothing. */ measure?: string | null;
}) {
  const lift = usePressLift();
  const chip = candidateChip(k, viewed), reason = candidateStatus(k), has = candidateHas(k), value = candidateValue(k);
  const message = k.napomena?.trim() ?? '';
  const stacked = large || narrow;
  const mark: { text: string; tone: CandidateMarkTone } | null = reason ? { text: reason.text, tone: reason.tone }
    : measure && k.stanje === 'SELECTABLE' && k.mozeIzabrati === true ? { text: measure, tone: 'green' } : null;
  const total = <OfferedTotal value={value} stacked={stacked} />;
  // The one thing to do with an offer that can be chosen now; any other offer (changed, full, closed, chosen, withdrawn) has none.
  const choosable = k.stanje === 'SELECTABLE' && k.mozeIzabrati;
  return <Animated.View style={lift.style}>
    <Surface kind="record" style={[recordFlush, k.stanje === 'SELECTED' && s.chosen]}>
      <Press disabled={disabled} accessibilityState={{ disabled }} accessibilityRole="button" accessibilityLabel={`Pogledajte prijavu: ${k.ime}`}
        accessibilityValue={{ text: candidateSpoken(k, fallbackTime, timezone, viewed, mark && !reason ? mark.text : null) }} accessibilityHint="Otvara celu prijavu."
        haptic="select" scaleTo={1} onPressIn={lift.give} onPressOut={lift.settle} onPress={onOpen} style={recordBody}>
        {chip === 'application.sent' ? null : <PrijavaState status={chip} reason={null} silent />}
        <View style={s.head}>
          <CandidateAvatar candidate={k} size={layout.slotFace} photo={photo} />
          <View style={s.identity}>
            <T variant="bodyStrong" style={s.name}>{k.ime}</T>
            <CandidateTrustLine candidate={k} />
            {stacked ? total : null}
          </View>
          {stacked ? null : total}
        </View>
        <View>
          <FactRow art="calendar" value={candidateTerm(k, timezone, fallbackTime)} />
          <FactRow art="users" value={osoba(k.pokrivaMesta)} />
          {has ? <FactRow art={has.art} value={has.text} /> : null}
        </View>
        {mark || message ? <View style={s.words}>
          {mark ? <CandidateMark text={mark.text} tone={mark.tone} /> : null}
          {message ? <T variant="note" tone="muted" numberOfLines={2}>{`„${message}“`}</T> : null}
        </View> : null}
      </Press>
      {choosable ? <RecordFoot disabled={disabled} label="Izaberi" tone="green" accessibilityLabel={`Izaberi: ${k.ime}`} accessibilityHint="Otvara prijavu, gde izbor potvrđujete."
        onPress={onOpen} onPressIn={lift.give} onPressOut={lift.settle} /> : null}
    </Surface>
  </Animated.View>;
});

/**
 * The height of a comparison column's head at its fullest: the 40 px picture, a three-line name, a two-line rating, the state's
 * chip and a two-line reason, with the gaps between them, at the rounded text scale. The head is the person and then the state; both
 * aligned columns reserve all of it so a long name or a reason cannot shift just one column's cells. Two columns side by side hold
 * their head to it, so their cells line up whatever the names (review r4 rk item 6: a fixed 132 was shorter than a three-line name
 * beside the picture, and the columns slipped).
 */
export function compareIdentityHeight(scale: number): number {
  const text = 3 * sys.type.heading.lineHeight! + 2 * TRUST_LINE + CHIP_HEIGHT + 2 * REASON_LINE;
  return Math.ceil(40 + 3 * COMPARE_IDENTITY_GAP + sys.space.sm + text * scale);
}
const TRUST_LINE = sys.type.note.lineHeight!, COMPARE_IDENTITY_GAP = sys.space.sm, CHIP_HEIGHT = 24, REASON_LINE = sys.type.note.lineHeight!;

/**
 * An application as a comparison column: the person on top, then the state (the same chip as the card), then the same cells in
 * every column and in the card's order — the term, the offer, the people, what the person has — followed by the complete message. A
 * cell is a small grey label over its value, and the cells are told apart by the space between them, not by lines. `aligned` holds
 * the head to one height when two columns stand side by side.
 */
export const CandidateCompareCard = memo(function CandidateCompareCard({ candidate: k, timezone, fallbackTime, viewed = false, onOpen, photo, aligned, disabled = false }: {
  disabled?: boolean;
  candidate: KandidatProjekcija; timezone?: string | null; fallbackTime: string; viewed?: boolean; onOpen: () => void; photo?: ReactNode; aligned: boolean;
}) {
  const reason = candidateStatus(k), value = candidateValue(k), message = k.napomena?.trim() ?? '', has = candidateHas(k);
  const scale = useTextScale();
  const lift = usePressLift();
  return <Animated.View style={[s.column, lift.style]}>
    <Surface kind="record" style={[recordFlush, s.column, k.stanje === 'SELECTED' && s.chosen]}>
      <Press disabled={disabled} accessibilityState={{ disabled }} accessibilityRole="button" accessibilityLabel={`Otvori prijavu: ${k.ime}`}
        accessibilityValue={{ text: candidateSpoken(k, fallbackTime, timezone, viewed) }} accessibilityHint="Otvara celu prijavu."
        haptic="select" scaleTo={1} onPressIn={lift.give} onPressOut={lift.settle} onPress={onOpen} style={[recordBody, s.columnBody]}>
        <View style={[s.compareHead, aligned && { minHeight: compareIdentityHeight(scale) }]}>
          <View style={[s.compareIdentity, !aligned && s.comparePhoneHead]}>
            <CandidateAvatar candidate={k} size={40} photo={photo} />
            <View style={[!aligned && s.identity, s.comparePersonCopy]}>
              <T variant="heading" style={s.compareName} numberOfLines={aligned ? 3 : undefined}>{k.ime}</T>
              <CandidateTrustLine candidate={k} />
            </View>
          </View>
          <PrijavaState status={candidateChip(k, viewed)} reason={reason ? { text: reason.text, tone: reason.tone } : null} silent />
        </View>
        <View style={s.cell}><T variant="label" tone="muted">Termin</T><T variant="note">{candidateTerm(k, timezone, fallbackTime)}</T></View>
        {/* A column reads from its left edge: the quiet words too (review r4 rk item 7). */}
        <View style={s.cell}><T variant="label" tone="muted">Ponuda</T><PrijavaPriceText price={value} large={false} /></View>
        <View style={s.cell}><T variant="label" tone="muted">Ljudi</T><T variant="bodyStrong">{osoba(k.pokrivaMesta)}</T></View>
        {has ? <View style={s.cell}><T variant="label" tone="muted">Ima</T><T variant="note">{has.text.replace(/^Ima: /, '')}</T></View> : null}
        {message ? <View style={s.cell}><T variant="label" tone="muted">Poruka</T><T variant="note" tone="muted">{message}</T></View> : null}
      </Press>
    </Surface>
  </Animated.View>;
});

/**
 * The person at the head of their offer, under the sheet's title, which is their name (review r4 rk item 3): the 56 px
 * picture and the rating beside it. The name is not drawn again; the row still says it to a screen reader, as the person
 * first, with what a press does as its hint (as the task's poster row is). It opens their public profile.
 */
export function CandidatePerson({ candidate: k, photo, onPress, disabled = false }: {
  candidate: KandidatProjekcija; photo?: ReactNode; onPress: () => void; disabled?: boolean;
}) {
  const trust = candidateTrust(k);
  // No heading role inside the press: a screen reader never reaches a heading that lives in a button (review r4 rk item
  // 3). The sheet's own title is the heading.
  return <Press accessibilityRole="button" accessibilityLabel={`${k.ime}, ${trust.spoken}`} accessibilityHint="Otvara javni profil"
    accessibilityState={{ disabled }} disabled={disabled} haptic="select" scaleTo={sys.motion.scale.row} onPress={onPress} style={s.person}>
    <CandidateAvatar candidate={k} size={layout.slotFace} photo={photo} />
    <View style={s.identity}>
      <CandidateTrustLine candidate={k} lines={3} />
      {/* A visible word for the row (verify r4c item 3): with only the picture and "Ocena nije dostupna" beside the caret,
          the row read as dead or as a link to the rating. It stays while a command runs, as the caret does. */}
      <T variant="bodyStrong" tone="green">Pogledajte profil</T>
    </View>
    <Glyph name="caret-right" size={20} tone="muted" />
  </Press>;
}

const s = StyleSheet.create({
  chosen: { borderColor: sys.color.green },
  identity: { flex: 1, minWidth: 0, gap: sys.space.xs },
  // The person and the offer in one row: the face, the name over the rating, and the total at the end (it keeps its width, the name gives).
  head: { flexDirection: 'row', alignItems: 'center', gap: sys.space.md },
  name: { color: sys.color.ink },
  total: { alignItems: 'flex-end', flexShrink: 0, maxWidth: '40%' },
  totalStacked: { alignItems: 'flex-start' },
  figure: { color: sys.color.money },
  currency: { textAlign: 'right' },
  unpriced: { textAlign: 'right', maxWidth: 110, flexShrink: 0 },
  // The mark and the message are two lines of one thought, 4 apart.
  words: { gap: sys.space.xs },
  mark: { flexDirection: 'row', alignItems: 'center', gap: sys.space.sm },
  dot: { width: sys.space.sm, height: sys.space.sm, borderRadius: sys.radius.pill },
  dotGreen: { backgroundColor: sys.color.green }, dotMuted: { backgroundColor: sys.color.muted }, dotWarn: { backgroundColor: sys.color.orange },
  markWords: { flexShrink: 1, fontWeight: '600', color: sys.color.ink },
  markWarn: { color: sys.color.warn },
  trust: { flexDirection: 'row', alignItems: 'center', gap: sys.space.xs },
  trustText: { flexShrink: 1, fontVariant: ['tabular-nums'] },
  // Two columns share a row of the list and stand level: each fills the height the taller one needs.
  column: { flex: 1, minWidth: 0 },
  columnBody: { flex: 1 },
  compareName: { color: sys.color.ink },
  compareHead: { gap: sys.space.sm },
  compareIdentity: { gap: COMPARE_IDENTITY_GAP },
  comparePhoneHead: { flexDirection: 'row', alignItems: 'center', gap: sys.space.md },
  comparePersonCopy: { gap: COMPARE_IDENTITY_GAP, minWidth: 0 },
  cell: { gap: sys.space.xs },
  person: { flexDirection: 'row', alignItems: 'center', gap: sys.space.md, minHeight: layout.rowMin, paddingVertical: sys.space.xs },
});
