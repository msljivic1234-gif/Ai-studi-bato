export type MessagePushOwner = { accountId: string; accountRevision: number; sessionEpoch: number };
export type MessagePushIntent = MessagePushOwner & { serial: number; eventId: string; eventType: 'MESSAGE_RECEIVED' | 'OPPORTUNITY_AVAILABLE' | 'RESPONSE_RECEIVED' | 'RESPONSE_UPDATED'; at: number; coldRoute: number | null };
let intent: MessagePushIntent | null = null;
let serial = 0;
const listeners = new Set<() => void>();
const emit = () => { for (const listener of listeners) listener(); };

/** Memory-only event hint. Neither a message nor a task id, receipt or durable command. */
export const messagePushIntent = {
  snapshot: () => intent,
  subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
  remember(eventId: string, owner: MessagePushOwner, coldRoute: number | null) {
    intent = { ...owner, eventId, eventType: 'MESSAGE_RECEIVED', coldRoute, serial: ++serial, at: Date.now() }; emit();
  },
  rememberOpportunity(eventId: string, owner: MessagePushOwner, coldRoute: number | null) {
    intent = { ...owner, eventId, eventType: 'OPPORTUNITY_AVAILABLE', coldRoute, serial: ++serial, at: Date.now() }; emit();
  },
  rememberApplication(eventId: string, eventType: 'RESPONSE_RECEIVED' | 'RESPONSE_UPDATED', owner: MessagePushOwner, coldRoute: number | null) {
    intent = { ...owner, eventId, eventType, coldRoute, serial: ++serial, at: Date.now() }; emit();
  },
  retire(expected: number) { if (intent?.serial === expected) { intent = null; emit(); } },
  clear() { if (intent) { intent = null; emit(); } },
};

export function ownsMessagePush(value: MessagePushIntent, owner: MessagePushOwner): boolean {
  return value.accountId === owner.accountId && value.accountRevision === owner.accountRevision
    && value.sessionEpoch === owner.sessionEpoch;
}
