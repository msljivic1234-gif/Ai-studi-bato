import { createContext, useContext } from 'react';
import { starost } from '../../../lib/starost';

/**
 * How old an open task is (UX plan 2.14, "starost na kartici, kartici na mapi i detalju"), asked by the card instead of being handed to it.
 *
 * The list reads the server's page rows, and every row says when the task was published (`publishedAt`; the list is ordered by it, newest
 * first). The card's task (`MarketplaceItem`) does not carry that time, so the list that knows it offers it: the card asks `useTaskAge(id)`
 * and gets "Upravo", "pre 25 min", "juče", "pre 2 dana" ... (`starost`), or null. Null is the honest answer wherever the time is not known (a
 * reader that does not read it, a task of the person's own lists, a time that cannot be read): no age is ever invented.
 *
 * The context lives here, in the discovery folder that owns the list, and costs a card nothing until the card asks.
 */
export type PublishedAt = ReadonlyMap<string, string>;
export type TaskAgeOf = (id: string) => string | null;

/** The answer when nothing is known: no age. */
export const NO_AGE: TaskAgeOf = () => null;
export const TaskAgeContext = createContext<TaskAgeOf>(NO_AGE);

/** The age of the task with this id, as the list around the card knows it; null when it does not. */
export const useTaskAge = (id: string): string | null => useContext(TaskAgeContext)(id);

/** The reader of ages for one read of the list: `now` is the moment of that read, so a card does not change its words while it is on screen. */
export function taskAgeOf(published: PublishedAt | undefined, now: Date): TaskAgeOf {
  if (!published || published.size === 0) return NO_AGE;
  return id => starost(published.get(id), { sada: now });
}
