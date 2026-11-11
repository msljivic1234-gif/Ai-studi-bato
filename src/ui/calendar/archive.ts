import type { DogovorProjekcija, MojaPrijavaProjekcija, PotrebaProjekcija } from '../../contracts/projections';
import { dogovora, prijava, zadataka } from '../system/plural';
import { ROLE_REQUESTER, agendaFacts, agendaRole } from './agenda';
import type { PlannerStatus } from './planner';

/**
 * "Arhiva" (owner, 2026-10-07; plan 2.2): where the things of mine that are over are kept, read-only: finished and cancelled
 * Dogovori, closed tasks, withdrawn and closed applications, for both sides at once. It is composed from the reads the planner
 * already makes; nothing new is asked of the server.
 *
 * It says only what the reads say. A closed TASK reaches the phone as one state (the client folds finished, cancelled, expired and
 * archived into "closed", `needClientService`), and a closed APPLICATION folds "not chosen", "expired" and "task closed" the same way,
 * so neither can honestly be called "Otkazan" or "Istekao": they are "Zatvoren" and "Zatvorena", found under "Sve" only. A
 * withdrawn application is one I took back, so it counts with the cancelled. Deleted drafts leave no row at all ("Obrisani nacrti se
 * ne čuvaju.").
 *
 * Pure and dependency-light on purpose: no React and no native module.
 */

/** What an entry of the archive is: a Dogovor, a task of mine, or an application of mine (Raspored holds only the Dogovori; the Arhiva keeps all three). */
export type ArchiveKind = 'dogovor' | 'zadatak' | 'prijava';
/** The words of a task and an application that have no title to go by, and what I am to an application. */
export const TASK_FALLBACK_TITLE = 'Zadatak';
export const APPLICATION_FALLBACK_TITLE = 'Prijava';
export const ROLE_APPLICANT = 'Tvoja prijava';

/** Why a thing is over, as far as the read says. `closed` is over for a reason the read does not keep. */
export type ArchiveEnd = 'completed' | 'cancelled' | 'expired' | 'closed';
/** The quiet chips of the archive: "Sve · Otkazani · Istekli · Završeni". */
export type ArchiveFilter = 'all' | Exclude<ArchiveEnd, 'closed'>;
export const ARCHIVE_FILTERS: readonly { key: ArchiveFilter; label: string }[] = [
  { key: 'all', label: 'Sve' }, { key: 'cancelled', label: 'Otkazani' }, { key: 'expired', label: 'Istekli' }, { key: 'completed', label: 'Završeni' },
];

export type ArchiveEntry = Readonly<{
  key: string;
  kind: ArchiveKind;
  /** What the row opens: the Dogovor's, the task's or the application's id. */
  id: string;
  title: string | null;
  fallbackTitle: string;
  end: ArchiveEnd;
  status: PlannerStatus;
  /** The thing's own words for its time, as its read wrote them; '' when the read wrote none. */
  timeText: string;
  /** Which side I am on, in the rows' words; null when a Dogovor does not say. */
  role: string | null;
  /** The other person of a Dogovor, when known. */
  person: string | null;
  place: string;
}>;

/** The sentence under the list: a deleted draft is gone, not archived. */
export const DRAFTS_NOT_KEPT = 'Obrisani nacrti se ne čuvaju.';
/** Said under a filter while some entries have no kept reason: they are under "Sve" and nowhere else. */
export const REASON_NOT_KEPT = 'Neke stavke nemaju zabeležen razlog zatvaranja. Vidiš ih pod „Sve“.';

const tidy = (value: unknown): string | null => typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') || null : null;

/** The archive of the three reads, grouped as the screen draws it: Dogovori, then tasks, then applications, each in the order its read gave. */
export function archiveEntries({ agreements, needs, applications }: {
  agreements: readonly DogovorProjekcija[] | null; needs: readonly PotrebaProjekcija[] | null; applications: readonly MojaPrijavaProjekcija[] | null;
}): ArchiveEntry[] {
  const entries: ArchiveEntry[] = [];
  for (const row of agreements ?? []) {
    if (row.stanje !== 'COMPLETED' && row.stanje !== 'CANCELLED') continue;
    const facts = agendaFacts(row), completed = row.stanje === 'COMPLETED';
    entries.push({ key: `agreement:${row.id}`, kind: 'dogovor', id: row.id, title: facts.title, fallbackTitle: 'Dogovor',
      end: completed ? 'completed' : 'cancelled',
      status: completed ? row.ocenaMoguca === true ? { key: 'task.completed', detail: 'oceni' } : { key: 'task.completed' } : { key: 'task.cancelled' },
      timeText: tidy(row.vremeTekst) ?? '', role: agendaRole(row), person: facts.person, place: facts.place });
  }
  for (const row of needs ?? []) {
    if (row.stanje !== 'ZATVORENA') continue;
    entries.push({ key: `need:${row.id}`, kind: 'zadatak', id: row.id, title: tidy(row.naslov), fallbackTitle: TASK_FALLBACK_TITLE, end: 'closed',
      status: { word: 'Zatvoren', shape: 'dash', tone: 'grey' }, timeText: tidy(row.vremeTekst) ?? '', role: ROLE_REQUESTER, person: null, place: row.podrucjeTekst ?? '' });
  }
  for (const row of applications ?? []) {
    if (row.stanje !== 'WITHDRAWN' && row.stanje !== 'CLOSED') continue;
    const withdrawn = row.stanje === 'WITHDRAWN';
    entries.push({ key: `application:${row.prijavaId}`, kind: 'prijava', id: row.prijavaId, title: tidy(row.naslov), fallbackTitle: APPLICATION_FALLBACK_TITLE,
      end: withdrawn ? 'cancelled' : 'closed', status: withdrawn ? { key: 'application.withdrawn' } : { word: 'Zatvorena', shape: 'dash', tone: 'grey' },
      timeText: tidy(row.vremeTekst) ?? '', role: ROLE_APPLICANT, person: null, place: row.podrucjeTekst ?? '' });
  }
  return entries;
}

export const filterArchive = (entries: readonly ArchiveEntry[], filter: ArchiveFilter): ArchiveEntry[] =>
  filter === 'all' ? [...entries] : entries.filter(entry => entry.end === filter);

/** Whether some entries are over for a reason the read does not keep, which a filter other than "Sve" cannot show. */
export const hasUnkeptReason = (entries: readonly ArchiveEntry[]): boolean => entries.some(entry => entry.end === 'closed');

export type ArchiveGroup = Readonly<{
  kind: ArchiveKind;
  /** "Dogovori", "Zadaci", "Prijave". */
  heading: string;
  /** How many, with the plural its noun needs: "1 Dogovor", "2 zadatka", "5 prijava". */
  count: string;
  entries: readonly ArchiveEntry[];
}>;
const GROUPS: readonly { kind: ArchiveKind; heading: string; say: (count: number) => string }[] = [
  { kind: 'dogovor', heading: 'Dogovori', say: dogovora }, { kind: 'zadatak', heading: 'Zadaci', say: zadataka }, { kind: 'prijava', heading: 'Prijave', say: prijava },
];

/** The entries a filter leaves, in groups by kind; a kind with none is not a group. */
export function archiveGroups(entries: readonly ArchiveEntry[], filter: ArchiveFilter): ArchiveGroup[] {
  const shown = filterArchive(entries, filter);
  return GROUPS.flatMap(({ kind, heading, say }): ArchiveGroup[] => {
    const own = shown.filter(entry => entry.kind === kind);
    return own.length ? [{ kind, heading, count: say(own.length), entries: own }] : [];
  });
}

/** What an empty filter says: the honest "none", never a claim about what the read does not keep. */
export const EMPTY_ARCHIVE: Readonly<Record<ArchiveFilter, string>> = {
  all: 'Ovde će stajati završeni, otkazani i istekli zadaci, prijave i Dogovori.',
  cancelled: 'Nema otkazanih.', expired: 'Nema isteklih.', completed: 'Nema završenih.',
};
