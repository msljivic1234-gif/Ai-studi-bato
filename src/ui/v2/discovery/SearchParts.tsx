import type { Ref } from 'react';
import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';
import { Press } from '../../Press';
import { T } from '../../Text';
import { withInter } from '../../interFont';
import { FactArt, type FactArtKind } from '../../system/FactArt';
import { Glyph } from '../../system/Glyph';
import { layout } from '../../system/layout';
import { fieldBox, sys } from '../../system/tokens';

/** The picture that leads a row which has no number (the map's area, the person's own position): the 2.5D sticker, as every fact's. */
const LEAD_ART = 28;

/** One set of choices, one of which is chosen (a radio group to a screen reader), with a quiet selected state. */
export function Choice<K extends string>({ label, options, value, compact = false, onChange }: {
  label: string; options: readonly (readonly [K, string])[]; value: K | null; compact?: boolean; onChange: (value: K) => void;
}) {
  return <View accessibilityRole="radiogroup" accessibilityLabel={label} style={s.chips}>
    {options.map(([key, words]) => {
      const checked = key === value;
      // The 48 dp minimum and existing hit slop remain; text can wrap at larger system scales.
      return <Press key={key} accessibilityRole="radio" accessibilityLabel={words} accessibilityState={{ checked }} aria-checked={checked}
        haptic="select" scaleTo={sys.motion.scale.button} hitSlop={{ top: sys.space.xs, bottom: sys.space.xs }} onPress={() => onChange(key)} style={[s.chip, checked && s.chipOn]}>
        {checked ? <Glyph name="check" size={16} /> : null}
        <T variant={compact ? 'note' : 'copy'} style={[s.chipText, checked && s.chipTextOn]}>{words}</T>
      </Press>;
    })}
  </View>;
}

/**
 * The system's one text field, with the search glass before it and a clear button in it. The glass is a hint of what the
 * field does; the field's name is its `label`, spoken, and its placeholder is only the example.
 */
export function SearchField({ value, onChangeText, label, placeholder, clearLabel, returnKeyType, onSubmit, testID, inputRef, autoFocus = false, maxLength = 1000 }: {
  value: string; onChangeText: (text: string) => void; label: string; placeholder: string; clearLabel: string;
  returnKeyType?: TextInputProps['returnKeyType']; onSubmit?: () => void; testID?: string; inputRef?: Ref<TextInput>; autoFocus?: boolean; maxLength?: number;
}) {
  return <View style={s.field}>
    <Glyph name="search" tone="muted" />
    <TextInput ref={inputRef} testID={testID} accessibilityLabel={label} placeholder={placeholder} placeholderTextColor={sys.color.muted}
      value={value} onChangeText={text => onChangeText(text.slice(0, maxLength))} maxLength={maxLength} style={s.input}
      multiline={false} numberOfLines={1} returnKeyType={returnKeyType} onSubmitEditing={onSubmit} autoFocus={autoFocus} />
    {value ? <Press accessibilityRole="button" accessibilityLabel={clearLabel} haptic="select" hitSlop={0} style={s.clear}
      onPress={() => onChangeText('')}><Glyph name="close" size={16} /></Press> : null}
  </View>;
}

/**
 * A row of "Gde" (the owner's pick of 8 Oct 2026, "Gradovi brojem"): the NUMBER of tasks leads the row, 16/700 in a column of its own, and the place stands
 * beside it, so a city is no longer a pin again and again. A row that has no number to lead with has what leads it instead: a picture where the place is not
 * a city (the map's area, the person's own position), the words "Još nema" for a city nobody has posted in, or nothing while the count is not known. The
 * place, one quiet line under it when there is more to say, and a tick when it is the one chosen. The rows touch, so a row takes no touch beyond itself. A
 * row that only leads on to more rows (a city whose tasks are under its parts) is a button and has no tick to show. What a screen reader hears is `label`.
 */
export function PlaceRow({ art, count, lead, text, note, label, hint, role = 'radio', checked = false, onPress }: {
  /** A picture in the lead column, for a place that has no number to lead with. */ art?: FactArtKind;
  /** How many tasks: the figure that leads the row; `null` or left out says nothing (the count is not known). */ count?: number | null;
  /** Words in the lead column instead of a figure ("Još nema"). */ lead?: string;
  text: string; note?: string | null;
  /** What a screen reader says: the place and its count in one go. */ label: string; hint?: string;
  role?: 'radio' | 'button'; checked?: boolean; onPress: () => void;
}) {
  return <Press accessibilityRole={role} accessibilityLabel={label} accessibilityHint={hint}
    accessibilityState={role === 'radio' ? { checked } : undefined} aria-checked={role === 'radio' ? checked : undefined}
    haptic="select" scaleTo={sys.motion.scale.row} hitSlop={0} onPress={onPress} style={[s.place, checked && s.placeOn]}>
    <View style={[s.lead, (art || typeof count === 'number') && s.leadTile]}>
      {art ? <FactArt kind={art} size={LEAD_ART} />
        : typeof count === 'number' ? <T variant="priceRow" tone={count === 0 ? 'muted' : undefined} style={s.count}>{count}</T>
          : lead ? <T variant="meta" tone="muted" style={s.leadWords}>{lead}</T> : null}
    </View>
    <View style={s.grow}>
      <T variant="body" style={s.ink} numberOfLines={2}>{text}</T>
      {note ? <T variant="note" tone="muted">{note}</T> : null}
    </View>
    {checked ? <Glyph name="check" tone="green" /> : role === 'button' ? <Glyph name="caret-right" tone="muted" /> : null}
  </Press>;
}

/** The quiet title of a group of rows ("Popularni gradovi"): the list's own words, never a card. */
export function GroupTitle({ children }: { children: string }) {
  return <T variant="note" tone="muted" accessibilityRole="header" style={s.groupTitle}>{children}</T>;
}

const s = StyleSheet.create({
  grow: { flex: 1, minWidth: 0 },
  ink: { color: sys.color.ink },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: sys.space.sm },
  // Selection uses a quiet neutral well, ink outline and check; green belongs to the apply action.
  chip: { flexDirection: 'row', alignItems: 'center', gap: sys.space.xs, minHeight: 48, maxWidth: '100%', paddingHorizontal: sys.space.md,
    paddingVertical: sys.space.sm, borderRadius: sys.radius.control,
    borderWidth: 1, borderColor: sys.color.lineStrong, backgroundColor: sys.color.surface },
  chipOn: { backgroundColor: sys.color.wash, borderColor: sys.color.ink },
  chipText: { fontWeight: '500', color: sys.color.ink, flexShrink: 1 },
  chipTextOn: { color: sys.color.ink, fontWeight: '600' },
  // The one text field of the system, with the search glass before it and the clear button in it.
  field: { ...fieldBox, flexDirection: 'row', alignItems: 'center', gap: sys.space.sm, paddingVertical: 0, paddingRight: sys.space.xs },
  input: withInter({ ...sys.type.body, color: sys.color.ink, flex: 1, minWidth: 0, minHeight: 48, paddingVertical: sys.space.sm }),
  clear: { width: 48, height: 48, borderRadius: sys.radius.pill, alignItems: 'center', justifyContent: 'center' },
  // Place rows read as a list; only the chosen row has a neutral well and a check. The row's picture and words stand at the edge of the list (the
  // section names above them), and the chosen row's well reaches 8 beyond it, so a tint never makes the words step in.
  place: { flexDirection: 'row', alignItems: 'center', gap: sys.space.md, minHeight: 56, marginHorizontal: -sys.space.sm, paddingHorizontal: sys.space.sm,
    paddingVertical: sys.space.sm, borderRadius: sys.radius.control },
  placeOn: { backgroundColor: sys.color.greenSoft },
  // The lead column is as wide as a person's face slot, so every place of the list starts at the same edge; a figure or the words stand at its right.
  lead: { minWidth: layout.slotFace, alignItems: 'flex-end', justifyContent: 'center' },
  leadTile: { minHeight: layout.slotFace, alignItems: 'center', borderRadius: sys.radius.control, backgroundColor: sys.color.wash,
    paddingHorizontal: sys.space.xs, paddingVertical: sys.space.xs },
  count: { textAlign: 'right' },
  leadWords: { textAlign: 'right' },
  groupTitle: { paddingTop: sys.space.md, fontWeight: '600' },
});
