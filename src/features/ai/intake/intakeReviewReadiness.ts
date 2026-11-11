import type { AiNeedV2Conversation } from '../../../contracts/aiNeedV2';
import type { AiTaskReviewEnvelope } from '../../../data/aiTaskReviewClientService';
import type { WorkerAiSnapshot } from '../../../data/workerAiClientService';
import { reviewFactProblem } from '../../../data/reviewFactProblem';
import { normalizeNeedLocation, pointsMissing } from '../../../lib/location';
import { completeDraftProposal } from '../../../ui/v2/draftSummary';

// In-memory comparison only. Neither conversation values nor this key belong in
// logs/storage. Object member order from separate JSON responses is irrelevant.
const ordered = (value: unknown): unknown => Array.isArray(value) ? value.map(ordered)
  : value !== null && typeof value === 'object'
    ? Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, ordered(item)]))
    : value;
const factKey = (facts: readonly { key: string; value: unknown; status: string; id: string | null }[]) => JSON.stringify(
  facts.filter(fact => fact.status !== 'UNKNOWN').map(({ key, value, status, id }) => ({ key, value: ordered(value), status, id }))
    .sort((a, b) => a.key.localeCompare(b.key)));

export function taskReadinessKey(conversation: AiNeedV2Conversation): string {
  return JSON.stringify([conversation.conversationId, conversation.status, conversation.safety,
    conversation.messages.map(message => message.id), factKey(conversation.facts)]);
}

function taskLocation(conversation: AiNeedV2Conversation) {
  const fact = (key: string) => conversation.facts.find(item => item.key === key && item.status !== 'UNKNOWN')?.value ?? null;
  return normalizeNeedLocation({ taskCountryCode: fact('need.task_country_code'), geography: fact('need.task_geography'),
    exactAddress: fact('need.exact_address'), accessNotes: fact('need.access_notes'), resolvedLocation: fact('need.resolved_location') });
}

export function taskReadyToPrepare(conversation: AiNeedV2Conversation): boolean {
  if (conversation.status !== 'OPEN' || conversation.safety !== 'ALLOW' || !completeDraftProposal(conversation.facts)) return false;
  const location = taskLocation(conversation);
  if (!location) return false;
  const points = pointsMissing(location.geography, location.resolvedLocation);
  return location.geography.mode === 'REMOTE' || points.total > 0 && points.done === points.total;
}

export function taskReviewReady(review: AiTaskReviewEnvelope | null | undefined, conversation: AiNeedV2Conversation, now = Date.now()): boolean {
  const location = taskLocation(conversation);
  // The signed server review omits handoff outside REMOTE work. Compare that
  // same projection after a mode correction, without changing conversation facts
  // or accepting an extra handoff in the signed on-site review.
  const facts = location && location.geography.mode !== 'REMOTE'
    ? conversation.facts.filter(fact => fact.key !== 'need.handoff') : conversation.facts;
  const validClassification = !review?.classificationState
    || ['READY', 'PENDING_CLASSIFICATION', 'REVIEW_REQUIRED'].includes(review.classificationState);
  return !!review && taskReadyToPrepare(conversation) && review.conversationId === conversation.conversationId
    && review.canAccept && review.safety === 'ALLOW' && validClassification
    && review.missingRequired.length === 0 && Date.parse(review.expiresAt) > now
    && factKey([...review.publicProjection, ...review.ownerPrivateProjection]) === factKey(facts)
    && JSON.stringify(ordered(normalizeNeedLocation(review.location))) === JSON.stringify(ordered(location))
    && !reviewFactProblem(review, now)
    && !review.publicProjection.some(fact => fact.key === 'need.verified_identity_required' && fact.value === true);
}

// An already opened review may stay visible after expiry, with Save disabled.
// This check is never sufficient to admit a new review or a Save command.
export function workerReviewPresentable(snapshot: WorkerAiSnapshot): boolean {
  const review = snapshot.review;
  const validClassification = !review?.classificationState
    || ['READY', 'PENDING_CLASSIFICATION', 'REVIEW_REQUIRED'].includes(review.classificationState);
  if (!review || snapshot.status !== 'OPEN' || snapshot.stale || snapshot.safety !== 'ALLOW'
    || review.accountId !== snapshot.accountId || review.conversationId !== snapshot.conversationId
    || review.profileId !== snapshot.profileId || review.revision !== snapshot.revision
    || !review.canAccept || review.missingRequired.length || !validClassification) return false;
  const onSite = review.reviewedServiceModes?.some(item => item.mode === 'ON_SITE');
  return !onSite || !!review.profile.workAreas?.length
    || !!review.profile.location.operatingCountryCode && review.profile.location.city.trim().length >= 2;
}

export function workerReviewReady(snapshot: WorkerAiSnapshot, now = Date.now()): boolean {
  return workerReviewPresentable(snapshot) && Date.parse(snapshot.review!.expiresAt) > now;
}

// A technical failure never asks the person to restate an already understood job.
export function classificationPreparationMessage(state: string | undefined): string | null {
  if (!state || state === 'READY' || state === 'PENDING_CLASSIFICATION' || state === 'REVIEW_REQUIRED') return null;
  if (state === 'SERVICE_MODE_CONFIRMATION_REQUIRED') return 'Način rada za uslugu još nije razjašnjen. Dopunite taj podatak u razgovoru.';
  if (state === 'CATALOG_UNAVAILABLE') return 'Provera usluge trenutno nije dostupna. Pokušajte ponovo kasnije; podaci iz razgovora ostaju sačuvani.';
  if (state === 'STALE_CATALOG') return 'Potvrda povezivanja usluge više nije važeća. Potrebna je nova provera; nije potrebno da ponavljate opis.';
  return 'Potvrda pregleda trenutno nije dostupna. Podaci iz razgovora ostaju sačuvani; proverite stanje.';
}
