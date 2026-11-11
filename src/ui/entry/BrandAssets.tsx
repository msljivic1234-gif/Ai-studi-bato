import Svg, { G } from 'react-native-svg';
import { brandParts } from './spojBrandData';
import { BRAND_PARTS } from './spojBrandMath';
import { BrandMaterialDefs, BrandMaterialPath, useBrandMaterialId } from './BrandMaterial';
import { BrandRasterDefs, BrandRasterMark, BrandRasterWords, useBrandRasterId } from './BrandRaster';

export function BrandMark({ size = 58 }: { size?: number }) {
  const material = useBrandMaterialId(), raster = useBrandRasterId();
  // Optical symbol at map/auth sizes: crisp and synchronous for native snapshots.
  if (size >= 48) return <Svg width={size} height={size * 291 / 280} viewBox="0 0 280 291" accessible={false}>
    <BrandRasterDefs id={raster} /><BrandRasterMark id={raster} />
  </Svg>;
  return <Svg width={size} height={size * 291 / 280} viewBox="0 0 280 291" accessible={false}>
    <BrandMaterialDefs id={material} />
    <G>{BRAND_PARTS.map((part, index) => <G key={index} transform={`translate(${part[0]} ${part[1]})`}>
      {brandParts[index].map((path, key) => <BrandMaterialPath key={key} id={material} {...path} small={size < 40} />)}
    </G>)}</G>
  </Svg>;
}

export function BrandLockup({ width = 156 }: { width?: number }) {
  const material = useBrandRasterId();
  return <Svg width={width} height={width * 104 / 320} viewBox="39 174 320 104" accessible accessibilityRole="image" accessibilityLabel="USKOČI">
    <BrandRasterDefs id={material} />
    <G transform="translate(42.806 175.496) scale(.34)"><G transform="rotate(.40107046 140 145.44829)">
      <BrandRasterMark id={material} />
    </G></G>
    <BrandRasterWords id={material} />
  </Svg>;
}
