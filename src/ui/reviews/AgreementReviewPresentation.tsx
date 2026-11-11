import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import type { ReviewTag } from '../../data/reviewsClientService';
import { Press } from '../Press';
import { Avatar, FaceEdge } from '../system/Avatar';
import { DetailTopBar } from '../system/DetailTopBar';
import { FlowFooter } from '../system/FlowFooter';
import { Glyph } from '../system/Glyph';
import { layout } from '../system/layout';
import { PECAT_FALL_MS, Pecat } from '../system/Pecat';
import { Screen } from '../system/Screen';
import { Section } from '../system/Section';
import { StateView } from '../system/StateView';
import { Surface } from '../system/Surface';
import { plural } from '../system/plural';
import { brandAction, sys } from '../system/tokens';
import { T } from '../Text';
import { V2Action } from '../v2/V2Action';
import { QuietReadState } from '../v2/QuietReadState';
import { RatingStar, STARS_WIDTH, STAR_SLOT, StarGlow } from './RatingStar';
import { ReviewCommentField, type ReviewCommentFieldView } from './ReviewCommentField';
import { ReviewCommentText } from './ReviewCommentText';

/*
 * The rating screen as it is drawn (round 6, unit `prijava`, 2026-09-24), apart from the screen that reads and saves it
 * (`AgreementReviewScreen`), so the internal gallery can draw every state from fixtures without touching a data service.
 * It imports the review types only, never the service.
 *
 * Owner's picks of 8 Oct 2026: "Zvezde kao nalepnice" (the person's face at 72 with its sticker edge stands above the stars, centred;
 * the five stars are 48 dp stickers) and "Pilula pada, sjaj" (the saved rating: the pill "Ocenjeno" falls onto the corner of the stars
 * and one glow crosses them, only for a rating that has JUST been saved).
 */
export const tagLabels: Record<ReviewTag, string> = {
  AS_AGREED: 'Po dogovoru', CAREFUL: 'Pažljivo', CLEAR_COMMUNICATION: 'Jasna komunikacija',
  ON_TIME: 'Na vreme', RELIABLE: 'Pouzdano', RESPECTFUL: 'Uz poštovanje',
};
const ratingLabels = ['Izaberite ocenu', 'Loše', 'Ispod očekivanja', 'Dobro', 'Vrlo dobro', 'Odlično'];
const STARS = [1, 2, 3, 4, 5] as const;
/** The face of the person the rating is about: 72, centred, the sticker edge round it. */
const FACE = 72;
const reviewedTags = (tags: readonly ReviewTag[]) => tags.map(tag => tagLabels[tag]).join(' · ');
/** What the saved screen says once, under the rating: why it matters to others and that it cannot be changed. */
export const SACUVANO_NOTE = 'Ocena se ne može menjati. Objavljuje se kada obe strane ocene saradnju ili kada isteknu 14 dana od njenog završetka.';
/** Whom the rating is about, as the screen draws them: never invented, absent when the Dogovor did not say. */
export type ReviewPerson = { name: string; initials: string; profileId: string | null; role: string; task: string };
/** What the rating screen shows; each state carries only what it draws. */
export type ReviewView =
  | { kind: 'loading' } | { kind: 'none' } | { kind: 'unavailable' }
  | { kind: 'error'; message: string }
  | { kind: 'saved'; rating: number; tags: readonly ReviewTag[]; fresh: boolean;
      /** D12: the person's own comment as the server stored it. Absent when there is none, and in a build without comments. */
      comment?: string | null }
  | { kind: 'eligible'; catalog: { maxTags: number; tags: readonly ReviewTag[] }; rating: number; tags: readonly ReviewTag[]; editable: boolean;
      attempt: boolean; onRate: (value: number) => void; onToggleTag: (tag: ReviewTag) => void;
      save: { label: string; loading: boolean; disabled: boolean; reason: string | null; onPress: () => void };
      /** D12: the optional comment. Absent when the build or the backend has no comments: then nothing of it is drawn. */
      comment?: ReviewCommentFieldView };
type ReviewRetry = { label: string; disabled: boolean; onPress: () => void };

/**
 * The rating screen as it is drawn, from its state alone (the internal gallery draws it with fixtures). Presentation
 * only: every press is the screen's own handler, which keeps its guards.
 */
export function AgreementReviewPresentation({ backLabel, onBack, view, retry, notice, person, photo, keyboardAware = false }: {
  backLabel: string; onBack: () => void; view: ReviewView; retry: ReviewRetry;
  /** A failure with the rating still on screen: said in the foot, beside the one way to check again. */
  notice: string | null;
  /** The person's photo at the size asked for (72), or `fallback` (their letters, the same size) when there is none. */
  person: ReviewPerson | null; photo?: (profileId: string, fallback: ReactNode, size?: number) => ReactNode;
  /** D12: a comment can be typed on this screen, so the save stays above the keyboard. Off, the screen is laid out exactly as it always was. */
  keyboardAware?: boolean;
}) {
  // The photo when the person has one, and their letters in the same disc when not; both at 72, inside the sticker edge.
  const letters = person ? <Avatar initials={person.initials} size={FACE} /> : null;
  const face = person ? <FaceEdge>{person.profileId && photo ? photo(person.profileId, letters, FACE) : letters}</FaceEdge> : null;
  const tagsFull = view.kind === 'eligible' && view.tags.length >= view.catalog.maxTags;
  // `none` (no read has answered yet) is drawn as loading: never an empty screen without a way on.
  const loading = view.kind === 'loading' || view.kind === 'none';
  // The foot is the system's `FlowFooter`: one green action, at most one quiet one, and why the green one is grey in a line ABOVE it.
  const alert = notice ? <Surface kind="note" tone="warn"><T accessibilityRole="alert" variant="body" style={s.ink}>{notice}</T></Surface> : null;
  const footer = loading || view.kind === 'error' ? null
    // A saved rating stays saved when a later read fails: the way back stays the green action, the check beside it.
    : notice && view.kind === 'saved' ? <FlowFooter>
      {alert}
      <V2Action label={backLabel} onPress={onBack} style={brandAction} />
      <V2Action label={retry.label} kind="quiet" disabled={retry.disabled} onPress={retry.onPress} />
    </FlowFooter>
    : notice ? <FlowFooter>
      {alert}
      <V2Action label={retry.label} disabled={retry.disabled} onPress={retry.onPress} style={brandAction} />
    </FlowFooter>
    : view.kind === 'saved' ? <FlowFooter><V2Action label={backLabel} onPress={onBack} style={brandAction} /></FlowFooter>
    // Before "Sačuvaj" a person is told once what saving means (idea R29); while the button is grey, the line above it says why instead.
    : view.kind === 'eligible' ? <FlowFooter reason={view.save.disabled && view.save.reason ? view.save.reason : undefined}>
      {!(view.save.disabled && view.save.reason) ? <T variant="note" tone="muted" testID="review-save-warning">{SAVE_WARNING}</T> : null}
      <V2Action label={view.save.label} loading={view.save.loading} disabled={view.save.disabled} onPress={view.save.onPress} style={brandAction} />
    </FlowFooter>
    : null;
  const [errorTitle, errorBody] = view.kind === 'error' ? firstSentence(view.message) : ['', null];
  return <Screen kind="flow" keyboardAvoiding={keyboardAware} header={<DetailTopBar title="Ocena saradnje" backLabel={backLabel} onBack={onBack} />} footer={footer}>
      {loading ? <QuietReadState art="star" title="Učitavamo ocenu…" body="Proveravamo Dogovor i mogućnost ocenjivanja." />
        : view.kind === 'error' ? <StateView kind="error" title={errorTitle} body={errorBody ?? undefined}
          primary={{ label: retry.label, onPress: retry.onPress, disabled: retry.disabled }} />
        : view.kind === 'saved' ? <SavedRating view={view} person={person} face={face} />
        : view.kind === 'eligible' ? <>
          {person ? <View accessible accessibilityLabel={[person.name, person.role, person.task].filter(Boolean).join(', ')} style={s.person}>
            {face}
            <T accessible={false} variant="title" style={[s.ink, s.center]} numberOfLines={2}>{person.name}</T>
            {person.role ? <T variant="note" tone="muted" style={s.center}>{person.role}</T> : null}
            {person.task ? <T variant="note" tone="muted" style={s.center} numberOfLines={2}>{person.task}</T> : null}
          </View> : null}
          <View style={s.rating}>
            <T accessibilityRole="header" variant={person ? 'heading' : 'title'} style={[s.ink, s.center]}>Kako je prošla saradnja?</T>
            <View accessibilityRole="radiogroup" accessibilityLabel="Ocena od 1 do 5" style={s.stars}>
              {/* A star takes its colour on the press, with no scale or bounce: the rating is a fact. */}
              {STARS.map(value => <Press key={value} accessibilityRole="radio" accessibilityLabel={`Ocena ${value} od 5`}
                accessibilityHint={ratingLabels[value]}
                accessibilityState={{ checked: view.rating === value, disabled: !view.editable }} disabled={!view.editable} haptic="select" scaleTo={1} hitSlop={0}
                onPress={() => view.onRate(value)} style={s.star}>
                <RatingStar full={value <= view.rating} />
              </Press>)}
            </View>
            {/* The word for the chosen stars. Before any is chosen the foot says "Izaberi ocenu" once, so the line holds its place and stays quiet. */}
            <T accessibilityLiveRegion="polite" variant="bodyStrong" style={[s.ink, s.center]}>{view.rating ? ratingLabels[view.rating] : ' '}</T>
          </View>
          <Section title="Šta je obeležilo saradnju?">
            <T variant="note" tone="muted">{`Nije obavezno · najviše ${view.catalog.maxTags}`}</T>
            <View style={s.tags}>
              {view.catalog.tags.map(tag => {
                const selected = view.tags.includes(tag), capped = !selected && tagsFull, disabled = !view.editable || capped;
                return <Press key={tag} accessibilityRole="checkbox" accessibilityLabel={tagLabels[tag]}
                  accessibilityHint={capped ? fullHint(view.catalog.maxTags) : undefined}
                  accessibilityState={{ checked: selected, disabled }} disabled={disabled} haptic="select" hitSlop={0}
                  onPress={() => { if (!disabled) view.onToggleTag(tag); }} style={[s.tag, selected && s.tagSelected]}>
                  {selected ? <Glyph name="check" size={16} tone="green" /> : null}
                  <T variant="note" style={selected ? s.tagTextSelected : capped ? s.tagTextCapped : s.ink}>{tagLabels[tag]}</T>
                </Press>;
              })}
            </View>
            {tagsFull && view.editable ? <T variant="note" tone="muted" accessibilityLiveRegion="polite">{fullHint(view.catalog.maxTags)}</T> : null}
          </Section>
          {view.comment ? <ReviewCommentField field={view.comment} /> : null}
          {view.attempt ? <T variant="meta" tone="muted">Čuvamo Vašu ocenu dok proveravate da li je poslata.</T> : null}
        </> : view.kind === 'unavailable' ? <StateView kind="empty" art="star" title="Ocena nije dostupna" body="Ocenu možete poslati nakon završetka Dogovora, u roku od 14 dana."
          primary={{ label: backLabel, onPress: onBack }} /> : null}
  </Screen>;
}

/**
 * The saved rating: the same column as before saving (the face, the name, then the stars), now with the title "Ocena je sačuvana.", the
 * stars as they were given, the pill "Ocenjeno" and what the rating said. Right after saving (`fresh`) the pill falls onto the corner of
 * the stars, the glow crosses them once as it lands, and the stamp makes the success tick as it lands (an outcome the server confirmed);
 * reopened later, nothing moves and nothing ticks, because nothing new happened. The stars and the words are the fact and never move.
 */
function SavedRating({ view, person, face }: { view: Extract<ReviewView, { kind: 'saved' }>; person: ReviewPerson | null; face: ReactNode }) {
  return <>
    {person ? <View style={s.person}>
      {face}
      <T variant="bodyStrong" style={[s.ink, s.center]} numberOfLines={2}>{person.name}</T>
    </View> : null}
    <View style={s.saved}>
      {/* A sentence-form event title ends with a stop, as "Prijava je poslata." and "Dogovor je sklopljen." do. */}
      <T accessibilityRole="header" variant="title" style={[s.ink, s.center]}>Ocena je sačuvana.</T>
      <View style={s.starsBox}>
        <StarGlow width={STARS_WIDTH} play={view.fresh} delay={PECAT_FALL_MS}>
          <View style={s.stars} accessible={false} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
            {STARS.map(value => <View key={value} style={s.star}><RatingStar full={value <= view.rating} /></View>)}
          </View>
        </StarGlow>
        <Pecat label="Ocenjeno" tone="green" shape="check" tickKind="success" play={view.fresh} style={s.pecat} />
      </View>
      <T variant="body" style={[s.ink, s.center]}>{`Vaša ocena: ${view.rating} od 5`}</T>
      {view.tags.length ? <T variant="note" tone="muted" style={s.center}>{reviewedTags(view.tags)}</T> : null}
      {view.comment ? <View style={s.savedComment}>
        <T variant="meta" tone="muted">Vaš komentar</T>
        <ReviewCommentText text={view.comment} />
      </View> : null}
      <T variant="note" tone="muted" style={[s.center, s.note]}>{SACUVANO_NOTE}</T>
    </View>
  </>;
}

/** Said once, above "Sačuvaj": a saved rating cannot be changed (idea R29). */
export const SAVE_WARNING = 'Ocenu posle čuvanja ne možete menjati. Objavljuje se kada obe strane ocene ili isteknu 14 dana od završetka.';

/** Why the other tags stopped taking a press once the most are chosen. */
function fullHint(max: number): string {
  return `Najviše ${plural(max, 'oznaka', 'oznake', 'oznaka')}. Uklonite jednu da izaberete drugu.`;
}
/** "Ocenu trenutno nije moguće učitati. Proveri vezu." → the first sentence and the rest. */
function firstSentence(message: string): [string, string | null] {
  const match = /^(.+?[.!?])\s+(\S[\s\S]*)$/.exec(message.trim());
  return match ? [match[1], match[2]] : [message.trim(), null];
}

const s = StyleSheet.create({
  ink: { color: sys.color.ink },
  center: { textAlign: 'center' },
  // The person the rating is about: the face over the name, centred, as the owner's picture has them.
  person: { alignItems: 'center', gap: sys.space.sm, paddingTop: sys.space.sm },
  rating: { gap: sys.space.md },
  // Five stars of 48 and four gaps of 8: 272 dp, centred.
  stars: { flexDirection: 'row', gap: sys.space.sm, width: STARS_WIDTH, alignSelf: 'center' },
  star: { width: STAR_SLOT, height: STAR_SLOT, alignItems: 'center', justifyContent: 'center' },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: sys.space.sm, paddingTop: sys.space.xs },
  tag: { minHeight: layout.touch, paddingHorizontal: sys.space.base, flexDirection: 'row', alignItems: 'center', gap: sys.space.xs,
    borderRadius: sys.radius.pill, borderWidth: 1, borderColor: sys.color.lineStrong, backgroundColor: sys.color.surface },
  tagSelected: { borderColor: sys.color.green, backgroundColor: sys.color.greenSoft },
  tagTextSelected: { color: sys.color.green, fontWeight: '700' }, tagTextCapped: { color: sys.color.muted },
  saved: { alignItems: 'center', gap: sys.space.md },
  starsBox: { width: STARS_WIDTH, alignSelf: 'center', paddingTop: sys.space.sm },
  // The pill lands on the top right corner of the stars, half over their edge.
  pecat: { position: 'absolute', top: -sys.space.xs, right: -sys.space.sm },
  savedComment: { alignSelf: 'stretch', gap: sys.space.xs },
  note: { paddingTop: sys.space.sm },
});
