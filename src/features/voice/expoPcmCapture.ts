import { AppState, Platform } from 'react-native';
import { AudioModule, getRecordingPermissionsAsync, requestRecordingPermissionsAsync, setAudioModeAsync } from 'expo-audio';
import type { AudioStream, AudioStreamBuffer } from 'expo-audio';
import type { NativePcmModule } from './nativeSpeechAdapter';
import { SPEECH_LIMITS } from './speechProtocol';
import { permissionAsk } from '../../ui/permissions/permissionAsk';

type Subscription = { remove(): void };
type Pcm = { sessionId: string; sequence: number; pcmBase64: string; rms: number };
type Interrupted = { sessionId: string; code: string };
const supported = () => !Platform.isTV && (Platform.OS === 'android' || Platform.OS === 'ios');
type Session = {
  id: string; cancelled: boolean; stream: AudioStream | null; subscriptions: Subscription[];
  starting: Promise<void> | null; stopping: Promise<void> | null;
  cap: ReturnType<typeof setTimeout> | null; watchdog: ReturnType<typeof setInterval> | null;
  sequence: number; bytes: number; lastBufferAt: number;
};

/** Called only by the existing explicit hold-to-talk permission action. */
export async function requestExpoSpeechPermission(signal: AbortSignal): Promise<'granted' | 'denied' | 'unavailable' | 'later'> {
  if (!supported() || signal.aborted) return 'unavailable';
  try {
    const permission = await getRecordingPermissionsAsync();
    if (signal.aborted) return 'denied';
    if (permission.granted) return 'granted';
    if (!permission.canAskAgain) return 'denied';
    // The system is about to ask: say why first. "Ne sada" asks the system nothing; "Dozvoli" reaches its window even if the
    // hold was let go while the question was read (the grant is for the next hold).
    if (permissionAsk.hasHost() && await permissionAsk.ask('microphone') === 'later') return 'later';
    const asked = await requestRecordingPermissionsAsync();
    return !signal.aborted && asked.granted ? 'granted' : 'denied';
  } catch { return 'unavailable'; }
}

const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
function base64(bytes: Uint8Array): string {
  let encoded = '';
  for (let index = 0; index < bytes.length; index += 3) {
    const a = bytes[index], b = bytes[index + 1] ?? 0, c = bytes[index + 2] ?? 0;
    encoded += alphabet[a >>> 2] + alphabet[((a & 3) << 4) | (b >>> 4)]
      + (index + 1 < bytes.length ? alphabet[((b & 15) << 2) | (c >>> 6)] : '=')
      + (index + 2 < bytes.length ? alphabet[c & 63] : '=');
  }
  return encoded;
}

/**
 * Expo 57 PCM adapter for iOS and the explicit Android alternative.
 * No file, JS resampling, provider change or automatic fallback. AppState,
 * stream status and a bounded stall watchdog retire interrupted captures.
 * Expo's stream does not expose audio-focus/AVAudioSession interruption events;
 * native interruption and route-change behavior still needs device acceptance.
 */
export function createExpoPcmCapture(): NativePcmModule {
  let active: Session | null = null;
  const pcmListeners = new Set<(value: Pcm) => void>();
  const interruptionListeners = new Set<(value: Interrupted) => void>();

  function detach(session: Session) {
    if (session.cap !== null) clearTimeout(session.cap);
    if (session.watchdog !== null) clearInterval(session.watchdog);
    session.cap = null; session.watchdog = null;
    for (const subscription of session.subscriptions.splice(0)) subscription.remove();
  }
  function stop(sessionId: string): Promise<void> {
    const session = active;
    if (!session || session.id !== sessionId) return Promise.resolve();
    if (session.stopping) return session.stopping;
    session.cancelled = true; detach(session);
    // Invalidate before waiting. A queued native start is stopped again after it
    // settles, so releasing a gesture during start cannot resurrect the mic.
    session.stopping = (async () => {
      let failure: unknown = null;
      try { session.stream?.stop(); } catch (error) { failure = error; }
      try { await session.starting; } catch { /* startup failure still needs release */ }
      try { session.stream?.stop(); } catch (error) { failure ??= error; }
      try { session.stream?.release(); } catch (error) { failure ??= error; }
      try { await setAudioModeAsync({ allowsRecording: false, interruptionMode: 'doNotMix', playsInSilentMode: true,
        shouldPlayInBackground: false, allowsBackgroundRecording: false }); } catch { /* best-effort session reset */ }
      // Native stop changes isStreaming before releasing AudioRecord. A first
      // failure therefore cannot be certified safe by a later idempotent stop.
      session.stream = null;
      if (active === session) active = null;
      if (failure) throw failure;
    })();
    return session.stopping;
  }
  function interrupt(session: Session, code: string) {
    if (session.cancelled || active !== session) return;
    void stop(session.id).catch(() => undefined); // caller's arbiter awaits the same teardown
    for (const listener of [...interruptionListeners]) listener({ sessionId: session.id, code });
  }
  function buffer(session: Session, event: AudioStreamBuffer) {
    let bytes: Uint8Array | null = null;
    try {
      bytes = new Uint8Array(event.data);
      if (active !== session || session.cancelled) return;
      if (event.sampleRate !== SPEECH_LIMITS.sampleRate || event.channels !== 1
          || !Number.isFinite(event.timestamp) || event.timestamp < 0 || bytes.length % 2 !== 0
          || session.bytes + bytes.length > SPEECH_LIMITS.pcmTotalBytes) {
        interrupt(session, 'CAPTURE_FAILED'); return;
      }
      if (!bytes.length) return;
      session.lastBufferAt = Date.now(); session.bytes += bytes.length;
      // Protocol accepts any even chunk <=3200 bytes. Emit the final short part
      // immediately: no buffered tail can be lost when the person releases.
      for (let offset = 0; offset < bytes.length && !session.cancelled; offset += SPEECH_LIMITS.pcmChunkBytes) {
        const part = bytes.subarray(offset, Math.min(bytes.length, offset + SPEECH_LIMITS.pcmChunkBytes));
        const samples = new DataView(part.buffer, part.byteOffset, part.byteLength);
        let squares = 0;
        for (let index = 0; index < part.length; index += 2) {
          const sample = samples.getInt16(index, true) / 32768; squares += sample * sample;
        }
        const value = { sessionId: session.id, sequence: session.sequence++, pcmBase64: base64(part),
          rms: Math.min(1, Math.sqrt(squares / (part.length / 2))) };
        for (const listener of [...pcmListeners]) listener(value);
      }
    } catch { interrupt(session, 'CAPTURE_FAILED'); }
    finally { bytes?.fill(0); }
  }
  function start(sessionId: string, maxDurationMs: number): Promise<void> {
    if (active || !supported() || AppState.currentState !== 'active'
        || !sessionId || !Number.isFinite(maxDurationMs) || maxDurationMs <= 0 || maxDurationMs > SPEECH_LIMITS.captureMs) {
      return Promise.reject(new Error('MIC_UNAVAILABLE'));
    }
    const session: Session = { id: sessionId, cancelled: false, stream: null, subscriptions: [],
      starting: null, stopping: null, cap: null, watchdog: null, sequence: 0, bytes: 0, lastBufferAt: Date.now() };
    active = session;
    session.subscriptions.push(AppState.addEventListener('change', state => {
      if (state !== 'active') interrupt(session, 'BACKGROUND');
    }));
    session.starting = (async () => {
      // This config sets the shared audio policy; AudioStream itself currently has
      // no focus-loss callback. Do not claim that this supplies native parity.
      await setAudioModeAsync({ allowsRecording: true, interruptionMode: 'doNotMix',
        shouldPlayInBackground: false, allowsBackgroundRecording: false });
      if (session.cancelled) return;
      if (AppState.currentState !== 'active') throw new Error('MIC_BACKGROUND');
      const stream = new AudioModule.AudioStream({ sampleRate: SPEECH_LIMITS.sampleRate, channels: 1, encoding: 'int16' });
      session.stream = stream;
      session.subscriptions.push(stream.addListener('audioStreamBuffer', value => buffer(session, value)));
      session.subscriptions.push(stream.addListener('audioStreamStatus', status => {
        if (!status.isStreaming && !session.cancelled) interrupt(session, 'AUDIO_INTERRUPTED');
      }));
      await stream.start();
      if (session.cancelled) return;
      if (stream.sampleRate !== SPEECH_LIMITS.sampleRate || stream.channels !== 1 || !stream.isStreaming) {
        throw new Error('MIC_FORMAT_UNSUPPORTED');
      }
      session.lastBufferAt = Date.now();
      session.cap = setTimeout(() => interrupt(session, 'CAPTURE_TIMEOUT'), maxDurationMs);
      session.watchdog = setInterval(() => {
        if (!stream.isStreaming || Date.now() - session.lastBufferAt > 2500) interrupt(session, 'AUDIO_INTERRUPTED');
      }, 500);
    })();
    void session.starting.catch(() => { interrupt(session, 'CAPTURE_FAILED'); });
    return session.starting;
  }
  const addListener: NativePcmModule['addListener'] = ((event: 'pcm' | 'interrupted', listener: ((value: Pcm) => void) | ((value: Interrupted) => void)) => {
    if (event === 'pcm') { const callback = listener as (value: Pcm) => void; pcmListeners.add(callback); return { remove: () => { pcmListeners.delete(callback); } }; }
    const callback = listener as (value: Interrupted) => void; interruptionListeners.add(callback); return { remove: () => { interruptionListeners.delete(callback); } };
  }) as NativePcmModule['addListener'];
  return { start, stop, addListener };
}
