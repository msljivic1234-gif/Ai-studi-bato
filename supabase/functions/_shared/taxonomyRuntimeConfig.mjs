import { readSupabasePublishableKey } from './supabaseKeys.mjs';
/**
 * Single-pass intake admission (A30-D04/D05, C10). Missing/false config is
 * default OFF, including on DEV. The historical DUAL_GEMINI key still gates
 * the single-response intake and still needs verified DEV scope/paid admission.
 * The key is retained for rollout compatibility, not a second provider call.
 *
 * This is not provider budget authority. Every paid operation still passes the
 * current reservation, durable turn and usage fences. No URL, ref or secret is
 * embedded in the source and no request/client input can enable a feature.
 */
export function taxonomyIntakeEnabled(get) {
  if (typeof get !== 'function' || get('USKOCI_TAXONOMY_DUAL_GEMINI') !== 'true'
    || get('USKOCI_GEMINI_PAID_TEST_ENABLED') !== 'true'
    || !readSupabasePublishableKey(get) || get('USKOCI_TAXONOMY_ROLLOUT_SCOPE') !== 'DEV') return false;
  const allowed = get('USKOCI_TAXONOMY_ALLOWED_PROJECT_REF');
  if (typeof allowed !== 'string' || !/^[a-z0-9]{20}$/.test(allowed)) return false;
  try {
    const target = new URL(get('SUPABASE_URL') ?? '');
    // Permit the platform's standard trailing slash, but no alternate paths,
    // embedded credentials, query, port, or lookalike host.
    return target.protocol === 'https:' && target.username === '' && target.password === ''
      && !target.port && target.pathname === '/' && !target.search && !target.hash
      && target.hostname === allowed + '.supabase.co';
  } catch { return false; }
}
