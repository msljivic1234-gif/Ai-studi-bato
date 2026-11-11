import type { MarketplaceItem } from '../../data/marketplaceView';
import { inicijali } from '../../lib/inicijali';
import { AuthorizedPhoto } from '../media/AuthorizedPhoto';
import { Avatar } from '../system/Avatar';

/** Uses the list's existing public projection; the image reader still authorizes this exact profile context. */
export function TaskPublisherPortrait({ item, size }: { item: MarketplaceItem; size: 40 | 56 }) {
  const name = 'narucilacIme' in item && typeof item.narucilacIme === 'string' ? item.narucilacIme.trim() : '';
  const fallback = <Avatar initials={inicijali(name)} size={size} />;
  if (!name || !('narucilacProfilId' in item) || !item.narucilacProfilId || !item.narucilacAvatarId) return fallback;
  return <AuthorizedPhoto assetId={item.narucilacAvatarId} profileId={item.narucilacProfilId} label="Profilna fotografija"
    contentFit="cover" style={{ width: size, height: size, borderRadius: size / 2, aspectRatio: 1 }} unavailable={fallback} />;
}
