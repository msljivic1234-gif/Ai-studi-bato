/** Test doubles for the three voice platform seams. Only tests import this file; nothing here reaches a production bundle. */
import type { InterruptReason, PermissionAnswer, PlayerStatus, RecordedFile, VoiceFilePort, VoicePlayerPort, VoiceRecorderPort } from '../ports';

export function createFakeRecorder(initial: Partial<{ permission: PermissionAnswer; file: RecordedFile }> = {}) {
  const interruptions = new Set<(reason: InterruptReason) => void>(), levels = new Set<(level: number) => void>();
  const state = { permission: initial.permission ?? ('granted' as PermissionAnswer), file: initial.file ?? { uri: 'file:///cache/voice-1.m4a', durationMs: 4200 },
    startError: false, stopError: false, recording: false, started: 0, stopped: 0, cancelled: 0, permissionAsked: 0 };
  const port: VoiceRecorderPort = {
    requestPermission: async () => { state.permissionAsked += 1; return state.permission; },
    start: async () => { if (state.startError) throw new Error('START'); state.recording = true; state.started += 1; },
    stop: async () => { if (state.stopError) throw new Error('STOP'); state.recording = false; state.stopped += 1; return state.file; },
    cancel: async () => { state.recording = false; state.cancelled += 1; },
    onInterrupted: listener => { interruptions.add(listener); return () => { interruptions.delete(listener); }; },
    onLevel: listener => { levels.add(listener); return () => { levels.delete(listener); }; },
  };
  return { port, state, interrupt: (reason: InterruptReason = 'BACKGROUND') => { for (const listener of [...interruptions]) listener(reason); },
    level: (value: number) => { for (const listener of [...levels]) listener(value); }, listenerCount: () => interruptions.size + levels.size };
}

export function createFakePlayer() {
  const listeners = new Set<(status: PlayerStatus) => void>();
  const state = { loaded: null as string | null, playing: false, positionMs: 0, calls: [] as string[], loadError: false, playError: false, released: 0 };
  const emit = (patch: Partial<PlayerStatus> = {}) => { const status: PlayerStatus = { positionMs: state.positionMs, durationMs: 4200, playing: state.playing, ended: false, ...patch }; for (const l of [...listeners]) l(status); };
  const port: VoicePlayerPort = {
    load: async uri => { state.calls.push('load:' + uri); if (state.loadError) throw new Error('LOAD'); state.loaded = uri; state.positionMs = 0; state.playing = false; },
    play: async () => { state.calls.push('play'); if (state.playError) throw new Error('PLAY'); state.playing = true; emit(); },
    pause: async () => { state.calls.push('pause'); state.playing = false; emit(); },
    stop: async () => { state.calls.push('stop'); state.playing = false; state.positionMs = 0; },
    seek: async ms => { state.calls.push('seek:' + ms); state.positionMs = ms; emit(); },
    onStatus: listener => { listeners.add(listener); return () => { listeners.delete(listener); }; },
    release: async () => { state.calls.push('release'); state.released += 1; state.loaded = null; },
  };
  return { port, state, emit, progress: (positionMs: number) => { state.positionMs = positionMs; emit({ positionMs }); }, finish: () => { state.playing = false; emit({ ended: true, playing: false }); },
    listenerCount: () => listeners.size };
}

export function createFakeFiles(initial: Record<string, ArrayBuffer> = {}) {
  const files = new Map<string, ArrayBuffer>(Object.entries(initial));
  const log = { removed: [] as string[], written: [] as string[], purged: 0 };
  const state = { readError: false, writeError: false, removeError: false, next: 0 };
  const port: VoiceFilePort = {
    read: async uri => { if (state.readError || !files.has(uri)) throw new Error('READ'); return files.get(uri)!; },
    writeTemp: async (name, bytes) => { if (state.writeError) throw new Error('WRITE'); const uri = `file:///tmp/${name}#${state.next += 1}`; files.set(uri, bytes); log.written.push(uri); return uri; },
    remove: async uri => { if (state.removeError) throw new Error('REMOVE'); files.delete(uri); log.removed.push(uri); },
    purgeAll: async () => { files.clear(); log.purged += 1; },
  };
  return { port, files, log, state, put: (uri: string, size = 64) => { files.set(uri, new ArrayBuffer(size)); } };
}
