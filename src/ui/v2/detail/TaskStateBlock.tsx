import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { T } from '../../Text';
import { Avatar } from '../../system/Avatar';
import { sys } from '../../system/tokens';
import { ProductFooterAction } from '../../product/ProductDetails';

/**
 * The block of state at the head of the owner's own task (the owner, 8 Oct 2026: "jedan blok stanja na vrhu"): what the task has now in ONE
 * line - "Još nema prijava", or the faces of the people who applied and how many ("3 prijave") - and under it the one green action when
 * something is the owner's to do. The edit is not here: it stands in the bar of the page, in sight (the approved draft R3, rule J15). Nothing
 * here explains: no sentence says where the applications can be seen.
 *
 * The faces are people and never invented: a count of applications draws at most three drawn people, side by side, and "+N" for the rest;
 * a screen that has read the applicants hands their real faces in (`faces`) and they stand in their place.
 */
export type StateAction = { label: string; accessibilityLabel?: string; disabled?: boolean; arrow?: boolean; onPress: () => void };

/** How many faces the block draws before it says "+N". */
export const STATE_FACES = 3;

/** The people who applied, as stickers laid over each other by a third; the count is the line beside them, so the faces are decoration. */
function Faces({ count }: { count: number }) {
  const shown = Math.min(count, STATE_FACES), rest = count - shown;
  return <View importantForAccessibility="no-hide-descendants" accessibilityElementsHidden style={s.faces}>
    {Array.from({ length: shown }, (_, index) => <View key={index} style={index > 0 ? s.overlap : undefined}><Avatar initials={null} size={40} edge /></View>)}
    {rest > 0 ? <View style={[s.more, s.overlap]}><T variant="label" style={s.moreText}>{`+${rest}`}</T></View> : null}
  </View>;
}

export function TaskStateBlock({ notice, line, applicants = 0, faces, note, primary, busy = false, testID }: {
  /** What cannot wait and the chip does not say ("Dogovor je otkazan"), above the line. */
  notice?: string | null;
  /** The one line of data: "Još nema prijava", "3 prijave". */
  line?: string | null;
  /** How many applications the line counts: the faces, at most three. */
  applicants?: number;
  /** The real faces of the applicants, when the screen has them; they replace the drawn ones. */
  faces?: ReactNode;
  /** What a closed search left, in its own words ("1 od 2 dogovoreno · preostala potraga je zatvorena"). */
  note?: string | null;
  /** The one green action of the screen, when something is the owner's to do. */
  primary?: StateAction | null;
  busy?: boolean; testID?: string;
}) {
  if (!notice && !line && !note && !primary) return null;
  return <View testID={testID} style={s.block}>
    {notice ? <T testID="own-task-notice" accessibilityLiveRegion="polite" variant="bodyStrong" style={s.notice}>{notice}</T> : null}
    {line ? <View style={s.standing}>
      {faces ?? (applicants > 0 ? <Faces count={applicants} /> : null)}
      <T testID="own-task-line" variant="heading" style={s.line}>{line}</T>
    </View> : null}
    {note ? <T testID="own-task-note" variant="note" tone="muted">{note}</T> : null}
    {primary ? <ProductFooterAction label={primary.label} accessibilityLabel={primary.accessibilityLabel} disabled={busy || !!primary.disabled}
      arrow={primary.arrow ?? true} onPress={primary.onPress} /> : null}
  </View>;
}

const s = StyleSheet.create({
  // The line, the note and the actions are 12 apart: one block, not three.
  block: { gap: sys.space.md },
  notice: { color: sys.color.warn },
  standing: { flexDirection: 'row', alignItems: 'center', gap: sys.space.md },
  line: { flexShrink: 1, color: sys.color.ink },
  // The faces lie over each other by a third of their width, and "+N" is the last of them.
  faces: { flexDirection: 'row', alignItems: 'center' },
  overlap: { marginLeft: -sys.space.md },
  more: { minWidth: 40, height: 40, borderRadius: sys.radius.pill, paddingHorizontal: sys.space.sm, backgroundColor: sys.color.wash,
    borderWidth: 2, borderColor: sys.color.surface, alignItems: 'center', justifyContent: 'center' },
  moreText: { color: sys.color.ink, letterSpacing: 0 },
});
