import { StyleSheet, View } from 'react-native';
import { T } from '../Text';
import { sys } from '../system/tokens';

/**
 * The name of a group in a list of records: "Čeka tebe", "Danas", "Sutra", "Termin još nije dogovoren", "Završeni". A heading, not a control: the
 * `bodyStrong` type in ink, with what the group holds (`count`, "2 Dogovora") under it in a quiet line when there is something to count.
 * 24 above it (the 12 between two cards and its own 12) and 12 below (the cards' gap), the one rhythm of a group title in a list - the
 * Dogovori, the Raspored and the Arhiva draw it the same way (composition spec 4.8, 4.10). `first`: the first heading of a list has
 * nothing above it to stand away from, so the list's own space under the controls is its.
 */
export function GroupHeader({ title, count, first = false }: { title: string; count?: string; first?: boolean }) {
  return <View style={first ? s.first : s.group}>
    <T accessibilityRole="header" variant="bodyStrong" style={s.title}>{title}</T>
    {count ? <T variant="note" tone="muted">{count}</T> : null}
  </View>;
}

const s = StyleSheet.create({
  group: { gap: sys.space.xs, paddingTop: sys.space.md },
  first: { gap: sys.space.xs },
  title: { color: sys.color.ink },
});
