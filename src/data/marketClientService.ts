import type { MarketConfig } from '../contracts/market';
import { marketConfig } from '../lib/market';
import type { Ishod } from './ports';
import { readReceipt } from './serverReceipt';

/** Read-only preparation metadata. Product status never grants publication or provider authority. */
export const marketClientService = {
  list(): Promise<Ishod<readonly MarketConfig[]>> {
    return readReceipt({ rpc: 'rpc_list_location_markets', args: {}, errors: {},
      fallback: 'MARKET_CONFIG_READ_FAILED', invalid: 'MARKET_CONFIG_INVALID_RESPONSE',
      decode(raw) {
        if (!Array.isArray(raw) || raw.length > 250) return null;
        const result: MarketConfig[] = [], countries = new Set<string>();
        for (const item of raw) {
          const config = marketConfig(item);
          if (!config || countries.has(config.countryCode)) return null;
          countries.add(config.countryCode); result.push(config);
        }
        return result;
      } });
  },
};
