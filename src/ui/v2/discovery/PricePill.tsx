import { StyleSheet, View } from 'react-native';
import { CheckCircle, Lightning, User } from 'phosphor-react-native';
import type { PinLabel } from '../../../data/marketplaceView';
import { T } from '../../Text';
import { sys } from '../../system/tokens';
import { BrandMark } from '../../entry/BrandAssets';

/** What a pill on the map shows: one task's price label, or how many tasks share one point. */
export type PillContent = PinLabel | { text: string; tone: 'count'; spoken: string };
/** A positive answer from the current account's separate relation read, never inferred from public task data. */
export type PinRelation = 'OWNED' | 'APPLIED';
export const pinRelationWords = (relation?: PinRelation) => relation === 'OWNED' ? 'Vaš zadatak' : relation === 'APPLIED' ? 'Prijava je već poslata' : '';

// Measure the selected shape at this size, rather than scaling beyond the native snapshot's bounds.
const SELECTED_SCALE = 1.06;

/**
 * A recognisable USKOČI mark and truthful terms, never an invented price. Every capsule stays white; selection adds
 * a quiet orange halo and a slightly larger measured shape. Urgency keeps its separate lightning cue. MapLibre draws
 * this view as a bitmap; camera and sheet motion happen outside it, without an animated child in the annotation.
 */
export function PricePill({ content, urgent = false, selected = false, relation }: {
  content: PillContent; urgent?: boolean; selected?: boolean; relation?: PinRelation;
}) {
  const words = content.tone === 'none' ? null : content.text;
  const scale = selected ? SELECTED_SCALE : 1;
  // A shared point is a group, not an individual relationship. Selection owns the outline; urgency and relationship
  // retain separate glyphs, so an urgent own task cannot erase either fact or introduce a competing fill colour.
  const status = content.tone === 'count' ? undefined : relation;
  const RelationIcon = status === 'OWNED' ? User : CheckCircle;
  return <View collapsable={false} style={s.frame}>
    <View style={s.shape}>
      {selected ? <>
        <View pointerEvents="none" style={s.haloOuter} />
        <View pointerEvents="none" style={s.haloInner} />
      </> : null}
      <View testID="price-pill" style={[s.pill, !words && s.markOnly, urgent && s.urgent,
        selected && s.selected, selected && !words && s.selectedMarkOnly]}>
        <View style={[s.mark, selected && s.selectedMark]} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
          {/* Native paths draw into MapLibre's canvas snapshot, including after route reattachment;
              this exact existing brand mark has no asynchronous image controller to reattach. */}
          <BrandMark size={30 * scale} />
        </View>
        {urgent ? <Lightning size={14 * scale} weight="fill" color={sys.color.danger} /> : null}
        {words ? <T variant="meta" numberOfLines={1} maxFontSizeMultiplier={1.3}
          style={[s.text, TONE[content.tone], selected && s.selectedText]}>{words}</T> : null}
        {status ? <View testID={`pin-relation-${status}`} accessible={false} importantForAccessibility="no-hide-descendants"
          accessibilityElementsHidden style={s.relation}>
          <RelationIcon size={16 * scale} weight="bold" color={sys.color.green} />
        </View> : null}
      </View>
    </View>
  </View>;
}

const s = StyleSheet.create({
  // The outer halo reaches four pixels past the measured shape; eight pixels keep it inside the bitmap.
  frame: { padding: 8 },
  shape: { position: 'relative' },
  // Two quiet edges give the snapshot a soft halo without platform-dependent colored shadows or animation.
  haloOuter: { position: 'absolute', top: -4, right: -4, bottom: -4, left: -4, borderRadius: sys.radius.pill,
    borderWidth: 4, borderColor: sys.color.orange, opacity: 0.08 },
  haloInner: { position: 'absolute', top: -2, right: -2, bottom: -2, left: -2, borderRadius: sys.radius.pill,
    borderWidth: 2, borderColor: sys.color.orange, opacity: 0.16 },
  pill: { flexDirection: 'row', alignItems: 'center', gap: sys.space.xs, minHeight: 40, paddingLeft: 4, paddingRight: sys.space.md, paddingVertical: 3,
    borderRadius: sys.radius.pill, borderWidth: 1, borderColor: sys.color.line, backgroundColor: sys.color.surface,
    shadowColor: sys.color.ink, shadowOpacity: 0.12, shadowRadius: 5, shadowOffset: { width: 0, height: 2 }, elevation: 4 },
  markOnly: { paddingRight: 4, minWidth: 40 },
  mark: { width: 34, height: 34, borderRadius: sys.radius.pill, backgroundColor: sys.color.surface, alignItems: 'center', justifyContent: 'center' },
  urgent: { borderColor: sys.color.danger },
  selected: { minHeight: 40 * SELECTED_SCALE, gap: sys.space.xs * SELECTED_SCALE,
    paddingLeft: 4 * SELECTED_SCALE, paddingRight: sys.space.md * SELECTED_SCALE, paddingVertical: 3 * SELECTED_SCALE,
    borderWidth: SELECTED_SCALE, borderColor: sys.color.orangeHalo },
  selectedMarkOnly: { paddingRight: 4 * SELECTED_SCALE, minWidth: 40 * SELECTED_SCALE },
  selectedMark: { width: 34 * SELECTED_SCALE, height: 34 * SELECTED_SCALE },
  relation: { alignItems: 'center', justifyContent: 'center' },
  // The meta size (13), set a little tighter so the pill stays a small mark on the map.
  text: { lineHeight: 16, letterSpacing: 0, fontVariant: ['tabular-nums'] },
  selectedText: { color: sys.color.orangeInk, fontSize: sys.type.meta.fontSize * SELECTED_SCALE, lineHeight: 16 * SELECTED_SCALE },
});
/** Money is the money colour at the money weight; the offer word is grey and lighter; a count is ink. */
const TONE = StyleSheet.create({
  money: { color: sys.color.money, fontWeight: '600' },
  offer: { color: sys.color.muted, fontWeight: '500' },
  count: { color: sys.color.ink, fontWeight: '600' },
  none: { color: sys.color.muted, fontWeight: '500' },
});
