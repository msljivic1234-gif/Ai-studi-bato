import { createAudioArbiter } from './ports';

/** One process-wide owner for AI speech, voice-message recording and both players. */
export const sharedAudioArbiter = createAudioArbiter();
