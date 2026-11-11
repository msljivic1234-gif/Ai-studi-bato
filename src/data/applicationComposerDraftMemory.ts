/** Unsent application fields belong to one account visit and one task. A captured submit intent
 * has a separate durable journal; this small process-local cache never stores a request ID or
 * claims that an unsent draft survives an app restart. */
export type UnsentApplicationDraft = {
  price: string; people: string; note: string; start: string | null; end: string | null;
};
export type ApplicationDraftScope = { accountId: string; accountRevision: number; needId: string };

const MAX_DRAFTS = 8;
const MAX_AGE_MS = 24 * 60 * 60 * 1000;
const drafts = new Map<string, { value: UnsentApplicationDraft; savedAt: number }>();
const scopeKey = ({ accountId, accountRevision, needId }: ApplicationDraftScope) =>
  JSON.stringify([accountId, accountRevision, needId]);

export const applicationComposerDraftMemory = {
  read(scope: ApplicationDraftScope): UnsentApplicationDraft | null {
    const key = scopeKey(scope), entry = drafts.get(key);
    if (!entry) return null;
    if (Date.now() - entry.savedAt > MAX_AGE_MS) { drafts.delete(key); return null; }
    return { ...entry.value };
  },
  remember(scope: ApplicationDraftScope, value: UnsentApplicationDraft): void {
    const key = scopeKey(scope);
    drafts.delete(key);
    drafts.set(key, { value: { ...value }, savedAt: Date.now() });
    while (drafts.size > MAX_DRAFTS) drafts.delete(drafts.keys().next().value!);
  },
  clear(scope: ApplicationDraftScope): void { drafts.delete(scopeKey(scope)); },
  /** Also useful when the account session is explicitly retired. */
  clearAll(): void { drafts.clear(); },
};
