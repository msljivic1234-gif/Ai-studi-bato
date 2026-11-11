import type { AiNeedMessage } from '../../contracts/aiNeedV2';
import type { LocationDialogueReceipt } from '../../contracts/locationDialogue';

export type IntakeTurnRole = 'ordinary' | LocationDialogueReceipt['action'];
type Released = { ids: readonly string[]; after: string | null; confirmationKey: string };
export type IntakeLocationOrder = {
  scope: string; seen: ReadonlySet<string>; active: readonly string[] | null; released: readonly Released[];
};

const remembered = new Map<string, IntakeLocationOrder>();
let memoryOwner: string | null = null;
let memoryGeneration = 0;
/** Bounded process memory, scoped to the account revision. Never persisted to disk. */
export function intakeLocationMemory(owner: string) {
  if (memoryOwner !== owner) { remembered.clear(); memoryOwner = owner; memoryGeneration++; }
  const generation = memoryGeneration;
  return {
    generation,
    read: (scope: string) => memoryOwner === owner && memoryGeneration === generation ? remembered.get(scope) ?? null : null,
    write: (scope: string, state: IntakeLocationOrder) => {
      if (memoryOwner !== owner || memoryGeneration !== generation) return;
      remembered.delete(scope); remembered.set(scope, state);
      if (remembered.size > 50) remembered.delete(remembered.keys().next().value!);
    },
  };
}

/** Presentation only. Retains IDs, never message text or private location values. Canonical history is never edited. */
export function orderIntakeLocation(previous: IntakeLocationOrder | null, input: {
  scope: string; messages: readonly AiNeedMessage[]; roles: Readonly<Record<string, IntakeTurnRole>>;
  causalMessageId?: string; pendingLocation: boolean; confirmedLocation: boolean; canRelease: boolean;
  preserveHistory: boolean; confirmationKey: string;
}) {
  const base = previous?.scope === input.scope ? previous : { scope: input.scope, seen: new Set<string>(), active: null, released: [] };
  const { messages, roles } = input;
  let active = base.active, released = [...base.released];
  // Ordinary turns can still ask for a material clarification. Keep that question visible
  // before the map is confirmed, including a later authoritative readback of a held turn.
  const clarifications = new Set(messages.filter(message => message.fromAi && (message.safety === 'CLARIFY'
    || roles[message.id] === 'CLARIFY' || roles[message.id] === 'CORRECT' || roles[message.id] === 'CONTINUE'
    // Ordinary AI replies can end in a real question (e.g. a date clarification).
    // It must be readable before a map takes focus, including after signed readback.
    || /[?？]\s*$/.test(message.body))).map(message => message.id));
  if (active !== null) active = active.filter(id => !clarifications.has(id));
  released = released.map(span => ({ ...span, ids: span.ids.filter(id => !clarifications.has(id)) })).filter(span => span.ids.length > 0);
  const alreadyReleased = new Set(released.flatMap(span => [...span.ids]));
  // CONTINUE is an answer without map confirmation, including "why do you need the map?".
  // It must be readable now; only a genuine confirmation waits for canonical point readback.
  const continuing = (id: string) => roles[id] === 'ordinary' || roles[id] === 'CONFIRM_DISPLAYED';
  const lastUser = messages.reduce((last, message, index) => message.fromAi ? last : index, -1);
  if (input.preserveHistory) active = null;
  else if (input.pendingLocation || active !== null) {
    const held = new Set(active ?? []);
    for (const [index, message] of messages.entries()) {
      if (!message.fromAi || alreadyReleased.has(message.id) || clarifications.has(message.id)) continue;
      const causal = active === null && index > lastUser && message.id === input.causalMessageId;
      if (causal || (!base.seen.has(message.id) && continuing(message.id))) held.add(message.id);
    }
    active = [...held];
  }
  if (active !== null && input.confirmedLocation && input.canRelease && !input.preserveHistory) {
    const ids = new Set(active), after = messages.filter(message => !ids.has(message.id)).at(-1)?.id ?? null;
    released.push({ ids: active, after, confirmationKey: input.confirmationKey }); active = null;
  }
  const hidden = new Set(active ?? []);
  let display = messages.filter(message => !hidden.has(message.id));
  // Keep each released continuation at its original release point when later turns arrive.
  for (const span of released) {
    const ids = new Set(span.ids), tail = display.filter(message => ids.has(message.id));
    if (!tail.length) continue;
    display = display.filter(message => !ids.has(message.id));
    const index = span.after === null ? 0 : display.findIndex(message => message.id === span.after) + 1;
    display.splice(index, 0, ...tail);
  }
  const placement = [...released].reverse().find(span => span.confirmationKey === input.confirmationKey);
  return { state: { scope: input.scope, seen: new Set(messages.map(message => message.id)), active, released } as IntakeLocationOrder,
    messages: display, placement };
}
