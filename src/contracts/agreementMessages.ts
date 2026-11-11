export type AgreementMessageCommand = Readonly<{
  accountId: string;
  agreementId: string;
  clientMessageId: string;
  body: string;
  photos?: Readonly<{ agreementVersion: number; assetIds: readonly string[] }>;
  /** A voice message: ONE ready voice asset, an empty body and no photos. The asset is the one the private upload settled READY. */
  voice?: Readonly<{ agreementVersion: number; assetId: string }>;
}>;

const MESSAGE_ASSET_ID = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i;
export function validMessageVoice(value: unknown): value is NonNullable<AgreementMessageCommand['voice']> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const v = value as Record<string, unknown>;
  return Object.keys(v).length === 2 && Number.isInteger(v.agreementVersion) && (v.agreementVersion as number) >= 1 && (v.agreementVersion as number) <= 2147483647
    && typeof v.assetId === 'string' && v.assetId.length === 36 && MESSAGE_ASSET_ID.test(v.assetId);
}

export function validMessagePhotos(value: unknown): value is NonNullable<AgreementMessageCommand['photos']> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const v = value as Record<string, unknown>;
  if (Object.keys(v).length !== 2 || !Number.isInteger(v.agreementVersion) || (v.agreementVersion as number) < 1
    || (v.agreementVersion as number) > 2147483647 || !Array.isArray(v.assetIds) || v.assetIds.length < 1 || v.assetIds.length > 6
    || v.assetIds.some(id => typeof id !== 'string' || id.length !== 36 || !/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(id))) return false;
  return new Set(v.assetIds.map(id => id.toLowerCase())).size === v.assetIds.length;
}

export type AgreementMessageErrorCode = 'AUTH_CONTEXT_CHANGED' | 'INVALID_MESSAGE' | 'READ_ONLY'
  | 'NOT_AVAILABLE' | 'CONFLICT' | 'UNAVAILABLE' | 'INVALID_RESPONSE';

export class AgreementMessageError extends Error {
  constructor(readonly code: AgreementMessageErrorCode) { super(code); this.name = 'AgreementMessageError'; }
}

export interface AgreementMessagePort {
  /** Retry the same immutable command. A transport failure does not prove absence. */
  send(command: AgreementMessageCommand): Promise<{ messageId: string }>;
}
