import { createConfiguredLocationResolver } from './configuredLocationResolver';
import { supabaseKlijent, supabaseKonfigurisan } from './supabaseClient';
import { readPublicSupabaseConfig } from './publicSupabaseConfig';
import { sesijaSada } from '../store/sesija';

/** Only the app's authenticated Edge endpoint is reachable from the native editor. */
export function createProductionLocationResolver() {
  // Owner-approved provider identity is public. Its access token exists only in Edge.
  const providerHint = 'locationiq';
  const config = readPublicSupabaseConfig();
  if (!config || !supabaseKonfigurisan()) return createConfiguredLocationResolver();
  const baseUrl = config.url;
  const owner = sesijaSada(), accountId = owner.user?.id, incarnation = owner.accountRevision;
  const owns = () => !!accountId && sesijaSada().user?.id === accountId && sesijaSada().accountRevision === incarnation;
  return createConfiguredLocationResolver({ endpoint: `${baseUrl.replace(/\/$/, '')}/functions/v1/uskoci-location-search`, providerHint,
    getAccessToken: async () => {
      if (!owns()) return null;
      const { data, error } = await supabaseKlijent().auth.getSession();
      const session = data.session;
      return !error && owns() && session && session.user.id === accountId ? session.access_token : null;
    },
  }, async (_endpoint, init) => {
    if (!owns() || init.signal?.aborted) throw new Error('LOCATION_SESSION_CHANGED');
    const headers = new Headers(init.headers);
    const { data, error } = await supabaseKlijent().functions.invoke('uskoci-location-search', {
      body: JSON.parse(String(init.body)), headers: { Authorization: headers.get('Authorization') ?? '' },
      signal: init.signal ?? undefined,
    });
    if (!owns() || init.signal?.aborted) throw new Error('LOCATION_SESSION_CHANGED');
    const status = error && 'context' in error && error.context instanceof Response ? error.context.status : undefined;
    return { ok: !error, status, redirected: false, json: async () => data };
  });
}
