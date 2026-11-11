import { useCallback, useRef, useState } from 'react';
import type { InboxItem } from '../../contracts/inbox';
import { inboxClientService } from '../../data/inboxClientService';
import type { ReadStamps } from './inboxCopy';

/**
 * Reading ONE notification without opening it (the swipe on a row, T4a 2026-10-07).
 *
 * It uses the call the screen already makes for a tapped row (`rpc_mark_activity_event_read`, through the same client
 * service); nothing new is written and nothing is sent that a tap did not send. What the inbox model does for a tap
 * (read, then resolve the destination) is two steps; here only the first is wanted, and the model has no command for it, so
 * the confirmed read is kept beside the model and laid over its page (`applyLocalReads`).
 *
 * Rules, each of them the model's own:
 * - one command at a time, and nothing starts for a screen that is no longer the person's (`owns`);
 * - a row shows as read only after the server returned the moment it was read, never on the press;
 * - a failure says so (`failed`) and changes nothing; the list is read again from the notice, as after any unconfirmed action;
 * - what is kept belongs to ONE model (the account and the set the list shows): another set or another account starts empty.
 */
type Held = { owner: object; stamps: ReadStamps; pending: string | null; failed: boolean };
const empty = (owner: object): Held => ({ owner, stamps: {}, pending: null, failed: false });

export function useInboxReads(owner: object, owns: () => boolean, read: (id: string) => Promise<string> = id => inboxClientService.read(id)) {
  const [held, setHeld] = useState<Held>(() => empty(owner));
  const mine = held.owner === owner ? held : empty(owner);
  const running = useRef(false);

  const markRead = useCallback(async (item: Pick<InboxItem, 'id' | 'readAt'>): Promise<boolean> => {
    if (item.readAt || running.current || !owns()) return false;
    running.current = true;
    const keep = (patch: (current: Held) => Partial<Held>) => setHeld(current => {
      const base = current.owner === owner ? current : empty(owner);
      return { ...base, ...patch(base) };
    });
    keep(() => ({ pending: item.id, failed: false }));
    try {
      const readAt = await read(item.id);
      if (!owns()) { keep(() => ({ pending: null })); return false; }
      keep(base => ({ pending: null, failed: false, stamps: { ...base.stamps, [item.id]: readAt } }));
      return true;
    } catch {
      if (owns()) keep(() => ({ pending: null, failed: true })); else keep(() => ({ pending: null }));
      return false;
    } finally {
      running.current = false;
    }
  }, [owner, owns, read]);

  /** The notice was answered (the list is being read again): its failure is no longer news. */
  const forgetFailure = useCallback(() => setHeld(current => current.failed ? { ...current, failed: false } : current), []);

  return { stamps: mine.stamps, pending: mine.pending, failed: mine.failed, markRead, forgetFailure };
}
