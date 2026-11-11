import { ScrollView, StyleSheet, View } from 'react-native';
import { Press } from '../../Press';
import { T } from '../../Text';
import { Glyph } from '../../system/Glyph';
import { sys } from '../../system/tokens';

/**
 * A capsule that is one existing choice, toggled at once, without opening anything. `removable` is for one that is on and has a ✕ of its
 * own to take it away ("Nisu na mapi ✕", a time that has no capsule of its own); a plain one that is on has a tick.
 */
export type QuickChip = { key: string; label: string; selected: boolean; onPress: () => void; removable?: boolean; hint?: string };

/** Which tasks the list is about: every open task, or only the ones that match the person's own work profile. */
export type ScopeKey = 'all' | 'forMe';
/** The one word of the scope that is a capsule: on, the list is about the tasks that fit the person's own work profile. */
export const FOR_ME = 'Za mene';

/**
 * The one row of capsules over the map, under the primary Filteri control (UX plan 2.13 and section P; the owner's phone of 7 and 8 Oct
 * 2026; the approved plan, U1: "Za mene · Danas · Ovaj vikend · Na daljinu · Sa iznosom", each only where the search really has it): the capsules that float
 * over the map, each raised off the tiles. It stands there at every height of the list and never moves into it: the list's own top line says only how
 * many tasks there are and in what order. It scrolls sideways, so a capsule cut by the edge says there is more.
 *
 * - "Na lokaciji" and "Na daljinu" lead when available. "Za mene" follows: a capsule that is on or off, drawn only when the build says the server has the filter key (`forMeAvailable`,
 *   DISCOVERY-ZAMENE): a control that does nothing is not shown. It used to be a two-part switch beside "Svi zadaci", which said "Svi zadaci"
 *   a second time under the pill and pushed the capsules off the screen.
 * - The rest are the quick choices the search really has and the tasks can back (the screen decides which), each writing into the same
 *   state as the filters, so there are never two sources of truth. What is on and has no capsule of its own stands here too, with its own ✕, so no
 *   condition filters the list unseen. "Moja lokacija" is not here: it is not a filter, it only moves the camera, so it stands above the list.
 * - The full filters are opened by the primary control above this row (`DiscoverySearchBar`).
 */
export function DiscoveryChipRow({ forMeAvailable = false, scope = 'all', onScope, chips, testID = 'discovery-chips' }: {
  forMeAvailable?: boolean;
  scope?: ScopeKey; onScope?: (scope: ScopeKey) => void;
  chips: readonly QuickChip[];
  testID?: string;
}) {
  const remote = chips.find(chip => chip.key === 'where:remote');
  const onsite = chips.find(chip => chip.key === 'where:onsite' && !chip.removable);
  return <ScrollView testID={testID} horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled"
    accessibilityLabel="Brzi filteri" style={s.rail} contentContainerStyle={s.chips}>
    {onsite ? <Capsule key={onsite.key} label={onsite.label} selected={onsite.selected} hint={onsite.hint} onPress={onsite.onPress} /> : null}
    {remote ? <Capsule key={remote.key} label={remote.label} selected={remote.selected} removable={remote.removable} hint={remote.hint} onPress={remote.onPress} /> : null}
    {forMeAvailable ? <Capsule testID="chip-for-me" label={FOR_ME} selected={scope === 'forMe'} hint="Zadaci koji odgovaraju tvom radnom profilu."
      onPress={() => onScope?.(scope === 'forMe' ? 'all' : 'forMe')} /> : null}
    {chips.filter(chip => chip.key !== remote?.key && chip.key !== onsite?.key).map(chip => <Capsule key={chip.key} label={chip.label} selected={chip.selected} removable={chip.removable} hint={chip.hint} onPress={chip.onPress} />)}
  </ScrollView>;
}

/** A quiet capsule inside a full touch target; selection has both color and a mark. */
function Capsule({ label, selected, removable = false, hint, testID, onPress }: {
  label: string; selected: boolean; removable?: boolean; hint?: string; testID?: string; onPress: () => void;
}) {
  return <Press testID={testID} accessibilityRole="button" accessibilityLabel={label} accessibilityHint={hint} accessibilityState={{ selected }}
    haptic="select" scaleTo={sys.motion.scale.button} hitSlop={0} onPress={onPress}
    style={s.touch}>
    <View style={[s.chip, selected && s.chipOn]}>
    {selected && !removable ? <Glyph name="check" size={16} tone="ink" /> : null}
    <T variant="meta" style={[s.chipText, selected && s.chipTextOn]} numberOfLines={1}>{label}</T>
    {selected && removable ? <Glyph name="close" size={16} tone="ink" /> : null}
    </View>
  </Press>;
}

const s = StyleSheet.create({
  rail: { flexGrow: 0, alignSelf: 'stretch' },
  chips: { flexDirection: 'row', alignItems: 'center', gap: sys.space.sm, paddingHorizontal: sys.space.base },
  touch: { minHeight: sys.touch.min, minWidth: sys.touch.min, justifyContent: 'center' },
  chip: { flexDirection: 'row', alignItems: 'center', gap: sys.space.sm, minHeight: 36, paddingVertical: sys.space.sm, paddingHorizontal: sys.space.md, borderRadius: sys.radius.pill,
    borderWidth: 1, borderColor: sys.color.line, backgroundColor: sys.color.surface,
    shadowColor: sys.color.ink, shadowOpacity: 0.08, shadowRadius: 4, shadowOffset: { width: 0, height: 2 }, elevation: 3 },
  chipOn: { backgroundColor: sys.color.greenSoft, borderColor: sys.color.green },
  chipText: { fontWeight: '500', color: sys.color.ink },
  chipTextOn: { fontWeight: '600' },
});
