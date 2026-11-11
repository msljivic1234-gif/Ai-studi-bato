/**
 * Where the person was going when the app sent them to sign in.
 *
 * A link, a push, or a cold start into any protected route bounces through `/auth`, and until now
 * the destination was used only to choose which form to show and then dropped: after signing in you
 * landed on the tab home with no mention of the Dogovor you had tapped. The store that exists for
 * this (`povratniCilj`) carries an *intent* chosen on the entry screen, and its only writer has
 * always written `{ kind: 'NONE' }` — so its NEED, DOGOVOR and REQUESTER_DRAFT branches have never
 * run. This is the missing half, and deliberately the smaller one.
 *
 * In memory, not on disk. The bounce and the sign-in happen in one run of the app; a route
 * remembered across a kill would be a route the person has long since forgotten asking for. The
 * fifteen-minute bound is for the case where they leave the phone on the sign-in screen and come
 * back to it much later.
 */
const LIFETIME_MS = 15 * 60_000;

let pending: { path: string; at: number; serial: number } | null = null;
let serial = 0;
type DeliveryOwner = { accountId: string; accountRevision: number; sessionEpoch: number };
let delivered: { at: number; owner: DeliveryOwner } | null = null;

/** Paths that are the sign-in flow itself, or the shell, are not destinations. */
const routable = (path: string) =>
  !!path && path !== '/' && !path.startsWith('/auth') && !path.startsWith('/oporavak') && !path.startsWith('/prijave');

export const pendingRoute = {
  remember(path: string) {
    if (!routable(path)) return null;
    delivered = null;
    pending = { path, at: Date.now(), serial: ++serial };
    return pending.serial;
  },
  /** The exact cold push is already owned by its visible Inbox. A one-consumer
   * tombstone also blocks an older Auth fallback if its consumer starts later. */
  delivered(expected: number | null, owner: DeliveryOwner) {
    if (expected !== null && pending?.serial === expected) {
      pending = null; delivered = { at: Date.now(), owner };
    }
  },
  takeDecision(owner: DeliveryOwner): { kind: 'ROUTE'; path: string } | { kind: 'DELIVERED' } | null {
    const value = pending, receipt = delivered;
    pending = null; delivered = null;
    if (value && Date.now() - value.at < LIFETIME_MS) return { kind: 'ROUTE', path: value.path };
    return receipt && Date.now() - receipt.at < LIFETIME_MS && receipt.owner.accountId === owner.accountId
      && receipt.owner.accountRevision === owner.accountRevision && receipt.owner.sessionEpoch === owner.sessionEpoch ? { kind: 'DELIVERED' } : null;
  },
  /** Returns the destination once, and forgets it either way. */
  take(): string | null {
    const value = pending;
    pending = null;
    return value && Date.now() - value.at < LIFETIME_MS ? value.path : null;
  },
  clear() {
    pending = null; delivered = null;
  },
};
