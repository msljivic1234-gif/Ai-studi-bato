import { memo } from 'react';
import { View } from 'react-native';
import { Image } from 'expo-image';

// Original bundled illustrations, never a user photograph or an actual map.
const ART = {
  publish: require('../../../assets/illustrations/natural-v1/publish.webp'),
  discover: require('../../../assets/illustrations/natural-v1/money.webp'),
};

/** Reserved dimensions keep decoding from moving nearby text; quiet decoration needs no motion. */
function HomeLaunchArtBase({ kind, compact = false, size: requestedSize }: { kind: keyof typeof ART; compact?: boolean; size?: 48 | 64 | 96 }) {
  const size = requestedSize ?? (compact ? 52 : 90);
  return <View accessible={false} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden
    style={{ width: size, height: size, flexShrink: 0 }}>
    <Image source={ART[kind]} style={{ width: size, height: size }} accessible={false}
      contentFit="contain" cachePolicy="memory" transition={0} allowDownscaling />
  </View>;
}

export const HomeLaunchArt = memo(HomeLaunchArtBase);
