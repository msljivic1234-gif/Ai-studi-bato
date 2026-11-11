import { createTurnIntentJournal, type TurnIntent } from '../features/ai/intake/turnIntentJournal';

export type WorkerAiTurnIntent = TurnIntent;
/** Worker-intake unknown-outcome owner. Its persisted key remains independent of Need. */
export const workerAiTurnIntentJournal = createTurnIntentJournal('worker');
