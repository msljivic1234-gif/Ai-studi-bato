import { SPEECH_LIMITS, SPEECH_MODEL, SPEECH_PROTOCOL, pcmBase64Bytes } from '../../../src/features/voice/speechProtocol.ts';
import { AI_TEST_LIMITS } from '../_shared/aiTestBudget.ts';

type Socket = Pick<WebSocket, 'readyState' | 'bufferedAmount' | 'send' | 'close' | 'onopen' | 'onmessage' | 'onerror' | 'onclose'>;
const object = (v: unknown): v is Record<string, any> => !!v && typeof v === 'object' && !Array.isArray(v);
const safeText = (v: unknown): v is string => typeof v === 'string' && v.length <= SPEECH_LIMITS.transcriptCharacters
  && !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(v);

/** All audio remains in bounded memory. The client cannot choose model, tools, VAD or pricing bounds. */
export function bridgeSpeech(client: Socket, upstream: Socket, conversationId: string, operationId: string,
  onFinished?: (completed: boolean, audioBytes: number, transcriptChars: number) => void) {
  let completed = false;
  let ended = false, ready = false, providerSetup = false, released = false, eventSequence = 0, audioSequence = 0;
  let audioBytes = 0, segmentIndex = 0, finalText = '', interimText = '', turnComplete = false;
  let observedOutputChars = 0;
  let receivedProviderBytes = 0;
  let deadline: ReturnType<typeof setTimeout>;
  const send = (event: Record<string, unknown>) => {
    if (ended || client.readyState !== 1 || client.bufferedAmount > SPEECH_LIMITS.outgoingBufferBytes) return false;
    try { client.send(JSON.stringify({ protocol: SPEECH_PROTOCOL, conversationId, operationId, sequence: eventSequence++, ...event })); return true; }
    catch { return false; }
  };
  const close = () => {
    if (ended) return;
    ended = true; clearTimeout(deadline);
    // Count audio send attempts, including a send that throws: local failure is
    // not proof of remote rollback or zero usage. Partial output is not completion.
    // Empty replacement frames cannot erase earlier output evidence. Only a
    // completed turn uses the exact final transcript for the existing estimate.
    try { onFinished?.(completed, audioBytes, completed ? finalText.length : observedOutputChars); } catch { }
    finalText = ''; interimText = '';
    try { upstream.close(1000, 'session ended'); } catch { }
    try { client.close(1000, 'session ended'); } catch { }
  };
  const error = (code: string) => { send({ kind: 'error', code }); close(); };
  const sendUpstream = (message: object) => {
    try { upstream.send(JSON.stringify(message)); return true; }
    catch { error('SPEECH_UNAVAILABLE'); return false; }
  };
  const timeout = (ms: number) => { clearTimeout(deadline); deadline = setTimeout(() => error('SPEECH_TIMEOUT'), ms); };
  const complete = () => {
    if (!released || !turnComplete || interimText || !finalText.trim()) return;
    completed = true;
    send({ kind: 'final', text: finalText.trim() }); close();
  };
  const beginInput = () => {
    if (ended || ready || !providerSetup || client.readyState !== 1) return;
    ready = true;
    if (!sendUpstream({ realtimeInput: { activityStart: {} } })) return;
    if (!send({ kind: 'ready' })) { close(); return; }
    timeout(SPEECH_LIMITS.captureMs);
  };
  timeout(SPEECH_LIMITS.setupMs);
  client.onopen = beginInput;

  upstream.onopen = () => {
    if (ended) { try { upstream.close(); } catch { } return; }
    sendUpstream({ setup: { model: 'models/' + SPEECH_MODEL,
      generationConfig: { responseModalities: ['TEXT'], maxOutputTokens: AI_TEST_LIMITS.speechMaxOutputTokens, candidateCount: 1 },
      realtimeInputConfig: { automaticActivityDetection: { disabled: true }, activityHandling: 'NO_INTERRUPTION' },
      inputAudioTranscription: { languageCodes: ['sr-RS'], mode: 'VERBATIM' },
    } });
  };
  // The provider delivers its JSON frames as binary, so a string-only reader rejects even
  // `{"setupComplete": {}}`. Decoding is async for a Blob, and transcript order matters,
  // so frames are processed one at a time through this chain.
  let frames: Promise<void> = Promise.resolve();
  const frameText = async (data: unknown): Promise<string | null> => {
    if (typeof data === 'string') return data.length > 32768 ? null : data;
    if (data instanceof Blob) return data.size > 32768 ? null : await data.text();
    if (data instanceof ArrayBuffer) return data.byteLength > 32768 ? null : new TextDecoder().decode(data);
    if (ArrayBuffer.isView(data)) {
      const view = data as ArrayBufferView;
      return view.byteLength > 32768 ? null : new TextDecoder().decode(view.buffer.slice(view.byteOffset, view.byteOffset + view.byteLength));
    }
    return null;
  };
  // A string frame is handled synchronously exactly as before. Only a binary frame needs
  // decoding, and while one is in flight later frames queue behind it so transcript order
  // is never disturbed.
  let decoding = 0;
  upstream.onmessage = event => {
    if (ended) return;
    if (typeof event.data === 'string' && decoding === 0) { handleText(event.data); return; }
    decoding += 1;
    frames = frames
      .then(async () => { const raw = await frameText(event.data); if (raw === null) { error('SPEECH_INVALID'); return; } handleText(raw); })
      .catch(() => { error('SPEECH_INVALID'); })
      .finally(() => { decoding -= 1; });
  };
  const handleText = (raw: string) => {
    if (ended) return;
    if (raw.length > 32768) { error('SPEECH_INVALID'); return; }
    receivedProviderBytes += new TextEncoder().encode(raw).byteLength;
    if (receivedProviderBytes > 1048576) { error('SPEECH_LIMIT'); return; }
    let message: Record<string, any>;
    try { message = JSON.parse(raw); } catch { error('SPEECH_INVALID'); return; }
    if (!object(message)) { error('SPEECH_INVALID'); return; }
    if (message.error || message.toolCall || message.goAway || message.sessionResumptionUpdate) { error('SPEECH_UNAVAILABLE'); return; }
    if (message.setupComplete) {
      if (providerSetup) { error('SPEECH_INVALID'); return; }
      providerSetup = true;
      beginInput();
    }
    const content = message.serverContent;
    if (content !== undefined && !object(content)) { error('SPEECH_INVALID'); return; }
    if (!content) return;
    if (!ready || content.interrupted) { error('SPEECH_INCOMPLETE'); return; }
    if (content.interimInputTranscription) {
      const text = content.interimInputTranscription.text;
      if (!safeText(text) || finalText.length + text.length > SPEECH_LIMITS.transcriptCharacters) { error('SPEECH_LIMIT'); return; }
      observedOutputChars = Math.max(observedOutputChars, finalText.length + text.length);
      interimText = text;
      if (!send({ kind: 'segment', index: segmentIndex, final: false, text })) { close(); return; }
    }
    if (content.inputTranscription) {
      const text = content.inputTranscription.text;
      if (!safeText(text) || finalText.length + text.length > SPEECH_LIMITS.transcriptCharacters) { error('SPEECH_LIMIT'); return; }
      observedOutputChars = Math.max(observedOutputChars, finalText.length + text.length);
      // Provider final chunks are ordered by this WebSocket; do not deduplicate repeated spoken words by value.
      finalText += text;
      interimText = '';
      if (!send({ kind: 'segment', index: segmentIndex++, final: true, text })) { close(); return; }
    }
    if (content.turnComplete === true) {
      // A provider pause is never permission to submit while the gesture remains held.
      if (!released) { error('SPEECH_INCOMPLETE'); return; }
      turnComplete = true;
    }
    // Proven by a controlled probe on 2026-09-17: gemini-3.5-transcribe-live never sends
    // turnComplete. After activityEnd it sends inputTranscription and then
    // generationComplete: true, 306 ms later, and nothing else for 20 s. Waiting only for
    // turnComplete is why every session ended in FINALIZATION_TIMEOUT with a perfect
    // transcript already in hand. generationComplete counts only after release, so it can
    // never finish a gesture that is still held.
    if (content.generationComplete === true && released) turnComplete = true;
    complete();
  };
  client.onmessage = event => {
    if (ended) return;
    if (typeof event.data !== 'string' || event.data.length > 4800) { error('SPEECH_INVALID'); return; }
    let message: Record<string, any>;
    try { message = JSON.parse(event.data); } catch { error('SPEECH_INVALID'); return; }
    if (!object(message)) { error('SPEECH_INVALID'); return; }
    if (message.kind === 'cancel' && Object.keys(message).length === 1) { close(); return; }
    if (!ready || released || upstream.readyState !== 1) { error('SPEECH_INVALID'); return; }
    if (message.kind === 'release' && Object.keys(message).length === 1) {
      released = true;
      if (!sendUpstream({ realtimeInput: { activityEnd: {} } })) return;
      timeout(SPEECH_LIMITS.finalizationMs);
      return;
    }
    const bytes = pcmBase64Bytes(message.pcmBase64);
    if (message.kind !== 'audio' || Object.keys(message).length !== 3 || message.sequence !== audioSequence || bytes === null) {
      error('SPEECH_INVALID'); return;
    }
    if (audioBytes + bytes > AI_TEST_LIMITS.speechPcmBytes || upstream.bufferedAmount > SPEECH_LIMITS.outgoingBufferBytes) {
      error('SPEECH_LIMIT'); return;
    }
    audioBytes += bytes; audioSequence++;
    sendUpstream({ realtimeInput: { audio: { data: message.pcmBase64, mimeType: 'audio/pcm;rate=16000' } } });
    message.pcmBase64 = ''; // Do not retain audio in session state, storage or logs.
  };
  client.onerror = close;
  client.onclose = close;
  upstream.onerror = () => error('SPEECH_UNAVAILABLE');
  upstream.onclose = () => { if (!ended) error('SPEECH_INCOMPLETE'); };
  return close;
}
