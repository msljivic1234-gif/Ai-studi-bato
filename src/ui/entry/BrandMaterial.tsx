import { useId } from 'react';
import { Defs, G, LinearGradient, Path, RadialGradient, Stop } from 'react-native-svg';

/** The original articulated silhouette, finished in the owner's green/orange enamel.
 * Lighting is static: the existing UI clock moves each complete material layer.
 * No bitmap decoding, SVG filters or animated gradient definitions on map pins.
 */
export function useBrandMaterialId() {
  return `uskoci-enamel-${useId().replace(/[^a-zA-Z0-9-]/g, '')}`;
}

export function BrandMaterialDefs({ id }: { id: string }) {
  return <Defs>
    <LinearGradient id={`${id}-green`} x1="12%" y1="0%" x2="78%" y2="100%">
      <Stop offset="0" stopColor="#79CABA" />
      <Stop offset={0.21} stopColor="#24A28A" />
      <Stop offset={0.57} stopColor="#087E68" />
      <Stop offset={0.86} stopColor="#00624F" />
      <Stop offset="1" stopColor="#124D40" />
    </LinearGradient>
    <LinearGradient id={`${id}-orange`} x1="12%" y1="0%" x2="78%" y2="100%">
      <Stop offset="0" stopColor="#FFD18A" />
      <Stop offset={0.22} stopColor="#FFA32A" />
      <Stop offset={0.58} stopColor="#FF830C" />
      <Stop offset={0.88} stopColor="#E36105" />
      <Stop offset="1" stopColor="#B94B04" />
    </LinearGradient>
    <LinearGradient id={`${id}-rim`} x1="18%" y1="0%" x2="65%" y2="100%">
      <Stop offset="0" stopColor="#FFFFFF" stopOpacity=".72" />
      <Stop offset={0.38} stopColor="#FFFFFF" stopOpacity=".12" />
      <Stop offset={0.68} stopColor="#193D32" stopOpacity=".08" />
      <Stop offset="1" stopColor="#173B30" stopOpacity=".28" />
    </LinearGradient>
    <RadialGradient id={`${id}-light`} cx="30%" cy="13%" rx="56%" ry="45%">
      <Stop offset="0" stopColor="#FFFFFF" stopOpacity=".35" />
      <Stop offset={0.32} stopColor="#FFFFFF" stopOpacity=".12" />
      <Stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
    </RadialGradient>
  </Defs>;
}

export function BrandMaterialPath({ id, d, fill, small = false, unit = 1 }: {
  id: string; d: string; fill: string; small?: boolean; unit?: number;
}) {
  const tone = fill === '#FF7908' ? 'orange' : 'green';
  return <G>
    {/* A short lower edge gives volume without a halo around the mark. */}
    {!small ? <Path d={d} fill={tone === 'orange' ? '#B95107' : '#145A49'} opacity=".28" transform={`translate(0 ${unit * 1.4})`} /> : null}
    <Path d={d} fill={`url(#${id}-${tone})`} stroke={`url(#${id}-rim)`}
      strokeWidth={unit * (small ? .75 : 1.5)} strokeLinejoin="round" />
    {!small ? <Path d={d} fill={`url(#${id}-light)`} /> : null}
  </G>;
}
