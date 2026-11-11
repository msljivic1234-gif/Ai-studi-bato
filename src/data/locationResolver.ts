import type { CoarsePosition } from '../contracts/location';
import type { NeedTaskGeographyPoint } from '../contracts/needFactsV2';
import { coarsePosition, locationText } from '../lib/location';

type PublicQuery = Readonly<{ city: string; area?: string }>;
export type LocationSuggestion = Readonly<{ publicPlace: NeedTaskGeographyPoint; approximatePosition: CoarsePosition | null }>;
/** A deployment supplies an approved provider. There is deliberately no default provider or GPS dependency. */
export interface LocationResolverPort {
  search(query: PublicQuery, signal: AbortSignal): Promise<unknown>;
}
export type LocationResolution =
  | Readonly<{ status: 'PROPOSALS'; suggestions: readonly LocationSuggestion[]; requiresConfirmation: true }>
  | Readonly<{ status: 'PROVIDER_ACTIVATION_BLOCKED' | 'INVALID_QUERY' | 'UNAVAILABLE' | 'CANCELLED' }>;

function query(value: unknown): PublicQuery | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const input = value as Record<string, unknown>;
  if (Object.keys(input).some(key => key !== 'city' && key !== 'area')) return null;
  const city = locationText(input.city, 160);
  const area = input.area === undefined ? undefined : locationText(input.area, 160);
  return city && area !== null ? { city, ...(area ? { area } : {}) } : null;
}
/** Only a coarse query is sent. Private access notes/addresses are not accepted at this boundary. */
export function createLocationResolver(provider?: LocationResolverPort) {
  return {
    async search(rawQuery: unknown, signal?: AbortSignal): Promise<LocationResolution> {
      const input = query(rawQuery);
      if (!input) return { status: 'INVALID_QUERY' };
      if (signal?.aborted) return { status: 'CANCELLED' };
      if (!provider) return { status: 'PROVIDER_ACTIVATION_BLOCKED' };
      const controller = new AbortController();
      const abort = () => controller.abort();
      signal?.addEventListener('abort', abort);
      let timer: ReturnType<typeof setTimeout> | undefined;
      let cancel: (() => void) | undefined;
      try {
        const cancelled = new Promise<never>((_resolve, reject) => {
          cancel = () => reject(new Error('LOCATION_CANCELLED'));
          controller.signal.addEventListener('abort', cancel);
          timer = setTimeout(abort, 10_000);
        });
        const result = await Promise.race([provider.search(input, controller.signal), cancelled]);
        if (controller.signal.aborted) return { status: signal?.aborted ? 'CANCELLED' : 'UNAVAILABLE' };
        if (!Array.isArray(result) || result.length > 20) return { status: 'UNAVAILABLE' };
        const suggestions: LocationSuggestion[] = [];
        for (const item of result) {
          if (!item || typeof item !== 'object' || Array.isArray(item)) return { status: 'UNAVAILABLE' };
          const raw = item as Record<string, unknown>;
          if (Object.keys(raw).some(key => key !== 'publicPlace' && key !== 'approximatePosition')) return { status: 'UNAVAILABLE' };
          const place = query(raw.publicPlace);
          const approximatePosition = raw.approximatePosition === null ? null : coarsePosition(raw.approximatePosition);
          if (!place || (raw.approximatePosition !== null && !approximatePosition)) return { status: 'UNAVAILABLE' };
          suggestions.push({ publicPlace: place, approximatePosition });
        }
        return { status: 'PROPOSALS', suggestions, requiresConfirmation: true };
      } catch {
        return { status: signal?.aborted ? 'CANCELLED' : 'UNAVAILABLE' };
      } finally {
        clearTimeout(timer);
        signal?.removeEventListener('abort', abort);
        if (cancel) controller.signal.removeEventListener('abort', cancel);
      }
    },
  };
}
