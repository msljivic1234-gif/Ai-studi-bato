import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { reviewCommentsClientService, type ReviewCommentCursor, type ReviewCommentItem, type ReviewCommentPage } from '../../data/reviewCommentsClientService';
import { REVIEW_COMMENT_PAGE_SIZE } from '../../data/reviewCommentText';
import { inicijali } from '../../lib/inicijali';
import { vreme } from '../../lib/vreme';
import { useSesija } from '../../store/sesija';
import { T } from '../Text';
import { V2Action } from '../v2/V2Action';
import { Avatar } from '../system/Avatar';
import { FactArt } from '../system/FactArt';
import { sys } from '../system/tokens';
import { ReviewCommentText } from './ReviewCommentText';

/** The reviewer's photo, drawn by the route that owns the media code (the section loads none); `fallback` is the stand-in. */
export type ReviewCommentPhoto = (profileId: string, size: 40, fallback: ReactNode) => ReactNode;

type Loaded = { items: ReviewCommentItem[]; hasMore: boolean; cursor: ReviewCommentCursor | null };
const NOTHING: Loaded = { items: [], hasMore: false, cursor: null };
/** What the section holds, and for WHICH account and profile it holds it: anything else is not shown, not even for a frame. */
type State = { scope: string; phase: 'loading' | 'error' | 'nothing' | 'ready'; data: Loaded; more: 'idle' | 'loading' | 'error' };
const waiting = (scope: string, phase: State['phase'] = 'loading'): State => ({ scope, phase, data: NOTHING, more: 'idle' });
/** Append an admitted page: a comment that came twice is shown once. Privacy-null is handled before this helper. */
const appended = (current: Loaded, page: ReviewCommentPage): Loaded => ({
  items: [...current.items, ...page.items.filter(item => !current.items.some(seen => seen.reviewId === item.reviewId))],
  hasMore: page.hasMore, cursor: page.nextAfter });

/**
 * "Komentari" of a profile (D12): the written comments ABOUT the person whose profile this is, newest first, a page of 20 at a
 * time with "Prikaži još" while there are more. Every state is a true one: reading is a still bar (never "nobody wrote one"),
 * no comments yet says that nobody wrote one, a failed read says so and offers to try again (never an empty list), and the
 * reader's `null` (a blocked pair, a closed account, another world, a backend without D12) is NOTHING AT ALL: no title, no error.
 * Each comment shows its rating, its date in the one `vreme()` format, and the reviewer's name and photo exactly as the reader
 * returned them: a reviewer with no name has no name and no letters, and the photo is asked for only when the reader returned
 * an avatar path. The text is drawn by `ReviewCommentText` (plain, bounded). There is deliberately no report or block control
 * here: no existing entry point for a review exists, and none is invented.
 *
 * It reads when it mounts and when the profile or the account changes: what was read for another account or profile is never
 * drawn for this one, and a late answer for anything else is dropped. The text of a comment lives in this component's state only.
 */
export function ReviewCommentsSection({ profileId, photo }: { profileId: string; photo?: ReviewCommentPhoto }) {
  const { user, accountRevision } = useSesija();
  const accountId = user?.id;
  const scope = `${accountId ?? ''}:${accountRevision}:${profileId}`;
  const [held, setHeld] = useState<State>(() => waiting(scope));
  const state = held.scope === scope ? held : waiting(scope);
  // A read belongs to the account and profile that asked: a later load or unmount retires it.
  const generation = useRef(0), asking = useRef(false);

  const load = useCallback(async () => {
    const mine = ++generation.current;
    asking.current = false;
    if (!accountId) { setHeld(waiting(scope, 'nothing')); return; }
    setHeld(waiting(scope));
    let result;
    try { result = await reviewCommentsClientService.list(profileId, { limit: REVIEW_COMMENT_PAGE_SIZE }, { accountId, accountRevision }); } catch { result = null; }
    if (mine !== generation.current) return;
    if (!result || !result.ok) setHeld(waiting(scope, 'error'));
    else if (result.podatak === null) setHeld(waiting(scope, 'nothing'));
    else setHeld({ scope, phase: 'ready', data: appended(NOTHING, result.podatak), more: 'idle' });
  }, [scope, profileId, accountId, accountRevision]);
  useEffect(() => { void load(); return () => { generation.current += 1; }; }, [load]);

  const loadMore = async () => {
    const cursor = state.data.cursor;
    if (!accountId || asking.current || !state.data.hasMore || !cursor) return;
    const mine = generation.current;
    asking.current = true; setHeld(current => current.scope === scope ? { ...current, more: 'loading' } : current);
    let result;
    try { result = await reviewCommentsClientService.list(profileId, { after: cursor, limit: REVIEW_COMMENT_PAGE_SIZE }, { accountId, accountRevision }); } catch { result = null; }
    if (mine !== generation.current) return;
    asking.current = false;
    // An authoritative null revokes this list, including earlier pages. A transport failure still offers retry.
    setHeld(current => current.scope !== scope ? current : !result || !result.ok ? { ...current, more: 'error' }
      : result.podatak === null ? waiting(scope, 'nothing')
        : { ...current, more: 'idle', data: appended(current.data, result.podatak) });
  };

  if (!accountId || state.phase === 'nothing') return null;
  const { data, more } = state;
  return <View style={s.section}>
    <T accessibilityRole="header" variant="heading" style={s.ink}>Komentari</T>
    {state.phase === 'loading' ? <View accessibilityRole="progressbar" accessibilityLabel="Učitavamo komentare" style={s.bar} />
      : state.phase === 'error' ? <View style={s.state}>
        <T variant="note" tone="muted">Komentari trenutno nisu dostupni.</T>
        <V2Action label="Pokušaj ponovo" kind="quiet" onPress={() => { void load(); }} />
      </View>
        : data.items.length === 0 ? <T variant="note" tone="muted">Još niko nije napisao komentar.</T>
          : <>
            {data.items.map((item, index) => <CommentRow key={item.reviewId} item={item} photo={photo} first={index === 0} />)}
            {more === 'error' ? <T variant="note" tone="muted">Još komentara trenutno nije učitano.</T> : null}
            {data.hasMore ? <V2Action label={more === 'error' ? 'Pokušaj ponovo' : 'Prikaži još'} loading={more === 'loading'} onPress={() => { void loadMore(); }} /> : null}
          </>}
  </View>;
}

/** One comment: who wrote it, with how many stars and when, and what they wrote. */
function CommentRow({ item, photo, first }: { item: ReviewCommentItem; photo?: ReviewCommentPhoto; first: boolean }) {
  const { author } = item;
  // No name, no letters: the Avatar draws a person, and the line says the name is not there instead of inventing one.
  const stand = <Avatar initials={inicijali(author.displayName)} size={40} />;
  const face = author.avatarPath !== null && photo ? photo(author.profileId, 40, stand) : stand;
  return <View style={[s.item, !first && s.rule]}>
    <View style={s.head}>
      {face}
      <View style={s.who}>
        {author.displayName ? <T variant="bodyStrong" style={s.ink} numberOfLines={2}>{author.displayName}</T>
          : <T variant="bodyStrong" tone="muted" numberOfLines={2}>Ime nije dostupno</T>}
        <View style={s.meta}>
          <View accessible accessibilityLabel={`Ocena ${item.rating} od 5`} style={s.rating}>
            <FactArt kind="star" size={16} />
            <T variant="note" style={s.ink}>{`${item.rating} od 5`}</T>
          </View>
          <T variant="note" tone="muted">{vreme(item.createdAt)}</T>
        </View>
      </View>
    </View>
    <ReviewCommentText text={item.comment} />
  </View>;
}

const s = StyleSheet.create({
  ink: { color: sys.color.ink },
  // An open white section set off by one hairline, like the rating and the trust facts of a profile: no card, no card inside a card.
  section: { gap: sys.space.md, marginTop: sys.space.md, paddingTop: sys.space.base },
  // Standing still where the comments will be: no spinner, nothing moves.
  bar: { width: 160, height: 16, borderRadius: sys.radius.control, backgroundColor: sys.color.skeleton, marginVertical: sys.space.xs },
  state: { gap: sys.space.sm, alignItems: 'flex-start' },
  item: { gap: sys.space.sm },
  rule: { paddingTop: sys.space.md },
  head: { flexDirection: 'row', alignItems: 'center', gap: sys.space.md },
  who: { flex: 1, minWidth: 0, gap: sys.space.xs },
  meta: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: sys.space.md, rowGap: sys.space.xs },
  rating: { flexDirection: 'row', alignItems: 'center', gap: sys.space.xs },
});
