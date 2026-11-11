import type { InboxItem, InboxPage, InboxRole } from '../../contracts/inbox';

/**
 * Words and small pure rules of the inbox that belong to no screen (T4a, 2026-10-07).
 *
 * WHERE A TAP GOES. The destination itself is decided by the model and the route (`rpc_resolve_activity_event`, then
 * `app/obavestenja.tsx`); nothing here navigates. This only says, under a row and before it is touched, where the tap
 * will land, in the words the owner uses ("zadatak", "Moje prijave", "Dogovor"). It follows what the resolver and the
 * route do today, event by event, and an event this table does not know says nothing: a destination is never invented.
 */
export function inboxDestination(item: Pick<InboxItem, 'eventType' | 'role'>): string | null {
  switch (item.eventType) {
    // The conversation itself, on the message that arrived.
    case 'MESSAGE_RECEIVED': return 'Otvara poruku u Dogovoru';
    // The change that waits for an answer, not the overview.
    case 'AGREEMENT_CHANGE_PROPOSED': return 'Otvara predlog izmene Dogovora';
    // Everything else about a Dogovor lands on its overview, where the next step is stated.
    case 'AGREEMENT_VERSION_CHANGED': case 'AGREEMENT_CHANGE_REJECTED': case 'AGREEMENT_CANCELLED': case 'EXECUTION_STATE_CHANGED':
    case 'COMPLETION_REQUIRED': case 'PRIVATE_ACCESS_GRANTED': case 'RECOVERY_OPENED': case 'REVIEW_RECEIVED':
    case 'RESPONSE_SELECTED':
      return 'Otvara Dogovor';
    case 'OPPORTUNITY_AVAILABLE': return 'Otvara zadatak';
    // A requester's own task: the applications to choose from.
    case 'RESPONSE_RECEIVED': case 'RESPONSE_UPDATED': case 'RESPONSE_WITHDRAWN': return 'Otvara prijave za Vaš zadatak';
    // A worker's own application.
    case 'RESPONSE_VIEWED': case 'RESPONSE_SHORTLISTED': case 'RESPONSE_NOT_SELECTED': case 'RESPONSE_STALE': case 'RESPONSE_EXPIRED':
      return 'Otvara Vašu prijavu';
    // The same event is the owner's task for a requester and the offer for a worker.
    case 'NEED_REVISED': return item.role === 'REQUESTER' ? 'Otvara Vaš zadatak' : 'Otvara Vašu prijavu';
    // A cancelled task is not a place to stand: the person who applied lands on their own applications.
    case 'NEED_CANCELLED': return item.role === 'REQUESTER' ? 'Otvara Vaš zadatak' : 'Otvara Vaše prijave';
    case 'CLARIFICATION_CREATED': case 'CLARIFICATION_ANSWERED': return 'Otvara pitanja o zadatku';
    default: return null;
  }
}

/** Visible cue for the same known destination, never a second routing authority. */
export function inboxActionLabel(item: Pick<InboxItem, 'eventType' | 'role'>): string | null {
  const destination = inboxDestination(item);
  return destination ? ({
    'Otvara poruku u Dogovoru': 'Otvorite poruku',
    'Otvara predlog izmene Dogovora': 'Pregledajte izmenu',
    'Otvara Dogovor': 'Otvorite Dogovor',
    'Otvara zadatak': 'Pogledajte zadatak',
    'Otvara prijave za Vaš zadatak': 'Pregledajte prijave',
    'Otvara prijave za tvoj zadatak': 'Pregledajte prijave',
    'Otvara Vašu prijavu': 'Pogledajte prijavu',
    'Otvara tvoju prijavu': 'Pogledajte prijavu',
    'Otvara Vaš zadatak': 'Pogledajte svoj zadatak',
    'Otvara tvoj zadatak': 'Pogledajte svoj zadatak',
    'Otvara Vaše prijave': 'Pogledajte svoje prijave',
    'Otvara tvoje prijave': 'Pogledajte svoje prijave',
    'Otvara pitanja o zadatku': 'Pogledajte pitanja',
  } as Record<string, string>)[destination] ?? null : null;
}

/** Events the person marked read one at a time (a swipe), each with the moment the server gave back. */
export type ReadStamps = Readonly<Record<string, string>>;

/**
 * The page as the person sees it after reading rows one by one: an event the server confirmed as read shows as read, and
 * the count that was above the list goes down by exactly those events (never below zero). The model owns the page and has
 * no call for a single row that is not opened, so the confirmed read lives beside it and is laid over it here. A page that
 * already carries the read (the next refresh) is returned as it is, so nothing is counted twice; with nothing to lay over,
 * the very same object comes back, which keeps a memoised list still.
 */
export function applyLocalReads<S extends { page: InboxPage | null }>(state: S, stamps: ReadStamps): S {
  const page = state.page;
  if (!page) return state;
  let cleared = 0;
  const items = page.items.map(item => {
    const stamp = stamps[item.id];
    if (!stamp || item.readAt) return item;
    cleared += 1;
    return { ...item, readAt: stamp };
  });
  if (cleared === 0) return state;
  return { ...state, page: { ...page, items, unreadCount: Math.max(0, page.unreadCount - cleared) } };
}

/** Whether a row can be marked read on its own: it is unread, and the screen offers the command at all. */
export const canMarkRead = (item: Pick<InboxItem, 'readAt'>, offered: boolean) => offered && !item.readAt;

/**
 * Which set of notifications a tab shows, in the owner's words (also the names of the sets in the notification settings). The set
 * of a requester is "Moji zadaci", as the card on Početna is: "Zadaci" is the name of the tab of OTHER people's tasks, and one word
 * must not name two things (UI/UX pass, 2026-10-08).
 */
export const INBOX_SET_LABEL: Readonly<Record<'ALL' | InboxRole, string>> = { ALL: 'Sve', REQUESTER: 'Moji zadaci', WORKER: 'Moje prijave' };

/**
 * R11, R15: the task an event is about, when the read says which one. The client takes it since commit 6c78480e (`InboxItem.taskTitle`,
 * kept by the decoder when the read carries it), so every row says which task it is about without being opened as soon as the server
 * does: `rpc_list_inbox` returns `taskTitle` beside each event (the task's own title, no address, nothing for the lock screen: rule A20).
 * The server package that adds it (INBOX-NASLOV) is proven apart and is not applied, so on a server that does not send it this is null
 * and the row says what it said before. Nothing is invented from the words of the event or from another list.
 */
export function inboxTaskTitle(item: object): string | null {
  // Read as unknown on purpose: the decoder keeps only a string, but a row built by hand (a fixture, an older cache) is not trusted either.
  const title = (item as { taskTitle?: unknown }).taskTitle;
  return typeof title === 'string' && title.trim() ? title.trim().replace(/\s+/g, ' ') : null;
}

/** The forms of "zadatak" that the server's stored words write with a capital in the middle of a sentence ("za Zadatak"). */
const CAPITAL_TASK = /(\S) (Zadatak|Zadatka|Zadatku|Zadatkom|Zadaci|Zadataka)(?![\p{L}])/gu;

/**
 * The stored words of an event as the sentence they are. Three of the server's stored texts spell "zadatak" with a capital in the
 * middle of the sentence ("Imaš novu prijavu za Zadatak.": a mistake that reads like a wrong name; `pkg027c_notification_ti_copy.sql`
 * lines 66, 78, 84), and the stored rows keep it until a migration rewrites them. The rule of the app is "zadatak" in the lower case
 * inside a sentence, so the row shows it that way; at the start of a sentence (after a full stop) it keeps its capital. Once the server
 * says it right this changes nothing, so it can stay.
 */
export function readableServerCopy(text: string): string {
  return text.replace(CAPITAL_TASK, (match, before: string, word: string) => /[.!?:…]/.test(before) ? match : `${before} ${word.charAt(0).toLowerCase()}${word.slice(1)}`);
}
