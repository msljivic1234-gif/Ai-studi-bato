import { useCallback, useMemo, type ReactNode } from 'react';
import type { JavniProfilProjekcija } from '../../contracts/projections';
import { izvor } from '../../data';
import { requesterProfileClientService } from '../../data/requesterProfileClientService';
import { useFocusedResource } from '../../hooks/useFocusedResource';
import { inicijali } from '../../lib/inicijali';
import { ProfilePhoto } from '../media/ContextPhotos';
import { Avatar, type AvatarSize } from '../system/Avatar';
import { previewPerson, type PreviewPerson } from './reviewAsTask';

/**
 * Who asks, as the people who read the task will read him: the owner of the review (the review is always his), with the name, the face and the
 * rating of his public profile (owner, 8 Oct 2026: "„ti“ kao onaj ko traži sa svojim imenom/licem/ocenom ako ih čitanje ima"). Two reads, both
 * the app's existing ones: his identity as a requester (`requesterProfileClientService`: the name and the profile id) and the public profile
 * that others read of that id (`javniProfil`: the rating and how many reviews it stands on). Either may fail, and the review is whole without
 * them: a name that could not be read is no name, a rating that was not returned is no rating, and `null` is no person at all. The reads are
 * made again whenever the screen is focused again, so a name changed in "Lični podaci" is what the next preview says.
 */
export type ReviewPerson = PreviewPerson & {
  /** The public profile as it was read, for the sheet that shows him as everyone sees him; null when that read failed. */
  profile: JavniProfilProjekcija | null;
  /** His authorized portrait at the size asked for; the initials stand in while it is read and when he has none. */
  photo: (profileId: string, size?: number) => ReactNode;
};

const FACE_SIZES: readonly number[] = [32, 40, 48, 56, 72, 96];

export function useReviewPerson(): ReviewPerson | null {
  const load = useCallback(async (): Promise<{ person: PreviewPerson; profile: JavniProfilProjekcija | null } | null> => {
    const identity = await requesterProfileClientService.read();
    if (!identity.ok) return null;
    let profile: JavniProfilProjekcija | null = null;
    try { profile = await izvor.javniProfil(identity.podatak.profileId); } catch { profile = null; }
    const person = previewPerson(identity.podatak.profileId, identity.podatak.displayName, profile);
    return person.name ? { person, profile } : null;
  }, []);
  const { data } = useFocusedResource(load, { retainOnRefresh: true });
  return useMemo(() => {
    if (!data) return null;
    const letters = inicijali(data.person.name);
    const photo = (profileId: string, size?: number) => <ProfilePhoto profileId={profileId} size={size ?? 96} initial={null}
      fallback={size && FACE_SIZES.includes(size) ? <Avatar size={size as AvatarSize} initials={letters} /> : undefined} />;
    return { ...data.person, profile: data.profile, photo };
  }, [data]);
}
