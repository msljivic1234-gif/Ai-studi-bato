export type PublicPushTarget = { kind: 'INBOX' }
  | { kind: 'MESSAGE_EVENT' | 'OPPORTUNITY_EVENT'; eventId: string }
  | { kind: 'APPLICATION_EVENT'; eventId: string; eventType: 'RESPONSE_RECEIVED' | 'RESPONSE_UPDATED' };

/** Provider metadata supplies an opaque event, never a route or message body. */
export function publicPushTarget(value: unknown): PublicPushTarget | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const data = value as Record<string, unknown>;
  if (data.kind !== 'INBOX') return null;
  if (Object.keys(data).length === 1) return { kind: 'INBOX' };
  if (Object.keys(data).length !== 3 || !['MESSAGE_RECEIVED', 'OPPORTUNITY_AVAILABLE', 'RESPONSE_RECEIVED', 'RESPONSE_UPDATED'].includes(String(data.eventType))
    || typeof data.eventId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(data.eventId)) return null;
  if (data.eventType === 'RESPONSE_RECEIVED' || data.eventType === 'RESPONSE_UPDATED')
    return { kind: 'APPLICATION_EVENT', eventId: data.eventId.toLowerCase(), eventType: data.eventType };
  return { kind: data.eventType === 'MESSAGE_RECEIVED' ? 'MESSAGE_EVENT' : 'OPPORTUNITY_EVENT', eventId: data.eventId.toLowerCase() };
}
