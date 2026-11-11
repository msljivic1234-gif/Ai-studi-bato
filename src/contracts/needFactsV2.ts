export const NEED_FACT_SCHEMA_V2 = 'NEED_FACT_V2' as const;
export const LEGACY_FACT_SCHEMA_V1 = 'LEGACY_TEXT_V1' as const;

export type NeedFactValueType =
  | 'TEXT'
  | 'INTEGER'
  | 'BOOLEAN'
  | 'ENUM'
  | 'TIMESTAMPTZ'
  | 'TEXT_ARRAY'
  | 'OBJECT';

export type NeedFactPrivacyClass = 'PUBLIC' | 'PRIVATE';

export const NEED_FACT_V2_DEFINITIONS = {
  'need.title': { valueType: 'TEXT', privacyClass: 'PUBLIC', requiredForDraft: true, label: 'Naslov' },
  'need.description': { valueType: 'TEXT', privacyClass: 'PUBLIC', requiredForDraft: true, label: 'Opis' },
  'need.category': { valueType: 'TEXT', privacyClass: 'PUBLIC', requiredForDraft: true, label: 'Kategorija' },
  'need.price_mode': { valueType: 'ENUM', privacyClass: 'PUBLIC', requiredForDraft: true, label: 'Cena' },
  'need.price_rsd': { valueType: 'INTEGER', privacyClass: 'PUBLIC', requiredForDraft: false, label: 'Iznos' },
  // What the amount above is FOR, once a task can say so (pkg025a–d). Not required for a draft: a
  // task for one person has nothing to disambiguate, and every task written before 2026-09-20 has
  // no basis at all and reads exactly as it always has. It matters when the task needs more than
  // one person and the requester named a price — then TOTAL and PER_PERSON are different offers.
  'need.price_basis': { valueType: 'ENUM', privacyClass: 'PUBLIC', requiredForDraft: false, label: 'Osnova cene' },
  'need.schedule_kind': { valueType: 'ENUM', privacyClass: 'PUBLIC', requiredForDraft: true, label: 'Termin' },
  'need.starts_at': { valueType: 'TIMESTAMPTZ', privacyClass: 'PUBLIC', requiredForDraft: false, label: 'Početak' },
  'need.ends_at': { valueType: 'TIMESTAMPTZ', privacyClass: 'PUBLIC', requiredForDraft: false, label: 'Kraj' },
  // Explicit NONE clears an earlier application deadline. Missing means the owner has not decided.
  'need.response_deadline': { valueType: 'OBJECT', privacyClass: 'PUBLIC', requiredForDraft: false, label: 'Rok za prijave' },
  'need.people_needed': { valueType: 'INTEGER', privacyClass: 'PUBLIC', requiredForDraft: true, label: 'Ljudi' },
  'need.required_skills': { valueType: 'TEXT_ARRAY', privacyClass: 'PUBLIC', requiredForDraft: false, label: 'Veštine' },
  'need.required_tools': { valueType: 'TEXT_ARRAY', privacyClass: 'PUBLIC', requiredForDraft: false, label: 'Alat' },
  'need.required_vehicles': { valueType: 'TEXT_ARRAY', privacyClass: 'PUBLIC', requiredForDraft: false, label: 'Vozilo' },
  'need.required_licenses': { valueType: 'TEXT_ARRAY', privacyClass: 'PUBLIC', requiredForDraft: false, label: 'Dozvole' },
  'need.minimum_experience_years': { valueType: 'INTEGER', privacyClass: 'PUBLIC', requiredForDraft: false, label: 'Iskustvo' },
  // AF-D23 keeps the historical key readable; only explicit false correction is
  // available while external identity verification is not offered in this test.
  'need.verified_identity_required': { valueType: 'BOOLEAN', privacyClass: 'PUBLIC', requiredForDraft: false, manualOnly: true, label: 'Uslov provere identiteta' },
  'need.task_country_code': { valueType: 'TEXT', privacyClass: 'PUBLIC', requiredForDraft: true, label: 'Država' },
  'need.task_geography': { valueType: 'OBJECT', privacyClass: 'PUBLIC', requiredForDraft: true, label: 'Lokacija' },
  // Transfer of a physical result is separate from where the work takes place.
  // Only coarse countries/city belong here; never an address or a work-map pin.
  'need.handoff': { valueType: 'OBJECT', privacyClass: 'PUBLIC', requiredForDraft: false, label: 'Predaja' },
  'need.critical_conditions': { valueType: 'TEXT_ARRAY', privacyClass: 'PUBLIC', requiredForDraft: false, label: 'Bitni uslovi' },
  'need.public_photo_paths': { valueType: 'TEXT_ARRAY', privacyClass: 'PUBLIC', requiredForDraft: false, manualOnly: true, label: 'Fotografije' },
  'need.exact_address': { valueType: 'TEXT', privacyClass: 'PRIVATE', requiredForDraft: false, label: 'Tačna adresa' },
  'need.access_notes': { valueType: 'TEXT', privacyClass: 'PRIVATE', requiredForDraft: false, label: 'Pristup' },
  'need.resolved_location': { valueType: 'OBJECT', privacyClass: 'PRIVATE', requiredForDraft: false, manualOnly: true, label: 'Potvrđene tačke' },
} as const satisfies Record<string, {
  valueType: NeedFactValueType;
  privacyClass: NeedFactPrivacyClass;
  requiredForDraft: boolean;
  label: string;
  manualOnly?: boolean;
}>;

export type NeedFactV2Key = keyof typeof NEED_FACT_V2_DEFINITIONS;
export const IDENTITY_VERIFICATION_UNAVAILABLE_COPY = 'Provera identiteta dokumentom ili selfijem nije dostupna u ovoj test verziji. Podatke o identitetu učesnici navode sami.';
export const NEED_FACT_V2_KEYS = Object.keys(NEED_FACT_V2_DEFINITIONS) as NeedFactV2Key[];
export const AI_PROPOSABLE_NEED_FACT_V2_KEYS = NEED_FACT_V2_KEYS.filter(key =>
  !('manualOnly' in NEED_FACT_V2_DEFINITIONS[key]));
// New clients can read a complete typed turn. Older clients retain their
// 12-fact wire contract until they explicitly advertise this capability.
export const MAX_AI_NEED_FACT_V2_PROPOSALS = AI_PROPOSABLE_NEED_FACT_V2_KEYS.length;
export const NEED_FACT_TURN_CAPABILITY_HEADER = 'x-uskoci-need-facts';
export const NEED_FACT_TURN_CAPABILITY_VERSION = 'registry-v1';
export function isAiProposableNeedFactV2Key(value: string): value is NeedFactV2Key {
  return AI_PROPOSABLE_NEED_FACT_V2_KEYS.some(key => key === value);
}
export const REQUIRED_NEED_FACT_V2_KEYS = NEED_FACT_V2_KEYS.filter(
  (key) => NEED_FACT_V2_DEFINITIONS[key].requiredForDraft,
);

/**
 * The most V2 facts any payload may carry: the size of the registry itself.
 *
 * Five decoders spelled this `22`, which was the key count on the day they were written. Adding
 * `need.price_basis` moved the count and left every one of them one short — and these decoders fail
 * ALL-OR-NOTHING: a single fact they cannot place discards the whole review, not just that fact. So
 * a maximal task would have gone blank rather than dropped one row. Derived from the list, so the
 * cap can never again disagree with the thing it is a cap on.
 */
export const MAX_NEED_FACT_V2_PAYLOAD = NEED_FACT_V2_KEYS.length;

export type NeedTaskGeographyMode =
  | 'STATIONARY'
  | 'POINT_TO_POINT'
  | 'MULTI_STOP'
  | 'AREA_BASED'
  | 'REMOTE';

export type NeedTaskGeographyPoint = {
  label?: string;
  city?: string;
  area?: string;
};

export type NeedTaskGeography = {
  mode: NeedTaskGeographyMode;
  start?: NeedTaskGeographyPoint;
  end?: NeedTaskGeographyPoint;
  waypoints?: NeedTaskGeographyPoint[];
  serviceArea?: NeedTaskGeographyPoint;
};

export type LocationSlot = 'start' | 'end' | 'serviceArea' | `waypoints/${number}`;
export type LocationPinOrigin = Readonly<{ kind: 'MANUAL_PIN' }> | Readonly<{
  kind: 'PROVIDER_CANDIDATE'; providerHint: string; candidateHint: string | null;
}>;
/** Coordinates chosen by the owner; provider hints never attest accuracy. */
export type ConfirmedLocationPoint = Readonly<{
  slot: LocationSlot; latitudeE6: number; longitudeE6: number; origin: LocationPinOrigin;
  address?: string; accessNotes?: string;
}>;
/** Private witness references the existing topology; it never owns that topology. */
export type ResolvedLocationValue = Readonly<{
  version: 1;
  binding: Readonly<{ taskCountryCode: string; geography: NeedTaskGeography; exactAddress: string | null }>;
  points: readonly ConfirmedLocationPoint[];
}>;

export type NeedFactV2Value = string | number | boolean | string[] | NeedTaskGeography | ResolvedLocationValue | import('./serviceHandoff.ts').ServiceHandoff;

export function isNeedFactV2Key(value: string): value is NeedFactV2Key {
  return Object.prototype.hasOwnProperty.call(NEED_FACT_V2_DEFINITIONS, value);
}

export function factDisplayLabel(key: NeedFactV2Key): string {
  return NEED_FACT_V2_DEFINITIONS[key].label;
}

export function isPrivateNeedFact(key: NeedFactV2Key): boolean {
  return NEED_FACT_V2_DEFINITIONS[key].privacyClass === 'PRIVATE';
}
