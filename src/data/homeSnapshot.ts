import type { DogovorProjekcija, MojaPrijavaProjekcija, PotrebaProjekcija, PrilikaProjekcija, RadnikProfilProjekcija } from '../contracts/projections';
import { prijava } from '../ui/system/plural';
import { readableTitle } from './needDetailPresentation';
import { hasNeedAttention, ownedTaskCounts, type OwnedTaskCounts } from './marketplaceView';
import { applicationCounts, type ApplicationCounts } from './myApplicationsView';
import { acceptedTerm, awaitingFinishCount, looseLine, notOver, rasporedOf, withoutTermCount, type HomeRaspored } from '../ui/home/raspored';
import { zonaTelefona } from '../lib/vreme';

/**
 * Početna (owner decision 1, 2026-09-19; the overview of the owner's information architecture, 2026-09-23): what
 * waits for this account, composed on the phone from the three reads that already exist. No mode is consulted: the
 * same account's own tasks, its applications to other people's, and its Dogovori on either side stand next to each
 * other. My own tasks and my applications are two front doors, "Moji zadaci" and "Moje prijave", each counted by the
 * same rule as the list it opens; the preview of their rows ("Moje aktivnosti") is retired, and since 2026-09-24 its
 * address redirects to Početna, so its composition is gone too.
 *
 * PKG-042 supplies server attention separately. The legacy attention composition stays as the
 * historical SQL proof oracle and test-source adapter, never a production fallback after an RPC failure.
 * Production application totals use the existing first-page aggregate. Task draft/total and
 * next-Agreement composition still use complete lists; cutting these lists would lose facts.
 *
 * Raspored (owner, 2026-10-07): the next accepted appointment is told day first in Serbian time, from its accepted
 * instants and from nothing else (`ui/home/raspored.ts`); no new read is made for it. With no appointment ahead, active
 * Dogovori that have no exact term, or whose exact term has passed without being marked done, are still counted in one
 * quiet line (`quietLine`), so an agreement never vanishes from Početna for want of a day to show it on.
 */
export type HomeSection<T> = { kind: 'known'; value: T } | { kind: 'unavailable' };
/**
 * What Početna asks of the account's own work profile (R20, R06): `null` is "this account has none". A caller that does not read
 * it leaves `workerProfile` out of the reads, and the profile is then unknown: no row is drawn and nothing is said about it.
 */
export type HomeWorkProfileRead = Pick<RadnikProfilProjekcija, 'stanje' | 'dostupanOdmah'>;
export type HomeReads = { needs: HomeSection<PotrebaProjekcija[]>;
  /** Production reads exact aggregate counts; full arrays remain the legacy proof/gallery adapter. */
  applications: HomeSection<MojaPrijavaProjekcija[] | ApplicationCounts>;
  agreements: HomeSection<DogovorProjekcija[]>; workerProfile?: HomeSection<HomeWorkProfileRead | null>;
  opportunities?: HomeSection<PrilikaProjekcija[]>; };
export type HomeTarget = { kind: 'NEED'; needId: string } | { kind: 'CANDIDATES'; needId: string }
  | { kind: 'APPLICATION'; applicationId: string } | { kind: 'AGREEMENT'; agreementId: string }
  /** R02: the Dogovor has no term yet. The row opens the form that proposes one (Izmene Dogovora, "Predloži termin"). */
  | { kind: 'AGREEMENT_TERM'; agreementId: string }
  /** The other side proposed a change of the terms and it waits for my answer: the row opens that proposal. */
  | { kind: 'AGREEMENT_CHANGE'; agreementId: string }
  /** R20: the work profile still has to be set up. The row opens its conversation. */
  | { kind: 'WORKER_PROFILE' };
export type HomeAttention = { id: string; title: string; detail: string; target: HomeTarget;
  /** Structured by the live attention decoder. Legacy proof/gallery rows retain their combined detail. */
  taskTitle?: string };
export type HomeAttentionPreview = { rows: HomeAttention[]; more: number; asOf: string;
  /**
   * EX-04 S3 (RC-03): the server's own count of finished Dogovori that wait for MY rating, and the id when exactly one does. Absent from an older server, and then Početna
   * counts from the Dogovori read as before. Present, it is exact and bounded: it does not depend on how many Dogovori there are, or on any list being read.
   */
  ratings?: { due: number; agreementId: string | null } };
export type { HomeRaspored };
export type HomeRow = { id: string; title: string; detail: string; target: HomeTarget;
  /** An accepted term on a CONFIRMED Agreement that is not over (ahead of now, or its exact window under way), never the source task's time. */
  upcoming?: true;
  /**
   * Display facts kept separate for the appointment card; time is already worded by the Agreement projection. The other
   * side's public profile id and initials let the route draw their face (the Dogovori card does the same); null says the
   * server named no profile or no name to take letters from, and the face is then a drawn person.
   */
  appointment?: { timeText: string; counterpartName: string; roleLabel: 'Tvoj zadatak' | 'Uskačeš' | null;
    counterpartProfileId?: string | null; counterpartInitials?: string | null };
  /**
   * "Raspored" (owner, 2026-10-07): only the featured appointment has it, and only when it is `upcoming` with an accepted
   * instant. Its day-first first line is computed from that instant in Serbian time, never from `appointment.timeText`.
   * A row without it has no card (an active Dogovor with no day to show it on is counted in `quietLine` instead).
   */
  raspored?: HomeRaspored };
type Preview<Row> = { rows: Row[]; more: number };
/**
 * The active Dogovori Početna shows. `quietLine` is Raspored without a card: present only when no accepted appointment
 * lies ahead (no row has `raspored`) and some active Dogovori have no day to show them on, so an agreement never vanishes
 * from Početna: those known to have no exact term, and those confirmed whose exact term has passed without being marked
 * done ("2 Dogovora bez tačnog termina · 1 Dogovor čeka završetak"). Absent otherwise.
 */
export type HomeAgreements = Preview<HomeRow> & { quietLine?: string };
/** The account's own work profile as Početna uses it: whether it still has to be set up, and whether the person says they can start now. */
export type HomeWorkProfile = { state: 'NONE' | RadnikProfilProjekcija['stanje']; availableNow: boolean };
export type HomeSnapshot = { attention: HomeAttention[]; attentionMore: number; agreements: HomeSection<HomeAgreements>;
  /**
   * Things that wait for me and that the phone knows from the reads it already makes, not from the server's attention list: a
   * Dogovor with no term (R02), a change the other side proposed, a draft to continue (R18). They follow the server's rows in
   * "Čeka te", up to `HOME_WAITING_LIMIT` rows together; `promptsMore` counts those that did not fit. Both are absent when there
   * is none, so a snapshot without them is exactly the one it was before.
   */
  prompts?: HomeAttention[]; promptsMore?: number;
  /** R20, R06: absent when the profile was not read; `unavailable` when its read failed (nothing is then said about it). */
  workerProfile?: HomeSection<HomeWorkProfile>;
  /** The two front doors. A side that could not be read is unavailable, never zero. */
  mine: { tasks: HomeSection<OwnedTaskCounts>; applications: HomeSection<ApplicationCounts> };
  partial: boolean; attentionState?: 'known' | 'unavailable';
  /** Every read answered and this account has no task, no application, no Dogovor and nothing waiting. */
  firstRun: boolean;
  /** Exact number only after every completed row has a valid receipt; null means unavailable, never zero. */
  ratingsDue: number | null;
  /**
   * When exactly one Dogovor waits for my rating, its id, as the Dogovori read already gave it: Početna then opens that
   * rating in one tap (emulator critique A1, 2026-09-24). With none or several it is null and Početna opens Dogovori.
   */
  ratingDueAgreementId: string | null };

const READ_TIMEOUT_MS = 15_000;
/** One read that fails or hangs costs its own section, never the screen, and never reads as empty. */
export async function readHomeSection<T>(read: (signal: AbortSignal) => Promise<T>, signal?: AbortSignal): Promise<HomeSection<T>> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const controller = new AbortController();
  const retire = () => controller.abort();
  signal?.addEventListener('abort', retire, { once: true });
  let stopped: (() => void) | undefined;
  try {
    if (signal?.aborted) return { kind: 'unavailable' };
    const cancelled = new Promise<never>((_, reject) => {
      stopped = () => reject(new Error('HOME_READ_RETIRED'));
      controller.signal.addEventListener('abort', stopped, { once: true });
      timer = setTimeout(retire, READ_TIMEOUT_MS);
    });
    const value = await Promise.race([read(controller.signal), cancelled]);
    if (controller.signal.aborted) return { kind: 'unavailable' };
    return { kind: 'known', value };
  } catch { return { kind: 'unavailable' }; } finally {
    if (timer) clearTimeout(timer);
    signal?.removeEventListener('abort', retire);
    if (stopped) controller.signal.removeEventListener('abort', stopped);
    controller.abort();
  }
}

/** Independently refreshed content fails its resource read so the last successful value can stay visible.
 * Wrap null because a successful null work profile means "none", not "still unread". */
export async function readHomeOptional<T>(read: (signal: AbortSignal) => Promise<T>, signal?: AbortSignal): Promise<{ value: T }> {
  const section = await readHomeSection(read, signal);
  if (section.kind === 'unavailable') throw new Error('HOME_OPTIONAL_READ_FAILED');
  return { value: section.value };
}

// One next Dogovor (2026-09-23): the rest are one tab away, in Dogovori.
const HOME_ATTENTION_LIMIT = 3, HOME_AGREEMENT_LIMIT = 1;
/** "Čeka te" holds the server's rows (three at most) and the phone's own prompts together: four rows, never a list that crowds out Raspored. */
export const HOME_WAITING_LIMIT = 4;
/** A draft older than this is no longer offered on Početna (R18). */
export const DRAFT_FRESH_DAYS = 7;

/**
 * Whether a draft is recent enough to be offered as "Nastavi nacrt" (R18). The owner read includes an update instant when its
 * receipt is valid. An older reader can still omit it: unknown age is never presented as an old draft.
 */
export function draftIsFresh(updatedAt: string | null | undefined, now: number): boolean {
  if (typeof updatedAt !== 'string') return true;
  const at = Date.parse(updatedAt);
  return Number.isFinite(at) && Number.isFinite(now) ? now - at <= DRAFT_FRESH_DAYS * 86_400_000 : true;
}

/**
 * R02: a confirmed Dogovor whose accepted terms say neither a window nor even a start, with no change waiting to give it one.
 * Both fields have to be there and be empty: a list that did not read the terms leaves them out, and that is not "no term".
 */
export const needsTerm = (row: DogovorProjekcija): boolean => row.stanje === 'CONFIRMED' && row.tacanTermin === null
  && row.prihvacenPocetak === null && !row.izmenaCeka;

const activeApplication = (row: MojaPrijavaProjekcija) => ['SUBMITTED', 'VIEWED', 'SHORTLISTED', 'STALE_REVIEW_REQUIRED'].includes(row.stanje);
const staleApplication = (row: MojaPrijavaProjekcija) => row.stanje === 'STALE_REVIEW_REQUIRED' || row.promenjenaPotreba;
/** `traziPaznju` is the server's own flag; the phone does not second-guess it, only words it. */
const needsMe = (row: MojaPrijavaProjekcija) => staleApplication(row) || row.traziPaznju;
const activeAgreement = (row: DogovorProjekcija) => row.stanje === 'CONFIRMED' || row.stanje === 'AWAITING_REQUESTER';
/** The same rule the Dogovori list uses for "Čeka tvoju ocenu"; Home must not contradict it. */
const ratingDue = (row: DogovorProjekcija) => row.stanje === 'COMPLETED' && row.ocenaMoguca;
/** What I am to a Dogovor comes from that Dogovor's own participants, never from an app-wide mode. */
const mySide = (row: DogovorProjekcija) => row.ucesnici.find(person => person.viSte)?.uloga ?? null;
const counterpart = (row: DogovorProjekcija) => row.ucesnici.find(person => !person.viSte)?.ime ?? 'Druga strana';

function agreementRow(row: DogovorProjekcija): HomeRow {
  const side = mySide(row);
  const roleLabel = side === 'narucilac' ? 'Tvoj zadatak' : side === 'uskocer' ? 'Uskačeš' : null;
  const counterpartName = counterpart(row);
  const other = row.ucesnici.find(person => !person.viSte);
  return { id: `agreement:${row.id}`, title: row.naslov, target: { kind: 'AGREEMENT', agreementId: row.id },
    detail: [roleLabel, counterpartName, row.vremeTekst].filter(Boolean).join(' · '),
    appointment: { timeText: row.vremeTekst, counterpartName, roleLabel,
      counterpartProfileId: other?.profilId ?? null, counterpartInitials: other?.inicijali?.trim() || null } };
}

export function composeHome(reads: HomeReads, serverAttention?: HomeSection<HomeAttentionPreview>, now = Date.now(),
  /** The phone's own zone: it never changes a time (agreed times read in Serbian time), only whether Raspored says so in words. */
  phoneZone: string | undefined = zonaTelefona()): HomeSnapshot {
  const needs = reads.needs.kind === 'known' ? reads.needs.value : null;
  const applicationRead = reads.applications.kind === 'known' ? reads.applications.value : null;
  const applications = Array.isArray(applicationRead) ? applicationRead : null;
  const applicationTotals = Array.isArray(applicationRead) ? applicationCounts(applicationRead) : applicationRead;
  const agreements = reads.agreements.kind === 'known' ? reads.agreements.value : null;

  // A blocked completion first, then an open problem, then a changed task under my application,
  // then my own tasks with applications to choose from. One identity per subject and reason.
  const attention: HomeAttention[] = serverAttention
    ? serverAttention.kind === 'known' ? serverAttention.value.rows : [] : [
    ...(agreements ?? []).filter(row => row.stanje === 'AWAITING_REQUESTER' && mySide(row) === 'narucilac').map(row => ({
      id: `agreement:${row.id}:confirm`, title: 'Potvrdi završetak', detail: `${row.naslov} · završetak je označen i čeka Vašu potvrdu`,
      target: { kind: 'AGREEMENT' as const, agreementId: row.id } })),
    ...(agreements ?? []).filter(row => activeAgreement(row) && row.problemOtvoren).map(row => ({
      id: `agreement:${row.id}:problem`, title: 'Prijavljen je problem', detail: `${row.naslov} · automatski završetak je zaustavljen`,
      target: { kind: 'AGREEMENT' as const, agreementId: row.id } })),
    ...(applications ?? []).filter(row => activeApplication(row) && needsMe(row)).map(row => ({
      id: `application:${row.prijavaId}:${staleApplication(row) ? 'stale' : 'attention'}`,
      title: staleApplication(row) ? 'Zadatak je izmenjen' : 'Prijava traži Vašu pažnju',
      detail: staleApplication(row) ? `${row.naslov} · pregledajte izmene pre nego što odlučite o prijavi` : `${row.naslov} · otvorite svoju prijavu`,
      target: { kind: 'APPLICATION' as const, applicationId: row.prijavaId } })),
    ...(needs ?? []).filter(hasNeedAttention).map(row => ({
      id: `need:${row.id}:applications`, title: prijava(row.brojPrijavaZaIzbor!), detail: `${row.naslov} · čeka Vaš izbor`,
      target: { kind: 'CANDIDATES' as const, needId: row.id } })),
  ];

  // Only an accepted term that is not over can be called "next": it starts ahead of now, or its exact window is under
  // way. A past or source-task time must not hide tomorrow's actual appointment. Other active Agreements retain their
  // server order and neutral label.
  const nowInstant = Number.isSafeInteger(now) ? BigInt(now) * 1000n : null;
  const ordered = (agreements ?? []).filter(activeAgreement)
    .map((row, index) => {
      const term = acceptedTerm(row);
      return { row, index, term, upcoming: row.stanje === 'CONFIRMED' && nowInstant !== null && term !== null && notOver(term, nowInstant) ? term.startAt : null };
    })
    .sort((a, b) => {
      const left = a.upcoming, right = b.upcoming;
      if (left !== null && right !== null && left !== right) return left < right ? -1 : 1;
      if (left !== null && right === null) return -1;
      if (left === null && right !== null) return 1;
      return a.index - b.index;
    });
  // Raspored: the block says the featured appointment day first in Serbian time, plus one quiet line about the rest.
  // Only a featured appointment that is `upcoming` has one; with none there is no card (see `quietLine` below).
  // Besides the appointments, two kinds of active Dogovor have no day in the schedule ahead and are counted, not listed:
  // those with no exact term, and the confirmed ones whose exact term has passed without being marked done. Both are
  // Dogovori and are said as Dogovori. Without a clock nothing can be said to have passed.
  const [featured, ...rest] = ordered;
  const loose = (featuredId: string | null) => ({ withoutTerm: withoutTermCount(agreements ?? [], featuredId),
    awaitingFinish: awaitingFinishCount(agreements ?? [], nowInstant) });
  const raspored = featured && featured.term && featured.upcoming !== null && Number.isSafeInteger(now)
    ? rasporedOf(featured.term, rest.flatMap(entry => entry.upcoming !== null && entry.term ? [entry.term] : []),
      loose(featured.row.id), new Date(now), phoneZone) : null;
  const activeAgreements = ordered.map(entry => ({ ...agreementRow(entry.row), ...(entry.upcoming !== null ? { upcoming: true as const } : {}),
    ...(entry === featured && raspored ? { raspored } : {}) }));
  // No card, but never no trace: an active Dogovor must not vanish from Početna for want of a day to show it on. With no
  // appointment ahead those Dogovori are counted in one quiet line (with a card, the same counts ride in the card's own
  // grey line).
  const quietLine = raspored ? null : looseLine(loose(null));
  // What waits for me that the phone knows from the reads it already makes (R02, R18). They follow the server's own rows and
  // never replace them: the server's aggregate stays the answer about applications, completions and problems.
  const subject = (title: string) => { const text = readableTitle(title); return text ? { taskTitle: text } : {}; };
  const prompts: HomeAttention[] = [
    ...(agreements ?? []).filter(row => activeAgreement(row) && row.izmenaCeka && !row.izmenaCeka.mojPredlog).map(row => ({
      id: `agreement:${row.id}:change`, title: 'Odgovori na predlog izmene', ...subject(row.naslov), detail: 'Druga strana predlaže izmenu uslova.',
      target: { kind: 'AGREEMENT_CHANGE' as const, agreementId: row.id } })),
    ...(agreements ?? []).filter(needsTerm).map(row => ({
      id: `agreement:${row.id}:term`, title: 'Predloži termin', ...subject(row.naslov), detail: 'Termin još nije dogovoren.',
      target: { kind: 'AGREEMENT_TERM' as const, agreementId: row.id } })),
    ...(needs ?? []).filter(row => row.stanje === 'NACRT' && readableTitle(row.naslov)
      && draftIsFresh(row.azurirano, now)).slice(0, 1).map(row => ({
      id: `need:${row.id}:draft`, title: 'Nastavi nacrt', ...subject(row.naslov), detail: 'Nacrt još nije objavljen.',
      target: { kind: 'NEED' as const, needId: row.id } })),
  ];
  const room = Math.max(0, HOME_WAITING_LIMIT - Math.min(attention.length, HOME_ATTENTION_LIMIT));
  const profileRead = reads.workerProfile;
  const workerProfile: HomeSnapshot['workerProfile'] = profileRead === undefined ? undefined
    : profileRead.kind === 'unavailable' ? { kind: 'unavailable' }
      : { kind: 'known', value: profileRead.value ? { state: profileRead.value.stanje, availableNow: profileRead.value.dostupanOdmah }
        : { state: 'NONE', availableNow: false } };
  const due = (agreements ?? []).filter(ratingDue);
  const serverRatings = serverAttention?.kind === 'known' ? serverAttention.value.ratings : undefined;
  // The server's aggregate is the whole answer when it is there: a failed or slow Dogovori read then withholds the Dogovori, never the number of ratings.
  const ratingsKnown = !!serverRatings || agreements !== null && !agreements.some(row => row.stanje === 'COMPLETED' && row.stanjeProvereOcene === 'UNAVAILABLE');
  const partial = !ratingsKnown || serverAttention?.kind === 'unavailable' || [reads.needs, reads.applications, reads.agreements].some(section => section.kind === 'unavailable');

  return {
    attention: attention.slice(0, HOME_ATTENTION_LIMIT), attentionMore: serverAttention
      ? serverAttention.kind === 'known' ? serverAttention.value.more : 0 : Math.max(0, attention.length - HOME_ATTENTION_LIMIT),
    ...(serverAttention ? { attentionState: serverAttention.kind } : {}),
    ...(prompts.length ? { prompts: prompts.slice(0, room), ...(prompts.length > room ? { promptsMore: prompts.length - room } : {}) } : {}),
    ...(workerProfile ? { workerProfile } : {}),
    agreements: agreements ? { kind: 'known', value: { rows: activeAgreements.slice(0, HOME_AGREEMENT_LIMIT),
      more: Math.max(0, activeAgreements.length - HOME_AGREEMENT_LIMIT), ...(quietLine ? { quietLine } : {}) } } : { kind: 'unavailable' },
    mine: { tasks: needs ? { kind: 'known', value: ownedTaskCounts(needs) } : { kind: 'unavailable' },
      applications: applicationTotals ? { kind: 'known', value: applicationTotals } : { kind: 'unavailable' } },
    partial,
    firstRun: !partial && !attention.length && !needs?.length && !applicationTotals?.total && !agreements?.length,
    ratingsDue: serverRatings ? serverRatings.due : ratingsKnown ? due.length : null,
    ratingDueAgreementId: serverRatings ? serverRatings.agreementId : ratingsKnown && due.length === 1 ? due[0].id : null,
  };
}
