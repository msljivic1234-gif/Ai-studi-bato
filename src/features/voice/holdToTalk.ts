import { toSerbianLatin } from '../../lib/serbianLatin';

/** Provider-neutral native speech lifecycle. No audio storage or publication writer. */
export type VoiceScope = Readonly<{
  accountId: string;
  accountRevision: number;
  conversationId: string;
}>;

export type VoiceSession = Readonly<VoiceScope & {
  generation: number;
  gestureId: string;
  startedAt: number;
  mode: 'hold' | 'accessible';
}>;

export type VoiceErrorCode =
  | 'VOICE_NOT_CONFIGURED' | 'MIC_PERMISSION_DENIED' | 'MIC_PERMISSION_TIMEOUT'
  | 'MIC_UNAVAILABLE' | 'CAPTURE_FAILED' | 'CAPTURE_TIMEOUT' | 'AUDIO_INTERRUPTED'
  | 'SPEECH_UNAVAILABLE' | 'SPEECH_CONNECTION_FAILED'
  | 'FINALIZATION_FAILED' | 'FINALIZATION_TIMEOUT' | 'FINAL_TRANSCRIPT_MISSING'
  | 'TRANSCRIPT_INVALID' | 'TRANSCRIPT_TOO_LONG' | 'AI_SPEAKING'
  | 'DRAFT_NOT_ACCEPTED' | 'VOICE_PREPARATION_FAILED';

export const VOICE_ERROR_COPY: Readonly<Record<VoiceErrorCode, string>> = {
  VOICE_NOT_CONFIGURED: 'Govorni unos još nije povezan. Možete da nastavite kucanjem.',
  MIC_PERMISSION_DENIED: 'Mikrofon nije dozvoljen. Dozvolu možete promeniti u podešavanjima telefona ili nastaviti kucanjem.',
  MIC_PERMISSION_TIMEOUT: 'Zahtev za mikrofon je istekao. Pokrenite novi govorni unos.',
  MIC_UNAVAILABLE: 'Mikrofon trenutno nije dostupan. Nastavite kucanjem.',
  CAPTURE_FAILED: 'Govorni unos je prekinut. Možete da nastavite kucanjem.',
  SPEECH_UNAVAILABLE: 'Govorni servis trenutno nije dostupan. Pokušajte kasnije ili nastavite kucanjem.',
  SPEECH_CONNECTION_FAILED: 'Veza za govorni unos je prekinuta. Pokušajte ponovo ili nastavite kucanjem.',
  CAPTURE_TIMEOUT: 'Snimanje je dostiglo ograničenje trajanja. Nastavite kraćom porukom.',
  AUDIO_INTERRUPTED: 'Snimanje je prekinuto. Pokušajte ponovo ili napišite poruku.',
  FINALIZATION_FAILED: 'Tekst govora nije potvrđen. Pokušajte ponovo ili napišite poruku.',
  FINALIZATION_TIMEOUT: 'Tekst govora nije stigao na vreme. Pokušajte ponovo ili napišite poruku.',
  FINAL_TRANSCRIPT_MISSING: 'Govor nije prepoznat. Pokušajte ponovo ili napišite poruku.',
  TRANSCRIPT_INVALID: 'Tekst govora nije mogao da se prikaže. Pokušajte ponovo ili napišite poruku.',
  TRANSCRIPT_TOO_LONG: 'Poruka može da ima do 4.000 znakova. Podelite je na kraće poruke.',
  AI_SPEAKING: 'Sačekajte da se čitanje odgovora završi pre govornog unosa.',
  DRAFT_NOT_ACCEPTED: 'Završni tekst je sačuvan. Otvorite ga za izmenu pre slanja; ako je poruka puna, najpre je skratite.',
  VOICE_PREPARATION_FAILED: 'Govorni unos nije pripremljen. Proverite vezu i pokušajte ponovo ili nastavite kucanjem.',
};

/** Retention is a fact, not a promise attached to an error code. */
export function voiceErrorCopy(code: VoiceErrorCode, retainedText = ''): string {
  if (!retainedText.trim() || code === 'DRAFT_NOT_ACCEPTED') return VOICE_ERROR_COPY[code];
  return code === 'FINAL_TRANSCRIPT_MISSING'
    ? 'Nije stigao ceo tekst. Prepoznati deo možete da pregledate pre slanja.'
    : `${VOICE_ERROR_COPY[code]} Prepoznati deo možete da pregledate pre slanja.`;
}

export type SpeechEvent =
  | { kind: 'segment'; index: number; final: boolean; text: string }
  | { kind: 'level'; value: number | null }
  | { kind: 'error'; code: 'MIC_UNAVAILABLE' | 'CAPTURE_FAILED' | 'AUDIO_INTERRUPTED'
    | 'SPEECH_UNAVAILABLE' | 'SPEECH_CONNECTION_FAILED' };

export type FinalTranscript = { kind: 'final'; text: string } | { kind: 'incomplete' };

export interface NativeSpeechCapture {
  /** The adapter checks canCapture before/after each async acquisition and closes late resources. */
  start(): Promise<void>;
  /** Immediately fences native audio callbacks and stops capture, without ending the STT read. */
  stopCapture(): void;
  /** Called once, after stopCapture. Only a provider-confirmed whole utterance is `final`. */
  finalize(): Promise<FinalTranscript>;
  /** Idempotent; closes microphone, recognizer/socket and all native listeners, including pending acquisitions. */
  dispose(): void;
}

export interface NativeSpeechAdapter {
  /**
   * `later`: the person answered "Ne sada" to the question that comes before the system's window (ui/permissions). The system
   * was not asked and nothing went wrong, so it is not an error and ends the gesture without a word.
   */
  requestPermission(signal: AbortSignal): Promise<'granted' | 'denied' | 'unavailable' | 'later'>;
  /** Creates an inert, cancellable handle. No microphone or provider I/O until start(). */
  createCapture(input: {
    session: VoiceSession;
    signal: AbortSignal;
    canCapture: () => boolean;
    onEvent: (event: SpeechEvent) => void;
  }): NativeSpeechCapture;
}

export type VoiceTranscript = Readonly<{
  session: VoiceSession;
  text: string;
}>;

export type VoiceCancelReason = 'gesture' | 'navigation' | 'background' | 'account' | 'interruption' | 'dispose';
export type VoicePhase = 'IDLE' | 'PERMISSION_PENDING' | 'PREPARING' | 'STARTING' | 'LISTENING' | 'FINALIZING';
export type VoiceSnapshot = Readonly<{
  phase: VoicePhase;
  session: VoiceSession | null;
  finalText: string;
  interimText: string;
  audioLevel: number | null;
  fallbackText: string;
  error: VoiceErrorCode | null;
}>;

export type HoldToTalkOptions = {
  adapter: NativeSpeechAdapter | null;
  /** An empty conversation id is allowed only during explicit first-gesture preparation. */
  getScope: () => VoiceScope | null;
  /** No AI turn or audio I/O. Adoption is synchronous and runs only for the still-held gesture. */
  prepareConversation?: (input: { signal: AbortSignal; isCurrent: () => boolean }) =>
    Promise<{ conversationId: string; adopt: () => boolean } | null>;
  isAiSpeaking?: () => boolean;
  /** Synchronous handoff to the visible editable composer. Never dispatches an AI/message command. */
  onTranscript: (input: VoiceTranscript & { isCurrent: () => boolean }) => boolean;
  /** Technical safety deadlines are supplied by the approved integration, never copied from HTML demo timing. */
  limits: { permissionMs: number; captureMs: number; finalizationMs: number };
};

type ActiveSession = {
  identity: VoiceSession;
  abort: AbortController;
  capture: NativeSpeechCapture | null;
  held: boolean;
  segments: Map<number, { final: boolean; text: string }>;
  completed: boolean;
  deadline?: ReturnType<typeof setTimeout>;
};

const blank = (): VoiceSnapshot => ({ phase: 'IDLE', session: null, finalText: '', interimText: '',
  audioLevel: null, fallbackText: '', error: null });
const sameScope = (a: VoiceScope | null, b: VoiceScope | null) => !!a && !!b
  && a.accountId === b.accountId && a.accountRevision === b.accountRevision && a.conversationId === b.conversationId;
const safeText = (text: unknown): text is string => typeof text === 'string'
  && !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(text);
const MAX_TEXT = 4000; // Existing owned AI turn input bound.

export class HoldToTalkController {
  private snapshot: VoiceSnapshot = blank();
  private listeners = new Set<() => void>();
  private active: ActiveSession | null = null;
  private generation = 0;
  private foreground = true;
  private disposed = false;

  constructor(private readonly options: HoldToTalkOptions) {
    if (!Object.values(options.limits).every(value => Number.isSafeInteger(value) && value > 0)) {
      throw new Error('VOICE_DEADLINES_REQUIRED');
    }
  }

  getSnapshot = (): VoiceSnapshot => this.snapshot;
  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  };

  private update(patch: Partial<VoiceSnapshot>) {
    this.snapshot = Object.freeze({ ...this.snapshot, ...patch });
    this.listeners.forEach(listener => listener());
  }

  private current(session: ActiveSession) {
    return !this.disposed && this.foreground && this.active === session && !session.abort.signal.aborted
      && sameScope(this.options.getScope(), session.identity);
  }

  private clearDeadline(session: ActiveSession) {
    if (session.deadline !== undefined) clearTimeout(session.deadline);
    session.deadline = undefined;
  }

  private deadline(session: ActiveSession, ms: number, code: VoiceErrorCode) {
    this.clearDeadline(session);
    session.deadline = setTimeout(() => {
      if (!this.current(session)) { this.contextChanged(); return; }
      this.fail(session, code);
    }, ms);
  }

  private closeCapture(session: ActiveSession) {
    const capture = session.capture;
    session.capture = null;
    if (!capture) return;
    try { capture.stopCapture(); } catch { /* dispose remains required even if stop fails */ }
    try { capture.dispose(); } catch { /* adapters cannot reflect platform errors to the user */ }
  }

  private terminate(session: ActiveSession) {
    this.clearDeadline(session);
    session.held = false;
    session.abort.abort();
    this.closeCapture(session);
    if (this.active === session) this.active = null;
  }

  private transcript(session: ActiveSession) {
    return [...session.segments].sort(([a], [b]) => a - b).map(([, value]) => value.text).join(' ').trim();
  }

  private fail(session: ActiveSession, error: VoiceErrorCode) {
    if (!this.current(session)) { this.contextChanged(); return; }
    const fallbackText = this.transcript(session);
    this.terminate(session);
    this.update({ ...blank(), session: session.identity, fallbackText, error });
  }

  /** Returns false while another native speech gesture is active. */
  begin(gestureId: string, mode: VoiceSession['mode'] = 'hold'): boolean {
    this.contextChanged();
    if (this.disposed || !this.foreground || this.active || !gestureId) return false;
    const scope = this.options.getScope();
    if (!scope || (!scope.conversationId && !this.options.prepareConversation)) return false;
    if (!this.options.adapter) { this.update({ error: 'VOICE_NOT_CONFIGURED' }); return false; }
    if (this.options.isAiSpeaking?.()) { this.update({ error: 'AI_SPEAKING' }); return false; }
    const session: ActiveSession = {
      identity: Object.freeze({ ...scope, generation: ++this.generation, gestureId, mode, startedAt: Date.now() }),
      abort: new AbortController(), capture: null, held: true, segments: new Map(), completed: false,
    };
    this.active = session;
    this.update({ ...blank(), session: session.identity, phase: 'PERMISSION_PENDING' });
    this.deadline(session, this.options.limits.permissionMs, 'MIC_PERMISSION_TIMEOUT');
    void this.start(session);
    return true;
  }

  private async start(session: ActiveSession) {
    const adapter = this.options.adapter!;
    try {
      const permission = await adapter.requestPermission(session.abort.signal);
      if (!this.current(session) || !session.held) { this.contextChanged(); return; }
      // "Ne sada" to the question before the system's window: no microphone, no error, the composer is as it was.
      if (permission === 'later') { this.cancel('gesture'); return; }
      if (permission !== 'granted') {
        this.fail(session, permission === 'denied' ? 'MIC_PERMISSION_DENIED' : 'MIC_UNAVAILABLE'); return;
      }
      if (!session.identity.conversationId) {
        this.update({ phase: 'PREPARING' });
        this.deadline(session, this.options.limits.permissionMs, 'VOICE_PREPARATION_FAILED');
        let prepared: Awaited<ReturnType<NonNullable<HoldToTalkOptions['prepareConversation']>>>;
        try {
          prepared = await this.options.prepareConversation!({ signal: session.abort.signal,
            isCurrent: () => this.current(session) && session.held });
        } catch { if (this.current(session)) this.fail(session, 'VOICE_PREPARATION_FAILED'); else this.contextChanged(); return; }
        // The opener may finish after release, navigation, timeout or a newer gesture.
        // Never let such a receipt acquire a microphone or a provider connection.
        if (!this.current(session) || !session.held) { this.contextChanged(); return; }
        if (!prepared?.conversationId || !prepared.adopt()) { this.fail(session, 'VOICE_PREPARATION_FAILED'); return; }
        // Publish the id and update identity in the same synchronous step: a render
        // must never observe the new conversation with the old gesture identity.
        const next = { ...session.identity, conversationId: prepared.conversationId };
        if (!sameScope(this.options.getScope(), next)) { this.cancel('account'); return; }
        session.identity = Object.freeze(next);
        this.update({ session: session.identity });
      }
      if (this.options.isAiSpeaking?.()) { this.fail(session, 'AI_SPEAKING'); return; }
      this.update({ phase: 'STARTING' });
      const capture = adapter.createCapture({ session: session.identity, signal: session.abort.signal,
        canCapture: () => this.current(session) && session.held && !this.options.isAiSpeaking?.(),
        onEvent: event => this.receive(session, event) });
      // Register before async start so release/background can close pending native acquisitions.
      session.capture = capture;
      if (!this.current(session) || !session.held) { this.closeCapture(session); return; }
      await capture.start();
      if (!this.current(session) || !session.held) { this.closeCapture(session); this.contextChanged(); return; }
      this.update({ phase: 'LISTENING' });
      this.deadline(session, this.options.limits.captureMs, 'CAPTURE_TIMEOUT');
    } catch {
      if (this.current(session)) this.fail(session, 'CAPTURE_FAILED');
      else { this.closeCapture(session); this.contextChanged(); }
    }
  }

  private receive(session: ActiveSession, event: SpeechEvent) {
    if (!this.current(session)) { this.contextChanged(); return; }
    if (session.completed || !['STARTING', 'LISTENING', 'FINALIZING'].includes(this.snapshot.phase)) return;
    if (event.kind === 'error') { this.fail(session, event.code); return; }
    if (event.kind === 'level') {
      if (session.held) this.update({ audioLevel: typeof event.value === 'number' && Number.isFinite(event.value)
        && event.value >= 0 && event.value <= 1 ? event.value : null });
      return;
    }
    if (!Number.isSafeInteger(event.index) || event.index < 0 || event.index > MAX_TEXT
      || !safeText(event.text) || typeof event.final !== 'boolean') { this.fail(session, 'TRANSCRIPT_INVALID'); return; }
    const previous = session.segments.get(event.index);
    // Duplicate finals and late hypotheses never replace already-final words.
    if (previous?.final) return;
    const text = toSerbianLatin(event.text.trim());
    const candidate = new Map(session.segments);
    candidate.set(event.index, { text, final: event.final });
    if ([...candidate.values()].map(part => part.text).join(' ').trim().length > MAX_TEXT) {
      this.fail(session, 'TRANSCRIPT_TOO_LONG'); return;
    }
    session.segments.set(event.index, { text, final: event.final });
    const segments = [...session.segments].sort(([a], [b]) => a - b).map(([, value]) => value);
    this.update({ finalText: segments.filter(part => part.final).map(part => part.text).join(' ').trim(),
      interimText: segments.filter(part => !part.final).map(part => part.text).join(' ').trim() });
  }

  release(gestureId: string): void {
    const session = this.active;
    if (!session || session.identity.gestureId !== gestureId || !session.held) return;
    if (!this.current(session)) { this.contextChanged(); return; }
    session.held = false;
    if (this.snapshot.phase !== 'LISTENING' || !session.capture) { this.cancel('gesture'); return; }
    this.update({ phase: 'FINALIZING', audioLevel: null });
    this.deadline(session, this.options.limits.finalizationMs, 'FINALIZATION_TIMEOUT');
    try { session.capture.stopCapture(); }
    catch { this.fail(session, 'FINALIZATION_FAILED'); return; }
    void this.finish(session);
  }

  private async finish(session: ActiveSession) {
    let result: FinalTranscript;
    try { result = await session.capture!.finalize(); }
    catch { if (this.current(session)) this.fail(session, 'FINALIZATION_FAILED'); else this.contextChanged(); return; }
    if (!this.current(session) || session.completed) { this.contextChanged(); return; }
    if (!result || result.kind !== 'final') { this.fail(session, 'FINAL_TRANSCRIPT_MISSING'); return; }
    if (!safeText(result.text)) { this.fail(session, 'TRANSCRIPT_INVALID'); return; }
    if (!result.text.trim()) { this.fail(session, 'FINAL_TRANSCRIPT_MISSING'); return; }
    const text = toSerbianLatin(result.text.trim());
    if (text.length > MAX_TEXT) { this.fail(session, 'TRANSCRIPT_TOO_LONG'); return; }
    const transcript = Object.freeze({ session: session.identity, text });
    session.completed = true;
    this.clearDeadline(session);
    this.closeCapture(session);
    let accepted = false;
    try {
      if (!this.current(session)) { this.contextChanged(); return; }
      accepted = this.options.onTranscript({ ...transcript, isCurrent: () => this.current(session) }) === true;
    } catch { /* Keep the confirmed text locally; never expose a callback error. */ }
    if (!this.current(session)) { this.contextChanged(); return; }
    this.terminate(session);
    this.update({ ...blank(), session: session.identity, fallbackText: accepted ? '' : transcript.text,
      error: accepted ? null : 'DRAFT_NOT_ACCEPTED' });
  }

  cancel(reason: VoiceCancelReason): void {
    const session = this.active;
    if (session) this.terminate(session);
    // No private transient text carries across account, navigation or explicit cancellation.
    this.update(blank());
  }

  /** Move retained speech into the current editable composer once, without dispatching it. */
  useFallback(accept: (text: string) => boolean): boolean {
    this.contextChanged();
    const previous = this.snapshot;
    if (this.active || previous.phase !== 'IDLE' || !previous.fallbackText) return false;
    let accepted = false;
    try { accepted = accept(previous.fallbackText) === true; } catch { /* Keep the editable fallback. */ }
    this.contextChanged();
    if (!accepted || this.snapshot !== previous) return false;
    this.update(blank());
    return true;
  }

  /** Call synchronously on Auth/context changes, including A→B→A incarnations. */
  contextChanged(): void {
    const identity = this.active?.identity ?? this.snapshot.session;
    if (identity && !sameScope(this.options.getScope(), identity)) this.cancel('account');
  }

  setForeground(foreground: boolean): void {
    this.foreground = foreground;
    if (!foreground) this.cancel('background');
  }

  interrupt(): void {
    const session = this.active;
    if (session && !session.completed) this.fail(session, 'AUDIO_INTERRUPTED');
  }

  dispose(): void {
    if (this.disposed) return;
    this.cancel('dispose');
    this.disposed = true;
    this.listeners.clear();
  }
}
