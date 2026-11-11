import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import type { ReceivedReview, ReceivedReviewsMode } from '../../data/workTrustClientService';
import { inicijali } from '../../lib/inicijali';
import { trenutak } from '../../lib/trenutak';
import { SettingsGroup } from '../settings/SettingsPresentation';
import { T } from '../Text';
import { V2Action } from '../v2/V2Action';
import { Avatar } from '../system/Avatar';
import { layout, ruleWidth } from '../system/layout';
import { plural } from '../system/plural';
import { StateView } from '../system/StateView';
import { sys } from '../system/tokens';
import { tagLabels } from './AgreementReviewPresentation';
import { StarsRow } from './RatingsPresentation';
import { ReviewCommentText } from './ReviewCommentText';

/** The reviewer's photo, drawn by the route that owns the media code (the list loads none); `fallback` is the stand-in. */
export type ReceivedReviewPhoto = (profileId: string, size: 40, fallback: ReactNode) => ReactNode;

export type ReceivedReviewsView =
  | { kind: 'loading' }
  | { kind: 'error'; onRetry: () => void }
  | { kind: 'ready'; mode: ReceivedReviewsMode; items: readonly ReceivedReview[]; totalCount: number; notListedCount: number; hasMore: boolean;
      /** The next page: `loading` while it is asked for, `error` when it failed (the page shown stays). */
      more: 'idle' | 'loading' | 'error'; onMore: () => void };

/** What the server's `mode` makes the list: the reviews with a comment the person may read, or every review one by one. */
export const receivedReviewsTitle = (mode: ReceivedReviewsMode) => mode === 'ALL' ? 'Sve ocene' : 'Komentari';

/**
 * What stands under the list when the server leaves some reviews out of it (`COMMENTED_ONLY`: a review with stars only is counted in the
 * average and not listed). It says only what the server said: how many are not listed and that they are in the average. It makes no
 * promise about who sees what or about anyone staying unnamed (owner decision A10).
 */
export const notListedNote = (count: number): string | null => count > 0 ? `${plural(count, 'ocena ulazi', 'ocene ulaze', 'ocena ulazi')} u prosek, ali se ne prikazuje pojedinačno.` : null;

/** "Po dogovoru · Na vreme": the labels the reviewer chose, in the words the rating screen uses. */
export const reviewTagsLine = (tags: readonly string[]): string | null => {
  const words = tags.map(tag => (tagLabels as Record<string, string>)[tag]).filter(Boolean);
  return words.length ? words.join(' · ') : null;
};

/**
 * The reviews the person RECEIVED, newest first (PROFILE-TRUST, R30): the part of "Primljene" under the average. Each is the person who
 * gave it (their name and photo when the server returns them, "Ime nije dostupno" when it masks the face), the stars, the day, the labels
 * they chose, the task it was about and the comment when the reviewed person may read it. Which reviews are listed at all is the owner's
 * privacy decision and the server's answer (`mode`), never this screen's. Every state is a true one: reading is a still bar, a failed read
 * says so and offers it again (never an empty list), and a failed next page keeps the page that is shown.
 */
export function ReceivedReviewsList({ view, photo }: { view: ReceivedReviewsView; photo?: ReceivedReviewPhoto }) {
  if (view.kind === 'loading') return <SettingsGroup title="Komentari">
    <View accessibilityRole="progressbar" accessibilityLabel="Učitavamo komentare" style={s.bar} />
  </SettingsGroup>;
  if (view.kind === 'error') return <SettingsGroup title="Komentari">
    {/* Quiet: when the average above could not be read either, its retry is the screen's one green action. */}
    <StateView kind="error" title="Komentari trenutno nisu dostupni" quiet={{ label: 'Pokušaj ponovo', onPress: view.onRetry }} />
  </SettingsGroup>;
  const note = view.mode === 'COMMENTED_ONLY' ? notListedNote(view.notListedCount) : null;
  // Nothing at all to say: no reviews yet, and none left out. The average above already says "Još nema ocena".
  if (!view.items.length && !note) return null;
  return <SettingsGroup title={receivedReviewsTitle(view.mode)}>
    {view.items.length === 0 ? <T variant="note" tone="muted">Još niko nije napisao komentar.</T> : view.items.map((item, index) =>
      <ReceivedItem key={item.reviewId} item={item} photo={photo} last={index === view.items.length - 1 && !view.hasMore} />)}
    {view.more === 'error' ? <T variant="note" tone="muted" accessibilityLiveRegion="polite" style={s.note}>Još ocena trenutno nije učitano.</T> : null}
    {view.hasMore ? <View style={s.more}><V2Action label={view.more === 'error' ? 'Pokušaj ponovo' : 'Prikaži još'} kind="secondary"
      loading={view.more === 'loading'} onPress={view.onMore} /></View> : null}
    {note ? <T variant="note" tone="muted" style={s.note}>{note}</T> : null}
  </SettingsGroup>;
}

function ReceivedItem({ item, photo, last }: { item: ReceivedReview; photo?: ReceivedReviewPhoto; last: boolean }) {
  const { reviewer } = item;
  const name = reviewer.displayName, day = trenutak(item.createdAt)?.dan ?? null, tags = reviewTagsLine(item.tags);
  const role = item.receivedAs === 'WORKER' ? 'kad uskačeš' : 'kad tražiš pomoć';
  // No name, no letters: the Avatar draws a person, and the line says the name is not there instead of inventing one.
  const stand = <Avatar initials={inicijali(name)} size={layout.slot} />;
  const face = !reviewer.masked && reviewer.avatarPath !== null && reviewer.profileId && photo ? photo(reviewer.profileId, layout.slot, stand) : stand;
  const spoken = [`Ocena ${item.rating} od 5`, name ?? 'Ime nije dostupno', item.taskTitle, day, role].filter(Boolean).join('. ');
  return <View accessible accessibilityLabel={item.comment ? undefined : spoken} style={s.item}>
    <View style={s.face}>{face}</View>
    <View style={s.copy}>
      <View style={s.head}>
        {name ? <T variant="bodyStrong" numberOfLines={2} style={s.name}>{name}</T>
          : <T variant="bodyStrong" tone="muted" numberOfLines={2} style={s.name}>Ime nije dostupno</T>}
        {day ? <T variant="meta" tone="muted">{day}</T> : null}
      </View>
      <StarsRow rating={item.rating} />
      {/* What it was about and in which role, on one quiet line; the labels the reviewer chose under it; then the words. */}
      <T variant="note" tone="muted">{[item.taskTitle, role].filter(Boolean).join(' · ')}</T>
      {tags ? <T variant="note" tone="muted">{tags}</T> : null}
      {item.comment ? <ReviewCommentText text={item.comment} /> : null}
    </View>
    {last ? null : <View pointerEvents="none" style={s.rule} />}
  </View>;
}

const s = StyleSheet.create({
  // Standing where the reviews will be: no spinner, nothing moves.
  bar: { width: 160, height: 16, borderRadius: sys.radius.control, backgroundColor: sys.color.skeleton, marginVertical: sys.space.xs },
  item: { flexDirection: 'row', alignItems: 'flex-start', gap: sys.space.md, paddingVertical: sys.space.md },
  face: { width: layout.slot, alignItems: 'center' },
  copy: { flex: 1, minWidth: 0, gap: sys.space.xs },
  head: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: sys.space.md },
  name: { flex: 1, minWidth: 0, color: sys.color.ink },
  rule: { position: 'absolute', left: layout.slot + sys.space.md, right: 0, bottom: 0, height: ruleWidth, backgroundColor: sys.color.line },
  more: { paddingTop: sys.space.sm },
  note: { paddingTop: sys.space.sm },
});
