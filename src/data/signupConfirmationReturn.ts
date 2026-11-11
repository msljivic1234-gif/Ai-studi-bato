export type SignupReturnKind = 'RETURNED' | 'LINK_UNAVAILABLE' | 'INVALID_LINK';

/** Classification only. No credential, provider text or identity leaves this parser. */
export function signupReturnKind(link: string, redirect: string): SignupReturnKind {
  if (link.length > 24_576 || /%(?![\da-f]{2})/i.test(link)) return 'INVALID_LINK';
  try {
    const url = new URL(link);
    const target = new URL(redirect);
    if (url.protocol !== target.protocol || url.host !== target.host || url.pathname !== target.pathname ||
      url.username || url.password || url.search !== target.search) return 'INVALID_LINK';
    const params = new URLSearchParams(url.hash.slice(1));
    const seen = new Set<string>();
    for (const [name] of params) {
      if (seen.has(name)) return 'INVALID_LINK';
      seen.add(name);
    }
    if (params.has('error') || params.has('error_code')) {
      // GoTrue uses otp_expired for expired AND already consumed confirmation links.
      return params.get('error_code') === 'otp_expired' ? 'LINK_UNAVAILABLE' : 'INVALID_LINK';
    }
    const access = params.get('access_token');
    const refresh = params.get('refresh_token');
    if (params.get('type') !== 'signup' || params.get('token_type') !== 'bearer' ||
      !access || !refresh || access.length > 16_384 || refresh.length > 4_096 || /\s/.test(access + refresh)) return 'INVALID_LINK';
    // A syntactically valid callback is not evidence of a confirmed account. Password login remains the authority.
    return 'RETURNED';
  } catch { return 'INVALID_LINK'; }
}

/** Plain login links stay ordinary navigation. Credential-bearing auth links are always scrubbed. */
export function hasSignupReturnData(url: URL): boolean {
  return !!url.hash || ['access_token', 'refresh_token', 'code', 'token_hash', 'error', 'error_code', 'type']
    .some(key => url.searchParams.has(key));
}
