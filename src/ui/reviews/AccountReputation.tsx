import { useCallback } from 'react';
import { reviewsClientService, type AccountReputation as Reputation } from '../../data/reviewsClientService';
import { useFocusedResource } from '../../hooks/useFocusedResource';
import { FigureCell, FigureCellError, FigureCellPlaceholder, NEW_RATING, ratingFigure } from '../profile/ProfileFigures';

/**
 * Only a real aggregate is drawn: anything without a numeric count (a read that is not this one) draws nothing, and a
 * count of reviews without a numeric average draws nothing either, because its figure would read "undefined".
 */
const isReputation = (value: unknown): value is Reputation => {
  if (!value || typeof value !== 'object') return false;
  const { reviewCount, averageRating } = value as { reviewCount?: unknown; averageRating?: unknown };
  return typeof reviewCount === 'number' && (reviewCount === 0 || (typeof averageRating === 'number' && Number.isFinite(averageRating)));
};

/**
 * One account reputation in both intents; an unavailable read is not zero reviews.
 *
 * The first of the three figures of a profile (8 Oct 2026, "Lice i tri broja"): the cell is drawn inside the profile's row of figures
 * and takes its own share of it. With `onOpen` it is a way in: it opens "Ocene" (the ratings the person received and gave; the written
 * comments of D12 live there too), the only door to that screen. Without `onOpen` it is the figure alone.
 */
export function AccountReputation({ accountId, onOpen }: {
  accountId: string;
  /** Opens the ratings. Absent: the figure is only a figure. */
  onOpen?: () => void;
}) {
  const load = useCallback(async () => {
    const result = await reviewsClientService.reputation(accountId);
    if (!result.ok) throw new Error('REPUTATION_NOT_AVAILABLE');
    return result.podatak;
  }, [accountId]);
  const reputation = useFocusedResource(load);
  return <ReputationFigure state={reputation.loading ? 'loading' : reputation.error ? 'error' : reputation.data}
    onRetry={() => { void reputation.refresh(); }} onOpen={onOpen} />;
}

/**
 * The rating as a figure (a cell of the profile's row). While it reads: the shape of it, standing still (no spinner, nothing moves).
 * With reviews: the flat star, "4,8" and "12 ocena" under it. With none: the words "Nova ocena" and "još nema ocena", never a zero
 * average and never a star. When the read fails: one short line and "Osveži" in the same place. Anything else draws nothing, never
 * "undefined". With `onOpen` an answer (ratings or none) is a way in that says where it goes ("Otvara ocene.") and ends in the arrow.
 */
export function ReputationFigure({ state, onRetry, onOpen }: { state: 'loading' | 'error' | unknown; onRetry: () => void; onOpen?: () => void }) {
  if (state === 'loading') return <FigureCellPlaceholder label="Proveravamo ocene…" />;
  if (state === 'error') return <FigureCellError message="Ocene trenutno nisu dostupne." retryLabel="Osveži ocene" onRetry={onRetry} />;
  if (!isReputation(state)) return null;
  const figure = state.reviewCount === 0 || state.averageRating === null ? NEW_RATING : ratingFigure(state.averageRating, state.reviewCount);
  return <FigureCell testID="reputation-figure" figure={onOpen ? { ...figure, hint: 'Otvara ocene.' } : figure} onPress={onOpen} />;
}
