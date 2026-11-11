import { memo, type ReactNode } from 'react';
import { StyleSheet, View, type TextStyle } from 'react-native';
import { T } from '../Text';
import { FactArt } from './FactArt';
import { ruleWidth } from './layout';
import { sys } from './tokens';

/** Row (32), list (40), root photo (48), compact identity (56), and profile portraits (72/88/96). */
export type AvatarSize = 32 | 40 | 48 | 56 | 72 | 88 | 96;

const LETTERS: Record<AvatarSize, TextStyle> = {
  32: { fontSize: 12, lineHeight: 16 },
  40: { fontSize: 15, lineHeight: 20 },
  48: { fontSize: 18, lineHeight: 24 },
  56: { fontSize: 20, lineHeight: 26 },
  72: { fontSize: 26, lineHeight: 32 },
  88: { fontSize: 30, lineHeight: 38 },
  96: { fontSize: 34, lineHeight: 42 },
};
const GLYPH: Record<AvatarSize, number> = { 32: 20, 40: 24, 48: 28, 56: 32, 72: 40, 88: 48, 96: 52 };

/** The white edge of a face that stands for its screen (the sticker edge), two rules wide: 2 dp. */
export const FACE_EDGE = ruleWidth * 2;
/** What a ring round a face says: the Dogovor is live (agreed, under way, waiting for a confirmation), or it is over. */
export type FaceRing = 'live' | 'over';

/**
 * The face of the person a screen is about, as a sticker (owner's picks of 8 Oct 2026: the rating, my profile, the public profile):
 * a white edge of 2 dp round it and one soft shadow, so it lies on the white screen as a thing and not as a flat disc. It wraps
 * whatever is the face (the initials disc or the person's photo); `ring` adds a ring outside the edge, in colour and in the words
 * beside it, never alone. Decoration: the person's name always stands beside it.
 */
export function FaceEdge({ ring, children }: { ring?: FaceRing; children: ReactNode }) {
  const ringColor = ring === 'live' ? sys.color.green : ring === 'over' ? sys.color.lineStrong : null;
  return <View accessible={false} style={[s.edge, sys.elevation.soft, ringColor ? { borderWidth: FACE_EDGE, borderColor: ringColor } : null]}>{children}</View>;
}

/**
 * The one stand-in for a person's photo (2026-09-24): a round green-soft disc with their initials, or a drawn person when
 * there is no name to take letters from. Pass `inicijali(name)` from `lib/inicijali`; an empty string or null draws the
 * person, so a missing name never becomes letters that belong to nobody.
 *
 * The disc is decoration: the person's name always stands beside it, so a screen reader hears the name once, not the
 * name and then its letters. The letters keep their size under a larger text setting, because they must stay inside
 * the disc and say nothing the name beside them does not.
 *
 * `edge` draws the sticker edge round it (`FaceEdge`) and `ring` a state ring outside that; both are off by default, so a face in
 * a row is exactly what it always was.
 */
function AvatarBase({ initials, size = 40, edge = false, ring }: { initials: string | null | undefined; size?: AvatarSize; edge?: boolean; ring?: FaceRing }) {
  const letters = initials?.trim() || null;
  const disc = <View accessible={false} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden
    style={[s.disc, { width: size, height: size }]}>
    {letters ? <T variant="label" maxFontSizeMultiplier={1} numberOfLines={1} style={[s.letters, LETTERS[size]]}>{letters}</T>
      : <FactArt kind="person" size={GLYPH[size]} />}
  </View>;
  return edge || ring ? <FaceEdge ring={ring}>{disc}</FaceEdge> : disc;
}

export const Avatar = memo(AvatarBase);

const s = StyleSheet.create({
  disc: { borderRadius: sys.radius.pill, backgroundColor: sys.color.greenSoft, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  letters: { color: sys.color.green, fontWeight: '700', letterSpacing: 0, textAlign: 'center' },
  edge: { alignSelf: 'center', alignItems: 'center', justifyContent: 'center', padding: FACE_EDGE, borderRadius: sys.radius.pill, backgroundColor: sys.color.surface },
});
