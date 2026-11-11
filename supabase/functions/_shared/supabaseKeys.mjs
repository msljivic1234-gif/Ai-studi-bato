/** Supabase key migration boundary. No key values are logged or returned to clients.
 * Modern Edge env values are JSON maps; only the explicitly named `default`
 * key is selected. A present but invalid map must never fall back silently.
 * Missing/true USKOCI_LEGACY_SUPABASE_KEYS_ENABLED preserves the deployed
 * transition. False (or another present value) retires the legacy paths here,
 * including platform-injected old values. This is NOT API-key revocation;
 * migrate callers and deactivate legacy keys through Supabase separately.
 */
const MAX_KEY_LENGTH = 4096;
const modernKey = (key, prefix) => typeof key === 'string' && key.length <= MAX_KEY_LENGTH
  && key.startsWith(prefix) && /^[A-Za-z0-9_-]+$/.test(key.slice(prefix.length));
const legacyKey = (key, prefix) => typeof key === 'string' && key.length <= MAX_KEY_LENGTH
  && /^[A-Za-z0-9._~-]+$/.test(key)
  && (!key.startsWith('sb_') || modernKey(key, prefix));

function legacyKeysEnabled(get) {
  const setting = get('USKOCI_LEGACY_SUPABASE_KEYS_ENABLED');
  return setting === undefined || setting === 'true';
}

function readKey(get, modernName, legacyName, prefix) {
  if (typeof get !== 'function') return null;
  const raw = get(modernName);
  if (raw === undefined) {
    if (!legacyKeysEnabled(get)) return null;
    const old = get(legacyName);
    return legacyKey(old, prefix) ? old : null;
  }
  if (typeof raw !== 'string' || !raw.length || raw.length > 65536) return null;
  try {
    const keys = JSON.parse(raw);
    if (!keys || typeof keys !== 'object' || Array.isArray(keys)
      || !Object.hasOwn(keys, 'default') || !modernKey(keys.default, prefix)) return null;
    return keys.default;
  } catch { return null; }
}

export const readSupabaseServiceKey = get => readKey(get, 'SUPABASE_SECRET_KEYS', 'SUPABASE_SERVICE_ROLE_KEY', 'sb_secret_');
export const readSupabasePublishableKey = get => readKey(get, 'SUPABASE_PUBLISHABLE_KEYS', 'SUPABASE_ANON_KEY', 'sb_publishable_');

/** Modern keys belong only on apikey. Headers normalizes case and also handles
 * a Headers instance, so a stale hidden Authorization cannot survive a spread.
 * An actual user JWT is set separately by the user-scoped request path.
 */
export function supabaseServiceHeaders(key, extra) {
  if (!legacyKey(key, 'sb_secret_')) throw new Error('SUPABASE_SERVICE_KEY_UNAVAILABLE');
  const headers = new Headers(extra);
  headers.delete('authorization');
  headers.set('apikey', key);
  if (!modernKey(key, 'sb_secret_')) headers.set('authorization', 'Bearer ' + key);
  return Object.fromEntries(headers.entries());
}

/** No early exit on a differing byte. Length is bounded before allocation. */
function sameKey(presented, expected) {
  if (presented.length > MAX_KEY_LENGTH || expected.length > MAX_KEY_LENGTH) return false;
  const actual = new TextEncoder().encode(presented), configured = new TextEncoder().encode(expected);
  let difference = actual.length ^ configured.length;
  for (let i = 0; i < Math.max(actual.length, configured.length); i++)
    difference |= (actual[i] ?? 0) ^ (configured[i] ?? 0);
  actual.fill(0); configured.fill(0);
  return difference === 0;
}

/** Internal cron calls prove possession of an actually configured secret.
 * Never trust sb-api-key-compatibility or unverified JWT claims. During this
 * transition the configured legacy key still works unless explicitly disabled.
 * A Supabase revocation alone must not leave env equality as a back door:
 * disable this path before retiring the platform key. Invalid modern
 * configuration closes BOTH admission paths.
 */
export function isSupabaseServiceRequest(input, get) {
  const selected = readSupabaseServiceKey(get);
  if (!selected) return false;
  const headers = new Headers(input), apikey = headers.get('apikey') ?? '';
  const authorization = headers.get('authorization') ?? '';
  const bearer = authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
  const old = legacyKeysEnabled(get) ? get('SUPABASE_SERVICE_ROLE_KEY') : undefined;
  const legacy = legacyKey(old, 'sb_secret_') ? old : '';
  const selectedApi = sameKey(apikey, selected);
  const selectedBearer = sameKey(bearer, selected);
  const legacyApi = sameKey(apikey, legacy);
  const legacyBearer = sameKey(bearer, legacy);
  return selectedApi || (!modernKey(selected, 'sb_secret_') && selectedBearer)
    || (legacy.length > 0 && (legacyApi || (!modernKey(legacy, 'sb_secret_') && legacyBearer)));
}
