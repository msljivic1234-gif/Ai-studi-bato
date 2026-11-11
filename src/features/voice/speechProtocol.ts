/** Bounded first-party speech protocol. Neither side forwards arbitrary provider JSON. */
export const SPEECH_PROTOCOL = 'USKOCI_SPEECH_V1';
export const SPEECH_MODEL = 'gemini-3.5-transcribe-live';
export const SPEECH_LIMITS = Object.freeze({ sampleRate: 16000, pcmChunkBytes: 3200, pcmTotalBytes: 3840000,
  transcriptCharacters: 4000, captureMs: 120000, setupMs: 15000, finalizationMs: 15000, outgoingBufferBytes: 65536 });

export type SpeechServerEvent = {
  protocol: typeof SPEECH_PROTOCOL;
  conversationId: string;
  operationId: string;
  sequence: number;
} & ({ kind: 'ready' }
  | { kind: 'segment'; index: number; final: boolean; text: string }
  | { kind: 'final'; text: string }
  | { kind: 'error'; code: 'SPEECH_UNAVAILABLE' | 'SPEECH_CANCELLED' | 'SPEECH_TIMEOUT' | 'SPEECH_INCOMPLETE' | 'SPEECH_LIMIT' | 'SPEECH_INVALID' });

export function decodeSpeechEvent(raw: unknown, conversationId: string, operationId: string, expectedSequence: number): SpeechServerEvent | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const event = raw as Record<string, unknown>;
  if (event.protocol !== SPEECH_PROTOCOL || event.conversationId !== conversationId || event.operationId !== operationId
    || event.sequence !== expectedSequence) return null;
  const base = ['protocol','conversationId','operationId','sequence','kind'];
  const keys = event.kind === 'segment' ? [...base,'index','final','text'] : event.kind === 'final' ? [...base,'text']
    : event.kind === 'error' ? [...base,'code'] : event.kind === 'ready' ? base : [];
  if (!keys.length || Object.keys(event).length !== keys.length || !keys.every(key => Object.hasOwn(event, key))) return null;
  if ((event.kind === 'final' || event.kind === 'segment') && (typeof event.text !== 'string'
    || event.text.length > SPEECH_LIMITS.transcriptCharacters || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(event.text))) return null;
  if (event.kind === 'segment' && (typeof event.index !== 'number' || !Number.isSafeInteger(event.index) || event.index < 0
    || event.index > SPEECH_LIMITS.transcriptCharacters || typeof event.final !== 'boolean')) return null;
  if (event.kind === 'error' && !['SPEECH_UNAVAILABLE','SPEECH_CANCELLED','SPEECH_TIMEOUT','SPEECH_INCOMPLETE','SPEECH_LIMIT','SPEECH_INVALID'].includes(event.code as string)) return null;
  return event as SpeechServerEvent;
}

export function pcmBase64Bytes(value: unknown): number | null {
  if (typeof value !== 'string' || !value.length || value.length > 4268 || value.length % 4 !== 0
    || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value)) return null;
  const length = value.length / 4 * 3 - (value.endsWith('==') ? 2 : value.endsWith('=') ? 1 : 0);
  return length > 0 && length <= SPEECH_LIMITS.pcmChunkBytes && length % 2 === 0 ? length : null;
}
