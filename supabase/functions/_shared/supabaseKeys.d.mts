export type SupabaseEnvReader = (name: string) => string | undefined;
export function readSupabaseServiceKey(get: SupabaseEnvReader): string | null;
export function readSupabasePublishableKey(get: SupabaseEnvReader): string | null;
export function supabaseServiceHeaders(key: string, extra?: HeadersInit): Record<string, string>;
export function isSupabaseServiceRequest(headers: HeadersInit, get: SupabaseEnvReader): boolean;
