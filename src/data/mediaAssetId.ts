import { uuid } from './serverReceipt';

/** Extract only an asset ID from an existing v5 media reference; never expose its path as a URL. */
export function mediaAssetId(ref: string): string | null {
  const match = /^([a-f0-9-]{36})\/v5\/([a-f0-9-]{36})\/[a-f0-9]{64}\.jpg$/i.exec(ref);
  return match && uuid(match[1]) && uuid(match[2]) ? match[2] : null;
}
