import { Animated, StyleSheet, View, type DimensionValue } from 'react-native';
import { useBreath } from './Arrive';
import { FACT_ROW_ART } from './FactRow';
import { layout, ruleWidth } from './layout';
import { Surface } from './Surface';
import { useTextScale } from './textScale';
import { sys, cardCompact } from './tokens';

/** Placeholder that matches the final geometry; the list breathes as one while it waits (V41), never per block. */
function SkeletonBlock({ width, height, radius = 8 }: { width: DimensionValue; height: number; radius?: number }) {
  return <View style={{ width, height, borderRadius: radius, backgroundColor: sys.color.skeleton }} />;
}
/**
 * One line of text as a block, centred in the line's own height so rows keep their measure. A share of the width
 * ("60%") takes the rest of its row first, so the share has a width to be measured against.
 */
function SkeletonLine({ width, line, height }: { width: DimensionValue; line: number; height: number }) {
  return <View style={[s.line, { minHeight: line }, typeof width === 'string' && s.grow]}><SkeletonBlock width={width} height={height} radius={6} /></View>;
}

/**
 * Which shape is coming. THREE of them are the shapes of the system itself (UI/UX pass 2026-10-08, F8b; composition spec T7: "skelet iste
 * geometrije kao stvarni red"): a placeholder is drawn with the SAME padding, gaps, slot and line boxes as the real thing, so that when what
 * is coming arrives nothing moves, at the owner's text size too (the line boxes follow the text scale). A list says which one is
 * coming, and the default stays `plain`, as it was.
 *
 * - `row`:    a `ListRow`: the picture in its 40 slot (56 with `face`), two lines (`rows`: 1 to 3), 12 over and under, the inset rule under
 *             every row but the last. `heading` puts a `Section` title's bar over the rows; `switches` swaps the picture for the pill of
 *             a switch at the end (a settings list).
 * - `record`: a `Surface kind="record"`: the same white card, 24 corners, 16 padding and shadow, and in it the measure of a task's face
 *             (`TaskRecordBody`, 12 between its parts): a title line over a row of the amount and the count of people (4 between them),
 *             `rows` fact lines of a `FactRow` (2 by default, 4 apart), and with `foot` the person's 40 picture and two lines. With the foot
 *             it is 207 dp at ordinary text and a one-line title (199 while the fact pictures were 24), which is the least a task card is (a card
 *             is that to about 260: a second line of title, a state over it, a condition under the facts), so the list does not jump by a hand's
 *             breadth when the cards come (it was 146).
 *             The measure is not a number written here: it is the sum of the same tokens the face is built from, and `skeleton.test.tsx` adds them up.
 *             Records stand 12 apart. Use this where a list of tasks, Dogovori or prijave arrives.
 * - `fact`:   a `FactRow`: its picture (28 today, read from `FactRow`) and one line (`rows`: 1 or 2) at its 20 line box, 8 apart. For the facts of a detail screen.
 *
 * The seven that came before are the geometry of one real screen each, as they were drawn when the screen was (r6 on the emulator,
 * b4531ef4: every loading state drew a task card, with an avatar and chips, where a flat thread, three facts or a bare face arrived, so
 * the layout jumped and a card stood where the rule forbids one). They are kept for the screens that use them and are not extended; a
 * screen that is built on the new primitives takes `row`, `record` or `fact`:
 *
 * - `task`: a task list's card, at the measure of the face the task card has since the owner's pick of 8 Oct 2026 (`TaskRecordBody`): the title, then the
 *   facts with the AMOUNT as the first of them (the place of its picture and a bar the width of a sum), `rows` more facts (2 by default), and the foot,
 *   the person's 40 picture and two lines with the count of people at the end of the same line. It is the least a task card is (a title of one line, one line
 *   to each fact), so a list that says `task` waits at the measure it will arrive in. `record` is the older face and keeps its own shape for the
 *   lists of Dogovori and prijave.
 * - `plain`: every other old card (a Prijava, a Dogovor, a task's detail, legal documents, the export): a title and its lines over a quiet
 *   foot, with no person drawn.
 * - `preview`: the publish review's "Ovako će drugi videti zadatak" card (ReviewPreview): the task head and `rows` fact lines on a compact
 *   card, no foot and no person.
 * - `face`: the application composer's task face (TaskHead): the same head and fact lines, bare, closed by the composer's own hairline.
 * - `thread`: one item of the Q&A thread (TaskQaPresentation): the question in bold, the answer behind a 3 px rule and indented, parted
 *   from the next item by a hairline; no frame. `count` is the number of items, `rows` the answer's lines.
 * - `facts`: the Izmene terms (AgreementActionsPresentation's Fact): a 24 px drawing beside a label and its value, `rows` of them.
 * - `person`: the rating screen (AgreementReviewPresentation, eligible): the 56 px face beside the name and role, the question, five
 *   star blanks and the tag pills under a hairline; no frame.
 */
export type SkeletonVariant = 'plain' | 'task' | 'taskDetail' | 'preview' | 'face' | 'thread' | 'facts' | 'person' | 'row' | 'record' | 'fact';

/** What a placeholder tells assistive technology: nothing to read here, the sentence under it says it all. */
const hidden = { importantForAccessibility: 'no-hide-descendants', accessibilityElementsHidden: true } as const;

/** TaskFace's head: the title line with the value slot beside it. */
function Head() {
  return <View style={s.head}>
    <SkeletonLine width="78%" line={22} height={18} />
    <SkeletonLine width={72} line={22} height={18} />
  </View>;
}
/** TaskFace's fact line: a 16 px drawing and the fact at its 19 px line. */
function FactLine({ width }: { width: DimensionValue }) {
  return <View style={s.fact}><SkeletonBlock width={16} height={16} radius={sys.radius.pill} /><SkeletonLine width={width} line={19} height={13} /></View>;
}
const factWidth = (index: number): DimensionValue => index ? '44%' : '60%';

/* ------------------------------------------------------------------------------------------------ the shapes of the system */

/**
 * The side of a fact's picture, from `FactRow` (24 until 2026-10-08, 28 since the owner asked for the 2.5D pictures back). A suite that stands in for
 * `FactRow` with a bare component has no such number, and a placeholder must still draw under it.
 */
const FACT_ART = FACT_ROW_ART ?? 28;

/** The line box of the amount (`priceRow`, 16/21): the one text role of a record that the type scale writes as an optional number. */
const PRICE_LINE = sys.type.priceRow.lineHeight ?? 21;

/** A line box of a text role as it will be at the person's text size: the box and the bar inside it grow with the type. */
function useScaled() {
  const scale = useTextScale();
  return (size: number) => Math.round(size * scale);
}

/**
 * One line of text before it arrives: a capsule `height` high, `share` of the width wide (or `width` dp), standing in the middle of the
 * line box (`line`) the real text will have. The share is measured against the wrapper, which is as wide as the column it stands in.
 */
function TextBar({ width, line, height }: { width: DimensionValue; line: number; height: number }) {
  return <View style={{ minHeight: line, justifyContent: 'center' }}>
    <View style={{ width, height, borderRadius: sys.radius.chip, backgroundColor: sys.color.skeleton }} />
  </View>;
}

/** A `ListRow` before it arrives (see `ListRow`: 12 over and under, 12 between the parts, a 40 slot, 64 high with two lines or a picture). */
function RowPlaceholder({ lines, face, switches, last, index }: { lines: number; face: boolean; switches: boolean; last: boolean; index: number }) {
  const px = useScaled();
  const slot = face ? layout.slotFace : layout.slot;
  const picture = face ? layout.slotFace : 32;
  const start = switches ? 0 : slot + sys.space.md;
  return <View style={[s.listRow, { minHeight: switches && lines < 2 ? layout.rowMinPlain : layout.rowMin }]}>
    {switches ? null : <View style={[s.listSlot, { width: slot }]}><SkeletonBlock width={picture} height={picture} radius={sys.radius.pill} /></View>}
    <View style={s.listCopy}>
      <TextBar width={index % 2 ? '52%' : '64%'} line={px(sys.type.bodyStrong.lineHeight)} height={px(16)} />
      {lines >= 2 ? <TextBar width="40%" line={px(sys.type.note.lineHeight)} height={px(12)} /> : null}
      {lines >= 3 ? <TextBar width="28%" line={px(sys.type.meta.lineHeight)} height={px(10)} /> : null}
    </View>
    {/* The size of the platform switch the real row draws (51 by 31), so the row does not change height when it arrives. */}
    {switches ? <SkeletonBlock width={51} height={31} radius={sys.radius.pill} /> : null}
    {last ? null : <View pointerEvents="none" style={[s.listRule, { left: start }]} />}
  </View>;
}

/** A `FactRow` before it arrives: the picture, 12, and the first line centred on the picture (the copy's own half-leading). */
function FactPlaceholder({ lines, index }: { lines: number; index: number }) {
  const px = useScaled();
  const line = sys.type.note.lineHeight;
  return <View style={[s.factBox, { minHeight: FACT_ART }]}>
    <SkeletonBlock width={FACT_ART} height={FACT_ART} radius={sys.radius.pill} />
    <View style={[s.listCopy, { paddingTop: Math.max(0, (FACT_ART - line) / 2) }]}>
      <TextBar width={index % 2 ? '44%' : '60%'} line={px(line)} height={px(12)} />
      {lines >= 2 ? <TextBar width="36%" line={px(sys.type.meta.lineHeight)} height={px(10)} /> : null}
    </View>
  </View>;
}

/**
 * A `Surface kind="record"` before it arrives: the record's own frame and the measure of a task's face (`TaskRecordBody`: 12 between its
 * parts, 4 inside a part), so the card does not change when its contents do. The title takes the whole width and the amount stands under it
 * with the count of people at the end of that line, as the face draws them.
 */
function RecordPlaceholder({ lines, foot }: { lines: number; foot: boolean }) {
  const px = useScaled();
  return <Surface kind="record">
    <View style={s.recBody}>
      <View style={s.recLead}>
        <TextBar width="78%" line={px(sys.type.heading.lineHeight)} height={px(18)} />
        <View style={s.recDecision}>
          <TextBar width={96} line={px(PRICE_LINE)} height={px(14)} />
          <TextBar width={44} line={px(PRICE_LINE)} height={px(12)} />
        </View>
      </View>
      <View style={s.recFacts}>{Array.from({ length: lines }, (_, index) => <FactPlaceholder key={index} lines={1} index={index} />)}</View>
      {foot ? <View style={s.recFoot}>
        <SkeletonBlock width={layout.slot} height={layout.slot} radius={sys.radius.pill} />
        <View style={s.listCopy}>
          <TextBar width="48%" line={px(sys.type.note.lineHeight)} height={px(12)} />
          <TextBar width="32%" line={px(sys.type.meta.lineHeight)} height={px(10)} />
        </View>
      </View> : null}
    </View>
  </Surface>;
}

/** TaskRecordBody's budget: label above the value and its basis. */
function AmountPlaceholder() {
  const px = useScaled();
  return <View testID="task-skeleton-budget" style={s.recLead}>
    <TextBar width={48} line={px(sys.type.meta.lineHeight)} height={px(10)} />
    <View style={s.taskAmount}>
      <TextBar width={96} line={px(sys.type.priceSmall.lineHeight ?? sys.type.heading.lineHeight)} height={px(18)} />
      <TextBar width={44} line={px(sys.type.note.lineHeight)} height={px(12)} />
    </View>
  </View>;
}

/** Current task composition: title, budget, quiet facts, then the separated person. */
function TaskPlaceholder({ lines }: { lines: number }) {
  const px = useScaled();
  const note = px(sys.type.note.lineHeight);
  return <Surface kind="record">
    <View style={s.recBody}>
      <TextBar width="78%" line={px(sys.type.cardTitle.lineHeight ?? sys.type.heading.lineHeight)} height={px(18)} />
      <AmountPlaceholder />
      <View style={s.taskFacts}>
        {Array.from({ length: lines }, (_, index) => <View key={index} testID="task-skeleton-fact" style={s.taskFact}>
          <SkeletonBlock width={sys.icon.size.row} height={sys.icon.size.row} radius={sys.radius.chip} />
          <View style={s.listCopy}><TextBar width={factWidth(index)} line={note} height={px(12)} /></View>
        </View>)}
      </View>
      <View style={[s.recFoot, s.taskFoot]}>
        <SkeletonBlock width={layout.slot} height={layout.slot} radius={sys.radius.pill} />
        <View style={s.listCopy}>
          <TextBar width="48%" line={note} height={px(12)} />
          <TextBar width="32%" line={note} height={px(12)} />
        </View>
      </View>
    </View>
  </Surface>;
}

/** The detail's title, capacity, amount and labeled facts, at the system text scale.
 * No fake content or actions; the screen owns the single loading announcement. */
function TaskDetailPlaceholder() {
  const px = useScaled();
  return <View {...hidden} style={s.taskDetail}>
    <View style={s.detailTitle}>
      <TextBar width="88%" line={px(sys.type.display.lineHeight ?? 38)} height={px(27)} />
      <TextBar width="56%" line={px(sys.type.display.lineHeight ?? 38)} height={px(27)} />
    </View>
    <TextBar width="42%" line={px(24)} height={px(16)} />
    <Surface kind="panel" variant="tinted" tone="brand" density="comfortable" style={s.detailTitle}>
      <TextBar width="30%" line={px(20)} height={px(12)} />
      <TextBar width="68%" line={px(sys.type.priceHero.lineHeight ?? 38)} height={px(27)} />
      <TextBar width="38%" line={px(20)} height={px(12)} />
    </Surface>
    <Surface kind="panel" variant="tinted" tone="wash" density="comfortable" style={s.detailFacts}>
      {[0, 1].map(index => <View key={index} style={s.factRow}>
        <SkeletonBlock width={FACT_ART} height={FACT_ART} />
        <View style={s.grow}>
          <TextBar width="30%" line={px(20)} height={px(12)} />
          <TextBar width={index ? '75%' : '90%'} line={px(24)} height={px(16)} />
        </View>
      </View>)}
    </Surface>
  </View>;
}

export function SkeletonCard({ rows, variant = 'plain', face = false, switches = false, foot = false, last = true, index = 0 }: {
  rows?: number; variant?: SkeletonVariant;
  /** `row`: the slot holds a person's face (56). */ face?: boolean;
  /** `row`: a switch at the end instead of a picture at the start. */ switches?: boolean;
  /** `record`: a person's picture and two lines at the foot. */ foot?: boolean;
  /** `row`: this is the last of its group, so it draws no rule under it. */ last?: boolean;
  /** `row` and `fact`: which one of the group, so the lines are not all the same width. */ index?: number;
}) {
  if (variant === 'row') return <RowPlaceholder lines={Math.min(3, Math.max(1, rows ?? 2))} face={face} switches={switches} last={last} index={index} />;
  if (variant === 'task') return <TaskPlaceholder lines={rows ?? 2} />;
  if (variant === 'taskDetail') return <TaskDetailPlaceholder />;
  if (variant === 'record') return <RecordPlaceholder lines={rows ?? 2} foot={foot} />;
  if (variant === 'fact') return <FactPlaceholder lines={Math.min(2, Math.max(1, rows ?? 1))} index={index} />;
  const lines = rows ?? 2;
  if (variant === 'preview' || variant === 'face') return <View {...hidden} style={variant === 'preview' ? s.preview : s.face}>
    <Head />
    {Array.from({ length: lines }, (_, at) => <FactLine key={at} width={factWidth(at)} />)}
  </View>;
  if (variant === 'thread') return <View {...hidden} style={s.threadItem}>
    <SkeletonLine width="72%" line={24} height={18} />
    <View style={s.answer}>
      <SkeletonLine width={64} line={18} height={12} />
      {Array.from({ length: lines }, (_, at) => <SkeletonLine key={at} width={at ? '58%' : '88%'} line={24} height={14} />)}
    </View>
  </View>;
  if (variant === 'facts') return <View {...hidden} style={s.factRows}>
    {Array.from({ length: lines }, (_, at) => <View key={at} style={s.factRow}>
      <SkeletonBlock width={24} height={24} radius={sys.radius.pill} />
      <View style={s.factCopy}>
        <SkeletonLine width={56} line={18} height={12} />
        <SkeletonLine width={at ? '52%' : '40%'} line={24} height={14} />
      </View>
    </View>)}
  </View>;
  if (variant === 'person') return <View {...hidden} style={s.personScreen}>
    <View style={s.personRow}>
      <SkeletonBlock width={56} height={56} radius={sys.radius.pill} />
      <View style={s.personCopy}>
        <SkeletonLine width="64%" line={26} height={20} />
        <SkeletonLine width={96} line={18} height={12} />
      </View>
    </View>
    <SkeletonLine width="56%" line={24} height={18} />
    <View style={s.starRow}>{Array.from({ length: 5 }, (_, at) => <SkeletonBlock key={at} width={40} height={40} radius={sys.radius.control} />)}</View>
    <View style={s.tagSection}>
      <SkeletonLine width="48%" line={24} height={18} />
      <View style={s.tags}>{[104, 80, 128, 96].map((width, at) => <SkeletonBlock key={at} width={width} height={48} radius={sys.radius.pill} />)}</View>
    </View>
  </View>;
  // `plain`, which is also what a shape nobody listed waits as: a title and its lines over a quiet foot.
  return <View {...hidden} style={s.plain}>
    <SkeletonBlock width="78%" height={22} radius={7} />
    {Array.from({ length: lines }, (_, at) => <SkeletonBlock key={at} width={at ? '44%' : '60%'} height={14} radius={6} />)}
    <View style={s.plainFoot}><SkeletonBlock width={112} height={24} radius={7} /><SkeletonBlock width={58} height={18} radius={6} /></View>
  </View>;
}

export type SkeletonListProps = {
  /** How many items. */ count?: number;
  /**
   * Lines inside each item: a `row` has 1 to 3 (2 by default), a `record` its fact lines (2), a `fact` 1 or 2 (1); an older shape keeps the
   * meaning it always had.
   */
  rows?: number;
  variant?: SkeletonVariant;
  /** `row`: the slot holds a person's face (56). */ face?: boolean;
  /** `row`: a `Section` title's bar over the rows. */ heading?: boolean;
  /** `row`: a switch at the end of every row instead of a picture at the start (a settings list, 56 dp rows). */ switches?: boolean;
  /** `record`: a person's picture and two lines at the foot of every record. */ foot?: boolean;
  /** For a caller that has no sentence of its own under the list: the one thing a screen reader is told about the whole block. */ label?: string;
};

/** The distance between two placeholders: what stands between two real ones (`ListRow`s part by their rule alone). */
const GAP: Partial<Record<SkeletonVariant, number>> = { row: 0, record: layout.group, fact: sys.space.sm };

export function SkeletonList({ count = 3, rows, variant, face = false, heading = false, switches = false, foot = false, label }: SkeletonListProps) {
  const opacity = useBreath();
  // Thread items part themselves with their own hairline, as the loaded thread does; rows with their rule; every other shape stands 12 apart.
  const spacing = variant === 'thread' ? undefined : variant !== undefined && variant in GAP ? { gap: GAP[variant] } : s.list;
  return <Animated.View accessible={label ? true : undefined} accessibilityLabel={label} {...hidden} accessibilityElementsHidden={!label}
    style={[spacing, { opacity }]}>
    {variant === 'row' && heading ? <View style={s.listHeading}><TextBar width={112} line={sys.type.heading.lineHeight} height={18} /></View> : null}
    {Array.from({ length: count }, (_, index) => <SkeletonCard key={index} rows={rows} variant={variant} face={face} switches={switches} foot={foot}
      last={index === count - 1} index={index} />)}
  </Animated.View>;
}

/**
 * What a list of anything shows while its first read is on its way: `count` placeholders in the shape of what is coming, breathing as
 * ONE (a single loop for the list, never one per block; still under reduced motion), and nothing that can be pressed. It is
 * `SkeletonList` with the row for its default, under the name the primitives of the grid are called by: `<Skeleton variant="row" count={5} />`.
 */
export function Skeleton(props: SkeletonListProps) {
  return <SkeletonList variant="row" {...props} />;
}

const s = StyleSheet.create({
  taskDetail: { gap: sys.space.base },
  detailTitle: { gap: sys.space.xs },
  detailFacts: { gap: sys.space.lg },
  // The plain card: the card frame, its lines 10 apart, and a quiet foot under a hairline.
  plain: { ...cardCompact, gap: 10 },
  plainFoot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 6, paddingTop: 14, borderTopWidth: 1, borderTopColor: sys.color.line },
  grow: { flex: 1, minWidth: 0 },
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  line: { justifyContent: 'center' },
  fact: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1 },
  list: { gap: 12 },
  // ReviewPreview's card (ReviewPresentation s.card): the compact card, head and facts 8 apart, nothing under them.
  preview: { ...cardCompact, gap: sys.space.sm },
  // The composer's task face (ApplicationComposerPresentation s.task): bare, over its own hairline.
  face: { gap: sys.space.sm, paddingBottom: sys.space.lg, borderBottomWidth: 1, borderColor: sys.color.line },
  // One Q&A item (TaskQaPresentation s.item / s.answer): the rule is drawn in the placeholder tone, not the green.
  threadItem: { gap: sys.space.sm, paddingVertical: sys.space.md, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: sys.color.cardLine },
  answer: { gap: sys.space.xs, paddingLeft: sys.space.md, borderLeftWidth: 3, borderLeftColor: sys.color.skeleton },
  // The Izmene terms (AgreementActionsPresentation s.facts / s.fact): 24 px drawing, label over value.
  factRows: { gap: sys.space.md },
  factRow: { flexDirection: 'row', alignItems: 'flex-start', gap: sys.space.md },
  factCopy: { flex: 1, minWidth: 0, gap: 2 },
  // The rating screen (AgreementReviewPresentation s.content / s.person / s.starRow / s.section / s.tags).
  personScreen: { gap: sys.space.lg },
  personRow: { flexDirection: 'row', alignItems: 'center', gap: sys.space.base },
  personCopy: { flex: 1, minWidth: 0, gap: sys.space.xs },
  starRow: { flexDirection: 'row', justifyContent: 'center', gap: sys.space.sm },
  tagSection: { gap: sys.space.sm, paddingTop: sys.space.lg, borderTopWidth: 1, borderColor: sys.color.line },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: sys.space.sm, paddingTop: sys.space.xs },
  // The shapes of the system, each with the numbers of the primitive it stands for (`ListRow`, `FactRow`, `Surface kind="record"`).
  listRow: { flexDirection: 'row', alignItems: 'center', gap: sys.space.md, paddingVertical: sys.space.md },
  listSlot: { alignItems: 'center', justifyContent: 'center' },
  listCopy: { flex: 1, minWidth: 0 },
  // The divider is not a border, as in `ListRow`: it begins where the words begin, and the last row of a group draws none.
  listRule: { position: 'absolute', right: 0, bottom: 0, height: ruleWidth, backgroundColor: sys.color.line },
  // A `Section` title is 24 high and stands 12 above what it holds.
  listHeading: { marginBottom: layout.group },
  factBox: { flexDirection: 'row', alignItems: 'flex-start', gap: sys.space.md },
  // The face of a task (`TaskRecordBody`): 12 between its parts, 4 inside the lead and the facts, the person 40 high.
  recBody: { gap: sys.space.md },
  recLead: { gap: sys.space.xs },
  recDecision: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', columnGap: sys.space.base },
  recFacts: { gap: sys.space.xs },
  // The amount's row of a task's card (`TaskRecordBody`'s valueCopy): the sum and what it buys on one line, 8 apart.
  taskAmount: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', columnGap: sys.space.sm },
  taskFacts: { gap: sys.space.sm },
  taskFact: { flexDirection: 'row', alignItems: 'flex-start', gap: sys.space.sm },
  taskFoot: { paddingTop: sys.space.md, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: sys.color.line },
  recFoot: { flexDirection: 'row', alignItems: 'center', gap: sys.space.md },
});
