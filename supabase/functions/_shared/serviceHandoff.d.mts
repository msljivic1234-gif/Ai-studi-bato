export type ServiceHandoff = { required: false } | {
  required: true;
  shippingCountries?: string[];
  localExchange?: { countryCode: string; city: string };
};
/** Strict wire validator; unknown/invalid returns null, valid returns an unchanged detached clone. */
export declare function decodeServiceHandoff(value: unknown): ServiceHandoff | null;
export declare function formatServiceHandoff(value: unknown): string | null;
