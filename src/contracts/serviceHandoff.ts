// One validator is shared with the Edge transport. This client wrapper adds only
// display words, never inferred shipping options, addresses or matching authority.
export { decodeServiceHandoff, formatServiceHandoff as serviceHandoffText } from '../../supabase/functions/_shared/serviceHandoff.mjs';
// An explicit TypeScript-only wire shape. The shared Edge decoder remains the
// final authority for strict keys, country syntax, sizes and privacy.
export type ServiceHandoff =
  | Readonly<{ required: false }>
  | Readonly<{
      required: true;
      shippingCountries?: string[];
      localExchange?: Readonly<{ countryCode: string; city: string }>;
    }>;
