export type InboxRole = 'REQUESTER' | 'WORKER';
export type InboxItem = {
  id: string; eventType: string; role: InboxRole; occurredAt: string;
  readAt: string | null; title: string; body: string; family: string;
  /** The title of the task the event is about, when the read carries it (INBOX-NASLOV); absent on a server that does not. */
  taskTitle?: string;
};
export type InboxCursor = { at: string; id: string };
export type InboxPage = { items: InboxItem[]; hasMore: boolean; unreadCount: number; asOf: string };
export type InboxTarget = { kind: 'UNAVAILABLE' } | {
  kind: 'AGREEMENT_MESSAGE'; id: string; messageId: string; eventId: string; role: InboxRole;
} | {
  kind: 'GROUP_MESSAGE'; id: string; groupId: string; messageId: string; sequence: string; eventId: string; role: InboxRole;
} | {
  kind: 'CANDIDATE'; id: string; responseId: string; role: 'REQUESTER';
} | {
  kind: 'AGREEMENT' | 'APPLICATIONS' | 'CANDIDATES' | 'OWN_NEED' | 'OPPORTUNITY';
  id: string; role: InboxRole;
};
export interface InboxPort {
  list(role: InboxRole | null, cursor?: InboxCursor, limit?: number): Promise<InboxPage>;
  read(id: string): Promise<string>;
  readAll(through: string, role: InboxRole | null): Promise<number>;
  resolve(id: string): Promise<InboxTarget>;
}
