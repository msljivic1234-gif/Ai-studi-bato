/**
 * How a task ENDED, as the server said it (plan 2.2, "jedan sistem stanja").
 *
 * The client used to fold four different endings into one word. `needClientService` maps COMPLETED, CANCELLED, EXPIRED and
 * ARCHIVED to the one `stanje` 'ZATVORENA', and the screens drew that as "Zatvoren": a finished task, one the owner cancelled
 * and one nobody was chosen for all looked the same, and nothing could tell the Istorija tab (or an Arhiva) which was which.
 *
 * The raw ending now travels beside `stanje`, as an optional `kraj` on the same object. `stanje` is NOT changed: every screen
 * and every filter that reads 'ZATVORENA' (the Istorija tab, "Treba moja radnja", the lifecycle menu, Početna's counts) keeps
 * working exactly as before. `kraj` is only ever present on a task that ended, and only when the server said how.
 *
 * It is typed here, not in `contracts/projections.ts`, so that this change touches no contract another team is editing: read it
 * with `endingOf(task)`. Moving the field into `PotrebaProjekcija` later is a one-line change that this file's callers do not notice.
 */
export type NeedEnding = 'COMPLETED' | 'CANCELLED' | 'EXPIRED' | 'ARCHIVED';

export const NEED_ENDINGS: readonly NeedEnding[] = ['COMPLETED', 'CANCELLED', 'EXPIRED', 'ARCHIVED'];

/** A task as `mapNeed` returns it: the projection plus, for a task that ended, how it ended. */
export type WithEnding<T> = T & { kraj?: NeedEnding };

/** The ending a raw server status stands for; null for every status of a task that has not ended. */
export function endingOfStatus(status: unknown): NeedEnding | null {
  return typeof status === 'string' && (NEED_ENDINGS as readonly string[]).includes(status) ? status as NeedEnding : null;
}

/** How this task ended, when it did and the read said how; null for a task still going, and for one read before `kraj` existed. */
export function endingOf(item: object | null | undefined): NeedEnding | null {
  return item && 'kraj' in item ? endingOfStatus((item as { kraj?: unknown }).kraj) : null;
}
