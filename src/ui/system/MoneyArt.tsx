import { Image } from 'expo-image';
import { View } from 'react-native';
import { FactArt } from './FactArt';

const SOURCE = require('../../../assets/illustrations/natural-v1/money.webp');

/** Money subject only; amount, currency, basis and payment state belong to the adjacent facts. */
export function MoneyArt({ size, quiet = false }: { size: 24 | 28 | 32; quiet?: boolean }) {
  // Preserve the legible quiet vector; never tint material artwork into a new state meaning.
  if (quiet) return <FactArt kind="money" size={size} cut="art" tone="quiet" />;
  return <View accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants"
    style={{ width: size, height: size }}>
    <Image source={SOURCE} style={{ width: size, height: size }} accessible={false}
      contentFit="contain" cachePolicy="memory" transition={0} allowDownscaling />
  </View>;
}
