/** One admitted conversation, never a notification event or a grouping by person. */
export type ConversationInboxKind = 'AGREEMENT' | 'GROUP';
export type ConversationInboxCursor = Readonly<{
  snapshotAt: string;
  lastAt: string;
  kind: ConversationInboxKind;
  id: string;
}>;
export type ConversationInboxItem = Readonly<{
  kind: ConversationInboxKind;
  id: string;
  routeAgreementId: string;
  task: Readonly<{ id: string; title: string }>;
  counterpart: Readonly<{ profileId: string; displayName: string }> | null;
  lastMessage: Readonly<{
    id: string;
    createdAt: string;
    mine: boolean;
    kind: 'TEXT' | 'PHOTO' | 'VOICE';
    preview: string | null;
  }>;
  /** Unknown is null. Private conversations have no authoritative unread counter. */
  unreadMessageCount: number | null;
}>;
export type ConversationInboxPage = Readonly<{
  schema: 'MY_CONVERSATIONS_PAGE_V1';
  accountId: string;
  authoritative: true;
  asOf: string;
  snapshotAt: string;
  items: readonly ConversationInboxItem[];
  nextCursor: ConversationInboxCursor | null;
}>;
