import { useId } from 'react';
import { ClipPath, Defs, G, Image, Path, Use } from 'react-native-svg';
import { BRAND_PARTS } from './spojBrandMath';

export const BRAND_RASTER = require('../../../assets/brand/premium-entry/logo.png');
// One untouched transparent atlas, partitioned along its semantic contours. The
// pin's tip stays with the pin, and the smile does not borrow the adjacent arm.
// The two touching hands share one curved boundary rather than a rectangular cut.
const PIN = 'M370 235H485V337L444 380H408L370 337Z';
const SMILE = 'M318 335H370L389 371Q426 387 462 371L480 335H532V405L489 440H356L318 405Z';
const FINGERS = 'M326 541Q341 540 344 551L350 555Q366 552 372 561L377 570L378 574Q395 572 399 583L402 592Q418 591 422 603Q426 620 416 633Q407 643 389 638L381 629L374 626L362 621L358 609L345 610L333 602L330 593L317 593Q306 590 304 575Q304 557 316 548Z';
const ORANGE_ARM = 'M540 235H735V664H545L530 588L523 571L517 562L506 552L495 542L483 532L470 521L457 511L442 503L424 499L410 503L397 515L385 522L370 520L360 513L354 502L361 491L371 479L381 468L390 458L399 448L419 439L448 439L474 447L505 437L527 405L540 365Z';
const LOWER = 'M135 235H735V664H135Z';
const PART_CONTOURS = [
  SMILE,
  PIN,
  'M135 60H400V235H135Z',
  'M400 60H735V235H400Z',
  FINGERS,
  // The green arm owns everything below the heads except the four subjects
  // above. Reusing their exact contours keeps the assembled identity complete.
  `${LOWER} ${SMILE} ${PIN} ${FINGERS} ${ORANGE_ARM}`,
  ORANGE_ARM,
] as const;
const MARK_OUTLINE = 'M135 60H735V235H713V360L698 410L657 482L594 551L530 591L440 664H135Z';
const SX = 280 / 580, SY = 291 / 604;

export function useBrandRasterId() { return `uskoci-art-${useId().replace(/[^a-zA-Z0-9-]/g, '')}`; }

export function BrandRasterDefs({ id }: { id: string }) {
  return <Defs>
    <Image id={`${id}-image`} href={BRAND_RASTER} width={2048} height={683} preserveAspectRatio="none" />
    <ClipPath id={`${id}-mark`}><Path d={MARK_OUTLINE} /></ClipPath>
    <ClipPath id={`${id}-words`}><Path d="M735 60H1925V660H699V400L713 360V235H735Z" /></ClipPath>
    {PART_CONTOURS.map((d, i) => <ClipPath key={i} id={`${id}-part-${i}`}>
      <Path d={d} fillRule="evenodd" clipRule="evenodd" />
    </ClipPath>)}
  </Defs>;
}

export function BrandRasterMark({ id, part }: { id: string; part?: number }) {
  const origin = part === undefined ? [0, 0] : BRAND_PARTS[part];
  return <G transform={`translate(${-origin[0]} ${-origin[1]})`}>
    {/* Declarative G extracts transform, not the native-only matrix prop. */}
    <G transform={`matrix(${SX} 0 0 ${SY} ${-145 * SX} ${-66 * SY})`}>
      <G clipPath={`url(#${id}-mark)`}>
        {part === undefined ? <Use href={`#${id}-image`} /> :
          <G clipPath={`url(#${id}-part-${part})`} clipRule="evenodd"><Use href={`#${id}-image`} /></G>}
      </G>
    </G>
  </G>;
}

export function BrandRasterWords({ id }: { id: string }) {
  return <G transform={`matrix(${216 / 1226} 0 0 ${104 / 604} ${143 - 699 * 216 / 1226} ${174 - 66 * 104 / 604})`}>
    <G clipPath={`url(#${id}-words)`}><Use href={`#${id}-image`} /></G>
  </G>;
}
