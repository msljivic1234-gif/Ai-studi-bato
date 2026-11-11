import { useCallback } from 'react';
import { StyleSheet, View } from 'react-native';
import { reviewsClientService } from '../../data/reviewsClientService';
import { useFocusedResource } from '../../hooks/useFocusedResource';
import { T } from '../Text';
import { FactArt } from '../system/FactArt';
import { sys } from '../system/tokens';
import { ratingFigure } from './ProfileFigures';

/**
 * The rating of an account as one short line, "★ 4,8 · 12 ocena", for a place that is not the row of figures (the card "Kako te vide kad uskačeš" of the
 * work profile, approved draft of 8 Oct 2026, P3). It is the same read as the figure of the profile (`AccountReputation`) and the same words
 * (`ratingFigure`), and it draws ONLY a rating that exists: while it reads, when it fails and when there are no reviews yet the line is not drawn,
 * because a zero nobody counted, a star over nothing and "Nova ocena" under a name would each say something the app does not know.
 */
export function RatingLine({ accountId }: { accountId: string }) {
  const load = useCallback(async () => {
    const result = await reviewsClientService.reputation(accountId);
    if (!result.ok) throw new Error('REPUTATION_NOT_AVAILABLE');
    return result.podatak;
  }, [accountId]);
  const { data } = useFocusedResource(load);
  if (!data || !(data.reviewCount > 0) || typeof data.averageRating !== 'number') return null;
  return <RatingLineView average={data.averageRating} count={data.reviewCount} />;
}

/** The line itself, from a rating that exists (the design gallery draws it from a fixture, with no read). */
export function RatingLineView({ average, count }: { average: number; count: number }) {
  if (!Number.isFinite(average) || !(count > 0)) return null;
  const figure = ratingFigure(average, count);
  return <View testID="rating-line" accessible accessibilityLabel={figure.spoken} style={s.row}>
    <FactArt kind="star" size={16} />
    <T variant="note" tone="muted">{`${figure.value} · ${figure.label}`}</T>
  </View>;
}

const s = StyleSheet.create({ row: { flexDirection: 'row', alignItems: 'center', gap: sys.space.xs } });
