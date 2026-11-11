import type { AiTaskPublicationCommand, AiTaskReviewEnvelope } from './aiTaskReviewClientService';
import { positiveInteger, sameId, uuid, type ReceiptAccount } from './serverReceipt';
import { sesijaSada } from '../store/sesija';

/** Navigation context only. No facts, private locations, credentials or server authority are stored here. */
export type PublicationHandoff = Readonly<ReceiptAccount & {
  token: string; needId: string; needRevision: number;
}>;

let sequence = 0;
let latest: PublicationHandoff | null = null;

/** Called only after the review route has read back the published owner revision. URL params cannot create it. */
export function rememberPublication(input: {
  review: AiTaskReviewEnvelope; command: AiTaskPublicationCommand; publishedReadback: boolean;
}, owner: ReceiptAccount): PublicationHandoff | null {
  const session = sesijaSada();
  if (session.user?.id !== owner.accountId || session.accountRevision !== owner.accountRevision
    || input.review.accountId !== owner.accountId || !input.publishedReadback
    || input.command.authoritative !== true || input.command.state !== 'PUBLISHED'
    || !sameId(input.command.reviewId, input.review.reviewId)
    || !uuid(input.command.needId) || !positiveInteger(input.command.needRevision)) return null;
  latest = Object.freeze({ ...owner, token: `publication-${++sequence}`,
    needId: input.command.needId, needRevision: input.command.needRevision });
  return latest;
}

/** Identity revision rejects A→B→A, while an ordinary token refresh keeps the same account context. */
export function publicationIsCurrent(handoff: PublicationHandoff): boolean {
  const session = sesijaSada();
  return latest === handoff && session.user?.id === handoff.accountId
    && session.accountRevision === handoff.accountRevision;
}

/**
 * Where a confirmed publication lands: the task's OWN overview (owner, 2026-10-07: the whole life of a task "vidno i lako
 * razumljivo"), not the Zadaci map. The pin was a stranger's view of the task and the map a place to look for work; the overview
 * is where the owner sees what the task is doing and what comes next. The review route asks for it only through a hand-off it
 * just made (`rememberPublication` has proved account, revision and the read-back), so the id here is the proved one. The Zadaci
 * landing that read the same hand-off from the URL stays in `zadaci.tsx` for an old link; nothing in the app sends it there now.
 */
export function publishedTaskRoute(handoff: PublicationHandoff) {
  return { pathname: '/potrebe/[id]/pregled', params: { id: handoff.needId } } as const;
}

/** An external/old route is not proof of ownership or of a publication performed in this app session. */
export function readPublicationHandoff(params: {
  publishedHandoff?: unknown; publishedNeedId?: unknown; publishedRevision?: unknown;
}): PublicationHandoff | null {
  return latest && publicationIsCurrent(latest) && params.publishedHandoff === latest.token
    && sameId(params.publishedNeedId, latest.needId) && params.publishedRevision === String(latest.needRevision)
    ? latest : null;
}
