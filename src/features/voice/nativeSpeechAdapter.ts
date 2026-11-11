import { PermissionsAndroid, Platform } from 'react-native';
import { requireOptionalNativeModule } from 'expo';
import type { FinalTranscript, NativeSpeechAdapter, NativeSpeechCapture, SpeechEvent, VoiceSession } from './holdToTalk';
import { decodeSpeechEvent, pcmBase64Bytes, SPEECH_LIMITS } from './speechProtocol';
import { sharedAudioArbiter } from '../voiceMessages/audioArbiter';
import type { AudioArbiter, AudioLease } from '../voiceMessages/ports';
import { permissionAsk } from '../../ui/permissions/permissionAsk';

type Subscription = { remove(): void };
export interface NativePcmModule {
  start(sessionId: string, maxDurationMs: number): void | Promise<void>;
  stop(sessionId: string): void | Promise<void>;
  addListener(event: 'pcm', listener: (event: { sessionId: string; sequence: number; pcmBase64: string; rms: number }) => void): Subscription;
  addListener(event: 'interrupted', listener: (event: { sessionId: string; code: string }) => void): Subscription;
}
type Connection = { url: string; accessToken: string; anonKey: string };
export type SpeechAdapterOptions = {
  getConnection: (session: VoiceSession, signal: AbortSignal) => Promise<Connection | null>;
  newOperationId: () => string;
  /** Tests may isolate ownership; production defaults to the process-wide arbiter. */
  arbiter?: AudioArbiter;
};

export function createNativeSpeechAdapter(options: SpeechAdapterOptions): NativeSpeechAdapter {
  let native: NativePcmModule | null = null;
  // iOS uses the already-installed Expo PCM stream. Android keeps its reviewed
  // native default and explicit build-time opt-in; no failed capture switches paths.
  const useExpo = Platform.OS === 'ios' || process.env.EXPO_PUBLIC_SPEECH_CAPTURE === 'expo';
  let expoPermission: ((signal: AbortSignal) => Promise<'granted' | 'denied' | 'unavailable' | 'later'>) | null = null;
  try {
    if (!Platform.isTV && (Platform.OS === 'android' || Platform.OS === 'ios')) {
      if (useExpo) {
        // Load only on the selected native path. A failed Expo session never
        // silently starts another microphone or falls back to an audio file.
        const expo = require('./expoPcmCapture') as typeof import('./expoPcmCapture');
        native = expo.createExpoPcmCapture(); expoPermission = expo.requestExpoSpeechPermission;
      } else native = requireOptionalNativeModule<NativePcmModule>('UskociVoice');
    }
  } catch { }
  const arbiter = options.arbiter ?? sharedAudioArbiter;
  return {
    async requestPermission(signal) {
      if (!native || signal.aborted) return 'unavailable';
      if (expoPermission) return expoPermission(signal);
      if (Platform.OS !== 'android') return 'unavailable';
      const granted = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO);
      if (signal.aborted) return 'denied';
      if (granted) return 'granted';
      // The system is about to ask: say why first (design proposal N). The person may let go of the button while reading it,
      // which ends this gesture but not their answer, so "Dozvoli" still reaches the system's window and the next hold finds
      // the permission given. "Ne sada" asks the system nothing. With nothing to draw the question, nothing changes at all.
      if (permissionAsk.hasHost() && await permissionAsk.ask('microphone') === 'later') return 'later';
      const status = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO);
      return !signal.aborted && status === PermissionsAndroid.RESULTS.GRANTED ? 'granted' : 'denied';
    },
    createCapture(input): NativeSpeechCapture {
      const module = native;
      const operationId = options.newOperationId();
      let socket: WebSocket | null = null, disposed = false, captureStopped = false, started = false, released = false;
      let expectedSequence = 0, expectedAudioSequence = 0, pcmBytes = 0;
      let subscriptions: Subscription[] = [];
      let lease: AudioLease | null = null, stopError: unknown = null;
      let stopped: Promise<void> = Promise.resolve();
      let readyResolve: () => void = () => {}, readyReject: (error: Error) => void = () => {};
      const ready = new Promise<void>((resolve, reject) => { readyResolve = resolve; readyReject = reject; });
      // A disposal can precede start() awaiting setup. Mark the rejection handled immediately.
      void ready.catch(() => undefined);
      let finalResolve: (result: FinalTranscript) => void = () => {};
      const final = new Promise<FinalTranscript>(resolve => { finalResolve = resolve; });
      let terminalReceived = false, serviceReady = false;
      const stopCapture = () => {
        if (captureStopped) return;
        captureStopped = true;
        subscriptions.forEach(subscription => subscription.remove()); subscriptions = [];
        // Native fallback stops synchronously; Expo also waits out a pending start.
        // Keep ownership until that teardown finishes, including after navigation.
        try {
          const result = module?.stop(operationId);
          if (result && typeof result.then === 'function') {
            stopped = result.then(() => { lease?.(); lease = null; }, error => { stopError = error; throw error; });
            void stopped.catch(() => undefined);
          } else { lease?.(); lease = null; }
        } catch (error) { stopError = error; stopped = Promise.reject(error); void stopped.catch(() => undefined); }
      };
      const dispose = () => {
        if (disposed) return;
        disposed = true;
        input.signal.removeEventListener('abort', dispose);
        stopCapture();
        readyReject(new Error('CAPTURE_CANCELLED'));
        finalResolve({ kind: 'incomplete' });
        if (socket) {
          const previous = socket; socket = null;
          previous.onopen = null; previous.onmessage = null; previous.onerror = null; previous.onclose = null;
          try { if (previous.readyState === 1 && !terminalReceived) previous.send(JSON.stringify({ kind: 'cancel' })); } catch { }
          try { previous.close(1000, 'session ended'); } catch { }
        }
      };
      const fail = (code: Extract<SpeechEvent, { kind: 'error' }>['code'] = 'CAPTURE_FAILED') => {
        if (disposed) return;
        readyReject(new Error(code)); finalResolve({ kind: 'incomplete' });
        input.onEvent({ kind: 'error', code }); dispose();
      };
      input.signal.addEventListener('abort', dispose, { once: true });
      if (input.signal.aborted) dispose();

      return {
        async start() {
          if (disposed || !module || !input.canCapture()) throw new Error('MIC_UNAVAILABLE');
          const acquired = await arbiter.claim('speech', async () => {
            fail('AUDIO_INTERRUPTED');
            await stopped;
            if (stopError) throw stopError;
          });
          if (disposed || !input.canCapture() || !acquired.isCurrent()) { acquired(); dispose(); return; }
          lease = acquired;
          const connection = await options.getConnection(input.session, input.signal);
          if (disposed || !input.canCapture()) { dispose(); return; }
          if (!connection || !connection.accessToken || !connection.anonKey) throw new Error('MIC_UNAVAILABLE');
          const url = new URL(connection.url);
          if (url.protocol !== 'https:' || url.username || url.password || url.pathname !== '/' || url.search || url.hash) throw new Error('SPEECH_CONNECTION_INVALID');
          url.protocol = 'wss:'; url.pathname = '/functions/v1/uskoci-speech-session';
          url.searchParams.set('conversationId', input.session.conversationId);
          url.searchParams.set('operationId', operationId);
          // React Native's native WebSocket supports request headers; tokens never enter query strings.
          const NativeWebSocket = WebSocket as unknown as new (url: string, protocols: string[], options: { headers: Record<string,string> }) => WebSocket;
          socket = new NativeWebSocket(url.toString(), [], { headers: { Authorization: 'Bearer ' + connection.accessToken, apikey: connection.anonKey } });
          socket.onmessage = event => {
            if (disposed) return;
            if (typeof event.data !== 'string' || event.data.length > 30000) { fail(); return; }
            let raw: unknown;
            try { raw = JSON.parse(event.data); } catch { fail(); return; }
            const message = decodeSpeechEvent(raw, input.session.conversationId, operationId, expectedSequence);
            if (!message) { fail(); return; }
            expectedSequence++;
            if (message.kind === 'ready') { serviceReady = true; readyResolve(); return; }
            if (message.kind === 'segment') { input.onEvent({ kind: 'segment', index: message.index, final: message.final, text: message.text }); return; }
            if (message.kind === 'error') {
              // Only a validated service refusal gets this message; it does not establish a billing cause.
              fail(message.code === 'SPEECH_UNAVAILABLE' ? 'SPEECH_UNAVAILABLE' : 'CAPTURE_FAILED'); return;
            }
            if (!released || terminalReceived) { fail(); return; }
            terminalReceived = true;
            finalResolve(message.text.trim() ? { kind: 'final', text: message.text } : { kind: 'incomplete' });
          };
          // A refused upgrade (including budget admission) has no usable speech
          // session yet. Native WebSocket does not expose a trustworthy HTTP body;
          // describe availability, without inferring a billing or network cause.
          const connectionFailure = () => fail(serviceReady ? 'SPEECH_CONNECTION_FAILED' : 'SPEECH_UNAVAILABLE');
          socket.onerror = connectionFailure;
          socket.onclose = () => { if (!terminalReceived && !disposed) connectionFailure(); };
          await ready;
          if (disposed || !input.canCapture()) { dispose(); return; }
          subscriptions.push(module.addListener('pcm', event => {
            if (event.sessionId !== operationId || disposed || captureStopped || !input.canCapture()) return;
            const bytes = pcmBase64Bytes(event.pcmBase64);
            if (bytes === null || event.sequence !== expectedAudioSequence || pcmBytes + bytes > SPEECH_LIMITS.pcmTotalBytes
              || socket?.readyState !== 1 || socket.bufferedAmount > SPEECH_LIMITS.outgoingBufferBytes) { fail(); return; }
            expectedAudioSequence++; pcmBytes += bytes;
            input.onEvent({ kind: 'level', value: event.rms });
            socket.send(JSON.stringify({ kind: 'audio', sequence: event.sequence, pcmBase64: event.pcmBase64 }));
          }));
          subscriptions.push(module.addListener('interrupted', event => {
            if (event.sessionId === operationId && !disposed) fail('AUDIO_INTERRUPTED');
          }));
          if (disposed || !input.canCapture()) { dispose(); return; }
          started = true;
          await module.start(operationId, SPEECH_LIMITS.captureMs);
          if (disposed || !input.canCapture() || !acquired.isCurrent()) dispose();
        },
        stopCapture,
        async finalize(): Promise<FinalTranscript> {
          if (disposed || !started || released || socket?.readyState !== 1) return { kind: 'incomplete' };
          stopCapture();
          try { await stopped; } catch { fail(); return { kind: 'incomplete' }; }
          if (disposed || released || socket?.readyState !== 1) return { kind: 'incomplete' };
          released = true;
          socket.send(JSON.stringify({ kind: 'release' }));
          return final;
        },
        dispose,
      };
    },
  };
}
