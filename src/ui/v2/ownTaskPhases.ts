import type { PotrebaProjekcija } from '../../contracts/projections';
import { hasNeedAttention } from '../../data/marketplaceView';

/**
 * The phases of my active tasks, the groups of "Moji zadaci" ("Papir na stolu", the owner's pick of 2026-10-08): "Čeka tvoj izbor",
 * "Objavljeno", "Dogovoreno". A task is in exactly one, by what it is doing now and nothing else; drafts and the finished are not active and
 * have no phase (they are the two rows under the groups). Pure, and the same words the card's chip used to say: a group that says the
 * state is why the card does not wear the chip a second time (`OwnTaskCard`'s `sectionSays`).
 *
 * - `choosing`: it waits for MY choice, by the one rule of the app (`hasNeedAttention`: a place is open and the server counts applications
 *   to choose among), the same that counts "Čeka tvoj izbor" on Početna and said "Bira se" on the card. An unknown count is never a choice.
 * - `agreed`: someone is agreed (every place, or some of them) and nothing waits for my choice.
 * - `published`: it is out and nobody is agreed yet, whether or not an application has come.
 *
 * Its own file, and not a part of `ownTaskOverview` (the task page's model): that one reads the publication gate, which reaches the data
 * client, and a list that only groups what it was given must not load one (the screen suites would crash on it).
 */
export type OwnTaskPhase = 'choosing' | 'published' | 'agreed';
export const OWN_TASK_PHASES: readonly { readonly key: OwnTaskPhase; readonly title: string }[] = [
  { key: 'choosing', title: 'Čeka Vaš izbor' }, { key: 'published', title: 'Objavljeno' }, { key: 'agreed', title: 'Dogovoreno' },
];

/** The phase of one active task; null for a draft and for a closed task, which are not in the groups. */
export function ownTaskPhase(item: PotrebaProjekcija): OwnTaskPhase | null {
  if (item.stanje === 'NACRT' || item.stanje === 'ZATVORENA') return null;
  if (hasNeedAttention(item)) return 'choosing';
  if (item.stanje === 'POPUNJENA' || (item.stanje === 'DELIMICNO_POPUNJENA' && item.pokrivenost.popunjeno > 0)) return 'agreed';
  return 'published';
}

/** My active tasks split by phase, in the order the groups are drawn and each group in the order the list gave them; an empty group stays in the list. */
export function ownTaskPhases(items: readonly PotrebaProjekcija[]): { key: OwnTaskPhase; title: string; items: PotrebaProjekcija[] }[] {
  const groups = OWN_TASK_PHASES.map(phase => ({ ...phase, items: [] as PotrebaProjekcija[] }));
  for (const item of items) {
    const phase = ownTaskPhase(item);
    if (phase) groups.find(group => group.key === phase)!.items.push(item);
  }
  return groups;
}
