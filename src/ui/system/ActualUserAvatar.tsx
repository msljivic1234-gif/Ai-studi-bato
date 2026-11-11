import { useCallback, useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { ownProfileClientService } from '../../data/ownProfileClientService';
import { useFocusedResource } from '../../hooks/useFocusedResource';
import { inicijali } from '../../lib/inicijali';
import { sesijaSada, useSesija } from '../../store/sesija';
import { ProfilePhoto } from '../media/ContextPhotos';
import { ownPhotoCache } from '../media/ownPhotoCache';
import { Press } from '../Press';
import { Avatar } from './Avatar';
import { sys } from './tokens';

export const ROOT_AVATAR_SIZE = 48;
const TARGET = 56;

/** Own, current-account identity only. Reads never block the header or change its navigation authority. */
export function ActualUserAvatar({ onPress }: { onPress: () => void }) {
  const { user, accountRevision } = useSesija();
  const accountId = user?.id;
  const read = useCallback(async (signal: AbortSignal) => {
    const requester = await ownProfileClientService.read(accountId ?? '', 'narucilac');
    if (signal.aborted) throw new Error('HEADER_PROFILE_READ_RETIRED');
    // The hub uses the requester identity first. Only authoritative absence permits the worker fallback.
    return requester ?? ownProfileClientService.read(accountId ?? '', 'uskocer');
  }, [accountId]);
  const resource = useFocusedResource(read);
  // The header lives as long as the signed-in tabs. When its account goes (signed out, or another one signed in) nothing of that account's photograph
  // stays in memory; a header that is only drawn again for the same account forgets nothing.
  useEffect(() => () => {
    const now = sesijaSada();
    if (now.user?.id !== accountId || now.accountRevision !== accountRevision) ownPhotoCache.forget();
  }, [accountId, accountRevision]);
  const identity = !resource.loading && !resource.error && resource.data?.accountId === accountId ? resource.data : null;
  const fallback = <Avatar initials={inicijali(identity?.ime)} size={ROOT_AVATAR_SIZE} />;
  return <Press accessibilityRole="button" accessibilityLabel="Moj profil"
    accessibilityValue={identity?.ime ? { text: identity.ime } : undefined} onPress={onPress}
    haptic="select" hitSlop={0} style={s.target}>
    <View accessible={false} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden style={s.portrait}>
      {/* The person's own photograph: remembered in memory while the app stays in front (ownPhotoCache), so coming back to a tab
          draws it at once instead of the letter that stands in for it while it is read. */}
      {identity?.profileId ? <ProfilePhoto key={`${accountId}:${accountRevision}:${identity.profileId}`}
        profileId={identity.profileId} size={ROOT_AVATAR_SIZE} fallback={fallback} own /> : fallback}
    </View>
  </Press>;
}

const s = StyleSheet.create({
  target: { width: TARGET, height: TARGET, flexShrink: 0, alignItems: 'center', justifyContent: 'center' },
  portrait: { width: ROOT_AVATAR_SIZE, height: ROOT_AVATAR_SIZE, borderRadius: sys.radius.pill, overflow: 'hidden' },
});
