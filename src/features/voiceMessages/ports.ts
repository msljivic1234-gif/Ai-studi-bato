/**
 * Voice messages: the three platform seams. Everything above them (the recording-to-sending model, the playback model, the screen hooks) is plain
 * TypeScript against these interfaces and is tested with fakes; the `expo-audio` and file-system adapters implement them and are the only place a
 * native module is touched. One audio owner at a time is enforced by `audioArbiter`, never by the adapters.
 */
/**
 * `later`: the person answered "Ne sada" to the question that comes before the system's window (ui/permissions). The system was
 * not asked and nothing went wrong, so the recording simply does not start and no message is shown.
 */
export type PermissionAnswer = 'granted' | 'denied' | 'blocked' | 'unavailable' | 'later';
/** A finished recording: a file in the app's private cache and its real duration. The bytes stay in that file until it is uploaded or discarded. */
export type RecordedFile = Readonly<{ uri: string; durationMs: number }>;
export type InterruptReason = 'BACKGROUND' | 'AUDIO_FOCUS' | 'FAILED';

export interface VoiceRecorderPort {
  requestPermission(): Promise<PermissionAnswer>;
  /** Starts ONE mono AAC M4A recording into the private cache; resolves only when audio is really being captured. */
  start(): Promise<void>;
  /** Finalizes the file and returns it. */
  stop(): Promise<RecordedFile>;
  /** Stops and deletes whatever was recorded. Idempotent. */
  cancel(): Promise<void>;
  /** Fires when the platform takes the microphone away (background, a call, a failure). Returns the unsubscribe. */
  onInterrupted(listener: (reason: InterruptReason) => void): () => void;
  /** A 0..1 input level for a live meter, where the platform offers one. Optional: nothing depends on it. */
  onLevel?(listener: (level: number) => void): () => void;
}

export type PlayerStatus = Readonly<{ positionMs: number; durationMs: number | null; playing: boolean; ended: boolean }>;
export interface VoicePlayerPort {
  /** Prepares a local file for playback (a recording under review, or a downloaded message). Replaces whatever was loaded. */
  load(uri: string): Promise<void>;
  play(): Promise<void>;
  pause(): Promise<void>;
  /** Stops and rewinds. The file stays loaded until the next load or release. */
  stop(): Promise<void>;
  seek(positionMs: number): Promise<void>;
  onStatus(listener: (status: PlayerStatus) => void): () => void;
  /** Frees the native player. Idempotent. */
  release(): Promise<void>;
}

export interface VoiceFilePort {
  /** The whole file, for the upload. */
  read(uri: string): Promise<ArrayBuffer>;
  /** A temporary file for a downloaded message; the name is a safe leaf, never a path. */
  writeTemp(name: string, bytes: ArrayBuffer): Promise<string>;
  remove(uri: string): Promise<void>;
  /** Removes every temporary voice file of this app (logout, account change). */
  purgeAll(): Promise<void>;
}

/** Exactly one of these owns the speaker or the microphone; claiming releases the previous owner first. */
export type AudioOwner = 'recording' | 'preview' | 'playback' | 'speech';
/** Release only after native teardown succeeds; use isCurrent after awaited setup. */
export type AudioLease = (() => void) & { isCurrent(): boolean };
export function createAudioArbiter() {
  let owner: { kind: AudioOwner; release: () => void | Promise<void>; revoked: boolean } | null = null;
  let queue: Promise<void> = Promise.resolve();
  return {
    /** Returns a release function for the claim. `release` is called when another owner claims, never when this owner releases itself. */
    claim(kind: AudioOwner, release: () => void | Promise<void>): Promise<AudioLease> {
      const claim = queue.then(async () => {
        const previous = owner;
        if (previous) {
          previous.revoked = true;
          try { await previous.release(); }
          catch (error) {
            // A caller may have cleared its lease before discovering native teardown
            // failed. Retain the exclusion fence: no second microphone/player starts.
            owner = previous;
            throw error;
          }
        }
        const mine = { kind, release, revoked: false }; owner = mine;
        return Object.assign(() => { if (owner === mine) owner = null; }, {
          isCurrent: () => owner === mine && !mine.revoked,
        });
      });
      // All handoffs wait for teardown, including handoffs queued in the same tick.
      // A failed request does not poison the queue; the retained owner is retried.
      queue = claim.then(() => undefined, () => undefined);
      return claim;
    },
    current: (): AudioOwner | null => owner?.kind ?? null,
  };
}
export type AudioArbiter = ReturnType<typeof createAudioArbiter>;
