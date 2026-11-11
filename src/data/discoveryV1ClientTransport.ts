import type { DiscoveryV1OwnerTransport, DiscoveryV1OwnerRequest } from './discoveryV1Owner';
import { supabaseKlijent } from './supabaseClient';

type RpcRequest = {
  abortSignal?: (signal: AbortSignal) => Promise<{ data: unknown; error: { message?: unknown } | null }>;
  then?: Promise<{ data: unknown; error: { message?: unknown } | null }>['then'];
};
type RpcClient = {
  rpc: (name: string, args: { p_request: DiscoveryV1OwnerRequest }) => RpcRequest | Promise<{ data: unknown; error: { message?: unknown } | null }>;
};

/**
 * A read nobody answers ends here (the other Zadaci reads use the same 15 s). React Native has no request timeout on Android, so without it an owner would wait for ever
 * and the screen would stay on its last picture for ever.
 */
export const DISCOVERY_V1_READ_DEADLINE_MS = 15_000;
/** The code of the one refusal that is about the person and not about the read: "Za mene" needs an active work profile. */
export const DISCOVERY_V1_FOR_ME_REFUSED = 'DISCOVERY_V1_FOR_ME_PROFILE_REQUIRED';

/**
 * P6 transport only. It is intentionally not exported through Izvor and is not referenced by a route.
 * The production switch stays off until the server rollout/performance/native gates are accepted.
 */
export function createDiscoveryV1SupabaseTransport(client: RpcClient = supabaseKlijent() as unknown as RpcClient): DiscoveryV1OwnerTransport {
  return async (request, signal) => {
    if (signal.aborted) throw new Error('DISCOVERY_V1_READ_ABORTED');
    // The request has a signal of its own: the deadline stops this one request and never touches the signal of the caller. Whatever the client does with it, the read ends
    // when the caller aborts or the deadline passes, and it is never retried.
    const own = new AbortController();
    let timedOut = false, timer: ReturnType<typeof setTimeout> | undefined, onAbort = () => {};
    const ended = new Promise<never>((_, reject) => {
      timer = setTimeout(() => { timedOut = true; own.abort(); reject(new Error('DISCOVERY_V1_READ_TIMEOUT')); }, DISCOVERY_V1_READ_DEADLINE_MS);
      onAbort = () => { own.abort(); reject(new Error('DISCOVERY_V1_READ_ABORTED')); };
      signal.addEventListener('abort', onAbort, { once: true });
    });
    let response: { data: unknown; error: { message?: unknown } | null };
    try {
      const pending = client.rpc('rpc_discovery_v1', { p_request: request }) as RpcRequest;
      const sent = typeof pending.abortSignal === 'function' ? pending.abortSignal(own.signal) : pending as Promise<typeof response>;
      response = await Promise.race([sent, ended]);
    } catch {
      if (signal.aborted) throw new Error('DISCOVERY_V1_READ_ABORTED');
      throw new Error(timedOut ? 'DISCOVERY_V1_READ_TIMEOUT' : 'DISCOVERY_V1_READ_FAILED');
    } finally {
      clearTimeout(timer); signal.removeEventListener('abort', onAbort);
    }
    if (signal.aborted) throw new Error('DISCOVERY_V1_READ_ABORTED');
    // Only three server refusals are named: the session (AUTH_REQUIRED), an anchor that lived out its 30 minutes (P6_ANCHOR_EXPIRED), which the route renews with one fresh open,
    // and "Za mene" asked of a person with no active work profile (P6_FOR_ME_PROFILE_REQUIRED), which the screen answers by turning the switch off and saying why.
    // Everything else, an invalid anchor included, stays the generic failure; no provider text is passed on.
    if (response.error) {
      const message = response.error.message;
      throw new Error(message === 'AUTH_REQUIRED' ? 'AUTH_REQUIRED' : message === 'P6_ANCHOR_EXPIRED' ? 'DISCOVERY_V1_ANCHOR_EXPIRED'
        : message === 'P6_FOR_ME_PROFILE_REQUIRED' ? DISCOVERY_V1_FOR_ME_REFUSED : 'DISCOVERY_V1_READ_FAILED');
    }
    return response.data;
  };
}
