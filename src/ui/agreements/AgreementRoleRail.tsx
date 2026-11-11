import { useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Press } from '../Press';
import { T } from '../Text';
import { Glyph } from '../system/Glyph';
import { layout } from '../system/layout';
import { useTextScale } from '../system/textScale';
import { sys } from '../system/tokens';
import { AGREEMENT_ROLE_FILTERS, type AgreementRoleFilter } from './agreementListModel';

type Props = { value: AgreementRoleFilter; onChange: (value: AgreementRoleFilter) => void };
type Bounds = { x: number; width: number };

/** Keep the three roles in one rail without shrinking type or touch targets. Resizing remeasures the whole rail. */
export function AgreementRoleRail(props: Props) {
  const [width, setWidth] = useState(0);
  const scale = useTextScale();
  return <View style={s.frame} onLayout={event => setWidth(event.nativeEvent.layout.width)}>
    <MeasuredRail key={`${width}:${scale}`} {...props} width={width} />
  </View>;
}

function MeasuredRail({ value, onChange, width }: Props & { width: number }) {
  const scroll = useRef<ScrollView>(null);
  const bounds = useRef(new Map<AgreementRoleFilter, Bounds>());
  const offset = useRef(0);
  const contentWidth = useRef(0);
  const selected = useRef(value); selected.current = value;
  const reveal = () => {
    if (width <= 0 || contentWidth.current <= 0 || bounds.current.size !== AGREEMENT_ROLE_FILTERS.length) return;
    const item = bounds.current.get(selected.current);
    if (!item) return;
    const end = contentWidth.current;
    const target = item.width > width || item.x < offset.current ? item.x
      : item.x + item.width > offset.current + width ? item.x + item.width - width : offset.current;
    const next = Math.max(0, Math.min(target, Math.max(0, end - width)));
    if (Math.abs(next - offset.current) < 1) return;
    scroll.current?.scrollTo({ x: next, animated: false });
  };
  // A person's manual horizontal scroll does not trigger this effect or change their selected role.
  useEffect(reveal, [value, width]); // Bounds arrive from the native layout callbacks below.
  return <ScrollView ref={scroll} horizontal showsHorizontalScrollIndicator={false} style={s.rail}
    contentContainerStyle={s.items} keyboardShouldPersistTaps="handled" scrollEventThrottle={16}
    onContentSizeChange={measured => { contentWidth.current = measured; reveal(); }}
    onScroll={event => { offset.current = event.nativeEvent.contentOffset.x; }}
    accessibilityRole="radiogroup" accessibilityLabel="Vaša uloga u Dogovorima">
    {AGREEMENT_ROLE_FILTERS.map(option => {
      const on = value === option.key;
      return <Press key={option.key} accessibilityRole="radio" accessibilityLabel={option.spoken}
        accessibilityState={{ checked: on }} onPress={() => onChange(option.key)} haptic="select"
        onLayout={event => {
          const { x, width: measured } = event.nativeEvent.layout;
          const previous = bounds.current.get(option.key);
          if (previous?.x === x && previous.width === measured) return;
          bounds.current.set(option.key, { x, width: measured }); reveal();
        }} style={[s.chip, width > 0 && { maxWidth: width }, on && s.selected]}>
        {on ? <Glyph name="check" size={16} tone="green" /> : null}
        <T variant="meta" style={[s.text, on && s.selectedText]}>{option.label}</T>
      </Press>;
    })}
  </ScrollView>;
}

const s = StyleSheet.create({
  frame: { flex: 1, minWidth: 0, minHeight: layout.touch },
  rail: { flexGrow: 0 },
  items: { flexDirection: 'row', alignItems: 'center', gap: sys.space.sm },
  chip: { flexDirection: 'row', alignItems: 'center', gap: sys.space.xs, minHeight: layout.touch,
    paddingHorizontal: sys.space.base, paddingVertical: sys.space.xs, borderRadius: sys.radius.pill,
    borderWidth: 1, borderColor: sys.color.line, backgroundColor: sys.color.surface },
  selected: { borderColor: sys.color.green },
  text: { flexShrink: 1, color: sys.color.ink, fontWeight: '600' },
  selectedText: { color: sys.color.green },
});
