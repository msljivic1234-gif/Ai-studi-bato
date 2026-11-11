import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useFocusEffect } from 'expo-router';
import { ActivityIndicator, Platform, RefreshControl, ScrollView, StyleSheet, TextInput, View, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import type { PorukaProjekcija } from '../contracts/projections';
import { sameMessagePhotos, sameMessageVoice, type createAgreementOutbox, type OutboxError } from '../data/agreementOutbox';
import { voiceMessagesBuilt } from '../data/voiceMessagesGate';
import { useAgreementVoice, type AgreementVoiceScope, type AgreementVoiceController } from '../hooks/useAgreementVoice';
import { AgreementVoiceMic, AgreementVoicePanel, voiceTime } from './media/AgreementVoiceControls';
import type { AgreementPhotosController } from '../hooks/useAgreementPhotos';
import { AgreementPhotoComposer, AgreementPhotoSheet } from './media/AgreementPhotoComposer';
import { PHOTO_WORDS, removalRequest } from './media/photoWords';
import { Glyph } from './system/Glyph';
import { useConfirmSheet } from './system/ConfirmSheet';
import { tick } from './system/haptics';
import { AuthorizedPhoto } from './media/AuthorizedPhoto';
import { PhotoViewer, type PhotoReadContext, type PagePhoto } from './media/PhotoViewer';
import { Press } from './Press';
import { FactArt } from './system/FactArt';
import { floating, sys } from './system/tokens';
import { useLayoutClass, useTextScale } from './system/textScale';
import { T } from './Text';
import { withInter } from './interFont';
import { positiveInteger, uuid } from '../data/serverReceipt';
import { SupportContextEntry } from './support/SupportContextEntry';
import { serbianToday } from './calendar/serbianDays';
import { PhotoBubble, TextBubble, VoiceBubble } from './messages/MessageBubbles';
import { MessageMark } from './messages/MessageMark';
import { MARK_WORDS, buildThread, entryMark, messageSpoken, readMark, type ThreadMessage } from './messages/threadModel';

// The day/clock words and the spoken summary live with the thread model; they stay importable from here.
export { messageMoment, messageSpoken } from './messages/threadModel';

type Outbox = ReturnType<typeof createAgreementOutbox>;
type MessageGallery = { outbox: Outbox; context: PhotoReadContext; photos: readonly PagePhoto[]; index: number; localId?: string };
function FocusedMessageGallery(props: React.ComponentProps<typeof PhotoViewer>) {
  const close = useRef(props.onClose); close.current = props.onClose;
  useFocusEffect(useCallback(() => () => close.current(), []));
  return <PhotoViewer {...props} />;
}
/** Route-owned, account/Agreement-scoped reading intent; no message bodies are retained. */
export type AgreementReadingPosition = {
  following: boolean;
  offset: number;
  anchor?: { messageId: string; within: number };
};
type Props = {
  /** The read's messages. `createdAt` is the server's own instant when the read carries it (the history read does). */
  messages: ThreadMessage[];
  loading: boolean;
  error: boolean;
  refreshing?: boolean;
  refreshError?: boolean;
  writable: boolean;
  terminal: boolean;
  refresh: () => Promise<void>;
  refreshWorkspace: () => Promise<void>;
  outbox: Outbox;
  state: ReturnType<Outbox['getSnapshot']>;
  photos?: AgreementPhotosController;
  voiceScope?: AgreementVoiceScope;
  support?: { canAct: () => boolean; navigate: (action: () => void) => void };
  /** The surrounding frame moves identity/accepted terms into history when the keyboard or text needs the space. */
  context?: ReactNode;
  /** Identity only: local outbox entries have no canonical id or timestamp yet. */
  sender?: (message: Pick<ThreadMessage, 'moja' | 'posiljalacAccountId'> & Partial<Pick<ThreadMessage, 'posiljalacIme'>>) => ReactNode;
  compact?: boolean;
  readingPosition?: { current: AgreementReadingPosition };
  hasOlder?: boolean;
  hasNewer?: boolean;
  loadingOlder?: boolean;
  loadingNewer?: boolean;
  historyError?: boolean;
  historyErrorDirection?: 'older' | 'newer';
  onLoadOlder?: () => Promise<void>;
  onLoadNewer?: () => Promise<void>;
  onShowLatest?: () => Promise<void>;
  onDisplayedMessageIds?: (ids: readonly string[]) => void;
};

const errors: Record<OutboxError, string> = {
  STORAGE_UNAVAILABLE: 'Poruka nije sačuvana na telefonu. Tekst nije odbačen; pokušajte ponovo.',
  STORAGE_INVALID: 'Poruke sačuvane na ovom telefonu nije moguće učitati. Prepiska je bezbedno sačuvana.',
  CAPACITY: 'Čeka 50 poruka koje nisu poslate. Proverite ih pre nove poruke.',
  INVALID_MESSAGE: 'Poruka može imati od 1 do 2.000 znakova. Proverite tekst.',
  READ_ONLY: 'Dogovor trenutno ne prihvata nove poruke. Osvežite njegov status.',
  NOT_AVAILABLE: 'Više nemate pristup slanju u ovom Dogovoru. Osvežite njegov status.',
  AUTH_CONTEXT_CHANGED: 'Nalog je promenjen. Vratite se na Dogovore.',
  CONFLICT: 'Ova poruka se razlikuje od sačuvane. Možete da kopirate tekst.',
  UNAVAILABLE: 'Veza je prekinuta. Ne znamo da li je poruka stigla.',
  // The words describe and the button ("Proverite", `outcomeCopy`) commands: the line does not say the verb of the button twice.
  INVALID_RESPONSE: 'Ne znamo da li je poruka stigla. Neće se poslati dvaput.',
  NOT_READY: 'Sačekajte da se učitaju sačuvane poruke.',
};

/**
 * A send that FAILED ticks once (haptic rule R5: a tick is an outcome, never a touch; `system/haptics`, kind `error`). Failed is the
 * entry's own state, the one that says "Nije poslato": a send whose outcome is merely unknown ("Ne znamo da li je stigla") is a wait
 * that requires an authoritative read or a separate explicit resend, not a failure, and ticks nothing. What had already failed when the thread opened is not news and is not
 * ticked; the same failed attempt is ticked once, and a new attempt that fails is a new failure. A tick is not movement, so this
 * does not touch the conversation's rule of no motion.
 */
function useFailedSendTick(entries: readonly { command: { clientMessageId: string }; state: string; attempt: number }[], hydrated: boolean) {
  const failed = entries.filter(entry => entry.state === 'failed').map(entry => `${entry.command.clientMessageId}:${entry.attempt}`).join('|');
  const known = useRef<Set<string> | null>(null);
  useEffect(() => {
    if (!hydrated) return;
    const now = failed ? failed.split('|') : [];
    if (known.current === null) { known.current = new Set(now); return; }
    let news = false;
    for (const key of now) if (!known.current.has(key)) { known.current.add(key); news = true; }
    if (news) tick('error');
  }, [failed, hydrated]);
}

/** A command in the conversation (send, the "+", retry) is at least 48 high; the touch token is the 44 of a row. */
const COMMAND = 48;
/** The "+" inside the pill: the 44 touch token, a round well. */
const INLINE_PLUS = 44;
/** The one sentence a closed Dogovor says under its thread, in place of the field. The projection carries no date or side to add. */
export const CLOSED_SENTENCE = 'Dogovor je zatvoren. Poruke možete samo da čitate.';

/** Quiet text action used inside the conversation (retry, refresh). The spoken label may be longer than the visible text. */
function ChatAction({ label, text = label, onPress, tone = 'green', center = false, end = false, refresh = false, busy = false, quiet = false }: { label: string; text?: string; onPress: () => void;
  tone?: 'green' | 'ink' | 'onMine'; center?: boolean; end?: boolean; refresh?: boolean; busy?: boolean; quiet?: boolean }) {
  return <Press accessibilityRole="button" accessibilityLabel={label} haptic="select" onPress={onPress}
    disabled={busy} accessibilityState={{ busy, disabled: busy }}
    style={[s.chatAction, refresh && s.refreshAction, quiet && s.refreshQuiet, center && s.center, end && s.end]}>
    {refresh ? busy ? <ActivityIndicator size="small" color={sys.color.ink} /> : <Glyph name="refresh" size={16} tone={quiet ? 'muted' : 'ink'} /> : null}
    <T variant={quiet ? 'meta' : refresh ? 'note' : 'action'} style={{ color: quiet ? sys.color.muted : tone === 'onMine' ? sys.conversation.onUser : sys.color.ink }}>{text}</T>
  </Press>;
}

const recoverablePhoto = (receipt: AgreementPhotosController['items'][number]['receipt']) => !receipt
  || (!receipt.attachedMessageId && receipt.state !== 'CANCELLED' && receipt.state !== 'FAILED');
/** Closing an Agreement forbids new photos; existing opaque intents still need exact read/cancel recovery. */
function TerminalPhotoRecovery({ photos, capturing }: { photos: AgreementPhotosController; capturing: boolean }) {
  const [showSaved, setShowSaved] = useState(false);
  const confirm = useConfirmSheet();
  const items = photos.items?.filter(item => recoverablePhoto(item.receipt)) ?? [];
  const saved = photos.saved?.filter(recoverablePhoto) ?? [];
  if (!items.length && !saved.length && (photos.loaded || !photos.message)) return null;
  const busy = photos.busy || capturing;
  return <View style={s.details} testID="agreement-terminal-photo-recovery">
    <T variant="bodyStrong">Pripremljene fotografije</T>
    {photos.message ? <T variant="meta" accessibilityLiveRegion="polite">{photos.message}</T> : null}
    <ChatAction label="Osvežite fotografije poruke" text="Proverite fotografije" refresh busy={busy} onPress={() => { void photos.refresh(); }} />
    {items.map((item, index) => <View key={item.ref.clientRequestId} style={s.details}>
      <T variant="meta">{`Fotografija ${index + 1}`}</T>
      {photos.reserved(item) ? <T variant="meta" tone="muted">Fotografija je uz poruku. Prvo proverite da li je poslata.</T> : <>
        <T variant="meta" tone="muted">{item.receipt?.state === 'READY' ? 'Fotografija nije pridružena poruci.' : 'Ne znamo da li je fotografija poslata.'}</T>
        <ChatAction label={`Uklonite pripremljenu fotografiju ${index + 1}`} text="Uklonite fotografiju" busy={busy}
          onPress={() => confirm.ask(removalRequest('AGREEMENT', () => photos.remove(item.ref)))} />
      </>}
    </View>)}
    {saved.length ? <>
      <ChatAction label="Prikažite ranije pripremljene fotografije" busy={busy} onPress={() => setShowSaved(old => !old)} />
      {showSaved ? saved.map((upload, index) => <ChatAction key={upload.clientRequestId}
        label={`Prikažite ranije pripremljenu fotografiju ${index + 1}`} text={`Fotografija ${index + 1} · Prikažite za uklanjanje`}
        busy={busy || photos.items.length >= 6} onPress={() => { void photos.restore(upload.clientRequestId); }} />) : null}
    </> : null}
    {confirm.sheet}
  </View>;
}

/**
 * The conversation of a Dogovor (proposal R, 2026-10-07). White incoming bubbles and charcoal outgoing ones in ONE shape for
 * text, photo and voice; consecutive messages of one person close in time share a run and one tail; a day or a long pause is
 * said once above its messages, in Serbian time (`messages/threadModel`). Each message of mine carries ONE small mark, no clock
 * and no text: a check once the server holds it, two checks only when the read says it was seen (`procitano === true`; the
 * server returns null today, so that state is built and tested but not drawn), a quiet dot while it goes. A pending send keeps
 * its real outbox state (never a text-match guess), and nothing is drawn that the read does not carry.
 *
 * Writing is one pill, "+ / text / microphone": a hold on the microphone sends on release (a screen reader keeps the review step),
 * and the same guards as ever stand behind it: one client message id per message, the retained command, the recovery states, the
 * 2.000-character limit. An unknown outcome is checked with an authoritative message read, never an automatic retry. Explicit resend retains the same client message id. A closed Dogovor
 * draws no field, only one grey sentence under the thread. The composer stays above the keyboard.
 */
export function AgreementChat(props: Props) {
  return voiceMessagesBuilt() && Platform.OS === 'android' && props.voiceScope
    ? <VoiceEnabledAgreementChat {...props} voiceScope={props.voiceScope} /> : <AgreementChatContent {...props} />;
}
function VoiceEnabledAgreementChat(props: Props & { voiceScope: AgreementVoiceScope }) {
  const voice = useAgreementVoice({ ...props.voiceScope, writable: props.writable && !props.terminal,
    canRecord: props.state.phase === 'ready' && !props.state.capturing && !props.state.draft.trim()
      && (!props.photos || props.photos.loaded && !props.photos.busy && !props.photos.hasSelection),
    messages: props.messages, historyError: props.error, refresh: props.refresh });
  return <AgreementChatContent {...props} voice={voice} />;
}
function AgreementChatContent({ messages, loading, error, writable, terminal, refresh, refreshWorkspace, outbox, state, support, photos, voice,
  context, sender, compact = false, refreshing = false, refreshError = false, readingPosition,
  hasOlder = false, hasNewer = false, loadingOlder = false, loadingNewer = false, historyError = false,
  historyErrorDirection, onLoadOlder, onLoadNewer, onShowLatest, onDisplayedMessageIds }: Props & { voice?: AgreementVoiceController }) {
  const textScale = useTextScale();
  const { stacked: stackedComposer } = useLayoutClass();
  // Which message the person is holding, for the support path that used to stand under every one.
  const [chosen, setChosen] = useState<string | null>(null);
  // The "+" opens the shared photo sheet (Galerija, Kamera); the earlier prepared photos are shown when asked for from it.
  const [sheetOpen, setSheetOpen] = useState(false);
  const [savedOpen, setSavedOpen] = useState(false);
  const [gallery, setGallery] = useState<MessageGallery | null>(null);
  const covered = useRef(false);
  const [focused, setFocused] = useState(false);
  const list = useRef<ScrollView>(null);
  // Native layout/keyboard scroll events describe geometry, not a decision to stop following.
  const following = useRef(readingPosition?.current.following ?? true);
  const userScrolling = useRef(false);
  const readingOffset = useRef(readingPosition?.current.offset ?? 0);
  const restoring = useRef(!following.current);
  const rowPositions = useRef(new Map<string, number>());
  const bubblePositions = useRef(new Map<string, { y: number; height: number }>());
  const visibilityFrame = useRef<number | null>(null);
  const scrollObserved = useRef(false);
  const pendingHistory = useRef<PorukaProjekcija[] | null>(null);
  const layoutIdentity = useMemo(() => JSON.stringify([textScale, chosen, messages.map(message =>
    [message.id, message.telo, message.vremeTekst, message.createdAt, message.moja, message.fotografije, message.glas])]), [messages, textScale, chosen]);
  const previousLayout = useRef(layoutIdentity);
  // Insertion, eviction, a changed bubble/day/photo or font size retires old native
  // measurements. In particular an unchanged first ID does not prove the rest stayed put.
  if (previousLayout.current !== layoutIdentity) {
    previousLayout.current = layoutIdentity;
    if (!following.current) restoring.current = true;
    rowPositions.current.clear();
    bubblePositions.current.clear();
    scrollObserved.current = false;
  }
  const restoreFrame = useRef<number | null>(null);
  const mounted = useRef(true);
  const geometry = useRef({ offset: 0, viewport: 0, content: 0 });
  const contextHeight = useRef(0);
  const followFrame = useRef<number | null>(null);
  const [showLatest, setShowLatest] = useState(!following.current);
  const remember = () => {
    if (!mounted.current || !readingPosition) return;
    const offset = readingOffset.current;
    let anchor: AgreementReadingPosition['anchor'];
    let closest = -Infinity;
    if (!following.current) for (const message of source.current.messages) {
      const y = rowPositions.current.get(message.id);
      if (y !== undefined && y <= offset && y > closest) {
        closest = y; anchor = { messageId: message.id, within: offset - y };
      }
    }
    readingPosition.current = { following: following.current, offset, ...(anchor ? { anchor } : {}) };
  };
  const cancelRestoreFrame = () => {
    if (restoreFrame.current !== null) cancelAnimationFrame(restoreFrame.current);
    restoreFrame.current = null;
  };
  const cancelRestore = () => { restoring.current = false; cancelRestoreFrame(); };
  const restoreReading = () => {
    if (!restoring.current || pendingHistory.current === messages || loading || error || userScrolling.current) return;
    if (restoreFrame.current !== null) cancelAnimationFrame(restoreFrame.current);
    restoreFrame.current = requestAnimationFrame(() => {
      restoreFrame.current = null;
      if (!mounted.current || !restoring.current || source.current.loading || source.current.error
        || source.current.messages !== messages || !geometry.current.viewport || !geometry.current.content) return;
      const saved = readingPosition?.current;
      const anchor = saved?.anchor;
      const anchorY = anchor && rowPositions.current.get(anchor.messageId);
      // Wait for the actual row's layout. If access/data changed and it no longer exists,
      // the clamped old offset is a fallback, never a reason to show a cached transcript.
      if (anchor && messages.some(message => message.id === anchor.messageId) && anchorY === undefined) return;
      const wanted = anchor && anchorY !== undefined ? anchorY + anchor.within : readingOffset.current;
      const y = Math.max(0, Math.min(wanted, geometry.current.content - geometry.current.viewport));
      readingOffset.current = geometry.current.offset = y;
      restoring.current = false;
      scrollObserved.current = false;
      list.current?.scrollTo({ y, animated: false });
      remember();
    });
  };
  const cancelFollow = () => {
    if (followFrame.current !== null) cancelAnimationFrame(followFrame.current);
    followFrame.current = null;
  };
  const reportDisplayed = () => {
    if (covered.current || !onDisplayedMessageIds || visibilityFrame.current !== null) return;
    const owner = messages;
    const notify = onDisplayedMessageIds;
    visibilityFrame.current = requestAnimationFrame(() => {
      visibilityFrame.current = null;
      if (covered.current || !mounted.current || restoring.current || source.current.messages !== owner
        || source.current.onDisplayedMessageIds !== notify || source.current.loading || source.current.error) return;
      const { offset, viewport, content } = geometry.current;
      if (!(viewport > 0)) return;
      if (!scrollObserved.current && !(content > 0 && content <= viewport)) return;
      const visible = owner.filter(message => {
        if (message.moja) return false;
        const rowY = rowPositions.current.get(message.id);
        const bubble = bubblePositions.current.get(message.id);
        if (rowY === undefined || !bubble || !(bubble.height > 0)) return false;
        const top = rowY + bubble.y;
        const overlap = Math.min(top + bubble.height, offset + viewport) - Math.max(top, offset);
        // Day labels and mounted offscreen rows cannot acknowledge a message.
        return overlap >= Math.min(bubble.height, viewport) * 0.5;
      }).slice(0, 50).map(message => message.id);
      if (visible.length) notify(visible);
    });
  };
  // Effect replay may suspend work without changing the person's reading intent.
  useEffect(() => { mounted.current = true; return () => {
    mounted.current = false; cancelFollow(); cancelRestoreFrame();
    if (visibilityFrame.current !== null) cancelAnimationFrame(visibilityFrame.current);
    visibilityFrame.current = null;
  }; }, []);
  useEffect(() => {
    if (pendingHistory.current && pendingHistory.current !== messages) pendingHistory.current = null;
    restoreReading(); reportDisplayed();
  }, [messages, loading, error, onDisplayedMessageIds]);
  const followLatest = () => {
    if (!following.current || hasNewer || userScrolling.current) return;
    scrollObserved.current = false;
    list.current?.scrollToEnd({ animated: false });
    cancelFollow();
    // The compact header can change content and viewport in adjacent native layout passes.
    followFrame.current = requestAnimationFrame(() => {
      followFrame.current = null;
      if (following.current && !hasNewer && !userScrolling.current) list.current?.scrollToEnd({ animated: false });
    });
  };
  const chooseLatest = () => {
    cancelRestore(); following.current = true; userScrolling.current = false; remember(); setShowLatest(false); followLatest();
    if (hasNewer || error || !messages.length) void onShowLatest?.();
  };
  const readUserPosition = ({ nativeEvent: event }: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (!mounted.current || source.current.messages !== messages) return;
    readingOffset.current = Math.max(0, event.contentOffset.y);
    following.current = !hasNewer && event.contentOffset.y + event.layoutMeasurement.height >= event.contentSize.height - 80;
    remember();
    setShowLatest(previous => previous === !following.current ? previous : !following.current);
  };
  const observePosition = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (!mounted.current || source.current.messages !== messages) return;
    const native = event.nativeEvent;
    scrollObserved.current = true;
    geometry.current = { offset: native.contentOffset.y, viewport: native.layoutMeasurement.height, content: native.contentSize.height };
    if (userScrolling.current) readUserPosition(event);
    reportDisplayed();
  };
  const source = useRef({ messages, support, loading, error, photos, terminal, writable, outbox, state, refresh, onDisplayedMessageIds });
  source.current = { messages, support, loading, error, photos, terminal, writable, outbox, state, refresh, onDisplayedMessageIds };
  const galleryCurrent = (value: MessageGallery) => {
    const now = source.current;
    if (!mounted.current || now.loading || now.error || now.outbox !== value.outbox || now.photos?.agreementId !== value.context.agreementId) return false;
    const entry = value.localId ? now.state.entries.find(item => item.command.clientMessageId === value.localId) : null;
    const ids = value.localId ? entry?.messageId === value.context.messageId ? entry?.command.photos?.assetIds : undefined
      : now.messages.find(item => item.id === value.context.messageId)?.fotografije?.map(item => item.assetId);
    return !!ids && ids.length === value.photos.length && ids.every((id, index) => id === value.photos[index].assetId);
  };
  const openGallery = (value: MessageGallery) => {
    if (!galleryCurrent(value)) return;
    covered.current = true; setGallery(value);
  };
  const closeGallery = () => { covered.current = false; setGallery(null); reportDisplayed(); };
  const visibleGallery = gallery && galleryCurrent(gallery) ? gallery : null;
  useEffect(() => { if (gallery && !visibleGallery) closeGallery(); }, [gallery, visibleGallery]);
  const loadHistory = (direction: 'older' | 'newer') => {
    if (!mounted.current || source.current.messages !== messages || loadingOlder || loadingNewer || loading || error) return;
    cancelFollow(); following.current = false; remember(); restoring.current = true;
    pendingHistory.current = messages;
    setShowLatest(true);
    void (direction === 'older' ? onLoadOlder?.() : onLoadNewer?.())?.finally(() => {
      if (!mounted.current || pendingHistory.current !== messages) return;
      pendingHistory.current = null;
      if (source.current.messages === messages) { restoring.current = false; reportDisplayed(); }
    });
  };
  const supportCurrent = () => !!support && source.current.support === support && source.current.messages === messages
    && !source.current.loading && !source.current.error && support.canAct();
  const ready = state.phase === 'ready';
  const entries = voice ? [...state.entries, ...voice.outboxState.entries] : state.entries;
  useFailedSendTick(entries, ready && (!voice || voice.outboxState.phase === 'ready'));
  const voiceBusy = !!voice && voice.recording.phase !== 'idle';
  const hideEmptyTextForVoiceReview = voice?.recording.phase === 'review' && state.draft.length === 0;
  const length = Array.from(state.draft.trim()).length;
  // Presentation follows the draft, never transient send eligibility. A held mic retains its responder host/slot.
  const holdingVoice = voice?.recording.phase === 'requesting' || voice?.recording.phase === 'recording';
  const hasMessageDraft = length > 0 || state.capturing || !!photos?.hasSelection || !!photos?.ready || !!photos?.items?.length;
  const showMic = !!voice && (holdingVoice || !hasMessageDraft);
  const inlineTools = !stackedComposer && !hideEmptyTextForVoiceReview;
  const canSend = ready && writable && !voiceBusy && !state.capturing && (!photos || photos.loaded) && !photos?.busy && (length > 0 || photos?.ready === true) && length <= 2000
    && (!photos?.hasSelection || photos.ready);
  const settleSend = async (owner: Outbox, photoAgreementId?: string) => {
    if (!mounted.current || source.current.outbox !== owner) return;
    setSavedOpen(false);
    await source.current.refresh();
    if (!mounted.current || source.current.outbox !== owner) return;
    const currentPhotos = source.current.photos;
    if (currentPhotos?.agreementId === photoAgreementId) await currentPhotos?.refresh();
  };
  /** Read-only verification. A refresh reads this Agreement's canonical messages; the parent
   * reconciles exact account/clientMessageId/body/media receipts, including the voice outbox.
   * Absence from the current history window is not proof that a message was not delivered. */
  const checkUnknown = () => {
    if (!mounted.current || source.current.outbox !== outbox) return;
    void source.current.refresh().catch(() => { /* The history owner reports read errors. */ });
  };
  /** Only an explicit resend can write. The outbox reuses the retained client message id. */
  const resend = (entry: typeof entries[number]) => {
    if (!mounted.current || source.current.outbox !== outbox || !source.current.writable || source.current.terminal) return;
    if (entry.command.voice ? voice?.outboxState.phase !== 'ready' : state.phase !== 'ready') return;
    const owner = entry.command.voice ? voice?.outbox : outbox;
    if (owner) void owner.retry(entry.command.clientMessageId).then(() => settleSend(outbox, entry.command.agreementId));
  };
  const send = () => {
    if (voiceBusy) return;
    if (!mounted.current || source.current.outbox !== outbox || source.current.terminal || !source.current.writable) return;
    const currentPhotos = source.current.photos;
    if (currentPhotos && !currentPhotos.canSubmit()) return;
    const attachments = currentPhotos?.capture();
    if (currentPhotos?.hasSelection && !attachments) return;
    // Follow the explicit gesture, not an intermediate outbox state React may batch away.
    // Hydrating older confirmed/unknown commands must never move a reader to the bottom.
    chooseLatest();
    // The photo tools fold back behind the "+" once the message has gone (review r4 rd item 6).
    void outbox.sendDraft(attachments ?? undefined).then(() => settleSend(outbox, currentPhotos?.agreementId));
  };
  // Reconciliation includes the real sender/key/body in the model. Never use
  // matching text alone to pretend that an uncertain send was accepted.
  const matchesCanonical = (entry: typeof state.entries[number]) => !error && messages.some(message =>
    message.posiljalacAccountId === entry.command.accountId && message.telo === entry.command.body
      && message.clientMessageId === entry.command.clientMessageId
      && sameMessagePhotos(entry.command.photos, message.fotografije?.length
        ? { agreementVersion: message.dogovorVerzija!, assetIds: message.fotografije.map(photo => photo.assetId) } : undefined)
      && sameMessageVoice(entry.command.voice, message.glas ? { agreementVersion: message.dogovorVerzija!, assetId: message.glas.assetId } : undefined)
      && (!entry.messageId || message.id === entry.messageId));
  const receiptKey = (entry: typeof state.entries[number]) => JSON.stringify(entry.command);
  const observedOutbox = useRef({ owner: outbox, hydrated: false, historical: new Set<string>(), canonical: new Set<string>() });
  if (observedOutbox.current.owner !== outbox) observedOutbox.current = {
    owner: outbox, hydrated: false, historical: new Set(), canonical: new Set(),
  };
  const observed = observedOutbox.current;
  if (ready && !observed.hydrated) {
    observed.hydrated = true;
    for (const entry of state.entries) if (entry.state === 'confirmed') observed.historical.add(receiptKey(entry));
  }
  const observedVoice = useRef({ owner: voice?.outbox, hydrated: false });
  if (observedVoice.current.owner !== voice?.outbox) observedVoice.current = { owner: voice?.outbox, hydrated: false };
  if (voice?.outboxState.phase === 'ready' && !observedVoice.current.hydrated) {
    observedVoice.current.hydrated = true;
    for (const entry of voice.outboxState.entries) if (entry.state === 'confirmed') observed.historical.add(receiptKey(entry));
  }
  // Confirmed receipts have no chronological timestamp. Hydrated receipts and already
  // observed canonical rows must never reappear at the end of an older server window.
  // Newly confirmed sends still show until their first exact canonical read, even if
  // React batches away the intermediate sending render. Keep bookkeeping outbox-bounded.
  const currentKeys = new Set(entries.map(receiptKey));
  for (const key of observed.historical) if (!currentKeys.has(key)) observed.historical.delete(key);
  for (const key of observed.canonical) if (!currentKeys.has(key)) observed.canonical.delete(key);
  for (const entry of entries) if (matchesCanonical(entry)) observed.canonical.add(receiptKey(entry));
  const local = entries.filter(entry => !matchesCanonical(entry)
    && !(entry.state === 'confirmed' && (observed.historical.has(receiptKey(entry)) || observed.canonical.has(receiptKey(entry)))));
  const denied = entries.some(entry => entry.error === 'READ_ONLY' || entry.error === 'NOT_AVAILABLE');
  // A chosen, prepared or explained photo is never hidden: the tray above writing is drawn while one exists (review r4 rd
  // item 6), or while the earlier prepared photos were asked for. Nothing else opens it; the "+" opens the photo sheet.
  const forced = !!photos && (photos.hasSelection || !!photos.items?.length || !!photos.message || !!photos.versionConflict);
  const photoPanel = !!photos && !terminal && (forced || savedOpen);
  const shown = !error ? messages : [];
  const empty = !loading && !error && messages.length === 0 && local.length === 0;
  // The first read's spinner stands in the middle like every other state, not on the composer (review r4 rd item 8).
  const centred = empty || error || (loading && !shown.length && !local.length);
  // The transcript as runs and lines: grouped bubbles, Serbian day lines, one small mark by each of my messages.
  const today = serbianToday();
  const thread = useMemo(() => buildThread(shown), [shown, today]); // eslint-disable-line react-hooks/exhaustive-deps
  // The server read is the only automatic recovery for an unknown send; mount,
  // foreground and reconnect must never call a message writer.
  const sendsAllowed = writable && !terminal && !loading && !error;
  return (
    <View style={s.screen}>
      <ScrollView ref={list} testID="agreement-chat-history" style={s.history} keyboardShouldPersistTaps="handled"
        onContentSizeChange={(_width, height) => { geometry.current.content = height; restoreReading(); followLatest(); reportDisplayed(); }}
        onLayout={event => { if (event) geometry.current.viewport = event.nativeEvent.layout.height; restoreReading(); followLatest(); reportDisplayed(); }}
        accessibilityActions={[{ name: 'scrollBackward', label: 'Starije poruke' }, { name: 'scrollForward', label: 'Novije poruke' }]}
        onAccessibilityAction={({ nativeEvent }) => {
          const direction = nativeEvent.actionName === 'scrollBackward' ? -1 : nativeEvent.actionName === 'scrollForward' ? 1 : 0;
          if (!direction) return;
          cancelFollow(); cancelRestore(); userScrolling.current = false;
          const { offset, viewport, content } = geometry.current;
          const end = Math.max(0, content - viewport);
          const y = Math.max(0, Math.min(end, offset + direction * viewport * 0.8));
          geometry.current.offset = readingOffset.current = y;
          scrollObserved.current = false;
          following.current = !hasNewer && direction > 0 && y >= end - 1;
          remember();
          setShowLatest(!following.current);
          list.current?.scrollTo({ y, animated: false });
          reportDisplayed();
        }}
        scrollEventThrottle={100}
        onScrollBeginDrag={event => { cancelFollow(); cancelRestore(); userScrolling.current = true; readUserPosition(event); }}
        onScroll={observePosition}
        onScrollEndDrag={event => { readUserPosition(event); userScrolling.current = false; }}
        onMomentumScrollBegin={() => { cancelFollow(); cancelRestore(); userScrolling.current = true; }}
        onMomentumScrollEnd={event => { readUserPosition(event); userScrolling.current = false; }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} tintColor={sys.color.ink} colors={[sys.color.ink]} />}
        contentContainerStyle={[s.list, centred ? s.listCentred : s.listBottom]}>
        <View testID="agreement-chat-context" onLayout={({ nativeEvent }) => {
          if (!mounted.current) return;
          const height = nativeEvent.layout.height;
          const delta = height - contextHeight.current;
          contextHeight.current = height;
          if (following.current) followLatest();
          else if (restoring.current) restoreReading();
          else if (delta && !userScrolling.current) {
            // Preserve the message's screen position when terms or refresh feedback change above it.
            readingOffset.current = Math.max(0, readingOffset.current + delta);
            geometry.current.offset = readingOffset.current;
            // Native row layouts follow this context measurement; retain the same anchor
            // while updating only its fallback offset.
            if (readingPosition) readingPosition.current = { ...readingPosition.current, offset: readingOffset.current };
            list.current?.scrollTo({ y: readingOffset.current, animated: false });
          }
        }}>{context}
          {refreshError && !error ? <View style={s.refreshNotice} accessibilityLiveRegion="polite">
            <T variant="note" tone="muted" style={s.centerText}>{messages.length
              ? 'Nove poruke nisu proverene. Ranije učitane poruke su i dalje ovde.'
              : 'Nove poruke nisu proverene.'}</T>
            <ChatAction label="Ponovo proverite nove poruke" text="Pokušajte ponovo" onPress={() => void refresh()} center refresh busy={refreshing} />
          </View> : null}
          {/* Measure the complete pre-message region: failure replaces this action with the notice,
              so compensating the notice alone would shift an older message by the removed button's height. */}
          {!error && !refreshError && !terminal && (shown.length > 0 || local.length > 0) && !(loading && !shown.length)
            ? <ChatAction label="Osvežite poruke" onPress={() => void refresh()} refresh quiet busy={refreshing} /> : null}
        </View>
        {!error && hasOlder && onLoadOlder ? <View>
          {historyError && historyErrorDirection === 'older' ? <T variant="note" tone="muted" style={s.centerText} accessibilityLiveRegion="polite">Starije poruke nisu učitane. Prepiska ostaje ovde.</T> : null}
          <ChatAction label="Učitajte starije poruke" text={historyError && historyErrorDirection === 'older' ? 'Pokušajte ponovo · starije poruke' : 'Starije poruke'}
            onPress={() => loadHistory('older')} center refresh busy={loadingOlder || loadingNewer || loading || refreshing} />
        </View> : null}
        {loading && !shown.length ? <View accessibilityLiveRegion="polite" style={s.loading}>
          <ActivityIndicator accessibilityLabel="Učitavanje poruka" color={sys.color.ink} />
          <T variant="note" tone="muted" style={[s.centerText, s.stateCopy]}>Učitavamo poruke i proveravamo ko učestvuje u Dogovoru.</T>
        </View> : null}
        {/* Incoming push hints also refresh the visible conversation. Manual refresh remains available without push
            permission/delivery, including as a quiet action accessible without a pull gesture at the head of the
            thread (review r4 rd item 4; "Povuci naniže za nove poruke." used to be the only hint). It is there in the
            empty thread too, where someone waits for the other side's first message, and not on a closed Dogovor, where
            nothing new can arrive (verify r4b rd item 4); the first read's spinner stands alone. In the empty thread it
            stands under the empty state's words, as the error state's action does, not above its drawing (verify r4c
            item 2). */}
        {error ? <View style={s.stateBlock} accessibilityLiveRegion="polite">
          <View style={s.stateArt}><FactArt kind="chat" size={56} muted /></View>
          <T accessibilityRole="alert" variant="title" style={[s.ink, s.centerText]}>Poruke nisu učitane</T>
          <T variant="copy" tone="muted" style={[s.centerText, s.stateCopy]}>{state.draft.trim() || state.entries.length
            ? 'Proverite vezu. Vaš tekst ostaje sačuvan.' : 'Proverite vezu pa pokušajte ponovo.'}</T>
          <ChatAction label="Ponovo učitaj poruke" text="Pokušajte ponovo" onPress={() => void refresh()} center />
        </View> : null}
        {empty ? <View style={s.stateBlock}>
          <View style={s.stateArt}><FactArt kind="chat" size={56} muted={terminal} /></View>
          {/* A finished Dogovor with no messages cannot take a first one; it says so instead of inviting it. */}
          {terminal ? <T variant="copy" tone="muted" style={[s.centerText, s.stateCopy]}>U ovom Dogovoru nije bilo poruka.</T> : <>
            <T accessibilityRole="header" variant="title" style={[s.ink, s.centerText]}>Napišite prvu poruku</T>
            <T variant="copy" tone="muted" style={[s.centerText, s.stateCopy]}>Poruke vide samo učesnici ovog Dogovora.</T>
            {!refreshError ? <ChatAction label="Osvežite poruke" onPress={() => void refresh()} center refresh busy={refreshing} /> : null}</>}
        </View> : null}
        {thread.map(entry => {
          const { message, moment } = entry;
          // The small mark by my message: sent, or seen only when the read says so. The other person's message has none.
          const kind = readMark(message);
          const selectForSupport = () => setChosen(current => current === message.id ? null : message.id);
          const summary = { accessibilityRole: support ? 'button' as const : 'text' as const,
            accessibilityLabel: messageSpoken(message, moment, kind ? MARK_WORDS[kind].toLowerCase() : undefined),
            accessibilityHint: support ? 'Dugim pritiskom birate poruku za podršku.' : undefined,
            onLongPress: support ? selectForSupport : undefined,
            accessibilityActions: support ? [{ name: 'activate', label: 'Izaberite ovu poruku za podršku' }] : undefined,
            onAccessibilityAction: support ? selectForSupport : undefined,
            haptic: support ? 'select' as const : 'none' as const, scaleTo: 1 as const };
          const hasPhotos = !!photos && !!message.fotografije?.length;
          const common = { mine: message.moja, first: entry.first, last: entry.last, afterSeparator: entry.separator !== null, summary,
            mark: kind ? <MessageMark kind={kind} /> : null };
          return <View key={message.id} testID={`agreement-message-row-${message.id}`} onLayout={({ nativeEvent }) => {
            if (!mounted.current || source.current.messages !== messages) return;
            rowPositions.current.set(message.id, nativeEvent.layout.y); restoreReading(); reportDisplayed();
          }}>
            {entry.separator ? <T accessibilityRole="header" style={s.day}>{entry.separator}</T> : null}
            {entry.first && sender ? sender(message) : null}
            <View testID={`agreement-message-bubble-${message.id}`} onLayout={({ nativeEvent }) => {
              if (!mounted.current || source.current.messages !== messages) return;
              bubblePositions.current.set(message.id, { y: nativeEvent.layout.y, height: nativeEvent.layout.height }); reportDisplayed();
            }}>
            {/* One bubble shape for text, photo and voice. The spoken summary keeps who/what/when/state, but photo recovery
                and the play button are separate reachable actions, never buttons hidden inside an accessible message
                button; a photo is also held (long press) to offer the message to support, without being a stop itself. */}
            {hasPhotos ? <PhotoBubble {...common} caption={message.telo || null}
              photos={message.fotografije?.map((photo, photoIndex) => <Press key={photo.assetId} accessible={false} scaleTo={1} haptic="select"
                onLongPress={summary.onLongPress}><AuthorizedPhoto assetId={photo.assetId} agreementId={photos!.agreementId} messageId={message.id}
                label={`Fotografija poruke ${photoIndex + 1}`} style={s.photo}
                open={{ label: `Otvorite fotografiju poruke ${photoIndex + 1}`, hint: 'Pregled preko celog ekrana.',
                  onLongPress: summary.onLongPress,
                  onPress: () => openGallery({ outbox, context: { agreementId: photos!.agreementId, messageId: message.id },
                    photos: message.fotografije!, index: photoIndex }) }} /></Press>)} />
              : message.glas && voice ? <VoiceBubble {...common} voice={voice} message={message} />
                : <TextBubble {...common} lines={[message.telo, message.glas ? `Glasovna poruka · ${voiceTime(message.glas.trajanjeMs)}` : ''].filter(Boolean)} />}
            </View>
            {/* This stood under every message, full width, doubling the height of the transcript. It belongs to the
                message a person actually wants to report, which is the one they hold. It stands under that bubble, on
                its side, as a sibling: inside the bubble's press its own buttons were a target inside a target, and a
                screen reader never reached them. */}
            {support && chosen === message.id && uuid(message.id) && positiveInteger(message.dogovorVerzija) ? <View
              style={[s.supportEntry, message.moja ? s.supportMine : s.supportTheirs]}><SupportContextEntry
                reference={{ kind: 'AGREEMENT_MESSAGE', id: message.id.toLowerCase(), revision: message.dogovorVerzija }}
                label="Izaberite ovu poruku za podršku" previewText={[message.glas ? 'Glasovna poruka. Podrška ne može da presluša snimak.' : message.telo, message.fotografije?.length
                  ? `Privatne fotografije uz ovu poruku: ${message.fotografije.length}. Uključene su u izabrani dokaz.` : ''].filter(Boolean).join('\n')} disabled={loading}
                canAct={supportCurrent} navigate={support.navigate} /></View> : null}
          </View>;
        })}
        {!error && hasNewer && onLoadNewer ? <View>
          {historyError && historyErrorDirection === 'newer' ? <T variant="note" tone="muted" style={s.centerText} accessibilityLiveRegion="polite">Novije poruke nisu učitane. Prepiska ostaje ovde.</T> : null}
          <ChatAction label="Učitajte novije poruke" text={historyError && historyErrorDirection === 'newer' ? 'Pokušajte ponovo · novije poruke' : 'Novije poruke'}
            onPress={() => loadHistory('newer')} center refresh busy={loadingOlder || loadingNewer || loading || refreshing} />
        </View> : null}
        {/* What I sent and the read has not returned yet: said by its real outbox state, with no day of its own (an
            unconfirmed send may be older than today). */}
        {/* The uncertain state offers a read-only check and a distinct user-requested resend with the same
            command key. A definite failure offers only an explicit resend while writing is allowed. */}
        {local.map((entry, index) => {
          const failed = entry.state === 'failed';
          const kind = entryMark(entry);
          const what = entry.command.body || (entry.command.voice ? 'glasovna poruka' : entry.command.photos ? 'fotografija' : 'poruka');
          const summary = { accessibilityRole: 'text' as const, accessibilityLabel: `Vi: ${what}, ${MARK_WORDS[kind].toLowerCase()}`, scaleTo: 1 as const };
          // An unloaded newer window separates this local run from the last visible canonical message.
          const first = index === 0 && (hasNewer || !thread[thread.length - 1]?.message.moja);
          const common = { mine: true, first, last: index === local.length - 1,
            afterSeparator: false, summary, failed, mark: failed ? null : <MessageMark kind={kind} live /> };
          return <View key={entry.command.clientMessageId} testID={`agreement-local-message-${entry.command.clientMessageId}`}>
            {first && sender ? sender({ moja: true, posiljalacAccountId: entry.command.accountId }) : null}
            {entry.command.photos ? <PhotoBubble {...common} caption={entry.command.body || null}
              photos={entry.command.photos.assetIds.map((assetId, photoIndex) => <AuthorizedPhoto key={assetId} assetId={assetId}
                agreementId={entry.command.agreementId} messageId={entry.messageId} label={`Fotografija poruke na čekanju ${photoIndex + 1}`}
                style={s.photo} open={{ label: `Otvorite fotografiju poruke na čekanju ${photoIndex + 1}`,
                  onPress: () => openGallery({ outbox, context: { agreementId: entry.command.agreementId, messageId: entry.messageId },
                    localId: entry.command.clientMessageId, photos: entry.command.photos!.assetIds.map(id => ({ assetId: id })), index: photoIndex }) }} />)} />
              : <TextBubble {...common} lines={[entry.command.body, entry.command.voice ? 'Glasovna poruka' : ''].filter(Boolean)} />}
            {entry.state === 'unknown' || failed ? <View style={s.pendingNote}>
              <T variant="meta" tone={failed ? 'danger' : 'muted'} style={s.rightText} accessibilityLiveRegion="polite">{MARK_WORDS[kind]}</T>
              {failed && entry.error ? <T variant="meta" tone="muted" style={s.rightText}>{errors[entry.error]}</T> : null}
              {entry.state === 'unknown' ? <ChatAction label={`Proverite da li je stigla: ${what}`}
                text="Proverite" tone="ink" end refresh busy={refreshing}
                onPress={checkUnknown} /> : null}
              {sendsAllowed && (entry.command.voice ? voice?.outboxState.phase === 'ready' : state.phase === 'ready') ? <ChatAction
                label={entry.command.voice ? 'Pošaljite glasovnu poruku ponovo' : `Ponovite slanje poruke ${entry.command.body}`}
                text="Pošaljite ponovo" tone="ink" end onPress={() => resend(entry)} /> : null}
            </View> : null}
          </View>;
        })}
      {/* Photo preparation and recovery can be taller than the remaining keyboard viewport. They belong to its
          scroll, directly above writing, so their complete explanation and every exact retry remain reachable. */}
      {state.error || state.phase === 'error' || (terminal && !!photos) || (!terminal && !writable) || denied || length > 2000 || photoPanel ? <View testID="agreement-chat-details" style={s.details}>
        {state.error ? <T variant="meta" tone="danger" accessibilityLiveRegion="polite">{errors[state.error]}</T> : null}
        {state.phase === 'error' || state.error === 'STORAGE_UNAVAILABLE' || state.error === 'STORAGE_INVALID'
          ? <ChatAction label="Ponovo učitaj sačuvane poruke" text="Pokušajte ponovo" onPress={() => void outbox.start()} /> : null}
        {/* A closed Dogovor keeps its history and existing-photo recovery, without a new-message/photo composer; the one
            sentence that says so stands under the thread, where the field would be. */}
        {!terminal && !writable ? <T variant="meta" tone="muted">Osvežite Dogovor pre nove poruke. Nacrt ostaje sačuvan.</T> : null}
        {!terminal && (!writable || denied) ? <ChatAction label="Osvežite status Dogovora" onPress={() => void refreshWorkspace()} /> : null}
        {!terminal && length > 2000 ? <T variant="meta" tone="danger">{length.toLocaleString('sr-Latn-RS')} / 2.000 znakova — skratite poruku.</T> : null}
        {photos && photoPanel ? <AgreementPhotoComposer photos={photos} capturing={state.capturing}
          showSaved={savedOpen} onHideSaved={() => setSavedOpen(false)} /> : null}
        {photos && terminal ? <TerminalPhotoRecovery photos={photos} capturing={state.capturing} /> : null}
      </View> : null}
      {voice ? <View style={s.details}>
        <AgreementVoicePanel voice={voice} writable={writable && !terminal} />
        {voice.outboxState.error ? <T variant="meta" tone="danger" accessibilityLiveRegion="polite">{errors[voice.outboxState.error]}</T> : null}
        {voice.outboxState.phase === 'error' ? <ChatAction label="Učitajte sačuvana slanja glasovnih poruka" text="Pokušajte ponovo" onPress={() => { void voice.outbox.start(); }} /> : null}
      </View> : null}
      </ScrollView>
      {showLatest || hasNewer ? <View style={s.latestRow}>
        <Press accessibilityRole="button" accessibilityLabel="Najnovije poruke" onPress={chooseLatest}
          haptic="select" hitSlop={0} style={s.latest}>
          <Glyph name="caret-down" size={20} />
          <T variant="note" tone="ink">Najnovije poruke</T>
        </Press>
      </View> : null}
      {!terminal ? <View testID="agreement-chat-composer" style={[s.composerArea, compact && s.composerCompact]}>
        <View style={[s.pill, focused && s.pillFocused]}>
          <View style={[s.writingRow, inlineTools && photos && s.writingWithPhoto, hideEmptyTextForVoiceReview && s.hidden]}
            accessibilityElementsHidden={hideEmptyTextForVoiceReview}
            importantForAccessibility={hideEmptyTextForVoiceReview ? 'no-hide-descendants' : 'auto'}>
            <TextInput value={state.draft} onChangeText={outbox.setDraft} multiline editable={!terminal && !voiceBusy}
              accessibilityLabel="Napišite poruku" placeholder="Poruka" placeholderTextColor={sys.color.muted}
              onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
              // Let an ordinary multiline draft show up to three full lines. The old keyboard cap was one
              // line plus padding, which clipped the first line while the caret scrolled to the last one.
              scrollEnabled style={[s.input, s.writingInput, inlineTools && s.inputInline, { minHeight: Math.max(COMMAND, Math.ceil(sys.type.body.lineHeight * textScale + 24)) },
                compact && { maxHeight: Math.max(COMMAND, Math.ceil(sys.type.body.lineHeight * textScale * (textScale >= 1.6 ? 2 : 3) + 24)) }]} />
            <View style={[s.commandSlot, !inlineTools && showMic && s.hidden]}>
            <Press accessibilityRole="button" accessibilityLabel="Pošaljite poruku" disabled={!canSend}
              accessibilityElementsHidden={showMic} importantForAccessibility={showMic ? 'no-hide-descendants' : 'auto'}
              accessibilityState={{ disabled: !canSend, busy: state.capturing }} onPress={send} haptic={canSend ? 'light' : 'none'} hitSlop={0} style={[s.sendArea, showMic && s.hidden]}>
              <View style={[s.send, canSend && s.sendReady]}>
                {state.capturing ? <ActivityIndicator color={sys.color.muted} />
                  : <Glyph name="send" size={20} tone={canSend ? 'onGreen' : 'muted'} on />}
              </View>
            </Press>
            </View>
          </View>
        {photos || voice ? <View pointerEvents="box-none" style={[s.toolbar, inlineTools && s.toolbarInline]}>
          {photos ? <Press accessibilityRole="button" accessibilityLabel={PHOTO_WORDS.add} accessibilityHint="Galerija ili kamera."
            accessibilityState={{ disabled: voiceBusy }} disabled={voiceBusy}
            onPress={() => { chooseLatest(); setSheetOpen(true); }} haptic={voiceBusy ? 'none' : 'select'} hitSlop={0}
            style={[s.tool, inlineTools && s.toolInline]}>
            <Glyph name="plus" size={24} tone={voiceBusy ? 'muted' : 'ink'} />
            {!inlineTools ? <T variant="meta" style={[s.toolLabel, voiceBusy && s.toolLabelDisabled]}>{PHOTO_WORDS.add}</T> : null}
          </Press> : null}
          {voice ? <View pointerEvents="box-none" style={[s.voiceTools, inlineTools && s.voiceToolsInline]}>
            <View pointerEvents={showMic ? 'auto' : 'none'} style={[s.micSlot, !inlineTools && !showMic && s.hidden]}
              accessibilityElementsHidden={!showMic} importantForAccessibility={!showMic ? 'no-hide-descendants' : 'auto'}>
              <View style={!showMic ? s.hidden : undefined}><AgreementVoiceMic voice={voice} /></View>
            </View>
          </View> : null}
        </View> : null}
        </View>
      </View> : <View testID="agreement-chat-closed" accessible accessibilityLabel={CLOSED_SENTENCE} style={s.closed}>
        <FactArt kind="lock" size={20} muted />
        <T variant="note" tone="muted" style={s.closedText}>{CLOSED_SENTENCE}</T>
      </View>}
      {photos && sheetOpen && !terminal ? <AgreementPhotoSheet photos={photos} capturing={state.capturing}
        onClose={() => setSheetOpen(false)} onShowSaved={() => setSavedOpen(true)} /> : null}
      {visibleGallery ? <FocusedMessageGallery title="Fotografije iz poruke" context={visibleGallery.context}
        photos={visibleGallery.photos} index={visibleGallery.index} onClose={closeGallery}
        onIndex={index => { if (galleryCurrent(visibleGallery)) setGallery({ ...visibleGallery, index }); }} /> : null}
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, minHeight: 0, backgroundColor: sys.conversation.ground },
  history: { flex: 1, minHeight: 0 },
  latestRow: { alignItems: 'center', paddingHorizontal: sys.space.md },
  latest: { minHeight: COMMAND, flexDirection: 'row', alignItems: 'center', gap: sys.space.sm,
    paddingHorizontal: sys.space.md },
  list: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12, flexGrow: 1 },
  // A short conversation sits on the composer, where a reply is written; a state stands in the middle.
  listBottom: { justifyContent: 'flex-end' },
  listCentred: { justifyContent: 'center' },
  loading: { paddingVertical: 24, alignItems: 'center', gap: sys.space.sm },
  center: { alignSelf: 'center' }, end: { alignSelf: 'flex-end' }, centerText: { textAlign: 'center' }, ink: { color: sys.color.ink },
  // The states of the conversation are the system's empty and error column (T7): the picture, one title, one sentence of at most 280, the way forward.
  stateBlock: { gap: sys.space.md, alignItems: 'center', paddingHorizontal: sys.space.xl, paddingVertical: sys.space.base },
  stateCopy: { maxWidth: 280 },
  refreshNotice: { gap: 8, alignItems: 'center', paddingVertical: 12 },
  stateArt: { width: 96, height: 96, borderRadius: sys.radius.card, backgroundColor: sys.conversation.iconWell, alignItems: 'center', justifyContent: 'center', marginBottom: sys.space.xs },
  chatAction: { minHeight: COMMAND, justifyContent: 'center', alignSelf: 'flex-start', paddingHorizontal: 4 },
  refreshAction: { flexDirection: 'row', alignItems: 'center', gap: sys.space.sm, paddingHorizontal: sys.space.base,
    borderWidth: 1, borderColor: sys.color.line, borderRadius: sys.radius.pill },
  // A focused button must also be visible and tappable. The previous zero-height/transparent style stranded screen-reader focus.
  refreshQuiet: { borderWidth: 0, alignSelf: 'flex-end', paddingHorizontal: sys.space.sm },
  // A day or a pause, said once above its messages: a quiet word, no box (proposal R1). The bubble shape lives in ./messages/bubbleShape.
  day: { alignSelf: 'center', marginTop: sys.space.base, marginBottom: sys.space.sm, paddingHorizontal: sys.space.md,
    fontSize: 12, lineHeight: 16, fontWeight: '600', color: sys.color.muted, fontVariant: ['tabular-nums'] },
  // The support entry of a held message stands under it, on its side, as wide as a bubble may be.
  supportEntry: { maxWidth: '78%', marginTop: 4 },
  supportMine: { alignSelf: 'flex-end' }, supportTheirs: { alignSelf: 'flex-start' },
  photo: { width: 220, maxWidth: '100%' },
  // What an unconfirmed or refused send says under its bubble, on its side, with the one action for that exact message.
  pendingNote: { alignSelf: 'flex-end', alignItems: 'flex-end', maxWidth: '78%', marginTop: 4, gap: 2 },
  rightText: { textAlign: 'right' },
  // A closed Dogovor: one grey sentence where the field was (proposal R2).
  closed: { flexDirection: 'row', alignItems: 'center', gap: sys.space.md, marginHorizontal: sys.space.base, marginTop: sys.space.sm,
    marginBottom: sys.space.md, paddingVertical: 14, paddingHorizontal: sys.space.base, borderRadius: sys.radius.control, backgroundColor: sys.color.wash },
  closedText: { flex: 1, minWidth: 0 },
  // One stable surface: ordinary tools share the writing line; large text gets an internal second row.
  // Only styles change. The native input and held mic keep their React position across draft/keyboard changes.
  composerArea: { flexShrink: 0, gap: 4, paddingHorizontal: sys.space.md, paddingTop: sys.space.sm, paddingBottom: sys.space.md, backgroundColor: sys.conversation.ground },
  composerCompact: { paddingTop: 4, paddingBottom: 8 },
  details: { gap: sys.space.sm, paddingTop: sys.space.sm },
  // The one pill, in the Gemini manner: "+" and the microphone (or send) on the ends of one rounded, softly lifted capsule.
  pill: { paddingHorizontal: sys.space.sm, paddingVertical: sys.space.xs, borderRadius: sys.radius.sheet,
    borderWidth: 1, borderColor: sys.conversation.edge, backgroundColor: sys.conversation.surface, ...floating },
  writingRow: { flexDirection: 'row', alignItems: 'flex-end' },
  writingInput: { flex: 1, paddingHorizontal: 12, paddingVertical: 12 },
  inputInline: { paddingHorizontal: 4 },
  writingWithPhoto: { paddingLeft: INLINE_PLUS + sys.space.xs },
  hidden: { display: 'none' },
  commandSlot: { width: COMMAND, height: COMMAND, flexShrink: 0 },
  micSlot: { width: COMMAND, height: COMMAND, flexShrink: 0 },
  // Inside the pill the "+" is a 44 well (the touch token), centred in the pill's 52.
  toolInline: { width: INLINE_PLUS, height: INLINE_PLUS, minWidth: INLINE_PLUS, minHeight: INLINE_PLUS, paddingHorizontal: 0 },
  pillFocused: { borderColor: sys.color.ink },
  toolbar: { minHeight: COMMAND, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: sys.space.sm },
  toolbarInline: { position: 'absolute', left: sys.space.sm, right: sys.space.sm, bottom: sys.space.xs, flexWrap: 'nowrap', justifyContent: 'space-between', gap: 0 },
  voiceTools: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: sys.space.xs },
  voiceToolsInline: { flex: 0, marginLeft: 'auto' },
  tool: { minWidth: COMMAND, minHeight: COMMAND, flexShrink: 1, flexDirection: 'row', gap: sys.space.sm, paddingHorizontal: sys.space.md,
    borderRadius: sys.radius.pill, backgroundColor: sys.conversation.iconWell, alignItems: 'center', justifyContent: 'center' },
  toolLabel: { flexShrink: 1, color: sys.color.ink },
  toolLabelDisabled: { color: sys.color.muted },
  input: withInter({ ...sys.type.body, minWidth: 0, minHeight: COMMAND, maxHeight: 140, color: sys.color.ink,
    paddingHorizontal: sys.space.md, paddingTop: sys.space.md, paddingBottom: sys.space.md, textAlignVertical: 'top' }),
  // The send is a 48 px target around a 40 px circle: the one green primary of the screen with a white glyph when a message
  // can go, a grey well with a muted glyph when it cannot (never faded), a quiet spinner while photos are being captured.
  sendArea: { width: COMMAND, height: COMMAND, marginLeft: 'auto', alignItems: 'center', justifyContent: 'center' },
  send: { width: 40, height: 40, borderRadius: sys.radius.pill, alignItems: 'center', justifyContent: 'center', backgroundColor: sys.color.control },
  sendReady: { backgroundColor: sys.color.green },
});
