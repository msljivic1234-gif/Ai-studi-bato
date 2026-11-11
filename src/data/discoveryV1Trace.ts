import Constants from 'expo-constants';

/** The exact DEV package of the disposable-stack proof builds and the DEV checkpoints. A store build never logs. */
const TRACE_PACKAGE = 'rs.uskoci.dev';
const CODE = /^[A-Z][A-Z0-9_]{5,80}$/;
const MAX_LINES = 240;
/** The short lines that come once per touch (`pin`) or per camera move (`settled`) have a budget of their own each, so that a long session cannot use up the diagnosis lines. */
const OWN_BUDGET: Partial<Record<DiscoveryV1TraceEvent, number>> = { pin: 400, settled: 400 };
const used: Partial<Record<DiscoveryV1TraceEvent | 'diagnosis', number>> = {};

/** The stable code an owner, contract or transport error carries (`DISCOVERY_V1_...`); anything else is only "UNCODED". */
export function discoveryV1ErrorCode(error: unknown): string {
  const message = error instanceof Error ? error.message : '';
  return CODE.test(message) ? message : 'UNCODED';
}

export type DiscoveryV1TraceEvent = 'restored' | 'restore-failed' | 'read-failed' | 'markers' | 'settled' | 'pin' | 'warm';

/**
 * Bounded diagnosis of why the P6 screen ends in its error state, for the DEV package only: a fixed event name and one fixed error code
 * or two counts (`settled`: how a settled camera move was classified; `pin`: milliseconds to the touched bucket's halo and to its card data; `warm`: a return that showed the kept
 * picture, its age in seconds and its rows). No task, person,
 * request, bounds or free text, and at most MAX_LINES lines per app run (and OWN_BUDGET lines of each of the short `pin` and `settled` lines).
 */
export function traceDiscoveryV1(event: DiscoveryV1TraceEvent, detail: string | null = null) {
  const budget = OWN_BUDGET[event] === undefined ? 'diagnosis' : event;
  if (Constants.expoConfig?.android?.package !== TRACE_PACKAGE || (used[budget] ?? 0) >= (OWN_BUDGET[event] ?? MAX_LINES)) return;
  if (detail !== null && !CODE.test(detail) && !/^\d{1,4}\/\d{1,4}$/.test(detail)) return;
  used[budget] = (used[budget] ?? 0) + 1;
  console.info(`[USKOCI_P6_TRACE] ${JSON.stringify([event, detail])}`);
}
