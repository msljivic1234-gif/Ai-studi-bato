import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';
import { router } from 'expo-router';
import type { DogovorProjekcija, UcesnikProjekcija } from '../../contracts/projections';
import { readableTitle } from '../../data/needDetailPresentation';
import { reviewCommentsClientService } from '../../data/reviewCommentsClientService';
import { REVIEW_COMMENT_MESSAGES, prepareReviewComment, reviewCommentLength } from '../../data/reviewCommentText';
import type { ReviewCommand, ReviewTag } from '../../data/reviewsClientService';
import { failure } from '../../data/serverReceipt';
import { useOwnedEditor } from '../../hooks/useOwnedEditor';
import { noviUuidZahtevId } from '../../lib/idempotencija';
import { AgreementReviewPresentation, type ReviewView } from './AgreementReviewPresentation';

export { AgreementReviewPresentation, type ReviewPerson, type ReviewView } from './AgreementReviewPresentation';

/**
 * The refusals of the comment itself (D12). Each one is raised before anything is stored, so the attempt that met it is over: the
 * command is released, the text and the stars stay on screen, and the person edits the comment and sends it as a new attempt.
 * Everything else that can go wrong keeps the unknown-outcome rule of this screen (the choice is frozen until the person checks).
 */
const COMMENT_REFUSALS: ReadonlySet<string> = new Set(['REVIEW_COMMENT_INVALID', 'REVIEW_COMMENT_TOO_LONG', 'REVIEW_COMMENT_CONTACT_NOT_PUBLIC',
  'REVIEW_COMMENT_UNAVAILABLE']);

export function backFromReview() { if (router.canGoBack()) router.back(); else router.replace('/dogovori'); }
/** The rating opened from a Dogovor: Back returns there, and with no history (a cold link) it opens that Dogovor, as it says. */
export function backFromReviewToAgreement(agreementId: string) {
  if (router.canGoBack()) router.back(); else router.replace({ pathname: '/dogovor/[id]', params: { id: agreementId } });
}
/** The rating opened from Početna: Back returns there, and with no history it lands there too. */
export function backFromReviewToHome() { if (router.canGoBack()) router.back(); else router.replace('/'); }

/**
 * One rating, up to N tags, one save. The saved receipt is final and shown as such.
 *
 * One calm screen (round 6, unit `prijava`, 2026-09-24; the owner's pick of 8 Oct 2026, "Zvezde kao nalepnice"): the person being rated
 * first, centred (their face at 72, name, what they are to me and the task), five stars as 48 dp stickers, the optional tags, and ONE
 * green save pinned at the foot. The stars are the screen's one orange accent. The person comes from a second read of the Dogovor; it never blocks or delays the rating,
 * and when it fails or does not match the person the server names, no person is drawn (nothing is invented).
 */
export function AgreementReviewScreen({ agreementId, accountId, accountRevision, backLabel = 'Nazad na Dogovor', onBack = backFromReview,
  readAgreement, photo, roleOf }: {
  agreementId: string; accountId: string; accountRevision: number;
  /** What the way back is called: the screen the rating was opened from ("Nazad na Početnu" from Početna's strip). */
  backLabel?: string;
  /** The way back, for the top bar's arrow and for the button that names it. */
  onBack?: () => void;
  /** Reads the Dogovor, only to show whom the rating is about. */
  readAgreement?: () => Promise<DogovorProjekcija | null>;
  /** The person's photo, drawn by the route at the `size` it is asked for (72, the face of the owner's rating); `fallback` (their letters, the same size) when there is none. */
  photo?: (profileId: string, fallback: ReactNode, size?: number) => ReactNode;
  /** What the person is to me, in the Dogovor's own words; the route hands it in so this screen loads no media code. */
  roleOf?: (person: UcesnikProjekcija) => string;
}) {
  // The one door to the review reads and writes. Without the D12 build flag, or against a backend without the package, it hands
  // every call to the legacy review service unchanged, and this screen is exactly the screen it was before comments existed.
  const read = useCallback(() => reviewCommentsClientService.context(agreementId, { accountId, accountRevision }),
    [agreementId, accountId, accountRevision]);
  const workspace = useOwnedEditor(read);
  const [rating, setRating] = useState(0), [tags, setTags] = useState<ReviewTag[]>([]);
  // The optional written comment (D12). Memory only: it lives here and in the request body, never in a store, a log or a cache, and
  // it is kept in THIS state (not the field's) so the loading swap of a resume cannot lose it.
  const [commentText, setCommentText] = useState(''), [commentOpen, setCommentOpen] = useState(false);
  // What the server refused about the comment, said under the save for as long as the text is the one it refused.
  const [refusal, setRefusal] = useState<{ message: string; text: string } | null>(null);
  const [attempt, setAttempt] = useState<ReviewCommand | null>(null);
  const attemptRef = useRef<ReviewCommand | null>(null);
  const activeRef = useRef(true);
  const [foreground, setForeground] = useState(true), [resumeRequired, setResumeRequired] = useState(false);
  // A mount effect, not a focus effect. On 2026-09-23 every star and tag on this screen was dead on two phones
  // and the emulator while the back arrow in the same top bar worked; the one difference was a guard that
  // compared a focus token minted inside `useFocusEffect` with the token the render had captured, and on the
  // device the two never met: the emulator probe of 2026-09-23 (build 4e864a08) showed the focus effect ran once with
  // AppState active, so the token was minted after the render that drew the stars, and nothing re-rendered after it. Which screen is current is
  // already owned by `useOwnedEditor` (its data is null while this screen is blurred, so nothing is editable
  // then, and a stale save is refused by its scope); the app's foreground state belongs to a mount effect.
  useEffect(() => {
    activeRef.current = true;
    const subscription = AppState.addEventListener('change', state => {
      activeRef.current = state === 'active'; setForeground(activeRef.current); setResumeRequired(true);
    });
    return () => { subscription.remove(); activeRef.current = false; };
  }, []);
  useEffect(() => {
    if (!foreground || !resumeRequired || workspace.busy) return;
    let current = true;
    void workspace.refresh().then(() => { if (current && activeRef.current) setResumeRequired(false); });
    return () => { current = false; };
  }, [foreground, resumeRequired, workspace.busy, workspace.refresh]);
  const context = workspace.data, receipt = context?.review;
  // Only a v2 context carries a comment policy, so a build without the flag (or a backend without D12) can never have a field.
  const commentPolicy = context?.commentPolicy ?? null, commentOn = commentPolicy !== null;
  const prepared = commentOn ? prepareReviewComment(commentText) : null;
  const refusedNow = refusal !== null && refusal.text === commentText ? refusal.message : null;
  // Why the comment cannot be sent as it stands: what the server would refuse, or what it just refused.
  const blocked = (prepared?.kind === 'invalid' ? REVIEW_COMMENT_MESSAGES[prepared.code] : null) ?? refusedNow;
  // Whom the rating is about: the Dogovor's own participant with the account the server named, and never me.
  const target = context?.targetAccountId ?? null;
  const [person, setPerson] = useState<{ who: UcesnikProjekcija; task: string } | null>(null);
  const personRequest = useRef(0);
  useEffect(() => {
    if (!readAgreement || !target) return;
    const request = ++personRequest.current;
    readAgreement().then(agreement => {
      if (request !== personRequest.current) return;
      const who = agreement?.ucesnici.find(p => p.id === target && !p.viSte);
      setPerson(who && agreement ? { who, task: readableTitle(agreement.naslov) } : null);
    }).catch(() => { if (request === personRequest.current) setPerson(null); });
    return () => { personRequest.current++; };
  }, [readAgreement, target]);
  // "Ponovi istu ocenu" only once a save has come back unconfirmed; the first save keeps its own words while it runs.
  const [settled, setSettled] = useState(false);
  useEffect(() => { if (attempt && !workspace.busy) setSettled(true); }, [attempt, workspace.busy]);
  // The refusal of the comment is said under the save and does not hold the screen: the person edits the comment and sends again.
  const refused = refusal !== null && workspace.error === refusal.message;
  const enabled = foreground && !resumeRequired && !workspace.loading && !workspace.busy && (!workspace.error || refused) && !workspace.uncertain;
  const current = () => activeRef.current;
  const editable = enabled && context?.eligible === true && !attempt;
  const submit = () => {
    if (!enabled || !current() || !context?.eligible || rating < 1 || blocked !== null) return;
    const sentText = commentText;
    void workspace.save(async () => {
      const comment = prepared?.kind === 'text' ? prepared.text : null;
      const command = attemptRef.current ?? { agreementId, targetAccountId: context.targetAccountId,
        rating, tags: [...tags].sort(), clientRequestId: noviUuidZahtevId(), ...(comment !== null ? { comment } : null) };
      attemptRef.current = command; setAttempt(command);
      const result = await reviewCommentsClientService.submit(command, { accountId, accountRevision });
      if (!result.ok) {
        if (COMMENT_REFUSALS.has(result.kod)) {
          attemptRef.current = null; setAttempt(null); setSettled(false); setRefusal({ message: result.poruka, text: sentText });
        }
        return result;
      }
      const checked = await read();
      if (!checked.ok) return checked;
      if (checked.podatak.review?.reviewId !== result.podatak.reviewId) {
        return failure('REVIEW_READBACK_REQUIRED', 'Ne možemo da vidimo da li je ocena sačuvana. Proverite to.');
      }
      return checked;
    }, commentOn ? { settledFailure: result => !result.ok && COMMENT_REFUSALS.has(result.kod) } : undefined);
  };
  const loading = workspace.loading || !foreground || resumeRequired;
  const retry = { label: attempt ? 'Proverite sačuvanu ocenu' : 'Ponovo učitajte ocenu', disabled: workspace.busy || !foreground,
    onPress: () => { if (current()) void workspace.refresh(); } };
  const view: ReviewView = loading ? { kind: 'loading' }
    : !context && workspace.error ? { kind: 'error', message: workspace.error }
    : receipt ? { kind: 'saved', rating: receipt.rating, tags: receipt.tags, fresh: workspace.saved, ...(receipt.comment ? { comment: receipt.comment } : null) }
    : context?.eligible ? { kind: 'eligible', catalog: context.tagCatalog, rating, tags, editable, attempt: !!attempt,
      onRate: value => { if (editable && current() && !attemptRef.current) setRating(value); },
      onToggleTag: tag => { if (editable && current() && !attemptRef.current) setTags(values => values.includes(tag)
        ? values.filter(value => value !== tag) : values.length < context.tagCatalog.maxTags ? [...values, tag] : values); },
      save: { label: settled ? 'Sačuvajte ocenu ponovo' : 'Sačuvajte ocenu', loading: workspace.busy, disabled: !enabled || rating < 1 || blocked !== null,
        reason: enabled && rating < 1 ? 'Izaberite ocenu od 1 do 5 pre slanja.' : enabled && blocked !== null ? blocked : null, onPress: submit },
      ...(commentPolicy ? { comment: { value: commentText, open: commentOpen || commentText !== '', editable, maxLength: commentPolicy.maxLength,
        count: reviewCommentLength(commentText), invalid: blocked !== null,
        onOpen: () => { if (editable && current()) setCommentOpen(true); },
        onChange: (text: string) => { if (editable && current() && !attemptRef.current) setCommentText(text); } } } : null) }
    : context ? { kind: 'unavailable' } : { kind: 'none' };
  return <AgreementReviewPresentation backLabel={backLabel} onBack={onBack} view={view} retry={retry}
    notice={!loading && workspace.error && context && workspace.error !== refusal?.message ? workspace.error : null}
    person={person ? { name: person.who.ime, initials: person.who.inicijali, profileId: person.who.profilId, role: roleOf?.(person.who) ?? '', task: person.task } : null}
    photo={photo} keyboardAware={commentOn} />;
}
