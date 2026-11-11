export type RemainingSearchCloseAttempt = Readonly<{ needId: string; revision: number; clientRequestId: string }>;

/**
 * One immutable close-remaining-search command per Need revision. An unknown
 * outcome must be retried with the same client request id so the server can
 * answer with its stored receipt or the already-closed replay; a new id is
 * minted only for a different Need or revision, or after the closure has been
 * confirmed by an authoritative readback and the caller cleared the attempt.
 */
export function retainRemainingSearchCloseAttempt(
  previous: RemainingSearchCloseAttempt | null,
  needId: string,
  revision: number,
  mint: () => string,
): RemainingSearchCloseAttempt {
  if (previous && previous.needId === needId && previous.revision === revision) return previous;
  return Object.freeze({ needId, revision, clientRequestId: mint() });
}
