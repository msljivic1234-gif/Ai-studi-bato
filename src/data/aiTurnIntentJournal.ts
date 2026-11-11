import { createTurnIntentJournal, type TurnIntent } from '../features/ai/intake/turnIntentJournal';

export type AiTurnIntent = TurnIntent;
/** Need-intake unknown-outcome owner. The persisted key and all errors remain unchanged. */
export const aiTurnIntentJournal = createTurnIntentJournal('need');
