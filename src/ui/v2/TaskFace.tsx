import { StyleSheet, View, type StyleProp, type TextStyle } from 'react-native';
import type { NeedScheduleProjection, NeedUrgencyProjection, Pokrivenost, PotrebaProjekcija, StanjePotrebe } from '../../contracts/projections';
import type { NeedTaskGeographyPoint } from '../../contracts/needFactsV2';
import { hasNeedAttention, type MarketplaceItem } from '../../data/marketplaceView';
import type { FactArtKind } from '../system/FactArt';
import { osobuAkuz, plural } from '../system/plural';
import { sys } from '../system/tokens';
import { T } from '../Text';
import { TITLE_SIZE } from './cardHeadFit';
import { NeedUrgencyBadge } from './NeedUrgencyBadge';

/**
 * A compact work brief: conditional state, title with truthful terms, grouped place/time/material requirements,
 * then human identity and capacity. Long text stays readable; narrower or enlarged-text cards stack whole groups.
 * No helper invents a rating, count, state or price basis, and a word about money never wears an amount's styling.
 * The parts are drawings only: the card is one target and says every fact once (`taskSpoken`).
 * Pure helpers first, then reusable parts for the list and selected map preview.
 */

/* ------------------------------------------------------------------------------------------------ what it says */

/** What stands in the value slot. A retained map card can temporarily await a fresh exact price. */
export type TaskValue =
  | { kind: 'amount'; amount: string; basis: 'ukupno' | 'po osobi' | 'po osobi po satu' | null }
  | { kind: 'offers' }
  | { kind: 'unpriced' }
  | { kind: 'unverified' };

export function taskValue(item: Pick<MarketplaceItem, 'rezimCene' | 'ponudjenaCena' | 'osnovaCene'>): TaskValue {
  if (item.rezimCene === 'OFFERS') return { kind: 'offers' };
  const amount = item.ponudjenaCena?.prikaz;
  if (!amount) return { kind: 'unpriced' };
  // The card says what the number buys in one or two words (A10, B14); the full sentence stays on the detail.
  return { kind: 'amount', amount, basis: item.osnovaCene === 'HOURLY' ? 'po osobi po satu' : item.osnovaCene === 'TOTAL' ? 'ukupno' : item.osnovaCene === 'PER_PERSON' ? 'po osobi' : null };
}

/** The words of a value slot without an amount. They are labels, never drawn as money. */
export const VALUE_WORDS = { offers: 'Tražim ponude', unpriced: 'Cena nije navedena', unverified: 'Cena nije potvrđena' } as const;

/** The value slot as it is heard: the amount with what it buys, or the word. */
export const valueSpoken = (value: TaskValue) => value.kind === 'amount'
  ? value.basis ? `${value.amount} ${value.basis}` : value.amount : VALUE_WORDS[value.kind];

/** Where the task starts, from public data only. Route cards show the pickup/start area only;
 * the full A→B route belongs on detail/map, not in a dense discovery card. */
export function taskPlace(item: Pick<MarketplaceItem, 'detalji' | 'podrucjeTekst'>): { remote: boolean; text: string } {
  if (item.detalji?.rezimLokacije === 'REMOTE') return { remote: true, text: 'Na daljinu' };
  const geography = item.detalji?.geografija;
  if (geography?.mode === 'POINT_TO_POINT' || geography?.mode === 'MULTI_STOP') {
    const from = publicName(geography.start);
    if (from) return { remote: false, text: from };
  }
  return { remote: false, text: item.podrucjeTekst };
}
const publicName = (point: NeedTaskGeographyPoint | undefined) => point?.label?.trim() || point?.area?.trim() || point?.city?.trim() || null;

/**
 * The one requirement a worker decides on, from the task's own conditions, then its vehicles, then its tools. Skills
 * are never read and neither is `uslovi` (skills + tools + vehicles in one list): "Krečenje" under "Krečenje stana" read
 * as a category, which the owner forbids. The skills stay on the detail's requirement list.
 */
export type TaskRequirement = { kind: 'condition' | 'vehicle' | 'tool'; text: string; spoken: string };
export function taskRequirement(item: Pick<MarketplaceItem, 'detalji'>): TaskRequirement | null {
  const needs = item.detalji?.zahtevi;
  if (!needs) return null;
  const clean = (values: readonly string[] | null | undefined) => (values ?? []).map(value => value.trim()).filter(Boolean);
  const conditions = clean(needs.bitniUslovi), vehicles = clean(needs.vozila), tools = clean(needs.alati);
  if (conditions.length) return { kind: 'condition', text: conditions.join(' · '), spoken: `Bitni uslovi: ${conditions.join(', ')}` };
  if (vehicles.length) return { kind: 'vehicle', text: vehicles.join(' · '), spoken: `Potrebno vozilo: ${vehicles.join(', ')}` };
  if (tools.length) return { kind: 'tool', text: tools.join(' · '), spoken: `Potreban alat: ${tools.join(', ')}` };
  return null;
}
/**
 * The fact drawing of each requirement. A vehicle and a tool are FactArt kinds of their own (card review r3 item 5): the
 * picker's Pictogram is a scene for 32 px and above, broke its own size rule at the card's 16 and brought orange in.
 */
export const REQUIREMENT_ART: Record<TaskRequirement['kind'], FactArtKind> = { condition: 'info', vehicle: 'vehicle', tool: 'tool' };

/**
 * "popunjeno" agrees with the number of places filled: "2, 3 and 4 mesta popunjena", and "popunjeno" for 0, 1 and 5 and over (text proposal 2026-10-07, MNOZINA); 12 to 14 are 5-and-over.
 */
const filledWord = (count: number) => { const last = count % 10, tens = count % 100; return last >= 2 && last <= 4 && !(tens >= 12 && tens <= 14) ? 'popunjena' : 'popunjeno'; };
const filledSpoken = (places: Pokrivenost) => `${places.popunjeno} od ${places.ukupno} mesta ${filledWord(places.popunjeno)}`;

/**
 * How many people, said to the one reading it. A worker asks how many places are left ("Traži 2 osobe", "Još 1 od 2
 * mesta"); the owner follows the progress of their own task ("0/2 popunjeno").
 */
export function placesText(places: Pokrivenost, audience: 'worker' | 'owner', display: 'words' | 'fraction' = 'words'): { text: string; spoken: string } {
  // A list card compares filled/total at a glance; its single accessible card still explains the fraction in full.
  // Composer and detail-like previews keep the audience-specific words unless they explicitly opt in.
  if (display === 'fraction') return { text: `${places.popunjeno}/${places.ukupno}`, spoken: filledSpoken(places) };
  if (audience === 'owner') return { text: `${places.popunjeno}/${places.ukupno} popunjeno`, spoken: filledSpoken(places) };
  if (places.preostalo <= 0) return { text: 'Sva mesta su popunjena', spoken: 'Sva mesta su popunjena' };
  if (places.popunjeno <= 0) return { text: `Traži ${osobuAkuz(places.ukupno)}`, spoken: `Traži ${osobuAkuz(places.ukupno)}` };
  return { text: `Još ${places.preostalo} od ${places.ukupno} mesta`, spoken: `Još ${places.preostalo} od ${places.ukupno} mesta` };
}

/**
 * The people a task needs, said to the one reading it on the card (the owner's phone of 8 Oct 2026: "bez 0/1 — ništa ne znači onome ko traži zadatak;
 * broj potrebnih ljudi samo kad je više od jedne osobe, rečima 'Treba 3 osobe'"). A task for ONE person says nothing of it: the ordinary task has no
 * count to read. A task for several says how many it needs, in words, and once some places are filled, how many are left (for a worker) or how far it
 * is (for the owner); a task whose places are all taken says so, whatever its size. Nothing is invented: the numbers are the read's own.
 */
export function capacityWords(places: Pokrivenost, audience: 'worker' | 'owner'): { text: string; spoken: string } | null {
  if (places.preostalo <= 0) return { text: 'Sva mesta su popunjena', spoken: 'Sva mesta su popunjena' };
  if (places.ukupno <= 1) return null;
  if (places.popunjeno <= 0) { const text = `Treba ${osobuAkuz(places.ukupno)}`; return { text, spoken: text }; }
  return audience === 'owner' ? { text: `${places.popunjeno}/${places.ukupno} popunjeno`, spoken: filledSpoken(places) }
    : { text: `${places.popunjeno}/${places.ukupno} nađeno (još ${places.preostalo} slobodno)`, spoken: `${places.popunjeno} od ${places.ukupno} nađeno, još ${places.preostalo} slobodno` };
}

/**
 * A rating is shown with how many reviews it stands on, so a 5,0 from one review never looks like one from fifty.
 * Zero reviews says so; an unknown count (the profile read did not say) shows the rating alone; no rating shows nothing.
 * The same honesty rule as the public profile sheet.
 */
export function ratingWords(rating: string | null | undefined, count: number | null | undefined): { text: string; star: boolean; spoken: string } | null {
  if (count === 0) return { text: 'Još nema ocena', star: false, spoken: 'još nema ocena' };
  if (!rating) return null;
  if (typeof count === 'number' && Number.isSafeInteger(count) && count > 0) {
    return { text: `${rating} (${count})`, star: true, spoken: `ocena ${rating}, ${plural(count, 'ocena', 'ocene', 'ocena')}` };
  }
  return { text: rating, star: true, spoken: `ocena ${rating}` };
}
/** The person as heard: the name, and the honest rating when there is one. */
export function personSpoken(name: string, rating: string | null | undefined, count: number | null | undefined): string {
  const trust = ratingWords(rating, count);
  return trust ? `${name}, ${trust.spoken}` : name;
}

// Capacity already conveys fullness; only draft and closure need separate lifecycle words.
const OWN_STATUS: Partial<Record<StanjePotrebe, string>> = { NACRT: 'Nacrt', ZATVORENA: 'Zatvoren' };
/**
 * The status line, only when it says something: every card in a list of open tasks is open, so that is never said, and
 * a card in a section named for its state (every card under Nacrti is a draft, every card under Istorija is closed) does
 * not repeat it (card review r3 item 10). `sectionSays` is the state the list's own section already names.
 */
export type TaskCardRelation = 'OWNED' | 'APPLIED' | 'UNKNOWN' | 'PENDING';
export function taskStatus(item: MarketplaceItem, relation?: TaskCardRelation, sectionSays?: StanjePotrebe): { text: string; quiet: boolean } | null {
  if ('stanje' in item) {
    if (sectionSays && item.stanje === sectionSays) return null;
    const text = OWN_STATUS[item.stanje];
    return text ? { text, quiet: item.stanje === 'NACRT' || item.stanje === 'ZATVORENA' } : null;
  }
  // A sent application is a paper plane in words, never the tick of something finished.
  return relation === 'OWNED' ? { text: 'Vaš zadatak', quiet: false }
    : relation === 'APPLIED' ? { text: 'Prijava poslata', quiet: false }
    : relation === 'UNKNOWN' ? { text: 'Vaš status nije potvrđen', quiet: true }
    : relation === 'PENDING' ? { text: 'Proveravamo…', quiet: true } : null;
}

/**
 * What my own task asks of me next, from the server's count of applications I can choose among. Unknown (null) draws
 * nothing, never zero; a draft continues its editing; a closed or full task asks nothing. Whether applications wait is
 * the list's own rule (`hasNeedAttention`), the one the "Aktivni" badge and "Treba moja radnja" count by, so the card's
 * foot and that count can never disagree (card review r3 item 7).
 */
export type OwnerNext = { kind: 'waiting'; count: number; text: string } | { kind: 'none' } | { kind: 'draft' } | null;
export function ownerNext(item: PotrebaProjekcija): OwnerNext {
  if (item.stanje === 'NACRT') return { kind: 'draft' };
  if (item.stanje === 'ZATVORENA' || item.pokrivenost.preostalo <= 0) return null;
  const count = item.brojPrijavaZaIzbor;
  if (typeof count !== 'number' || !Number.isSafeInteger(count) || count < 0) return null;
  if (!hasNeedAttention(item)) return count === 0 ? { kind: 'none' } : null;
  return { kind: 'waiting', count, text: plural(count, 'prijava čeka izbor', 'prijave čekaju izbor', 'prijava čeka izbor') };
}

/**
 * Whether a task's term is a confirmed instant: a fixed window that names a start or an end. A flexible range (today,
 * tomorrow, this week, any time on a remote task) and a term the read did not carry are not, and the calendar mark beside
 * them is drawn quiet: green means a fact that IS confirmed, grey a term that is not set (the colour-meaning table in
 * `tokens.ts`, wave-1 review).
 */
export function scheduleConfirmed(schedule: NeedScheduleProjection | undefined): boolean {
  return schedule?.kind === 'FIXED_WINDOW' && (schedule.startsAt != null || schedule.endsAt != null);
}

/**
 * Everything the card shows, as one sentence after its command name, in this order: HITNO, status, the value, where,
 * when, the requirement, the places, the person and what comes next. It is the order the card is drawn in, except that
 * HITNO, drawn after the status on the first line, is said before it. Empty parts are left out.
 */
export function taskSpoken(parts: { status?: string | null; urgent?: boolean; value: TaskValue;
  /** The face draws no word for the amount (the owner, 8 Oct 2026), so it is the face that says what it is: "Budžet 6.000 RSD ukupno". */
  budget?: boolean; place: string; schedule: string;
  requirement?: TaskRequirement | null; places?: string | null; person?: string | null; next?: string | null }): string {
  const value = parts.budget && parts.value.kind === 'amount' ? `Budžet ${valueSpoken(parts.value)}` : valueSpoken(parts.value);
  return [parts.urgent ? 'HITNO' : null, parts.status, value, parts.place, parts.schedule, parts.requirement?.spoken,
    parts.places, parts.person, parts.next].filter((part): part is string => typeof part === 'string' && part.trim().length > 0).join(', ');
}

/* ------------------------------------------------------------------------------------------------ the parts */

/** Line 1. The HITNO badge reads the card's one clock; the card says HITNO itself, so the badge is not a stop of its own. */
export function CardStatus({ status, urgency, now }: { status: { text: string; quiet: boolean } | null; urgency?: NeedUrgencyProjection; now: number }) {
  const tone = status?.quiet ? sys.color.muted : sys.color.green;
  return <View style={s.statusRow}>
    {status ? <View style={s.status}><View style={[s.dot, { backgroundColor: tone }]} />
      <T variant="label" numberOfLines={1} style={[s.statusText, { color: tone }]}>{status.text}</T></View> : <View style={s.grow} />}
    <View importantForAccessibility="no-hide-descendants" accessibilityElementsHidden><NeedUrgencyBadge urgency={urgency} now={now} /></View>
  </View>;
}

/** The orange dot that marks what waits for me: a dot, never an orange fill (R1 critique B1). */
export function WaitingDot() {
  return <View style={s.waitingDot} />;
}

/* ------------------------------------------------------------------ parts other faces share (step 5c, 2026-09-24) */

/**
 * How a status line speaks, for a face whose states are not the task's (an application: Poslata, Izabrana, Povučena).
 * `ink` is a state in progress, `green` a good outcome, `muted` one that is over, and `waiting` something that waits for
 * me (the orange dot and the `warn` words of the waiting foot). The state is said by the dot and the word, never by a
 * coloured card edge.
 */
export type StatusTone = 'ink' | 'green' | 'muted' | 'waiting';
const STATUS_TONES: Record<StatusTone, { dot: string; text: string }> = {
  ink: { dot: sys.color.ink, text: sys.color.ink },
  green: { dot: sys.color.green, text: sys.color.green },
  muted: { dot: sys.color.muted, text: sys.color.muted },
  waiting: { dot: sys.color.orange, text: sys.color.warn },
};

/** Line 1 of a face with its own states: the dot and the word, on the task card's status geometry. */
export function CardStatusLine({ text, tone }: { text: string; tone: StatusTone }) {
  const ink = STATUS_TONES[tone];
  return <View style={s.status}>
    <View testID="card-status-dot" style={[s.dot, { backgroundColor: ink.dot }]} />
    <T variant="label" numberOfLines={1} style={[s.statusText, { color: ink.text }]}>{text}</T>
  </View>;
}

/**
 * The title alone, in the task card's title type, for a face whose value is not beside it. `style` places it (beside a
 * value slot) or quiets it (a title not known yet); the type stays the card's.
 */
export function CardTitle({ title, lines = 2, style }: { title: string; lines?: number; style?: StyleProp<TextStyle> }) {
  return <T style={[s.title, style]} numberOfLines={lines || undefined}>{title}</T>;
}

const s = StyleSheet.create({
  grow: { flex: 1 },
  statusRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  status: { flexDirection: 'row', alignItems: 'center', gap: 7, flexShrink: 1 },
  dot: { width: 6, height: 6, borderRadius: sys.radius.pill },
  statusText: { flexShrink: 1, letterSpacing: 0.3 },
  title: { fontSize: TITLE_SIZE, lineHeight: 26, fontWeight: sys.type.cardTitle.fontWeight, letterSpacing: -0.3, color: sys.color.ink },
  waitingDot: { width: 8, height: 8, borderRadius: sys.radius.pill, backgroundColor: sys.color.orange },
});
