/** Enable only in a build paired with the approved MY_CONVERSATIONS_PAGE_V1 reader. */
export function conversationInboxBuilt(flag: unknown = process.env.EXPO_PUBLIC_CONVERSATION_INBOX): boolean {
  return flag === '1';
}
