import type { NeedTaskGeography, ResolvedLocationValue } from './needFactsV2';
import type { CountryCode } from './market';
export type { LocationSlot, LocationPinOrigin, ConfirmedLocationPoint, ResolvedLocationValue } from './needFactsV2';

/** The existing public topology contains coarse text, never private addresses or GPS. */
export type NeedLocationInput = Readonly<{
  taskCountryCode: CountryCode;
  geography: NeedTaskGeography;
  exactAddress: string | null;
  accessNotes: string | null;
  resolvedLocation?: ResolvedLocationValue | null;
}>;
export type NeedLocationReview = Readonly<{
  accountId: string;
  conversationId: string;
  editable: boolean;
  confirmed: boolean;
  revision: string;
  value: Readonly<{ taskCountryCode: CountryCode | null; geography: NeedTaskGeography | null; exactAddress: string | null; accessNotes: string | null; resolvedLocation?: ResolvedLocationValue | null }>;
}>;
export type NeedLocationSave = Readonly<{
  conversationId: string; expectedRevision: string; confirmed: true; value: NeedLocationInput;
}>;
export type NeedLocationReceipt = Readonly<{
  saved: true; idempotentReplay: boolean; review: NeedLocationReview;
}>;

/** Coordinates, when explicitly supplied, are coarse two-decimal preferences only. */
export type CoarsePosition = Readonly<{ latitude: number; longitude: number }>;
export type WorkerLocationInput = Readonly<{
  operatingCountryCode: CountryCode;
  city: string; radiusKm: number; approximatePosition: CoarsePosition | null;
}>;
export type WorkerLocation = Omit<WorkerLocationInput, 'operatingCountryCode'> & Readonly<{
  operatingCountryCode: CountryCode | null;
  accountId: string; profileId: string; revision: string;
}>;
export type WorkerLocationSave = Readonly<{
  expectedRevision: string; confirmed: true; value: WorkerLocationInput;
}>;
export type WorkerLocationReceipt = Readonly<{
  saved: true; idempotentReplay: boolean; location: WorkerLocation;
}>;
