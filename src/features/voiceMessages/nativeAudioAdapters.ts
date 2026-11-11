import { AppState, Platform } from 'react-native';
import { Directory, File, Paths } from 'expo-file-system';
import type { AudioPlayer, AudioRecorder, AudioStatus, RecordingOptions } from 'expo-audio';
import type { InterruptReason, PlayerStatus, VoicePlayerPort, VoiceRecorderPort } from './ports';
import { VOICE_CACHE_DIRECTORY, VOICE_FILE_MAX_BYTES, isExpoVoiceRecordingUri, registerVoiceNativeCleanup } from './nativeVoiceFiles';
import { permissionAsk } from '../../ui/permissions/permissionAsk';

// Importing a flag-off screen must not initialize ExpoAudio. Factories are called only by the enabled native seam.
type ExpoAudio = typeof import('expo-audio');
const nativeAudio = (): ExpoAudio => require('expo-audio') as ExpoAudio;
const supported = () => (Platform.OS === 'android' || Platform.OS === 'ios') && !Platform.isTV;
const foreground = () => AppState.currentState === 'active';
const MAX_MS = 300_000;
const wait = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));
function serial() {
  let tail: Promise<unknown> = Promise.resolve();
  return <T>(work: () => Promise<T>): Promise<T> => {
    const next = tail.then(work);
    // Keep the queue usable, while returning the original rejection to the caller. Native handles are retained on release failure.
    tail = next.then(() => undefined, () => undefined);
    return next;
  };
}
function localVoiceFile(uri: string): File {
  const directory = new Directory(Paths.cache, VOICE_CACHE_DIRECTORY);
  const prefix = directory.uri.endsWith('/') ? directory.uri : `${directory.uri}/`;
  if (!uri.startsWith(prefix) || !/^[A-Za-z0-9][A-Za-z0-9._-]{0,95}$/.test(uri.slice(prefix.length))) throw new Error('VOICE_FILE_PATH');
  const file = new File(uri);
  if (!file.exists || file.size <= 0 || file.size > VOICE_FILE_MAX_BYTES) throw new Error('VOICE_FILE_SIZE');
  return file;
}
async function waitForLoaded(player: AudioPlayer, current: () => boolean, requireDuration = false): Promise<AudioStatus> {
  const until = Date.now() + 10_000;
  while (current()) {
    const status = player.currentStatus;
    if (status.error) throw new Error('VOICE_PLAYER_FAILED');
    if (status.isLoaded && (!requireDuration || (Number.isFinite(status.duration) && status.duration > 0))) return status;
    if (Date.now() >= until) throw new Error('VOICE_PLAYER_LOAD_TIMEOUT');
    await wait(50);
  }
  throw new Error('VOICE_AUDIO_RETIRED');
}
const recordings = new Set<() => Promise<void>>();
/** Logout integration can await every native recording, including an unresolved prepare/stop. */
export async function cancelAllNativeVoiceRecordings(): Promise<void> {
  const results = await Promise.allSettled([...recordings].map(cancel => cancel()));
  if (results.some(result => result.status === 'rejected')) throw new Error('VOICE_RECORDING_RELEASE_FAILED');
}

/** Caller holds the shared audio-arbiter claim. This adapter never asks permission as a side effect of start(). */
export function createNativeVoiceRecorder(): VoiceRecorderPort {
  const audio = supported() ? nativeAudio() : null;
  const enqueue = serial();
  const interrupted = new Set<(reason: InterruptReason) => void>();
  const levels = new Set<(level: number) => void>();
  let epoch = 0, preparing = false, capturing = false, finishing = false, interruptionSent = false;
  let recorder: AudioRecorder | null = null, probe: AudioPlayer | null = null;
  let rawUri: string | null = null, finalUri: string | null = null;
  let nativeFailed = false, releaseFailed = false, recordingStartedAt = 0;
  let stopTask: Promise<{ uri: string; durationMs: number }> | null = null;
  let poll: ReturnType<typeof setInterval> | null = null;
  let appSubscription: ReturnType<typeof AppState.addEventListener> | null = null;
  let recorderSubscription: { remove(): void } | null = null, unregister: (() => void) | null = null;
  const options: RecordingOptions = {
    directory: 'cache', extension: '.m4a', sampleRate: 44_100, numberOfChannels: 1, bitRate: 64_000, isMeteringEnabled: true,
    android: { outputFormat: 'mpeg4', audioEncoder: 'aac', maxFileSize: VOICE_FILE_MAX_BYTES, audioSource: 'voice_recognition' },
    ios: { outputFormat: 'aac ', audioQuality: 0x40, bitRateStrategy: 0 },
    web: {}, // Web is explicitly unavailable; never substitute another codec for the M4A contract.
  };
  function stopObserving() {
    if (poll !== null) { clearInterval(poll); poll = null; }
    appSubscription?.remove(); appSubscription = null;
    recorderSubscription?.remove(); recorderSubscription = null;
  }
  function releaseNative() {
    // No nulling before release: a failed release must remain visible to the next cancellation/claim.
    if (releaseFailed) throw new Error('VOICE_RECORDING_RELEASE_FAILED');
    try {
      if (probe) { probe.remove(); probe = null; }
      if (recorder) { recorder.release(); recorder = null; }
    } catch (error) { releaseFailed = true; throw error; }
    capturing = false;
  }
  function dropRaw() {
    if (!rawUri) return;
    if (!isExpoVoiceRecordingUri(rawUri)) throw new Error('VOICE_RECORDING_PATH');
    const file = new File(rawUri);
    if (file.exists) file.delete();
    rawUri = null;
  }
  function retired() { unregister?.(); unregister = null; recordings.delete(cancel); }
  async function cleanup() {
    stopObserving();
    if (recorder && !rawUri) rawUri = recorder.uri;
    releaseNative(); // releasing the native recorder closes even an unstarted prepared recorder
    dropRaw();
    if (finalUri) { const file = new File(finalUri); if (file.exists) file.delete(); finalUri = null; }
    preparing = false; finishing = false; retired();
  }
  function cancel(): Promise<void> {
    epoch += 1; // immediately retires a pending permission/prepare/finalization before awaiting the queue
    stopObserving();
    return enqueue(cleanup);
  }
  function stop(): Promise<{ uri: string; durationMs: number }> {
    if (stopTask) return stopTask;
    if (!preparing && !recorder) return Promise.reject(new Error('VOICE_RECORDING_NOT_STARTED'));
    const own = epoch;
    finishing = true;
    stopTask = enqueue(async () => {
      if (own !== epoch || !recorder || !audio) throw new Error('VOICE_RECORDING_RETIRED');
      stopObserving();
      try {
        rawUri = recorder.uri ?? rawUri;
        // A native duration/file-size cap may already have finalized it. Never stop a completed recorder twice.
        const state = recorder.getStatus();
        if (state.isRecording || state.canRecord) await recorder.stop();
        releaseNative();
        if (own !== epoch) throw new Error('VOICE_RECORDING_RETIRED');
        if (nativeFailed || !rawUri || !isExpoVoiceRecordingUri(rawUri)) throw new Error('VOICE_RECORDING_FAILED');
        const file = new File(rawUri);
        if (!file.exists || !Number.isInteger(file.size) || file.size <= 0 || file.size > VOICE_FILE_MAX_BYTES) throw new Error('VOICE_FILE_SIZE');
        // Recorder duration resets to zero after stop on both native implementations. Read the finalized container's real duration without playing it.
        probe = audio.createAudioPlayer({ uri: rawUri }, { updateInterval: 100, downloadFirst: false, keepAudioSessionActive: false });
        const status = await waitForLoaded(probe, () => own === epoch, true);
        const durationMs = Math.ceil(status.duration * 1000);
        try { probe.remove(); probe = null; } catch (error) { releaseFailed = true; throw error; }
        if (!Number.isFinite(durationMs) || durationMs <= 0 || durationMs > MAX_MS) throw new Error('VOICE_DURATION_INVALID');
        if (own !== epoch) throw new Error('VOICE_RECORDING_RETIRED');
        const directory = new Directory(Paths.cache, VOICE_CACHE_DIRECTORY);
        directory.create({ intermediates: true, idempotent: true });
        const destination = new File(directory, file.name);
        // Native-generated UUID name; no overwrite and no interleaving with logout's directory purge.
        file.moveSync(destination);
        rawUri = null; finalUri = destination.uri;
        retired(); finishing = false;
        return { uri: destination.uri, durationMs };
      } catch (error) {
        await cleanup();
        throw error;
      }
    });
    return stopTask;
  }
  function interrupt(reason: InterruptReason) {
    if (interruptionSent || (!capturing && !preparing) || finishing) return;
    interruptionSent = true;
    if (preparing) { void cancel().catch(() => { /* retained native handle makes the next start fail closed */ }); return; }
    // Stop even before the model has subscribed; concurrent model.stop() receives this same promise.
    void stop().catch(() => { /* stopTask retains the failure for the owner */ });
    // A normal native cap can beat the model's 250ms max ticker. Keep its completed stopTask for that ticker.
    if (reason === 'AUDIO_FOCUS' && !nativeFailed && Date.now() - recordingStartedAt >= MAX_MS - 500) return;
    for (const listener of [...interrupted]) { try { listener(reason); } catch { /* observers do not own native teardown */ } }
  }
  async function start(): Promise<void> {
    if (!audio || !foreground()) throw new Error('VOICE_MIC_UNAVAILABLE');
    if (releaseFailed || preparing || capturing || finishing || recorder || probe) throw new Error('VOICE_RECORDING_BUSY');
    const own = ++epoch;
    preparing = true; nativeFailed = false; interruptionSent = false; stopTask = null; finalUri = null;
    unregister = registerVoiceNativeCleanup(cancel); recordings.add(cancel);
    appSubscription = AppState.addEventListener('change', state => { if (state !== 'active') interrupt('BACKGROUND'); });
    return enqueue(async () => {
      try {
        if (own !== epoch || !foreground()) throw new Error('VOICE_RECORDING_RETIRED');
        const permission = await audio.getRecordingPermissionsAsync();
        if (!permission.granted || own !== epoch || !foreground()) throw new Error('VOICE_MIC_NOT_GRANTED');
        await audio.setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true, interruptionMode: 'doNotMix',
          shouldPlayInBackground: false, allowsBackgroundRecording: false, shouldRouteThroughEarpiece: false });
        if (own !== epoch || !foreground()) throw new Error('VOICE_RECORDING_RETIRED');
        recorder = new audio.AudioModule.AudioRecorder({ ...options, ...(Platform.OS === 'ios' ? options.ios : options.android) });
        await recorder.prepareToRecordAsync();
        rawUri = recorder.uri;
        if (own !== epoch || !foreground()) throw new Error('VOICE_RECORDING_RETIRED');
        recorderSubscription = recorder.addListener('recordingStatusUpdate', status => {
          if (status.hasError || status.mediaServicesDidReset) nativeFailed = true;
          if (!finishing && (status.isFinished || status.hasError || status.mediaServicesDidReset)) interrupt(status.hasError ? 'FAILED' : 'AUDIO_FOCUS');
        });
        // Leave room for the encoder's final AAC frame; validate the actual container duration below.
        recordingStartedAt = Date.now();
        recorder.record({ forDuration: (MAX_MS - 200) / 1000 });
        if (!recorder.getStatus().isRecording) throw new Error('VOICE_RECORDING_NOT_STARTED');
        preparing = false; capturing = true;
        poll = setInterval(() => {
          if (!recorder || !capturing || finishing) return;
          try {
            const status = recorder.getStatus();
            if (!foreground()) { interrupt('BACKGROUND'); return; }
            if (status.mediaServicesDidReset || !status.isRecording) { interrupt('AUDIO_FOCUS'); return; }
            if (rawUri && new File(rawUri).size >= VOICE_FILE_MAX_BYTES) { interrupt('FAILED'); return; }
            if (typeof status.metering === 'number' && Number.isFinite(status.metering)) {
              const level = Math.max(0, Math.min(1, Math.pow(10, status.metering / 20)));
              for (const listener of [...levels]) { try { listener(level); } catch { /* optional meter observer */ } }
            }
          } catch { nativeFailed = true; interrupt('FAILED'); }
        }, 100);
      } catch (error) {
        await cleanup();
        throw error;
      }
    });
  }
  return {
    async requestPermission() {
      if (!audio || !foreground()) return 'unavailable';
      const own = epoch;
      try {
        // Expo's Android request path delegates to Activity.requestPermissions even when granted.
        // Read first so repeated holds do not reopen that lifecycle path unnecessarily.
        const permission = await audio.getRecordingPermissionsAsync();
        if (own !== epoch || !foreground()) return 'unavailable';
        if (permission.granted) return 'granted';
        if (!permission.canAskAgain) return 'blocked';
        // The system is about to ask: say why first (design proposal N). "Ne sada" asks it nothing. The person may let go of the
        // button while reading the question, which retires this attempt (`epoch`) but not their answer, so "Dozvoli" still
        // reaches the system's window and the next hold finds the permission given; only the app being left stops it.
        // With nothing to draw the question, nothing changes at all.
        if (permissionAsk.hasHost()) {
          if (await permissionAsk.ask('microphone') === 'later') return 'later';
          if (!foreground()) return 'unavailable';
        }
        const answer = await audio.requestRecordingPermissionsAsync();
        if (own !== epoch || !foreground()) return 'unavailable';
        return answer.granted ? 'granted' : answer.canAskAgain ? 'denied' : 'blocked';
      } catch { return 'unavailable'; }
    },
    start, stop, cancel,
    onInterrupted(listener) { interrupted.add(listener); return () => { interrupted.delete(listener); }; },
    onLevel(listener) { levels.add(listener); return () => { levels.delete(listener); }; },
  };
}

/** Local files only. Each preview/received-message player has its own instance; the shared arbiter owns exclusivity. */
export function createNativeVoicePlayer(): VoicePlayerPort {
  const audio = supported() ? nativeAudio() : null;
  const enqueue = serial(), listeners = new Set<(status: PlayerStatus) => void>();
  let player: AudioPlayer | null = null, epoch = 0;
  let sourceUri: string | null = null, wanted = false, releaseFailed = false;
  let subscription: { remove(): void } | null = null, appSubscription: ReturnType<typeof AppState.addEventListener> | null = null;
  let unregister: (() => void) | null = null;
  let latest: PlayerStatus = { positionMs: 0, durationMs: null, playing: false, ended: false };
  function emit() { for (const listener of [...listeners]) { try { listener(latest); } catch { /* screen observer */ } } }
  function publish(status: AudioStatus) {
    latest = { positionMs: Number.isFinite(status.currentTime) ? Math.max(0, Math.round(status.currentTime * 1000)) : 0,
      durationMs: Number.isFinite(status.duration) && status.duration > 0 ? Math.ceil(status.duration * 1000) : null,
      playing: status.playing, ended: status.didJustFinish };
    emit();
  }
  async function releaseNative() {
    if (releaseFailed) throw new Error('VOICE_PLAYER_RELEASE_FAILED');
    subscription?.remove(); subscription = null;
    appSubscription?.remove(); appSubscription = null;
    try { if (player) { player.remove(); player = null; } } catch (error) { releaseFailed = true; throw error; }
    latest = { ...latest, playing: false };
  }
  function release(): Promise<void> {
    epoch += 1; wanted = false; sourceUri = null;
    return enqueue(async () => { await releaseNative(); unregister?.(); unregister = null; latest = { ...latest, ended: false }; emit(); });
  }
  function interruptedPause() {
    // Expo resumes internally paused players on focus/foreground gain. Destroy that native owner;
    // keep only the local URI/position so an explicit next play can prepare a new one.
    epoch += 1; wanted = false;
    void enqueue(async () => { await releaseNative(); emit(); }).catch(() => { /* permanent releaseFailed fence blocks the next play/load */ });
  }
  async function prepare(uri: string, own: number) {
    if (!audio || own !== epoch || !foreground() || releaseFailed) throw new Error('VOICE_PLAYER_UNAVAILABLE');
    localVoiceFile(uri);
    unregister ??= registerVoiceNativeCleanup(release);
    player = audio.createAudioPlayer({ uri }, { updateInterval: 100, downloadFirst: false, keepAudioSessionActive: false });
    const mine = player;
    appSubscription = AppState.addEventListener('change', state => { if (state !== 'active') interruptedPause(); });
    const status = await waitForLoaded(mine, () => own === epoch && foreground());
    if (own !== epoch) throw new Error('VOICE_PLAYER_RETIRED');
    subscription = mine.addListener('playbackStatusUpdate', status => {
      if (own !== epoch || player !== mine) return;
      const unexpectedlyPaused = wanted && latest.playing && !status.playing && !status.isBuffering && !status.didJustFinish;
      if (status.mediaServicesDidReset || status.error || !foreground() || unexpectedlyPaused) {
        latest = { ...latest, playing: false }; emit(); interruptedPause(); return;
      }
      publish(status);
    });
    publish(status);
  }
  return {
    async load(uri) {
      const own = ++epoch;
      wanted = false; sourceUri = null;
      return enqueue(async () => {
        await releaseNative();
        if (own !== epoch) throw new Error('VOICE_PLAYER_RETIRED');
        latest = { positionMs: 0, durationMs: null, playing: false, ended: false };
        try { await prepare(uri, own); if (own !== epoch) throw new Error('VOICE_PLAYER_RETIRED'); sourceUri = uri; } catch (error) { await releaseNative(); throw error; }
      });
    },
    async play() {
      const own = epoch;
      return enqueue(async () => {
        if (!audio || !sourceUri || own !== epoch || !foreground()) throw new Error('VOICE_PLAYER_RETIRED');
        try {
          if (!player) {
            const position = latest.positionMs;
            await prepare(sourceUri, own);
            const restored = player as AudioPlayer | null;
            if (restored && position > 0) await restored.seekTo(position / 1000);
          }
          await audio.setAudioModeAsync({ allowsRecording: false, interruptionMode: 'doNotMix', playsInSilentMode: true,
            shouldPlayInBackground: false, allowsBackgroundRecording: false, shouldRouteThroughEarpiece: false });
          if (!player || own !== epoch || !foreground()) throw new Error('VOICE_PLAYER_RETIRED');
          wanted = true; player.play();
        } catch (error) { wanted = false; await releaseNative(); throw error; }
      });
    },
    async pause() {
      const own = epoch; wanted = false;
      return enqueue(async () => { if (player && own === epoch) player.pause(); });
    },
    async stop() {
      const own = epoch; wanted = false;
      return enqueue(async () => {
        if (own !== epoch) return;
        if (player) { player.pause(); await player.seekTo(0); }
        latest = { ...latest, positionMs: 0, playing: false, ended: false }; emit();
      });
    },
    async seek(positionMs) {
      const own = epoch;
      return enqueue(async () => {
        if (own !== epoch || !Number.isFinite(positionMs)) return;
        const position = Math.max(0, Math.min(positionMs, latest.durationMs ?? positionMs));
        if (player) await player.seekTo(position / 1000);
        else { latest = { ...latest, positionMs: position }; emit(); }
      });
    },
    onStatus(listener) { listeners.add(listener); listener(latest); return () => { listeners.delete(listener); }; },
    release,
  };
}