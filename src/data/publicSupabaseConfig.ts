/**
 * Single, dependency-free authority for the native app's PUBLIC Supabase target.
 * An entirely absent EXPO_PUBLIC pair retains the existing preview DEV default.
 * A partial, blank or malformed override FAILS CLOSED: never pair a custom URL
 * with the DEV publishable key, or silently send one subsystem elsewhere.
 * The production build/OTA target stays explicitly blocked by build-contract.cjs.
 */
export type PublicSupabaseConfig = Readonly<{ url: string; anonKey: string }>;
const CANONICAL_DEV_URL = 'https://leqcwgzvjsxugfgzdmth.supabase.co';
const CANONICAL_DEV_ANON = 'sb_publishable_o_I-YOn57oPCrIboF0OjPQ_c3DHmOZW';
const DEV_DEFAULT: PublicSupabaseConfig = Object.freeze({ url: CANONICAL_DEV_URL, anonKey: CANONICAL_DEV_ANON });

export function readPublicSupabaseConfig(): PublicSupabaseConfig | null {
  // Expo replaces direct EXPO_PUBLIC references at bundling time.
  const rawUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const rawKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  if (rawUrl === undefined && rawKey === undefined) return DEV_DEFAULT;
  if (typeof rawUrl !== 'string' || typeof rawKey !== 'string') return null;
  const url = rawUrl.trim(), anonKey = rawKey.trim();
  if (!url || !anonKey) return null;
  try {
    const parsed = new URL(url);
    const localhost = ['localhost', '127.0.0.1', '[::1]'].includes(parsed.hostname);
    if (parsed.protocol !== 'https:' && !(localhost && parsed.protocol === 'http:')) return null;
    if (parsed.username || parsed.password || parsed.pathname !== '/' || parsed.search || parsed.hash) return null;
    return { url: parsed.origin, anonKey };
  } catch {
    return null;
  }
}
