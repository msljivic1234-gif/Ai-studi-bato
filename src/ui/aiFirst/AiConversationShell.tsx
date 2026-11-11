import { createContext, memo, useCallback, useContext, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { Animated as NativeAnimated, AppState, Easing, Keyboard, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, TextInput, View, useWindowDimensions, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { Easing as ReanimatedEasing, FadeInDown } from 'react-native-reanimated';
import { T } from '../Text';
import { withInter } from '../interFont';
import { Press } from '../Press';
import { ChromeIconButton, ScreenChrome } from '../system/ScreenChrome';
import { FactArt, type FactArtKind, type FactArtRole } from '../system/FactArt';
import { Glyph } from '../system/Glyph';
import { layout } from '../system/layout';
import { ListRow } from '../system/ListRow';
import { Section } from '../system/Section';
import { Surface } from '../system/Surface';
import { AiAssistantArt, AiAssistantWelcome, type AssistantWelcomeMemory } from './AiAssistantArt';
import { useConfirmSheet } from '../system/ConfirmSheet';
import { useReducedMotion } from '../system/motion';
import { useLayoutClass, useTextScale } from '../system/textScale';
import { sys } from '../system/tokens';
import { VOICE_PROCESSING_NOTICE } from '../../features/voice/useHoldToTalk';
import { HOLD_HINT, VoiceComposer, VoiceNotice, useVoiceScreenReader, type VoiceInput } from './VoiceComposer';
import { useConversationArrival } from './useConversationArrival';
import { useStreamDisplay } from './useStreamDisplay';
import type { AiCorrectionIntent } from '../../data/aiCorrectionIntent';

export type ConversationMessage = { id: string; fromAi: boolean; body: string };
/** A line of the conversation's own history that is not a message (a confirmed place), drawn after the message it followed. */
export type ConversationNote = { key: string; afterMessageId: string | null; node: ReactNode };
const DraftDisclosure = createContext<{ expanded: boolean; toggle: () => void } | null>(null);
/** Disclosure is presentation state, never the command that prepares the full review. */
export function useAiDraftDisclosure() {
  const shared = useContext(DraftDisclosure);
  const [expanded, setExpanded] = useState(false);
  return shared ?? { expanded, toggle: () => setExpanded(value => !value) };
}
export type AiConversationShellProps = {
  /** Separates arrival/announcement ownership when a different conversation replaces this view. */ conversationKey?: string;
  /** The chrome's title; the chrome draws no line under it (no copy that explains where you are). */ title: string;
  /** The one live card; null until there is something to show. */ card: (compact: boolean) => ReactNode;
  /** A completed draft can become the next decision at the end of the thread, shown once. */
  cardPlacement?: 'top' | 'end' | 'beforeLatestReply';
  messages: readonly ConversationMessage[]; welcome: string; welcomeDetail: string;
  /** Fixed UI greeting, not an AI turn, not saved or sent to the provider. */
  introMessage?: string;
  /** Returning profiles can lead with the question instead of replaying the large first-visit illustration. */
  showWelcomeArt?: boolean;
  /** Selects the initial control only; switching modes never starts capture or sends text. */
  initialInputMode?: 'keyboard' | 'voice';
  value: string; canEdit: boolean; canSend: boolean; pending: boolean; busy: boolean;
  /** Non-reply work, such as abandoning or verifying a conversation. */
  busyLabel?: string;
  onChange: (value: string) => void; onSend: () => void; onBack: () => void;
  /** Local editing context. It never becomes a message or changes the typed draft. */
  correction?: AiCorrectionIntent & { onDismiss: () => void };
  /** A caller-owned unfinished step can temporarily hold sending without erasing the typed draft. */
  sendBlockedReason?: string;
  /** Named conversation tools. Left out when the owner has no supported action. */
  onOptions?: () => void;
  /** An everyday action, visible without opening the options menu. The route owns confirmation and reconciliation. */
  newConversation?: { onPress: () => void; disabled?: boolean };
  /** A guarded draft exit beside the latest conversation, owned by the route. */
  exitAction?: ReactNode;
  status?: ReactNode; actions?: ReactNode; children?: ReactNode;
  /** Quiet, read-only facts understood so far; the full guarded card still waits for review readiness. */
  draftCue?: ReactNode;
  /** Current task context, such as its location, on the conversation's open white surface. */
  context?: ReactNode;
  /** Keep an existing map before a follow-up answer so the answer remains the latest readable item. */
  contextBeforeMessageId?: string;
  /** An owned inline editing visit. Reveal its top once; local height changes never follow the thread end. */
  interactiveContextKey?: string;
  /** The visit was asked for explicitly (a tap on a line far up the thread): reveal it even while earlier messages are read. */
  revealInteractiveContext?: boolean;
  /** History notes, each an ordinary item of the message list after the message it followed (owner, 2026-10-07: nothing
   *  stays docked at the bottom). A null anchor, or one no longer in the thread, places the note after the last message. */
  threadNotes?: readonly ConversationNote[];
  /** The conversation's next primary step, shown above the composer when the draft is ready (or alone, where the composer stood, once `closed`). */
  footerAction?: ReactNode;
  /**
   * The conversation is over and takes no more words: the field, the microphone and the voice mode are not drawn (the owner's phone, 8 Oct 2026: a
   * finished conversation still invited "Opiši šta ti treba"). Where they stood is `footerAction`, the one thing left to do, or nothing.
   */
  closed?: boolean;
  /** One controller for held/tapped speech and optional transcript review. */
  voice?: VoiceInput;
  /** The "+" at the start of the composer (the task's photos). Left out when there is nothing to attach to. */
  attach?: { label: string; hint?: string; onPress: () => void; disabled?: boolean };
  placeholder?: string;
  /**
   * Openings offered before the first word (38 of the first 62 conversations never got one): whole sentences a person might say,
   * not names of categories. Each is a row of the empty conversation; one tap puts the sentence in the field for the person to finish.
   */
  openings?: readonly string[];
  /** Illustrations describe the opening's task; they add no command or domain state. */
  openingArts?: readonly FactArtKind[];
  /** A sentence already sent and not yet read back from the server. It belongs on screen. */
  sentMessage?: string | null;
  /** Only real server text deltas belong here. No typewriter animation. */
  streamingText?: string;
  /**
   * One question at a time (the worker-profile conversation, M1): the assistant's latest message is THE question and is
   * drawn large, while it waits for an answer; earlier assistant turns are quieter. Default off: a thread of the task
   * conversation keeps one size for every turn.
   */
  questionFocus?: boolean;
};

/**
 * The AI conversation (owner step 6, 2026-09-24, after the owner's Gemini reference): one chrome (the arrow back, the
 * title), a compact live draft beside the current question, and one composer edge.
 *
 * - The assistant speaks on an open reading surface with a quiet group label; the person's own words are
 *   dark ink bubbles on the right. Nothing is typed out that has not arrived: streamed text is the
 *   server's own deltas, and while nothing has arrived three dots say that an answer is being written.
 * - The composer gives text its full width; attachments and speech sit in a separate toolbar, with send at the right.
 *   The caller chooses the initial input control. Speech still returns text; a send that cannot go now explains why.
 *
 * No domain mutations: card, transcript and composer share one bounded surface, and every command is the screen's own.
 */
export function AiConversationShell(p: AiConversationShellProps) {
  const { height } = useWindowDimensions();
  const textScale = useTextScale();
  // The up-right arrow at the end of an opening only fits beside the words; at a large text size the row would put it under them.
  const { stacked: stackedRows } = useLayoutClass();
  const [keyboard, setKeyboard] = useState(false);
  const [tapToTalk, setTapToTalk] = useState(false);
  const [reviewFirst, setReviewFirst] = useState(false);
  const reader = useVoiceScreenReader();
  const [modeChoice, setModeChoice] = useState({ key: p.conversationKey, mode: 'auto' });
  const selectedInputMode = !p.voice ? 'keyboard' : modeChoice.key === p.conversationKey && modeChoice.mode !== 'auto'
    ? modeChoice.mode : p.value.trim() ? 'keyboard' : p.initialInputMode ?? 'voice';
  const captureInputMode = useRef({ key: p.conversationKey, mode: selectedInputMode });
  if (!p.voice || p.voice.state.phase === 'IDLE' || captureInputMode.current.key !== p.conversationKey) {
    captureInputMode.current = { key: p.conversationKey, mode: selectedInputMode };
  }
  const inputMode = captureInputMode.current.mode;
  const voiceMode = inputMode === 'voice';
  // The alternative gesture uses this same controller, never a second conversation screen.
  const [holdHint, setHoldHint] = useState(false);
  const [readingEarlier, setReadingEarlier] = useState(false);
  const [inputFocused, setInputFocused] = useState(false);
  const [composerWidth, setComposerWidth] = useState(0);
  const [inputHeight, setInputHeight] = useState(48);
  const [expandedDraft, setExpandedDraft] = useState(false);
  const [disclosure, setDisclosure] = useState({ key: p.conversationKey, expanded: false });
  const [transcriptReview, setTranscriptReview] = useState<{ key: string | undefined; value: string } | null>(null);
  useEffect(() => { setTranscriptReview(null); }, [p.conversationKey]);
  useEffect(() => { if (p.pending || p.closed) setTranscriptReview(null); }, [p.pending, p.closed]);
  const assistantWelcome = useRef<AssistantWelcomeMemory>({ key: p.conversationKey, consumed: false });
  const expanded = disclosure.key === p.conversationKey && disclosure.expanded;
  const input = useRef<TextInput>(null);
  const inputFocusFrame = useRef<number | null>(null);
  useEffect(() => () => {
    if (inputFocusFrame.current !== null) cancelAnimationFrame(inputFocusFrame.current);
    inputFocusFrame.current = null;
  }, [p.conversationKey]);
  const focusedCorrection = useRef<string | null>(null);
  useEffect(() => {
    if (!p.correction || p.closed || !p.canEdit || voiceMode || (p.voice && p.voice.state.phase !== 'IDLE') || focusedCorrection.current === p.correction.token) return;
    focusedCorrection.current = p.correction.token;
    input.current?.focus();
  }, [p.correction?.token, p.canEdit, p.closed, voiceMode, p.voice?.state.phase]);
  const thread = useRef<ScrollView>(null);
  // Only a deliberate reading gesture changes intent. Keyboard and content geometry must never impersonate one.
  const followLatest = useRef(true);
  const userScrolling = useRef(false);
  const momentumAllowed = useRef(false);
  const historyOffset = useRef(0);
  const contextHeight = useRef(0);
  const anchorConversation = useRef(p.conversationKey);
  const contextActive = useRef(false);
  const inlineContext = !!p.context && !!p.contextBeforeMessageId && p.messages.some(message => message.id === p.contextBeforeMessageId);
  contextActive.current = !!p.context && p.interactiveContextKey !== undefined && (!inlineContext || !!p.revealInteractiveContext);
  const contextOwner = useRef<{ key: string; conversation: string | undefined; pending: boolean; measuring: boolean } | null>(null);
  // RN exposes innerViewRef for measurement relative to the actual scroll content, not its viewport.
  const threadContent = useRef<View>(null!);
  const interactiveContext = useRef<View>(null);
  const latestReply = useRef<View>(null);
  const replyKey = useRef<string | null>(null);
  const lastMessage = p.messages.at(-1);
  replyKey.current = (p.cardPlacement === 'end' || p.cardPlacement === 'beforeLatestReply') && lastMessage?.fromAi && !p.sentMessage && !p.streamingText && !p.pending && !p.closed
    ? lastMessage.id : null;
  const geometry = useRef({ offset: 0, content: 0, viewport: 0 });
  const followFrame = useRef<number | null>(null);
  const hasActivity = !!(p.messages.length || p.sentMessage || p.pending || p.busy || p.streamingText);
  const activity = useRef(hasActivity); activity.current = hasActivity;
  const cancelFollow = useCallback(() => {
    if (followFrame.current !== null) cancelAnimationFrame(followFrame.current);
    followFrame.current = null;
  }, []);
  const revealContext = useCallback(() => {
    const owner = contextOwner.current;
    if (!contextActive.current || !owner?.pending || owner.measuring || userScrolling.current) return;
    cancelFollow();
    followFrame.current = requestAnimationFrame(() => {
      followFrame.current = null;
      if (!contextActive.current || contextOwner.current !== owner || !owner.pending || userScrolling.current) return;
      const node = interactiveContext.current, ancestor = threadContent.current;
      if (!node || !ancestor) return; // A later actual layout event retries; never spin waiting for a native ref.
      owner.measuring = true;
      const current = () => contextActive.current && contextOwner.current === owner && owner.pending
        && !userScrolling.current && interactiveContext.current === node && threadContent.current === ancestor;
      const failed = () => { owner.measuring = false; };
      try {
        node.measureLayout(ancestor, (_x, y) => {
          owner.measuring = false;
          if (!current() || !Number.isFinite(y)) return;
          owner.pending = false;
          // A content-size event may still describe the preceding conversation.
          // Let the native ScrollView clamp against its current layout instead.
          const target = Math.max(0, y);
          historyOffset.current = target; geometry.current.offset = target;
          thread.current?.scrollTo({ y: target, animated: false });
        }, failed);
      } catch { failed(); }
    });
  }, [cancelFollow]);
  useLayoutEffect(() => {
    cancelFollow();
    const newConversation = anchorConversation.current !== p.conversationKey;
    anchorConversation.current = p.conversationKey;
    contextOwner.current = contextActive.current && p.interactiveContextKey !== undefined
      ? { key: p.interactiveContextKey, conversation: p.conversationKey,
          pending: newConversation || !!p.revealInteractiveContext || (followLatest.current && !userScrolling.current), measuring: false } : null;
    revealContext();
    return () => { contextOwner.current = null; cancelFollow(); };
  }, [p.conversationKey, p.interactiveContextKey, !!p.context, inlineContext, !!p.revealInteractiveContext, cancelFollow, revealContext]);
  const cancelContextReveal = () => { if (contextOwner.current) contextOwner.current.pending = false; };
  const scrollLatest = useCallback((animated = false) => {
    thread.current?.scrollToEnd({ animated });
  }, []);
  const followAfterLayout = useCallback(() => {
    if (contextActive.current || !followLatest.current || userScrolling.current || !activity.current) return;
    cancelFollow();
    followFrame.current = requestAnimationFrame(() => {
      followFrame.current = null;
      if (!contextActive.current && followLatest.current && !userScrolling.current && activity.current) {
        thread.current?.scrollToEnd({ animated: false });
      }
    });
  }, [cancelFollow]);
  const reduced = useReducedMotion();
  // Show received, complete Unicode boundaries without a synthetic typewriter.
  // Reduced motion uses this same immediate, monotone preview.
  const displayedStream = useStreamDisplay(p);
  const notice = useConfirmSheet({ reduced });
  const arrival = useConversationArrival(p);
  const compact = keyboard || height < 760 || textScale >= 1.3 || p.pending;
  // An open keyboard or large text can leave no room for the answer below a pinned draft.
  // Keep the same review target in the transcript; its existing anchor handling preserves reading position.
  const inlineSummary = keyboard || textScale >= 1.6 || height < 500;
  // An end card has one stable owner/location, including while the keyboard is open.
  // Default to end placement so the chat remains spacious and unobstructed (ChatGPT style) without top pinned clutter.
  const cardAtEnd = p.cardPlacement ? p.cardPlacement === 'end' || p.cardPlacement === 'beforeLatestReply' : true;
  const cardBeforeReply = p.cardPlacement === 'beforeLatestReply' && !!replyKey.current;
  const pinned = p.card(compact);
  const finalizingSpeech = p.voice?.state.phase === 'FINALIZING'
    ? [p.voice.state.finalText, p.voice.state.interimText].filter(Boolean).join(' ').trim()
    : '';
  const shownSentMessage = p.sentMessage || (finalizingSpeech ? finalizingSpeech : null);
  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', () => { setKeyboard(true); followAfterLayout(); });
    const hide = Keyboard.addListener('keyboardDidHide', () => { setKeyboard(false); followAfterLayout(); });
    return () => { show.remove(); hide.remove(); cancelFollow(); };
  }, [cancelFollow, followAfterLayout]);
  useEffect(() => {
    if (shownSentMessage) {
      latest(true);
    }
  }, [shownSentMessage]);
  const phase = p.voice?.state.phase ?? 'IDLE';
  // The advice after a tap goes as soon as the microphone does anything.
  useEffect(() => { if (phase !== 'IDLE') setHoldHint(false); }, [phase]);
  // Speech that closes (the conversation ended, or it cannot take speech any more) takes voice mode with it.
  useEffect(() => { setTapToTalk(false); setReviewFirst(false); }, [p.conversationKey]);
  const previousValue = useRef({ key: p.conversationKey, value: p.value, phase, session: p.voice?.state.session });
  const reviewedDraft = useRef<{ key: string | undefined; session: NonNullable<VoiceInput['state']['session']> } | null>(null);
  useEffect(() => {
    const previous = previousValue.current;
    const session = p.voice?.state.session;
    previousValue.current = { key: p.conversationKey, value: p.value, phase, session };
    // A reviewed transcript is delivered through the consumer's existing onTranscript
    // guard. Reveal its resulting draft, without a second send or automatic keyboard.
    if (previous.key === p.conversationKey && previous.value !== p.value && p.value.trim() && session?.mode === 'accessible'
      && (phase !== 'IDLE' || previous.phase !== 'IDLE' || previous.session !== session)) {
      reviewedDraft.current = { key: p.conversationKey, session };
    }
    if (reviewedDraft.current && reviewedDraft.current.key !== p.conversationKey) reviewedDraft.current = null;
    if (reviewedDraft.current && phase === 'IDLE') {
      const accepted = reviewedDraft.current.session === session && !p.voice?.state.error && !p.voice?.state.fallbackText;
      reviewedDraft.current = null;
      if (accepted) {
        setModeChoice({ key: p.conversationKey, mode: 'keyboard' });
        setTranscriptReview({ key: p.conversationKey, value: p.value });
      }
    }
  }, [p.value, p.conversationKey, p.voice?.state.session, p.voice?.state.error, p.voice?.state.fallbackText, phase]);
  useEffect(() => {
    cancelFollow(); followLatest.current = true; userScrolling.current = false; momentumAllowed.current = false;
    historyOffset.current = 0; setReadingEarlier(false);
    if (contextActive.current) revealContext(); else followAfterLayout();
  }, [p.conversationKey, cancelFollow, followAfterLayout, revealContext]);
  const syncReadingPosition = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
    geometry.current = { offset: contentOffset.y, content: contentSize.height, viewport: layoutMeasurement.height };
    if (!userScrolling.current) return;
    historyOffset.current = Math.max(0, contentOffset.y);
    const atBottom = contentSize.height - contentOffset.y - layoutMeasurement.height < 80;
    if (followLatest.current !== atBottom) { followLatest.current = atBottom; setReadingEarlier(!atBottom); }
  };
  const latest = (animated: boolean) => {
    cancelContextReveal(); cancelFollow(); userScrolling.current = false; momentumAllowed.current = false;
    followLatest.current = true; setReadingEarlier(false); scrollLatest(animated);
  };

  const hasText = p.value.trim().length > 0;
  // Unknown does not mean failed: only the caller's explicit retry grant can
  // offer another send while this same request is pending.
  const sendShown = p.pending ? p.canSend : hasText;
  const textRoom = composerWidth - 32 - (p.attach ? 48 : 0) - (p.voice ? 52 : 0) - (sendShown || p.voice ? 48 : 0);
  const stackedComposer = textScale >= 1.3 || (composerWidth > 0 && textRoom < 128) || expandedDraft || p.value.includes('\n');
  // Once a narrow field wraps, keep the full-width draft until it is short again.
  // Measuring the wider result must not oscillate between two layouts while typing.
  useEffect(() => {
    if (p.value.length <= 8 && !p.value.includes('\n')) setExpandedDraft(false);
    if (!p.value) setInputHeight(48);
  }, [p.value]);
  const voiceIdle = phase === 'IDLE';
  const modeBlocked = !voiceIdle;
  const modeReason = phase === 'FINALIZING' ? 'Sačekaj da završimo govorni unos.' : 'Završite ili otkažite govor pre promene unosa.';
  // Snapshot closes the brief responder→React-render race: a tap cannot unmount
  // the held microphone after begin has acquired the controller but before render.
  const canSwitch = () => voiceIdle && (!p.voice || p.voice.controller.getSnapshot().phase === 'IDLE');
  const chooseInput = (mode: 'voice' | 'keyboard', focus = false) => {
    if (!canSwitch()) return;
    if (inputFocusFrame.current !== null) cancelAnimationFrame(inputFocusFrame.current);
    inputFocusFrame.current = null;
    setHoldHint(false); setModeChoice({ key: p.conversationKey, mode });
    if (mode === 'voice') Keyboard.dismiss();
    else if (focus) inputFocusFrame.current = requestAnimationFrame(() => {
      inputFocusFrame.current = null;
      if (canSwitch()) input.current?.focus();
    });
  };
  const sendReason = p.canSend || !sendShown ? null
    : p.sendBlockedReason ?? (p.pending ? p.busy ? 'Poruka se šalje.' : 'Ishod prethodne poruke još nije potvrđen. Proverite razgovor.'
      : !voiceIdle ? 'Završite govor pa pošaljite.' : p.busy ? 'Sačekajte da stigne odgovor.' : 'Poruku sada ne možete da pošaljete.');
  const privacy = () => notice.ask({ title: 'Govorni unos i privatnost', message: VOICE_PROCESSING_NOTICE, confirmLabel: 'U redu', cancelLabel: null });

  const last = p.messages.at(-1);
  const welcomeShown = p.messages.length === 0 && !shownSentMessage && !p.pending && !p.busy && !p.streamingText && !p.introMessage;
  const compactWelcome = keyboard || inputFocused;
  const reviewedTextShown = !voiceMode && !p.pending && !p.busy && !!transcriptReview && transcriptReview.key === p.conversationKey
    && transcriptReview.value === p.value && hasText;
  const openings = p.openings ?? [];
  // History notes are not messages: no entrance, no speaker, and nothing about them is docked outside the thread.
  const notes = p.threadNotes ?? [], anchored = new Set(p.messages.map(message => message.id));
  const drawNote = (note: ConversationNote) => <View key={`note:${note.key}`} testID="ai-thread-note">{note.node}</View>;
  const headerRight = p.onOptions
    ? <ChromeIconButton label="Opcije razgovora" glyph="more" quiet onPress={() => { Keyboard.dismiss(); p.onOptions?.(); }} />
    : p.newConversation
      ? <ChromeIconButton label="Novi razgovor" glyph="refresh" quiet disabled={p.newConversation.disabled}
          onPress={() => { if (!p.newConversation?.disabled) { Keyboard.dismiss(); p.newConversation?.onPress(); } }} />
      : undefined;

  return <DraftDisclosure.Provider value={{ expanded, toggle: () => setDisclosure({ key: p.conversationKey, expanded: !expanded }) }}>
  {/* A closed conversation can keep its next action in the scroll. Without a composer/footer,
      the frame owns the bottom inset so that action stays above Android's gesture area. */}
  <SafeAreaView edges={p.closed && !p.footerAction ? ['top', 'bottom'] : ['top']} testID="ai-conversation-safe-area" style={s.canvas}>
    {/* Android edge-to-edge can keep the window full-height despite adjustResize.
        Padding uses the measured overlap; a genuinely resized window contributes
        zero overlap, so it does not subtract the keyboard height a second time. */}
    <KeyboardAvoidingView style={s.flex} behavior="padding">
      <ScreenChrome variant="detail" tone="conversation" onBack={p.onBack} title={p.title} right={headerRight} />
      {/* Before the first word there is no draft to pin, and an empty card pushed the one invitation on the screen
          below the fold. The caller returns null until it has something. */}
      {pinned && !inlineSummary && !cardAtEnd ? <ScrollView testID="ai-pinned-card" style={[s.cardArea,
        { maxHeight: compact ? 180 : Math.min(300, height * 0.36) }]} contentContainerStyle={compact ? s.cardAreaCompact : s.cardContents}
        keyboardShouldPersistTaps="handled" nestedScrollEnabled>{pinned}</ScrollView> : null}
      <View style={s.flex}>
      <ScrollView ref={thread} innerViewRef={threadContent} testID="ai-conversation-thread" style={s.flex}
        // Before the first word the invitation is the only thing on screen, so it sits in the space it has. As soon as
        // there is a thread, the thread starts at the top as threads do.
        contentContainerStyle={[s.thread, p.messages.length === 0 && p.showWelcomeArt !== false && !p.introMessage && !p.sentMessage && !p.status && !p.context && !notes.length && s.threadEmpty]}
        keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" showsVerticalScrollIndicator={false}
        onScrollBeginDrag={() => { cancelContextReveal(); cancelFollow(); userScrolling.current = true; momentumAllowed.current = true; }}
        onScroll={syncReadingPosition}
        onScrollEndDrag={event => { syncReadingPosition(event); userScrolling.current = false; }}
        onMomentumScrollBegin={() => { userScrolling.current = momentumAllowed.current; momentumAllowed.current = false; }}
        onMomentumScrollEnd={event => { syncReadingPosition(event); userScrolling.current = false; momentumAllowed.current = false; }}
        scrollEventThrottle={100}
        accessibilityActions={[{ name: 'scrollBackward', label: 'Prethodne poruke' }, { name: 'scrollForward', label: 'Novije poruke' }]}
        onAccessibilityAction={event => {
          const direction = event.nativeEvent.actionName;
          if (direction !== 'scrollBackward' && direction !== 'scrollForward') return;
          const { offset, viewport, content } = geometry.current;
          if (!viewport) return;
          cancelContextReveal(); cancelFollow(); userScrolling.current = false; momentumAllowed.current = false;
          const end = Math.max(0, content - viewport);
          const target = Math.max(0, Math.min(end, offset + (direction === 'scrollBackward' ? -1 : 1) * viewport * 0.75));
          historyOffset.current = target; geometry.current.offset = target;
          followLatest.current = end - target < 80; setReadingEarlier(!followLatest.current);
          thread.current?.scrollTo({ y: target, animated: false });
        }}
        onLayout={event => {
          const viewport = event.nativeEvent.layout.height;
          if (!Number.isFinite(viewport) || viewport <= 0 || geometry.current.viewport === viewport) return;
          geometry.current.viewport = viewport;
          if (contextActive.current) revealContext();
          if (followLatest.current) followAfterLayout();
          else thread.current?.scrollTo({ y: historyOffset.current, animated: false });
        }}
        // The first pending turn already belongs at the bottom, even before the server returns a message ID.
        onContentSizeChange={(_width, content) => {
          if (!Number.isFinite(content) || content < 0 || geometry.current.content === content) return;
          geometry.current.content = content; revealContext(); followAfterLayout();
        }}>
        {/* Always mounted: inserting/removing inline context preserves the sentence being read below it. */}
        <View testID="ai-inline-context" style={pinned && inlineSummary && !cardAtEnd ? s.inlineContext : undefined} onLayout={event => {
          const previous = contextHeight.current, next = event.nativeEvent.layout.height, delta = next - previous;
          contextHeight.current = next;
          // An anchor inside the draft must stay there when its details open. Only transcript below the old
          // context moves by its height delta. With new context, offset zero still means the visible top.
          const belowContext = previous === 0 ? historyOffset.current > 0 : historyOffset.current >= previous;
          if (!followLatest.current && delta && belowContext) {
            historyOffset.current = Math.max(0, historyOffset.current + delta);
            thread.current?.scrollTo({ y: historyOffset.current, animated: false });
          }
        }}>{pinned && inlineSummary && !cardAtEnd ? <View testID="ai-inline-card">{pinned}</View> : null}</View>
        <View style={s.turns}>
        {p.introMessage ? <View testID="ai-local-opening" accessibilityLabel={`USKOČI: ${p.introMessage}`} style={s.assistant}>
          <Mark /><T selectable style={s.answer}>{p.introMessage}</T>
        </View> : null}
        {welcomeShown ? <View style={[s.welcome, compactWelcome && s.welcomeCompact]}>
          {!p.introMessage && p.showWelcomeArt !== false ? <View importantForAccessibility="no-hide-descendants" style={s.presence}>
            {compactWelcome ? <AiAssistantArt size={44} animated={false} />
              : <AiAssistantWelcome conversationKey={p.conversationKey} memory={assistantWelcome} />}
          </View> : null}
          {!p.introMessage ? <T accessibilityRole="header" variant={p.showWelcomeArt === false ? 'heading' : 'title'}
            style={p.showWelcomeArt === false ? s.returningTitle : compactWelcome ? s.welcomeCompactTitle : s.welcomeTitle}>{p.welcome}</T> : null}
          {p.welcomeDetail && !compactWelcome ? <T variant="copy" tone="muted" style={[s.welcomeCopy, p.showWelcomeArt === false && s.returningCopy]}>{p.welcomeDetail}</T> : null}
          {openings.length && p.canEdit && !compactWelcome ? <View testID="ai-opening-examples" style={s.openings}>
            <Section title="Na primer">
              {openings.map((opening, index) => <ListRow key={opening} title={opening} last={index === openings.length - 1}
                leading={p.openingArts?.[index] ? <FactArt kind={p.openingArts[index]} size={32} role={openingRole(p.openingArts[index])} /> : undefined}
                // The arrow says "this goes into the field", not "this opens a screen": the row draws no caret of its own.
                arrow={false} trailing={stackedRows ? undefined : <Glyph name="arrow-up-right" tone="muted" />}
                accessibilityLabel={opening} accessibilityHint="Upisuje ovo u poruku da možete da dopunite."
                onPress={() => { if (!canSwitch()) return; p.onChange(opening + ' '); chooseInput('keyboard', true); }} />)}
            </Section>
          </View> : null}
          {/* The speech disclosure is reachable before the first word, and from voice mode at any time. */}
          {p.voice && !compactWelcome ? <Press accessibilityRole="button" accessibilityLabel="O govornom unosu i privatnosti" haptic="select"
            onPress={privacy} style={s.privacy}>
            <Glyph name="info" size={16} tone="muted" /><T variant="meta" tone="muted">O govornom unosu i privatnosti</T>
          </Press> : null}
        </View> : null}
        {/* One keyed list: a note keeps its identity when its anchor or the welcome changes, so it moves instead of remounting. */}
        {[...(welcomeShown ? [] : p.messages.flatMap((message, index) => [
          ...(pinned && cardBeforeReply && replyKey.current === message.id
            ? [<View key="understood-before-question" testID="ai-end-card">{pinned}</View>] : []),
          ...(inlineContext && message.id === p.contextBeforeMessageId
            ? [<View key="interactive-context" ref={interactiveContext} collapsable={false} testID="ai-task-context" onLayout={revealContext}>{p.context}</View>] : []),
          <View key={message.id} ref={replyKey.current === message.id ? latestReply : undefined}
            collapsable={false} testID={replyKey.current === message.id ? 'ai-latest-reply' : undefined} onLayout={replyKey.current === message.id ? followAfterLayout : undefined}>
          <Turn {...message}
          showSpeaker={message.fromAi && (index === 0 || !p.messages[index - 1].fromAi)}
          emphasis={!p.questionFocus || p.closed || !message.fromAi ? 'plain' : index === p.messages.length - 1 && !p.sentMessage && !p.streamingText ? 'question' : 'earlier'}
          // Frequent updates and streamed text get no decorative entrance. A turn that arrives while you are watching is
          // feedback; the thread you already had when the screen opened is not, and must not replay.
          reduced={reduced || !arrival.shouldEnter(message.id)} /></View>,
          ...notes.filter(note => note.afterMessageId === message.id).map(drawNote)])),
          ...notes.filter(note => note.afterMessageId === null || !anchored.has(note.afterMessageId)).map(drawNote)]}
        {/* Until the server read brings it back, what was said is still what was said: present, readable, and visibly
            not yet part of the record. */}
        {shownSentMessage ? <View accessibilityLabel={`Vi, šalje se: ${shownSentMessage}`} style={[s.person, s.sending]}>
          <T selectable style={s.personText}>{shownSentMessage}</T>
        </View> : null}
        {displayedStream ? <View testID="ai-stream-preview" accessibilityLabel={`USKOČI: ${displayedStream}`} accessibilityLiveRegion="none" style={s.assistant}>
          {shownSentMessage || !last?.fromAi ? <Mark /> : null}
          <T testID="ai-stream-preview-text" selectable style={p.questionFocus ? s.question : s.answer}>{displayedStream}</T>
        </View> : null}
        {/* Three dots are what a person waiting for an answer already understands; they stop under reduced motion. */}
        {p.busy && !displayedStream && p.busyLabel ? <View testID="ai-command-progress"
          accessibilityLiveRegion="polite" accessibilityLabel={p.busyLabel} style={s.commandProgress}>
          <T variant="note" tone="muted">{p.busyLabel}</T>
        </View> : null}
        {p.busy && !displayedStream && !p.busyLabel ? <View accessibilityLiveRegion="polite" accessibilityLabel="USKOČI piše odgovor" style={s.assistant}>
          {shownSentMessage || !last?.fromAi ? <Mark /> : null}
          <View style={s.typing}>
            <View style={s.dots}>{[0, 1, 2].map(index => <TypingDot key={index} index={index} reduced={reduced} />)}</View>
          </View>
        </View> : null}
        {p.context && !inlineContext ? <View ref={interactiveContext} collapsable={false} testID="ai-task-context" onLayout={revealContext}>{p.context}</View> : null}
        {/* Recovery belongs to scrollable content, not a second fixed footer. */}
        {p.status ? <Surface kind="note" testID="ai-recovery-in-thread" style={s.recovery}>{p.status}</Surface> : null}
        {p.actions ? <View style={s.actions}>{p.actions}</View> : null}
        {p.draftCue ? <View testID="ai-draft-cue" style={s.draftCue}>{p.draftCue}</View> : null}
        {pinned && cardAtEnd && !cardBeforeReply ? <View testID="ai-end-card">{pinned}</View> : null}
        </View>
      </ScrollView>
      {/* This control gets its own measured row. An overlay hid the expanded draft/review on small screens;
          shrinking the thread preserves its reading anchor through onLayout instead of covering its content. */}
      {readingEarlier && hasActivity ? <View testID="ai-latest-region" style={s.latestRegion}>
        <Press testID="ai-latest" accessibilityRole="button"
        accessibilityLabel="Najnovija poruka" onPress={() => latest(!reduced)} haptic="select" style={s.latest}>
        <Glyph name="caret-down" /><T variant="note" style={s.latestText}>Najnovija poruka</T>
      </Press></View> : null}
      </View>
      {/* Above the keyboard the composer needs no inset of its own; without it, the gesture bar is the phone's. No tab bar
          is drawn under a conversation (`_layout`), so this is the composer's own inset on both conversations. */}
      {/* Closing removes the input before Android may emit keyboardDidHide. The saved-action footer
          always owns its bottom inset; the open composer still gives that space to the keyboard. */}
      {p.closed && !p.footerAction ? null : <SafeAreaView edges={p.closed || !keyboard ? ['bottom'] : []} testID="ai-composer-footer" style={s.footer}>
        {p.footerAction ? <View testID="ai-footer-action">{p.footerAction}</View> : null}
        {p.closed ? null : <>
        {p.correction ? <View testID="ai-correction-context" style={s.correction}>
          <View style={s.correctionCopy} accessibilityLiveRegion="polite">
            <T variant="note" style={s.latestText}>{p.correction.title}</T>
            <T variant="note" tone="muted">{p.correction.hint}</T>
          </View>
          <Press accessibilityRole="button" accessibilityLabel="Zatvorite temu izmene" onPress={p.correction.onDismiss}
            disabled={!p.canEdit} accessibilityState={{ disabled: !p.canEdit }} style={s.target}>
            <Glyph name="close" size={20} tone="muted" />
          </Press>
        </View> : null}
        {/* A person who cannot hold uses the same microphone in start/stop mode with explicit review. */}
        {p.voice ? <VoiceNotice {...p.voice} onKeepText={text => {
          const kept = p.voice!.onKeepText(text);
          if (kept) chooseInput('keyboard');
          return kept;
        }} tapToTalk={tapToTalk} hint={holdHint ? reviewFirst ? 'Držite mikrofon dok govorite, pa pustite za pregled.' : HOLD_HINT : null}
          hintAction={holdHint && !p.voice.disabled && voiceIdle ? { label: 'Govorite bez držanja', onPress: () => {
            if (!canSwitch()) return; Keyboard.dismiss(); setHoldHint(false); setTapToTalk(true); } } : undefined} /> : null}
        {/* When the thread's own recovery note already explains the wait, the line here would say it twice; the send
            button still says it to a screen reader. The same holds while the message is being sent: the thread shows the
            answer arriving, so no line is docked above the composer for it. */}
        {sendReason && voiceIdle && !p.status && !(p.pending && p.busy) ? <T testID="ai-send-reason" accessibilityElementsHidden importantForAccessibility="no-hide-descendants"
          variant="note" tone="muted" style={s.reason}>{sendReason}</T> : null}
        {reviewedTextShown ? <View testID="ai-transcript-review" style={s.transcriptReview} accessibilityLiveRegion="polite">
          <Glyph name="mic" size={18} tone="green" />
          <T variant="note" style={s.preferenceText}>Proverite prepoznate reči, pa pošaljite poruku.</T>
        </View> : null}
        <View testID="ai-composer" onLayout={event => {
          const width = event.nativeEvent.layout.width;
          if (Number.isFinite(width) && width > 0) setComposerWidth(previous => previous === width ? previous : width);
        }}
          style={[s.pill, voiceMode && s.voicePill, !voiceMode && stackedComposer && s.pillExpanded, inputFocused && s.pillFocused]}>
          {p.attach ? <View style={[s.attachmentSlot, !voiceMode && stackedComposer && s.attachmentBelow]}>
            <Press accessibilityRole="button" accessibilityLabel={p.attach.label} accessibilityHint={p.attach.hint}
              accessibilityState={{ disabled: !!p.attach.disabled }} disabled={p.attach.disabled} haptic={p.attach.disabled ? 'none' : 'select'}
              hitSlop={0} onPress={p.attach.onPress} style={s.target}>
              <View style={s.toolCircle}><Glyph name="plus" size={24} tone={p.attach.disabled ? 'muted' : 'ink'} /></View>
            </Press>
          </View> : voiceMode ? <View style={s.attachmentSlot} /> : null}
          {voiceMode ? null : <TextInput ref={input} accessibilityLabel="Poruka za asistenta" value={p.value} editable={p.canEdit && voiceIdle && !p.pending}
            onFocus={() => setInputFocused(true)} onBlur={() => setInputFocused(false)}
            onChangeText={text => { if (!p.canEdit || p.pending || !canSwitch()) return; setHoldHint(false); setTranscriptReview(null); p.onChange(text); }}
            placeholder={p.placeholder ?? 'Napišite poruku'} placeholderTextColor={sys.color.muted} multiline maxLength={4000}
            onContentSizeChange={event => {
              const measured = Math.ceil(event.nativeEvent.contentSize.height);
              if (!Number.isFinite(measured) || measured <= 0) return;
              const nextHeight = Math.max(48, Math.min(132, measured));
              setInputHeight(previous => previous === nextHeight ? previous : nextHeight);
              const oneLine = sys.type.body.lineHeight * textScale + 20;
              if (!stackedComposer && p.value.length > 8 && measured > oneLine + 8) setExpandedDraft(true);
            }}
            // A field that cannot be edited now says so in its ink: the words in it are held, not a draft to change.
            style={[s.input, { height: inputHeight }, stackedComposer && s.inputExpanded, !p.canEdit && s.inputOff]} />}
          <View testID="ai-composer-tools" style={[s.composerTools, voiceMode && s.voiceTools, !voiceMode && stackedComposer && s.toolsBelow]}>
            {p.voice ? voiceMode ? (
              <VoiceComposer {...p.voice} size={64} tapToTalk={tapToTalk} reviewFirst={reviewFirst} onTooShort={() => setHoldHint(true)} />
            ) : <Press testID="ai-input-mode" accessibilityRole="button" accessibilityLabel="Pređite na govor"
                accessibilityHint={modeBlocked ? modeReason : 'Izaberite govor; snimanje počinje tek na mikrofonu.'}
                accessibilityState={{ disabled: modeBlocked || p.pending }} disabled={modeBlocked || p.pending} haptic="select"
                onPress={() => { if (!p.pending) chooseInput('voice'); }} style={s.target}>
                <Glyph name="mic" size={24} tone={p.pending ? 'muted' : 'green'} />
              </Press> : null}
            {sendShown ? <Press testID="ai-send" accessibilityRole="button" accessibilityLabel={p.pending ? 'Pošaljite ponovo' : 'Pošaljite poruku'}
              accessibilityHint={sendReason ?? undefined} accessibilityState={{ disabled: !p.canSend }} disabled={!p.canSend}
              onPress={() => { if (!p.canSend) return; latest(false); p.onSend(); }} haptic={p.canSend ? 'light' : 'none'} hitSlop={0} style={s.target}>
              <View style={[s.round, s.send, !p.canSend && s.roundOff]}>
                <Glyph name="send" size={24} on tone={p.canSend ? 'onGreen' : 'muted'} /></View>
            </Press> : null}
          </View>
          {voiceMode ? <Press testID="ai-input-mode" accessibilityRole="button" accessibilityLabel="Pređite na tastaturu"
            accessibilityHint={modeBlocked ? modeReason : hasText ? 'Neposlata poruka je sačuvana.' : 'Napišite poruku umesto govora.'}
            accessibilityState={{ disabled: modeBlocked }} disabled={modeBlocked} haptic="select" style={s.target}
            onPress={() => chooseInput('keyboard', true)}>
            <Glyph name="keyboard" size={26} tone={modeBlocked ? 'muted' : 'ink'} />
          </Press> : null}
        </View>
        {voiceMode && voiceIdle && hasText ? <T testID="ai-retained-draft" variant="note" tone="muted" style={s.voicePrompt}>
          Neposlata poruka čeka u tastaturi.
        </T> : null}
        </>}
      </SafeAreaView>}
    </KeyboardAvoidingView>
    {p.children}
    {notice.sheet}
  </SafeAreaView></DraftDisclosure.Provider>;
}

/** The colour family of an opening's picture: a place, people or, for everything else, what the person can do. */
function openingRole(kind: FactArtKind): FactArtRole {
  return kind === 'home' || kind === 'pin' ? 'location' : kind === 'users' || kind === 'person' ? 'people' : 'skills';
}

/** Speaker identity stays explicit without repeating the product logo throughout the transcript. */
function Mark() {
  return <View testID="ai-assistant-mark" importantForAccessibility="no-hide-descendants" accessibilityElementsHidden style={s.mark}>
    <AiAssistantArt size={24} />
  </View>;
}

/** One of three dots that rise and fall while an answer is being written. */
function TypingDot({ index, reduced }: { index: number; reduced: boolean }) {
  const life = useRef(new NativeAnimated.Value(0)).current;
  const [foreground, setForeground] = useState(AppState.currentState === 'active');
  useEffect(() => {
    const subscription = AppState.addEventListener('change', state => setForeground(state === 'active'));
    return () => subscription.remove();
  }, []);
  useEffect(() => {
    life.stopAnimation();
    life.setValue(0);
    if (reduced || !foreground) return;
    const timing = (toValue: number) => NativeAnimated.timing(life, { toValue, duration: sys.motion.loop.typing,
      easing: Easing.inOut(Easing.quad), useNativeDriver: true, isInteraction: false });
    const run = NativeAnimated.sequence([NativeAnimated.delay(index * 140),
      NativeAnimated.loop(NativeAnimated.sequence([timing(1), timing(0)]))]);
    run.start();
    return () => run.stop();
  }, [index, life, reduced, foreground]);
  const style = { opacity: life.interpolate({ inputRange: [0, 1], outputRange: [0.25, 0.85] }),
    transform: [{ translateY: life.interpolate({ inputRange: [0, 1], outputRange: [0, -3] }) }] };
  return reduced || !foreground ? <View style={[s.dot, s.dotStill]} /> : <NativeAnimated.View style={[s.dot, style]} />;
}

/**
 * One turn. The assistant has a reading surface under its speaker label; the person's bubble is aligned right.
 * Persisted turns do not rerender for each keystroke or incoming chunk. Side, colour and shape say who is speaking; the
 * labels are for a screen reader.
 */
const Turn = memo(function Turn({ fromAi, body, reduced, showSpeaker, emphasis = 'plain' }: ConversationMessage & {
  reduced: boolean; showSpeaker: boolean; emphasis?: 'plain' | 'question' | 'earlier';
}) {
  // Decide the host once, as shared Appear does: history is an ordinary View,
  // while a genuinely new row keeps its animated host after it settles. A
  // subsequent keystroke/re-read must neither remount text nor replay motion.
  const [entering] = useState(() => reduced ? undefined : FadeInDown.duration(sys.motion.enter)
    .easing(ReanimatedEasing.bezier(...sys.motion.easeOut))
    .withInitialValues({ transform: [{ translateY: (fromAi ? -1 : 1) * sys.motion.categories.content.reveal.translateY }] }));
  const content = fromAi
    ? <>{showSpeaker ? <Mark /> : null}<T selectable style={emphasis === 'question' ? s.question : emphasis === 'earlier' ? s.earlier : s.answer}>{body}</T></>
    : <T selectable style={s.personText}>{body}</T>;
  const frame = { accessibilityLabel: `${fromAi ? 'USKOČI' : 'Vi'}: ${body}`, style: fromAi ? s.assistant : s.person };
  return entering
    ? <Animated.View entering={entering} {...frame}>{content}</Animated.View>
    : <View {...frame}>{content}</View>;
});

const s = StyleSheet.create({
  conversationTools: { alignItems: 'flex-end' },
  management: { gap: sys.space.xs, alignItems: 'flex-end' },
  newConversation: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: sys.space.sm, paddingHorizontal: sys.space.sm },
  newConversationText: { color: sys.color.green, fontWeight: '700' },
  newConversationDisabled: { color: sys.color.muted, fontWeight: '700' },
  canvas: { flex: 1, backgroundColor: sys.conversation.ground }, flex: { flex: 1, minHeight: 0 },
  cardArea: { flexGrow: 0, flexShrink: 1, paddingHorizontal: layout.chatList },
  cardContents: { paddingTop: 2, paddingBottom: sys.space.md },
  cardAreaCompact: { paddingTop: 0, paddingBottom: sys.space.sm },
  thread: { flexGrow: 1, paddingHorizontal: layout.chatList, paddingTop: sys.space.md, paddingBottom: sys.space.md },
  turns: { gap: sys.space.xl }, inlineContext: { paddingBottom: sys.space.xl },
  threadEmpty: { justifyContent: 'center', paddingBottom: sys.space.lg },
  welcome: { gap: sys.space.md, paddingTop: sys.space.sm, paddingBottom: sys.space.sm, maxWidth: 440, width: '100%', alignSelf: 'center' },
  welcomeCompact: { gap: sys.space.sm, paddingVertical: 0 },
  welcomeCompactTitle: { ...sys.type.body, fontWeight: '600', textAlign: 'center', color: sys.color.ink },
  presence: { alignItems: 'center', justifyContent: 'center', alignSelf: 'center', marginBottom: 4 },
  welcomeTitle: { ...sys.type.title, fontWeight: '600', color: sys.color.ink, textAlign: 'center' },
  welcomeCopy: { lineHeight: 24, textAlign: 'center' },
  returningTitle: { color: sys.color.ink, textAlign: 'left' },
  returningCopy: { textAlign: 'left' },
  // Whole sentences, one under the other, from the same edge as the thread will have: rows, not boxes.
  openings: { marginTop: sys.space.md },
  draftCue: { paddingVertical: sys.space.sm },
  privacy: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'center', maxWidth: '100%' },
  // Long replies read on the canvas; alignment and the group label identify the speaker.
  assistant: { gap: sys.space.sm, alignSelf: 'stretch', paddingVertical: sys.space.xs },
  mark: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  // The type scale's own voice for a sentence said in the conversation (review r4 ra item 11; it was a raw 17/27).
  answer: { ...sys.type.speech, color: sys.color.ink },
  // One question at a time (`questionFocus`): the latest question in the larger speech of voice mode, what came before it quieter.
  question: { ...sys.type.speechLarge, color: sys.color.ink },
  earlier: { ...sys.type.copy, color: sys.color.muted },
  // Own words have an elegant, soft sage capsule with deep green ink text (never harsh black).
  person: { alignSelf: 'flex-end', maxWidth: '88%', marginLeft: 28, paddingVertical: 12, paddingHorizontal: 18,
    borderRadius: 20, borderBottomRightRadius: 6, backgroundColor: sys.conversation.userSoft,
    borderWidth: 1, borderColor: sys.conversation.userSoftEdge,
    shadowColor: sys.conversation.userSoftShadow, shadowOffset: { width: 0, height: 1.5 }, shadowOpacity: 0.08, shadowRadius: 3, elevation: 1 },
  personText: { ...sys.type.body, color: sys.conversation.userSoftInk, fontWeight: '500' },
  /** Sent, not yet confirmed by a read: present and readable, visibly not yet part of the record. */
  sending: { opacity: 0.9, backgroundColor: sys.conversation.userSoftSending, borderColor: sys.conversation.userSoftSendingEdge },
  // One line of the answer's type (`speech`, 26), so the dots sit where the first line of the answer will.
  typing: { flexDirection: 'row', gap: sys.space.md, alignItems: 'center', flexWrap: 'wrap', minHeight: 28 },
  progressCopy: { flex: 1, minWidth: 120, gap: sys.space.xs },
  commandProgress: { paddingVertical: sys.space.sm, paddingHorizontal: sys.space.md },
  dots: { flexDirection: 'row', gap: 5, alignItems: 'center', height: 26 },
  dot: { width: 7, height: 7, borderRadius: sys.radius.pill, backgroundColor: sys.color.artRole.ai.front },
  dotStill: { opacity: 0.55 },
  recovery: { gap: sys.space.md },
  actions: { gap: sys.space.md },
  latestRegion: { flexShrink: 0, paddingHorizontal: sys.space.md, backgroundColor: sys.conversation.ground },
  latest: { alignSelf: 'center', maxWidth: '100%', minHeight: 48, flexDirection: 'row', gap: 8,
    alignItems: 'center', paddingHorizontal: 16, paddingVertical: 8, borderRadius: sys.radius.pill,
    backgroundColor: sys.color.surface },
  latestText: { flexShrink: 1, color: sys.color.ink, fontWeight: '600' },
  footer: { paddingHorizontal: layout.chatComposer, paddingTop: sys.space.xs, paddingBottom: sys.space.sm, gap: sys.space.sm, backgroundColor: sys.conversation.ground },
  reason: { paddingHorizontal: sys.space.sm },
  correction: { flexDirection: 'row', alignItems: 'flex-start', paddingLeft: sys.space.sm, gap: sys.space.sm },
  correctionCopy: { flex: 1, minWidth: 0, gap: sys.space.xs },
  inputPreferences: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', columnGap: sys.space.sm },
  preference: { minHeight: sys.touch.min, flexDirection: 'row', alignItems: 'center', gap: sys.space.sm, paddingHorizontal: sys.space.sm, flexShrink: 1 },
  preferenceText: { flexShrink: 1, color: sys.color.ink },
  transcriptReview: { flexDirection: 'row', alignItems: 'center', gap: sys.space.sm, paddingHorizontal: sys.space.sm },
  reviewBox: { width: 20, height: 20, borderRadius: sys.radius.check, borderWidth: 1, borderColor: sys.color.muted, alignItems: 'center', justifyContent: 'center' },
  reviewBoxOn: { borderColor: sys.color.green, backgroundColor: sys.color.green },
  voicePrompt: { textAlign: 'center', paddingHorizontal: sys.space.sm },
  voiceTools: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  voicePill: { minHeight: 76, paddingHorizontal: 12, paddingVertical: 6, justifyContent: 'space-between', backgroundColor: sys.conversation.surface },
  gestureChoice: { minHeight: sys.touch.min, justifyContent: 'center', alignSelf: 'flex-start' },
  // One ordinary horizontal pill; only a wrapped draft or limited reading space moves tools below.
  pill: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 6,
    borderRadius: sys.radius.sheet, borderWidth: 1, borderColor: sys.color.line, backgroundColor: sys.conversation.surface,
    ...sys.elevation.soft },
  pillFocused: { borderColor: sys.color.ink },
  pillExpanded: { paddingBottom: 64 },
  composerTools: { flexDirection: 'row', alignItems: 'center' },
  attachmentSlot: { width: 48 },
  attachmentBelow: { position: 'absolute', left: 8, bottom: 8 },
  toolsBelow: { position: 'absolute', right: 8, bottom: 6, minHeight: 52 },
  toolCircle: { width: 40, height: 40, borderRadius: sys.radius.pill, backgroundColor: sys.color.surface,
    alignItems: 'center', justifyContent: 'center' },
  target: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  input: withInter({ ...sys.type.body, flex: 1, color: sys.color.ink, minWidth: 0, minHeight: 48, maxHeight: 132,
    paddingHorizontal: 8, paddingTop: 10, paddingBottom: 10, textAlignVertical: 'top' }),
  inputExpanded: { paddingHorizontal: 12 },
  inputOff: { color: sys.color.muted },
  round: { width: 44, height: 44, borderRadius: sys.radius.pill, alignItems: 'center', justifyContent: 'center' },
  send: { backgroundColor: sys.color.green },
  voiceRound: { backgroundColor: sys.color.artRole.ai.soft },
  // Disabled is a quiet wash with a muted glyph, never a faded ghost of the live control.
  roundOff: { backgroundColor: sys.color.wash },
  round64: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center' },
  send64: { backgroundColor: sys.color.green, shadowColor: sys.color.green, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.35, shadowRadius: 8, elevation: 4 },
});
