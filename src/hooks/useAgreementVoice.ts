import { useCallback, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';
import { AccessibilityInfo, AppState } from 'react-native';
import { useFocusEffect } from 'expo-router';
import type { PorukaProjekcija } from '../contracts/projections';
import { agreementVoiceClientService } from '../data/agreementVoiceClientService';
import { agreementVoiceJournal } from '../data/agreementPhotoJournal';
import { createVoiceMessageComposer, type VoiceComposerSnapshot } from '../features/voiceMessages/voiceMessageComposer';
import { createVoiceMessagePlayback, type VoicePlaybackSnapshot } from '../features/voiceMessages/voiceMessagePlayback';
import { nativeVoiceFiles } from '../features/voiceMessages/nativeVoiceFiles';
import { createNativeVoiceRecorder, createNativeVoicePlayer } from '../features/voiceMessages/nativeAudioAdapters';
import { sharedAudioArbiter } from '../features/voiceMessages/audioArbiter';
import { noviUuidZahtevId } from '../lib/idempotencija';
import { sesijaSada } from '../store/sesija';
import { useAgreementVoiceOutbox } from './useAgreementOutbox';

export type AgreementVoiceScope = Readonly<{
  accountId: string; accountRevision: number; agreementId: string; version: number;
  isCurrent(): boolean;
}>;
type Options = AgreementVoiceScope & {
  writable: boolean; canRecord: boolean; messages: readonly PorukaProjekcija[]; historyError: boolean;
  refresh(): Promise<void>;
};
const EMPTY_RECORDING: VoiceComposerSnapshot = Object.freeze({ phase: 'idle', elapsedMs: 0, durationMs: null,
  preview: 'idle', previewMs: 0, level: null, error: null, canRecord: false, canSend: false,
  canDiscard: false, canRetry: false, recovered: [], unresolved: [], recoveryBusy: false });
const EMPTY_PLAYBACK: VoicePlaybackSnapshot = Object.freeze({ assetId: null, status: 'idle', positionMs: 0, durationMs: 0, error: null });
const noSubscribe = () => () => {};
type Runtime = { composer: ReturnType<typeof createVoiceMessageComposer>; playback: ReturnType<typeof createVoiceMessagePlayback>; retire(): void; current(): boolean };
type Hold = { runtime: Runtime; cancelled: boolean; completed: boolean; review: boolean; stopping: Promise<void> | null; explicitStop: boolean };

/** Mounted only in an admitted Android voice-enabled thread. Leaving Poruke unmounts it, even though the route remains. */
export function useAgreementVoice(options: Options) {
  const latest = useRef(options); latest.current = options;
  const owns = () => sesijaSada().user?.id === latest.current.accountId
    && sesijaSada().accountRevision === latest.current.accountRevision && latest.current.isCurrent()
    && AppState.currentState === 'active';
  const { model: outbox, state: outboxState } = useAgreementVoiceOutbox(options.accountId, options.agreementId, options.writable);
  const [runtime, setRuntime] = useState<Runtime | null>(null);
  const [interactionError, setInteractionError] = useState<string | null>(null);
  const active = useRef<Runtime | null>(null);
  const hold = useRef<Hold | null>(null);
  const admissionChanged = useRef<() => void>(() => {});
  const cancelHold = () => { if (hold.current) hold.current.cancelled = true; hold.current = null; };
  // Until accessibility resolves, use explicit review rather than assuming release should send.
  const [screenReader, setScreenReader] = useState(true);
  const [reviewFirst, setReviewFirst] = useState(false);
  const review = screenReader || reviewFirst;
  const reviewRef = useRef(review); reviewRef.current = review;
  useEffect(() => {
    let mounted = true;
    void AccessibilityInfo.isScreenReaderEnabled().then(value => { if (mounted) setScreenReader(value); }).catch(() => {});
    const sub = AccessibilityInfo.addEventListener('screenReaderChanged', setScreenReader);
    return () => { mounted = false; sub.remove(); };
  }, []);

  useFocusEffect(useCallback(() => {
    let focused = true;
    const accountId = options.accountId, accountRevision = options.accountRevision, agreementId = options.agreementId, version = options.version;
    function retire() {
      cancelHold();
      const previous = active.current; active.current = null;
      previous?.retire();
      setRuntime(null);
    }
    function enter() {
      if (!focused || AppState.currentState !== 'active' || !owns()) { retire(); return; }
      retire();
      let admitted = true;
      let next: Runtime | null = null;
      const current = () => admitted && focused && next !== null && active.current === next && owns()
        && latest.current.accountId === accountId && latest.current.accountRevision === accountRevision
        && latest.current.agreementId === agreementId && latest.current.version === version;
      const composer = createVoiceMessageComposer({ accountId, accountRevision, agreementId, isCurrent: current,
        agreement: () => ({ version: latest.current.version, writable: latest.current.writable && latest.current.canRecord && outbox.getSnapshot().phase === 'ready' }),
        recorder: createNativeVoiceRecorder(), player: createNativeVoicePlayer(), files: nativeVoiceFiles,
        arbiter: sharedAudioArbiter, uploads: agreementVoiceClientService, journal: agreementVoiceJournal, outbox,
        newRequestId: noviUuidZahtevId });
      const playback = createVoiceMessagePlayback({ accountId, accountRevision, isCurrent: current,
        service: agreementVoiceClientService, player: createNativeVoicePlayer(), files: nativeVoiceFiles, arbiter: sharedAudioArbiter });
      next = { composer, playback, current, retire() {
        admitted = false;
        void composer.dispose().catch(() => {});
        void playback.dispose().catch(() => {});
      } };
      active.current = next; composer.refresh(); setInteractionError(null); setRuntime(next);
    }
    admissionChanged.current = enter;
    enter();
    let foreground = AppState.currentState === 'active';
    const app = AppState.addEventListener('change', state => {
      const nextForeground = state === 'active';
      // Repeating active must not dispose an in-progress hold or its recorder ownership.
      if (nextForeground && foreground) return;
      foreground = nextForeground;
      if (nextForeground) enter(); else retire();
    });
    return () => { focused = false; admissionChanged.current = () => {}; app.remove(); retire(); };
  }, [options.accountId, options.accountRevision, options.agreementId, options.version, outbox]));
  const admitted = options.isCurrent();
  useLayoutEffect(() => { admissionChanged.current(); }, [admitted, options.version]);

  const recording = useSyncExternalStore(runtime?.composer.subscribe ?? noSubscribe,
    runtime?.composer.getSnapshot ?? (() => EMPTY_RECORDING), () => EMPTY_RECORDING);
  const playback = useSyncExternalStore(runtime?.playback.subscribe ?? noSubscribe,
    runtime?.playback.getSnapshot ?? (() => EMPTY_PLAYBACK), () => EMPTY_PLAYBACK);
  useEffect(() => {
    if (runtime?.current() && outboxState.phase === 'ready') void runtime.composer.restore().catch(() => {});
  }, [runtime, outboxState.phase]);
  useEffect(() => {
    if (!runtime?.current()) return;
    runtime.composer.refresh();
    if (!options.writable || !options.canRecord) {
      cancelHold();
      const phase = runtime.composer.getSnapshot().phase;
      if (phase === 'requesting' || phase === 'recording') void runtime.composer.discard().catch(() => {});
    }
  }, [runtime, options.writable, options.canRecord, options.version, outboxState]);
  useEffect(() => {
    if (options.historyError || !owns()) return;
    void outbox.reconcile(options.messages.filter(message => message.glas && message.clientMessageId && message.posiljalacAccountId)
      .map(message => ({ senderAccountId: message.posiljalacAccountId!, clientMessageId: message.clientMessageId!, messageId: message.id,
        body: message.telo, voice: { agreementVersion: message.dogovorVerzija!, assetId: message.glas!.assetId } })));
  }, [outbox, options.messages, options.historyError, outboxState.phase]);

  async function begin() {
    const owner = active.current;
    if (!owner?.current() || !owner.composer.getSnapshot().canRecord || hold.current) return;
    hold.current = { runtime: owner, cancelled: false, completed: false, review: reviewRef.current, stopping: null, explicitStop: false };
    setInteractionError(null);
    try { await owner.composer.start(); }
    catch { if (owner.current()) setInteractionError('Mikrofon nije spreman. Pokušajte ponovo.'); }
  }
  function finishHold(gesture: Hold): Promise<void> {
    if (gesture.stopping) return gesture.stopping;
    const owner = gesture.runtime;
    if (!owner.current()) { gesture.cancelled = true; owner.retire(); return Promise.resolve(); }
    const phase = owner.composer.getSnapshot().phase;
    if (phase === 'requesting') { gesture.cancelled = true; gesture.stopping = owner.composer.discard(); }
    else if (phase === 'recording') { gesture.explicitStop = true; gesture.stopping = owner.composer.stop(); }
    else gesture.stopping = Promise.resolve();
    return gesture.stopping;
  }
  async function endHold() {
    const gesture = hold.current;
    if (!gesture) return;
    try { await finishHold(gesture); }
    catch { gesture.cancelled = true; if (gesture.runtime.current()) setInteractionError('Snimanje nije zaustavljeno. Izaberite Odustani.'); }
    finally {
      // Responder termination may emit press-out without touch-cancel. A later tap must never inherit its send authority.
      if (!gesture.completed && hold.current === gesture) { gesture.cancelled = true; hold.current = null; }
    }
  }
  async function release() {
    const gesture = hold.current;
    if (!gesture || gesture.completed) return;
    gesture.completed = true;
    const owner = gesture.runtime;
    try {
      await finishHold(gesture);
      const result = owner.composer.getSnapshot();
      if (!gesture.cancelled && gesture.explicitStop && !gesture.review && !reviewRef.current && owner.current()
        && result.phase === 'review' && !result.error) {
        await owner.composer.send();
        if (owner.current()) await latest.current.refresh();
      }
    } catch { if (owner.current()) setInteractionError('Snimak nije poslat. Proverite stanje snimanja.'); }
    finally { if (hold.current === gesture) hold.current = null; }
  }
  const run = async (work: (owner: Runtime) => Promise<void>) => {
    const owner = active.current;
    if (!owner?.current()) return;
    setInteractionError(null);
    try { await work(owner); }
    catch { if (owner.current()) setInteractionError('Promena snimka nije potvrđena. Pokušajte ponovo.'); }
  };
  const settle = async (work: (owner: Runtime) => Promise<void>) => run(async owner => {
    await work(owner); if (owner.current()) await latest.current.refresh();
  });
  return { recording, playback, outbox, outboxState, review, reviewFirst, screenReader, setReviewFirst, interactionError,
    begin, endHold, release,
    cancel: () => { cancelHold(); return run(owner => owner.composer.discard()); },
    preview: () => run(owner => owner.composer.togglePreview()),
    send: () => settle(owner => owner.composer.send()), retry: () => settle(owner => owner.composer.retry()),
    refreshRecovery: () => run(owner => owner.composer.restore()),
    sendRecovered: (ref: Parameters<Runtime['composer']['sendRecovered']>[0]) => settle(owner => owner.composer.sendRecovered(ref)),
    discardRecovered: (ref: Parameters<Runtime['composer']['discardRecovered']>[0]) => run(owner => owner.composer.discardRecovered(ref)),
    cancelUnresolved: (ref: Parameters<Runtime['composer']['cancelUnresolved']>[0]) => run(owner => owner.composer.cancelUnresolved(ref)),
    toggle: (message: PorukaProjekcija) => run(owner => message.glas ? owner.playback.toggle({
      agreementId: options.agreementId, assetId: message.glas.assetId, messageId: message.id, durationMs: message.glas.trajanjeMs }) : Promise.resolve()),
  };
}
export type AgreementVoiceController = ReturnType<typeof useAgreementVoice>;
