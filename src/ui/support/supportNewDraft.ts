import type { SupportPayloads, SupportReference } from '../../data/supportCaseTypes';

/** One bounded, private RAM draft for the current account incarnation and route.
 * Never persistent storage: an unconfirmed submitted command belongs to the service journal,
 * NOT to this unsent-text cache. Switching account, revision, context or preset retires it.
 */
export type SupportNewTextDraft = { topic: SupportPayloads['CREATE']['topic']; title: string; body: string; desired: string };
let cached: { scope: string; draft: SupportNewTextDraft } | null = null;

export function supportNewDraftScope(accountId: string, accountRevision: number,
  reference: SupportReference | null | 'INVALID', preset?: { title: string; body: string }, initialTopic?: 'NO_SHOW'): string {
  const ref = reference && reference !== 'INVALID' ? reference : null;
  return JSON.stringify([accountId, accountRevision, ref?.kind ?? null, ref?.id ?? null,
    ref?.revision ?? null, preset?.title ?? null, preset?.body ?? null, initialTopic ?? null]);
}
export function readSupportNewDraft(scope: string): SupportNewTextDraft | null {
  if (cached && cached.scope !== scope) cached = null;
  return cached ? { ...cached.draft } : null;
}
export function rememberSupportNewDraft(scope: string, draft: SupportNewTextDraft): void {
  cached = { scope, draft: { ...draft } };
}
/** The optional no-argument form exists for deterministic isolated test setup. */
export function clearSupportNewDraft(scope?: string): void {
  if (scope === undefined || cached?.scope === scope) cached = null;
}
