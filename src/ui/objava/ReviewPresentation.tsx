import type { ReactNode, Ref } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';
import type { PrilikaProjekcija } from '../../contracts/projections';
import { T } from '../Text';
import { Press } from '../Press';
import { FactArt } from '../system/FactArt';
import { Glyph } from '../system/Glyph';
import { KeyValueRow } from '../system/KeyValueRow';
import { layout } from '../system/layout';
import { ListRow } from '../system/ListRow';
import { Screen } from '../system/Screen';
import { Section } from '../system/Section';
import { SuccessMark } from '../system/SuccessMark';
import { Surface } from '../system/Surface';
import { brandAction, field, sys } from '../system/tokens';
import { WaitingDot } from '../v2/TaskFace';
import { TaskCard } from '../v2/TaskCard';
import { EditPencil, type PartPencil } from './EditPencil';

/**
 * The parts of the publish review (/pregled-zadatka), drawings only: the route owns every command, guard and read, and
 * the design gallery (/dizajn-objava) draws the same parts from fixtures.
 *
 * The review IS the task as the people who will read it get it (owner, 8 Oct 2026: "pregled zadatka pre objave treba da bude kao detaljan
 * pregled zadatka… on vidi kako će drugi videti taj zadatak"): first the real card of the task, as the map and the list draw it
 * (`ReviewCard`), then the real page that opens from it (`ReviewDetail`), with the owner's pencils on each part and, for him alone, the frame of
 * the exact address. There is no list of facts and no step between: what still stands in the way is a short list at the top, and the one green
 * "Objavi zadatak" is the foot. It stands on the one grid: the screen is a `Screen kind="flow"` with its one foot, parts are parted by space
 * and never by a line. A pencil is not drawn while the screen cannot act (a save is running, an edit is open, an outcome is not read yet),
 * so the one open thing is the only thing that can be pressed and nothing looks pressable that is not.
 */

/**
 * The frame of the review: `Screen kind="flow"` with its bar and its one foot, and, inside it, the scroll of the parts. `Screen` draws the
 * measure of every screen (the edge `layout.gutter`, 8 under the bar, `layout.section` between the parts and above the foot), but gives no
 * reference to its scroll, and an open correction has to scroll its part into view (`scrollRef`, `contentRef`). So the review turns `Screen`'s
 * own measure off (`reset`) and draws the same numbers around the scroll it holds (F8: a `scrollRef` on `Screen` takes this back, and this
 * is the one place to change).
 */
export function ReviewFrame({ header, footer, scrollRef, contentRef, children }: { header: ReactNode; footer?: ReactNode;
  scrollRef?: Ref<ScrollView>; contentRef?: Ref<View>; children: ReactNode }) {
  return <Screen kind="flow" scroll={false} contentStyle={frame.reset} header={header} footer={footer}>
    <ScrollView ref={scrollRef} keyboardShouldPersistTaps="handled" style={frame.fill} contentContainerStyle={frame.content}>
      <View ref={contentRef} style={frame.stack}>{children}</View>
    </ScrollView>
  </Screen>;
}

/**
 * What the stored command ended in, said once at the top, in a note. Only a publication confirmed here and now springs. `action` is the one
 * way to check what the note says is not known ("Proveri", the one word of the app's vocabulary of trouble), drawn inside the note it belongs to.
 */
export function ReviewStatus({ published, fresh, text, action }: { published: boolean; fresh: boolean; text: string; action?: ReactNode }) {
  return <Surface kind="note">
    {/* The action stands in the sentence's own column, so a quiet button starts where the words start; with one the icon stands at the first line. */}
    <View style={[s.statusRow, action ? s.statusRowTop : null]}>
      {published ? <SuccessMark fresh={fresh} size={40} /> : <FactArt kind="info" size={24} />}
      <View style={s.statusText}>
        <T accessibilityLiveRegion="polite" variant="body">{text}</T>
        {action}
      </View>
    </View>
  </Surface>;
}

/**
 * The first half of the preview: the task as the map and the list draw it, the real card (`TaskCard`, the one the Zadaci list and the pin's
 * sheet are made of), with the caption that says so and the pencil that returns to the conversation (the whole task is changed there; each
 * part of it has its own pencil below). The card is the one the others touch, so it is touched here too, and what it opens is the page under it:
 * `onOpen` takes the owner to it. Nothing about it is drawn that the review does not know: no distance (it is the distance from the one who
 * looks), no age, no state (this is a task that is not published yet).
 */
export function ReviewCard({ need, onOpen, pencil, portrait }: { need: PrilikaProjekcija; onOpen: () => void; pencil?: PartPencil;
  /** The owner's authorized portrait; without it the initials stand in. */ portrait?: ReactNode }) {
  return <View testID="review-card">
    <View style={s.captionRow}>
      <T variant="note" tone="muted" style={s.caption}>Ovako ga vide na mapi i u listi</T>
      {pencil ? <EditPencil pencil={pencil} /> : null}
    </View>
    <TaskCard item={need} onOpen={onOpen} portrait={portrait} />
  </View>;
}

/** The caption of the second half: the page the card opens. */
export function ReviewCaption({ children }: { children: ReactNode }) {
  return <T variant="note" tone="muted" style={s.pageCaption}>{children}</T>;
}

/** `actionLabel` is the word of the way out ("Izmeni termin"), drawn under the sentence so the row reads as the button it is. */
export type TodoRow = { key: string; text: string; onPress?: () => void; actionLabel?: string };

/**
 * "Još treba": each blocker as a row with the orange dot (the screen's one accent), its sentence and, where a tap leads to the fix, the
 * word of that fix under it and the arrow ("Dopuni u razgovoru ›"). A row that leads nowhere has no arrow and no press: nothing here looks
 * like a link and goes nowhere (owner's phone, 2026-10-07: a sentence with a faint arrow beside a grey publish was not read as a button, so
 * the way out is said in words and the row is the one a touch is meant for). It stands at the top, above the task, because it is why the
 * green action under it is grey.
 */
export function ReviewTodoList({ items, disabled, children }: { items: readonly TodoRow[]; disabled: boolean; children?: ReactNode }) {
  return <Section title="Još treba">
    {items.map((item, index) => <ListRow key={item.key} leading={<WaitingDot />} title={item.text}
      subtitle={item.onPress ? item.actionLabel : undefined} accessibilityLabel={item.onPress ? item.text : undefined}
      accessibilityHint={item.onPress ? item.actionLabel : undefined} disabled={disabled && !!item.onPress}
      onPress={item.onPress} last={index === items.length - 1 && !children} />)}
    {children}
  </Section>;
}

/**
 * The way out at the end of a review that is not published yet, after everything there is to change (owner, 2026-10-07: "when the user arrives
 * at this review there is no easy way to delete it"): "Obriši nacrt", in the danger colour, which asks first. It is a row of the page and not
 * another button in the foot, where the green "Objavi zadatak" and "Sačuvaj nacrt" are the whole of what can be decided. Going back to the
 * conversation to change the task is the arrow of the bar and the pencil of the card, not a row of its own. `onDelete` is left out where there is
 * no draft to delete (the changes of a task that exists): then there is no way out here at all and nothing is drawn.
 */
export function ReviewWaysOut({ onDelete, onEdit, disabled }: { onDelete?: () => void; onEdit?: () => void; disabled: boolean }) {
  if (!onDelete && !onEdit) return null;
  return <Section>
    {onEdit ? <ListRow leading={<Glyph name="edit" size={24} />} title="Izmenite kroz razgovor" accessibilityLabel="Izmenite zadatak" disabled={disabled} last={!onDelete}
      onPress={() => onEdit()} /> : null}
    {onDelete ? <ListRow leading={<Glyph name="trash" size={24} tone="danger" />} title="Obrišite nacrt" accessibilityLabel="Obrišite nacrt" tone="danger" disabled={disabled} last
      onPress={onDelete} /> : null}
  </Section>;
}

/**
 * An open correction: what is corrected, then its editor and its commands (`children`), and nothing else of the part. A line made of several facts
 * (the price, the time) names what is corrected by its tabs, so it has no name of its own (`name` left out).
 */
export function ReviewEditing({ name, rowRef, children }: { name?: string; rowRef?: (node: View | null) => void; children: ReactNode }) {
  return <View ref={rowRef} collapsable={false} style={s.editing}>
    {name ? <T variant="meta" tone="muted">{name}</T> : null}
    {children}
  </View>;
}

/**
 * One fact's row, for what is not a line of the page of others (the facts under "Dodaj još podataka"): its label and its value, and a word
 * "Izmeni" at the end of the row (`KeyValueRow`: beside the label when the value is short and the text ordinary, under it when it is long or the
 * text is large). While an edit is open the row is its editor (`children`).
 */
export function ReviewFactRow({ label, value, system, edit, actionLabel, children, rowRef, last = false }: {
  label: string; value: string; system: boolean; edit?: () => void; actionLabel?: string;
  /** An open correction: replaces the value with its editor. */ children?: ReactNode;
  rowRef?: (node: View | null) => void; /** The last row of its group: no divider under it. */ last?: boolean;
}) {
  if (children) return <ReviewEditing name={label} rowRef={rowRef}>{children}</ReviewEditing>;
  // A value the system chose says so under it, in the same quiet words, so it is not read as the owner's own.
  const shown = system ? <View><T variant="body">{value}</T><T variant="meta" tone="muted">Podrazumevana vrednost</T></View> : value;
  return <View ref={rowRef} collapsable={false}>
    <KeyValueRow label={label} value={shown} action={edit ? { label: actionLabel ?? 'Izmenite', onPress: edit } : undefined} last={last} />
  </View>;
}

/**
 * What the task does not say yet, and can: the facts the page of others draws no line for (the lists with nothing in them, how many people
 * when it is one) named in ONE row, which opens them in place as rows with their pencil ("Dodaj još podataka · Alat · Vozila"). Nothing
 * is hidden from what is being accepted, and nothing is a wall of "Nema navedenih stavki".
 */
export function ReviewMoreFacts({ labels, open, disabled = false, onToggle, children }: { labels: readonly string[]; open: boolean;
  /** Not now: a correction is open elsewhere, so the row neither opens nor closes what is under it. */ disabled?: boolean; onToggle: () => void; children?: ReactNode }) {
  return <View>
    <ListRow leading={<FactArt kind="document" size={32} />} tone="quiet" title="Dodajte još podataka" subtitle={labels.join(' · ')}
      accessibilityLabel={`Dodajte još podataka: ${labels.join(', ')}`} expanded={open} disabled={disabled} last onPress={onToggle} />
    {open ? children : null}
  </View>;
}

/**
 * The one brand action of the review. Its states are the V2Action states: at work it keeps its green and its words with
 * a spinner before them; unavailable it is the quiet wash with muted words, never a faded copy of the live button. Why it is grey is
 * said in the foot (`FlowFooter reason`), above it; here it is only its spoken hint.
 */
export function PublishButton({ label, blocked, working, reason, onPress }: { label: string; blocked: boolean; working: boolean;
  /** Why it is grey: spoken as its hint (the same line is drawn above it, in the foot). */ reason?: string | null; onPress: () => void }) {
  const resting = blocked && !working;
  return <Press accessibilityRole="button" accessibilityLabel={label} accessibilityHint={resting && reason ? reason : undefined} disabled={blocked}
    accessibilityState={working ? { disabled: true, busy: true } : { disabled: blocked }} onPress={onPress}
    style={[s.publish, resting && s.publishResting]}>
    {working ? <ActivityIndicator color={sys.color.onGreen} /> : null}
    <T style={[s.publishLabel, resting && s.publishLabelResting]}>{label}</T>
  </Press>;
}

/** What the route draws around the parts: the field of an open correction, the sentence of an error, and the one note of a failure. */
export const reviewStyles = StyleSheet.create({
  error: { ...sys.type.meta, color: sys.color.danger },
  // The editor's text field: the app's one field (its green outline was the loudest line of the review, 2026-09-24).
  input: { ...field, minHeight: 56, paddingVertical: sys.space.md },
  warnText: { ...sys.type.note, color: sys.color.warn },
  identity: { gap: sys.space.sm, paddingTop: sys.space.sm },
});

const frame = StyleSheet.create({
  fill: { flex: 1 },
  reset: { paddingHorizontal: 0, paddingTop: 0, paddingBottom: 0, gap: 0 },
  content: { width: '100%', maxWidth: layout.maxWidth, alignSelf: 'center', paddingHorizontal: layout.gutter, paddingTop: sys.space.sm,
    paddingBottom: layout.section },
  stack: { gap: layout.section },
});

const s = StyleSheet.create({
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: sys.space.md },
  statusRowTop: { alignItems: 'flex-start' },
  statusText: { flex: 1, minWidth: 0, gap: sys.space.xs },
  // The caption is a touch high when it carries the pencil, and its words stand in the middle of that line.
  captionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: layout.group, minHeight: layout.touch },
  caption: { flex: 1, minWidth: 0 },
  // The second half starts 8 below where the first ends (32 with the gap of the screen), so the two captions are not read as one list; its
  // page begins 12 under its caption, as a section does under its name.
  pageCaption: { marginTop: sys.space.sm, marginBottom: layout.group },
  editing: { paddingVertical: sys.space.md, gap: sys.space.sm },
  publish: { ...brandAction, flexDirection: 'row', gap: sys.space.sm, alignItems: 'center', justifyContent: 'center', padding: sys.space.md },
  // Shrinks and wraps beside the spinner rather than running out of the button ("Potvrdi izmene" at 320 dp
  // with large text).
  publishLabel: { ...sys.type.body, fontWeight: '700', color: sys.color.onGreen, flexShrink: 1, textAlign: 'center' },
  publishResting: { backgroundColor: sys.color.wash, borderWidth: 1, borderColor: sys.color.line },
  publishLabelResting: { color: sys.color.muted },
});
