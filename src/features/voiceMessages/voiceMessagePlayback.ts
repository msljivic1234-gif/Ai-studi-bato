import type { Ishod } from '../../data/ports';
import type { AgreementVoicePlayback } from '../../data/agreementVoiceClientService';
import type { ReceiptAccount } from '../../data/serverReceipt';
import type { AudioArbiter, AudioLease, VoiceFilePort, VoicePlayerPort } from './ports';
import { VOICE_ERROR_COPY, type VoiceErrorCode } from './voiceCopy';

/**
 * Playback of ONE voice message at a time, for the whole conversation screen. The bytes are fetched through the authenticated read (the server
 * authorizes the exact message twice), written to ONE temporary file and played from it; the file is removed when playback stops, ends, is replaced, the
 * screen loses focus or the account changes. Nothing is cached across those moments and no URL ever exists.
 */
export type VoicePlaybackTarget = Readonly<{ agreementId: string; assetId: string; messageId?: string; durationMs: number }>;
export type VoicePlaybackStatus = 'idle' | 'loading' | 'playing' | 'paused' | 'error';
export type VoicePlaybackSnapshot = Readonly<{
  /** The message that owns the speaker now (loading, playing, paused or failed), else null. */
  assetId: string | null;
  status: VoicePlaybackStatus;
  positionMs: number;
  durationMs: number;
  error: Readonly<{ code: VoiceErrorCode; message: string }> | null;
}>;
export type VoicePlaybackOptions = Readonly<{
  accountId: string; accountRevision: number;
  isCurrent(): boolean;
  service: Readonly<{ playback(input: Readonly<{ agreementId: string; assetId: string; messageId?: string }>, scope?: ReceiptAccount, signal?: AbortSignal): Promise<Ishod<AgreementVoicePlayback>> }>;
  player: VoicePlayerPort; files: VoiceFilePort; arbiter: AudioArbiter;
}>;

const IDLE: VoicePlaybackSnapshot = Object.freeze({ assetId: null, status: 'idle', positionMs: 0, durationMs: 0, error: null });
let playbackInstance = 0;

export function createVoiceMessagePlayback(options: VoicePlaybackOptions) {
  const instance = ++playbackInstance;
  const scope: ReceiptAccount = { accountId: options.accountId, accountRevision: options.accountRevision };
  const listeners = new Set<() => void>();
  let snapshot: VoicePlaybackSnapshot = IDLE;
  let generation = 0, current: { target: VoicePlaybackTarget; token: object } | null = null;
  let tempUri: string | null = null, unsubscribe: (() => void) | null = null, releaseClaim: AudioLease | null = null, abort: AbortController | null = null;
  let tearingDown: Promise<void> | null = null;
  const publish = (next: VoicePlaybackSnapshot) => { snapshot = Object.freeze(next); for (const listener of [...listeners]) { try { listener(); } catch { /* a screen's failure never stops playback */ } } };
  const alive = (token: object, g: number) => current?.token === token && g === generation && options.isCurrent();
  const failure = (target: VoicePlaybackTarget, code: VoiceErrorCode): VoicePlaybackSnapshot =>
    ({ assetId: target.assetId, status: 'error', positionMs: 0, durationMs: target.durationMs, error: { code, message: VOICE_ERROR_COPY[code] } });

  /** Stops whatever plays, frees the native player, removes the temporary file and forgets the target. Idempotent. */
  function teardown(): Promise<void> {
    if (tearingDown) return tearingDown;
    const file = tempUri, lease = releaseClaim;
    abort?.abort(); abort = null;
    if (unsubscribe) { unsubscribe(); unsubscribe = null; }
    current = null;
    const task = (async () => {
      // Keep ownership if native cleanup fails; another audio owner must not start over it.
      await options.player.stop();
      await options.player.release();
      lease?.(); if (releaseClaim === lease) releaseClaim = null;
      if (tempUri === file) tempUri = null;
      if (file) { try { await options.files.remove(file); } catch { /* the logout purge removes leftovers */ } }
    })();
    tearingDown = task;
    void task.finally(() => { if (tearingDown === task) tearingDown = null; }).catch(() => undefined);
    return task;
  }
  async function stop() { const g = ++generation; await teardown(); if (generation === g) publish(IDLE); }

  async function toggle(target: VoicePlaybackTarget): Promise<void> {
    if (!options.isCurrent()) return;
    const same = current?.target.assetId === target.assetId && (current.target.messageId ?? null) === (target.messageId ?? null);
    if (same && snapshot.status === 'playing') { try { await options.player.pause(); } catch { /* status follows */ } return; }
    if (same && snapshot.status === 'paused' && releaseClaim?.isCurrent()) {
      const mine = current!, g = generation;
      try { await options.player.play(); } catch {
        if (alive(mine.token, g)) {
          const stoppedAt = generation + 1;
          try { await stop(); } catch { /* retain unsafe lease */ }
          if (generation === stoppedAt && options.isCurrent()) publish(failure(target, 'PLAYBACK_FAILED'));
        }
      }
      return;
    }
    if (same && snapshot.status === 'loading') return;
    // A different message, or a retry after a failure: the previous one is torn down first, then this one takes the speaker.
    generation += 1; const g = generation, token = {};
    try {
      await teardown();
      if (generation !== g || !options.isCurrent()) return;
      current = { target, token };
      publish({ assetId: target.assetId, status: 'loading', positionMs: 0, durationMs: target.durationMs, error: null });
      const lease = await options.arbiter.claim('playback', () => stop());
      if (!alive(token, g) || !lease.isCurrent()) { lease(); return; }
      releaseClaim = lease;
      const requestAbort = new AbortController(); abort = requestAbort;
      const result = await options.service.playback({ agreementId: target.agreementId, assetId: target.assetId, ...(target.messageId ? { messageId: target.messageId } : {}) }, scope, requestAbort.signal);
      if (abort === requestAbort) abort = null;
      if (!alive(token, g) || !lease.isCurrent()) return;
      if (!result.ok) { publish(failure(target, result.kod === 'MEDIA_NOT_FOUND' || result.kod === 'MEDIA_UNAVAILABLE' ? 'PLAYBACK_UNAVAILABLE' : 'PLAYBACK_FAILED')); await teardown(); return; }
      const uri = await options.files.writeTemp(`voice-${target.assetId}-${instance}-${g}.m4a`, result.podatak.bytes);
      if (!alive(token, g)) { try { await options.files.remove(uri); } catch { /* purged later */ } return; }
      tempUri = uri;
      await options.player.load(uri);
      if (!alive(token, g) || !lease.isCurrent()) return;
      unsubscribe = options.player.onStatus(status => {
        if (!alive(token, g) || !lease.isCurrent()) return;
        if (status.ended) {
          const stoppedAt = generation + 1;
          void (async () => { if (!alive(token, g)) return; await stop(); })().catch(() => {
            if (generation === stoppedAt && options.isCurrent()) publish(failure(target, 'PLAYBACK_FAILED'));
          }); return;
        }
        publish({ assetId: target.assetId, status: status.playing ? 'playing' : 'paused', positionMs: Math.max(0, Math.round(status.positionMs)),
          // The stored length is the one the message row already shows; the player's own figure only fills in when that is unknown.
          durationMs: target.durationMs > 0 ? target.durationMs : Math.max(0, Math.round(status.durationMs ?? 0)), error: null });
      });
      await options.player.play();
      if (alive(token, g) && snapshot.status === 'loading') publish({ ...snapshot, status: 'playing' });
    } catch {
      if (generation === g && options.isCurrent()) {
        publish(failure(target, 'PLAYBACK_FAILED'));
        try { await teardown(); } catch { /* retain unsafe lease; later cleanup can retry */ }
      }
    }
  }

  return {
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    getSnapshot: () => snapshot,
    toggle, stop,
    /** The screen lost focus, the account changed or the conversation closed: everything is released. */
    async dispose() { listeners.clear(); await stop(); },
  };
}
export type VoiceMessagePlayback = ReturnType<typeof createVoiceMessagePlayback>;
