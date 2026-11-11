/** A normalized country identifier; recognition and availability belong to the server. */
export type CountryCode = string;
export type MarketProductStatus = 'BUILDING' | 'LIVE' | 'WAITLIST' | 'COMING';
export type MarketConfig = Readonly<{
  countryCode: CountryCode;
  productStatus: MarketProductStatus;
  defaultCurrencyCode: string;
  defaultLanguageTag: string;
  defaultTimezone: string;
}>;
