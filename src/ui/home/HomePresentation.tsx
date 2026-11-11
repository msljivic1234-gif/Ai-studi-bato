import { useRef, type ReactNode } from 'react';
import { ActivityIndicator, RefreshControl, StyleSheet, View } from 'react-native';
import { readableTitle } from '../../data/needDetailPresentation';
import { Avatar } from '../system/Avatar';
import { FactArt, type FactArtKind } from '../system/FactArt';
import type { HomeAttention, HomeRaspored, HomeRow, HomeSection, HomeSnapshot, HomeTarget } from '../../data/homeSnapshot';
import type { OwnedTaskCounts } from '../../data/marketplaceView';
import type { ApplicationCounts } from '../../data/myApplicationsView';
import { ScreenHeader } from '../system/ScreenHeader';
import { Press } from '../Press';
import { Appear, useAppear } from '../system/Appear';
import { ListRow } from '../system/ListRow';
import { Screen } from '../system/Screen';
import { Section } from '../system/Section';
import { Surface } from '../system/Surface';
import { layout } from '../system/layout';
import { T } from '../Text';
import { V2Action } from '../v2/V2Action';
import { sys } from '../system/tokens';
import { plural, prijava } from '../system/plural';
import { useLayoutClass } from '../system/textScale';
import { usePullRefresh } from '../system/usePullRefresh';
import { HomeLaunchArt } from './HomeLaunchArt';
import { HowItWorks } from './HowItWorks';

/** Two main actions, the next appointment, real pending work and the account's lists.
 * Empty attention stays hidden; failures retain explicit recovery. One account owns both roles.
 * Current design authority: docs/product/USKOCI_PRODUCT_UX_MASTER.md, S01.
 */
export type HomePresentationProps = {
  /** Only the focused live route starts decorative motion; galleries stay still. */
  active?: boolean;
  home: HomeSnapshot | null; loading: boolean; refreshing: boolean; error: boolean;
  /**
   * The last read failed but what is on screen is the last one that worked (the route keeps it through a failed re-read): the
   * screen says so in one line and keeps the content (R31). `error` is the other case, where there is nothing to show.
   */
  stale?: boolean;
  /** Internal galleries supply the same chrome with an inert bell; the live header remains the default. */
  header?: ReactNode;
  /** Account-owned AI conversations, read separately from tasks and decisions. */
  intakeResume?: ReactNode;
  onPublish: () => void; onEarn: () => void; onProfile: () => void; onOpen: (target: HomeTarget) => void;
  /**
   * What waits for my rating. With the one Dogovor's id (the Dogovori read already gave it) the route opens that
   * rating; with null — several, or none known — it opens Dogovori, where each one waits (critique A1, 2026-09-24).
   */
  onRatings: (agreementId: string | null) => void;
  onMyTasks: () => void; onMyApplications: () => void; onRefresh: () => void;
  /** Saved availability is a fact; its action continues the AI conversation. */
  availableNow?: { value: boolean; onEdit: () => void };
  /**
   * The face of the other person in the card of the next Dogovor. The route hands over the element that reads their photo (a data
   * client), exactly as it hands over the header's avatar; the presentation passes the stand-in it would draw itself
   * (their initials, or a drawn person). Without it, or without a profile id, the stand-in is the face.
   */
  photo?: (profileId: string, standIn: ReactNode) => ReactNode;
  workProfileRead?: HomeOptionalRead;
};

type HomeOptionalRead = { loading: boolean; refreshing: boolean; error: boolean; stale: boolean; onRetry: () => void };

/** The work-profile read recovers independently from the account's core overview. */
function WorkProfileReadState({ state }: { state?: HomeOptionalRead }) {
  if (!state || !state.loading && !state.refreshing && !state.error && !state.stale) return null;
  return <View testID="home-worker-read" style={s.recovery}>
    <T variant="note" tone="muted" accessibilityRole={state.error || state.stale ? 'alert' : undefined}>
      {state.loading ? 'Učitavamo radni profil…'
        : state.refreshing ? 'Osvežavamo radni profil…'
          : state.stale ? 'Radni profil nije osvežen. Prikazano je poslednje učitano.' : 'Radni profil trenutno nije učitan.'}
    </T>
    {state.error || state.stale || state.refreshing ? <V2Action kind="quiet" compact tone="neutral" label="Osvežite radni profil"
      loading={state.refreshing} disabled={state.loading || state.refreshing} onPress={state.onRetry} /> : null}
  </View>;
}

/** Illustrations identify the two intentions; text and touch area grow independently. */
const DOOR_ART = 48;
/** How many things "Čeka Vas" draws (the blueprint of 8 Oct 2026, T3): a list that is longer is counted, not scrolled. */
export const WAITING_LIMIT = 3;

/** Equal intentions, without a persistent account role. Large text uses full-width rows. */
function StartActions({ onPublish, onEarn }: { onPublish: () => void; onEarn: () => void }) {
  const { stacked } = useLayoutClass();
  return <View testID="home-intentions" style={[s.actions, stacked && s.actionsStacked]}>
    <Press accessibilityRole="button" accessibilityLabel="Objavite zadatak" accessibilityHint="Opišite šta Vam treba."
      haptic="select" onPress={onPublish} scaleTo={sys.motion.scale.row} style={[s.door, s.publishDoor, stacked && s.doorStacked]}>
      <View style={[s.doorMain, stacked && s.doorMainStacked]}>
        <HomeLaunchArt kind="publish" size={DOOR_ART} />
        <View style={s.doorCopy}>
          <T variant="heading" style={s.doorTitle}>Objavite zadatak</T>
          <T variant="note" tone="muted">Opišite šta Vam treba.</T>
        </View>
      </View>
    </Press>
    <Press accessibilityRole="button" accessibilityLabel="Uskočite i zaradite" accessibilityHint="Pronađite zadatak."
      haptic="select" onPress={onEarn} scaleTo={sys.motion.scale.row} style={[s.door, s.earnDoor, stacked && s.doorStacked]}>
      <View style={[s.doorMain, stacked && s.doorMainStacked]}>
        <HomeLaunchArt kind="discover" size={DOOR_ART} />
        <View style={s.doorCopy}>
          <T variant="heading" style={s.doorTitle}>Uskočite i zaradite</T>
          <T variant="note" tone="muted">Pronađite zadatak.</T>
        </View>
      </View>
    </Press>
  </View>;
}

/** The picture a kind of waiting row is drawn with: the same coloured illustration the cards use for this kind of thing. */
function artFor(target: HomeTarget): FactArtKind {
  switch (target.kind) {
    case 'CANDIDATES': return 'users';
    case 'APPLICATION': return 'applications';
    case 'AGREEMENT': case 'AGREEMENT_CHANGE': return 'agreements';
    case 'AGREEMENT_TERM': return 'calendar';
    case 'WORKER_PROFILE': return 'users';
    default: return 'tasks';
  }
}

/** Something here waits for me: an orange dot on the picture, the one mark of attention (B1). A row that only suggests has none. */
function Marked({ art, attention }: { art: FactArtKind; attention: boolean }) {
  return <View>
    <FactArt kind={art} size={32} />
    {attention ? <View testID="attention-dot" style={s.attentionDot} /> : null}
  </View>;
}

/** "2 prijave · čeka tvoj izbor": two short parts on one line, the second one in the lower case of a sentence's middle. */
const joined = (first: string, second: string) => `${first} · ${second.replace(/\.$/, '').replace(/^\p{Lu}/u, letter => letter.toLowerCase())}`;

/**
 * One thing that waits for me. The subject leads (the task, in 16/24) and the exact action is under it, and that is all the eye is
 * given: the reason the server or the phone keeps ("Termin još nije dogovoren.", "Nacrt još nije objavljen.") said the action a second
 * time, and the owner's phone showed it as a third line (8 Oct 2026). A row about a pile of applications keeps count and action on one
 * line ("2 prijave · čeka tvoj izbor"), because the count alone does not say what is asked. A row the server or the phone could not name
 * a task for leads with its action and the reason under it. The whole row is one stop for a screen reader and says the same words in
 * the same order, the reason included.
 */
function WaitingRow({ row, onOpen, last }: { row: HomeAttention; onOpen: (target: HomeTarget) => void; last: boolean }) {
  const taskTitle = row.taskTitle === undefined ? null : readableTitle(row.taskTitle);
  const title = readableTitle(row.title);
  const compact = !!taskTitle && row.target.kind === 'CANDIDATES';
  const words = taskTitle ? { title: taskTitle, subtitle: compact ? joined(title, row.detail) : title } : { title, subtitle: row.detail };
  return <ListRow leading={<Marked art={artFor(row.target)} attention />} {...words} last={last} onPress={() => onOpen(row.target)}
    accessibilityLabel={[title, taskTitle, row.detail].filter(Boolean).join('. ')} />;
}

/** The width and height of the other person's face in the card of the next Dogovor. */
const FACE = 32;
/** The calendar at the end of the time's line: small, so the time stays the largest thing on the screen. */
const CALENDAR = 32;

/**
 * The next accepted appointment, the time first and largest (owner, 2026-10-07; "Danas u 14", 2026-10-08): when it is, in Serbian
 * time and from the accepted instant (`raspored.when`, never the display sentence), in the voice of money (`priceLarge`: ink, 700,
 * tabular figures, so the clocks line up), then what it is, who it is with, and the one quiet line about the rest. The calendar
 * stands at 32 at the end of the time's line (not larger: it would compete with the time) and says nothing the words do not say.
 * It is the same record a Dogovor is in Dogovori (one shadow, one corner, 16 inside); the whole card opens the Dogovor. The whole
 * schedule is not reached from here: Raspored has one door, Dogovori (the blueprint of 8 Oct 2026). The time is a fact: it is never
 * animated.
 */
function RasporedCard({ row, raspored, photo, onOpen }: {
  row: HomeRow; raspored: HomeRaspored; photo?: HomePresentationProps['photo']; onOpen: (target: HomeTarget) => void;
}) {
  const appointment = row.appointment, title = readableTitle(row.title);
  const name = appointment?.counterpartName ?? '', role = appointment?.roleLabel ?? null;
  const standIn = <Avatar initials={appointment?.counterpartInitials} size={FACE} />;
  const profileId = appointment?.counterpartProfileId;
  const face = profileId && photo ? photo(profileId, standIn) : standIn;
  // "Po vremenu u Srbiji" inside a sentence: only its first letter gives way ("Srbiji" is a name).
  const zone = raspored.zone ? `, ${raspored.zone.charAt(0).toLowerCase()}${raspored.zone.slice(1)}` : '';
  const spoken = [`${raspored.spoken}${zone}`, title, [name, role].filter(Boolean).join(', '), raspored.more].filter(Boolean).join('. ');
  return <Surface kind="record" accessibilityLabel={spoken} accessibilityHint="Otvara Dogovor." onPress={() => onOpen(row.target)} style={s.appointment}>
    <View style={s.appointmentHead}>
      <View style={s.appointmentWhen}>
        <T variant="priceLarge" style={s.appointmentDay}>{raspored.when}</T>
        {/* A phone set to another zone, or one that does not say, is told which time this is (the planner's own rule). */}
        {raspored.zone ? <T variant="meta" tone="muted">{raspored.zone}</T> : null}
      </View>
      <FactArt kind="calendar" size={CALENDAR} />
    </View>
    <T>{title}</T>
    {name || role ? <View style={s.appointmentPerson}>
      <View accessible={false} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden style={s.face}>{face}</View>
      <View style={s.copy}>
        {name ? <T variant="note" style={s.appointmentName}>{name}</T> : null}
        {role ? <T variant="meta" tone="muted">{role}</T> : null}
      </View>
    </View> : null}
    {raspored.more ? <T variant="note" tone="muted">{raspored.more}</T> : null}
  </Surface>;
}

/** Without an appointment ahead, the first waiting task leads. Its action stays directly below, at the same destination. */
function FirstWaiting({ row, onOpen }: { row: HomeAttention; onOpen: (target: HomeTarget) => void }) {
  const title = readableTitle(row.title), taskTitle = row.taskTitle === undefined ? null : readableTitle(row.taskTitle);
  const subtitle = taskTitle ? row.target.kind === 'CANDIDATES' ? joined(title, row.detail) : title : row.detail;
  return <Surface kind="record" onPress={() => onOpen(row.target)} accessibilityLabel={[taskTitle, title, row.detail].filter(Boolean).join('. ')} style={s.appointment}>
    <View style={s.appointmentHead}>
      <View style={s.appointmentWhen}>
        <T variant="heading" style={s.appointmentDay}>{taskTitle ?? title}</T>
        <T variant="note" tone="muted">{subtitle}</T>
      </View>
      <Marked art={artFor(row.target)} attention />
    </View>
  </Surface>;
}

/** A front door to one of my lists: its name and, once read, what is in it. It opens the list even when unread. */
function MineRow({ art, title, detail, onPress, last = false }: {
  art: FactArtKind; title: string; detail: string | null; onPress: () => void; last?: boolean;
}) {
  return <ListRow leading={<FactArt kind={art} size={32} />} title={title} subtitle={detail ?? undefined} onPress={onPress} last={last}
    accessibilityLabel={detail ? `${title}. ${detail}` : title} />;
}

/** No optimistic availability toggle: the status changes after AI review and Save. */
function AvailableNowRow({ control, last }: { control: NonNullable<HomePresentationProps['availableNow']>; last: boolean }) {
  return <ListRow leading={<FactArt kind="clock" size={32} />} title="Dostupnost" subtitle={control.value ? 'Mogu odmah' : 'Mogu odmah: isključeno'} last={last}
    accessibilityLabel="Izmenite dostupnost kroz razgovor" onPress={control.onEdit} />;
}

/** Said once and quietly: a part of the overview that could not be read names itself, and the shared recovery above retries it. */
function Unavailable({ text }: { text: string }) {
  return <T accessibilityLiveRegion="polite" variant="note" tone="muted">{text}</T>;
}

/**
 * The first read has a calm, truthful status. Its height roughly reserves the old two-row footprint, but no grey shapes suggest
 * that an appointment or pending decision exists before the read confirms one. It stands after the stable doors and list entries:
 * an empty first result therefore cannot pull those controls into a new position merely by removing a placeholder above them.
 */
const INITIAL_READ_HEIGHT = sys.type.heading.lineHeight + layout.group + layout.rowMin * 2;
function HomeInitialLoading() {
  return <View testID="home-initial-loading" accessibilityLiveRegion="polite" style={s.initialLoading}>
    <ActivityIndicator size="small" color={sys.color.green} />
    <T variant="note" tone="muted" style={s.initialLoadingText}>Učitavamo Vaš pregled…</T>
  </View>;
}

// The two doors count what their lists hold, never what waits: that is said once, under "Čeka Vas", from the server's
// own attention list (PKG-042: no inference fallback). A door that also said "1 čeka izbor" contradicted a known empty
// "Čeka Vas", and stood in for it when that list could not be read.
/**
 * "8 aktivnih · 1 nacrt" — the sets of "Moji zadaci", counted by the list's own filter, each with its number (the blueprint of 8 Oct
 * 2026, Z1). A draft that "Čeka Vas" offers to continue is counted here too: the row is the count of the list it opens, and "Nastavi
 * nacrt" is an action; the one does not stand in for the other.
 */
function tasksLine(section: HomeSection<OwnedTaskCounts>): string {
  if (section.kind === 'unavailable') return 'Trenutno nedostupno';
  const c = section.value;
  const parts = [c.active ? plural(c.active, 'aktivan', 'aktivna', 'aktivnih') : null,
    c.drafts ? plural(c.drafts, 'nacrt', 'nacrta', 'nacrta') : null].filter(Boolean);
  return parts.length ? parts.join(' · ') : c.total ? 'Nema aktivnih zadataka' : 'Još nemate zadatak';
}
/**
 * "1 čeka odgovor" — the applications that are open and wait for the other side's answer, counted by the list's own tabs (the blueprint
 * of 8 Oct 2026, Z1 and U8: "Čeka odgovor" is the list's first group). An application that waits for me sits in the list's own "Čeka Vas"
 * set, not among these, so a row with none waiting that is not all finished names how many applications there are instead of saying
 * that none waits over one that does.
 */
function applicationsLine(section: HomeSection<ApplicationCounts>): string {
  if (section.kind === 'unavailable') return 'Trenutno nedostupno';
  const c = section.value;
  if (c.active) return plural(c.active, 'čeka odgovor', 'čekaju odgovor', 'čeka odgovor');
  return !c.total ? 'Još nemate prijavu' : c.finished === c.total ? 'Nijedna ne čeka odgovor' : prijava(c.total);
}

export function HomePresentation(p: HomePresentationProps) {
  const home = p.home;
  const { stacked } = useLayoutClass();
  // A row that was already here when the screen opened has nothing to tell you by sliding in; only a genuinely new one moves,
  // and each list remembers what it has already shown. The first rows after the initial read are news and arrive once (B1).
  const waiting = useAppear(), agreements = useAppear();
  const sawInitialLoading = useRef(false);
  if (p.loading && !home) sawInitialLoading.current = true;
  const prompts = home?.prompts ?? [];
  waiting.settle([...(home?.attention ?? []), ...prompts].map(item => item.id), undefined, { afterLoading: sawInitialLoading.current });
  // Raspored holds the one next appointment that has its day-first words, as a card, and nothing else. With none ahead there is no block
  // (the count of Dogovori with no day, `quietLine`, is no longer drawn here: a weak row, 8 Oct 2026); an active Dogovor is not lost for it,
  // since what it asks of me is said under "Čeka Vas" and all of them stand in Raspored.
  const next = home?.agreements.kind === 'known' ? home.agreements.value.rows[0] ?? null : null;
  const raspored = next?.raspored;
  agreements.settle(next && raspored ? [next.id] : []);
  const attentionUnavailable = home?.attentionState === 'unavailable';
  // Empty attention has no section; unread data keeps its explicit recovery state.
  // Ratings share the next-action section but are not part of the server attention count.
  // Show that count only when no ratings are waiting and their read is complete.
  const waitingShown = !!home && (attentionUnavailable || home.attention.length > 0 || prompts.length > 0 || home.ratingsDue === null
    || home.ratingsDue > 0 || home.attentionMore > 0 || (home.promptsMore ?? 0) > 0);
  // Before the first answer a front door has no line; after a failed read it says so, never "0".
  const tasksDetail = home ? tasksLine(home.mine.tasks) : p.error ? 'Trenutno nedostupno' : null;
  const applicationsDetail = home ? applicationsLine(home.mine.applications) : p.error ? 'Trenutno nedostupno' : null;
  const profile = home?.workerProfile?.kind === 'known' ? home.workerProfile.value : null;
  const setupProfile = !!profile && (profile.state === 'NONE' || profile.state === 'DRAFT');
  const availabilityShown = !!profile && profile.state === 'ACTIVE' && !!p.availableNow;
  // The rows of "Čeka Vas", in the order they are drawn, so only the last one has no divider. At most WAITING_LIMIT of them (the server's
  // things first, then what the phone itself found, then the ratings); what does not fit is counted in the line under them, together with
  // what the server and the phone already said they left out. With no appointment ahead the first of them is the one record of the screen
  // (`FirstWaiting`, "Danas u 14": the focus must not vanish), and the rest stand under it as rows.
  const ratings = home ? (home.ratingsDue === null ? 'unknown' as const : home.ratingsDue > 0 ? 'due' as const : null) : null;
  const everyWait = home ? [...home.attention, ...prompts] : [];
  const waits = everyWait.slice(0, WAITING_LIMIT);
  const ratingsShown = ratings !== null && waits.length < WAITING_LIMIT;
  const more = home ? home.attentionMore + (home.promptsMore ?? 0) + (everyWait.length - waits.length) + (ratings !== null && !ratingsShown ? 1 : 0) : 0;
  const lead = !raspored && !attentionUnavailable && waits.length > 0 ? waits[0] : null;
  const rows = lead ? waits.slice(1) : waits;
  const rowCount = rows.length + (ratingsShown ? 1 : 0);
  const underLead = rowCount > 0 || more > 0;
  const recovery = p.stale ? 'stale' as const : home?.partial ? 'partial' as const : p.error && !home ? 'failed' as const : null;
  // The pull spinner is for a pull. "Osvežite pregled" has a spinner of its own, and no read the route starts by itself may raise the white
  // disc of Android's pull at the top of the screen (the owner's phone, 8 Oct 2026).
  const pull = usePullRefresh(p.onRefresh, p.refreshing);
  return <Screen kind="root" background="wash" header={p.header ?? <ScreenHeader title="Početna" onProfile={p.onProfile} />}
    contentStyle={{ paddingBottom: 100 }}
    refreshControl={<RefreshControl refreshing={pull.refreshing} onRefresh={pull.onRefresh} tintColor={sys.color.green} colors={[sys.color.green]} />}>
    {recovery ? <Surface kind="note" testID="home-recovery" style={s.recovery}>
      <T accessibilityRole="alert" variant="note">{recovery === 'stale' ? 'Nema veze. Prikazano je poslednje učitano.'
        : recovery === 'partial' ? 'Deo pregleda trenutno nije učitan.' : 'Pregled nije učitan. Proverite vezu i pokušajte ponovo.'}</T>
      <V2Action label="Osvežite pregled" kind="secondary" compact loading={p.refreshing} disabled={p.loading || p.refreshing} onPress={p.onRefresh} />
    </Surface> : null}
    {/* Accepted appointments and pending decisions lead. No inferred urgency or invented schedule. */}
    {next && raspored ? <Section title="Sledeće">
      <Appear index={0} animate={agreements.isNew(next.id)}><RasporedCard row={next} raspored={raspored} photo={p.photo} onOpen={p.onOpen} /></Appear>
    </Section> : null}

    {home && waitingShown ? <Section title="Čeka Vas">
      {attentionUnavailable ? <Unavailable text="Ne možemo da učitamo ono što Vas čeka." /> : null}
      {lead ? <View style={underLead ? s.lead : undefined}>
        <Appear index={0} animate={waiting.isNew(lead.id)}><FirstWaiting row={lead} onOpen={p.onOpen} /></Appear>
      </View> : null}
      {rows.map((item, index) => <Appear key={item.id} index={index + (lead ? 1 : 0)} animate={waiting.isNew(item.id)}>
        <WaitingRow row={item} onOpen={p.onOpen} last={index === rowCount - 1} />
      </Appear>)}
      {/* Dogovori/Aktivni lists a completed Dogovor until it is rated; Home names the same thing, verb first, and
          with exactly one it opens that rating in one tap instead of four (critique A1, 2026-09-24). */}
      {ratingsShown && ratings === 'unknown' ? <ListRow leading={<FactArt kind="star" size={32} />} title="Proverite ocene" subtitle="Nisu svi podaci o ocenama učitani."
        onPress={() => p.onRatings(null)} last accessibilityLabel="Proverite ocene u Dogovorima"
        accessibilityHint="Broj Dogovora za ocenjivanje trenutno nije potvrđen." />
        : ratingsShown && ratings === 'due' && home.ratingsDue ? <ListRow leading={<Marked art="star" attention />} title={oceniDogovore(home.ratingsDue)} last
          onPress={() => p.onRatings(home.ratingDueAgreementId)} accessibilityLabel={oceniDogovore(home.ratingsDue)}
          accessibilityHint={home.ratingDueAgreementId ? 'Otvara ocenu saradnje.' : 'Otvara Dogovore.'} /> : null}
      {more > 0 ? <T variant="note" tone="muted" style={s.more}>I još {more} u Vašim zadacima, prijavama i Dogovorima.</T> : null}
    </Section> : null}

    {/* A Dogovori read that failed says so here, never as an empty schedule; with no appointment ahead there is no block and no placeholder. */}
    {home?.agreements.kind === 'unavailable' ? <Section title="Sledeće"><Unavailable text="Ne možemo da učitamo Dogovore." /></Section> : null}

    <StartActions onPublish={p.onPublish} onEarn={p.onEarn} />
    {p.intakeResume}

    {/* My lists stand in one group of rows directly under what is above, with the one section gap and no heading or line of their own. */}
    <View style={s.mineGroup}>
      <MineRow art="tasks" title="Moji zadaci" detail={tasksDetail} onPress={p.onMyTasks} />
      <MineRow art="applications" title="Moje prijave" detail={applicationsDetail} onPress={p.onMyApplications} last={!setupProfile && !availabilityShown} />
      <WorkProfileReadState state={p.workProfileRead} />
      {availabilityShown ? <AvailableNowRow control={p.availableNow!} last={!setupProfile} /> : null}
      {/* R20: until the work profile exists, one row says what it is for and opens its conversation. */}
      {setupProfile ? <ListRow leading={<FactArt kind="users" size={32} />} title="Podesite profil majstora" subtitle="Dobijate zadatke koji Vam odgovaraju."
        onPress={() => p.onOpen({ kind: 'WORKER_PROFILE' })} last accessibilityLabel="Podesite profil majstora. Dobijate zadatke koji Vam odgovaraju." /> : null}
    </View>
    {p.loading && !home ? <HomeInitialLoading /> : null}
    {home?.firstRun ? <HowItWorks stacked={stacked} /> : null}
  </Screen>;
}

/** "Ocenite završen Dogovor" / "Ocenite 2 završena Dogovora" / "Ocenite 5 završenih Dogovora": the verb leads (A1). */
function oceniDogovore(count: number): string {
  return count === 1 ? 'Ocenite završen Dogovor'
    // plural() already carries the count; the emulator showed "2 2 završena Dogovora" when it was added twice.
    : `Ocenite ${plural(count, 'završen Dogovor', 'završena Dogovora', 'završenih Dogovora')}`;
}

const s = StyleSheet.create({
  actions: { flexDirection: 'row', alignItems: 'stretch', gap: layout.group },
  actionsStacked: { flexDirection: 'column' },
  door: { flex: 1, minWidth: 0, minHeight: sys.touch.min, padding: sys.space.base, borderRadius: sys.radius.card },
  doorStacked: { flex: 0 },
  publishDoor: { backgroundColor: sys.color.orangeSoft },
  earnDoor: { backgroundColor: sys.color.greenSoft },
  doorMain: { alignItems: 'flex-start', gap: sys.space.md },
  doorMainStacked: { flexDirection: 'row', alignItems: 'center' },
  doorCopy: { flexShrink: 1, minWidth: 0, gap: sys.space.xs },
  doorTitle: { color: sys.color.ink },
  // Something waits here: the orange dot on the corner of its picture. The white ring keeps it apart from the drawing.
  attentionDot: { position: 'absolute', top: 0, right: 0, width: sys.space.sm, height: sys.space.sm, borderRadius: sys.radius.pill,
    backgroundColor: sys.color.orange, borderWidth: 1, borderColor: sys.color.surface },
  // The appointment is a record; its parts stand 12 apart.
  appointment: { gap: layout.group },
  appointmentHead: { flexDirection: 'row', alignItems: 'flex-start', gap: sys.space.md },
  // The record that leads "Čeka Vas" when no appointment is ahead: a card, so the rows under it stand one card-gap below.
  lead: { paddingBottom: layout.group },
  appointmentWhen: { flex: 1, minWidth: 0, gap: sys.space.xs },
  // The time leads, in black ("Danas · 14:00–16:00"), in the voice of money: `priceLarge` is 700 with tabular figures, so the clocks line up.
  appointmentDay: { color: sys.color.ink },
  appointmentPerson: { flexDirection: 'row', alignItems: 'center', gap: sys.space.md },
  appointmentName: { color: sys.color.ink, fontWeight: '600' },
  face: { width: FACE, height: FACE, flexShrink: 0, borderRadius: sys.radius.pill, overflow: 'hidden' },
  copy: { flex: 1, minWidth: 0, gap: sys.space.xs },
  more: { paddingTop: sys.space.sm },
  recovery: { gap: sys.space.sm, alignItems: 'flex-start' },
  initialLoading: { minHeight: INITIAL_READ_HEIGHT, backgroundColor: sys.color.surface, alignItems: 'center', justifyContent: 'center', gap: sys.space.base },
  initialLoadingText: { textAlign: 'center' },
  mineGroup: { gap: sys.space.sm },
});
