/** A bounded read failure category. Never retain provider/SQL prose, URLs, payloads or a stack in UI state. */
export type ReadFailureReason = 'AUTH_REQUIRED' | 'FORBIDDEN' | 'CONTRACT' | 'NETWORK' | 'TIMEOUT' | 'UNAVAILABLE';

const known: Readonly<Record<string, ReadFailureReason>> = {
  AUTH_REQUIRED: 'AUTH_REQUIRED', AUTH_ACCOUNT_CHANGED: 'AUTH_REQUIRED',
  PGRST301: 'AUTH_REQUIRED', PGRST302: 'AUTH_REQUIRED', '28000': 'AUTH_REQUIRED', '28P01': 'AUTH_REQUIRED',
  '42501': 'FORBIDDEN', ACCOUNT_CLOSED: 'FORBIDDEN',
  OPPORTUNITIES_RESPONSE_INVALID: 'CONTRACT', OPPORTUNITIES_TOO_MANY_PAGES: 'CONTRACT',
  NEED_DETAIL_INVALID_PROJECTION: 'CONTRACT', NEED_ACTIONABLE_COUNT_INVALID: 'CONTRACT',
  TASK_CAPACITY_INVALID: 'CONTRACT', TASK_DEADLINE_INVALID: 'CONTRACT', TASK_REMAINING_SEARCH_STATE_INVALID: 'CONTRACT',
  PGRST202: 'CONTRACT', PGRST203: 'CONTRACT', '22023': 'CONTRACT',
  MARKETPLACE_READ_TIMEOUT: 'TIMEOUT', TASK_RELATIONS_READ_TIMEOUT: 'TIMEOUT',
  DISCOVERY_V1_READ_TIMEOUT: 'TIMEOUT', '57014': 'TIMEOUT',
  'Network request failed': 'NETWORK', 'Failed to fetch': 'NETWORK',
  'TypeError: Network request failed': 'NETWORK', 'TypeError: Failed to fetch': 'NETWORK',
  'NetworkError when attempting to fetch resource.': 'NETWORK',
};

/** Known transport/domain identifiers only; an unfamiliar refusal is not evidence of a bad internet connection. */
export function readFailureReason(error: unknown): ReadFailureReason {
  if (!error || typeof error !== 'object') return 'UNAVAILABLE';
  const { code, message } = error as { code?: unknown; message?: unknown };
  for (const value of [code, message]) {
    if (typeof value === 'string' && Object.prototype.hasOwnProperty.call(known, value)) return known[value];
  }
  return 'UNAVAILABLE';
}
