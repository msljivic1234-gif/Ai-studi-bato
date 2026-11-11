import { StyleSheet, View } from 'react-native';
import { Press } from '../Press';
import { T } from '../Text';
import { ProductSheet } from '../product/ProductSheet';
import { Glyph } from '../system/Glyph';
import { layout } from '../system/layout';
import { ListRow } from '../system/ListRow';
import { sys } from '../system/tokens';
import { looseBarLabel } from './calendarViews';
import { entryOpens, saysSomething } from './entryText';
import { PlannerChip } from './PlannerChip';
import { entryTitle, type PlannerEntry } from './planner';

/** The command a Dogovor with no term offers, in its own words. */
export const PROPOSE_TERM_LABEL = 'Predloži termin';

/**
 * "2 Dogovora bez termina ›": the bar over the calendar (owner's sketch, 8 Oct 2026) for the Dogovori that are agreed but have no time on
 * any day. It is there only when there are some, and it is quiet (a tint, an orange dot that says "yours to do", the way into it); the
 * Dogovori themselves are in the sheet it opens, or, when there is one that may ask for a term, in the form that does.
 */
export function LooseBar({ count, hint, onPress }: { count: number; hint: string; onPress: () => void }) {
  return <Press accessibilityRole="button" accessibilityLabel={looseBarLabel(count)} accessibilityHint={hint} haptic="select"
    scaleTo={sys.motion.scale.row} onPress={onPress} style={s.bar}>
    <View style={s.dot} />
    <T variant="bodyStrong" style={s.words}>{looseBarLabel(count)}</T>
    <Glyph name="caret-right" size={20} tone="muted" />
  </Press>;
}

/**
 * The Dogovori without a term, one row each: its title, whose side it is and with whom, its own words for the time when it has any
 * ("Do 10. okt · 18:00 · početak nije potvrđen"), and, for one that may ask for a term, "Predloži termin" at the end of the row, which opens
 * the form that proposes one (the same one Početna's "Čeka te" and the Dogovor's own menu open). A row that cannot ask (it waits for a
 * confirmation, or a change of its term waits for an answer) opens the Dogovor. The command is never drawn without the way to take it.
 */
export function LooseSheet({ entries, onOpen, onProposeTerm, onClose }: {
  entries: readonly PlannerEntry[]; onOpen: (agreementId: string) => void; onProposeTerm?: (agreementId: string) => void; onClose: () => void;
}) {
  return <ProductSheet title={looseBarLabel(entries.length)} onClose={onClose}>
    {dismiss => <View style={s.list}>
      {entries.map((entry, at) => {
        const propose = entry.proposesTerm && onProposeTerm ? onProposeTerm : null;
        const who = [entry.role, entry.person].filter((part): part is string => !!part).join(' · ');
        const words = [entry.timeWord, entry.place].filter((part): part is string => !!part).join(' · ');
        return <ListRow key={entry.key} title={entryTitle(entry)} subtitle={who || undefined} meta={words || undefined}
          accessibilityLabel={propose ? `${PROPOSE_TERM_LABEL}. ${entryTitle(entry)}` : entryOpens(entry)}
          trailing={propose ? <T variant="note" tone="green" style={s.command}>{PROPOSE_TERM_LABEL}</T> : saysSomething(entry) ? <PlannerChip status={entry.status} /> : undefined}
          last={at === entries.length - 1} onPress={() => { if (propose) propose(entry.id); else onOpen(entry.id); dismiss(); }} />;
      })}
    </View>}
  </ProductSheet>;
}

const s = StyleSheet.create({
  bar: { minHeight: layout.touch, flexDirection: 'row', alignItems: 'center', gap: sys.space.md, paddingVertical: sys.space.sm, paddingHorizontal: sys.space.base,
    borderRadius: sys.radius.control, backgroundColor: sys.color.wash },
  // The orange of what is yours to do: a Dogovor that waits for a term.
  dot: { width: 8, height: 8, borderRadius: sys.radius.pill, backgroundColor: sys.color.orange },
  words: { flex: 1, minWidth: 0 },
  list: { paddingBottom: sys.space.base },
  command: { fontWeight: '600' },
});
