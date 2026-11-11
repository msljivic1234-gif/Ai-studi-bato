import type { CountryCode, MarketConfig, MarketProductStatus } from '../contracts/market';

/** Normalization never infers a country from a city, language, position or account. */
export function countryCode(value: unknown): CountryCode | null {
  if (typeof value !== 'string') return null;
  const code = value.replace(/^ +| +$/g, '');
  return /^[A-Za-z]{2}$/.test(code) ? code.toUpperCase() : null;
}
export function timeZone(value: unknown): string | null {
  if (typeof value !== 'string' || value.length > 100 || !/^[A-Za-z_]+(?:\/[A-Za-z0-9_+.-]+)*$/.test(value)) return null;
  try { new Intl.DateTimeFormat('en', { timeZone: value }); return value; } catch { return null; }
}
export function marketConfig(value: unknown): MarketConfig | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const input = value as Record<string, unknown>;
  if (Object.keys(input).some(key => !['countryCode', 'productStatus', 'defaultCurrencyCode', 'defaultLanguageTag', 'defaultTimezone'].includes(key))) return null;
  const code = countryCode(input.countryCode), timezone = timeZone(input.defaultTimezone);
  const statuses: readonly string[] = ['BUILDING', 'LIVE', 'WAITLIST', 'COMING'];
  if (!code || input.countryCode !== code || !timezone || typeof input.productStatus !== 'string' || !statuses.includes(input.productStatus)
    || typeof input.defaultCurrencyCode !== 'string' || !/^[A-Z]{3}$/.test(input.defaultCurrencyCode)
    || typeof input.defaultLanguageTag !== 'string' || input.defaultLanguageTag.length > 35 || !/^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/.test(input.defaultLanguageTag)) return null;
  return { countryCode: code, productStatus: input.productStatus as MarketProductStatus,
    defaultCurrencyCode: input.defaultCurrencyCode, defaultLanguageTag: input.defaultLanguageTag, defaultTimezone: timezone };
}
