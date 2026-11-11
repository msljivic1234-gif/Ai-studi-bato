import type { Ishod } from '../../data/ports';
import type { AgreementUploadRef } from '../../data/agreementPhotoClientService';
import type { AgreementVoiceUpload } from '../../data/agreementVoiceClientService';
import type { ReceiptAccount } from '../../data/serverReceipt';
import type { AudioArbiter, AudioLease, InterruptReason, RecordedFile, VoiceFilePort, VoicePlayerPort, VoiceRecorderPort } from './ports';
import { VOICE_ERROR_COPY, type VoiceErrorCode } from './voiceCopy';

/**
 * Voice message, from the microphone to the conversation: record -> review (listen, delete) -> send -> sending -> sent, with failed/retry on the way.
 * Plain TypeScript against `ports.ts`; the screen only reads `getSnapshot()` and calls the verbs. The recording stays in a private cache file until the
 * server has stored it; the upload uses ONE client key per recording, so a retry can never produce a second message; the durable outbox (its own voice
 * journal) owns everything after the asset is READY. Nothing here decides how it looks.
 */
export const VOICE_MAX_DURATION_MS = 300_000;
export const VOICE_MIN_DURATION_MS = 300;
export const VOICE_MIN_BYTES = 32;
export const VOICE_MAX_BYTES = 4_194_304;
const TICK_MS = 250;

export type VoiceComposerPhase = 'idle' | 'requesting' | 'recording' | 'review' | 'uploading' | 'failed';
export type VoiceComposerError = Readonly<{ code: string; message: string }>;
export type RecoveredRecording = Readonly<{ ref: AgreementUploadRef; assetId: string; durationMs: number }>;
/** A previously journaled request whose server outcome is not yet terminal; no audio bytes or private message are cached. */
export type UnresolvedRecording = Readonly<{ ref: AgreementUploadRef; state: 'ABSENT' | 'PROCESSING' | 'STAGED' | 'UNKNOWN' }>;
export type VoiceComposerSnapshot = Readonly<{
  phase: VoiceComposerPhase;
  /** Milliseconds recorded so far while recording. */
  elapsedMs: number;
  /** The finished recording's real length (review, uploading, failed), else null. */
  durationMs: number | null;
  preview: 'idle' | 'playing' | 'paused';
  previewMs: number;
  /** A 0..1 input level while recording, where the platform gives one. */
  level: number | null;
  error: VoiceComposerError | null;
  canRecord: boolean;
  canSend: boolean;
  canDiscard: boolean;
  canRetry: boolean;
  /** Recordings the server holds READY that no message carries (an app restart between the upload and the send). Sending or deleting is explicit. */
  recovered: readonly RecoveredRecording[];
  /** Unknown and in-progress upload identities remain visible until an authoritative read or cancellation settles them. */
  unresolved: readonly UnresolvedRecording[];
  recoveryBusy: boolean;
}>;

type Outbox = Readonly<{
  sendVoice(voice: Readonly<{ agreementVersion: number; assetId: string }>): Promise<void>;
  getSnapshot(): Readonly<{ capturing: boolean; error: string | null; entries: readonly Readonly<{ command: Readonly<{ voice?: Readonly<{ assetId: string }> }> }>[] }>;
}>;
type Journal = Readonly<{
  load(accountId: string, agreementId: string): Promise<AgreementUploadRef[]>;
  save(accountId: string, ref: AgreementUploadRef, current: () => boolean): Promise<unknown>;
  clear(accountId: string, ref: AgreementUploadRef, current: () => boolean): Promise<unknown>;
}>;
type Uploads = Readonly<{
  upload(ref: AgreementUploadRef, bytes: ArrayBuffer, scope?: ReceiptAccount, signal?: AbortSignal): Promise<Ishod<AgreementVoiceUpload>>;
  read(ref: AgreementUploadRef, scope?: ReceiptAccount, signal?: AbortSignal): Promise<Ishod<AgreementVoiceUpload>>;
  cancel(ref: AgreementUploadRef, scope?: ReceiptAccount, signal?: AbortSignal): Promise<Ishod<AgreementVoiceUpload>>;
}>;
export type VoiceComposerOptions = Readonly<{
  accountId: string; accountRevision: number; agreementId: string;
  /** The account/session incarnation and the focused screen are still the ones that started this model. */
  isCurrent(): boolean;
  /** The live Agreement: the version the message is for (null while unknown) and whether new messages are allowed at all. */
  agreement(): Readonly<{ version: number | null; writable: boolean }>;
  recorder: VoiceRecorderPort; player: VoicePlayerPort; files: VoiceFilePort; arbiter: AudioArbiter;
  uploads: Uploads; journal: Journal; outbox: Outbox;
  newRequestId(): string;
  now?(): number;
  timers?: Readonly<{ setInterval(handler: () => void, ms: number): unknown; clearInterval(handle: unknown): void }>;
}>;

const error = (code: VoiceErrorCode | string, message?: string): VoiceComposerError =>
  ({ code, message: message ?? VOICE_ERROR_COPY[code as VoiceErrorCode] ?? VOICE_ERROR_COPY.OUTCOME_UNKNOWN });

export function createVoiceMessageComposer(options: VoiceComposerOptions) {
  const now = options.now ?? (() => Date.now());
  const timers = options.timers ?? { setInterval: (h: () => void, ms: number) => setInterval(h, ms), clearInterval: (h: unknown) => clearInterval(h as ReturnType<typeof setInterval>) };
  const scope: ReceiptAccount = { accountId: options.accountId, accountRevision: options.accountRevision };
  // One mounted owner cancels upload, readback and explicit cancellation alike. Server outcomes remain journaled until reconciled.
  const requestAbort = new AbortController();
  const listeners = new Set<() => void>();
  let generation = 0;
  let phase: VoiceComposerPhase = 'idle';
  let elapsedMs = 0, level: number | null = null, startedAt = 0;
  let recorded: RecordedFile | null = null;
  let failure: VoiceComposerError | null = null;
  let preview: 'idle' | 'playing' | 'paused' = 'idle', previewMs = 0, previewLoaded = false;
  let recovered: readonly RecoveredRecording[] = [];
  let unresolved: readonly UnresolvedRecording[] = [];
  let checkingRecovery = false;
  // The recording being delivered: its client key, whether any upload was attempted, and the READY asset once there is one.
  let pending: { ref: AgreementUploadRef; attempted: boolean; assetId: string | null } | null = null;
  let ticker: unknown = null, unsubscribeRecorder: Array<() => void> = [], unsubscribePlayer: (() => void) | null = null;
  let releaseRecordingClaim: AudioLease | null = null, releasePreviewClaim: AudioLease | null = null;
  let starting = false, finishing: Promise<void> | null = null, previewBusy = false, previewGeneration = 0;
  let previewStopping: Promise<void> | null = null;
  let working = false;
  let snapshot!: VoiceComposerSnapshot;

  const alive = (g: number) => g === generation && !requestAbort.signal.aborted && options.isCurrent();
  const agreementNow = () => { try { return options.agreement(); } catch { return { version: null, writable: false }; } };
  const outboxBusy = () => { try { return options.outbox.getSnapshot().capturing; } catch { return true; } };
  const build = (): VoiceComposerSnapshot => {
    const live = agreementNow();
    const allowed = options.isCurrent() && live.writable && live.version !== null && !outboxBusy() && !finishing && !checkingRecovery;
    return Object.freeze({ phase, elapsedMs, durationMs: recorded?.durationMs ?? null, preview, previewMs, level, error: failure,
      canRecord: phase === 'idle' && allowed && !starting && !working && !releaseRecordingClaim, canSend: (phase === 'review') && allowed && !working,
      canDiscard: !working && !finishing && (phase === 'recording' || phase === 'review' || phase === 'failed'), canRetry: phase === 'failed' && allowed && !working && pending !== null, recovered, unresolved, recoveryBusy: checkingRecovery || working });
  };
  snapshot = build();
  const publish = () => { snapshot = build(); for (const listener of [...listeners]) { try { listener(); } catch { /* a screen's own failure never stops the model */ } } };
  const fail = (value: VoiceComposerError | null) => { failure = value; };

  function stopTicker() { if (ticker !== null) { timers.clearInterval(ticker); ticker = null; } }
  function unsubscribeRecording() { for (const off of unsubscribeRecorder.splice(0)) { try { off(); } catch { /* idempotent */ } } level = null; }
  async function dropFile() {
    const file = recorded; recorded = null;
    if (file) { try { await options.files.remove(file.uri); } catch { /* a leftover cache file is removed by the next purge */ } }
  }
  function stopPreview(): Promise<void> {
    previewGeneration += 1;
    if (previewStopping) return previewStopping;
    if (unsubscribePlayer) { unsubscribePlayer(); unsubscribePlayer = null; }
    const lease = releasePreviewClaim;
    const was = previewLoaded || previewBusy || !!lease; previewLoaded = false;
    preview = 'idle'; previewMs = 0;
    const task = (async () => {
      if (was) { await options.player.stop(); await options.player.release(); }
      lease?.(); if (releasePreviewClaim === lease) releasePreviewClaim = null;
    })();
    previewStopping = task;
    void task.finally(() => { if (previewStopping === task) previewStopping = null; }).catch(() => undefined);
    return task;
  }

  function finishRecording(g: number, reason: 'stopped' | 'interrupted' | 'maximum'): Promise<void> {
    if (finishing) return finishing;
    const task = finishRecordingOnce(g, reason);
    finishing = task;
    void task.finally(() => { if (finishing === task) finishing = null; if (alive(g)) publish(); }).catch(() => undefined);
    return task;
  }
  async function finishRecordingOnce(g: number, reason: 'stopped' | 'interrupted' | 'maximum') {
    stopTicker(); unsubscribeRecording();
    const lease = releaseRecordingClaim;
    let file: RecordedFile;
    try { file = await options.recorder.stop(); } catch {
      // A failed stop is not proof that the microphone is free. Cancellation must finish before another owner may enter.
      await options.recorder.cancel();
      lease?.(); if (releaseRecordingClaim === lease) releaseRecordingClaim = null;
      if (!alive(g)) return;
      phase = 'idle'; fail(error('RECORDING_FAILED')); publish(); return;
    }
    lease?.(); if (releaseRecordingClaim === lease) releaseRecordingClaim = null;
    if (!alive(g)) { try { await options.files.remove(file.uri); } catch { /* purged later */ } return; }
    if (!Number.isFinite(file.durationMs) || file.durationMs < VOICE_MIN_DURATION_MS) {
      try { await options.files.remove(file.uri); } catch { /* purged later */ }
      phase = 'idle'; fail(error(reason === 'interrupted' ? 'RECORDING_INTERRUPTED' : 'RECORDING_TOO_SHORT')); publish(); return;
    }
    recorded = { uri: file.uri, durationMs: Math.min(Math.round(file.durationMs), VOICE_MAX_DURATION_MS) };
    phase = 'review'; fail(reason === 'interrupted' ? error('RECORDING_INTERRUPTED') : null); publish();
  }
  function recordingInterrupted(_reason: InterruptReason) {
    if (phase !== 'recording') return;
    void finishRecording(generation, 'interrupted').catch(() => { fail(error('RECORDING_FAILED')); publish(); });
  }

  async function start() {
    if (phase !== 'idle' || !build().canRecord || !options.isCurrent() || starting) return;
    starting = true;
    const g = generation;
    phase = 'requesting'; fail(null); publish();
    try {
    let answer;
    try { answer = await options.recorder.requestPermission(); } catch { answer = 'unavailable' as const; }
    if (!alive(g) || phase !== 'requesting') return;
    // "Ne sada" to the question before the system's window: nothing was asked and nothing went wrong, so the composer is as it was.
    if (answer === 'later') { phase = 'idle'; publish(); return; }
    if (answer !== 'granted') {
      phase = 'idle'; fail(error(answer === 'blocked' ? 'MIC_PERMISSION_BLOCKED' : answer === 'unavailable' ? 'MIC_UNAVAILABLE' : 'MIC_PERMISSION_DENIED')); publish(); return;
    }
    const release = await options.arbiter.claim('recording', async () => {
      if (phase === 'recording') { await finishRecording(generation, 'interrupted'); return; }
      if (phase === 'requesting') {
        const lease = releaseRecordingClaim;
        generation += 1; phase = 'idle'; fail(error('RECORDING_INTERRUPTED')); publish();
        await options.recorder.cancel();
        lease?.(); if (releaseRecordingClaim === lease) releaseRecordingClaim = null;
      } else {
        const lease = releaseRecordingClaim;
        await options.recorder.cancel();
        lease?.(); if (releaseRecordingClaim === lease) releaseRecordingClaim = null;
      }
    });
    if (!alive(g) || phase !== 'requesting' || !release.isCurrent()) { release(); return; }
    releaseRecordingClaim = release;
    try { await options.recorder.start(); } catch {
      if (!release.isCurrent()) return;
      await options.recorder.cancel(); release(); if (releaseRecordingClaim === release) releaseRecordingClaim = null;
      if (!alive(g)) return;
      phase = 'idle'; fail(error('RECORDING_FAILED')); publish(); return;
    }
    if (!alive(g) || phase !== 'requesting' || !release.isCurrent()) {
      if (release.isCurrent()) { await options.recorder.cancel(); release(); }
      if (releaseRecordingClaim === release) releaseRecordingClaim = null; return;
    }
    startedAt = now(); elapsedMs = 0; phase = 'recording';
    unsubscribeRecorder = [options.recorder.onInterrupted(recordingInterrupted)];
    if (options.recorder.onLevel) unsubscribeRecorder.push(options.recorder.onLevel(value => { if (phase === 'recording') { level = Math.max(0, Math.min(1, value)); publish(); } }));
    ticker = timers.setInterval(() => {
      if (phase !== 'recording') return;
      elapsedMs = Math.max(0, now() - startedAt);
      if (elapsedMs >= VOICE_MAX_DURATION_MS) { elapsedMs = VOICE_MAX_DURATION_MS; void finishRecording(generation, 'maximum').catch(() => { fail(error('RECORDING_FAILED')); publish(); }); return; }
      publish();
    }, TICK_MS);
    publish();
    } catch { if (alive(g)) { phase = 'idle'; fail(error('RECORDING_FAILED')); publish(); } }
    finally { starting = false; if (options.isCurrent()) publish(); }
  }
  async function stop() { if (phase === 'recording') await finishRecording(generation, 'stopped'); }

  async function discard() {
    if (!options.isCurrent() || working) return;
    working = true; publish();
    const g = generation;
    try {
    if (phase === 'recording' || phase === 'requesting') {
      generation += 1; const retired = generation, lease = releaseRecordingClaim;
      stopTicker(); unsubscribeRecording();
      await options.recorder.cancel();
      lease?.(); if (releaseRecordingClaim === lease) releaseRecordingClaim = null;
      if (alive(retired)) { phase = 'idle'; fail(null); publish(); }
      return;
    }
    if (phase !== 'review' && phase !== 'failed') return;
    await stopPreview();
    if (!alive(g)) return;
    const toCancel = pending;
    // A server recording is cancelled first. If that cannot be confirmed the recording stays where it is: the next start shows it as a recovered recording,
    // never a silent send, and deleting it is one explicit tap.
    if (toCancel?.attempted) {
      const result = await options.uploads.cancel(toCancel.ref, scope, requestAbort.signal);
      if (!alive(g)) return;
      if (!result.ok || (result.podatak.state !== 'CANCELLED' && !result.podatak.attachedMessageId && result.podatak.state !== 'FAILED')) {
        fail(error('OUTCOME_UNKNOWN')); publish(); return;
      }
      try { await options.journal.clear(options.accountId, toCancel.ref, () => alive(g)); } catch { /* the next restore clears a cancelled identity */ }
    } else if (toCancel) {
      try { await options.journal.clear(options.accountId, toCancel.ref, () => alive(g)); } catch { /* the next restore clears an unused identity */ }
    }
    await dropFile(); if (!alive(g)) return;
    pending = null; phase = 'idle'; fail(null); publish();
    } catch { if (options.isCurrent()) { fail(error('OUTCOME_UNKNOWN')); publish(); } }
    finally { working = false; if (options.isCurrent()) publish(); }
  }

  async function togglePreview() {
    if (!options.isCurrent() || working || previewBusy || previewStopping || (phase !== 'review' && phase !== 'failed') || !recorded) return;
    const g = generation, p = previewGeneration, file = recorded;
    const valid = () => alive(g) && previewGeneration === p && recorded === file;
    previewBusy = true;
    try {
      if (preview === 'playing') { await options.player.pause(); return; }
      if (!previewLoaded) {
        // Another audio owner taking the speaker ends the preview; the screen must hear about it, so the snapshot is republished.
        const lease = await options.arbiter.claim('preview', async () => { await stopPreview(); publish(); });
        if (!valid() || !lease.isCurrent()) { lease(); return; }
        releasePreviewClaim = lease;
        await options.player.load(file.uri);
        if (!valid() || !lease.isCurrent()) return;
        previewLoaded = true;
        unsubscribePlayer = options.player.onStatus(status => {
          if (!previewLoaded || !valid() || !lease.isCurrent()) return;
          if (status.ended) { preview = 'idle'; previewMs = 0; void options.player.stop().catch(() => undefined); }
          else { preview = status.playing ? 'playing' : 'paused'; previewMs = Math.max(0, Math.round(status.positionMs)); }
          publish();
        });
      }
      if (!valid() || !releasePreviewClaim?.isCurrent()) return;
      await options.player.play();
    } catch { try { await stopPreview(); } catch { /* keep the lease until a successful cleanup */ } if (alive(g)) { fail(error('PLAYBACK_FAILED')); publish(); } }
    finally { previewBusy = false; }
  }

  /** Delivery: make sure the server holds the recording READY, then hand exactly that asset to the durable voice outbox. */
  async function deliver(g: number): Promise<void> {
    if (!alive(g)) return;
    const item = pending!, live = agreementNow();
    if (!live.writable) { phase = 'failed'; fail(error('NOT_AVAILABLE')); publish(); return; }
    if (item.assetId === null) {
      let ref = item.ref;
      if (item.attempted) {
        // Read first: a dispatched unknown request never allocates another key and never asserts absence.
        const read = await options.uploads.read(ref, scope, requestAbort.signal);
        if (!alive(g)) return;
        if (!read.ok) { phase = 'failed'; fail(error(read.kod === 'AUTH_ACCOUNT_CHANGED' ? read.kod : 'UPLOAD_UNCONFIRMED', read.poruka)); publish(); return; }
        const state = read.podatak.state;
        if (state === 'READY' && read.podatak.assetId) { if (read.podatak.attachedMessageId) { await finishDelivered(g, ref); return; } item.assetId = read.podatak.assetId; }
        else if (state === 'PROCESSING' || state === 'STAGED') { phase = 'failed'; fail(error('OUTCOME_UNKNOWN')); publish(); return; }
        else if (state === 'FAILED' || state === 'CANCELLED') { item.attempted = false; ref = item.ref = { ...ref, clientRequestId: options.newRequestId() }; }
      }
      if (item.assetId === null) {
        if (live.version === null) { phase = 'failed'; fail(error('NOT_AVAILABLE')); publish(); return; }
        if (!item.attempted && ref.agreementVersion !== live.version) ref = item.ref = { ...ref, agreementVersion: live.version, clientRequestId: options.newRequestId() };
        if (!recorded) { phase = 'failed'; fail(error('RECORDING_INVALID')); publish(); return; }
        await options.journal.save(options.accountId, ref, () => alive(g));
        if (!alive(g)) return;
        let bytes: ArrayBuffer;
        try { bytes = await options.files.read(recorded.uri); } catch { if (alive(g)) { phase = 'failed'; fail(error('RECORDING_INVALID')); publish(); } return; }
        if (!alive(g)) return;
        if (!(bytes instanceof ArrayBuffer) || bytes.byteLength < VOICE_MIN_BYTES || bytes.byteLength > VOICE_MAX_BYTES) {
          phase = 'failed'; fail(error('RECORDING_INVALID')); publish(); return;
        }
        item.attempted = true;
        const result = await options.uploads.upload(ref, bytes, scope, requestAbort.signal);
        if (!alive(g)) return;
        if (!result.ok) { phase = 'failed'; fail(error(result.kod === 'AUTH_ACCOUNT_CHANGED' ? result.kod : result.kod.startsWith('MEDIA_') || result.kod === 'INTERACTION_BLOCKED' || result.kod === 'ACCOUNT_CLOSING' ? result.kod : 'UPLOAD_UNCONFIRMED', result.poruka)); publish(); return; }
        const up = result.podatak;
        if (up.state === 'READY' && up.assetId) { if (up.attachedMessageId) { await finishDelivered(g, ref); return; } item.assetId = up.assetId; }
        else if (up.state === 'FAILED' || up.state === 'CANCELLED') { item.attempted = false; item.ref = { ...ref, clientRequestId: options.newRequestId() }; phase = 'failed'; fail(error('RECORDING_FAILED')); publish(); return; }
        else { phase = 'failed'; fail(error('OUTCOME_UNKNOWN')); publish(); return; }
      }
    }
    const assetId = item.assetId!;
    if (!alive(g) || !agreementNow().writable) return;
    await options.outbox.sendVoice({ agreementVersion: item.ref.agreementVersion, assetId });
    if (!alive(g)) return;
    let stored = false;
    try { stored = options.outbox.getSnapshot().entries.some(entry => entry.command.voice?.assetId === assetId); } catch { stored = false; }
    if (!stored) { phase = 'failed'; fail(error('SEND_NOT_STORED')); publish(); return; }
    await finishDelivered(g, item.ref);
  }
  async function finishDelivered(g: number, _ref: AgreementUploadRef) {
    // The outbox now owns the message; the journal identity stays until the next read sees the message attached, then it is cleared.
    await stopPreview(); await dropFile(); pending = null;
    if (!alive(g)) return;
    phase = 'idle'; fail(null); publish();
  }
  async function send() {
    if (phase !== 'review' || working || !build().canSend || !recorded) return;
    const g = generation, live = agreementNow();
    working = true;
    try {
      await stopPreview();
      if (!alive(g)) return;
      pending = pending ?? { ref: { agreementId: options.agreementId, agreementVersion: live.version!, clientRequestId: options.newRequestId() }, attempted: false, assetId: null };
      phase = 'uploading'; fail(null); publish();
      await deliver(g);
    }
    catch { if (alive(g)) { phase = 'failed'; fail(error('UPLOAD_UNCONFIRMED')); publish(); } }
    finally { working = false; if (alive(g)) publish(); }
  }
  async function retry() {
    if (phase !== 'failed' || working || !build().canRetry || !pending) return;
    const g = generation; working = true; phase = 'uploading'; fail(null); publish();
    try { await deliver(g); }
    catch { if (alive(g)) { phase = 'failed'; fail(error('UPLOAD_UNCONFIRMED')); publish(); } }
    finally { working = false; if (alive(g)) publish(); }
  }

  /** A persisted upload attempt is never erased because one read said ABSENT.
   * The network and upload worker can still finish later. Only a confirmed terminal
   * state or attached message retires that key; all others remain visible for
   * explicit readback/cancellation. No automatic send or server cancellation. */
  async function restore() {
    const g = generation;
    if (!options.isCurrent() || checkingRecovery || working) return;
    checkingRecovery = true; publish();
    try {
      let refs: AgreementUploadRef[];
      try { refs = await options.journal.load(options.accountId, options.agreementId); }
      catch { if (alive(g)) fail(error('OUTCOME_UNKNOWN')); return; }
      if (!alive(g)) return;
      const reserved = new Set<string>();
      try { for (const entry of options.outbox.getSnapshot().entries) if (entry.command.voice) reserved.add(entry.command.voice.assetId); }
      catch {
        // Never offer an asset for a second send when the active outbox cannot tell us whether it already owns it.
        if (alive(g)) {
          recovered = [];
          unresolved = refs.filter(ref => !pending || pending.ref.clientRequestId !== ref.clientRequestId)
            .map(ref => ({ ref, state: 'UNKNOWN' as const }));
          fail(error('OUTCOME_UNKNOWN')); publish();
        }
        return;
      }
      const found: RecoveredRecording[] = [], waiting: UnresolvedRecording[] = [];
      for (const ref of refs) {
        if (pending && pending.ref.clientRequestId === ref.clientRequestId) continue;
        let read: Awaited<ReturnType<Uploads['read']>> | null = null;
        try { read = await options.uploads.read(ref, scope, requestAbort.signal); } catch { /* retain the identity */ }
        if (!alive(g)) return;
        if (!read?.ok) { waiting.push({ ref, state: 'UNKNOWN' }); continue; }
        const up = read.podatak;
        if (up.attachedMessageId || up.state === 'FAILED' || up.state === 'CANCELLED') {
          try { await options.journal.clear(options.accountId, ref, () => alive(g)); }
          catch { waiting.push({ ref, state: 'UNKNOWN' }); }
          if (!alive(g)) return;
          continue;
        }
        if (up.state === 'READY' && up.assetId && up.voice) {
          if (!reserved.has(up.assetId)) found.push({ ref, assetId: up.assetId, durationMs: up.voice.durationMs });
          continue;
        }
        // ABSENT/PROCESSING/STAGED are not evidence that a dispatched attempt is safely gone.
        waiting.push({ ref, state: up.state === 'ABSENT' || up.state === 'PROCESSING' || up.state === 'STAGED' ? up.state : 'UNKNOWN' });
      }
      if (!alive(g)) return;
      recovered = found; unresolved = waiting; publish();
    } finally { checkingRecovery = false; if (alive(g)) publish(); }
  }
  /** Explicit user cancellation only, never on mount or background restore. */
  async function cancelUnresolved(ref: AgreementUploadRef) {
    const g = generation;
    const item = unresolved.find(entry => entry.ref.clientRequestId === ref.clientRequestId
      && entry.ref.agreementId === ref.agreementId && entry.ref.agreementVersion === ref.agreementVersion);
    if (!item || !options.isCurrent() || working || checkingRecovery) return;
    working = true; publish();
    try {
      const response = await options.uploads.cancel(item.ref, scope, requestAbort.signal);
      if (!alive(g)) return;
      const up = response.ok ? response.podatak : null;
      if (!up || (!up.attachedMessageId && up.state !== 'CANCELLED' && up.state !== 'FAILED')) {
        fail(error('OUTCOME_UNKNOWN')); return;
      }
      await options.journal.clear(options.accountId, item.ref, () => alive(g));
      if (!alive(g)) return;
      unresolved = unresolved.filter(entry => entry.ref.clientRequestId !== item.ref.clientRequestId);
      fail(null);
    } catch { if (alive(g)) fail(error('OUTCOME_UNKNOWN')); }
    finally { working = false; if (alive(g)) publish(); }
  }
  /** Another owner can capture a recovered READY asset while its recovery row is still visible.
   * Its outbox command owns all retries from that moment. Never create a second
   * client message ID or cancel the already-captured upload. */
  function retireRecoveredIfOutboxed(item: RecoveredRecording): boolean {
    const reserved = options.outbox.getSnapshot().entries.some(entry => entry.command.voice?.assetId === item.assetId);
    if (!reserved) return false;
    recovered = recovered.filter(entry => entry.ref.clientRequestId !== item.ref.clientRequestId);
    fail(null);
    return true;
  }
  async function sendRecovered(ref: AgreementUploadRef) {
    const g = generation, item = recovered.find(entry => entry.ref.clientRequestId === ref.clientRequestId);
    if (!item || !options.isCurrent() || working || checkingRecovery || !agreementNow().writable || outboxBusy()) return;
    working = true; publish();
    try {
      if (retireRecoveredIfOutboxed(item)) return;
      await options.outbox.sendVoice({ agreementVersion: item.ref.agreementVersion, assetId: item.assetId });
      if (!alive(g)) return;
      const stored = options.outbox.getSnapshot().entries.some(entry => entry.command.voice?.assetId === item.assetId);
      if (stored) recovered = recovered.filter(entry => entry.ref.clientRequestId !== ref.clientRequestId);
      else fail(error('SEND_NOT_STORED'));
    } catch { if (alive(g)) fail(error('SEND_NOT_STORED')); }
    finally { working = false; if (alive(g)) publish(); }
  }
  async function discardRecovered(ref: AgreementUploadRef) {
    const g = generation, item = recovered.find(entry => entry.ref.clientRequestId === ref.clientRequestId);
    if (!item || !options.isCurrent() || working || checkingRecovery) return;
    working = true; publish();
    try {
      if (retireRecoveredIfOutboxed(item)) return;
      const result = await options.uploads.cancel(item.ref, scope, requestAbort.signal);
      if (!alive(g)) return;
      if (!result.ok || (!result.podatak.attachedMessageId && result.podatak.state !== 'CANCELLED' && result.podatak.state !== 'FAILED')) {
        fail(error('OUTCOME_UNKNOWN')); return;
      }
      try { await options.journal.clear(options.accountId, item.ref, () => alive(g)); } catch { /* cleared on the next focus */ }
      recovered = recovered.filter(entry => entry.ref.clientRequestId !== ref.clientRequestId);
    } catch { if (alive(g)) fail(error('OUTCOME_UNKNOWN')); }
    finally { working = false; if (alive(g)) publish(); }
  }

  /** The screen lost focus, the account changed or the Agreement closed: the microphone and the speaker are released at once and an unsent recording is discarded. */
  async function dispose() {
    generation += 1; const file = recorded;
    stopTicker(); unsubscribeRecording(); requestAbort.abort();
    if (phase === 'recording' || phase === 'requesting' || releaseRecordingClaim) await options.recorder.cancel();
    releaseRecordingClaim?.(); releaseRecordingClaim = null;
    await stopPreview();
    recorded = null; pending = pending; phase = 'idle'; failure = null; working = false; listeners.clear();
    if (file) { try { await options.files.remove(file.uri); } catch { /* purged on logout or the next start */ } }
  }

  return {
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    getSnapshot: () => snapshot,
    /** Re-derives the snapshot when the Agreement or the outbox changed under the model (the hook calls this on every render that changed them). */
    refresh: publish,
    start, stop, discard, togglePreview, send, retry, restore, sendRecovered, discardRecovered, cancelUnresolved, dispose,
  };
}
export type VoiceMessageComposer = ReturnType<typeof createVoiceMessageComposer>;
