import { createContext, isValidElement, useContext, useEffect, useState, type ReactNode, type RefObject } from 'react';
import { Keyboard, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View, type ScrollViewProps } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { StanjeProfila } from '../../contracts/projections';
import { T } from '../Text';
import { DetailTopBar } from '../system/DetailTopBar';
import { FactArt } from '../system/FactArt';
import { layout, ruleWidth } from '../system/layout';
import { StateView } from '../system/StateView';
import { sys } from '../system/tokens';
import { ConversationArt } from '../system/ConversationArt';
import { V2Action } from '../v2/V2Action';
import { QuietReadState } from '../v2/QuietReadState';
import type { WorkerDraft } from './workerProfileDraft';
import { WorkerProfileSaved, type AvailableNowControl, type SavedProfilePart } from './WorkerProfileSaved';
import type { WorkerExecutionModeView } from '../../hooks/useWorkerExecutionModes';
import { type WorkerAiPart } from './workerProfileFacts';

/**
 * Frame of the worker profile: back, title, keyboard-safe body, sticky footer. `/profil/razgovor` and `/profil/lokacija`
 * draw it too, so the title can be theirs; the back says only "Nazad", because the screen is also opened from an
 * application (prijava) and Back returns there, not to the profile.
 *
 * While the software keyboard is up the sticky footer steps aside (review of step 9, 2026-09-24): on a 320 × 640 phone
 * the footer (status lines, a 54 dp primary, a quiet action or the area confirmation) rose with the keyboard and left
 * under 100 dp for the field being typed. It is hidden, not removed, so a button keeps its state and nothing is announced
 * again; it comes back as soon as the keyboard closes (Back, the return key, a drag of the body, or a tap outside the
 * field). The body keeps what the person needs while typing: the activation checklist and every field's own hint.
 *
 * A `WorkerProfileFooter` keeps its answer on screen while typing and steps aside only with its actions (round 5c): a tap
 * on a row that refuses because the draft is not saved, or a "Dopuni osnovne podatke" that focuses a field, writes its
 * sentence there, and hiding the whole footer made the tap look dead. Any other footer (the area confirmation, the AI
 * review) steps aside whole, because nothing in it answers a tap made while typing.
 */
export function WorkerProfileFrame({ back, children, footer, title = 'Profil za uskakanje', backLabel = 'Nazad', scrollRef, onScroll, onScrollBeginDrag, right, tone }: {
  back: () => void; children: ReactNode; footer?: ReactNode; title?: string; backLabel?: string;
  scrollRef?: RefObject<ScrollView | null>; onScroll?: ScrollViewProps['onScroll']; onScrollBeginDrag?: ScrollViewProps['onScrollBeginDrag'];
  /** At most one control in the bar's right place: the "ⓘ" with what the profile does with its data (`HeaderInfo`). */ right?: ReactNode;
  /** Match the live AI conversation while its owned read is in progress. */ tone?: 'conversation';
}) {
  const typing = useKeyboardShown();
  const keepsStatus = isValidElement(footer) && footer.type === WorkerProfileFooter;
  const aside = typing && !keepsStatus;
  return <SafeAreaView edges={['top', 'bottom']} style={[s.screen, tone === 'conversation' && s.conversationScreen]}>
    <DetailTopBar backLabel={backLabel} title={title} onBack={back} right={right} tone={tone} />
    <KeyboardAvoidingView style={s.grow} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      {/* The iOS number pad has no return key and iOS has no Back: dragging the body closes the keyboard (review 5b). */}
      <ScrollView ref={scrollRef} onScroll={onScroll} onScrollBeginDrag={onScrollBeginDrag} scrollEventThrottle={onScroll ? 16 : undefined}
        keyboardShouldPersistTaps="handled" keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
        contentContainerStyle={s.content}>{children}</ScrollView>
      {footer ? <FooterTyping.Provider value={typing}>
        <View testID="worker-profile-footer" style={[s.footer, typing && (keepsStatus ? s.footerTyping : s.footerAside)]}
          accessibilityElementsHidden={aside} importantForAccessibility={aside ? 'no-hide-descendants' : 'auto'}>{footer}</View>
      </FooterTyping.Provider> : null}
    </KeyboardAvoidingView>
  </SafeAreaView>;
}

/** Whether the frame's footer is drawn while the keyboard is up; only `WorkerProfileFooter` reads it. */
const FooterTyping = createContext(false);

/**
 * Whether the software keyboard is up, from the keyboard's own events (iOS says it before the animation, Android after).
 * It starts false: a footer is never hidden without an event saying the keyboard is there.
 */
function useKeyboardShown() {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const ios = Platform.OS === 'ios';
    const show = Keyboard.addListener(ios ? 'keyboardWillShow' : 'keyboardDidShow', () => setShown(true));
    const hide = Keyboard.addListener(ios ? 'keyboardWillHide' : 'keyboardDidHide', () => setShown(false));
    return () => { show.remove(); hide.remove(); };
  }, []);
  return shown;
}

/** Reading the profile, or why it could not be read. No draft is built from defaults. */
export function WorkerProfileStatus({ loading, error, retry, recoverCorrupt, context = 'profile' }: {
  loading: boolean; error?: string | null; retry: () => void; recoverCorrupt?: () => void;
  context?: 'profile' | 'conversation';
}) {
  if (context === 'conversation') return loading
    ? <QuietReadState art="chat" title="Otvaramo razgovor" body="Pripremamo razgovor i proveravamo stanje nacrta." />
    : <StateView kind="error" art="chat" title="Razgovor nije dostupan" body={error ?? undefined}
      primary={{ label: 'Ponovo učitajte razgovor', onPress: retry }}
      quiet={recoverCorrupt ? {label:'Oporavite lokalni zapis',onPress:recoverCorrupt}:undefined} />;
  if (loading) return <QuietReadState art="person" title="Učitavamo profil za uskakanje…" body="Proveravamo sačuvane veštine i dostupnost." />;
  return <StateView kind="error" title="Profil za uskakanje nije dostupan" body={error ?? undefined}
    primary={{ label: 'Ponovo učitajte profil', onPress: retry }} />;
}

/**
 * The answer to the last save, right above the button that made it: Save sits in this footer, often far below the top
 * of a long form, so a line at the top of the scroll was never seen. It is said only once the saved profile has been
 * read back (the route decides that); the button's own check confirms it for a moment.
 *
 * While the keyboard is up only the answer stays (the message and the error, with room of their own); the actions and
 * the held line step aside, mounted, so a button keeps its state and nothing is announced again (round 5c).
 */
export function WorkerProfileFooter({ message, error, held = false, children }: {
  message?: string | null; error?: string | null;
  /** An unconfirmed save is kept and only what is really saved is shown. */ held?: boolean; children: ReactNode;
}) {
  const typing = useContext(FooterTyping);
  return <>
    {message || error ? <View testID="worker-profile-answer" style={[s.answer, typing && s.answerTyping]}>
      {message ? <View style={s.statusLine}><FactArt kind="check" size={20} />
        <T accessibilityRole="alert" variant="body" style={[s.grow, s.ink]}>{message}</T></View> : null}
      {error ? <T accessibilityRole="alert" variant="body" style={s.danger}>{error}</T> : null}
    </View> : null}
    <View testID="worker-profile-actions" style={[s.answer, typing && s.footerAside]} accessibilityElementsHidden={typing}
      importantForAccessibility={typing ? 'no-hide-descendants' : 'auto'}>
      {held ? <T variant="meta" tone="muted">Vaš tekst nije izgubljen. Ispod je prikazano samo ono što je sačuvano.</T> : null}
      {children}
    </View>
  </>;
}

/** Personal profile activation needs identity/capabilities and an area, never a permanent team. */
export type WorkerActivationChecks = { basics: boolean; area: boolean; capacity?: boolean };
// The name is not typed here any more (owner, 8 Oct 2026: one name for everything, and "Lični podaci" is where it is changed), so the first check says
// what is still done here: the skills (and the account's name, which the work profile takes when it is activated).
const CHECKS: [keyof WorkerActivationChecks, string][] = [['basics', 'Veštine i ime naloga'], ['area', 'Područje rada']];
export type WorkerNavigation = '/profil/lokacija' | '/profil/dostupnost' | '/profil/obavestenja' | '/profil/podaci' | '/podrska';

/**
 * Whether tasks can be offered to you, first. Active is one line with a colored check. A draft is an open section with
 * the two things activation waits for, each marked ready or missing; they are not buttons, because the footer's
 * primary already leads to the first missing one. "Ready" is said only when the route's primary really is the
 * activation (both checks can pass while a change still has to be saved). A
 * suspension says so and offers support.
 */
function ActivationStatus({ status, checks, readyToActivate, disabled, navigate }: {
  status: StanjeProfila | null; checks?: WorkerActivationChecks; readyToActivate: boolean; disabled: boolean;
  navigate: (path: WorkerNavigation) => void;
}) {
  if (status === 'ACTIVE') return <View style={s.activeLine}>
    <FactArt kind="check" size={20} /><T variant="note" style={[s.grow, s.ink]}>Profil je aktivan</T>
  </View>;
  // Moderation wording is one word in the whole app: "suspendovan" (owner, 2026-10-07).
  if (status === 'SUSPENDED') return <View style={[s.status, s.suspended]}>
    <T variant="bodyStrong" style={s.danger}>Profil je trenutno suspendovan</T>
    <T variant="note" style={s.ink}>Dok traje suspenzija, zadaci Vam se ne nude.</T>
    <V2Action tone="neutral" label="Obratite se podršci" kind="quiet" compact disabled={disabled} onPress={() => navigate('/podrska')} style={s.start} />
  </View>;
  const draft = status === 'DRAFT';
  return <View style={s.status}>
    <View style={s.titleLine}><View style={s.dot} />
      <T variant="bodyStrong" style={[s.grow, s.ink]}>{draft ? 'Profil za uskakanje je još nacrt' : 'Profil za uskakanje još nije podešen'}</T></View>
    <T variant="note" tone="muted">{draft ? 'Dok je nacrt, zadaci Vam se ne nude.' : 'Bez njega ne možete da se prijavite na zadatak.'}</T>
    {checks ? <View style={s.checklist}>{CHECKS.map(([key, label]) => <View key={key} accessible
      accessibilityLabel={`${label}: ${checks[key] ? 'spremno' : 'nedostaje'}`} style={s.checkItem}>
      {checks[key] ? <FactArt kind="check" size={20} /> : <View style={s.emptyCheck} />}
      <T variant="note" style={[s.grow, s.ink]}>{label}</T>
    </View>)}</View> : null}
    {draft && readyToActivate ? <T variant="note" tone="muted">Sve je spremno za aktivaciju.</T> : null}
  </View>;
}

export type WorkerProfileFocusRequest = { target: 'skill' | 'tool' | 'vehicle'; token: number };
/** Saved profile or first AI entry. Legacy draft command recovery stays in the route.
 * Compatibility props do not re-enable the retired manual editor. */
export function WorkerProfileForm({ draft, disabled, status, navigate, openConversation, showConversationAction = true, profileExists = true, introOnly = false,
  accountName = null, onUseAccountName, nameWorking = false, face, rating, availableNow, executionModes, refreshModes, confirmMap, checks, readyToActivate }: {
  draft: WorkerDraft; change: (value: WorkerDraft) => void; disabled: boolean; status: StanjeProfila | null;
  navigate: (path: WorkerNavigation) => void; focusRequest?: WorkerProfileFocusRequest | null;
  checks?: WorkerActivationChecks; readyToActivate?: boolean; openConversation?: (part?: WorkerAiPart) => void; profileExists?: boolean;
  /** A saved draft uses its footer action; individual rows still open AI corrections. */ showConversationAction?: boolean;
  /** Only a pristine first visit. Retained drafts and uncertain writes must keep their recovery actions. */ introOnly?: boolean;
  reading?: boolean;
  /** Compatibility flag; ordinary facts always use AI, even when omitted. */ aiOnly?: boolean;
  executionModes?: WorkerExecutionModeView; refreshModes?: () => void;
  confirmMap?: () => void;
  /** Opens the AI topic for a profile section. */ onEditPart?: (part: SavedProfilePart) => void;
  /** The face in the card of the read profile. */ face?: ReactNode;
  /** The rating line in that card. */ rating?: ReactNode;
  /** Saved availability with an AI edit entry. */ availableNow?: AvailableNowControl;
  /** Retained caller compatibility only; cannot reopen the removed manual editor. */
  openSection?: { section: 'identity' | 'skills' | 'tools' | 'vehicles'; token: number } | null;
  /** The name of the account, when it could be read. */ accountName?: string | null;
  /** Writes the account's name into the work profile; without it the difference is not offered a way out. */ onUseAccountName?: () => void;
  /** That write is in flight. */ nameWorking?: boolean;
}) {
  if (introOnly || (!profileExists && status === null)) return <View testID="worker-profile-intro" style={s.setupIntro}>
    <ConversationArt size={96} />
    <T variant="heading" accessibilityRole="header" style={s.ink}>Ispričajte čime se bavite</T>
    <T variant="body" tone="muted">Koje zadatke želite da preuzimate, gde i kada Vam odgovara.</T>
    <T variant="note" tone="muted">Razgovor možete da nastavite kasnije. Profil aktivirate tek kada pregledate i potvrdite podatke.</T>
  </View>;
  return <WorkerProfileSaved draft={draft} disabled={disabled} navigate={navigate} openConversation={openConversation}
    showConversationAction={showConversationAction}
    executionModes={executionModes} refreshModes={refreshModes} confirmMap={confirmMap}
    readOnly={status === 'SUSPENDED'} face={face} rating={rating} availableNow={availableNow}
    accountName={accountName} onUseAccountName={onUseAccountName} nameWorking={nameWorking}
    status={<ActivationStatus status={status} checks={checks} readyToActivate={readyToActivate ?? false} disabled={disabled} navigate={navigate} />} />;
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: sys.color.ground }, conversationScreen: { backgroundColor: sys.conversation.ground }, grow: { flex: 1, minWidth: 0 },
  ink: { color: sys.color.ink }, danger: { color: sys.color.danger },
  start: { alignSelf: 'flex-start' },
  content: { paddingHorizontal: layout.gutter, paddingTop: sys.space.sm, gap: layout.section, paddingBottom: layout.zone },
  footer: { paddingHorizontal: layout.gutter, paddingVertical: sys.space.md, gap: sys.space.sm, borderTopWidth: ruleWidth, borderColor: sys.color.line,
    backgroundColor: sys.color.surface },
  footerAside: { display: 'none' },
  // While typing, a footer that keeps its answer draws no strip of its own: an empty one would sit on the keyboard.
  footerTyping: { paddingVertical: 0, borderTopWidth: 0, gap: 0 },
  answer: { gap: sys.space.sm }, answerTyping: { paddingVertical: sys.space.md },
  setupIntro: { gap: sys.space.md, paddingTop: sys.space.sm, paddingBottom: sys.space.xl },
  statusLine: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  activeLine: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  // Activation requirements are an open reading section; suspension keeps its meaningful warning surface.
  status: { gap: sys.space.md },
  suspended: { backgroundColor: sys.color.dangerSoft, padding: sys.space.base, borderRadius: sys.radius.control },
  titleLine: { flexDirection: 'row', alignItems: 'center', gap: sys.space.sm },
  dot: { width: 8, height: 8, borderRadius: sys.radius.pill, backgroundColor: sys.color.orange },
  checklist: { gap: sys.space.xs },
  checkItem: { minHeight: 28, flexDirection: 'row', alignItems: 'center', gap: sys.space.sm },
  emptyCheck: { width: 20, height: 20, borderRadius: sys.radius.pill, borderWidth: 1.5, borderColor: sys.color.lineStrong },
});
