/** One bounded private reply draft in process RAM, not a second persisted command.
 * The existing support journal owns every sent or unknown request.
 */
let cached: { scope: string; text: string } | null = null;
export const supportReplyDraftScope = (accountId: string, accountRevision: number, caseId: string): string =>
  JSON.stringify([accountId, accountRevision, caseId]);
export function readSupportReplyDraft(scope: string): string {
  if (cached && cached.scope !== scope) cached = null;
  return cached?.text ?? '';
}
export function rememberSupportReplyDraft(scope: string, text: string): void {
  if (text.length <= 25000) cached = { scope, text };
}
export function clearSupportReplyDraft(scope?: string): void {
  if (scope === undefined || cached?.scope === scope) cached = null;
}
