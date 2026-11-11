/**
 * The one public way to write to support from a screen where nobody is signed in: a restricted account has no session, and the
 * private support (`/podrska`) is account-scoped, so it cannot be opened from there. No address is invented. It exists only
 * when the owner supplies one at build time (`EXPO_PUBLIC_SUPPORT_EMAIL`), and until then "Obrati se podršci" is not drawn at all
 * (design synthesis: it renders only when the owner gives a URL or an email; nothing is shown as "uskoro").
 */
const ADDRESS = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}$/;

/** The `mailto:` link for the owner's public support address, or null when there is none (or it is not an address). */
export function publicSupportMailto(address: string | undefined = process.env.EXPO_PUBLIC_SUPPORT_EMAIL): string | null {
  const trimmed = address?.trim();
  return trimmed && ADDRESS.test(trimmed) ? `mailto:${trimmed}?subject=${encodeURIComponent('USKOČI: ograničen nalog')}` : null;
}
