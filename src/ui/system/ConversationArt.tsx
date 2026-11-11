import { memo } from 'react';
import { View } from 'react-native';
import { Image } from 'expo-image';

const SOURCE = require('../../../assets/illustrations/uskoci-messages-v2.png');

/** Original, local, static conversation illustration; never a listening or delivery indicator. */
export const ConversationArt = memo(function ConversationArt({ size = 112 }: { size?: number }) {
  return <View accessible={false} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden
    style={{ width: size, height: size, flexShrink: 0 }}>
    <Image source={SOURCE} contentFit="contain" transition={0} cachePolicy="memory" allowDownscaling
      accessible={false} style={{ width: size, height: size }} />
  </View>;
});
